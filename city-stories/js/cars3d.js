// Detailed vehicle models: pickup truck, off-road SUV, city police SUV, community peace officer SUV,
// the city bus and the CTrain car. Each is fitted to its real length, width and height and faces +z
// like the other vehicles. Until a model has loaded, the simpler vehicles stand in.
import * as THREE from 'three';
import { loader, warm } from './gltf.js?v=11111720';


// real sizes (metres): length, width, height
export const CAR3D = {
  pickup: { L: 5.9, W: 2.03, H: 1.96 },
  offroad: { L: 4.88, W: 1.89, H: 1.85 },
  police: { L: 4.78, W: 1.93, H: 1.9 },
  peace: { L: 5.05, W: 2.0, H: 1.95 },
  bus: { L: 12.2, W: 2.59, H: 3.2 },
  ctrain: { L: 24.8, W: 2.65, H: 3.9 },
  sorento: { L: 4.78, W: 1.89, H: 1.69 },      // 2017 Kia Sorento, white
  rondo: { L: 4.55, W: 1.8, H: 1.65 },         // 2008 Kia Rondo, brown
  veloster: { L: 4.22, W: 1.8, H: 1.4 },       // 2015 Hyundai Veloster, orange
};
const READY = {};

async function load(kind) {
  const gl = await loader.loadAsync(`data/veh/${kind}.glb`); let mesh = null;
  gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  gl.scene.updateMatrixWorld(true);
  const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox(); let b = geo.boundingBox, s = b.getSize(new THREE.Vector3());
  if (s.x > s.z) geo.rotateY(-Math.PI / 2);           // the models come facing +x: turn them to face +z
  geo.computeBoundingBox(); b = geo.boundingBox; s = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3()), R = CAR3D[kind];
  geo.translate(-c.x, -b.min.y, -c.z); geo.scale(R.W / s.x, R.H / s.y, R.L / s.z);
  geo.computeBoundingSphere(); geo.userData.shared = true;
  const m = mesh.material;
  READY[kind] = { geo, mat: new THREE.MeshLambertMaterial({ map: m.map }), wheels: WHEEL_R[kind] ? axleWheels(geo, WHEEL_R[kind]) : null };
}
// tyre radius by vehicle (m); the CTrain's wheels are hidden under its skirts
const WHEEL_R = { pickup: 0.42, offroad: 0.43, police: 0.38, peace: 0.39, bus: 0.5, sorento: 0.37, rondo: 0.33, veloster: 0.32 };
// the wheels: cutting the model's own tyres out of the mesh left holes and black scraps when they turned, so each car
// gets clean wheels of its own (a tyre and an alloy rim) placed over the model's tyres at its axles, and those spin
let WHEEL_TEX = null;
function rimTexture() {
  if (WHEEL_TEX) return WHEEL_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1b1c1f'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
  const rg = g.createRadialGradient(64, 64, 6, 64, 64, 46); rg.addColorStop(0, '#e9ecef'); rg.addColorStop(1, '#9aa2aa');
  g.fillStyle = '#3a3e44'; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill();
  g.fillStyle = rg; for (let k = 0; k < 5; k++) { g.save(); g.translate(64, 64); g.rotate(k / 5 * Math.PI * 2); g.beginPath(); g.moveTo(-6, 8); g.lineTo(6, 8); g.lineTo(11, 44); g.lineTo(-11, 44); g.closePath(); g.fill(); g.restore(); }
  g.strokeStyle = '#c9ced4'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.stroke();
  g.fillStyle = '#d6dade'; g.beginPath(); g.arc(64, 64, 11, 0, 7); g.fill(); g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(64, 64, 4, 0, 7); g.fill();
  WHEEL_TEX = new THREE.CanvasTexture(c); WHEEL_TEX.colorSpace = THREE.SRGBColorSpace; WHEEL_TEX.anisotropy = 4; return WHEEL_TEX;
}
const WMAT = {};
function wheelMesh(r, w, side) {
  WMAT.tyre ||= new THREE.MeshLambertMaterial({ color: 0x1d1e21 }); WMAT.rim ||= new THREE.MeshLambertMaterial({ map: rimTexture() });
  const g = new THREE.Group(), t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), WMAT.tyre); t.rotation.z = Math.PI / 2; g.add(t);
  for (const sd of [side, -side]) { const f = new THREE.Mesh(new THREE.CircleGeometry(r * 0.97, 22), WMAT.rim); f.rotation.y = sd * Math.PI / 2; f.position.x = sd * (w / 2 + 0.004); g.add(f); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
// the axles from the model: its lowest points at the sides (where the tyres touch the ground), front and back
function axleWheels(geo, r) {
  const P = geo.attributes.position, n = P.count; geo.computeBoundingBox(); const bb = geo.boundingBox, W = bb.max.x - bb.min.x;
  const low = []; for (let i = 0; i < n; i++) if (P.getY(i) < 0.08) low.push([P.getX(i), P.getZ(i)]);
  if (low.length < 8) return null;
  const zs = low.map(p => p[1]).sort((a, b) => a - b), axles = []; let st = zs[0], prev = zs[0];
  for (const z of zs.slice(1).concat([Infinity])) { if (z - prev > 0.8) { axles.push((st + prev) / 2); st = z; } prev = z; }
  if (axles.length < 2 || axles.length > 4) return null;
  const front = Math.max(...axles), wheels = [];
  for (const az of axles) for (const sd of [1, -1]) {
    let ox = 0; for (const [x, z] of low) if (Math.sign(x) === sd && Math.abs(z - az) < r) ox = Math.max(ox, Math.abs(x));
    if (!ox) ox = W / 2 - 0.08;
    const w = Math.min(0.3, Math.max(0.2, r * 0.6)); wheels.push({ p: [sd * (ox - w / 2 + 0.02), r, az], r, w, side: sd, front: az === front });
  }
  return { body: geo, wheels, overlay: true };
}
// find the wheels in the model so they can turn: the low points at the sides give the axles, and the
// triangles inside each tyre's circle become their own piece, spun round the axle
function splitWheels(geo, W, r) {
  const P = geo.attributes.position, n = P.count, idx = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i);
  const zs = [];
  for (let i = 0; i < n; i++) if (P.getY(i) < 0.1 && Math.abs(P.getX(i)) > W / 2 - 0.45) zs.push(P.getZ(i));
  if (zs.length < 8) return null;
  zs.sort((a, b) => a - b);
  const axles = []; let st = zs[0], prev = zs[0];
  for (const z of zs.slice(1).concat([Infinity])) { if (z - prev > 0.8) { axles.push((st + prev) / 2); st = z; } prev = z; }
  if (axles.length < 2 || axles.length > 4) return null;
  // first guess: a circle of the tyre radius standing on the ground at each axle; then refit each tyre's
  // centre and size to the points found, and take only what lies inside that circle
  const K = axles.length * 2, lab = new Int8Array(n), C = [];
  for (let a = 0; a < axles.length; a++) for (let sd = 0; sd < 2; sd++) C.push({ y: r, z: axles[a], r, x: sd ? 1 : -1 });
  for (let pass = 0; pass < 2; pass++) {
    lab.fill(0);
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (Math.abs(x) < W / 2 - 0.36) continue;
      for (let k = 0; k < K; k++) { const c = C[k]; if ((x > 0) !== (c.x > 0)) continue; const dz = z - c.z, dy = y - c.y; if (dz * dz + dy * dy < c.r * c.r * (pass ? 0.98 : 0.9)) { lab[i] = k + 1; break; } }
    }
    if (pass) break;
    for (let k = 0; k < K; k++) {        // refit from the points inside
      let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, cnt = 0;
      for (let i = 0; i < n; i++) if (lab[i] === k + 1) { const y = P.getY(i), z = P.getZ(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); cnt++; }
      if (cnt > 10) { const c = C[k]; c.z = (z0 + z1) / 2; c.r = Math.max(0.25, Math.min(r * 1.15, Math.max(y1 - y0, z1 - z0) / 2 + 0.02)); c.y = Math.max(c.r, y0 + c.r); }
    }
  }
  const parts = Array.from({ length: K + 1 }, () => []);
  for (let t = 0; t < idx.length; t += 3) { const a = lab[idx[t]], k = a && a === lab[idx[t + 1]] && a === lab[idx[t + 2]] ? a : 0; parts[k].push(idx[t], idx[t + 1], idx[t + 2]); }
  const sub = list => { const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(list); g.boundingSphere = geo.boundingSphere; g.userData.shared = true; return g; };
  const wheels = [];
  for (let k = 1; k <= K; k++) {
    if (parts[k].length < 30) continue;
    let sx = 0, c = 0; for (const v of parts[k]) { sx += P.getX(v); c++; }
    const a = (k - 1) >> 1, cc = C[k - 1];
    wheels.push({ geo: sub(parts[k]), p: [sx / c, cc.y, cc.z], front: a === axles.length - 1 });
  }
  if (wheels.length < 4) return null;
  return { body: sub(parts[0]), wheels };
}
export async function loadCars3D() { await Promise.all(Object.keys(CAR3D).map(k => load(k).catch(e => console.warn('vehicle model', k, e)))); const g = new THREE.Group(); for (const k in READY) { const m = makeCar3D(k); if (m) g.add(m); } warm(g); }
export const car3dReady = k => !!READY[k];

