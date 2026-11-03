// 무대 만들기 도구: 사탕 플라스틱 발판, 난간, 결승 아치, 장식 섬, 하늘·구름·젤리 바다
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mat, low, makeSky, makeClouds, makeJellySea, makeLights } from '../engine/core.js';
import { loadGLB, fitClone } from '../engine/assets.js';
import { labelPlane } from '../engine/labels.js';

export const PAL = {
  pink: '#ff8fbf', hotpink: '#ff5f9e', mint: '#6fe0c0', butter: '#ffe07a', sky: '#7fcbff', lilac: '#b9a2ff',
  cream: '#fff3e6', white: '#ffffff', peach: '#ffb48a', grape: '#8b6cff', lime: '#a6eb6a', navy: '#3a3f7a',
};

// 줄무늬 텍스처 (발판 옆면)
const stripeCache = new Map();
export function stripeTex(a, b, n = 6, diag = true) {
  const k = a + b + n + diag;
  if (stripeCache.has(k)) return stripeCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 128, 128); x.fillStyle = b;
  const w = 128 / n;
  if (diag) { for (let i = -n; i < n * 2; i += 2) { x.beginPath(); x.moveTo(i * w, 0); x.lineTo(i * w + w, 0); x.lineTo(i * w + w - 128, 128); x.lineTo(i * w - 128, 128); x.fill(); } }
  else for (let i = 0; i < n; i += 2) x.fillRect(0, i * w, 128, w);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  stripeCache.set(k, t); return t;
}
// 윗면 무늬 (작은 물방울 무늬)
const dotCache = new Map();
export function dotTex(base, dot) {
  const k = base + dot; if (dotCache.has(k)) return dotCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128); x.fillStyle = dot;
  for (const [px, py] of [[32, 32], [96, 96], [96, 32], [32, 96]]) { x.globalAlpha = (px + py) % 128 ? 0.5 : 0.8; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  dotCache.set(k, t); return t;
}
function texMat(t, rx, ry, rough = 0.45) {
  const tt = t.clone(); tt.needsUpdate = true; tt.repeat.set(rx, ry);
  return mat('#ffffff', { map: tt, rough });
}

