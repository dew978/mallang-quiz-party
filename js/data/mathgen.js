// mathgen.js — 초등 수학 문제 절차적 생성기 (2022 개정 교육과정, 1~6학년 1·2학기)
// generateMath(grade, semester[, unitName]) → { q, c, a, e }
//   q: 문제(≤ ~40자), c: 보기 3~4개(각 ≤ 8자, 서로 다름), a: 정답 인덱스, e: 한 줄 풀이

// ───────────────────────── 기본 도구 ─────────────────────────
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => (a / gcd(a, b)) * b;
const sample = (arr, n) => shuffle(arr.slice()).slice(0, n);
const PRE = ['', '', '', '삼', '사', '오', '육', '칠', '팔', '구', '십']; // n각형 접두

// ── 조사: 숫자 읽기의 마지막 음절 받침 여부(분수는 분자, 소수는 마지막 자리) ──
const BAT = [0, 1, 3, 6, 7, 8];
function lastDigitOf(s) {
  s = String(s);
  const m = s.includes('/') ? s.match(/(\d+)\/\d+\s*$/) : s.match(/(\d)\D*$/);
  return m ? +m[1] % 10 : 0;
}
/** 받침 여부: 한글 음절이면 종성, 숫자면 읽기 기준 */
function hasBat(s) {
  s = String(s).trim();
  const ch = s.charCodeAt(s.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) return (ch - 0xac00) % 28 !== 0;
  return BAT.includes(lastDigitOf(s));
}
const jo = (s, A, B) => `${s}${hasBat(s) ? A : B}`;
const wa = (s) => jo(s, '과', '와');
const eul = (s) => jo(s, '을', '를');
const eun = (s) => jo(s, '은', '는');
const iga = (s) => jo(s, '이', '가');
const ro = (s) => `${s}${[0, 3, 6].includes(lastDigitOf(s)) ? '으로' : '로'}`;

// ── 분수 / 소수 서식 ──
function red(n, d) { const g = gcd(n, d) || 1; return [n / g, d / g]; }
/** n/d 를 문자열로. reduce=약분, mixed=대분수 표기("1과 2/3") */
function fs(n, d, { reduce = true, mixed = true } = {}) {
  if (d < 0) { n = -n; d = -d; }
  if (reduce) [n, d] = red(n, d);
  if (n % d === 0) return String(n / d);
  if (mixed && n > d) { const w = Math.floor(n / d); return `${wa(w)} ${n % d}/${d}`; }
  return `${n}/${d}`;
}
const fs4 = (n, d) => fs(n, d, { reduce: false }); // 약분하지 않는 학년용
const mixS = (w, a, b) => (w ? `${wa(w)} ${a}/${b}` : `${a}/${b}`);
/** 정수 v 를 소수점 p 자리 수로 (v=275,p=2 → "2.75") */
function fd(v, p) {
  const neg = v < 0; v = Math.abs(Math.round(v));
  if (!p) return (neg ? '-' : '') + v;
  const s = String(v).padStart(p + 1, '0');
  let r = s.slice(0, -p) + '.' + s.slice(-p);
  r = r.replace(/0+$/, '').replace(/\.$/, '');
  return (neg ? '-' : '') + r;
}
/** 큰 수 한글 단위 표기 (350000000 → "3억 5000만") */
function kor(n) {
  const U = [['조', 1e12], ['억', 1e8], ['만', 1e4]];
  const p = [];
  for (const [u, v] of U) { const k = Math.floor(n / v); n -= k * v; if (k) p.push(k + u); }
  if (n) p.push(String(n));
  return p.join(' ') || '0';
}
// 받아올림/받아내림 실수
// 받아올림을 잊은 덧셈(맨 앞자리는 그대로 씀): 64+47 → 101
function addNC(a, b) { let r = 0, p = 1; while (a >= 10 || b >= 10) { r += ((a % 10 + b % 10) % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; } return r + (a + b) * p; }
function subNB(a, b) { let r = 0, p = 1; while (a > 0 || b > 0) { r += Math.abs(a % 10 - b % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; } return r; }
function subNoDec(a, b) { let r = 0, p = 1; while (a > 0 || b > 0) { r += ((a % 10 - b % 10 + 10) % 10) * p; a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10; } return r; }
function mulNC(a, b) { let r = 0, p = 1; while (a > 0) { r += ((a % 10) * b % 10) * p; a = Math.floor(a / 10); p *= 10; } return r; }
function mulCat(a, b) { return Number(String(a).split('').map((d) => +d * b).join('')); }

// ── 보기 값 비교 키 (같은 값 다른 표기 → 같은 키) ──
function rk(n, d) { const [x, y] = red(n, d); return `${x}/${y}`; }
function vkey(s) {
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d+)[과와] (\d+)\/(\d+)$/))) return 'n|' + rk(+m[1] * +m[3] + +m[2], +m[3]);
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return 'n|' + rk(+m[1], +m[2]);
  if ((m = s.match(/^(\d+)(?:\.(\d+))?([^\d\s./:]*)$/))) {
    const dec = m[2] || '';
    return (m[3] || 'n') + '|' + rk(+(m[1] + dec), 10 ** dec.length);
  }
  return 's|' + s.replace(/\s+/g, '');
}
// 정답 문자열의 숫자 하나를 살짝 바꾼 오답 (보충용)
function perturb(ans) {
  const s = String(ans);
  const toks = [...s.matchAll(/\d+(?:\.\d+)?/g)];
  if (!toks.length) return null;
  const t = pick(toks), str = t[0];
  let rep;
  if (str.includes('.')) {
    const p = str.split('.')[1].length, v = Math.round(parseFloat(str) * 10 ** p);
    const nv = v + pick([-2, -1, 1, 2, 10, -10]);
    if (nv <= 0) return null;
    rep = fd(nv, p);
  } else {
    const v = +str, nv = v + pick(v >= 20 ? [-10, -2, -1, 1, 2, 10] : [-2, -1, 1, 2]);
    if (nv <= 0) return null;
    rep = String(nv);
  }
  const out = s.slice(0, t.index) + rep + s.slice(t.index + str.length);
  return out.replace(/(\d+)[과와] /g, (_, w) => `${wa(w)} `);
}
const BAD = /NaN|undefined|Infinity|null/;
/**
 * 문제 객체 생성. ds=오답 후보(그럴듯한 실수). nofill=true 이면 숫자 변형 보충을 하지 않음
 * (정답이 '보기 집합'에 의존하는 문제: 가장 큰 수, 짝수 고르기 등)
 */
function mk(q, ans, ds, e, nofill = false) {
  ans = String(ans);
  if (!ans || ans.length > 8 || ans.startsWith('-') || BAD.test(ans)) throw new Error('bad answer');
  const seen = new Set([vkey(ans)]);
  const out = [];
  const add = (d) => {
    if (d === null || d === undefined) return;
    d = String(d);
    if (!d || d.length > 8 || d.startsWith('-') || BAD.test(d)) return;
    const k = vkey(d);
    if (seen.has(k)) return;
    seen.add(k); out.push(d);
  };
  shuffle(ds.slice()).forEach(add);
  if (!nofill) for (let i = 0; i < 40 && out.length < 3; i++) add(perturb(ans));
  const chosen = out.slice(0, Math.random() < 0.5 ? 2 : 3);
  if (chosen.length < 2) throw new Error('not enough choices');
  const c = shuffle([ans, ...chosen]);
  return { q, c, a: c.indexOf(ans), e };
}
/** 사실형(텍스트) 문제: pool 에서 정답 제외 오답 */
const mkT = (q, ans, pool, e) => mk(q, ans, pool.filter((x) => x !== ans), e, true);
const near = (n, arr = [1, -1, 2, -2]) => arr.map((d) => n + d);

// ───────────────────────── 1학년 ─────────────────────────
const U = {};
U['1-1'] = [
  ['9까지의 수', () => {
    const t = ri(0, 3);
    if (t === 0) { const n = ri(1, 8); return mk(`${n}보다 1 큰 수는?`, n + 1, [n, n + 2, n - 1], `${n} 바로 뒤의 수는 ${n + 1}`); }
    if (t === 1) { const n = ri(2, 9); return mk(`${n}보다 1 작은 수는?`, n - 1, [n, n + 1, n - 2], `${n} 바로 앞의 수는 ${n - 1}`); }
    if (t === 2) { const a = ri(1, 7); return mk(`${wa(a)} ${a + 2} 사이의 수는?`, a + 1, [a, a + 2, a + 3], `${a}, ${a + 1}, ${a + 2} 순서`); }
    const O = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째'];
    const i = ri(1, 6);
    return mk(`순서에서 ${O[i]} 바로 다음은?`, O[i + 1], [O[i], O[i + 2], O[i - 1]], `${O[i]} 다음은 ${O[i + 1]}`, true);
  }],
  ['여러 가지 모양', () => {
    const C = ['상자 모양', '둥근기둥 모양', '공 모양'];
    const items = [['축구공은', 2], ['구슬은', 2], ['농구공은', 2], ['주사위는', 0], ['휴지 상자는', 0], ['냉장고는', 0],
      ['음료수 캔은', 1], ['딱풀은', 1], ['두루마리 휴지는', 1],
      ['어느 쪽으로도 잘 굴러가는 것은', 2], ['평평한 면만 있는 것은', 0], ['눕히면 굴러가고 쌓을 수도 있는 것은', 1],
      ['둥근 부분이 없는 것은', 0], ['평평한 면이 없는 것은', 2]];
    const [s, k] = pick(items);
    const why = ['평평한 면만 있어요', '평평한 면과 둥근 면이 있어요', '전체가 둥글어요'][k];
    return mkT(`${s} 어떤 모양?`, C[k], [...C, '세모 모양'], `${C[k]}: ${why}`);
  }],
  ['덧셈과 뺄셈', () => {
    const t = ri(0, 3);
    if (t === 0) { const a = ri(1, 8), b = ri(1, 9 - a); return mk(`${a} + ${b} = ?`, a + b, [a + b + 1, a + b - 1, Math.abs(a - b)], `${wa(a)} ${b}를 모으면 ${a + b}`.replace(/(\d)를/, (m, d) => eul(d))); }
    if (t === 1) { const a = ri(2, 9), b = ri(1, a); return mk(`${a} - ${b} = ?`, a - b, [a - b + 1, a - b - 1, a + b], `${a}에서 ${b}만큼 덜어내면 ${a - b}`); }
    if (t === 2) { const a = ri(2, 9), b = ri(1, a - 1); return mk(`${a}는 ${b}와 □로 가를 수 있어요. □는?`.replace(`${a}는`, eun(a)).replace(`${b}와`, wa(b)), a - b, [a - b + 1, a - b - 1, a], `${b} + ${a - b} = ${a}`); }
    const a = ri(1, 8), b = ri(1, 9 - a);
    return mk(`${wa(a)} ${eul(b)} 모으면?`, a + b, [a + b + 1, a + b - 1, a * 10 + b], `${a} + ${b} = ${a + b}`);
  }],
  ['비교하기', () => {
    const t = ri(0, 2);
    if (t === 0) {
      const ns = sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4), big = Math.random() < 0.5;
      const ans = big ? Math.max(...ns) : Math.min(...ns);
      return mk(`${ns.join(', ')} 중 가장 ${big ? '큰' : '작은'} 수는?`, ans, ns.filter((x) => x !== ans), `가장 ${big ? '큰' : '작은'} 수는 ${ans}`, true);
    }
    const W = t === 1
      ? { key: ['무거운', '가벼운'], L: ['깃털', '연필', '사과', '수박', '자전거', '자동차', '코끼리'] }
      : { key: ['긴', '짧은'], L: ['개미', '지우개', '연필', '우산', '자전거', '버스', '기차'] };
    const idx = sample([0, 1, 2, 3, 4, 5, 6], 4).sort((x, y) => x - y);
    const items = idx.map((i) => W.L[i]), hi = Math.random() < 0.5;
    const ans = hi ? items[3] : items[0];
    return mk(`가장 ${hi ? W.key[0] : W.key[1]} 것은?`, ans, items.filter((x) => x !== ans), `${iga(ans)} 가장 ${hi ? W.key[0] : W.key[1]} 것`, true);
  }],
  ['50까지의 수', () => {
    const t = ri(0, 2);
    if (t === 0) { const a = ri(1, 4), b = ri(1, 9); return mk(`10개씩 묶음 ${a}개와 낱개 ${b}개는?`, 10 * a + b, [10 * b + a, a + b, 10 * a + b + 10, 10 * a + b + 1], `10이 ${a}개, 1이 ${b}개 → ${10 * a + b}`); }
    if (t === 1) { const n = ri(10, 48); return mk(`${n} 바로 다음 수는?`, n + 1, [n - 1, n + 2, n + 10], `${n} 다음은 ${n + 1}`); }
    const n = ri(11, 49); return mk(`${n} 바로 앞의 수는?`, n - 1, [n + 1, n - 2, n - 10], `${n} 앞은 ${n - 1}`);
  }],
];
U['1-2'] = [
  ['100까지의 수', () => {
    const t = ri(0, 3);
    if (t === 0) { const a = ri(5, 9), b = ri(0, 9); return mk(`10개씩 묶음 ${a}개와 낱개 ${b}개는?`, 10 * a + b, [10 * b + a, a + b, 10 * a + b + 10, 10 * a + b + 1], `10이 ${a}개, 1이 ${b}개 → ${10 * a + b}`); }
    if (t === 1) { const n = ri(50, 98); return mk(`${n}보다 1 큰 수는?`, n + 1, [n - 1, n + 10, n + 2], `${n} 다음은 ${n + 1}`); }
    const even = t === 2, base = 2 * ri(5, 45) + (even ? 0 : 1);
    const ds = [base - 1, base + 1, base + 3, base - 3];
    return mk(`다음 중 ${even ? '짝수' : '홀수'}는?`, base, ds, `${base}: 일의 자리 ${base % 10} → ${even ? '짝수' : '홀수'}`, true);
  }],
  ['덧셈과 뺄셈(받아올림 없음)', () => {
    if (Math.random() < 0.5) {
      const a1 = ri(1, 8), a0 = ri(0, 8), b1 = ri(0, 9 - a1 - 0 > 0 ? 9 - a1 : 0), b0 = ri(1, 9 - a0);
      const a = a1 * 10 + a0, b = b1 * 10 + b0, s = a + b;
      return mk(`${a} + ${b} = ?`, s, [s + 10, s - 10, s + 1, s - 1], `일의 자리 ${a0 + b0}, 십의 자리 ${a1 + b1}`);
    }
    const a1 = ri(2, 9), a0 = ri(1, 9), b1 = ri(1, a1 - 1), b0 = ri(0, a0);
    const a = a1 * 10 + a0, b = b1 * 10 + b0, d = a - b;
    return mk(`${a} - ${b} = ?`, d, [d + 10, d - 10, d + 1, a + b], `일의 자리 ${a0 - b0}, 십의 자리 ${a1 - b1}`);
  }],
  ['여러 가지 모양(평면)', () => {
    const C = ['□ 모양', '△ 모양', '○ 모양'];
    const F = [['뾰족한 곳이 3군데인 모양은?', 1], ['뾰족한 곳이 4군데인 모양은?', 0], ['뾰족한 곳이 없는 모양은?', 2],
      ['곧은 선이 없는 모양은?', 2], ['곧은 선이 3개인 모양은?', 1], ['곧은 선이 4개인 모양은?', 0],
      ['동전을 본뜨면 어떤 모양?', 2], ['공책을 본뜨면 어떤 모양?', 0], ['삼각자를 본뜨면 어떤 모양?', 1]];
    const [q, k] = pick(F);
    return mkT(q, C[k], [...C, '공 모양'], `${C[k]}: 뾰족한 곳 ${[4, 3, 0][k]}군데`);
  }],
  ['덧셈과 뺄셈(세 수, 10 만들기)', () => {
    const t = ri(0, 3);
    if (t === 0) { const a = ri(1, 6), b = ri(1, 6), c = ri(1, 6), s = a + b + c; return mk(`${a} + ${b} + ${c} = ?`, s, [s + 1, s - 1, a + b, s + 2], `${a}+${b}=${a + b}, ${a + b}+${c}=${s}`); }
    if (t === 1) { const a = ri(1, 9); return mk(`${a} + □ = 10, □는?`, 10 - a, [11 - a, 9 - a, a], `${a}와(과) ${10 - a}를 더하면 10`); }
    if (t === 2) { const a = ri(1, 9); return mk(`10 - ${a} = ?`, 10 - a, [11 - a, 9 - a, 10 + a], `10에서 ${a}를 빼면 ${10 - a}`.replace(/(\d)를/, (m, d) => eul(d))); }
    const a = ri(4, 9), b = ri(1, 9 - a + 4 > 9 ? 3 : 4), c = ri(1, a + b - 1), r = a + b - c;
    return mk(`${a} + ${b} - ${c} = ?`, r, [r + 1, r - 1, a + b + c, a - b + c].filter((x) => x !== r), `${a}+${b}=${a + b}, ${a + b}-${c}=${r}`);
  }],
  ['시계 보기', () => {
    const h = ri(1, 12), nx = h === 12 ? 1 : h + 1;
    if (Math.random() < 0.5) {
      return mk(`짧은바늘 ${h}, 긴바늘 12를 가리키면?`, `${h}시`, [`${nx}시`, h === 12 ? '1시 30분' : '12시', `${h}시 30분`, `${h === 1 ? 12 : h - 1}시`], `긴바늘 12 → 정각, ${h}시`, true);
    }
    return mk(`짧은바늘 ${wa(h)} ${nx} 사이, 긴바늘 6이면?`, `${h}시 30분`, [`${nx}시 30분`, `${h}시 6분`, `${h}시`, `${h}시 15분`], `긴바늘 6 → 30분, ${h}시 30분`, true);
  }],
  ['규칙 찾기', () => {
    if (Math.random() < 0.5) {
      const d = pick([1, 2, 3, 5, 10]), up = Math.random() < 0.7;
      const s = up ? ri(1, 40) : ri(5 * d + 1, 99), seq = [0, 1, 2, 3].map((i) => s + (up ? i : -i) * d);
      const ans = s + (up ? 4 : -4) * d;
      if (ans <= 0 || ans > 100) throw 0;
      return mk(`${seq.join(', ')}, □`, ans, [ans + (up ? d : -d), ans + 1, ans - 1, seq[3]], `${d}씩 ${up ? '커지는' : '작아지는'} 규칙`);
    }
    const S = ['●', '▲', '■', '★'], L = ri(2, 3), unit = sample(S, L), n = ri(5, 7);
    const seq = Array.from({ length: n }, (_, i) => unit[i % L]).join('');
    const ans = unit[n % L];
    return mk(`${seq} 다음 모양은?`, ans, S.filter((x) => x !== ans), `${unit.join('')} 모양이 반복돼요`, true);
  }],
  ['덧셈과 뺄셈(받아올림)', () => {
    if (Math.random() < 0.5) { const a = ri(2, 9), b = ri(11 - a > 2 ? 11 - a : 2, 9), s = a + b; if (s < 11) throw 0; return mk(`${a} + ${b} = ?`, s, [s - 10, s - 1, s + 1, s + 10], `10을 만들고 남은 ${s - 10} → ${s}`); }
    const a = ri(11, 18), b = ri(a - 9, 9), d = a - b; if (b <= a % 10) throw 0;
    return mk(`${a} - ${b} = ?`, d, [d + 1, d - 1, 10 + Math.abs(a % 10 - b), d + 10], `10에서 ${b}를 빼고 ${a % 10} 더하기 → ${d}`.replace(/(\d)를/, (m, x) => eul(x)));
  }],
];

