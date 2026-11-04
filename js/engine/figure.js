// 캐릭터: 미니 유물레이더스와 같은 방식(TRELLIS 모델 + 블렌더에서 심은 뼈 11개)의 장난감 인형.
// 모델은 키 1, 발바닥 0, 앞이 +X. 뼈를 코드로 돌려서 달리기·점프·다이브·넘어짐·어지러움·기쁨 자세를 만든다.
import * as THREE from 'three';
import { clone as cloneSkinned } from '../../vendor/addons/utils/SkeletonUtils.js';
import { loadGLB, fitClone, hasModel } from './assets.js';
import { low } from './core.js';
import { HATS } from '../data/game.js';

export const FIG_H = 1.38;            // 캐릭터 키 (물리 몸 높이 1.2보다 조금 크게: 머리가 커 보이게)
const BONES = ['hips', 'spine', 'head', 'arm_uL', 'arm_lL', 'arm_uR', 'arm_lR', 'leg_uL', 'leg_lL', 'leg_uR', 'leg_lR'];
const AX_LAT = new THREE.Vector3(0, 0, 1);   // 모델 좌우 축: 이 축으로 돌리면 앞뒤로 흔들린다
const AX_FWD = new THREE.Vector3(1, 0, 0);   // 모델 앞 축: 이 축으로 돌리면 옆으로 벌어진다
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qm = new THREE.Quaternion();
const info = new Map();   // 모델별 머리 치수

export const modelName = (id, lod) => 'char_' + id + (lod && hasModel('char_' + id + '_lod') ? '_lod' : '');

// 머리 치수(모델 단위): 목 위 꼭짓점의 폭과 정수리. 안테나·깃털처럼 가는 것은 빼려고 가운데 기둥의 높은 쪽 2%는 버린다
function headInfo(src, neckY) {
  const ys = [], zs = [];
  src.traverse(o => {
    if (!o.isSkinnedMesh && !o.isMesh) return;
    const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 6000));
    for (let i = 0; i < p.count; i += step) {
      const y = p.getY(i), z = p.getZ(i);
      if (y < neckY + 0.04) continue;
      zs.push(Math.abs(z));
      if (Math.abs(z) < 0.1) ys.push(y);
    }
  });
  const q = (a, k) => { if (!a.length) return 0; a.sort((m, n) => m - n); return a[Math.min(a.length - 1, Math.floor(a.length * k))]; };
  return { top: q(ys, 0.98) || 0.95, width: q(zs, 0.97) * 2 || 0.3 };
}

// 그림자 원
let shadowTex = null;
function blobTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(30,20,60,0.55)'); g.addColorStop(0.6, 'rgba(30,20,60,0.25)'); g.addColorStop(1, 'rgba(30,20,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c); return shadowTex;
}
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

function nameSprite(text, me = false) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const x = c.getContext('2d');
  x.font = '700 40px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(240, x.measureText(text).width + 34);
  x.fillStyle = me ? 'rgba(255,90,140,0.92)' : 'rgba(25,30,70,0.6)';
  roundRect(x, 128 - w / 2, 8, w, 54, 27); x.fill();
  x.fillStyle = '#fff'; x.fillText(text, 128, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.11, 0.031, 1); s.renderOrder = 20;
  return s;
}
function roundRect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }

let starTex = null;
function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffd84d'; x.strokeStyle = '#ff9f1c'; x.lineWidth = 4; x.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.closePath(); x.fill(); x.stroke();
  starTex = new THREE.CanvasTexture(c); return starTex;
}

// 모델이 없을 때: 둥근 몸통 + 머리 (코드 인형)
function fallback() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: '#2b3157' }), white = new THREE.MeshLambertMaterial({ color: '#f2f4f8' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), white); body.position.y = 0.42; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.32), navy); head.position.y = 0.8; g.add(head);
  return g;
}

