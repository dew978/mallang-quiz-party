// 3D 보기 글자판: 캔버스에 글자를 그려 텍스처로 쓴다. 글이 길면 두 줄로 나누고 크기를 줄여 칸 안에 맞춘다.
import * as THREE from 'three';

function fitLines(x, text, maxW, maxLines, size, font) {
  for (let s = size; s >= 18; s -= 2) {
    x.font = `${s}px ${font}`;
    if (x.measureText(text).width <= maxW) return { lines: [text], size: s };
    if (maxLines > 1) {
      // 띄어쓰기에서 나누고, 없으면 가운데에서
      const words = text.split(' ');
      let best = null;
      if (words.length > 1) {
        for (let i = 1; i < words.length; i++) {
          const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
          const w = Math.max(x.measureText(a).width, x.measureText(b).width);
          if (!best || w < best.w) best = { lines: [a, b], w };
        }
      } else {
        const m = Math.ceil(text.length / 2); const a = text.slice(0, m), b = text.slice(m);
        best = { lines: [a, b], w: Math.max(x.measureText(a).width, x.measureText(b).width) };
      }
      if (best && best.w <= maxW && s * 2.1 <= 9999) return { lines: best.lines, size: s };
    }
  }
  x.font = `18px ${font}`;
  return { lines: [text], size: 18 };
}

// 판 텍스처: bg 배경색(없으면 투명), shape 모양 표시, 테두리
export function labelTexture(text, { w = 512, h = 256, bg = null, fg = '#ffffff', stroke = 'rgba(40,20,60,0.85)', shape = '', shapeColor = '#fff', font = 'Jua, sans-serif', size = 120, radius = 40, border = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (bg) {
    x.fillStyle = bg; rr(x, 6, 6, w - 12, h - 12, radius); x.fill();
    if (border) { x.lineWidth = 10; x.strokeStyle = border; rr(x, 11, 11, w - 22, h - 22, radius - 4); x.stroke(); }
  }
  let left = 0;
  if (shape) {
    x.font = `${Math.round(h * 0.34)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = shapeColor; x.fillText(shape, h * 0.3, h * 0.5);
    left = h * 0.5;
  }
  const maxW = w - left - 36;
  const { lines, size: s } = fitLines(x, String(text), maxW, 2, Math.min(size, h * (lines2(text) ? 0.38 : 0.55)), font);
  x.font = `${s}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineJoin = 'round'; x.lineWidth = Math.max(6, s * 0.16); x.strokeStyle = stroke; x.fillStyle = fg;
  const cx = left + (w - left) / 2, lh = s * 1.08, y0 = h / 2 - (lines.length - 1) * lh / 2 + s * 0.04;
  lines.forEach((ln, i) => { if (stroke) x.strokeText(ln, cx, y0 + i * lh); x.fillText(ln, cx, y0 + i * lh); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const lines2 = t => String(t).length > 6;
function rr(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }

export function labelPlane(text, width, height, opts = {}) {
  const tex = labelTexture(text, { w: 512, h: Math.round(512 * height / width), ...opts });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: opts.double ? THREE.DoubleSide : THREE.FrontSide }));
  m.renderOrder = 3;
  return m;
}
export function labelSprite(text, width, height, opts = {}) {
  const tex = labelTexture(text, { w: 512, h: Math.round(512 * height / width), ...opts });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(width, height, 1); s.renderOrder = 4;
  return s;
}
export function disposeLabel(o) { o.material?.map?.dispose(); o.material?.dispose(); o.geometry?.dispose?.(); }
