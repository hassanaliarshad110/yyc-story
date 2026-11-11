// Streams 500 m map tiles around the player and turns them into 3D meshes plus collision data.
import * as THREE from 'three';
import { MAT, nearFade } from './materials.js?v=11111720';
import { loader } from './gltf.js?v=11111720';
import { TER, ground, gl } from './terrain.js?v=11111720';

export const L = { BLD: 1, ROAD: 2, PATH: 3, RAIL: 4, AREA: 5, WATER: 6, WWAY: 7, POI: 8, STOP: 9, BARR: 10, TREE: 11 };
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
        if (flags & 0x10) {    // deck heights above the ground (bridges, ramps) -> keep them (zr) and make them absolute (z)
          let zr = new Float32Array(np); for (let i = 0; i < np; i++) { zr[i] = dv.getInt16(o, true) / 10; o += 2; }
          let a2 = arr;
          if (TER.on && DECKS.abs) { const d = deckLine(arr, zr, 10, ox, oy); d.r.zr = d.zr; d.r.z = d.z; rings.push(d.r); continue; }
          if (TER.on) { const d = densifyZ(arr, zr, 10); a2 = d.r; zr = d.z; }      // so raised runs follow the hills between points
          a2.zr = zr; a2.z = absDeck(a2, zr, ox, oy); rings.push(a2); continue;
        }
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

// deck heights solved for the whole city (tools/fix_decks.py): deck = ground + zr at each point, straight between points
// (bridges over valleys stay level between their points), never below the ground plus the lower of the two heights
export const DECKS = { abs: false };
function deckLine(arr, zr, step, ox, oy) {
  const n = zr.length, r = [], Z = [], ZR = [];
  let pz = 0;
  for (let i = 0; i < n; i++) {
    const x = arr[i * 2], y = arr[i * 2 + 1], z = ground(x + ox, y + oy) + zr[i];
    if (i > 0) {
      const ax = arr[i * 2 - 2], ay = arr[i * 2 - 1], l = Math.hypot(x - ax, y - ay), k = Math.floor(l / step), lo = Math.min(zr[i - 1], zr[i]), flat = Math.max(zr[i - 1], zr[i]) <= 0.3;
      for (let j = 1; j <= k; j++) {
        const t = j / (k + 1), mx = ax + (x - ax) * t, my = ay + (y - ay) * t, g = ground(mx + ox, my + oy);
        const zz = flat ? g + zr[i - 1] + (zr[i] - zr[i - 1]) * t : Math.max(pz + (z - pz) * t, g + lo);
        r.push(mx, my); Z.push(zz); ZR.push(zz - g);
      }
    }
    r.push(x, y); Z.push(z); ZR.push(zr[i]); pz = z;
  }
  return { r: new Float32Array(r), z: new Float32Array(Z), zr: new Float32Array(ZR) };
}
// a raised run stays straight between where it leaves and rejoins the ground (bridges over valleys stay level),
// but never sinks under rising ground
function absDeck(arr, zr, ox, oy) {
  const n = zr.length, z = new Float32Array(n);
  if (!TER.on) { z.set(zr); return z; }
  const g = new Float32Array(n), len = new Float32Array(n);
  for (let i = 0; i < n; i++) { g[i] = ground(arr[i * 2] + ox, arr[i * 2 + 1] + oy); if (i) len[i] = len[i - 1] + Math.hypot(arr[i * 2] - arr[i * 2 - 2], arr[i * 2 + 1] - arr[i * 2 - 1]); }
  for (let i = 0; i < n; i++) z[i] = g[i] + zr[i];
  // each raised run (bridge, overpass) spans straight between the ground where it starts and ends
  let i = 0;
  while (i < n) {
    if (zr[i] <= 0.3) { i++; continue; }
    let j = i; while (j < n && zr[j] > 0.3) j++;
    const a = Math.max(0, i - 1), b = Math.min(n - 1, j), L = len[b] - len[a] || 1;
    for (let k = i; k < j; k++) { const lin = g[a] + (g[b] - g[a]) * (len[k] - len[a]) / L; z[k] = Math.max(lin, g[k]) + zr[k]; }
    i = j;
  }
  return z;
}
// densify a raised ring and its relative heights together
function densifyZ(r, zr, step) {
  const n = zr.length, out = [], oz = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) { const ax = r[i * 2 - 2], ay = r[i * 2 - 1], bx = r[i * 2], by = r[i * 2 + 1], l = Math.hypot(bx - ax, by - ay), k = Math.floor(l / step); for (let j = 1; j <= k; j++) { const t = j / (k + 1); out.push(ax + (bx - ax) * t, ay + (by - ay) * t); oz.push(zr[i - 1] + (zr[i] - zr[i - 1]) * t); } }
    out.push(r[i * 2], r[i * 2 + 1]); oz.push(zr[i]);
  }
  return { r: new Float32Array(out), z: new Float32Array(oz) };
}
// add points so no segment is longer than step (ground-hugging lines follow the terrain)
function densify(r, step = 10) {
  const n = r.length / 2, out = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) { const ax = r[i * 2 - 2], ay = r[i * 2 - 1], bx = r[i * 2], by = r[i * 2 + 1], l = Math.hypot(bx - ax, by - ay), k = Math.floor(l / step); for (let j = 1; j <= k; j++) { const t = j / (k + 1); out.push(ax + (bx - ax) * t, ay + (by - ay) * t); } }
    out.push(r[i * 2], r[i * 2 + 1]);
  }
  return new Float32Array(out);
}
// ---------------------------------------------------------------- geometry helpers
class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.lift = null; }
  get n() { return this.pos.length / 3; }
  // y is above the ground at (x, -z) unless lift is set (a fixed base, e.g. a building's footprint, or 0 for absolute heights)
  v(x, y, z, nx, ny, nz, u, w, c) { y += this.lift != null ? this.lift : TER.on ? gl(x, -z) : 0; this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w); this.col.push(c.r, c.g, c.b); if (this.hc) this.hc.push(this.hx, this.hz); return this.n - 1; }
  build() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.hc) g.setAttribute('hc', new THREE.Float32BufferAttribute(this.hc, 2));
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
const KCOL = {   // building wall tints by kind (houses: the vinyl siding colours you see in NE Calgary)
  1: [0xd8cfc0, 0xc9b8a2, 0xeeeeea, 0xb7b9b0, 0x8fa3bd, 0x6f86a6, 0xcbbd9f, 0x9eaa98, 0xf4f2ec, 0x8f9aa3, 0xb9c4b0, 0xd9c7a8, 0x7d8a8f, 0xc7b29a, 0xe6dfcf, 0x9cb0c4, 0xa8a59c], 2: [0xcfc8bc], 3: [0xc9c4ba, 0xb0aca4, 0xd6cfc2], 4: [0xcab8a0, 0xbfb3a6, 0xd1c7b8, 0x9ca7ad],
  5: [0xb9b5ae, 0xa7a49e], 6: [0xd5ccbd, 0xc4b9a8], 7: [0xc2a68a, 0xb59a7e], 8: [0xd3c7b4], 9: [0xc4c0b8], 10: [0xb4b2ad], 11: [0xd0d0d0], 12: [0xdedad2],
  13: [0x9fa6ad], 14: [0xc4beb3, 0xb3ada3], 15: [0xa8b8c8, 0x8fa3b6, 0xb6c2cc, 0x7e93a8], 16: [0xc9b78f], 17: [0xd9d6cf]
};
KCOL[18] = KCOL[1]; KCOL[19] = KCOL[1];
const ROOF = { 1: [0x5a5550, 0x4a4643, 0x6b5a4c, 0x3f4245, 0x705f52, 0x2f3236, 0x7a6a5a, 0x4f5a4e, 0x8a5a44, 0x3d3a37], 2: [0x5a5550, 0x4a4643, 0x6b5a4c], 4: [0x6d6a66, 0x5b5754, 0x4a4643] };
function pick(arr, h) { return arr[Math.floor(h * arr.length) % arr.length]; }
function hash2(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }

// house cladding by the year it was built (from the property assessment roll): 0 siding, 1 brick, 2 stucco, 3 stone accents
const ERA_STYLE = { 1: [2, 2, 2, 0, 0], 2: [1, 1, 2, 2, 2, 0], 3: [0, 0, 0, 0, 2, 2, 3], 4: [3, 3, 3, 0, 0] };
function wallGroup(k, h, hs, era) {
  if (k === 15 || (k === 3 && h > 25) || (k === 4 && h > 30) || k === 17) return 'tower';
  if (k === 4) return 'apt';
  if (k === 6 && h < 9) return 'shop';
  if (k === 1 || k === 2 || k === 18 || k === 19) { const st = ERA_STYLE[era]; return 'house' + (st ? st[Math.floor(hs * 977) % st.length] : Math.floor(hs * 977) % 4); }
  return 'comm';
}

export function buildBuildings(feats, skylineSkip = true, roads = []) {
  const G = { house0: new GeoBuilder(), house1: new GeoBuilder(), house2: new GeoBuilder(), house3: new GeoBuilder(), apt: new GeoBuilder(), comm: new GeoBuilder(), shop: new GeoBuilder(), tower: new GeoBuilder(), roof: new GeoBuilder(), trim: new GeoBuilder(), doors: new GeoBuilder(), drive: new GeoBuilder() };
  const coll = [];
  const nearRoad = roadIndex(roads);
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
    const hb = TER.on ? Math.min(...pts.map(p => gl(p[0], p[1]))) - 0.1 : 0;       // sits on the lowest corner of its lot
    for (const key in G) G[key].lift = hb; G.drive.lift = null;
    tmpC.setHex(pick(KCOL[k] || KCOL[14], hs));
    const wc = tmpC.clone();
    const era = (f.flags >> 5) & 7, wg = wallGroup(k, h, hs, era), grp = G[wg];
    let per = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 0.05) continue;
      const nx = dy / len, nz = dx / len;      // outward normal for CCW ring: (dy, -dx) in x/north -> three z = -north
      const u0 = per / 4, u1 = (per + len) / 4; per += len;
      const v0 = wg === 'shop' ? 0 : mh / 3.5, v1 = wg === 'shop' ? 1 : h / 3.5;
      const i0 = grp.v(a[0], mh, -a[1], nx, 0, nz, u0, v0, wc), i1 = grp.v(b[0], mh, -b[1], nx, 0, nz, u1, v0, wc);
      const i2 = grp.v(b[0], h, -b[1], nx, 0, nz, u1, v1, wc), i3 = grp.v(a[0], h, -a[1], nx, 0, nz, u0, v1, wc);
      grp.idx.push(i0, i1, i2, i0, i2, i3);
    }
    // roof
    const R = G.roof;
    const pitched = (k === 1 || k === 2 || k === 18 || k === 19 || (k === 4 && h < 14)) && pts.length <= (k === 19 ? 16 : 12);
    tmpC.setHex(pitched ? pick(ROOF[k] || ROOF[1], hs * 7 % 1) : 0x8d8a85);
    if (!pitched && k === 15) tmpC.setHex(0x6c7884);
    const rc = tmpC.clone();
    if (pitched) {
      const rise = k === 2 ? 0.9 : era === 2 && k === 1 ? Math.min(1.6, 0.8 + Math.sqrt(Math.abs(ringArea(f.rings[0]))) * 0.06) : Math.min(3.2, 1.2 + Math.sqrt(Math.abs(ringArea(f.rings[0]))) * 0.12), s = 0.3;
      const house = (k === 1 || k === 18 || k === 19);
      // eaves: the roof overhangs the walls by ~0.45 m, with a fascia board and a soffit underneath
      const ov = house ? 0.45 : 0.3, eh = h - 0.12, eave = offsetRing(pts, ov);
      const inner = pts.map(p => [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s]);
      const gb = house && pts.length <= 12 && (k === 19 || hs * 7 % 1 < 0.75) ? gableBox(pts, cx, cy, nearRoad) : null;
      if (gb) {          // gable roof over the house's rectangle: the gable end faces the street (rows: ridge along the street)
        gableRoof(G, R, grp, gb.rect, offsetRing(gb.rect, ov), k === 19 ? (gb.fi + 1) % 4 : gb.fi, h, eh, rc, wc);
        if (house) houseDetails(G, pts, h, rise, cx, cy, hs, nearRoad, inner, k);
        continue;
      }
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length, a = eave[i], b = eave[j], c = inner[j], d = inner[i];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const nrm = new THREE.Vector3(ey, rise * 0.9, ex).normalize();
        const i0 = R.v(a[0], eh, -a[1], nrm.x, nrm.y, nrm.z, 0, 0, rc), i1 = R.v(b[0], eh, -b[1], nrm.x, nrm.y, nrm.z, 1, 0, rc);
        const i2 = R.v(c[0], h + rise, -c[1], nrm.x, nrm.y, nrm.z, 1, 1, rc), i3 = R.v(d[0], h + rise, -d[1], nrm.x, nrm.y, nrm.z, 0, 1, rc);
        R.idx.push(i0, i1, i2, i0, i2, i3);
        // fascia (vertical trim along the eave) and soffit (underside)
        const T = G.trim, len = Math.hypot(ex, ey) || 1, nx = ey / len, nz = ex / len;
        const f0 = T.v(a[0], eh - 0.2, -a[1], nx, 0, nz, 0, 0, TRIM_C), f1 = T.v(b[0], eh - 0.2, -b[1], nx, 0, nz, 0, 0, TRIM_C), f2 = T.v(b[0], eh, -b[1], nx, 0, nz, 0, 0, TRIM_C), f3 = T.v(a[0], eh, -a[1], nx, 0, nz, 0, 0, TRIM_C);
        T.idx.push(f0, f1, f2, f0, f2, f3);
        const w0 = pts[i], w1 = pts[j];
        const s0 = T.v(w0[0], eh - 0.2, -w0[1], 0, -1, 0, 0, 0, SOFFIT_C), s1 = T.v(w1[0], eh - 0.2, -w1[1], 0, -1, 0, 0, 0, SOFFIT_C), s2 = T.v(b[0], eh - 0.2, -b[1], 0, -1, 0, 0, 0, SOFFIT_C), s3 = T.v(a[0], eh - 0.2, -a[1], 0, -1, 0, 0, 0, SOFFIT_C);
        T.idx.push(s0, s2, s1, s0, s3, s2);
      }
      addCap(R, inner, h + rise, rc);
      if (house) houseDetails(G, pts, h, rise, cx, cy, hs, nearRoad, inner, k);
      else if (k === 2) garageDoor(G, pts, h, cx, cy, nearRoad);
    } else addCap(R, pts, h, rc);
  }
  for (const key in G) G[key].lift = null;
  return { geos: Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.build()])), coll };
}

