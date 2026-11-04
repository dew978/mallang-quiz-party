// 라운드 공용: 동전, 장애물(회전 막대·흔들 추·통통 기둥·움직이는 발판), 출발 배치
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mat, low } from '../engine/core.js';
import { knock } from '../engine/physics.js';
import { fx, shake } from '../engine/fx.js';
import { audio } from '../audio.js';
import { PAL, stripeTex, platform } from './stage.js';

// ---- 동전 (나만 줍는다) ----
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18).rotateZ(Math.PI / 2);
export class Coins {
  constructor(session, parent) { this.s = session; this.list = []; this.parent = parent; this.m = mat('#ffd23f', { rough: 0.25, metal: 0.55, emissive: 0.15 }); }
  add(x, y, z) { const c = new THREE.Mesh(coinGeo, this.m); c.position.set(x, y + 0.9, z); c.castShadow = false; c.userData.camKeep = true; this.parent.add(c); this.list.push(c); return c; }
  line(x1, z1, x2, z2, n, y = 0) { for (let i = 0; i < n; i++) { const k = n === 1 ? 0.5 : i / (n - 1); this.add(x1 + (x2 - x1) * k, y, z1 + (z2 - z1) * k); } }
  update(dt, t) {
    const me = this.s.me; if (!me) return;
    const b = me.body;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.rotation.y = t * 3 + i;
      if (b.state === 'fallen') continue;
      const dx = c.position.x - b.x, dy = c.position.y - (b.y + 0.6), dz = c.position.z - b.z;
      if (dx * dx + dy * dy + dz * dz < 1.1) {
        this.parent.remove(c); this.list.splice(i, 1);
        me.coins++; audio.play('coin', { vol: 0.7, rate: 1 + Math.min(0.5, (this.combo = (this.lastT && t - this.lastT < 0.7 ? (this.combo || 0) + 1 : 0)) * 0.06) }); this.lastT = t;
        fx.sparkle(c.position, 6, ['#ffe680', '#ffffff']);
        this.s.hudCoins?.(me.coins);
      }
    }
  }
}

// ---- 회전 막대 ----
export function sweeper(session, parent, { x = 0, y = 0, z, len = 8, speed = 1.6, height = 0.55, phase = 0, color = PAL.hotpink, both = true, hub: withHub = true }) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  if (withHub) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.4, 20), mat(PAL.butter, { rough: 0.3 })); hub.position.y = 0.7; hub.castShadow = !low(); g.add(hub);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(PAL.hotpink, { rough: 0.3 })); cap.position.y = 1.4; g.add(cap);
    session.world.add({ kind: 'cyl', x, y: y + 0.7, z, r: 0.75, hy: 0.7, noSafe: true });
  }
  const arm = new THREE.Group(); arm.position.y = height; g.add(arm);
  arm.userData.camKeep = true;   // 피해야 하는 막대는 카메라를 가려도 늘 보이게 (기둥만 숨겨짐)
  const L = both ? len * 2 : len;
  const barM = mat('#ffffff', { map: (() => { const t = stripeTex(color, '#ffffff', 10).clone(); t.needsUpdate = true; t.repeat.set(L / 2, 1); return t; })(), rough: 0.35 });
  const bar = new THREE.Mesh(new RoundedBoxGeometry(L, 0.5, 0.5, 2, 0.22), barM); bar.position.x = both ? 0 : len / 2; bar.castShadow = !low(); arm.add(bar);
  for (const sx of both ? [-1, 1] : [1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), mat(PAL.butter, { rough: 0.3 })); k.position.x = sx * len; arm.add(k); }
  const h = {
    a: phase, group: g, speed,
    update(dt) { if (this.off) { g.visible = false; return; } g.visible = true; this.a += this.speed * dt; arm.rotation.y = -this.a; },
    test(p) {
      if (this.off) return;
      const speed = this.speed;
      const b = p.body;
      const by = y + height;
      if (b.y > by + 0.32 || b.y + 1.15 < by - 0.3) return;
      // 막대 방향: three.js rotation.y = -a → 월드 방향 (cos a, sin a)
      const ux = Math.cos(this.a), uz = Math.sin(this.a);
      const dx = b.x - x, dz = b.z - z;
      let s = dx * ux + dz * uz; s = Math.max(both ? -len : 0, Math.min(len, s));
      const cx = ux * s, cz = uz * s, ex = dx - cx, ez = dz - cz, d = Math.hypot(ex, ez);
      if (d > 0.46 + 0.28 || Math.abs(s) < 0.8) return;
      // 막대가 쓸고 가는 방향 = 접선 방향 (회전 방향 × 반지름)
      const tx = -uz * Math.sign(s) * Math.sign(speed), tz = ux * Math.sign(s) * Math.sign(speed);
      const pw = 5 + Math.abs(speed * s) * 0.45;
      if (knock(b, tx * pw, 3.6, tz * pw, 0.6)) hitFx(session, p, b);
    },
  };
  session.world.addHazard(h);
  return h;
}

