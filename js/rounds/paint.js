// 라운드 ③ 정답 물감 땅따먹기 (2026-11-04, 너무 어렵던 풍선 사냥을 바꿈)
// 광장 귀퉁이에 보기 물감통이 놓인다. 정답 통에 뛰어들면 몸에 내 색 물감이 묻고, 몇 초 동안 달리는 곳마다 바닥이 내 색이 된다.
// 점프·낭떠러지 없이 평평한 광장이라 쉽다. 먼저 맞힐수록 별(3·2·1)과 칠하는 시간이 많고, 끝나면 넓게 칠한 순서로 보너스 별.
import * as THREE from 'three';
import { mat, low } from '../engine/core.js';
import { setState } from '../engine/physics.js';
import { labelTexture } from '../engine/labels.js';
import { fx, shake, burst } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand, pickWeighted } from '../game/session.js';
import { speakQuestion, stopSpeak } from '../tts.js';
import { answerTime } from '../quiz.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, platform, rail, post, backdrop, floatingIslands, bobIslands, hotAirBalloons, prop } from './stage.js';
import { Coins, bumper } from './common.js';

const AX = 13, AZ = 9.5;               // 광장 반 너비·반 깊이
const CELL = 1, GX = AX * 2 / CELL, GZ = Math.round(AZ * 2 / CELL);
const PX = 20;                         // 칸 하나 = 그림 20픽셀
const BRUSH = 1.15;                    // 칠하는 반지름
const SPOTS = [[-9, -5.8], [9, -5.8], [-9, 5.8], [9, 5.8]];
const PAINT_T = [9, 8, 7];             // 정답 순서별 칠하기 시간(초)
const AREA_BONUS = [4, 3, 2];          // 넓이 1·2·3등 별
// 사람마다 다른 물감 색 (12명)
export const PAINT = ['#ff4d8d', '#3d8bff', '#ffb52e', '#2fd27a', '#a65bff', '#ff7a2b', '#18d6d0', '#ff5fd2', '#8bd346', '#5c6cff', '#ff5a4a', '#00b4ff'];