// ---------------------------------------------------------------- City of Calgary 3D buildings (LiDAR roofs, tools/build_b3d.py)
// one tile blob -> wall and roof geometry by material, like buildBuildings. skipTall: leave the 38 m+ towers to the skyline.
const FLAT_ROOF = new THREE.Color(0x8d8a85), GLASS_ROOF = new THREE.Color(0x6c7884), BLACK_C = new THREE.Color(0x000000);
const LIGHT_COLS = [0x3aa0ff, 0xb05aff, 0xff4a7a, 0xffb02a, 0x2affd0, 0xf2f6ff, 0xff6a2a, 0x5a7aff].map(c => new THREE.Color(c));
// opt: { ox, oy, swap } — swap: plain houses that a detailed model can replace up close go in their own
// geometry (shouse0..3, sroof) tagged with each house's centre, and come back as `cands`
export const HOUSES = { place: null, drop: null };
// extra walkable surfaces (CTrain platforms): oriented boxes { x, y, fx, fy, hl, hw, top }
export const PLATFORMS = [];
// more roofs from elsewhere (the landmark models): fn(x, y) -> height or null
export const ROOF_EXTRA = { fn: null };
// buildings rebuilt as other models (shopping plazas): an oriented box (centre, length, depth, rotation) on a 200 m grid
const SKIPG = new Map();
export function addSkip(x, y, r, L, D, rot) {
  const ax = Math.cos(rot), ay = Math.sin(rot), e = { x, y, L, D, ax, ay }, R = Math.hypot(L, D) / 2;
  for (let i = Math.floor((x - R) / 200); i <= Math.floor((x + R) / 200); i++) for (let j = Math.floor((y - R) / 200); j <= Math.floor((y + R) / 200); j++) { const k = i + ',' + j; let l = SKIPG.get(k); if (!l) SKIPG.set(k, l = []); l.push(e); }
}
function skipped(x, y) {
  for (const e of SKIPG.get(Math.floor(x / 200) + ',' + Math.floor(y / 200)) || []) { const dx = x - e.x, dy = y - e.y; if (Math.abs(dx * e.ax + dy * e.ay) < e.L / 2 + 1 && Math.abs(-dx * e.ay + dy * e.ax) < e.D / 2 + 1) return true; }
  return false;
}
// the top of a CTrain platform under (x, y), or null; standY: where people stand (the platform top, else the ground)
export function platformTop(x, y) {
  let best = null;
  for (const P of PLATFORMS) { const dx = x - P.x, dy = y - P.y; if (Math.abs(dx) > P.hl + P.hw || Math.abs(dy) > P.hl + P.hw) continue; if (Math.abs(dx * P.fx + dy * P.fy) <= P.hl && Math.abs(dx * P.fy - dy * P.fx) <= P.hw && (best == null || P.top > best)) best = P.top; }
  return best;
}
export function standY(x, y) { const g = ground(x, y), p = platformTop(x, y); return p != null && p > g - 0.5 && p < g + 2.5 ? p : g; }      // detailed house models (houses3d.js) hook in here
export const B3D_SKIP = [];        // landmarks drawn by their own models (world x, y, radius); filled by houses3d.js
export function buildB3D(buf, skipTall = true, groundAt = gl, opt = {}) {
  const G = { house0: new GeoBuilder(), house1: new GeoBuilder(), house2: new GeoBuilder(), house3: new GeoBuilder(), apt: new GeoBuilder(), comm: new GeoBuilder(), shop: new GeoBuilder(), tower: new GeoBuilder(), roof: new GeoBuilder(), crown: new GeoBuilder(), wash: new GeoBuilder() };
  if (opt.swap) for (const k of ['shouse0', 'shouse1', 'shouse2', 'shouse3', 'sroof']) { G[k] = new GeoBuilder(); G[k].hc = []; }
  const cands = [], OX = opt.ox || 0, OY = opt.oy || 0;
  for (const k in G) G[k].lift = 0;
  const dv = new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x31425959) return { geos: {}, n: 0 };       // 'YYB1'
  const n = dv.getUint32(4, true); let o = 8, built = 0;
  const X = [], Y = [], Z = [], walls = [], outlines = [], cwalls = [];
  // roof heights on a 2.5 m grid over the tile (and 50 m around it): what a helicopter can land on or must fly over
  const HG = { c: 2.5, o: -50, n: 240, h: new Float32Array(240 * 240).fill(-1e9) };
  for (let b = 0; b < n; b++) {
    const kb = dv.getUint8(o), flags = dv.getUint8(o + 1), gbase = dv.getInt16(o + 2, true) / 10, nv = dv.getUint16(o + 4, true); o += 6;
    X.length = Y.length = Z.length = 0;
    for (let i = 0; i < nv; i++) { X.push(dv.getInt16(o, true) / 10); Y.push(dv.getInt16(o + 2, true) / 10); Z.push(dv.getInt16(o + 4, true) / 10); o += 6; }
    const nt = dv.getUint16(o, true); o += 2; const tOff = o; o += nt * 6;
    const nw = dv.getUint16(o, true); o += 2; const wOff = o; o += nw * 8;
    const tall = kb & 0x80, k = kb & 0x7f;
    // sit on the game's ground: the lowest wall foot, a little into the ground like the other buildings
    let gmin = Infinity, cx = 0, cy = 0, zmax = -Infinity, mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (let w = 0; w < nw; w++) { const a = dv.getUint16(wOff + w * 8, true); if (dv.getInt16(wOff + w * 8 + 4, true) / 10 === gbase) gmin = Math.min(gmin, groundAt(X[a], Y[a])); }
    for (let i = 0; i < nv; i++) { cx += X[i]; cy += Y[i]; zmax = Math.max(zmax, Z[i]); mnx = Math.min(mnx, X[i]); mxx = Math.max(mxx, X[i]); mny = Math.min(mny, Y[i]); mxy = Math.max(mxy, Y[i]); }
    cx /= nv; cy /= nv;
    if (!isFinite(gmin)) gmin = groundAt(cx, cy);
    const foot = gbase + 0.4, shift = gmin - 0.1 - foot, h = zmax - foot, base = gmin - 0.5;
    // the outline and roof height, for landing helicopters and flying between towers
    { const E = []; for (let w = 0; w < nw; w++) { const q = wOff + w * 8; if (dv.getInt16(q + 4, true) / 10 === gbase) { const a = dv.getUint16(q, true), c = dv.getUint16(q + 2, true); E.push(X[a], Y[a], X[c], Y[c]); } }
      if (E.length) outlines.push({ mnx, mny, mxx, mxy, top: zmax + shift, E }); }
    for (let w = 0; w < nw; w++) {                         // walls that reach the ground block people and cars
      const q = wOff + w * 8; if (dv.getInt16(q + 4, true) / 10 !== gbase) continue;
      const a = dv.getUint16(q, true), c = dv.getUint16(q + 2, true); if (Math.hypot(X[c] - X[a], Y[c] - Y[a]) > 0.3) cwalls.push([X[a], Y[a], X[c], Y[c]]);
    }
    for (let t = 0; t < nt; t++) {                         // rasterise the roof triangles
      const q = tOff + t * 6, A = dv.getUint16(q, true), B = dv.getUint16(q + 2, true), C = dv.getUint16(q + 4, true);
      const x0 = X[A], y0 = Y[A], x1 = X[B], y1 = Y[B], x2 = X[C], y2 = Y[C], den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(den) < 1e-6) continue;
      const i0 = Math.max(0, Math.floor((Math.min(x0, x1, x2) - HG.o) / HG.c)), i1 = Math.min(HG.n - 1, Math.floor((Math.max(x0, x1, x2) - HG.o) / HG.c));
      const j0 = Math.max(0, Math.floor((Math.min(y0, y1, y2) - HG.o) / HG.c)), j1 = Math.min(HG.n - 1, Math.floor((Math.max(y0, y1, y2) - HG.o) / HG.c));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const px = HG.o + (i + 0.5) * HG.c, py = HG.o + (j + 0.5) * HG.c;
        const a = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den, b = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den, g = 1 - a - b;
        if (a < -0.02 || b < -0.02 || g < -0.02) continue;
        const z = a * Z[A] + b * Z[B] + g * Z[C] + shift, k2 = i * HG.n + j; if (z > HG.h[k2]) HG.h[k2] = z;
      }
    }
    if ((tall && skipTall) || k === 17) continue;          // the Calgary Tower has its own model
    if (B3D_SKIP.some(q => Math.hypot(cx + OX - q[0], cy + OY - q[1]) < q[2]) || skipped(cx + OX, cy + OY)) continue;
    built++;
    const hs = hash2(cx, cy), era = (flags >> 5) & 7, wg0 = wallGroup(k, h, hs, era);
    // a plain house with a simple footprint: a detailed model can stand in for it
    let cand = null;
    if (opt.swap && !tall && (k === 1 || k === 18 || k === 19) && h > 2.5 && h < 11.5) {
      const E = []; let len0 = 0, ang = 0, area = 0;
      for (let w = 0; w < nw; w++) { const q = wOff + w * 8; if (dv.getInt16(q + 4, true) / 10 !== gbase) continue; const a = dv.getUint16(q, true), c = dv.getUint16(q + 2, true), l = Math.hypot(X[c] - X[a], Y[c] - Y[a]); E.push(X[a], Y[a]); area += X[a] * Y[c] - X[c] * Y[a]; if (l > len0) { len0 = l; ang = Math.atan2(Y[c] - Y[a], X[c] - X[a]); } }
      area = Math.abs(area) / 2;
      const ux = Math.cos(ang), uy = Math.sin(ang); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let i = 0; i < E.length; i += 2) { const u = E[i] * ux + E[i + 1] * uy, v = -E[i] * uy + E[i + 1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const du = u1 - u0, dvv = v1 - v0, um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      if (E.length >= 8 && area > 45 && area < (k === 19 ? 900 : 480) && area / (du * dvv) > 0.62 && Math.min(du, dvv) > 4.5)
        cand = { x: um * ux - vm * uy, y: um * uy + vm * ux, ang, du, dv: dvv, base: gmin - 0.1, h: zmax + shift - (gmin - 0.1), k, era, hs };
    }
    if (cand) { cands.push(cand); for (const q of ['shouse0', 'shouse1', 'shouse2', 'shouse3', 'sroof']) { G[q].hx = cand.x + OX; G[q].hz = -(cand.y + OY); } }
    const wg = cand ? 's' + wg0 : wg0, grp = G[wg];
    tmpC.setHex(pick(KCOL[k] || KCOL[14], hs)); const wc = tmpC.clone();
    const house = k === 1 || k === 2 || k === 18 || k === 19;
    tmpC.setHex(pick(ROOF[k] || ROOF[1], hs * 7 % 1)); const pitchC = tmpC.clone();
    const flatC = k === 15 || wg === 'tower' ? GLASS_ROOF : FLAT_ROOF;
    // walls (roof edges with the roof on their left: outward is to the right)
    let per = 0;
    for (let w = 0; w < nw; w++) {
      const q = wOff + w * 8, a = dv.getUint16(q, true), c = dv.getUint16(q + 2, true), za = dv.getInt16(q + 4, true) / 10, zb = dv.getInt16(q + 6, true) / 10;
      const ax = X[a], ay = Y[a], bx = X[c], by = Y[c], len = Math.hypot(bx - ax, by - ay); if (len < 0.05) continue;
      const nx = (by - ay) / len, nz = (bx - ax) / len;
      const ta = Z[a] + shift, tb = Z[c] + shift;
      const la = za === gbase ? base : za + shift, lb = zb === gbase ? base : zb + shift;
      const u0 = per / 4, u1 = (per + len) / 4; per += len;
      const v = y => wg === 'shop' ? Math.min(1, (y - base) / 4) : (y - base) / 3.5;
      const i0 = grp.v(ax, la, -ay, nx, 0, nz, u0, v(la), wc), i1 = grp.v(bx, lb, -by, nx, 0, nz, u1, v(lb), wc);
      const i2 = grp.v(bx, tb, -by, nx, 0, nz, u1, v(tb), wc), i3 = grp.v(ax, ta, -ay, nx, 0, nz, u0, v(ta), wc);
      grp.idx.push(i0, i1, i2, i0, i2, i3);
      if (za === gbase && len > 1.5) walls.push([ax, ay, bx, by, la, Math.min(ta, tb), house ? 1 : 0]);
      if (tall && len > 2) {          // night lights on towers: crown band near the top, floodlight wash from the street
        const lc = LIGHT_COLS[Math.floor(hs * 97) % LIGHT_COLS.length], top = Math.min(ta, tb), ox = nx * 0.25, oz = nz * 0.25;
        if (top > zmax + shift - 9) {
          const C = G.crown, b0 = top - 5;
          const j0 = C.v(ax + ox, b0, -ay + oz, nx, 0, nz, 0, 0, lc), j1 = C.v(bx + ox, b0, -by + oz, nx, 0, nz, 0, 0, lc), j2 = C.v(bx + ox, tb + 0.3, -by + oz, nx, 0, nz, 0, 0, lc), j3 = C.v(ax + ox, ta + 0.3, -ay + oz, nx, 0, nz, 0, 0, lc);
          C.idx.push(j0, j1, j2, j0, j2, j3);
        }
        if (za === gbase) {
          const Wd = G.wash, wc2 = LIGHT_COLS[Math.floor(hs * 31 + 3) % LIGHT_COLS.length], up = Math.min(top - la, 45);
          const k0 = Wd.v(ax + ox, la, -ay + oz, nx, 0, nz, 0, 0, wc2), k1 = Wd.v(bx + ox, lb, -by + oz, nx, 0, nz, 0, 0, wc2), k2 = Wd.v(bx + ox, lb + up, -by + oz, nx, 0, nz, 0, 0, BLACK_C), k3 = Wd.v(ax + ox, la + up, -ay + oz, nx, 0, nz, 0, 0, BLACK_C);
          Wd.idx.push(k0, k1, k2, k0, k2, k3);
        }
      }
    }
    // roof triangles (counter-clockwise from above)
    const R = cand ? G.sroof : G.roof;
    for (let t = 0; t < nt; t++) {
      const q = tOff + t * 6, A = dv.getUint16(q, true), B = dv.getUint16(q + 2, true), C = dv.getUint16(q + 4, true);
      const ux = X[B] - X[A], uy = Y[B] - Y[A], uz = Z[B] - Z[A], wx = X[C] - X[A], wy = Y[C] - Y[A], wz = Z[C] - Z[A];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nzz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nzz);
      if (!(l > 1e-4)) continue;                  // a sliver with no area: its normal would be NaN and black out the night glow
      nx /= l; ny /= l; nzz /= l;
      if (nzz < 0) { nx = -nx; ny = -ny; nzz = -nzz; }
      const col = nzz < 0.985 && (house || h < 14) ? pitchC : flatC;
      const i0 = R.v(X[A], Z[A] + shift, -Y[A], nx, nzz, -ny, X[A] / 8, Y[A] / 8, col), i1 = R.v(X[B], Z[B] + shift, -Y[B], nx, nzz, -ny, X[B] / 8, Y[B] / 8, col), i2 = R.v(X[C], Z[C] + shift, -Y[C], nx, nzz, -ny, X[C] / 8, Y[C] / 8, col);
      R.idx.push(i0, i1, i2);
    }
  }
  return { geos: Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.n ? g.build() : null])), n: built, walls, outlines, cwalls, hgrid: HG, cands };
}
// Sentinel-2 ground imagery (tools/build_s2.py): one 8 km texture per region, multiplied by the fine ground texture up close
export const S2 = { on: false, rg: 8000, mats: new Map() };
const S2_LOADER = new THREE.TextureLoader();
export function s2Material(rx, ry, near = false) {
  const k = rx + '_' + ry, key = k + (near ? 'n' : ''); let m = S2.mats.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ color: 0x93a86e });
  const detail = MAT.base.map;
  m.onBeforeCompile = sh => {
    sh.uniforms.detailMap = { value: detail };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWU;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWU = (modelMatrix * vec4(transformed, 1.0)).xz / 40.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWU;\nuniform sampler2D detailMap;').replace('#include <map_fragment>', '#include <map_fragment>\n' + (near ? 'diffuseColor.rgb = mix(vec3(0.297, 0.40, 0.157), diffuseColor.rgb, 0.45);\n' : '') + 'diffuseColor.rgb *= mix(vec3(1.0), texture2D(detailMap, vWU).rgb * 1.12, 0.55);');
  };
  m.customProgramCacheKey = () => 's2ground' + (near ? 'n' : '');
  S2_LOADER.load('data/s2/' + k + '.jpg', tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; m.map = tex; m.color.set(0xffffff); m.needsUpdate = true; }, undefined, () => {});
  S2.mats.set(key, m);
  return m;
}

