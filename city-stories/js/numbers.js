// House numbers on the front of every building, from the City of Calgary Parcel Address open data.
// Each address gets a small dark plate with white digits on the wall that faces its street.
import * as THREE from 'three';
import { ground } from './terrain.js?v=11111720';
import { buildHalloween, HALLOWEEN } from './halloween.js?v=11111720';

const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-', COLS = 8, ROWS = 5, CW = 64, CHH = 96;
let MAT = null;
function atlas() {
  if (MAT) return MAT;
  const c = document.createElement('canvas'); c.width = COLS * CW; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect((COLS - 1) * CW, (ROWS - 1) * CHH, CW, CHH);          // solid cell (the plate)
  g.font = '700 80px "Segoe UI", Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < CH.length; i++) { const cx = (i % COLS) * CW + CW / 2, cy = Math.floor(i / COLS) * CHH + CHH / 2 + 4; g.fillText(CH[i], cx, cy); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // self-lit (like a porch-lit number), so it reads at night too
  MAT = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return MAT;
}
const cell = i => { const cx = i % COLS, cy = Math.floor(i / COLS); return [cx * CW / (COLS * CW), 1 - (cy + 1) * CHH / 512, (cx + 1) * CW / (COLS * CW), 1 - cy * CHH / 512]; };
const SOLID = (ROWS - 1) * COLS + COLS - 1;

const packs = new Map();
function blob(ix, iy) {
  const pk = Math.floor(ix / 16) + '_' + Math.floor(iy / 16);
  let p = packs.get(pk);
  if (!p) {
    p = fetch('data/a/' + pk + '.wasm').then(r => r.ok ? r.arrayBuffer() : null).then(buf => {
      if (!buf) return null; const dv = new DataView(buf), jl = dv.getUint32(4, true);
      return { buf, base: 8 + jl, idx: JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))) };
    }).catch(() => null);
    packs.set(pk, p); if (packs.size > 6) packs.delete(packs.keys().next().value);
  }
  return p.then(P => { const e = P && P.idx[ix + '_' + iy]; return e ? new DataView(P.buf, P.base + e[0], e[1]) : null; });
}

// walls of a tile: from the 3D buildings if loaded, else the 2D footprints (base = ground, top = height)
function tileWalls(t, gl) {
  // the 3D buildings' walls, plus the newer houses built from the map's footprints (they aren't in the 3D data)
  if (t.walls3d) return t.camBld && t.camBld.length ? t.walls3d.concat(footWalls(t.camBld, gl)) : t.walls3d;
  return footWalls(t.layers && t.layers[1], gl);
}
function footWalls(B, gl) {
  const out = []; if (!B) return out;
  for (const f of B) {
    const r = f.rings[0], n = r.length / 2; if (n < 3) continue;
    let A = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; A += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; }
    const h = Math.max(2.5, f.a / 10), house = f.kind === 1 || f.kind === 18 || f.kind === 19;
    for (let i = 0; i < n; i++) {
      let a = i, b = (i + 1) % n; if (A < 0) [a, b] = [b, a];
      const ax = r[a * 2], ay = r[a * 2 + 1], bx = r[b * 2], by = r[b * 2 + 1]; if (Math.hypot(bx - ax, by - ay) < 1.5) continue;
      const g0 = gl(ax, ay); out.push([ax, ay, bx, by, g0, g0 + h, house ? 1 : 0]);
    }
  }
  return out;
}