export class Figure {
  constructor(charId, { name = '', me = false, hat = 'none', showName = true, lod = !me } = {}) {
    this.id = charId; this.me = me;
    this.root = new THREE.Group();
    this.squash = new THREE.Group(); this.root.add(this.squash);
    this.tilt = new THREE.Group(); this.tilt.position.y = FIG_H * 0.5; this.squash.add(this.tilt);
    this.shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    this.shadow.renderOrder = 2;
    this.stars = new THREE.Group();
    const sm = new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false });
    for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(sm); s.scale.setScalar(0.28); this.stars.add(s); }
    this.stars.visible = false; this.root.add(this.stars);
    if (showName && name) { this.tag = nameSprite(name, me); this.tag.position.y = FIG_H + 0.4; this.root.add(this.tag); }
    if (me) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#ffe14d'; x.strokeStyle = '#ff6a8f'; x.lineWidth = 6; x.beginPath(); x.moveTo(8, 14); x.lineTo(56, 14); x.lineTo(32, 52); x.closePath(); x.fill(); x.stroke();
      this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
      this.arrow.scale.set(0.03, 0.03, 1); this.arrow.renderOrder = 21; this.root.add(this.arrow);
    }
    this.sq = { v: 0, x: 0 };
    this.pitch = 0; this.roll = 0; this.spin = 0; this.emote = null;
    this.w = 0.5; this.bones = {};
    this.ready = this.build(charId, hat, lod);
  }
  async build(id, hat, lod) {
    const src = await loadGLB(modelName(id, lod)) || (lod ? await loadGLB(modelName(id, false)) : null);
    if (!src) {
      const f = fallback(); f.scale.setScalar(FIG_H); f.position.y = -FIG_H * 0.5; this.tilt.add(f);
      this.head = { top: 0.95, width: 0.34 }; this.w = 0.4; await this.setHat(hat); return this;
    }
    const model = this.model = cloneSkinned(src);
    model.rotation.y = -Math.PI / 2;          // 모델 앞(+X) → 게임 앞(+Z)
    model.scale.setScalar(FIG_H);
    model.position.y = -FIG_H * 0.5;
    this.tilt.add(model);
    model.updateMatrixWorld(true);
    const inv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    model.traverse(o => {
      if (o.isSkinnedMesh || o.isMesh) { o.frustumCulled = false; o.castShadow = !low(); }
      if (!o.isBone) return;
      const key = o.name.replace(/[._]/g, ''), n = BONES.find(b => b === key || b.replace('_', '') === key);
      if (!n) return;
      // 뼈 방향(모델 기준) → 모델의 좌우·앞 축을 뼈 안쪽 좌표로
      const V = o.getWorldQuaternion(new THREE.Quaternion()).premultiply(inv), Vi = V.clone().invert();
      this.bones[n] = { b: o, rest: o.quaternion.clone(), lat: AX_LAT.clone().applyQuaternion(Vi).normalize(), fwd: AX_FWD.clone().applyQuaternion(Vi).normalize(), modelQ: V };
    });
    if (!info.has(id)) {
      const neck = this.bones.head ? this.bones.head.b.getWorldPosition(new THREE.Vector3()) : null;
      const neckY = neck ? model.worldToLocal(neck).y : 0.7;
      info.set(id, { ...headInfo(src, neckY), neckY });
    }
    this.head = info.get(id);
    this.w = Math.max(0.42, this.head.width * FIG_H);
    await this.setHat(hat);
    return this;
  }
  // 뼈 돌리기: pitch = 앞뒤(+면 팔다리가 앞으로), roll = 옆으로(+면 모델의 -Z 쪽 = 왼쪽으로)
  pose(n, pitch, roll = 0) {
    const k = this.bones[n]; if (!k) return;
    k.b.quaternion.copy(k.rest);
    if (pitch) k.b.quaternion.multiply(qa.setFromAxisAngle(k.lat, pitch));
    if (roll) k.b.quaternion.multiply(qb.setFromAxisAngle(k.fwd, roll));
  }
  async setHat(hatId) {
    if (this.hat) { this.hat.parent?.remove(this.hat); this.hat = null; }
    const h = HATS.find(x => x.id === hatId); this.hatId = hatId;
    if (!h || h.id === 'none') return;
    const src = await loadGLB('hat_' + h.id); if (!src || this.hatId !== hatId) return;
    const headW = (this.head?.width || 0.3) * FIG_H;
    const hm = fitClone(src, headW * h.size * 0.95, 'width');
    const hy = hm.userData.size.y;
    const topW = (this.head?.top || 0.95) * FIG_H;    // 발바닥에서 정수리까지 (월드 단위)
    let y = h.fit === 'top' ? topW - 0.07 : h.fit === 'wrap' ? topW - hy * 0.5 : topW - hy * 0.75 - 0.05;
    const hb = this.bones.head;
    if (!hb) { hm.position.y = y - FIG_H * 0.5; this.tilt.add(hm); this.hat = hm; return; }
    // 머리뼈에 붙인다: 뼈 안쪽 좌표는 모델 단위(키 1)이므로 FIG_H로 나눈다
    const holder = new THREE.Group();
    holder.quaternion.copy(hb.modelQ).invert().multiply(qm.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI / 2));
    const off = new THREE.Vector3(0, y / FIG_H - this.head.neckY, 0).applyQuaternion(hb.modelQ.clone().invert());
    holder.position.copy(off); holder.scale.setScalar(1 / FIG_H);
    holder.add(hm); hb.b.add(holder);
    this.hat = holder;
  }
  addTo(scene) { scene.add(this.root); scene.add(this.shadow); }
  removeFrom(scene) { scene.remove(this.root); scene.remove(this.shadow); }
  setVisible(v) { this.root.visible = v; this.shadow.visible = v; }
  update(b, dt, t) {
    const r = this.root;
    r.position.set(b.x, b.y, b.z);
    r.rotation.y = b.yaw;
    const hs = Math.hypot(b.vx, b.vz), st = b.state;
    const run = b.grounded && st === 'normal' ? Math.min(1, hs / 6.5) : 0;
    const ph = b.stepPhase * 1.05;
    // 착지 찌그러짐 (인형이라 말랑이보다 덜)
    if (b.justLanded) this.sq.v -= Math.min(4, b.landImpact * 0.25);
    if (b.justJumped) this.sq.v += 2.4;
    if (b.squish) { this.sq.v -= 3; b.squish = 0; }
    this.sq.v += (-this.sq.x * 260 - this.sq.v * 16) * dt; this.sq.x += this.sq.v * dt;
    let sy = 1 + this.sq.x * 0.35;
    if (!b.grounded && st !== 'dive' && st !== 'knock') sy += Math.max(-0.04, Math.min(0.06, b.vy * 0.006));
    sy = Math.max(0.78, Math.min(1.2, sy));
    const sxz = 1 / Math.sqrt(sy);
    this.squash.scale.set(sxz, sy, sxz);

    // 자세 값 (L/R 팔·다리)
    let pitchT = 0, rollT = 0, bob = 0;
    let spine = 0, head = 0, hips = 0;
    let auL = 0, auR = 0, alL = 0.15, alR = 0.15, aoL = 0.05, aoR = 0.05;   // 팔: 위팔 앞뒤 · 아래팔 굽힘 · 벌림
    let luL = 0, luR = 0, llL = 0, llR = 0, loL = 0, loR = 0;               // 다리
    if (st === 'normal' && b.grounded) {
      const s = Math.sin(ph), c = Math.cos(ph);
      luL = s * 0.8 * run; luR = -s * 0.8 * run;
      llL = -run * 0.95 * (0.5 - 0.5 * c); llR = -run * 0.95 * (0.5 + 0.5 * c);
      auL = -s * 0.75 * run; auR = s * 0.75 * run; alL = alR = 0.15 + 0.55 * run;
      spine = -0.14 * run; head = 0.08 * run;
      bob = Math.abs(s) * 0.05 * run;
      rollT = s * 0.04 * run;
      if (run < 0.1) { const br = Math.sin(t * 2.4); spine = br * 0.025; aoL = 0.07 + br * 0.03; aoR = 0.07 - br * 0.03; head = Math.sin(t * 0.9) * 0.05; }
    } else if (st === 'normal' || st === 'launch') {
      const fall = b.vy < -2, fl = fall ? Math.sin(t * 20) * 0.35 : 0;
      aoL = 1.15 + fl; aoR = 1.15 - fl; auL = auR = 0.35; alL = alR = 0.4;
      luL = 0.7; llL = -1.1; luR = -0.15; llR = -0.4;
      spine = 0.05; head = -0.1;
      pitchT = st === 'launch' ? -0.15 : 0.06;
      if (st === 'launch') { aoL = aoR = 2.5; auL = auR = 0.2; }
    } else if (st === 'dive' || st === 'slide') {
      pitchT = st === 'dive' ? 1.2 : 1.4;
      auL = auR = 2.7; alL = alR = 0.1; aoL = aoR = 0.25;
      luL = luR = -0.35; llL = llR = -0.5;
      head = -0.7;
      if (st === 'slide') bob = -0.12;
    } else if (st === 'getup') {
      pitchT = 0.5; auL = auR = 1.0;
    } else if (st === 'knock') {
      if (!b.grounded) { this.spin += dt * 14; pitchT = this.spin; } else { pitchT = -1.35; this.spin = 0; }
      aoL = aoR = 1.4; luL = 0.5; luR = -0.3; loL = 0.3; loR = 0.3;
    } else if (st === 'stun') {
      rollT = Math.sin(t * 7) * 0.14; pitchT = 0.08;
      head = 0.35 + Math.sin(t * 7) * 0.1; aoL = 0.25 + Math.sin(t * 7) * 0.15; aoR = 0.25 - Math.sin(t * 7) * 0.15; auL = auR = -0.1; alL = alR = 0.05;
    }
    if (this.emote === 'cheer') {
      const k = Math.abs(Math.sin(t * 7));
      aoL = 2.55 + k * 0.25; aoR = 2.55 + (1 - k) * 0.25; auL = auR = 0.15; alL = alR = 0.35;
      bob = k * 0.22; rollT = Math.sin(t * 7) * 0.08; head = -0.15;
      luL = luR = 0; llL = llR = 0;
    } else if (this.emote === 'sad') { head = 0.45; spine = 0.12; aoL = aoR = 0.02; auL = auR = 0.05; pitchT = 0.12; }
    if (st !== 'knock') this.spin = 0;
    const kk = st === 'knock' && !b.grounded ? 1 : Math.min(1, dt * 14);
    this.pitch += (pitchT - this.pitch) * kk;
    this.roll += (rollT - this.roll) * Math.min(1, dt * 12);
    this.tilt.rotation.x = this.pitch; this.tilt.rotation.z = this.roll;
    this.tilt.position.y = FIG_H * 0.5 + bob - (st === 'slide' ? 0.3 : 0) - (st === 'knock' && b.grounded ? 0.35 : 0);
    // 뼈: 등뼈·머리는 위를 향한 뼈라 앞으로 숙이려면 -pitch
    this.pose('hips', hips); this.pose('spine', spine); this.pose('head', -head);
    this.pose('arm_uL', auL, aoL); this.pose('arm_uR', auR, -aoR);
    this.pose('arm_lL', alL); this.pose('arm_lR', alR);
    this.pose('leg_uL', luL, loL); this.pose('leg_uR', luR, -loR);
    this.pose('leg_lL', llL); this.pose('leg_lR', llR);
    const dizzy = st === 'stun' || (st === 'knock' && b.grounded);
    this.stars.visible = dizzy;
    if (dizzy) this.stars.children.forEach((s, i) => { const a = t * 5 + i * 2.09; s.position.set(Math.cos(a) * 0.42, FIG_H + 0.12 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.42); });
    if (this.arrow) this.arrow.position.y = FIG_H + (this.tag ? 0.8 : 0.45) + Math.sin(t * 5) * 0.08;
    if (b.groundY > -50 && st !== 'fallen') {
      const hgt = Math.max(0, b.y - b.groundY);
      this.shadow.visible = this.root.visible;
      this.shadow.position.set(b.x, b.groundY + 0.03, b.z);
      const k = Math.max(0.35, 1 - hgt * 0.12);
      this.shadow.scale.setScalar(1.05 * k);
      this.shadow.material.opacity = k;
    } else this.shadow.visible = false;
  }
  dispose() { /* 공용 지오메트리·재질은 남긴다 */ }
}