// a Group facing +z with userData { L, W, kind } like the other vehicles; null if the model hasn't loaded
export function makeCar3D(kind) {
  const r = READY[kind]; if (!r) return null;
  const g = new THREE.Group(), W = r.wheels, m = new THREE.Mesh(W ? W.body : r.geo, r.mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const R = CAR3D[kind], wheels = [], front = [];
  if (W) for (const w of W.wheels) {             // each tyre on its own pivot at the axle: spins as you drive, the front ones steer
    const pv = new THREE.Group(); pv.rotation.order = 'YXZ'; pv.position.set(w.p[0], w.p[1], w.p[2]);
    if (W.overlay) pv.add(wheelMesh(w.r * 1.03, w.w, w.side));
    else { const wm = new THREE.Mesh(w.geo, r.mat); wm.position.set(-w.p[0], -w.p[1], -w.p[2]); wm.castShadow = true; pv.add(wm); }
    g.add(pv);
    wheels.push(pv); if (w.front) front.push(pv);
  }
  g.userData = { L: R.L, W: R.W, kind: kind === 'pickup' ? 'truck' : kind === 'offroad' ? 'suv' : kind, model: kind, wheels, front, wheelR: WHEEL_R[kind] || 0.4 };
  if (kind === 'police' || kind === 'peace') {          // flashing roof lights for the chase
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: kind === 'peace' ? 0xffa020 : 0xff2020 }));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x2a5cff }));
    a.position.set(-0.3, R.H + 0.02, -0.3); b.position.set(0.3, R.H + 0.02, -0.3); g.add(a, b);
    g.userData.beacons = [a, b]; g.userData.police = true; g.userData.peace = kind === 'peace';
  }
  return g;
}
