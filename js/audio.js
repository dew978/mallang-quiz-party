// 소리: 생성한 효과음/배경음 파일을 쓰고, 없으면 WebAudio 합성음으로 대신한다
import { save } from './save.js';

const ctx = new (window.AudioContext || window.webkitAudioContext)();
const master = ctx.createGain(); master.connect(ctx.destination);
const sfxBus = ctx.createGain(); sfxBus.connect(master);
const bgmBus = ctx.createGain(); bgmBus.connect(master);
const buffers = {};
const GAIN = { hover: 0.5, step: 0.35, tick: 0.6, land: 0.7 };
let manifest = { ext: '.mp3', sfx: [], bgm: [] };
let bgmNode = null, bgmName = null, noiseBuf = null;
const lastPlay = {};

export const audio = {
  ctx,
  async init() {
    applyVolume();
    try { const r = await fetch('assets/audio/manifest.json', { cache: 'no-cache' }); if (r.ok) manifest = await r.json(); } catch (e) { /* 합성음 */ }
    const ext = manifest.ext || '.mp3';
    const jobs = [];
    for (const n of manifest.sfx || []) jobs.push(loadBuf('sfx/' + n + ext, n));
    for (const n of manifest.bgm || []) jobs.push(loadBuf('bgm/' + n + ext, 'bgm_' + n));
    noiseBuf = makeNoise();
    await Promise.allSettled(jobs);
  },
  unlock() { if (ctx.state !== 'running') ctx.resume(); },
  applyVolume,
  // 같은 소리를 너무 자주 겹쳐 내지 않는다(봇 12명이 동시에 점프해도 시끄럽지 않게)
  play(name, { vol = 1, rate = 1, gap = 0.04 } = {}) {
    if (ctx.state !== 'running' || vol <= 0.01) return;
    const now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    vol *= GAIN[name] || 1;
    const buf = buffers[name];
    if (buf) {
      const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = vol;
      s.connect(g); g.connect(sfxBus); s.start();
      return s;
    }
    synth(name, vol, rate);
  },
  playBgm(name) {
    if (bgmName === name) return;
    bgmName = name;
    const t = ctx.currentTime;
    if (bgmNode) { const old = bgmNode; old.g.gain.setTargetAtTime(0, t, 0.35); setTimeout(() => { try { old.s.stop(); } catch (e) {} }, 1800); bgmNode = null; }
    if (!name) return;
    const buf = buffers['bgm_' + name] || buffers['bgm_' + ({ menu: 'title', round_b: 'round_a', final: 'round_a', result: 'title' }[name])];
    if (!buf) { bgmNode = synthBgm(name); return; }
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, t, 0.4);
    s.connect(g); g.connect(bgmBus); s.start();
    bgmNode = { s, g };
  },
  duck(on) { bgmBus.gain.setTargetAtTime(save.settings.bgm * 0.6 * (on ? 0.35 : 1), ctx.currentTime, 0.15); },
};

