// Synthesized WebAudio: no samples, no files. A low pad-and-bass loop is the
// night; short voices sit on top — burn crackle, a hunter's bite, the harvest
// chime, the pulse. The context only starts on a user gesture (the title
// screen's click), and every call is a no-op before that, so staged screenshot
// scenes stay silent and safe.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let step = 0;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startMusic();
  }

  function tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, vol = 0.2, delay = 0, attack = 0.005 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.2, delay = 0, freq = 1200, q = 0.8 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  /** A slow two-oscillator pad + a soft bass pulse, Dm-ish, 100 BPM eighth notes. */
  function startMusic() {
    const bass = [55, 55, 65.4, 55, 49, 49, 58.3, 73.4]; // A1 A1 C2 A1 G1 G1 Bb1 D2
    const sparkle = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392];
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const i = step % 8;
      tone({ freq: bass[i], type: 'triangle', dur: 0.42, vol: 0.16 });
      if (step % 2 === 0) tone({ freq: bass[i] * 2, type: 'sine', dur: 0.3, vol: 0.05 });
      if (step % 16 === 8) tone({ freq: sparkle[(step >> 1) % 8], type: 'sine', dur: 0.5, vol: 0.035 });
      step += 1;
    }, 300);
  }

  return {
    start,
    /** A hollow catches fire: dry crackle + a falling minor chirp. */
    burn() { noise({ dur: 0.16, vol: 0.16, freq: 2600, q: 0.6 }); tone({ freq: 620, freqEnd: 190, type: 'sawtooth', dur: 0.14, vol: 0.06 }); },
    /** A mote is eaten: the light goes out with a tiny inverted blip. */
    eaten() { tone({ freq: 880, freqEnd: 220, type: 'sine', dur: 0.09, vol: 0.08 }); },
    /** The drone is bitten. */
    hurt() { tone({ freq: 160, freqEnd: 60, type: 'square', dur: 0.18, vol: 0.16 }); noise({ dur: 0.12, vol: 0.1, freq: 500 }); },
    /** Pulse: a warm outward whoosh. */
    pulse() { noise({ dur: 0.32, vol: 0.2, freq: 700, q: 0.4 }); tone({ freq: 180, freqEnd: 420, type: 'sine', dur: 0.28, vol: 0.1 }); },
    /** Bloom harvested: three rising chimes. */
    harvest() { [523.25, 659.25, 783.99].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.34, vol: 0.12, delay: i * 0.07 })); },
    /** A new wave arrives: two low warnings. */
    wave() { tone({ freq: 98, type: 'triangle', dur: 0.4, vol: 0.2 }); tone({ freq: 98, type: 'triangle', dur: 0.4, vol: 0.2, delay: 0.22 }); },
    /** Upgrade chosen. */
    upgrade() { [392, 523.25, 659.25, 783.99].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.1, delay: i * 0.06 })); },
    /** The Undershepherd enters. */
    boss() { tone({ freq: 65, freqEnd: 41, type: 'sawtooth', dur: 1.1, vol: 0.22 }); tone({ freq: 130, freqEnd: 82, type: 'sawtooth', dur: 1.1, vol: 0.1, delay: 0.05 }); },
    /** The light goes out. */
    over() { tone({ freq: 330, freqEnd: 55, type: 'triangle', dur: 1.4, vol: 0.2 }); },
    stop() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; },
  };
}
