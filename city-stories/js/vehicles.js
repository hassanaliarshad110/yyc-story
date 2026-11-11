// Cars and the motorbike from Grand Chori Karachi (baked model data in data/veh/*.json), with spinning wheels.
import * as THREE from 'three';
import { shiny } from './graphics.js';

const b64u8 = s => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const D = {};          // raw data by name
const GEO = {};        // geometry (+ wheel geometries)
const MATS = {};       // material per name:tint
export const VEH_KINDS = ['papurola', 'mehran', 'amb', 'truck', 'moto'];

function bakedGeo(d) {
  const n = d.n, q = new Int16Array(b64u8(d.p).buffer), p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = d.mn[i % 3] + (q[i] + 32768) / 65535 * d.sc[i % 3];
  const n8 = new Int8Array(b64u8(d.nm).buffer), nm = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) nm[i] = n8[i] / 127;
  const u16 = new Uint16Array(b64u8(d.uv).buffer), uv = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) uv[i] = u16[i] / 65535;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const ib = b64u8(d.i).buffer; g.setIndex(new THREE.BufferAttribute(d.i32 ? new Uint32Array(ib) : new Uint16Array(ib), 1)); g.computeBoundingSphere(); return g;
}
// split the wheels out of the body so they can spin
const WHL = { car: [{ s: 1, z: 1.325 }, { s: -1, z: 1.325 }, { s: 1, z: -1.285 }, { s: -1, z: -1.285 }], cy: .3126, cr: .345, cxi: .76, cxm: .87, bike: [{ x: .754, y: .335, r: .352 }, { x: -.631, y: .335, r: .345 }], bz: .06 };
function wheelSplit(pos, idx, n, which) {
  const nv = pos.length / 3, lab = new Int8Array(nv); for (let i = 0; i < nv; i++) lab[i] = which(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const cnt = new Uint32Array(n + 1), nt = idx.length / 3, tl = new Int8Array(nt);
  for (let t = 0; t < nt; t++) { const a = lab[idx[t * 3]]; const k = (a && a === lab[idx[t * 3 + 1]] && a === lab[idx[t * 3 + 2]]) ? a : 0; tl[t] = k; cnt[k]++; }
  const C = idx.constructor, out = [], o = new Uint32Array(n + 1); for (let k = 0; k <= n; k++) out.push(new C(cnt[k] * 3));
  for (let t = 0; t < nt; t++) { const k = tl[t], d = out[k], q = o[k]; d[q] = idx[t * 3]; d[q + 1] = idx[t * 3 + 1]; d[q + 2] = idx[t * 3 + 2]; o[k] = q + 3; } return out;
}
function geoWith(geo, index) { const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(new THREE.BufferAttribute(index, 1)); g.boundingSphere = geo.boundingSphere; return g; }
function carWhich(x, y, z) { const ax = x < 0 ? -x : x; if (ax < WHL.cxi || y > .7) return 0; for (let k = 0; k < 4; k++) { const w = WHL.car[k]; if ((x > 0) === (w.s > 0)) { const dz = z - w.z, dy = y - WHL.cy; if (dz * dz + dy * dy < WHL.cr * WHL.cr) return k + 1; } } return 0; }
function bikeWhich(x, y, z) { if (z > WHL.bz || z < -WHL.bz) return 0; for (let k = 0; k < 2; k++) { const w = WHL.bike[k], dx = x - w.x, dy = y - w.y; if (dx * dx + dy * dy < w.r * w.r) return k + 1; } return 0; }

// body paint colours: the texture's own red is swapped for the tint
const TINTS = { white: [238, 238, 232], silver: [168, 174, 180], black: [36, 36, 40], blue: [44, 84, 170], grey: [112, 116, 122], gold: [196, 170, 110], green: [46, 92, 62], navy: [30, 44, 84], red: [168, 24, 30] };
function bakedTex(d, w, h, rgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const im = new Image(); im.onload = () => {
    g.drawImage(im, 0, 0, w, h);
    if (rgb) { const dd = g.getImageData(0, 0, w, h), a = dd.data, [tr, tg, tb] = rgb; for (let i = 0; i < a.length; i += 4) { const r = a[i], gg = a[i + 1], b = a[i + 2]; if (r > 50 && r > gg * 1.7 && r > b * 1.4 && !(r > 205 && gg < 95)) { const l = Math.min(1.12, r / 168); a[i] = Math.min(255, tr * l); a[i + 1] = Math.min(255, tg * l); a[i + 2] = Math.min(255, tb * l); } } g.putImageData(dd, 0, 0); }
    t.needsUpdate = true;
  }; im.src = d.tex; return t;
}
const TEXSIZE = { papurola: [1024, 512], mehran: [1024, 794], amb: [1024, 577], truck: [1024, 510], moto: [1024, 1024] };

export async function loadVehicles(names = VEH_KINDS) {
  await Promise.all(names.map(async n => { try { const r = await fetch('data/veh/' + n + '.json'); D[n] = await r.json(); } catch (e) { console.warn('vehicle', n, e); } }));
  for (const n of names) {
    const d = D[n]; if (!d) continue;
    const g = bakedGeo(d); GEO[n] = { body: g, wheels: [] };
    try {
      if (n === 'papurola') { const parts = wheelSplit(g.attributes.position.array, g.index.array, 4, carWhich); GEO[n] = { body: geoWith(g, parts[0]), wheels: [1, 2, 3, 4].map(k => geoWith(g, parts[k])) }; }
      if (n === 'moto') { const parts = wheelSplit(g.attributes.position.array, g.index.array, 2, bikeWhich); GEO[n] = { body: geoWith(g, parts[0]), wheels: [geoWith(g, parts[1]), geoWith(g, parts[2])] }; }
    } catch (e) { console.warn(e); }
  }
}
export const vehiclesReady = () => !!GEO.papurola;
function mat(n, tint) { const k = n + ':' + (tint || ''); if (!MATS[k]) { const [w, h] = TEXSIZE[n]; MATS[k] = shiny(new THREE.MeshLambertMaterial({ map: bakedTex(D[n], w, h, tint ? TINTS[tint] : null), side: THREE.DoubleSide })); } return MATS[k]; }

const pick = a => a[Math.random() * a.length | 0];
// returns a Group facing +z with userData {L, W, kind, wheels:[pivot groups], front:[pivots]}; null if the data is missing
export function makeKarachiVehicle(kind, tint) {
  const G = GEO[kind]; if (!G) return null;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const wheels = [], front = [];
  let L = 4.5, W = 1.85;
  if (kind === 'papurola') {
    tint = tint === undefined ? pick([null, 'white', 'white', 'silver', 'silver', 'black', 'black', 'blue', 'grey', 'gold', 'navy', 'green']) : tint;
    const m = new THREE.Mesh(G.body, mat(kind, tint)); m.scale.set(.84, .92, 1); body.add(m);
    G.wheels.forEach((wg, k) => { const w = WHL.car[k], pv = new THREE.Group(); pv.rotation.order = 'YXZ'; pv.position.set(w.s * WHL.cxm, WHL.cy, w.z); const wm = new THREE.Mesh(wg, m.material); wm.position.set(-w.s * WHL.cxm, -WHL.cy, -w.z); pv.add(wm); m.add(pv); wheels.push(pv); if (w.z > 0) front.push(pv); });
    L = 4.5; W = 1.85;
  } else if (kind === 'mehran') {
    tint = tint === undefined ? pick([null, null, 'white', 'white', 'silver', 'blue', 'grey']) : tint;
    const m = new THREE.Mesh(G.body, mat(kind, tint)); m.scale.set(.78, .82, 1); body.add(m); L = 3.4; W = 1.56;
  } else if (kind === 'truck') { const m = new THREE.Mesh(G.body, mat(kind)); m.scale.set(.8, .85, 1); body.add(m); L = 7.2; W = 2.45; }
  else if (kind === 'amb') {
    const m = new THREE.Mesh(G.body, mat(kind)); m.scale.set(.8, .78, 1); body.add(m); L = 5; W = 2;
    const lr = new THREE.Mesh(new THREE.BoxGeometry(.34, .14, .22), new THREE.MeshBasicMaterial({ color: 0xff2a2a })), lb = new THREE.Mesh(new THREE.BoxGeometry(.34, .14, .22), new THREE.MeshBasicMaterial({ color: 0x3a6cff }));
    lr.position.set(-.42, 2.3, 1.15); lb.position.set(.42, 2.3, 1.15); body.add(lr, lb); g.userData.beacons = [lr, lb];
  } else if (kind === 'moto') {
    const m = new THREE.Mesh(G.body, mat(kind)); m.rotation.y = -Math.PI / 2; m.position.y = .08; body.add(m);
    G.wheels.forEach((wg, k) => { const w = WHL.bike[k], pv = new THREE.Group(); pv.position.set(w.x, w.y, 0); const wm = new THREE.Mesh(wg, m.material); wm.position.set(-w.x, -w.y, 0); pv.add(wm); m.add(pv); wheels.push({ pv, bike: true }); });
    L = 1.9; W = 0.75;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { ...g.userData, L, W, kind: kind === 'moto' ? 'bike' : kind, model: kind, wheels, front, roll: 0 };
  return g;
}
// spin wheels by distance travelled and steer the front ones
export function spinWheels(g, dist, steer = 0) {
  const u = g.userData; if (!u.wheels || !u.wheels.length) return;
  u.roll = (u.roll || 0) + dist / (u.wheelR || 0.33);
  for (const w of u.wheels) { if (w.bike) w.pv.rotation.z = -u.roll; else w.rotation.x = u.roll; }
  for (const f of u.front || []) f.rotation.y = steer;
}