// ───────────────────────── 2학년 ─────────────────────────
U['2-1'] = [
  ['세 자리 수', () => {
    const t = ri(0, 3);
    if (t === 0) { const h = ri(1, 9), te = ri(0, 9), o = ri(0, 9), n = h * 100 + te * 10 + o; return mk(`100이 ${h}, 10이 ${te}, 1이 ${o}개인 수는?`, n, [h * 100 + o * 10 + te, te * 100 + h * 10 + o, n + 10, n + 1, h + te + o], `백 ${h}, 십 ${te}, 일 ${o} → ${n}`); }
    if (t === 1) {
      const dg = sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 3), n = dg[0] * 100 + dg[1] * 10 + dg[2], p = ri(0, 2), d = dg[2 - p];
      const v = d * 10 ** p;
      return mk(`${n}에서 ${iga(d)} 나타내는 값은?`, v, [d, d * 10, d * 100].filter((x) => x !== v).concat([n]), `${eun(d)} ${['일', '십', '백'][p]}의 자리 → ${v}`);
    }
    if (t === 2) { const st = pick([1, 10, 100]), s = ri(101, 999 - 4 * st); const seq = [0, 1, 2].map((i) => s + i * st), ans = s + 3 * st; return mk(`${seq.join(', ')}, □`, ans, [s + 4 * st, ans + (st === 10 ? 100 : 10), ans + (st === 1 ? 10 : 1), seq[2]], `${st}씩 뛰어 세기`); }
    const h = ri(1, 9), ns = sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => x * 10 + ri(0, 9)), 4).map((x) => h * 100 + x), big = Math.random() < 0.5;
    if (new Set(ns).size < 4) throw 0;
    const ans = big ? Math.max(...ns) : Math.min(...ns);
    return mk(`${ns.join(', ')} 중 가장 ${big ? '큰' : '작은'} 수?`, ans, ns.filter((x) => x !== ans), `백의 자리가 같으면 십의 자리 비교`, true);
  }],
  ['여러 가지 도형', () => {
    const N = ['삼각형', '사각형', '오각형', '육각형', '원'];
    if (Math.random() < 0.5) {
      const F = [['변이 3개인 도형은?', 0], ['꼭짓점이 4개인 도형은?', 1], ['변이 5개인 도형은?', 2], ['꼭짓점이 6개인 도형은?', 3], ['곧은 선 없이 둥근 도형은?', 4], ['변이 4개인 도형은?', 1]];
      const [q, k] = pick(F);
      return mkT(q, N[k], N, k === 4 ? '원은 곧은 선과 꼭짓점이 없어요' : `${N[k]}: 변과 꼭짓점 ${k + 3}개`);
    }
    const k = ri(0, 3), n = k + 3, part = pick(['변', '꼭짓점']);
    return mk(`${N[k]}의 ${part}${part === '변' ? '은' : '은'} 몇 개?`, `${n}개`, [`${n + 1}개`, `${n - 1}개`, `${n * 2}개`], `${N[k]}은 ${part}이 ${n}개`);
  }],
  ['덧셈과 뺄셈', () => {
    if (Math.random() < 0.5) {
      const a = ri(15, 89); if (a % 10 === 0) throw 0;
      const b0 = ri(10 - (a % 10), 9), b = ri(1, 8) * 10 + b0;
      const s = a + b;
      return mk(`${a} + ${b} = ?`, s, [addNC(a, b), s - 10, s + 10, s + 1], `일의 자리 ${(a % 10) + b0} → 10을 받아올림`);
    }
    const a = ri(31, 99), b = ri(11, a - 10); if (a % 10 >= b % 10) throw 0;
    const d = a - b;
    return mk(`${a} - ${b} = ?`, d, [subNB(a, b), subNoDec(a, b), d + 10, d - 1], `십의 자리에서 10을 받아내림`);
  }],
  ['길이 재기', () => {
    const t = ri(0, 2);
    if (t === 0) { const n = ri(3, 20); return mk(`1cm로 ${n}번 잰 길이는?`, `${n}cm`, [`${n + 1}cm`, `${n - 1}cm`, `${n}m`, `${n * 10}cm`], `1cm가 ${n}번 → ${n}cm`); }
    if (t === 1) { const a = ri(1, 8), b = a + ri(2, 9); return mk(`자의 눈금 ${a}에서 ${b}까지의 길이는?`, `${b - a}cm`, [`${b}cm`, `${b - a + 1}cm`, `${b + a}cm`, `${b - a - 1}cm`], `${b} - ${a} = ${b - a}(cm)`); }
    const a = ri(3, 15), b = ri(3, 15);
    return mk(`${a}cm와 ${b}cm를 이으면 몇 cm?`, `${a + b}cm`, [`${a + b + 1}cm`, `${a + b - 1}cm`, `${Math.abs(a - b)}cm`, `${a + b + 10}cm`], `${a} + ${b} = ${a + b}(cm)`);
  }],
  ['분류하기', () => {
    if (Math.random() < 0.4) {
      return mk('분류 기준으로 알맞은 것은?', pick(['색깔', '모양', '크기', '다리 수', '바퀴 수']), ['예쁜 것', '좋아하는 것', '멋진 것', '귀여운 것', '재미있는 것'], '누가 분류해도 같은 결과여야 해요', true);
    }
    const col = sample(['빨강', '파랑', '노랑', '초록'], 3), cnt = sample([2, 3, 4, 5, 6, 7, 8], 3), most = Math.random() < 0.5;
    const tgt = most ? Math.max(...cnt) : Math.min(...cnt), ans = col[cnt.indexOf(tgt)];
    const extra = ['빨강', '파랑', '노랑', '초록'].find((x) => !col.includes(x));
    return mk(`${col.map((c, i) => `${c} ${cnt[i]}개`).join(', ')}. 가장 ${most ? '많은' : '적은'} 색?`, ans, [...col.filter((x) => x !== ans), extra], `${iga(ans)} ${tgt}개로 가장 ${most ? '많아요' : '적어요'}`, true);
  }],
  ['곱셈', () => {
    const a = ri(2, 9), b = ri(2, 9), p = a * b, t = ri(0, 2);
    if (t === 0) return mk(`${a}씩 ${b}묶음은 모두 몇 개?`, p, [a + b, p + a, p - a], `${a}×${b}=${p}`);
    if (t === 1) return mk(`${a}의 ${b}배는?`, p, [a + b, p + a, p - a], `${a}×${b}=${p}`);
    if (b > 5) throw 0;
    return mk(`${Array(b).fill(a).join('+')}를 곱셈식으로?`.replace(/(\d)를 곱/, (m, d) => `${eul(d)} 곱`), `${a}×${b}`, [`${a}×${b + 1}`, `${a}×${b - 1}`, `${a}+${b}`], `${a}를 ${b}번 더함 → ${a}×${b}`.replace(/^(\d)를/, (m, d) => eul(d)), true);
  }],
];
U['2-2'] = [
  ['네 자리 수', () => {
    const t = ri(0, 2);
    if (t === 0) { const a = ri(1, 9), b = ri(0, 9), c = ri(0, 9), d = ri(0, 9), n = a * 1000 + b * 100 + c * 10 + d; return mk(`1000이 ${a}, 100이 ${b}, 10이 ${c}, 1이 ${d}개인 수?`, n, [a * 100 + b * 10 + c + d, n + 100, n + 10, b * 1000 + a * 100 + c * 10 + d], `천 ${a}, 백 ${b}, 십 ${c}, 일 ${d} → ${n}`); }
    if (t === 1) {
      const dg = sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4), n = +dg.join(''), p = ri(0, 3), d = dg[3 - p], v = d * 10 ** p;
      return mk(`${n}에서 ${iga(d)} 나타내는 값은?`, v, [d, d * 10, d * 100, d * 1000].filter((x) => x !== v), `${['일', '십', '백', '천'][p]}의 자리 숫자 → ${v}`);
    }
    const st = pick([1000, 100, 10]), s = ri(1001, 9999 - 4 * st), ans = s + 3 * st;
    return mk(`${s}, ${s + st}, ${s + 2 * st}, □`, ans, [s + 4 * st, ans + (st === 10 ? 100 : 10), s + 2 * st, ans + 1], `${st}씩 뛰어 세기`);
  }],
  ['곱셈구구', () => {
    const a = ri(2, 9), b = ri(Math.random() < 0.1 ? 0 : 2, 9), p = a * b, t = ri(0, 2);
    if (t === 0 || b < 2) return mk(`${a} × ${b} = ?`, p, [a * (b + 1), a * Math.max(b - 1, 0), (a + 1) * b, a + b], `${a}단: ${a}×${b}=${p}`);
    if (t === 1) return mk(`□ × ${b} = ${p}, □는?`, a, [a + 1, a - 1, b, p - b], `${a}×${b}=${p}`);
    return mk(`${a}단 곱셈구구에서 ${a}×${b}의 다음 값은?`, a * (b + 1), [a * b + 1, a * (b + 2), (a + 1) * b], `${a}단은 ${a}씩 커져요`);
  }],
  ['길이 재기(m, cm)', () => {
    const t = ri(0, 3);
    if (t === 0) { const m = ri(1, 9), c = ri(1, 99), n = m * 100 + c; return mk(`${m}m ${c}cm는 몇 cm?`, `${n}cm`, [`${m * 10 + c}cm`, `${m * 1000 + c}cm`, `${n + 100}cm`, `${Number(`${m}${c}`)}cm`], `1m=100cm → ${m * 100}+${c}=${n}`); }
    if (t === 1) { const n = ri(101, 999), m = Math.floor(n / 100), c = n % 100; if (!c) throw 0; return mk(`${n}cm는 몇 m 몇 cm?`, `${m}m ${c}cm`, [`${m + 1}m ${c}cm`, `${Math.floor(n / 10)}m ${n % 10}cm`, m > 1 ? `${m - 1}m ${c}cm` : `${m}m ${c + 10}cm`], `100cm=1m → ${m}m ${c}cm`); }
    if (t === 2) { const m1 = ri(1, 4), m2 = ri(1, 4), c1 = ri(10, 60), c2 = ri(5, 99 - c1); return mk(`${m1}m ${c1}cm + ${m2}m ${c2}cm = ?`, `${m1 + m2}m ${c1 + c2}cm`, [`${m1 + m2 + 1}m ${c1 + c2}cm`, `${m1 + m2}m ${c1 + c2 + 10}cm`, `${Math.abs(m1 - m2) || 1}m ${c1 + c2}cm`], `m끼리 ${m1 + m2}, cm끼리 ${c1 + c2}`); }
    return mk('1m는 몇 cm?', '100cm', ['10cm', '1000cm', '50cm'], '1m = 100cm');
  }],
  ['시각과 시간', () => {
    const t = ri(0, 3);
    if (t === 0) {
      const h = ri(1, 12), nx = h === 12 ? 1 : h + 1, k = ri(1, 11);
      return mk(`짧은바늘 ${wa(h)} ${nx} 사이, 긴바늘 ${k}. 몇 시 몇 분?`, `${h}시 ${5 * k}분`, [`${nx}시 ${5 * k}분`, `${h}시 ${k}분`, k < 11 ? `${h}시 ${5 * k + 5}분` : `${h}시 ${5 * k - 5}분`], `긴바늘 ${k} → ${5 * k}분`, true);
    }
    if (t === 1) {
      const h = ri(1, 10), m = 10 * ri(2, 5), d = 10 * ri(2, 5); if (m + d < 60) throw 0;
      const H = h + 1, M = m + d - 60, fmt = (x, y) => (y ? `${x}시 ${y}분` : `${x}시`);
      return mk(`${fmt(h, m)}에서 ${d}분 후는?`, fmt(H, M), [fmt(h, M), fmt(H + 1, M), fmt(H, M + 10), fmt(h, m + d - 50)], `${m}+${d}=${m + d}분 → 1시간 ${M}분`, true);
    }
    if (t === 2) {
      const C = pick([['1시간 = □분', 60, [100, 30, 24]], ['1일 = □시간', 24, [12, 60, 30]], ['1주일 = □일', 7, [5, 10, 30]], ['1년 = □개월', 12, [10, 24, 7]], ['2시간 = □분', 120, [200, 60, 100]], ['3주일 = □일', 21, [30, 10, 24]]]);
      return mk(C[0], C[1], C[2], `${C[0].replace('□', C[1])}`, true);
    }
    const h1 = ri(1, 7), dh = ri(2, 4);
    return mk(`${h1}시부터 ${h1 + dh}시까지는 몇 시간?`, `${dh}시간`, [`${dh + 1}시간`, `${dh - 1}시간`, `${dh * 10}분`], `${h1 + dh} - ${h1} = ${dh}(시간)`);
  }],
  ['표와 그래프', () => {
    const [a, b, c] = sample([2, 3, 4, 5, 6, 7, 8], 3), t = ri(0, 2);
    if (t === 0) return mk(`사과 ${a}명, 배 ${b}명, 귤 ${c}명. 모두 몇 명?`, `${a + b + c}명`, [`${a + b + c + 1}명`, `${a + b + c - 1}명`, `${a + b}명`], `${a}+${b}+${c}=${a + b + c}`);
    if (t === 1) { const ns = ['사과', '배', '귤'], v = [a, b, c], ans = ns[v.indexOf(Math.max(a, b, c))]; return mk(`사과 ${a}명, 배 ${b}명, 귤 ${c}명. 가장 많은 것?`, ans, [...ns.filter((x) => x !== ans), '포도'], `${iga(ans)} ${Math.max(a, b, c)}명으로 가장 많아요`, true); }
    const x = Math.max(a, b), y = Math.min(a, b);
    return mk(`그래프에 축구 ○${x}개, 야구 ○${y}개. 몇 명 차이?`, `${x - y}명`, [`${x + y}명`, `${x - y + 1}명`, `${x}명`], `${x} - ${y} = ${x - y}`);
  }],
  ['규칙 찾기', () => {
    const t = ri(0, 2);
    if (t === 0) { const d = pick([2, 3, 4, 5, 6, 9, 10, 100]), s = ri(1, 50), seq = [0, 1, 2, 3].map((i) => s + i * d), ans = s + 4 * d; return mk(`${seq.join(', ')}, □`, ans, [ans + d, ans + 1, ans - 1, seq[3]], `${d}씩 커지는 규칙`); }
    if (t === 1) {
      const S = ['●', '▲', '■', '★'], unit = sample(S, 3), n = ri(5, 8), seq = Array.from({ length: n }, (_, i) => unit[i % 3]).join(''), ans = unit[n % 3];
      return mk(`${seq} 다음 모양은?`, ans, S.filter((x) => x !== ans), `${unit.join('')} 반복`, true);
    }
    const a = ri(2, 9);
    return mk(`곱셈표에서 ${a}단의 수는 몇씩 커지나요?`, a, [a + 1, a - 1, a * 2], `${a}단은 ${a}씩 커져요`);
  }],
];

