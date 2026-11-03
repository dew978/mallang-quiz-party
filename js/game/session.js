// 라운드 한 판을 돌리는 실행기: 장면·물리·카메라·봇·떨어짐/다시 나타남·소개→카운트다운→경기→끝
import * as THREE from 'three';
import { scene as SC, camera, renderer, clock, adaptResolution, low } from '../engine/core.js';
import { World, makeBody, stepBody, collideBodies, setState, P } from '../engine/physics.js';
import { Mallang } from '../engine/mallang.js';
import { initFx, updateFx, fx, shake } from '../engine/fx.js';
import { input, moveVector, consumeEdges, clearInput } from '../engine/input.js';
import { audio } from '../audio.js';
import { save } from '../save.js';
import { hud } from './hud.js';
import { TRAILS, BOT_LEVEL } from '../data/game.js';
import { recordAnswer } from '../quiz.js';

const FIXED = 1 / 60;

export class Session {
  // opts: { RoundClass, roster:[{pid,name,charId,hat,trail,bot,me,remote}], questions, botLevel, net, onEnd }
  constructor(opts) {
    this.opts = opts;
    this.scene = SC;
    this.world = new World();
    this.t = 0; this.phase = 'load'; this.phaseT = 0;
    this.acc = 0; this.paused = false;
    this.level = BOT_LEVEL[opts.botLevel || save.settings.bots] || BOT_LEVEL.normal;
    this.isHost = !opts.net || opts.net.isHost;
    this.players = opts.roster.map((r, i) => ({ ...r, idx: i, body: makeBody(), stars: 0, coins: 0, finished: false, place: 0, answers: [], bot: (r.bot || (r.me && opts.demo)) ? { t: 0, mem: {} } : null }));
    this.me = this.players.find(p => p.me);
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camInit = false;
    this.wrongs = [];      // 내가 틀린 문제
    this.events = [];
  }
  async build() {
    // 이전 판 장면 정리 (카메라만 남김)
    const keep = new Set([camera]);
    for (const o of [...this.scene.children]) if (!keep.has(o)) this.scene.remove(o);
    initFx(this.scene);
    this.round = new this.opts.RoundClass(this);
    await this.round.build();
    this.players.forEach(p => {
      p.view = new Mallang(p.charId, { name: p.me ? (save.settings.name || '나') : p.name, me: p.me, hat: p.hat || 'none', showName: true });
      p.view.addTo(this.scene);
      p.trail = TRAILS.find(t => t.id === p.trail) || null;
    });
    await Promise.all(this.players.map(p => p.view.ready));
    this.round.spawn(this.players);
    for (const p of this.players) { p.view.update(p.body, 0, 0); setState(p.body, 'frozen'); }
    this.phase = 'intro'; this.phaseT = 0;
  }
  humans() { return this.players.filter(p => p.me || !p.bot); }
  // ---- 진행 ----
  start() {
    hud.show(true);
    hud.setRound(this.round.info);
    hud.setStars(this.me?.stars || 0);
    audio.playBgm(this.round.info.bgm);
    this.introLen = this.round.intro ? this.round.intro.length : 3;
    hud.roundCard(this.round.info, this.introLen);
  }
  frame(dt, draw = true) {
    dt = Math.min(dt, 0.1);
    adaptResolution(dt);
    if (this.paused) { this.render(dt, true); return; }
    this.acc += dt;
    let n = 0;
    while (this.acc >= FIXED && n < 6) { this.tick(FIXED); this.acc -= FIXED; n++; }
    if (n === 6) this.acc = 0;
    if (draw) this.render(dt, false);
  }
  tick(dt) {
    this.t += dt; this.phaseT += dt;
    const ph = this.phase;
    if (ph === 'intro') {
      if (this.phaseT >= this.introLen) { this.phase = 'count'; this.phaseT = 0; this.lastCount = 4; hud.roundCard(null); }
    } else if (ph === 'count') {
      const left = 3 - Math.floor(this.phaseT);
      if (left !== this.lastCount && left > 0) { this.lastCount = left; hud.count(String(left)); audio.play('count'); }
      if (this.phaseT >= 3) {
        this.phase = 'play'; this.phaseT = 0; hud.count('출발!', 'go'); audio.play('go');
        for (const p of this.players) if (p.body.state === 'frozen') setState(p.body, 'normal');
        input.enabled = true;
        this.round.begin?.();
      }
    } else if (ph === 'end') {
      if (this.phaseT > 2.6 && !this.ended) { this.ended = true; this.finish(); }
    }
    // 라운드 규칙
    this.round.update(dt, ph);
    // 몸 움직이기
    const playing = ph === 'play';
    for (const p of this.players) {
      if (p.remote) continue;
      const b = p.body;
      let c = null;
      if (p.me && !p.bot) {
        const m = moveVector(), e = consumeEdges();
        const f = this.round.forward || { x: 0, z: -1 };
        // 화면 위쪽 = 무대 앞쪽
        const rx = -f.z, rz = f.x;
        c = { mx: (f.x * m.y + rx * m.x), mz: (f.z * m.y + rz * m.x), jump: e.jump && playing, jumpHeld: input.jumpHeld, dive: e.dive && playing };
        if (!playing && ph !== 'end') { c.mx = c.mz = 0; }
      } else if (p.bot && playing && (this.isHost || p.me)) c = this.round.botCtrl(p, dt) || null;
      stepBody(b, c || undefined, dt, this.world);
      this.soundFor(p);
      // 떨어짐
      if (b.state !== 'fallen' && b.y < this.world.killY) this.fall(p);
      if (b.state === 'fallen') { p.fallT -= dt; if (p.fallT <= 0) this.respawn(p); }
    }
    for (const h of this.world.hazards) h.update?.(dt, this.t);
    for (const h of this.world.hazards) for (const p of this.players) if (!p.remote && p.body.state !== 'fallen' && p.body.state !== 'frozen') h.test?.(p, dt);
    collideBodies(this.players.map(p => p.body));
    this.opts.net?.tick?.(this, dt);
  }
  soundFor(p) {
    const b = p.body, near = p.me ? 1 : this.hearing(p);
    if (near <= 0.02) return;
    if (b.justJumped) audio.play('jump', { vol: 0.7 * near, rate: 0.9 + Math.random() * 0.2, gap: 0.06 });
    if (b.justDived) { audio.play('dive', { vol: 0.8 * near }); b.justDived = false; }
    if (b.justLanded && b.landImpact > 4) { audio.play('land', { vol: Math.min(1, b.landImpact / 14) * near, gap: 0.05 }); if (b.landImpact > 9) fx.dust({ x: b.x, y: b.y + 0.1, z: b.z }, 5); }
    if (b.bumpFx) { audio.play('bonk', { vol: 0.5 * b.bumpFx * near, rate: 1.3, gap: 0.12 }); b.bumpFx = 0; }
    if (b.stomped) { audio.play('bounce', { vol: 0.8 * near, rate: 1.3 }); b.stomped = 0; }
    // 발소리·발자국 효과
    if (b.grounded && b.state === 'normal') {
      const step = Math.floor(b.stepPhase / Math.PI);
      if (step !== p.lastStep) {
        p.lastStep = step;
        if (p.me) audio.play('step', { vol: 0.5, rate: 0.9 + Math.random() * 0.3, gap: 0.05 });
        if (p.trail && p.trail.id !== 'none') fx.trail({ x: b.x, y: b.y + 0.2, z: b.z }, p.trail.id === 'rainbow' ? 'star' : p.trail.id === 'note' ? 'note' : p.trail.id, p.trail.colors);
      }
    }
  }
  hearing(p) {
    if (!this.me) return 0.5;
    const d = Math.hypot(p.body.x - this.me.body.x, p.body.z - this.me.body.z);
    return Math.max(0, 1 - d / 16) * 0.6;
  }
  fall(p) {
    const b = p.body;
    setState(b, 'fallen'); p.fallT = this.round.respawnDelay ?? 1.4;
    p.view.setVisible(false);
    fx.splash({ x: b.x, y: this.round.seaY ?? -7, z: b.z });
    if (p.me || this.hearing(p) > 0.1) audio.play('splash', { vol: p.me ? 1 : 0.4 });
    if (p.me) { hud.toast('퐁당! 다시 올라가요'); shake.add(0.3); }
    this.round.onFall?.(p);
  }
  respawn(p) {
    const b = p.body;
    const spot = this.round.respawnSpot(p) || b.lastSafe;
    b.x = spot.x; b.y = spot.y + 0.05; b.z = spot.z; b.vx = b.vy = b.vz = 0;
    if (spot.yaw !== undefined) b.yaw = spot.yaw;
    setState(b, 'normal'); b.grounded = false; b.hitCool = 0.8;
    p.view.setVisible(true);
    fx.poof({ x: b.x, y: b.y + 0.6, z: b.z });
    if (p.me) audio.play('respawn');
  }
  // ---- 점수·문제 ----
  award(p, n, why) {
    if (!n) return;
    p.stars += n;
    if (p.me) { hud.setStars(p.stars, true); hud.popAt(p.body, `+${n}★`, 'star'); audio.play('star'); }
    this.opts.net?.reportStars?.(p, n);
  }
  answer(p, q, ok, pickIdx) {
    p.answers.push({ ok });
    if (!p.me) return;
    recordAnswer(q, ok);
    if (!ok && !this.wrongs.some(w => w.q === q.q)) this.wrongs.push({ ...q, pick: pickIdx });
  }
  // 모두 끝 (라운드가 부른다)
  endRound(text = '끝!', fromNet = false) {
    if (this.phase === 'end') return;
    // 친구와 할 때는 방장이 끝을 정한다
    if (this.opts.net && !this.isHost && !fromNet) return;
    if (this.opts.net && this.isHost) this.opts.net.endRound(text);
    this.phase = 'end'; this.phaseT = 0; input.enabled = false;
    hud.hideQuestion(); hud.banner(text, 'end'); audio.play('round_end');
    for (const p of this.players) if (p.body.state === 'normal') p.body.vx = p.body.vz = 0;
  }
  finish() {
    clearInput();
    this.opts.onEnd?.(this.results());
  }
  results() {
    return { players: this.players.map(p => ({ pid: p.pid, name: p.name, charId: p.charId, hat: p.hat, me: p.me, bot: !!p.bot, stars: p.stars, coins: p.coins, place: p.place, correct: p.answers.filter(a => a.ok).length, total: p.answers.length })), wrongs: this.wrongs };
  }
  // ---- 그리기 ----
  render(dt, paused) {
    const t = this.t;
    for (const p of this.players) {
      // 친구 몸은 받은 위치를 부드럽게 따라간다
      if (p.remote && p.net && !paused) {
        const b = p.body, n = p.net, k = Math.min(1, dt * 14);
        if (Math.hypot(n.x - b.x, n.z - b.z) > 6) { b.x = n.x; b.y = n.y; b.z = n.z; }
        b.x += (n.x - b.x) * k; b.y += (n.y - b.y) * k; b.z += (n.z - b.z) * k;
        let dy = n.yaw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * k;
        b.vx = n.vx; b.vy = n.vy; b.vz = n.vz; b.state = n.st; b.grounded = n.g; b.groundY = n.g ? b.y : b.groundY;
        if (b.grounded) b.stepPhase += Math.hypot(b.vx, b.vz) * dt * 1.45;
        p.view.setVisible(n.st !== 'fallen');
      }
      p.view.update(p.body, paused ? 0 : dt, t);
    }
    if (!paused) { updateFx(dt); this.round.visual?.(dt, t); }
    this.updateCamera(dt);
    renderer.render(this.scene, camera);
  }
  updateCamera(dt) {
    const r = this.round;
    let look, pos;
    if (this.phase === 'intro' && r.introCam) { const c = r.introCam(this.phaseT / this.introLen); pos = c.pos; look = c.look; this.camInit = false; }
    else {
      const tgt = this.me ? this.me.body : this.players[0].body;
      const c = r.camera(tgt);
      pos = c.pos; look = c.look;
    }
    if (!this.camInit) { this.camPos.copy(pos); this.camLook.copy(look); this.camInit = true; }
    const k = this.phase === 'intro' ? 1 : 1 - Math.exp(-dt * 6);
    this.camPos.lerp(pos, k); this.camLook.lerp(look, 1 - Math.exp(-dt * 9));
    camera.position.copy(this.camPos);
    if (shake.amt > 0 && save.settings.shake) {
      const a = shake.amt * shake.amt * 0.35;
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a;
      shake.amt = Math.max(0, shake.amt - dt * 2.2);
    }
    camera.lookAt(this.camLook);
    r.lights?.userData.follow?.(this.me ? new THREE.Vector3(this.me.body.x, 0, this.me.body.z) : this.camLook);
  }
  dispose() {
    this.round?.dispose?.();
    for (const p of this.players) p.view?.removeFrom(this.scene);
    hud.show(false);
  }
}

// ---- 봇 도우미 ----
// 목표점으로 걷기 (조금 흔들리게)
export function steer(p, tx, tz, lvl, wobble = 0.15) {
  const b = p.body, dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d < 0.25) return { mx: 0, mz: 0, d };
  const n = (p.bot.noise ??= Math.random() * 10);
  const w = Math.sin(p.bot.t * 1.7 + n) * wobble;
  const ca = Math.cos(w), sa = Math.sin(w);
  let mx = dx / d, mz = dz / d;
  [mx, mz] = [mx * ca - mz * sa, mx * sa + mz * ca];
  const s = Math.min(1, d / 1.2) * lvl.speed;
  return { mx: mx * s, mz: mz * s, d };
}
export const rand = (a, b) => a + Math.random() * (b - a);
export const pickWeighted = (correct, n, acc) => Math.random() < acc ? correct : (() => { let k; do { k = Math.floor(Math.random() * n); } while (k === correct && n > 1); return k; })();
