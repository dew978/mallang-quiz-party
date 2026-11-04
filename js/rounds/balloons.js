// 라운드 ③ 정답 풍선 사냥: 광장에 보기 글자가 적힌 풍선이 떠다닌다. 한 문제에 풍선 하나만 터뜨릴 수 있다.
// 정답 풍선을 먼저 터뜨릴수록 별이 많고(3·2·1), 틀린 풍선은 먹물이 터져 잠깐 어지럽다. 높은 풍선은 트램펄린으로.
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
import { Coins } from './common.js';

const AX = 15, AZ = 11;      // 광장 반 너비·반 깊이
const balloonGeo = new THREE.SphereGeometry(0.78, 22, 16);
const knotGeo = new THREE.ConeGeometry(0.14, 0.22, 8);

export class BalloonsRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('balloons') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.qi = -1; this.state = 'wait'; this.stT = 0;
    this.balloons = []; this.intro = { length: 4 };
    this.pads = [];
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, 0) });
    this.lights = this.bd.lights;
    platform(w, root, { x: 0, y: 0, z: 0, w: AX * 2, d: AZ * 2, h: 1.6, color: PAL.lilac, top: PAL.cream });
    const ins = { x: 0, z: 0 };
    rail(w, root, -AX, -AZ, AX, -AZ, 0, PAL.white, 1.0, ins); rail(w, root, -AX, AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    rail(w, root, -AX, -AZ, -AX, AZ, 0, PAL.white, 1.0, ins); rail(w, root, AX, -AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    for (const [x, z] of [[-AX, -AZ], [AX, -AZ], [-AX, AZ], [AX, AZ]]) post(root, x, 0, z, PAL.hotpink, 1.4);
    // 낮은 사탕 블록 (올라가서 뛰면 더 높이)
    const blocks = [[-7, -3, PAL.mint], [7, -3, PAL.butter], [0, 5, PAL.sky], [-9, 6, PAL.peach], [9, 6, PAL.pink], [0, -7.5, PAL.lime]];
    for (const [x, z, c] of blocks) platform(w, root, { x, y: 1.1, z, w: 3, d: 3, h: 1.1, color: c, top: PAL.cream });
    this.blocks = blocks.map(([x, z]) => ({ x, z }));
    // 트램펄린 (네 귀퉁이)
    for (const [x, z] of [[-11.5, -7.5], [11.5, -7.5], [-11.5, 7.5], [11.5, 7.5]]) this.pads.push(this.trampoline(x, z));
    this.coins = new Coins(s, root);
    // 둘레 장식
    for (const [i, [x, z]] of [[-20, -14], [20, -14], [-21, 8], [21, 9], [0, -18]].entries()) prop(root, ['prop_lollipop', 'prop_cottoncandy', 'prop_icecream', 'prop_cupcake', 'prop_giftbox'][i], { x, y: -3 + (i % 2), z, size: 7 + (i % 3) });
    floatingIslands(root, [{ x: -34, y: -5, z: -26, size: 12 }, { x: 32, y: -2, z: -32 }, { x: -42, y: 2, z: 12, size: 14 }, { x: 40, y: -6, z: 10, size: 11 }, { x: 0, y: -8, z: -48, size: 16 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, -10), 60);
  }
  trampoline(x, z) {
    const s = this.s, g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 24), mat(PAL.white, { rough: 0.4 })); base.position.y = 0.25; g.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 24), mat(PAL.hotpink, { rough: 0.25 })); top.position.y = 0.55; g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.14, 8, 28), mat(PAL.butter, { rough: 0.3 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.56; g.add(ring);
    const pad = { x, z, top, sq: 0 };
    const col = s.world.add({ kind: 'cyl', x, y: 0.31, z, r: 1.45, hy: 0.31, noSafe: true });
    col.bouncePad = b => {
      b.vy = 17.5; b.grounded = false; b.ground = null; b.fromPad = true; b.dived = false;
      pad.sq = 1;
      const p = s.players.find(pp => pp.body === b);
      if (p?.me) audio.play('bounce'); else if (p && s.hearing(p) > 0.1) audio.play('bounce', { vol: s.hearing(p) * 0.6 });
      fx.sparkle({ x, y: 0.8, z }, 6);
    };
    return pad;
  }
  spawn(players) {
    players.forEach((p, i) => {
      const a = i / players.length * Math.PI * 2, r = 4 + (i % 2) * 2.5;
      const b = p.body; b.x = Math.cos(a) * r * 1.3; b.z = Math.sin(a) * r * 0.8; b.y = 0.1; b.yaw = Math.PI;
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() { this.state = 'gap'; this.stT = 0.5; hud.hint('<b>정답 풍선</b>에 몸을 부딪쳐 터뜨려요! 높은 풍선은 귀퉁이 <b>트램펄린</b>으로', 5); }
  respawnSpot() { return { x: rand(-6, 6), y: 6, z: rand(-4, 4) }; }
  // 풍선 띄우기: 보기마다 3~4개, 그중 둘은 낮게
  spawnBalloons(q) {
    const rng = seeded(Math.floor((this.s.opts.net?.seed ?? Math.random() * 1e9) + this.qi * 7919)), rnd = (a, b) => a + rng() * (b - a);
    for (const b of this.balloons) this.removeBalloon(b);
    this.balloons = [];
    const n = q.c.length, per = n === 3 ? 4 : 3;
    const spots = [];
    const free = (x, z) => spots.every(s => Math.hypot(s.x - x, s.z - z) > 2.4);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < per; k++) {
        let x, z, y, tries = 0;
        const high = k === per - 1;     // 하나는 높이 (트램펄린 근처)
        do {
          if (high) { const pd = this.pads[Math.floor(rng() * 4)]; x = pd.x + rnd(-1.8, 1.8); z = pd.z + rnd(-1.8, 1.8); y = rnd(4.2, 5.4); }
          else { x = rnd(-AX + 2, AX - 2); z = rnd(-AZ + 2, AZ - 2); y = rnd(1.7, 2.5); const onBlock = this.blocks.find(bk => Math.abs(bk.x - x) < 1.8 && Math.abs(bk.z - z) < 1.8); if (onBlock) y += 1.1; }
        } while (!free(x, z) && ++tries < 30);
        spots.push({ x, z });
        this.balloons.push(this.makeBalloon(i, q.c[i], x, y, z, rng));
      }
    }
  }
  makeBalloon(i, text, x, y, z, rng = Math.random) {
    const st = ANSWER_STYLE[i];
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.userData.camKeep = true;   // 정답 풍선은 카메라를 가려도 숨기지 않는다
    const m = new THREE.Mesh(balloonGeo, mat(st.hex, { rough: 0.18 })); m.scale.set(1, 1.15, 1); m.castShadow = !low(); g.add(m);
    const knot = new THREE.Mesh(knotGeo, mat(st.dark)); knot.position.y = -0.95; knot.rotation.x = Math.PI; g.add(knot);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4), mat('#ffffff')); string.position.y = -1.6; g.add(string);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })); shine.position.set(-0.28, 0.42, 0.55); g.add(shine);
    const tex = labelTexture(text, { w: 512, h: 220, bg: 'rgba(255,255,255,0.95)', fg: st.dark, stroke: null, shape: st.shape, shapeColor: st.hex, size: 120, radius: 70, border: st.hex });
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    lab.scale.set(2.3, 0.99, 1); lab.position.y = 1.35; lab.renderOrder = 6; g.add(lab);
    this.root.add(g);
    return { i, g, lab, x, y, z, baseY: y, ph: rng() * 6, alive: true, vx: (rng() - 0.5) * 0.5, vz: (rng() - 0.5) * 0.5 };
  }
  removeBalloon(b) { this.root.remove(b.g); b.lab.material.map.dispose(); b.lab.material.dispose(); b.alive = false; }
  popBalloon(b, color) {
    fx.confetti({ x: b.x, y: b.y, z: b.z }, 18, 0.7);
    burst({ x: b.x, y: b.y, z: b.z }, { kind: 'dot', colors: [color, '#ffffff'], count: 12, speed: 6, up: 2, gravity: 4, life: 0.5, size: 0.4 });
    this.removeBalloon(b);
  }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    for (const pd of this.pads) { pd.sq = Math.max(0, pd.sq - dt * 4); pd.top.scale.set(1 + pd.sq * 0.15, 1 - pd.sq * 0.6, 1 + pd.sq * 0.15); }
    // 풍선 둥실둥실
    for (const b of this.balloons) {
      if (!b.alive) continue;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.x) > AX - 1.5) b.vx = -b.vx; if (Math.abs(b.z) > AZ - 1.5) b.vz = -b.vz;
      b.y = b.baseY + Math.sin(t * 1.6 + b.ph) * 0.22;
      if (b.rise) { b.baseY += dt * 3; b.g.scale.setScalar(1 + Math.sin(t * 10) * 0.05); }
      b.g.position.set(b.x, b.y, b.z); b.g.rotation.z = Math.sin(t * 1.3 + b.ph) * 0.08;
    }
    if (phase !== 'play' || this.over) return;
    this.stT -= dt;
    const q = this.qs[this.qi];
    if (this.state === 'gap' && this.stT <= 0) this.nextQ();
    else if (this.state === 'ask') {
      const left = Math.max(0, this.stT);
      hud.timer(left / this.T, left);
      const sec = Math.ceil(left); if (sec !== this.lastSec) { this.lastSec = sec; if (sec <= 3 && sec > 0) audio.play('tick'); }
      // 터뜨리기
      for (const p of s.players) {
        if (p.remote || p.picked != null || p.body.state === 'fallen') continue;
        const pb = p.body, cy = pb.y + 0.65;
        for (const b of this.balloons) {
          if (!b.alive) continue;
          const dx = b.x - pb.x, dy = b.y - cy, dz = b.z - pb.z;
          if (dx * dx + dy * dy * 0.8 + dz * dz < 1.3 * 1.3) { this.pop(p, b, q); break; }
        }
      }
      const allPicked = s.players.every(p => p.picked != null);
      if (this.stT <= 0 || allPicked) this.close(q);
    } else if (this.state === 'show' && this.stT <= 0) {
      for (const b of this.balloons) if (b.alive) this.popBalloon(b, ANSWER_STYLE[b.i].hex);
      this.balloons = [];
      if (this.qi + 1 >= this.qs.length) { this.end(); return; }
      this.state = 'gap'; this.stT = 1.2; hud.hideQuestion();
    }
  }
  pop(p, b, q) {
    const s = this.s, ok = b.i === q.a;
    p.picked = b.i;
    if (!p.remote) this.s.opts.net?.event('pop', { qi: this.qi, bi: this.balloons.indexOf(b), pp: p.pid });
    this.popBalloon(b, ANSWER_STYLE[b.i].hex);
    s.answer(p, q, ok, b.i);
    const me = p.me, near = me ? 1 : s.hearing(p);
    if (near > 0.05) audio.play('balloon_pop', { vol: near, gap: 0.03 });
    if (ok) {
      this.okCount++;
      const stars = this.okCount === 1 ? 3 : this.okCount === 2 ? 2 : 1;
      s.award(p, stars, 'balloon');
      if (me) { audio.play('correct'); hud.popAt(p.body, this.okCount === 1 ? '1등 정답!' : '정답!', 'good'); hud.mark(b.i, true); hud.reveal(q, true, 2.6); }
    } else {
      setState(p.body, 'stun', 1.1);
      fx.ink({ x: b.x, y: b.y, z: b.z });
      if (me) { audio.play('ink'); audio.play('wrong', { vol: 0.6 }); hud.ink(true); setTimeout(() => hud.ink(false), 1300); shake.add(0.25); hud.mark(b.i, false); hud.popAt(p.body, '먹물 펑!', 'bad'); }
    }
  }
  // 친구 기기에서 터진 풍선
  onNet(m) {
    if (m.k !== 'pop' || m.qi !== this.qi || this.state !== 'ask') return;
    const b = this.balloons[m.bi], p = this.s.players.find(x => x.pid === m.pp);
    if (p) p.picked = b ? b.i : -1;
    if (!b || !b.alive) return;
    if (b.i === this.qs[this.qi].a) this.okCount++;
    this.popBalloon(b, ANSWER_STYLE[b.i].hex);
    if (this.s.hearing(p) > 0.05) audio.play('balloon_pop', { vol: this.s.hearing(p) });
  }
  close(q) {
    const s = this.s;
    this.state = 'show'; this.stT = 1.8;
    stopSpeak();
    for (const p of s.players) if (p.picked == null) { s.answer(p, q, false, -1); }
    const me = s.me;
    if (me && me.picked == null) { hud.reveal(q, false, 2.6); audio.play('wrong', { vol: 0.5 }); }
    else if (me && me.picked !== q.a) hud.reveal(q, false, 2.6);
    hud.mark(q.a, true); hud.timer(null);
    // 남은 풍선: 정답은 반짝이며 떠오르고 나머지는 터진다
    for (const b of this.balloons) {
      if (!b.alive) continue;
      if (b.i === q.a) { b.rise = true; fx.sparkle({ x: b.x, y: b.y, z: b.z }, 8); }
      else this.popBalloon(b, ANSWER_STYLE[b.i].hex);
    }
    this.balloons = this.balloons.filter(b => b.alive);
  }
  nextQ() {
    this.qi++;
    const q = this.qs[this.qi];
    this.okCount = 0;
    for (const p of this.s.players) p.picked = null;
    this.spawnBalloons(q);
    this.T = answerTime(q) + 3;
    this.state = 'ask'; this.stT = this.T; this.lastSec = -1;
    hud.question(q, { label: `문제 ${this.qi + 1}/${this.qs.length}` });
    hud.progress(`문제 ${this.qi + 1}/${this.qs.length}`);
    speakQuestion(q);
    audio.play('whoosh', { vol: 0.5 });
    for (const p of this.s.players) if (p.bot) {
      const lv = this.s.level;
      p.bot.decideT = rand(...lv.react) * 1.2 + rand(0, 2.5);
      p.bot.pick = pickWeighted(q.a, q.c.length, lv.acc);
      p.bot.target = null;
    }
    for (let i = 0; i < 4; i++) this.coins.add(rand(-AX + 2, AX - 2), 0, rand(-AZ + 2, AZ - 2));
  }
  end() { if (this.over) return; this.over = true; this.s.endRound('끝!'); }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.4, 15.5 + b.y * 0.4, 17 + b.z * 0.35), look: new THREE.Vector3(b.x * 0.6, b.y * 0.4 + 1, b.z * 0.55 - 2.5) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k), a = 0.6 + e * 2.2;
    return { pos: new THREE.Vector3(Math.cos(a) * 30, 18 - e * 4, Math.sin(a) * 26), look: new THREE.Vector3(0, 1, 0) };
  }
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = b.x, tz = b.z, jump = false;
    if (this.state === 'ask' && p.picked == null && this.T - this.stT > m.decideT) {
      if (!m.target || !m.target.alive) {
        // 고른 보기의 낮은 풍선 중 가까운 것 (없으면 아무 낮은 풍선)
        const low = this.balloons.filter(x => x.alive && x.baseY < 3.8);
        let cand = low.filter(x => x.i === m.pick);
        if (!cand.length) cand = low;
        cand.sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z));
        m.target = cand[0] || null;
      }
      // 낮은 풍선이 없으면 높은 풍선 밑 트램펄린으로
      if (!m.target) { const hi = this.balloons.filter(x => x.alive).sort((a, c) => (a.i === m.pick ? 0 : 1) - (c.i === m.pick ? 0 : 1))[0]; if (hi) m.target = hi; }
      if (m.target) {
        tx = m.target.x; tz = m.target.z;
        const d = Math.hypot(tx - b.x, tz - b.z);
        if (m.target.baseY > 3.8 && b.grounded) {
          const pd = this.pads.slice().sort((a, c) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(c.x - tx, c.z - tz))[0];
          tx = pd.x; tz = pd.z;
          if (Math.hypot(pd.x - b.x, pd.z - b.z) < 2.3) jump = true;
        } else if (d < 1.1 && b.grounded && m.target.y > b.y + 1.2) jump = true;
      }
    } else { tx = b.x + Math.sin(m.t * 0.7 + m.noise) * 2; tz = b.z + Math.cos(m.t * 0.6 + m.noise) * 2; }
    const c = steer(p, tx, tz, lv, 0.08);
    // 바짝 붙으면 멈추지 말고 밑으로
    if (m.target && Math.hypot(tx - b.x, tz - b.z) < 0.6) { c.mx *= 0.3; c.mz *= 0.3; }
    return { mx: c.mx, mz: c.mz, jump, jumpHeld: true };
  }
  dispose() { for (const b of this.balloons) this.removeBalloon(b); this.s.scene.remove(this.root); }
}

// 같은 씨앗이면 모든 기기에서 같은 수열 (풍선 자리 맞추기)
function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
