// 친구와 파티: 방 만들기·들어가기 로비 + 경기 중 주고받기
// 방장 기기가 문제·라운드 순서·봇을 정하고, 각자 자기 말랑이를 움직여 1초에 15번 위치를 보낸다(방장이 모아서 모두에게 다시 보냄).
// 라운드는 모두 불러온 뒤(ready) 방장이 begin을 보내면 함께 시작하고, 끝도 방장이 정한다.
import { hostRoom, joinRoom, NET_V, MAX_PLAYERS } from './net.js';
import { save, persist } from '../save.js';
import { CHARACTERS, ROUNDS, BOT_NAMES } from '../data/game.js';
import { questionSet } from '../quiz.js';
import { Q_PER_ROUND, roundOrder } from '../game/party.js';
import { portrait } from '../ui/portrait.js';
import { audio } from '../audio.js';
import { esc } from '../game/hud.js';
import { setState } from '../engine/physics.js';

const $ = id => document.getElementById(id);
let app = null, link = null, isHost = false, myPid = null, players = [], mode = 'show', useBots = true, net = null, inGame = false;
const ST = ['normal', 'dive', 'slide', 'getup', 'knock', 'stun', 'frozen', 'launch', 'fallen'];

export function openLobby(a, code = '') {
  app = a;
  app.go('lobby');
  $('lobbyJoin').hidden = false; $('lobbyRoom').hidden = true;
  document.body.classList.remove('host');
  $('netStatus').textContent = '';
  $('joinCode').value = code || '';
  bindOnce();
  if (code) setTimeout(() => join(code), 300);
}

let bound = false;
function bindOnce() {
  if (bound) return; bound = true;
  const act = (name, fn) => document.querySelectorAll(`[data-act="${name}"]`).forEach(b => b.addEventListener('click', fn));
  act('createRoom', create);
  act('joinRoom', () => join($('joinCode').value.trim().toUpperCase()));
  act('copyLink', () => { navigator.clipboard?.writeText(inviteLink()).then(() => app.toast('초대 링크를 복사했어요'), () => app.toast(inviteLink())); });
  act('roomLeave', () => { leave(); app.go('menu', { reset: true }); });
  act('roomStart', startGame);
  document.querySelector('#scr-lobby [data-act=back]')?.addEventListener('click', () => leave());
  act('roomChar', () => {
    const own = CHARACTERS.filter(c => save.ownedChars.includes(c.id));
    const i = own.findIndex(c => c.id === save.selChar);
    save.selChar = own[(i + 1) % own.length].id; persist();
    const me = players.find(p => p.pid === myPid); if (me) me.charId = save.selChar;
    if (isHost) broadcastRoom(); else link?.send({ t: 'me', charId: save.selChar, hat: save.equip.hat });
    drawRoom();
  });
  $('joinCode').addEventListener('keydown', e => { if (e.code === 'Enter') join($('joinCode').value.trim().toUpperCase()); });
  $('roomBots').addEventListener('change', e => { useBots = e.target.checked; broadcastRoom(); });
}
const inviteLink = () => `${location.origin}${location.pathname}?room=${link?.code || ''}`;
const meInfo = () => ({ name: save.settings.name || '친구', charId: save.selChar, hat: save.equip.hat, trail: save.equip.trail });

