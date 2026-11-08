// Spoken dialogue: every line of the stories is voiced in each language (audio/<lang>/<n>.mp3, n = the line's
// number in lang/en.json; tools/build_voices.py). Lines without a recording are simply shown.
import { LANG } from './i18n.js';

let ids = null, man = null, cur = null;
const ready = (async () => {
  try {
    const [en, m] = await Promise.all([fetch('lang/en.json').then(r => r.json()), fetch('audio/manifest.json').then(r => r.ok ? r.json() : {})]);
    ids = new Map(en.map((s, i) => [s, i])); man = m;
  } catch (e) { ids = new Map(); man = {}; }
})();
export const voice = { on: (() => { try { return localStorage.getItem('yyc-voice') !== '0'; } catch (e) { return true; } })() };
export function setVoice(on) { voice.on = on; try { localStorage.setItem('yyc-voice', on ? '1' : '0'); } catch (e) { } if (!on) stopVoice(); }
// plays the line (English text as written in the story) in the current language; returns its length in seconds, or 0
export function speak(text) {
  stopVoice();
  if (!voice.on || !ids || !man || text == null) return 0;
  const id = ids.get(String(text).trim()), L = man[LANG.code];
  if (id == null || !L || !L[id]) return 0;
  cur = new Audio(`audio/${LANG.code}/${id}.mp3`); cur.volume = 1;
  cur.play().catch(() => { });
  return L[id];
}
export function stopVoice() { if (cur) { cur.pause(); cur = null; } }
export { ready as voiceReady };
