// Sound effects: the helicopter is a short recorded-style loop (audio/sfx); everything else, the engines included, is made in
// the browser with WebAudio: horn, footsteps, bumps, chimes, CTrain/bus door bell, city ambience and birds.
let ctx = null, master = null, muted = false;
const S = { eng: null, amb: null, birdT: 3, last: 0, engVol: 1 };
try { S.engVol = +(localStorage.getItem('yyc-engvol') ?? 1); } catch (e) { }
export function setEngineVolume(v) { S.engVol = v; try { localStorage.setItem('yyc-engvol', String(v)); } catch (e) { } }
export const engineVolume = () => S.engVol;
try { muted = localStorage.getItem('yyc-mute') === '1'; } catch (e) { }

function noiseBuf(sec = 2, brown = false) {
  const n = ctx.sampleRate * sec, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
let WHITE = null;
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  WHITE = noiseBuf(1.5);
  // engine: two detuned oscillators through a low-pass, silent until driving
  // plus a soft firing pulse (the cylinders) and a faint upper harmonic so it reads on phone speakers too
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), o3g = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  const puls = ctx.createGain(), pl = ctx.createOscillator(), plg = ctx.createGain();
  o1.type = 'triangle'; o2.type = 'sine'; o3.type = 'sawtooth'; o3g.gain.value = 0.18; lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.8; g.gain.value = 0;
  pl.type = 'sine'; plg.gain.value = 0.22; puls.gain.value = 0.78; pl.connect(plg); plg.connect(puls.gain);
  o1.connect(lp); o2.connect(lp); o3.connect(o3g); o3g.connect(lp); lp.connect(puls); puls.connect(g); g.connect(master); o1.start(); o2.start(); o3.start(); pl.start();
  S.eng = { o1, o2, o3, pl, lp, g };
  // helicopter rotor: filtered noise chopped by a slow square wave, kept soft
  const rs = ctx.createBufferSource(), rbp = ctx.createBiquadFilter(), rchop = ctx.createGain(), rg = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  rs.buffer = noiseBuf(2, true); rs.loop = true; rbp.type = 'lowpass'; rbp.frequency.value = 260; rchop.gain.value = 0.5; lfo.type = 'square'; lfo.frequency.value = 7; lfoG.gain.value = 0.5; rg.gain.value = 0;
  lfo.connect(lfoG); lfoG.connect(rchop.gain); rs.connect(rbp); rbp.connect(rchop); rchop.connect(rg); rg.connect(master); rs.start(); lfo.start();
  S.rotor = { g: rg, lfo };
  // a recorded-style loop for the helicopter (it replaces the made-up rotor once loaded)
  S.loops = {};
  for (const [k, f] of [['rotor', 'rotor']]) {        // (the recorded car and motorbike loops are out: the made-up engine sounds better)
    fetch(`audio/sfx/${f}.mp3`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => {
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; src.loop = true;
      // skip the encoder's silence at both ends so the loop is seamless
      src.loopStart = 0.06; src.loopEnd = buf.duration - 0.06;
      g.gain.value = 0; src.connect(g); g.connect(master); src.start(0, src.loopStart); S.loops[k] = { src, g };
    }).catch(e => console.warn('sound', f, e));
  }
  // city ambience: soft brown-noise hum
  const src = ctx.createBufferSource(), alp = ctx.createBiquadFilter(), ag = ctx.createGain();
  src.buffer = noiseBuf(4, true); src.loop = true; alp.type = 'lowpass'; alp.frequency.value = 420; ag.gain.value = 0.0;
  src.connect(alp); alp.connect(ag); ag.connect(master); src.start(); S.amb = { g: ag, lp: alp };
}
export function setMuted(m) { muted = m; try { localStorage.setItem('yyc-mute', m ? '1' : '0'); } catch (e) { } if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05); }
export const isMuted = () => muted;

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(freq, type, t, a, peak, d, dest = master) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; o.connect(g); g.connect(dest); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05); return o; }
function noise(t, dur, peak, ftype, freq, q = 1) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = WHITE; f.type = ftype; f.frequency.value = freq; f.Q.value = q; s.connect(f); f.connect(g); g.connect(master); env(g, t, 0.004, peak, dur); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
const ok = () => ctx && !muted && ctx.state === 'running';