// ---- 방장 ----
async function create() {
  $('netStatus').textContent = '방을 여는 중...';
  try {
    isHost = true; myPid = 'h0';
    players = [{ pid: 'h0', slot: 0, host: true, ...meInfo(), name: save.settings.name || '방장' }];
    link = await hostRoom({
      status: (s, d) => { if (s === 'ready') { $('netStatus').textContent = '친구를 기다리는 중'; showRoom(); } else if (s === 'error') { $('netStatus').textContent = '연결 오류: ' + d; app.toast('방을 열지 못했어요. 인터넷 연결을 확인해 주세요'); } },
      join: () => {},
      leave: slot => { const p = players.find(x => x.slot === slot); if (p) { p.off = true; if (!inGame) players = players.filter(x => x !== p); broadcastRoom(); app.toast(`${p.name}이(가) 나갔어요`); } },
      data: (m, slot) => onHostData(m, slot),
      held: () => false,
    });
  } catch (e) { $('netStatus').textContent = String(e.message || e); }
}
function onHostData(m, slot) {
  if (m.t === 'hello') {
    if (m.v !== NET_V) { link.drop(slot, { t: 'deny', why: '게임 판이 달라요. 화면을 새로고침한 뒤 다시 들어와 주세요' }); return; }
    // 같은 이름이 끊겼다 다시 오면 원래 자리로
    const back = players.find(p => p.off && p.name === m.name);
    if (back) { link.move(slot, back.slot); back.off = false; slot = back.slot; }
    else {
      if (players.filter(p => !p.off).length >= MAX_PLAYERS) { link.drop(slot, { t: 'deny', why: '방이 꽉 찼어요 (최대 8명)' }); return; }
      if (inGame) { link.drop(slot, { t: 'deny', why: '파티가 벌써 시작했어요. 다음 판에 들어와 주세요' }); return; }
      players.push({ pid: 'g' + slot, slot, name: m.name, charId: m.charId, hat: m.hat, trail: m.trail });
    }
    link.send(slot, { t: 'welcome', pid: 'g' + slot });
    broadcastRoom(); audio.play('coin');
  } else if (m.t === 'me') {
    const p = players.find(x => x.slot === slot); if (p) { p.charId = m.charId; p.hat = m.hat; broadcastRoom(); }
  } else if (m.t === 's') { net?.onState(m.d); }
  else if (m.t === 'ready') { net?.onReady(m.pid); }
  else if (m.t === 'ev') { net?.onEvent(m, true); }
}
function broadcastRoom() {
  const room = { t: 'room', players: players.filter(p => !p.off).map(p => ({ pid: p.pid, name: p.name, charId: p.charId, hat: p.hat, host: !!p.host })), subj: `${save.grade}학년 ${save.semester}학기 · ${save.subject}`, mode, bots: useBots };
  link?.broadcast(room);
  drawRoom(room);
}
function showRoom() {
  $('lobbyJoin').hidden = true; $('lobbyRoom').hidden = false;
  document.body.classList.toggle('host', isHost);
  $('roomCode').textContent = link.code;
  import('./qr.js').then(m => m.qrSvg(inviteLink())).then(svg => { $('roomQr').innerHTML = svg; }).catch(() => { $('roomQr').textContent = ''; });
  if (isHost) {
    const seg = $('roomMode'); seg.innerHTML = '';
    for (const [v, label] of [['show', '🎉 파티 쇼'], ...ROUNDS.map(r => [r.id, r.icon + ' ' + r.name.replace('결승: ', '')])]) {
      const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', v === mode);
      b.onclick = () => { audio.play('click'); mode = v; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); broadcastRoom(); };
      seg.appendChild(b);
    }
    broadcastRoom();
  }
}
let lastRoom = null;
async function drawRoom(room = lastRoom) {
  if (!room) room = { players: players.filter(p => !p.off), subj: `${save.grade}학년 ${save.semester}학기 · ${save.subject}` };
  lastRoom = room;
  $('roomSubj').innerHTML = `문제: <b>${esc(room.subj)}</b><br>(방장의 학년·과목)`;
  const box = $('roomSlots'); box.innerHTML = '';
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = room.players[i], d = document.createElement('div');
    d.className = 'slot' + (p ? (p.host ? ' host' : '') : ' empty');
    if (p) { const img = await portrait(p.charId, p.hat || 'none'); d.innerHTML = `<img src="${img}"><span>${esc(p.name)}${p.pid === myPid ? ' (나)' : ''}</span>`; }
    else d.innerHTML = room.bots !== false && isHost && useBots ? '<span>🤖 봇</span>' : '<span>빈자리</span>';
    box.appendChild(d);
  }
  if (!isHost) $('roomWait').textContent = `방장이 출발하기를 기다리는 중... (${room.mode === 'show' ? '파티 쇼' : ROUNDS.find(r => r.id === room.mode)?.name || ''})`;
}

