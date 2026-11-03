// 초대 링크 QR 코드 (SVG 문자열). vendor/qrcode.js는 필요할 때만 불러온다
let loaded = null;
export async function qrSvg(text) {
  if (!window.qrcode) await (loaded ??= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}
