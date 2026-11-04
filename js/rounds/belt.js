// 라운드 ⑦ 정답 과일 컨베이어 (2026-11-05): 뒤로 흐르는 컨베이어 세 줄 위를 거꾸로 달린다. 앞쪽 과일 통에서 보기 과일이 굴러 내려온다.
// 정답 과일을 잡으면 별(처음 2개, 그다음 1개, 한 문제에 2번까지) + 잠깐 빨라짐, 틀린 과일에 부딪히면 뒤로 데굴. 뒤 끝으로 밀려 떨어져도 다시 올라온다.
// 가운데 줄은 빠르고 양옆은 느리다. 과일이 나오는 순서는 같은 씨앗으로 정해서 기기마다 같다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mat, low } from '../engine/core.js';
import { knock, P } from '../engine/physics.js';
import { labelTexture, labelPlane } from '../engine/labels.js';
import { fx, shake, burst } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand } from '../game/session.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, platform, rail, post, backdrop, floatingIslands, bobIslands, hotAirBalloons, prop, stripeTex } from './stage.js';
import { bumper } from './common.js';
import { QuizLoop, seeded, roundSeed } from './quizloop.js';

const HALF = 6.3, FRONT = -34, BACK = 6;   // 길 반 너비, 앞 벽, 뒤 끝(떨어지는 곳)
const LANES = [-4.2, 0, 4.2], LANE_W = 4.2;
const SPEED = [2.4, 3.8, 2.4];             // 컨베이어 속도 (+Z, 뒤로)
const ROLL = 2.3;                          // 과일이 컨베이어보다 더 빨리 구르는 만큼
const FR = 0.78;                           // 과일 반지름
const EVERY = 0.62;                        // 과일 나오는 간격(초)
const MAX_CATCH = 2;

