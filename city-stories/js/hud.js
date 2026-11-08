// On-screen interface: minimap, full map, dialogue, info cards, quizzes, toasts, objective.
import { L, AREA_COL } from './tiles.js';
import { communityAt } from './world.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { $, esc };

let world = null, game = null;
const overview = {};    // Path2D layers in world coords (x, -north)
export function initHUD(w, g) {
  world = w; game = g;
  const RW = { 1: 14, 2: 12, 3: 10, 4: 9, 5: 8, 8: 7, 10: 7 };
  for (const o of w.overview) {
    let key = o.c >= 20 ? (o.c === 22 ? 'ctrain' : o.c === 30 ? 'river' : 'rail') : 'r' + o.c;
    const p = overview[key] ||= new Path2D();
    o.p.forEach(([x, y], i) => i ? p.lineTo(x, -y) : p.moveTo(x, -y));
  }
  overview.green = new Path2D(); overview.water = new Path2D(); overview.land = new Path2D();
  for (const b of w.big) {
    const p = b.k === 99 ? overview.water : [5, 6, 7, 8, 13, 18, 9].includes(b.k) ? overview.green : null;
    if (!p) continue;
    for (const r of b.rings) r.forEach(([x, y], i) => i ? p.lineTo(x, -y) : p.moveTo(x, -y));
  }
  overview.city = new Path2D();
  for (const poly of w.city) poly[0].forEach(([x, y], i) => i ? overview.city.lineTo(x, -y) : overview.city.moveTo(x, -y));
  overview.comms = new Path2D();
  for (const c of w.communities) for (const poly of c.polys) poly[0].forEach(([x, y], i) => i ? overview.comms.lineTo(x, -y) : overview.comms.moveTo(x, -y));
  for (const c of w.communities) {        // label point: centre of the bounding box of the biggest ring
    const r = c.polys.map(p => p[0]).sort((a, b) => b.length - a.length)[0];
    let sx = 0, sy = 0; r.forEach(([x, y]) => { sx += x; sy += y; }); c.lx = sx / r.length; c.ly = sy / r.length;
  }
  $('.bm-x').onclick = closeMap;
  initBigMapInput();
}

// ---------------------------------------------------------------- tile paths for the minimap
export function tilePaths(t) {
  const mm = { roads: [], green: new Path2D(), water: new Path2D(), bld: new Path2D(), paths: new Path2D(), rail: new Path2D() };
  const poly = (p, r) => { for (let i = 0; i < r.length; i += 2) i ? p.lineTo(r[i], -r[i + 1]) : p.moveTo(r[i], -r[i + 1]); p.closePath(); };
  const line = (p, r) => { for (let i = 0; i < r.length; i += 2) i ? p.lineTo(r[i], -r[i + 1]) : p.moveTo(r[i], -r[i + 1]); };
  for (const f of t.layers[L.AREA] || []) if ([5, 6, 7, 8, 13, 14, 18].includes(f.kind)) f.rings.forEach(r => poly(mm.green, r));
  for (const f of t.layers[L.WATER] || []) f.rings.forEach(r => poly(mm.water, r));
  for (const f of t.layers[L.BLD] || []) poly(mm.bld, f.rings[0]);
  for (const f of t.layers[L.PATH] || []) line(mm.paths, f.rings[0]);
  for (const f of t.layers[L.RAIL] || []) line(mm.rail, f.rings[0]);
  const by = {};
  for (const f of t.layers[L.ROAD] || []) { if (f.kind > 10) continue; const w = Math.round(f.a / 10); const p = by[w] ||= new Path2D(); line(p, f.rings[0]); }
  mm.roads = Object.entries(by).map(([w, p]) => [+w, p]).sort((a, b) => a[0] - b[0]);
  t.mm = mm;
}

