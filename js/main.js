// 화면 흐름: 로딩 → 타이틀 → 학년·학기·과목 → 메뉴 → (혼자 파티 / 친구와 파티 / 상점 / 공부 기록 / 설정) → 파티 → 결과
import * as THREE from 'three';
import { initCore, renderer, applyQuality, low } from './engine/core.js';
import { loadManifest, loadGLB } from './engine/assets.js';
import { modelName } from './engine/figure.js';
import { initTouch, input, clearInput } from './engine/input.js';
import { audio } from './audio.js';
import { save, persist, resetSave, touchDevice } from './save.js';
import { loadQuestions, subjectsFor, nextQuestion, recordAnswer, notesFor, subjectKey, bankSize } from './quiz.js';
import { stopSpeak, speakQuestion } from './tts.js';
import { CHARACTERS, HATS, TRAILS, ROUNDS, ANSWER_STYLE, charById } from './data/game.js';
import { Party, soloRoster, Q_PER_ROUND } from './game/party.js';
import { hud, esc } from './game/hud.js';
import { portrait } from './ui/portrait.js';
import { showHero, hideHero } from './ui/showcase.js';
import { cover } from './ui/cover.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let screen = 'loading', stack = [], party = null, session = null;
const app = { go, toast, confirm: askConfirm, quizModal };

if (touchDevice) document.body.classList.add('touch');

// ---------- 시작 ----------
async function boot() {
  const bar = $('loadBar'), txt = $('loadText');
  const step = (k, t) => { bar.style.width = (k * 100) + '%'; txt.textContent = t; };
  step(0.05, '무대를 준비하는 중...');
  initCore();
  initTouch();
  await loadManifest();
  step(0.2, '소리를 불러오는 중...');
  await Promise.all([audio.init(), loadQuestions(), document.fonts.load('40px "Black Han Sans"'), document.fonts.load('40px "PretendardEB"'), document.fonts.load('800 20px Pretendard')].map(p => p.catch?.(() => {}) ?? p));
  step(0.55, '대원들을 깨우는 중...');
  await Promise.all([...CHARACTERS.map(c => loadGLB(modelName(c.id, false))), ...CHARACTERS.map(c => loadGLB(modelName(c.id, true))), ...HATS.filter(h => h.id !== 'none').map(h => loadGLB('hat_' + h.id))]);
  step(0.9, '거의 다 됐어요!');
  await loadTitleArt();
  step(1, '');
  requestAnimationFrame(loop);
  if (params.get('play')) { quickPlay(params.get('play')); return; }
  // 초대 링크(?room=코드)로 오면 바로 그 방으로
  if (params.get('room')) { const code = params.get('room').toUpperCase(); history.replaceState(null, '', location.pathname); import('./net/lobby.js').then(x => x.openLobby(app, code)); return; }
  go('title', { reset: true });
}
async function loadTitleArt() {
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = 'assets/images/title.png'; });
  if (img.naturalWidth) $('titleBg').style.backgroundImage = `url(assets/images/title.png)`;
  // 메뉴 아이콘 그림 (있으면)
  document.querySelectorAll('.tile .ic[data-icon]').forEach(el => {
    const im = new Image(); im.onload = () => { el.textContent = ''; el.appendChild(im); }; im.src = `assets/images/${el.dataset.icon}.png`;
  });
  // 타이틀 색종이
  const cf = $('titleConfetti'), cols = ['#ff4f9a', '#ffcf3a', '#2ed8ff', '#3fe08a', '#a46bff'];
  for (let i = 0; i < (low() ? 10 : 20); i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length];
    c.style.animationDuration = (6 + Math.random() * 7) + 's'; c.style.animationDelay = (-Math.random() * 12) + 's';
    c.style.transform = `rotate(${Math.random() * 360}deg)`; cf.appendChild(c);
  }
}

// ---------- 그리기 루프 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (session) session.frame(dt);
  hud.update(dt);
  requestAnimationFrame(loop);
}

