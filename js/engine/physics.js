// 가벼운 캐릭터 물리: 상자·원기둥·부채꼴 발판 위를 달리고 뛰고 몸을 날린다.
// 물리 엔진 없이 직접 계산해서 저사양 태블릿에서도 12명이 가볍게 돈다.

export const P = {
  speed: 7.3, accelG: 58, accelA: 24, frictionG: 42,
  jumpV: 10.4, grav: 27, fallMul: 1.38, shortHop: 2.1, maxFall: 30,
  coyote: 0.12, buffer: 0.15,
  diveSpeed: 11.5, diveUp: 4.6, slideTime: 0.42, getupTime: 0.2,
  r: 0.46, h: 1.2,
};

// ---- 충돌체 ----
// box: { kind:'box', x,y,z (가운데), hx,hy,hz, yaw }  cyl: { kind:'cyl', x,y,z, r, hy }  sector: { kind:'sector', x,y,z, r0,r1, a0,a1, rot, hy }
// 공통 선택 속성: pass(body)=>true면 통과, onPush(body,nx,nz), bounce(튕김 세기), slippery, enabled(false면 없음)
export class World {
  constructor() { this.solids = []; this.hazards = []; this.killY = -6; }
  add(s) {
    s.enabled ??= true;
    if (s.kind === 'box') { s.yaw ??= 0; s.c = Math.cos(s.yaw); s.s = Math.sin(s.yaw); }
    s.dx = 0; s.dy = 0; s.dz = 0; s.dyaw = 0;
    this.solids.push(s); return s;
  }
  addHazard(h) { this.hazards.push(h); return h; }
  // 움직이는 발판: 새 위치를 넣으면 이번 프레임 이동량을 기억해서 위에 선 캐릭터를 함께 옮긴다
  move(s, x, y, z, yaw) {
    s.dx = x - s.x; s.dy = y - s.y; s.dz = z - s.z; s.x = x; s.y = y; s.z = z;
    if (yaw !== undefined) { s.dyaw = yaw - (s.kind === 'sector' ? s.rot : s.yaw); if (s.kind === 'sector') s.rot = yaw; else { s.yaw = yaw; s.c = Math.cos(yaw); s.s = Math.sin(yaw); } }
    else s.dyaw = 0;
  }
}

function top(s) { return s.y + s.hy; }
function bottom(s) { return s.y - s.hy; }
// (x,z)가 윗면 안에 있나 (tol만큼 가장자리 여유)
function inside(s, x, z, tol) {
  if (s.kind === 'box') {
    const dx = x - s.x, dz = z - s.z;
    const lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
    return Math.abs(lx) <= s.hx + tol && Math.abs(lz) <= s.hz + tol;
  }
  const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
  if (s.kind === 'cyl') return d <= s.r + tol;
  if (s.kind === 'sector') {
    if (d < s.r0 - tol || d > s.r1 + tol) return false;
    let a = Math.atan2(dz, dx) + s.rot;
    a = ((a - s.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return a <= (s.a1 - s.a0) + tol / Math.max(1, d);
  }
  return false;
}
// 옆면 밀어내기: 밀린 방향(nx,nz)과 깊이
function pushOut(s, x, z, r) {
  if (s.kind === 'box') {
    const dx = x - s.x, dz = z - s.z;
    const lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
    const cx = Math.max(-s.hx, Math.min(s.hx, lx)), cz = Math.max(-s.hz, Math.min(s.hz, lz));
    let ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
    let nlx, nlz, depth;
    if (d > 1e-6) { if (d >= r) return null; nlx = ox / d; nlz = oz / d; depth = r - d; }
    else {
      // 가운데가 상자 안: 가장 얕은 쪽으로
      const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz);
      if (px < pz) { nlx = Math.sign(lx) || 1; nlz = 0; depth = px + r; } else { nlx = 0; nlz = Math.sign(lz) || 1; depth = pz + r; }
    }
    // 로컬 → 월드
    return { nx: nlx * s.c + nlz * s.s, nz: -nlx * s.s + nlz * s.c, depth };
  }
  if (s.kind === 'cyl') {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d >= s.r + r) return null;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
    return { nx, nz, depth: s.r + r - d };
  }
  if (s.kind === 'sector') {
    // 바깥 테두리만 벽 (발판 사이 경계는 벽이 아님)
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d >= s.r1 + r || d < s.r1 - 0.6) return null;
    if (!inside(s, x, z, 0) && !inside(s, s.x + dx / d * (s.r1 - 0.2), s.z + dz / d * (s.r1 - 0.2), 0)) return null;
    return { nx: dx / d, nz: dz / d, depth: s.r1 + r - d };
  }
  return null;
}

