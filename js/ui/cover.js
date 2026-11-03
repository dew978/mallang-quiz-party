// 커버플로우: 가운데 카드가 크게, 양옆은 비스듬히. 화살표·스와이프·휠·키보드로 넘긴다.
import { audio } from '../audio.js';
import { esc } from '../game/hud.js';

export function cover(box, items, start, onChange, onPick) {
  box.innerHTML = '';
  let idx = Math.max(0, Math.min(items.length - 1, start));
  const cards = items.map((it, i) => {
    const c = document.createElement('div'); c.className = 'cv-card' + (it.lock ? ' lock' : '');
    const media = it.img ? `<img src="${it.img}" class="${it.img.startsWith('data:') ? 'fit' : ''}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${it.emoji || '🎈'}'}))">` : `<span>${it.emoji || '🎈'}</span>`;
    c.innerHTML = `<div class="cv-img">${media}</div><div class="cv-name">${esc(it.title)}</div><div class="cv-sub">${esc(it.sub || '')}</div>${it.lock ? '<div class="cv-lock">🔒 잠김</div>' : ''}${it.tag ? `<div class="cv-tag">${esc(it.tag)}</div>` : ''}`;
    c.onclick = () => { if (i === idx) { onPick?.(i); } else set(i); };
    box.appendChild(c); return c;
  });
  const mk = (cls, d) => { const b = document.createElement('button'); b.className = 'cv-arrow ' + cls; b.onclick = e => { e.stopPropagation(); audio.play('click'); set(idx + d); }; box.appendChild(b); return b; };
  const L = mk('l', -1), R = mk('r', 1);
  function layout() {
    cards.forEach((c, i) => {
      const d = i - idx, a = Math.abs(d);
      const x = d * Math.min(250, innerWidth * 0.2), z = -a * 170, ry = -Math.sign(d) * Math.min(42, a * 32);
      c.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${d === 0 ? 1.06 : 0.9})`;
      c.style.zIndex = 20 - a; c.style.opacity = a > 2 ? 0 : 1 - a * 0.18; c.style.filter = d === 0 ? 'none' : 'brightness(.92)';
      c.style.pointerEvents = a > 2 ? 'none' : 'auto';
    });
    L.style.visibility = idx > 0 ? 'visible' : 'hidden'; R.style.visibility = idx < cards.length - 1 ? 'visible' : 'hidden';
  }
  function set(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    if (i === idx) return;
    idx = i; layout(); audio.play('whoosh', { vol: 0.25, rate: 1.4 }); onChange?.(idx);
  }
  // 스와이프
  let sx = null;
  box.onpointerdown = e => { sx = e.clientX; };
  box.onpointerup = e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) set(idx + (dx < 0 ? 1 : -1)); };
  box.onwheel = e => { e.preventDefault(); if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 20) set(idx + ((e.deltaY + e.deltaX) > 0 ? 1 : -1)); };
  const key = e => {
    if (!box.offsetParent) { removeEventListener('keydown', key); return; }
    if (e.code === 'ArrowLeft') set(idx - 1); else if (e.code === 'ArrowRight') set(idx + 1); else if (e.code === 'Enter') onPick?.(idx);
  };
  if (box._key) removeEventListener('keydown', box._key);
  box._key = key; addEventListener('keydown', key);
  layout();
  return { set, get: () => idx };
}