// ---- 친구 ----
async function join(code) {
  if (!/^[A-Z]{5}$/.test(code)) { app.toast('방 코드 5글자를 넣어 주세요'); return; }
  $('netStatus').textContent = '방을 찾는 중...';
  isHost = false;
  try {
    link = await joinRoom(code, {
      status: (s, d) => {
        if (s === 'connected') { $('netStatus').textContent = '연결됐어요'; link.send({ t: 'hello', v: NET_V, ...meInfo() }); }
        else if (s === 'closed') { app.toast('방장과 연결이 끊겼어요'); endNet(); }
        else if (s === 'error') { $('netStatus').textContent = ''; app.toast(d === 'peer-unavailable' ? '그 코드의 방이 없어요' : d === 'unreachable' ? '방은 찾았는데 방장 기기와 이어지지 않아요 (와이파이 확인)' : '연결 오류: ' + d); }
      },
      data: m => onGuestData(m),
    });
  } catch (e) { app.toast(String(e.message || e)); }
}
function onGuestData(m) {
  if (m.t === 'welcome') { myPid = m.pid; showRoom(); }
  else if (m.t === 'deny') { app.toast(m.why); leave(); }
  else if (m.t === 'room') { players = m.players; drawRoom(m); }
  else if (m.t === 'start') beginParty(m);
  else if (m.t === 'S') net?.onSnapshot(m.list);
  else if (m.t === 'begin') net?.onBegin();
  else if (m.t === 'ev') net?.onEvent(m, false);
  else if (m.t === 'end') net?.onEnd(m.text);
  else if (m.t === 'next') net?.onNext();
  else if (m.t === 'bye') { app.toast('방장이 방을 닫았어요'); endNet(); }
}
function leave() {
  if (link) { if (isHost) link.broadcast({ t: 'bye' }); setTimeout(() => { try { link?.close(); } catch (e) { } link = null; }, 200); }
  inGame = false; net = null;
}
function endNet() { const was = inGame; leave(); if (was) app.quitToMenu(); else app.go('menu', { reset: true }); }

// ---- 경기 시작 ----
function startGame() {
  if (!isHost) return;
  const humans = players.filter(p => !p.off);
  const order = roundOrder(mode);
  const qs = {}; order.forEach((id, i) => qs[i] = questionSet(Q_PER_ROUND[id]));
  const roster = humans.map(p => ({ pid: p.pid, name: p.name, charId: p.charId, hat: p.hat, trail: p.trail || 'none' }));
  if (useBots) {
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const hats = ['none', 'flower', 'bow', 'cap', 'headset', 'goggles', 'horn', 'wizard'];
    for (let i = roster.length; i < 12; i++) roster.push({ pid: 'bot' + i, name: names[i % names.length], charId: CHARACTERS[i % CHARACTERS.length].id, hat: hats[i % hats.length], trail: 'none', bot: true });
  }
  const m = { t: 'start', order, qs, roster, seed: Math.floor(Math.random() * 1e9), subj: { grade: save.grade, semester: save.semester, subject: save.subject } };
  link.broadcast(m);
  beginParty(m);
}
function beginParty(m) {
  inGame = true;
  if (!isHost) {
    // 방장의 학년·과목으로 기록한다
    Object.assign(save, m.subj);
    app.toast(`방장의 ${m.subj.grade}학년 ${m.subj.semester}학기 ${m.subj.subject} 문제로 풀어요`);
  }
  net = makeNet(m);
  const roster = m.roster.map(r => ({ ...r, me: r.pid === myPid, remote: r.pid !== myPid && (!r.bot || !isHost), bot: !!r.bot }));
  app.startParty({ mode: m.order.length > 1 ? 'show' : m.order[0], order: m.order, roster, net, questionsFor: async (id, idx) => m.qs[idx] });
}

