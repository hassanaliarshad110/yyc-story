// Low-poly people and vehicles built from boxes, so nothing needs to be downloaded.
import * as THREE from 'three';
import { busSignTexture } from './textures.js?v=11111647';
import { vehiclesReady, makeKarachiVehicle } from './vehicles.js?v=11111647';
import { makeCar3D } from './cars3d.js?v=11111647';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

export function makePerson(style = {}) {
  const g = new THREE.Group();
  const skin = mat(style.skin || 0xc68a5c), shirt = mat(style.shirt || 0x2a7de1), pants = mat(style.pants || 0x2b2f3a), hair = mat(style.hair || 0x1b1410), shoe = mat(0x222222);
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  const torso = new THREE.Mesh(box(0.46, 0.6, 0.26), shirt); torso.position.y = 0.32; hips.add(torso);
  const head = new THREE.Mesh(box(0.26, 0.28, 0.26), skin); head.position.y = 0.8; hips.add(head);
  const hr = new THREE.Mesh(box(0.28, style.long ? 0.3 : 0.1, 0.28), hair); hr.position.set(0, style.long ? 0.86 : 0.96, style.long ? -0.03 : 0); hips.add(hr);
  if (style.bag) { const b = new THREE.Mesh(box(0.34, 0.4, 0.14), mat(style.bag)); b.position.set(0, 0.34, -0.2); hips.add(b); }
  const limb = (w, h, m, x, y) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const l = new THREE.Mesh(box(w, h, w), m); l.position.y = -h / 2; piv.add(l); hips.add(piv); return piv; };
  const armL = limb(0.13, 0.58, shirt, -0.3, 0.6), armR = limb(0.13, 0.58, shirt, 0.3, 0.6);
  const legL = limb(0.17, 0.9, pants, -0.12, 0.02), legR = limb(0.17, 0.9, pants, 0.12, 0.02);
  [legL, legR].forEach(l => { const s = new THREE.Mesh(box(0.19, 0.08, 0.28), shoe); s.position.set(0, -0.9, 0.04); l.add(s); });
  g.userData = { armL, armR, legL, legR, phase: 0 };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function animatePerson(p, speed, dt) {
  const u = p.userData; u.phase += dt * (2 + speed * 1.6);
  const a = Math.min(1, speed / 4) * 0.8, s = Math.sin(u.phase) * a;
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8;
}

