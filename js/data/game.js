// 게임 데이터: 캐릭터, 치장, 라운드, 보기 색

// 말랑이 6종. 능력치는 없다(모두 공정). body/accent는 코드로 붙이는 손·발 색 (chars_colors.json이 있으면 덮어씀)
export const CHARACTERS = [
  { id: 'mochi', name: '모찌', animal: '토끼', desc: '귀가 쫑긋! 언제나 신나는 토끼', body: '#fff6f1', accent: '#f6a5b8', price: 0 },
  { id: 'bori', name: '보리', animal: '아기 곰', desc: '느긋하지만 한번 뛰면 멈추지 않는 곰', body: '#b98458', accent: '#7a4f2e', price: 0 },
  { id: 'ppiyak', name: '삐약', animal: '병아리', desc: '작아도 목소리는 제일 큰 병아리', body: '#ffe27a', accent: '#ff9f2e', price: 0 },
  { id: 'cheese', name: '치즈', animal: '고양이', desc: '호기심 대장 주황 고양이', body: '#ffb35c', accent: '#e07a26', price: 400 },
  { id: 'dino', name: '디노', animal: '아기 공룡', desc: '꼬리를 흔들며 달리는 아기 공룡', body: '#8fe0b8', accent: '#3fae7c', price: 400 },
  { id: 'pangi', name: '팡이', animal: '판다', desc: '대나무보다 퀴즈를 더 좋아하는 판다', body: '#f7f7f4', accent: '#2d2d33', price: 400 },
];
export const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

// 모자 (모델은 레이서에서 쓰던 hat_*.glb). fit: 씌우는 방식 (top 정수리 · wrap 머리에 둘러 씀 · band 머리띠)
export const HATS = [
  { id: 'none', name: '없음', price: 0, icon: '🙂' },
  { id: 'flower', name: '꽃 핀', price: 120, icon: '🌸', fit: 'top', size: 0.45 },
  { id: 'bow', name: '리본', price: 120, icon: '🎀', fit: 'top', size: 0.5 },
  { id: 'cap', name: '야구 모자', price: 180, icon: '🧢', fit: 'wrap', size: 0.95 },
  { id: 'headset', name: '헤드셋', price: 200, icon: '🎧', fit: 'band', size: 1.05 },
  { id: 'goggles', name: '고글', price: 220, icon: '🥽', fit: 'band', size: 1.0 },
  { id: 'horn', name: '유니콘 뿔', price: 260, icon: '🦄', fit: 'top', size: 0.55 },
  { id: 'wizard', name: '마법사 모자', price: 300, icon: '🧙', fit: 'wrap', size: 0.9 },
  { id: 'helmet', name: '헬멧', price: 300, icon: '⛑️', fit: 'wrap', size: 1.08 },
  { id: 'crown', name: '왕관', price: 500, icon: '👑', fit: 'top', size: 0.62 },
];
// 발자국 효과
export const TRAILS = [
  { id: 'none', name: '없음', price: 0, icon: '·' },
  { id: 'star', name: '반짝 별', price: 150, icon: '⭐', colors: ['#ffd84d', '#fff3a8'] },
  { id: 'heart', name: '하트', price: 150, icon: '💗', colors: ['#ff7aa8', '#ffc2d6'] },
  { id: 'note', name: '음표', price: 200, icon: '🎵', colors: ['#8f7bff', '#c2b8ff'] },
  { id: 'rainbow', name: '무지개', price: 300, icon: '🌈', colors: ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#b983ff'] },
];

// 보기 색 + 모양 (번호 대신)
export const ANSWER_STYLE = [
  { name: '빨강', hex: '#ff5a6e', dark: '#c9304a', shape: '●' },
  { name: '파랑', hex: '#3f8cff', dark: '#1f5fc7', shape: '▲' },
  { name: '노랑', hex: '#ffc02e', dark: '#d68b00', shape: '■' },
  { name: '초록', hex: '#32c97a', dark: '#169350', shape: '★' },
];

export const ROUNDS = [
  { id: 'doors', name: '정답 문 대시', icon: '🚪', rule: '정답이 적힌 문으로 돌진! 틀린 문은 띠용~ 튕겨요', how: '벽마다 문제 1개 · 장애물을 피해 결승선까지', bgm: 'round_a' },
  { id: 'tiles', name: '젤리 발판 서바이벌', icon: '🟩', rule: '시간 안에 정답 발판 위로! 틀린 발판은 떨어져요', how: '문제 8개 · 회전 막대는 점프로 넘어요', bgm: 'round_b' },
  { id: 'balloons', name: '정답 풍선 사냥', icon: '🎈', rule: '정답 풍선을 먼저 터뜨려요! 한 문제에 하나만', how: '문제 6개 · 높은 풍선은 트램펄린으로', bgm: 'round_a' },
  { id: 'tower', name: '결승: 왕관 구름 계단', icon: '👑', rule: '정답 점프대를 밟고 위로! 꼭대기 왕관을 잡아요', how: '점프대 문제 4개 · 왕관을 먼저 잡으면 우승', bgm: 'final' },
];
export const roundById = id => ROUNDS.find(r => r.id === id);

// 봇 이름
export const BOT_NAMES = ['콩콩', '몽실', '토리', '구름', '하루', '별이', '두부', '쿠키', '라온', '단비', '보미', '찰떡', '젤리', '솜솜'];

// 봇 난이도: 정답률, 반응 시간, 움직임 실수
export const BOT_LEVEL = {
  easy: { acc: 0.45, react: [1.6, 3.2], speed: 0.86, slip: 0.35 },
  normal: { acc: 0.62, react: [1.1, 2.4], speed: 0.93, slip: 0.2 },
  hard: { acc: 0.78, react: [0.7, 1.6], speed: 0.99, slip: 0.1 },
};