export const sfx = {
  step(run) { if (!ok()) return; const t = ctx.currentTime; noise(t, run ? 0.07 : 0.06, run ? 0.22 : 0.14, 'bandpass', 700 + Math.random() * 500, 1.2); noise(t, 0.04, 0.08, 'lowpass', 180, 0.7); },
  horn(bike) {
    if (!ok()) return; const t = ctx.currentTime, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bike ? 2600 : 1700; lp.connect(master);
    const fs = bike ? [620] : [392, 494];
    for (const f of fs) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f; o.connect(g); g.connect(lp); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.02); g.gain.setValueAtTime(0.07, t + (bike ? 0.18 : 0.42)); g.gain.exponentialRampToValueAtTime(0.0001, t + (bike ? 0.24 : 0.5)); o.start(t); o.stop(t + 0.6); }
  },
  crash() { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.35, 0.5, 'lowpass', 900, 0.8); tone(70, 'sine', t, 0.005, 0.6, 0.3); noise(t + 0.03, 0.18, 0.15, 'highpass', 3500, 0.7); },
  door() { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.5, 0.12, 'bandpass', 500, 0.8); },
  bell() { if (!ok()) return; const t = ctx.currentTime; tone(659, 'sine', t, 0.01, 0.25, 0.6); tone(523, 'sine', t + 0.32, 0.01, 0.25, 0.9); },     // CTrain / bus chime
  chime() { if (!ok()) return; const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => { tone(f, 'triangle', t + i * 0.11, 0.01, 0.22, 0.5); tone(f * 2, 'sine', t + i * 0.11, 0.01, 0.05, 0.3); }); },
  blip() { if (!ok()) return; const t = ctx.currentTime; tone(880, 'sine', t, 0.005, 0.12, 0.12); tone(1320, 'sine', t + 0.07, 0.005, 0.09, 0.12); },
  click() { if (!ok()) return; tone(1500, 'square', ctx.currentTime, 0.002, 0.04, 0.03); },
  enter() { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.12, 0.25, 'lowpass', 600); noise(t + 0.18, 0.1, 0.3, 'lowpass', 400); },
  chirp(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; const f = 2600 + Math.random() * 1600; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + 0.09); o.connect(g); g.connect(master); env(g, t, 0.01, 0.05, 0.09); o.start(t); o.stop(t + 0.15); },
};

// called every frame: st = { driving, bike, speed (m/s), throttle, day (0..1), cars (nearby moving cars), foot }
export function updateAudio(dt, st) {
  if (!ctx || !S.eng) return;
  const t = ctx.currentTime, e = S.eng;
  const sp = Math.abs(st.speed || 0);
  if (st.driving) {
    // a simple gearbox: the pitch rises through each gear and drops when it shifts
    const gears = st.bike ? [0, 7, 13, 19, 26, 40] : [0, 6, 12, 19, 27, 40]; let gi = 0; while (gi < gears.length - 2 && sp > gears[gi + 1]) gi++;
    const u = (sp - gears[gi]) / (gears[gi + 1] - gears[gi]);
    const base = st.bike ? 60 : 38, f = base * (1 + u * 1.1 + gi * 0.1) * (1 + (st.throttle || 0) * 0.06);
    e.o1.frequency.setTargetAtTime(f, t, 0.08); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.08); e.o3.frequency.setTargetAtTime(f * 2, t, 0.08); e.pl.frequency.setTargetAtTime(f * (st.bike ? 0.5 : 0.25), t, 0.08);
    e.lp.frequency.setTargetAtTime((st.bike ? 320 : 220) + sp * 6 + (st.throttle || 0) * 80, t, 0.1);
    // a soft hum, much quieter than before, and quieter again while the radio plays
    e.g.gain.setTargetAtTime((0.008 + (st.throttle || 0) * 0.004 + Math.min(0.004, sp * 0.00015)) * S.engVol * (st.radio ? 0.6 : 1), t, 0.12);
  } else e.g.gain.setTargetAtTime(0, t, 0.15);
  // the engine loops: pitch (playback speed) rises with speed and throttle, quieter while the radio plays
  const L = S.loops || {}, rad = st.radio ? 0.6 : 1;
  if (L.car || L.bike) {
    if (st.driving) e.g.gain.setTargetAtTime(0, t, 0.1);
    for (const k of ['car', 'bike']) {
      const l = L[k]; if (!l) continue; const on = st.driving && (k === 'bike') === !!st.bike;
      const rate = (k === 'bike' ? 0.75 : 0.7) + Math.min(1.0, sp / 28) * 0.75 + (st.throttle || 0) * 0.12;
      l.src.playbackRate.setTargetAtTime(rate, t, 0.15);
      l.g.gain.setTargetAtTime(on ? (0.22 + (st.throttle || 0) * 0.1 + Math.min(0.12, sp * 0.004)) * S.engVol * rad : 0, t, 0.15);
    }
  }
  if (L.rotor) { L.rotor.g.gain.setTargetAtTime(st.heli ? 0.2 * (st.rotor ?? 1) * rad * S.engVol : 0, t, 0.3); L.rotor.src.playbackRate.setTargetAtTime(0.85 + 0.25 * (st.rotor ?? 1), t, 0.3); if (S.rotor) S.rotor.g.gain.setTargetAtTime(0, t, 0.2); }
  else if (S.rotor) { S.rotor.g.gain.setTargetAtTime(st.heli ? 0.035 * (st.rotor ?? 1) * (st.radio ? 0.7 : 1) : 0, t, 0.3); S.rotor.lfo.frequency.setTargetAtTime(4 + 4 * (st.rotor ?? 1), t, 0.3); }
  // ambience: louder with traffic around, quieter at night
  const amb = 0.035 + Math.min(0.08, (st.cars || 0) * 0.008) * (0.5 + 0.5 * (st.day ?? 1));
  S.amb.g.gain.setTargetAtTime(muted ? 0 : amb, t, 0.5);
  // birds by day when walking
  if (st.foot && (st.day ?? 1) > 0.5 && !muted) { S.birdT -= dt; if (S.birdT <= 0) { S.birdT = 2.5 + Math.random() * 6; const n = 2 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) sfx.chirp(t + i * 0.13); } }
}
