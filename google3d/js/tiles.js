// Streams 500 m map tiles around the player and turns them into 3D meshes plus collision data.
import * as THREE from 'three';
import { MAT } from './materials.js';

export const L = { BLD: 1, ROAD: 2, PATH: 3, RAIL: 4, AREA: 5, WATER: 6, WWAY: 7, POI: 8, STOP: 9, BARR: 10 };
const dec = new TextDecoder();

export function parseTile(buf, ox, oy) {
  const dv = new DataView(buf);
  let o = 4;
  const nl = dv.getUint16(o, true); o += 4;
  const layers = {};
  for (let li = 0; li < nl; li++) {
    const lid = dv.getUint8(o), blen = dv.getUint32(o + 8, true); o += 12;
    const end = o + blen, feats = [];
    while (o < end) {
      const kind = dv.getUint8(o), flags = dv.getUint8(o + 1), a = dv.getUint16(o + 2, true), b = dv.getUint16(o + 4, true), name = dv.getUint16(o + 6, true), nr = dv.getUint16(o + 8, true);
      o += 10;
      const rings = [];
      for (let r = 0; r < nr; r++) {
        const np = dv.getUint16(o, true); o += 2;
        const arr = new Float32Array(np * 2);       // tile-local metres: x east, y north
        for (let i = 0; i < np; i++) { arr[i * 2] = dv.getInt16(o, true) / 10; arr[i * 2 + 1] = dv.getInt16(o + 2, true) / 10; o += 4; }
        rings.push(arr);
      }
      feats.push({ kind, flags, a, b, name, rings });
    }
    layers[lid] = feats;
  }
  const sl = dv.getUint32(o, true); o += 4;
  const strs = JSON.parse(dec.decode(new Uint8Array(buf, o, sl)));
  for (const k in layers) for (const f of layers[k]) f.name = f.name === 0xFFFF ? null : strs[f.name];
  return layers;
}

// ---------------------------------------------------------------- geometry helpers
class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(x, y, z, nx, ny, nz, u, w, c) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w); this.col.push(c.r, c.g, c.b); return this.n - 1; }
  build() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

