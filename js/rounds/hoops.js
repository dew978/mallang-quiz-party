// 라운드 ⑥ 정답 링 통과 (2026-11-05): 둥근 섬에 보기 고리가 뜬다. 낮은 고리는 섬 가장자리를 천천히 돌고(달려서 통과),
// 높은 고리는 통통 트램펄린 위에 누워 떠 있다(트램펄린을 밟고 튀어 올라 통과). 정답 고리를 먼저 통과할수록 별 3·2·1.
// 틀린 고리는 "띠용" 튕겨 낸다. 고리 위치는 문제가 나온 뒤 흐른 시간으로 정해져서 기기마다 같다.
import * as THREE from 'three';
import { mat, low } from '../engine/core.js';
import { knock, setState, P } from '../engine/physics.js';
import { labelTexture } from '../engine/labels.js';
import { fx, shake, burst } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand } from '../game/session.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, disc, rail, backdrop, floatingIslands, bobIslands, hotAirBalloons, prop, stripeTex } from './stage.js';
import { Coins } from './common.js';
import { QuizLoop, seeded, roundSeed, shuffled } from './quizloop.js';

const ISLE = 13.2;                 // 섬 반지름
const LOW_R = 9.4, LOW_Y = 1.75;   // 낮은 고리: 도는 반지름·가운데 높이
const PAD_R = 6.2, HIGH_Y = 4.7;   // 트램펄린 자리·높은 고리 높이
const PADS = 6, PAD_SIZE = 1.35, PAD_V = 17;
const HR = 1.45;                   // 고리 안쪽 반지름
const STARS = [3, 2, 1];

