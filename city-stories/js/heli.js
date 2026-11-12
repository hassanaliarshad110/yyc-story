// A small helicopter you can fly (same handling as the Karachi game): model and per-frame pose.
import * as THREE from 'three';
import { rotY } from './player.js?v=11112231';

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
function labelTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#c8202c'; g.font = '700 34px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeHeli() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const red = M(0xc8202c), wht = M(0xf2f2ee), dk = M(0x2a2d33), glass = new THREE.MeshLambertMaterial({ color: 0x2b5f86, transparent: true, opacity: 0.7 });
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || body).add(m); return m; };
  const cab = add(new THREE.SphereGeometry(1, 18, 12), red, 0, 1.5, 0); cab.scale.set(1.05, 1, 1.85);
  const gl = add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glass, 0, 1.55, 0.95); gl.scale.set(0.92, 0.85, 0.95); gl.rotation.x = 1.1;
  add(new THREE.BoxGeometry(2.12, 0.18, 2.6), wht, 0, 1.25, -0.1);
  const boom = add(new THREE.CylinderGeometry(0.24, 0.12, 4.8, 10), red, 0, 1.85, -3.4); boom.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.1, 1.2, 0.8), red, 0, 2.35, -5.6); add(new THREE.BoxGeometry(1.4, 0.08, 0.5), red, 0, 1.9, -5.2);
  add(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 8), dk, 0, 2.75, -0.1);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.05, -0.1); body.add(rotor);
  add(new THREE.BoxGeometry(9.4, 0.05, 0.32), dk, 0, 0, 0, rotor); add(new THREE.BoxGeometry(0.32, 0.05, 9.4), dk, 0, 0, 0, rotor); add(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), dk, 0, 0, 0, rotor);
  const trotor = new THREE.Group(); trotor.position.set(0.12, 2.3, -5.6); body.add(trotor); add(new THREE.BoxGeometry(0.04, 1.5, 0.14), dk, 0, 0, 0, trotor);
  for (const sx of [-0.9, 0.9]) {
    const sk = add(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), dk, sx, 0.12, 0); sk.rotation.x = Math.PI / 2;
    for (const z of [-0.7, 0.8]) { const s2 = add(new THREE.BoxGeometry(0.06, 0.75, 0.06), dk, sx * 0.85, 0.48, z); s2.rotation.z = sx > 0 ? -0.25 : 0.25; }
  }
  const tex = labelTex('YYC STORY');
  for (const s of [-1, 1]) { const pl = add(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshLambertMaterial({ map: tex }), s * 1.06, 1.25, -0.6); pl.rotation.y = s * Math.PI / 2; }
  // a landing light under the nose for night flying
  const beam = new THREE.SpotLight(0xfff2d0, 0, 120, 0.45, 0.6, 1.2); beam.position.set(0, 1.0, 1.4); beam.target.position.set(0, -20, 12); body.add(beam); body.add(beam.target);
  g.userData = { rotor, trotor, beam };
  return g;
}
export function newHeli(scene, x, y, h, alt) {
  const mesh = makeHeli(); scene.add(mesh);
  const v = { mesh, x, y, h, alt, v: 0, vy: 0, rot: 0, pitch: 0, roll: 0, spin: 0 };
  syncHeli(v); return v;
}
export function syncHeli(v) {
  const g = v.mesh; g.position.set(v.x, v.alt, -v.y); g.rotation.order = 'YXZ'; g.rotation.set(v.pitch, rotY(v.h), v.roll);
  const u = g.userData; u.rotor.rotation.y = v.spin || 0; u.trotor.rotation.x = (v.spin || 0) * 1.7;
}
// rotors wind down after you get out
export function idleHeli(v, dt) { if (v.rot > 0) { v.rot = Math.max(0, v.rot - dt * 0.25); v.spin += dt * 26 * v.rot; syncHeli(v); } }
