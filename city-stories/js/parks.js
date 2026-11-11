// Calgary park furniture and playgrounds, each at its real spot (City of Calgary Parks open data):
// benches, picnic tables, bleachers, playground equipment and its surfacing, drinking fountains,
// washrooms, BBQs, bike stands, flag poles, fire pits, little libraries and park name signs.
import * as THREE from 'three';
import { ground } from './terrain.js?v=11111647';
import { rotY } from './player.js?v=11111647';

let D = null;
export async function loadParks() {
  try {
    const r = await fetch('data/parks.wasm'); if (!r.ok) throw new Error(r.status);
    const txt = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
    D = JSON.parse(txt);
  } catch (e) { console.warn('no park data', e); D = null; }
  return !!D;
}

// ------------------------------------------------------------------ small model kit (one merged mesh per model, vertex colours)
const C = { wood: 0x8a5a33, woodDark: 0x6b4426, metal: 0x2f3438, green: 0x2f6b3a, red: 0xc8322b, yellow: 0xf2b705, blue: 0x2364aa, orange: 0xe8742a,
  purple: 0x6d4a9c, teal: 0x1b8a8a, grey: 0x9a9a96, alu: 0xc9ccce, black: 0x1d1f21, stone: 0x8b8580, concrete: 0xbdb8ae, white: 0xf2f2ee, water: 0x6fb2d6, brown: 0x7a5232 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
class Kit {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  add(geo, colour, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array; _c.set(colour);
    for (let i = 0; i < P.length; i++) { this.pos.push(P[i]); this.nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) this.col.push(_c.r, _c.g, _c.b);
    return this;
  }
  box(w, h, d, colour, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), colour, x, y, z, rx, ry, rz); }
  cyl(r, h, colour, x, y, z, rx, ry, rz, seg = 8) { return this.add(new THREE.CylinderGeometry(r, r, h, seg), colour, x, y, z, rx, ry, rz); }
  // a round bar from point a to point b
  bar(r, a, b, colour, seg = 6) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(r, r, L, seg); g.translate(0, L / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)));
    g.translate(a[0], a[1], a[2]);
    return this.add(g, colour, 0, 0, 0);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); return g;
  }
}

