// The in-game phone: Calgary 311, Transit, Find help, Map, Missions, Settings.
import { isMuted, setMuted, engineVolume, setEngineVolume } from './sound.js?v=11111647';
import { voice, setVoice } from './voice.js?v=11111647';
import { HALLOWEEN, setHalloween } from './halloween.js?v=11111647';
import { businessesNear, searchBusinesses, BIZ_CAT } from './business.js?v=11111647';
import { $, esc, toast, openMap } from './hud.js?v=11111647';
import { communityAt, wardAt, nearest } from './world.js?v=11111647';
import { titleOf } from './stories.js?v=11111647';

let game = null;
export function initPhone(g) {
  game = g;
  $('.phone-x').onclick = closePhone;
}
export function phoneOpen() { return !$('#phone').hidden; }
export function closePhone() { $('#phone').hidden = true; game.paused = false; if (game.phoneDone) { const f = game.phoneDone; game.phoneDone = null; f(null); } }
function show(title, html) { $('#phone').hidden = false; $('.phone-title').textContent = title; $('.phone-body').innerHTML = html; game.paused = true; }

export function openPhone() {
  show('Phone', `<div class="apps">
    <button class="app" data-app="311"><i style="background:#c8102e">311</i>Calgary 311</button>
    <button class="app" data-app="transit"><i style="background:#1d4f91">🚌</i>Transit</button>
    <button class="app" data-app="help"><i style="background:#1e9e4a">🤝</i>Find help</button>
    <button class="app" data-app="map"><i style="background:#7a3fa0">🗺️</i>Map</button>
    <button class="app" data-app="missions"><i style="background:#d48a00">⭐</i>Missions</button>
    <button class="app" data-app="settings"><i style="background:#555">⚙️</i>Settings</button>
    <button class="app" data-app="real"><i style="background:#0b7a75">📷</i>Real photos</button>
    <button class="app" data-app="biz"><i style="background:#b8432f">🛍️</i>Nearby</button>
    <button class="app" data-app="goto"><i style="background:#2a6fdb">📍</i>Go to address</button>
    <button class="app" data-app="facts"><i style="background:#e0a100">💡</i>City facts</button></div>
    <p style="font-size:12px;color:#5b6573;margin-top:22px">In the real world: <b>9-1-1</b> emergencies · <b>3-1-1</b> City services · <b>2-1-1</b> community and social help</p>`);
  $('.phone-body').querySelectorAll('[data-app]').forEach(b => b.onclick = () => {
    const a = b.dataset.app;
    if (a === '311') app311();
    if (a === 'transit') appTransit();
    if (a === 'help') appHelp();
    if (a === 'map') { closePhone(); openMap(); }
    if (a === 'missions') appMissions();
    if (a === 'settings') appSettings();
    if (a === 'real') appReal();
    if (a === 'biz') appBiz();
    if (a === 'goto') appGoto();
    if (a === 'facts') appFacts();
  });
}

// ---------------------------------------------------------------- 311
const CATS = [['pothole', '🕳️', 'Pothole or road damage'], ['light', '💡', 'Streetlight out'], ['graffiti', '🎨', 'Graffiti'], ['garbage', '🗑️', 'Garbage in a park or on a road'],
  ['sidewalk', '❄️', 'Snow and ice on a sidewalk'], ['tree', '🌳', 'Damaged City tree'], ['other', '📝', 'Something else']];
