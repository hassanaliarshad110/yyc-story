// Calgary 311 requests from the last two weeks (City of Calgary open data, refreshed every two weeks): a small icon for
// each request near you. The open data only gives each request's community, so every icon sits at its own random spot
// inside that community (the same spot every time). Tap an icon to see what the request is about.
import * as THREE from 'three';
import { ground } from './terrain.js?v=11111720';
import { card } from './hud.js?v=11111720';

const CELL = 200;
const ICONS = [
  [/animal|dog|cat\b|wildlife|coyote|pet/i, '🐾', '#8a5a2b'],
  [/snow|ice|sand|plow/i, '❄️', '#5aa7d6'],
  [/WRS|waste|garbage|recycl|cart|compost|litter|dump/i, '🗑️', '#6b7a3a'],
  [/tree|parks|grass|weed|playground|pathway|mow/i, '🌳', '#2f8f5a'],
  [/WATS|water|sewer|drain|hydrant|flood|leak/i, '💧', '#2b6cb0'],
  [/transit|bus\b|ctrain|lrt|shelter/i, '🚌', '#c8102e'],
  [/light|lamp/i, '💡', '#c9a227'],
  [/CFD|fire/i, '🚒', '#b8432f'],
  [/pothole|roads|street|sidewalk|curb|lane|traffic|sign|signal|crack|debris/i, '🚧', '#d9822b'],
  [/bylaw|noise|graffiti|nuisance|parking|vehicle|property|fence|DBBS|permit|encampment|safety/i, '📋', '#7a3fa0'],
];
const iconFor = s => { for (const [re, e, c] of ICONS) if (re.test(s)) return [e, c]; return ['📍', '#1d4f91']; };
const TEX = {};
function iconTexture(e, col, open) {
  const k = e + col + open; if (TEX[k]) return TEX[k];
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(48, 52, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(48, 46, 40, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = open ? '#ffffff' : 'rgba(255,255,255,0.55)'; g.stroke();
  g.font = '44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 49);
  if (!open) { g.fillStyle = '#2f8f5a'; g.beginPath(); g.arc(80, 16, 13, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 18px system-ui'; g.fillText('✓', 80, 17); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return TEX[k] = t;
}
// a deterministic random number from a string
function hash(s, n = 0) { let h = 2166136261 ^ n; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1e6) / 1e6; }
function inPoly(rings, x, y) {
  let ins = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) ins = !ins; }
  return ins;
}

export class Requests311 {
  constructor(scene, camera, world, canvas, tiles) {
    this.scene = scene; this.camera = camera; this.tiles = tiles; this.live = new Map(); this.t = 0; this.grid = new Map(); this.list = [];
    this.comms = new Map(); for (const c of world.communities || []) this.comms.set(c.code, c);
    this.ray = new THREE.Raycaster(); this.group = new THREE.Group(); this.group.name = '311'; scene.add(this.group);
    this.load();
    // a tap (not a drag) on an icon opens it
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; });
    canvas.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10 || performance.now() - down[2] > 600) return;
      const r = canvas.getBoundingClientRect(), v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(v, this.camera); const hit = this.ray.intersectObjects(this.group.children, false)[0];
      if (hit && hit.object.userData.req) this.open(hit.object.userData.req);
    });
  }
  async load() {
    try { this.d = await (await fetch('data/311.json')).json(); } catch (e) { console.warn('no 311 data', e); return; }
    const d = this.d;
    for (const r of d.r) {
      const [code] = d.comm[r[4]], c = this.comms.get(code); if (!c) continue;
      const p = this.spot(c, r[0]); if (!p) continue;
      const q = { id: r[0], date: r[1], svc: d.svc[r[2]], agency: d.agency[r[3]], comm: d.comm[r[4]][1], open: r[5] === 0, src: r[6], x: p[0], y: p[1] };
      this.list.push(q); const k = Math.floor(q.x / CELL) + ',' + Math.floor(q.y / CELL); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(q);
    }
    this.count = this.list.length;
  }
  // a random spot inside the community, kept off the buildings where we can tell (same spot for the same request)
  spot(c, id) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const rings = [];
    for (const poly of c.polys) for (const ring of poly) { rings.push(ring); for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    for (let n = 0; n < 40; n++) { const x = x0 + hash(id, n * 2) * (x1 - x0), y = y0 + hash(id, n * 2 + 1) * (y1 - y0); if (inPoly(rings, x, y)) return [x, y]; }
    return null;
  }
  near(x, y, r) {
    const out = [], n = Math.ceil(r / CELL), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const q of this.grid.get((cx + i) + ',' + (cy + j)) || []) { const d = Math.hypot(q.x - x, q.y - y); if (d < r) out.push([d, q]); }
    return out.sort((a, b) => a[0] - b[0]).slice(0, matchMedia('(pointer: coarse)').matches ? 60 : 160).map(a => a[1]);
  }
  update(dt, x, y) {
    if (!this.list.length || (this.t -= dt) > 0) return; this.t = 0.5;
    const want = new Set(this.near(x, y, 450));
    for (const q of want) {
      if (this.live.has(q)) continue;
      if (this.tiles && this.tiles.insideBuilding && this.tiles.insideBuilding(q.x, q.y)) { const s = this.tiles.safeSpot ? this.tiles.safeSpot(q.x, q.y, { maxR: 40 }) : null; if (s) { q.x = s.x ?? s[0]; q.y = s.y ?? s[1]; } }
      const [e, col] = iconFor(q.svc), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(e, col, q.open), depthWrite: false, sizeAttenuation: true }));
      s.scale.set(2.2, 2.2, 1); s.position.set(q.x, ground(q.x, q.y) + 2.6, -q.y); s.userData.req = q; s.renderOrder = 5;
      this.group.add(s); this.live.set(q, s);
    }
    for (const [q, s] of this.live) if (!want.has(q)) { this.group.remove(s); s.material.dispose(); this.live.delete(q); }
    // a gentle bob so they read as things to tap
    const t = performance.now() / 1000; for (const s of this.group.children) s.position.y += Math.sin(t * 2 + s.id) * 0.02;
  }
  open(q) {
    const game = window.game || {};
    const ds = String(q.date), date = new Date(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8)).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    card({
      tag: '311 request', title: q.svc,
      body: `<p><b>${q.open ? '🟠 Open' : '✅ Closed'}</b> · reported ${esc(date)}${q.src && !/^other$/i.test(q.src) ? ' by ' + esc(q.src.toLowerCase()) : ''}</p>
        <p>📍 ${esc(q.comm)} <small>(the City shares only the community, so this spot is approximate)</small></p>
        ${q.agency ? `<p>Handled by: ${esc(q.agency)}</p>` : ''}<p>Request number: <b>${esc(q.id)}</b></p>
        <p><small>See something like this in your neighbourhood? Report it on the 311 app, at calgary.ca/311 or by calling 311.</small></p>
        ${q.open ? `<p><button id="r311-help" class="primary" style="padding:8px 14px;border-radius:10px">🤝 Pitch in and help (a good deed)</button></p>` : ''}`,
      src: [['This request in the City\'s 311 open data', 'https://data.calgary.ca/resource/iahh-g8bj.json?service_request_id=' + encodeURIComponent(q.id)], ['Calgary 311', 'https://www.calgary.ca/311.html']],
    });
    const hb = document.getElementById('r311-help');
    if (hb) { if (game.powers && game.powers.helped.has('311:' + q.id)) { hb.disabled = true; hb.textContent = '💛 You helped here'; }
      hb.onclick = () => { if (game.powers && game.powers.deed('you pitched in on a 311 issue (' + q.svc + ')', '311:' + q.id)) { hb.disabled = true; hb.textContent = '💛 Thanks for helping!'; } }; }
  }
}