export class HoopsRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('hoops') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.hoops = []; this.pads = []; this.intro = { length: 4 };
    this.loop = new QuizLoop(this, { extra: 4, show: 2.0 });
    this.okCount = 0;
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, 0) });
    this.lights = this.bd.lights;
    disc(w, root, { x: 0, y: 0, z: 0, r: ISLE, h: 1.8, color: PAL.lilac, top: '#f6f0ff' });
    // 둥근 난간 (16조각)
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, r = ISLE - 0.25;
      rail(w, root, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, 0, i % 2 ? PAL.white : PAL.pink, 0.9, { x: 0, z: 0 });
    }
    // 낮은 고리가 도는 길 표시
    const track = new THREE.Mesh(new THREE.RingGeometry(LOW_R - 0.9, LOW_R + 0.9, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    track.position.y = 0.05; track.renderOrder = 1; track.userData.camKeep = true; root.add(track);
    // 트램펄린
    for (let i = 0; i < PADS; i++) {
      const a = i / PADS * Math.PI * 2 + Math.PI / PADS, x = Math.cos(a) * PAD_R, z = Math.sin(a) * PAD_R;
      this.pads.push(this.makePad(i, x, z));
    }
    // 가운데 사탕 기둥 장식 (충돌 있음)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 3.4, 18), mat('#ffffff', { map: (() => { const t = stripeTex(PAL.hotpink, '#ffffff', 6).clone(); t.needsUpdate = true; t.repeat.set(2, 3); return t; })(), rough: 0.35 }));
    pole.position.y = 1.7; pole.castShadow = !low(); root.add(pole);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14), mat(PAL.butter, { rough: 0.3 })); ball.position.y = 3.8; root.add(ball);
    w.add({ kind: 'cyl', x: 0, y: 1.7, z: 0, r: 0.75, hy: 1.7, noSafe: true });
    this.coins = new Coins(s, root);
    for (const [i, [x, z]] of [[-22, -16], [21, -15], [-22, 10], [22, 11], [0, -26]].entries()) prop(root, ['prop_pinwheel', 'prop_cottoncandy', 'prop_donut', 'prop_cupcake', 'prop_lollipop'][i], { x, y: -3 + (i % 2), z, size: 7 + (i % 3) });
    floatingIslands(root, [{ x: -34, y: -4, z: -26, size: 12 }, { x: 32, y: -1, z: -32 }, { x: -40, y: 3, z: 14, size: 14 }, { x: 38, y: -5, z: 12, size: 11 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, 0), 55);
    w.addHazard({ update: () => {}, test: p => this.testPass(p) });
  }
  makePad(i, x, z) {
    const s = this.s, g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(PAD_SIZE + 0.25, PAD_SIZE + 0.35, 0.5, 26), mat(PAL.navy, { rough: 0.4 })); rim.position.y = 0.25; rim.castShadow = !low(); g.add(rim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(PAD_SIZE, PAD_SIZE, 0.1, 26), mat(['#ff5f9e', '#36c6ff', '#ffc02e', '#32c97a', '#a46bff', '#ff8a3d'][i % 6], { rough: 0.25, emissive: 0.08 })); top.position.y = 0.52; g.add(top);
    const col = s.world.add({ kind: 'cyl', x, y: 0.28, z, r: PAD_SIZE + 0.2, hy: 0.28, noSafe: true });
    const pad = { i, x, z, g, top, sq: 0, col };
    col.bouncePad = b => this.bounce(pad, b);
    return pad;
  }
  bounce(pad, b) {
    const s = this.s, p = s.players.find(pp => pp.body === b);
    if (!p || b.state === 'fallen' || b.state === 'knock') return;
    b.vy = PAD_V; b.grounded = false; b.ground = null; b.fromPad = true; b.dived = false;
    if (b.state !== 'normal') setState(b, 'normal');
    pad.sq = 1;
    const near = p.me ? 1 : s.hearing(p);
    if (near > 0.05) audio.play('bounce', { vol: 0.8 * near, rate: 0.9 + Math.random() * 0.2, gap: 0.05 });
    if (p.me) fx.sparkle({ x: b.x, y: 0.7, z: b.z }, 6);
  }
  spawn(players) {
    players.forEach((p, i) => {
      const a = i / players.length * Math.PI * 2, r = 2.4 + (i % 2) * 1.3;
      const b = p.body; b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.y = 0.1; b.yaw = Math.atan2(b.x, b.z);
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() {
    this.loop.start();
    hud.hint('<b>정답 고리</b>를 통과해요! 높은 고리는 <b>트램펄린</b>을 밟고 튀어 올라 통과', 5);
  }
  respawnSpot() { return { x: rand(-2.5, 2.5), y: 6, z: rand(2, 3.5) }; }
  // ---- 고리 ----
  onAsk(q, qi) {
    this.clearHoops();
    this.okCount = 0;
    const rng = seeded(roundSeed(this.s, qi, 5)), n = q.c.length;
    const lowSlots = shuffled([...Array(n).keys()], rng), padSlots = shuffled([...Array(PADS).keys()], rng);
    const a0 = rng() * Math.PI * 2, dir = rng() < 0.5 ? -1 : 1;
    for (let j = 0; j < n; j++) this.hoops.push(this.makeHoop(this.hoops.length, lowSlots[j], 'low', { a: a0 + j / n * Math.PI * 2, w: 0.16 * dir }));
    for (let j = 0; j < n; j++) { const pd = this.pads[padSlots[j]]; this.hoops.push(this.makeHoop(this.hoops.length, j, 'high', { x: pd.x, z: pd.z, ph: rng() * 6 })); }
    for (const p of this.s.players) { p.qa.passed = new Set(); p.qa.got = false; }
    for (let i = 0; i < 3; i++) { const a = rng() * Math.PI * 2; this.coins.add(Math.cos(a) * 4, 0, Math.sin(a) * 4); }
  }
  makeHoop(id, ai, kind, o) {
    const st = ANSWER_STYLE[ai], g = new THREE.Group(); g.userData.camKeep = true;
    const tex = stripeTex(st.hex, '#ffffff', 10).clone(); tex.needsUpdate = true; tex.repeat.set(6, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(HR + 0.17, 0.2, 10, low() ? 28 : 44), mat('#ffffff', { map: tex, rough: 0.3, emissive: 0.1 }));
    ring.castShadow = !low(); g.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(HR, 32), new THREE.MeshBasicMaterial({ color: st.hex, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    fill.renderOrder = 4; g.add(fill);
    if (kind === 'high') g.rotation.x = -Math.PI / 2;     // 누운 고리 (아래에서 위로 통과)
    this.root.add(g);
    const lt = labelTexture(this.loop.q.c[ai], { w: 512, h: 220, bg: 'rgba(255,255,255,0.96)', fg: st.dark, stroke: null, shape: st.shape, shapeColor: st.hex, size: 120, radius: 70, border: st.hex });
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false }));
    lab.scale.set(2.5, 1.07, 1); lab.renderOrder = 6; this.root.add(lab);
    const h = { id, i: ai, kind, g, ring, fill, lab, pop: 0, born: this.s.t, ...o, c: new THREE.Vector3(), n: new THREE.Vector3() };
    this.placeHoop(h, 0);
    return h;
  }
  placeHoop(h, el) {
    if (h.kind === 'low') {
      const a = h.a + h.w * el;
      h.c.set(Math.cos(a) * LOW_R, LOW_Y, Math.sin(a) * LOW_R);
      h.n.set(-Math.sin(a), 0, Math.cos(a));       // 도는 방향으로 선 고리 (길을 따라 달려서 통과)
      h.g.rotation.set(0, Math.atan2(h.n.x, h.n.z), 0);
    } else {
      h.c.set(h.x, HIGH_Y + Math.sin(el * 1.3 + h.ph) * 0.25, h.z);
      h.n.set(0, 1, 0);
    }
    h.g.position.copy(h.c);
    h.lab.position.set(h.c.x, h.c.y + (h.kind === 'low' ? HR + 1.1 : 1.3), h.c.z);
  }
  clearHoops() { for (const h of this.hoops) { this.root.remove(h.g); this.root.remove(h.lab); h.lab.material.map.dispose(); h.lab.material.dispose(); h.ring.material.map?.dispose(); } this.hoops = []; }
  // 몸 가운데가 고리 면을 지나갔는지 (이전 위치 → 지금 위치)
  testPass(p) {
    if (!this.loop.asking || !p.qa) return;
    const b = p.body, cx = b.x, cy = b.y + 0.62, cz = b.z;
    const prev = p.hoopPrev || (p.hoopPrev = { x: cx, y: cy, z: cz });
    for (const h of this.hoops) {
      if (h.gone) continue;
      const d0 = (prev.x - h.c.x) * h.n.x + (prev.y - h.c.y) * h.n.y + (prev.z - h.c.z) * h.n.z;
      const d1 = (cx - h.c.x) * h.n.x + (cy - h.c.y) * h.n.y + (cz - h.c.z) * h.n.z;
      if ((d0 > 0) === (d1 > 0) || Math.abs(d0 - d1) > 3) continue;
      const k = d0 / (d0 - d1);
      const px = prev.x + (cx - prev.x) * k - h.c.x, py = prev.y + (cy - prev.y) * k - h.c.y, pz = prev.z + (cz - prev.z) * k - h.c.z;
      const dn = px * h.n.x + py * h.n.y + pz * h.n.z;
      const lat = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - dn * dn));
      if (lat > HR - 0.05) continue;
      if (p.qa.passed.has(h.id)) continue;
      p.qa.passed.add(h.id);
      this.pass(p, h, true);
    }
    prev.x = cx; prev.y = cy; prev.z = cz;
  }
  pass(p, h, local) {
    const s = this.s, q = this.loop.q, ok = h.i === q.a, b = p.body;
    h.pop = 1;
    if (ok) {
      if (p.qa.got) return;
      p.qa.got = true;
      const n = this.okCount++;
      const first = p.qa.ans == null;
      this.loop.record(p, h.i);
      if (!first) this.loop.markLater(p, h.i);
      const stars = first ? STARS[Math.min(n, STARS.length - 1)] : 1;
      if (local) { s.award(p, stars, 'hoop'); s.opts.net?.event('hoop', { qi: this.loop.qi, hid: h.id, pp: p.pid, ok: 1 }); }
      burst({ x: h.c.x, y: h.c.y, z: h.c.z }, { kind: 'star', colors: [ANSWER_STYLE[h.i].hex, '#ffe34d', '#ffffff'], count: 16, speed: 4.5, up: 3, gravity: 4, life: 0.9, size: 0.4 });
      if (p.me) { audio.play('balloon_pop', { vol: 0.8 }); audio.play('correct'); hud.popAt(b, n === 0 && first ? '1등 통과! +3' : `통과! +${stars}`, 'good'); shake.add(0.15); }
      else if (s.hearing(p) > 0.05) audio.play('balloon_pop', { vol: s.hearing(p) * 0.5 });
    } else {
      this.loop.record(p, h.i);
      if (local) {
        // 고리 반대쪽으로 튕겨 낸다
        const back = h.kind === 'high' ? { x: (b.x - h.c.x) * 2, z: (b.z - h.c.z) * 2 } : { x: -h.n.x * Math.sign(b.vx * h.n.x + b.vz * h.n.z || 1) * 6, z: -h.n.z * Math.sign(b.vx * h.n.x + b.vz * h.n.z || 1) * 6 };
        b.hitCool = 0; knock(b, back.x, h.kind === 'high' ? -2 : 4.5, back.z, 0.7);
        s.opts.net?.event('hoop', { qi: this.loop.qi, hid: h.id, pp: p.pid, ok: 0 });
      }
      fx.dust({ x: b.x, y: b.y + 0.6, z: b.z }, 6);
      if (p.me) { audio.play('bonk'); audio.play('wrong', { vol: 0.5 }); hud.popAt(b, '띠용~', 'bad'); shake.add(0.25); }
    }
  }
  onNet(m) {
    if (this.loop.onNet(m)) return;
    if (m.k !== 'hoop' || m.qi !== this.loop.qi || !this.loop.asking) return;
    const p = this.s.players.find(x => x.pid === m.pp), h = this.hoops.find(x => x.id === m.hid);
    if (!p || !h || !p.qa) return;
    if (m.ok) { if (!p.qa.got) { p.qa.got = true; this.okCount++; if (p.qa.ans == null) p.qa.ans = h.i; } h.pop = 1; burst({ x: h.c.x, y: h.c.y, z: h.c.z }, { kind: 'star', colors: ['#ffe34d', '#ffffff'], count: 8, speed: 3, up: 2, gravity: 4, life: 0.7, size: 0.35 }); }
    else { h.pop = 1; if (p.qa.ans == null) p.qa.ans = h.i; }
  }
  allDone() { return this.s.players.every(p => p.qa?.got); }
  onClose(q) { for (const h of this.hoops) if (h.i === q.a) { h.pop = 1; fx.sparkle({ x: h.c.x, y: h.c.y, z: h.c.z }, 10); } else h.fade = true; }
  onShowEnd() { this.clearHoops(); }
  onDone() { this.endAt = this.s.t + 0.8; }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    if (phase === 'play' && !this.over) this.loop.update(dt);
    const el = this.loop.asking ? this.loop.elapsed : (this.lastEl ?? 0);
    if (this.loop.asking) this.lastEl = el;
    for (const h of this.hoops) {
      this.placeHoop(h, el);
      const a = Math.min(1, (t - h.born) * 3), e = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.25 : 1;
      h.pop = Math.max(0, h.pop - dt * 3);
      let sc = Math.max(0.01, a * e) * (1 + h.pop * 0.25);
      if (h.fade) sc *= Math.max(0.01, 1 - (h.fadeK = (h.fadeK || 0) + dt * 2.5));
      h.g.scale.setScalar(sc); h.lab.visible = sc > 0.3;
      h.ring.rotation.z = t * 0.6;
    }
    for (const pd of this.pads) { pd.sq = Math.max(0, pd.sq - dt * 4); pd.top.scale.set(1 + pd.sq * 0.08, 1 - pd.sq * 0.5, 1 + pd.sq * 0.08); pd.top.position.y = 0.52 - pd.sq * 0.12; }
    if (s.me) hud.place(s.me.qa?.got ? '✅ 통과!' : '');
    if (this.endAt && t >= this.endAt) { this.endAt = 0; this.end(); }
  }
  end() { if (this.over) return; this.over = true; this.s.endRound('끝!'); }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.5, 13 + b.y * 0.55, 15 + b.z * 0.5), look: new THREE.Vector3(b.x * 0.65, b.y * 0.6 + 0.9, b.z * 0.6 - 2) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k), a = 0.8 + e * 2.4;
    return { pos: new THREE.Vector3(Math.cos(a) * 26, 18 - e * 4, Math.sin(a) * 24), look: new THREE.Vector3(0, 1.5, 0) };
  }
  // 봇: 낮은 고리는 길을 따라 앞질러 가서 통과, 높은 고리는 그 트램펄린으로
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = Math.cos(m.t * 0.3 + (m.noise ?? 0)) * 3.5, tz = Math.sin(m.t * 0.3 + (m.noise ?? 0)) * 3.5;
    if (this.loop.botReady(p) && !p.qa.got) {
      const cands = this.hoops.filter(h => h.i === m.pick && !h.fade);
      if (!m.goal || !cands.includes(m.goal)) m.goal = cands.sort((A, B) => Math.hypot(A.c.x - b.x, A.c.z - b.z) - Math.hypot(B.c.x - b.x, B.c.z - b.z))[Math.random() < 0.7 ? 0 : cands.length - 1] || null;
      const h = m.goal;
      if (h && h.kind === 'high') { tx = h.c.x; tz = h.c.z; }
      else if (h) {
        // 고리 뒤(도는 방향의 반대쪽) 1.8m에서 고리를 지나 앞으로
        const sgn = Math.sign(h.w) || 1, fx2 = h.n.x * sgn, fz2 = h.n.z * sgn;
        const relx = b.x - h.c.x, relz = b.z - h.c.z, along = relx * fx2 + relz * fz2;
        const lat = Math.hypot(relx - fx2 * along, relz - fz2 * along);
        if (along < -0.3 && lat < 0.9) { tx = h.c.x + fx2 * 3; tz = h.c.z + fz2 * 3; }
        else { tx = h.c.x - fx2 * 2.2; tz = h.c.z - fz2 * 2.2; }
      }
    }
    const c = steer(p, tx, tz, lv, 0.05);
    return { mx: c.mx, mz: c.mz, jump: false, jumpHeld: false };
  }
  dispose() { this.clearHoops(); this.s.scene.remove(this.root); }
}