export function app311(expect) {
  return new Promise(res => {
    let cat = null, photo = null;
    game.phoneDone = res;
    const p = game.player, cm = communityAt(game.world, p.x, p.y), st = game.tiles.streetAt(p.x, p.y, 60);
    const step1 = () => show('Calgary 311', `<div class="p-h">New request</div><p style="margin-top:-4px;color:#5b6573;font-size:14px">What would you like to report? 311 is for City services that are not emergencies.</p>
      <div class="p-list">${CATS.map(c => `<button class="p-item" data-c="${c[0]}"><b>${c[1]} ${c[2]}</b></button>`).join('')}</div>`) || bind1();
    const bind1 = () => $('.phone-body').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = CATS.find(c => c[0] === b.dataset.c); step2(); });
    const step2 = () => {
      show('Calgary 311', `<div class="p-h">${cat[1]} ${esc(cat[2])}</div>
        <div class="photo" id="p311photo">${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : 'No photo yet'}</div>
        <button class="p-btn alt" id="p311snap">📷 Take a photo</button>
        <div style="margin-top:12px;font-size:14px"><b>Location</b><br>${esc(st ? st.name : 'Near you')}${cm ? ', ' + esc(cm.n) : ''}<br><small style="color:#5b6573">The app uses your phone's location.</small></div>
        <button class="p-btn" id="p311send">Submit request</button>`);
      $('#p311snap').onclick = () => { photo = game.snapshot(); step2(); };
      $('#p311send').onclick = () => {
        if (!photo) { toast('Add a photo first: it helps the crew find the problem.'); return; }
        const sr = '26-' + String(Math.floor(10000000 + Math.random() * 89999999)).padStart(8, '0');
        show('Calgary 311', `<div class="p-h">✅ Request submitted</div><p>Your service request number is</p><p style="font-size:26px;font-weight:800;letter-spacing:.04em">${sr}</p>
          <p style="font-size:14px;color:#364152">311 sends your request to the right City team. You can check its status any time in the app, online, or by calling 311, using this number.</p>
          <button class="p-btn" id="p311ok">Done</button>`);
        $('#p311ok').onclick = () => { game.phoneDone = null; $('#phone').hidden = true; game.paused = false; res({ cat: cat[0], sr }); };
      };
    };
    step1();
  });
}

// ---------------------------------------------------------------- transit
export function appTransit() {
  const p = game.player;
  const stops = game.world.stops.map(s => [Math.hypot(s[0] - p.x, s[1] - p.y), s]).sort((a, b) => a[0] - b[0]).slice(0, 5);
  const routes = new Map();
  for (const path of game.transit.paths) { if (p.x < path.bb[0] - 300 || p.x > path.bb[2] + 300 || p.y < path.bb[1] - 300 || p.y > path.bb[3] + 300) continue; const pr = path.project(p.x, p.y); if (pr.d < 250) routes.set(path.route.r, path.route.n); }
  const rl = [...routes].sort((a, b) => (a[0].length - b[0].length) || a[0].localeCompare(b[0]));
  show('Transit', `<div class="p-h">Fares (2026)</div>
    <div class="p-list"><div class="p-item"><b>Youth 13 to 17: $2.65</b><small>Adult 18+: $4.00 · Kids 12 and under ride free · a fare is good for 90 minutes</small></div>
    <div class="p-item"><b>How to pay</b><small>Buy and activate a ticket in the My Fare app, use a ticket machine at a CTrain station, or pay cash on the bus.</small></div></div>
    <div class="p-h" style="margin-top:14px">Routes near you</div>
    <div class="chips">${rl.length ? rl.map(([r, n]) => `<span class="chip" title="${esc(n)}"><b>${esc(r)}</b> ${esc((n || '').slice(0, 26))}</span>`).join('') : '<span style="color:#5b6573">No routes within 250 m.</span>'}</div>
    <div class="p-h">Nearest stops</div>
    <div class="p-list">${stops.map(([d, s]) => `<div class="p-item"><b>${esc(s[2])}</b><small>Stop ${esc(s[3])} · ${Math.round(d)} m</small></div>`).join('')}</div>
    <p style="font-size:11px;color:#5b6573">Routes and stops: City of Calgary open data (Calgary Transit timetable). Fares: calgarytransit.com.</p>`);
}

