// 캐릭터 카드 그림: 게임 속 캐릭터 모델(모자 포함)을 그대로 찍어서 쓴다 (카드 = 인게임 모습)
import * as THREE from 'three';
import { Figure, FIG_H } from '../engine/figure.js';
import { makeBody } from '../engine/physics.js';
import { envMap } from '../engine/core.js';

let r = null, scene = null, cam = null;
const cache = new Map();
function setup() {
  if (r) return;
  const c = document.createElement('canvas'); c.width = 320; c.height = 360;
  r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(320, 360, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#ffc9e3', 1.3));
  const d = new THREE.DirectionalLight('#fff4e0', 2.2); d.position.set(2, 4, 5); scene.add(d);
  cam = new THREE.PerspectiveCamera(30, 320 / 360, 0.1, 50);
}
export async function portrait(charId, hat = 'none', pose = 'idle') {
  const key = charId + '|' + hat + '|' + pose;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    setup();
    const m = new Figure(charId, { showName: false, hat, lod: false });
    await m.ready;
    if (m.hatId !== hat) await m.setHat(hat);
    const b = makeBody(0, 0, 0); b.yaw = 0.35; b.grounded = true;
    if (pose === 'cheer') m.emote = 'cheer';
    m.update(b, 0.016, 0.3);
    m.shadow.visible = false;
    scene.add(m.root);
    cam.position.set(0.22, FIG_H * 0.64, 3.45); cam.lookAt(0, FIG_H * 0.6, 0);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    scene.remove(m.root);
    return url;
  })();
  cache.set(key, p);
  return p;
}