// ---- 캐릭터 몸 ----
export function makeBody(x = 0, y = 0, z = 0) {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.PI, // yaw π = -Z(앞) 쪽을 본다
    grounded: false, ground: null, groundY: -99, coyote: 0, buffer: 0, airTime: 0,
    state: 'normal', stateT: 0, dived: false, speedMul: 1, boostT: 0,
    landImpact: 0, justJumped: false, justLanded: false, bumped: 0, stepPhase: 0, moveAmt: 0,
    lastSafe: { x, y, z }, hitCool: 0,
  };
}
export function setState(b, st, t = 0) { b.state = st; b.stateT = t; }
export function knock(b, ix, iy, iz, t = 0.7) {
  if (b.state === 'fallen' || b.hitCool > 0) return false;
  b.vx = ix; b.vy = Math.max(b.vy, iy); b.vz = iz;
  b.grounded = false; b.ground = null;
  setState(b, 'knock', t); b.hitCool = 0.35;
  return true;
}

const ctrl0 = { mx: 0, mz: 0, jump: false, jumpHeld: false, dive: false };

// 한 걸음 (dt는 고정 1/60)
export function stepBody(b, c = ctrl0, dt, world) {
  b.justJumped = false; b.justLanded = false; b.landImpact = 0;
  if (b.hitCool > 0) b.hitCool -= dt;
  if (b.boostT > 0) b.boostT -= dt;
  if (b.stateT > 0) b.stateT -= dt;
  if (b.state === 'fallen') return;

  // 서 있던 발판이 움직이면 같이 간다
  if (b.grounded && b.ground && b.ground.enabled) {
    const g = b.ground;
    b.x += g.dx; b.y += g.dy; b.z += g.dz;
    if (g.dyaw) {
      const dx = b.x - g.x, dz = b.z - g.z, co = Math.cos(-g.dyaw), si = Math.sin(-g.dyaw);
      b.x = g.x + dx * co - dz * si; b.z = g.z + dx * si + dz * co; b.yaw += g.dyaw;
    }
  }

  const st = b.state;
  const canMove = st === 'normal';
  const speed = P.speed * b.speedMul * (b.boostT > 0 ? 1.35 : 1);
  let mx = canMove ? c.mx : 0, mz = canMove ? c.mz : 0;
  const ml = Math.hypot(mx, mz);
  b.moveAmt = ml;

  // 가로 속도
  if (st === 'normal' || st === 'launch') {
    const acc = b.grounded ? P.accelG : (st === 'launch' ? P.accelA * 0.35 : P.accelA);
    if (ml > 0.05) {
      const tx = mx * speed, tz = mz * speed;
      const k = Math.min(1, acc * dt / Math.max(0.001, Math.hypot(tx - b.vx, tz - b.vz)));
      if (st === 'launch') { b.vx += (tx - b.vx) * k * 0.25; b.vz += (tz - b.vz) * k * 0.25; }
      else { b.vx += (tx - b.vx) * k; b.vz += (tz - b.vz) * k; }
      // 바라보는 방향
      const want = Math.atan2(mx, mz);
      let d = want - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      b.yaw += d * Math.min(1, 15 * dt);
    } else if (b.grounded) {
      const sp = Math.hypot(b.vx, b.vz), dec = P.frictionG * dt;
      if (sp <= dec) { b.vx = 0; b.vz = 0; } else { b.vx -= b.vx / sp * dec; b.vz -= b.vz / sp * dec; }
    }
    // 너무 빠르면(튕긴 뒤) 천천히 줄인다
    const sp = Math.hypot(b.vx, b.vz), cap = speed * (b.grounded ? 1 : 1.15);
    if (sp > cap && st === 'normal') { const k = Math.max(cap / sp, 1 - 6 * dt); b.vx *= k; b.vz *= k; }
  } else if (b.grounded) {
    // 미끄러지기·넘어짐: 마찰
    const f = st === 'slide' ? 9 : 14;
    const k = Math.max(0, 1 - f * dt); b.vx *= k; b.vz *= k;
  } else if (st === 'dive') {
    // 다이브 중 약간 방향 틀기
    if (c.mx || c.mz) { b.vx += c.mx * 6 * dt; b.vz += c.mz * 6 * dt; }
  }

  // 점프 (코요테 타임 + 미리 누르기)
  if (c.jump) b.buffer = P.buffer; else if (b.buffer > 0) b.buffer -= dt;
  if (b.grounded) b.coyote = P.coyote; else if (b.coyote > 0) b.coyote -= dt;
  if (canMove && b.buffer > 0 && b.coyote > 0) {
    b.vy = P.jumpV; b.grounded = false; b.ground = null; b.coyote = 0; b.buffer = 0; b.justJumped = true;
  }
  // 다이브: 공중에서 한 번, 땅에서도 가능
  if (c.dive && canMove && !b.dived) {
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const sp = Math.max(Math.hypot(b.vx, b.vz), 0);
    const ds = Math.min(P.diveSpeed * b.speedMul * (b.boostT > 0 ? 1.15 : 1), sp + 6.5);
    b.vx = fx * ds; b.vz = fz * ds;
    b.vy = b.grounded ? P.diveUp : Math.max(b.vy, P.diveUp * 0.7);
    b.grounded = false; b.ground = null; b.dived = true;
    setState(b, 'dive'); b.justDived = true;
  }

  // 중력
  let g = P.grav;
  if (b.vy < 0) g *= P.fallMul;
  else if (st === 'normal' && !c.jumpHeld && b.vy > 0 && !b.fromPad) g *= P.shortHop;
  if (!b.grounded) b.vy = Math.max(-P.maxFall, b.vy - g * dt);
  if (b.vy <= 0) b.fromPad = false;

  // 이동
  const prevY = b.y;
  b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
  if (!b.grounded) b.airTime += dt; else b.airTime = 0;

  // 옆면 충돌
  b.bumped = 0;
  for (const s of world.solids) {
    if (!s.enabled || (s.pass && s.pass(b))) continue;
    // 바로 전에 윗면보다 위에 있었으면 옆면이 아니라 착지할 바닥이다
    if (b.y >= top(s) - 0.08 || prevY >= top(s) - 0.02 || b.y + P.h <= bottom(s)) continue;
    const o = pushOut(s, b.x, b.z, P.r);
    if (!o) continue;
    // 아주 낮은 턱은 올라선다 (계단)
    if (b.grounded && top(s) - b.y < 0.42 && top(s) - b.y > 0 && inside(s, b.x + o.nx * -0.2, b.z + o.nz * -0.2, P.r)) { b.y = top(s); continue; }
    b.x += o.nx * o.depth; b.z += o.nz * o.depth;
    const vn = b.vx * o.nx + b.vz * o.nz;
    if (s.bounce) {
      const out = Math.max(s.bounce, -vn * 1.1);
      b.vx += o.nx * (out - vn); b.vz += o.nz * (out - vn); b.vy = Math.max(b.vy, 3.5);
      b.grounded = false; b.ground = null;
      if (b.state === 'normal') setState(b, 'knock', 0.35);
      b.bumped = Math.max(b.bumped, out);
    } else if (vn < 0) { b.vx -= vn * o.nx; b.vz -= vn * o.nz; b.bumped = Math.max(b.bumped, -vn); }
    s.onPush?.(b, o.nx, o.nz, -vn);
  }

  // 천장
  if (b.vy > 0) {
    for (const s of world.solids) {
      if (!s.enabled || (s.pass && s.pass(b))) continue;
      const bt = bottom(s);
      if (prevY + P.h <= bt + 0.02 && b.y + P.h > bt && inside(s, b.x, b.z, -P.r * 0.4)) { b.y = bt - P.h; b.vy = 0; }
    }
  }

  // 바닥
  let best = null, bestTop = -1e9;
  const tolFoot = P.r * 0.55;
  for (const s of world.solids) {
    if (!s.enabled || (s.pass && s.pass(b))) continue;
    const t = top(s);
    if (t > bestTop && inside(s, b.x, b.z, tolFoot)) {
      // 위에서 내려왔거나 이미 서 있던 높이 근처만 바닥으로 인정
      const snap = b.grounded ? 0.35 : 0.02;
      if (b.y <= t + snap && prevY >= t - 0.45 - Math.max(0, -b.vy * dt)) { best = s; bestTop = t; }
    }
  }
  const wasGrounded = b.grounded;
  if (best && b.vy <= 0.01) {
    if (!wasGrounded) { b.landImpact = -b.vy; b.justLanded = true; }
    b.y = bestTop; b.vy = 0; b.grounded = true; b.ground = best; b.groundY = bestTop; b.dived = false;
    if (best.slippery) { /* 미끄러운 바닥은 마찰이 적다: 아래 마찰 보정에서 */ }
    if (best.bouncePad && b.state !== 'fallen') best.bouncePad(b);
    if (b.state === 'dive') setState(b, 'slide', P.slideTime);
    else if (b.state === 'launch') setState(b, 'normal');
    if (!best.moving && !best.noSafe && b.state === 'normal') { b.lastSafe.x = b.x; b.lastSafe.y = b.y; b.lastSafe.z = b.z; }
  } else {
    b.grounded = false; b.ground = null;
    // 그림자용 아래 바닥 높이
    let gy = -99;
    for (const s of world.solids) { if (s.enabled && !(s.pass && s.pass(b)) && top(s) <= b.y + 0.05 && top(s) > gy && inside(s, b.x, b.z, 0)) gy = top(s); }
    b.groundY = gy;
  }

  // 상태 넘기기
  if (b.state === 'slide' && b.stateT <= 0) setState(b, 'getup', P.getupTime);
  else if (b.state === 'getup' && b.stateT <= 0) setState(b, 'normal');
  else if (b.state === 'knock' && b.stateT <= 0 && b.grounded) setState(b, 'normal');
  else if (b.state === 'stun' && b.stateT <= 0) setState(b, 'normal');

  // 걸음 박자
  const hs = Math.hypot(b.vx, b.vz);
  if (b.grounded) b.stepPhase += hs * dt * 1.45;
}