// ---------------------------------------------------------------- find help
const KINDS = [['shelter', 'A bed tonight'], ['food', 'Food and meals'], ['day', 'Day spaces, showers, ID'], ['health', 'Health and recovery'], ['safe', 'Leaving abuse']];
export function appHelp(expect) {
  return new Promise(res => {
    game.phoneDone = res;
    let kind = expect || 'food';
    const H = game.world.help;
    const render = () => {
      const p = game.player;
      const list = H.places.filter(h => h.kind === kind).map(h => ({ ...h, d: h.x != null ? Math.hypot(h.x - p.x, h.y - p.y) : null })).sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12));
      show('Find help', `<div class="p-big"><div class="p-item"><b>9-1-1</b><small>Danger or a medical emergency</small></div><div class="p-item"><b>2-1-1</b><small>Call or text, 24/7: food, shelter, any help</small></div>
        <div class="p-item"><b>9-8-8</b><small>Suicide crisis line, call or text</small></div><div class="p-item"><b>403-266-4357</b><small>Distress Centre Calgary, 24/7</small></div></div>
        <p style="font-size:12px;color:#5b6573">In the game these are information only. In real life, dial the number.</p>
        <div class="chips">${KINDS.map(([k, t]) => `<button class="chip${k === kind ? ' on' : ''}" data-k="${k}">${t}</button>`).join('')}</div>
        ${kind === 'safe' ? '<p style="font-size:13px">These shelters keep their addresses private for safety. Call them and they will help you get there.</p>' : ''}
        <div class="p-list">${list.map(h => `<div class="p-item"><b>${esc(h.name)}</b><small>${esc(h.who || '')}${h.address ? '<br>' + esc(h.address) : ''}${h.d != null ? ` · ${(h.d / 1000).toFixed(1)} km` : ''}${h.hours ? '<br>' + esc(h.hours) : ''}${h.phone ? '<br>☎ ' + esc(h.phone) : ''}</small></div>`).join('')}</div>
        <button class="p-btn" id="call211">Call 2-1-1 (in game)</button>
        <p style="font-size:11px;color:#5b6573">${esc(H.note || '')} Sources: ${(H.sources || []).map(s => esc(s.title)).join('; ')}. Checked ${esc(H.checked || '')}.</p>`);
      $('.phone-body').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kind = b.dataset.k; render(); });
      $('#call211').onclick = () => {
        show('2-1-1', `<div class="p-h">📞 2-1-1 Alberta</div><p>"Hi, you've reached 211. We connect people with community, social, health and government services, any time of day. How can we help?"</p>
          <p style="font-size:14px;color:#364152">A 211 navigator can tell you where the nearest food bank or community meal is, how to get a food hamper, and what other help you can get. The call is free and confidential, and they can help in many languages.</p>
          <button class="p-btn" id="h-ok">Thank you!</button>`);
        $('#h-ok').onclick = () => { game.phoneDone = null; $('#phone').hidden = true; game.paused = false; res({ called: true }); };
      };
    };
    render();
  });
}

// ---------------------------------------------------------------- missions list
function appMissions() {
  const M = game.missions;
  show('Missions', `<div class="p-list">${M.list.map((m, i) => {
    const done = M.state.done.includes(m.id), avail = M.available(i);
    return `<button class="p-item" data-m="${i}" ${avail ? '' : 'disabled style="opacity:.5"'}><b>${done ? '✅' : avail ? '▶️' : '🔒'} ${i + 1}. ${esc(titleOf(m))}</b><small>${esc(m.teaches || '')}</small></button>`;
  }).join('')}</div>
  <div class="p-h" style="margin-top:14px">Landmarks found: ${game.missions.state.landmarks.length} / ${game.world.landmarks.length}</div>
  <div class="chips">${game.world.landmarks.map(l => `<span class="chip${game.missions.state.landmarks.includes(l.label) ? ' on' : ''}">${esc(l.label)}</span>`).join('')}</div>`);
  $('.phone-body').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { closePhone(); game.missions.start(+b.dataset.m); });
}