export class HouseNumbers {
  constructor(scene, tiles, { radius = 1 } = {}) { this.scene = scene; this.tiles = tiles; this.R = radius; this.built = new Map(); this.t = 0; this.busy = false; }
  update(dt, px, py) {
    this.t -= dt; if (this.t > 0 || this.busy) return; this.t = 0.6;
    const TS = this.tiles.TS, ix = Math.floor(px / TS), iy = Math.floor(py / TS);
    for (const [k, m] of this.built) { const [x, y] = k.split('_').map(Number); if (Math.abs(x - ix) > this.R + 1 || Math.abs(y - iy) > this.R + 1 || !this.tiles.tiles.get(k) || this.tiles.tiles.get(k).group !== m.userData.group) { this.scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.userData.hw) HALLOWEEN.groups.delete(m.userData.hw); this.built.delete(k); } }
    for (let dx = -this.R; dx <= this.R; dx++) for (let dy = -this.R; dy <= this.R; dy++) {
      const k = (ix + dx) + '_' + (iy + dy); if (this.built.has(k)) continue;
      const t = this.tiles.tiles.get(k); if (!t || !t.group || t.lite) continue;
      this.busy = true;
      blob(ix + dx, iy + dy).then(dv => { this.busy = false; if (this.built.has(k) || !dv || this.tiles.tiles.get(k) !== t) { if (!dv) this.built.set(k, new THREE.Object3D()); return; } let m; try { m = this.build(t, dv); } catch (e) { console.error('house numbers', k, e); m = new THREE.Object3D(); } m.userData.group = t.group; this.built.set(k, m); this.scene.add(m); this.t = 0; });
      return;
    }
  }
  build(t, dv) {
    const gl = (x, y) => ground(x + t.ox, y + t.oy);
    const walls = tileWalls(t, gl);
    // 8 m grid of walls
    const grid = new Map(), C = 8;
    walls.forEach((w, i) => { const x0 = Math.floor(Math.min(w[0], w[2]) / C), x1 = Math.floor(Math.max(w[0], w[2]) / C), y0 = Math.floor(Math.min(w[1], w[3]) / C), y1 = Math.floor(Math.max(w[1], w[3]) / C); for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 10000 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); } });
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const quad = (cx, cy, z, ux, uy, nx, ny, w, h, c, rgb) => {     // centre on the wall, along (ux, uy), out (nx, ny)
      const [u0, v0, u1, v1] = cell(c), b = pos.length / 3;
      for (const [s, tt, uu, vv] of [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]]) {
        pos.push(cx + ux * s * w / 2, z + tt * h / 2, -(cy + uy * s * w / 2)); nor.push(nx, 0, -ny); uv.push(uu, vv); col.push(...rgb);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const n = dv.getUint32(4, true); let o = 8;
    const spots = [], lit = new Set();
    for (let i = 0; i < n; i++) {
      const x = dv.getInt16(o, true) / 10, y = dv.getInt16(o + 2, true) / 10, rx = dv.getInt16(o + 4, true) / 10, ry = dv.getInt16(o + 6, true) / 10, len = dv.getUint8(o + 8); o += 9;
      let lab = ''; for (let j = 0; j < len; j++) lab += String.fromCharCode(dv.getUint8(o + j)); o += len;
      lab = lab.toUpperCase();
      let dx = rx - x, dy = ry - y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      // the nearest wall that faces the street (address points sit on the lot, in front of or inside the house)
      let best = null;
      const seen = new Set(), x0 = Math.floor((x - 24) / C), x1 = Math.floor((x + 24) / C), y0 = Math.floor((y - 24) / C), y1 = Math.floor((y + 24) / C);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const l = grid.get(cx * 10000 + cy); if (!l) continue;
        for (const wi of l) {
          if (seen.has(wi)) continue; seen.add(wi);
          const w = walls[wi], ex = w[2] - w[0], ey = w[3] - w[1], el = Math.hypot(ex, ey), nx = ey / el, ny = -ex / el;
          const face = nx * dx + ny * dy; if (face < 0.4) continue;                  // must face the street
          const u = Math.max(0, Math.min(1, ((x - w[0]) * ex + (y - w[1]) * ey) / (el * el)));
          const qx = w[0] + ex * u, qy = w[1] + ey * u, dist = Math.hypot(x - qx, y - qy);
          if (dist > 24) continue;
          const score = dist + (1 - face) * 6;
          if (!best || score < best.score) best = { score, w, u, el, nx, ny, ex: ex / el, ey: ey / el };
        }
      }
      if (!best) continue;
      const { w, nx, ny, ex, ey, el } = best;
      const u = Math.max(Math.min(0.5, 1.2 / el), Math.min(1 - Math.min(0.5, 1.2 / el), best.u));
      const px = w[0] + (w[2] - w[0]) * u + nx * 0.06, py = w[1] + (w[3] - w[1]) * u + ny * 0.06;
      if (w[6]) { spots.push({ x: px, y: py, nx, ny, ex, ey, len: el, u0: u, z0: w[4], z1: lit.has(w) ? 0 : w[5] }); lit.add(w); }
      const z = Math.min(w[4] + (w[6] ? 2.2 : 3.0), w[5] - 0.4); if (z < w[4] + 1) continue;
      // text runs left to right as seen from the street (the wall's own direction, roof on its left)
      const ux = ex, uy = ey, ch = w[6] ? 0.42 : 0.36, cw = ch * 0.6, pw = cw * lab.length + 0.16;      // big enough to read from the street
      quad(px, py, z, ux, uy, nx, ny, pw, ch + 0.14, SOLID, [0.06, 0.08, 0.12]);
      for (let j = 0; j < lab.length; j++) {
        const c = CH.indexOf(lab[j]); if (c < 0) continue;
        const off = (j - (lab.length - 1) / 2) * cw;
        quad(px + ux * off + nx * 0.01, py + uy * off + ny * 0.01, z, ux, uy, nx, ny, cw, ch, c, [1, 1, 1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, atlas()); m.position.set(t.ox, 0, -t.oy); m.name = 'numbers';
    if (spots.length) { const hw = buildHalloween(spots, gl); m.add(hw); m.userData.hw = hw; }
    return m;
  }
}
