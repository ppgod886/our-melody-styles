/* ============================================================
   《我们的乐章》音频引擎 —— 主题化版本
   音阶、音色、节奏、混响全部由 members.js 里的 window.AUDIO_CFG 定义，
   同一套引擎可以演奏水墨古筝 / 多巴胺马林巴 / Y2K合成器 / 爵士钢琴 / 星空铃音。
   ============================================================ */

const AudioEngine = (() => {
  const T = window.AUDIO_CFG;

  let ctx = null, master, comp, conv, wet, loopBus, soloBus;
  let delayNode = null, delayFb = null, delayWet = null;
  let mode = 'idle';            // idle | full | solo | finale
  let activeSection = -1;
  let step = 0, nextT = 0, timer = null;
  let droneOsc = null;

  const BPM = T.bpm;
  const STEP_DUR = 60 / BPM / 2;
  const FULL_LEN = 64;
  const SOLO_LEN = 16;

  /* 音名 → 频率（主题映射表优先，标准音名兜底） */
  const NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(name) {
    if (T.pitch && T.pitch[name]) return T.pitch[name];
    const m = /^([A-Ga-g])([#b♯♭]?)(\d)$/.exec((name || '').trim());
    if (!m) return null;
    let semi = NOTE_SEMI[m[1].toUpperCase()];
    if (m[2] === '#' || m[2] === '♯') semi += 1;
    if (m[2] === 'b' || m[2] === '♭') semi -= 1;
    const midi = 12 * (parseInt(m[3], 10) + 1) + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ---- 名单映射：把原编曲按声部搬到任意人数的新名单上 ---- */
  let FULL_PATTERN = [];
  let SOLO_PATTERNS = [];
  let boosts = new Array(MEMBERS.length).fill(1);
  let SEC_START = [0, 5, 10], SEC_SIZE = [5, 5, 5];
  const OLD_START = [0, 5, 10];

  function rebuild(members) {
    members.sort((x, y) => x.section - y.section);   // 稳定排序：保证"下标=声部起点+序号"
    const n = members.length;
    boosts = new Array(n).fill(1);

    SEC_SIZE = [0, 0, 0];
    members.forEach(m => SEC_SIZE[m.section]++);
    SEC_START = [0, SEC_SIZE[0], SEC_SIZE[0] + SEC_SIZE[1]];

    const mapIdx = mi => {
      const s = mi < 5 ? 0 : mi < 10 ? 1 : 2;
      const k = mi - OLD_START[s];
      return SEC_START[s] + (k % Math.max(1, SEC_SIZE[s]));
    };

    FULL_PATTERN = [];
    const used = new Set();
    for (const ev of T.full) {
      const mi = mapIdx(ev[1]);
      FULL_PATTERN.push([ev[0], mi, ev[2], ev[3]]);
      used.add(mi);
    }
    members.forEach((m, mi) => {
      if (used.has(mi)) return;
      const slot = (((mi - SEC_START[m.section]) % 8) + 8) % 8;
      FULL_PATTERN.push([(slot * 8 + 2 + m.section * 2) % 64, mi, 2, 0.38]);
    });

    SOLO_PATTERNS = T.solos.map((pat, s) =>
      pat.map(ev => {
        const k = ev[1] - OLD_START[s];
        return [ev[0], SEC_START[s] + (k % Math.max(1, SEC_SIZE[s])), ev[2], ev[3]];
      })
    );

    if (ctx && mode !== 'idle') startFull();
  }
  rebuild(MEMBERS);

  function init() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 4;
    comp.connect(ctx.destination);

    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp);

    conv = ctx.createConvolver();
    conv.buffer = makeImpulse(T.reverb.time, T.reverb.decay);
    wet = ctx.createGain(); wet.gain.value = T.reverb.wet;
    master.connect(conv); conv.connect(wet); wet.connect(comp);

    if (T.delay && T.delay.time > 0) {
      delayNode = ctx.createDelay(1.5);
      delayNode.delayTime.value = T.delay.time;
      delayFb = ctx.createGain(); delayFb.gain.value = T.delay.feedback;
      delayWet = ctx.createGain(); delayWet.gain.value = T.delay.wet;
      master.connect(delayNode); delayNode.connect(delayFb);
      delayFb.connect(delayNode); delayNode.connect(delayWet); delayWet.connect(comp);
    }

    if (T.drone) {
      droneOsc = ctx.createOscillator();
      droneOsc.type = 'sine';
      droneOsc.frequency.value = T.drone.freq;
      const dg = ctx.createGain();
      dg.gain.value = 0;
      dg.gain.setTargetAtTime(T.drone.gain, ctx.currentTime + 0.5, 2);
      droneOsc.connect(dg); dg.connect(comp);
      droneOsc.start();
    }

    if (T.crackle > 0) {
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.996 ? 0.15 : 1);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const cg = ctx.createGain(); cg.gain.value = T.crackle;
      src.connect(cg); cg.connect(comp);
      src.start();
    }

    loopBus = ctx.createGain(); loopBus.gain.value = 0; loopBus.connect(master);
    soloBus = ctx.createGain(); soloBus.gain.value = 0; soloBus.connect(master);

    nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 40);
  }

  function makeImpulse(dur, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* 主题音色：主振荡 + 可选第二振荡 + 可选高倍泛音 + 低通 + 主题包络 */
  function voice(mi, t, dur, vel, bus) {
    const m = MEMBERS[mi], tb = m.timbre, f = noteFreq(m.pitch) || 261.63;
    vel = Math.min(1, vel);
    const V = T.voice;
    if (!['sine','triangle','sawtooth','square'].includes(tb.wave)) tb.wave = 'sine';

    const g = ctx.createGain(); g.gain.value = 0;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = V.cutoff * (tb.cutoff / 1600);
    flt.Q.value = V.q || 0.6;
    flt.connect(g); g.connect(bus);

    const oscs = [];
    const o1 = ctx.createOscillator();
    o1.type = V.overrideWave || tb.wave;
    o1.frequency.value = f;
    o1.detune.value = (mi % 2 ? V.detune : -V.detune);
    o1.connect(flt); o1.start(t); oscs.push(o1);

    if (V.wave2) {
      const o2 = ctx.createOscillator();
      o2.type = V.wave2; o2.frequency.value = f;
      const g2 = ctx.createGain(); g2.gain.value = V.wave2Gain;
      o2.connect(g2); g2.connect(flt); o2.start(t); oscs.push(o2);
    }
    if (V.shimmer > 0) {
      const o3 = ctx.createOscillator();
      o3.type = 'sine'; o3.frequency.value = f * 2;
      const g3 = ctx.createGain(); g3.gain.value = V.shimmer;
      o3.connect(g3); g3.connect(flt); o3.start(t); oscs.push(o3);
    }

    const a = V.attack, rel = V.release, end = t + Math.max(dur, 0.25);
    const peak = vel * tb.vol;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * V.sustainLevel, t + a, Math.max(dur, 0.25) * V.decay);
    g.gain.setTargetAtTime(0.0001, end, rel);
    const stopAt = end + rel * 6;
    oscs.forEach(o => o.stop(stopAt));

    /* 延迟总线（Y2K 回声） */
    if (delayNode) { const dg = ctx.createGain(); dg.gain.value = 0.35; g.connect(dg); dg.connect(delayNode); }
  }

  function subSwell(t) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 65.41;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 1.8);
    g.gain.setTargetAtTime(0.0001, t + 7, 1.2);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 11);
  }

  function rolledChord(t, baseVel) {
    const secVel = T.finaleVel;
    MEMBERS.forEach((m, i) => voice(i, t + i * 0.07, 9, baseVel * secVel[m.section], master));
    subSwell(t + 0.2);
  }

  function schedule() {
    if (mode === 'idle') return;
    if (nextT < ctx.currentTime - 0.25) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.18) {
      if (mode === 'full') {
        const s = step % FULL_LEN;
        for (const ev of FULL_PATTERN) {
          if (ev[0] === s) voice(ev[1], nextT, ev[2] * STEP_DUR, ev[3], loopBus);
        }
      } else if (mode === 'solo') {
        const s = step % SOLO_LEN;
        for (const ev of SOLO_PATTERNS[activeSection]) {
          if (ev[0] === s) voice(ev[1], nextT, ev[2] * STEP_DUR, ev[3] * boosts[ev[1]], soloBus);
        }
      } else if (mode === 'finale') {
        const s = step % 32;
        if (s === 0) rolledChord(nextT, 0.62);
        if (s === 16) {
          const midStart = SEC_START[1];
          for (let k = 0; k < Math.min(3, SEC_SIZE[1]); k++)
            voice(midStart + k, nextT + k * 0.03, 6, 0.26, master);
        }
        if (s % 4 === 2) {
          const hi = SEC_START[2] + Math.floor(Math.random() * Math.max(1, SEC_SIZE[2]));
          voice(hi, nextT, 2.5, 0.15 * boosts[hi], master);
        }
      }
      step++; nextT += STEP_DUR;
    }
  }

  function startFull() {
    if (!ctx) return;
    ctx.resume();
    mode = 'full'; step = 0; nextT = ctx.currentTime + 0.08;
    const now = ctx.currentTime;
    loopBus.gain.setTargetAtTime(0.9, now, 0.5);
    soloBus.gain.setTargetAtTime(0, now, 0.3);
  }

  function solo(section) {
    if (!ctx) return;
    ctx.resume();
    mode = 'solo'; activeSection = section; step = 0;
    const now = ctx.currentTime;
    loopBus.gain.setTargetAtTime(0.07, now, 0.4);
    soloBus.gain.setTargetAtTime(0.95, now, 0.25);
  }

  function returnFull() { if (ctx) startFull(); }

  function accent(mi) {
    if (!ctx) return;
    ctx.resume();
    const bus = (mode === 'full') ? loopBus : (mode === 'solo' ? soloBus : master);
    voice(mi, ctx.currentTime + 0.02, 2.4, 0.85 * boosts[mi], bus);
  }

  function lightUp(mi) { boosts[mi] = 1.65; }

  function finale() {
    if (!ctx) return;
    mode = 'finale'; step = 1;   // 跳过调度器 s=0，避免与 rolledChord 直呼叠两次
    const now = ctx.currentTime;
    nextT = now + 0.15;
    loopBus.gain.setTargetAtTime(0, now, 0.3);
    soloBus.gain.setTargetAtTime(0, now, 0.3);
    rolledChord(now + 0.18, 0.72);
  }

  function reset() {
    boosts.fill(1);
    if (ctx) startFull(); else mode = 'idle';
  }

  return { init, startFull, solo, returnFull, accent, lightUp, finale, reset, rebuild, noteFreq };
})();
