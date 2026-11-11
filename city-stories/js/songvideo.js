// The song at the end of Natalia's story: after her assembly speech the whole school turns into a music video.
// The song (by Hassan Ali) plays, the camera cuts on the beat, everyone acts out the lyrics and dances,
// the lyrics show as subtitles (as sung, never translated), and then the game ends.
// Timing comes from the audio itself (tools/song_timing.py): bpm, the first downbeat, section starts and line starts.
import { ground } from './terrain.js?v=11111720';
import { LANG, pick, tr, tx } from './i18n.js?v=11111720';

export const SONG = {
  src: 'audio/beyond-the-mask.mp3',
  title: 'Beyond the Mask',
  titleUr: '',                       // the title in Urdu for the end screen, if Hassan wants one
  // from the audio (tools/song_timing.py): 90 bpm, first downbeat 0.24 s, 59 bars, 2:38 long
  bpm: 90.03, beat0: 0.238, len: 157.9,
  // where each part of the song starts (seconds, on a downbeat)
  sec: { intro: 0.24, v1: 20.2, ch1: 48.22, v2: 80.21, ch2: 112.2, outro: 144.18, end: 157 },
  lines: [],                         // [start (s), line]; a line stays up until the next one (or 6 s at most)
};
const LYRICS = {
  intro: ['Yeah listen up everyone class is in session,', 'Time to change the energy in here right now.', 'We are drawing the line today and forever,', 'Let us go together as one strong voice.'],
  v1: ['Step back and witness this toxic display you bring,', 'Your hollow words and cruel actions will not mean anything.', 'Trying to build your kingdom on someone else\'s pain,', 'But your power is just an illusion in the rain.', 'I see right through the mask that you are trying to wear,', 'This cycle ends today because we actually truly care.', 'You can choose to grow or stay in the dark,', 'But your hatred will never leave a lasting mark.'],
  ch: ['Stand up tall let your voice speak out,', 'We will silence every single doubt.', 'Do not carry this heavy pain alone tonight,', 'We are here to bring the guiding light.', 'You are never without a helping hand,', 'Together in this strength we firmly stand.'],
  v2: ['I see the quiet strength deep within your eyes,', 'No longer listen to their hateful hurtful lies.', 'You are safe with us do not feel afraid,', 'Look at this massive support network we have made.', 'Talk to your parents and share your whole heart,', 'Your teachers will help you make a brand new start.', 'The whole entire community is standing by your side,', 'There is nothing left that you need to hide.'],
  outro: ['Remember what we said you are not alone,', 'We will always have your back in this zone.', 'Step forward with confidence let your light shine,', 'Everything is truly going to be just fine.'],
};
// when each line starts (seconds), tapped along to the song by Hassan
const STARTS = {
  intro: [4.82, 8.14, 13.54, 18.95],
  v1: [21.52, 26.59, 29.46, 32.11, 34.78, 39.05, 42.85, 45.33],
  ch1: [48.21, 54.88, 59.92, 65.89, 71.76, 77.21],
  v2: [80.95, 83.35, 89.72, 93.39, 96.23, 98.92, 102.11, 107.91],
  ch2: [114.1, 119.64, 123.97, 128.86, 134.68, 140.92],
  outro: [145.31, 147.3, 150.06, 152.87],
};
for (const [k, L] of [['intro', 'intro'], ['v1', 'v1'], ['ch1', 'ch'], ['v2', 'v2'], ['ch2', 'ch'], ['outro', 'outro']]) STARTS[k].forEach((t, i) => SONG.lines.push([t, LYRICS[L][i]]));

const T = (en, fr, pa, ur, tl, ar) => ({ en, fr, pa, ur, tl, ar });
const W = {
  skip: T('Skip ▸▸', 'Passer ▸▸', 'ਛੱਡੋ ▸▸', 'چھوڑیں ▸▸', 'Laktawan ▸▸', 'تخطٍّ ▸▸'),
  play: T('▶ Play the song', '▶ Écouter la chanson', '▶ ਗੀਤ ਚਲਾਓ', '▶ گانا چلائیں', '▶ Patugtugin ang kanta', '▶ شغّل الأغنية'),
  end: T('The End', 'Fin', 'ਸਮਾਪਤ', 'اختتام', 'Wakas', 'النهاية'),
  by: T('Song by Hassan Ali', 'Chanson de Hassan Ali', 'ਗੀਤ: Hassan Ali', 'گانا: Hassan Ali', 'Awit ni Hassan Ali', 'أغنية: Hassan Ali'),
  explore: T('Keep exploring Calgary', 'Continuer à explorer Calgary', 'ਕੈਲਗਰੀ ਦੀ ਸੈਰ ਜਾਰੀ ਰੱਖੋ', 'کیلگری کی سیر جاری رکھیں', 'Magpatuloy sa paggalugad sa Calgary', 'واصل استكشاف كالغاري'),
};
const $ = s => document.querySelector(s);