const CAR_COLOURS = [0xf2f2f2, 0x1c1c1c, 0x8a9199, 0xb3b9c0, 0x9b1b1b, 0x1d3f7a, 0x2f5d3a, 0xd9c7a2, 0x5a2e1e, 0x2b6cb0, 0xc97a14];
// Calgary Police Service-style patrol car: white sedan, dark blue stripe and POLICE lettering, light bar on the roof
let POLICE_TEX = null;
function policeTex() {
  if (POLICE_TEX) return POLICE_TEX;
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#0d2a5c'; x.fillRect(0, 34, 512, 30); x.fillStyle = '#f5c400'; x.fillRect(0, 64, 512, 5);
  x.font = '800 30px "Segoe UI", Roboto, Arial, sans-serif'; x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', 256, 50);
  POLICE_TEX = new THREE.CanvasTexture(c); POLICE_TEX.colorSpace = THREE.SRGBColorSpace; return POLICE_TEX;
}
function policeKit(g, L, W, roofY, decalY) {
  const decal = new THREE.MeshBasicMaterial({ map: policeTex(), transparent: true, alphaTest: 0.1 }), red = new THREE.MeshBasicMaterial({ color: 0xff2020 }), blue = new THREE.MeshBasicMaterial({ color: 0x2a5cff }), bar = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (const s of [1, -1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.86, L * 0.86 * 96 / 512), decal); d.position.set(s * (W / 2 + 0.015), decalY, 0); d.rotation.y = s * Math.PI / 2; g.add(d); }
  const b = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 0.08, 0.3), bar); b.position.set(0, roofY, -0.15); g.add(b);
  const lr = new THREE.Mesh(new THREE.BoxGeometry(W * 0.28, 0.12, 0.26), red), lb = new THREE.Mesh(new THREE.BoxGeometry(W * 0.28, 0.12, 0.26), blue);
  lr.position.set(-W * 0.16, roofY + 0.09, -0.15); lb.position.set(W * 0.16, roofY + 0.09, -0.15); g.add(lr, lb);
  g.userData.beacons = [lr, lb]; g.userData.police = true;
}
export function makeCar(kind = 'car', colour) {
  // the detailed models: police SUVs (now and then a community peace officer), pickups and off-roaders
  { const r = Math.random(), k = kind === 'police' ? (r < 0.3 ? 'peace' : 'police') : kind === 'peace' ? 'peace' : kind === 'truck' ? 'pickup' : kind === 'suv' ? (r < 0.6 ? 'offroad' : 'pickup') : kind === 'car' ? (r < 0.12 ? 'pickup' : r < 0.2 ? 'offroad' : r < 0.32 ? 'sorento' : r < 0.42 ? 'rondo' : r < 0.52 ? 'veloster' : null) : null;
    const m = k && makeCar3D(k); if (m) return m; }
  if (kind === 'police') {
    const v = vehiclesReady() && makeKarachiVehicle('papurola', 'white');
    const car = v || makeCar('car', 0xf2f2f2);
    const bb = new THREE.Box3().setFromObject(car), sz = bb.getSize(new THREE.Vector3());
    policeKit(car, sz.z, sz.x * 0.97, bb.max.y + 0.02, bb.min.y + sz.y * 0.42); car.userData.kind = 'police'; return car;
  }
  if (vehiclesReady()) {      // the Karachi models: mostly the sedan, some small hatchbacks, the odd ambulance, truck or bike
    const r = Math.random();
    const k = kind === 'bike' ? 'moto' : 'papurola';      // the sedan and the motorbike: their wheels turn
    const v = makeKarachiVehicle(k, kind === 'family' ? 'navy' : undefined); if (v) return v;
  }
  if (kind === 'family') kind = 'suv';
  const g = new THREE.Group();
  const c = colour ?? CAR_COLOURS[Math.random() * CAR_COLOURS.length | 0];
  const body = mat(c), glass = mat(0x22303a), dark = mat(0x151515), light = mat(0xfff3c4, { emissive: 0x332a10 }), red = mat(0xb01010, { emissive: 0x300000 });
  let L = 4.5, W = 1.85, H = 0.75, cabH = 0.62, cabL = 2.4, cabZ = -0.2;
  if (kind === 'truck') { L = 5.6; W = 2.0; H = 0.95; cabH = 0.8; cabL = 2.2; cabZ = 0.9; }
  if (kind === 'suv') { L = 4.8; W = 1.95; H = 0.95; cabH = 0.72; cabL = 2.9; cabZ = -0.3; }
  const b = new THREE.Mesh(box(W, H, L), body); b.position.y = 0.35 + H / 2; g.add(b);
  const cab = new THREE.Mesh(box(W * 0.9, cabH, cabL), glass); cab.position.set(0, 0.35 + H + cabH / 2 - 0.02, cabZ); g.add(cab);
  const roof = new THREE.Mesh(box(W * 0.86, 0.06, cabL * 0.9), body); roof.position.set(0, 0.35 + H + cabH, cabZ); g.add(roof);
  if (kind === 'truck') { const bed = new THREE.Mesh(box(W, 0.4, 2.3), body); bed.position.set(0, 0.35 + H + 0.2, -1.6); g.add(bed); }
  for (const [x, z] of [[-W / 2, L / 2 - 0.9], [W / 2, L / 2 - 0.9], [-W / 2, -L / 2 + 0.9], [W / 2, -L / 2 + 0.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w);
  }
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
    const f = new THREE.Mesh(box(0.35, 0.14, 0.05), light); f.position.set(x, 0.35 + H * 0.65, L / 2); g.add(f);
    const r = new THREE.Mesh(box(0.35, 0.14, 0.05), red); r.position.set(x, 0.35 + H * 0.65, -L / 2); g.add(r);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { L, W, kind };
  return g;
}

// Calgary Transit bus: white body, red stripe, route sign
export function makeBus(route = '') {
  const m = makeCar3D('bus');
  if (m) {        // the detailed bus, with the route on its sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.32), new THREE.MeshBasicMaterial({ map: busSignTexture(route) }));
    sign.position.set(0, 2.88, 12.2 / 2 + 0.04); m.add(sign); m.userData = { ...m.userData, kind: 'bus', route, sign }; return m;
  }
  const g = new THREE.Group();
  const L = 12, W = 2.55, H = 2.9;
  const body = new THREE.Mesh(box(W, H, L), mat(0xf4f4f2)); body.position.y = 0.4 + H / 2; g.add(body);
  const stripe = new THREE.Mesh(box(W + 0.02, 0.35, L + 0.02), mat(0xc8102e)); stripe.position.y = 1.1; g.add(stripe);
  const win = new THREE.Mesh(box(W + 0.03, 1.0, L - 1.2), mat(0x1f2a33)); win.position.set(0, 2.25, -0.3); g.add(win);
  const ws = new THREE.Mesh(box(W - 0.2, 1.3, 0.04), mat(0x1f2a33)); ws.position.set(0, 2.1, L / 2 + 0.01); g.add(ws);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.36), new THREE.MeshBasicMaterial({ map: busSignTexture(route) }));
  sign.position.set(0, 3.05, L / 2 + 0.03); g.add(sign);
  for (const z of [L / 2 - 2.2, -L / 2 + 2.8]) for (const x of [-W / 2, W / 2]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), mat(0x151515)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { L, W, kind: 'bus', route, sign };
  return g;
}