// ---------- 화면 전환 ----------
function go(id, { back = false, reset = false, wipe = true } = {}) {
  if (reset) stack = [];
  else if (!back && screen && screen !== id && screen !== 'loading') stack.push(screen);
  const doIt = () => {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
    screen = id;
    if (id !== 'menu') hideHero();
    onEnter[id]?.();
  };
  if (wipe && screen !== 'loading') { const w = $('wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); audio.play('whoosh', { vol: 0.5 }); setTimeout(doIt, 400); }
  else doIt();
}
function goBack() { const prev = stack.pop(); audio.play('back'); if (prev) go(prev, { back: true }); }

// ---------- 버튼 공통 (물결, 소리, 포커스 해제) ----------
document.addEventListener('pointerdown', e => {
  audio.unlock();
  const b = e.target.closest('.btn, .ctile, .tile, .qbtn, .cv-arrow, .tabs button, .seg button, .hbtn, #fsBtn');
  if (!b) return;
  const r = b.getBoundingClientRect(), d = document.createElement('span');
  const s = Math.max(r.width, r.height); d.className = 'ripple';
  d.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.appendChild(d); setTimeout(() => d.remove(), 600);
});
document.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .ctile, .tile'); if (b && !b.contains(e.relatedTarget)) audio.play('hover', { vol: 0.5, gap: 0.06 }); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  b.blur();
  if (act !== 'back') audio.play('click');
  actions[act]?.(b);
});
$('fsBtn').addEventListener('click', () => {
  audio.play('click');
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
});
addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (session && !$('pause').hidden) actions.resume(); else if (session) actions.pause(); else if (stack.length && !['title', 'loading'].includes(screen)) goBack(); }
});

const actions = {
  back: goBack,
  start() { go('grade'); },
  option() { go('settings'); },
  settings() { go('settings'); },
  changeSubject() { go('grade'); },
  single() { pickMode(); },
  multi() { import('./net/lobby.js').then(m => m.openLobby(app)).catch(e => { console.error(e); toast('친구와 파티를 열지 못했어요'); }); },
  shop() { go('shop'); },
  record() { go('record'); },
  resetSave() { askConfirm('기록과 코인을 모두 지울까요?', () => resetSave()); },
  pause() { if (!session) return; session.paused = true; $('pause').hidden = false; input.enabled = false; audio.duck(true); stopSpeak(); },
  resume() { if (!session) return; $('pause').hidden = true; session.paused = false; audio.duck(false); clearInput(); input.enabled = session.phase === 'play'; },
  pauseSettings() { $('pause').hidden = true; go('settings'); $('scr-settings').classList.add('over'); },
  quitGame() { $('pause').hidden = true; audio.duck(false); quitToMenu(); },
  boardGo() { boardGoFn?.(); },
  resAgain() { if (party?.net) { const p = party; party = null; import('./net/lobby.js').then(x => x.backToRoom(app)); return; } if (lastSetup) startParty(lastSetup); },
  resHome() { if (party?.net) { import('./net/lobby.js').then(x => x.leaveRoom()); party = null; } go('menu', { reset: true }); },
};