export class PaintRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('paint') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.qi = -1; this.state = 'wait'; this.stT = 0;
    this.buckets = []; this.intro = { length: 4 };
    this.owner = new Int8Array(GX * GZ).fill(-1);
    this.count = new Int32Array(16);
    this.dirty = false; this.lastPct = -1;
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, 0) });
    this.lights = this.bd.lights;
    platform(w, root, { x: 0, y: 0, z: 0, w: AX * 2, d: AZ * 2, h: 1.6, color: PAL.sky, top: '#f4f1ff' });
    const ins = { x: 0, z: 0 };
    rail(w, root, -AX, -AZ, AX, -AZ, 0, PAL.white, 1.0, ins); rail(w, root, -AX, AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    rail(w, root, -AX, -AZ, -AX, AZ, 0, PAL.white, 1.0, ins); rail(w, root, AX, -AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    for (const [x, z] of [[-AX, -AZ], [AX, -AZ], [-AX, AZ], [AX, AZ]]) post(root, x, 0, z, PAL.hotpink, 1.4);
    // 바닥 물감 그림 (칸마다 동그란 물감 자국)
    const c = this.canvas = document.createElement('canvas'); c.width = GX * PX; c.height = GZ * PX;
    this.ctx = c.getContext('2d');
    this.ctx.strokeStyle = 'rgba(120,110,190,0.10)'; this.ctx.lineWidth = 2;
    for (let i = 1; i < GX; i++) { this.ctx.beginPath(); this.ctx.moveTo(i * PX, 0); this.ctx.lineTo(i * PX, c.height); this.ctx.stroke(); }
    for (let j = 1; j < GZ; j++) { this.ctx.beginPath(); this.ctx.moveTo(0, j * PX); this.ctx.lineTo(c.width, j * PX); this.ctx.stroke(); }
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = low() ? 1 : 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(GX * CELL, GZ * CELL).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    floor.position.y = 0.042; floor.renderOrder = 1; floor.userData.camKeep = true; root.add(floor);   // 발판 윗면(0.03) 바로 위
    // 통통 기둥 몇 개 (부딪히면 튕겨서 재밌게, 길은 막지 않게)
    for (const [x, z, col] of [[-4.5, 0, PAL.hotpink], [4.5, 0, PAL.butter], [0, -6.8, PAL.mint], [0, 6.8, PAL.grape]]) bumper(s, root, { x, z, r: 0.6, color: col });
    this.coins = new Coins(s, root);
    for (const [i, [x, z]] of [[-20, -14], [20, -14], [-21, 8], [21, 9], [0, -18]].entries()) prop(root, ['prop_lollipop', 'prop_cottoncandy', 'prop_icecream', 'prop_cupcake', 'prop_giftbox'][i], { x, y: -3 + (i % 2), z, size: 7 + (i % 3) });
    floatingIslands(root, [{ x: -34, y: -5, z: -26, size: 12 }, { x: 32, y: -2, z: -32 }, { x: -42, y: 2, z: 12, size: 14 }, { x: 40, y: -6, z: 10, size: 11 }, { x: 0, y: -8, z: -48, size: 16 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, -10), 60);
    // 사람마다 발밑 색 고리 (내 색이 무엇인지 늘 보이게)
    const ringGeo = new THREE.RingGeometry(0.5, 0.66, 28).rotateX(-Math.PI / 2);
    for (const p of s.players) {
      p.paintCol = PAINT[p.idx % PAINT.length]; p.paintT = 0;
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.paintCol, transparent: true, opacity: 0.85, depthWrite: false }));
      m.renderOrder = 3; root.add(m); p.ring = m;
    }
  }
  spawn(players) {
    players.forEach((p, i) => {
      const a = i / players.length * Math.PI * 2, r = 2.2 + (i % 2) * 1.6;
      const b = p.body; b.x = Math.cos(a) * r * 1.4; b.z = Math.sin(a) * r; b.y = 0.1; b.yaw = Math.PI;
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() {
    this.state = 'gap'; this.stT = 0.5;
    const me = this.s.me;
    hud.hint(`<b>정답 물감통</b>에 뛰어들어요! 그다음 달리는 곳이 <b style="color:${me?.paintCol || '#ff4d8d'}">내 색</b>으로 칠해져요`, 5);
  }
  respawnSpot() { return { x: rand(-3, 3), y: 6, z: rand(-2, 2) }; }
  // ---- 물감통 ----
  placeBuckets(q) {
    for (const k of this.buckets) this.root.remove(k.g);
    this.buckets = [];
    const rng = seeded(Math.floor((this.s.opts.net?.seed ?? Math.random() * 1e9) + this.qi * 7919));
    const spots = SPOTS.slice();
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    q.c.forEach((text, i) => this.buckets.push(this.makeBucket(i, text, ...spots[i])));
  }
  makeBucket(i, text, x, z) {
    const st = ANSWER_STYLE[i], g = new THREE.Group(); g.position.set(x, 0, z); g.userData.camKeep = true;
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.1, 0.95, 28, 1, true), mat(st.hex, { rough: 0.3 })); tub.position.y = 0.48; tub.castShadow = !low(); g.add(tub);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.05, 28), mat(st.dark, { rough: 0.15, emissive: 0.15 })); inner.position.y = 0.82; g.add(inner);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 8, 32), mat(PAL.white, { rough: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.95; g.add(rim);
    // 흘러내린 물감
    for (let k = 0; k < 4; k++) { const a = k * 1.7 + i, d = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 3, 6), mat(st.hex, { rough: 0.2 })); d.position.set(Math.cos(a) * 1.25, 0.68, Math.sin(a) * 1.25); g.add(d); }
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.75, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: st.hex, transparent: true, opacity: 0.35, depthWrite: false })); puddle.position.y = 0.02; puddle.renderOrder = 2; g.add(puddle);
    const tex = labelTexture(text, { w: 512, h: 220, bg: 'rgba(255,255,255,0.96)', fg: st.dark, stroke: null, shape: st.shape, shapeColor: st.hex, size: 120, radius: 70, border: st.hex });
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    lab.scale.set(3.0, 1.29, 1); lab.position.y = 2.55; lab.renderOrder = 6; g.add(lab);
    g.scale.setScalar(0.01); this.root.add(g);
    return { i, g, lab, x, z, inner, pop: 0, born: this.s.t };
  }
  removeBuckets() { for (const k of this.buckets) { this.root.remove(k.g); k.lab.material.map.dispose(); k.lab.material.dispose(); } this.buckets = []; }
  // ---- 칠하기 ----
  paintAt(p, x, z) {
    const r = BRUSH, i0 = Math.max(0, Math.floor((x - r + AX) / CELL)), i1 = Math.min(GX - 1, Math.floor((x + r + AX) / CELL));
    const j0 = Math.max(0, Math.floor((z - r + AZ) / CELL)), j1 = Math.min(GZ - 1, Math.floor((z + r + AZ) / CELL));
    const x2 = this.ctx;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -AX + (i + 0.5) * CELL, cz = -AZ + (j + 0.5) * CELL;
      if ((cx - x) ** 2 + (cz - z) ** 2 > r * r) continue;
      const k = j * GX + i, was = this.owner[k];
      if (was === p.idx) continue;
      if (was >= 0) this.count[was]--;
      this.owner[k] = p.idx; this.count[p.idx]++;
      // 물감 자국: 칸보다 조금 큰 동그라미 + 작은 방울
      x2.fillStyle = p.paintCol;
      const px = (i + 0.5) * PX, pz = (j + 0.5) * PX;
      x2.beginPath(); x2.arc(px + (Math.random() - 0.5) * 3, pz + (Math.random() - 0.5) * 3, PX * 0.72, 0, Math.PI * 2); x2.fill();
      if (Math.random() < 0.3) { x2.beginPath(); x2.arc(px + (Math.random() - 0.5) * PX * 1.4, pz + (Math.random() - 0.5) * PX * 1.4, PX * 0.2, 0, Math.PI * 2); x2.fill(); }
      this.dirty = true;
    }
  }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    // 물감통 등장·출렁
    for (const k of this.buckets) {
      const a = Math.min(1, (t - k.born) * 4), e = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.25 : 1;
      k.pop = Math.max(0, k.pop - dt * 3);
      k.g.scale.set(Math.max(0.01, a * e) * (1 + k.pop * 0.15), Math.max(0.01, a * e) * (1 - k.pop * 0.2), Math.max(0.01, a * e) * (1 + k.pop * 0.15));
      k.inner.position.y = 0.82 + Math.sin(t * 3 + k.i) * 0.02;
      k.lab.position.y = 2.55 + Math.sin(t * 2 + k.i) * 0.08;
    }
    // 칠하기. 친구 몸은 그릴 때만 따라오므로, 칠하기는 마지막으로 받은 위치(p.net)로 한다
    for (const p of s.players) {
      const b = p.body, at = p.remote && p.net ? p.net : b;
      if (p.paintT > 0 && (phase === 'play' || phase === 'end')) {
        p.paintT -= dt;
        if ((p.remote ? at.st : b.state) !== 'fallen' && at.y < 0.6) this.paintAt(p, at.x, at.z);
        p.dripT = (p.dripT || 0) - dt;
        if (p.dripT <= 0 && (p.me || s.hearing(p) > 0)) { p.dripT = 0.12; burst({ x: b.x, y: b.y + 0.5, z: b.z }, { kind: 'dot', colors: [p.paintCol, '#ffffff'], count: 2, speed: 1.2, up: 1.5, gravity: 8, life: 0.45, size: 0.22 }); }
        if (p.me && p.paintT <= 0) hud.toast('물감이 다 떨어졌어요! 다음 문제에서 또 맞혀요');
      }
      if (p.ring) {
        const vis = p.view?.root.visible !== false && b.state !== 'fallen';
        p.ring.visible = vis; p.ring.position.set(b.x, Math.max(0.03, (b.groundY > -50 ? b.groundY : 0) + 0.035), b.z);
        const on = p.paintT > 0;
        p.ring.scale.setScalar(on ? 1.25 + Math.sin(t * 10) * 0.08 : 1); p.ring.material.opacity = on ? 0.95 : 0.6;
      }
    }
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; }
    if (this.endAt && t >= this.endAt) { this.endAt = 0; this.end(); }
    // 내 땅 몇 %
    if (s.me) {
      const pct = Math.round(this.count[s.me.idx] / (GX * GZ) * 100);
      if (pct !== this.lastPct) { this.lastPct = pct; const rank = 1 + s.players.filter(p => this.count[p.idx] > this.count[s.me.idx]).length; hud.place(`🎨 내 땅 ${pct}% · ${rank}등`); }
    }
    if (phase !== 'play' || this.over) return;
    this.stT -= dt;
    const q = this.qs[this.qi];
    if (this.state === 'gap' && this.stT <= 0) this.nextQ();
    else if (this.state === 'ask') {
      const left = Math.max(0, this.stT);
      hud.timer(left / this.T, left);
      const sec = Math.ceil(left); if (sec !== this.lastSec) { this.lastSec = sec; if (sec <= 3 && sec > 0) audio.play('tick'); }
      for (const p of s.players) {
        if (p.remote || p.picked != null || p.body.state === 'fallen') continue;
        const pb = p.body;
        for (const k of this.buckets) if (Math.hypot(k.x - pb.x, k.z - pb.z) < 1.55 && pb.y < 1.6) { this.pick(p, k, q); break; }
      }
      if (this.stT <= 0 || s.players.every(p => p.picked != null)) this.close(q);
    } else if (this.state === 'show' && this.stT <= 0) {
      this.removeBuckets();
      hud.hideQuestion();
      if (this.qi + 1 >= this.qs.length) { this.state = 'rush'; this.stT = Math.min(6, Math.max(2.5, ...s.players.map(p => p.paintT))); hud.banner('마지막 칠하기!', 'go', 1.4); audio.play('whoosh'); }
      else { this.state = 'gap'; this.stT = 1.2; }
    } else if (this.state === 'rush') {
      hud.timer(Math.max(0, this.stT) / 6, Math.max(0, this.stT));
      if (this.stT <= 0) this.finishArea();
    }
  }
  pick(p, k, q) {
    const s = this.s, ok = k.i === q.a, me = p.me;
    p.picked = k.i; k.pop = 1;
    if (!p.remote) s.opts.net?.event('pick', { qi: this.qi, bi: k.i, pp: p.pid });
    s.answer(p, q, ok, k.i);
    const b = p.body, st = ANSWER_STYLE[k.i];
    b.vy = Math.max(b.vy, 5.5); b.grounded = false;      // 통에 퐁당 → 살짝 튀어 오른다
    burst({ x: k.x, y: 1, z: k.z }, { kind: 'drop', colors: [ok ? p.paintCol : '#b9c6dd', st.hex, '#ffffff'], count: 16, speed: 5, up: 5, gravity: 14, life: 0.7, size: 0.4 });
    const near = me ? 1 : s.hearing(p);
    if (near > 0.05) audio.play('splash', { vol: 0.7 * near, gap: 0.04 });
    if (ok) {
      const n = this.okCount++;
      p.paintT = Math.min(14, Math.max(0, p.paintT) + PAINT_T[Math.min(n, PAINT_T.length - 1)]);
      s.award(p, n === 0 ? 3 : n === 1 ? 2 : 1, 'paint');
      if (me) { audio.play('correct'); hud.popAt(p.body, n === 0 ? '1등 정답! 물감 듬뿍' : '정답! 칠해요', 'good'); hud.mark(k.i, true); hud.reveal(q, true, 2.6); shake.add(0.15); }
    } else {
      setState(p.body, 'stun', 0.9);
      if (me) { audio.play('wrong', { vol: 0.6 }); hud.mark(k.i, false); hud.popAt(p.body, '맹물이었어요!', 'bad'); }
    }
  }
  onNet(m) {
    const s = this.s;
    if (m.k === 'area') { this.applyArea(m.list); return; }
    if (m.k !== 'pick' || m.qi !== this.qi || this.state !== 'ask') return;
    const p = s.players.find(x => x.pid === m.pp); if (!p || p.picked != null) return;
    p.picked = m.bi;
    const k = this.buckets.find(x => x.i === m.bi); if (k) k.pop = 1;
    if (m.bi === this.qs[this.qi].a) { const n = this.okCount++; p.paintT = Math.min(14, Math.max(0, p.paintT) + PAINT_T[Math.min(n, PAINT_T.length - 1)]); }
    if (s.hearing(p) > 0.05) audio.play('splash', { vol: s.hearing(p) * 0.6 });
  }
  close(q) {
    const s = this.s;
    this.state = 'show'; this.stT = 1.8;
    stopSpeak();
    for (const p of s.players) if (p.picked == null && !p.remote) s.answer(p, q, false, -1);
    const me = s.me;
    if (me && me.picked == null) { hud.reveal(q, false, 2.6); audio.play('wrong', { vol: 0.5 }); }
    else if (me && me.picked !== q.a) hud.reveal(q, false, 2.6);
    hud.mark(q.a, true); hud.timer(null);
    for (const k of this.buckets) if (k.i === q.a) { k.pop = 1; fx.sparkle({ x: k.x, y: 1.6, z: k.z }, 12); } else k.g.visible = false;
  }
  nextQ() {
    this.qi++;
    const q = this.qs[this.qi];
    this.okCount = 0;
    for (const p of this.s.players) p.picked = null;
    this.placeBuckets(q);
    this.T = answerTime(q) + 3;
    this.state = 'ask'; this.stT = this.T; this.lastSec = -1;
    hud.question(q, { label: `문제 ${this.qi + 1}/${this.qs.length}` });
    hud.progress(`문제 ${this.qi + 1}/${this.qs.length}`);
    speakQuestion(q);
    audio.play('whoosh', { vol: 0.5 });
    for (const p of this.s.players) if (p.bot) {
      const lv = this.s.level;
      p.bot.decideT = rand(...lv.react) * 1.1 + rand(0, 1.8);
      p.bot.pick = pickWeighted(q.a, q.c.length, lv.acc);
    }
    for (let i = 0; i < 3; i++) this.coins.add(rand(-AX + 2, AX - 2), 0, rand(-AZ + 2, AZ - 2));
  }
  // 넓이 순위 → 보너스 별. 친구와 할 때는 방장이 정해서 알린다 (각 기기는 자기 사람 별만 더한다)
  finishArea() {
    if (this.areaDone) return;
    this.state = 'done';
    const s = this.s;
    if (s.opts.net && !s.isHost) return;     // 방장의 'area'를 기다린다
    const order = s.players.filter(p => this.count[p.idx] > 0).sort((a, b) => this.count[b.idx] - this.count[a.idx]);
    const list = order.slice(0, AREA_BONUS.length).map((p, i) => [p.pid, AREA_BONUS[i]]);
    s.opts.net?.event('area', { list });
    this.applyArea(list);
  }
  applyArea(list) {
    if (this.areaDone) return; this.areaDone = true;
    const s = this.s;
    list.forEach(([pid, n], i) => {
      const p = s.players.find(x => x.pid === pid); if (!p) return;
      if (!p.remote) s.award(p, n, 'area');
      if (i === 0) { hud.banner(`🎨 땅 1등: ${p.me ? '나' : p.name}!`, 'end', 1.8); fx.confetti({ x: p.body.x, y: p.body.y + 1.5, z: p.body.z }, 30); if (p.view) p.view.emote = 'cheer'; }
    });
    this.endAt = s.t + 1.9;
  }
  end() { if (this.over) return; this.over = true; this.s.endRound('끝!'); }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.5, 12.5 + b.y * 0.4, 13.5 + b.z * 0.45), look: new THREE.Vector3(b.x * 0.65, b.y * 0.4 + 0.8, b.z * 0.6 - 2.2) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k), a = 0.6 + e * 2.2;
    return { pos: new THREE.Vector3(Math.cos(a) * 26, 17 - e * 4, Math.sin(a) * 22), look: new THREE.Vector3(0, 0.5, 0) };
  }
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = b.x, tz = b.z;
    if (this.state === 'ask' && p.picked == null && this.T - this.stT > m.decideT) {
      const k = this.buckets.find(x => x.i === m.pick) || this.buckets[0];
      if (k) { tx = k.x; tz = k.z; }
    } else if (p.paintT > 0) {
      // 아직 내 색이 아닌 칸 중 가까운 곳으로
      m.paintT = (m.paintT || 0) - dt;
      if (!m.goal || m.paintT <= 0 || Math.hypot(m.goal.x - b.x, m.goal.z - b.z) < 0.9) {
        let best = null, bd = 1e9;
        for (let n = 0; n < 14; n++) {
          const i = Math.floor(Math.random() * GX), j = Math.floor(Math.random() * GZ);
          if (this.owner[j * GX + i] === p.idx) continue;
          const x = -AX + (i + 0.5) * CELL, z = -AZ + (j + 0.5) * CELL, d = Math.hypot(x - b.x, z - b.z) + (this.owner[j * GX + i] >= 0 ? -1.5 : 0);
          if (d < bd && d > 1.2) { bd = d; best = { x, z }; }
        }
        m.goal = best || { x: rand(-AX + 2, AX - 2), z: rand(-AZ + 2, AZ - 2) }; m.paintT = 2.2;
      }
      tx = m.goal.x; tz = m.goal.z;
    } else { const nz = m.noise ?? 0; tx = Math.sin(m.t * 0.5 + nz) * 3; tz = Math.cos(m.t * 0.4 + nz) * 2; }
    const c = steer(p, tx, tz, lv, 0.1);
    return { mx: c.mx, mz: c.mz, jump: false, jumpHeld: false };
  }
  dispose() { this.removeBuckets(); this.tex?.dispose(); this.s.scene.remove(this.root); }
}

function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
