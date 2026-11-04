// 라운드 ⑤ 정답 공 골인 (2026-11-05): 광장에 보기가 적힌 커다란 말랑 공이 굴러 나온다. 다 같이 밀어서 정답 공을 골대에 넣으면
// 골인 전 5초 안에 그 공을 민 사람 모두 별 2개, 마지막으로 민 사람은 3개. 틀린 공은 골대가 "퉤" 뱉는다. 다이브로 밀면 세게 굴러간다.
// 공 움직임은 방장(혼자 할 때는 내 기기)이 계산해서 친구들에게 1초에 10번 알린다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mat, low } from '../engine/core.js';
import { setState, P } from '../engine/physics.js';
import { labelTexture, labelPlane } from '../engine/labels.js';
import { fx, shake, burst } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand } from '../game/session.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, platform, rail, post, backdrop, floatingIslands, bobIslands, hotAirBalloons, prop, stripeTex } from './stage.js';
import { Coins, bumper } from './common.js';
import { QuizLoop, seeded, roundSeed, shuffled } from './quizloop.js';

const AX = 12, AZ = 10;          // 광장 반 너비·반 깊이 (골대는 -Z 끝)
const GW = 3.4;                  // 골대 입 반 너비
const GD = 3.6;                  // 골대 깊이
const R = 1.25;                  // 공 반지름
const FRICTION = 2.4, BOUNCE = 0.62;
const HELP_T = 5;                // 골인 전 이 시간 안에 민 사람이 도움 별