// every model faces +Z (the way someone sitting on it looks)
function bench(back = true, colour = C.wood) {
  const k = new Kit();
  for (const z of [-0.14, 0, 0.14]) k.box(1.8, 0.04, 0.11, colour, 0, 0.45, z);
  if (back) { k.box(1.8, 0.11, 0.035, colour, 0, 0.66, -0.24, -0.25); k.box(1.8, 0.11, 0.035, colour, 0, 0.82, -0.28, -0.25); }
  for (const x of [-0.72, 0.72]) {
    k.box(0.05, 0.44, 0.05, C.metal, x, 0.22, 0.14); k.box(0.05, 0.44, 0.05, C.metal, x, 0.22, -0.16);
    k.box(0.05, 0.05, 0.42, C.metal, x, 0.42, -0.01);
    if (back) k.box(0.05, 0.5, 0.05, C.metal, x, 0.68, -0.27, -0.25);
  }
  return k.build();
}
function picnic(colour = C.wood) {
  const k = new Kit();
  for (const z of [-0.25, -0.08, 0.08, 0.25]) k.box(1.85, 0.045, 0.15, colour, 0, 0.76, z);
  for (const s of [-1, 1]) { k.box(1.85, 0.045, 0.24, colour, 0, 0.45, s * 0.62); k.box(1.4, 0.06, 0.08, C.woodDark, 0, 0.42, s * 0.62); }
  for (const x of [-0.7, 0.7]) {
    k.box(0.08, 0.06, 1.5, C.woodDark, x, 0.42, 0);
    for (const s of [-1, 1]) k.bar(0.04, [x, 0, s * 0.7], [x, 0.74, s * 0.05], C.woodDark);
  }
  return k.build();
}
function bleacher() {
  const k = new Kit();
  for (let i = 0; i < 4; i++) { k.box(4.6, 0.05, 0.3, C.alu, 0, 0.4 + i * 0.4, -i * 0.6); k.box(4.6, 0.25, 0.03, C.grey, 0, 0.25 + i * 0.4, -i * 0.6 + 0.2); }
  for (const x of [-2.1, 0, 2.1]) { k.bar(0.04, [x, 0, 0.1], [x, 1.6, -1.9], C.grey); k.box(0.05, 1.6, 0.05, C.grey, x, 0.8, -1.9); }
  k.box(4.6, 0.04, 0.04, C.grey, 0, 2.3, -2.0); for (const x of [-2.3, 2.3]) k.box(0.04, 0.8, 0.04, C.grey, x, 1.95, -2.0);
  return k.build();
}
function gamesTable() {
  const k = new Kit();
  k.box(0.8, 0.06, 0.8, C.concrete, 0, 0.74, 0); k.cyl(0.12, 0.72, C.concrete, 0, 0.36, 0);
  for (const [x, z] of [[0, 0.75], [0, -0.75], [0.75, 0], [-0.75, 0]]) { k.cyl(0.2, 0.06, C.concrete, x, 0.45, z, 0, 0, 0, 10); k.cyl(0.08, 0.43, C.concrete, x, 0.21, z); }
  return k.build();
}
function adirondack() {
  const k = new Kit();
  k.box(0.65, 0.05, 0.6, C.red, 0, 0.36, 0.05, 0.12); k.box(0.65, 0.75, 0.05, C.red, 0, 0.7, -0.3, -0.35);
  for (const x of [-0.36, 0.36]) { k.box(0.12, 0.04, 0.75, C.red, x, 0.6, 0.05); k.box(0.05, 0.6, 0.05, C.red, x, 0.3, 0.38); k.box(0.05, 0.4, 0.05, C.red, x, 0.2, -0.2); }
  return k.build();
}
// ---- playground
function post(k, x, z, h, colour, r = 0.06) { k.cyl(r, h, colour, x, h / 2, z); }
function swings(n = 2) {
  n = Math.max(2, Math.min(4, n || 2));
  const k = new Kit(), L = 1.0 + n * 1.0, h = 2.5;
  k.cyl(0.06, L, C.blue, 0, h, 0, 0, 0, Math.PI / 2);
  for (const x of [-L / 2, L / 2]) for (const s of [-1, 1]) k.bar(0.05, [x + Math.sign(x) * 0.15, 0, s * 0.9], [x, h, 0], C.green);
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + 1 + i * 1.0 - (n - 1) * 0 ;
    const sx = -((n - 1) * 1.0) / 2 + i * 1.0;
    for (const d of [-0.2, 0.2]) k.box(0.02, h - 0.55, 0.02, C.alu, sx + d, (h + 0.55) / 2, 0);
    k.box(0.5, 0.04, 0.18, C.black, sx, 0.5, 0);
    void x;
  }
  return k.build();
}
function playComplex(seed) {
  const k = new Kit(), pal = [C.red, C.yellow, C.blue, C.green, C.orange, C.purple, C.teal], P = i => pal[(seed + i) % pal.length];
  // two decks on posts, a roof on the high one, a slide, stairs and a bridge
  const decks = [[-1.2, 0, 1.25], [1.3, 0.2, 1.75]];
  for (const [x, z, h] of decks) {
    k.box(1.6, 0.08, 1.6, C.metal, x, h, z);
    for (const [dx, dz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) post(k, x + dx, z + dz, h + 1.2, P(0), 0.06);
    k.box(1.5, 0.6, 0.04, P(2), x, h + 0.4, z - 0.76);                                      // guard panel
  }
  k.add(new THREE.ConeGeometry(1.25, 0.9, 4), P(1), 1.3, 3.4, 0.2, 0, Math.PI / 4, 0);       // roof
  k.box(0.9, 0.06, 1.0, C.alu, 0.05, 1.5, 0.1, 0, 0, -0.2);                                    // bridge between decks
  k.box(0.6, 0.05, 2.9, P(3), 1.3, 0.95, 2.1, 0.6, 0, 0);                                      // straight slide down the front
  for (const s of [-1, 1]) k.box(0.05, 0.22, 2.9, P(3), 1.3 + s * 0.3, 1.05, 2.1, 0.6, 0, 0);
  for (let i = 0; i < 4; i++) k.box(0.8, 0.05, 0.28, C.metal, -1.2, 0.25 + i * 0.25, 1.0 + (3 - i) * 0.25);   // steps
  k.box(0.04, 0.9, 0.9, P(4), -2.0, 1.75, 0);                                                 // play panel
  k.add(new THREE.TorusGeometry(0.28, 0.04, 6, 14), P(5), -2.03, 1.85, 0, 0, Math.PI / 2, 0);
  // a spiral slide off the high deck
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 1.5; k.box(0.55, 0.05, 0.5, P(6), 2.6 + Math.cos(a) * 0.45, 1.65 - i * 0.14, 0.2 - Math.sin(a) * 0.45, 0, a, 0.15); }
  return k.build();
}
function springToy(seed) {
  const k = new Kit(), col = [C.red, C.yellow, C.blue, C.green, C.orange][seed % 5];
  k.cyl(0.12, 0.35, C.metal, 0, 0.18, 0, 0, 0, 0, 10);
  k.add(new THREE.SphereGeometry(0.35, 10, 6), col, 0, 0.62, 0, 0, 0, 0, 1.4, 0.75, 0.85);
  k.add(new THREE.SphereGeometry(0.2, 8, 6), col, 0, 0.92, 0.42);
  k.cyl(0.02, 0.35, C.black, 0, 0.82, 0.25, 0, 0, Math.PI / 2);
  return k.build();
}
function climber(sub, seed) {
  const k = new Kit(), col = [C.blue, C.red, C.green, C.orange][seed % 4];
  if (sub === 3) {                                         // monkey bars
    for (const x of [-1.5, 1.5]) for (const z of [-0.3, 0.3]) post(k, x, z, 2.1, col);
    for (const z of [-0.3, 0.3]) k.cyl(0.04, 3.0, col, 0, 2.1, z, 0, 0, Math.PI / 2);
    for (let i = 0; i < 9; i++) k.cyl(0.025, 0.6, C.alu, -1.2 + i * 0.3, 2.1, 0, Math.PI / 2);
  } else {                                                 // dome climber: arches
    for (let i = 0; i < 4; i++) k.add(new THREE.TorusGeometry(1.3, 0.035, 5, 18, Math.PI), col, 0, 0, 0, 0, i * Math.PI / 4, 0);
    for (const h of [0.5, 0.95]) { const r = Math.sqrt(1.3 * 1.3 - h * h); k.add(new THREE.TorusGeometry(r, 0.03, 5, 22), C.alu, 0, h, 0, Math.PI / 2, 0, 0); }
  }
  return k.build();
}
function panelToy(sub, seed) {
  const k = new Kit(), col = [C.yellow, C.blue, C.red, C.green][seed % 4];
  if (sub === 6) { k.box(1.0, 0.5, 1.6, col, 0, 0.45, 0); k.box(0.9, 0.5, 0.6, C.white, 0, 0.9, -0.3); k.cyl(0.18, 0.04, C.black, 0, 1.0, 0.25, -1.0); for (const [x, z] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]) k.cyl(0.22, 0.12, C.black, x, 0.22, z, 0, 0, Math.PI / 2, 10); }
  else { post(k, -0.65, 0, 1.3, col); post(k, 0.65, 0, 1.3, col); k.box(1.2, 0.8, 0.06, C.white, 0, 0.75, 0); k.add(new THREE.TorusGeometry(0.2, 0.04, 6, 12), [C.red, C.blue][seed % 2], 0, 0.8, 0.05); }
  return k.build();
}
function spinner(sub, seed) {
  const k = new Kit(), col = [C.red, C.blue, C.green, C.yellow][seed % 4];
  if (sub === 4) { k.cyl(1.1, 0.12, col, 0, 0.32, 0, 0, 0, 0, 20); k.cyl(0.05, 0.6, C.metal, 0, 0.6, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.bar(0.03, [Math.cos(a) * 0.15, 0.9, Math.sin(a) * 0.15], [Math.cos(a) * 1.0, 0.38, Math.sin(a) * 1.0], C.alu); } }
  else { k.cyl(0.06, 2.0, col, 0, 1.0, 0); k.cyl(0.35, 0.05, C.black, 0, 0.55, 0, 0, 0, 0, 12); }
  return k.build();
}
function teeter(seed) {
  const k = new Kit(), col = [C.yellow, C.red, C.blue][seed % 3];
  k.box(0.3, 0.45, 0.4, C.metal, 0, 0.22, 0); k.box(0.3, 0.06, 3.2, col, 0, 0.5, 0, 0.12);
  for (const z of [-1.3, 1.3]) { k.box(0.4, 0.06, 0.4, C.black, 0, 0.5 + z * 0.12 + 0.05, z); k.box(0.04, 0.35, 0.04, C.alu, 0, 0.7 + z * 0.12, z - 0.25); k.box(0.4, 0.04, 0.04, C.alu, 0, 0.88 + z * 0.12, z - 0.25); }
  return k.build();
}
function fitness() {
  const k = new Kit();
  for (const x of [-0.8, 0.8]) post(k, x, 0, 2.2, C.green, 0.07);
  k.cyl(0.035, 1.6, C.alu, 0, 2.1, 0, 0, 0, Math.PI / 2); k.cyl(0.035, 1.6, C.alu, 0, 1.1, 0, 0, 0, Math.PI / 2);
  k.box(0.5, 0.06, 0.35, C.black, -0.4, 0.5, 0.3); k.box(0.06, 0.5, 0.06, C.green, -0.4, 0.25, 0.3);
  return k.build();
}
function slide(seed) {
  const k = new Kit(), col = [C.red, C.yellow, C.blue, C.green][seed % 4];
  for (const x of [-0.3, 0.3]) k.bar(0.035, [x, 0, -1.6], [x, 1.5, -1.0], C.alu);
  for (let i = 1; i < 6; i++) k.box(0.6, 0.03, 0.06, C.alu, 0, i * 0.25, -1.6 + i * 0.1);
  k.box(0.7, 0.06, 0.6, C.metal, 0, 1.5, -0.8);
  k.box(0.55, 0.05, 2.6, col, 0, 0.85, 0.45, 0.55, 0, 0); for (const s of [-1, 1]) k.box(0.04, 0.2, 2.6, col, s * 0.28, 0.95, 0.45, 0.55, 0, 0);
  return k.build();
}
function waterToy() {
  const k = new Kit();
  k.cyl(0.1, 3.0, C.blue, 0, 1.5, 0); k.add(new THREE.ConeGeometry(0.5, 0.5, 10, 1, true), C.yellow, 0.4, 3.0, 0, Math.PI, 0, 0);
  k.add(new THREE.TorusGeometry(0.6, 0.05, 6, 16, Math.PI), C.teal, 0, 2.4, 0, 0, 0, 0);
  return k.build();
}
function digger() { const k = new Kit(); k.cyl(0.08, 0.7, C.yellow, 0, 0.35, 0); k.box(0.4, 0.3, 0.4, C.yellow, 0, 0.8, 0); k.bar(0.04, [0, 0.9, 0], [0, 1.0, 1.0], C.yellow); k.bar(0.04, [0, 1.0, 1.0], [0, 0.35, 1.4], C.yellow); k.box(0.3, 0.2, 0.25, C.metal, 0, 0.3, 1.45); k.box(0.35, 0.05, 0.3, C.black, 0, 0.55, -0.35); return k.build(); }
function climbWall(seed) {
  const k = new Kit(); k.box(2.6, 2.3, 0.25, [C.teal, C.blue, C.grey][seed % 3], 0, 1.15, 0, 0.12);
  const pal = [C.red, C.yellow, C.green, C.orange, C.purple];
  for (let i = 0; i < 14; i++) { const h = Math.abs(Math.sin((seed + i) * 12.99)) , u = Math.abs(Math.sin((seed + i) * 7.13)); k.add(new THREE.SphereGeometry(0.08, 5, 4), pal[i % 5], -1.1 + u * 2.2, 0.3 + h * 1.8, 0.16 - (0.3 + h * 1.8) * 0.12); }
  return k.build();
}
function talkTube() { const k = new Kit(); for (const x of [-0.8, 0.8]) { post(k, x, 0, 0.9, C.yellow); k.add(new THREE.ConeGeometry(0.18, 0.3, 10, 1, true), C.blue, x, 1.0, 0.05, -Math.PI / 2); } return k.build(); }
function trackRide() { const k = new Kit(); for (const z of [-6, 6]) { k.bar(0.08, [-0.6, 0, z], [0, 3.0, z], C.green); k.bar(0.08, [0.6, 0, z], [0, 3.0, z], C.green); } k.cyl(0.06, 12, C.alu, 0, 3.0, 0, Math.PI / 2); k.box(0.05, 1.4, 0.05, C.alu, 0, 2.3, -2); k.cyl(0.18, 0.08, C.black, 0, 1.6, -2, 0, 0, 0, 10); return k.build(); }
function logRoll() { const k = new Kit(); k.cyl(0.25, 2.5, C.brown, 0, 0.45, 0, 0, 0, Math.PI / 2, 10); for (const x of [-1.35, 1.35]) { post(k, x, 0, 0.7, C.green); } k.box(2.8, 0.04, 0.04, C.alu, 0, 1.1, -0.35); for (const x of [-1.35, 1.35]) k.box(0.04, 1.1, 0.04, C.alu, x, 0.55, -0.35); return k.build(); }
function parkour() { const k = new Kit(); k.box(1.6, 0.9, 0.3, C.concrete, -1, 0.45, 0); k.box(1.0, 0.6, 1.0, C.concrete, 1, 0.3, 0.5); for (const x of [-1.6, 0.2, 1.8]) post(k, x, -1, 1.2, C.metal, 0.05); k.cyl(0.035, 3.4, C.alu, 0.1, 1.2, -1, 0, 0, Math.PI / 2); return k.build(); }
// ---- other park things
function fountain() { const k = new Kit(); k.cyl(0.22, 0.85, C.grey, 0, 0.42, 0, 0, 0, 0, 10); k.cyl(0.3, 0.12, C.alu, 0, 0.9, 0, 0, 0, 0, 12); return k.build(); }
function washroom() { const k = new Kit(); k.box(4.2, 2.8, 3.2, 0xb79f82, 0, 1.4, 0); k.add(new THREE.ConeGeometry(3.3, 1.0, 4), 0x4a4f55, 0, 3.3, 0, 0, Math.PI / 4, 0, 1, 1, 0.8); for (const x of [-1.0, 1.0]) k.box(0.9, 2.0, 0.05, 0x3f5a6b, x, 1.0, 1.62); return k.build(); }
function decoFountain() { const k = new Kit(); k.cyl(2.2, 0.5, C.stone, 0, 0.25, 0, 0, 0, 0, 24); k.cyl(2.0, 0.06, C.water, 0, 0.45, 0, 0, 0, 0, 24); k.cyl(0.25, 1.2, C.stone, 0, 0.6, 0, 0, 0, 0, 10); k.cyl(0.7, 0.12, C.stone, 0, 1.2, 0, 0, 0, 0, 16); return k.build(); }
function bbq() { const k = new Kit(); k.cyl(0.08, 0.8, C.metal, 0, 0.4, 0); k.box(0.7, 0.25, 0.45, C.black, 0, 0.9, 0); k.box(0.72, 0.04, 0.47, C.grey, 0, 1.03, 0); return k.build(); }
function bikeStand() { const k = new Kit(); for (const x of [-0.9, -0.3, 0.3, 0.9]) k.add(new THREE.TorusGeometry(0.38, 0.03, 5, 12, Math.PI), C.metal, x, 0.05, 0, 0, Math.PI / 2, 0); return k.build(); }
function flagPole() { const k = new Kit(); k.add(new THREE.CylinderGeometry(0.04, 0.08, 9, 8), C.alu, 0, 4.5, 0); k.box(0.02, 0.9, 1.8, C.red, 0, 8.4, 0.92); k.box(0.025, 0.9, 0.9, C.white, 0, 8.4, 0.92); return k.build(); }
function firePit() { const k = new Kit(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.add(new THREE.DodecahedronGeometry(0.2, 0), C.stone, Math.cos(a) * 0.7, 0.15, Math.sin(a) * 0.7); } k.cyl(0.55, 0.05, 0x2a2420, 0, 0.03, 0, 0, 0, 0, 14); return k.build(); }
function library() { const k = new Kit(); k.box(0.1, 1.1, 0.1, C.woodDark, 0, 0.55, 0); k.box(0.6, 0.55, 0.45, C.red, 0, 1.35, 0); k.add(new THREE.ConeGeometry(0.5, 0.3, 4), C.woodDark, 0, 1.78, 0, 0, Math.PI / 4, 0, 1, 1, 0.8); k.box(0.45, 0.4, 0.02, 0x9fc9e0, 0, 1.35, 0.23); return k.build(); }
function pingPong() { const k = new Kit(); k.box(2.74, 0.06, 1.52, 0x2c6e49, 0, 0.76, 0); k.box(0.02, 0.15, 1.6, C.white, 0, 0.86, 0); for (const x of [-1.0, 1.0]) k.box(0.15, 0.72, 1.2, C.concrete, x, 0.36, 0); return k.build(); }
function dogBags() { const k = new Kit(); k.box(0.06, 1.1, 0.06, C.metal, 0, 0.55, 0); k.box(0.25, 0.3, 0.14, C.green, 0, 1.15, 0.05); return k.build(); }
function parkSign() { const k = new Kit(); for (const x of [-1.05, 1.05]) k.box(0.14, 1.4, 0.14, C.woodDark, x, 0.7, 0); k.box(2.3, 0.75, 0.1, C.brown, 0, 1.15, 0); return k.build(); }

