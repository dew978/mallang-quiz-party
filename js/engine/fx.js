// 효과: 색종이·먼지·물보라·별·하트 파티클 (스프라이트 풀), 화면 흔들림
import * as THREE from 'three';
import { low } from './core.js';

const texs = {};
function tex(kind) {
  if (texs[kind]) return texs[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff';
  if (kind === 'dot') { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  else if (kind === 'puff') { for (const [px, py, r] of [[32, 34, 20], [20, 38, 13], [44, 38, 13], [32, 24, 14]]) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } }
  else if (kind === 'square') { x.fillRect(14, 22, 36, 20); }
  else if (kind === 'star') { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 30, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); }
  else if (kind === 'heart') { x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 10, 8, 32, 22); x.bezierCurveTo(54, 8, 60, 34, 32, 54); x.fill(); }
  else if (kind === 'note') { x.beginPath(); x.ellipse(24, 46, 11, 8, -0.4, 0, 7); x.fill(); x.fillRect(31, 12, 6, 34); x.fillRect(31, 12, 18, 6); }
  else if (kind === 'drop') { x.beginPath(); x.moveTo(32, 6); x.quadraticCurveTo(54, 36, 32, 58); x.quadraticCurveTo(10, 36, 32, 6); x.fill(); }
  const t = new THREE.CanvasTexture(c); texs[kind] = t; return t;
}

let scene = null;
const pool = [], live = [];
const MAX = 260;
export function initFx(s) {
  scene = s;
  for (const p of live) { p.sprite.visible = false; pool.push(p); }
  live.length = 0;
}
function get() {
  let p = pool.pop();
  if (!p) {
    if (live.length >= (low() ? 140 : MAX)) { p = live.shift(); }
    else { const m = new THREE.SpriteMaterial({ transparent: true, depthWrite: false }); p = { sprite: new THREE.Sprite(m) }; }
  }
  if (p.sprite.parent !== scene) scene.add(p.sprite);
  return p;
}
const C = new THREE.Color();
// 여러 개를 한꺼번에 뿌린다
export function burst(pos, o = {}) {
  if (!scene) return;
  const n = Math.round((o.count ?? 14) * (low() ? 0.6 : 1));
  const colors = o.colors || ['#ffffff'];
  for (let i = 0; i < n; i++) {
    const p = get(); const s = p.sprite;
    s.material.map = tex(o.kind || 'dot'); s.material.needsUpdate = true;
    s.material.color.set(colors[i % colors.length]);
    s.material.opacity = 1; s.material.rotation = Math.random() * 6.28;
    s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    const a = Math.random() * Math.PI * 2, up = o.up ?? 4, sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.8);
    const spread = o.spread ?? 1;
    p.vx = Math.cos(a) * sp * spread; p.vz = Math.sin(a) * sp * spread; p.vy = up * (0.5 + Math.random() * 0.8);
    if (o.dir) { p.vx += o.dir.x; p.vy += o.dir.y; p.vz += o.dir.z; }
    s.position.set(pos.x + (Math.random() - 0.5) * (o.jitter ?? 0.3), pos.y + (Math.random() - 0.5) * (o.jitter ?? 0.3), pos.z + (Math.random() - 0.5) * (o.jitter ?? 0.3));
    p.size = (o.size ?? 0.3) * (0.6 + Math.random() * 0.8); s.scale.setScalar(p.size);
    p.life = p.max = (o.life ?? 0.9) * (0.7 + Math.random() * 0.6);
    p.g = o.gravity ?? 9; p.drag = o.drag ?? 1.5; p.spin = (Math.random() - 0.5) * (o.spinAmt ?? 8);
    p.grow = o.grow ?? 0; p.flutter = !!o.flutter;
    s.visible = true; live.push(p);
  }
}
export function updateFx(dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i], s = p.sprite;
    p.life -= dt;
    if (p.life <= 0) { s.visible = false; live.splice(i, 1); pool.push(p); continue; }
    p.vy -= p.g * dt;
    const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vz *= k; if (p.flutter) p.vy *= Math.max(0, 1 - 3 * dt);
    s.position.x += p.vx * dt; s.position.y += p.vy * dt; s.position.z += p.vz * dt;
    s.material.rotation += p.spin * dt;
    const f = p.life / p.max;
    s.material.opacity = Math.min(1, f * 2.2);
    if (p.grow) s.scale.setScalar(p.size * (1 + (1 - f) * p.grow));
    if (p.flutter) s.scale.x = p.size * (0.4 + Math.abs(Math.sin(p.life * 9)) * 0.6);
  }
}

// 자주 쓰는 묶음
export const CONFETTI = ['#ff5a8a', '#ffd23f', '#3fd0ff', '#7cf07a', '#b07cff', '#ff9a3c'];
export const fx = {
  confetti(pos, n = 40, power = 1) { burst(pos, { kind: 'square', colors: CONFETTI, count: n, speed: 5 * power, up: 7 * power, gravity: 6, drag: 1.2, life: 2.2, size: 0.32, flutter: true, spinAmt: 14 }); },
  dust(pos, n = 6) { burst(pos, { kind: 'puff', colors: ['#ffffff', '#fff3fb'], count: n, speed: 2.2, up: 0.8, gravity: 0, drag: 3, life: 0.5, size: 0.42, grow: 1.4, jitter: 0.25 }); },
  splash(pos) {
    burst(pos, { kind: 'drop', colors: ['#7fd0ff', '#c9efff', '#ffffff'], count: 22, speed: 4.5, up: 9, gravity: 20, life: 0.9, size: 0.45 });
    burst(pos, { kind: 'puff', colors: ['#e3f6ff'], count: 6, speed: 2, up: 1, gravity: 0, life: 0.7, size: 0.9, grow: 2 });
  },
  stars(pos, n = 10, col = ['#ffe34d', '#fff6a8']) { burst(pos, { kind: 'star', colors: col, count: n, speed: 3.5, up: 4, gravity: 5, life: 0.9, size: 0.38, add: false }); },
  sparkle(pos, n = 8, col = ['#ffffff', '#fff2a8']) { burst(pos, { kind: 'dot', colors: col, count: n, speed: 2.5, up: 2, gravity: 0, life: 0.6, size: 0.35, add: true }); },
  poof(pos) { burst(pos, { kind: 'puff', colors: ['#ffffff', '#ffe6f7', '#e6f3ff'], count: 12, speed: 3.2, up: 1.5, gravity: 0, drag: 3, life: 0.7, size: 0.7, grow: 1.6, jitter: 0.5 }); fx.sparkle(pos, 8); },
  ink(pos) { burst(pos, { kind: 'drop', colors: ['#3b2a5a', '#5b3f8a'], count: 14, speed: 3, up: 4, gravity: 12, life: 0.7, size: 0.4 }); },
  trail(pos, kind, colors) { burst(pos, { kind, colors, count: 1, speed: 0.4, up: 1.2, gravity: -0.5, drag: 1, life: 0.9, size: 0.3, jitter: 0.25, spinAmt: 2 }); },
};

// 화면 흔들림
export const shake = { amt: 0, add(a) { this.amt = Math.min(1, this.amt + a); } };
