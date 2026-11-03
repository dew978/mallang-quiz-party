// 조작: 키보드(WASD/방향키, Space 점프, Shift·E 다이브) + 터치(왼쪽 떠다니는 조이스틱, 오른쪽 점프·다이브 단추)
const keys = new Set();
const state = { jumpEdge: false, diveEdge: false, jumpHeld: false, joy: { x: 0, y: 0, active: false }, enabled: false };
export const input = state;

addEventListener('keydown', e => {
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && state.enabled) e.preventDefault(); return; }
  keys.add(e.code);
  if (!state.enabled) return;
  if (e.code === 'Space') { state.jumpEdge = true; state.jumpHeld = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') state.diveEdge = true;
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Space') state.jumpHeld = false; });
addEventListener('blur', () => { keys.clear(); state.jumpHeld = false; resetJoy(); });

// 이동 벡터 (x: 오른쪽, y: 앞쪽), 길이 0~1
export function moveVector() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
  if (state.joy.active) return { x: state.joy.x, y: state.joy.y };
  return { x: 0, y: 0 };
}
export function consumeEdges() { const j = state.jumpEdge, d = state.diveEdge; state.jumpEdge = false; state.diveEdge = false; return { jump: j, dive: d }; }
export function clearInput() { state.jumpEdge = state.diveEdge = false; state.jumpHeld = false; resetJoy(); }

// ---- 터치 ----
let joyId = null, ox = 0, oy = 0;
const R = 62;
let base, knob, zone;
function resetJoy() { state.joy.x = state.joy.y = 0; state.joy.active = false; joyId = null; if (base) base.classList.remove('on'); }
export function initTouch() {
  zone = document.getElementById('joyZone'); base = document.getElementById('joyBase'); knob = document.getElementById('joyKnob');
  if (!zone) return;
  zone.addEventListener('pointerdown', e => {
    if (joyId !== null || !state.enabled) return;
    joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    ox = e.clientX; oy = e.clientY;
    base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px';
    base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
    state.joy.active = true; state.joy.x = state.joy.y = 0;
    e.preventDefault();
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const l = Math.hypot(dx, dy);
    // 손가락이 많이 밀리면 받침도 따라온다
    if (l > R * 1.4) { const k = (l - R * 1.4) / l; ox += dx * k; oy += dy * k; const r = zone.getBoundingClientRect(); base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px'; dx = e.clientX - ox; dy = e.clientY - oy; }
    const ll = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const kx = Math.cos(a) * ll, ky = Math.sin(a) * ll;
    knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const m = ll < 8 ? 0 : Math.min(1, (ll - 8) / (R - 14));
    state.joy.x = Math.cos(a) * m; state.joy.y = -Math.sin(a) * m;
  });
  const end = e => { if (e.pointerId === joyId) resetJoy(); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  const bind = (id, down, up) => {
    const b = document.getElementById(id); if (!b) return;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); if (state.enabled) down(); });
    const off = () => { b.classList.remove('down'); up?.(); };
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  };
  bind('btnJump', () => { state.jumpEdge = true; state.jumpHeld = true; }, () => { state.jumpHeld = false; });
  bind('btnDive', () => { state.diveEdge = true; });
}
