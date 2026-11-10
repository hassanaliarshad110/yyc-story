// Autumn: leaves drifting down from the maples and birches around you, fluttering in the wind and settling on the
// ground for a while before the next ones fall. Only near you, so it costs little.
import * as THREE from 'three';
import { L } from './tiles.js';
import { ground } from './terrain.js';

const COLS = [0xc8321e, 0xe0601c, 0xf09a24, 0xe8c030, 0xb04a1c, 0x9a5a2a, 0xd9471f];
export class Leaves {
  constructor(scene, tiles, n = 200) {
    this.tiles = tiles; this.n = n; this.trees = []; this.tT = 0; this.wind = 0;
    const g = new THREE.PlaneGeometry(0.17, 0.13); g.translate(0, 0, 0);
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(g, mat, n); this.mesh.frustumCulled = false; this.mesh.name = 'leaves';
    const c = new THREE.Color(); for (let i = 0; i < n; i++) this.mesh.setColorAt(i, c.setHex(COLS[i % COLS.length]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08));
    scene.add(this.mesh);
    this.P = Array.from({ length: n }, () => ({ x: 0, y: 0, z: -999, vz: 0, ph: Math.random() * 6.28, sp: 1 + Math.random() * 2, rest: 0, ax: Math.random(), ay: Math.random(), rot: 0, gz: 0 }));
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(1, 1, 1); this.v = new THREE.Vector3();
  }
  // broadleaf trees near you (tile-local features + the tile's origin)
  scan(px, py) {
    const out = [];
    for (const t of this.tiles.tiles.values()) {
      if (!t.layers || !t.layers[L.TREE] || Math.abs(t.ox + 250 - px) > 400 || Math.abs(t.oy + 250 - py) > 400) continue;
      for (const f of t.layers[L.TREE]) {
        const k = f.kind; if (k === 2 || k === 3 || k === 6 || k === 7 || k === 11) continue;
        const x = f.rings[0][0] + t.ox, y = f.rings[0][1] + t.oy; if (Math.abs(x - px) > 55 || Math.abs(y - py) > 55) continue;
        out.push([x, y, Math.max(3, f.a / 10), Math.max(1.2, f.b / 10)]);
      }
    }
    this.trees = out;
  }
  spawn(p, px, py) {
    const tr = this.trees.length ? this.trees[Math.random() * this.trees.length | 0] : null;
    if (tr) { const a = Math.random() * 6.28, r = Math.random() * tr[3] * 0.8; p.x = tr[0] + Math.cos(a) * r; p.y = tr[1] + Math.sin(a) * r; p.gz = ground(p.x, p.y); p.z = p.gz + tr[2] * (0.45 + Math.random() * 0.45); }
    else { p.x = px + (Math.random() - 0.5) * 60; p.y = py + (Math.random() - 0.5) * 60; p.gz = ground(p.x, p.y); p.z = p.gz + 6 + Math.random() * 8; }
    p.vz = 0.5 + Math.random() * 0.6; p.rest = 0;
  }
  update(dt, px, py, on = true) {
    this.mesh.visible = on; if (!on) return;
    if ((this.tT -= dt) <= 0) { this.tT = 1.5; this.scan(px, py); }
    this.wind += dt; const wx = 0.9 + Math.sin(this.wind * 0.13) * 0.6, wy = 0.35 + Math.cos(this.wind * 0.07) * 0.3;
    const { m, q, e, s, v } = this;
    for (let i = 0; i < this.n; i++) {
      const p = this.P[i];
      if (p.z < -900 || Math.abs(p.x - px) > 70 || Math.abs(p.y - py) > 70) { this.spawn(p, px, py); if (Math.random() < 0.5) p.z -= Math.random() * 6; }
      if (p.rest > 0) {           // lying on the ground
        p.rest -= dt; if (p.rest <= 0) p.z = -999;
        e.set(-Math.PI / 2, 0, p.rot); q.setFromEuler(e); m.compose(v.set(p.x, p.gz + 0.04, -p.y), q, s); this.mesh.setMatrixAt(i, m); continue;
      }
      p.ph += dt * p.sp;
      const sway = Math.sin(p.ph) * 0.9;
      p.x += (wx + sway * Math.cos(p.ax * 6.28)) * dt; p.y += (wy + sway * Math.sin(p.ax * 6.28)) * dt; p.z -= p.vz * (0.75 + 0.5 * Math.abs(Math.cos(p.ph))) * dt;
      p.rot += dt * p.sp * 0.8;
      if (p.z <= (p.gz = ground(p.x, p.y)) + 0.05) { p.rest = 6 + Math.random() * 8; continue; }
      e.set(Math.sin(p.ph) * 1.2, p.rot, Math.cos(p.ph * 0.7) * 0.9); q.setFromEuler(e); m.compose(v.set(p.x, p.z, -p.y), q, s); this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
