// 라운드 ① 정답 문 대시: 코스를 달려 벽마다 정답 문으로 돌진. 틀린 문은 띠용~ 튕긴다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mat, low } from '../engine/core.js';
import { knock, setState } from '../engine/physics.js';
import { labelPlane, labelTexture } from '../engine/labels.js';
import { fx, shake } from '../engine/fx.js';
import { audio } from '../audio.js';
import { hud } from '../game/hud.js';
import { steer, rand, pickWeighted } from '../game/session.js';
import { speakQuestion } from '../tts.js';
import { ANSWER_STYLE, roundById } from '../data/game.js';
import { PAL, platform, rail, post, finishArch, backdrop, floatingIslands, bobIslands, hotAirBalloons } from './stage.js';
import { Coins, sweeper, pendulum, bumper, mover, gridSpawns } from './common.js';

const W = 16, HALF = 8;
const GATES = [-28, -62, -100, -142];
const FINISH = -160;
const CHECK = [{ z: 3 }, { z: -31 }, { z: -65 }, { z: -103 }, { z: -145 }];

export class DoorsRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('doors') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7;
    this.qs = s.opts.questions;      // 문제 4개
    this.finishOrder = [];
    this.gates = [];
    this.intro = { length: 4 };
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -5;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, -80) });
    this.lights = this.bd.lights;
    // 바닥 조각들
    const floors = [
      { z0: 7, z1: -30, color: PAL.pink }, { z0: -30, z1: -68, color: PAL.mint },
      { z0: -89, z1: -106, color: PAL.butter }, { z0: -106, z1: -146, color: PAL.lilac }, { z0: -146, z1: -172, color: PAL.sky },
    ];
    for (const f of floors) {
      platform(w, root, { x: 0, y: 0, z: (f.z0 + f.z1) / 2, w: W, d: f.z0 - f.z1, h: 1.4, color: f.color });
      rail(w, root, -HALF - 0.1, f.z0 - 0.3, -HALF - 0.1, f.z1 + 0.3, 0);
      rail(w, root, HALF + 0.1, f.z0 - 0.3, HALF + 0.1, f.z1 + 0.3, 0);
      for (const sx of [-1, 1]) { post(root, sx * (HALF + 0.1), 0, f.z0 - 0.3, f.color === PAL.pink ? PAL.mint : PAL.hotpink, 1.1); post(root, sx * (HALF + 0.1), 0, f.z1 + 0.3, PAL.butter, 1.1); }
    }
    // 출발 쪽 뒤 난간, 결승 끝 난간
    rail(w, root, -HALF, 6.8, HALF, 6.8, 0, PAL.white, 1.0, { x: 0, z: 0 }); rail(w, root, -HALF, -171.8, HALF, -171.8, 0, PAL.white, 1.0, { x: 0, z: -160 });
    // 장애물: 통통 기둥
    for (const [x, z] of [[-4.5, -9], [3.5, -13], [-1, -17.5], [5, -21], [-5.5, -22.5]]) bumper(s, root, { x, z, color: [PAL.hotpink, PAL.sky, PAL.grape][Math.abs(Math.round(x)) % 3] });
    // 회전 막대
    this.sweepers = [sweeper(s, root, { z: -40, len: 7.9, speed: 1.15 }), sweeper(s, root, { z: -53, len: 7.9, speed: -1.35, phase: 1.2, color: PAL.grape })];
    // 구름 징검다리: 고정 발판 줄 2개 + 가운데 넓게 움직이는 발판 1줄
    this.movers = []; this.pads = [];
    const rows = [{ z: -72 }, { z: -78.5, move: true }, { z: -85 }];
    rows.forEach((r, i) => {
      if (r.move) { const mv = mover(s, root, { x: 0, z: r.z, w: 10.5, d: 5.2, ax: 2.6, speed: 0.8, color: PAL.peach }); this.movers.push(mv); this.pads.push({ z: r.z, list: [{ col: mv.col, hw: 5.25 }] }); return; }
      const list = [];
      for (const x of [-5.3, 0, 5.3]) { const p = platform(w, root, { x, y: 0, z: r.z, w: 4.7, d: 5.2, h: 0.8, color: [PAL.sky, PAL.lime, PAL.sky][(i + (x > 0 ? 1 : 0)) % 3] }); list.push({ col: p.col, hw: 2.35 }); }
      this.pads.push({ z: r.z, list });
    });
    this.pads.push({ z: -91.6, list: [{ col: { x: 0, z: -91.6 }, hw: 7.5 }] });   // 징검다리 끝 바닥
    // 흔들리는 추
    this.pendulums = [pendulum(s, root, { z: -116, phase: 0 }), pendulum(s, root, { z: -126, phase: 1.9, color: PAL.hotpink }), pendulum(s, root, { z: -136, phase: 3.6, color: PAL.sky })];
    // 정답 벽
    GATES.forEach((gz, i) => this.gates.push(this.buildGate(gz, this.qs[i], i)));
    finishArch(root, FINISH, W, 0, '도착!');
    // 동전
    this.coins = new Coins(s, root);
    this.coins.line(-6, -4, -6, -24, 5); this.coins.line(6, -4, 6, -24, 5); this.coins.line(0, -34, 0, -58, 6);
    for (const r of rows) { this.coins.add(-5.3, 0.6, r.z); this.coins.add(5.3, 0.6, r.z); }
    this.coins.line(-5, -110, 5, -140, 7); this.coins.line(0, -148, 0, -158, 3);
    // 멀리 장식
    floatingIslands(root, [{ x: -30, y: -6, z: -20, size: 12 }, { x: 34, y: -3, z: -50 }, { x: -36, y: 0, z: -95, size: 14 }, { x: 30, y: -8, z: -125, size: 11 }, { x: -28, y: -4, z: -165 }, { x: 36, y: 2, z: -185, size: 13 }, { x: 0, y: -10, z: -215, size: 18 }]);
    hotAirBalloons(root, 4, new THREE.Vector3(0, 0, -90), 75);
  }
  buildGate(gz, q, gi) {
    const s = this.s, root = this.root, n = q.c.length;
    const g = new THREE.Group(); g.position.z = gz; root.add(g);
    const postW = 0.6, dw = (W - (n + 1) * postW) / n, H = 3.1, wallH = 4.4, T = 0.9;
    const wallM = mat(PAL.white, { rough: 0.4 });
    // 기둥과 위쪽 벽
    for (let i = 0; i <= n; i++) {
      const x = -HALF + postW / 2 + i * (dw + postW);
      const p = new THREE.Mesh(new RoundedBoxGeometry(postW, wallH, T, 2, 0.18), mat(i % 2 ? PAL.hotpink : PAL.grape, { rough: 0.35 }));
      p.position.set(x, wallH / 2, 0); p.castShadow = !low(); g.add(p);
      s.world.add({ kind: 'box', x, y: wallH / 2, z: gz, hx: postW / 2, hy: wallH / 2, hz: T / 2, noSafe: true });
    }
    const lintel = new THREE.Mesh(new RoundedBoxGeometry(W + 0.4, wallH - H, T, 2, 0.2), wallM);
    lintel.position.set(0, H + (wallH - H) / 2, 0); g.add(lintel);
    s.world.add({ kind: 'box', x: 0, y: H + (wallH - H) / 2, z: gz, hx: HALF, hy: (wallH - H) / 2, hz: T / 2, noSafe: true });
    // 문제 판 (위쪽, 앞에서 보이게)
    const board = labelPlane(q.q, 13.5, 2.3, { bg: '#ffffff', fg: '#3a2a5a', stroke: null, border: '#ff8fbf', size: 84, font: '"PretendardEB", sans-serif', radius: 50 });
    board.position.set(0, wallH + 1.45, 0.05); g.add(board);
    const boardBack = new THREE.Mesh(new RoundedBoxGeometry(14, 2.6, 0.3, 2, 0.3), mat(PAL.hotpink, { rough: 0.35 })); boardBack.position.set(0, wallH + 1.45, -0.2); g.add(boardBack);
    const num = labelPlane(`${gi + 1}/4`, 1.8, 0.9, { bg: PAL.butter, fg: '#7a4a00', stroke: null, size: 70, radius: 30 }); num.position.set(-6.4, wallH + 2.85, 0.1); g.add(num);
    // 문 (정답 문은 통과, 오답 문은 막힘)
    const doors = [];
    for (let i = 0; i < n; i++) {
      const x = -HALF + postW + dw / 2 + i * (dw + postW);
      const st = ANSWER_STYLE[i];
      const jm = new THREE.MeshStandardMaterial({ color: st.hex, transparent: true, opacity: 0.88, roughness: 0.2, metalness: 0, emissive: st.hex, emissiveIntensity: 0.12 });
      const panel = new THREE.Mesh(new RoundedBoxGeometry(dw, H, 0.34, 2, 0.15), low() ? new THREE.MeshLambertMaterial({ color: st.hex, transparent: true, opacity: 0.9 }) : jm);
      panel.position.set(x, H / 2, 0); g.add(panel);
      const lab = labelPlane(q.c[i], dw * 0.94, Math.min(1.7, dw * 0.62), { fg: '#ffffff', stroke: st.dark, shape: st.shape, shapeColor: '#ffffff', size: 120 });
      lab.position.set(x, H * 0.55, 0.19); g.add(lab);
      const x2 = new THREE.Mesh(new THREE.PlaneGeometry(dw * 0.6, dw * 0.6), new THREE.MeshBasicMaterial({ map: xTex(), transparent: true, depthWrite: false }));
      x2.position.set(x, H * 0.5, 0.22); x2.visible = false; x2.renderOrder = 5; g.add(x2);
      const correct = i === q.a;
      const col = s.world.add({ kind: 'box', x, y: H / 2, z: gz, hx: dw / 2, hy: H / 2, hz: 0.17, noSafe: true, pass: correct ? () => true : null });
      if (!correct) col.onPush = (b, nx, nz, vn) => this.bonk(b, gi, i, vn);
      doors.push({ x, panel, lab, x2, correct, wob: 0 });
    }
    return { z: gz, q, doors, n, group: g };
  }
  spawn(players) {
    const sp = gridSpawns(players.length, 1.5, 13, 6, 2.4);
    players.forEach((p, i) => {
      const b = p.body, o = sp[i]; b.x = o.x; b.y = 0.1; b.z = o.z; b.yaw = Math.PI;
      b.lastSafe = { x: o.x, y: 0, z: o.z };
      p.gate = 0; p.tries = [new Set(), new Set(), new Set(), new Set()]; p.cp = 0;
      if (p.bot) p.bot.lane = (Math.random() - 0.5) * 11;
    });
  }
  begin() { this.started = true; hud.progress('벽 1/4'); hud.hint('정답이 적힌 <b>문</b>으로 달려가요! 장애물은 <b>점프</b>(Space)로 넘어요', 4.5); }
  // 틀린 문에 부딪힘
  bonk(b, gi, di, vn) {
    const p = this.s.players.find(x => x.body === b); if (!p || p.gate !== gi) return;
    const gate = this.gates[gi];
    if (b.hitCool > 0) return;
    knock(b, (Math.random() - 0.5) * 2, 4.5, 7.5, 0.75);
    b.hitCool = 0.5;
    const first = p.tries[gi].size === 0 && !p.passed?.[gi];
    p.tries[gi].add(di);
    const d = gate.doors[di]; d.wob = 1;
    if (p.me) {
      audio.play('bonk'); shake.add(0.35); d.x2.visible = true;
      hud.mark(di, false); hud.popAt(b, '띠용~', 'bad');
      if (first) { this.s.answer(p, gate.q, false, di); audio.play('wrong', { vol: 0.6 }); }
    } else if (this.s.hearing(p) > 0.1) audio.play('bonk', { vol: this.s.hearing(p) * 0.8 });
    fx.stars({ x: b.x, y: b.y + 1.2, z: b.z }, 5);
  }
  respawnSpot(p) {
    const c = CHECK[p.cp] || CHECK[0];
    return { x: (Math.random() - 0.5) * 6, y: 0, z: c.z, yaw: Math.PI };
  }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    if (phase !== 'play') return;
    this.playT = (this.playT || 0) + dt;
    for (const p of s.players) {
      if (p.remote) continue;
      const b = p.body;
      // 체크포인트
      for (let i = CHECK.length - 1; i > p.cp; i--) if (b.z < CHECK[i].z + 0.5 && b.grounded) { p.cp = i; break; }
      // 벽 통과
      const gi = p.gate;
      if (gi < GATES.length && b.z < GATES[gi] - 0.7 && b.state !== 'fallen') {
        const gate = this.gates[gi];
        const first = p.tries[gi].size === 0;
        p.passed ||= []; p.passed[gi] = true;
        p.gate++;
        // 정답 문 출렁
        const di = gate.doors.reduce((best, d, i) => Math.abs(d.x - b.x) < Math.abs(gate.doors[best].x - b.x) ? i : best, 0);
        gate.doors[di].wob = 1;
        if (first) { s.answer(p, gate.q, true, gate.q.a); s.award(p, 2, 'gate'); b.boostT = 1.6; }
        if (p.me) {
          fx.confetti({ x: b.x, y: b.y + 1.5, z: b.z }, 26);
          audio.play('door_burst'); if (first) audio.play('correct');
          hud.mark(gate.q.a, true); hud.reveal(gate.q, first, 2.8);
          setTimeout(() => { if (p.gate === gi + 1) hud.hideQuestion(); }, 1400);
          hud.progress(p.gate < 4 ? `벽 ${p.gate + 1}/4` : '결승선으로!');
          if (first) hud.popAt(b, '부스터!', 'good');
        } else if (s.hearing(p) > 0.15) audio.play('door_burst', { vol: 0.4 * s.hearing(p) });
      }
      // 문제 보여 주기 (벽에 가까워지면)
      if (p.me && p.gate < GATES.length && p.shownGate !== p.gate && b.z < GATES[p.gate] + 24) {
        p.shownGate = p.gate;
        const q = this.gates[p.gate].q;
        hud.question(q, { label: `벽 ${p.gate + 1} 문제` });
        speakQuestion(q);
      }
      // 결승
      if (!p.finished && b.z < FINISH) {
        p.finished = true; this.finishOrder.push(p); p.place = this.finishOrder.length;
        const bonus = [3, 2, 1][p.place - 1] || 0;
        if (bonus) s.award(p, bonus, 'place');
        p.view.emote = 'cheer';
        if (p.me) {
          hud.banner(`<b>${p.place}등</b> 도착!`, 'big'); audio.play('cheer'); fx.confetti({ x: b.x, y: b.y + 2, z: b.z }, 60, 1.3);
          hud.place(`${p.place}등`);
        }
      }
    }
    // 끝: 내가 도착하고 2.5초, 또는 2분 40초
    const humans = s.humans();
    const allIn = humans.every(p => p.finished);
    if (allIn) { this.doneT = (this.doneT || 0) + dt; if (this.doneT > 2.5) this.end(); }
    if (this.playT > 160) this.end('시간 끝!');
    if (this.playT > 140 && !this.warned) { this.warned = true; hud.toast('20초 남았어요!'); }
  }
  end(text) {
    if (this.over) return; this.over = true;
    // 못 들어온 사람은 남은 거리 순으로 순위
    const rest = this.s.players.filter(p => !p.finished).sort((a, b) => a.body.z - b.body.z);
    for (const p of rest) { this.finishOrder.push(p); p.place = this.finishOrder.length; }
    this.s.endRound(text || '끝!');
  }
  visual(dt, t) {
    for (const g of this.gates) for (const d of g.doors) {
      if (d.wob > 0) { d.wob = Math.max(0, d.wob - dt * 2.2); const k = Math.sin(d.wob * 18) * d.wob * 0.12; d.panel.scale.set(1 + k, 1 - k, 1 + k * 3); }
    }
    this.bd.update(dt); bobIslands(this.root, t);
  }
  camera(b) {
    const x = b.x * 0.55;
    return { pos: new THREE.Vector3(x, b.y * 0.7 + 6.4, b.z + 9.8), look: new THREE.Vector3(b.x * 0.75, b.y * 0.8 + 1.1, b.z - 4.5) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k);
    const z = FINISH + 6 + (16 - (FINISH + 6)) * e;
    return { pos: new THREE.Vector3(Math.sin(k * 3) * 6, 15 - e * 7, z + 10), look: new THREE.Vector3(0, 1.5, z - 8) };
  }
  // ---- 봇 ----
  botCtrl(p, dt) {
    const s = this.s, b = p.body, lv = s.level, m = p.bot;
    m.t += dt;
    if (p.finished) { const c = steer(p, m.lane, FINISH - 6, lv); return { ...c, jumpHeld: true }; }
    if (b.state !== 'normal') return null;
    let tx = m.lane, tz = b.z - 8, jump = false;
    const gi = p.gate;
    if (gi > 0 && b.z > GATES[gi - 1] - 1.2 && b.z < GATES[gi - 1] + 4) { const g = this.gates[gi - 1]; tx = g.doors[g.q.a].x; }
    // 다가가는 벽: 문 고르기 (읽는 시간만큼 천천히)
    if (gi < GATES.length && b.z < GATES[gi] + 16) {
      const gate = this.gates[gi];
      if (m.gate !== gi || m.pick == null || p.tries[gi].has(m.pick)) {
        if (m.gate !== gi) { m.gate = gi; m.readT = rand(...lv.react); }
        const tries = p.tries[gi].size;
        const acc = Math.min(0.97, lv.acc + tries * 0.25);
        let pick = pickWeighted(gate.q.a, gate.n, acc);
        if (p.tries[gi].has(pick)) pick = gate.q.a;
        m.pick = pick;
      }
      const door = gate.doors[m.pick];
      tx = door.x + (m.noise % 1 - 0.5) * 0.6; tz = GATES[gi] - 3;
      if (m.readT > 0) { m.readT -= dt; tz = Math.max(tz, b.z - 2.5); }
    }
    // 회전 막대: 막대가 닿기 0.05~0.3초 전에 점프
    this.sweepers.forEach((sw, si) => {
      const swz = si === 0 ? -40 : -53, sp = si === 0 ? 1.15 : -1.35;
      const r = Math.hypot(b.x, b.z - swz);
      if (r > 8.4 || r < 0.9 || !b.grounded) return;
      const ang = Math.atan2(b.z - swz, b.x);
      let best = 9;
      for (const off of [0, Math.PI]) { const dd = Math.atan2(Math.sin(ang - sw.a - off), Math.cos(ang - sw.a - off)) * Math.sign(sp); if (dd > -0.05 && dd < best) best = dd; }
      const tc = (best - 0.8 / r) / Math.abs(sp);
      if (tc > 0.03 && tc < 0.28 && Math.random() > lv.slip * 0.5) jump = true;
    });
    // 징검다리: 다음 줄에서 내 앞을 덮는 발판을 찾아 달려서 뛴다
    if (b.z < -64 && b.z > -90) {
      const row = this.pads.find(r => r.z < b.z - 2.7);
      const onPad = b.ground && this.pads.some(r => r.list.some(x => x.col === b.ground));
      const edgeZ = onPad ? b.ground.z - b.ground.hz : -68;
      if (!row) { tz = -94; }
      else {
        let best = null, bestD = 1e9;
        for (const x of row.list) { const dx = Math.max(0, Math.abs(x.col.x - b.x) - (x.hw - 0.9)); if (dx < bestD) { bestD = dx; best = x; } }
        tx = Math.max(best.col.x - best.hw + 1, Math.min(best.col.x + best.hw - 1, b.x + (m.noise % 1 - 0.5)));
        tz = row.z - 1;
        if (b.grounded && (onPad || b.z < -62)) {
          if (bestD > 0.2 + lv.slip) { tz = edgeZ + 1.3; }
          else if (b.z - edgeZ < 1.0) jump = true;
        }
      }
    }
    // 흔들 추: 추가 가까우면 잠깐 멈춤
    for (const pd of this.pendulums) {
      const pz = [-116, -126, -136][this.pendulums.indexOf(pd)];
      if (b.z > pz && b.z - pz < 3.2 && Math.abs(pd.hx - b.x) < 3.2 && Math.sign(pd.vx) === Math.sign(b.x - pd.hx) && Math.random() > lv.slip) tz = b.z + 0.5;
    }
    const c = steer(p, tx, tz, lv);
    // 막히면 점프
    if (b.bumped > 0 && Math.random() < 0.05) jump = true;
    return { mx: c.mx, mz: c.mz, jump, jumpHeld: true, dive: false };
  }
  dispose() {
    this.s.scene.remove(this.root);
  }
}

let xT = null;
function xTex() {
  if (xT) return xT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.lineCap = 'round'; x.strokeStyle = '#3a2a5a'; x.lineWidth = 30; x.beginPath(); x.moveTo(26, 26); x.lineTo(102, 102); x.moveTo(102, 26); x.lineTo(26, 102); x.stroke();
  x.strokeStyle = '#ffffff'; x.lineWidth = 16; x.stroke();
  xT = new THREE.CanvasTexture(c); return xT;
}