function appSettings() {
  const q = game.settings;
  show('Settings', `<div class="p-h">Picture quality</div><div class="chips">${[['low', 'Low (smoothest)'], ['medium', 'Medium'], ['high', 'High (best look)']].map(([v, t]) => `<button class="chip${q.q === v ? ' on' : ''}" data-q="${v}">${t}</button>`).join('')}</div>
    <div class="p-h">Frame rate counter</div><div class="chips"><button class="chip${q.fps ? ' on' : ''}" data-fps="1">Show</button><button class="chip${!q.fps ? ' on' : ''}" data-fps="0">Hide</button></div>
    <div class="p-h">View distance</div><div class="chips">${[['1', 'Short (faster)'], ['2', 'Normal'], ['3', 'Far'], ['4', 'Very far']].map(([v, t]) => `<button class="chip${String(q.radius) === v ? ' on' : ''}" data-r="${v}">${t}</button>`).join('')}</div>
    <div class="p-h">Shadows</div><div class="chips"><button class="chip${q.shadows ? ' on' : ''}" data-s="1">On</button><button class="chip${!q.shadows ? ' on' : ''}" data-s="0">Off</button></div>
    <div class="p-h">Night glow (lights bloom after dark)</div><div class="chips"><button class="chip${q.glow ? ' on' : ''}" data-gl="1">On</button><button class="chip${!q.glow ? ' on' : ''}" data-gl="0">Off (faster)</button></div>
    <div class="p-h">Sound</div><div class="chips"><button class="chip${!isMuted() ? ' on' : ''}" data-snd="1">On</button><button class="chip${isMuted() ? ' on' : ''}" data-snd="0">Off</button></div>
    <div class="p-h">Voices in the stories</div><div class="chips"><button class="chip${voice.on ? ' on' : ''}" data-vo="1">On</button><button class="chip${!voice.on ? ' on' : ''}" data-vo="0">Off</button></div>
    <div class="p-h">Halloween decorations</div><div class="chips"><button class="chip${HALLOWEEN.on ? ' on' : ''}" data-hw="1">On</button><button class="chip${!HALLOWEEN.on ? ' on' : ''}" data-hw="0">Off</button></div>
    <div class="p-h">Engine volume</div><div class="chips">${[['0', 'Off'], ['0.5', 'Quiet'], ['1', 'Normal']].map(([v, t]) => `<button class="chip${String(engineVolume()) === v ? ' on' : ''}" data-ev="${v}">${t}</button>`).join('')}</div>
    <div class="p-h">Time of day</div><div class="chips">${[['8', 'Morning'], ['13', 'Afternoon'], ['18.5', 'Evening'], ['22', 'Night']].map(([v, t]) => `<button class="chip" data-t="${v}">${t}</button>`).join('')}</div>
    <button class="p-btn alt" id="s-reset">Start the story again</button>
    <p style="font-size:12px;color:#5b6573;margin-top:16px"><b>YYC City Stories</b> · A game by Hassan Ali<br>${game.world.credits.data.map(esc).join('<br>')}<br>Map data downloaded ${esc((game.world.osm_date || '').slice(0, 10))}.</p>`);
  const b = $('.phone-body');
  b.querySelectorAll('[data-q]').forEach(x => x.onclick = () => { game.setQuality(x.dataset.q); appSettings(); });
  b.querySelectorAll('[data-fps]').forEach(x => x.onclick = () => { game.setFps(x.dataset.fps === '1'); appSettings(); });
  b.querySelectorAll('[data-r]').forEach(x => x.onclick = () => { game.setRadius(+x.dataset.r); appSettings(); });
  b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { game.setShadows(x.dataset.s === '1'); appSettings(); });
  b.querySelectorAll('[data-gl]').forEach(x => x.onclick = () => { game.setGlow(x.dataset.gl === '1'); appSettings(); });
  b.querySelectorAll('[data-ev]').forEach(x => x.onclick = () => { setEngineVolume(+x.dataset.ev); appSettings(); });
  b.querySelectorAll('[data-snd]').forEach(x => x.onclick = () => { setMuted(x.dataset.snd === '0'); appSettings(); });
  b.querySelectorAll('[data-vo]').forEach(x => x.onclick = () => { setVoice(x.dataset.vo === '1'); appSettings(); });
  b.querySelectorAll('[data-hw]').forEach(x => x.onclick = () => { setHalloween(x.dataset.hw === '1'); appSettings(); });
  b.querySelectorAll('[data-t]').forEach(x => x.onclick = () => { game.clock = +x.dataset.t; toast('Time changed'); });
  $('#s-reset').onclick = () => { game.missions.reset(); closePhone(); location.reload(); };
}

// ---------------------------------------------------------------- grocery shop
const ITEMS = [['Milk, 4 L', 6.49, 'list'], ['Eggs, dozen', 4.99, 'list'], ['Bread, loaf', 3.49, 'list'], ['Basmati rice, 4 kg', 11.99, 'list'], ['Onions, 1.4 kg bag', 3.29, 'list'],
  ['Red lentils (masoor daal), 1.8 kg', 6.99, ''], ['Bananas, about 1 kg', 1.79, ''], ['Chicken thighs, 1 kg', 9.99, ''], ['Potato chips, big bag', 4.79, 'treat'], ['Pop, 12 cans', 8.99, 'treat'], ['Chocolate bar', 2.49, 'treat']];