// ───────────────────────── 3학년 ─────────────────────────
U['3-1'] = [
  ['덧셈과 뺄셈', () => {
    if (Math.random() < 0.5) {
      const a = ri(105, 899), b = ri(105, 899), s = a + b;
      if (addNC(a, b) === s) throw 0;
      return mk(`${a} + ${b} = ?`, s, [addNC(a, b), s + 100, s - 100, s + 10, s - 10], `받아올림에 주의: ${s}`);
    }
    const a = ri(300, 999), b = ri(101, a - 100), d = a - b;
    if (subNB(a, b) === d) throw 0;
    return mk(`${a} - ${b} = ?`, d, [subNB(a, b), subNoDec(a, b), d + 100, d - 10], `받아내림에 주의: ${d}`);
  }],
  ['평면도형', () => {
    const t = ri(0, 2);
    if (t === 0) {
      const L = ['선분', '반직선', '직선', '곡선'];
      const [q, k] = pick([['두 점을 곧게 이은 선은?', 0], ['한쪽으로 끝없이 늘인 곧은 선은?', 1], ['양쪽으로 끝없이 늘인 곧은 선은?', 2]]);
      return mkT(q, L[k], L, `${L[k]}의 뜻을 기억해요`);
    }
    if (t === 1) {
      const F = pick([['네 각이 모두 직각인 사각형은?', '직사각형', ['직각삼각형', '오각형', '삼각형']],
        ['직각 4개, 네 변이 같은 사각형은?', '정사각형', ['직각삼각형', '오각형', '삼각형']],
        ['한 각이 직각인 삼각형은?', '직각삼각형', ['직사각형', '정사각형', '사각형']],
        ['직사각형의 직각은 몇 개?', '4개', ['1개', '2개', '3개']], ['직각삼각형의 직각은 몇 개?', '1개', ['2개', '3개', '0개']]]);
      return mk(F[0], F[1], F[2], `${F[1]}: 정의를 떠올려요`, true);
    }
    if (Math.random() < 0.5) { const a = ri(3, 15); return mk(`한 변이 ${a}cm인 정사각형, 네 변의 합?`, `${4 * a}cm`, [`${2 * a}cm`, `${a * a}cm`, `${4 * a + 4}cm`, `${3 * a}cm`], `${a}×4=${4 * a}(cm)`); }
    const a = ri(4, 15), b = ri(2, a - 1);
    return mk(`가로 ${a}cm, 세로 ${b}cm 직사각형 네 변의 합?`, `${2 * (a + b)}cm`, [`${a + b}cm`, `${a * b}cm`, `${2 * a + b}cm`], `(${a}+${b})×2=${2 * (a + b)}`);
  }],
  ['나눗셈', () => {
    const a = ri(2, 9), b = ri(2, 9), n = a * b, t = ri(0, 2);
    if (t === 0) return mk(`${n} ÷ ${b} = ?`, a, [a + 1, a - 1, n - b, b === a ? a + 2 : b], `${b}×${a}=${n} → ${a}`);
    if (t === 1) return mk(`사탕 ${n}개를 ${b}명이 똑같이 나누면 한 명에?`, `${a}개`, [`${a + 1}개`, `${a - 1}개`, `${n - b}개`], `${n}÷${b}=${a}`);
    return mk(`${b} × □ = ${n}, □는?`, a, [a + 1, a - 1, n + b, n - b], `${n}÷${b}=${a}`);
  }],
  ['곱셈', () => {
    const t = ri(0, 2);
    if (t === 0) { const a = ri(2, 9) * 10, b = ri(2, 9), p = a * b; return mk(`${a} × ${b} = ?`, p, [p / 10, p * 10, p + a], `${a / 10}×${b}=${p / 10} → ${p}`); }
    const a = t === 1 ? ri(1, 4) * 10 + ri(1, 2) : ri(13, 49), b = ri(2, t === 1 ? 2 : 9), p = a * b;
    return mk(`${a} × ${b} = ?`, p, [mulNC(a, b), mulCat(a, b), p + b, p - 10, p + 10], `${a % 10}×${b}=${(a % 10) * b}, ${Math.floor(a / 10) * 10}×${b}=${Math.floor(a / 10) * 10 * b}`);
  }],
  ['길이와 시간', () => {
    const t = ri(0, 3);
    if (t === 0) { const c = ri(1, 15), m = ri(1, 9), n = 10 * c + m; return mk(`${c}cm ${m}mm는 몇 mm?`, `${n}mm`, [`${c * 100 + m}mm`, `${c + m}mm`, `${n + 10}mm`], `1cm=10mm → ${10 * c}+${m}=${n}`); }
    if (t === 1) { const k = ri(1, 9), m = ri(1, 9) * 100 + (Math.random() < 0.5 ? 0 : ri(1, 99)), n = 1000 * k + m; return mk(`${k}km ${m}m는 몇 m?`, `${n}m`, [`${k * 100 + m}m`, `${k * 10000 + m}m`, `${n + 100}m`], `1km=1000m → ${1000 * k}+${m}=${n}`); }
    if (t === 2) { const mi = ri(1, 9), s = ri(5, 59), n = 60 * mi + s; return mk(`${mi}분 ${s}초는 몇 초?`, `${n}초`, [`${100 * mi + s}초`, `${mi + s}초`, `${n + 10}초`, `${n - 10}초`], `1분=60초 → ${60 * mi}+${s}=${n}`); }
    const m1 = ri(1, 5), m2 = ri(1, 4), s1 = ri(20, 55), s2 = ri(65 - s1 > 5 ? 65 - s1 : 5, 55); if (s1 + s2 < 61) throw 0;
    const M = m1 + m2 + 1, S = s1 + s2 - 60;
    return mk(`${m1}분 ${s1}초 + ${m2}분 ${s2}초 = ?`, `${M}분 ${S}초`, [`${M - 1}분 ${S}초`, `${M + 1}분 ${S}초`, `${M}분 ${S + 10}초`], `초끼리 ${s1 + s2}초=1분 ${S}초`);
  }],
  ['분수와 소수', () => {
    const t = ri(0, 4);
    if (t === 0) { const d = ri(3, 10), n = ri(1, d - 1); return mk(`피자를 ${d}조각 중 ${n}조각 먹었어요. 먹은 양은?`, `${n}/${d}`, [`${d - n}/${d}`, `${d}/${n}`, `${n}/${d + 1}`, `${n}/${Math.max(d - n, 1)}`], `전체 ${d}조각 중 ${n}조각 → ${n}/${d}`); }
    if (t === 1) { const k = pick([ri(2, 9), ri(11, 39)]); return mk(`0.1이 ${k}개인 수는?`, fd(k, 1), [String(k), fd(k, 2), String(k * 10), fd(k + 1, 1)], `0.1이 ${k}개 → ${fd(k, 1)}`); }
    if (t === 2) { const [a, b] = sample([2, 3, 4, 5, 6, 7, 8, 9], 2); const ans = `1/${Math.min(a, b)}`; return mk(`${wa(`1/${a}`)} 1/${b} 중 더 큰 수는?`, ans, [`1/${Math.max(a, b)}`, '같아요'], `분모가 작을수록 큰 단위분수`, true); }
    if (t === 3) { const c = ri(1, 15), m = ri(1, 9); return mk(`${c}cm ${m}mm는 몇 cm?`, `${c}.${m}cm`, [`${c}${m}cm`, `${m}.${c}cm`, `${c}.${m}0cm` === `${c}.${m}cm` ? null : `${c + 1}.${m}cm`, `${c}.0${m}cm`], `1mm=0.1cm → ${c}.${m}cm`); }
    const d = ri(4, 12), [x, y] = sample(Array.from({ length: d - 1 }, (_, i) => i + 1), 2), ans = `${Math.max(x, y)}/${d}`;
    return mk(`${wa(`${x}/${d}`)} ${y}/${d} 중 더 큰 수는?`, ans, [`${Math.min(x, y)}/${d}`, '같아요'], `분모가 같으면 분자가 큰 쪽`, true);
  }],
];
U['3-2'] = [
  ['곱셈', () => {
    const t = ri(0, 2);
    if (t === 0) { const a = ri(112, 489), b = ri(2, 9), p = a * b; return mk(`${a} × ${b} = ?`, p, [mulNC(a, b), p + 100, p - 10, p + a], `${a}×${b}=${p}`); }
    if (t === 1) { const a = ri(12, 49), b = ri(12, 49), u = b % 10, te = Math.floor(b / 10), p = a * b; if (!u) throw 0; return mk(`${a} × ${b} = ?`, p, [a * u + a * te, p + a, p - 10, p + 100], `${a}×${u}=${a * u}, ${a}×${te * 10}=${a * te * 10}`); }
    const a = ri(2, 9) * 10, b = ri(2, 9) * 10, p = a * b;
    return mk(`${a} × ${b} = ?`, p, [p / 10, p * 10, p / 100], `${a / 10}×${b / 10}=${p / 100}, 0 두 개 → ${p}`);
  }],
  ['나눗셈', () => {
    const t = ri(0, 3), b = ri(3, 9), q = ri(3, 19), r = ri(1, b - 1), n = b * q + r;
    if (t === 0) return mk(`${n} ÷ ${b}의 나머지는?`, r, [r + 1, b - r, r - 1, q], `${b}×${q}=${b * q}, ${n}-${b * q}=${r}`);
    if (t === 1) return mk(`${n} ÷ ${b}의 몫은?`, q, [q + 1, q - 1, r, q + 10], `${b}×${q}=${b * q}, 나머지 ${r}`);
    if (t === 2) { const qq = ri(11, 49), bb = ri(2, 6), nn = qq * bb; if (nn > 999) throw 0; return mk(`${nn} ÷ ${bb} = ?`, qq, [qq + 1, qq - 1, qq + 10, qq - 10], `${bb}×${qq}=${nn}`); }
    return mk(`어떤 수 ÷ ${b} = ${q} … ${r}. 어떤 수는?`, n, [b * q, b * q - r, n + b, (b + r) * q], `${b}×${q}+${r}=${n}`);
  }],
  ['원', () => {
    const t = ri(0, 3);
    if (t === 0) { const r = ri(2, 15); return mk(`반지름이 ${r}cm인 원의 지름은?`, `${2 * r}cm`, [`${r}cm`, `${r * 4}cm`, `${r + 2}cm`], `지름 = 반지름×2 = ${2 * r}cm`); }
    if (t === 1) { const r = ri(2, 15); return mk(`지름이 ${2 * r}cm인 원의 반지름은?`, `${r}cm`, [`${2 * r}cm`, `${4 * r}cm`, `${r + 1}cm`], `반지름 = 지름÷2 = ${r}cm`); }
    if (t === 2) {
      const F = pick([['원의 중심과 원 위의 한 점을 이은 선분?', '반지름'], ['원의 중심을 지나며 원 위 두 점을 이은 선분?', '지름'], ['원을 그릴 때 컴퍼스 침을 꽂은 점?', '원의 중심']]);
      return mkT(F[0], F[1], ['반지름', '지름', '원의 중심', '꼭짓점'], `${F[1]}의 뜻을 기억해요`);
    }
    const r = ri(2, 8), k = ri(2, 5);
    return mk(`반지름 ${r}cm인 원 ${k}개를 한 줄로 붙인 길이?`, `${2 * r * k}cm`, [`${r * k}cm`, `${2 * r * (k + 1)}cm`, `${2 * r + k}cm`], `지름 ${2 * r}cm × ${k} = ${2 * r * k}cm`);
  }],
  ['분수', () => {
    const t = ri(0, 3);
    if (t === 0) { const b = ri(2, 6), a = ri(1, b - 1), n = b * ri(2, 6), v = (n / b) * a; return mk(`${n}의 ${a}/${b}은 얼마?`.replace(`${a}/${b}은`, eun(`${a}/${b}`)), v, [n / b, n * a, n - a, v + 1], `${n}÷${b}=${n / b}, ${n / b}×${a}=${v}`); }
    if (t === 1) { const d = ri(2, 9), w = ri(1, 4), r = ri(1, d - 1), N = w * d + r; return mk(`${eul(`${N}/${d}`)} 대분수로 나타내면?`, mixS(w, r, d), [mixS(r, w, d) && r < d && w < d ? mixS(r, w, d) : null, mixS(w + 1, r, d), mixS(w, d - r, d), mixS(w, r, N)].filter((x) => x && x.length <= 8), `${N}÷${d}=${w}…${r} → ${mixS(w, r, d)}`); }
    if (t === 2) { const d = ri(2, 9), w = ri(1, 4), r = ri(1, d - 1), N = w * d + r; return mk(`${eul(mixS(w, r, d))} 가분수로 나타내면?`, `${N}/${d}`, [`${w + r}/${d}`, `${w * d}/${d}`, `${N + 1}/${d}`, `${w * r}/${d}`], `${w}×${d}+${r}=${N} → ${N}/${d}`); }
    const d = ri(3, 9), w = ri(1, 3), r = ri(1, d - 1), N = w * d + r, M = N + pick([-2, -1, 1, 2]);
    if (M <= d) throw 0;
    const A = mixS(w, r, d), B = `${M}/${d}`, ans = N > M ? A : B;
    return mk(`${wa(A)} ${B} 중 더 큰 수는?`, ans, [ans === A ? B : A, '같아요'], `${A} = ${ro(`${N}/${d}`)} 바꿔 비교`, true);
  }],
  ['들이와 무게', () => {
    const t = ri(0, 3);
    const unit = Math.random() < 0.5 ? ['L', 'mL'] : ['kg', 'g'];
    if (t === 0) { const a = ri(1, 9), b = pick([ri(1, 9) * 100, ri(10, 99), ri(101, 999)]), n = 1000 * a + b; return mk(`${a}${unit[0]} ${b}${unit[1]}는 몇 ${unit[1]}?`, `${n}${unit[1]}`, [`${Number(`${a}${b}`)}${unit[1]}`, `${100 * a + b}${unit[1]}`, `${n + 100}${unit[1]}`, `${10000 * a + b}${unit[1]}`], `1${unit[0]}=1000${unit[1]} → ${n}${unit[1]}`); }
    if (t === 1) { const n = ri(11, 89) * 100, a = Math.floor(n / 1000), b = n % 1000; if (!a || !b) throw 0; return mk(`${n}${unit[1]}는 몇 ${unit[0]} 몇 ${unit[1]}?`, `${a}${unit[0]} ${b}${unit[1]}`, [`${a * 10 + b / 100}${unit[0]} ${b / 100}${unit[1]}`, `${a + 1}${unit[0]} ${b}${unit[1]}`, `${a}${unit[0]} ${b / 10}${unit[1]}`], `1000${unit[1]}=1${unit[0]}`); }
    if (t === 2) {
      const a = ri(1, 4), c = ri(1, 4), b = ri(1, 9) * 100, d = ri(1, 9) * 100, G = (a + c) * 1000 + b + d, A = Math.floor(G / 1000), B = G % 1000;
      const f = (x, y) => (y ? `${x}${unit[0]} ${y}${unit[1]}` : `${x}${unit[0]}`);
      return mk(`${a}${unit[0]} ${b}${unit[1]} + ${c}${unit[0]} ${d}${unit[1]} = ?`, f(A, B), [f(A + 1, B), f(A - 1 > 0 ? A - 1 : A + 2, B), f(A, (B + 100) % 1000 || 900)], b + d >= 1000 ? `${unit[1]}끼리 ${b + d} → 받아올림` : `${unit[0]}끼리, ${unit[1]}끼리 더해요`);
    }
    const C = pick([['1L는 몇 mL?', '1000mL', ['100mL', '10mL', '10000mL']], ['1kg은 몇 g?', '1000g', ['100g', '10g', '10000g']], ['1t은 몇 kg?', '1000kg', ['100kg', '10kg', '10000kg']]]);
    return mk(C[0], C[1], C[2], C[0].replace(/[은는] 몇.*/, ` = ${C[1]}`));
  }],
  ['그림그래프', () => {
    const big = pick([10, 100]), a = ri(1, 6), b = ri(1, 9), n = big * a + (big / 10) * b;
    return mk(`큰 그림=${big}명, 작은 그림=${big / 10}명. 큰 ${a}개, 작은 ${b}개는?`, `${n}명`, [`${a + b}명`, `${big * b + (big / 10) * a}명`, `${n + big}명`], `${big}×${a}+${big / 10}×${b}=${n}`);
  }],
];