function ringArea(r) { let a = 0; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) a += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1]; return a / 2; }
function cleanRing(r) {          // drop closing duplicate, return array of [x,y]
  const pts = []; const n = r.length / 2;
  for (let i = 0; i < n; i++) pts.push([r[i * 2], r[i * 2 + 1]]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  return pts;
}

const tmpC = new THREE.Color();
const KCOL = {   // building wall tints by kind
  1: [0xd8cfc0, 0xc9b8a2, 0xe2ddd3, 0xb7b9b0, 0xa9b4bd, 0xcbbd9f, 0x9eaa98], 2: [0xcfc8bc], 3: [0xc9c4ba, 0xb0aca4, 0xd6cfc2], 4: [0xcab8a0, 0xbfb3a6, 0xd1c7b8, 0x9ca7ad],
  5: [0xb9b5ae, 0xa7a49e], 6: [0xd5ccbd, 0xc4b9a8], 7: [0xc2a68a, 0xb59a7e], 8: [0xd3c7b4], 9: [0xc4c0b8], 10: [0xb4b2ad], 11: [0xd0d0d0], 12: [0xdedad2],
  13: [0x9fa6ad], 14: [0xc4beb3, 0xb3ada3], 15: [0xa8b8c8, 0x8fa3b6, 0xb6c2cc, 0x7e93a8], 16: [0xc9b78f], 17: [0xd9d6cf]
};
const ROOF = { 1: [0x5a5550, 0x4a4643, 0x6b5a4c, 0x3f4245, 0x705f52], 2: [0x5a5550, 0x4a4643], 4: [0x6d6a66, 0x5b5754] };
function pick(arr, h) { return arr[Math.floor(h * arr.length) % arr.length]; }
function hash2(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }

function wallGroup(k, h) { if (k === 15 || (k === 3 && h > 25) || (k === 4 && h > 30) || k === 17) return 'tower'; if (k === 1 || k === 2 || k === 4) return 'house'; return 'comm'; }

export function buildBuildings(feats, skylineSkip = true) {
  const G = { house: new GeoBuilder(), comm: new GeoBuilder(), tower: new GeoBuilder(), roof: new GeoBuilder() };
  const coll = [];
  for (const f of feats) {
    let pts = cleanRing(f.rings[0]);
    if (pts.length < 3) continue;
    if (ringArea(f.rings[0]) < 0) pts.reverse();          // counter-clockwise (seen from above, north up)
    const h = Math.max(2.5, f.a / 10), mh = f.b / 10, k = f.kind;
    coll.push(pts);
    if (skylineSkip && (f.flags & 4)) continue;           // tall towers are drawn by the always-on skyline
    if (k === 17) continue;                                // Calgary Tower has its own model
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const hs = hash2(cx, cy);
    tmpC.setHex(pick(KCOL[k] || KCOL[14], hs));
    const wc = tmpC.clone();
    const grp = G[wallGroup(k, h)];
    let per = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 0.05) continue;
      const nx = dy / len, nz = dx / len;      // outward normal for CCW ring: (dy, -dx) in x/north -> three z = -north
      const u0 = per / 4, u1 = (per + len) / 4; per += len;
      const v0 = mh / 3.5, v1 = h / 3.5;
      const i0 = grp.v(a[0], mh, -a[1], nx, 0, nz, u0, v0, wc), i1 = grp.v(b[0], mh, -b[1], nx, 0, nz, u1, v0, wc);
      const i2 = grp.v(b[0], h, -b[1], nx, 0, nz, u1, v1, wc), i3 = grp.v(a[0], h, -a[1], nx, 0, nz, u0, v1, wc);
      grp.idx.push(i0, i1, i2, i0, i2, i3);
    }
    // roof
    const R = G.roof;
    const pitched = (k === 1 || k === 2 || (k === 4 && h < 14)) && pts.length <= 12;
    tmpC.setHex(pitched ? pick(ROOF[k] || ROOF[1], hs * 7 % 1) : 0x8d8a85);
    if (!pitched && k === 15) tmpC.setHex(0x6c7884);
    const rc = tmpC.clone();
    if (pitched) {
      const rise = k === 2 ? 0.9 : Math.min(3.2, 1.2 + Math.sqrt(Math.abs(ringArea(f.rings[0]))) * 0.12), s = 0.3;
      const inner = pts.map(p => [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s]);
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length, a = pts[i], b = pts[j], c = inner[j], d = inner[i];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const nrm = new THREE.Vector3(ey, rise * 0.9, ex).normalize();
        const i0 = R.v(a[0], h, -a[1], nrm.x, nrm.y, nrm.z, 0, 0, rc), i1 = R.v(b[0], h, -b[1], nrm.x, nrm.y, nrm.z, 1, 0, rc);
        const i2 = R.v(c[0], h + rise, -c[1], nrm.x, nrm.y, nrm.z, 1, 1, rc), i3 = R.v(d[0], h + rise, -d[1], nrm.x, nrm.y, nrm.z, 0, 1, rc);
        R.idx.push(i0, i1, i2, i0, i2, i3);
      }
      addCap(R, inner, h + rise, rc);
    } else addCap(R, pts, h, rc);
  }
  return { geos: Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.build()])), coll };
}

function addCap(R, pts, y, c) {
  const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { return; }
  const base = R.n;
  for (const p of pts) R.v(p[0], y, -p[1], 0, 1, 0, p[0] / 8, p[1] / 8, c);
  for (const t of tris) pushUp(R, base, pts, t);
}

// add a triangle so it faces up (counter-clockwise seen from above, north up)
function pushUp(G, base, pts, t) {
  const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
  const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (cr >= 0) G.idx.push(base + t[0], base + t[1], base + t[2]); else G.idx.push(base + t[0], base + t[2], base + t[1]);
}

// flat polygons (land use, parks, water) at height y
export function buildFlat(feats, colourOf, yOf, uvScale = 25) {
  const G = new GeoBuilder();
  for (const f of feats) {
    const c = colourOf(f); if (!c) continue;
    const y = yOf(f);
    const outer = cleanRing(f.rings[0]); if (outer.length < 3) continue;
    const holes = f.rings.slice(1).map(cleanRing).filter(h => h.length >= 3);
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p[0], p[1])), holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])))); } catch (e) { continue; }
    const all = outer.concat(...holes), base = G.n;
    tmpC.set(c);
    for (const p of all) G.v(p[0], y, -p[1], 0, 1, 0, p[0] / uvScale, p[1] / uvScale, tmpC);
    for (const t of tris) pushUp(G, base, all, t);
  }
  return G.build();
}

