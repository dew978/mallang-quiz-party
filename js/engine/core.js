// 렌더러·장면·하늘·젤리 바다·조명. 그래픽 품질(high/low)과 자동 해상도 조절.
import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/addons/environments/RoomEnvironment.js';
import { save } from '../save.js';

export const canvas = document.getElementById('gl');
export let renderer, scene, camera, envMap = null;
export const clock = { t: 0, dt: 0 };
let pixelScale = 1, slowFrames = 0, fastFrames = 0;

export function low() { return save.settings.quality === 'low'; }

export function initCore() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !low(), powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !low();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.3, 700);
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  } catch (e) { envMap = null; }
  resize();
  addEventListener('resize', resize);
}
export function applyQuality() {
  if (!renderer) return;
  renderer.shadowMap.enabled = !low();
  pixelScale = 1;
  resize();
}
export function resize() {
  const w = innerWidth, h = innerHeight;
  const maxPR = low() ? 1 : 1.75;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxPR) * pixelScale);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 세로가 긴 화면에서도 좌우가 덜 잘리게
  camera.fov = w / h < 1.3 ? 62 : 55;
  camera.updateProjectionMatrix();
}
// 느린 기기면 해상도를 조금씩 낮추고, 여유가 있으면 되돌린다
export function adaptResolution(frameDt) {
  if (frameDt > 1 / 40) { slowFrames++; fastFrames = 0; } else if (frameDt < 1 / 56) { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
  if (slowFrames > 90 && pixelScale > 0.55) { pixelScale = Math.max(0.55, pixelScale - 0.15); slowFrames = 0; resize(); }
  if (fastFrames > 600 && pixelScale < 1) { pixelScale = Math.min(1, pixelScale + 0.1); fastFrames = 0; resize(); }
}

// ---- 공용 재질: 말랑한 사탕 플라스틱 ----
const matCache = new Map();
export function mat(color, { rough = 0.42, metal = 0, emissive = 0, map = null, transparent = false, opacity = 1, side, key } = {}) {
  const k = key || [color, rough, metal, emissive, transparent, opacity, side, low()].join('|');
  if (!map && matCache.has(k)) return matCache.get(k);
  let m;
  if (low()) m = new THREE.MeshLambertMaterial({ color, map, transparent, opacity });
  else m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map, transparent, opacity, envMap, envMapIntensity: 0.55 });
  if (emissive) { m.emissive = new THREE.Color(color); m.emissiveIntensity = emissive; }
  if (side) m.side = side;
  if (!map) matCache.set(k, m);
  return m;
}
export function clearMatCache() { matCache.clear(); }

// ---- 하늘: 위는 하늘색, 지평선은 분홍빛 ----
export function makeSky(top = '#6cc4ff', mid = '#bfe6ff', bottom = '#ffd6ea') {
  const g = new THREE.SphereGeometry(600, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vp;
      void main(){ float h = vp.y; vec3 c = h > 0.05 ? mix(mid, top, smoothstep(0.05, 0.55, h)) : mix(bottom, mid, smoothstep(-0.25, 0.05, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -10; sky.frustumCulled = false;
  return sky;
}

// 구름: 캔버스로 그린 몽글몽글 구름 스프라이트
let cloudTex = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const blobs = [[70, 80, 42], [120, 62, 52], [175, 78, 40], [100, 92, 36], [150, 95, 34], [205, 92, 26], [45, 96, 24]];
  x.fillStyle = 'rgba(255,255,255,1)';
  for (const [bx, by, r] of blobs) { x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill(); }
  // 아래쪽 그늘
  const g = x.createLinearGradient(0, 40, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(200,215,245,0.55)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  cloudTex = new THREE.CanvasTexture(c); cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}
export function makeClouds(n = 22, spread = 260, yMin = 10, yMax = 70, center = new THREE.Vector3()) {
  const grp = new THREE.Group();
  const m = new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.95 });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(m);
    const a = Math.random() * Math.PI * 2, r = spread * (0.45 + Math.random() * 0.55);
    s.position.set(center.x + Math.cos(a) * r, yMin + Math.random() * (yMax - yMin), center.z + Math.sin(a) * r);
    const k = 30 + Math.random() * 45; s.scale.set(k, k * 0.5, 1);
    s.userData.drift = 0.6 + Math.random() * 1.2;
    grp.add(s);
  }
  // 발밑 아래로 깔리는 구름 바다
  for (let i = 0; i < Math.round(n * 0.7); i++) {
    const s = new THREE.Sprite(m);
    const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * spread * 0.8;
    s.position.set(center.x + Math.cos(a) * r, -16 - Math.random() * 14, center.z + Math.sin(a) * r);
    const k = 40 + Math.random() * 50; s.scale.set(k, k * 0.45, 1);
    s.userData.drift = 0.3 + Math.random() * 0.6;
    grp.add(s);
  }
  grp.userData.update = dt => { for (const s of grp.children) { s.position.x += s.userData.drift * dt; if (s.position.x > center.x + spread) s.position.x -= spread * 2; } };
  return grp;
}

// 젤리 바다: 떨어지면 퐁당 빠지는 곳 (물결 셰이더)
export function makeJellySea(y = -7, size = 600, color = '#7fd0ff', color2 = '#e3f6ff') {
  const g = new THREE.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, c1: { value: new THREE.Color(color) }, c2: { value: new THREE.Color(color2) } },
    vertexShader: 'varying vec2 vw; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vw = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float t; uniform vec3 c1; uniform vec3 c2; varying vec2 vw;
      void main(){ float a = sin(vw.x*0.16 + t*1.3) * cos(vw.y*0.13 - t*1.1) + sin((vw.x+vw.y)*0.07 + t*0.6);
      float s = smoothstep(0.9, 1.6, a);
      vec3 c = mix(c1, c2, 0.5 + 0.35*a);
      c = mix(c, vec3(1.0), s*0.3);
      float d = length(vw) / 300.0;
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const sea = new THREE.Mesh(g, m); sea.position.y = y;
  sea.userData.update = dt => { m.uniforms.t.value += dt; };
  return sea;
}

// 기본 조명: 반구광 + 해 (해가 그림자를 만든다, 그림자 범위는 플레이어를 따라감)
export function makeLights() {
  const grp = new THREE.Group();
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffc9e3', low() ? 1.7 : 1.15);
  grp.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', low() ? 1.5 : 2.1);
  sun.position.set(-14, 26, 10);
  sun.castShadow = !low();
  sun.shadow.mapSize.set(1024, 1024);
  const s = sun.shadow.camera; s.left = -26; s.right = 26; s.top = 26; s.bottom = -26; s.near = 1; s.far = 80;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  grp.add(sun, sun.target);
  grp.userData.follow = (p) => { sun.position.set(p.x - 14, p.y + 26, p.z + 10); sun.target.position.copy(p); };
  return grp;
}
