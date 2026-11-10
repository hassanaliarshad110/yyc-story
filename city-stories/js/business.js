// Real Calgary businesses (City of Calgary business licences): storefront signs on the right buildings near you,
// and a lookup for the phone's "Nearby" app.
import * as THREE from 'three';
import { L } from './tiles.js';
import { ground } from './terrain.js';
import { LM_GROUPS } from './houses3d.js';
const RAY = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();

export const BIZ_CAT = {
  food: { icon: '🍽️', col: '#b8432f', label: 'Food' }, shop: { icon: '🛍️', col: '#1f5fa8', label: 'Shops' },
  service: { icon: '✂️', col: '#7a3fa0', label: 'Services' }, auto: { icon: '🔧', col: '#3d4a57', label: 'Auto' }, learn: { icon: '📚', col: '#1e7a46', label: 'Learning' },
};
let LIST = [], GRID = new Map(); const C = 100;
export async function loadBusinesses() {
  try { const d = await (await fetch('data/biz.json')).json(); LIST = d.b.map(r => ({ x: r[0], y: r[1], name: r[2], cat: r[3], addr: r[4] })); }
  catch (e) { console.warn('no businesses', e); LIST = []; }
  for (const b of LIST) { const k = Math.floor(b.x / C) + ',' + Math.floor(b.y / C); let l = GRID.get(k); if (!l) GRID.set(k, l = []); l.push(b); }
  return LIST.length;
}
export function businessesNear(x, y, r = 300, cat = null) {
  const out = [], n = Math.ceil(r / C), cx = Math.floor(x / C), cy = Math.floor(y / C);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const b of GRID.get((cx + i) + ',' + (cy + j)) || []) {
    if (cat && b.cat !== cat) continue; const d = Math.hypot(b.x - x, b.y - y); if (d <= r) out.push({ b, d });
  }
  return out.sort((a, b) => a.d - b.d);
}
export function searchBusinesses(q, x, y, max = 30) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  return LIST.filter(b => b.name.toLowerCase().includes(q)).map(b => ({ b, d: Math.hypot(b.x - x, b.y - y) })).sort((a, b) => a.d - b.d).slice(0, max);
}

