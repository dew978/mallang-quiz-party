// 문제 읽어 주기: 브라우저에 있는 한국어 음성으로 문제와 보기를 읽는다 (인터넷·서버 필요 없음)
import { save } from './save.js';
import { ANSWER_STYLE } from './data/game.js';

let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices?.() || [];
  voice = vs.find(v => /ko/i.test(v.lang) && /google|yuna|heami|sunhi/i.test(v.name)) || vs.find(v => /ko/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function ttsOn() {
  const m = save.settings.tts;
  if (!window.speechSynthesis || save.settings.sfx <= 0.01) return false;
  return m === 'on' || (m === 'auto' && save.grade <= 2);
}
export function speakQuestion(q, force = false) {
  if (!q || (!force && !ttsOn()) || !window.speechSynthesis) return;
  stopSpeak();
  // 수식 기호를 말로 바꾼다
  const say = s => String(s).replace(/×/g, ' 곱하기 ').replace(/÷/g, ' 나누기 ').replace(/\+/g, ' 더하기 ').replace(/(\d)\s*-\s*(\d)/g, '$1 빼기 $2')
    .replace(/=\s*\?/g, ' 는? ').replace(/□/g, ' 네모 ').replace(/\//g, ' 분의 ');
  const text = say(q.q) + '. ' + q.c.map((c, i) => `${ANSWER_STYLE[i].name}, ${say(c)}`).join('. ');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = save.grade <= 2 ? 0.92 : 1.05; u.pitch = 1.1; u.volume = Math.min(1, save.settings.sfx + 0.2);
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
export function stopSpeak() { try { window.speechSynthesis?.cancel(); } catch (e) { /* 무시 */ } }
