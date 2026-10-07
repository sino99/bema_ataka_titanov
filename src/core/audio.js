// Синтезированные звуки (WebAudio). Любой вызов безопасен, даже если контекст не готов.
export function createAudio() {
  let ac = null, master = null, noiseBuf = null, music = null;
  const A = { muted: false, unlock, play, setMuted };

  function init() {
    if (ac) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain(); master.gain.value = A.muted ? 0 : 0.7;
      master.connect(ac.destination);
      const len = ac.sampleRate * 2;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (_) { ac = null; return false; }
  }

  let musicTried = false;
  function unlock() {
    try {
      if (!init()) return;
      if (ac.state === 'suspended') ac.resume();
      if (!musicTried) {
        musicTried = true;
        fetch('/audio/theme.mp3', { method: 'HEAD' }).then((r) => {
          const ct = r.headers.get('content-type') || '';
          if (r.ok && !ct.includes('text/html')) {
            music = new Audio('/audio/theme.mp3');
            music.loop = true; music.volume = 0.4; music.muted = A.muted;
            music.play().catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (_) {}
  }

  function setMuted(m) {
    A.muted = m;
    if (master) master.gain.value = m ? 0 : 0.7;
    if (music) music.muted = m;
  }

  // --- помощники ---
  function noise(t, dur, type, f0, f1, q, g0, g1) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(g0, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(Math.max(g1, 0.0001), t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function osc(t, dur, type, f0, f1, g0) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const SOUNDS = {
    click: (t) => osc(t, 0.04, 'square', 1800, 900, 0.05),
    whoosh: (t) => noise(t, 0.5, 'bandpass', 300, 3000, 1.2, 0.5, 0.01),
    hook: (t) => { osc(t, 0.05, 'square', 2600, 1400, 0.12); noise(t + 0.03, 0.22, 'bandpass', 800, 4500, 3, 0.25, 0.01); },
    slash: (t) => noise(t, 0.12, 'highpass', 3500, 0, 0.7, 0.55, 0.01),
    hit: (t) => { osc(t, 0.2, 'sine', 160, 45, 0.6); noise(t, 0.15, 'lowpass', 900, 0, 0.7, 0.4, 0.01); },
    titanStep: (t) => osc(t, 0.3, 'sine', 50, 38, 0.3),
    titanDie: (t) => { noise(t, 1.6, 'lowpass', 2200, 400, 0.7, 0.4, 0.01); osc(t, 1.2, 'sawtooth', 300, 50, 0.15); },
    steam: (t) => noise(t, 1.0, 'highpass', 1800, 0, 0.7, 0.3, 0.01),
    win: (t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => osc(t + i * 0.11, 0.5, 'triangle', f, 0, 0.25)),
    lose: (t) => [392, 311.13, 261.63, 196].forEach((f, i) => osc(t + i * 0.2, 0.6, 'triangle', f, 0, 0.25))
  };

  function play(name) {
    try {
      if (A.muted || !ac || ac.state !== 'running') return;
      const f = SOUNDS[name];
      if (f) f(ac.currentTime + 0.005);
    } catch (_) {}
  }
  return A;
}