// ───────────────────────── 4학년 ─────────────────────────
U['4-1'] = [
  ['큰 수', () => {
    const t = ri(0, 3);
    if (t === 0) { const a = ri(1, 9), b = ri(0, 9), c = ri(0, 9), n = a * 10000 + b * 1000 + c * 100; return mk(`10000이 ${a}, 1000이 ${b}, 100이 ${c}개인 수?`, n, [a * 1000 + b * 100 + c * 10, n * 10, b * 10000 + a * 1000 + c * 100, n + 1000], `만 ${a}, 천 ${b}, 백 ${c} → ${n}`); }
    if (t === 1) {
      for (let i = 0; i < 30; i++) {
        const hi = ri(1000, 9999), mid = ri(1, 99) * 100, dg = String(hi), p = ri(0, 3), d = +dg[3 - p];
        if (!d) continue;
        if ((dg + String(mid).padStart(4, '0')).split('').filter((x) => +x === d).length !== 1) continue;
        const N = hi * 1e8 + mid * 1e4, v = d * 10 ** (8 + p);
        return mk(`${kor(N)}에서 숫자 ${iga(d)} 나타내는 값?`, kor(v), [kor(v * 10), kor(v / 10), kor(v / 1e4), kor(v * 1e4)], `${eun(d)} ${['일', '십', '백', '천'][p]}억의 자리 → ${kor(v)}`);
      }
      throw 0;
    }
    if (t === 2) {
      const a = ri(12, 98), p = ri(5, 10), N = a * 10 ** p, k = pick([10, 100]); if (a % 10 === 0) throw 0;
      return mk(`${kor(N)}의 ${k}배는?`, kor(N * k), [kor(N * k * 10), kor(N * k / 10), kor(N * k * 100), kor(N)], `${k}배 하면 0이 ${k === 10 ? 1 : 2}개 늘어요`);
    }
    const u = pick([1e4, 1e8]), st = pick([1, 10, 100, 1000]) * u, s = ri(2, 60) * st, ans = s + 3 * st;
    return mk(`${kor(s)}, ${kor(s + st)}, ${kor(s + 2 * st)}, □`, kor(ans), [kor(s + 4 * st), kor(ans + st * 10), kor(s + 2 * st), kor(ans + st / 10)], `${kor(st)}씩 뛰어 세기`);
  }],
  ['각도', () => {
    const t = ri(0, 4);
    if (t === 0) { const a = ri(4, 16) * 5, b = ri(4, 16) * 5, c = 180 - a - b; if (c < 15) throw 0; return mk(`삼각형의 두 각이 ${a}°, ${b}°. 나머지 각은?`, `${c}°`, [`${360 - a - b}°`, `${c + 10}°`, `${a + b}°`, `${c - 10}°`], `180°-${a}°-${b}°=${c}°`); }
    if (t === 1) { const a = ri(14, 30) * 5, b = ri(14, 30) * 5, c = ri(14, 30) * 5, d = 360 - a - b - c; if (d < 30 || d > 170) throw 0; return mk(`사각형의 세 각 ${a}°, ${b}°, ${c}°. 나머지 각?`, `${d}°`, [`${d + 10}°`, `${d - 10}°`, `${180 - (a + b + c - 180)}°`], `360°-${a + b + c}°=${d}°`); }
    if (t === 2) { const a = ri(3, 30) * 5, b = ri(3, 25) * 5, plus = Math.random() < 0.5 || a <= b; const v = plus ? a + b : a - b; return mk(`${a}° ${plus ? '+' : '-'} ${b}° = ?`, `${v}°`, [`${v + 10}°`, `${v - 10}°`, plus ? `${Math.abs(a - b)}°` : `${a + b}°`], `${a} ${plus ? '+' : '-'} ${b} = ${v}`); }
    if (t === 3) { const x = pick([ri(1, 17) * 10, 90, ri(2, 34) * 5]); if (x >= 180 || x <= 0) throw 0; const ans = x < 90 ? '예각' : x === 90 ? '직각' : '둔각'; return mkT(`${x}°는 어떤 각?`, ans, ['예각', '직각', '둔각'], x < 90 ? `${x}°는 90°보다 작으니 예각` : x === 90 ? '90°는 직각이에요' : `${x}°는 90°보다 크니 둔각`); }
    const h = ri(1, 11), v = 30 * Math.min(h, 12 - h);
    return mk(`${h}시 정각, 두 바늘이 이루는 작은 쪽 각도?`, `${v}°`, [`${v + 30}°`, `${Math.abs(v - 30) || 60}°`, `${h * 10}°`, `${360 - v}°`], `한 칸 30° × ${Math.min(h, 12 - h)}칸 = ${v}°`);
  }],
  ['곱셈과 나눗셈', () => {
    const t = ri(0, 3);
    if (t === 0) { const a = ri(112, 899), b = ri(12, 89), u = b % 10, te = Math.floor(b / 10), p = a * b; if (!u) throw 0; return mk(`${a} × ${b} = ?`, p, [a * u + a * te, p + a, p - 100, p + 1000], `${a}×${u}=${a * u}, ${a}×${te * 10}=${a * te * 10}`); }
    if (t <= 2) {
      const b = ri(12, 49), q = ri(5, 39), r = ri(1, b - 1), n = b * q + r; if (n > 999 || n < 100) throw 0;
      if (t === 1) return mk(`${n} ÷ ${b}의 몫은?`, q, [q + 1, q - 1, r, q + 10], `${b}×${q}=${b * q}, 나머지 ${r}`);
      return mk(`${n} ÷ ${b}의 나머지는?`, r, [r + 1, b - r, q, r + 10], `${b}×${q}=${b * q}, ${n}-${b * q}=${r}`);
    }
    const a = ri(2, 9) * 100, b = ri(2, 9) * 10, p = a * b;
    return mk(`${a} × ${b} = ?`, p, [p / 10, p * 10, p / 100], `${a / 100}×${b / 10}=${p / 1000}, 0이 3개 → ${p}`);
  }],
  ['평면도형의 이동', () => {
    const A = ['↑', '→', '↓', '←'], i = ri(0, 3), t = ri(0, 3);
    if (t === 0) { const k = pick([1, 2, 3]); return mkT(`'${A[i]}' 모양을 시계 방향으로 ${90 * k}° 돌리면?`, A[(i + k) % 4], A, `시계 방향 90°마다 한 칸씩 돌아가요`); }
    if (t === 1) { const k = pick([1, 2, 3]); return mkT(`'${A[i]}' 모양을 시계 반대 방향으로 ${90 * k}° 돌리면?`, A[(i - k + 8) % 4], A, `반대 방향 90°마다 한 칸씩 돌아가요`); }
    if (t === 2) {
      const lr = Math.random() < 0.5, ans = lr ? A[[0, 3, 2, 1][i]] : A[[2, 1, 0, 3][i]];
      return mkT(`'${A[i]}' 모양을 ${lr ? '오른쪽' : '아래쪽'}으로 뒤집으면?`, ans, A, lr ? '오른쪽 뒤집기: 왼쪽↔오른쪽이 바뀜' : '아래쪽 뒤집기: 위↔아래가 바뀜');
    }
    const F = pick([['시계 방향 90°로 몇 번 돌리면 처음과 같나요?', '4번', ['2번', '3번', '1번']], ['시계 방향 90°는 반대 방향 몇 °와 같나요?', '270°', ['90°', '180°', '360°']],
      ['도형을 밀면 모양은 어떻게 되나요?', '그대로', ['뒤집힘', '돌아감', '커짐']], ['같은 방향으로 2번 뒤집으면?', '처음 모양', ['뒤집힌 모양', '돌린 모양']]]);
    return mk(F[0], F[1], F[2], F[1] === '4번' ? '90°×4 = 360° 한 바퀴' : `정답: ${F[1]}`, true);
  }],
  ['막대그래프', () => {
    const t = ri(0, 3), s = pick([1, 2, 5, 10]), k = ri(3, 12);
    if (t === 0) { if (s === 1) throw 0; return mk(`눈금 한 칸이 ${s}명, 막대가 ${k}칸이면?`, `${s * k}명`, [`${k}명`, `${s * (k + 1)}명`, `${s + k}명`], `${s}×${k}=${s * k}(명)`); }
    if (t === 1) { if (s === 1) throw 0; return mk(`눈금 한 칸이 ${s}명일 때 ${s * k}명은 몇 칸?`, `${k}칸`, [`${s * k}칸`, `${k + 1}칸`, `${k * 2}칸`], `${s * k}÷${s}=${k}(칸)`); }
    const [a, b, c] = sample([4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 3);
    if (t === 2) return mk(`막대그래프: 축구 ${a}명, 야구 ${b}명. 몇 명 차이?`, `${Math.abs(a - b)}명`, [`${a + b}명`, `${Math.abs(a - b) + 1}명`, `${Math.max(a, b)}명`], `${Math.max(a, b)}-${Math.min(a, b)}=${Math.abs(a - b)}`);
    const ns = ['봄', '여름', '가을'], v = [a, b, c], ans = ns[v.indexOf(Math.max(a, b, c))];
    return mk(`봄 ${a}명, 여름 ${b}명, 가을 ${c}명. 가장 긴 막대는?`, ans, [...ns.filter((x) => x !== ans), '겨울'], `가장 많은 ${ans}의 막대가 가장 길어요`, true);
  }],
  ['규칙 찾기', () => {
    const t = ri(0, 2);
    if (t === 0) { const r = pick([2, 3]), s = ri(1, 5), seq = [0, 1, 2, 3].map((i) => s * r ** i), ans = s * r ** 4; return mk(`${seq.join(', ')}, □`, ans, [seq[3] + (seq[3] - seq[2]), ans + r, seq[3] * (r + 1)], `${r}씩 곱하는 규칙`); }
    if (t === 1) { const st = pick([100, 1000, 10000, 1100, 2000]), s = ri(10, 90) * 100 + ri(1, 9) * 10, ans = s + 3 * st; return mk(`${s}, ${s + st}, ${s + 2 * st}, □`, ans, [s + 4 * st, ans + 10, ans - 100, s + 2 * st], `${st}씩 커지는 규칙`); }
    const P = pick([['11×11=121, 111×111=12321, 1111×1111=?', 1234321, [123321, 12344321, 1235321]],
      ['99×99=9801, 999×999=998001, 9999×9999=?', 99980001, [9998001, 99980010, 99990001]],
      ...[3, 4, 5, 6, 7, 8, 9].map((k) => [`101×11=1111, 101×22=2222, 101×${11 * k}=?`, 1111 * k, [1111 * (k + 1), 1111 * (k - 1), 101 * k]])]);
    return mk(P[0], P[1], P[2], `규칙을 이어 가면 ${P[1]}`);
  }],
];
U['4-2'] = [
  ['분수의 덧셈과 뺄셈', () => {
    const d = ri(3, 12), t = ri(0, 3);
    if (t === 0) { const a = ri(1, d - 1), b = ri(1, d - 1), N = a + b; return mk(`${a}/${d} + ${b}/${d} = ?`, fs4(N, d), [`${N}/${2 * d}`, fs4(N + 1, d), fs4(Math.abs(a - b) || N + 2, d)], `분모는 그대로, 분자끼리: ${a}+${b}=${N}`); }
    if (t === 1) { const w1 = ri(1, 4), w2 = ri(1, 4), a = ri(1, d - 1), b = ri(1, d - 1), N = (w1 + w2) * d + a + b; return mk(`${mixS(w1, a, d)} + ${mixS(w2, b, d)} = ?`, fs4(N, d), [fs4(N + d, d), fs4(N - 1, d), `${wa(w1 + w2)} ${a + b}/${2 * d}`, fs4(N - d, d)], `자연수끼리 ${w1 + w2}, 분자끼리 ${a + b}`); }
    if (t === 2) {
      const w1 = ri(2, 5), w2 = ri(1, w1 - 1), a = ri(1, d - 2), b = ri(a + 1, d - 1), N = (w1 - w2) * d + a - b;
      return mk(`${mixS(w1, a, d)} - ${mixS(w2, b, d)} = ?`, fs4(N, d), [fs4((w1 - w2) * d + b - a, d), fs4(N + d, d), fs4(N + 1, d)], `1을 ${ro(`${d}/${d}`)} 바꿔 받아내림`);
    }
    const n = ri(2, 5), w = ri(0, n - 1), a = ri(1, d - 1), N = n * d - (w * d + a);
    return mk(`${n} - ${mixS(w, a, d)} = ?`, fs4(N, d), [fs4(N + d, d), fs4((n - w) * d + a, d), fs4(N - 1, d)], `${eul(n)} ${ro(mixS(n - 1, d, d))} 바꿔 계산`);
  }],
  ['삼각형', () => {
    const t = ri(0, 2);
    if (t === 0) {
      const F = pick([['세 변의 길이가 같은 삼각형은?', '정삼각형', ['직각삼각형', '둔각삼각형', '사다리꼴']],
        ['두 변의 길이가 같은 삼각형은?', '이등변삼각형', ['직각삼각형', '둔각삼각형', '평행사변형']],
        ['한 각이 둔각인 삼각형은?', '둔각삼각형', ['예각삼각형', '직각삼각형', '정삼각형']],
        ['세 각이 모두 예각인 삼각형은?', '예각삼각형', ['둔각삼각형', '직각삼각형', '평행사변형']],
        ['한 각이 직각인 삼각형은?', '직각삼각형', ['예각삼각형', '둔각삼각형', '정삼각형']]]);
      return mk(F[0], F[1], F[2], `${F[1]}의 뜻을 기억해요`, true);
    }
    if (t === 1) {
      const top = ri(2, 14) * 10, base = (180 - top) / 2;
      if (Math.random() < 0.5) return mk(`이등변삼각형 꼭지각 ${top}°, 한 밑각은?`, `${base}°`, [`${180 - top}°`, `${top}°`, `${base + 10}°`, `${base - 10}°`], `(180°-${top}°)÷2=${base}°`);
      return mk(`이등변삼각형 한 밑각 ${base}°, 꼭지각은?`, `${top}°`, [`${180 - base}°`, `${base}°`, `${top + 10}°`, `${180 - 2 * base + 20}°`], `180°-${base}°×2=${top}°`);
    }
    if (Math.random() < 0.4) return mk('정삼각형의 한 각은 몇 도?', '60°', ['90°', '45°', '180°', '30°'], '180°÷3=60°');
    const a = ri(3, 15), b = ri(2, 15); if (a === b) throw 0;
    if (Math.random() < 0.5) return mk(`한 변이 ${a}cm인 정삼각형의 둘레는?`, `${3 * a}cm`, [`${2 * a}cm`, `${4 * a}cm`, `${a * a}cm`], `${a}×3=${3 * a}(cm)`);
    return mk(`이등변삼각형 같은 두 변 ${a}cm, 다른 변 ${b}cm. 둘레?`, `${2 * a + b}cm`, [`${a + b}cm`, `${a + 2 * b}cm`, `${3 * a}cm`], `${a}×2+${b}=${2 * a + b}(cm)`);
  }],
  ['소수의 덧셈과 뺄셈', () => {
    const t = ri(0, 4);
    if (t === 0) { const a = ri(101, 899), b = ri(11, 89), s = a + 10 * b; if (a % 10 === 0) throw 0; return mk(`${fd(a, 2)} + ${fd(b, 1)} = ?`, fd(s, 2), [fd(a + b, 2), fd(s + 10, 2), fd(s - 10, 2), fd(s, 1)], `자리를 맞춰요: ${fd(a, 2)}+${fd(10 * b, 2)}`.replace(/\.(\d)$/, '.$10')); }
    if (t === 1) { const A = ri(30, 99), b = ri(101, 10 * A - 50), d = 10 * A - b; if (b % 10 === 0) throw 0; return mk(`${fd(A, 1)} - ${fd(b, 2)} = ?`, fd(d, 2), [fd(subNB(10 * A, b), 2), fd(subNoDec(10 * A, b), 2), fd(d + 10, 2)], `${eul(fd(A, 1))} ${ro((A / 10).toFixed(2))} 보고 계산`); }
    if (t === 2) { const k = ri(101, 999); if (k % 10 === 0) throw 0; return mk(`0.01이 ${k}개인 수는?`, fd(k, 2), [fd(k, 1), fd(k, 3), String(k)], `0.01이 ${k}개 → ${fd(k, 2)}`); }
    if (t === 3) {
      const dg = sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 3), x = `${dg[0]}.${dg[1]}${dg[2]}`, p = ri(0, 2), d = dg[p], v = [d, d / 10, d / 100][p];
      return mk(`${x}에서 ${iga(d)} 나타내는 수는?`, fd(Math.round(v * 100), 2), [d, fd(d * 10, 2), fd(d, 2), fd(d, 3)].filter((y) => String(y) !== fd(Math.round(v * 100), 2)), `${['일의 자리', '소수 첫째 자리', '소수 둘째 자리'][p]}`);
    }
    const a = ri(11, 98), b = 10 * a + pick([-9, -5, -3, 3, 5, 9]), A = fd(a, 1), B = fd(b, 2);
    if (b % 10 === 0) throw 0;
    const ans = 10 * a > b ? A : B;
    return mk(`${wa(A)} ${B} 중 더 큰 수는?`, ans, [ans === A ? B : A, '같아요'], `소수 둘째 자리까지 맞춰 비교`, true);
  }],
  ['사각형', () => {
    const t = ri(0, 2);
    if (t === 0) {
      const F = pick([['마주 보는 두 쌍의 변이 평행한 사각형?', '평행사변형', ['사다리꼴', '삼각형', '오각형']],
        ['네 변의 길이가 모두 같은 사각형?', '마름모', ['사다리꼴', '평행사변형', '직사각형']],
        ['평행한 변이 한 쌍이라도 있는 사각형 이름?', '사다리꼴', ['오각형', '직각삼각형', '원']],
        ['서로 만나지 않는 두 직선의 관계는?', '평행', ['수직', '직각', '교차']],
        ['두 직선이 직각으로 만나는 관계는?', '수직', ['평행', '예각', '둔각']]]);
      return mk(F[0], F[1], F[2], `${F[1]}의 뜻을 기억해요`, true);
    }
    if (t === 1) { const a = ri(4, 16) * 5; if (a === 90) throw 0; return mk(`평행사변형의 한 각이 ${a}°, 이웃한 각은?`, `${180 - a}°`, [`${a}°`, `${360 - a}°`, `${90 - a > 0 ? 90 - a : 180 - a + 10}°`], `이웃한 두 각의 합은 180°`); }
    if (Math.random() < 0.5) { const a = ri(3, 15); return mk(`한 변이 ${a}cm인 마름모의 둘레는?`, `${4 * a}cm`, [`${2 * a}cm`, `${a * a}cm`, `${3 * a}cm`], `네 변이 같아요: ${a}×4=${4 * a}`); }
    const a = ri(4, 15), b = ri(3, a - 1);
    return mk(`평행사변형 두 변 ${a}cm, ${b}cm. 둘레는?`, `${2 * (a + b)}cm`, [`${a + b}cm`, `${a * b}cm`, `${2 * a + b}cm`], `(${a}+${b})×2=${2 * (a + b)}`);
  }],
  ['꺾은선그래프', () => {
    const t = ri(0, 2);
    if (t === 0) { const a = ri(5, 20), d = 2 * ri(1, 5); return mk(`10시 ${a}°C, 12시 ${a + d}°C. 11시 기온은 약?`, `${a + d / 2}°C`, [`${a + d}°C`, `${a}°C`, `${a + d + d / 2}°C`], `두 값의 가운데: ${a + d / 2}°C`); }
    if (t === 1) {
      const ok = ['월별 키 변화', '시각별 기온', '날짜별 몸무게', '연도별 인구'], no = ['반별 학생 수', '좋아하는 색', '나라별 인구', '취미별 학생'];
      const pos = Math.random() < 0.6;
      if (pos) return mk('꺾은선그래프로 나타내기 좋은 것?', pick(ok), sample(no, 3), '시간에 따른 변화는 꺾은선그래프', true);
      return mk('꺾은선그래프에 알맞지 않은 것?', pick(no), sample(ok, 3), '항목별 비교는 막대그래프', true);
    }
    const a = ri(5, 20), b = a + ri(2, 12);
    return mk(`9시 ${a}°C, 12시 ${b}°C. 몇 °C 올랐나요?`, `${b - a}°C`, [`${a + b}°C`, `${b - a + 1}°C`, `${b}°C`], `${b}-${a}=${b - a}(°C)`);
  }],
  ['다각형', () => {
    const n = ri(4, 8), t = ri(0, 3), nm = `${PRE[n]}각형`;
    if (t === 0) { const v = (n * (n - 3)) / 2; return mk(`${nm}의 대각선은 모두 몇 개?`, `${v}개`, [`${n * (n - 3)}개`, `${n}개`, `${n - 3}개`, `${v + 1}개`], `${n}×${n - 3}÷2=${v}(개)`); }
    if (t === 1) { const a = ri(2, 12); return mk(`한 변이 ${a}cm인 정${nm}의 둘레?`, `${n * a}cm`, [`${(n - 1) * a}cm`, `${(n + 1) * a}cm`, `${n + a}cm`], `${a}×${n}=${n * a}(cm)`); }
    if (t === 2) return mkT(`변이 ${n}개인 정다각형의 이름은?`, `정${nm}`, [4, 5, 6, 7, 8, 9].map((k) => `정${PRE[k]}각형`), `변 ${n}개 → 정${nm}`);
    const a = ri(2, 12);
    return mk(`둘레가 ${n * a}cm인 정${nm}의 한 변은?`, `${a}cm`, [`${a + 1}cm`, `${n * a - n}cm`, `${a * 2}cm`], `${n * a}÷${n}=${a}(cm)`);
  }],
];