// building packs (same 8 x 8 layout as the map packs)
export const B3D = { on: false, pack: 8, gz: false, packs: new Map() };
export function b3dBlob(ix, iy) {
  const pk = Math.floor(ix / B3D.pack) + '_' + Math.floor(iy / B3D.pack);
  let p = B3D.packs.get(pk);
  if (!p) {
    p = fetch('data/b/' + pk + '.wasm').then(r => r.ok ? r.arrayBuffer() : null).then(buf => {
      if (!buf) return null; const dv = new DataView(buf), jl = dv.getUint32(4, true);
      return { buf, base: 8 + jl, idx: JSON.parse(dec.decode(new Uint8Array(buf, 8, jl))) };
    }).catch(() => null);
    B3D.packs.set(pk, p);
    if (B3D.packs.size > 16) B3D.packs.delete(B3D.packs.keys().next().value);
  }
  return p.then(async P => {
    const e = P && P.idx[ix + '_' + iy]; if (!e) return null;
    const u = new Uint8Array(P.buf, P.base + e[0], e[1]);
    return B3D.gz ? new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()) : u;
  });
}

const TRIM_C = new THREE.Color(0xf2efe8), SOFFIT_C = new THREE.Color(0xd8d4cc), BRICK_C = new THREE.Color(0x8a4b3a), STEP_C = new THREE.Color(0xb9b5ac), WHITE_C = new THREE.Color(0xffffff), DRIVE_C = new THREE.Color(0xbdb9b0);
// grow a CCW ring outward by d metres (mitred corners, clamped)
function offsetRing(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], c = pts[i], q = pts[(i + 1) % n];
    let e1x = c[0] - p[0], e1y = c[1] - p[1], e2x = q[0] - c[0], e2y = q[1] - c[1]; const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    const n1 = [e1y / l1, -e1x / l1], n2 = [e2y / l2, -e2x / l2]; let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const k = Math.min(2.5, 1 / Math.max(0.4, mx * n1[0] + my * n1[1]));
    out.push([c[0] + mx * d * k, c[1] + my * d * k]);
  }
  return out;
}
// nearest road point (tile-local), from a coarse grid of points every ~6 m along local roads
export function roadIndex(roads) {
  const cells = new Map(), C = 25;
  for (const r of roads || []) {
    if ([1, 2, 8, 11, 12].includes(r.kind) || (r.flags & 4) || r.rings[0].z) continue;
    const a = r.rings[0], n = a.length / 2, w = r.a / 20;
    for (let i = 1; i < n; i++) {
      const x0 = a[i * 2 - 2], y0 = a[i * 2 - 1], x1 = a[i * 2], y1 = a[i * 2 + 1], l = Math.hypot(x1 - x0, y1 - y0), m = Math.max(1, Math.ceil(l / 6));
      for (let k = 0; k <= m; k++) { const x = x0 + (x1 - x0) * k / m, y = y0 + (y1 - y0) * k / m, key = Math.floor(x / C) + ',' + Math.floor(y / C); let L = cells.get(key); if (!L) cells.set(key, L = []); L.push([x, y, w]); }
    }
  }
  return (x, y, maxD = 45) => {
    let best = null, bd = maxD; const cx = Math.floor(x / C), cy = Math.floor(y / C);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const L = cells.get((cx + i) + ',' + (cy + j)); if (!L) continue; for (const p of L) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = p; } } }
    return best;
  };
}
function quad(G, a, b, y0, y1, nx, nz, u0, u1, c, off = 0.03) {        // vertical quad in front of a wall, a->b along it
  const ox = nx * off, oz = nz * off;
  const i0 = G.v(a[0] + ox, y0, -a[1] + oz, nx, 0, nz, u0, 0, c), i1 = G.v(b[0] + ox, y0, -b[1] + oz, nx, 0, nz, u1, 0, c);
  const i2 = G.v(b[0] + ox, y1, -b[1] + oz, nx, 0, nz, u1, 1, c), i3 = G.v(a[0] + ox, y1, -a[1] + oz, nx, 0, nz, u0, 1, c);
  G.idx.push(i0, i1, i2, i0, i2, i3);
}
function boxG(G, x, y, w, d, y0, y1, c) {      // axis-aligned box (map coords x/y, heights y0..y1)
  const P = [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
  for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey); quad(G, a, b, y0, y1, ey / l, ex / l, 0, 1, c, 0); }
  const base = G.n; for (const p of P) G.v(p[0], y1, -p[1], 0, 1, 0, 0, 0, c); G.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
// front door, garage door and driveway on the wall that faces the street; a step and sometimes a chimney
function houseDetails(G, pts, h, rise, cx, cy, hs, nearRoad, inner, k = 1) {
  const rp = nearRoad(cx, cy);
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey); if (len < 3.5) continue;
    const nx = ey / len, ny = -ex / len, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const score = rp ? ((rp[0] - mx) * nx + (rp[1] - my) * ny) / (Math.hypot(rp[0] - mx, rp[1] - my) || 1) + len * 0.02 : len;
    if (!best || score > best.score) best = { a, b, len, nx, ny, ex: ex / len, ey: ey / len, score };
  }
  if (best && h >= 2.4) {
    const { a, len, nx, ny, ex, ey } = best, tz = nx, tzz = -ny;          // three normal: x = nx, z = -ny
    const at = t => [a[0] + ex * t, a[1] + ey * t];
    const dh = Math.min(2.1, h - 0.35);
    if (k === 18 || k === 19) {          // duplex: two front doors mirrored; townhouse: one door per ~6.5 m unit
      const units = k === 18 ? 2 : Math.max(2, Math.round(len / 6.5)), uw = len / units;
      for (let q = 0; q < units; q++) {
        const mirror = k === 18 ? q === 1 : q % 2 === 1, dC = q * uw + (mirror ? uw - 1.1 : 1.1);
        quad(G.doors, at(dC - 0.5), at(dC + 0.5), 0.2, 0.2 + dh, tz, tzz, 0, 0.25, WHITE_C);
        boxG(G.trim, at(dC)[0] + nx * 0.55, at(dC)[1] + ny * 0.55, 1.5, 1.0, 0, 0.2, STEP_C);
        if (uw >= 6.2 && k === 18) { const gC = q * uw + (mirror ? 2.9 : uw - 2.9); quad(G.doors, at(gC - 1.3), at(gC + 1.3), 0.05, Math.min(2.2, h - 0.3), tz, tzz, 0.25, 1, WHITE_C); }
      }
      return;
    }
    const garage = len >= 8.5 && hs > 0.15;
    const flip = hs > 0.6;                                 // garage on the left or right
    const gC = flip ? len - 3.4 : 3.4, dC = garage ? (flip ? Math.min(len - 7.2, 2.2) + 0.2 : Math.max(7.2, len - 2.2)) : len * (0.35 + hs * 0.3);
    quad(G.doors, at(dC - 0.5), at(dC + 0.5), 0.2, 0.2 + dh, tz, tzz, 0, 0.25, WHITE_C);
    boxG(G.trim, at(dC)[0] + nx * 0.55, at(dC)[1] + ny * 0.55, 1.7, 1.0, 0, 0.2, STEP_C);          // front step
    if (rp) {        // front walk out to the street
      const d0 = at(dC), dist = (rp[0] - d0[0]) * nx + (rp[1] - d0[1]) * ny - rp[2];
      if (dist > 1.5 && dist < 18) { const p0 = [d0[0] - ex * 0.6 + nx, d0[1] - ey * 0.6 + ny], p1 = [d0[0] + ex * 0.6 + nx, d0[1] + ey * 0.6 + ny], q1 = [p1[0] + nx * (dist - 1), p1[1] + ny * (dist - 1)], q0 = [p0[0] + nx * (dist - 1), p0[1] + ny * (dist - 1)], D = G.drive, base = D.n;
        for (const p of [p0, p1, q1, q0]) D.v(p[0], 0.07, -p[1], 0, 1, 0, p[0] / 4, p[1] / 4, DRIVE_C); pushUp(D, base, [p0, p1, q1, q0], [0, 1, 2]); pushUp(D, base, [p0, p1, q1, q0], [0, 2, 3]); }
    }
    if (garage) {
      quad(G.doors, at(gC - 2.4), at(gC + 2.4), 0.05, Math.min(2.3, h - 0.3), tz, tzz, 0.25, 1, WHITE_C);
      // driveway to the street
      if (rp) {
        const g0 = at(gC), dist = (rp[0] - g0[0]) * nx + (rp[1] - g0[1]) * ny - rp[2];
        if (dist > 1 && dist < 22) {
          const D = G.drive, p0 = at(gC - 2.6), p1 = at(gC + 2.6), q0 = [p0[0] + nx * dist, p0[1] + ny * dist], q1 = [p1[0] + nx * dist, p1[1] + ny * dist], y = 0.07;
          const base = D.n; for (const p of [p0, p1, q1, q0]) D.v(p[0], y, -p[1], 0, 1, 0, p[0] / 4, p[1] / 4, DRIVE_C);
          pushUp(D, base, [p0, p1, q1, q0], [0, 1, 2]); pushUp(D, base, [p0, p1, q1, q0], [0, 2, 3]);
        }
      }
    }
  }
  if (hs * 13 % 1 < 0.35) {              // chimney
    const p = inner[Math.floor(hs * 31) % inner.length], x = cx + (p[0] - cx) * 0.6, y = cy + (p[1] - cy) * 0.6;
    boxG(G.trim, x, y, 0.75, 0.75, h, h + rise + 0.7, BRICK_C);
  }
}

// which wall of a footprint faces the nearest street
function frontEdge(pts, cx, cy, nearRoad) {
  const rp = nearRoad(cx, cy); let best = -1, bs = -1e9;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey); if (len < 2.5) continue;
    const nx = ey / len, ny = -ex / len, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const sc = rp ? ((rp[0] - mx) * nx + (rp[1] - my) * ny) / (Math.hypot(rp[0] - mx, rp[1] - my) || 1) : len;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