// 발판: 둥근 상자 + 크림 윗면 + 줄무늬 옆면 (+ 충돌체)
export function platform(world, parent, { x = 0, y = 0, z = 0, w = 4, d = 4, h = 1, yaw = 0, color = PAL.pink, color2 = PAL.white, top = PAL.cream, collide = true, stripes = true, r = 0.22, dotted = true, extra = {} } = {}) {
  const g = new THREE.Group(); g.position.set(x, y - h / 2, z); g.rotation.y = yaw;
  const side = stripes ? texMat(stripeTex(color, color2, 8), Math.max(1, Math.round((w + d) / 3)), Math.max(1, h)) : mat(color);
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, h / 2 - 0.01)), side);
  body.receiveShadow = !low(); body.castShadow = !low();
  g.add(body);
  if (top) {
    const tm = dotted ? texMat(dotTex(top, color), w / 2.2, d / 2.2, 0.6) : mat(top, { rough: 0.6 });
    const cap = new THREE.Mesh(new RoundedBoxGeometry(w - 0.06, 0.16, d - 0.06, 2, 0.07), tm);
    cap.position.y = h / 2 - 0.05; cap.receiveShadow = !low(); g.add(cap);
  }
  parent.add(g);
  let col = null;
  if (collide) col = world.add({ kind: 'box', x, y: y - h / 2 + 0.03, z, hx: w / 2, hy: h / 2 + 0.03, hz: d / 2, yaw, ...extra });
  return { mesh: g, col };
}
// 둥근 발판 (원기둥)
export function disc(world, parent, { x = 0, y = 0, z = 0, r = 4, h = 1, color = PAL.mint, color2 = PAL.white, top = PAL.cream, collide = true, seg = 36, extra = {} } = {}) {
  const g = new THREE.Group(); g.position.set(x, y - h / 2, z);
  const side = texMat(stripeTex(color, color2, 8, false), Math.round(r * 2), 1);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.94, h, low() ? 24 : seg), side);
  body.receiveShadow = !low(); body.castShadow = !low(); g.add(body);
  if (top) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.04, r - 0.04, 0.16, low() ? 24 : seg), texMat(dotTex(top, color), r / 1.1, r / 1.1, 0.6)); cap.position.y = h / 2 - 0.05; cap.receiveShadow = !low(); g.add(cap); }
  parent.add(g);
  const col = collide ? world.add({ kind: 'cyl', x, y: y - h / 2 + 0.03, z, r, hy: h / 2 + 0.03, ...extra }) : null;
  return { mesh: g, col };
}
// 난간: 낮은 둥근 막대 (떨어지지 않게)
// 충돌판은 바깥쪽으로 두껍게 해서, 여럿이 밀쳐도 난간을 뚫고 나가지 않게 한다. inside: 놀이 구역 안쪽 한 점
export function rail(world, parent, x1, z1, x2, z2, y = 0, color = PAL.white, h = 1.0, inside = null) {
  const len = Math.hypot(x2 - x1, z2 - z1), yaw = Math.atan2(x2 - x1, z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.4, h, len, 2, 0.18), mat(color, { rough: 0.35 }));
  m.position.set(cx, y + h / 2, cz); m.rotation.y = yaw; m.castShadow = !low(); parent.add(m);
  const ins = inside || { x: 0, z: cz };
  let nx = Math.cos(yaw), nz = -Math.sin(yaw);
  if (nx * (ins.x - cx) + nz * (ins.z - cz) > 0) { nx = -nx; nz = -nz; }
  const T = 0.9;
  world.add({ kind: 'box', x: cx + nx * T, y: y + h / 2 + 0.4, z: cz + nz * T, hx: 0.2 + T, hy: h / 2 + 0.4, hz: len / 2, yaw, noSafe: true });
  return m;
}
// 기둥 끝 공 장식
export function post(parent, x, y, z, color = PAL.hotpink, h = 1.4) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, h, 10), mat(PAL.white)); p.position.y = h / 2; g.add(p);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), mat(color, { rough: 0.3 })); b.position.y = h + 0.2; g.add(b);
  parent.add(g); return g;
}

// 결승 아치
export function finishArch(parent, z, width = 16, y = 0, text = '도착!') {
  const g = new THREE.Group(); g.position.set(0, y, z);
  const pm = mat(PAL.hotpink, { rough: 0.35 });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 6, 16), texMat(stripeTex(PAL.hotpink, PAL.white, 6), 2, 3));
    p.position.set(sx * (width / 2 + 0.4), 3, 0); p.castShadow = !low(); g.add(p);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), mat(PAL.butter, { rough: 0.3 })); ball.position.set(sx * (width / 2 + 0.4), 6.6, 0); g.add(ball);
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(width + 2.4, 1.6, 0.8, 2, 0.35), pm); beam.position.y = 6.4; g.add(beam);
  const lab = labelPlane(text, width * 0.7, 1.5, { fg: '#ffffff', stroke: '#c2306a', size: 150 }); lab.position.set(0, 6.4, 0.42); g.add(lab);
  const lab2 = lab.clone(); lab2.rotation.y = Math.PI; lab2.position.z = -0.42; g.add(lab2);
  // 바닥 체크무늬
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#3a3f7a'; x.fillRect(i * 8, j * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(width, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t })); fl.position.y = 0.06; g.add(fl);
  parent.add(g); return g;
}

// 하늘 배경 한 벌: 하늘·구름·젤리 바다·조명 + 멀리 떠 있는 장식 섬
export function backdrop(scene, { center = new THREE.Vector3(0, 0, -60), seaY = -7, sky, clouds = 26 } = {}) {
  const g = new THREE.Group();
  g.add(makeSky(...(sky || [])));
  const cl = makeClouds(low() ? 14 : clouds, 220, 8, 70, center); g.add(cl);
  const sea = makeJellySea(seaY); sea.position.x = center.x; sea.position.z = center.z; g.add(sea);
  const lights = makeLights(); g.add(lights);
  scene.add(g);
  scene.fog = new THREE.Fog('#e6f2ff', 90, 330);
  const updaters = [cl.userData.update, sea.userData.update];
  return { group: g, lights, update: dt => updaters.forEach(u => u(dt)) };
}

