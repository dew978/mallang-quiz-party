// 문제 출제: 고른 학년·학기·과목 문제은행에서 겹치지 않게 뽑는다. 수학은 단원 문제 생성기를 주로 쓴다.
import { save, persist } from './save.js';

let bankMod = null, extras = [], mathGen = null;
let pool = [], key = '';
const norm = t => String(t || '').replace(/\s/g, '');
const EXTRA_FILES = [['questions_extra_a.js', 'EXTRA_A'], ['questions_extra_b.js', 'EXTRA_B'], ['questions_extra_c.js', 'EXTRA_C'],
  ['questions_extra_d.js', 'EXTRA_D'], ['questions_extra_e.js', 'EXTRA_E'], ['questions_extra_f.js', 'EXTRA_F']];

export async function loadQuestions() {
  try { bankMod = await import('./data/questions.js'); } catch (e) { console.warn('문제은행 로드 실패', e); bankMod = null; }
  await Promise.all(EXTRA_FILES.map(async ([file, name]) => {
    try { const m = await import('./data/' + file); if (m[name]) extras.push(m[name]); } catch (e) { /* 없으면 있는 은행만 */ }
  }));
  try { const m = await import('./data/mathgen.js'); mathGen = m.generateMath; } catch (e) { /* 없으면 은행 문제만 */ }
}
export function subjectsFor(grade) {
  return bankMod?.SUBJECTS_BY_GRADE?.[grade] || (grade <= 2 ? ['국어', '수학', '통합'] : ['국어', '수학', '사회', '과학', '영어']);
}
export const subjectKey = () => `${save.grade}-${save.semester}-${save.subject}`;

function currentList() {
  const base = bankMod?.getQuestions?.(save.grade, save.semester, save.subject) || [];
  const more = extras.flatMap(x => x?.[String(save.grade)]?.[String(save.semester)]?.[save.subject] || []);
  const seen = new Set(), out = [];
  for (const q of [...base, ...more]) {
    const n = norm(q.q);
    if (!q || !Array.isArray(q.c) || q.c.length < 2 || seen.has(n)) continue;
    seen.add(n); out.push(q);
  }
  return out;
}
export function bankSize() { return currentList().length; }

// 최근에 낸 문제 기록: 은행을 거의 다 돌 때까지 같은 문제를 내지 않는다 (다시 켜도 이어짐)
function history() { save.qHist ||= {}; return (save.qHist[key] ||= []); }
function remember(q, size) {
  const h = history(); h.push(norm(q.q));
  const cap = Math.max(12, size - 3); while (h.length > cap) h.shift();
  persist();
}

// maxChoices: 3D 보기 칸 수 제한 (풍선은 4개까지)
export function nextQuestion(avoid = new Set()) {
  const k = subjectKey();
  if (k !== key) { key = k; pool = []; }
  const h = history(), recent = new Set(h);
  for (const a of avoid) recent.add(a);
  // 틀렸던 문제는 가끔 다시 (최근 12문제 안에 나온 건 제외)
  const last = new Set(h.slice(-12));
  const notes = notesFor().filter(n => !last.has(norm(n.q)) && !avoid.has(norm(n.q)));
  if (notes.length && Math.random() < 0.18) { const n = notes[Math.floor(Math.random() * notes.length)]; remember(n, 999); return shuffle({ q: n.q, c: n.c, a: n.a, e: n.e, again: true }); }
  if (save.subject === '수학' && mathGen && Math.random() < 0.8) {
    for (let t = 0; t < 10; t++) {
      try {
        const g = mathGen(save.grade, save.semester);
        if (g?.c?.length >= 3 && g.c.length <= 4 && g.a >= 0 && !recent.has(norm(g.q))) { remember(g, 200); return shuffle(g); }
      } catch (e) { break; }
    }
  }
  const list = currentList();
  if (!pool.length) {
    pool = list.filter(q => !recent.has(norm(q.q)));
    if (!pool.length && list.length) { h.length = 0; pool = list.filter(q => !avoid.has(norm(q.q))); if (!pool.length) pool = list.slice(); }
  }
  if (!pool.length) return genMath(save.grade);
  const q = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  remember(q, list.length);
  return shuffle(q);
}
// 한 라운드에 쓸 문제 n개 (서로 겹치지 않게)
export function questionSet(n) {
  const out = [], avoid = new Set();
  for (let i = 0; i < n; i++) { const q = nextQuestion(avoid); avoid.add(norm(q.q)); out.push(q); }
  return out;
}

function shuffle(q) {
  let c = q.c.slice(0, 4), a = q.a;
  if (a >= c.length) { c[c.length - 1] = q.c[a]; a = c.length - 1; }
  const order = c.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { q: q.q, c: order.map(i => c[i]), a: order.indexOf(a), e: q.e || '', again: !!q.again };
}

function genMath(grade) {
  const r = n => Math.floor(Math.random() * n);
  let q, ans;
  if (grade <= 2) { const a = 2 + r(40), b = 1 + r(30); q = `${a} + ${b} = ?`; ans = a + b; }
  else if (grade <= 4) { const a = 3 + r(9), b = 2 + r(9); q = `${a} × ${b} = ?`; ans = a * b; }
  else { const a = 2 + r(20), b = 2 + r(9), c = 1 + r(9); q = `${a} + ${b} × ${c} = ?`; ans = a + b * c; }
  const set = new Set([ans]);
  while (set.size < 3) set.add(ans + (r(2) ? 1 : -1) * (1 + r(6)));
  const c = [...set].sort(() => Math.random() - 0.5).map(String);
  return { q, c, a: c.indexOf(String(ans)), e: `정답은 ${ans}이에요` };
}

// 제한 시간: 학년 기본 + 글 길이 (설정에서 넉넉하게/빠르게)
export function answerTime(q, grade = save.grade) {
  const base = grade <= 2 ? 12 : grade <= 4 ? 10 : 8.5;
  const len = (q.q.length + q.c.join('').length) * 0.055;
  const mul = { relaxed: 1.3, normal: 1, fast: 0.8 }[save.settings.timer] || 1;
  return Math.round((base + len) * mul * 2) / 2;
}

// ---- 오답 노트 · 공부 기록 ----
export function recordAnswer(q, ok) {
  if (!q) return;
  const k = subjectKey();
  save.record ||= {}; save.notes ||= [];
  const rec = (save.record[k] ||= { c: 0, w: 0 });
  ok ? rec.c++ : rec.w++;
  ok ? save.stats.correct++ : save.stats.wrong++;
  const i = save.notes.findIndex(n => n.q === q.q);
  if (!ok) {
    if (i >= 0) { save.notes[i].wrong++; save.notes[i].streak = 0; save.notes[i].at = Date.now(); }
    else save.notes.unshift({ key: k, q: q.q, c: q.c, a: q.a, e: q.e || '', wrong: 1, streak: 0, at: Date.now() });
    if (save.notes.length > 300) save.notes.length = 300;
  } else if (i >= 0) {
    if (++save.notes[i].streak >= 2) save.notes.splice(i, 1);   // 두 번 연속 맞히면 졸업
  }
  persist();
}
export function notesFor(k = subjectKey()) { return (save.notes || []).filter(n => n.key === k); }