// the house's rectangle lined up with its street-facing wall (only for roughly rectangular footprints)
function gableBox(pts, cx, cy, nearRoad) {
  const fi = frontEdge(pts, cx, cy, nearRoad); if (fi < 0) return null;
  const a = pts[fi], b = pts[(fi + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 3) return null;
  const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l, vx = uy, vy = -ux;          // u along the front, v outward
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const p of pts) { const u = (p[0] - cx) * ux + (p[1] - cy) * uy, v = (p[0] - cx) * vx + (p[1] - cy) * vy; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  let ar = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) ar += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  if (Math.abs(ar / 2) / ((u1 - u0) * (v1 - v0)) < 0.8) return null;      // L-shapes keep their hip roof
  const P = (u, v) => [cx + ux * u + vx * v, cy + uy * u + vy * v];
  let rect = [P(u0, v1), P(u0, v0), P(u1, v0), P(u1, v1)];                  // ... then make it counter-clockwise
  let r2 = 0; for (let i = 0, j = 3; i < 4; j = i++) r2 += rect[j][0] * rect[i][1] - rect[i][0] * rect[j][1];
  if (r2 < 0) rect.reverse();
  // the front edge is the one at v1
  let best = 0, bv = -1e9; for (let i = 0; i < 4; i++) { const m = [(rect[i][0] + rect[(i + 1) % 4][0]) / 2, (rect[i][1] + rect[(i + 1) % 4][1]) / 2], v = (m[0] - cx) * vx + (m[1] - cy) * vy; if (v > bv) { bv = v; best = i; } }
  return { rect, fi: best };
}
// a gable roof over a 4-corner footprint: gable ends on edge fi and the edge opposite, slopes on the other two
function gableRoof(G, R, W, pts, eave, fi, h, eh, rc, wc) {
  const P = i => pts[(fi + i) % 4], E = i => eave[(fi + i) % 4];
  const span = (Math.hypot(P(1)[0] - P(0)[0], P(1)[1] - P(0)[1]) + Math.hypot(P(3)[0] - P(2)[0], P(3)[1] - P(2)[1])) / 2;
  const rise = Math.min(4.2, Math.max(1.4, span * 0.42)), top = h + rise;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const Rf = mid(E(0), E(1)), Rb = mid(E(2), E(3));                 // ridge ends over the eaves
  const tri = (B, a, ay, b, by, c, cy, col) => {                    // one face, normal from its winding
    const ux = b[0] - a[0], uy = by - ay, uz = -(b[1] - a[1]), vx = c[0] - a[0], vy = cy - ay, vz = -(c[1] - a[1]);
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; const t = b, tb = by; b = c; by = cy; c = t; cy = tb; }
    const i0 = B.v(a[0], ay, -a[1], nx / l, ny / l, nz / l, 0, 0, col), i1 = B.v(b[0], by, -b[1], nx / l, ny / l, nz / l, 1, 0, col), i2 = B.v(c[0], cy, -c[1], nx / l, ny / l, nz / l, 1, 1, col);
    B.idx.push(i0, i1, i2);
  };
  // the two slopes
  tri(R, E(1), eh, E(2), eh, Rb, top, rc); tri(R, E(1), eh, Rb, top, Rf, top, rc);
  tri(R, E(3), eh, E(0), eh, Rf, top, rc); tri(R, E(3), eh, Rf, top, Rb, top, rc);
  // gable walls (siding colour, the plain top part of the facade texture so no window lands in the triangle)
  for (const [a, b] of [[P(0), P(1)], [P(2), P(3)]]) {
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1, nx = ey / l, nz = ex / l, m = mid(a, b), apex = h + rise * (l / 2) / ((l / 2) + 0.45);
    const i0 = W.v(a[0], h, -a[1], nx, 0, nz, 0, 0.74, wc), i1 = W.v(b[0], h, -b[1], nx, 0, nz, l / 4, 0.74, wc), i2 = W.v(m[0], apex, -m[1], nx, 0, nz, l / 8, 0.99, wc);
    W.idx.push(i0, i1, i2);
  }
  // fascia along the sloped and level eaves
  const T = G.trim;
  for (let i = 0; i < 4; i++) {
    const a = E(i), b = E((i + 1) % 4), ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1, nx = ey / l, nz = ex / l;
    const ya = (i === 0 || i === 2) ? eh : eh, yb = eh;
    if (i === 1 || i === 3) { const f0 = T.v(a[0], ya - 0.2, -a[1], nx, 0, nz, 0, 0, TRIM_C), f1 = T.v(b[0], yb - 0.2, -b[1], nx, 0, nz, 0, 0, TRIM_C), f2 = T.v(b[0], yb, -b[1], nx, 0, nz, 0, 0, TRIM_C), f3 = T.v(a[0], ya, -a[1], nx, 0, nz, 0, 0, TRIM_C); T.idx.push(f0, f1, f2, f0, f2, f3); }
    else {      // rake boards up the gable
      const r = mid(a, b);
      for (const [p, q] of [[a, r], [r, b]]) { const y0 = p === a ? eh : top, y1 = q === b ? eh : top; const f0 = T.v(p[0], y0 - 0.22, -p[1], nx, 0, nz, 0, 0, TRIM_C), f1 = T.v(q[0], y1 - 0.22, -q[1], nx, 0, nz, 0, 0, TRIM_C), f2 = T.v(q[0], y1 + 0.02, -q[1], nx, 0, nz, 0, 0, TRIM_C), f3 = T.v(p[0], y0 + 0.02, -p[1], nx, 0, nz, 0, 0, TRIM_C); T.idx.push(f0, f1, f2, f0, f2, f3); }
    }
  }
}

function garageDoor(G, pts, h, cx, cy, nearRoad) {
  const rp = nearRoad(cx, cy, 30); let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey); if (len < 2.8) continue;
    const nx = ey / len, ny = -ex / len, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const score = rp ? ((rp[0] - mx) * nx + (rp[1] - my) * ny) / (Math.hypot(rp[0] - mx, rp[1] - my) || 1) : len;
    if (!best || score > best.score) best = { a, len, nx, ny, ex: ex / len, ey: ey / len, score };
  }
  if (!best) return;
  const { a, len, nx, ny, ex, ey } = best, w = Math.min(len - 0.6, len > 6 ? 4.8 : 2.6), c0 = len / 2;
  quad(G.doors, [a[0] + ex * (c0 - w / 2), a[1] + ey * (c0 - w / 2)], [a[0] + ex * (c0 + w / 2), a[1] + ey * (c0 + w / 2)], 0.05, Math.min(2.2, h - 0.25), nx, -ny, 0.25, 1, WHITE_C);
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

// ground normal at tile-local (x, y); slopes are shaded a little stronger than real so gentle hollows and rises read on screen
const SLOPE_SHADE = 2.2;
function tnorm(x, y) {
  const e = 4, nx = (gl(x - e, y) - gl(x + e, y)) * SLOPE_SHADE, nz = (gl(x, y + e) - gl(x, y - e)) * SLOPE_SHADE, l = Math.hypot(nx, 2 * e, nz);
  return [nx / l, 2 * e / l, nz / l];
}
// flat polygons (land use, parks, water) at height y
export function buildFlat(feats, colourOf, yOf, uvScale = 25, maxEdge = 14) {
  const G = new GeoBuilder();
  for (const f of feats) {
    const c = colourOf(f); if (!c) continue;
    const y = yOf(f);
    const outer = cleanRing(f.rings[0]); if (outer.length < 3) continue;
    const holes = f.rings.slice(1).map(cleanRing).filter(h => h.length >= 3);
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p[0], p[1])), holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])))); } catch (e) { continue; }
    const all = outer.concat(...holes);
    tmpC.set(c);
    if (!TER.on) { const base = G.n; for (const p of all) G.v(p[0], y, -p[1], 0, 1, 0, p[0] / uvScale, p[1] / uvScale, tmpC); for (const t of tris) pushUp(G, base, all, t); continue; }
    // on hilly ground big triangles are split until they follow the terrain
    const emit = (a, b, cc, depth) => {
      const lab = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2, lbc = (b[0] - cc[0]) ** 2 + (b[1] - cc[1]) ** 2, lca = (cc[0] - a[0]) ** 2 + (cc[1] - a[1]) ** 2, m = Math.max(lab, lbc, lca);
      if (m > maxEdge * maxEdge && depth < 12) {
        if (m === lab) { const p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; emit(a, p, cc, depth + 1); emit(p, b, cc, depth + 1); }
        else if (m === lbc) { const p = [(b[0] + cc[0]) / 2, (b[1] + cc[1]) / 2]; emit(a, b, p, depth + 1); emit(a, p, cc, depth + 1); }
        else { const p = [(cc[0] + a[0]) / 2, (cc[1] + a[1]) / 2]; emit(a, b, p, depth + 1); emit(p, b, cc, depth + 1); }
        return;
      }
      const base = G.n; for (const p of [a, b, cc]) { const n = tnorm(p[0], p[1]); G.v(p[0], y, -p[1], n[0], n[1], n[2], p[0] / uvScale, p[1] / uvScale, tmpC); }
      pushUp(G, base, [a, b, cc], [0, 1, 2]);
    };
    for (const t of tris) emit(all[t[0]], all[t[1]], all[t[2]], 0);
  }
  return G.build();
}

// ribbons along lines (roads, paths, rail)
export function buildRibbons(lines, y, widthOf, colour = 0xffffff, vScale = 10, offsetOf = null) {
  const G = new GeoBuilder();
  tmpC.set(colour);
  for (const ln of lines) {
    const w = widthOf(ln) / 2, raw = ln.rings[0], r = raw.z || !TER.on ? raw : densify(raw, 10), n = r.length / 2;
    if (n < 2) continue;
    G.lift = r.z ? 0 : null;                               // decks carry absolute heights
    const yy = typeof y === 'function' ? y(ln) : y, off = offsetOf ? offsetOf(ln) : 0;
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
      const cx = off ? x - dz * off / dot : x, cz = off ? z + dx * off / dot : z;    // sidewalks run beside the line
      if (i > 0) along += la;
      const yh = yy + (r.z ? r.z[i] : 0);
      G.v(cx + ox, yh, -(cz + oz), 0, 1, 0, 0, along / vScale, tmpC);
      G.v(cx - ox, yh, -(cz - oz), 0, 1, 0, 1, along / vScale, tmpC);
      if (i > 0) { const a = base + (i - 1) * 2; G.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
  }
  return G.build();
}

// bridge and overpass structure: deck sides, railings and pillars under raised roads, paths and rails
export function buildDecks(lines, widthOf, rail = true, ridx = null, rails = null) {
  const G = new GeoBuilder(); G.lift = 0; const c = new THREE.Color(0xb9b6ae), cr = new THREE.Color(0x8d8f93);
  for (const ln of lines) {
    const r = ln.rings[0], Z = r.z, ZR = r.zr || Z; if (!Z) continue;
    const n = r.length / 2, hw = widthOf(ln) / 2 + 0.3;
    let sincePillar = 15;
    for (let i = 1; i < n; i++) {
      const ax = r[i * 2 - 2], ay = r[i * 2 - 1], bx = r[i * 2], by = r[i * 2 + 1], za = Z[i - 1], zb = Z[i];
      if (Math.max(ZR[i - 1], ZR[i]) < 0.8) continue;
      const ga = TER.on ? gl(ax, ay) : 0, gb = TER.on ? gl(bx, by) : 0;
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy); if (l < 0.05) continue;
      const nx = -dy / l * hw, ny = dx / l * hw;            // left side offset
      for (const sgn of [1, -1]) {
        const x0 = ax + nx * sgn, y0 = ay + ny * sgn, x1 = bx + nx * sgn, y1 = by + ny * sgn;
        const fnx = sgn * -dy / l, fnz = -(sgn * dx / l);
        const q = (xa, ya, ha, la, xb, yb, hb, lb, col) => {     // a vertical quad from (low..high) at both ends
          const i0 = G.v(xa, la, -ya, fnx, 0, fnz, 0, 0, col), i1 = G.v(xb, lb, -yb, fnx, 0, fnz, 1, 0, col), i2 = G.v(xb, hb, -yb, fnx, 0, fnz, 1, 1, col), i3 = G.v(xa, ha, -ya, fnx, 0, fnz, 0, 1, col);
          if (sgn > 0) G.idx.push(i0, i2, i1, i0, i3, i2); else G.idx.push(i0, i1, i2, i0, i2, i3);
        };
        const open = ridx && (ridx.on(x0, y0, za, r, 0.6) || ridx.on(x1, y1, zb, r, 0.6));      // deck edge meets another road (ramps joining)
        if (!open) q(x0, y0, za + 0.2, Math.max(ga, za - 1.1), x1, y1, zb + 0.2, Math.max(gb, zb - 1.1), c);     // deck edge
        if (rail && !open) { q(x0, y0, za + 1.0, za + 0.2, x1, y1, zb + 1.0, zb + 0.2, cr); if (rails) rails.add(x0, y0, za, x1, y1, zb); }      // railing
      }
      // pillars every ~30 m where the deck is high
      sincePillar += l;
      if (sincePillar > 30 && (ZR[i - 1] + ZR[i]) / 2 > 3) {
        sincePillar = 0;
        const px = (ax + bx) / 2, py = (ay + by) / 2, top = (za + zb) / 2 - 1.1, s2 = 0.7, pg = TER.on ? gl(px, py) - 1 : 0;
        const pts = [[px - s2, py - s2], [px + s2, py - s2], [px + s2, py + s2], [px - s2, py + s2]];
        for (let k = 0; k < 4; k++) {
          const p0 = pts[k], p1 = pts[(k + 1) % 4], ex = p1[0] - p0[0], ey = p1[1] - p0[1], el = Math.hypot(ex, ey);
          const ox = ey / el, oz = ex / el;
          const i0 = G.v(p0[0], pg, -p0[1], ox, 0, oz, 0, 0, c), i1 = G.v(p1[0], pg, -p1[1], ox, 0, oz, 1, 0, c), i2 = G.v(p1[0], top, -p1[1], ox, 0, oz, 1, 1, c), i3 = G.v(p0[0], top, -p0[1], ox, 0, oz, 0, 1, c);
          G.idx.push(i0, i1, i2, i0, i2, i3);
        }
      }
    }
  }
  return G.build();
}

// surfaces you can stand or drive on above the ground (tile-local segments), for heights
export function buildSurfaces(lists) {
  const cell = 16, grid = new Map(); let n = 0;
  for (const [lines, widthOf, tag] of lists) for (const ln of lines) {
    const r = ln.rings[0], Z = r.z, ZR = r.zr || Z; if (!Z || (ln.flags & 4)) continue;
    const hw = widthOf(ln) / 2 + 0.4;
    for (let i = 1; i < r.length / 2; i++) {
      if (Math.max(ZR[i - 1], ZR[i]) < 0.3) continue;
      const seg = [r[i * 2 - 2], r[i * 2 - 1], Z[i - 1], r[i * 2], r[i * 2 + 1], Z[i], hw, tag || 0]; n++;
      const x0 = Math.floor((Math.min(seg[0], seg[3]) - hw) / cell), x1 = Math.floor((Math.max(seg[0], seg[3]) + hw) / cell);
      const y0 = Math.floor((Math.min(seg[1], seg[4]) - hw) / cell), y1 = Math.floor((Math.max(seg[1], seg[4]) + hw) / cell);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 100000 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(seg); }
    }
  }
  return n ? { cell, grid } : null;
}