export function appShop(storeName, budget) {
  return new Promise(res => {
    game.phoneDone = res;
    const q = ITEMS.map(() => 0);
    const render = () => {
      const total = q.reduce((s, n, i) => s + n * ITEMS[i][1], 0);
      const listOk = ITEMS.every((it, i) => it[2] !== 'list' || q[i] > 0);
      show(storeName, `<div class="p-h">Ammi's list: milk, eggs, bread, rice, onions</div>
        <p style="font-size:13px;color:#5b6573;margin-top:-6px">You have $${budget.toFixed(2)}. Game prices, roughly like a Calgary grocery store.</p>
        ${ITEMS.map((it, i) => `<div class="shop-row"><div><b style="font-size:14px">${esc(it[0])}</b>${it[2] === 'list' ? ' 📝' : ''}<br><small>$${it[1].toFixed(2)}</small></div><div style="display:flex;gap:6px;align-items:center"><button data-m="${i}">−</button><span class="q">${q[i]}</span><button data-p="${i}">+</button></div></div>`).join('')}
        <div class="p-item" style="margin-top:8px"><b>Total: $${total.toFixed(2)}</b><small>${total > budget ? '⚠️ More than you have!' : 'Left over: $' + (budget - total).toFixed(2)}</small></div>
        <button class="p-btn" id="pay" ${!listOk || total > budget ? 'disabled style="opacity:.5"' : ''}>Pay at the checkout</button>`);
      const b = $('.phone-body');
      b.querySelectorAll('[data-p]').forEach(x => x.onclick = () => { q[+x.dataset.p]++; render(); });
      b.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { q[+x.dataset.m] = Math.max(0, q[+x.dataset.m] - 1); render(); });
      const pay = $('#pay'); if (pay) pay.onclick = () => { if (!listOk || total > budget) return; game.phoneDone = null; $('#phone').hidden = true; game.paused = false; res({ total, treats: ITEMS.reduce((s, it, i) => s + (it[2] === 'treat' ? q[i] : 0), 0) }); };
    };
    render();
  });
}

// real street photos of the places you've been and the landmarks you've found
function appReal() {
  const st = game.missions.state, W = game.world;
  const items = [...(st.visited || []), ...W.landmarks.filter(l => st.landmarks.includes(l.label)).map(l => ({ name: l.label, x: l.x, y: l.y, radius: l.full && !l.downtown ? 300 : 120 }))];
  show('Real photos', `<p style="font-size:13px;color:#5b6573;margin-top:0">See the real street photo of places you've been. Find more landmarks to add them here.</p>
    <div class="p-list">${items.length ? items.map((p, i) => `<button class="p-item" data-i="${i}"><b>📷 ${esc(p.name)}</b></button>`).join('') : '<p>Nothing yet: complete a mission or find a landmark.</p>'}</div>`);
  $('.phone-body').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closePhone(); game.openReal(items[+b.dataset.i]); });
}

