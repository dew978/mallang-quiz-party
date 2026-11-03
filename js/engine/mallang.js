// 말랑이: TRELLIS 몸통(동그란 찹쌀떡) + 코드로 붙인 손·발 + 모자 + 이름표.
// 뼈대 없이 상태(달리기·점프·다이브·넘어짐·어지러움·기쁨)에 따라 손발과 몸을 절차적으로 움직인다.
import * as THREE from 'three';
import { loadGLB, fitClone, headTop } from './assets.js';
import { low, mat } from './core.js';
import { charById, HATS } from '../data/game.js';

export const BODY_H = 1.08;          // 몸통 높이
const LIFT = 0.13;                   // 발 위로 몸통이 떠 있는 높이
const sphere = new THREE.SphereGeometry(1, 16, 12);
const sphereLo = new THREE.SphereGeometry(1, 10, 8);
let colors = {};
export async function loadCharColors() {
  try { const r = await fetch('assets/images/chars_colors.json', { cache: 'no-cache' }); if (r.ok) colors = await r.json(); } catch (e) { /* 기본색 */ }
}
const bodyInfo = new Map();   // 캐릭터별 몸통 크기·정수리

async function bodyFor(id) {
  const src = await loadGLB('char_' + id);
  if (src) {
    const w = fitClone(src, BODY_H, 'height');
    if (!bodyInfo.has(id)) bodyInfo.set(id, { size: w.userData.size.clone(), head: headTop(w) });
    return w;
  }
  return fallbackBody(id);
}

// 모델 파일이 없을 때: 동그란 몸 + 귀 + 눈 (코드 모델)
function fallbackBody(id) {
  const ch = charById(id), g = new THREE.Group();
  const body = new THREE.Mesh(sphereLo === sphere ? sphere : sphere, mat(ch.body, { rough: 0.55 }));
  body.scale.set(0.5, 0.48, 0.47); body.position.y = 0.48; g.add(body);
  const dark = mat('#2a2230', { rough: 0.3 }), white = mat('#ffffff', { rough: 0.2, emissive: 0.2 }), blush = mat('#ff9fb6', { rough: 0.6 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(sphere, dark); e.scale.set(0.075, 0.095, 0.05); e.position.set(sx * 0.16, 0.56, 0.43); g.add(e);
    const hl = new THREE.Mesh(sphere, white); hl.scale.setScalar(0.028); hl.position.set(sx * 0.16 + 0.025, 0.59, 0.47); g.add(hl);
    const b = new THREE.Mesh(sphere, blush); b.scale.set(0.07, 0.04, 0.03); b.position.set(sx * 0.27, 0.45, 0.39); g.add(b);
    const acc = mat(ch.accent, { rough: 0.5 });
    if (id === 'mochi') { const ear = new THREE.Mesh(sphere, mat(ch.body)); ear.scale.set(0.09, 0.3, 0.07); ear.position.set(sx * 0.15, 1.05, 0); ear.rotation.z = -sx * 0.15; g.add(ear); }
    else if (id === 'cheese') { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), acc); ear.position.set(sx * 0.27, 0.92, 0); g.add(ear); }
    else if (id === 'bori' || id === 'pangi') { const ear = new THREE.Mesh(sphere, id === 'pangi' ? mat('#2d2d33') : acc); ear.scale.set(0.12, 0.12, 0.07); ear.position.set(sx * 0.3, 0.9, 0); g.add(ear); }
  }
  if (id === 'ppiyak') { const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), mat('#ff9f2e')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.47, 0.5); g.add(beak); }
  if (id === 'dino') for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), mat('#ffe27a')); sp.position.set(0, 0.95 - i * 0.18, -0.25 - i * 0.12); sp.rotation.x = -0.6 - i * 0.3; g.add(sp); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), dark); mouth.position.set(0, 0.47, 0.47); mouth.rotation.z = Math.PI; g.add(mouth);
  g.userData.size = new THREE.Vector3(1, BODY_H, 0.95);
  if (!bodyInfo.has(id)) bodyInfo.set(id, { size: g.userData.size.clone(), head: { y: id === 'mochi' ? 0.96 : 0.96, z: 0 } });
  g.traverse(o => { if (o.isMesh) o.castShadow = !low(); });
  return g;
}