// 경기 중 통신
function makeNet(start) {
  let session = null, sendT = 0, ready = new Set(), beginRes = null, beginTimer = 0, nextFn = null;
  const n = {
    isHost, myPid, seed: start.seed,
    attach(s) { session = s; ready = new Set(); },
    // 라운드를 다 불러오면: 친구는 ready를 보내고, 방장은 모두 준비되거나 8초가 지나면 begin
    waitBegin() {
      return new Promise(res => {
        beginRes = res;
        if (isHost) {
          ready.add(myPid);
          const check = () => { const need = session.players.filter(p => !p.bot).map(p => p.pid); if (need.every(pid => ready.has(pid))) go(); };
          const go = () => { clearTimeout(beginTimer); if (!beginRes) return; link.broadcast({ t: 'begin' }); const r = beginRes; beginRes = null; r(); };
          n.onReady = pid => { ready.add(pid); check(); };
          beginTimer = setTimeout(go, 8000); check();
        } else link.send({ t: 'ready', pid: myPid });
      });
    },
    onReady(pid) { ready.add(pid); },
    onBegin() { const r = beginRes; beginRes = null; r?.(); },
    // 1초에 15번 내 상태(방장은 모두의 상태)를 보낸다
    tick(s, dt) {
      sendT -= dt; if (sendT > 0) return; sendT = 1 / 15;
      const pack = p => { const b = p.body; return [p.pid, +b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(2), +b.vx.toFixed(1), +b.vy.toFixed(1), +b.vz.toFixed(1), ST.indexOf(b.state), b.grounded ? 1 : 0, p.stars, p.finished ? 1 : 0, p.place || 0, p.level || 0, p.view?.emote === 'cheer' ? 1 : 0, p.coins || 0]; };
      if (isHost) link.broadcast({ t: 'S', list: s.players.filter(p => !p.remote || p.netD).map(p => p.remote ? p.netD : pack(p)) });
      else { const me = s.me; if (me) link.send({ t: 's', d: pack(me) }); }
    },
    onState(d) { if (session) applyOne(session, d); },
    onSnapshot(list) { if (session) for (const d of list) if (d[0] !== myPid) applyOne(session, d); },
    event(k, data) { const m = { t: 'ev', k, pid: myPid, ...data }; if (isHost) link.broadcast(m); else link.send(m); },
    onEvent(m, fromGuest) {
      if (isHost && fromGuest) link.broadcast(m);
      if (m.pid === myPid || !session) return;
      session.round.onNet?.(m);
    },
    endRound(text) { if (isHost) link.broadcast({ t: 'end', text }); },
    onEnd(text) { session?.endRound(text, true); },
    next() { if (isHost) link.broadcast({ t: 'next' }); },
    onNext() { const f = nextFn; nextFn = null; f?.(); },
    waitNext(f) { nextFn = f; },
    leave() { leave(); },
    onResult() { inGame = false; },
  };
  return n;
}
// 받은 상태를 그 사람의 몸에 넣는다 (그릴 때 부드럽게 따라감)
function applyOne(s, d) {
  const p = s.players.find(x => x.pid === d[0]); if (!p || !p.remote) return;
  p.netD = d;
  p.net = { x: d[1], y: d[2], z: d[3], yaw: d[4], vx: d[5], vy: d[6], vz: d[7], st: ST[d[8]] || 'normal', g: !!d[9] };
  p.stars = d[10]; p.finished = !!d[11]; p.place = d[12]; p.level = d[13];
  if (p.view) p.view.emote = d[14] ? 'cheer' : null;
  if (!p.netInit) { const b = p.body; b.x = d[1]; b.y = d[2]; b.z = d[3]; p.netInit = true; }
}

// 결과 화면에서 "다시 하기": 같은 방 대기실로 돌아간다 (방장이 다시 출발)
export function backToRoom(a) {
  app = a; inGame = false; net = null;
  if (!link) { app.go('menu', { reset: true }); return; }
  app.go('lobby', { reset: true });
  $('lobbyJoin').hidden = true; $('lobbyRoom').hidden = false;
  document.body.classList.toggle('host', isHost);
  if (isHost) broadcastRoom(); else drawRoom();
}
export function leaveRoom() { leave(); }