// ───────────────────────── 5학년 ─────────────────────────
U['5-1'] = [
  ['자연수의 혼합 계산', () => {
    const t = ri(0, 5);
    if (t === 0) { const a = ri(2, 30), b = ri(2, 9), c = ri(2, 9), v = a + b * c; return mk(`${a} + ${b} × ${c} = ?`, v, [(a + b) * c, v + 1, v - b], `${b}×${c}를 먼저: ${a}+${b * c}=${v}`.replace(/(\d)를/, (m, x) => eul(x))); }
    if (t === 1) { const a = ri(2, 20), b = ri(2, 20), c = ri(2, 9), v = (a + b) * c; return mk(`(${a} + ${b}) × ${c} = ?`, v, [a + b * c, v + c, v - 1], `괄호 먼저: ${a + b}×${c}=${v}`); }
    if (t === 2) { const b = ri(2, 9), c = ri(2, 9), a = b * c + ri(5, 40), v = a - b * c; return mk(`${a} - ${b} × ${c} = ?`, v, [(a - b) * c, v + 1, v + c], `${b}×${c}를 먼저: ${a}-${b * c}=${v}`.replace(/(\d)를/, (m, x) => eul(x))); }
    if (t === 3) { const c = ri(2, 9), k = ri(2, 9), b = c * k, a = ri(2, 40), v = a + k; const w = (a + b) % c === 0 ? (a + b) / c : v + c; return mk(`${a} + ${b} ÷ ${c} = ?`, v, [w, v + 1, a + b], `${b}÷${c}를 먼저: ${a}+${k}=${v}`.replace(/(\d)를/, (m, x) => eul(x))); }
    if (t === 4) { const a = ri(2, 9), b = ri(3, 12), d = ri(2, 6), k = ri(1, 5), c = d * k, v = a * b - k; const w = (a * b - c) % d === 0 && a * b - c > 0 ? (a * b - c) / d : v - 1; return mk(`${a} × ${b} - ${c} ÷ ${d} = ?`, v, [w, a * b - c, v + 1], `${a * b} - ${k} = ${v}`); }
    const a = ri(2, 9), b = ri(5, 15), c = ri(1, b - 1), v = a * (b - c);
    return mk(`${a} × (${b} - ${c}) = ?`, v, [a * b - c, v + a, v - 1], `괄호 먼저: ${a}×${b - c}=${v}`);
  }],
  ['약수와 배수', () => {
    const t = ri(0, 4);
    if (t === 0) { const n = pick([6, 8, 10, 12, 15, 16, 18, 20, 24, 28, 30, 36, 40, 42, 48]); const k = Array.from({ length: n }, (_, i) => i + 1).filter((x) => n % x === 0).length; return mk(`${n}의 약수는 모두 몇 개?`, `${k}개`, [`${k - 1}개`, `${k + 1}개`, `${k - 2}개`, `${k + 2}개`], `${n}을 나누어떨어지게 하는 수 ${k}개`.replace(/(\d)을/, (m, x) => eul(x))); }
    const g = ri(2, 12), [m1, m2] = sample([1, 2, 3, 4, 5, 6, 7], 2); if (gcd(m1, m2) !== 1) throw 0;
    const a = Math.min(g * m1, g * m2), b = Math.max(g * m1, g * m2), G = gcd(a, b), L = lcm(a, b);
    if (t === 1) { const dv = [1, 2, 3, 4, 6].filter((x) => G % x === 0 && x !== G); return mk(`${wa(a)} ${b}의 최대공약수는?`, G, [...dv.slice(-2), L, G * 2], `두 수의 공약수 중 가장 큰 수: ${G}`); }
    if (t === 2) { if (L > 200) throw 0; return mk(`${wa(a)} ${b}의 최소공배수는?`, L, [G, a * b, L * 2, L + G], `두 수의 공배수 중 가장 작은 수: ${L}`); }
    if (t === 3) {
      const n = pick([12, 18, 20, 24, 30, 36]), dv = Array.from({ length: n }, (_, i) => i + 1).filter((x) => n % x === 0 && x > 1), nd = [5, 7, 8, 9, 10, 11, 14, 16].filter((x) => n % x !== 0);
      return mk(`다음 중 ${n}의 약수가 아닌 것은?`, pick(nd), sample(dv, 3), `${n}을 나누어떨어지지 않는 수`.replace(/(\d)을/, (m, x) => eul(x)), true);
    }
    const k = ri(3, 9), v = Math.ceil(10 / k) * k;
    return mk(`${k}의 배수 중 가장 작은 두 자리 수는?`, v, [v + k, k, v - 1, 10], `${k}×${v / k}=${v}`);
  }],
  ['규칙과 대응', () => {
    const t = ri(0, 3), k = ri(2, 9), x = ri(5, 12);
    if (t === 0) return mk(`△가 1, 2, 3일 때 ○는 ${k}, ${2 * k}, ${3 * k}. △=${x}이면 ○는?`, k * x, [x + k, k * (x + 1), k * x + 1], `○ = △×${k} → ${x}×${k}=${k * x}`);
    if (t === 1) return mk(`△가 1, 2, 3일 때 ○는 ${1 + k}, ${2 + k}, ${3 + k}. △=${x}이면 ○는?`, x + k, [x * k, x + k + 1, x * (1 + k)], `○ = △+${k} → ${x}+${k}=${x + k}`);
    if (t === 2) return mk(`△가 1, 2, 3일 때 ○는 ${k}, ${2 * k}, ${3 * k}. 대응 관계식은?`, `○=△×${k}`, [`○=△+${k}`, `△=○×${k}`, `○=△×${k + 1}`], `○는 △의 ${k}배`, true);
    const [nm, un, it, c] = pick([['탁자', '개', '의자', 4], ['자동차', '대', '바퀴', 4], ['오리', '마리', '다리', 2], ['세발자전거', '대', '바퀴', 3]]);
    return mk(`${nm} 1${un}에 ${it} ${c}개. ${nm} ${x}${un}이면 ${eun(it)}?`, `${c * x}개`, [`${c + x}개`, `${c * (x - 1)}개`, `${c * x + c}개`], `${x}×${c}=${c * x}(개)`);
  }],
  ['약분과 통분', () => {
    const t = ri(0, 2);
    if (t === 0) {
      const q = ri(3, 9), p = ri(1, q - 1); if (gcd(p, q) !== 1) throw 0;
      const k = ri(2, 6), n = p * k, d = q * k;
      return mk(`${eul(`${n}/${d}`)} 기약분수로 나타내면?`, `${p}/${q}`, [`${p}/${d}`, `${n}/${q}`, `${p + 1}/${q}`, `${p}/${q + 1}`], `분자·분모를 ${ro(k)} 나누면 ${p}/${q}`);
    }
    const [b, d] = sample([2, 3, 4, 5, 6, 8, 9, 10, 12], 2), L = lcm(b, d);
    if (t === 1) { if (L === b * d && Math.random() < 0.5) throw 0; return mk(`분모 ${wa(b)} ${d}의 가장 작은 공통분모는?`, L, [b * d === L ? L * 2 : b * d, b + d, Math.max(b, d), L + Math.min(b, d)], `${wa(b)} ${d}의 최소공배수 ${L}`); }
    const a = ri(1, b - 1), c = ri(1, d - 1), A = (a * L) / b, C = (c * L) / d; if (A === C) throw 0;
    const x = `${a}/${b}`, y = `${c}/${d}`, ans = A > C ? x : y;
    return mk(`${wa(x)} ${y} 중 더 큰 수는?`, ans, [ans === x ? y : x, '같아요'], `통분: ${A}/${L}, ${C}/${L}`, true);
  }],
  ['분수의 덧셈과 뺄셈', () => {
    let b = ri(2, 9), d = ri(2, 9); if (b === d) throw 0;
    const a = ri(1, b - 1), c = ri(1, d - 1), L = lcm(b, d), A = (a * L) / b, C = (c * L) / d, t = ri(0, 3);
    if (t === 0) { const N = A + C; return mk(`${a}/${b} + ${c}/${d} = ?`, fs(N, L), [`${a + c}/${b + d}`, fs(N + 1, L), fs(a + c, L), fs(N - 1, L)], `통분: ${A}/${L}+${C}/${L}=${fs(N, L)}`); }
    if (t === 1) { if (A <= C) throw 0; const N = A - C; return mk(`${a}/${b} - ${c}/${d} = ?`, fs(N, L), [a > c && b !== d ? `${a - c}/${Math.abs(b - d)}` : null, fs(N + 1, L), fs(Math.abs(a - c) || 1, L), fs(N + C, L)], `통분: ${A}/${L}-${C}/${L}=${fs(N, L)}`); }
    const w1 = ri(1, 3), w2 = ri(1, 3);
    if (t === 2) { const N = (w1 + w2) * L + A + C; return mk(`${mixS(w1, a, b)} + ${mixS(w2, c, d)} = ?`, fs(N, L), [fs(N + L, L), fs(N - 1, L), A + C >= L ? fs(N - L, L) : fs(N + 1, L)], `통분 후 자연수·분수끼리 더해요`); }
    if (A >= C) throw 0;
    const W = w1 + 1 + w2, N = (W - w2) * L + A - C;
    return mk(`${mixS(W, a, b)} - ${mixS(w2, c, d)} = ?`, fs(N, L), [fs((W - w2) * L + C - A, L), fs(N + L, L), fs(N + 1, L)], `통분 후 1을 ${ro(`${L}/${L}`)} 받아내림`);
  }],
  ['다각형의 둘레와 넓이', () => {
    const t = ri(0, 7), a = ri(3, 15), b = ri(2, 12);
    if (t === 0) return mk(`가로 ${a}cm, 세로 ${b}cm인 직사각형의 넓이?`, `${a * b}cm²`, [`${2 * (a + b)}cm²`, `${a + b}cm²`, `${a * b * 2}cm²`], `가로×세로=${a}×${b}=${a * b}`);
    if (t === 1) return mk(`가로 ${a}cm, 세로 ${b}cm인 직사각형의 둘레?`, `${2 * (a + b)}cm`, [`${a * b}cm`, `${a + b}cm`, `${2 * a + b}cm`], `(${a}+${b})×2=${2 * (a + b)}`);
    if (t === 2) return mk(`한 변이 ${a}cm인 정사각형의 넓이?`, `${a * a}cm²`, [`${4 * a}cm²`, `${2 * a}cm²`, `${a * a + a}cm²`], `${a}×${a}=${a * a}`);
    if (t === 3) return mk(`밑변 ${a}cm, 높이 ${b}cm인 평행사변형의 넓이?`, `${a * b}cm²`, [`${(a * b) / 2}cm²`, `${2 * (a + b)}cm²`, `${a * b + b}cm²`], `밑변×높이=${a}×${b}=${a * b}`);
    if (t === 4) { if ((a * b) % 2) throw 0; return mk(`밑변 ${a}cm, 높이 ${b}cm인 삼각형의 넓이?`, `${(a * b) / 2}cm²`, [`${a * b}cm²`, `${a + b}cm²`, `${(a * b) / 2 + a}cm²`], `${a}×${b}÷2=${(a * b) / 2}`); }
    if (t === 5) { if ((a * b) % 2) throw 0; return mk(`두 대각선이 ${a}cm, ${b}cm인 마름모의 넓이?`, `${(a * b) / 2}cm²`, [`${a * b}cm²`, `${2 * (a + b)}cm²`, `${(a * b) / 2 + 1}cm²`], `${a}×${b}÷2=${(a * b) / 2}`); }
    if (t === 6) { const c = ri(2, 10), h = ri(2, 10); if (((a + c) * h) % 2 || a === c) throw 0; return mk(`윗변 ${c}, 아랫변 ${a}, 높이 ${h}cm 사다리꼴 넓이?`, `${((a + c) * h) / 2}cm²`, [`${(a + c) * h}cm²`, `${(a * c * h) / 2}cm²`, `${((a + c) * h) / 2 + h}cm²`], `(${c}+${a})×${h}÷2=${((a + c) * h) / 2}`); }
    return mk(`넓이 ${a * b}cm², 가로 ${a}cm인 직사각형의 세로?`, `${b}cm`, [`${b + 1}cm`, `${a * b - a}cm`, `${b * 2}cm`], `${a * b}÷${a}=${b}(cm)`);
  }],
];
U['5-2'] = [
  ['수의 범위와 어림하기', () => {
    const t = ri(0, 3);
    if (t === 0) {
      const L = ri(10, 40), U2 = L + ri(3, 8), li = Math.random() < 0.5, ui = Math.random() < 0.5;
      const cnt = U2 - L - 1 + (li ? 1 : 0) + (ui ? 1 : 0);
      return mk(`${L} ${li ? '이상' : '초과'} ${U2} ${ui ? '이하' : '미만'}인 자연수의 개수?`, `${cnt}개`, [`${cnt + 1}개`, `${cnt - 1}개`, `${cnt + 2}개`, `${U2 - L}개` === `${cnt}개` ? null : `${U2 - L}개`], `${li ? L : L + 1}부터 ${ui ? U2 : U2 - 1}까지 ${cnt}개`);
    }
    if (t === 1) {
      const N = ri(1001, 9999), pl = pick([10, 100, 1000]), pn = { 10: '십', 100: '백', 1000: '천' }[pl];
      if (N % pl === 0) throw 0;
      const up = Math.ceil(N / pl) * pl, dn = Math.floor(N / pl) * pl, rd = Math.round(N / pl) * pl;
      const mode = pick(['올림', '버림', '반올림']), ans = { 올림: up, 버림: dn, 반올림: rd }[mode];
      const other = pl === 10 ? 100 : pl / 10, alt = { 올림: Math.ceil(N / other) * other, 버림: Math.floor(N / other) * other, 반올림: Math.round(N / other) * other }[mode];
      return mk(`${eul(N)} ${mode}하여 ${pn}의 자리까지?`, ans, [up, dn, rd, alt, ans + pl].filter((x) => x !== ans), `${mode}: ${pn}의 자리 아래를 보고 → ${ans}`);
    }
    if (t === 2) {
      const x = ri(15, 60), k = pick(['이상', '이하', '초과', '미만']);
      const okf = { 이상: (v) => v >= x, 이하: (v) => v <= x, 초과: (v) => v > x, 미만: (v) => v < x }[k];
      const cand = [x - 3, x - 2, x - 1, x, x + 1, x + 2, x + 3];
      const good = cand.filter(okf), bad = cand.filter((v) => !okf(v));
      const ans = (k === '이상' || k === '이하') && Math.random() < 0.5 ? x : pick(good.filter((v) => v !== x));
      return mk(`다음 중 ${x} ${k}인 수는?`, ans, sample(bad, 3), `${k}: ${k === '이상' || k === '이하' ? `${eul(x)} 포함해요` : `${eun(x)} 포함하지 않아요`}`, true);
    }
    const L = ri(10, 50), Ux = L + ri(4, 9);
    return mk(`${L} 초과 ${Ux} 미만인 자연수 중 가장 작은 수?`, L + 1, [L, L + 2, Ux - 1], `초과는 ${eul(L)} 포함하지 않아요 → ${L + 1}`);
  }],
  ['분수의 곱셈', () => {
    const t = ri(0, 3);
    if (t === 0) {
      const b = ri(2, 9), d = ri(2, 9), a = ri(1, b - 1), c = ri(1, d - 1), N = a * c, D = b * d;
      return mk(`${a}/${b} × ${c}/${d} = ?`, fs(N, D), [fs(a * d, b * c), `${a + c}/${b + d}`, fs(N + 1, D), fs(N, b + d)], `분자끼리, 분모끼리: ${N}/${D}${gcd(N, D) > 1 ? ` → ${fs(N, D)}` : ''}`);
    }
    if (t === 1) { const b = ri(2, 9), a = ri(1, b - 1), n = ri(2, 12); return mk(`${n} × ${a}/${b} = ?`, fs(n * a, b), [n * a, fs(a, n * b), fs(n * b, a), fs(n * a + 1, b)], `${n}×${a}=${n * a} → ${n * a}/${b}${gcd(n * a, b) > 1 || n * a > b ? ` = ${fs(n * a, b)}` : ''}`); }
    if (t === 2) { const b = ri(2, 6), w = ri(1, 3), r = ri(1, b - 1), n = ri(2, 6), N = (w * b + r) * n; return mk(`${mixS(w, r, b)} × ${n} = ?`, fs(N, b), [fs(w * n * b + r, b), fs(N + 1, b), fs(N + b, b)], `가분수로: ${w * b + r}/${b}×${n}=${fs(N, b)}`); }
    const [a, b] = sample([2, 3, 4, 5, 6, 7, 8, 9], 2);
    return mk(`1/${a} × 1/${b} = ?`, `1/${a * b}`, [`1/${a + b}`, `2/${a * b}`, `2/${a + b}`], `단위분수의 곱: 1/(${a}×${b})`);
  }],
  ['합동과 대칭', () => {
    const t = ri(0, 3);
    if (t === 0) {
      const S = pick([['정삼각형', 3], ['정사각형', 4], ['직사각형', 2], ['마름모', 2], ['정오각형', 5], ['정육각형', 6], ['이등변삼각형', 1]]);
      return mk(`${S[0]}의 대칭축은 몇 개?`, `${S[1]}개`, [`${S[1] + 1}개`, `${S[1] - 1 || 3}개`, `${S[1] * 2}개`], `${S[0]}: 대칭축 ${S[1]}개`);
    }
    if (t === 1) {
      const yes = ['정사각형', '직사각형', '평행사변형', '마름모', '정육각형', '원'], no = ['정삼각형', '이등변삼각형', '정오각형', '직각삼각형'];
      if (Math.random() < 0.5) return mk('다음 중 점대칭도형은?', pick(yes), sample(no, 3), '180° 돌려 겹치면 점대칭도형', true);
      return mk('다음 중 점대칭도형이 아닌 것은?', pick(no), sample(yes, 3), '180° 돌려 겹치지 않아요', true);
    }
    if (t === 2) {
      const [x, y, z] = sample([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3);
      return mk(`합동인 △ㄱㄴㄷ, △ㄹㅁㅂ. ㄱㄴ=${x}cm, ㄴㄷ=${y}cm. ㅁㅂ은?`, `${y}cm`, [`${x}cm`, `${x + y}cm`, `${z}cm`], `ㅁㅂ의 대응변은 ㄴㄷ → ${y}cm`, true);
    }
    const F = pick([['점대칭도형의 대칭의 중심은 몇 개?', '1개', ['2개', '3개', '4개']], ['원의 대칭축은 몇 개?', '무수히 많음', ['1개', '2개', '4개']],
      ['선대칭도형을 대칭축으로 접으면?', '완전히 겹침', ['반만 겹침', '안 겹침']]]);
    return mk(F[0], F[1], F[2], `정답: ${F[1]}`, true);
  }],
  ['소수의 곱셈', () => {
    const t = ri(0, 3);
    if (t === 0) { const a = ri(11, 99), n = ri(2, 9); if (a % 10 === 0) throw 0; return mk(`${fd(a, 1)} × ${n} = ?`, fd(a * n, 1), [fd(a * n, 0), fd(a * n, 2), fd(a * n + 10, 1)], `${a}×${n}=${a * n} → 소수 한 자리 ${fd(a * n, 1)}`); }
    if (t === 1) { const a = ri(2, 9), b = ri(2, 9); return mk(`0.${a} × 0.${b} = ?`, fd(a * b, 2), [fd(a * b, 1), fd(a * b, 3), fd(a + b, 1)], `${a}×${b}=${a * b}, 소수 두 자리 → ${fd(a * b, 2)}`); }
    if (t === 2) { const a = ri(11, 49), b = ri(2, 9); if (a % 10 === 0) throw 0; return mk(`${fd(a, 1)} × 0.${b} = ?`, fd(a * b, 2), [fd(a * b, 1), fd(a * b, 3), fd(a * b + 10, 2)], `${a}×${b}=${a * b}, 소수 두 자리 → ${fd(a * b, 2)}`); }
    const a = ri(101, 999), k = pick([10, 100, 1000]); if (a % 10 === 0) throw 0;
    const p = Math.log10(k);
    return mk(`${fd(a, 2)} × ${k} = ?`, fd(a * k, 2), [fd(a * k * 10, 2), fd(a * k / 10, 2) === fd(a * k, 2) ? null : fd(Math.round(a * k / 10), 2), fd(a, 2 - p + 1 > 0 ? 2 - p + 1 : 0)], `×${k}: 소수점이 오른쪽으로 ${p}칸`);
  }],
  ['직육면체', () => {
    if (Math.random() < 0.65) {
      const F = pick([['직육면체의 면은 몇 개?', '6개'], ['직육면체의 모서리는 몇 개?', '12개'], ['직육면체의 꼭짓점은 몇 개?', '8개'], ['정육면체의 면은 몇 개?', '6개'],
        ['정육면체의 모서리는 몇 개?', '12개'], ['직육면체에서 한 면과 평행한 면은?', '1개'], ['직육면체에서 한 면과 수직인 면은?', '4개'],
        ['겨냥도에서 보이는 모서리는 몇 개?', '9개'], ['겨냥도에서 보이지 않는 모서리는?', '3개'], ['겨냥도에서 보이는 면은 몇 개?', '3개'], ['겨냥도에서 보이지 않는 꼭짓점은?', '1개']]);
      return mk(F[0], F[1], sample(['1개', '2개', '3개', '4개', '6개', '8개', '9개', '12개'].filter((x) => x !== F[1]), 3), `${F[0].replace(/[은는]? ?(몇 개)?\?$/, '')}: ${F[1]}`, true);
    }
    if (Math.random() < 0.5) { const a = ri(2, 12); return mk(`한 모서리 ${a}cm인 정육면체, 모든 모서리 합?`, `${12 * a}cm`, [`${6 * a}cm`, `${8 * a}cm`, `${4 * a}cm`], `모서리 12개: ${a}×12=${12 * a}`); }
    const [a, b, c] = sample([2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    return mk(`가로 ${a}, 세로 ${b}, 높이 ${c}cm 직육면체 모서리 합?`, `${4 * (a + b + c)}cm`, [`${a + b + c}cm`, `${2 * (a + b + c)}cm`, `${3 * (a + b + c)}cm`], `(${a}+${b}+${c})×4=${4 * (a + b + c)}`);
  }],
  ['평균과 가능성', () => {
    const t = ri(0, 3);
    if (t === 0) {
      const k = ri(3, 5), m = ri(5, 20), xs = Array.from({ length: k }, () => m + ri(-4, 4)); const diff = xs.reduce((s, v) => s + v, 0) - m * k; xs[k - 1] -= diff;
      if (xs.some((v) => v <= 0)) throw 0;
      const S = m * k;
      return mk(`${xs.join(', ')}의 평균은?`, m, [S, m + 1, m - 1, Math.max(...xs)], `합 ${S} ÷ ${k} = ${m}`);
    }
    if (t === 1) { const k = ri(3, 5), m = ri(70, 95); return mk(`${k}과목 평균이 ${m}점이면 총점은?`, `${k * m}점`, [`${m + k}점`, `${(k + 1) * m}점`, `${k * m + 10}점`], `${m}×${k}=${k * m}(점)`); }
    if (t === 2) {
      const tg = ri(80, 90), a = ri(70, 100), b = ri(70, 100), c = ri(70, 100), x = 4 * tg - a - b - c;
      if (x < 50 || x > 100) throw 0;
      return mk(`${a}, ${b}, ${c}점. 넷째 몇 점이면 평균 ${tg}점?`, `${x}점`, [`${tg}점`, `${x + 4}점`, `${x - 2}점`], `${tg}×4-${a + b + c}=${x}`);
    }
    const F = pick([['주사위를 굴려 7이 나올 가능성은?', '불가능하다'], ['동전을 던져 앞면이 나올 가능성은?', '반반이다'], ['주사위 눈이 6 이하로 나올 가능성은?', '확실하다'],
      ['주사위를 굴려 짝수가 나올 가능성은?', '반반이다'], ['내일 해가 서쪽에서 뜰 가능성은?', '불가능하다']]);
    if (Math.random() < 0.4) {
      const num = { 불가능하다: '0', 반반이다: '1/2', 확실하다: '1' }[F[1]];
      return mk(F[0].replace('가능성은?', '가능성을 수로?'), num, ['0', '1/2', '1', '1/4'].filter((x) => x !== num), `${F[1]} → ${num}`, true);
    }
    return mkT(F[0], F[1], ['불가능하다', '반반이다', '확실하다', '~일 것 같다'], `가능성: ${F[1]}`);
  }],
];

// ───────────────────────── 6학년 ─────────────────────────
U['6-1'] = [
  ['분수의 나눗셈', () => {
    const t = ri(0, 3);
    if (t === 0) { const [a, b] = sample([2, 3, 4, 5, 6, 7, 8, 9], 2); if (a >= b || gcd(a, b) !== 1) throw 0; return mk(`${a} ÷ ${eul(b)} 분수로 나타내면?`, `${a}/${b}`, [`${b}/${a}`, `1/${b}`, `${a}/${a + b}`], `${a}÷${b} = ${a}/${b}`); }
    if (t === 1) { const b = ri(2, 9), a = ri(1, b - 1), n = ri(2, 6); return mk(`${a}/${b} ÷ ${n} = ?`, fs(a, b * n), [fs(a * n, b), fs(n, a * b), fs(a, b + n), fs(a + 1, b * n)], `${a}/${b}×1/${n} = ${fs(a, b * n)}`); }
    if (t === 2) { const b = ri(2, 6), w = ri(1, 3), r = ri(1, b - 1), n = ri(2, 5), N = w * b + r; return mk(`${mixS(w, r, b)} ÷ ${n} = ?`, fs(N, b * n), [fs(N * n, b), fs(w * b * n + r, b * n) === fs(N, b * n) ? null : mixS(w, r, b * n), fs(N + 1, b * n)], `가분수 ${ro(`${N}/${b}`)} 바꿔: ${fs(N, b * n)}`); }
    const b = ri(2, 9), a = b * ri(1, 3) + ri(1, b - 1);
    return mk(`${a} ÷ ${b}의 몫을 분수로?`, fs(a, b), [`${b}/${a}`, fs(a + 1, b), mixS(b, a % b, a) && mixS(b, a % b, a).length <= 8 && a % b < a ? null : null, fs(a, b + 1)], `${a}÷${b} = ${a}/${b} = ${fs(a, b)}`);
  }],
  ['각기둥과 각뿔', () => {
    const n = ri(3, 8), pr = Math.random() < 0.5, nm = `${PRE[n]}각${pr ? '기둥' : '뿔'}`, t = ri(0, 3);
    const V = pr ? 2 * n : n + 1, F = pr ? n + 2 : n + 1, E = pr ? 3 * n : 2 * n;
    if (t <= 1) {
      const part = pick([['꼭짓점', V], ['면', F], ['모서리', E]]);
      const oV = pr ? n + 1 : 2 * n, oF = pr ? n + 1 : n + 2, oE = pr ? 2 * n : 3 * n;
      const other = { 꼭짓점: oV, 면: oF, 모서리: oE }[part[0]];
      return mk(`${nm}의 ${part[0]}은 몇 개?`, `${part[1]}개`, [`${other}개`, `${V}개`, `${F}개`, `${E}개`, `${part[1] + 1}개`], `${nm}: 꼭짓점 ${V}, 면 ${F}, 모서리 ${E}`);
    }
    if (t === 2) return mkT(`밑면이 ${PRE[n]}각형인 ${pr ? '각기둥' : '각뿔'}의 이름은?`, nm, [`${PRE[n]}각${pr ? '뿔' : '기둥'}`, `${PRE[n + 1]}각${pr ? '기둥' : '뿔'}`, `${PRE[n - 1] || '구'}각${pr ? '기둥' : '뿔'}`, nm], `밑면 모양으로 이름을 정해요`);
    if (Math.random() < 0.5) return mkT(`${pr ? '각기둥' : '각뿔'}의 옆면 모양은?`, pr ? '직사각형' : '삼각형', ['직사각형', '삼각형', '원', '오각형'], pr ? '각기둥 옆면은 직사각형' : '각뿔 옆면은 삼각형');
    return mk(`모서리가 ${E}개인 ${pr ? '각기둥' : '각뿔'}의 이름은?`, nm, [`${PRE[pr ? n + 1 : n + 1] || '구'}각${pr ? '기둥' : '뿔'}`, `${PRE[n]}각${pr ? '뿔' : '기둥'}`, n > 3 ? `${PRE[n - 1]}각${pr ? '기둥' : '뿔'}` : null].filter(Boolean), `모서리 ${E} = ${n}×${pr ? 3 : 2} → ${nm}`, true);
  }],
  ['소수의 나눗셈', () => {
    const t = ri(0, 2);
    if (t === 0) { const q = ri(11, 99), n = ri(2, 9), A = q * n; if (q % 10 === 0) throw 0; const p = Math.random() < 0.5 ? 1 : 2; return mk(`${fd(A, p)} ÷ ${n} = ?`, fd(q, p), [fd(q, p - 1 >= 0 ? p - 1 : 0), fd(q, p + 1), fd(q + 1, p)], `${A}÷${n}=${q} → ${fd(q, p)}`); }
    if (t === 1) { const C = pick([[1, 4, 25], [3, 4, 75], [1, 5, 20], [3, 5, 60], [7, 4, 175], [9, 4, 225], [1, 2, 50], [7, 5, 140], [9, 2, 450], [1, 8, 125, 3], [3, 8, 375, 3], [5, 8, 625, 3]]); const P = C[3] || 2, v = fd(C[2], P); if (C[0] / C[1] === Math.floor(C[0] / C[1])) throw 0; return mk(`${C[0]} ÷ ${C[1]}의 몫을 소수로?`, v, [fd(C[2], P - 1), fd(C[2], P + 1), fd(C[2] + 5, P)], `${C[0]}÷${C[1]} = ${C[0]}/${C[1]} = ${v}`); }
    const a = ri(11, 999), k = pick([10, 100]); if (a % 10 === 0) throw 0;
    return mk(`${a} ÷ ${k} = ?`, fd(a, Math.log10(k)), [fd(a, Math.log10(k) + 1), fd(a, Math.log10(k) - 1), String(a * k)], `÷${k}: 소수점이 왼쪽으로 ${Math.log10(k)}칸`);
  }],
  ['비와 비율', () => {
    const t = ri(0, 4);
    if (t === 0) { const [a, b] = sample([2, 3, 4, 5, 7, 8, 9], 2); if (gcd(a, b) !== 1) throw 0; return mk(`${a} : ${b}의 비율을 분수로?`, `${a}/${b}`, [`${b}/${a}`, `${a}/${a + b}`, `${b}/${a + b}`], `비교하는 양 ÷ 기준량 = ${a}/${b}`); }
    if (t === 1) { const p = ri(1, 99), v = fd(p, 2); return mk(`비율 ${eul(v)} 백분율로 나타내면?`, `${p}%`, [`${fd(p, 1)}%`, `${fd(p, 2)}%`, `${p * 10}%`], `${v}×100 = ${p}%`); }
    if (t === 2) { const T = pick([4, 5, 10, 20, 25, 50]), k = ri(1, T - 1), p = (k * 100) / T; return mk(`${T}명 중 ${k}명은 전체의 몇 %?`, `${p}%`, [`${k}%`, `${p + 10}%`, `${(T * 100) / k === Math.round((T * 100) / k) ? (T * 100) / k : p * 2}%`], `${k}/${T}×100 = ${p}%`); }
    if (t === 3) { const [a, b] = sample([2, 3, 4, 5, 6, 7, 8, 9], 2), fb = Math.random() < 0.5; return mk(`${a} : ${b}에서 ${fb ? '기준량' : '비교하는 양'}은?`, fb ? b : a, [fb ? a : b, a + b, a * b], `${a} : ${b}에서 앞=비교하는 양, 뒤=기준량`); }
    const pr = ri(2, 30) * 1000, r = pick([10, 20, 25, 30, 40, 50]), v = (pr * (100 - r)) / 100;
    return mk(`${pr}원짜리를 ${r}% 할인하면 얼마?`, `${v}원`, [`${(pr * r) / 100}원`, `${pr - r}원`, `${v + 1000}원`], `${pr}×${(100 - r) / 100} = ${v}원`);
  }],
  ['여러 가지 그래프', () => {
    const t = ri(0, 2);
    if (t === 0) { const T = pick([20, 40, 50, 200, 300, 400]), x = ri(1, 18) * 5, v = (T * x) / 100; if (v !== Math.floor(v)) throw 0; return mk(`원그래프: 전체 ${T}명, ${x}%는 몇 명?`, `${v}명`, [`${x}명`, `${v + 5}명`, `${T - v}명`], `${T}×${x}/100 = ${v}(명)`); }
    if (t === 1) { const T = pick([20, 25, 40, 50]), a = ri(1, T - 1), p = (a * 100) / T; if (p !== Math.floor(p)) throw 0; return mk(`전체 ${T}명 중 ${a}명. 띠그래프에서 몇 %?`, `${p}%`, [`${a}%`, `${p + 5}%`, `${100 - p}%`], `${a}/${T}×100 = ${p}%`); }
    const a = ri(4, 9) * 5, b = ri(2, 6) * 5, c = ri(1, 4) * 5, d = 100 - a - b - c; if (d <= 0) throw 0;
    return mk(`띠그래프: 가 ${a}%, 나 ${b}%, 다 ${c}%. 라는?`, `${d}%`, [`${d + 5}%`, `${a + b + c}%`, `${d - 5 > 0 ? d - 5 : d + 10}%`], `100-${a}-${b}-${c}=${d}(%)`);
  }],
  ['직육면체의 부피와 겉넓이', () => {
    const t = ri(0, 5), [a, b, c] = sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 12], 3);
    if (t === 0) return mk(`가로 ${a}, 세로 ${b}, 높이 ${c}cm인 직육면체 부피?`, `${a * b * c}cm³`, [`${2 * (a * b + b * c + c * a)}cm³`, `${a + b + c}cm³`, `${a * b}cm³`], `${a}×${b}×${c}=${a * b * c}`);
    if (t === 1) return mk(`가로 ${a}, 세로 ${b}, 높이 ${c}cm 직육면체 겉넓이?`, `${2 * (a * b + b * c + c * a)}cm²`, [`${a * b + b * c + c * a}cm²`, `${a * b * c}cm²`, `${2 * (a * b + b * c + c * a) + a * b}cm²`], `(${a * b}+${b * c}+${c * a})×2`);
    if (t === 2) return mk(`한 모서리 ${a}cm인 정육면체의 부피?`, `${a ** 3}cm³`, [`${6 * a * a}cm³`, `${3 * a}cm³`, `${a * a}cm³`], `${a}×${a}×${a}=${a ** 3}`);
    if (t === 3) return mk(`한 모서리 ${a}cm인 정육면체의 겉넓이?`, `${6 * a * a}cm²`, [`${a ** 3}cm²`, `${4 * a * a}cm²`, `${a * a}cm²`], `한 면 ${a * a}cm² × 6 = ${6 * a * a}`);
    if (t === 4) return mk('1m³는 몇 cm³?', '1000000', ['1000', '10000', '100000', '100'], '100×100×100 = 1000000');
    return mk(`부피 ${a * b * c}cm³, 가로 ${a}, 세로 ${b}cm. 높이?`, `${c}cm`, [`${c + 1}cm`, `${a * b}cm`, `${c * 2}cm`], `${a * b * c}÷(${a}×${b})=${c}`);
  }],
];
U['6-2'] = [
  ['분수의 나눗셈', () => {
    const t = ri(0, 3);
    if (t === 0) { const d = ri(5, 13), b = ri(1, 4), a = b * ri(2, 4); if (a >= d) throw 0; return mk(`${a}/${d} ÷ ${b}/${d} = ?`, a / b, [fs(a * b, d * d), a / b + 1, fs(b, a), a * b], `분모가 같으면 분자끼리: ${a}÷${b}=${a / b}`); }
    if (t === 1) { const b = ri(2, 9), d = ri(2, 9), a = ri(1, b - 1), c = ri(1, d - 1); if (a * d === b * c) throw 0; return mk(`${a}/${b} ÷ ${c}/${d} = ?`, fs(a * d, b * c), [fs(a * c, b * d), fs(b * c, a * d), fs(a * d + 1, b * c), fs(b * d, a * c)], `${a}/${b}×${d}/${c} = ${fs(a * d, b * c)}`); }
    if (t === 2) { const n = ri(2, 9), b = ri(2, 9), a = ri(1, b - 1); return mk(`${n} ÷ ${a}/${b} = ?`, fs(n * b, a), [fs(n * a, b), fs(a, n * b), fs(n * b + 1, a), n * b], `${n}×${b}/${a} = ${fs(n * b, a)}`); }
    const b = ri(2, 5), w = ri(1, 2), r = ri(1, b - 1), d = ri(2, 6), c = ri(1, d - 1), N = w * b + r;
    return mk(`${mixS(w, r, b)} ÷ ${c}/${d} = ?`, fs(N * d, b * c), [fs(N * c, b * d), fs(b * c, N * d), fs(N * d + 1, b * c)], `${N}/${b}×${d}/${c} = ${fs(N * d, b * c)}`);
  }],
  ['소수의 나눗셈', () => {
    const t = ri(0, 3);
    let qv, qs, dv, dsc;
    if (t === 0) { qv = ri(2, 9); qs = 0; dv = ri(2, 9); dsc = 1; }
    else if (t === 1) { qv = ri(11, 39); qs = 1; dv = ri(11, 19); dsc = 1; if (qv % 10 === 0) throw 0; }
    else if (t === 2) { dv = pick([2, 4, 5, 8]); dsc = 1; qv = pick([5, 10, 15, 20, 25, 30, 35, 40, 45]); qs = 0; if ((qv * dv) % 10) throw 0; }
    else { dv = pick([25, 75, 15, 125, 35]); dsc = 2; qv = ri(2, 12); qs = 0; }
    const A = qv * dv, as = qs + dsc, dividend = fd(A, as), Q = fd(qv, qs);
    if (dividend.includes('.') && dividend.split('.')[1].length > 2) throw 0;
    return mk(`${dividend} ÷ ${fd(dv, dsc)} = ?`, Q, [fd(qv * 10, qs), fd(qv, qs + 1), fd(qv + (qs ? 10 : 1), qs)], `둘 다 ${10 ** dsc}배: ${fd(A, as - dsc)}÷${dv}=${Q}`);
  }],
  ['공간과 입체', () => {
    const t = ri(0, 2);
    if (t === 0) { const a = ri(3, 9), b = ri(1, a), c = ri(0, b), s = a + b + c; return mk(`쌓기나무 1층 ${a}개, 2층 ${b}개, 3층 ${c}개. 모두?`, `${s}개`, [`${s + 1}개`, `${s - 1}개`, `${a}개`, `${a * 3}개`], `${a}+${b}+${c}=${s}(개)`); }
    if (t === 1) { const k = ri(3, 5), xs = Array.from({ length: k }, () => ri(1, 3)), s = xs.reduce((p, v) => p + v, 0); return mk(`위에서 본 모양에 쓴 수: ${xs.join(', ')}. 쌓기나무 개수?`, `${s}개`, [`${k}개`, `${s + 1}개`, `${s - 1}개`, `${Math.max(...xs) * k}개`], `각 칸의 수를 모두 더해요: ${s}`); }
    const k = ri(3, 8), h = ri(2, 4);
    return mk(`1층 ${k}칸, 모든 칸에 ${h}층씩 쌓으면 몇 개?`, `${k * h}개`, [`${k + h}개`, `${k * (h - 1)}개`, `${k * h + k}개`], `${k}×${h}=${k * h}(개)`);
  }],
  ['비례식과 비례배분', () => {
    const t = ri(0, 3), [p, q] = sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 2), k = ri(2, 6);
    if (t === 0) return mk(`${p} : ${q} = ${p * k} : □`, q * k, [q + (p * k - p), q * k + 1, p * k * q, q * (k + 1)], `전항이 ${k}배 → ${q}×${k}=${q * k}`);
    if (t === 1) return mk(`${p} : ${q} = □ : ${q * k}`, p * k, [p + (q * k - q), p * k + 1, p * (k + 1), q * k * p], `후항이 ${k}배 → ${p}×${k}=${p * k}`);
    if (t === 2) {
      if (gcd(p, q) !== 1) throw 0;
      const T = (p + q) * k, sm = Math.random() < 0.5;
      return mk(`${T}개를 ${p} : ${ro(q)} 나누면 ${sm ? '적은' : '많은'} 쪽은?`, `${(sm ? Math.min(p, q) : Math.max(p, q)) * k}개`, [`${(sm ? Math.max(p, q) : Math.min(p, q)) * k}개`, `${T / 2}개`, `${sm ? Math.min(p, q) : Math.max(p, q)}개`, `${(T * (sm ? Math.min(p, q) : Math.max(p, q))) / (p * q)}개`].filter((x) => !/\./.test(x)), `${T}×${sm ? Math.min(p, q) : Math.max(p, q)}/${p + q}=${(sm ? Math.min(p, q) : Math.max(p, q)) * k}`);
    }
    if (gcd(p, q) !== 1) throw 0;
    const same = (x, y) => x * q === y * p;
    const ds = [[q, p], [p + 1, q], [p, q + 1], [p * 2, q], [p, q * 2]].filter(([x, y]) => !same(x, y)).map(([x, y]) => `${x} : ${y}`);
    const form = ri(0, 2);
    let lhs;
    if (form === 0) lhs = `${p * k} : ${q * k}`;
    else if (form === 1) { if (k > 5) throw 0; lhs = `${fd(p * k, 1)} : ${fd(q * k, 1)}`; if (p * k % 10 === 0 && q * k % 10 === 0) throw 0; }
    else { lhs = `1/${q} : 1/${p}`; }
    return mk(`${eul(lhs)} 간단한 자연수의 비로?`, `${p} : ${q}`, ds, form === 2 ? `각 항에 ${p * q}를 곱해요` : `각 항을 같은 수로 나누거나 곱해요`, true);
  }],
  ['원의 넓이', () => {
    const t = ri(0, 4), r = ri(2, 10);
    if (t === 0) return mk(`지름 ${2 * r}cm 원의 원주는 몇 cm? (원주율 3.14)`, fd(314 * 2 * r, 2), [fd(314 * r, 2), fd(314 * r * r, 2), fd(314 * 4 * r, 2)], `${2 * r}×3.14 = ${fd(314 * 2 * r, 2)}`);
    if (t === 1) return mk(`반지름 ${r}cm 원의 원주는 몇 cm? (원주율 3.14)`, fd(314 * 2 * r, 2), [fd(314 * r, 2), fd(314 * r * r, 2), fd(314 * 4 * r, 2)], `${r}×2×3.14 = ${fd(314 * 2 * r, 2)}`);
    if (t === 2) return mk(`반지름 ${r}cm 원의 넓이는 몇 cm²? (원주율 3.14)`, fd(314 * r * r, 2), [fd(314 * 2 * r, 2), fd(314 * r, 2), fd(314 * 4 * r * r, 2)], `${r}×${r}×3.14 = ${fd(314 * r * r, 2)}`);
    if (t === 3) return mk(`지름 ${2 * r}cm 원의 넓이는 몇 cm²? (원주율 3.14)`, fd(314 * r * r, 2), [fd(314 * 4 * r * r, 2), fd(314 * 2 * r, 2), fd(314 * r, 2)], `반지름 ${r}: ${r}×${r}×3.14=${fd(314 * r * r, 2)}`);
    return mk(`원주가 ${fd(314 * 2 * r, 2)}cm인 원의 지름은? (3.14)`, `${2 * r}cm`, [`${r}cm`, `${4 * r}cm`, `${2 * r + 1}cm`], `${fd(314 * 2 * r, 2)}÷3.14 = ${2 * r}`);
  }],
  ['원기둥, 원뿔, 구', () => {
    if (Math.random() < 0.65) {
      const cnt = ['0개', '1개', '2개', '3개'], shp = ['원', '삼각형', '직사각형', '사다리꼴'], sol = ['원기둥', '원뿔', '구', '각기둥'];
      const F = pick([['원기둥의 밑면은 몇 개?', '2개', cnt], ['원뿔의 밑면은 몇 개?', '1개', cnt], ['원뿔의 꼭짓점은 몇 개?', '1개', cnt],
        ['원기둥의 꼭짓점은 몇 개?', '0개', cnt], ['구를 어느 방향에서 봐도 보이는 모양?', '원', shp], ['원기둥 전개도에서 옆면의 모양은?', '직사각형', shp],
        ['원기둥의 밑면의 모양은?', '원', shp], ['원뿔을 옆에서 본 모양은?', '삼각형', shp], ['반원을 지름을 축으로 돌리면?', '구', sol],
        ['직사각형을 한 변을 축으로 돌리면?', '원기둥', sol], ['직각삼각형을 직각을 낀 변을 축으로 돌리면?', '원뿔', sol]]);
      return mkT(F[0], F[1], F[2], `정답: ${F[1]}`);
    }
    const r = ri(1, 6);
    if (Math.random() < 0.5) return mk(`밑면 반지름 ${r}cm 원기둥 전개도, 옆면 가로는? (3.14)`, `${fd(314 * 2 * r, 2)}cm`, [`${fd(314 * r, 2)}cm`, `${fd(314 * r * r, 2)}cm`, `${2 * r}cm`], `옆면 가로 = 밑면 둘레 = ${fd(314 * 2 * r, 2)}`);
    return mk(`반지름이 ${r}cm인 구의 지름은?`, `${2 * r}cm`, [`${r}cm`, `${4 * r}cm`, `${fd(314 * r, 2)}cm`], `지름 = 반지름×2 = ${2 * r}cm`);
  }],
];