// ribbons along lines (roads, paths, rail)
export function buildRibbons(lines, y, widthOf, colour = 0xffffff, vScale = 10) {
  const G = new GeoBuilder();
  tmpC.set(colour);
  for (const ln of lines) {
    const w = widthOf(ln) / 2, r = ln.rings[0], n = r.length / 2;
    if (n < 2) continue;
    const yy = typeof y === 'function' ? y(ln) : y;
    let along = 0;
    const base = G.n;
    for (let i = 0; i < n; i++) {
      const x = r[i * 2], z = r[i * 2 + 1];
      let dx, dz;
      const px = i > 0 ? r[i * 2 - 2] : x, pz = i > 0 ? r[i * 2 - 1] : z, nx = i < n - 1 ? r[i * 2 + 2] : x, nz = i < n - 1 ? r[i * 2 + 3] : z;
      let ax = x - px, az = z - pz, bx = nx - x, bz = nz - z;
      const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
      ax /= la; az /= la; bx /= lb; bz /= lb;
      if (i === 0) { ax = bx; az = bz; } if (i === n - 1) { bx = ax; bz = az; }
      dx = ax + bx; dz = az + bz; const ld = Math.hypot(dx, dz) || 1; dx /= ld; dz /= ld;
      const dot = Math.max(0.35, dx * ax + dz * az);       // miter length limit
      const ox = -dz * w / dot, oz = dx * w / dot;          // left normal in (x, north)
      if (i > 0) along += la;
      G.v(x + ox, yy, -(z + oz), 0, 1, 0, 0, along / vScale, tmpC);
      G.v(x - ox, yy, -(z - oz), 0, 1, 0, 1, along / vScale, tmpC);
      if (i > 0) { const a = base + (i - 1) * 2; G.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
  }
  return G.build();
}

// segment grid for collisions (tile-local), cell 16 m
export function buildCollision(rings) {
  const cell = 16, grid = new Map();
  for (const pts of rings) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const seg = [a[0], a[1], b[0], b[1]];
      const x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const y0 = Math.floor(Math.min(a[1], b[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1]) / cell);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 100000 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(seg); }
    }
  }
  return { cell, grid };
}

// ---------------------------------------------------------------- styles
export const AREA_COL = { 1: 0x9eb47c, 2: 0xb7b3ab, 3: 0xa9a59d, 4: 0xbab4ab, 5: 0x7fae5c, 6: 0x56844a, 7: 0x8cc06a, 8: 0x86a873, 9: 0xb8b78a, 10: 0x8e8e8c,
  11: 0xa9b884, 12: 0xb7b3ab, 13: 0x6fa553, 14: 0xc9b98f, 15: 0xd8c99c, 16: 0xa6a089, 18: 0x7d9e7c, 19: 0xa9a59d, 20: 0xb9b3a8, 21: 0x9a9894, 22: 0x9c9c9e, 23: 0x5ab0d6 };
export const AREA_Y = k => ({ 1: 0.02, 2: 0.03, 3: 0.03, 4: 0.03, 16: 0.03, 19: 0.03, 9: 0.035, 11: 0.04, 12: 0.04, 8: 0.045, 7: 0.045, 22: 0.045, 5: 0.05, 6: 0.055, 18: 0.055, 10: 0.06, 13: 0.065, 14: 0.065, 15: 0.065, 20: 0.06, 21: 0.07, 23: 0.075 }[k] ?? 0.03);
export const ROAD_Y = { 1: 0.2, 2: 0.19, 3: 0.18, 4: 0.17, 5: 0.16, 6: 0.15, 7: 0.14, 8: 0.185, 9: 0.165, 10: 0.15, 11: 0.12, 12: 0.115 };
export const ROAD_TEX = c => (c === 1 || c === 2 || c === 8) ? 'highway' : (c === 3 || c === 4) ? 'major' : (c === 11 || c === 12) ? 'runway' : 'local';