// ---------- 화면별 ----------
const onEnter = {
  title() { audio.playBgm('title'); document.body.classList.remove('ingame'); },
  // 학년: 팔레트 위 물감 방울 6개
  grade() {
    audio.playBgm('menu');
    const g = $('gradeGrid'); g.innerHTML = ''; g.className = 'choice-grid palette';
    for (let i = 1; i <= 6; i++) {
      const b = document.createElement('button'); b.className = `blob k${i - 1}`; b.style.animationDelay = (i * 0.05) + 's';
      b.innerHTML = `<b>${i}</b><small>학년</small>`; b.onclick = () => pickPaint(b, () => { save.grade = i; persist(); go('semester'); }); g.appendChild(b);
    }
  },
  // 학기: 물감통 2개
  semester() {
    const g = $('semGrid'); g.innerHTML = ''; g.className = 'choice-grid cans';
    for (let i = 1; i <= 2; i++) {
      const b = document.createElement('button'); b.className = `can k${i === 1 ? 3 : 4}`; b.style.animationDelay = (i * 0.08) + 's';
      b.innerHTML = `<span class="body"><b>${i}</b><small>학기</small></span><span class="lid"></span><span class="drip"><i></i><i></i><i></i></span>`;
      b.onclick = () => pickPaint(b, () => { save.semester = i; persist(); go('subject'); }); g.appendChild(b);
    }
  },
  // 과목: 대원 배지
  subject() {
    const g = $('subjGrid'); g.innerHTML = '';
    const subs = subjectsFor(save.grade);
    g.className = 'choice-grid badges ' + (subs.length === 3 ? 'g3' : 'g5');
    const icon = { 국어: '📖', 수학: '🔢', 통합: '🌈', 사회: '🗺️', 과학: '🔬', 영어: '🔤' };
    subs.forEach((s, i) => {
      const b = document.createElement('button'); b.className = `badge k${[0, 4, 2, 3, 5][i % 5]}`; b.style.animationDelay = (i * 0.06) + 's';
      b.innerHTML = `<span class="disc">${icon[s] || '⭐'}</span><b>${s}</b>`;
      b.onclick = () => pickPaint(b, () => { save.subject = s; save.picked = true; persist(); if (pendingJoin) { const j = pendingJoin; pendingJoin = null; j(); } else go('menu', { reset: true }); });
      g.appendChild(b);
    });
  },
  menu() {
    audio.playBgm('menu'); document.body.classList.remove('ingame');
    $('menuInfo').textContent = `${save.grade}학년 ${save.semester}학기 · ${save.subject}`;
    setCoins($('menuCoins'));
    const ch = CHARACTERS.find(c => c.id === save.selChar) || CHARACTERS[0];
    $('heroName').innerHTML = `<small>${ch.animal}</small>${ch.name}`;
    showHero($('heroCanvas'), save.selChar, save.equip.hat);
  },
  settings() { buildSettings(); },
  record() { buildRecord(); },
  shop() { buildShop(); },
};
// 물감 고르기: 누른 곳이 퐁 튀고 잠깐 뒤 넘어간다 (두 번 눌러도 한 번만)
function pickPaint(b, next) {
  if (b.parentElement.dataset.busy) return;
  b.parentElement.dataset.busy = '1'; setTimeout(() => { delete b.parentElement.dataset.busy; }, 900);
  audio.play('splash', { vol: 0.6 }); b.classList.add('hit');
  setTimeout(next, 180);
}
function setCoins(el, bump) { el.textContent = save.coins.toLocaleString(); if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }

// ---------- 설정 ----------
function seg(el, opts, cur, onPick) {
  el.innerHTML = '';
  for (const [v, label] of opts) {
    const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', v === cur);
    b.onclick = () => { audio.play('click'); el.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(v); persist(); };
    el.appendChild(b);
  }
}
function buildSettings() {
  const st = save.settings;
  const bgm = $('setBgm'), sfx = $('setSfx');
  bgm.value = st.bgm; sfx.value = st.sfx;
  bgm.oninput = () => { st.bgm = +bgm.value; audio.applyVolume(); persist(); };
  sfx.oninput = () => { st.sfx = +sfx.value; audio.applyVolume(); persist(); };
  sfx.onchange = () => audio.play('coin');
  seg($('setTts'), [['auto', '1~2학년만'], ['on', '켜기'], ['off', '끄기']], st.tts, v => { st.tts = v; if (v === 'on') speakQuestion({ q: '문제를 읽어 줄게요', c: [] }, true); });
  seg($('setTimer'), [['relaxed', '넉넉하게'], ['normal', '보통'], ['fast', '빠르게']], st.timer, v => st.timer = v);
  seg($('setBots'), [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], st.bots, v => st.bots = v);
  seg($('setQuality'), [['high', '선명하게'], ['low', '가볍게 (태블릿)']], st.quality, v => { st.quality = v; applyQuality(); toast('다음 판부터 적용돼요'); });
  seg($('setShake'), [[true, '켜기'], [false, '끄기']], st.shake, v => st.shake = v);
  const nm = $('setName'); nm.value = st.name || ''; nm.oninput = () => { st.name = nm.value.trim().slice(0, 8); persist(); };
}

