// 파티 진행: 라운드 순서 → 라운드마다 Session → 사이사이 별판 → 마지막 결과
import { Session } from './session.js';
import { questionSet } from '../quiz.js';
import { save, persist } from '../save.js';
import { ROUNDS, roundById, CHARACTERS, BOT_NAMES } from '../data/game.js';
import { audio } from '../audio.js';
import { hud } from './hud.js';

const loaders = {
  doors: () => import('../rounds/doors.js').then(m => m.DoorsRound),
  tiles: () => import('../rounds/tiles.js').then(m => m.TilesRound),
  balloons: () => import('../rounds/balloons.js').then(m => m.BalloonsRound),
  tower: () => import('../rounds/tower.js').then(m => m.TowerRound),
};
export const Q_PER_ROUND = { doors: 4, tiles: 8, balloons: 6, tower: 4 };

export function roundOrder(mode) {
  if (mode !== 'show') return [mode];
  const a = ['doors', 'tiles', 'balloons'].sort(() => Math.random() - 0.5);
  return [...a, 'tower'];
}

// 혼자 할 때 참가자: 나 + 봇 11명 (캐릭터·모자 고루)
export function soloRoster(n = 12) {
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  const hats = ['none', 'none', 'flower', 'bow', 'cap', 'headset', 'goggles', 'horn', 'wizard', 'helmet', 'crown', 'none'];
  const list = [{ pid: 'me', name: save.settings.name || '나', charId: save.selChar, hat: save.equip.hat, trail: save.equip.trail, me: true }];
  for (let i = 1; i < n; i++) {
    const ch = CHARACTERS[(i + 2) % CHARACTERS.length];
    list.push({ pid: 'bot' + i, name: names[i % names.length], charId: ch.id, hat: hats[(i * 5) % hats.length], trail: 'none', bot: true });
  }
  return list;
}

export class Party {
  // ui: { showBoard(rows, next, onGo), showResult(res), setLoading(on) }
  constructor({ mode, roster, net = null, ui, fixedOrder = null, questionsFor = null }) {
    this.mode = mode; this.ui = ui; this.net = net;
    this.order = fixedOrder || roundOrder(mode);
    this.roster = roster;
    this.totals = Object.fromEntries(roster.map(r => [r.pid, 0]));
    this.coins = 0; this.wrongs = []; this.correct = 0; this.answered = 0; this.crown = false;
    this.idx = 0; this.session = null; this.questionsFor = questionsFor;
    this.history = [];
  }
  async playNext() {
    const id = this.order[this.idx];
    const RoundClass = await loaders[id]();
    const questions = this.questionsFor ? await this.questionsFor(id, this.idx) : questionSet(Q_PER_ROUND[id]);
    const s = new Session({
      RoundClass, questions, net: this.net, demo: this.demo,
      roster: this.roster.map(r => ({ ...r })),
      onEnd: res => this.roundDone(res),
    });
    s.roundNum = this.idx + 1; s.roundCount = this.order.length;
    for (const p of s.players) p.stars = this.totals[p.pid] || 0;
    this.session = s;
    this.net?.attach(s);
    this.ui.setLoading?.(true);
    await s.build();
    if (this.net) await this.net.waitBegin();
    s.round.info.num = this.order.length > 1 ? (id === 'tower' && this.order.length > 1 ? '결승 라운드' : `${this.idx + 1}라운드`) : '연습';
    this.ui.setLoading?.(false);
    this.ui.enterGame?.(s);
    s.start();
    return s;
  }
  roundDone(res) {
    const prev = { ...this.totals };
    for (const p of res.players) this.totals[p.pid] = p.stars;
    const me = res.players.find(p => p.me);
    if (me) { this.coins += me.coins; this.correct += me.correct; this.answered += me.total; }
    this.wrongs.push(...res.wrongs);
    if (this.session.round.crownBy === 'me') this.crown = true;
    this.history.push({ id: this.order[this.idx], res });
    const rows = this.rows(prev);
    this.ui.exitGame?.(this.session);
    this.session.dispose(); this.session = null;
    this.idx++;
    if (this.idx < this.order.length) {
      const next = roundById(this.order[this.idx]);
      this.ui.showBoard(rows, next, () => this.playNext());
    } else this.finish(rows);
  }
  rows(prev = {}) {
    return this.roster.map(r => ({ ...r, stars: this.totals[r.pid] || 0, gain: (this.totals[r.pid] || 0) - (prev[r.pid] || 0) }))
      .sort((a, b) => b.stars - a.stars || (a.me ? -1 : 1));
  }
  finish(rows) {
    const myRank = rows.findIndex(r => r.me) + 1;
    const myStars = this.totals.me ?? (rows.find(r => r.me)?.stars || 0);
    // 보상: 별 × 5 + 주운 동전 + 순위 보너스
    const rankBonus = [60, 40, 25][myRank - 1] || 10;
    const reward = myStars * 5 + this.coins + rankBonus + (this.crown ? 30 : 0);
    if (this.mode === 'show' || this.order.length > 1) save.stats.parties++;
    if (myRank === 1) save.stats.wins++;
    if (this.crown) save.stats.crowns++;
    save.coins += reward; persist();
    audio.playBgm('result');
    this.ui.showResult({ rows, myRank, myStars, reward, coins: this.coins, rankBonus, crown: this.crown, wrongs: this.wrongs, correct: this.correct, answered: this.answered, single: this.order.length === 1 });
  }
  abort() { if (this.session) { this.ui.exitGame?.(this.session); this.session.dispose(); this.session = null; } hud.show(false); }
}