// one geometry per (model, variant), made the first time it is needed
const GEO = new Map();
function geo(key, make) { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; }
const SEAT_MAKE = [() => bench(), () => bench(true, C.woodDark), () => picnic(), () => bleacher(), () => gamesTable(), () => adirondack()];
function playKey(t, n, sub, seed) {
  switch (t) {
    case 0: return ['sw' + Math.max(2, Math.min(4, n || 2)), () => swings(n)];
    case 1: return ['pc' + seed % 7, () => playComplex(seed % 7)];
    case 2: return ['sp' + seed % 5, () => springToy(seed % 5)];
    case 3: case 14: return t === 14 ? ['lr', logRoll] : ['cl' + (sub === 3 ? 3 : 0) + (seed % 4), () => climber(sub, seed % 4)];
    case 4: return ['pt' + (sub === 6 ? 6 : 0) + (seed % 4), () => panelToy(sub, seed % 4)];
    case 5: return ['sn' + (sub === 4 ? 4 : 0) + (seed % 4), () => spinner(sub, seed % 4)];
    case 6: return ['tt' + seed % 3, () => teeter(seed % 3)];
    case 7: return ['fi', fitness];
    case 8: return ['sl' + seed % 4, () => slide(seed % 4)];
    case 9: return ['wt', waterToy];
    case 10: return ['dg', digger];
    case 11: return ['cw' + seed % 3, () => climbWall(seed % 3)];
    case 12: return ['tk', talkTube];
    case 13: return ['tr', trackRide];
    case 15: return ['pk', parkour];
  }
  return null;
}
const MISC_MAKE = [fountain, washroom, decoFountain, bbq, bikeStand, flagPole, firePit, library, pingPong, dogBags];
const hash = (x, y) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;