// the song file starts loading as soon as the assembly mission begins; the first tap after that "unlocks" it
// (phones only let a page start sound inside a tap), so it can start on its own when the speech ends
let el = null;
export function prepareSong() {
  if (el) return el;
  el = new Audio(); el.preload = 'auto'; el.src = SONG.src;
  const unlock = () => {
    removeEventListener('pointerdown', unlock, true); removeEventListener('touchend', unlock, true);
    if (!el.paused) return; el.muted = true;
    const p = el.play(); if (p && p.then) p.then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
  };
  addEventListener('pointerdown', unlock, true); addEventListener('touchend', unlock, true);
  return el;
}

// ---------------------------------------------------------------- the video
// cast: { s (Natalia's spot at the front), p (Natalia), principal, maya, crowd[15], kid, amira, jordan, looks }
export function playSongVideo(M, g, cast) {
  const a = prepareSong(), S = SONG, bps = S.bpm / 60, bar = 4 / bps;
  const { s, p, principal, maya, crowd, kid, amira, jordan, looks } = cast;
  const box = $('#mv'), lyric = box.querySelector('.mv-lyric'), fade = box.querySelector('.mv-fade');
  box.hidden = false; box.classList.remove('done'); lyric.textContent = ''; fade.style.opacity = 1;
  $('#cine').querySelector('.cine-sub').hidden = true;
  const skipB = box.querySelector('.mv-skip'), playB = box.querySelector('.mv-play');
  skipB.textContent = pick(W.skip); playB.textContent = pick(W.play); playB.hidden = true;
  g.music && g.music.concert(0);
  const clock0 = g.clock; g.clock = 15.5;     // the video is set in the afternoon (it drifts into golden hour), like Hassan's clip

  // ---- camera: L(ax, ay, h) is ax metres to Natalia's right (+x), ay towards the back of the stage (+y), h up
  const L = (ax, ay, h) => [s.x + ax, ground(s.x + ax, s.y + ay) + h, -(s.y + ay)];
  let shot = null;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const lerp3 = (u, v, k) => [u[0] + (v[0] - u[0]) * k, u[1] + (v[1] - u[1]) * k, u[2] + (v[2] - u[2]) * k];
  // a shot: camera from A to B (each [pos, target]) between song times t0 and t1; cut = jump there at once
  const camAt = (t) => {
    if (!shot) return;
    const k = ease(Math.max(0, Math.min(1, (t - shot.t0) / Math.max(0.01, shot.t1 - shot.t0))));
    g.cineCam = { p: lerp3(shot.A[0], shot.B[0], k), t: lerp3(shot.A[1], shot.B[1], k), snap: true };
  };
  // orbit: around (cx, cy) at radius r and height h, from angle a0 to a1 (0 = in front of the stage, looking at it)
  const orbit = (cx, cy, r, h, a0, a1, lh = 1.3) => ({ orbit: [cx, cy, r, h, a0, a1, lh] });
  const camOrbit = (t) => {
    const [cx, cy, r, h, a0, a1, lh] = shot.orbit, k = ease(Math.max(0, Math.min(1, (t - shot.t0) / (shot.t1 - shot.t0)))), an = a0 + (a1 - a0) * k;
    g.cineCam = { p: L(cx + Math.sin(an) * r, cy - Math.cos(an) * r, h), t: L(cx, cy, lh), snap: true };
  };

  // ---- people
  const everyone = () => [p, maya, principal, ...crowd, ...extra];
  const extra = [];
  const DANCE = [0, 1, 2, 3, 1, 0, 3, 2];
  const dance = (who, style) => { who.act = { dance: style, sync: true, offset: (Math.max(0, everyone().indexOf(who)) % 4) / bps }; };
  const danceAll = (mix = true) => everyone().forEach((w, i) => dance(w, mix ? DANCE[i % DANCE.length] : 0));
  const still = list => list.forEach(w => { w.act = null; });
  const faceAll = (list, x, y) => list.forEach(w => M.face(w, x, y));
  const add = (look, x, y, h) => { const n = M.actor(look, s.x + x, s.y + y, h); extra.push(n); return n; };
  const go = (w, x, y, sp = 1.4) => M.walk(w, s.x + x, s.y + y, sp);
  const look = (w, x, y) => M.face(w, s.x + x, s.y + y);

  // ---- the shot list, part by part, with the story the lyrics tell
  // times are in bars from the start of each part, so every cut lands on a downbeat
  const at = (part, bars) => S.sec[part] + bars * bar;
  const bullies = [];
  const plan = [
    // INTRO: "class is in session" - Natalia at the front, the school listening
    { t: at('intro', 0), cam: [L(0, -16, 6), L(0, -3, 1.2), L(0, -9, 3), L(0, -2, 1.4)], run() { faceAll(crowd, s.x, s.y); look(p, 0, -10); look(maya, 0, -10); look(principal, 0, -10); } },
    { t: () => S.lines[0][0] - 0.05, cam: [L(-1.6, -3.2, 1.55), L(0, 0, 1.5), L(-1.1, -2.6, 1.55), L(0, 0, 1.55)], run() { p.act = { talk: true }; } },
    { t: () => S.lines[2][0] - 0.05, cam: [L(5, -9, 2.2), L(0, -6, 1.1), L(2, -10, 2.4), L(0, -6, 1.1)], run() { crowd.forEach(c => { c.act = { wave: true }; }); } },
    { t: () => S.lines[3][0] - 0.05, cam: [L(0, 6, 2.6), L(0, -6, 1.0), L(0, 3.5, 1.9), L(0, -6, 1.0)], run() { still(crowd); p.act = null; maya.act = { wave: true }; } },
    // VERSE 1: the confrontation - three older students push the Grade 7 kid at the side; Natalia steps in
    { t: at('v1', 0), cam: [L(10, -1, 2.0), L(7, -6, 1.2), L(9, -2.5, 1.7), L(7, -6, 1.2)], run() {
        maya.act = null; go(kid, 7, -6, 1.6).then(() => look(kid, 7, -9));
        for (let i = 0; i < 3; i++) { const b = add(looks.bully[i], 9 + i * 1.3, -11, 0); bullies.push(b); go(b, 6 + i * 1.2, -8, 1.5).then(() => look(b, 7, -6)); }
      } },
    { t: () => S.lines.find(l => l[1].startsWith('Step back'))[0] - 0.05, cam: [L(-2, -4, 1.6), L(2, -5, 1.4), L(-1, -4, 1.6), L(3, -5.5, 1.45)], run() { go(p, 6, -4.4, 2.6).then(() => { look(p, 7, -8); p.act = { talk: true }; }); faceAll(crowd, s.x + 7, s.y - 6); } },
    { t: () => S.lines.find(l => l[1].startsWith('Trying to build'))[0] - 0.05, cam: [L(7.5, -10.5, 1.5), L(6.5, -5, 1.5), L(7, -10, 1.6), L(6.5, -5, 1.5)], run() { bullies.forEach(b => { b.act = { talk: true }; }); go(kid, 6.8, -5, 1.2).then(() => look(kid, 7, -8)); } },
    { t: () => S.lines.find(l => l[1].startsWith('I see right through'))[0] - 0.05, cam: [L(4.2, -5.6, 1.6), L(6, -4.4, 1.55), L(4.6, -5.3, 1.55), L(6, -4.4, 1.55)], run() { bullies.forEach(b => { b.act = null; }); go(maya, 5, -4, 1.8).then(() => look(maya, 7, -8)); go(amira, 7.8, -4.2, 1.6).then(() => look(amira, 7, -8)); go(jordan, 5.6, -3.4, 1.6).then(() => look(jordan, 7, -8)); } },
    { t: () => S.lines.find(l => l[1].startsWith('This cycle'))[0] - 0.05, cam: [L(7, -13, 1.4), L(6, -4, 1.3), L(7, -12, 1.6), L(6, -4, 1.4)], run() { crowd.forEach((c, i) => { if (c === kid || c === amira || c === jordan) return; go(c, 3 + (i % 5) * 1.3, -2 - Math.floor(i / 5) * 1.2, 1.5).then(() => look(c, 7, -8)); }); } },
    { t: () => S.lines.find(l => l[1].startsWith('You can choose'))[0] - 0.05, cam: [L(5, -6, 2.4), L(7, -9, 1.2), L(4, -4, 3.2), L(7, -10, 1.2)], run() { p.act = { talk: true }; } },
    { t: () => S.lines.find(l => l[1].startsWith('But your hatred'))[0] - 0.05, cam: [L(6, -3.6, 1.8), L(7, -11, 1.3), L(6, -3.2, 2.2), L(8, -16, 1.3)], run() { p.act = null; bullies.forEach((b, i) => go(b, 10 + i * 2, -22, 1.3)); } },
    // CHORUS 1: everyone back at the front, dancing together
    { t: at('ch1', 0), cam: orbit(0, -3, 9, 2.4, -0.7, 0.5), run() {
        bullies.forEach(b => { b.g.visible = false; }); gather(); setTimeout(() => danceAll(), 900);
      } },
    { t: at('ch1', 4), cam: [L(0.4, -5.1, 1.5), L(0, -3.4, 1.4), L(-0.4, -5.0, 1.45), L(0, -3.4, 1.4)] },
    { t: at('ch1', 6), cam: orbit(0, -5, 9, 4.5, 0.9, -0.9, 0.9) },
    { t: at('ch1', 10), cam: [L(-6, -9, 1.0), L(0, -4, 1.4), L(6, -9, 1.0), L(0, -4, 1.4)] },
    // VERSE 2: looking after the kid - friends, parents, teachers and the whole community
    { t: at('v2', 0), cam: [L(-3.8, -4.4, 1.45), L(0.4, -3.9, 1.2), L(-3.2, -4.0, 1.4), L(0.4, -3.9, 1.2)], run() {
        still(everyone()); M.walk(kid, s.x + 0.8, s.y - 4.6, 1.2).then(() => look(kid, 0, -3)); go(p, 0, -3.2, 1.4).then(() => { look(p, 0.8, -4.6); p.act = { talk: true }; });
      } },
    { t: () => S.lines.find(l => l[1].startsWith('You are safe'))[0] - 0.05, cam: [L(3, -6, 1.6), L(0.6, -4, 1.3), L(2.4, -6.4, 1.5), L(0.6, -4, 1.3)], run() { go(maya, -0.8, -4.2, 1.6).then(() => look(maya, 0.8, -4.6)); go(amira, 1.8, -5.4, 1.6).then(() => look(amira, 0.8, -4.6)); go(jordan, 2, -3.8, 1.6).then(() => look(jordan, 0.8, -4.6)); } },
    { t: () => S.lines.find(l => l[1].startsWith('Look at this'))[0] - 0.05, cam: [L(0, -14, 3), L(0, -4, 1.2), L(0, -12, 5.5), L(0, -4, 1.2)], run() { crowd.forEach(c => { if (![kid, amira, jordan].includes(c)) c.act = { wave: true }; }); } },
    { t: () => S.lines.find(l => l[1].startsWith('Talk to your parents'))[0] - 0.05, cam: [L(-5, -8, 1.6), L(0.8, -4.6, 1.2), L(-4, -7, 1.6), L(0.8, -4.6, 1.2)], run() {
        still(crowd); const m = add(looks.mom, -9, -10, 0), d = add(looks.dad, -10, -9, 0);
        go(m, 0.2, -5.6, 1.6).then(() => look(m, 0.8, -4.6)); go(d, 1.5, -5.8, 1.6).then(() => look(d, 0.8, -4.6)); look(kid, -2, -7);
      } },
    { t: () => S.lines.find(l => l[1].startsWith('Your teachers'))[0] - 0.05, cam: [L(-3.5, -1.5, 1.7), L(0.8, -4.6, 1.3), L(-3, -2, 1.6), L(0.8, -4.6, 1.3)], run() {
        go(principal, -0.4, -5.2, 1.4).then(() => { look(principal, 0.8, -4.6); principal.act = { talk: true }; });
        const t = add(looks.teacher, -6, 1, 0); go(t, 2.2, -4.6, 1.5).then(() => look(t, 0.8, -4.6)); look(kid, -0.4, -5.2);
      } },
    { t: () => S.lines.find(l => l[1].startsWith('The whole entire'))[0] - 0.05, cam: [L(-4, -12, 2.6), L(0.8, -4.6, 1.0), L(-3, -14, 7), L(0.8, -4.6, 0.8)], run() {
        principal.act = null; for (let i = 0; i < 6; i++) { const n = add(looks.community[i % looks.community.length], -12 + i * 4.5, -16 - (i % 2) * 2, 0); const an = i / 6 * Math.PI * 2; go(n, 0.8 + Math.cos(an) * 4.4, -4.6 + Math.sin(an) * 4.4, 1.8).then(() => look(n, 0.8, -4.6)); }
      } },
    { t: () => S.lines.find(l => l[1].startsWith('There is nothing left'))[0] - 0.05, cam: [L(1.2, -1.6, 1.3), L(0.8, -4.6, 1.15), L(1.1, -2.2, 1.25), L(0.8, -4.6, 1.15)], run() { look(kid, 1.2, -1.6); kid.act = { wave: true }; p.act = null; } },
    // CHORUS 2: the whole community dances
    { t: at('ch2', 0), cam: orbit(0.8, -4.6, 8, 3, 0.6, -0.6), run() { danceAll(); } },
    { t: at('ch2', 4), cam: [L(0.8, -2.2, 1.0), L(0.8, -4.6, 1.3), L(0.8, -2.8, 1.5), L(0.8, -4.6, 1.3)] },
    { t: at('ch2', 6), cam: orbit(0.8, -4.6, 10, 5, -1.2, 1.2, 0.9) },
    { t: at('ch2', 10), cam: [L(9, -4.6, 1.2), L(0.8, -4.6, 1.3), L(-7, -4.6, 1.2), L(0.8, -4.6, 1.3)] },
    // OUTRO: "you are not alone" - everyone waves to the camera, then the camera rises over the school
    { t: at('outro', 0), cam: [L(0.8, -10, 1.6), L(0.8, -4.6, 1.3), L(0.8, -8.5, 1.6), L(0.8, -4.6, 1.3)], run() { everyone().forEach(w => { w.act = { wave: true }; M.face(w, s.x + 0.8, s.y - 12); }); } },
    { t: () => S.lines.find(l => l[1].startsWith('Step forward'))[0] - 0.05, cam: [L(0.8, -8, 1.4), L(0.8, -4.6, 1.3), L(0.8, -7, 1.4), L(0.8, -5.6, 1.3)], run() { still(everyone()); M.walk(p, s.x + 0.2, s.y - 5.6, 1.0); go(kid, 1.4, -5.6, 1.0); setTimeout(() => danceAll(false), 1600); } },
    { t: () => S.lines[S.lines.length - 1][0] - 0.05, cam: [L(0.8, -9, 2.5), L(0.8, -4.6, 1.3), L(0.8, -30, 40), L(0.8, -2, 0)] },
  ];
  function gather() {
    still(everyone());
    go(p, 0, -3.4, 2.2).then(() => look(p, 0, -10)); go(maya, -1.6, -3.4, 2).then(() => look(maya, 0, -10)); go(kid, 1.6, -3.4, 2).then(() => look(kid, 0, -10));
    crowd.forEach((c, i) => { if (c === kid) return; const r = Math.floor(i / 5), col = i % 5; go(c, -4.4 + col * 2.2 + (r % 2) * 0.8, -5.4 - r * 1.7, 2).then(() => look(c, 0, -12)); });
    go(principal, -4.8, -2.2, 1.6).then(() => look(principal, 0, -10));
  }
  // shot ends are the next shot's start (or the end of the song)
  const shots = plan.map(x => ({ ...x, t0: typeof x.t === 'function' ? x.t() : x.t })).sort((u, v) => u.t0 - v.t0);
  shots.forEach((x, i) => { x.t1 = i + 1 < shots.length ? shots[i + 1].t0 : S.sec.end; if (x.cam.orbit) x.orbit = x.cam.orbit; else { x.A = [x.cam[0], x.cam[1]]; x.B = [x.cam[2], x.cam[3]]; } });

  return new Promise(resolve => {
    let i = -1, li = -1, raf = 0, t0 = performance.now(), useClock = false, finished = false, last = performance.now();
    const now = () => useClock || !a || a.readyState < 2 || a.paused && a.currentTime === 0 ? (performance.now() - t0) / 1000 : a.currentTime;
    const finish = () => {
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      fade.style.transition = 'opacity 1.6s'; fade.style.opacity = 1;
      const v0 = a.volume; let k = 0; const fo = setInterval(() => { k += 0.05; a.volume = Math.max(0, v0 * (1 - k)); if (k >= 1) { clearInterval(fo); a.pause(); } }, 80);
      setTimeout(() => { lyric.textContent = ''; if (clock0 != null) g.clock = clock0; resolve(); }, 1700);
    };
    skipB.onclick = finish;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = now();
      // the next shot
      while (i + 1 < shots.length && t >= shots[i + 1].t0) { i++; shot = shots[i]; if (shot.run) shot.run(); }
      if (shot) (shot.orbit ? camOrbit : camAt)(t);
      // dancing on the beat: everyone's moves follow the song's clock
      const beatT = t - S.beat0 + 0.5 / bps;
      for (const w of everyone()) if (w.act && w.act.dance != null && w.act.sync) { w.act.syncT = beatT; w.act.beat = S.bpm / 120; }
      // subtitles
      let n = -1; for (let k = 0; k < S.lines.length; k++) if (S.lines[k][0] <= t) n = k; else break;
      const nextT = n + 1 < S.lines.length ? S.lines[n + 1][0] : S.sec.end, show = n >= 0 && t < Math.min(nextT, S.lines[n][0] + 6);
      const want = show ? S.lines[n][1] : '';
      if (want !== lyric.textContent) { lyric.classList.remove('in'); lyric.textContent = want; void lyric.offsetWidth; if (want) lyric.classList.add('in'); }
      if (t >= S.sec.end || (a && a.ended)) finish();
    };
    const go2 = () => {
      fade.style.transition = 'opacity 1.2s'; requestAnimationFrame(() => { fade.style.opacity = 0; });
      t0 = performance.now(); raf = requestAnimationFrame(tick);
    };
    a.currentTime = 0; a.volume = 1; a.muted = false;
    const pr = a.play();
    if (pr && pr.then) pr.then(go2).catch(() => {
      // the phone wouldn't start the song on its own: one tap starts it (or the video runs silent if the file is missing)
      if (a.error || a.networkState === 3) { useClock = true; go2(); return; }
      playB.hidden = false; fade.style.opacity = 0.6;
      playB.onclick = () => { playB.hidden = true; a.play().then(go2).catch(() => { useClock = true; go2(); }); };
    });
    else go2();
  });
}

