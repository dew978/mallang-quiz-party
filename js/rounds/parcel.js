// 라운드 ⑧ 정답 택배 배달 (2026-11-05): 하늘에서 보기 택배 상자가 떨어진다. 정답 상자에 닿으면 머리 위로 번쩍 들고(조금 느려짐),
// 가운데 정답 우체통에 넣으면 별(먼저 넣을수록 3·2). 틀린 상자는 "반송!" 튕겨 나온다. 상자 든 친구에게 다이브로 부딪히면 상자를 떨어뜨려 빼앗을 수 있고,
// 들고 다이브하면 상자를 앞으로 던진다. 정답 상자는 문제마다 3개뿐.
// 누가 어떤 상자를 들었는지는 방장(혼자면 내 기기)이 정한다: 친구 기기는 "줍기·놓기·넣기"를 부탁('rq')하고 방장이 결과를 알린다.
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
import { PAL, platform, rail, post, backdrop, floatingIslands, bobIslands, hotAirBalloons, prop } from './stage.js';
import { Coins, bumper } from './common.js';
import { QuizLoop, seeded, roundSeed, shuffled } from './quizloop.js';

const AX = 12.5, AZ = 10;
const MAIL_R = 2.5;          // 우체통에 넣는 거리
const COPIES = 3;            // 보기마다 상자 수
const CARRY_SPEED = 0.86;
const STARS = [3, 2, 2];

