// 게임 데이터: 캐릭터, 치장, 라운드, 보기 색

// 캐릭터 10종 (미니 유물레이더스 대원 5 + 같은 스타일로 새로 만든 5). 능력치는 없다(모두 공정). animal 칸 = 직업
export const CHARACTERS = [
  { id: 'scout', name: '안테나', animal: '탐험가', desc: '고글과 안테나로 정답 신호를 잡는 꼬마 탐험가', price: 0 },
  { id: 'rifle', name: '방울', animal: '물보라꾼', desc: '물감 탱크를 메고 씩씩하게 달리는 대원', price: 0 },
  { id: 'brawler', name: '단단', animal: '망치꾼', desc: '커다란 장갑으로 문도 쾅! 힘센 친구', price: 0 },
  { id: 'kitty', name: '냥냥', animal: '고양이 후드', desc: '헤드폰을 걸고 사뿐사뿐 달리는 고양이 소녀', price: 0 },
  { id: 'robot', name: '삐빅', animal: '로봇', desc: '화면 얼굴로 웃는 똑똑한 꼬마 로봇', price: 300 },
  { id: 'inventor', name: '뚝딱', animal: '발명가', desc: '공구 벨트에 무엇이든 고치는 꼬마 발명가', price: 300 },
  { id: 'bomber', name: '퐁퐁', animal: '풍선꾼', desc: '물감 풍선을 주렁주렁 단 우주 꼬마', price: 400 },
  { id: 'sniper', name: '모노', animal: '치유사', desc: '외눈 렌즈로 문제를 꼼꼼히 살피는 친구', price: 400 },
  { id: 'wizard', name: '반짝', animal: '마법사', desc: '두꺼운 책을 멘 별빛 꼬마 마법사', price: 500 },
  { id: 'knight', name: '용감', animal: '꼬마 기사', desc: '둥근 방패를 멘 용감한 꼬마 기사', price: 500 },
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
  { id: 'paint', name: '정답 물감 땅따먹기', icon: '🎨', rule: '정답 물감통에 뛰어들면 내 색 물감이 묻어요! 달리는 곳마다 내 땅', how: '문제 6개 · 가장 넓게 칠하면 보너스 별', bgm: 'round_a' },
  // 2026-11-05 추가 4종 (밀기·통과·거꾸로 달리기·들고 나르기)
  { id: 'ball', name: '정답 공 골인', icon: '⚽', rule: '보기 공을 다 같이 밀어서 정답 공을 골대에! 틀린 공은 골대가 뱉어요', how: '문제 5개 · 민 사람 모두 별, 넣은 사람은 1개 더', bgm: 'round_b' },
  { id: 'hoops', name: '정답 링 통과', icon: '⭕', rule: '정답 고리를 통과해요! 높은 고리는 트램펄린으로 튀어 올라요', how: '문제 5개 · 먼저 통과할수록 별 3·2·1', bgm: 'round_a' },
  { id: 'belt', name: '정답 과일 컨베이어', icon: '🍓', rule: '뒤로 흐르는 길을 거꾸로 달리며 정답 과일만 냠! 틀린 과일은 퉁', how: '문제 5개 · 한 문제에 정답 과일 2개까지', bgm: 'round_b' },
  { id: 'parcel', name: '정답 택배 배달', icon: '📦', rule: '정답 택배를 번쩍 들고 우체통에 쏙! 다이브로 빼앗을 수 있어요', how: '문제 5개 · 정답 택배는 문제마다 3개뿐', bgm: 'round_a' },
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