// ---------------------------------------------------------------- minimap
const mmc = () => $('#minimap');
export function drawMinimap(player, tiles, camH, target, icons = []) {
  const c = mmc(), g = c.getContext('2d'), W = c.width, H = c.height;
  const scale = player.mode === 'car' ? 0.16 : 0.32;     // pixels per metre
  g.save();
  g.fillStyle = '#d9d4c3'; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2); g.rotate(-camH); g.scale(scale, scale); g.translate(-player.x, player.y);
  // overview green and water (far)
  g.fillStyle = '#b5d39c'; g.fill(overview.green, 'evenodd');
  g.fillStyle = '#8fb8dd'; g.fill(overview.water, 'evenodd');
  for (const t of tiles.tiles.values()) {
    if (!t.mm) continue;
    g.save(); g.translate(t.ox, -t.oy);
    g.fillStyle = '#b5d39c'; g.fill(t.mm.green);
    g.fillStyle = '#8fb8dd'; g.fill(t.mm.water);
    g.fillStyle = '#bdb6a6'; g.fill(t.mm.bld);
    g.restore();
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#8fb8dd'; g.lineWidth = 14; if (overview.river) g.stroke(overview.river);
  for (const t of tiles.tiles.values()) {
    if (!t.mm) continue;
    g.save(); g.translate(t.ox, -t.oy);
    for (const [w, p] of t.mm.roads) { g.strokeStyle = w >= 12 ? '#f2b46b' : w >= 9 ? '#fbe7a6' : '#ffffff'; g.lineWidth = Math.max(w, 3 / scale); g.stroke(p); }
    g.strokeStyle = '#c8102e'; g.lineWidth = 3 / scale; g.stroke(t.mm.rail);
    g.restore();
  }
  // far roads where tiles are not loaded
  g.strokeStyle = '#f2b46b'; g.lineWidth = 9; for (const k of ['r1', 'r2']) if (overview[k]) g.stroke(overview[k]);
  g.strokeStyle = '#fbe7a6'; g.lineWidth = 7; for (const k of ['r3', 'r4']) if (overview[k]) g.stroke(overview[k]);
  g.restore();
  // target
  if (target) {
    const dx = (target.x - player.x) * scale, dy = -(target.y - player.y) * scale;
    const ca = Math.cos(-camH), sa = Math.sin(-camH);
    let px = dx * ca - dy * sa, py = dx * sa + dy * ca;
    const R = W / 2 - 10, d = Math.hypot(px, py);
    if (d > R) { px *= R / d; py *= R / d; }
    g.fillStyle = '#ffc400'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.arc(W / 2 + px, H / 2 + py, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // icons (e.g. the helicopter, the concert): an emoji at the edge if far away
  for (const ic of icons) {
    const dx = (ic.x - player.x) * scale, dy = -(ic.y - player.y) * scale, ca = Math.cos(-camH), sa = Math.sin(-camH);
    let px = dx * ca - dy * sa, py = dx * sa + dy * ca; const R = W / 2 - 14, d = Math.hypot(px, py); if (d > R) { px *= R / d; py *= R / d; }
    g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic.e, W / 2 + px, H / 2 + py);
  }
  // player arrow
  g.save(); g.translate(W / 2, H / 2); g.rotate(player.h - camH);
  g.fillStyle = '#c8102e'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
  // north marker
  const nx = W / 2 + Math.sin(-camH) * (W / 2 - 12), ny = H / 2 - Math.cos(-camH) * (H / 2 - 12);
  g.fillStyle = '#10161d'; g.beginPath(); g.arc(nx, ny, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
}

// ---------------------------------------------------------------- big map
const bm = { cx: 0, cy: 0, scale: 0.05, open: false, cats: { grocery: true, library: true, rec: true, landmark: true } };
export function openMap() {
  const p = game.player; bm.cx = p.x; bm.cy = p.y; bm.scale = 0.06; bm.open = true;
  $('#bigmap').hidden = false; resizeMap(); drawMap();
  $('.bm-legend').innerHTML = `<div><i style="background:#c8102e"></i>You</div><div><i style="background:#ffc400"></i>Mission / waypoint</div><div><i style="background:#1c8c40"></i>Grocery store</div><div><i style="background:#2856c8"></i>Library</div><div><i style="background:#e67814"></i>Recreation</div><div><i style="background:#7a3fa0"></i>Landmark</div>`;
}
export function closeMap() { bm.open = false; $('#bigmap').hidden = true; }
export function mapOpen() { return bm.open; }
function resizeMap() { const c = $('#bigmap-c'); c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; }
function drawMap() {
  const c = $('#bigmap-c'), g = c.getContext('2d'), W = c.width, H = c.height, dpr = devicePixelRatio;
  const s = bm.scale * dpr;
  g.fillStyle = '#d8d3c2'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-bm.cx, bm.cy);
  g.fillStyle = '#ece8dc'; g.fill(overview.city);
  g.fillStyle = '#b5d39c'; g.fill(overview.green, 'evenodd');
  g.fillStyle = '#8fb8dd'; g.fill(overview.water, 'evenodd');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (bm.scale > 0.12) {
    for (const t of game.tiles.tiles.values()) {
      if (!t.mm) continue;
      g.save(); g.translate(t.ox, -t.oy);
      g.fillStyle = '#b5d39c'; g.fill(t.mm.green); g.fillStyle = '#8fb8dd'; g.fill(t.mm.water); g.fillStyle = '#c9c1b0'; g.fill(t.mm.bld);
      for (const [w, p] of t.mm.roads) { g.strokeStyle = w >= 12 ? '#f2b46b' : '#fff'; g.lineWidth = Math.max(w, 1.2 / s); g.stroke(p); }
      g.restore();
    }
  }
  g.strokeStyle = '#8fb8dd'; g.lineWidth = Math.max(10, 2 / s); if (overview.river) g.stroke(overview.river);
  const rs = [['r5', '#ffffff', 1.0], ['r4', '#fbe7a6', 1.4], ['r3', '#fbe7a6', 1.8], ['r2', '#f2b46b', 2.4], ['r1', '#e8925f', 2.8], ['r8', '#e8925f', 1.2]];
  for (const [k, col, w] of rs) { if (!overview[k] || (k === 'r5' && bm.scale < 0.04)) continue; g.strokeStyle = col; g.lineWidth = w / s; g.stroke(overview[k]); }
  g.strokeStyle = '#c8102e'; g.lineWidth = 2.2 / s; if (overview.ctrain) g.stroke(overview.ctrain);
  g.strokeStyle = 'rgba(122,63,160,.45)'; g.lineWidth = 1 / s; g.stroke(overview.comms);
  g.strokeStyle = '#6e3c8c'; g.lineWidth = 3 / s; g.stroke(overview.city);
  g.restore();
  const P = (x, y) => [W / 2 + (x - bm.cx) * s, H / 2 - (y - bm.cy) * s];
  // community names
  if (bm.scale > 0.03) {
    g.font = `${12 * dpr}px sans-serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(90,50,120,.85)';
    for (const cm of world.communities) { const [x, y] = P(cm.lx, cm.ly); if (x > 0 && x < W && y > 0 && y < H && !/^\d\d[A-Z]$/.test(cm.n)) g.fillText(cm.n, x, y); }
  }
  const dot = (x, y, col, r) => { const [px, py] = P(x, y); if (px < -10 || px > W + 10 || py < -10 || py > H + 10) return; g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(px, py, r * dpr, 0, Math.PI * 2); g.fill(); g.stroke(); };
  const showSmall = bm.scale > 0.04;
  for (const p of world.places) {
    if (p.c === 'grocery' && showSmall) dot(p.x, p.y, '#1c8c40', 4);
    else if (p.c === 'citylib') dot(p.x, p.y, '#2856c8', 5);
    else if (p.c === 'rec' && p.city && showSmall) dot(p.x, p.y, '#e67814', 4);
  }
  g.font = `bold ${12 * dpr}px sans-serif`; g.textAlign = 'left';
  for (const l of world.landmarks) {
    dot(l.x, l.y, '#7a3fa0', 6);
    if (bm.scale > 0.035 || l.full) { const [px, py] = P(l.x, l.y); g.fillStyle = '#2a1838'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3 * dpr; g.strokeText(l.label, px + 9 * dpr, py + 4 * dpr); g.fillText(l.label, px + 9 * dpr, py + 4 * dpr); }
  }
  const tg = game.target(); if (tg) dot(tg.x, tg.y, '#ffc400', 9);
  const pl = game.player; dot(pl.x, pl.y, '#c8102e', 8);
}
function initBigMapInput() {
  const c = $('#bigmap-c'); const pts = new Map(); let moved = 0, pinch0 = null;
  c.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); c.setPointerCapture(e.pointerId); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: bm.scale }; } });
  c.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); bm.cx -= dx / bm.scale; bm.cy += dy / bm.scale; }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; bm.scale = Math.max(0.006, Math.min(1.5, pinch0.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d)); moved = 99; }
    drawMap();
  });
  c.addEventListener('pointerup', e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
    if (moved < 6) {   // tap: waypoint
      const x = bm.cx + (e.clientX - innerWidth / 2) / bm.scale, y = bm.cy - (e.clientY - innerHeight / 2) / bm.scale;
      game.setWaypoint(x, y); const cm = communityAt(world, x, y); toast('Waypoint set' + (cm ? ' in ' + cm.n : '')); drawMap();
    }
  });
  c.addEventListener('wheel', e => { bm.scale = Math.max(0.006, Math.min(1.5, bm.scale * (e.deltaY > 0 ? 0.85 : 1.18))); drawMap(); e.preventDefault(); }, { passive: false });
  addEventListener('resize', () => { if (bm.open) { resizeMap(); drawMap(); } });
}

// ---------------------------------------------------------------- messages
let toastT = 0;
export function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

let pendingNext = null;
export function nextPressed() { if (pendingNext) { const f = pendingNext; pendingNext = null; f(); return true; } return false; }
export function say(who, text) {
  return new Promise(res => {
    const d = $('#dialog'); d.hidden = false; d.querySelector('.who').textContent = who; d.querySelector('.text').innerHTML = text;
    const done = () => { d.hidden = true; pendingNext = null; res(); };
    d.querySelector('.next').onclick = done; pendingNext = done; game.paused = true;
  }).then(() => { game.paused = false; });
}
export function card({ tag = 'City service', title, body, src }) {
  return new Promise(res => {
    const c = $('#card'); c.hidden = false;
    c.querySelector('.card-tag').textContent = tag; c.querySelector('h2').textContent = title; c.querySelector('.card-body').innerHTML = body;
    c.querySelector('.card-src').innerHTML = src ? 'Source: ' + src.map(s => `<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a>`).join(' · ') + ' <span>(checked Nov 2026)</span>' : '';
    const done = () => { c.hidden = true; pendingNext = null; res(); };
    c.querySelector('.next').onclick = done; pendingNext = done; game.paused = true;
  }).then(() => { game.paused = false; });
}
export function quiz({ q, opts, a, explain }) {
  return new Promise(res => {
    const z = $('#quiz'); z.hidden = false; z.querySelector('h2').textContent = q;
    const ex = z.querySelector('.explain'); ex.textContent = ''; const nx = z.querySelector('.next'); nx.hidden = true;
    const box = z.querySelector('.opts'); box.innerHTML = '';
    let first = null;
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.textContent = o; box.appendChild(b);
      b.onclick = () => {
        if (first === null) first = i === a;
        if (i === a) { b.classList.add('right'); ex.innerHTML = explain; nx.hidden = false; box.querySelectorAll('button').forEach(x => x.disabled = true); }
        else { b.classList.add('wrong'); b.disabled = true; }
      };
    });
    const done = () => { z.hidden = true; pendingNext = null; res(first); };
    nx.onclick = done; game.paused = true;
  }).then(r => { game.paused = false; return r; });
}
export function setObjective(title, text) {
  const o = $('#objective'); if (!title) { o.hidden = true; return; }
  o.hidden = false; o.querySelector('.obj-title').textContent = title; o.querySelector('.obj-text').textContent = text; o.querySelector('.obj-dist').textContent = '';
}
export function setObjDist(d) { const e = $('#objective .obj-dist'); if (e) e.textContent = d == null ? '' : d > 950 ? (d / 1000).toFixed(1) + ' km away' : Math.round(d / 10) * 10 + ' m away'; }
export function setPrompt(t) { const p = $('#prompt'); if (!t) p.hidden = true; else { p.hidden = false; p.textContent = t; } }
export function found(t) { const f = $('#found'); f.textContent = t; f.hidden = false; clearTimeout(found.t); found.t = setTimeout(() => f.hidden = true, 3200); }
