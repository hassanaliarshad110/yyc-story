// The in-game phone: Calgary 311, Transit, Find help, Map, Missions, Settings.
import { $, esc, toast, openMap } from './hud.js';
import { communityAt, wardAt, nearest } from './world.js';

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
    <button class="app" data-app="real"><i style="background:#0b7a75">📷</i>Real photos</button></div>
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
    return `<button class="p-item" data-m="${i}" ${avail ? '' : 'disabled style="opacity:.5"'}><b>${done ? '✅' : avail ? '▶️' : '🔒'} ${i + 1}. ${esc(m.title)}</b><small>${esc(m.teaches)}</small></button>`;
  }).join('')}</div>
  <div class="p-h" style="margin-top:14px">Landmarks found: ${game.missions.state.landmarks.length} / ${game.world.landmarks.length}</div>
  <div class="chips">${game.world.landmarks.map(l => `<span class="chip${game.missions.state.landmarks.includes(l.label) ? ' on' : ''}">${esc(l.label)}</span>`).join('')}</div>`);
  $('.phone-body').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { closePhone(); game.missions.start(+b.dataset.m); });
}

function appSettings() {
  const q = game.settings;
  show('Settings', `<div class="p-h">View distance</div><div class="chips">${[['1', 'Short (faster)'], ['2', 'Normal'], ['3', 'Far']].map(([v, t]) => `<button class="chip${String(q.radius) === v ? ' on' : ''}" data-r="${v}">${t}</button>`).join('')}</div>
    <div class="p-h">Shadows</div><div class="chips"><button class="chip${q.shadows ? ' on' : ''}" data-s="1">On</button><button class="chip${!q.shadows ? ' on' : ''}" data-s="0">Off</button></div>
    <div class="p-h">Time of day</div><div class="chips">${[['8', 'Morning'], ['13', 'Afternoon'], ['18.5', 'Evening'], ['22', 'Night']].map(([v, t]) => `<button class="chip" data-t="${v}">${t}</button>`).join('')}</div>
    <button class="p-btn alt" id="s-reset">Start the story again</button>
    <p style="font-size:12px;color:#5b6573;margin-top:16px"><b>YYC Story</b> · A game by Hassan Ali<br>${game.world.credits.data.map(esc).join('<br>')}<br>Map data downloaded ${esc((game.world.osm_date || '').slice(0, 10))}.</p>`);
  const b = $('.phone-body');
  b.querySelectorAll('[data-r]').forEach(x => x.onclick = () => { game.setRadius(+x.dataset.r); appSettings(); });
  b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { game.setShadows(x.dataset.s === '1'); appSettings(); });
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