// ---------- 공부 기록 ----------
function buildRecord() {
  const key = subjectKey();
  $('recInfo').textContent = `${save.grade}학년 ${save.semester}학기 · ${save.subject}`;
  const recs = save.record || {};
  let c = 0, w = 0;
  const rows = [];
  for (const [k, r] of Object.entries(recs)) {
    c += r.c; w += r.w;
    const [g, s, sub] = k.split('-');
    rows.push(`<div><span>${g}-${s} ${sub}</span><b>${Math.round(r.c / Math.max(1, r.c + r.w) * 100)}% <small>(${r.c}/${r.c + r.w})</small></b></div>`);
  }
  const pct = Math.round(c / Math.max(1, c + w) * 100);
  $('recRing').style.background = `conic-gradient(#3fe08a ${pct * 3.6}deg, #2a3578 0)`;
  $('recRing').innerHTML = `<div style="width:110px;height:110px;border-radius:50%;background:#141a44;color:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column">${pct}%<small style="font-family:var(--read);font-weight:800;font-size:13px;color:#a3aedd">전체 정답률</small></div>`;
  $('recTable').innerHTML = (rows.length ? rows.join('') : '<p class="empty">아직 기록이 없어요. 파티에 참가해 보세요!</p>')
    + `<div style="margin-top:8px;background:rgba(255,207,58,.16)"><span>파티 참가</span><b>${save.stats.parties}번</b></div><div><span>우승</span><b>${save.stats.wins}번</b></div><div><span>왕관</span><b>${save.stats.crowns}개</b></div>`;
  const notes = notesFor(key);
  $('recCount').textContent = `(${notes.length}문제)`;
  const box = $('recNotes'); box.innerHTML = '';
  if (!notes.length) box.innerHTML = '<p class="empty">이 과목의 오답 노트가 비어 있어요 🎉</p>';
  for (const n of notes) {
    const d = document.createElement('div'); d.className = 'note';
    d.innerHTML = `<div class="nq">${esc(n.q)}<div class="na">정답: ${esc(n.c[n.a])}</div></div><div class="nw">틀림 ${n.wrong} · 연속 ${n.streak}/2</div>`;
    const b = document.createElement('button'); b.className = 'btn small mint'; b.textContent = '다시 풀기';
    b.onclick = () => { audio.play('click'); quizModal({ ...n }, ok => { recordAnswer({ q: n.q, c: n.c, a: n.a, e: n.e }, ok); setTimeout(buildRecord, 300); }, { tag: '오답 노트 다시 풀기', noShuffle: false }); };
    d.appendChild(b); box.appendChild(d);
  }
}

// ---------- 문제 모달 (상점·오답 노트) ----------
function quizModal(q0, done, { tag = '복습 문제', retry = false } = {}) {
  // 보기 섞기
  const order = q0.c.map((_, i) => i).sort(() => Math.random() - 0.5);
  const q = { q: q0.q, c: order.map(i => q0.c[i]), a: order.indexOf(q0.a), e: q0.e };
  const m = $('quiz'); m.hidden = false;
  $('quizTag').textContent = tag; $('quizQ').textContent = q.q; $('quizE').textContent = '';
  const box = $('quizC'); box.innerHTML = ''; box.className = 'quiz-choices' + (q.c.length === 3 ? ' n3' : '');
  $('quizBtns').innerHTML = '';
  speakQuestion(q);
  let answered = false;
  q.c.forEach((c, i) => {
    const b = document.createElement('button'); b.className = `qbtn c${i}`;
    b.innerHTML = `<i>${ANSWER_STYLE[i].shape}</i><span>${esc(c)}</span>`;
    b.onclick = () => {
      if (answered) return; answered = true; stopSpeak();
      const ok = i === q.a;
      const right = box.children[q.a]; right.classList.add('right'); right.insertAdjacentHTML('beforeend', '<span class="wrap"></span>');
      if (!ok) b.classList.add('wrongpick');
      audio.play(ok ? 'correct' : 'wrong');
      $('quizE').textContent = (ok ? '정답! ' : '아쉬워요. ') + (q.e || '');
      const close = document.createElement('button'); close.className = 'btn big ' + (ok ? 'pink' : 'blue'); close.textContent = ok ? '좋아요!' : '확인';
      close.onclick = () => { audio.play('click'); m.hidden = true; done(ok); };
      $('quizBtns').appendChild(close);
    };
    box.appendChild(b);
  });
}
function askConfirm(text, yes) {
  const m = $('confirm'); m.hidden = false; $('confirmText').textContent = text;
  $('confirmYes').onclick = () => { audio.play('click'); m.hidden = true; yes(); };
  $('confirmNo').onclick = () => { audio.play('back'); m.hidden = true; };
}
let toastT = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2000); }

