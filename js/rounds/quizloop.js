// 새 라운드 4종(공 골인·링 통과·과일 컨베이어·택배 배달)이 함께 쓰는 문제 진행:
// 쉬는 틈(gap) → 문제(ask, 시간 제한) → 정답 공개(show) → 다음 문제 … → 끝(done)
// 친구와 할 때는 방장이 문제 시작('qa')과 끝('qc')을 알리고 친구 기기는 따라간다(소식이 늦으면 스스로 넘어간다).
import { hud } from '../game/hud.js';
import { audio } from '../audio.js';
import { speakQuestion, stopSpeak } from '../tts.js';
import { answerTime } from '../quiz.js';
import { rand, pickWeighted } from '../game/session.js';

export class QuizLoop {
  // hooks(라운드에 있으면 부른다): onAsk(q, qi) · onClose(q) · onShowEnd(q) · onDone() · allDone(q) → true면 일찍 끝
  constructor(round, { extra = 3, gap = 1.3, show = 2.2, first = 0.6 } = {}) {
    this.r = round; this.s = round.s; this.qs = round.qs;
    this.extra = extra; this.gap = gap; this.show = show; this.first = first;
    this.qi = -1; this.state = 'wait'; this.stT = 0; this.T = 1; this.lastSec = -1;
    this.guest = !!(this.s.opts.net && !this.s.isHost);
  }
  get q() { return this.qs[this.qi]; }
  get asking() { return this.state === 'ask'; }
  get elapsed() { return this.T - this.stT; }
  get left() { return Math.max(0, this.stT); }
  get last() { return this.qi >= this.qs.length - 1; }
  start() { this.state = 'gap'; this.stT = this.first; }
  update(dt) {
    const st = this.state;
    if (st === 'wait' || st === 'done') return;
    this.stT -= dt;
    if (st === 'gap') {
      // 친구 기기는 방장 소식을 기다리되, 4초가 넘으면 스스로 다음 문제로
      if (this.stT <= 0 && (!this.guest || this.stT < -4)) this.ask(this.qi + 1);
    } else if (st === 'ask') {
      hud.timer(this.left / this.T, this.left);
      const sec = Math.ceil(this.left);
      if (sec !== this.lastSec) { this.lastSec = sec; if (sec <= 3 && sec > 0) audio.play('tick'); }
      if (!this.guest && (this.stT <= 0 || this.r.allDone?.(this.q))) this.close();
      else if (this.guest && this.stT < -1.5) this.close();
    } else if (st === 'show' && this.stT <= 0) {
      hud.hideQuestion();
      this.r.onShowEnd?.(this.q);
      if (this.last) { this.state = 'done'; this.r.onDone?.(); }
      else { this.state = 'gap'; this.stT = this.gap; }
    }
  }
  ask(qi) {
    if (qi >= this.qs.length) { this.state = 'done'; this.r.onDone?.(); return; }
    const s = this.s;
    this.qi = qi;
    const q = this.q;
    this.T = answerTime(q) + this.extra; this.stT = this.T; this.lastSec = -1;
    this.state = 'ask';
    for (const p of s.players) p.qa = { ans: null, ok: false, n: 0 };
    hud.question(q, { label: `문제 ${qi + 1}/${this.qs.length}` });
    hud.progress(`문제 ${qi + 1}/${this.qs.length}`);
    speakQuestion(q);
    audio.play('whoosh', { vol: 0.5 });
    for (const p of s.players) if (p.bot) {
      const lv = s.level;
      p.bot.decideT = rand(...lv.react) * 1.1 + rand(0, 1.4);
      p.bot.pick = pickWeighted(q.a, q.c.length, lv.acc);
      p.bot.goal = null;
    }
    if (s.opts.net && s.isHost) s.opts.net.event('qa', { qi });
    this.r.onAsk?.(q, qi);
  }
  close() {
    if (this.state !== 'ask') return;
    const s = this.s, q = this.q;
    this.state = 'show'; this.stT = this.show;
    stopSpeak();
    for (const p of s.players) if (!p.remote && p.qa.ans == null) s.answer(p, q, false, -1);
    const me = s.me;
    if (me) { if (!me.qa.ok) { hud.reveal(q, me.qa.ans == null ? null : false, 2.6); if (me.qa.ans == null) audio.play('wrong', { vol: 0.4 }); } }
    hud.mark(q.a, true); hud.timer(null);
    if (s.opts.net && s.isHost) s.opts.net.event('qc', { qi: this.qi });
    this.r.onClose?.(q);
  }
  // 이 문제에서 p가 처음 고른 보기를 기록한다(두 번째부터는 기록하지 않음). 맞았는지 돌려준다
  record(p, i) {
    const q = this.q; if (!q || !p.qa) return false;
    const ok = i === q.a;
    if (p.qa.ans != null) return ok;
    p.qa.ans = i; p.qa.ok = ok;
    if (!p.remote) this.s.answer(p, q, ok, i);
    if (p.me) { hud.mark(i, ok); if (ok) hud.reveal(q, true, 2.4); }
    return ok;
  }
  // 정답을 늦게 맞혔을 때(처음엔 틀렸다가) 내 화면만 정답 표시
  markLater(p, i) { if (p.me) hud.mark(i, i === this.q?.a); }
  botReady(p) { return this.asking && p.bot && this.elapsed > p.bot.decideT; }
  onNet(m) {
    if (!this.guest) return false;
    if (m.k === 'qa') { if (m.qi > this.qi) { if (this.state === 'ask') this.close(); this.ask(m.qi); } return true; }
    if (m.k === 'qc') { if (m.qi === this.qi && this.state === 'ask') this.close(); return true; }
    return false;
  }
}

// 같은 씨앗이면 기기마다 같은 순서가 나오는 난수
export function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function roundSeed(s, qi, salt = 0) { return Math.floor((s.opts.net?.seed ?? (s.localSeed ??= Math.floor(Math.random() * 1e9))) + qi * 7919 + salt * 104729); }
export function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
