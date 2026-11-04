// 라운드 ② 젤리 발판 서바이벌: 둥근 섬이 보기 수만큼 색 구역으로 나뉜다. 시간 안에 정답 구역에 서 있으면 버틴다.
// 틀린 구역은 흔들리다 젤리 바다로 떨어진다. 4번째 문제부터 회전 막대, 6번째부터 섬이 돈다. 떨어져도 하늘에서 다시 내려온다.
import * as THREE from 'three';
import { mat, low } from '../engine/core.js';
import { setState } from '../engine/physics.js';
import { labelTexture } from '../engine/labels.js';
import { fx, shake } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand, pickWeighted } from '../game/session.js';
import { speakQuestion, stopSpeak } from '../tts.js';
import { answerTime } from '../quiz.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, backdrop, floatingIslands, bobIslands, hotAirBalloons, stripeTex } from './stage.js';
import { Coins, sweeper } from './common.js';

const R0 = 1.7, R1 = 12.5, H = 1.3;

export class TilesRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('tiles') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.qi = -1; this.state = 'wait'; this.stT = 0; this.rot = 0; this.rotSpeed = 0;
    this.sectors = []; this.intro = { length: 4 };
    this.respawnDelay = 1.6;
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4.5;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, 0) });
    this.lights = this.bd.lights;
    // 가운데 기둥 (시계)
    const hub = new THREE.Group(); root.add(hub);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(R0 - 0.1, R0 + 0.15, 3.4, 28), mat('#ffffff', { map: (() => { const t = stripeTex(PAL.hotpink, '#ffffff', 8, false).clone(); t.needsUpdate = true; t.repeat.set(3, 1); return t; })(), rough: 0.35 }));
    col.position.y = 1.7 - H; col.castShadow = !low(); hub.add(col);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R0 + 0.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(PAL.butter, { rough: 0.3 })); dome.position.y = 3.4 - H; hub.add(dome);
    w.add({ kind: 'cyl', x: 0, y: 1.0, z: 0, r: R0, hy: 2.4, noSafe: true, slippery: true });
    // 시계판 (남은 초)
    this.clockC = document.createElement('canvas'); this.clockC.width = 256; this.clockC.height = 128;
    this.clockT = new THREE.CanvasTexture(this.clockC); this.clockT.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.clockT, transparent: true, depthWrite: false }));
    clock.scale.set(3.6, 1.8, 1); clock.position.y = 4.5; clock.renderOrder = 6; clock.userData.camKeep = true; hub.add(clock);
    this.drawClock('');
    // 섬 밑 (떨어질 때 보이는 단면) — 구역이 다 떨어져도 바닥 테두리는 남는다
    const under = new THREE.Mesh(new THREE.CylinderGeometry(R1 * 0.55, 2.2, 7, 24), mat('#ffd1e6', { rough: 0.8 }));
    under.position.y = -H - 3.6; root.add(under);
    this.sweep = sweeper(s, root, { x: 0, z: 0, len: R1 - 0.3, speed: 0.95, height: 0.55, hub: false, color: PAL.grape });
    this.sweep.off = true;
    this.coins = new Coins(s, root);
    floatingIslands(root, [{ x: -32, y: -5, z: -24, size: 12 }, { x: 30, y: -2, z: -30 }, { x: -40, y: 2, z: 10, size: 14 }, { x: 38, y: -6, z: 8, size: 11 }, { x: 0, y: -8, z: -45, size: 16 }, { x: -18, y: 6, z: -48 }, { x: 20, y: 4, z: -52, size: 10 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, -10), 60);
    this.makeSectors(this.qs[0].c.length, true);
  }
  drawClock(text, hurry) {
    const x = this.clockC.getContext('2d'); x.clearRect(0, 0, 256, 128);
    if (text !== '') {
      x.fillStyle = hurry ? '#ff5f9e' : '#ffffff'; rr(x, 50, 8, 156, 112, 50); x.fill();
      x.lineWidth = 8; x.strokeStyle = hurry ? '#c9306a' : '#7a4bd8'; rr(x, 54, 12, 148, 104, 46); x.stroke();
      x.font = '84px "Black Han Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = hurry ? '#ffffff' : '#7a4bd8'; x.fillText(text, 128, 70);
    }
    this.clockT.needsUpdate = true;
  }
  // 보기 수만큼 부채꼴 구역 만들기 (윗면에 보기 글자)
  makeSectors(n, first) {
    const s = this.s, w = s.world;
    for (const sc of this.sectors) { this.root.remove(sc.mesh); sc.col.enabled = false; sc.mesh.traverse(o => { if (o.material?.map && o.material.map.isCanvasTexture) o.material.map.dispose(); }); }
    w.solids = w.solids.filter(x => !this.sectors.some(sc => sc.col === x));
    this.sectors = [];
    const span = Math.PI * 2 / n;
    // 첫 구역이 화면 아래쪽(카메라 쪽)에서 반씩 걸치도록
    const base = Math.PI / 2 - span / 2 + (n === 4 ? span / 2 : 0);
    for (let i = 0; i < n; i++) {
      const a0 = base + i * span, a1 = a0 + span;
      const st = ANSWER_STYLE[i];
      const g = new THREE.Group();
      const shape = new THREE.Shape(), gap = 0.05, steps = 24;
      for (let k = 0; k <= steps; k++) { const a = a0 + gap + (a1 - a0 - gap * 2) * k / steps; shape.lineTo(Math.cos(-a) * R1, Math.sin(-a) * R1); }
      for (let k = steps; k >= 0; k--) { const a = a0 + gap * 2 + (a1 - a0 - gap * 4) * k / steps; shape.lineTo(Math.cos(-a) * R0, Math.sin(-a) * R0); }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 4 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, -H, 0);
      const m = new THREE.Mesh(geo, [mat(st.hex, { rough: 0.35 }), mat(st.dark, { rough: 0.45 })]);
      m.receiveShadow = !low(); m.castShadow = !low();
      g.add(m);
      // 글자판 (누운 판, 화면 위쪽을 향해 읽힘)
      const am = (a0 + a1) / 2, rc = (R0 + R1) * 0.6;
      const lw = Math.min(7.2, 2 * rc * Math.sin(span / 2) * 1.15), lh = lw * 0.42;
      const tex = labelTexture(this.qs[Math.max(0, this.qi)]?.c[i] ?? '', { w: 512, h: Math.round(512 * lh / lw), fg: '#ffffff', stroke: st.dark, shape: st.shape, shapeColor: '#ffffff', size: 140 });
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      lab.position.set(Math.cos(am) * rc, 0.13, Math.sin(am) * rc); lab.renderOrder = 3;
      g.add(lab);
      g.rotation.y = this.rot;
      this.root.add(g);
      const col = w.add({ kind: 'sector', x: 0, y: -H / 2 + 0.12, z: 0, r0: R0, r1: R1, a0, a1, rot: this.rot, hy: H / 2 });
      this.sectors.push({ mesh: g, lab, col, i, a0, a1, y: 0, vy: 0, shakeT: 0, falling: false, back: 0 });
    }
  }
  setLabels(q) {
    // 보기 수가 바뀌면 새로 만들고, 같으면 글자만 바꾼다
    if (q.c.length !== this.sectors.length) { this.makeSectors(q.c.length); return; }
    for (const sc of this.sectors) {
      const st = ANSWER_STYLE[sc.i];
      const old = sc.lab.material.map;
      sc.lab.material.map = labelTexture(q.c[sc.i], { w: 512, h: old.image.height, fg: '#ffffff', stroke: st.dark, shape: st.shape, shapeColor: '#ffffff', size: 140 });
      old.dispose();
    }
  }
  spawn(players) {
    players.forEach((p, i) => {
      const a = i / players.length * Math.PI * 2 + 0.3, r = 5 + (i % 3) * 2.2;
      const b = p.body; b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.y = 0.1; b.yaw = Math.atan2(-b.x, -b.z);
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() { this.state = 'gap'; this.stT = 0.6; hud.hint('정답 <b>색 발판</b> 위로 가요! 시간이 끝나면 틀린 발판이 떨어져요', 4.5); }
  zoneOf(b) {
    const d = Math.hypot(b.x, b.z);
    if (d < R0 - 0.2 || d > R1 + 0.5) return -1;
    for (const sc of this.sectors) {
      let a = Math.atan2(b.z, b.x) + sc.col.rot;
      a = ((a - sc.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (a <= sc.a1 - sc.a0) return sc.i;
    }
    return -1;
  }
  respawnSpot(p) {
    // 하늘에서 정답 구역(또는 아무 구역) 위로 떨어진다
    const q = this.qs[this.qi], sc = this.sectors.find(x => x.col.enabled && (!q || x.i === q.a || this.state !== 'fall')) || this.sectors[0];
    const am = (sc.a0 + sc.a1) / 2 - sc.col.rot + rand(-0.4, 0.4), r = rand(4, 10);
    return { x: Math.cos(am) * r, y: 7, z: Math.sin(am) * r };
  }
  onFall(p) { if (p.me) hud.toast('퐁당! 하늘에서 다시 내려와요'); }
  update(dt, phase) {
    const s = this.s;
    this.coins.update(dt, s.t);
    // 섬 돌기
    if (this.rotSpeed) {
      this.rot += this.rotSpeed * dt;
      for (const sc of this.sectors) { s.world.move(sc.col, 0, sc.col.y, 0, this.rot); sc.mesh.rotation.y = this.rot; }
    } else for (const sc of this.sectors) { sc.col.dx = sc.col.dz = sc.col.dy = 0; sc.col.dyaw = 0; }
    // 떨어지는 구역 움직임
    for (const sc of this.sectors) {
      if (sc.shakeT > 0) { sc.shakeT -= dt; sc.mesh.position.x = Math.sin(s.t * 60) * 0.08; sc.mesh.position.y = sc.y + Math.sin(s.t * 47) * 0.05; }
      else if (sc.falling) { sc.vy -= 22 * dt; sc.y += sc.vy * dt; sc.mesh.position.set(0, sc.y, 0); sc.mesh.rotation.z = (sc.y) * 0.01; }
      else if (sc.back > 0) { sc.back -= dt; sc.y += (0 - sc.y) * Math.min(1, dt * 5); sc.mesh.position.set(0, sc.y, 0); sc.mesh.rotation.z = 0; if (sc.back <= 0) { sc.y = 0; sc.mesh.position.set(0, 0, 0); } }
    }
    if (phase !== 'play' || this.over) return;
    this.stT -= dt;
    const q = this.qs[this.qi];
    if (this.state === 'gap' && this.stT <= 0) this.nextQ();
    else if (this.state === 'ask') {
      const left = Math.max(0, this.stT);
      hud.timer(left / this.T, left);
      const sec = Math.ceil(left);
      if (sec !== this.lastSec) { this.lastSec = sec; this.drawClock(String(sec), sec <= 3); if (sec <= 3 && sec > 0) audio.play('tick', { vol: 1 }); }
      if (this.stT <= 0) {
        // 땡! 틀린 구역 흔들림
        this.state = 'crack'; this.stT = 0.9; this.drawClock('땡!', true);
        stopSpeak();
        for (const sc of this.sectors) if (sc.i !== q.a) sc.shakeT = 0.9;
        audio.play('tile_crack'); shake.add(0.2);
        // 판정은 떨어지기 전 위치로
        this.judge(q);
      }
    } else if (this.state === 'crack' && this.stT <= 0) {
      this.state = 'fall'; this.stT = 2.1;
      for (const sc of this.sectors) if (sc.i !== q.a) { sc.falling = true; sc.vy = 0; sc.col.enabled = false; }
      audio.play('tile_drop');
      for (const sc of this.sectors) if (sc.i === q.a) { const am = (sc.a0 + sc.a1) / 2 - sc.col.rot; fx.sparkle({ x: Math.cos(am) * 7, y: 0.5, z: Math.sin(am) * 7 }, 14, ['#ffffff', '#fff3a0']); }
    } else if (this.state === 'fall' && this.stT <= 0) {
      // 다시 올라오기
      for (const sc of this.sectors) if (sc.falling) { sc.falling = false; sc.y = -9; sc.back = 1.2; sc.col.enabled = true; }
      this.drawClock('');
      if (this.qi + 1 >= this.qs.length) { this.end(); return; }
      this.state = 'gap'; this.stT = 1.1;
      hud.hideQuestion();
    }
  }
  judge(q) {
    const s = this.s, last = this.qi >= this.qs.length - 2;
    for (const p of s.players) {
      const z = p.body.state === 'fallen' ? -1 : this.zoneOf(p.body);
      const ok = z === q.a;
      s.answer(p, q, ok, z);
      if (ok) { s.award(p, last ? 2 : 1, 'tile'); }
      if (p.me) {
        if (ok) { audio.play('correct'); hud.popAt(p.body, '버텼다!', 'good'); }
        else { audio.play('wrong'); if (z >= 0) hud.mark(z, false); }
        hud.reveal(q, ok, 3.2);
      }
      if (ok) p.view.emote = null;
    }
    hud.mark(q.a, true);
  }
  nextQ() {
    this.qi++;
    const q = this.qs[this.qi];
    this.setLabels(q);
    this.T = answerTime(q);
    this.state = 'ask'; this.stT = this.T; this.lastSec = -1;
    hud.question(q, { label: `문제 ${this.qi + 1}/${this.qs.length}` + (this.qi >= this.qs.length - 2 ? ' · 별 2배!' : '') });
    hud.progress(`문제 ${this.qi + 1}/${this.qs.length}`);
    speakQuestion(q);
    // 장애물 단계
    if (this.qi === 3) { this.sweep.off = false; hud.banner('회전 막대 등장!', 'bad', 1.6); audio.play('round_start', { vol: 0.5 }); hud.hint('막대가 오면 <b>점프</b>!', 3); }
    if (this.qi === 5) { this.rotSpeed = 0.22; hud.banner('섬이 돌기 시작해요!', 'bad', 1.6); }
    // 봇 생각
    for (const p of this.s.players) if (p.bot) {
      const lv = this.s.level;
      p.bot.decideT = rand(...lv.react) * (0.8 + this.T / 14) + rand(0, this.T * 0.25);
      p.bot.pick = pickWeighted(q.a, q.c.length, lv.acc);
      p.bot.switchT = Math.random() < 0.15 ? this.T * rand(0.6, 0.85) : -1;
      p.bot.r = rand(4.2, 10.5); p.bot.da = rand(-0.32, 0.32);
    }
    // 가끔 동전
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = rand(4, 11); this.coins.add(Math.cos(a) * r, 0, Math.sin(a) * r); }
  }
  end() {
    if (this.over) return; this.over = true;
    this.s.endRound('끝!');
  }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    const k = 0.4;
    return { pos: new THREE.Vector3(b.x * k, 14.5 + b.y * 0.3, 15.8 + b.z * k), look: new THREE.Vector3(b.x * 0.55, 0, b.z * 0.55 - 1.5) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k), a = -1.2 + e * 2.77;
    return { pos: new THREE.Vector3(Math.cos(a) * (30 - e * 6), 20 - e * 3, Math.sin(a) * (30 - e * 6)), look: new THREE.Vector3(0, 0, 0) };
  }
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = b.x, tz = b.z, jump = false;
    const q = this.qs[this.qi];
    if (this.state === 'ask' && q) {
      const elapsed = this.T - this.stT;
      if (m.switchT > 0 && elapsed > m.switchT) { m.pick = pickWeighted(q.a, q.c.length, Math.min(0.95, lv.acc + 0.2)); m.switchT = -1; }
      if (elapsed > m.decideT) {
        const sc = this.sectors[m.pick] || this.sectors[0];
        const am = (sc.a0 + sc.a1) / 2 - sc.col.rot + m.da;
        tx = Math.cos(am) * m.r; tz = Math.sin(am) * m.r;
      } else { tx = b.x + Math.sin(m.t * 0.9 + m.noise) * 2; tz = b.z + Math.cos(m.t * 0.7 + m.noise) * 2; }
    } else if (this.state === 'crack' || this.state === 'fall') {
      // 남은 정답 구역 쪽으로
      const sc = this.sectors[q?.a] || this.sectors[0];
      const am = (sc.a0 + sc.a1) / 2 - sc.col.rot + m.da;
      if (this.zoneOf(b) !== q?.a && this.state === 'crack' && Math.random() < 0.02) { tx = Math.cos(am) * 7; tz = Math.sin(am) * 7; }
    } else { tx = b.x + Math.sin(m.t * 0.5 + m.noise) * 1.5; tz = b.z + Math.cos(m.t * 0.6 + m.noise) * 1.5; }
    // 섬 밖으로 가지 않게
    const d = Math.hypot(tx, tz); if (d > R1 - 1.2) { tx *= (R1 - 1.2) / d; tz *= (R1 - 1.2) / d; }
    // 회전 막대 점프
    if (!this.sweep.off && b.grounded) {
      const r = Math.hypot(b.x, b.z);
      if (r > 1.5) {
        const ang = Math.atan2(b.z, b.x); let best = 9;
        for (const off of [0, Math.PI]) { const dd = Math.atan2(Math.sin(ang - this.sweep.a - off), Math.cos(ang - this.sweep.a - off)); if (dd > -0.05 && dd < best) best = dd; }
        const tc = (best - 0.8 / r) / this.sweep.speed;
        if (tc > 0.03 && tc < 0.28 && Math.random() > lv.slip * 0.6) jump = true;
      }
    }
    const c = steer(p, tx, tz, lv, 0.1);
    return { mx: c.mx, mz: c.mz, jump, jumpHeld: true };
  }
  dispose() { this.s.scene.remove(this.root); }
}
function rr(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