// 그림자 원 (모든 화질에서 보임: 점프할 때 어디에 떨어질지 알려 준다)
let shadowTex = null;
function blobTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(40,20,60,0.55)'); g.addColorStop(0.6, 'rgba(40,20,60,0.25)'); g.addColorStop(1, 'rgba(40,20,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c); return shadowTex;
}
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// 이름표: 화면에서 늘 같은 크기
function nameSprite(text, color = '#ffffff', me = false) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const x = c.getContext('2d');
  x.font = '700 40px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(240, x.measureText(text).width + 34);
  x.fillStyle = me ? 'rgba(255,90,140,0.92)' : 'rgba(40,30,70,0.55)';
  roundRect(x, 128 - w / 2, 8, w, 54, 27); x.fill();
  x.fillStyle = color; x.fillText(text, 128, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.11, 0.031, 1); s.renderOrder = 20;
  return s;
}
function roundRect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }

// 어지러움 별
let starTex = null;
function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffd84d'; x.strokeStyle = '#ff9f1c'; x.lineWidth = 4; x.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.closePath(); x.fill(); x.stroke();
  starTex = new THREE.CanvasTexture(c); return starTex;
}

const hatCache = new Map();
async function hatModel(id) {
  if (!id || id === 'none') return null;
  const src = await loadGLB('hat_' + id);
  return src;
}