export class ParcelRound {
  constructor(s) {
    this.s = s; this.info = { ...roundById('parcel') };
    this.forward = { x: 0, z: -1 };
    this.seaY = -7; this.qs = s.opts.questions;
    this.parcels = []; this.intro = { length: 4 };
    this.loop = new QuizLoop(this, { extra: 12, show: 2.2 });
    this.okCount = 0;
  }
  async build() {
    const s = this.s, w = s.world, root = this.root = new THREE.Group(); s.scene.add(root);
    w.killY = -4;
    this.bd = backdrop(s.scene, { center: new THREE.Vector3(0, 0, 0) });
    this.lights = this.bd.lights;
    platform(w, root, { x: 0, y: 0, z: 0, w: AX * 2, d: AZ * 2, h: 1.6, color: PAL.peach, top: '#fff6ee' });
    const ins = { x: 0, z: 0 };
    rail(w, root, -AX, -AZ, AX, -AZ, 0, PAL.white, 1.0, ins); rail(w, root, -AX, AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    rail(w, root, -AX, -AZ, -AX, AZ, 0, PAL.white, 1.0, ins); rail(w, root, AX, -AZ, AX, AZ, 0, PAL.white, 1.0, ins);
    for (const [x, z] of [[-AX, -AZ], [AX, -AZ], [-AX, AZ], [AX, AZ]]) post(root, x, 0, z, PAL.hotpink, 1.4);
    this.buildMailbox(root, w);
    for (const [x, z, col] of [[-7, -5, PAL.mint], [7, -5, PAL.sky], [-7, 5, PAL.butter], [7, 5, PAL.grape]]) bumper(s, root, { x, z, r: 0.6, color: col });
    this.coins = new Coins(s, root);
    for (const [i, [x, z]] of [[-20, -15], [20, -15], [-21, 9], [21, 9], [0, -24]].entries()) prop(root, ['prop_giftbox', 'prop_cupcake', 'prop_icecream', 'prop_giftbox', 'prop_cottoncandy'][i], { x, y: -3 + (i % 2), z, size: 7 + (i % 3) });
    floatingIslands(root, [{ x: -34, y: -5, z: -26, size: 12 }, { x: 32, y: -2, z: -32 }, { x: -42, y: 2, z: 12, size: 14 }, { x: 40, y: -6, z: 10, size: 11 }]);
    hotAirBalloons(root, 3, new THREE.Vector3(0, 0, -10), 60);
    w.addHazard({ update: () => {}, test: p => this.testOwn(p) });
  }
  buildMailbox(root, w) {
    const g = new THREE.Group(); root.add(g);
    g.userData.camKeep = true;      // 목표물이라 카메라를 가려도 늘 보이게
    const red = mat('#ff4f6d', { rough: 0.35 }), white = mat(PAL.white, { rough: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 2.4, 26), red); body.position.y = 1.2; body.castShadow = !low(); g.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), red); dome.position.y = 2.4; g.add(dome);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.25, 26), white); band.position.y = 1.9; g.add(band);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const slot = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.22, 0.2, 1, 0.08), mat('#2a1d3a')); slot.position.set(Math.sin(a) * 1.13, 2.1, Math.cos(a) * 1.13); slot.rotation.y = a; g.add(slot); }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.5), mat(PAL.butter)); flag.position.set(1.25, 2.3, 0); g.add(flag);
    w.add({ kind: 'cyl', x: 0, y: 1.2, z: 0, r: 1.15, hy: 1.2, noSafe: true });
    const ring = new THREE.Mesh(new THREE.RingGeometry(MAIL_R - 0.25, MAIL_R, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4f6d', transparent: true, opacity: 0.55, depthWrite: false }));
    ring.position.y = 0.05; ring.renderOrder = 1; ring.userData.camKeep = true; root.add(ring);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('정답 우체통', { w: 512, h: 160, bg: '#ffffff', fg: '#ff4f6d', stroke: null, border: '#ff4f6d', size: 100, radius: 60 }), transparent: true, depthWrite: false }));
    sign.scale.set(3.6, 1.12, 1); sign.position.y = 4.1; sign.renderOrder = 6; g.add(sign);
    this.mail = g; this.mailRing = ring; this.mailBody = body;
  }
  spawn(players) {
    players.forEach((p, i) => {
      const a = i / players.length * Math.PI * 2, r = 4.2 + (i % 2) * 1.3;
      const b = p.body; b.x = Math.cos(a) * r * 1.3; b.z = Math.sin(a) * r; b.y = 0.1; b.yaw = Math.atan2(-b.x, -b.z);
      b.lastSafe = { x: b.x, y: 0, z: b.z };
    });
  }
  begin() {
    this.loop.start();
    hud.hint('<b>정답 택배</b>에 닿으면 번쩍! 가운데 <b>우체통</b>에 넣어요. 든 친구에게 <b>다이브</b>하면 빼앗아요', 5);
  }
  respawnSpot() { return { x: rand(-6, 6), y: 6, z: rand(5, 7) }; }
  // ---- 상자 ----
  onAsk(q, qi) {
    this.clearParcels();
    this.okCount = 0; this.okLeft = COPIES;
    const rng = seeded(roundSeed(this.s, qi, 13)), n = q.c.length;
    const spots = [];
    for (let k = 0; k < n * COPIES; k++) {
      let x, z, tries = 0;
      do { const a = rng() * Math.PI * 2, r = 5 + rng() * 5; x = Math.cos(a) * r * 1.1; z = Math.sin(a) * r * 0.85; tries++; }
      while (tries < 20 && (Math.abs(x) > AX - 1.5 || Math.abs(z) > AZ - 1.5 || spots.some(o => Math.hypot(o.x - x, o.z - z) < 2.2)));
      spots.push({ x, z });
    }
    const order = shuffled([...Array(n * COPIES).keys()], rng);
    order.forEach((slot, k) => this.parcels.push(this.makeParcel(k, k % n, spots[slot].x, spots[slot].z, 0.15 + (k % 6) * 0.12)));
    for (const p of this.s.players) { p.carry = null; if (!p.remote) p.body.speedMul = 1; p.reqT = 0; }
    for (let i = 0; i < 2; i++) this.coins.add(rand(-AX + 2, AX - 2), 0, rand(-AZ + 2, AZ - 2));
  }
  makeParcel(id, ai, x, z, delay) {
    const st = ANSWER_STYLE[ai], g = new THREE.Group(); g.userData.camKeep = true;
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.75, 0.95, 2, 0.1), mat(st.hex, { rough: 0.45 })); box.castShadow = !low(); g.add(box);
    const rib = mat('#ffffff', { rough: 0.35 });
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.77, 0.16), rib); g.add(r1);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.77, 0.98), rib); g.add(r2);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12), rib); bow.position.y = 0.44; bow.rotation.x = Math.PI / 2; g.add(bow);
    this.root.add(g);
    const lt = labelTexture(this.loop.q.c[ai], { w: 512, h: 220, bg: 'rgba(255,255,255,0.96)', fg: st.dark, stroke: null, shape: st.shape, shapeColor: st.hex, size: 120, radius: 70, border: st.hex });
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false }));
    lab.scale.set(2.0, 0.86, 1); lab.renderOrder = 6; this.root.add(lab);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b2357', transparent: true, opacity: 0.2, depthWrite: false }));
    shadow.renderOrder = 2; this.root.add(shadow);
    return { id, i: ai, g, lab, shadow, x, z, y: 9 + delay * 8, vy: 0, vx: 0, vz: 0, state: 'drop', holder: null, cool: {}, wob: Math.random() * 6 };
  }
  clearParcels() {
    for (const k of this.parcels) { this.root.remove(k.g); this.root.remove(k.lab); this.root.remove(k.shadow); k.lab.material.map.dispose(); k.lab.material.dispose(); }
    this.parcels = [];
    for (const p of this.s.players) { p.carry = null; if (!p.remote) p.body.speedMul = 1; }
  }
  byId(id) { return this.parcels.find(k => k.id === id); }
  // ---- 부탁 → 방장이 정함 ----
  req(kind, d) {
    const s = this.s;
    if (!s.opts.net || s.isHost) this.hostReq(kind, d);
    else s.opts.net.event('rq', { kind, qi: this.loop.qi, ...d });
  }
  hostReq(kind, d) {
    const s = this.s, k = this.byId(d.id);
    if (!this.loop.asking || !k) return;
    if (kind === 'pick') {
      if (k.state !== 'free' || (k.cool[d.pp] || 0) > s.t) return;
      const p = s.players.find(x => x.pid === d.pp); if (!p || p.carry != null) return;
      this.send('pk', { id: k.id, pp: d.pp });
    } else if (kind === 'drop') {
      if (k.holder !== d.pp) return;
      this.send('pd', { id: k.id, pp: d.pp, x: d.x, z: d.z, vx: d.vx, vz: d.vz });
    } else if (kind === 'deliver') {
      if (k.holder !== d.pp) return;
      const ok = k.i === this.loop.q.a;
      const n = ok ? this.okCount : -1;
      this.send('dl', { id: k.id, pp: d.pp, ok: ok ? 1 : 0, n });
    }
  }
  send(k, d) { this.s.opts.net?.event(k, { qi: this.loop.qi, ...d }); this.apply(k, d); }
  apply(kind, d) {
    const s = this.s, k = this.byId(d.id), p = s.players.find(x => x.pid === d.pp);
    if (!k || !p) return;
    if (kind === 'pk') {
      k.state = 'held'; k.holder = p.pid; p.carry = k.id;
      if (!p.remote) p.body.speedMul = CARRY_SPEED;
      const near = p.me ? 1 : s.hearing(p);
      if (near > 0.05) audio.play('jump', { vol: 0.6 * near, rate: 1.4 });
      if (p.me) hud.popAt(p.body, '번쩍!', '');
    } else if (kind === 'pd') {
      k.state = 'free'; k.holder = null; k.x = d.x; k.z = d.z; k.y = 2.0; k.vy = 3; k.vx = d.vx; k.vz = d.vz; k.cool[p.pid] = s.t + 0.9;
      if (p.carry === k.id) { p.carry = null; if (!p.remote) p.body.speedMul = 1; }
      fx.dust({ x: d.x, y: 1, z: d.z }, 5);
      if (p.me) hud.popAt(p.body, '앗, 떨어뜨렸다!', 'bad');
    } else if (kind === 'dl') {
      if (p.carry === k.id) { p.carry = null; if (!p.remote) p.body.speedMul = 1; }
      if (d.ok) {
        k.state = 'gone'; k.holder = null; this.okCount = Math.max(this.okCount, d.n + 1); this.okLeft = COPIES - this.okCount;
        this.mailPop = 1;
        burst({ x: 0, y: 2.6, z: 0 }, { kind: 'star', colors: [ANSWER_STYLE[k.i].hex, '#ffe34d', '#ffffff'], count: 18, speed: 5, up: 6, gravity: 8, life: 1, size: 0.4 });
        this.removeParcelMesh(k);
        if (!p.remote) { this.loop.record(p, k.i); s.award(p, STARS[Math.min(d.n, STARS.length - 1)], 'mail'); }
        else if (p.qa && p.qa.ans == null) p.qa.ans = k.i;
        if (p.qa) p.qa.ok = true;
        if (p.view) { p.view.emote = 'cheer'; setTimeout(() => { if (p.view?.emote === 'cheer') p.view.emote = null; }, 1100); }
        if (p.me) { audio.play('correct'); audio.play('door_burst', { vol: 0.6 }); hud.popAt(p.body, d.n === 0 ? '1등 배달! +3' : '배달 완료! +2', 'good'); shake.add(0.2); }
        else if (s.hearing(p) > 0.05) audio.play('star', { vol: s.hearing(p) * 0.5 });
        if (this.okLeft <= 0) hud.toast('정답 택배를 모두 배달했어요!');
      } else {
        // 반송: 우체통이 상자를 밖으로 퉤
        const a = Math.atan2(p.body.x, p.body.z);
        k.state = 'free'; k.holder = null; k.x = Math.sin(a) * 1.6; k.z = Math.cos(a) * 1.6; k.y = 2.6; k.vy = 6; k.vx = Math.sin(a) * 6; k.vz = Math.cos(a) * 6; k.cool[p.pid] = s.t + 2.5;
        this.mailPop = 1;
        if (!p.remote) { this.loop.record(p, k.i); setState(p.body, 'stun', 0.7); }
        else if (p.qa && p.qa.ans == null) p.qa.ans = k.i;
        if (p.me) { audio.play('bonk'); audio.play('wrong', { vol: 0.5 }); hud.popAt(p.body, '반송! 틀린 택배', 'bad'); shake.add(0.25); }
      }
    }
  }
  removeParcelMesh(k) { this.root.remove(k.g); this.root.remove(k.lab); this.root.remove(k.shadow); }
  // 내 기기 몸: 상자 줍기·떨어뜨리기·던지기·배달
  testOwn(p) {
    if (!this.loop.asking || !p.qa) return;
    const s = this.s, b = p.body;
    if ((p.reqT || 0) > s.t) return;
    if (p.carry != null) {
      const k = this.byId(p.carry); if (!k) { p.carry = null; b.speedMul = 1; return; }
      if (b.state === 'knock' || b.state === 'stun' || b.state === 'fallen') {
        // 부딪혀서 놓침 → 옆으로 툭
        p.reqT = s.t + 0.3;
        this.req('drop', { id: k.id, pp: p.pid, x: b.x, z: b.z, vx: b.vx * 0.5 + rand(-2, 2), vz: b.vz * 0.5 + rand(-2, 2) });
      } else if (b.state === 'dive') {
        // 들고 다이브 → 앞으로 던지기
        p.reqT = s.t + 0.3;
        const fx2 = Math.sin(b.yaw), fz2 = Math.cos(b.yaw);
        this.req('drop', { id: k.id, pp: p.pid, x: b.x + fx2 * 0.8, z: b.z + fz2 * 0.8, vx: fx2 * 9, vz: fz2 * 9 });
      } else if (Math.hypot(b.x, b.z) < MAIL_R + 0.2) {
        p.reqT = s.t + 0.4;
        this.req('deliver', { id: k.id, pp: p.pid });
      }
      return;
    }
    if (b.state !== 'normal' && b.state !== 'slide') return;
    for (const k of this.parcels) {
      if (k.state !== 'free' || (k.cool[p.pid] || 0) > s.t || k.y > 1.6) continue;
      if (Math.hypot(k.x - b.x, k.z - b.z) < 0.95 + P.r * 0.5) { p.reqT = s.t + 0.35; this.req('pick', { id: k.id, pp: p.pid }); break; }
    }
  }
  onNet(m) {
    if (this.loop.onNet(m)) return;
    if (m.qi !== this.loop.qi) return;
    if (m.k === 'rq') { if (this.s.isHost) this.hostReq(m.kind, m); return; }
    if (m.k === 'pk' || m.k === 'pd' || m.k === 'dl') this.apply(m.k, m);
  }
  allDone() { return this.okLeft <= 0; }
  onClose(q) {
    for (const k of this.parcels) if (k.state !== 'gone') { if (k.i === q.a) fx.sparkle({ x: k.x, y: k.y + 0.5, z: k.z }, 6); else k.fade = true; }
    for (const p of this.s.players) { p.carry = null; if (!p.remote) p.body.speedMul = 1; }
    for (const k of this.parcels) if (k.state === 'held') { k.state = 'free'; k.holder = null; k.vy = 2; }
  }
  onShowEnd() { this.clearParcels(); }
  onDone() { this.endAt = this.s.t + 0.8; }
  update(dt, phase) {
    const s = this.s, t = s.t;
    this.coins.update(dt, t);
    if (phase === 'play' && !this.over) this.loop.update(dt);
    for (const k of this.parcels) {
      if (k.state === 'gone') continue;
      if (k.state === 'held') {
        const p = s.players.find(x => x.pid === k.holder), r = p?.view?.root;
        if (r) {
          k.x = r.position.x; k.z = r.position.z; k.y = r.position.y + 1.62;
          k.g.position.set(k.x, k.y + Math.abs(Math.sin(t * 9 + k.wob)) * 0.06, k.z);
          k.g.rotation.set(Math.sin(t * 7 + k.wob) * 0.12, r.rotation.y, Math.sin(t * 6 + k.wob) * 0.14);   // 머리 위에서 흔들흔들
        }
      } else {
        // 떨어지기·미끄러지기 (모든 기기가 똑같이 계산)
        k.vy -= 26 * dt; k.y += k.vy * dt;
        if (k.y <= 0.38) {
          if (k.state === 'drop' && k.vy < -6) { fx.dust({ x: k.x, y: 0.2, z: k.z }, 4); if (s.me && Math.hypot(s.me.body.x - k.x, s.me.body.z - k.z) < 9) audio.play('land', { vol: 0.3, gap: 0.08 }); }
          k.y = 0.38; k.vy = Math.abs(k.vy) > 3 ? -k.vy * 0.3 : 0;
          if (k.state === 'drop') k.state = 'free';
          const sp = Math.hypot(k.vx, k.vz); if (sp > 0) { const d = Math.min(sp, 9 * dt); k.vx -= k.vx / sp * d; k.vz -= k.vz / sp * d; }
        }
        k.x += k.vx * dt; k.z += k.vz * dt;
        if (Math.abs(k.x) > AX - 0.8) { k.x = Math.sign(k.x) * (AX - 0.8); k.vx *= -0.5; }
        if (Math.abs(k.z) > AZ - 0.8) { k.z = Math.sign(k.z) * (AZ - 0.8); k.vz *= -0.5; }
        const dm = Math.hypot(k.x, k.z); if (dm < 1.7 && dm > 1e-3) { k.x *= 1.7 / dm; k.z *= 1.7 / dm; }
        k.g.position.set(k.x, k.y, k.z);
        k.g.rotation.y += (k.vx * k.vx + k.vz * k.vz > 1 ? 3 : 0.3) * dt;
        k.g.rotation.x = k.g.rotation.z = 0;
      }
      let sc = 1; if (k.fade) sc = Math.max(0.01, 1 - (k.fadeK = (k.fadeK || 0) + dt * 2.5));
      k.g.scale.setScalar(sc);
      k.lab.position.set(k.x, k.y + 1.0, k.z); k.lab.visible = sc > 0.3;
      k.shadow.position.set(k.x, 0.045, k.z); k.shadow.visible = k.state !== 'held' && sc > 0.2;
      const hgt = Math.max(0, k.y - 0.38); k.shadow.scale.setScalar(Math.max(0.4, 1 - hgt * 0.08));
    }
    this.mailPop = Math.max(0, (this.mailPop || 0) - dt * 3);
    this.mail.scale.set(1 + this.mailPop * 0.12, 1 - this.mailPop * 0.12, 1 + this.mailPop * 0.12);
    this.mailRing.material.opacity = 0.4 + Math.sin(t * 4) * 0.15 + (s.me?.carry != null ? 0.3 : 0);
    if (s.me) hud.place(this.loop.asking ? (s.me.carry != null ? '📦 우체통으로!' : `📦 남은 정답 택배 ${Math.max(0, this.okLeft ?? COPIES)}`) : '');
    if (this.endAt && t >= this.endAt) { this.endAt = 0; this.end(); }
  }
  end() { if (this.over) return; this.over = true; this.s.endRound('끝!'); }
  visual(dt, t) { this.bd.update(dt); bobIslands(this.root, t); }
  camera(b) {
    return { pos: new THREE.Vector3(b.x * 0.5, 12.5 + b.y * 0.4, 13.5 + b.z * 0.45), look: new THREE.Vector3(b.x * 0.65, b.y * 0.4 + 0.8, b.z * 0.6 - 2.2) };
  }
  introCam(k) {
    const e = k * k * (3 - 2 * k), a = 0.4 + e * 2.3;
    return { pos: new THREE.Vector3(Math.cos(a) * 25, 17 - e * 4, Math.sin(a) * 21), look: new THREE.Vector3(0, 1, 0) };
  }
  // 봇: 고른 상자를 주워 우체통으로. 그 상자를 남이 들고 있으면 쫓아가 다이브
  botCtrl(p, dt) {
    const s = this.s, b = p.body, m = p.bot, lv = s.level;
    m.t += dt;
    if (b.state !== 'normal') return null;
    let tx = Math.cos(m.t * 0.35 + (m.noise ?? 0)) * 6, tz = Math.sin(m.t * 0.35 + (m.noise ?? 0)) * 5, dive = false;
    if (p.carry != null) { tx = 0; tz = 0; }
    else if (this.loop.botReady(p) && this.okLeft > 0) {
      const free = this.parcels.filter(k => k.state === 'free' && k.i === m.pick && !(k.cool[p.pid] > s.t));
      const k = free.sort((A, B) => Math.hypot(A.x - b.x, A.z - b.z) - Math.hypot(B.x - b.x, B.z - b.z))[0];
      if (k) { tx = k.x; tz = k.z; }
      else {
        const held = this.parcels.find(k2 => k2.state === 'held' && k2.i === m.pick && k2.holder !== p.pid);
        const h = held && s.players.find(x => x.pid === held.holder);
        if (h) {
          const hb = h.remote && h.net ? h.net : h.body;
          tx = hb.x; tz = hb.z;
          m.diveCd = (m.diveCd || 0) - dt;
          if (Math.hypot(hb.x - b.x, hb.z - b.z) < 2.6 && m.diveCd <= 0 && Math.random() < lv.acc * 0.08) { dive = true; m.diveCd = 3; }
        }
      }
    }
    const c = steer(p, tx, tz, lv, 0.06);
    return { mx: c.mx, mz: c.mz, jump: false, jumpHeld: false, dive };
  }
  dispose() { this.clearParcels(); this.s.scene.remove(this.root); }
}