// ---------------------------------------------------------------- the end of the game
// after the song: "The End", what Natalia did, the credits, then back to the main menu (or keep exploring)
export function theEnd(summary) {
  const box = $('#mv'); box.hidden = false; box.classList.add('done');
  const end = box.querySelector('.mv-end'); end.hidden = false; box.querySelector('.mv-lyric').textContent = '';
  box.querySelector('.mv-skip').hidden = true;
  const title = SONG.titleUr || SONG.title;
  end.innerHTML = `<div class="mv-the-end">${pick(W.end)}</div>
    <div class="mv-song" ${SONG.titleUr ? 'dir="rtl" lang="ur"' : ''}>${title}</div>
    <div class="mv-by">${pick(W.by)}</div>
    <div class="mv-sum">${tx(summary)}</div>
    <div class="mv-btns"><button class="mv-menu">${tr('menu')}</button><button class="mv-free">${pick(W.explore)}</button></div>`;
  end.dir = ['ur', 'ar'].includes(LANG.code) ? 'rtl' : 'ltr';
  return new Promise(res => {
    end.querySelector('.mv-menu').onclick = () => { location.hash = 'menu'; location.reload(); };
    end.querySelector('.mv-free').onclick = () => { box.hidden = true; end.hidden = true; box.classList.remove('done'); box.querySelector('.mv-skip').hidden = false; res(); };
  });
}