export class Mallang {
  constructor(charId, { name = '', me = false, hat = 'none', showName = true } = {}) {
    this.id = charId; this.me = me;
    this.root = new THREE.Group();
    this.squash = new THREE.Group(); this.root.add(this.squash);
    this.tilt = new THREE.Group(); this.tilt.position.y = LIFT + BODY_H * 0.5; this.squash.add(this.tilt);
    const ch = charById(charId), col = colors[charId] || {};
    const bodyCol = col.body || ch.body, accCol = col.accent || ch.accent;
    const geo = low() ? sphereLo : sphere;
    const handM = mat(bodyCol, { rough: 0.5 }), footM = mat(accCol, { rough: 0.5 });
    this.hands = [0, 1].map(() => { const m = new THREE.Mesh(geo, handM); m.scale.setScalar(0.12); m.castShadow = !low(); this.tilt.add(m); return m; });
    this.feet = [0, 1].map(() => { const m = new THREE.Mesh(geo, footM); m.scale.set(0.15, 0.1, 0.2); m.castShadow = !low(); this.tilt.add(m); return m; });
    // 그림자
    this.shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    this.shadow.renderOrder = 2;
    // 어지러움 별 3개
    this.stars = new THREE.Group();
    const sm = new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false });
    for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(sm); s.scale.setScalar(0.28); this.stars.add(s); }
    this.stars.visible = false; this.root.add(this.stars);
    if (showName && name) { this.tag = nameSprite(name, '#fff', me); this.tag.position.y = LIFT + BODY_H + 0.55; this.root.add(this.tag); }
    if (me) {
      // 내 캐릭터 머리 위 통통 튀는 화살표
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#ffe14d'; x.strokeStyle = '#ff6a8f'; x.lineWidth = 6; x.beginPath(); x.moveTo(8, 14); x.lineTo(56, 14); x.lineTo(32, 52); x.closePath(); x.fill(); x.stroke();
      this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
      this.arrow.scale.set(0.03, 0.03, 1); this.arrow.renderOrder = 21; this.root.add(this.arrow);
    }
    this.sq = { v: 0, x: 0 };        // 착지 찌그러짐 스프링
    this.pitch = 0; this.roll = 0; this.spin = 0; this.emote = null; this.emoteT = 0;
    this.ready = this.build(charId, hat);
  }
  async build(id, hat) {
    const b = await bodyFor(id);
    b.position.y = -BODY_H * 0.5;
    this.body = b; this.tilt.add(b);
    const info = bodyInfo.get(id); this.info = info;
    const w = info.size.x, d = info.size.z;
    this.w = w; this.d = d;
    this.handBase = [new THREE.Vector3(-w * 0.5, -0.06, d * 0.05), new THREE.Vector3(w * 0.5, -0.06, d * 0.05)];
    this.footBase = [new THREE.Vector3(-w * 0.2, -BODY_H * 0.5 - LIFT + 0.07, d * 0.08), new THREE.Vector3(w * 0.2, -BODY_H * 0.5 - LIFT + 0.07, d * 0.08)];
    await this.setHat(hat);
    return this;
  }
  async setHat(hatId) {
    if (this.hat) { this.tilt.remove(this.hat); this.hat = null; }
    const h = HATS.find(x => x.id === hatId); this.hatId = hatId;
    if (!h || h.id === 'none') return;
    const src = await hatModel(h.id); if (!src || this.hatId !== hatId) return;
    const w = this.w || 1, info = this.info;
    const hm = fitClone(src, w * h.size, 'width');
    const top = info.head.y - BODY_H * 0.5;
    if (h.fit === 'top') hm.position.set(0, top - 0.04, info.head.z * 0.5);
    else if (h.fit === 'wrap') hm.position.set(0, top - hm.userData.size.y * 0.42, info.head.z * 0.3);
    else hm.position.set(0, top - hm.userData.size.y * 0.75 - 0.05, info.head.z * 0.2);
    this.hat = hm; this.tilt.add(hm);
  }
  addTo(scene) { scene.add(this.root); scene.add(this.shadow); }
  removeFrom(scene) { scene.remove(this.root); scene.remove(this.shadow); }
  setVisible(v) { this.root.visible = v; this.shadow.visible = v; }
  // b: 물리 몸, t: 시간
  update(b, dt, t) {
    const r = this.root;
    r.position.set(b.x, b.y, b.z);
    r.rotation.y = b.yaw;
    const hs = Math.hypot(b.vx, b.vz);
    const run = b.grounded && b.state === 'normal' ? Math.min(1, hs / 6.5) : 0;
    const ph = b.stepPhase * 1.05;
    let pitchT = 0, rollT = 0, bob = 0;
    const hand = this.hands, foot = this.feet;
    const hb = this.handBase, fb = this.footBase;
    if (!hb) return;
    // 기본 자세
    let hL = hb[0].clone(), hR = hb[1].clone(), fL = fb[0].clone(), fR = fb[1].clone();
    const st = b.state;
    // 착지 찌그러짐
    if (b.justLanded) this.sq.v -= Math.min(5.5, b.landImpact * 0.34);
    if (b.justJumped) this.sq.v += 3.2;
    if (b.squish) { this.sq.v -= 4; b.squish = 0; }
    this.sq.v += (-this.sq.x * 260 - this.sq.v * 16) * dt; this.sq.x += this.sq.v * dt;
    let sy = 1 + this.sq.x * 0.5;
    if (!b.grounded && st !== 'dive' && st !== 'knock') sy += Math.max(-0.06, Math.min(0.12, b.vy * 0.012));
    sy = Math.max(0.68, Math.min(1.3, sy));
    const sxz = 1 / Math.sqrt(sy);
    this.squash.scale.set(sxz, sy, sxz);

    if (st === 'normal' && b.grounded) {
      bob = Math.abs(Math.sin(ph)) * 0.07 * run + Math.sin(t * 2.6) * 0.008;
      pitchT = 0.2 * run; rollT = Math.sin(ph) * 0.09 * run;
      fL.z += Math.sin(ph) * 0.2 * run; fL.y += Math.max(0, Math.cos(ph)) * 0.1 * run;
      fR.z -= Math.sin(ph) * 0.2 * run; fR.y += Math.max(0, -Math.cos(ph)) * 0.1 * run;
      hL.z -= Math.sin(ph) * 0.16 * run; hR.z += Math.sin(ph) * 0.16 * run;
      hL.y += 0.04 * run; hR.y += 0.04 * run;
      // 가만히 있을 때 손을 살랑
      if (run < 0.1) { hL.y += Math.sin(t * 2.6) * 0.02; hR.y += Math.sin(t * 2.6 + 0.4) * 0.02; }
    } else if (st === 'normal' || st === 'launch') {
      // 공중: 올라갈 땐 손 위로, 떨어질 땐 버둥
      const fall = b.vy < -2;
      const fl = fall ? Math.sin(t * 22) * 0.08 : 0;
      hL.y += 0.3 + fl; hR.y += 0.3 - fl; hL.x -= 0.06; hR.x += 0.06;
      fL.y += 0.08; fR.y += 0.08; fL.z -= 0.08; fR.z += 0.06;
      pitchT = st === 'launch' ? -0.2 : 0.08;
    } else if (st === 'dive' || st === 'slide') {
      pitchT = st === 'dive' ? 1.25 : 1.45;
      hL.set(-this.w * 0.32, 0.18, this.d * 0.62); hR.set(this.w * 0.32, 0.18, this.d * 0.62);
      fL.z -= 0.25; fR.z -= 0.25; fL.y += 0.12; fR.y += 0.12;
      if (st === 'slide') bob = -0.08;
    } else if (st === 'getup') {
      pitchT = 0.5;
    } else if (st === 'knock') {
      if (!b.grounded) { this.spin += dt * 14; pitchT = this.spin; }
      else { pitchT = -1.35; this.spin = 0; }
      hL.y += 0.25; hR.y += 0.25; hL.x -= 0.1; hR.x += 0.1;
    } else if (st === 'stun') {
      rollT = Math.sin(t * 7) * 0.16; pitchT = 0.1;
      hL.y -= 0.05; hR.y -= 0.05;
    }
    // 기쁨 동작
    if (this.emote === 'cheer') {
      const k = Math.abs(Math.sin(t * 7));
      hL.set(-this.w * 0.45, 0.42 + k * 0.1, 0.05); hR.set(this.w * 0.45, 0.42 + (1 - k) * 0.1, 0.05);
      bob = k * 0.25; rollT = Math.sin(t * 7) * 0.12;
    } else if (this.emote === 'sad') { pitchT = 0.35; hL.y -= 0.12; hR.y -= 0.12; }
    if (st !== 'knock') this.spin = 0;
    // 넘어진 자세로 바로 바뀌면 어색하므로 부드럽게 (공중 돌기는 바로)
    const kk = st === 'knock' && !b.grounded ? 1 : Math.min(1, dt * 14);
    this.pitch += (pitchT - this.pitch) * kk;
    this.roll += (rollT - this.roll) * Math.min(1, dt * 12);
    this.tilt.rotation.x = this.pitch; this.tilt.rotation.z = this.roll;
    this.tilt.position.y = LIFT + BODY_H * 0.5 + bob - (st === 'slide' ? 0.25 : 0) - (st === 'knock' && b.grounded ? 0.3 : 0);
    hand[0].position.copy(hL); hand[1].position.copy(hR); foot[0].position.copy(fL); foot[1].position.copy(fR);
    // 어지러움 별
    const dizzy = st === 'stun' || (st === 'knock' && b.grounded);
    this.stars.visible = dizzy;
    if (dizzy) this.stars.children.forEach((s, i) => { const a = t * 5 + i * 2.09; s.position.set(Math.cos(a) * 0.42, LIFT + BODY_H + 0.15 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.42); });
    if (this.arrow) this.arrow.position.y = LIFT + BODY_H + (this.tag ? 0.95 : 0.6) + Math.sin(t * 5) * 0.08;
    // 그림자: 아래 바닥에 붙인다
    if (b.groundY > -50 && b.state !== 'fallen') {
      const hgt = Math.max(0, b.y - b.groundY);
      this.shadow.visible = this.root.visible;
      this.shadow.position.set(b.x, b.groundY + 0.03, b.z);
      const k = Math.max(0.35, 1 - hgt * 0.12);
      this.shadow.scale.setScalar((this.w || 1) * 1.05 * k);
      this.shadow.material.opacity = k;
    } else this.shadow.visible = false;
  }
  dispose() { /* 공용 지오메트리·재질은 남긴다 */ }
}
