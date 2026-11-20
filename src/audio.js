// Procedural audio (WebAudio, no asset files): night ambience music + sound effects.
// Presentation only; the simulation never depends on it.
export function createAudio(getVolume) {
  let ctx = null, master = null, musicTimer = null, step = 0, drone = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = getVolume();
      master.connect(ctx.destination);
    } catch { ctx = null; }
    return ctx;
  }
  const setVolume = (v) => { if (master) master.gain.value = v; };

  function tone(freq, dur, { vol = 0.2, type = 'sine', slide = 0, delay = 0, attack = 0.005 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  const A = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
  const PATTERN = [0, 2, 4, 2, 3, 5, 4, 2, 1, 3, 4, 6, 5, 3, 2, 0];
  function startMusic() {
    if (musicTimer || !ensure()) return;
    if (!drone) {
      drone = ctx.createOscillator();
      const g = ctx.createGain();
      drone.type = 'sine'; drone.frequency.value = 110; g.gain.value = 0.035;
      drone.connect(g).connect(master); drone.start();
    }
    musicTimer = setInterval(() => {
      const n = PATTERN[step++ % PATTERN.length];
      tone(A[n], 1.4, { vol: 0.05, type: 'triangle', attack: 0.05 });
      if (step % 8 === 1) tone(A[n] / 2, 3.2, { vol: 0.04, type: 'sine', attack: 0.4 });
    }, 650);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  const sfx = {
    pick: (carried = 1) => tone(660 + carried * 55, 0.14, { vol: 0.12, type: 'sine' }),
    deposit: () => { tone(440, 0.25, { vol: 0.12, type: 'triangle' }); tone(660, 0.2, { vol: 0.07, type: 'sine', delay: 0.05 }); },
    light: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.9, { vol: 0.12, type: 'triangle', delay: i * 0.08 })),
    pulse: () => { tone(180, 0.5, { vol: 0.16, type: 'sawtooth', slide: 500 }); tone(900, 0.4, { vol: 0.07, type: 'sine', slide: -600 }); },
    hit: () => { tone(150, 0.35, { vol: 0.22, type: 'square', slide: -80 }); tone(80, 0.4, { vol: 0.15, type: 'sawtooth', delay: 0.02 }); },
    jump: () => tone(300, 0.18, { vol: 0.1, type: 'sine', slide: 260 }),
    dash: () => { tone(500, 0.2, { vol: 0.09, type: 'sawtooth', slide: -300 }); tone(1000, 0.15, { vol: 0.05, type: 'sine', slide: -400, delay: 0.05 }); },
    charm: () => [784, 988, 1175, 1480].forEach((f, i) => tone(f, 0.3, { vol: 0.1, type: 'square', delay: i * 0.07 })),
    steal: () => tone(700, 0.3, { vol: 0.12, type: 'triangle', slide: -450 }),
    spawn: () => { tone(110, 0.6, { vol: 0.14, type: 'sawtooth', slide: 40 }); tone(55, 0.8, { vol: 0.08, type: 'sine', delay: 0.1 }); },
    tick: (urgent) => tone(urgent ? 1200 : 900, 0.08, { vol: urgent ? 0.14 : 0.08, type: 'square' }),
    win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.9, { vol: 0.13, type: 'triangle', delay: i * 0.12 })),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.8, { vol: 0.13, type: 'sine', delay: i * 0.2 })),
    click: () => tone(600, 0.06, { vol: 0.08, type: 'square' }),
    step: () => tone(120 + Math.random() * 50, 0.05, { vol: 0.03, type: 'triangle' }),
    bell: () => [440, 554, 660].forEach((f, i) => tone(f, 1.8, { vol: 0.05, type: 'sine', delay: i * 0.03, attack: 0.02 })),
  };
  return { ensure, setVolume, startMusic, stopMusic, sfx };
}