// the ground under one tile: a 25 m grid that follows the terrain
function groundGrid(TS, cell = 12.5) {
  const n = Math.round(TS / cell), G = new GeoBuilder(), white = new THREE.Color(0xffffff);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = i * cell, y = j * cell, n = tnorm(x, y);
    G.v(x, -0.03, -y, n[0], n[1], n[2], x / 40, y / 40, white);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; G.idx.push(a, b, d, a, d, c); }
  return G.build();
}
// speed limits by road class (Calgary: 40 km/h on residential streets)
export const SPEED_LIMIT = { 1: 100, 2: 80, 8: 70, 9: 60, 3: 60, 4: 60, 5: 50, 6: 40, 7: 30, 10: 50 };
// every road piece of a tile in a 16 m grid: is a point on some other road's pavement (at about the same height)?
export function pavementIndex(roads) {
  const cell = 16, grid = new Map();
  for (const f of roads || []) {
    if (f.flags & 4) continue;
    const r = f.rings[0], Z = r.z, hw = f.a / 20, n = r.length / 2;
    for (let i = 1; i < n; i++) {
      const seg = [r[i * 2 - 2], r[i * 2 - 1], Z ? Z[i - 1] : null, r[i * 2], r[i * 2 + 1], Z ? Z[i] : null, hw, r, f.kind];
      const x0 = Math.floor((Math.min(seg[0], seg[3]) - hw) / cell), x1 = Math.floor((Math.max(seg[0], seg[3]) + hw) / cell);
      const y0 = Math.floor((Math.min(seg[1], seg[4]) - hw) / cell), y1 = Math.floor((Math.max(seg[1], seg[4]) + hw) / cell);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 100000 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(seg); }
    }
  }
  return {
    // true if (x, y) at height z lies on the pavement of a road other than ring `self`
    on(x, y, z, self, margin = 0.3) {
      const l = grid.get(Math.floor(x / cell) * 100000 + Math.floor(y / cell)); if (!l) return false;
      for (const s of l) {
        if (s[7] === self) continue;
        const dx = s[3] - s[0], dy = s[4] - s[1], L2 = dx * dx + dy * dy || 1e-9;
        const u = Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / L2));
        if (Math.hypot(x - s[0] - dx * u, y - s[1] - dy * u) > s[6] - margin) continue;
        const zo = s[2] != null ? s[2] + (s[5] - s[2]) * u : gl(x, y);
        if (Math.abs(zo - z) < 2.5) return true;
      }
      return false;
    },
    // how far the drawn surface sits above the terrain here: road paint, or the raised sidewalk beside a main road
    lift(x, y) {
      const l = grid.get(Math.floor(x / cell) * 100000 + Math.floor(y / cell)); if (!l) return 0;
      let best = 0;
      for (const s of l) {
        if (s[2] != null) continue;                         // bridges and ramps carry their own heights
        const dx = s[3] - s[0], dy = s[4] - s[1], L2 = dx * dx + dy * dy || 1e-9;
        const u = Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / L2)), d = Math.hypot(x - s[0] - dx * u, y - s[1] - dy * u);
        if (d <= s[6]) return ROAD_Y[s[8]] || 0.15;
        if (s[8] >= 3 && s[8] <= 6 && d <= s[6] + 2.1) best = 0.13;
      }
      return best;
    }
  };
}
// barrier segments (guardrails, bridge railings) in a tile-local 16 m grid, for collisions
export function railStore() {
  const cell = 16, grid = new Map();
  return {
    grid, cell,
    add(ax, ay, az, bx, by, bz) {
      const seg = [ax, ay, az, bx, by, bz];
      const x0 = Math.floor(Math.min(ax, bx) / cell), x1 = Math.floor(Math.max(ax, bx) / cell), y0 = Math.floor(Math.min(ay, by) / cell), y1 = Math.floor(Math.max(ay, by) / cell);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 100000 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(seg); }
    }
  };
}
// steel W-beam guardrails along both sides of freeways and their ramps
export function buildGuardrails(roads, ridx, rails) {
  const G = new GeoBuilder(), white = new THREE.Color(0xffffff);
  for (const f of roads || []) {
    // guardrails only on freeways (in the middle, between the two directions) and along bridges; city streets get curbs
    const raw0 = f.rings[0], bridge = !!raw0.z;
    if ((f.flags & 4) || !(bridge ? [1, 2, 3, 4, 8, 9].includes(f.kind) : f.kind === 1)) continue;
    const raw = f.rings[0], Z = raw.z, r = Z || !TER.on ? raw : densify(raw, 8), n = r.length / 2; if (n < 2) continue;
    G.lift = Z ? 0 : null;
    for (const side of bridge ? [1, -1] : (f.flags & 1) ? [1] : []) {
      const off = (f.a / 20 + 0.6) * side; let along = 0; const base = G.n;
      const free = new Uint8Array(n), P = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = r[i * 2], y = r[i * 2 + 1], px = i > 0 ? r[i * 2 - 2] : x, py = i > 0 ? r[i * 2 - 1] : y, qx = i < n - 1 ? r[i * 2 + 2] : x, qy = i < n - 1 ? r[i * 2 + 3] : y;
        let dx = qx - px, dy = qy - py; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        if (i > 0) along += Math.hypot(x - px, y - py);
        const ox = -dy * off, oy = dx * off, nx = -dy * side, nz = -dx * side;
        const y0 = Z ? Z[i] + 0.15 : 0.1, zabs = Z ? Z[i] : (TER.on ? gl(x + ox, y + oy) : 0);
        // no rail where it would stand on another road (where ramps split off or merge, at junctions)
        free[i] = ridx && ridx.on(x + ox, y + oy, zabs, raw) ? 0 : 1;
        P[i * 3] = x + ox; P[i * 3 + 1] = y + oy; P[i * 3 + 2] = zabs;
        G.v(x + ox, y0, -(y + oy), nx, 0, nz, along / 2, 0, white); G.v(x + ox, y0 + 0.82, -(y + oy), nx, 0, nz, along / 2, 1, white);
      }
      for (let i = 1; i < n; i++) {
        if (!free[i - 1] || !free[i]) continue;
        const a = base + (i - 1) * 2; G.idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
        if (rails) rails.add(P[i * 3 - 3], P[i * 3 - 2], P[i * 3 - 1], P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      }
    }
  }
  return G.build();
}
// concrete curbs along both edges of city streets (and the CTrain where it runs at street level), broken where
// another road crosses so they stop at the corners of every intersection
export function buildCurbs(roads, ridx, rails) {
  const G = new GeoBuilder(), top = new THREE.Color(0xdcd9d2), face = new THREE.Color(0x9a978f);
  const lines = [];
  for (const f of roads || []) if ([2, 3, 4, 5, 6, 9].includes(f.kind) && !(f.flags & 4) && !f.rings[0].z) lines.push([f, f.a / 20, ROAD_Y[f.kind] || 0.15]);
  for (const f of rails || []) if (f.kind === 2 && !(f.flags & 4) && !f.rings[0].z) lines.push([f, 1.75, 0.17]);
  const H = 0.18, W = 0.24;
  for (const [f, hw, ry] of lines) {
    const raw = f.rings[0], r = TER.on ? densify(raw, 6) : raw, n = r.length / 2; if (n < 2) continue;
    for (const side of [1, -1]) {
      const P = [];
      for (let i = 0; i < n; i++) {
        const x = r[i * 2], y = r[i * 2 + 1], px = i > 0 ? r[i * 2 - 2] : x, py = i > 0 ? r[i * 2 - 1] : y, qx = i < n - 1 ? r[i * 2 + 2] : x, qy = i < n - 1 ? r[i * 2 + 3] : y;
        let dx = qx - px, dy = qy - py; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const nx = -dy * side, ny = dx * side, ex = x + nx * hw, ey = y + ny * hw;
        const free = !(ridx && (ridx.on(ex + nx * 0.1, ey + ny * 0.1, TER.on ? gl(ex, ey) : 0, raw, 0.3)));
        P.push([ex, ey, nx, ny, free]);
      }
      for (let i = 1; i < n; i++) {
        const a = P[i - 1], b = P[i]; if (!a[4] || !b[4]) continue;
        // the face toward the road, then the top
        const fnx = -a[2], fnz = a[3];
        const i0 = G.v(a[0], ry - 0.03, -a[1], fnx, 0, fnz, 0, 0, face), i1 = G.v(b[0], ry - 0.03, -b[1], fnx, 0, fnz, 1, 0, face), i2 = G.v(b[0], ry + H, -b[1], fnx, 0, fnz, 1, 1, face), i3 = G.v(a[0], ry + H, -a[1], fnx, 0, fnz, 0, 1, face);
        G.idx.push(i0, i1, i2, i0, i2, i3, i0, i2, i1, i0, i3, i2);
        const j0 = G.v(a[0], ry + H, -a[1], 0, 1, 0, 0, 0, top), j1 = G.v(b[0], ry + H, -b[1], 0, 1, 0, 1, 0, top), j2 = G.v(b[0] + b[2] * W, ry + H, -(b[1] + b[3] * W), 0, 1, 0, 1, 1, top), j3 = G.v(a[0] + a[2] * W, ry + H, -(a[1] + a[3] * W), 0, 1, 0, 0, 1, top);
        G.idx.push(j0, j1, j2, j0, j2, j3, j0, j2, j1, j0, j3, j2);
      }
    }
  }
  return G.build();
}
// speed limit signs (white "MAXIMUM" signs) on the right, facing traffic, every few hundred metres
const SIGN_GEO = {}, SIGN_MAT = {};
export function buildSpeedSigns(roads) {
  if (!roads) return [];
  SIGN_GEO.pole ||= new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5).translate(0, 1.2, 0);
  SIGN_GEO.panel ||= new THREE.PlaneGeometry(0.62, 0.8).translate(0, 2.45, 0.03);
  const byLimit = {}, poles = [];
  for (const f of roads) {
    const lim = SPEED_LIMIT[f.kind]; if (!lim || f.kind === 7 || (f.flags & 4) || f.rings[0].z) continue;
    const r = f.rings[0], n = r.length / 2, every = f.kind <= 2 ? 700 : f.kind <= 5 ? 450 : 260;
    let acc = every * 0.35;
    for (let i = 1; i < n; i++) {
      const ax = r[i * 2 - 2], ay = r[i * 2 - 1], bx = r[i * 2], by = r[i * 2 + 1], l = Math.hypot(bx - ax, by - ay); if (l < 0.1) continue;
      const dx = (bx - ax) / l, dy = (by - ay) / l;
      while (acc < l) {
        for (const dir of (f.flags & 1) ? [1] : [1, -1]) {
          const ddx = dx * dir, ddy = dy * dir, off = f.a / 20 + (f.kind <= 2 ? 2.2 : 1.4);
          const sx = ax + dx * acc + ddy * off, sy = ay + dy * acc - ddx * off;      // right-hand side of travel
          (byLimit[lim] ||= []).push([sx, sy, Math.atan2(-ddx, ddy)]); poles.push([sx, sy]);
        }
        acc += every;
      }
      acc -= l;
    }
  }
  if (!poles.length) return [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), out = [];
  const pm = new THREE.InstancedMesh(SIGN_GEO.pole, MAT.pole, poles.length);
  poles.forEach((s, i) => { m.compose(p.set(s[0], TER.on ? gl(s[0], s[1]) : 0, -s[1]), q.identity(), one); pm.setMatrixAt(i, m); }); out.push(pm);
  for (const [lim, list] of Object.entries(byLimit)) {
    SIGN_MAT[lim] ||= new THREE.MeshLambertMaterial({ map: speedSignTexture(lim) });
    const im = new THREE.InstancedMesh(SIGN_GEO.panel, SIGN_MAT[lim], list.length);
    list.forEach((s, i) => { q.setFromAxisAngle(up, s[2]); m.compose(p.set(s[0], TER.on ? gl(s[0], s[1]) : 0, -s[1]), q, one); im.setMatrixAt(i, m); }); out.push(im);
  }
  return out;
}
function speedSignTexture(lim) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 164; const g = c.getContext('2d');
  g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 128, 164); g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(6, 6, 116, 152);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '700 19px Arial, sans-serif'; g.fillText('MAXIMUM', 64, 36);
  g.font = '900 64px Arial, sans-serif'; g.fillText(String(lim), 64, 106); g.font = '700 20px Arial, sans-serif'; g.fillText('km/h', 64, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// street lights: curved davit poles along city streets every ~45 m, the lamp heads glow at night
const LIGHT_GEO = {};
export function buildStreetLights(roads) {
  if (!roads || !roads.length) return [];
  if (!LIGHT_GEO.pole) {
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 7.6, 6).translate(0, 3.8, 0);
    const arm = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5).rotateZ(Math.PI / 2).translate(1.05, 7.55, 0);
    LIGHT_GEO.pole = mergeGeos([pole, arm]);
    LIGHT_GEO.head = new THREE.BoxGeometry(0.75, 0.16, 0.34).translate(2.15, 7.45, 0);
  }
  const spots = [];
  for (const f of roads) {
    if (![3, 4, 5, 6].includes(f.kind) || f.rings[0].z || (f.flags & 4)) continue;
    const r = f.rings[0], n = r.length / 2, off = f.a / 20 + 0.8; let acc = 22, side = 1;
    for (let i = 1; i < n; i++) {
      const ax = r[i * 2 - 2], ay = r[i * 2 - 1], bx = r[i * 2], by = r[i * 2 + 1], l = Math.hypot(bx - ax, by - ay); if (l < 0.1) continue;
      const dx = (bx - ax) / l, dy = (by - ay) / l;
      while (acc < l) {
        const px = ax + dx * acc, py = ay + dy * acc, nx = dy * side, ny = -dx * side;     // to the right (then left on main roads)
        spots.push([px + nx * off, py + ny * off, Math.atan2(-ny, -nx)]);
        if (f.kind <= 4) side = -side;
        acc += f.kind <= 4 ? 38 : 48;
      }
      acc -= l;
    }
  }
  if (!spots.length) return [];
  const poles = new THREE.InstancedMesh(LIGHT_GEO.pole, MAT.pole, spots.length), heads = new THREE.InstancedMesh(LIGHT_GEO.head, MAT.lamp, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => { q.setFromAxisAngle(up, s[2]); m.compose(p.set(s[0], TER.on ? gl(s[0], s[1]) : 0, -s[1]), q, one); poles.setMatrixAt(i, m); heads.setMatrixAt(i, m); });
  poles.castShadow = true;
  return [poles, heads];
}
function mergeGeos(list) {
  const pos = [], nor = [], idx = []; let o = 0;
  for (const g0 of list) { const g = g0.index ? g0 : g0; const P = g.attributes.position.array, N = g.attributes.normal.array; pos.push(...P); nor.push(...N); for (const i of g.index.array) idx.push(i + o); o += P.length / 3; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
// street trees (City of Calgary public tree inventory): instanced trunks and crowns
const TREE_GEO = {};
// street trees by species class (tools/tag_trees.py, City of Calgary Public Trees): each class has its own crown shape
// 1 broadleaf  2 spruce  3 pine  4 poplar  5 small flowering  6 shrub  7 larch  8 birch  9 big shade tree  10 willow  11 juniper
function mergeGeo(parts) {          // [geometry, [x, y, z], [sx, sy, sz]] -> one non-indexed geometry
  const P = [], N = [];
  for (const [g0, o, sc] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals();
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) { P.push(pa.getX(i) * sc[0] + o[0], pa.getY(i) * sc[1] + o[1], pa.getZ(i) * sc[2] + o[2]); N.push(na.getX(i), na.getY(i), na.getZ(i)); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
function treeGeos() {
  if (TREE_GEO.c) return TREE_GEO;
  const ico = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 9).translate(0, 0.5, 0);
  TREE_GEO.trunk = new THREE.CylinderGeometry(0.12, 0.2, 1, 6).translate(0, 0.5, 0);
  // crowns in a unit box: x/z radius ~1, y from 0 (crown base) to 1 (top)
  const S = (x, y, z, r, ry = r) => [ico, [x, y, z], [r, ry, r]];
  TREE_GEO.c = {
    1: mergeGeo([S(0, 0.5, 0, 0.75, 0.5), S(0.45, 0.42, 0.2, 0.55, 0.4), S(-0.42, 0.45, -0.22, 0.55, 0.4), S(0.05, 0.7, -0.35, 0.5, 0.35), S(-0.15, 0.68, 0.38, 0.45, 0.32)]),
    2: mergeGeo([[cone, [0, 0, 0], [1, 0.55, 1]], [cone, [0, 0.3, 0], [0.74, 0.45, 0.74]], [cone, [0, 0.55, 0], [0.48, 0.45, 0.48]]]),
    3: mergeGeo([S(0.1, 0.55, 0, 0.7, 0.32), S(-0.45, 0.35, 0.25, 0.5, 0.25), S(0.4, 0.3, -0.35, 0.45, 0.22), S(0, 0.85, 0.1, 0.45, 0.2)]),
    4: mergeGeo([S(0, 0.48, 0, 0.62, 0.5), S(0.15, 0.78, 0.05, 0.42, 0.25), S(-0.18, 0.3, -0.1, 0.5, 0.3)]),
    5: mergeGeo([S(0, 0.5, 0, 0.85, 0.5), S(0.35, 0.55, 0.3, 0.5, 0.38), S(-0.35, 0.5, -0.25, 0.5, 0.38)]),
    6: mergeGeo([S(0, 0.45, 0, 0.9, 0.5), S(0.45, 0.35, 0.3, 0.6, 0.38), S(-0.4, 0.38, -0.3, 0.6, 0.4)]),
    7: mergeGeo([[cone, [0, 0, 0], [0.9, 1, 0.9]], S(0, 0.25, 0, 0.55, 0.2)]),
    8: mergeGeo([S(0, 0.5, 0, 0.62, 0.5), S(0.2, 0.75, 0.1, 0.4, 0.25), S(-0.25, 0.35, -0.1, 0.45, 0.3)]),
    9: mergeGeo([S(0, 0.5, 0, 0.8, 0.5), S(0.55, 0.42, 0.25, 0.6, 0.4), S(-0.5, 0.45, -0.3, 0.6, 0.42), S(0.1, 0.72, -0.45, 0.55, 0.32), S(-0.2, 0.7, 0.45, 0.5, 0.32), S(0.45, 0.62, -0.3, 0.45, 0.3)]),
    10: mergeGeo([S(0, 0.55, 0, 0.95, 0.45), [cone.clone().rotateX(Math.PI), [0, 0.45, 0], [1.05, 0.5, 1.05]]]),
    11: mergeGeo([[cone, [0, 0, 0], [1, 1, 1]], S(0, 0.25, 0, 0.75, 0.3)])
  };
  return TREE_GEO;
}
// the generated tree models (autumn sugar maple, Colorado blue spruce, paper birch): one geometry each, standing on y = 0,
// 1 high, crown radius 1. Most broadleaf street trees become maples, in reds, oranges and golds
export const TREE_M = {};
export async function loadTreeModels() {
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  await Promise.all(['maple', 'spruce', 'birch'].map(async k => {
    try {
      const gl0 = await loader.loadAsync(`data/models/tree_${k}.glb`); gl0.scene.updateMatrixWorld(true); let mesh = null; gl0.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox();
      const b = geo.boundingBox, sz = b.getSize(v), c = b.getCenter(v2), r = Math.max(sz.x, sz.z) / 2;
      geo.translate(-c.x, -b.min.y, -c.z); geo.scale(1 / r, 1 / sz.y, 1 / r); geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mat = new THREE.MeshLambertMaterial({ map: mesh.material.map });
      if (k === 'maple') {        // the leaves (greenish texels) take each tree's autumn colour; the trunk keeps its bark
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = sh => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n vec3 txC = diffuseColor.rgb; float lfM = smoothstep(-0.02, 0.06, txC.g - txC.r * 0.85);')
            .replace('#include <color_fragment>', '#include <color_fragment>\n #ifdef USE_COLOR\n { float lu = dot(txC, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(txC, vColor.rgb * (0.8 + lu * 0.9), lfM); }\n #endif');
        };
      }
      nearFade(mat, 1.5, 4.5); if (k === 'maple') mat.customProgramCacheKey = () => 'nearfade-maple';
      TREE_M[k] = { geo, mat };
    } catch (e) { console.warn('tree model', k, e); }
  }));
}
const TINT = { maple: [[0.85, 0.16, 0.07], [0.95, 0.42, 0.08], [0.95, 0.66, 0.14], [0.68, 0.09, 0.07], [0.9, 0.3, 0.06], [0.78, 0.62, 0.18]], birch: [[1, 1, 1], [1, 0.92, 0.75]], spruce: [[1, 1, 1], [0.85, 0.95, 1], [0.9, 1, 0.9]] };
function modelFor(c, hs) {
  if (c === 6 || c === 11) return null;                       // shrubs and junipers keep their low shapes
  if (c === 2 || c === 3 || c === 7) return 'spruce';
  if (c === 8) return 'birch';
  if (c === 4) return hs < 0.5 ? 'birch' : 'maple';
  return hs * 7 % 1 < 0.18 ? 'birch' : 'maple';
}
// leaf colours (HSL) per class: [hue, sat, light] base and jitter; some classes have a second colour (purple crabapples, blue spruce)
const LEAF = { 1: [0.24, 0.45, 0.3], 2: [0.37, 0.32, 0.22], 3: [0.33, 0.33, 0.25], 4: [0.2, 0.5, 0.36], 5: [0.23, 0.42, 0.33], 6: [0.25, 0.4, 0.3], 7: [0.27, 0.45, 0.42], 8: [0.21, 0.5, 0.42], 9: [0.25, 0.42, 0.28], 10: [0.19, 0.42, 0.42], 11: [0.4, 0.28, 0.24] };
export function buildTrees(feats) {
  if (!feats || !feats.length) return [];
  const G = treeGeos(), out = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const cls = f => (f.kind >= 1 && f.kind <= 11 ? f.kind : 1);
  const hsOf = f => { const r = f.rings[0]; return Math.abs(Math.sin(r[0] * 12.9898 + r[1] * 78.233)) % 1; };
  if (TREE_M.maple && TREE_M.spruce && TREE_M.birch) {      // the detailed models
    const byM = {}, rest = [];
    for (const f of feats) { const k = modelFor(cls(f), hsOf(f)); if (k) (byM[k] ||= []).push(f); else rest.push(f); }
    for (const [k, list] of Object.entries(byM)) {
      const M = TREE_M[k], im = new THREE.InstancedMesh(M.geo, M.mat, list.length), T = TINT[k];
      list.forEach((f, i) => {
        const r = f.rings[0], h = Math.max(3, f.a / 10), cr = Math.max(1.2, f.b / 10), hs = hsOf(f), c = cls(f);
        const w = k === 'spruce' ? Math.max(1.2, Math.min(cr * 0.85, h * 0.3)) : Math.min(cr * 0.95, h * 0.62);
        m.compose(pos.set(r[0], TER.on ? gl(r[0], r[1]) : 0, -r[1]), q.setFromAxisAngle(up, hs * 6.28), sc.set(w * (0.92 + hs * 0.16), h, w * (1.08 - hs * 0.16)));
        im.setMatrixAt(i, m); const t = T[(hs * 31 | 0) % T.length]; im.setColorAt(i, col.setRGB(t[0], t[1], t[2]));
      });
      im.castShadow = true; im.userData.trees = k; out.push(im);
    }
    if (!rest.length) return out;
    feats = rest;
  }
  const withTrunk = feats.filter(f => cls(f) !== 6 && cls(f) !== 11);
  if (withTrunk.length) {
    const trunks = new THREE.InstancedMesh(G.trunk, MAT.trunk, withTrunk.length);
    withTrunk.forEach((f, i) => {
      const r = f.rings[0], h = f.a / 10, c = cls(f), tall = c === 3 ? 0.62 : c === 2 || c === 7 ? 0.2 : c === 4 ? 0.3 : c === 10 ? 0.35 : 0.42;
      m.compose(pos.set(r[0], TER.on ? gl(r[0], r[1]) : 0, -r[1]), q.identity(), sc.set(1 + f.b / 60, h * tall, 1 + f.b / 60)); trunks.setMatrixAt(i, m);
      trunks.setColorAt(i, col.setHex(c === 8 ? 0xe8e4da : c === 3 ? 0x7a4f35 : 0x5b4535));
    });
    trunks.castShadow = true; out.push(trunks);
  }
  const by = {}; for (const f of feats) (by[cls(f)] ||= []).push(f);
  for (const [c0, list] of Object.entries(by)) {
    const c = +c0, im = new THREE.InstancedMesh(G.c[c], MAT.leaves, list.length);
    list.forEach((f, i) => {
      const r = f.rings[0], h = f.a / 10, cr = f.b / 10, hs = Math.abs(Math.sin(r[0] * 12.9898 + r[1] * 78.233)) % 1;
      const gy0 = TER.on ? gl(r[0], r[1]) : 0;
      let y0, ch, w;          // crown base, crown height, crown radius
      if (c === 2) { y0 = h * 0.06; ch = h * 0.94; w = Math.max(1.2, Math.min(cr * 0.85, h * 0.28)); }
      else if (c === 7) { y0 = h * 0.12; ch = h * 0.88; w = Math.min(cr * 0.7, h * 0.22); }
      else if (c === 11) { y0 = 0; ch = Math.max(1.5, h * 0.5); w = Math.max(0.8, cr * 0.6); }
      else if (c === 6) { y0 = 0; ch = Math.min(2.6, Math.max(1.2, h * 0.3)); w = Math.max(1, cr * 0.7); }
      else if (c === 3) { y0 = h * 0.5; ch = h * 0.5; w = cr * 0.8; }
      else if (c === 4) { y0 = h * 0.25; ch = h * 0.78; w = cr * 0.65; }
      else if (c === 10) { y0 = h * 0.2; ch = h * 0.75; w = cr * 1.15; }
      else if (c === 5) { y0 = h * 0.32; ch = Math.max(2, h * 0.68); w = cr * 0.9; }
      else { y0 = h * 0.35; ch = h * 0.68; w = cr * (c === 9 ? 1.05 : 0.95); }
      m.compose(pos.set(r[0], gy0 + y0, -r[1]), q.setFromAxisAngle(up, hs * 6.28), sc.set(w * (0.9 + hs * 0.2), ch, w * (1.1 - hs * 0.2)));
      im.setMatrixAt(i, m);
      const L = LEAF[c]; let hh = L[0] + (hs - 0.5) * 0.05, ss = L[1] + (hs * 7 % 1 - 0.5) * 0.12, ll = L[2] + (hs * 13 % 1 - 0.5) * 0.08;
      if (c === 5 && hs * 3 % 1 < 0.3) { hh = 0.96; ss = 0.3; ll = 0.24; }          // purple-leaf crabapples and chokecherries
      if (c === 2 && hs * 5 % 1 < 0.25) { hh = 0.5; ss = 0.18; ll = 0.36; }         // Colorado blue spruce
      im.setColorAt(i, col.setHSL(hh, ss, ll));
    });
    im.castShadow = true; out.push(im);
  }
  return out;
}

// segment grid for collisions (tile-local), cell 16 m
export function buildSegCollision(segs) {
  const cell = 16, grid = new Map();
  for (const seg of segs) {
    const x0 = Math.floor(Math.min(seg[0], seg[2]) / cell), x1 = Math.floor(Math.max(seg[0], seg[2]) / cell);
    const y0 = Math.floor(Math.min(seg[1], seg[3]) / cell), y1 = Math.floor(Math.max(seg[1], seg[3]) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 100000 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(seg); }
  }
  return { cell, grid };
}
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
// map footprints that no City 3D building stands on (and that aren't landmarks or rebuilt plazas)
function missingFootprints(feats, outlines, ox, oy) {
  const G = new Map(), C = 25, key = (i, j) => i + ',' + j;
  for (const o of outlines) for (let i = Math.floor(o.mnx / C); i <= Math.floor(o.mxx / C); i++) for (let j = Math.floor(o.mny / C); j <= Math.floor(o.mxy / C); j++) { const k = key(i, j); let l = G.get(k); if (!l) G.set(k, l = []); l.push(o); }
  const inside = (o, x, y) => {
    if (x < o.mnx - 0.5 || x > o.mxx + 0.5 || y < o.mny - 0.5 || y > o.mxy + 0.5) return false;
    let c = false; const E = o.E;
    for (let i = 0; i < E.length; i += 4) { const x1 = E[i], y1 = E[i + 1], x2 = E[i + 2], y2 = E[i + 3]; if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1) c = !c; }
    return c;
  };
  const out = [];
  for (const f of feats) {
    const r = f.rings[0]; if (!r || r.length < 6) continue;
    const n = r.length / 2; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += r[i * 2]; cy += r[i * 2 + 1]; } cx /= n; cy /= n;
    if (Math.abs(ringArea(r)) < 25) continue;                 // sheds
    const pts = [[cx, cy]]; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4))) pts.push([r[i * 2] * 0.6 + cx * 0.4, r[i * 2 + 1] * 0.6 + cy * 0.4]);
    let hit = false;
    for (const [x, y] of pts) { for (const o of G.get(key(Math.floor(x / C), Math.floor(y / C))) || []) if (inside(o, x, y)) { hit = true; break; } if (hit) break; }
    if (hit) continue;
    const wx = cx + ox, wy = cy + oy;
    if (B3D_SKIP.some(q => Math.hypot(wx - q[0], wy - q[1]) < q[2] + 15) || skipped(wx, wy)) continue;
    out.push(f);
  }
  return out;
}
export class TileManager {
  constructor(scene, world, opts = {}) {
    this.scene = scene; this.world = world; this.TS = world.ts;
    this.index = new Set(world.tiles.map(t => t[0] + '_' + t[1]));
    this.tiles = new Map(); this.queue = []; this.loading = 0;
    DECKS.abs = world.decks === 2; B3D.on = !!world.b3d; S2.on = !!world.s2; if (world.s2) S2.rg = world.s2.rg; if (world.b3d && typeof world.b3d === 'object') { B3D.pack = world.b3d.pack || 8; B3D.gz = !!world.b3d.gz; }
    this.radius = opts.radius ?? 2; this.base = opts.base || 'data/t/';
    this.onTile = opts.onTile || (() => {}); this.meshes = opts.meshes ?? true;
  }
  key(ix, iy) { return ix + '_' + iy; }
  // full tiles within `radius` of you (and of where you will be in a few seconds), a lighter ring of
  // buildings and roads beyond that so the city in the distance is already there when you arrive
  update(px, py, vx = 0, vy = 0) {
    const TS = this.TS, R = this.radius, F = this.far ?? 1, ix = Math.floor(px / TS), iy = Math.floor(py / TS);
    const ax = Math.floor((px + vx * 7) / TS), ay = Math.floor((py + vy * 7) / TS);      // ~7 s ahead
    const want = new Map();
    const ask = (cx, cy, r, full, w0) => {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const k = this.key(cx + dx, cy + dy); if (!this.index.has(k)) continue;
        const d = w0 + dx * dx + dy * dy, cur = want.get(k);
        if (!cur || (full && !cur[3]) || (full === cur[3] && d < cur[0])) want.set(k, [d, cx + dx, cy + dy, full]);
      }
    };
    ask(ix, iy, R + F, false, 40); ask(ix, iy, R, true, 0);
    if (ax !== ix || ay !== iy) ask(ax, ay, Math.max(1, R - 1), true, 2);
    const todo = [];
    for (const [k, [d, x, y, full]] of want) {
      const t = this.tiles.get(k);
      if (!t) todo.push([d, x, y, k, full]);
      else if (full && t.lite && t.group && !t.upgrading) todo.push([d, x, y, k, true]);
    }
    todo.sort((a, b) => a[0] - b[0]);
    for (const [, x, y, k, full] of todo) { if (this.loading >= 6) break; this.load(x, y, k, !full); }
    for (const [k, t] of this.tiles) {
      if (!t.group) continue;
      const far = Math.max(Math.abs(t.ix - ix), Math.abs(t.iy - iy)), nearAhead = Math.max(Math.abs(t.ix - ax), Math.abs(t.iy - ay)) <= R;
      if (far > R + F + 1 && !nearAhead) this.unload(k);
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
      if (this.packs.size > 16) this.packs.delete(this.packs.keys().next().value);
      p.catch(() => this.packs.delete(pk));
    }
    return p;
  }
  async load(ix, iy, k, lite = false) {
    const old = this.tiles.get(k);
    if (old) old.upgrading = true; else this.tiles.set(k, { ix, iy, group: null });
    this.loading++;
    try {
      const pack = await this.getPack(ix, iy);
      const e = pack.idx[k]; if (!e) throw new Error('missing tile ' + k);
      const buf = pack.buf.slice(pack.base + e[0], pack.base + e[0] + e[1]);
      const bbuf = B3D.on ? await b3dBlob(ix, iy) : null;
      const t = this.tiles.get(k); if (!t) return;
      // geometry building is spread over frames by the caller (pending queue); nearest first
      this.queue.push({ k, ix, iy, buf, lite, bbuf });
    } catch (e) { console.warn('tile', k, e); if (!old) this.tiles.delete(k); else old.upgrading = false; }
    finally { this.loading--; }
  }
  // build tiles for up to `ms` milliseconds (at least one), nearest to you first
  pumpFor(ms, px, py) {
    const t0 = performance.now();
    if (!this.gen && this.queue.length > 1 && px != null) {
      const TS = this.TS, d = j => (j.lite ? 1e9 : 0) + Math.hypot((j.ix + 0.5) * TS - px, (j.iy + 0.5) * TS - py);
      this.queue.sort((a, b) => d(a) - d(b));
    }
    let n = 0;
    while ((this.queue.length || this.gen) && (n === 0 || performance.now() - t0 < ms)) { this.pump(); n++; }
    return n;
  }
  // build at most one tile per call (keeps frames smooth); a tile that fails to build is dropped so it loads again
  // a tile is built in a few steps over several frames (ground, roads, 3D buildings, footprints), so no single frame
  // stalls on a whole tile (that was the stutter when driving into new streets, worst on phones)
  pump() {
    const job = this.gen ? this.genJob : this.queue[0];
    try { return this.pumpStep(); }
    catch (e) { this.gen = null; console.warn('tile build', job && job.k, e); if (job) { const t = this.tiles.get(job.k); if (t && !t.group) this.tiles.delete(job.k); else if (t) t.upgrading = false; } return true; }
  }
  pumpStep() {
    if (!this.gen) { const job = this.queue.shift(); if (!job) return false; this.genJob = job; this.gen = this.buildTile(job); }
    if (this.genJob.lite) { while (!this.gen.next().done); this.gen = null; return true; }      // far tiles are light: one go
    if (this.gen.next().done) this.gen = null;
    return true;
  }
  pumpOne() { do { if (!this.pumpStep()) return false; } while (this.gen); return true; }      // a whole tile at once
  *buildTile(job) {
    let t = this.tiles.get(job.k); if (!t) return true;
    const entry = t;
    const lite = job.lite, prev = t.group ? t : null;
    if (prev) { if (!prev.upgrading || lite) return true; t = { ix: job.ix, iy: job.iy, group: null }; }      // a lighter tile becoming a full one
    const ox = job.ix * this.TS, oy = job.iy * this.TS;
    const layers = parseTile(job.buf, ox, oy);
    TER.ox = ox; TER.oy = oy;
    const g = new THREE.Group(); g.position.set(ox, 0, -oy); g.name = 'tile ' + job.k;
    // between steps: the tile may have been unloaded meanwhile (then drop the half-built one), and other code may have moved TER
    const gone = () => { if (this.tiles.get(job.k) === entry) { TER.ox = ox; TER.oy = oy; return false; } g.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); return true; };
    if (this.meshes && TER.on) {
      const gg = groundGrid(this.TS, lite ? 25 : 12.5);
      if (gg) {
        let mat = MAT.base;
        if (S2.on) {       // the real ground colours from the satellite, with the fine texture on top
          const rx = Math.floor(ox / S2.rg), ry = Math.floor(oy / S2.rg), uv = gg.attributes.position, U = gg.attributes.uv;
          for (let i = 0; i < uv.count; i++) U.setXY(i, (ox + uv.getX(i) - rx * S2.rg) / S2.rg, (oy - uv.getZ(i) - ry * S2.rg) / S2.rg);
          mat = s2Material(rx, ry, !lite);      // up close: half lawn green, half satellite, so yards stay green
        }
        const m = new THREE.Mesh(gg, mat); m.receiveShadow = !lite; g.add(m);
      }
    }
    const M = this.meshes, D = M && !lite;       // D: street furniture and details, only on full tiles
    const add = (geo, mat, opts = {}) => { if (!geo || !M) return null; const m = new THREE.Mesh(geo, mat); m.receiveShadow = opts.rs ?? true; m.castShadow = opts.cs ?? false; if (opts.ro != null) m.renderOrder = opts.ro; g.add(m); return m; };
    // ground cover
    if (M && layers[L.AREA]) add(buildFlat(layers[L.AREA].sort((a, b) => a.flags - b.flags), f => AREA_COL[f.kind], f => AREA_Y(f.kind)), MAT.ground, { ro: 1 });
    if (M && layers[L.WATER]) add(buildFlat(layers[L.WATER], () => 0x5d8fb8, () => 0.08), MAT.water, { ro: 2 });
    if (M && layers[L.WWAY]) add(buildRibbons(layers[L.WWAY], 0.085, f => f.a / 10, 0x5d8fb8), MAT.waterFlat, { ro: 2 });
    yield; if (gone()) return;
    // paths and roads
    if (M && layers[L.PATH]) add(buildRibbons(layers[L.PATH].filter(f => !(f.flags & 4)), f => (f.flags & 8) ? 0.13 : 0.11, f => f.kind === 5 ? 3 : (f.kind === 2 ? 5 : 2.2)), MAT.path, { ro: 3 });
    if (M && layers[L.RAIL]) add(buildRibbons(layers[L.RAIL].filter(f => !(f.flags & 4)), 0.17, f => 3.0, 0xffffff, 4), MAT.rail, { ro: 5 });
    const roadW = f => f.a / 10, pathW = f => f.kind === 5 ? 3 : (f.kind === 2 ? 5 : 2.2), railW = () => 3.0;
    const roads = (layers[L.ROAD] || []).filter(f => !(f.flags & 4));
    const ridx = pavementIndex(roads), rails = railStore(); t.rails = rails; t.pave = ridx;
    if (M) {
      const raised = ls => (ls || []).filter(f => !(f.flags & 4) && f.rings[0].z);
      const deck = buildDecks([...raised(layers[L.ROAD]).map(f => ({ ...f, w: roadW(f) })), ...raised(layers[L.PATH]).map(f => ({ ...f, w: pathW(f) })), ...raised(layers[L.RAIL]).map(f => ({ ...f, w: 3.2 }))], f => f.w, true, ridx, rails);
      add(deck, MAT.concrete, { cs: true });
      if (D) {
        for (const im of buildTrees(layers[L.TREE])) g.add(im);
        for (const im of buildStreetLights(layers[L.ROAD])) g.add(im);
        for (const im of buildSpeedSigns(layers[L.ROAD])) g.add(im);
      }
      add(buildGuardrails(layers[L.ROAD], ridx, rails), MAT.guardrail, { cs: !lite });
    }
    yield; if (gone()) return;
    t.surf = buildSurfaces([[layers[L.ROAD] || [], roadW, 1], [layers[L.PATH] || [], pathW, 2], [layers[L.RAIL] || [], railW, 3]]);
    const byTex = {};
    for (const r of roads) (byTex[ROAD_TEX(r.kind)] ||= []).push(r);
    if (M) for (const [tx, list] of Object.entries(byTex)) add(buildRibbons(list, f => ROAD_Y[f.kind] || 0.15, f => f.a / 10), MAT.road[tx], { ro: 4 });
    if (D) {      // sidewalks both sides of city streets
      const sw = roads.filter(f => [3, 4, 5, 6].includes(f.kind) && !f.rings[0].z);      // sidewalks along main roads, collectors and residential streets
      add(buildCurbs(roads, ridx, layers[L.RAIL]), MAT.concrete, { ro: 4 });
      add(buildRibbons(sw, 0.13, () => 1.8, 0xffffff, 4, f => f.a / 20 + 1.1), MAT.sidewalk, { ro: 2 });
      add(buildRibbons(sw, 0.13, () => 1.8, 0xffffff, 4, f => -(f.a / 20 + 1.1)), MAT.sidewalk, { ro: 2 });
    }
    yield; if (gone()) return;
    // buildings
    let coll = null;
    if (M && job.bbuf) {      // the City's 3D buildings: real roofs and heights
      const { geos, walls, outlines, cwalls, hgrid, cands } = buildB3D(job.bbuf, true, gl, { ox, oy, swap: D });
      t.walls3d = walls; t.roofs3d = outlines; t.hgrid = hgrid;
      coll = buildSegCollision(cwalls);
      const cs = !lite;
      for (let i = 0; i < 4; i++) add(geos['house' + i], MAT.wallHouses[i], { cs });
      for (let i = 0; i < 4; i++) { const m = add(geos['shouse' + i], MAT.wallHousesSwap[i], { cs }); if (m) m.customDepthMaterial = MAT.swapDepth; }
      { const m = add(geos.sroof, MAT.roofSwap, { cs }); if (m) m.customDepthMaterial = MAT.swapDepth; }
      if (cands && cands.length) { t.hcands = [cands, roadIndex(layers[L.ROAD]), g, ox, oy]; if (HOUSES.place) t.houses = HOUSES.place(...t.hcands); }
      for (const [k, mt] of [['apt', MAT.wallApt], ['comm', MAT.wallComm], ['shop', MAT.wallShop], ['tower', MAT.wallTower]]) { const m = add(geos[k], mt, { cs }); if (m) m.userData.bld = 1; } add(geos.roof, MAT.roof, { cs });
    }
    yield; if (gone()) return;
    if (layers[L.BLD]) {
      const footOnly = !M || !!job.bbuf;
      // the City's 3D buildings are a few years old: newer homes (whole streets in new communities) are only in the
      // map's footprints, so any footprint with no 3D building on it is built from the footprint
      let fill = null;
      // the camera is only pulled in by walls that are drawn (footprints hidden under 3D models used to block it out of thin air)
      t.camBld = footOnly ? [] : layers[L.BLD];
      if (footOnly && job.bbuf && t.roofs3d) {
        fill = missingFootprints(layers[L.BLD], t.roofs3d, ox, oy); t.camBld = fill;
        if (fill.length) fill = buildBuildings(fill, true, layers[L.ROAD]); else fill = null;
      }
      const { geos, coll: rings } = !footOnly ? buildBuildings(layers[L.BLD], true, layers[L.ROAD]) : fill ? { geos: fill.geos, coll: fill.coll } : { geos: {}, coll: [] };
      const cs = !lite;
      for (let i = 0; i < 4; i++) add(geos['house' + i], MAT.wallHouses[i], { cs });
      for (const [k, mt] of [['apt', MAT.wallApt], ['comm', MAT.wallComm], ['shop', MAT.wallShop], ['tower', MAT.wallTower]]) { const m = add(geos[k], mt, { cs }); if (m) m.userData.bld = 1; } add(geos.roof, MAT.roof, { cs }); add(geos.trim, MAT.concrete, { cs }); if (D) { add(geos.doors, MAT.doors); add(geos.drive, MAT.drive, { ro: 2 }); }
      if (!job.bbuf) coll = buildCollision(rings);          // with the City's 3D buildings, their real walls are the obstacles
      else if (fill && rings.length) { const extra = buildCollision(rings); if (coll) { for (const [k, l] of extra.grid) { const c = coll.grid.get(k); if (c) c.push(...l); else coll.grid.set(k, l); } } else coll = extra; }
    }
    yield; if (gone()) return;
    if (layers[L.TREE]) {        // tree trunks block cars and people
      const tr = layers[L.TREE].map(f => { const x = f.rings[0][0], y = f.rings[0][1], s2 = 0.35; return [[x - s2, y - s2], [x + s2, y - s2], [x + s2, y + s2], [x - s2, y + s2]]; });
      if (coll) { const extra = buildCollision(tr); for (const [k, l] of extra.grid) { const c = coll.grid.get(k); if (c) c.push(...l); else coll.grid.set(k, l); } }
      else coll = buildCollision(tr);
    }
    this.scene.add(g);
    t.group = g; t.layers = layers; t.coll = coll; t.ox = ox; t.oy = oy; t.lite = lite;
    if (prev) { this.scene.remove(prev.group); prev.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); if (prev.houses && HOUSES.drop) HOUSES.drop(prev.houses); }
    this.tiles.set(job.k, t);
    if (!lite) this.onTile(t, true);
    return true;
  }
  unload(k) {
    const t = this.tiles.get(k); if (!t) return;
    if (t.group) { this.scene.remove(t.group); t.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); if (!t.lite) this.onTile(t, false); }
    if (t.houses && HOUSES.drop) HOUSES.drop(t.houses);
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
  // the tile under (x, y) and the neighbours whose road pieces can reach here (a piece runs up to ~75 m past its tile)
  tilesNear(x, y, m = 80) {
    const TS = this.TS, ix = Math.floor(x / TS), iy = Math.floor(y / TS), lx = x - ix * TS, ly = y - iy * TS;
    const dxs = [0], dys = [0]; if (lx < m) dxs.push(-1); if (lx > TS - m) dxs.push(1); if (ly < m) dys.push(-1); if (ly > TS - m) dys.push(1);
    const out = [];
    for (const dx of dxs) for (const dy of dys) { const t = this.tiles.get(this.key(ix + dx, iy + dy)); if (t) out.push(t); }
    return out;
  }
  // guardrails and bridge railings: the first one crossed going from (ax, ay) to (bx, by) at height z, as its unit direction, or null
  railHit(ax, ay, bx, by, z) {
    for (const t of this.tilesNear(bx, by)) { if (!t.rails) continue; const h = this.railHitIn(t, ax, ay, bx, by, z); if (h) return h; }
    return null;
  }
  railHitIn(t, ax, ay, bx, by, z) {
    const R = t.rails, lax = ax - t.ox, lay = ay - t.oy, lbx = bx - t.ox, lby = by - t.oy;
    const k0 = Math.floor(Math.min(lax, lbx) / R.cell), k1 = Math.floor(Math.max(lax, lbx) / R.cell), j0 = Math.floor(Math.min(lay, lby) / R.cell), j1 = Math.floor(Math.max(lay, lby) / R.cell);
    const mx = lbx - lax, my = lby - lay;
    for (let cx = k0; cx <= k1; cx++) for (let cy = j0; cy <= j1; cy++) {
      const l = R.grid.get(cx * 100000 + cy); if (!l) continue;
      for (const s of l) {
        const ex = s[3] - s[0], ey = s[4] - s[1], den = mx * ey - my * ex; if (Math.abs(den) < 1e-9) continue;
        const u = ((s[0] - lax) * ey - (s[1] - lay) * ex) / den, w = ((s[0] - lax) * my - (s[1] - lay) * mx) / den;
        if (u < 0 || u > 1 || w < 0 || w > 1) continue;
        const rz = s[2] + (s[5] - s[2]) * w; if (z < rz - 1.2 || z > rz + 0.9) continue;
        const el = Math.hypot(ex, ey) || 1; return [ex / el, ey / el];
      }
    }
    return null;
  }
  // height of the surface under (x, y) you can reach from height cur: the ground, or a bridge / ramp / overpass deck
  // only: 1 roads, 2 paths, 3 rail (trains stay on their own decks)
  surfaceAt(x, y, cur = 0, step = 1.3, only = 0, lift = false) {
    const g0 = ground(x, y); let best = g0;
    for (const t of this.tilesNear(x, y)) {
      if (!t || !t.surf) continue;
      const lx = x - t.ox, ly = y - t.oy, S = t.surf, l = S.grid.get(Math.floor(lx / S.cell) * 100000 + Math.floor(ly / S.cell));
      if (!l) continue;
      for (const s of l) {
        if (only && s[7] !== only) continue;
        const dx = s[3] - s[0], dy = s[4] - s[1], L2 = dx * dx + dy * dy || 1e-9;
        let u = ((lx - s[0]) * dx + (ly - s[1]) * dy) / L2; if (u < -0.02 || u > 1.02) continue; u = Math.max(0, Math.min(1, u));
        if (Math.hypot(lx - s[0] - dx * u, ly - s[1] - dy * u) > s[6]) continue;
        const z = s[2] + (s[5] - s[2]) * u;
        if (z <= cur + step && z > best) best = z;
      }
    }
    if (!only) for (const P of PLATFORMS) {
      const dx = x - P.x, dy = y - P.y; if (Math.abs(dx) > P.hl + P.hw || Math.abs(dy) > P.hl + P.hw) continue;
      if (Math.abs(dx * P.fx + dy * P.fy) <= P.hl && Math.abs(dx * P.fy - dy * P.fx) <= P.hw && P.top <= cur + Math.max(step, 1.35) && P.top > best) best = P.top;      // you can always step up onto a platform
    }
    // up on a roof (out of the helicopter, off a tower): stand on it
    if (!only && cur - g0 > 1.5) { const r = this.roofAt(x, y); if (r != null && r <= cur + Math.max(step, 0.6) && r > best) best = r; }
    if (lift && best === g0) for (const t of this.tilesNear(x, y, 40)) { if (!t.pave) continue; const l = t.pave.lift(x - t.ox, y - t.oy); if (l) return g0 + l; }
    return best;
  }
  // buildings between two points (for the camera): the fraction along the line where the first wall is hit, or 1
  rayHit(x0, y0, x1, y1) {
    let tMin = 1; const seen = new Set();
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      const t = this.tileAt(x, y); if (!t || seen.has(t)) continue; seen.add(t);
      const ax = x0 - t.ox, ay = y0 - t.oy, bx = x1 - t.ox, by = y1 - t.oy, mnx = Math.min(ax, bx) - 1, mxx = Math.max(ax, bx) + 1, mny = Math.min(ay, by) - 1, mxy = Math.max(ay, by) + 1;
      for (const f of t.camBld || []) {
        if (f.a < 30) continue;                     // low sheds and fences don't block the view
        const r = f.rings[0], n = r.length / 2;
        let inBox = false; for (let i = 0; i < n; i++) { const px = r[i * 2], py = r[i * 2 + 1]; if (px > mnx - 40 && px < mxx + 40 && py > mny - 40 && py < mxy + 40) { inBox = true; break; } }
        if (!inBox) continue;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, cx = r[i * 2], cy = r[i * 2 + 1], dx = r[j * 2] - cx, dy = r[j * 2 + 1] - cy, ex = bx - ax, ey = by - ay;
          const den = ex * dy - ey * dx; if (Math.abs(den) < 1e-9) continue;
          const tt = ((cx - ax) * dy - (cy - ay) * dx) / den, uu = ((cx - ax) * ey - (cy - ay) * ex) / den;
          if (tt > 0 && tt < tMin && uu >= 0 && uu <= 1) tMin = tt;
        }
      }
      // the 3D models' walls stand at the roof edge (eaves), a little outside the footprints
      if (t.walls3d) for (const w of t.walls3d) {
        const cx = w[0], cy = w[1], dx = w[2] - cx, dy = w[3] - cy;
        if (Math.max(cx, w[2]) < mnx || Math.min(cx, w[2]) > mxx || Math.max(cy, w[3]) < mny || Math.min(cy, w[3]) > mxy) continue;
        const ex = bx - ax, ey = by - ay, den = ex * dy - ey * dx; if (Math.abs(den) < 1e-9) continue;
        const tt = ((cx - ax) * dy - (cy - ay) * dx) / den, uu = ((cx - ax) * ey - (cy - ay) * ex) / den;
        if (tt > 0 && tt < tMin && uu >= 0 && uu <= 1) tMin = tt;
      }
    }
    return tMin;
  }
  // the roof height of the building at (x, y), or null (helicopters land on roofs)
  // ---------------------------------------------------------------- never stuck: spots a person (or car) can stand on and leave
  // inside a building: a roof is over this spot, well above the ground (and above whoever stands there)
  insideBuilding(x, y, gy = ground(x, y)) { const r = this.roofAt(x, y); return r != null && r > gy + 2.2 && gy < ground(x, y) + 3 && this.inFootprint(x, y); }
  // inside the walls of a building that stands on the ground (canopies, overhangs and skywalks have no walls down to the street)
  inFootprint(x, y) {
    let any = false;
    for (const t of this.tilesNear(x, y, 60)) {
      if (!t.roofs3d) continue; any = true; const lx = x - t.ox, ly = y - t.oy;
      for (const o of t.roofs3d) {
        if (lx < o.mnx || lx > o.mxx || ly < o.mny || ly > o.mxy) continue;
        let c = 0; const E = o.E;
        for (let i = 0; i < E.length; i += 4) { const ay = E[i + 1], by = E[i + 3]; if ((ay > ly) !== (by > ly) && lx < E[i] + (ly - ay) / (by - ay) * (E[i + 2] - E[i])) c++; }
        if (c & 1) return true;
      }
    }
    return !any;          // no outlines here (older tiles): trust the roof alone
  }
  // the buildings around this spot have loaded (so a check here means something)
  readyAt(x, y) { const t = this.tileAt(x, y); return !!(t && t.coll && (t.hgrid || t.layers)); }
  standable(x, y, r = 0.45) { return !this.insideBuilding(x, y) && !this.collide(x, y, r).hit; }
  // can you walk from (x, y) to somewhere `need` metres away? (a flood fill on a 0.8 m grid, so no wall slips between two cells)
  reaches(x, y, r = 0.45, need = 24, cap = 3500, roofs = true) {
    const S = 0.8, seen = new Set(['0,0']), q = [[0, 0]];
    for (let h = 0; h < q.length && seen.size < cap; h++) {
      const [i, j] = q[h];
      if (Math.hypot(i * S, j * S) >= need) return true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (i + di) + ',' + (j + dj); if (seen.has(k)) continue; seen.add(k);
        const qx = x + (i + di) * S, qy = y + (j + dj) * S;
        if (roofs ? this.standable(qx, qy, r) : !this.collide(qx, qy, r).hit) q.push([i + di, j + dj]);
      }
    }
    return seen.size >= cap;            // a very big open area counts as free
  }
  // the nearest spot to (x, y) that is outside buildings, clear of walls and not boxed in; `pref` = the way you were heading
  paveAt(x, y) { const t = this.tileAt(x, y); return t && t.pave ? t.pave.lift(x - t.ox, y - t.oy) : 0; }
  safeSpot(x, y, { r = 0.45, pref = null, maxR = 120, street = true, car = false } = {}) {
    if (this.standable(x, y, r) && this.reaches(x, y, r)) return { x, y, moved: false };
    // first look for a sidewalk (or, failing that, the edge of a street) close by; then for any open ground
    const passes = car ? [[l => l >= 0.14, 45], [() => true, maxR]] : street ? [[l => l > 0.1 && l < 0.14, 45], [l => l > 0, 45], [() => true, maxR]] : [[() => true, maxR]];
    for (const [want, lim] of passes) {
      for (let rad = 1; rad <= lim; rad += rad < 10 ? 1 : 2) {
        const n = Math.max(8, Math.round(rad * 2)), c = [];
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, px = x + Math.sin(a) * rad, py = y + Math.cos(a) * rad;
          if (!want(this.paveAt(px, py)) || !this.standable(px, py, r + 0.15)) continue;
          let d = 0; if (pref != null) { d = Math.abs(((a - pref) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); }
          c.push([d, px, py]);
        }
        c.sort((a, b) => a[0] - b[0]);
        for (const [, px, py] of c.slice(0, 6)) if (this.reaches(px, py, r)) return { x: px, y: py, moved: true };
      }
    }
    return { x, y, moved: false };
  }
  // the highest roof at (x, y): the City's buildings and the landmark models (towers, the Saddledome...)
  roofAt(x, y) {
    const a = this.roofAt0(x, y), b = ROOF_EXTRA.fn ? ROOF_EXTRA.fn(x, y) : null;
    return a == null ? b : b == null ? a : Math.max(a, b);
  }
  roofAt0(x, y) {
    // the City's 3D buildings: the highest roof triangle over (x, y), from each tile's 2.5 m roof grid
    let best = -1e9, any = false;
    for (const t of this.tilesNear(x, y, 60)) {
      const H = t.hgrid; if (!H) continue; any = true;
      const i = Math.floor((x - t.ox - H.o) / H.c), j = Math.floor((y - t.oy - H.o) / H.c);
      if (i < 0 || j < 0 || i >= H.n || j >= H.n) continue;
      const z = H.h[i * H.n + j]; if (z > best) best = z;
    }
    if (any) return best > -1e8 ? best : null;
    // without them: the footprint the point is in
    const t = this.tileAt(x, y); if (!t || !t.layers || !t.layers[L.BLD]) return null;
    const lx = x - t.ox, ly = y - t.oy;
    for (const f of t.layers[L.BLD]) {
      const r = f.rings[0], n = r.length / 2; let ins = false;
      for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1]; if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi + 1e-12) + xi) ins = !ins; }
      if (ins) return ground(x, y) + Math.max(2.5, f.a / 10);
    }
    return null;
  }
  outside(x, y) {
    const t = this.tileAt(x, y); if (!t || !t.layers || !t.layers[L.BLD] || t.hgrid) return null;
    const lx = x - t.ox, ly = y - t.oy;
    for (const f of t.layers[L.BLD]) {
      const r = f.rings[0], n = r.length / 2; let ins = false;
      for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1]; if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi + 1e-12) + xi) ins = !ins; }
      if (!ins) continue;
      let best = null, bd = 1e9;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, ax = r[i * 2], ay = r[i * 2 + 1], ex = r[j * 2] - ax, ey = r[j * 2 + 1] - ay, L2 = ex * ex + ey * ey || 1; const u = Math.max(0, Math.min(1, ((lx - ax) * ex + (ly - ay) * ey) / L2)), px = ax + ex * u, py = ay + ey * u, d = Math.hypot(lx - px, ly - py); if (d < bd) { bd = d; best = [px, py]; } }
      if (best) { const dx = best[0] - lx, dy = best[1] - ly, l = Math.hypot(dx, dy) || 1; return { x: best[0] + dx / l * 0.9 + t.ox, y: best[1] + dy / l * 0.9 + t.oy }; }
    }
    return null;
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