// ---- signs
// store numbers from the licence ("Dollarama #1354", "Dollarama 1691") don't go on the sign
const signName = n => (n || '').replace(/\s*#\s*\d+\s*$/, '').replace(/\s+\d{3,5}\s*$/, '').trim();
function signTexture(b0) {
  const b = { ...b0, name: signName(b0.name) };
  const c = document.createElement('canvas'), g = c.getContext('2d'), cat = BIZ_CAT[b.cat] || BIZ_CAT.shop;
  g.font = '700 46px system-ui, sans-serif'; const tw = g.measureText(b.name).width;
  c.width = Math.min(1400, Math.max(320, Math.ceil(tw + 110))); c.height = 96;
  g.fillStyle = cat.col; g.fillRect(0, 0, c.width, 96); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, c.width, 6); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 90, c.width, 6);
  g.font = '44px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(cat.icon, 14, 50);
  g.fillStyle = '#ffffff'; g.font = '700 46px system-ui, sans-serif'; g.fillText(b.name, 82, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { t, aspect: c.width / 96 };
}
// the storefront: the building the business is in (or the nearest one), on its wall that faces the nearest street
export function wallFor(tiles, b) {
  const t = tiles.tileAt(b.x, b.y); if (!t || !t.layers || !t.layers[L.BLD]) return null;
  const lx = b.x - t.ox, ly = b.y - t.oy;
  let bld = null, bd = 30;
  for (const f of t.layers[L.BLD]) {
    const r = f.rings[0], n = r.length / 2; if (n < 3) continue;
    let ins = false;
    for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1]; if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi + 1e-12) + xi) ins = !ins; }
    let d = ins ? 0 : 1e9;
    if (!ins) for (let i = 0; i < n; i++) { const j = (i + 1) % n, ax = r[i * 2], ay = r[i * 2 + 1], ex = r[j * 2] - ax, ey = r[j * 2 + 1] - ay, L2 = ex * ex + ey * ey || 1; let u = Math.max(0, Math.min(1, ((lx - ax) * ex + (ly - ay) * ey) / L2)); d = Math.min(d, Math.hypot(lx - ax - ex * u, ly - ay - ey * u)); }
    if (d < bd) { bd = d; bld = f; }
  }
  if (!bld) return null;
  // nearest street point
  let rp = null, rd = 120;
  for (const f of t.layers[L.ROAD] || []) {
    if (f.kind === 1 || f.kind === 2 || f.kind === 8) continue;
    const r = f.rings[0];
    for (let i = 0; i + 3 < r.length; i += 2) { const ax = r[i], ay = r[i + 1], ex = r[i + 2] - ax, ey = r[i + 3] - ay, L2 = ex * ex + ey * ey || 1; const u = Math.max(0, Math.min(1, ((lx - ax) * ex + (ly - ay) * ey) / L2)), px = ax + ex * u, py = ay + ey * u, d = Math.hypot(lx - px, ly - py); if (d < rd) { rd = d; rp = [px, py]; } }
  }
  const r = bld.rings[0], n = r.length / 2;
  let area = 0; for (let i = 0, j = n - 1; i < n; j = i++) area += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1];
  const s = area < 0 ? -1 : 1;
  let best = null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = r[i * 2], ay = r[i * 2 + 1], ex = r[j * 2] - ax, ey = r[j * 2 + 1] - ay, l = Math.hypot(ex, ey); if (l < 3) continue;
    const nx = s * ey / l, ny = -s * ex / l, mx = ax + ex / 2, my = ay + ey / 2;
    let u = ((lx - ax) * ex + (ly - ay) * ey) / (l * l); u = Math.max(0.12, Math.min(0.88, u));
    const px = ax + ex * u, py = ay + ey * u;
    const face = rp ? ((rp[0] - mx) * nx + (rp[1] - my) * ny) / (Math.hypot(rp[0] - mx, rp[1] - my) || 1) : 0;
    const score = face * 2 - Math.hypot(lx - px, ly - py) / 15 + Math.min(1, l / 20) * 0.3;
    if (!best || score > best.score) best = { score, x: px + t.ox, y: py + t.oy, nx, ny, len: l, h: bld.a / 10, key: t.ix + ':' + t.iy + ':' + t.layers[L.BLD].indexOf(bld) + ':' + i, ax: ax + t.ox, ay: ay + t.oy, ex: ex / l, ey: ey / l, u: u * l };
  }
  return best;
}
export class Signs {
  constructor(scene, tiles) { this.scene = scene; this.tiles = tiles; this.live = new Map(); this.t = 0; this.slots = new Map(); }
  update(dt, x, y) {
    if ((this.t -= dt) > 0) return; this.t = 0.4;
    const want = businessesNear(x, y, 220).slice(0, 40), keep = new Set();
    for (const { b } of want) {
      keep.add(b);
      if (this.live.has(b)) continue;
      const w = wallFor(this.tiles, b); if (!w) continue;
      const { t: tex, aspect } = signTexture(b), sh = 1.0, width = Math.min(w.len - 0.4, sh * aspect), hgt = sh * (width / (sh * aspect));
      // find a free spot on this wall: slide along it, then go up a row
      const used = this.slots.get(w.key) || []; let pos = null;
      for (let row = 0; row < 3 && !pos; row++) for (let k = 0; k < 40 && !pos; k++) {
        const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6, c0 = Math.max(width / 2 + 0.2, Math.min(w.len - width / 2 - 0.2, w.u + off));
        if (!used.some(q => q.row === row && Math.abs(q.c - c0) < (q.w + width) / 2 + 0.3)) pos = { row, c: c0, w: width };
      }
      if (!pos) continue;
      used.push(pos); this.slots.set(w.key, used);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(width, hgt), mat);
      const wx = w.ax + w.ex * pos.c, wy = w.ay + w.ey * pos.c, base = ground(wx, wy); let y0 = Math.min(Math.max(2.6, w.h - 1.2), 3.9) + pos.row * (hgt + 0.25);
      // the footprint's wall and the 3D building's real wall can be metres apart: look along the wall's normal for the real
      // facade (city buildings and landmark models) and put the sign flat on it
      let px = wx, py = wy, nx = w.nx, ny = w.ny;
      const tile = this.tiles.tileAt(wx, wy), tg = [];
      if (tile && tile.group) for (const c of tile.group.children) if (c.userData.bld) tg.push(c);
      for (const g of LM_GROUPS) if (Math.hypot(g.position.x - wx, -g.position.z - wy) < 250) tg.push(g);
      // inside a landmark model (the Superstores): the sign goes up high on its front wall
      const lm = LM_GROUPS.find(g => { const L = g.userData.lm; return L && Math.hypot(L.x - wx, L.y - wy) < Math.max(L.size[0], L.size[2]) / 2 + 12; });
      if (lm) { const L = lm.userData.lm; y0 = Math.max(y0, Math.min(L.size[1] * 0.62, 8)); }
      if (tg.length) {
        RAY.set(_o.set(wx + w.nx * 14, base + y0 + hgt / 2, -(wy + w.ny * 14)), _d.set(-w.nx, 0, w.ny)); RAY.far = 40;
        const hit = RAY.intersectObjects(tg, true)[0];
        if (hit) {
          if (hit.face) { _n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); const hl = Math.hypot(_n.x, _n.z); if (hl > 0.7 && (_n.x * w.nx - _n.z * w.ny) / hl > 0.5) { nx = _n.x / hl; ny = -_n.z / hl; } }
          px = hit.point.x; py = -hit.point.z;
        }
      }
      m.position.set(px + nx * 0.12, base + y0, -(py + ny * 0.12)); m.rotation.y = Math.atan2(nx, -ny);
      m.userData.biz = b; m.userData.key = w.key; m.userData.slot = pos;
      this.scene.add(m); this.live.set(b, m);
    }
    for (const [b, m] of this.live) if (!keep.has(b)) { this.scene.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); this.live.delete(b); const u = this.slots.get(m.userData.key); if (u) { const i = u.indexOf(m.userData.slot); if (i >= 0) u.splice(i, 1); if (!u.length) this.slots.delete(m.userData.key); } }
  }
}
