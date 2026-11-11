// "See it for real": the real street photo of a place (Google Street View Static API).
// Opens facing the place; arrows turn left and right. Photos load only when asked for.
import { $, esc, toast } from './hud.js?v=11111720';
import { toLatLon } from './world.js?v=11111720';

let game = null;
export function initRealView(g) {
  game = g;
  const el = document.createElement('div');
  el.id = 'real'; el.hidden = true;
  el.innerHTML = `<div class="real-in"><div class="real-top"><b class="real-title"></b><button class="real-x">✕</button></div>
    <div class="real-photo"><img alt=""><button class="real-l" aria-label="Turn left">◀</button><button class="real-r" aria-label="Turn right">▶</button><div class="real-msg"></div></div>
    <div class="real-foot"><span class="real-g">Google</span><span class="real-c"></span></div>
    <p class="real-note">This is the real street photo of this spot. Find it next time you're out in Calgary!</p></div>`;
  document.body.appendChild(el);
  el.querySelector('.real-x').onclick = closeReal;
  el.querySelector('.real-l').onclick = () => turn(-60);
  el.querySelector('.real-r').onclick = () => turn(60);
}
let cur = null;
export function realOpen() { return !$('#real').hidden; }
export function closeReal() { $('#real').hidden = true; game.paused = false; cur = null; }
const API = 'https://maps.googleapis.com/maps/api/streetview';
function bearing(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
export async function openReal(place) {
  if (!game.key) { toast('Real street photos need the Google key'); return; }
  if (game.realOK === false) { toast('Real street photos work on the published game website, not in this preview.'); return; }
  const el = $('#real'); el.hidden = false; game.paused = true;
  el.querySelector('.real-title').textContent = place.name || place.label || 'This spot';
  const img = el.querySelector('img'), msg = el.querySelector('.real-msg');
  img.removeAttribute('src'); msg.textContent = 'Finding the street photo…'; el.querySelector('.real-c').textContent = '';
  const [lat, lon] = toLatLon(game.world, place.x, place.y);
  try {
    const r = await fetch(`${API}/metadata?location=${lat.toFixed(6)},${lon.toFixed(6)}&radius=${place.radius || 120}&source=outdoor&key=${game.key}`);
    const m = await r.json();
    if (m.status !== 'OK') { msg.textContent = m.status === 'ZERO_RESULTS' ? 'No street photo near this spot.' : 'Street photos are not available right now (' + m.status + ').'; return; }
    cur = { pano: m.pano_id, heading: bearing(m.location.lat, m.location.lng, lat, lon) };
    el.querySelector('.real-c').textContent = (m.copyright || '© Google') + (m.date ? ' · photo ' + m.date : '');
    show();
  } catch (e) { msg.textContent = 'Could not reach Google Street View.'; }
}
function turn(d) { if (!cur) return; cur.heading = (cur.heading + d + 360) % 360; show(); }
function show() {
  const el = $('#real'), img = el.querySelector('img'), msg = el.querySelector('.real-msg');
  msg.textContent = '';
  const w = Math.min(640, Math.round(innerWidth * 0.92)), h = Math.min(640, Math.round(w * 0.62));
  img.onerror = () => { msg.textContent = 'The photo could not load.'; };
  img.src = `${API}?size=${w}x${h}&pano=${cur.pano}&heading=${Math.round(cur.heading)}&pitch=6&fov=90&return_error_code=true&key=${game.key}`;
}
