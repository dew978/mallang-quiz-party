// 카메라 가림 막기: 카메라와 내 캐릭터 사이에 낀 무대 물체를 "카메라에만" 안 보이게 한다.
// - 충돌체(World.solids)는 손대지 않는다 → 나·친구·봇 모두 그대로 부딪힌다.
// - visible 은 건드리지 않고 재질의 colorWrite/depthWrite 만 끈다 → 그림자는 그대로 남고,
//   게임 코드의 visible 토글(✕ 표시, 꺼진 회전 막대 등)과도 섞이지 않는다. 셰이더를 다시 만들지 않아 끊김도 없다.
// - 무대 root 바로 아래 자식 하나(문 벽 한 줄, 발판 하나, 추 하나…)를 한 덩어리로 통째로 숨긴다.
// - userData.camKeep = true 인 물체(와 그 아래)는 절대 숨기지 않는다: 회전 막대·추 공처럼 피해야 하는 것, 풍선·왕관 같은 목표물.
import * as THREE from 'three';

const HOLD = 0.25;        // 가림이 풀려도 이만큼은 더 숨긴다 (경계에서 깜빡이지 않게)
const BACK = 1.5;         // 광선을 카메라보다 이만큼 뒤에서 쏜다 (카메라가 물체 속을 지나가도 잡히게)
const NEAR = 1.2;         // 카메라 바로 앞 이 거리 안에 들어온 물체도 숨긴다 (화면 가장자리를 덮는 것)
const FLOOR_PAD = 0.3;    // 윗면이 마지막으로 선 높이 + 이 값보다 낮으면 바닥으로 보고 숨기지 않는다
const RELIST = 0.5;       // 무대 물체 목록을 다시 모으는 간격(초) — 풍선·발판이 새로 생기고 없어지므로
// 캐릭터 몸에서 광선이 닿을 점: [옆으로, 높이]. 몸통 가운데·위쪽만 본다 (발만 살짝 가리는 낮은 턱·트램펄린은 그대로 둔다)
const BODY_PTS = [[0, 0.65], [0, 1.1], [-0.34, 0.65], [0.34, 0.65]];
// 카메라 앞 화면 네 귀퉁이와 가운데 (NDC)
const VIEW_PTS = [[0, 0], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]];

const _o = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _from = new THREE.Vector3();
const _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _reg = new THREE.Box3();
const _seg = { t0: 0, t1: 0 };
const matState = new WeakMap();   // 물체 → 따로 복제한 재질과 원래 colorWrite/depthWrite

export class CameraOcclusion {
  constructor() {
    this.ray = new THREE.Raycaster();
    this.units = new Map();   // 덩어리 → { hitT, hidden }
    this.cands = [];          // 무대의 그릴 것들 { o, unit, box, live }
    this.boxes = new WeakMap();
    this.hits = [];
    this.owned = [];          // 숨기려고 따로 복제한 재질 (판이 끝나면 정리)
    this.t = 0; this.refY = null; this.root = null; this.listT = 0;
  }
  // root: 무대 그룹, camera: 위치·행렬이 갱신된 카메라, b: 따라가는 몸, active: false면 새로 숨기지 않는다(전부 되돌아옴)
  update(dt, root, camera, b, active) {
    this.t += dt;
    if (b && b.grounded) this.refY = b.y;
    if (root && b && active && b.state !== 'fallen') {
      if (this.refY === null) this.refY = b.y;
      this.scan(root, camera, b);
    }
    for (const [u, st] of this.units) {
      if (!u.parent) { this.units.delete(u); continue; }       // 무대에서 빠진 것 (터진 풍선 등)
      const hide = this.t - st.hitT < HOLD;
      if (hide !== st.hidden) { st.hidden = hide; setHidden(u, hide, this.owned); }
      if (!hide) this.units.delete(u);
    }
  }
  // 무대 root 아래 그릴 것들을 모은다 (camKeep 가지는 뺀다)
  collect(root) {
    this.root = root; this.listT = this.t + RELIST;
    const list = this.cands = [];
    const walk = (o, unit) => {
      if (o.userData.camKeep) return;
      if ((o.isMesh || o.isSprite) && o.geometry && o.material) {
        let box = this.boxes.get(o); if (!box) this.boxes.set(o, box = new THREE.Box3());
        list.push({ o, unit, box, live: false });
      }
      for (const c of o.children) walk(c, unit);
    };
    for (const u of root.children) walk(u, u);
  }
  scan(root, camera, b) {
    if (root !== this.root || this.t >= this.listT) this.collect(root);
    _o.copy(camera.position);
    // 광선이 지나갈 수 있는 범위 (카메라 둘레 + 몸 둘레를 감싸는 상자). 이 밖의 물체는 볼 필요가 없다
    const reach = BACK + NEAR;
    _reg.min.set(Math.min(_o.x - reach, b.x - 0.6), Math.min(_o.y - reach, b.y), Math.min(_o.z - reach, b.z - 0.6));
    _reg.max.set(Math.max(_o.x + reach, b.x + 0.6), Math.max(_o.y + reach, b.y + 1.5), Math.max(_o.z + reach, b.z + 0.6));
    // 이번 프레임 각 물체의 월드 상자. 범위 밖·발밑 바닥(윗면이 낮은 것)·꺼진 것·무대에서 빠진 것은 뺀다
    const floor = this.refY + FLOOR_PAD;
    for (const c of this.cands) {
      c.live = false;
      const o = c.o, m = o.matrixWorld;
      if (o.isSprite) {
        _p.setFromMatrixPosition(m); _sc.setFromMatrixScale(m);
        const r = Math.max(Math.abs(_sc.x), Math.abs(_sc.y)) * 0.71;
        if (!sphereNearBox(_p, r, _reg)) continue;
        c.box.min.set(_p.x - r, _p.y - r, _p.z - r); c.box.max.set(_p.x + r, _p.y + r, _p.z + r);
      } else {
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        _p.copy(g.boundingSphere.center).applyMatrix4(m);
        if (!sphereNearBox(_p, g.boundingSphere.radius * m.getMaxScaleOnAxis(), _reg)) continue;
        if (!g.boundingBox) g.computeBoundingBox();
        c.box.copy(g.boundingBox).applyMatrix4(m);
      }
      if (c.box.max.y <= floor) continue;
      if (!shownUnder(o, c.unit, root)) continue;
      c.live = true;
    }
    this.ray.camera = camera;     // 스프라이트 판정에 필요
    // 카메라에서 몸으로 가는 수평 방향의 옆쪽
    _s.set(b.z - _o.z, 0, _o.x - b.x);
    if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0); else _s.normalize();
    // 1) 카메라 → 몸 여러 점
    for (const [side, h] of BODY_PTS) {
      _t.set(b.x + _s.x * side, b.y + h, b.z + _s.z * side);
      _d.subVectors(_t, _o);
      const dist = _d.length(); if (dist < 1e-3) continue;
      _d.divideScalar(dist);
      this.cast(_d, dist + BACK);
    }
    // 2) 카메라 바로 앞 (카메라가 벽·판 속을 지나갈 때)
    for (const [nx, ny] of VIEW_PTS) {
      _d.set(nx, ny, 0.5).unproject(camera).sub(_o).normalize();
      this.cast(_d, NEAR + BACK);
    }
  }
  cast(dir, far) {
    const ray = this.ray, hits = this.hits;
    _from.copy(_o).addScaledVector(dir, -BACK);
    ray.set(_from, dir); ray.near = 0; ray.far = far;
    for (const c of this.cands) {
      if (!c.live || !segHitsBox(_from, dir, far, c.box)) continue;
      const st = this.units.get(c.unit);
      if (st && st.hitT === this.t) continue;          // 이 덩어리는 이번 프레임에 이미 맞음
      hits.length = 0;
      c.o.raycast(ray, hits);
      if (!hits.length) continue;
      if (st) st.hitT = this.t; else this.units.set(c.unit, { hitT: this.t, hidden: false });
    }
    hits.length = 0;
  }
  // 판이 끝날 때
  reset() {
    for (const [u, st] of this.units) if (st.hidden) setHidden(u, false, this.owned);
    this.units.clear();
    for (const m of this.owned) m.dispose();
    this.owned.length = 0; this.cands = [];
    this.refY = null; this.root = null;
  }
}