export class BeltRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('belt') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.fruits = []; this.belts = []; this.intro = { length: 4 };
    this.loop = new QuizLoop(this, { extra: 3, show: 1.8, gap: 1.0 });
    this.plan = []; this.next = 0;
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, -14) });
    this.lights = this.bd.lights;
    const len = BACK - FRONT, cz = (BACK + FRONT) / 2;
    // 컨베이어 세 줄: 바닥 몸통 + 흐르는 무늬 + 충돌판(줄마다 따로 → 어느 줄에 섰는지 안다)
    platform(w, root, { x: 0, y: -0.25, z: cz, w: HALF * 2 + 0.6, d: len, h: 1.6, color: PAL.navy, top: null, collide: false });
    this.beltTex = [];
    LANES.forEach((x, i) => {
      const t = stripeTex(i === 1 ? PAL.hotpink : PAL.sky, '#ffffff', 8, false).clone(); t.needsUpdate = true; t.repeat.set(1, len / 2.2);
      this.beltTex.push(t);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W - 0.16, len).rotateX(-Math.PI / 2), mat('#ffffff', { map: t, rough: 0.55 }));
      m.position.set(x, 0.02, cz); m.receiveShadow = !low(); m.userData.camKeep = true; root.add(m);
      const col = w.add({ kind: 'box', x, y: -0.4, z: cz, hx: LANE_W / 2, hy: 0.42, hz: len / 2, noSafe: true });
      this.belts.push({ col, speed: SPEED[i], x });
      // 화살표 (뒤로 흐름)
      for (let z = FRONT + 4; z < BACK - 2; z += 7) { const a = labelPlane('▼', 1.4, 1.4, { fg: 'rgba(255,255,255,0.75)', stroke: null, size: 150 }); a.geometry.rotateX(-Math.PI / 2); a.position.set(x, 0.04, z); a.userData.camKeep = true; root.add(a); }
    });
    // 줄 사이 낮은 칸막이 (넘을 수 있게 아주 낮게)
    for (const x of [-LANE_W / 2, LANE_W / 2]) { const d = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.12, len, 1, 0.05), mat(PAL.white)); d.position.set(x, 0.07, cz); root.add(d); }
    rail(w, root, -HALF, FRONT, -HALF, BACK, 0, PAL.white, 1.1, { x: 0, z: cz }); rail(w, root, HALF, FRONT, HALF, BACK, 0, PAL.white, 1.1, { x: 0, z: cz });
    // 앞 벽 + 과일 통. 벽은 통통 튕겨 내서 벽에 붙어 버티지 못한다(과일은 벽 몇 걸음 앞에 떨어진다)
    platform(w, root, { x: 0, y: 3, z: FRONT - 1, w: HALF * 2 + 1.2, d: 2, h: 6, color: PAL.hotpink, top: PAL.cream, extra: { bounce: 9, noSafe: true } });
    const chute = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 2.6, 24, 1, true), mat(PAL.butter, { rough: 0.35, side: THREE.DoubleSide })); chute.position.set(0, 4.4, FRONT - 0.6); root.add(chute);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), mat(['#ff5a6e', '#ffc02e', '#32c97a', '#3f8cff', '#a46bff', '#ff8a3d', '#ff5fd2'][i], { rough: 0.3 })); f.position.set(-1.6 + i * 0.53, 5.6 + (i % 2) * 0.4, FRONT - 0.6 + (i % 3 - 1) * 0.5); root.add(f); }
    const sign = labelPlane('정답 과일만 잡아요!', 8.5, 1.4, { bg: PAL.white, fg: '#c2306a', stroke: null, border: PAL.hotpink, size: 100, radius: 40 });
    sign.position.set(0, 1.7, FRONT + 0.05); root.add(sign);
    for (const x of [-HALF, HALF]) { post(root, x, 0, BACK, PAL.butter, 1.3); post(root, x, 0, FRONT, PAL.hotpink, 1.3); }
    // 길 위에 서 있는 통통 기둥 (컨베이어가 밀어도 기둥은 그대로)
    for (const [x, z, col] of [[-LANE_W / 2, -10, PAL.grape], [LANE_W / 2, -20, PAL.mint], [-LANE_W / 2, -27, PAL.butter], [LANE_W / 2, -4, PAL.hotpink]]) bumper(s, root, { x, z, r: 0.5, color: col });
    for (const [i, [x, z]] of [[-17, -30], [18, -26], [-19, 0], [18, 4], [0, -50]].entries()) prop(root, ['prop_icecream', 'prop_cupcake', 'prop_lollipop', 'prop_donut', 'prop_cottoncandy'][i], { x, y: -3 + (i % 2), z, size: 7 + (i % 3) });
    floatingIslands(root, [{ x: -30, y: -5, z: -40, size: 12 }, { x: 30, y: -2, z: -46 }, { x: -36, y: 2, z: 4, size: 14 }, { x: 34, y: -6, z: -6, size: 11 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, -16), 55);
    w.addHazard({ update: () => {}, test: p => this.touch(p) });
  }
  spawn(players) {
    players.forEach((p, i) => {
      const lane = i % 3, row = Math.floor(i / 3);
      const b = p.body; b.x = LANES[lane] + (row % 2 ? 0.8 : -0.8); b.z = -16 + row * 1.8; b.y = 0.1; b.yaw = Math.PI;
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() {
    this.loop.start();
    hud.hint('바닥이 뒤로 흘러요! 앞으로 달리면서 <b>정답 과일</b>만 잡아요. 틀린 과일은 피해요', 5);
  }
  respawnSpot() { return { x: LANES[Math.floor(Math.random() * 3)], y: 5, z: rand(-22, -16) }; }
  // ---- 과일 ----
  onAsk(q, qi) {
    this.clearFruits();
    const rng = seeded(roundSeed(this.s, qi, 9)), n = q.c.length;
    this.plan = []; this.next = 0;
    let lastLane = -1;
    for (let k = 0; k < 60; k++) {
      let lane = Math.floor(rng() * 3); if (lane === lastLane && rng() < 0.6) lane = (lane + 1 + Math.floor(rng() * 2)) % 3; lastLane = lane;
      let ai = rng() < 0.4 ? q.a : Math.floor(rng() * n); if (ai === q.a && rng() < 0.15) ai = (q.a + 1) % n;
      this.plan.push({ id: k, t: 0.5 + k * EVERY, lane, ai });
    }
    for (const p of this.s.players) p.qa.catches = 0;
  }
  makeFruit(f) {
    const st = ANSWER_STYLE[f.ai], g = new THREE.Group(); g.userData.camKeep = true;
    const body = new THREE.Mesh(new THREE.SphereGeometry(FR, low() ? 14 : 20, low() ? 10 : 14), mat(st.hex, { rough: 0.3, emissive: 0.08 }));
    body.scale.y = 0.92; body.castShadow = !low(); g.add(body);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), mat('#32c97a', { rough: 0.4 })); leaf.position.set(0.12, FR * 0.95, 0); leaf.rotation.z = -0.6; g.add(leaf);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })); shine.position.set(-0.3, 0.32, 0.55); g.add(shine);
    this.root.add(g);
    const lt = this.labCache?.[f.ai] || (this.labCache ||= [])[f.ai] || ((this.labCache[f.ai] = labelTexture(this.loop.q.c[f.ai], { w: 512, h: 220, bg: 'rgba(255,255,255,0.95)', fg: st.dark, stroke: null, shape: st.shape, shapeColor: st.hex, size: 120, radius: 70, border: st.hex })));
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false }));
    lab.scale.set(1.9, 0.82, 1); lab.renderOrder = 6; this.root.add(lab);
    return { ...f, g, body, lab, z: FRONT + 0.6, x: LANES[f.lane], y: 4.4, vy: 6.5, gone: false, pop: 0 };   // 통에서 퐁 튀어나와 몇 걸음 앞에 떨어진다
  }
  clearFruits() {
    for (const f of this.fruits) { this.root.remove(f.g); this.root.remove(f.lab); f.lab.material.dispose(); }
    this.fruits = [];
    for (const t of this.labCache || []) t?.dispose();
    this.labCache = [];
  }
  removeFruit(f, pop = true) {
    if (f.gone) return; f.gone = true;
    if (pop) burst({ x: f.x, y: f.y, z: f.z }, { kind: 'dot', colors: [ANSWER_STYLE[f.ai].hex, '#ffffff'], count: 10, speed: 3.5, up: 3, gravity: 9, life: 0.6, size: 0.3 });
    this.root.remove(f.g); this.root.remove(f.lab); f.lab.material.dispose();
  }
  touch(p) {
    if (!this.loop.asking || !p.qa) return;
    const b = p.body; if (b.state === 'fallen') return;
    for (const f of this.fruits) {
      if (f.gone || f.y > 1.6) continue;
      const dx = f.x - b.x, dz = f.z - b.z;
      if (dx * dx + dz * dz > (FR + P.r) ** 2 || b.y > f.y + FR) continue;
      const ok = f.ai === this.loop.q.a;
      if (ok && p.qa.catches >= MAX_CATCH) continue;
      this.catchFruit(p, f, ok, true);
    }
  }
  catchFruit(p, f, ok, local) {
    const s = this.s, b = p.body;
    this.removeFruit(f);
    const first = p.qa.ans == null;
    this.loop.record(p, f.ai);
    if (ok) {
      p.qa.catches++;
      if (!first && p.qa.catches === 1) this.loop.markLater(p, f.ai);
      if (local) { s.award(p, p.qa.catches === 1 ? 2 : 1, 'fruit'); b.boostT = 1.3; s.opts.net?.event('fr', { qi: this.loop.qi, id: f.id, pp: p.pid, ok: 1 }); }
      if (p.me) { audio.play('coin', { vol: 0.8, rate: 1 + p.qa.catches * 0.1 }); if (p.qa.catches === 1) audio.play('correct'); hud.popAt(b, p.qa.catches === 1 ? '냠! +2' : '냠! +1', 'good'); }
      else if (s.hearing(p) > 0.05) audio.play('coin', { vol: s.hearing(p) * 0.4 });
    } else {
      if (local) { b.hitCool = 0; knock(b, (Math.random() - 0.5) * 3, 4.5, 8.5, 0.75); s.opts.net?.event('fr', { qi: this.loop.qi, id: f.id, pp: p.pid, ok: 0 }); }
      if (p.me) { audio.play('bonk'); audio.play('wrong', { vol: 0.5 }); hud.popAt(b, '퉁! 틀린 과일', 'bad'); shake.add(0.3); }
      else if (s.hearing(p) > 0.05) audio.play('bonk', { vol: s.hearing(p) * 0.4 });
    }
  }
  onNet(m) {
    if (this.loop.onNet(m)) return;
    if (m.k !== 'fr' || m.qi !== this.loop.qi) return;
    const p = this.s.players.find(x => x.pid === m.pp); if (!p || !p.qa) return;
    const f = this.fruits.find(x => x.id === m.id);
    if (f) this.removeFruit(f);
    else { const pl = this.plan.find(x => x.id === m.id); if (pl) pl.taken = true; }   // 아직 안 나온 과일(시간이 조금 어긋남)
    if (p.qa.ans == null) p.qa.ans = f ? f.ai : -1;
    if (m.ok) p.qa.catches++;
  }
  onClose(q) {
    // 남은 과일: 정답은 반짝, 나머지는 퐁 사라짐
    for (const f of this.fruits) if (!f.gone) { if (f.ai === q.a) fx.sparkle({ x: f.x, y: f.y + 0.5, z: f.z }, 4); this.removeFruit(f, f.ai !== q.a); }
  }
  onShowEnd() { this.clearFruits(); }
  onDone() { this.endAt = this.s.t + 0.8; }
  update(dt, phase) {
    const s = this.s, t = s.t;
    if (phase === 'play' && !this.over) this.loop.update(dt);
    // 컨베이어: 줄 위에 서 있는 내 기기 몸을 뒤로 민다 (몸 움직이기 전에)
    for (const p of s.players) {
      if (p.remote) continue;
      const b = p.body; if (!b.grounded || b.state === 'fallen') continue;
      const bl = this.belts.find(x => x.col === b.ground); if (bl) b.z += bl.speed * dt;
    }
    this.beltTex.forEach((tx, i) => { tx.offset.y = (tx.offset.y + SPEED[i] * dt / 2.2) % 1; });
    // 과일 내보내기·굴리기
    if (this.loop.asking) {
      const el = this.loop.elapsed;
      while (this.next < this.plan.length && this.plan[this.next].t <= el) { const pl = this.plan[this.next++]; if (!pl.taken) this.fruits.push(this.makeFruit(pl)); }
    }
    for (const f of this.fruits) {
      if (f.gone) continue;
      const v = SPEED[f.lane] + ROLL;
      f.z += v * dt;
      if (f.y > FR) { f.vy -= 30 * dt; f.y += f.vy * dt; if (f.y <= FR) { f.y = FR; f.vy = Math.abs(f.vy) > 4 ? -f.vy * 0.35 : 0; } }
      else f.y = FR + Math.abs(Math.sin(f.z * 1.6)) * 0.12;      // 데굴데굴 통통
      f.body.rotation.x += v * dt / FR;
      f.g.position.set(f.x, f.y, f.z);
      f.lab.position.set(f.x, f.y + 1.35, f.z);
      if (f.z > BACK + 1) this.removeFruit(f, false);
    }
    if (this.fruits.length > 40) this.fruits = this.fruits.filter(f => !f.gone);
    if (s.me) hud.place(this.loop.asking && s.me.qa ? `🍓 ${s.me.qa.catches || 0}/${MAX_CATCH}` : '');
    if (this.endAt && t >= this.endAt) { this.endAt = 0; this.end(); }
  }
  allDone() { return false; }
  end() { if (this.over) return; this.over = true; this.s.endRound('끝!'); }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.55, 8.2 + b.y * 0.4, b.z + 10.5), look: new THREE.Vector3(b.x * 0.7, 0.9 + b.y * 0.3, b.z - 6) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k);
    return { pos: new THREE.Vector3(14 - e * 12, 12 - e * 3, 12 - e * 4), look: new THREE.Vector3(0, 1, -16 + e * 4) };
  }
  // 봇: 고른 과일이 오는 줄로 가서 앞으로 달려 맞이한다. 다른 과일이 바로 앞에 오면 옆 줄로 피한다
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    const laneOf = x => LANES.reduce((best, lx, i) => Math.abs(lx - x) < Math.abs(LANES[best] - x) ? i : best, 0);
    let lane = m.lane ?? laneOf(b.x), tz = -24 + Math.sin(m.t * 0.4 + (m.noise ?? 0)) * 3;
    if (this.loop.botReady(p) && p.qa.catches < MAX_CATCH) {
      const want = this.fruits.filter(f => !f.gone && f.y < 2.2 && f.ai === m.pick && f.z < b.z + 1.5 && f.z > b.z - 14).sort((A, B) => B.z - A.z)[0];
      if (want) { lane = want.lane; tz = want.z + 1.2; }
    }
    // 내 줄 앞 4m 안에 다른 과일 → 옆 줄로
    const cur = laneOf(b.x);
    const danger = this.fruits.some(f => !f.gone && f.lane === cur && f.z < b.z + 0.3 && f.z > b.z - 4.5 && (!this.loop.asking || f.ai !== m.pick || !this.loop.botReady(p)));
    if (danger) { const alt = [cur - 1, cur + 1].filter(x => x >= 0 && x < 3); lane = alt[Math.floor((m.noise ?? 0) * 10) % alt.length]; }
    if (Math.random() < 0.01) m.lane = undefined; else m.lane = lane;
    const c = steer(p, LANES[lane], Math.max(FRONT + 4, tz), lv, 0.03);
    return { mx: c.mx, mz: c.mz, jump: false, jumpHeld: false };
  }
  dispose() { this.clearFruits(); this.s.scene.remove(this.root); }
}
