// Headlights and tail lights for cars and motorbikes that are being driven: a soft glow on each lamp (warm white in
// front, red behind) and a pool of light on the road ahead. One mesh and one draw call per car; they fade in at dusk.
import * as THREE from 'three';

// a 2-cell texture: a round lamp glow (left half) and a beam on the road, bright at the car and fading ahead (right half)
function tex() {
  const S = 128, cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S; const g = cv.getContext('2d');
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.85)'); r.addColorStop(0.45, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, S, S);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y / (S - 1), u = x / (S - 1) * 2 - 1;          // v: 0 at the car .. 1 far ahead; u: across
    const w = 0.35 + 0.65 * v, a = Math.max(0, 1 - Math.pow(Math.abs(u) / w, 2.2)) * Math.pow(1 - v, 1.4) * Math.min(1, v * 6 + 0.25);
    const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, S, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let MAT = null;
function mat() {
  return MAT ||= new THREE.MeshBasicMaterial({ map: tex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true, toneMapped: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
}
const HEAD = [1.0, 0.93, 0.78], TAIL = [1.0, 0.1, 0.06], BEAM = [0.85, 0.78, 0.6];

// add the lights to a car (once); bounds are measured on the model as it was built (front = +z)
export function addLights(mesh) {
  const u = mesh.userData; if (u.lights) return u.lights;
  const rot = mesh.rotation.clone(), pos = mesh.position.clone(); mesh.rotation.set(0, 0, 0); mesh.position.set(0, 0, 0); mesh.updateMatrixWorld(true);
  const bb = new THREE.Box3(); mesh.traverse(o => { if (o.isMesh && o.name !== 'lights') { o.geometry.computeBoundingBox && !o.geometry.boundingBox && o.geometry.computeBoundingBox(); if (o.geometry.boundingBox) bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  mesh.rotation.copy(rot); mesh.position.copy(pos); mesh.updateMatrixWorld(true);
  if (bb.isEmpty()) return null;
  const bike = u.kind === 'bike', H = bb.max.y - bb.min.y, hw = (bb.max.x - bb.min.x) / 2, cx = (bb.max.x + bb.min.x) / 2;
  const P = [], C = [], UV = [], I = [];
  const quad = (pts, col, uv) => { const b = P.length / 3; for (let k = 0; k < 4; k++) { P.push(...pts[k]); C.push(...col); UV.push(...uv[k]); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const DOT = [[0, 0], [0.5, 0], [0.5, 1], [0, 1]];
  // a glow facing out of the front (s = 1) or back (s = -1)
  const lamp = (x, y, z, w, h, col, s) => quad([[x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z]].map(p => (p[2] += 0.04 * s, p)), col, DOT);
  const fy = bb.min.y + H * (bike ? 0.68 : 0.42), ry = bb.min.y + H * (bike ? 0.55 : 0.55), fz = bb.max.z, rz = bb.min.z;
  if (bike) { lamp(cx, fy, fz, 0.5, 0.42, HEAD, 1); lamp(cx, ry, rz, 0.3, 0.24, TAIL, -1); }
  else {
    const lx = Math.max(0.3, hw - 0.3);
    for (const sx of [-1, 1]) { lamp(cx + sx * lx, fy, fz, 0.6, 0.42, HEAD, 1); lamp(cx + sx * lx, ry, rz, 0.42, 0.28, TAIL, -1); }
  }
  // the beam on the road: from the bumper to ~11 m ahead
  const gy = bb.min.y + 0.24, bw = bike ? 2.6 : Math.max(3.2, hw * 3.2), L = bike ? 9 : 11;
  quad([[cx - bw / 2 * 0.45, gy, fz - 0.2], [cx + bw / 2 * 0.45, gy, fz - 0.2], [cx + bw / 2, gy, fz + L], [cx - bw / 2, gy, fz + L]], BEAM, [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  const m = new THREE.Mesh(g, mat()); m.renderOrder = 6; m.castShadow = false; m.name = 'lights';
  mesh.add(m); u.lights = m; return m;
}
export function lightsOn(mesh, on) { const l = on ? addLights(mesh) : mesh.userData.lights; if (l) l.visible = !!on; }
// 0 by day .. 1 at night
export function setCarLightsNight(n) { const m = mat(), o = Math.max(0, Math.min(1, (n - 0.15) * 1.6)); m.opacity = o; m.visible = o > 0.01; }