// ------------------------------------------------------------------ placing them near the player
const CELL = 200;
export class ParkAssets {
  constructor(scene, opts = {}) {
    this.scene = scene; this.R = opts.radius ?? 380; this.cells = new Map(); this.built = new Map(); this.t = 0;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.padMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.seats = [];
    if (!D) return;
    const put = (x, y, item) => { const k = Math.floor(x / CELL) + ',' + Math.floor(y / CELL); let c = this.cells.get(k); if (!c) this.cells.set(k, c = { seat: [], play: [], pad: [], misc: [], sign: [] }); c[item[0]].push(item[1]); };
    for (const s of D.seat) put(s[0], s[1], ['seat', s]);
    for (const p of D.pad) { const r = p[2][0]; let sx = 0, sy = 0; for (let i = 0; i < r.length; i += 2) { sx += r[i]; sy += r[i + 1]; } p.cx = sx / (r.length / 2); p.cy = sy / (r.length / 2); put(p.cx, p.cy, ['pad', p]); }
    for (const p of D.play) put(p[0], p[1], ['play', p]);
    for (const m of D.misc) put(m[0], m[1], ['misc', m]);
    for (const s of D.sign) put(s[0], s[1], ['sign', s]);
  }
  // the long axis of a playground's surfacing, so its equipment lines up with it
  padAxis(cell, x, y) {
    for (const p of cell.pad) {
      if (Math.hypot(p.cx - x, p.cy - y) > 40) continue;
      const r = p[2][0]; let inside = false;
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) if ((r[i + 1] > y) !== (r[j + 1] > y) && x < (r[j] - r[i]) * (y - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) inside = !inside;
      if (!inside) continue;
      if (p.axis == null) { let sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < r.length; i += 2) { const dx = r[i] - p.cx, dy = r[i + 1] - p.cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; } p.axis = 0.5 * Math.atan2(2 * sxy, sxx - syy); }
      return p.axis;
    }
    return null;
  }
  buildCell(key, cell) {
    const g = new THREE.Group(); g.name = 'park ' + key;
    const inst = new Map(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const place = (gkey, make, x, y, h, lift = 0) => { const geom = geo(gkey, make); let L = inst.get(gkey); if (!L) inst.set(gkey, L = { geom, list: [] }); L.list.push([x, y, h, lift]); };
    const seats = [];
    for (const s of cell.seat) {
      const [x, y, t, dir] = s, h = dir >= 0 ? dir * Math.PI / 180 : hash(x, y) * Math.PI * 2;
      place('seat' + t, SEAT_MAKE[t], x, y, h);
      if (t === 0 || t === 1 || t === 5) seats.push({ x, y, h, kind: 'bench' }); else if (t === 2) seats.push({ x, y, h, kind: 'table' });
    }
    for (const it of cell.play) {
      const [x, y, t, n, sub] = it, seed = Math.floor(hash(x, y) * 997), pk = playKey(t, n, sub, seed); if (!pk) continue;
      const ax = this.padAxis(cell, x, y);
      const h = ax != null ? Math.PI / 2 - ax + (seed % 2) * Math.PI : hash(y, x) * Math.PI * 2;
      place('play' + pk[0], pk[1], x, y, h);
    }
    for (const it of cell.misc) { const [x, y, t] = it; if (MISC_MAKE[t]) place('misc' + t, MISC_MAKE[t], x, y, hash(x, y) * Math.PI * 2); }
    for (const [gkey, L] of inst) {
      const im = new THREE.InstancedMesh(L.geom, this.mat, L.list.length);
      L.list.forEach(([x, y, h, lift], i) => { im.setMatrixAt(i, m.compose(p.set(x, ground(x, y) + lift, -y), q.setFromAxisAngle(up, rotY(h)), one)); });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; g.add(im);
    }
    // playground surfacing: pea gravel / sand, rubber in fitness and spray parks, with a raised edger
    if (cell.pad.length) {
      const pos = [], nor = [], col = [], idx = [], c = new THREE.Color(), e = [];
      for (const pd of cell.pad) {
        const [t, edge, rings] = pd, base = pos.length / 3;
        const tint = [[0.70, 0.62, 0.50], [0.30, 0.33, 0.36], [0.72, 0.73, 0.71]][t] || [0.7, 0.62, 0.5];
        const outer = [], holes = [];
        rings.forEach((r, ri) => { const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1])); if (pts.length > 2 && pts[0].equals(pts[pts.length - 1])) pts.pop(); (ri ? holes : outer).push(pts); });
        if (!outer[0] || outer[0].length < 3) continue;
        let tris; try { tris = THREE.ShapeUtils.triangulateShape(outer[0], holes); } catch (err) { continue; }
        const all = outer[0].concat(...holes);
        for (const v of all) { const n = 0.92 + hash(v.x, v.y) * 0.12; c.setRGB(tint[0] * n, tint[1] * n, tint[2] * n); pos.push(v.x, ground(v.x, v.y) + 0.1, -v.y); nor.push(0, 1, 0); col.push(c.r, c.g, c.b); }
        for (const tr of tris) { const a = all[tr[0]], b = all[tr[1]], d = all[tr[2]], cr = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x); if (cr >= 0) idx.push(base + tr[0], base + tr[1], base + tr[2]); else idx.push(base + tr[0], base + tr[2], base + tr[1]); }
        if (edge) e.push(outer[0]);
      }
      // edger: a low curb all round
      for (const ring of e) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.08, ny = dx / l * 0.08, base = pos.length / 3;
          const ya = ground(a.x, a.y), yb = ground(b.x, b.y);
          for (const [x, y, z] of [[a.x - nx, ya + 0.2, a.y - ny], [a.x + nx, ya + 0.2, a.y + ny], [b.x + nx, yb + 0.2, b.y + ny], [b.x - nx, yb + 0.2, b.y - ny], [a.x - nx, ya, a.y - ny], [b.x - nx, yb, b.y - ny], [a.x + nx, ya, a.y + ny], [b.x + nx, yb, b.y + ny]]) { pos.push(x, y, -z); nor.push(0, 1, 0); col.push(0.62, 0.6, 0.56); }
          idx.push(base, base + 2, base + 1, base, base + 3, base + 2, base + 4, base + 3, base, base + 4, base + 5, base + 3, base + 6, base + 1, base + 2, base + 6, base + 2, base + 7);
        }
      }
      if (idx.length) {
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        pg.setIndex(idx); pg.computeBoundingSphere();
        const mesh = new THREE.Mesh(pg, this.padMat); mesh.receiveShadow = true; mesh.renderOrder = 3; g.add(mesh);
      }
    }
    // park name signs
    for (const s of cell.sign) {
      const [x, y, text, dir] = s, sg = new THREE.Mesh(geo('sign', parkSign), this.mat);
      const h = dir >= 0 ? dir * Math.PI / 180 : hash(x, y) * Math.PI * 2, gy = ground(x, y);
      sg.position.set(x, gy, -y); sg.rotation.y = rotY(h); sg.castShadow = true; g.add(sg);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const cx = cv.getContext('2d');
      cx.fillStyle = '#5a3a22'; cx.fillRect(0, 0, 512, 160); cx.strokeStyle = '#e8d9b8'; cx.lineWidth = 6; cx.strokeRect(10, 10, 492, 140);
      cx.fillStyle = '#f4ead2'; let fs = 58; cx.font = `700 ${fs}px Georgia, serif`; while (cx.measureText(text).width > 470 && fs > 22) { fs -= 2; cx.font = `700 ${fs}px Georgia, serif`; }
      cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 256, 82);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.68), new THREE.MeshLambertMaterial({ map: tex }));
      for (const side of [1, -1]) { const f = side === 1 ? face : face.clone(); f.position.set(0, 1.15, side * 0.056); if (side < 0) f.rotation.y = Math.PI; sg.add(f); }
      sg.userData.tex = tex;
    }
    this.scene.add(g);
    return { g, seats };
  }
  dispose(b) {
    this.scene.remove(b.g);
    b.g.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh && o.geometry && ![...GEO.values()].includes(o.geometry)) { o.geometry.dispose(); if (o.material !== this.mat && o.material !== this.padMat) { o.material.map?.dispose(); o.material.dispose(); } } });
  }
  update(dt, px, py) {
    if (!D || (this.t -= dt) > 0) return; this.t = 0.5;
    const R = this.R, cx = Math.floor(px / CELL), cy = Math.floor(py / CELL), n = Math.ceil(R / CELL);
    const want = [];                                       // nearest cells first
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const k = (cx + i) + ',' + (cy + j), c = this.cells.get(k);
      if (!c || this.built.has(k)) continue;
      const d = Math.hypot((cx + i + 0.5) * CELL - px, (cy + j + 0.5) * CELL - py);
      if (d <= R + CELL * 0.7) want.push([d, k, c]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, k, c] of want.slice(0, 2)) this.built.set(k, this.buildCell(k, c));
    for (const [k, b] of this.built) {
      const [i, j] = k.split(',').map(Number), mx = (i + 0.5) * CELL, my = (j + 0.5) * CELL;
      if (Math.hypot(mx - px, my - py) > R + CELL * 1.6) { this.dispose(b); this.built.delete(k); }
    }
    this.seats = []; for (const b of this.built.values()) for (const s of b.seats) this.seats.push(s);
  }
  // the nearest bench or picnic-table seat within reach
  seatNear(x, y, reach = 2.2) {
    let best = null, bd = reach;
    for (const s of this.seats) {
      // a picnic table has a seat on each side
      const opts = s.kind === 'table' ? [[0.62, 0], [-0.62, Math.PI]] : [[-0.06, 0]];
      for (const [off, turn] of opts) {
        const h = s.h + turn, sx = s.x + Math.sin(s.h) * off, sy = s.y + Math.cos(s.h) * off, d = Math.hypot(sx - x, sy - y);
        if (d < bd) { bd = d; best = { x: sx, y: sy, h: s.kind === 'table' ? h + Math.PI : h, kind: s.kind }; }
      }
    }
    return best;
  }
}
export const parksCredit = () => D && D.credit;