// ---------- 상점 ----------
let shopTab = 'char', shopIdx = 0;
$('shopTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; audio.play('click'); shopTab = b.dataset.tab; shopIdx = 0; buildShop(); });
async function buildShop() {
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
  setCoins($('shopCoins'));
  const items = shopTab === 'char' ? CHARACTERS : shopTab === 'hat' ? HATS : TRAILS;
  const owned = id => shopTab === 'char' ? save.ownedChars.includes(id) : save.owned[shopTab].includes(id);
  const equipped = id => shopTab === 'char' ? save.selChar === id : save.equip[shopTab] === id;
  const cards = await Promise.all(items.map(async it => {
    let img;
    if (shopTab === 'char') img = await portrait(it.id, save.equip.hat);
    else if (shopTab === 'hat') img = await portrait(save.selChar, it.id);
    return { title: it.name, sub: shopTab === 'char' ? `${it.animal} · ${it.desc}` : it.id === 'none' ? '아무것도 안 해요' : (shopTab === 'hat' ? '머리에 쏙!' : '달릴 때 발밑에 반짝'), img, emoji: it.icon, lock: !owned(it.id), tag: equipped(it.id) ? '사용 중' : '' };
  }));
  cover($('shopCover'), cards, shopIdx, i => { shopIdx = i; panel(); }, () => act());
  function panel() {
    const it = items[shopIdx], p = $('shopPanel');
    if (equipped(it.id)) p.innerHTML = `<b>${it.name}</b> 사용 중이에요`;
    else if (owned(it.id)) { p.innerHTML = `<b>${it.name}</b>`; const b = btn('사용하기', 'mint'); b.onclick = act; p.appendChild(b); }
    else { p.innerHTML = `<b>${it.name}</b> <span class="coins" style="display:inline-flex">${it.price}</span>`; const b = btn('문제 풀고 사기', 'pink'); b.onclick = act; if (save.coins < it.price) { b.disabled = true; p.insertAdjacentHTML('beforeend', '<small style="color:#ff4f9a">코인이 모자라요</small>'); } p.appendChild(b); }
  }
  function act() {
    const it = items[shopIdx];
    if (equipped(it.id)) return;
    if (owned(it.id)) {
      if (shopTab === 'char') save.selChar = it.id; else save.equip[shopTab] = it.id;
      persist(); audio.play('purchase'); buildShop(); return;
    }
    if (save.coins < it.price) { toast('코인이 모자라요. 파티에서 모아 와요!'); return; }
    quizModal(nextQuestion(), ok => {
      if (ok) {
        save.coins -= it.price;
        if (shopTab === 'char') { save.ownedChars.push(it.id); save.selChar = it.id; } else { save.owned[shopTab].push(it.id); save.equip[shopTab] = it.id; }
        persist(); audio.play('purchase'); toast(`${it.name}을(를) 얻었어요!`); buildShop();
      } else toast('코인은 그대로예요. 다른 문제로 다시 도전!');
    }, { tag: `${it.name} 사기 · 맞히면 내 것!` });
  }
  panel();
}
function btn(t, c) { const b = document.createElement('button'); b.className = 'btn ' + c; b.textContent = t; return b; }

// ---------- 혼자 파티: 모드 → 캐릭터 ----------
const MODES = [{ id: 'show', name: '파티 쇼', icon: '🎉', rule: '라운드 3개 + 결승! 별을 가장 많이 모으면 우승', how: '약 8분 · 문제 20개쯤 · 8종 중 4라운드' }, ...ROUNDS.map(r => ({ ...r }))];
let modeIdx = 0, charIdx = 0, lastSetup = null;
function pickMode() {
  go('pick');
  $('pickTitle').textContent = '무엇을 할까요?';
  setCoins($('pickCoins'));
  $('botSel').style.display = '';
  seg($('botSel'), [['easy', '봇 쉬움'], ['normal', '봇 보통'], ['hard', '봇 어려움']], save.settings.bots, v => save.settings.bots = v);
  const cards = MODES.map(m => ({ title: m.name, sub: m.id === 'show' ? '전체 파티' : '라운드 연습', img: m.id === 'show' ? 'assets/images/title.png' : `assets/images/round_${m.id}.jpg`, emoji: m.icon }));
  const info = () => { const m = MODES[modeIdx]; $('pickInfo').innerHTML = `<b>${m.name}</b> · ${m.rule}<br><small>${m.how}</small>`; };
  cover($('pickCover'), cards, modeIdx, i => { modeIdx = i; info(); }, () => $('pickGo').click());
  info();
  $('pickGo').textContent = '선택!';
  $('pickGo').onclick = () => { audio.play('click'); pickChar(); };
}
async function pickChar() {
  go('pick');
  $('pickTitle').textContent = '누구로 할까요?';
  $('botSel').style.display = 'none';
  const list = CHARACTERS.filter(c => save.ownedChars.includes(c.id));
  charIdx = Math.max(0, list.findIndex(c => c.id === save.selChar));
  const cards = await Promise.all(list.map(async c => ({ title: c.name, sub: c.animal, img: await portrait(c.id, save.equip.hat) })));
  const info = () => { const c = list[charIdx]; $('pickInfo').innerHTML = `<b>${c.name}</b> · ${c.desc}<br><small>더 많은 친구는 상점에서 만날 수 있어요</small>`; };
  cover($('pickCover'), cards, charIdx, i => { charIdx = i; info(); }, () => $('pickGo').click());
  info();
  $('pickGo').textContent = '파티 시작!';
  $('pickGo').onclick = () => {
    audio.play('click');
    save.selChar = list[charIdx].id; persist();
    startParty({ mode: MODES[modeIdx].id });
  };
}

// ---------- 파티 실행 ----------
let boardGoFn = null, boardTimer = 0;
const partyUI = {
  setLoading(on) { $('loadText').textContent = on ? '무대를 꾸미는 중...' : ''; },
  enterGame(s) {
    session = s;
    document.body.classList.add('ingame');
    document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
    screen = 'game';
  },
  exitGame() { session = null; input.enabled = false; stopSpeak(); },
  showBoard(rows, next, goNext) {
    go('board', { reset: true });
    document.body.classList.add('ingame');
    $('boardTitle').textContent = '중간 순위';
    showRows($('boardList'), rows, true);
    $('boardNext').textContent = `다음: ${next.icon} ${next.name}`;
    let left = 8;
    const b = $('boardGo');
    const tick = () => { b.textContent = `다음 라운드 (${left})`; if (left-- <= 0) boardGoFn(); };
    clearInterval(boardTimer); boardTimer = setInterval(tick, 1000); tick();
    boardGoFn = () => { clearInterval(boardTimer); boardGoFn = null; party?.net?.next(); goNext(); };
    if (party?.net && !party.net.isHost) { b.style.display = 'none'; clearInterval(boardTimer); boardGoFn = null; party.net.waitNext(goNext); $('boardNext').textContent += ' · 방장을 기다리는 중'; } else b.style.display = '';
    audio.playBgm('menu');
  },
  async showResult(r) {
    go('result', { reset: true });
    document.body.classList.remove('ingame');
    $('resTitle').innerHTML = r.single ? '연습 끝!' : r.myRank === 1 ? '🏆 우승! 축하해요!' : `파티 끝! 나는 <span style="color:#ffd23f">${r.myRank}등</span>`;
    // 시상대 (1~3등, 기뻐하는 모습)
    const pod = document.createElement('div'); pod.className = 'podium';
    const top3 = [r.rows[1], r.rows[0], r.rows[2]];
    for (const [k, row] of top3.entries()) {
      if (!row) continue;
      const place = [2, 1, 3][k], img = await portrait(row.charId, row.hat || 'none', 'cheer');
      pod.insertAdjacentHTML('beforeend', `<div class="pd p${place}${row.me ? ' me' : ''}"><img src="${img}"><b>${esc(row.me ? '나' : row.name)}</b><div class="step">${place}</div></div>`);
    }
    await showRows($('resList'), r.rows, false);
    $('resList').prepend(pod);
    const pct = Math.round(r.correct / Math.max(1, r.answered) * 100);
    $('resReward').innerHTML = `<div>맞힌 문제 <b>${r.correct}/${r.answered}</b></div><div>정답률 <b>${pct}%</b></div><div>모은 별 <b>★${r.myStars}</b></div><div>받은 코인 <b>+${r.reward}</b></div>` + (r.crown ? '<div>👑 왕관 보너스!</div>' : '');
    const n = $('resNotes');
    n.innerHTML = r.wrongs.length ? `<h3>📒 이번에 틀린 문제 (${r.wrongs.length})</h3>` + r.wrongs.map(w => `<div class="rn">${esc(w.q)}<br><span class="ra">정답: ${esc(w.c[w.a])}</span>${w.pick != null && w.pick !== w.a && w.c[w.pick] ? `<span class="rp">${esc(w.c[w.pick])}</span>` : ''}${w.e ? `<em>${esc(w.e)}</em>` : ''}</div>`).join('') : '<h3>🎉 모두 맞혔어요!</h3><p class="empty">틀린 문제가 하나도 없어요. 최고!</p>';
    audio.play(r.myRank === 1 ? 'crown' : 'cheer');
    if (party?.net) party.net.onResult?.();
  },
};
async function showRows(box, rows, gains) {
  box.innerHTML = '';
  for (const [i, r] of rows.entries()) {
    const d = document.createElement('div'); d.className = 'brow' + (r.me ? ' me' : ''); d.style.animationDelay = (i * 0.05) + 's';
    const img = await portrait(r.charId, r.hat || 'none');
    d.innerHTML = `<div class="rk">${i + 1}</div><img src="${img}"><div class="nm">${esc(r.me ? (save.settings.name ? save.settings.name + ' (나)' : '나') : r.name)}</div>${gains ? `<div class="gain">${r.gain ? '+' + r.gain : ''}</div>` : ''}<div class="st">★${r.stars}</div>`;
    box.appendChild(d);
  }
}
async function startParty(setup) {
  lastSetup = setup;
  party?.abort();
  party = new Party({ mode: setup.mode, roster: setup.roster || soloRoster(), ui: partyUI, net: setup.net || null, fixedOrder: setup.order, questionsFor: setup.questionsFor });
  party.demo = !!setup.demo;
  setup.onParty?.(party);
  document.body.classList.add('ingame');
  await party.playNext();
}
function quitToMenu() {
  party?.net?.leave?.();
  party?.abort(); party = null; session = null;
  input.enabled = false; stopSpeak();
  document.body.classList.remove('ingame');
  go('menu', { reset: true });
}
let pendingJoin = null;
app.startParty = startParty; app.partyUI = partyUI; app.quitToMenu = quitToMenu; app.setPendingJoin = f => pendingJoin = f;
app.getParty = () => party;

// 개발용: ?play=doors 로 바로 라운드
function quickPlay(id) {
  save.selChar ||= 'mochi';
  startParty({ mode: id, demo: params.has('demo') });
}
// 설정 화면을 일시정지에서 열었으면 돌아갈 때 일시정지 창으로
const _back = actions.back;
actions.back = () => {
  if (screen === 'settings' && session) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); screen = 'game'; $('pause').hidden = false; audio.play('back'); return; }
  _back();
};
window.__app = app;
// 개발용: 라운드 무대 사진 찍기 (모드 카드 그림). 개발 서버에서만 저장된다.
app.shots = async (ids = ['doors', 'tiles', 'paint', 'ball', 'hoops', 'belt', 'parcel', 'tower']) => {
  const { Session } = await import('./game/session.js');
  const { questionSet } = await import('./quiz.js');
  const out = [];
  for (const id of ids) {
    const mod = await import(`./rounds/${id}.js`);
    const RC = Object.values(mod).find(v => typeof v === 'function');
    const s = new Session({ RoundClass: RC, questions: questionSet(Q_PER_ROUND[id]), roster: soloRoster(), demo: true });
    await s.build(); s.start(); session = s;
    await new Promise(r => setTimeout(r, 1500));
    // 물감 땅따먹기는 바닥이 칠해진 모습이 보이게 더 오래 돌린다
    for (let i = 0; i < 60 * (id === 'paint' ? 40 : ['ball', 'hoops', 'belt', 'parcel'].includes(id) ? 22 : 12); i++) s.frame(1 / 60, false);
    s.render(0.016, false);
    const { renderer: R } = await import('./engine/core.js');
    s.render(0.016, false);
    const url = R.domElement.toDataURL('image/jpeg', 0.82);
    const blob = await (await fetch(url)).blob();
    await fetch('/__save?name=round_' + id + '.jpg', { method: 'PUT', body: blob });
    out.push(id); s.dispose(); session = null;
  }
  return out;
};
// 점검용: 화면이 숨겨져 있어도 시간을 빨리 돌려 본다
app.step = (sec, ctrl, draw = false) => { for (let i = 0; i < sec * 60; i++) { if (ctrl) ctrl(session); session?.frame(1 / 60, draw || i % 30 === 0); hud.update(1 / 60); } return session && { phase: session.phase, t: +session.t.toFixed(2) }; };
app.session = () => session;
boot();
