// 라운드 ④ 결승: 왕관 구름 계단. 층마다 보기가 적힌 점프대가 있다. 정답 점프대는 다음 층으로 슈퍼 점프,
// 틀린 점프대는 바람이 빠지며 뒤로 튕긴다. 꼭대기 왕관을 먼저 잡으면 우승 별 +5.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mat, low } from '../engine/core.js';
import { knock, setState } from '../engine/physics.js';
import { labelPlane } from '../engine/labels.js';
import { fx, shake } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand, pickWeighted } from '../game/session.js';
import { speakQuestion } from '../tts.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, platform, rail, post, backdrop, floatingIslands, bobIslands, hotAirBalloons, prop } from './stage.js';
import { Coins, sweeper, pendulum, bumper } from './common.js';

const W = 16, HALF = 8, STEP_Y = 5, STEP_Z = 22, DEPTH = 16;
const LEVELS = 5;      // 0~3: 문제 층, 4: 꼭대기
const lvY = k => k * STEP_Y;
const lvBack = k => -k * STEP_Z + 4;
const lvFront = k => lvBack(k) - DEPTH;
const COLORS = [PAL.pink, PAL.mint, PAL.sky, PAL.lilac, PAL.butter];

export class TowerRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('tower') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.stations = []; this.order = []; this.crownBy = null; this.intro = { length: 4.5 };
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -5;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 10, -45) });
    this.lights = this.bd.lights;
    for (let k = 0; k < LEVELS; k++) {
      const y = lvY(k), zc = (lvBack(k) + lvFront(k)) / 2, top = k === LEVELS - 1;
      // 층 기둥 (구름 탑)
      platform(w, root, { x: 0, y, z: zc, w: W, d: DEPTH, h: 1.4 + (k ? 0 : 0), color: COLORS[k] });
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 3, y + 8, 18), mat('#ffffff', { rough: 0.8 }));
      pillar.position.set(0, y - 1.4 - (y + 8) / 2, zc); root.add(pillar);
      const ins = { x: 0, z: zc };
      rail(w, root, -HALF - 0.1, lvBack(k) - 0.3, -HALF - 0.1, lvFront(k) + 0.3, y, PAL.white, 1.0, ins);
      rail(w, root, HALF + 0.1, lvBack(k) - 0.3, HALF + 0.1, lvFront(k) + 0.3, y, PAL.white, 1.0, ins);
      if (k === 0) rail(w, root, -HALF, lvBack(k) - 0.2, HALF, lvBack(k) - 0.2, y, PAL.white, 1.0, ins);
      rail(w, root, -HALF, lvFront(k) + 0.2, HALF, lvFront(k) + 0.2, y, PAL.white, 1.0, ins);
      for (const sx of [-1, 1]) for (const zz of [lvBack(k), lvFront(k)]) post(root, sx * (HALF + 0.1), y, zz, PAL.hotpink, 1.2);
      if (!top) this.stations.push(this.buildStation(k, this.qs[k]));
    }
    // 층마다 장애물
    this.sweep = sweeper(s, root, { x: 0, y: lvY(1), z: (lvBack(1) + lvFront(1)) / 2 + 2, len: 7.6, speed: 1.1 });
    this.pend = pendulum(s, root, { y: lvY(2), z: (lvBack(2) + lvFront(2)) / 2 + 2, phase: 0.5, color: PAL.hotpink });
    for (const [x, dz] of [[-4, 0], [4, 2], [0, 5]]) bumper(s, root, { x, y: lvY(3), z: lvBack(3) - 4 - dz, color: PAL.grape });
    this.sweep2 = sweeper(s, root, { x: 0, y: lvY(3), z: (lvBack(3) + lvFront(3)) / 2, len: 7.6, speed: -1.0, color: PAL.sky });
    // 꼭대기 왕관
    const tk = LEVELS - 1, tz = (lvBack(tk) + lvFront(tk)) / 2 - 2;
    this.crownPos = new THREE.Vector3(0, lvY(tk), tz);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 1.2, 24), mat(PAL.white, { rough: 0.35 })); ped.position.set(0, lvY(tk) + 0.6, tz); root.add(ped);
    w.add({ kind: 'cyl', x: 0, y: lvY(tk) + 0.6, z: tz, r: 1.7, hy: 0.6, noSafe: true });
    this.crown = await prop(root, 'goal_crown', { x: 0, y: lvY(tk) + 1.2, z: tz, size: 1.9 });
    this.crown.userData.camKeep = true;
    this.crownLight = new THREE.PointLight('#ffe066', 3, 9); this.crownLight.position.set(0, lvY(tk) + 3, tz); root.add(this.crownLight);
    const sign = labelPlane('왕관을 잡아라!', 9, 1.6, { bg: PAL.hotpink, fg: '#ffffff', stroke: '#b01f5a', size: 110, radius: 40 });
    sign.position.set(0, lvY(tk) + 6, lvFront(tk) + 1); root.add(sign);
    this.coins = new Coins(s, root);
    for (let k = 0; k < LEVELS - 1; k++) this.coins.line(-5, lvBack(k) - 3, 5, lvBack(k) - 3, 4, lvY(k));
    floatingIslands(root, [{ x: -30, y: 2, z: -10, size: 12 }, { x: 32, y: 8, z: -35 }, { x: -34, y: 14, z: -60, size: 14 }, { x: 30, y: 4, z: -80, size: 11 }, { x: -20, y: 22, z: -110, size: 16 }, { x: 24, y: 26, z: -115 }]);
    hotAirBalloons(root, 4, new THREE.Vector3(0, 10, -45), 70);
  }
  buildStation(k, q) {
    const s = this.s, n = q.c.length, y = lvY(k), front = lvFront(k);
    const pw = (W - 1) / n - 0.35, pz = front + 2.4;
    const g = new THREE.Group(); this.root.add(g);
    const board = labelPlane(q.q, 13, 2, { bg: '#ffffff', fg: '#3a2a5a', stroke: null, border: '#9b7bff', size: 80, font: '"PretendardEB", sans-serif', radius: 46 });
    board.position.set(0, lvY(k + 1) + 4.2, lvBack(k + 1) + 0.2); g.add(board);
    const num = labelPlane(k < 3 ? `${k + 1}층 문제` : '마지막 문제!', 3.2, 0.9, { bg: PAL.butter, fg: '#7a4a00', stroke: null, size: 66, radius: 30 });
    num.position.set(-5.2, lvY(k + 1) + 5.6, lvBack(k + 1) + 0.25); g.add(num);
    const pads = [];
    for (let i = 0; i < n; i++) {
      const x = -HALF + 0.5 + pw / 2 + 0.175 + i * (pw + 0.35), st = ANSWER_STYLE[i];
      const pg = new THREE.Group(); pg.position.set(x, y, pz); g.add(pg);
      const base = new THREE.Mesh(new RoundedBoxGeometry(pw, 0.36, 3, 2, 0.14), mat(st.dark, { rough: 0.4 })); base.position.y = 0.1; pg.add(base);
      const cush = new THREE.Mesh(new RoundedBoxGeometry(pw - 0.3, 0.3, 2.7, 3, 0.14), mat(st.hex, { rough: 0.25 })); cush.position.y = 0.3; pg.add(cush);
      const lab = labelPlane(q.c[i], pw - 0.3, Math.min(1.5, (pw - 0.3) * 0.5), { fg: '#ffffff', stroke: st.dark, shape: st.shape, shapeColor: '#fff', size: 120 });
      lab.geometry.rotateX(-Math.PI / 2); lab.position.set(0, 0.47, 0.1); pg.add(lab);
      // 서 있는 안내판 (멀리서도 보이게)
      const stand = labelPlane(q.c[i], pw - 0.2, 1.1, { bg: st.hex, fg: '#ffffff', stroke: st.dark, shape: st.shape, shapeColor: '#fff', size: 100, radius: 30 });
      stand.position.set(0, 2.4, -1.55); pg.add(stand);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), mat('#ffffff')); stick.position.set(0, 0.95, -1.6); pg.add(stick);
      const x2 = labelPlane('✕', 1.6, 1.6, { fg: '#ffffff', stroke: '#3a2a5a', size: 200 }); x2.geometry.rotateX(-Math.PI / 2); x2.position.set(0, 0.5, 0.1); x2.visible = false; pg.add(x2);
      const col = s.world.add({ kind: 'box', x, y: y + 0.2, z: pz, hx: pw / 2, hy: 0.2, hz: 1.5, noSafe: true });
      const pad = { i, x, z: pz, cush, x2, sq: 0, col, correct: i === q.a };
      col.bouncePad = b => this.onPad(k, pad, b);
      pads.push(pad);
    }
    return { k, q, pads, group: g };
  }
  onPad(k, pad, b) {
    const s = this.s, p = s.players.find(pp => pp.body === b);
    if (!p || b.hitCool > 0 || b.state === 'launch') return;
    if (p.level !== k) return;
    pad.sq = 1;
    const st = this.stations[k];
    if (pad.correct) {
      const first = !p.tried[k].size;
      // 다음 층으로 포물선 (1초 비행)
      const tx = pad.x * 0.6, ty = lvY(k + 1) + 0.1, tz = lvBack(k + 1) - 3.5, T = 1.0, g = 27;
      b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = (ty - b.y + 0.5 * g * T * T) / T;
      b.grounded = false; b.ground = null; setState(b, 'launch'); b.hitCool = 0.4;
      p.level = k + 1; p.cp = k + 1;
      if (first) { s.answer(p, st.q, true, pad.i); s.award(p, 2, 'pad'); }
      fx.confetti({ x: b.x, y: b.y + 1, z: b.z }, 20);
      if (p.me) {
        audio.play('launch'); if (first) audio.play('correct');
        hud.mark(pad.i, true); hud.reveal(st.q, first, 2.8);
        setTimeout(() => hud.hideQuestion(), 1500);
        hud.progress(p.level < 4 ? `${p.level + 1}층` : '꼭대기!');
      } else if (s.hearing(p) > 0.1) audio.play('launch', { vol: s.hearing(p) * 0.5 });
    } else {
      const firstWrong = !p.tried[k].size;
      p.tried[k].add(pad.i);
      knock(b, (Math.random() - 0.5) * 2, 7, 6.5, 0.9);
      b.hitCool = 0.6;
      if (firstWrong) s.answer(p, st.q, false, pad.i);
      if (p.me) { audio.play('bonk'); audio.play('wrong', { vol: 0.6 }); pad.x2.visible = true; hud.mark(pad.i, false); hud.popAt(b, '피슝~', 'bad'); shake.add(0.3); }
      fx.dust({ x: b.x, y: b.y, z: b.z }, 8);
    }
  }
  spawn(players) {
    players.forEach((p, i) => {
      const b = p.body, col = i % 6, row = Math.floor(i / 6);
      b.x = (col - 2.5) * 2.3; b.z = 1.5 + row * 2.2; b.y = 0.1; b.yaw = Math.PI;
      b.lastSafe = { x: b.x, y: 0, z: b.z };
      p.level = 0; p.cp = 0; p.tried = [new Set(), new Set(), new Set(), new Set()];
      if (p.bot) p.bot.lane = (Math.random() - 0.5) * 10;
    });
  }
  begin() { hud.progress('1층'); hud.hint('정답 <b>점프대</b>를 밟으면 위층으로 슝! 꼭대기 <b>왕관</b>을 잡아요', 5); }
  respawnSpot(p) { const k = p.level; return { x: rand(-5, 5), y: lvY(k) + 0.1, z: lvBack(k) - 2.5, yaw: Math.PI }; }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    if (this.crown) { this.crown.rotation.y = t * 0.8; this.crown.position.y = lvY(LEVELS - 1) + 1.25 + Math.sin(t * 2) * 0.12; this.crown.visible = !this.crownBy; }
    for (const st of this.stations) for (const pd of st.pads) { pd.sq = Math.max(0, pd.sq - dt * 3); pd.cush.scale.set(1 + pd.sq * 0.08, 1 - pd.sq * 0.7, 1 + pd.sq * 0.08); }
    if (phase !== 'play' || this.over) return;
    this.playT = (this.playT || 0) + dt;
    for (const p of s.players) {
      if (p.remote) continue;
      const b = p.body;
      // 문제 보여 주기
      if (p.me && p.level < 4 && p.shown !== p.level && b.grounded && b.y > lvY(p.level) - 0.5) {
        p.shown = p.level;
        const q = this.stations[p.level].q;
        hud.question(q, { label: p.level < 3 ? `${p.level + 1}층 문제` : '마지막 문제!' });
        speakQuestion(q);
        hud.progress(`${p.level + 1}층`);
      }
      // 꼭대기 도착 / 왕관
      if (p.level === 4 && b.grounded && !p.finished) {
        p.finished = true; this.order.push(p); p.place = this.order.length;
        if (p.place > 1 || this.crownBy) { const bonus = [0, 3, 2][p.place - 1] ?? 1; s.award(p, bonus || 1, 'top'); }
        if (p.me) { hud.banner(this.crownBy ? `꼭대기 <b>${p.place}등</b>!` : '왕관을 잡아요!', 'big', 1.6); hud.place(`${p.place}등`); }
      }
      if (!this.crownBy && p.level === 4 && b.state !== 'fallen') {
        const d = Math.hypot(b.x - this.crownPos.x, b.z - this.crownPos.z);
        if (d < 2.3 && b.y > this.crownPos.y - 0.5) this.takeCrown(p);
      }
    }
    // 끝: 사람(나)이 꼭대기에 오르거나 왕관 뒤 20초, 또는 3분
    const humans = s.humans();
    if (humans.every(p => p.finished)) { this.doneT = (this.doneT || 0) + dt; if (this.doneT > 3) this.end(); }
    if (this.crownBy) {
      this.afterT = (this.afterT || 0) + dt;
      const left = Math.ceil(30 - this.afterT);
      if (left !== this.lastLeft && left <= 10 && left > 0) { this.lastLeft = left; hud.count(String(left)); audio.play('tick'); }
      if (this.afterT > 30) this.end('시간 끝!');
    }
    if (this.playT > 180) this.end('시간 끝!');
  }
  onNet(m) { if (m.k === 'crown' && !this.crownBy) { const p = this.s.players.find(x => x.pid === m.pp); if (p) this.takeCrown(p); } }
  takeCrown(p) {
    const s = this.s;
    if (!p.remote) s.opts.net?.event('crown', { pp: p.pid });
    this.crownBy = p.me ? 'me' : p.pid; this.crownPlayer = p;
    if (!p.finished) { p.finished = true; this.order.unshift(p); }
    this.order.forEach((x, i) => x.place = i + 1);
    s.award(p, 5, 'crown');
    p.view.emote = 'cheer';
    fx.confetti({ x: p.body.x, y: p.body.y + 2, z: p.body.z }, 80, 1.4);
    fx.stars({ x: p.body.x, y: p.body.y + 2, z: p.body.z }, 20);
    audio.play('crown'); audio.play('cheer');
    if (p.me) { hud.banner('👑 왕관 획득!', 'big', 2.4); shake.add(0.4); hud.place('1등'); }
    else hud.banner(`👑 ${p.name}이(가) 왕관을 잡았어요!`, '', 2.2);
    // 머리 위 왕관
    if (this.crown) { const c = this.crown.clone(); c.scale.multiplyScalar(0.32); c.position.set(0, 1.7, 0); p.view.root.add(c); this.crownOnHead = c; }
  }
  end(text) {
    if (this.over) return; this.over = true;
    const rest = this.s.players.filter(p => !p.finished).sort((a, b) => b.level - a.level || a.body.z - b.body.z);
    for (const p of rest) { this.order.push(p); p.place = this.order.length; }
    this.s.endRound(text || '결승 끝!');
  }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.55, b.y + 7.2, b.z + 10.5), look: new THREE.Vector3(b.x * 0.75, b.y + 1.6, b.z - 5) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k);
    const top = this.crownPos;
    const z = top.z + (12 - top.z) * e, y = top.y + 4 - (top.y - 2) * e;
    return { pos: new THREE.Vector3(Math.sin(k * 4) * 8, y + 6, z + 12), look: new THREE.Vector3(0, y, z - 6) };
  }
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = m.lane, tz = b.z - 6, jump = false;
    const k = p.level;
    if (k >= 4) { tx = this.crownPos.x + (m.noise % 1 - 0.5) * 2; tz = this.crownPos.z + 1; return { ...steer(p, tx, tz, lv), jumpHeld: true }; }
    const st = this.stations[k];
    if (m.level !== k) { m.level = k; m.readT = rand(...lv.react) + 0.5; m.pick = null; }
    if (m.pick == null || p.tried[k].has(m.pick)) {
      const acc = Math.min(0.97, lv.acc + p.tried[k].size * 0.3);
      let pick = pickWeighted(st.q.a, st.pads.length, acc);
      if (p.tried[k].has(pick)) pick = st.q.a;
      m.pick = pick;
    }
    const pad = st.pads[m.pick];
    if (m.readT > 0) { m.readT -= dt; tz = Math.max(pad.z + 4, b.z - 1.5); tx = pad.x; }
    else { tx = pad.x; tz = pad.z; }
    // 회전 막대 피하기 (1층·3층)
    for (const [sw, lvl, spd] of [[this.sweep, 1, 1.1], [this.sweep2, 3, -1.0]]) {
      if (k !== lvl || !b.grounded) continue;
      const cz = sw === this.sweep ? (lvBack(1) + lvFront(1)) / 2 + 2 : (lvBack(3) + lvFront(3)) / 2;
      const r = Math.hypot(b.x, b.z - cz); if (r > 8 || r < 0.9) continue;
      const ang = Math.atan2(b.z - cz, b.x); let best = 9;
      for (const off of [0, Math.PI]) { const dd = Math.atan2(Math.sin(ang - sw.a - off), Math.cos(ang - sw.a - off)) * Math.sign(spd); if (dd > -0.05 && dd < best) best = dd; }
      const tc = (best - 0.8 / r) / Math.abs(spd);
      if (tc > 0.03 && tc < 0.28 && Math.random() > lv.slip * 0.5) jump = true;
    }
    const c = steer(p, tx, tz, lv);
    if (b.bumped > 0 && Math.random() < 0.04) jump = true;
    return { mx: c.mx, mz: c.mz, jump, jumpHeld: true };
  }
  dispose() { this.s.scene.remove(this.root); }
}
