// 저장 데이터 (localStorage). 이 기기 안에만 남는다.
const KEY = 'mallang_party_save_v1';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// 처음부터 가진 캐릭터 (data/game.js의 price 0)
const FREE_CHARS = ['scout', 'rifle', 'brawler', 'kitty'];
// 2026-11-04 말랑이 6종 → 레이더스 스타일 10종. 예전에 산 말랑이(400)는 동전으로 돌려준다
const OLD_CHARS = { mochi: 0, bori: 0, ppiyak: 0, cheese: 400, dino: 400, pangi: 400 };
function migrate(d) {
  if (!d.ownedChars?.some(id => id in OLD_CHARS)) return d;
  const refund = d.ownedChars.reduce((s, id) => s + (OLD_CHARS[id] || 0), 0);
  d.coins = (d.coins || 0) + refund;
  d.ownedChars = [...new Set([...FREE_CHARS, ...d.ownedChars.filter(id => !(id in OLD_CHARS))])];
  if (d.selChar in OLD_CHARS) d.selChar = 'scout';
  if (refund) d.refund = refund;
  return d;
}

const DEFAULT = () => ({
  coins: 200,
  grade: 3, semester: 1, subject: '국어', picked: false,
  ownedChars: [...FREE_CHARS],
  selChar: 'scout',
  owned: { hat: ['none'], trail: ['none'] },
  equip: { hat: 'none', trail: 'none' },
  settings: {
    bgm: 0.55, sfx: 0.85, shake: true,
    quality: isTouch ? 'low' : 'high',
    tts: 'auto',          // auto(1~2학년 자동) · on · off
    timer: 'normal',      // relaxed · normal · fast
    bots: 'normal',       // easy · normal · hard
    name: '',
  },
  stats: { parties: 0, wins: 0, crowns: 0, correct: 0, wrong: 0 },
  record: {}, notes: [], qHist: {},
});

export const save = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = migrate(JSON.parse(raw)), def = DEFAULT();
      return { ...def, ...d, settings: { ...def.settings, ...d.settings }, owned: { ...def.owned, ...d.owned },
        equip: { ...def.equip, ...d.equip }, stats: { ...def.stats, ...d.stats } };
    }
  } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
  return DEFAULT();
}
let pending = 0;
export function persist() {
  // 한 프레임에 여러 번 불려도 한 번만 쓴다
  if (pending) return;
  pending = requestAnimationFrame(() => { pending = 0; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 무시 */ } });
}
export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
  location.reload();
}
export const touchDevice = isTouch;
