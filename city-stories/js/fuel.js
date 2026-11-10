// Gas stations: a canopy on columns with pump islands in front of every fuel station on the map (OpenStreetMap
// fuel stations), turned to face the nearest street. Built with the map tile and removed with it.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { L, roadIndex } from './tiles.js';
import { ground } from './terrain.js';

const FUEL = 15;
let MAT = null, LIGHT = null;
function mats() {
  if (MAT) return;
  MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
  LIGHT = new THREE.MeshBasicMaterial({ color: 0xf4f6ff });
}
function box(w, h, d, x, y, z, col) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const CANOPY = [0xc8102e, 0x1f5fa8, 0x2f8f5a, 0xe0a020, 0xf2f2f2];
// one station's canopy and pumps, in its own frame: +z toward the street
function station(seed) {
  const G = [], col = CANOPY[seed % CANOPY.length], W = 18, D = 10, H = 5.2;
  G.push(box(W, 0.7, D, 0, H, 0, 0xf4f4f2));                    // canopy slab
  G.push(box(W + 0.1, 0.45, D + 0.1, 0, H + 0.15, 0, col));      // coloured fascia band
  for (const x of [-W / 2 + 2.5, W / 2 - 2.5]) for (const z of [-2.2, 2.2]) G.push(box(0.45, H, 0.45, x, 0, z, 0xdedcd6));
  for (const x of [-W / 2 + 4, 0, W / 2 - 4]) {                 // pump islands
    G.push(box(1.3, 0.18, 6.5, x, 0, 0, 0xc9c5bc));
    for (const z of [-1.6, 1.6]) {
      G.push(box(0.75, 1.75, 0.5, x, 0.18, z, 0xf2f2ee));
      G.push(box(0.78, 0.35, 0.53, x, 1.6, z, col));
      G.push(box(0.5, 0.35, 0.05, x, 1.0, z + 0.27, 0x1b2a36));       // the screen
      G.push(box(0.5, 0.35, 0.05, x, 1.0, z - 0.27, 0x1b2a36));
      G.push(box(0.12, 0.5, 0.12, x + 0.45, 0.7, z, 0x222222));       // the nozzle holster
    }
  }
  G.push(box(W + 4, 0.06, D + 6, 0, 0, 0, 0x5d5d5a));            // the paved forecourt
  return mergeGeometries(G);
}
// for a newly built map tile: the fuel stations on it
export function buildFuel(t, tiles) {
  const P = t.layers && t.layers[L.POI]; if (!P || !t.group) return;
  const pts = P.filter(f => f.kind === FUEL); if (!pts.length) return;
  mats();
  const near = roadIndex(t.layers[L.ROAD]);
  for (const f of pts) {
    const r = f.rings[0], x = r[0], y = r[1], rp = near(x, y, 70);
    let hx = 0, hy = 1; if (rp) { const dx = rp[0] - x, dy = rp[1] - y, d = Math.hypot(dx, dy) || 1; hx = dx / d; hy = dy / d; }
    // between the shop and the street, on open ground: step out from the shop until the canopy's corners are clear
    const clear = (cx, cy, h) => { if (!tiles) return true; const fx = Math.sin(h), fy = Math.cos(h); for (const [a, b] of [[0, 0], [9, 5], [-9, 5], [9, -5], [-9, -5], [0, 6], [0, -6]]) { const px = cx + t.ox + fy * a + fx * b, py = cy + t.oy - fx * a + fy * b; if (tiles.collide(px, py, 0.8).hit || tiles.insideBuilding(px, py)) return false; } return true; };
    let cx = null, cy = null, h = Math.atan2(hx, hy);
    for (const turn of [0, 0.5, -0.5, Math.PI / 2, -Math.PI / 2]) {
      const a = Math.atan2(hx, hy) + turn, ux = Math.sin(a), uy = Math.cos(a);
      for (let d = 10; d <= 34 && cx == null; d += 2) { const qx = x + ux * d, qy = y + uy * d; if (clear(qx, qy, a)) { cx = qx; cy = qy; h = Math.atan2(hx, hy); } }
      if (cx != null) break;
    }
    if (cx == null) continue;          // no open forecourt found: leave it
    const m = new THREE.Mesh(station(Math.floor(Math.abs(x * 7 + y * 3))), MAT);
    m.position.set(cx, ground(cx + t.ox, cy + t.oy) - 0.02, -cy); m.rotation.y = Math.PI - h;
    m.castShadow = true; m.receiveShadow = true; m.name = 'fuel'; t.group.add(m);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), LIGHT); lamp.rotation.x = Math.PI / 2; lamp.position.y = 5.18; m.add(lamp);
  }
}