// 장식 모델 배치 (없으면 코드 모델)
export async function prop(parent, name, { x, y = 0, z, size = 3, yaw = 0, by = 'height' }) {
  const src = await loadGLB(name);
  let o;
  if (src) o = fitClone(src, size, by);
  else o = fallbackProp(name, size);
  o.position.set(x, y, z); o.rotation.y = yaw;
  parent.add(o); return o;
}
function fallbackProp(name, size) {
  const g = new THREE.Group();
  if (name === 'prop_lollipop') {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * size, 0.08 * size, size * 0.6, 8), mat(PAL.white)); s.position.y = size * 0.3; g.add(s);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.32, size * 0.32, size * 0.1, 24), texMat(stripeTex(PAL.hotpink, PAL.white, 10), 1, 1)); c.rotation.x = Math.PI / 2; c.position.y = size * 0.75; g.add(c);
  } else if (name === 'prop_cottoncandy' || name === 'prop_island') {
    const c = new THREE.Mesh(new THREE.SphereGeometry(size * 0.4, 14, 10), mat(name === 'prop_island' ? PAL.lime : PAL.pink, { rough: 0.8 })); c.position.y = size * 0.6; g.add(c);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * size, 0.12 * size, size * 0.4, 8), mat('#d9a06a')); s.position.y = size * 0.2; g.add(s);
  } else if (name === 'goal_crown') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.45, size * 0.4, size * 0.5, 8, 1, true), mat('#ffd23f', { metal: 0.6, rough: 0.25, side: THREE.DoubleSide })); c.position.y = size * 0.45; g.add(c);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(size * 0.08, size * 0.25, 6), mat('#ffd23f', { metal: 0.6, rough: 0.25 })); sp.position.set(Math.cos(a) * size * 0.43, size * 0.8, Math.sin(a) * size * 0.43); g.add(sp); }
    const cu = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.55, size * 0.6, size * 0.2, 20), mat('#e0344f', { rough: 0.7 })); cu.position.y = size * 0.1; g.add(cu);
  } else {
    const c = new THREE.Mesh(new RoundedBoxGeometry(size * 0.7, size * 0.7, size * 0.7, 2, size * 0.12), mat([PAL.mint, PAL.butter, PAL.sky, PAL.lilac][Math.floor(Math.random() * 4)])); c.position.y = size * 0.35; g.add(c);
  }
  return g;
}

// 멀리 떠 있는 섬들 (장식, 충돌 없음)
export async function floatingIslands(parent, spots) {
  const names = ['prop_lollipop', 'prop_cottoncandy', 'prop_cupcake', 'prop_icecream', 'prop_pinwheel', 'prop_giftbox', 'prop_donut'];
  const jobs = [];
  for (const [i, s] of spots.entries()) {
    const g = new THREE.Group(); g.position.set(s.x, s.y, s.z); parent.add(g);
    jobs.push(prop(g, 'prop_island', { x: 0, z: 0, size: s.size || 9, by: 'width', yaw: i * 1.7 }).then(o => {
      const topY = (o.userData.size?.y || 6) * 0.62;
      if (s.deco !== false) return prop(g, names[i % names.length], { x: 0, y: topY, z: 0, size: (s.size || 9) * 0.45, yaw: i });
    }));
    g.userData.bob = Math.random() * 6;
    parent.userData.islands ||= []; parent.userData.islands.push(g);
  }
  await Promise.all(jobs);
}
export function bobIslands(parent, t) { for (const g of parent.userData.islands || []) g.position.y += Math.sin(t * 0.6 + g.userData.bob) * 0.004; }

// 열기구
export async function hotAirBalloons(parent, n, center, radius) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + 0.4;
    const o = await prop(parent, 'prop_hotair', { x: center.x + Math.cos(a) * radius, y: 18 + i * 7 % 16, z: center.z + Math.sin(a) * radius, size: 10 });
    o.userData.phase = i * 1.3; list.push(o);
  }
  return list;
}