// ---- 흔들리는 사탕 추 ----
export function pendulum(session, parent, { z, y = 0, x = 0, width = 16, len = 6.2, amp = 1.05, speed = 1.7, phase = 0, color = PAL.grape }) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const top = len + 1.3;
  const frameM = mat(PAL.white, { rough: 0.35 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, top + 0.3, 12), frameM); p.position.set(sx * (width / 2 + 0.6), (top + 0.3) / 2, 0); p.castShadow = !low(); g.add(p); }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(width + 1.8, 0.5, 0.5, 2, 0.2), mat(color, { rough: 0.3 })); beam.position.y = top + 0.3; g.add(beam);
  session.world.add({ kind: 'cyl', x: x - width / 2 - 0.6, y: y + top / 2, z, r: 0.34, hy: top / 2, noSafe: true });
  session.world.add({ kind: 'cyl', x: x + width / 2 + 0.6, y: y + top / 2, z, r: 0.34, hy: top / 2, noSafe: true });
  const piv = new THREE.Group(); piv.position.y = top; g.add(piv);
  piv.userData.camKeep = true;   // 흔들리는 공은 늘 보이게 (틀만 숨겨짐)
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 6), mat('#ffffff')); rope.position.y = -len / 2; piv.add(rope);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.0, 22, 16), mat('#ffffff', { map: (() => { const t = stripeTex(color, '#ffffff', 8).clone(); t.needsUpdate = true; t.repeat.set(2, 1); return t; })(), rough: 0.3 }));
  ball.position.y = -len; ball.castShadow = !low(); piv.add(ball);
  const h = {
    t: phase, prevX: 0, hx: 0, hy: 0,
    update(dt) {
      this.t += dt;
      const th = amp * Math.sin(this.t * speed);
      piv.rotation.z = th;
      const nx = x + Math.sin(th) * len, ny = y + top - Math.cos(th) * len;
      this.vx = (nx - this.hx) / Math.max(dt, 1e-3); this.hx = nx; this.hy = ny;
    },
    test(p) {
      const b = p.body;
      const dx = b.x - this.hx, dy = (b.y + 0.6) - this.hy, dz = b.z - z;
      if (dx * dx + dy * dy + dz * dz > 1.55 * 1.55) return;
      const dir = Math.sign(this.vx || dx) || 1;
      if (knock(b, dir * 7.5, 3.8, (Math.sign(dz) || 1) * 1.5, 0.65)) hitFx(session, p, b);
    },
  };
  session.world.addHazard(h);
  return h;
}

// ---- 통통 기둥 (부딪히면 튕겨 나감) ----
export function bumper(session, parent, { x, y = 0, z, r = 0.7, color = PAL.hotpink }) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, 1.2, 18), mat(PAL.cream, { rough: 0.5 })); stem.position.y = 0.6; stem.castShadow = !low(); g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { rough: 0.3 })); cap.position.y = 1.15; cap.scale.y = 0.75; cap.castShadow = !low(); g.add(cap);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; const d = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 10, 8), mat('#ffffff')); d.position.set(Math.cos(a) * r * 0.85, 1.15 + r * 0.55, Math.sin(a) * r * 0.85); d.scale.y = 0.5; g.add(d); }
  const col = session.world.add({ kind: 'cyl', x, y: y + 0.8, z, r: r * 1.2, hy: 0.8, bounce: 10, noSafe: true });
  col.onPush = (b, nx, nz, vn) => { if (vn > 1.5) { cap.scale.set(1.2, 0.6, 1.2); setTimeout(() => cap.scale.set(1, 0.75, 1), 120); if (b === session.me?.body) audio.play('bounce', { vol: 0.8 }); } };
  return g;
}

// ---- 움직이는 발판 (좌우로) ----
export function mover(session, parent, { x, y = 0, z, w = 4.4, d = 4.4, ax = 3, az = 0, speed = 1, phase = 0, color = PAL.sky }) {
  const p = platform(session.world, parent, { x, y, z, w, d, h: 0.8, color, extra: { moving: true } });
  const h = {
    t: phase,
    update(dt) {
      this.t += dt;
      const nx = x + Math.sin(this.t * speed) * ax, nz = z + Math.sin(this.t * speed) * az;
      session.world.move(p.col, nx, p.col.y, nz);
      p.mesh.position.x = nx; p.mesh.position.z = nz;
    },
    col: p.col,
  };
  session.world.addHazard(h);
  return h;
}

export function hitFx(session, p, b) {
  const me = p === session.me;
  fx.stars({ x: b.x, y: b.y + 1, z: b.z }, me ? 10 : 5);
  if (me) { audio.play('hit'); shake.add(0.45); }
  else if (session.hearing(p) > 0.1) audio.play('hit', { vol: session.hearing(p) });
}

// 출발 자리: 줄 맞춰 (앞쪽 -Z)
export function gridSpawns(n, z0, width = 14, cols = 6, gap = 2.2) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
    const x = (col - (inRow - 1) / 2) * (width / cols);
    out.push({ x, y: 0, z: z0 + row * gap, yaw: Math.PI });
  }
  return out;
}