// 아직 그 덩어리 아래에 붙어 있고, 위로 올라가며 꺼진(visible=false) 것이 없나
function shownUnder(o, unit, root) {
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === unit) return unit.parent === root;
  }
  return false;
}
// 공(가운데 c, 반지름 r)이 상자에 닿나
function sphereNearBox(c, r, box) {
  const dx = Math.max(box.min.x - c.x, 0, c.x - box.max.x);
  const dy = Math.max(box.min.y - c.y, 0, c.y - box.max.y);
  const dz = Math.max(box.min.z - c.z, 0, c.z - box.max.z);
  return dx * dx + dy * dy + dz * dz <= r * r;
}
// 선분(from + dir·t, 0 ≤ t ≤ far)이 상자를 지나가나 (축마다 들어가고 나오는 t를 좁혀 간다)
function segHitsBox(from, dir, far, box) {
  const r = _seg; r.t0 = 0; r.t1 = far;
  return slab(from.x, dir.x, box.min.x, box.max.x, r) && slab(from.y, dir.y, box.min.y, box.max.y, r) && slab(from.z, dir.z, box.min.z, box.max.z, r);
}
function slab(o, d, lo, hi, r) {
  if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / d, c = (hi - o) / d;
  if (a > c) { const x = a; a = c; c = x; }
  if (a > r.t0) r.t0 = a;
  if (c < r.t1) r.t1 = c;
  return r.t0 <= r.t1;
}
// 덩어리 안의 그릴 것들을 숨기거나 되돌린다 (camKeep 가지는 건너뜀)
function setHidden(o, hide, owned) {
  if (o.userData.camKeep) return;
  if (o.material) {
    for (const e of ownMats(o, owned)) {
      e.m.colorWrite = hide ? false : e.cw;
      e.m.depthWrite = hide ? false : e.dw;
    }
  }
  for (const c of o.children) setHidden(c, hide, owned);
}
// 재질은 여러 물체가 같이 쓰므로(mat 캐시) 처음 숨길 때 이 물체 것만 따로 복제해 둔다.
// 같은 설정의 복제라 셰이더는 그대로 다시 쓴다. 게임 코드가 재질을 통째로 바꿨으면 새 것으로 다시 복제한다.
function ownMats(o, owned) {
  const cur = Array.isArray(o.material) ? o.material : [o.material];
  let list = matState.get(o);
  if (list && list.length === cur.length && list.every((e, i) => e.m === cur[i])) return list;
  list = cur.map(m => {
    const c = m.clone(); owned.push(c);
    return { m: c, cw: m.colorWrite, dw: m.depthWrite };
  });
  o.material = Array.isArray(o.material) ? list.map(e => e.m) : list[0].m;
  matState.set(o, list);
  return list;
}
