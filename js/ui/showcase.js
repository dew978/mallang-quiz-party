// 메뉴 왼쪽: 내 캐릭터를 3D로 세워 둔다. 숨 쉬듯 살랑이다가 가끔 손을 번쩍, 끌면 돌아간다.
// 메뉴 화면에서만 그리고(그 밖에서는 멈춤), 게임 캔버스와 따로 작은 렌더러를 쓴다.
import * as THREE from 'three';
import { Figure, FIG_H } from '../engine/figure.js';
import { makeBody } from '../engine/physics.js';
import { envMap, low } from '../engine/core.js';

let r = null, scene = null, cam = null, fig = null, key = '', raf = 0, canvas = null;
const body = makeBody(0, 0, 0);
let yaw = 0.35, spinV = 0, drag = null, t = 0, last = 0, cheerT = 4;

function setup(cv) {
  if (r && canvas === cv) return;
  canvas = cv;
  r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: !low() });
  r.setPixelRatio(Math.min(devicePixelRatio, low() ? 1 : 2));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
  scene = new THREE.Scene();
  if (envMap) scene.environment = envMap;
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2f6a', 1.5));
  const k = new THREE.DirectionalLight('#fff3e6', 2.4); k.position.set(2, 4, 4); scene.add(k);
  const rim = new THREE.DirectionalLight('#36f1ff', 1.6); rim.position.set(-3, 2, -3); scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#ff4f9a', 1.0); rim2.position.set(3, 1, -2); scene.add(rim2);
  cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  // 끌어서 돌리기
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y0: yaw }; cv.setPointerCapture(e.pointerId); spinV = 0; });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; const ny = drag.y0 + dx * 0.012; spinV = (ny - yaw) * 30; yaw = ny; });
  const up = () => { drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  // 톡 누르면 기뻐한다
  cv.addEventListener('click', () => { if (fig) { fig.emote = 'cheer'; cheerT = -1.2; } });
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) r.setSize(w, h, false);
  cam.aspect = w / h;
  // 캐릭터 키가 화면 높이의 80%쯤 되게
  const dist = (FIG_H * 1.25) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  cam.position.set(0, FIG_H * 0.74, dist); cam.lookAt(0, FIG_H * 0.66, 0);
  cam.updateProjectionMatrix();
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
  if (!fig || !canvas.offsetParent) return;
  resize();
  if (!drag) { spinV *= Math.pow(0.04, dt); yaw += spinV * dt; yaw += (0.35 + Math.sin(t * 0.4) * 0.25 - yaw) * Math.min(1, dt * (Math.abs(spinV) > 0.3 ? 0 : 0.8)); }
  // 가끔 손을 번쩍
  cheerT += dt;
  if (cheerT > 6) { fig.emote = 'cheer'; cheerT = -1.4; }
  if (cheerT > 0 && fig.emote === 'cheer') fig.emote = null;
  body.yaw = yaw; body.grounded = true; body.vx = body.vz = 0; body.groundY = -100;
  fig.update(body, dt, t);
  r.render(scene, cam);
}

export async function showHero(cv, charId, hat = 'none') {
  if (!cv) return;
  setup(cv);
  const k = charId + '|' + hat;
  if (k !== key) {
    key = k;
    const f = new Figure(charId, { showName: false, hat, lod: false });
    await f.ready;
    if (key !== k) return;
    if (fig) scene.remove(fig.root);
    fig = f; fig.shadow.visible = false; scene.add(fig.root);
    fig.emote = 'cheer'; cheerT = -1.2;
  }
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
}
export function hideHero() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
