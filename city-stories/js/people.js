// People on the sidewalks: walkers around you (many more downtown), and people experiencing homelessness
// sheltering under the downtown bridges, with a way to check in and get them connected to outreach.
import * as THREE from 'three';
import { Character, HAT_COLORS } from './rig.js';
import { ground } from './terrain.js';
import { L } from './tiles.js';

const SKINS = [0x8d5a3b, 0xb07a52, 0xe0b896, 0xc49a76, 0x5a3a28, 0xd9a77e, 0xf0cfb0];
const SHIRTS = [0x2a7de1, 0xc8102e, 0x2f8f5a, 0x222222, 0xe0a020, 0x7a3fa0, 0xf2f2f2, 0x4a5a6a, 0x9b2a2a, 0x1f4f7f];
const PANTS = [0x2a2e38, 0x23252b, 0x3a4a6a, 0x5a4a3a, 0x30343c];
const HAIRS = [0x15100d, 0x4a2e1a, 0x8a6a3a, 0xd2d0cc, 0x15100d];
// a small set of looks (each look's mesh is built once and shared)
const LOOKS = [];
for (let i = 0; i < 18; i++) {
  const f = i % 2 === 1;
  LOOKS.push({ skin: SKINS[i % SKINS.length], shirt: SHIRTS[(i * 3) % SHIRTS.length], pants: PANTS[i % PANTS.length], hair: HAIRS[(i * 7) % HAIRS.length], fem: f, long: f && i % 4 === 1, scale: 0.94 + (i % 3) * 0.04, bag: i % 5 === 0 ? 0x333333 : undefined, hat: i % 3 !== 2 ? HAT_COLORS[i % HAT_COLORS.length] : undefined });     // Stampede time: most people wear cowboy hats
}
const WORN = [{ skin: 0xc49a76, shirt: 0x4a4a3a, pants: 0x3a3a34, hair: 0x5a4a3a }, { skin: 0x8d5a3b, shirt: 0x5a3a2a, pants: 0x2a2a2a, hair: 0x15100d }, { skin: 0xe0b896, shirt: 0x3a4a5a, pants: 0x4a4038, hair: 0x8a7a6a, fem: true, long: true }];
const DOWNTOWN = { x: 0, y: 200, r: 1900 };

