// Sing-along lyrics for "Under One Sky" while you're near a concert stage, timed to the song as it plays.
let L = null, el = null, box = null, cur = -2;
export async function loadLyrics() {
  try { const r = await fetch('audio/under-one-sky.lyrics.json'); if (r.ok) L = await r.json(); } catch (e) { L = null; }
  box = document.createElement('div'); box.id = 'lyrics'; box.hidden = true;
  box.innerHTML = '<div class="lyr-now" dir="auto"></div><div class="lyr-next" dir="auto"></div>';
  document.body.appendChild(box);
}
// level: how close you are to a stage (0..1); audio: the song's <audio> element
// the lines sung right now, for the big screens at the stages: [now, next] or null
let AUD = null, LV = 0;
export function lyricLines() {
  const audio = AUD; if (!L || !audio || audio.paused || LV <= 0) return null;
  const t = audio.currentTime; let i = -1;
  for (let k = 0; k < L.length; k++) { if (L[k][0] <= t + 0.15) i = k; else break; }
  if (i >= 0 && t > L[i][1] + 2.5) i = -1;
  return [i >= 0 ? L[i][2] : '♪ ♪ ♪', i + 1 < L.length ? L[i + 1][2] : ''];
}
// draw the sung line in big letters on a stage screen (canvas 512 x 256); false when nothing is playing
export function drawLyricsOn(g, W = 512, top = 150) {
  const ln = lyricLines(); if (!ln) return false;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, top - 34, W, 256 - top + 34);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 34; g.font = `800 ${fs}px "Segoe UI", Roboto, sans-serif`;
  const words = ln[0].split(' '), lines = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > W - 30 && cur) { lines.push(cur); cur = w; } else cur = t2; }
  if (cur) lines.push(cur);
  lines.slice(0, 2).forEach((l, k) => g.fillText(l, W / 2, top - 6 + k * 38));
  g.font = '600 20px "Segoe UI", Roboto, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(ln[1].slice(0, 46), W / 2, 238);
  return true;
}
// lyrics are shown on the stage screens only: the old overlay stays hidden
export function updateLyrics(level, audio, hide = false) {
  AUD = audio; LV = hide ? 0 : level;
  if (box && !box.hidden) box.hidden = true;
  return;
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