// ---------------------------------------------------------------- tile manager
export class TileManager {
  constructor(scene, world, opts = {}) {
    this.scene = scene; this.world = world; this.TS = world.ts;
    this.index = new Set(world.tiles.map(t => t[0] + '_' + t[1]));
    this.tiles = new Map(); this.queue = []; this.loading = 0;
    this.radius = opts.radius ?? 2; this.base = opts.base || 'data/t/';
    this.onTile = opts.onTile || (() => {}); this.meshes = opts.meshes ?? true;
  }
  key(ix, iy) { return ix + '_' + iy; }
  update(px, py) {
    const ix = Math.floor(px / this.TS), iy = Math.floor(py / this.TS), R = this.radius;
    const want = [];
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
      const k = this.key(ix + dx, iy + dy);
      if (this.index.has(k) && !this.tiles.has(k)) want.push([dx * dx + dy * dy, ix + dx, iy + dy, k]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, x, y, k] of want) { if (this.loading >= 3) break; this.load(x, y, k); }
    for (const [k, t] of this.tiles) {
      if (!t.group) continue;
      if (Math.abs(t.ix - ix) > R + 1 || Math.abs(t.iy - iy) > R + 1) this.unload(k);
    }
  }
  // tiles come in 8 x 8 region packs: fetch a pack once, keep the last few
  getPack(ix, iy) {
    const R = this.world.pack || 8, pk = Math.floor(ix / R) + '_' + Math.floor(iy / R);
    this.packs ||= new Map();
    let p = this.packs.get(pk);
    if (!p) {
      p = fetch('data/p/' + pk + '.wasm').then(r => { if (!r.ok) throw new Error('pack ' + pk + ' ' + r.status); return r.arrayBuffer(); }).then(buf => {
        const dv = new DataView(buf), jl = dv.getUint32(4, true);
        return { buf, base: 8 + jl, idx: JSON.parse(dec.decode(new Uint8Array(buf, 8, jl))) };
      });
      this.packs.set(pk, p);
      if (this.packs.size > 10) this.packs.delete(this.packs.keys().next().value);
      p.catch(() => this.packs.delete(pk));
    }
    return p;
  }
  async load(ix, iy, k) {
    this.tiles.set(k, { ix, iy, group: null });
    this.loading++;
    try {
      const pack = await this.getPack(ix, iy);
      const e = pack.idx[k]; if (!e) throw new Error('missing tile ' + k);
      const buf = pack.buf.slice(pack.base + e[0], pack.base + e[0] + e[1]);
      const t = this.tiles.get(k); if (!t) return;
      // geometry building is spread over frames by the caller (pending queue)
      this.queue.push({ k, ix, iy, buf });
    } catch (e) { console.warn('tile', k, e); this.tiles.delete(k); }
    finally { this.loading--; }
  }
  // build at most one tile per call (keeps frames smooth)
  pump() {
    const job = this.queue.shift(); if (!job) return false;
    const t = this.tiles.get(job.k); if (!t) return true;
    const ox = job.ix * this.TS, oy = job.iy * this.TS;
    const layers = parseTile(job.buf, ox, oy);
    const g = new THREE.Group(); g.position.set(ox, 0, -oy); g.name = 'tile ' + job.k;
    const M = this.meshes;
    const add = (geo, mat, opts = {}) => { if (!geo || !M) return null; const m = new THREE.Mesh(geo, mat); m.receiveShadow = opts.rs ?? true; m.castShadow = opts.cs ?? false; if (opts.ro != null) m.renderOrder = opts.ro; g.add(m); return m; };
    // ground cover
    if (M && layers[L.AREA]) add(buildFlat(layers[L.AREA].sort((a, b) => a.flags - b.flags), f => AREA_COL[f.kind], f => AREA_Y(f.kind)), MAT.ground, { ro: 1 });
    if (M && layers[L.WATER]) add(buildFlat(layers[L.WATER], () => 0x5d8fb8, () => 0.08), MAT.water, { ro: 2 });
    if (M && layers[L.WWAY]) add(buildRibbons(layers[L.WWAY], 0.085, f => f.a / 10, 0x5d8fb8), MAT.waterFlat, { ro: 2 });
    // paths and roads
    if (M && layers[L.PATH]) add(buildRibbons(layers[L.PATH].filter(f => !(f.flags & 4)), f => (f.flags & 8) ? 0.13 : 0.11, f => f.kind === 5 ? 3 : (f.kind === 2 ? 5 : 2.2)), MAT.path, { ro: 3 });
    if (M && layers[L.RAIL]) add(buildRibbons(layers[L.RAIL].filter(f => !(f.flags & 4)), 0.125, f => 3.0, 0xffffff, 4), MAT.rail, { ro: 3 });
    const roads = (layers[L.ROAD] || []).filter(f => !(f.flags & 4));
    const byTex = {};
    for (const r of roads) (byTex[ROAD_TEX(r.kind)] ||= []).push(r);
    if (M) for (const [tx, list] of Object.entries(byTex)) add(buildRibbons(list, f => ROAD_Y[f.kind] || 0.15, f => f.a / 10), MAT.road[tx], { ro: 4 });
    // buildings
    let coll = null;
    if (layers[L.BLD]) {
      const { geos, coll: rings } = M ? buildBuildings(layers[L.BLD]) : { geos: {}, coll: layers[L.BLD].map(f => { const p = cleanRing(f.rings[0]); if (ringArea(f.rings[0]) < 0) p.reverse(); return p; }).filter(p => p.length >= 3) };
      add(geos.house, MAT.wallHouse, { cs: true }); add(geos.comm, MAT.wallComm, { cs: true }); add(geos.tower, MAT.wallTower, { cs: true }); add(geos.roof, MAT.roof, { cs: true });
      coll = buildCollision(rings);
    }
    this.scene.add(g);
    t.group = g; t.layers = layers; t.coll = coll; t.ox = ox; t.oy = oy;
    this.onTile(t, true);
    return true;
  }
  unload(k) {
    const t = this.tiles.get(k); if (!t) return;
    if (t.group) { this.scene.remove(t.group); t.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.onTile(t, false); }
    this.tiles.delete(k);
  }
  tileAt(x, y) { return this.tiles.get(this.key(Math.floor(x / this.TS), Math.floor(y / this.TS))); }
  // push a circle (world x,y north, radius r) out of buildings; returns {x,y,hit}
  collide(x, y, r) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const t = this.tileAt(x, y);
      const tiles = [t];
      // neighbours if near the edge
      const lx0 = x - Math.floor(x / this.TS) * this.TS, ly0 = y - Math.floor(y / this.TS) * this.TS;
      if (lx0 < 20) tiles.push(this.tileAt(x - 30, y)); if (lx0 > this.TS - 20) tiles.push(this.tileAt(x + 30, y));
      if (ly0 < 20) tiles.push(this.tileAt(x, y - 30)); if (ly0 > this.TS - 20) tiles.push(this.tileAt(x, y + 30));
      for (const tt of tiles) {
        if (!tt || !tt.coll) continue;
        const lx = x - tt.ox, ly = y - tt.oy, C = tt.coll, cs = C.cell;
        const segs = new Set();
        for (let cx = Math.floor((lx - r) / cs); cx <= Math.floor((lx + r) / cs); cx++)
          for (let cy = Math.floor((ly - r) / cs); cy <= Math.floor((ly + r) / cs); cy++) { const l = C.grid.get(cx * 100000 + cy); if (l) for (const s of l) segs.add(s); }
        for (const s of segs) {
          const ax = s[0], ay = s[1], bx = s[2], by = s[3];
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
          let u = ((x - tt.ox - ax) * dx + (y - tt.oy - ay) * dy) / L2; u = Math.max(0, Math.min(1, u));
          const qx = ax + dx * u + tt.ox, qy = ay + dy * u + tt.oy;
          let ex = x - qx, ey = y - qy; const d = Math.hypot(ex, ey);
          if (d < r) {
            hit = true;
            if (d < 1e-4) { ex = dy; ey = -dx; const l = Math.hypot(ex, ey) || 1; ex /= l; ey /= l; } else { ex /= d; ey /= d; }
            // outward normal of a CCW ring edge is (dy, -dx); keep pushing outward
            const nx = dy, ny = -dx, nl = Math.hypot(nx, ny) || 1;
            if (ex * nx / nl + ey * ny / nl < 0 && d < r * 0.5) { ex = nx / nl; ey = ny / nl; }
            x = qx + ex * r; y = qy + ey * r;
          }
        }
      }
    }
    return { x, y, hit };
  }
  // nearest named road to a point (for the street name in the HUD)
  streetAt(x, y, maxD = 30) {
    const t = this.tileAt(x, y); if (!t || !t.layers || !t.layers[L.ROAD]) return null;
    let best = null, bd = maxD;
    for (const f of t.layers[L.ROAD]) {
      if (!f.name) continue;
      const r = f.rings[0];
      for (let i = 0; i + 3 < r.length; i += 2) {
        const ax = r[i] + t.ox, ay = r[i + 1] + t.oy, bx = r[i + 2] + t.ox, by = r[i + 3] + t.oy;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
        let u = ((x - ax) * dx + (y - ay) * dy) / L2; u = Math.max(0, Math.min(1, u));
        const d = Math.hypot(x - ax - dx * u, y - ay - dy * u);
        if (d < bd) { bd = d; best = f; }
      }
    }
    return best ? { name: best.name, kind: best.kind, d: bd } : null;
  }
}