// CTrain car (Calgary's light rail): white with red band. A train is 3-4 cars.
export function makeTrain(cars = 3, line = 'Red') {
  const g = new THREE.Group();
  const L = 24.5, W = 2.65, H = 3.3, gap = 0.6;
  for (let i = 0; i < cars; i++) {
    const d = makeCar3D('ctrain'); if (d) { d.position.z = -i * (24.8 + gap); g.add(d); continue; }
    const c = new THREE.Group();
    const b = new THREE.Mesh(box(W, H, L), mat(0xf2f2f0)); b.position.y = 0.6 + H / 2; c.add(b);
    const band = new THREE.Mesh(box(W + 0.02, 0.5, L + 0.02), mat(0xc8102e)); band.position.y = 1.3; c.add(band);
    const win = new THREE.Mesh(box(W + 0.03, 1.0, L - 2), mat(0x1f2a33)); win.position.y = 2.5; c.add(win);
    const pan = new THREE.Mesh(box(0.1, 0.8, 1.6), mat(0x333333)); pan.position.set(0, 0.6 + H + 0.4, 0); c.add(pan);
    c.position.z = -i * (L + gap); g.add(c);
  }
  g.userData = { L: cars * (L + gap), W, kind: 'train', line };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeMarker(colour = 0xffc400) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 32), new THREE.MeshBasicMaterial({ color: colour }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 30; g.add(beam);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4), new THREE.MeshBasicMaterial({ color: colour }));
  arrow.rotation.x = Math.PI; arrow.position.y = 4; g.add(arrow);
  g.userData.arrow = arrow;
  return g;
}

export function makeTree(scale = 1, kind = 0) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.22 * scale, 2.2 * scale, 6), mat(0x5b4232)); t.position.y = 1.1 * scale; g.add(t);
  const crown = kind === 1 ? new THREE.ConeGeometry(1.6 * scale, 5 * scale, 7) : new THREE.IcosahedronGeometry(2 * scale, 0);
  const c = new THREE.Mesh(crown, mat(kind === 1 ? 0x2d5a34 : 0x4f7d3a)); c.position.y = (kind === 1 ? 4.2 : 3.6) * scale; g.add(c);
  return g;
}