// ───────────────────────── 공개 API ─────────────────────────
export const MATH_UNITS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((g) => [g, { 1: U[`${g}-1`].map((u) => u[0]), 2: U[`${g}-2`].map((u) => u[0]) }]),
);

function valid(r) {
  return r && typeof r.q === 'string' && r.q.length <= 44 && !BAD.test(r.q) &&
    typeof r.e === 'string' && !BAD.test(r.e) && r.e.length <= 46 &&
    Array.isArray(r.c) && r.c.length >= 3 && r.c.length <= 4 && new Set(r.c).size === r.c.length &&
    r.c.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 8 && !BAD.test(s)) &&
    Number.isInteger(r.a) && r.a >= 0 && r.a < r.c.length;
}

/** 내부/테스트용: 특정 단원에서 한 문제(실패 시 null) */
export function _genUnit(grade, semester, unitName, tries = 60) {
  const list = U[`${grade}-${semester}`];
  const u = list && list.find((x) => x[0] === unitName);
  if (!u) return null;
  for (let i = 0; i < tries; i++) {
    try { const r = u[1](); if (valid(r)) return r; } catch (e) { /* 다시 뽑기 */ }
  }
  return null;
}

/**
 * 학년(1~6)·학기(1~2)에 맞는 수학 문제 하나를 만든다.
 * @param {number} grade @param {number} semester @param {string} [unitName] 특정 단원 지정(선택)
 * @returns {{q:string,c:string[],a:number,e:string}}
 */
export function generateMath(grade, semester, unitName) {
  const g = Math.min(6, Math.max(1, Math.round(+grade) || 1));
  const s = +semester === 2 ? 2 : 1;
  const names = MATH_UNITS[g][s];
  for (let i = 0; i < 10; i++) {
    const name = unitName && names.includes(unitName) ? unitName : pick(names);
    const r = _genUnit(g, s, name);
    if (r) return r;
  }
  // 최후의 보루(정상적으로는 도달하지 않음)
  const a = ri(2, 9), b = ri(2, 9);
  return mk(`${a} + ${b} = ?`, a + b, [a + b + 1, a + b - 1, a * b], `${a}+${b}=${a + b}`);
}

export default generateMath;