// 캐릭터끼리 부딪힘: 밀리고 튕긴다 (달라붙지 않게)
export function collideBodies(list) {
  const R2 = P.r * 2;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.state === 'fallen' || a.ghost) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.state === 'fallen' || b.ghost) continue;
      const dy = a.y - b.y;
      if (Math.abs(dy) > P.h * 0.92) continue;
      const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
      if (d >= R2 || d < 1e-5) continue;
      // 머리 밟기: 위에서 떨어지면 통통
      if (dy > P.h * 0.6 && a.vy < 0) { a.vy = 9; a.grounded = false; b.squish = 1; a.stomped = 1; continue; }
      if (-dy > P.h * 0.6 && b.vy < 0) { b.vy = 9; b.grounded = false; a.squish = 1; b.stomped = 1; continue; }
      const nx = dx / d, nz = dz / d, pen = R2 - d;
      a.x += nx * pen * 0.5; a.z += nz * pen * 0.5; b.x -= nx * pen * 0.5; b.z -= nz * pen * 0.5;
      const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rv < 0) {
        // 다이브로 부딪히면 세게 민다
        const hard = (a.state === 'dive' || b.state === 'dive') ? 1.6 : 1;
        const imp = -rv * 0.55 * hard + 1.6;
        a.vx += nx * imp; a.vz += nz * imp; b.vx -= nx * imp; b.vz -= nz * imp;
        if (-rv > 5) { a.bumpFx = b.bumpFx = Math.min(1, -rv / 10); }
        if (hard > 1) {
          const victim = a.state === 'dive' ? b : a;
          if (victim.state === 'normal') { victim.vy = Math.max(victim.vy, 3); setState(victim, 'knock', 0.45); victim.grounded = false; }
        }
      }
    }
  }
}
