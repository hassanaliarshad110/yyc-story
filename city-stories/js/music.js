// The title song "Under One Sky" (by Hassan Ali): plays on the title screen, from the chorus when the game starts,
// as the radio in cars and the helicopter, and at the Saddledome concert every night.
// Phones only let a page start sound inside a tap or key press, so every (re)start happens in one.
import { isMuted } from './sound.js';
const SONG = 'audio/under-one-sky.mp3', CHORUS = 61.8, CHORUS_LEN = 26;
const S = { title: false, chorusEnd: 0, radio: false, concert: 0, want: 0, cur: 0, lastTry: 0, pendingSeek: null, radioOff: false };
try { S.radioOff = localStorage.getItem('yyc-radio') === 'off'; } catch (e) { }
const el = new Audio(); el.preload = 'auto'; el.loop = true; el.volume = 0; el.src = SONG;
// the whole song is also downloaded into memory, so jumping to the chorus works even where the host can't seek a stream
let blobUrl = null;
fetch(SONG).then(r => r.ok ? r.blob() : null).then(b => { if (!b) return; blobUrl = URL.createObjectURL(b); if (el.paused) swap(); }).catch(() => { });
function swap() { if (!blobUrl || el.src === blobUrl) return; const t = S.pendingSeek ?? el.currentTime; el.src = blobUrl; S.pendingSeek = t; }
function applySeek() { if (S.pendingSeek == null) return; if (el.readyState >= 1) { try { el.currentTime = S.pendingSeek; } catch (e) { } S.pendingSeek = null; } else el.addEventListener('loadedmetadata', applySeek, { once: true }); }
function start() { if (el.paused) swap(); applySeek(); const p = el.play(); if (p && p.catch) p.catch(() => { }); }
// any tap or key: if the song should be playing but isn't, start it now
const kick = () => { if (S.want > 0 && el.paused) start(); };
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, kick, true);

export const music = {
  title(on) { S.title = on; if (on && el.paused && el.currentTime === 0) { S.want = 1; start(); } },
  // the title screens: the song from the chorus onwards, until the game starts (call inside a tap)
  titleChorus() { S.title = true; if (el.paused) swap(); if (el.currentTime < CHORUS - 1) S.pendingSeek = CHORUS; S.want = 1; start(); },
  // call from the Start button's click, so the jump to the chorus and the play happen inside the tap
  startChorus() { S.title = false; S.chorusEnd = performance.now() + CHORUS_LEN * 1000; if (el.paused) swap(); S.pendingSeek = CHORUS; S.want = 1; start(); },
  radio(on) { if (on && !S.radio && !S.radioOff && el.paused) { S.want = 1; start(); } S.radio = on; },     // also called from the get-in tap
  get radioOff() { return S.radioOff; },
  toggleRadio() { S.radioOff = !S.radioOff; try { localStorage.setItem('yyc-radio', S.radioOff ? 'off' : 'on'); } catch (e) { } if (!S.radioOff && S.radio) { S.want = 1; start(); } return !S.radioOff; },
  concert(level) { S.concert = level; },
  get playing() { return !el.paused; },
  get el() { return el; },
  update(dt) {
    const left = (S.chorusEnd - performance.now()) / 1000;
    let target = Math.max(S.title ? 0.7 : 0, left > 0 ? 0.7 * Math.min(1, left / 3) : 0, S.radio && !S.radioOff ? 0.5 : 0, S.concert * 0.85);
    if (isMuted() || document.hidden) target = 0;
    S.want = target;
    S.cur += (target - S.cur) * Math.min(1, dt * (target > S.cur ? 1.5 : 1.0));
    if (Math.abs(target - S.cur) < 0.003) S.cur = target;
    el.volume = Math.max(0, Math.min(1, S.cur));
    if (target > 0 && el.paused && performance.now() - S.lastTry > 1000) { S.lastTry = performance.now(); start(); }   // works on desktops; phones wait for the next tap
    if (target === 0 && S.cur < 0.005 && !el.paused) el.pause();
  },
};
