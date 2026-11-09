// Sing-along lyrics for "Under One Sky" while you're near a concert stage, timed to the song as it plays.
let L = null, el = null, box = null, cur = -2;
export async function loadLyrics() {
  try { const r = await fetch('audio/under-one-sky.lyrics.json'); if (r.ok) L = await r.json(); } catch (e) { L = null; }
  box = document.createElement('div'); box.id = 'lyrics'; box.hidden = true;
  box.innerHTML = '<div class="lyr-now" dir="auto"></div><div class="lyr-next" dir="auto"></div>';
  document.body.appendChild(box);
}
// level: how close you are to a stage (0..1); audio: the song's <audio> element
export function updateLyrics(level, audio, hide = false) {
  if (!box) return;
  if (!L || hide || level < 0.12 || !audio || audio.paused) { if (!box.hidden) { box.hidden = true; cur = -2; } return; }
  const t = audio.currentTime;
  let i = -1;
  for (let k = 0; k < L.length; k++) { if (L[k][0] <= t + 0.15) i = k; else break; }
  if (i >= 0 && t > L[i][1] + 2.5) i = -1;                 // a long instrumental gap: no line
  box.hidden = false; box.style.opacity = Math.min(1, (level - 0.12) * 3).toFixed(2);
  if (i === cur) return; cur = i;
  const now = box.firstChild, next = box.lastChild;
  now.textContent = i >= 0 ? L[i][2] : '♪ ♪ ♪';
  next.textContent = i + 1 < L.length && i >= -1 ? (L[i + 1] ? L[i + 1][2] : '') : '';
  now.classList.remove("pop"); void now.offsetWidth; now.classList.add("pop");
}