// ---------------------------------------------------------------- nearby businesses (City of Calgary business licences)
function appBiz(cat = null, q = '') {
  const p = game.player, list = q ? searchBusinesses(q, p.x, p.y) : businessesNear(p.x, p.y, 1500, cat).slice(0, 30);
  const km = d => d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km';
  show('Nearby', `<input id="biz-q" class="p-input" placeholder="Search a business by name" value="${esc(q)}" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccd;margin-bottom:8px">
    <div class="chips"><button class="chip${!cat && !q ? ' on' : ''}" data-c="">All</button>${Object.entries(BIZ_CAT).map(([k, v]) => `<button class="chip${cat === k ? ' on' : ''}" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}</div>
    <div class="p-list">${list.length ? list.map(({ b, d }, i) => `<button class="p-item" data-i="${i}"><b>${BIZ_CAT[b.cat].icon} ${esc(b.name)}</b><br><small>${esc(b.addr)} · ${km(d)}</small></button>`).join('') : '<p>Nothing found close by.</p>'}</div>
    <p style="font-size:11px;color:#5b6573">From the City of Calgary business licence list. Tap one to set a waypoint.</p>`);
  const body = $('.phone-body');
  body.querySelectorAll('[data-c]').forEach(x => x.onclick = () => appBiz(x.dataset.c || null));
  const inp = body.querySelector('#biz-q'); inp.onkeydown = e => { if (e.key === 'Enter') appBiz(null, inp.value); }; inp.onchange = () => appBiz(null, inp.value);
  body.querySelectorAll('[data-i]').forEach(x => x.onclick = () => { const b = list[+x.dataset.i].b; game.setWaypoint(b.x, b.y); toast('Waypoint: ' + b.name); closePhone(); });
}

// ---------------------------------------------------------------- Go to address: type an address, jump there
// data/addr.wasm (gzip JSON, tools/build_addr.py): { s: [street names], a: { streetIndex: [[number, x, y, sx, sy, h], ...] } }
let ADDR = null;
async function loadAddr() {
  if (ADDR) return ADDR;
  const r = await fetch('data/addr.wasm'); if (!r.ok) throw new Error('no address list');
  const txt = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
  const d = JSON.parse(txt);
  ADDR = { streets: d.s, a: d.a, norm: d.s.map(normSt) };
  return ADDR;
}
const ABBR = { STREET: 'ST', AVENUE: 'AV', AVE: 'AV', ROAD: 'RD', DRIVE: 'DR', BOULEVARD: 'BV', BLVD: 'BV', CRESCENT: 'CR', CRES: 'CR', COURT: 'CO', CT: 'CO', CLOSE: 'CL', PLACE: 'PL', TRAIL: 'TR', WAY: 'WY', LANE: 'LN', GATE: 'GA', HEIGHTS: 'HT', HTS: 'HT', CIRCLE: 'CI', CIR: 'CI', PARK: 'PA', TERRACE: 'TC', TER: 'TC', GREEN: 'GR', GROVE: 'GV', LINK: 'LI', VIEW: 'VW', SQUARE: 'SQ', MEWS: 'ME', COMMON: 'CM', COMMONS: 'CM', MANOR: 'MR', POINT: 'PT', RISE: 'RI', HILL: 'HL', BAY: 'BA', ROW: 'RO', LANDING: 'LD', PARKWAY: 'PY', HIGHWAY: 'HI', NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW' };
function normSt(s) { return String(s).toUpperCase().replace(/[.,#]/g, ' ').split(/\s+/).filter(Boolean).map(w => ABBR[w] || w).join(' '); }
function findAddress(q) {
  const A = ADDR; q = normSt(q);
  const m = q.match(/^(\d+[A-Z]?)\s+(.*)$/); const num = m ? m[1] : null, st = m ? m[2] : q;
  if (!st) return [];
  const words = st.split(' ');
  const hits = [];
  for (let i = 0; i < A.norm.length && hits.length < 60; i++) {
    const n = A.norm[i]; if (!words.every(w => n.split(' ').some(x => x.startsWith(w)))) continue;
    hits.push(i);
  }
  const out = [];
  for (const i of hits) {
    const list = A.a[i] || [];
    if (num) { const e = list.find(e => String(e[0]) === num) || list.find(e => String(e[0]).startsWith(num)); if (e) out.push({ label: e[0] + ' ' + A.streets[i], e }); }
    else if (list.length) { const e = list[Math.floor(list.length / 2)]; out.push({ label: A.streets[i] + ` (${list.length} addresses)`, e }); }
    if (out.length >= 12) break;
  }
  return out;
}
function appGoto(q = '', results = null) {
  show('Go to address', `<input id="addr-q" class="p-input" placeholder="e.g. 800 Macleod Tr SE" value="${esc(q)}" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccd;margin-bottom:8px" autocomplete="off">
    <button class="p-btn" id="addr-go">Find</button>
    <div class="p-list" id="addr-res">${results ? (results.length ? results.map((r, i) => `<button class="p-item" data-i="${i}"><b>📍 ${esc(r.label)}</b></button>`).join('') : '<p>No address found. Try the house number and street, like "123 Main St NE".</p>') : '<p style="color:#5b6573;font-size:13px">Type any Calgary address. You will be taken right in front of it.</p>'}</div>
    <p style="font-size:11px;color:#5b6573">Addresses: City of Calgary Parcel Address open data.</p>`);
  const body = $('.phone-body'), inp = body.querySelector('#addr-q');
  const go = async () => {
    const v = inp.value.trim(); if (!v) return;
    body.querySelector('#addr-res').innerHTML = '<p>Searching…</p>';
    try { await loadAddr(); appGoto(v, findAddress(v)); } catch (e) { body.querySelector('#addr-res').innerHTML = '<p>The address list could not be loaded.</p>'; }
  };
  body.querySelector('#addr-go').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  if (!results) setTimeout(() => inp.focus(), 50);
  if (results) body.querySelectorAll('[data-i]').forEach(x => x.onclick = () => {
    const r = results[+x.dataset.i], e = r.e;
    closePhone(); game.teleport(e[3] ?? e[1], e[4] ?? e[2], e[5] ?? 0); game.setWaypoint(e[1], e[2]); toast('📍 ' + r.label);
  });
}

// ---------------------------------------------------------------- City facts
const FUN = [
  'The Calgary Stampede started in 1912 and calls itself "The Greatest Outdoor Show on Earth".',
  'Calgary hosted the 1988 Winter Olympics. Canada Olympic Park and the Olympic Oval are still used for training.',
  'The Calgary Tower is 191 m tall and opened in 1968. Its glass floor hangs over 9th Avenue.',
  'The +15 skywalks join downtown buildings about 15 feet above the street, so you can cross downtown without going outside.',
  'A chinook wind can raise the temperature by more than 20 °C in a few hours in the middle of winter.',
  'Fish Creek Provincial Park and Nose Hill Park are two of the largest urban parks in Canada.',
  'The red Peace Bridge over the Bow River was designed by Santiago Calatrava and opened in 2012.',
  'The CTrain opened in 1981 and was one of the first light rail systems in North America.',
  'Calgary sits where the Bow and Elbow rivers meet. Fort Calgary was built there in 1875.',
  '3-1-1 is the City\'s number for non-emergency services: potholes, bins, streetlights, bylaw and more.',
];
async function appFacts() {
  const p = game.player, ward = wardAt(game.world, p.x, p.y), comm = communityAt(game.world, p.x, p.y), councillor = ward && ward.c;
  const fun = FUN[Math.floor(Math.random() * FUN.length)];
  const html = live => `<div class="p-h">Calgary right now</div>
    <div class="p-item"><b>Mayor</b><br><small>Jeromy Farkas (since October 2025)</small></div>
    <div class="p-item"><b>Population</b><br><small>About 1.58 million (City of Calgary estimate for 2026)</small></div>
    <div class="p-item"><b>Open 311 requests</b><br><small>${live}</small></div>
    ${ward ? `<div class="p-item"><b>You are in Ward ${esc(ward.n)}${comm ? ', ' + esc(comm.n) : ''}</b><br><small>${councillor ? 'Your councillor: ' + esc(councillor) : ''}</small></div>` : ''}
    <div class="p-h">Fun fact</div><p>${esc(fun)}</p>
    <button class="p-btn alt" id="f-more">Another fact</button>
    <p style="font-size:11px;color:#5b6573">311 count: City of Calgary open data, live. Population: City of Calgary population outlook.</p>`;
  show('City facts', html('Checking…'));
  $('.phone-body').querySelector('#f-more').onclick = () => appFacts();
  try {
    const url = 'https://data.calgary.ca/resource/iahh-g8bj.json?' + new URLSearchParams({ '$select': 'count(*) as n', '$where': "status_description='Open'" });
    const r = await fetch(url); const j = await r.json(); const n = +(j[0] && j[0].n);
    if (isFinite(n) && $('.phone-title').textContent === 'City facts') { const el = [...$('.phone-body').querySelectorAll('.p-item small')][2]; if (el) el.textContent = n.toLocaleString() + ' service requests are open right now'; }
  } catch (e) { const el = [...$('.phone-body').querySelectorAll('.p-item small')][2]; if (el) el.textContent = 'Not available offline'; }
}

// a random address between rmin and rmax metres from (x, y), with the spot on the street in front of it (for deliveries)
export async function randomAddressNear(x, y, rmin = 300, rmax = 1500) {
  try { await loadAddr(); } catch (e) { return null; }
  const A = ADDR, cand = [];
  for (const [si, list] of Object.entries(A.a)) for (const e of list) { const d = Math.hypot(e[1] - x, e[2] - y); if (d >= rmin && d <= rmax) cand.push([si, e]); if (cand.length > 4000) break; }
  if (!cand.length) return null;
  const [si, e] = cand[Math.floor(Math.random() * cand.length)];
  return { x: e[3] ?? e[1], y: e[4] ?? e[2], label: e[0] + ' ' + A.streets[+si] };
}