export class People {
  constructor(scene, tiles, { max = 16, maxDowntown = 40 } = {}) {
    this.scene = scene; this.tiles = tiles; this.max = max; this.maxDT = maxDowntown;
    this.walkers = []; this.pool = []; this.t = 0;
    this.camps = []; this.campTiles = new Set(); this.near = null;
    this.mat = { bag: new THREE.MeshLambertMaterial({ color: 0x3a5a7a }), bag2: new THREE.MeshLambertMaterial({ color: 0x7a3a2a }), tent: new THREE.MeshLambertMaterial({ color: 0x4f6b3a, side: THREE.DoubleSide }), cart: new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }) };
  }
  // sidewalk lines of a tile: footways, and both sides of city streets
  segs(t) {
    if (t.walkSegs) return t.walkSegs;
    const S = [];
    for (const f of (t.layers && t.layers[L.PATH]) || []) {
      if (f.flags & 4 || f.rings[0].z) continue; const r = f.rings[0];
      for (let i = 1; i < r.length / 2; i++) S.push([r[i * 2 - 2] + t.ox, r[i * 2 - 1] + t.oy, r[i * 2] + t.ox, r[i * 2 + 1] + t.oy]);
    }
    for (const f of (t.layers && t.layers[L.ROAD]) || []) {
      if (![3, 4, 5, 6].includes(f.kind) || f.flags & 4 || f.rings[0].z) continue;
      const r = f.rings[0], off = f.a / 20 + 1.1;
      for (const side of [1, -1]) for (let i = 1; i < r.length / 2; i++) {
        const ax = r[i * 2 - 2], ay = r[i * 2 - 1], bx = r[i * 2], by = r[i * 2 + 1], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l * off * side, ny = (bx - ax) / l * off * side;
        S.push([ax + nx + t.ox, ay + ny + t.oy, bx + nx + t.ox, by + ny + t.oy]);
      }
    }
    return (t.walkSegs = S.filter(s => Math.hypot(s[2] - s[0], s[3] - s[1]) > 2));
  }
  spawn(px, py) {
    const t = this.tiles.tileAt(px + (Math.random() - 0.5) * 220, py + (Math.random() - 0.5) * 220);
    if (!t || !t.group || t.lite || !t.layers) return;
    const S = this.segs(t); if (!S.length) return;
    for (let tries = 0; tries < 8; tries++) {
      const s = S[Math.floor(Math.random() * S.length)], u = Math.random(), x = s[0] + (s[2] - s[0]) * u, y = s[1] + (s[3] - s[1]) * u, d = Math.hypot(x - px, y - py);
      if (d < 35 || d > 130) continue;
      let ch = this.pool.pop();
      if (!ch) { ch = new Character(LOOKS[Math.floor(Math.random() * LOOKS.length)]); }
      this.scene.add(ch.g);
      this.walkers.push({ ch, s, u, dir: Math.random() < 0.5 ? 1 : -1, sp: 1.1 + Math.random() * 0.5, t, pause: 0 });
      return;
    }
  }
  update(dt, px, py) {
    const dd = Math.hypot(px - DOWNTOWN.x, py - DOWNTOWN.y), want = dd < DOWNTOWN.r ? this.maxDT : this.max;
    this.t -= dt;
    if (this.t <= 0) { this.t = 0.15; if (this.walkers.length < want) this.spawn(px, py); }
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i], s = w.s, L2 = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1;
      let x = s[0] + (s[2] - s[0]) * w.u, y = s[1] + (s[3] - s[1]) * w.u;
      const far = Math.hypot(x - px, y - py);
      if (far > 170 || !w.t.group || this.walkers.length > want + 6) { this.scene.remove(w.ch.g); this.pool.push(w.ch); this.walkers.splice(i, 1); continue; }
      if (w.pause > 0) { w.pause -= dt; w.ch.animate(dt, { speed: 0 }); }
      else {
        w.u += w.dir * w.sp * dt / L2;
        if (w.u > 1 || w.u < 0) {       // end of the sidewalk piece: carry on along a connected one, or turn back
          const ex = w.u > 1 ? s[2] : s[0], ey = w.u > 1 ? s[3] : s[1], S = this.segs(w.t);
          let next = null;
          for (let k = 0; k < 40 && !next; k++) { const c = S[Math.floor(Math.random() * S.length)]; if (c === s) continue; if (Math.hypot(c[0] - ex, c[1] - ey) < 4) { next = [c, 0, 1]; } else if (Math.hypot(c[2] - ex, c[3] - ey) < 4) next = [c, 1, -1]; }
          if (next) { w.s = next[0]; w.u = next[1]; w.dir = next[2]; } else { w.dir = -w.dir; w.u = Math.max(0, Math.min(1, w.u)); if (Math.random() < 0.3) w.pause = 1 + Math.random() * 3; }
        }
        if (far < 90 || Math.random() < 0.5) w.ch.animate(far < 90 ? dt : dt * 2, { speed: w.sp });
      }
      const s2 = w.s; x = s2[0] + (s2[2] - s2[0]) * w.u; y = s2[1] + (s2[3] - s2[1]) * w.u;
      const h = Math.atan2((s2[2] - s2[0]) * w.dir, (s2[3] - s2[1]) * w.dir);
      w.ch.g.position.set(x, ground(x, y) + 0.05, -y); w.ch.g.rotation.y = Math.PI - h;
    }
    this.updateCamps(dt, px, py);
  }
  // ---------------------------------------------------------------- shelter under the downtown bridges
  updateCamps(dt, px, py) {
    if (Math.hypot(px - DOWNTOWN.x, py - DOWNTOWN.y) < DOWNTOWN.r + 600) {
      for (const t of this.tiles.tiles.values()) {
        const k = t.ix + '_' + t.iy;
        if (!t.group || t.lite || this.campTiles.has(k) || Math.hypot(t.ox + 250 - DOWNTOWN.x, t.oy + 250 - DOWNTOWN.y) > DOWNTOWN.r) continue;
        this.campTiles.add(k); this.makeCamps(t);
      }
    }
    this.near = null;
    for (const c of this.camps) {
      const d = Math.hypot(c.x - px, c.y - py);
      c.g.visible = d < 400;
      if (d < 120) for (const p of c.people) p.animate(dt, { sit: true });
      if (d < 3.5 && (!this.near || d < this.near.d)) this.near = { c, d };
    }
  }
  makeCamps(t) {
    const W = t.layers[L.WATER] || [], R = t.layers[L.ROAD] || [];
    const inWater = (x, y) => W.some(f => { const r = f.rings[0], n = r.length / 2; let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; });
    let made = 0;
    for (const f of R) {
      const r = f.rings[0]; if (!r.zr || made >= 2) continue;
      for (let i = 2; i < r.length / 2 - 2 && made < 2; i += 6) {
        if (r.zr[i] < 4.5) continue;
        const lx = r[i * 2], ly = r[i * 2 + 1], dx = r[i * 2 + 2] - r[i * 2 - 2], dy = r[i * 2 + 3] - r[i * 2 - 1], l = Math.hypot(dx, dy) || 1, off = f.a / 20 - 1.5;
        const x = lx + (-dy / l) * off, y = ly + (dx / l) * off;         // under the deck, near its edge
        if (inWater(x, y)) continue;
        const h = Math.abs(Math.sin(x * 12.9 + y * 78.2));
        if (h > 0.55) continue;                                           // not under every bridge
        if (this.camps.some(c => Math.hypot(c.x - x - t.ox, c.y - y - t.oy) < 80)) continue;
        this.addCamp(x + t.ox, y + t.oy, Math.atan2(dx, dy), h); made++;
      }
    }
  }
  addCamp(x, y, h, hs) {
    const g = new THREE.Group(), gy = ground(x, y); g.position.set(x, gy, -y); g.rotation.y = Math.PI - h;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 1.9), hs < 0.25 ? this.mat.bag2 : this.mat.bag); bag.position.set(1.2, 0.09, 0); g.add(bag);
    if (hs < 0.3) { const tent = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.3, 4, 1, true), this.mat.tent); tent.position.set(-1.4, 0.65, 0.3); tent.rotation.y = Math.PI / 4; g.add(tent); }
    if (hs > 0.15) { const cart = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.9), this.mat.cart); cart.position.set(0.2, 0.55, 1.4); g.add(cart); }
    const people = [];
    const n = hs < 0.2 ? 2 : 1;
    for (let i = 0; i < n; i++) { const ch = new Character(WORN[(Math.floor(hs * 10) + i) % WORN.length]); ch.g.position.set(0.3 - i * 0.8, 0, -0.6 + i * 0.4); ch.g.rotation.y = 0.4 - i * 0.8; g.add(ch.g); ch.animate(0.5, { sit: true }); people.push(ch); }
    this.scene.add(g);
    this.camps.push({ x, y, g, people, d: 0 });
  }
}