function applyVolume() {
  sfxBus.gain.value = save.settings.sfx;
  bgmBus.gain.value = save.settings.bgm * 0.6;
}
async function loadBuf(path, name) {
  try {
    const r = await fetch('assets/audio/' + path);
    if (!r.ok) return;
    buffers[name] = await ctx.decodeAudioData(await r.arrayBuffer());
  } catch (e) { /* 그 소리만 합성음 */ }
}
function makeNoise() {
  const b = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// ---- 합성음 (파일이 없을 때) ----
function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, freq = 1000, type = 'lowpass', delay = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
}
function synth(name, v = 1, rate = 1) {
  switch (name) {
    case 'count': tone(660, 0.3, 'square', 0.15 * v); break;
    case 'go': tone(1320, 0.5, 'square', 0.16 * v); tone(990, 0.5, 'triangle', 0.14 * v); break;
    case 'click': tone(900, 0.06, 'triangle', 0.2 * v, 300); break;
    case 'back': tone(700, 0.08, 'triangle', 0.18 * v, -250); break;
    case 'hover': tone(1400, 0.03, 'sine', 0.05 * v); break;
    case 'whoosh': noise(0.3, 0.2 * v, 1800, 'bandpass'); break;
    case 'jump': tone(380 * rate, 0.16, 'sine', 0.2 * v, 420); break;
    case 'land': noise(0.08, 0.2 * v, 400); break;
    case 'step': noise(0.03, 0.06 * v, 900); break;
    case 'dive': noise(0.25, 0.2 * v, 1400, 'bandpass'); break;
    case 'slide': noise(0.3, 0.12 * v, 700); break;
    case 'bonk': tone(220, 0.35, 'sine', 0.3 * v, 260); tone(140, 0.25, 'square', 0.08 * v); break;
    case 'door_burst': noise(0.25, 0.3 * v, 3000, 'highpass'); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.15, 'triangle', 0.12 * v, 0, i * 0.05)); break;
    case 'correct': tone(988, 0.14, 'triangle', 0.22 * v); tone(1319, 0.3, 'triangle', 0.22 * v, 0, 0.11); break;
    case 'wrong': tone(300, 0.2, 'triangle', 0.18 * v, -60); tone(220, 0.3, 'triangle', 0.16 * v, -40, 0.16); break;
    case 'splash': noise(0.5, 0.35 * v, 900); tone(200, 0.3, 'sine', 0.15 * v, -120); break;
    case 'respawn': tone(600, 0.25, 'sine', 0.15 * v, 900); break;
    case 'bounce': tone(180, 0.3, 'sine', 0.3 * v, 500); break;
    case 'launch': tone(200, 0.6, 'sawtooth', 0.1 * v, 900); noise(0.5, 0.2 * v, 1500, 'bandpass'); break;
    case 'hit': noise(0.18, 0.4 * v, 600); tone(120, 0.2, 'square', 0.15 * v, -60); break;
    case 'tick': tone(1600, 0.03, 'square', 0.06 * v); break;
    case 'tile_crack': noise(0.6, 0.25 * v, 300); break;
    case 'tile_drop': noise(0.7, 0.25 * v, 500, 'bandpass'); tone(300, 0.7, 'sine', 0.1 * v, -250); break;
    case 'balloon_pop': noise(0.12, 0.45 * v, 2500, 'bandpass'); break;
    case 'ink': noise(0.35, 0.35 * v, 500); break;
    case 'dizzy': [1800, 2200, 1900].forEach((f, i) => tone(f, 0.08, 'sine', 0.06 * v, 0, i * 0.12)); break;
    case 'star': tone(1700, 0.18, 'sine', 0.12 * v, 900); break;
    case 'coin': tone(1319, 0.07, 'square', 0.1 * v); tone(1760, 0.16, 'square', 0.1 * v, 0, 0.06); break;
    case 'purchase': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16 * v, 0, i * 0.08)); break;
    case 'cheer': noise(1.2, 0.18 * v, 1800, 'bandpass'); break;
    case 'crown': case 'round_start': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.1 * v, 0, i * 0.11)); break;
    case 'round_end': tone(1400, 0.5, 'square', 0.1 * v); [784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15 * v, 0, 0.3 + i * 0.12)); break;
    case 'fall': tone(1200, 0.9, 'sine', 0.1 * v, -900); break;
    default: tone(700, 0.08, 'sine', 0.08 * v);
  }
}
function synthBgm(name) {
  const g = ctx.createGain(); g.gain.value = 0.22; g.connect(bgmBus);
  const sets = { title: [523, 659, 784, 659, 587, 698, 880, 698], final: [440, 523, 659, 784, 659, 523, 494, 587] };
  const notes = sets[name] || [392, 523, 659, 523, 440, 587, 698, 587];
  let i = 0, alive = true;
  const step = () => {
    if (!alive) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = notes[i++ % notes.length];
    const e = ctx.createGain(); e.gain.setValueAtTime(0.3, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + 0.25);
    setTimeout(step, name === 'final' ? 170 : 230);
  };
  step();
  return { s: { stop() { alive = false; } }, g };
}