export class BallRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('ball') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.balls = []; this.intro = { length: 4 };
    this.loop = new QuizLoop(this, { extra: 13, show: 2.4 });
    this.sendT = 0;
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, -4) });
    this.lights = this.bd.lights;
    // 잔디처럼 줄무늬 광장
    platform(w, root, { x: 0, y: 0, z: 0, w: AX * 2, d: AZ * 2, h: 1.6, color: PAL.mint, top: '#eafff6' });
    const lines = new THREE.Group(); root.add(lines);
    const lm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
    const mid = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.85, 40).rotateX(-Math.PI / 2), lm); mid.position.set(0, 0.05, 1.5); lines.add(mid);
    const box = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2 + 3, 0.22).rotateX(-Math.PI / 2), lm); box.position.set(0, 0.05, -AZ + 3.2); lines.add(box);
    for (const sx of [-1, 1]) { const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.2).rotateX(-Math.PI / 2), lm); sl.position.set(sx * (GW + 1.5), 0.05, -AZ + 1.6); lines.add(sl); }
    lines.children.forEach(m => { m.renderOrder = 1; m.userData.camKeep = true; });
    // 난간: 골대 입만 비운다
    const ins = { x: 0, z: 0 };
    rail(w, root, -AX, AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    rail(w, root, -AX, -AZ, -AX, AZ, 0, PAL.white, 1.0, ins); rail(w, root, AX, -AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    rail(w, root, -AX, -AZ, -GW - 0.4, -AZ, 0, PAL.white, 1.0, ins); rail(w, root, GW + 0.4, -AZ, AX, -AZ, 0, PAL.white, 1.0, ins);
    for (const [x, z] of [[-AX, -AZ], [AX, -AZ], [-AX, AZ], [AX, AZ]]) post(root, x, 0, z, PAL.hotpink, 1.4);
    this.buildGoal(root, w);
    // 구석에 통통 기둥 (공이 맞고 튀어 재밌게)
    for (const [x, z, col] of [[-8, -5, PAL.hotpink], [8, -5, PAL.butter], [-8, 5.5, PAL.sky], [8, 5.5, PAL.grape]]) bumper(s, root, { x, z, r: 0.6, color: col });
    this.bumpers = [[-8, -5], [8, -5], [-8, 5.5], [8, 5.5]];
    this.coins = new Coins(s, root);
    for (const [i, [x, z]] of [[-20, -16], [20, -15], [-21, 8], [21, 9], [0, -24]].entries()) prop(root, ['prop_lollipop', 'prop_cottoncandy', 'prop_icecream', 'prop_cupcake', 'prop_giftbox'][i], { x, y: -3 + (i % 2), z, size: 7 + (i % 3) });
    floatingIslands(root, [{ x: -34, y: -5, z: -28, size: 12 }, { x: 32, y: -2, z: -34 }, { x: -42, y: 2, z: 12, size: 14 }, { x: 40, y: -6, z: 10, size: 11 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, -10), 60);
    // 공과 사람이 부딪히는 일은 장애물 자리에서 (몸이 움직인 뒤에)
    w.addHazard({ update: dt => this.simBalls(dt), test: p => this.touch(p) });
  }
  buildGoal(root, w) {
    const g = new THREE.Group(); g.position.set(0, 0, -AZ); root.add(g);
    // 골대 바닥 (공이 굴러 들어가는 자리)
    platform(w, root, { x: 0, y: 0, z: -AZ - GD / 2, w: GW * 2 + 0.8, d: GD, h: 1.6, color: PAL.hotpink, top: '#fff0f6' });
    const postM = mat('#ffffff', { map: (() => { const t = stripeTex(PAL.hotpink, '#ffffff', 6).clone(); t.needsUpdate = true; t.repeat.set(1, 3); return t; })(), rough: 0.35 });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.2, 14), postM); p.position.set(sx * GW, 2.1, 0); p.castShadow = !low(); g.add(p);
      w.add({ kind: 'cyl', x: sx * GW, y: 2.1, z: -AZ, r: 0.32, hy: 2.1, noSafe: true });
      // 옆 그물 벽 (사람·공 모두 막음)
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, GD), mat('#ffffff', { transparent: true, opacity: 0.35 })); side.position.set(sx * (GW + 0.3), 1.7, -GD / 2); g.add(side);
      w.add({ kind: 'box', x: sx * (GW + 0.5), y: 1.7, z: -AZ - GD / 2, hx: 0.35, hy: 1.7, hz: GD / 2, noSafe: true });
    }
    const bar = new THREE.Mesh(new RoundedBoxGeometry(GW * 2 + 0.6, 0.55, 0.55, 2, 0.2), mat(PAL.butter, { rough: 0.3 })); bar.position.y = 4.2; g.add(bar);
    const back = new THREE.Mesh(new THREE.BoxGeometry(GW * 2 + 0.6, 3.6, 0.15), mat('#ffffff', { transparent: true, opacity: 0.4 })); back.position.set(0, 1.8, -GD); g.add(back);
    w.add({ kind: 'box', x: 0, y: 1.8, z: -AZ - GD - 0.3, hx: GW + 0.6, hy: 1.8, hz: 0.35, noSafe: true });
    const sign = labelPlane('정답 공만 골인!', 6.4, 1.2, { bg: PAL.hotpink, fg: '#ffffff', stroke: '#b01f5a', size: 100, radius: 36 });
    sign.position.set(0, 5.2, 0.3); g.add(sign);
    this.goalBar = bar; this.goalG = g;
  }
  spawn(players) {
    players.forEach((p, i) => {
      const row = Math.floor(i / 6), col = i % 6;
      const b = p.body; b.x = (col - 2.5) * 2.4; b.z = 6 + row * 2; b.y = 0.1; b.yaw = Math.PI;
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() {
    this.loop.start();
    hud.hint('보기 공을 밀어서 <b>정답 공</b>을 골대에 넣어요! <b>다이브</b>로 밀면 세게 굴러가요', 5);
  }
  respawnSpot() { return { x: rand(-4, 4), y: 6, z: rand(4, 7) }; }
  // ---- 공 ----
  onAsk(q, qi) {
    this.clearBalls();
    const rng = seeded(roundSeed(this.s, qi, 3));
    const n = q.c.length, order = shuffled([...Array(n).keys()], rng);
    const gap = n <= 2 ? 6 : n === 3 ? 5 : 4.4;
    order.forEach((ai, slot) => this.balls.push(this.makeBall(ai, q.c[ai], (slot - (n - 1) / 2) * gap, 1.2)));
    this.scored = false;
    for (let i = 0; i < 2; i++) this.coins.add(rand(-AX + 2, AX - 2), 0, rand(-AZ + 3, AZ - 2));
  }
  makeBall(i, text, x, z) {
    const st = ANSWER_STYLE[i], g = new THREE.Group(); g.position.set(x, R, z); g.userData.camKeep = true;
    const tex = stripeTex(st.hex, '#ffffff', 6, false).clone(); tex.needsUpdate = true; tex.repeat.set(2, 1);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(R, low() ? 18 : 28, low() ? 12 : 20), mat('#ffffff', { map: tex, rough: 0.35 }));
    sph.castShadow = !low(); g.add(sph);
    // 공에 붙은 보기 모양 (어느 쪽에서 봐도 색이 보이게 큰 줄무늬 + 위 글자판)
    const lt = labelTexture(text, { w: 512, h: 220, bg: 'rgba(255,255,255,0.96)', fg: st.dark, stroke: null, shape: st.shape, shapeColor: st.hex, size: 120, radius: 70, border: st.hex });
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false }));
    lab.scale.set(2.8, 1.2, 1); lab.renderOrder = 6; this.root.add(lab);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b2357', transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.renderOrder = 2; this.root.add(shadow);
    g.scale.setScalar(0.01); this.root.add(g);
    return { i, g, sph, lab, shadow, x, z, vx: 0, vz: 0, tx: x, tz: z, born: this.s.t, touch: new Map(), last: null, gone: false, spitT: 0 };
  }
  clearBalls() { for (const k of this.balls) { this.root.remove(k.g); this.root.remove(k.lab); this.root.remove(k.shadow); k.lab.material.map.dispose(); k.lab.material.dispose(); k.sph.material.map?.dispose(); } this.balls = []; }
  // 방장(또는 혼자)만 공을 굴린다. 친구 기기는 받은 위치로 부드럽게 따라간다
  simBalls(dt) {
    const s = this.s, host = !this.loop.guest;
    for (const k of this.balls) {
      if (k.gone) continue;
      if (host) {
        // 친구 몸은 그 기기가 움직이므로, 방장은 받은 위치로 공만 밀어 준다
        for (const p of s.players) if (p.remote && p.net && p.net.st !== 'fallen') this.pushBall(k, p, p.net.x, p.net.y, p.net.z, p.net.vx, p.net.vz, p.net.st, false);
        k.x += k.vx * dt; k.z += k.vz * dt;
        const sp = Math.hypot(k.vx, k.vz);
        if (sp > 0) { const d = Math.min(sp, FRICTION * dt); k.vx -= k.vx / sp * d; k.vz -= k.vz / sp * d; }
        if (sp > 16) { k.vx *= 16 / sp; k.vz *= 16 / sp; }
        this.walls(k);
        // 통통 기둥
        for (const [bx, bz] of this.bumpers) { const dx = k.x - bx, dz = k.z - bz, d = Math.hypot(dx, dz), m = R + 0.75; if (d < m && d > 1e-4) { const nx = dx / d, nz = dz / d; k.x = bx + nx * m; k.z = bz + nz * m; const vn = k.vx * nx + k.vz * nz; if (vn < 0) { k.vx -= vn * nx * 2.1; k.vz -= vn * nz * 2.1; } } }
      } else {
        // 받은 위치 + 속도로 미리 가 본 곳을 따라간다
        k.tx += k.vx * dt; k.tz += k.vz * dt;
        const f = Math.min(1, dt * 10); k.x += (k.tx - k.x) * f; k.z += (k.tz - k.z) * f;
      }
    }
    // 공끼리
    if (host) for (let a = 0; a < this.balls.length; a++) for (let b = a + 1; b < this.balls.length; b++) {
      const A = this.balls[a], B = this.balls[b]; if (A.gone || B.gone) continue;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d >= R * 2 || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, pen = R * 2 - d;
      A.x -= nx * pen / 2; A.z -= nz * pen / 2; B.x += nx * pen / 2; B.z += nz * pen / 2;
      const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (rv < 0) { const j = -rv * 0.9; A.vx -= nx * j; A.vz -= nz * j; B.vx += nx * j; B.vz += nz * j; }
    }
    if (host && this.loop.asking) for (const k of this.balls) if (!k.gone && k.z < -AZ - R * 0.7) this.inGoal(k);
    // 친구들에게 공 위치
    if (host && s.opts.net && this.balls.length) {
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 0.1; s.opts.net.event('bs', { qi: this.loop.qi, b: this.balls.map(k => [+k.x.toFixed(2), +k.z.toFixed(2), +k.vx.toFixed(2), +k.vz.toFixed(2), k.gone ? 1 : 0]) }); }
    }
  }
  walls(k) {
    const inMouth = Math.abs(k.x) < GW - R * 0.35;
    if (k.x < -AX + R + 0.3) { k.x = -AX + R + 0.3; k.vx = Math.abs(k.vx) * BOUNCE; }
    if (k.x > AX - R - 0.3) { k.x = AX - R - 0.3; k.vx = -Math.abs(k.vx) * BOUNCE; }
    if (k.z > AZ - R - 0.3) { k.z = AZ - R - 0.3; k.vz = -Math.abs(k.vz) * BOUNCE; }
    if (k.z < -AZ + R + 0.3 && !inMouth && k.z > -AZ - 0.2) { k.z = -AZ + R + 0.3; k.vz = Math.abs(k.vz) * BOUNCE; }
    if (k.z < -AZ) {   // 골대 안: 옆·뒤 그물
      if (k.x < -GW + R) { k.x = -GW + R; k.vx = Math.abs(k.vx) * 0.3; }
      if (k.x > GW - R) { k.x = GW - R; k.vx = -Math.abs(k.vx) * 0.3; }
      if (k.z < -AZ - GD + R) { k.z = -AZ - GD + R; k.vz = Math.abs(k.vz) * 0.3; }
    }
  }
  // 사람 ↔ 공 (내 기기가 움직이는 몸: 몸은 밀려나고, 방장이면 공도 민다)
  touch(p) {
    const b = p.body; if (b.state === 'fallen') return;
    for (const k of this.balls) if (!k.gone) this.pushBall(k, p, b.x, b.y, b.z, b.vx, b.vz, b.state, true);
  }
  pushBall(k, p, x, y, z, vx, vz, st, own) {
    if (y > R * 2 - 0.35) return;                      // 공 위에 뛰어오른 사람
    const dx = k.x - x, dz = k.z - z, d = Math.hypot(dx, dz), m = R + P.r * 0.95;
    if (d >= m || d < 1e-4) return;
    const nx = dx / d, nz = dz / d, pen = m - d;
    const host = !this.loop.guest;
    if (own) {
      const b = p.body;
      b.x -= nx * pen * 0.7; b.z -= nz * pen * 0.7;
      const vn = b.vx * nx + b.vz * nz;
      if (vn > 0) { b.vx -= nx * vn * 0.45; b.vz -= nz * vn * 0.45; }   // 무거워서 밀면 조금 느려진다
    }
    if (host) {
      k.x += nx * pen * 0.3; k.z += nz * pen * 0.3;
      const rel = (vx - k.vx) * nx + (vz - k.vz) * nz;
      const hard = st === 'dive' || st === 'slide' ? 1.9 : 1;
      if (rel > 0) { const j = rel * 1.05 * hard + 0.6; k.vx += nx * j; k.vz += nz * j; }
      else { k.vx += nx * 0.5; k.vz += nz * 0.5; }
      if (hard > 1 && rel > 3) this.boom(k, p);
    }
    // 누가 밀었나 (방장이 정한다) + 처음 민 공 = 이 사람의 답
    if (this.loop.asking) {
      if (host) { k.touch.set(p.pid, this.s.t); k.last = p.pid; }
      if (!p.remote && p.qa && p.qa.ans == null) this.loop.record(p, k.i);
    }
  }
  boom(k, p) {
    if (k.boomT && this.s.t - k.boomT < 0.4) return; k.boomT = this.s.t;
    fx.dust({ x: k.x, y: 0.4, z: k.z }, 6);
    const near = p.me ? 1 : this.s.hearing(p);
    if (near > 0.05) audio.play('bounce', { vol: 0.7 * near, rate: 0.8 });
  }
  inGoal(k) {
    const s = this.s, q = this.loop.q;
    if (k.i === q.a) {
      if (this.scored) return;
      this.scored = true; k.gone = true;
      const who = [...k.touch].filter(([, at]) => s.t - at < HELP_T).map(([pid]) => pid);   // 최근 5초 안에 민 사람만
      s.opts.net?.event('goal', { qi: this.loop.qi, bi: k.i, who, last: k.last });
      this.applyGoal(k, who, k.last);
      this.loop.close();
    } else {
      // 틀린 공: 골대가 뱉는다
      k.z = -AZ + R + 0.4; k.vz = 10 + Math.random() * 3; k.vx = (Math.random() - 0.5) * 6;
      s.opts.net?.event('spit', { qi: this.loop.qi, bi: k.i, who: [...k.touch.keys()] });
      this.applySpit(k, [...k.touch.keys()]);
    }
  }
  applyGoal(k, who, last) {
    const s = this.s;
    k.gone = true; k.goneT = s.t;
    burst({ x: k.x, y: R, z: k.z }, { kind: 'square', colors: [ANSWER_STYLE[k.i].hex, '#ffffff', '#ffd84d'], count: 40, speed: 7, up: 8, gravity: 10, life: 1.4, size: 0.35, spinAmt: 10 });
    fx.confetti({ x: 0, y: 4.5, z: -AZ - 1 }, 40);
    audio.play('door_burst', { vol: 0.8 }); audio.play('cheer', { vol: 0.6 });
    hud.banner('⚽ 골인!', 'go', 1.4);
    for (const pid of who) {
      const p = s.players.find(x => x.pid === pid); if (!p) continue;
      if (!p.remote) s.award(p, pid === last ? 3 : 2, 'goal');
      if (p.view) p.view.emote = 'cheer';
      if (p.me) { audio.play('correct'); hud.popAt(p.body, pid === last ? '골! +3' : '도움! +2', 'good'); shake.add(0.2); }
    }
    setTimeout(() => { for (const p of s.players) if (p.view?.emote === 'cheer') p.view.emote = null; }, 1600);
  }
  applySpit(k, who) {
    const s = this.s;
    this.goalBar.scale.set(1.08, 1.4, 1.4); setTimeout(() => this.goalBar.scale.set(1, 1, 1), 180);
    fx.dust({ x: k.x, y: 1, z: -AZ }, 10);
    audio.play('bonk', { vol: 0.8 });
    if (s.me && who.includes(s.me.pid)) { hud.toast('퉤! 틀린 공은 골대가 뱉어요'); audio.play('wrong', { vol: 0.5 }); }
  }
  onNet(m) {
    if (this.loop.onNet(m)) return;
    const s = this.s;
    if (m.k === 'bs') {
      if (m.qi !== this.loop.qi) return;
      m.b.forEach((d, j) => { const k = this.balls[j]; if (!k) return; k.tx = d[0]; k.tz = d[1]; k.vx = d[2]; k.vz = d[3]; if (d[4]) k.gone = true; });
    } else if (m.k === 'goal' && m.qi === this.loop.qi) {
      const k = this.balls.find(x => x.i === m.bi); if (k && !k.goneT) this.applyGoal(k, m.who, m.last);
      this.loop.close();
    } else if (m.k === 'spit' && m.qi === this.loop.qi) {
      const k = this.balls.find(x => x.i === m.bi); if (k) this.applySpit(k, m.who);
    }
  }
  onClose(q) {
    // 정답 공 반짝, 나머지는 쪼그라든다
    for (const k of this.balls) if (k.i === q.a) { if (!k.gone) fx.sparkle({ x: k.x, y: 2, z: k.z }, 14); } else k.fade = true;
  }
  onShowEnd() { this.clearBalls(); }
  onDone() { this.endAt = this.s.t + 0.8; }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    if (phase === 'play' && !this.over) this.loop.update(dt);
    // 공 그리기
    for (const k of this.balls) {
      const a = Math.min(1, (t - k.born) * 3), e = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.2 : 1;
      let sc = Math.max(0.01, a * e);
      if (k.fade) sc *= 0.0001 + Math.max(0, 1 - (k.fadeK = (k.fadeK || 0) + dt * 2.5));
      if (k.gone && k.goneT) sc *= Math.max(0.01, 1 - (t - k.goneT) * 3);
      const dx = k.x - k.g.position.x, dz = k.z - k.g.position.z, dist = Math.hypot(dx, dz);
      if (dist > 1e-4 && dist < 3) { // 구르는 방향으로 굴린다
        const ax = new THREE.Vector3(dz, 0, -dx).normalize();
        k.sph.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, dist / R));
      }
      const drop = k.z < -AZ ? Math.min(0.5, (-AZ - k.z) * 0.2) : 0;
      k.g.position.set(k.x, R * sc - drop, k.z); k.g.scale.setScalar(sc);
      k.lab.position.set(k.x, R * 2 * sc + 1.1 + Math.sin(t * 2 + k.i) * 0.08, k.z); k.lab.visible = sc > 0.2;
      k.shadow.position.set(k.x, 0.045, k.z); k.shadow.scale.setScalar(sc); k.shadow.visible = sc > 0.05;
    }
    if (this.endAt && t >= this.endAt) { this.endAt = 0; this.end(); }
  }
  allDone() { return false; }
  end() { if (this.over) return; this.over = true; this.s.endRound('끝!'); }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.55, 11.5 + b.y * 0.4, 12.5 + b.z * 0.55), look: new THREE.Vector3(b.x * 0.65, b.y * 0.4 + 0.8, b.z * 0.6 - 3.5) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k), a = -0.9 + e * 2.4;
    return { pos: new THREE.Vector3(Math.sin(a) * 24, 16 - e * 4, Math.cos(a) * 20), look: new THREE.Vector3(0, 0.5, -3) };
  }
  // 봇: 고른 공 뒤로 돌아가서 골대 쪽으로 민다
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = Math.sin(m.t * 0.5 + (m.noise ?? 0)) * 4, tz = 5, dive = false;
    const k = this.loop.botReady(p) ? (this.balls.find(x => x.i === m.pick && !x.gone) || null) : null;
    if (k && !k.fade) {
      // 공에서 골대 쪽 방향
      const gx = 0 - k.x, gz = (-AZ - 2) - k.z, gl = Math.hypot(gx, gz) || 1, ux = gx / gl, uz = gz / gl;
      const bx = k.x - ux * (R + 0.9), bz = k.z - uz * (R + 0.9);       // 공 뒤
      const toB = Math.hypot(bx - b.x, bz - b.z);
      const ahead = (b.x - k.x) * ux + (b.z - k.z) * uz;                 // + 면 공보다 골대 쪽에 서 있다
      if (ahead > -0.4 && Math.hypot(b.x - k.x, b.z - k.z) < R + 2.2) {
        // 공 앞에 있으면 옆으로 돌아간다
        const side = ((b.x - k.x) * uz - (b.z - k.z) * ux) >= 0 ? 1 : -1;
        tx = k.x + uz * side * (R + 1.6) - ux * 0.8; tz = k.z - ux * side * (R + 1.6) - uz * 0.8;
      } else if (toB > 0.9) { tx = bx; tz = bz; }
      else {
        tx = k.x + ux * 3; tz = k.z + uz * 3;                              // 밀기
        m.diveCd = (m.diveCd || 0) - dt;
        if (m.diveCd <= 0 && Math.random() < 0.02) { dive = true; m.diveCd = 2.5; }
      }
    } else if (this.loop.asking) { tx = b.x * 0.9; tz = 4; }
    const c = steer(p, tx, tz, lv, 0.06);
    return { mx: c.mx, mz: c.mz, jump: false, jumpHeld: false, dive };
  }
  dispose() { this.clearBalls(); this.s.scene.remove(this.root); }
}
