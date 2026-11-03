// 경기 화면 HUD: 위 문제 카드(보기는 색+모양), 정답 풀이 띠, 별 수, 라운드 카드, 카운트다운, 배너, 떠오르는 글자
import * as THREE from 'three';
import { camera } from '../engine/core.js';
import { ANSWER_STYLE } from '../data/game.js';

const $ = id => document.getElementById(id);
let el = null;
function E() {
  if (el) return el;
  el = { hud: $('hud'), round: $('hudRound'), stars: $('hudStars'), prog: $('hudProg'), q: $('hudQ'), qText: $('hudQText'), qCh: $('hudQChoices'), qBar: $('hudQBar'), qTime: $('hudQTime'),
    reveal: $('hudReveal'), count: $('hudCount'), banner: $('hudBanner'), toast: $('hudToast'), pops: $('hudPops'), card: $('roundCard'), hint: $('hudHint'), place: $('hudPlace'), ink: $('inkLayer') };
  return el;
}
let toastT = 0, bannerT = 0, revealT = 0, countT = 0, hintT = 0;
const v = new THREE.Vector3();

export const hud = {
  show(on) { E().hud.classList.toggle('on', on); if (!on) { this.hideQuestion(); E().reveal.classList.remove('on'); E().card.classList.remove('on'); E().ink.classList.remove('on'); } },
  setRound(info) { E().round.innerHTML = `<span>${info.icon}</span>${info.name}`; },
  setStars(n, bump) { const s = E().stars; s.querySelector('b').textContent = n; if (bump) { s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); } },
  progress(text) { E().prog.textContent = text || ''; E().prog.style.display = text ? '' : 'none'; },
  place(text) { E().place.textContent = text || ''; E().place.style.display = text ? '' : 'none'; },
  // 문제 카드
  question(q, { label = '' } = {}) {
    const e = E();
    e.qText.textContent = q.q;
    e.q.dataset.n = q.c.length;
    e.qCh.innerHTML = q.c.map((c, i) => `<div class="qc c${i}" data-i="${i}"><i>${ANSWER_STYLE[i].shape}</i><span>${esc(c)}</span></div>`).join('');
    e.q.querySelector('.qlabel').textContent = label || (q.again ? '다시 나온 문제' : '문제');
    e.q.classList.toggle('again', !!q.again);
    e.q.classList.remove('on'); void e.q.offsetWidth; e.q.classList.add('on');
    this.timer(null);
    e.reveal.classList.remove('on');
  },
  hideQuestion() { E().q.classList.remove('on'); },
  timer(frac, secs) {
    const e = E();
    if (frac == null) { e.qBar.parentElement.style.visibility = 'hidden'; e.qTime.textContent = ''; return; }
    e.qBar.parentElement.style.visibility = 'visible';
    e.qBar.style.transform = `scaleX(${Math.max(0, frac)})`;
    e.qBar.classList.toggle('hurry', frac < 0.3);
    e.qTime.textContent = secs != null ? Math.ceil(secs) : '';
  },
  // 내가 고른 것 표시
  mark(i, ok) { const c = E().qCh.querySelector(`[data-i="${i}"]`); if (c) c.classList.add(ok ? 'ok' : 'no'); },
  // 정답 공개 + 풀이 띠
  reveal(q, ok, dur = 2.6) {
    const e = E();
    e.qCh.querySelectorAll('.qc').forEach(c => c.classList.toggle('answer', +c.dataset.i === q.a));
    e.reveal.className = 'reveal on ' + (ok === true ? 'good' : ok === false ? 'bad' : '');
    const head = ok === true ? '정답!' : ok === false ? '아쉬워요!' : '정답은';
    e.reveal.innerHTML = `<b>${head}</b> <span class="ans c${q.a}"><i>${ANSWER_STYLE[q.a].shape}</i>${esc(q.c[q.a])}</span>${q.e ? `<em>${esc(q.e)}</em>` : ''}`;
    revealT = dur;
  },
  hideReveal() { E().reveal.classList.remove('on'); revealT = 0; },
  // 라운드 소개 카드
  roundCard(info, dur) {
    const e = E();
    if (!info) { e.card.classList.remove('on'); return; }
    e.card.innerHTML = `<div class="rc-in"><div class="rc-icon">${info.icon}</div><div class="rc-num">${info.num || ''}</div><h2>${info.name}</h2><p>${info.rule}</p><small>${info.how}</small></div>`;
    e.card.classList.remove('on'); void e.card.offsetWidth; e.card.classList.add('on');
  },
  count(text, cls = '') { const e = E().count; e.textContent = text; e.className = 'count on ' + cls; void e.offsetWidth; countT = cls === 'go' ? 0.9 : 0.8; },
  banner(text, cls = '', dur = 1.8) { const e = E().banner; e.innerHTML = text; e.className = 'banner on ' + cls; bannerT = dur; },
  toast(text, dur = 1.6) { const e = E().toast; e.textContent = text; e.classList.add('on'); toastT = dur; },
  hint(text, dur = 4) { const e = E().hint; e.innerHTML = text; e.classList.add('on'); hintT = dur; },
  ink(on) { E().ink.classList.toggle('on', on); },
  // 머리 위로 떠오르는 글자
  popAt(b, text, cls = '') {
    v.set(b.x, b.y + 1.9, b.z).project(camera);
    if (v.z > 1) return;
    const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
    d.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; d.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    E().pops.appendChild(d); setTimeout(() => d.remove(), 1200);
  },
  update(dt) {
    const e = E();
    if (toastT > 0 && (toastT -= dt) <= 0) e.toast.classList.remove('on');
    if (bannerT > 0 && (bannerT -= dt) <= 0) e.banner.classList.remove('on');
    if (revealT > 0 && (revealT -= dt) <= 0) e.reveal.classList.remove('on');
    if (countT > 0 && (countT -= dt) <= 0) e.count.classList.remove('on');
    if (hintT > 0 && (hintT -= dt) <= 0) e.hint.classList.remove('on');
  },
};
export function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
