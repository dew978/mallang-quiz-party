// GLB 불러오기·크기 맞추기 (TRELLIS 모델은 Y 위, +Z 앞, 대략 1 크기). 없으면 null → 코드 모델로 대신.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/addons/loaders/GLTFLoader.js';
import { low, envMap } from './core.js';

const loader = new GLTFLoader();
const cache = new Map();
let manifest = null;

export async function loadManifest() {
  try { const r = await fetch('assets/models/manifest.json', { cache: 'no-cache' }); manifest = r.ok ? await r.json() : []; } catch (e) { manifest = []; }
  return manifest;
}
export const hasModel = name => !!manifest?.includes(name);

// 원본 장면을 한 번만 불러 두고, 쓸 때마다 복제한다
export function loadGLB(name) {
  if (cache.has(name)) return cache.get(name);
  const p = (async () => {
    if (manifest && !manifest.includes(name)) return null;
    try {
      const g = await loader.loadAsync(`assets/models/${name}.glb`);
      const root = g.scene;
      root.traverse(o => {
        if (o.isMesh) {
          o.castShadow = !low(); o.receiveShadow = false;
          const m = o.material;
          if (m && m.isMeshStandardMaterial) {
            if (low()) {
              o.material = new THREE.MeshLambertMaterial({ map: m.map, color: m.color });
            } else { m.roughness = Math.max(0.5, m.roughness ?? 0.6); m.metalness = Math.min(0.1, m.metalness ?? 0); m.envMap = envMap; m.envMapIntensity = 0.45; }
          }
          if (o.material?.map) { o.material.map.anisotropy = low() ? 1 : 4; }
        }
      });
      return root;
    } catch (e) { console.warn('모델을 못 불러왔어요', name, e); return null; }
  })();
  cache.set(name, p);
  return p;
}

// 바닥이 y=0, 가운데가 x=z=0이 되도록 하고, 높이(또는 가장 긴 변)를 size에 맞춘 복제본
export function fitClone(src, size, by = 'height') {
  const obj = src.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const sz = box.getSize(new THREE.Vector3());
  const ref = by === 'height' ? sz.y : by === 'width' ? sz.x : Math.max(sz.x, sz.y, sz.z);
  const k = size / Math.max(1e-6, ref);
  const wrap = new THREE.Group();
  obj.scale.multiplyScalar(k);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  obj.position.set(-c.x, -box.min.y * k, -c.z);
  wrap.add(obj);
  wrap.userData.size = sz.multiplyScalar(k);
  return wrap;
}

// 메시 꼭짓점에서 가운데 기둥의 가장 높은 곳 = 정수리 (귀·뿔은 옆에 있어서 피한다)
export function headTop(wrap) {
  const sz = wrap.userData.size; let best = 0, bestZ = 0;
  const v = new THREE.Vector3();
  wrap.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(wrap.matrixWorld).invert();
  wrap.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 6000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (Math.abs(v.x) < sz.x * 0.09 && v.y > best) { best = v.y; bestZ = v.z; }
    }
  });
  return { y: best || sz.y, z: bestZ };
}
