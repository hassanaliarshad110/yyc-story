// Sports fields from the City of Calgary's open data (Parks Sport Surfaces): soccer fields with lines and goals,
// Canadian football fields with yard lines and goal posts, rugby H posts, cricket grounds with their boundary rope,
// and cricket pitches with creases and stumps. Built in cells near the player, like the park furniture.
import * as THREE from 'three';
import { ground } from './terrain.js?v=11112205';

let D = null;
export async function loadFields() {
  try {
    const r = await fetch('data/fields.wasm'); if (!r.ok) throw new Error(r.status);
    D = JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
  } catch (e) { console.warn('no field data', e); D = null; }
  return !!D;
}

const CELL = 300, LINE_Y = 0.06;
const WHITE = [0.95, 0.95, 0.93], YELLOW = [0.96, 0.8, 0.12];
const SURF = { 1: [0.24, 0.5, 0.26], 2: [0.62, 0.61, 0.58], 3: [0.72, 0.6, 0.44] };     // artificial turf, concrete, clay

class Geo {                    // positions + normals + colours, with a quad helper
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, col) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(...col); return this.p.length / 3 - 1; }
  quad(a, b, c, d, n, col, two = false) {
    const i0 = this.v(...a, ...n, col), i1 = this.v(...b, ...n, col), i2 = this.v(...c, ...n, col), i3 = this.v(...d, ...n, col);
    this.i.push(i0, i1, i2, i0, i2, i3); if (two) this.i.push(i0, i2, i1, i0, i3, i2);
  }
  box(cx, cy, cz, sx, sy, sz, col) {            // an axis-aligned box in three.js space
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col);
  }
  // a box between two points (a post, a bar)
  bar(ax, ay, az, bx, by, bz, t, col) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1;
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(dx, dy, dz), Math.abs(dy) / L > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    const g = new THREE.BoxGeometry(t, t, L); g.applyMatrix4(m); g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    const P = g.attributes.position, N = g.attributes.normal, I = g.index.array, base = this.p.length / 3;
    for (let k = 0; k < P.count; k++) this.v(P.getX(k), P.getY(k), P.getZ(k), N.getX(k), N.getY(k), N.getZ(k), col);
    for (const k of I) this.i.push(base + k);
  }
  mesh(mat) {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); return new THREE.Mesh(g, mat);
  }
}

export class Fields {
  constructor(scene, opts = {}) {
    this.scene = scene; this.R = opts.radius ?? 420; this.cells = new Map(); this.built = new Map(); this.t = 0;
    this.lineMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.netMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    this.stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    if (!D) return;
    for (const f of D.field) { const k = Math.floor(f[1] / CELL) + ',' + Math.floor(f[2] / CELL); let c = this.cells.get(k); if (!c) this.cells.set(k, c = []); c.push(f); }
  }
  // all the fields within r metres (for missions or the map)
  near(x, y, r = 200, type = null) { return D ? D.field.filter(f => (type == null || f[0] === type) && Math.hypot(f[1] - x, f[2] - y) < r) : []; }
  buildCell(list) {
    const g = new THREE.Group(), L = new Geo(), S = new Geo(), N = new Geo(), T = new Geo(), M = new Geo();
    for (const f of list) {
      const [type, cx, cy, len, wid, ang, surf] = f, ca = Math.cos(ang), sa = Math.sin(ang);
      const W = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
      const P3 = (u, v, h = 0) => { const [x, y] = W(u, v); return [x, ground(x, y) + h, -y]; };
      // a painted line from (u0,v0) to (u1,v1), cut into short pieces so it follows the ground
      const line = (u0, v0, u1, v1, w = 0.12, col = WHITE, G = L, h = LINE_Y) => {
        const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 6)), du = (u1 - u0) / n, dv = (v1 - v0) / n, l = Math.hypot(du, dv) || 1, pu = -dv / l * w / 2, pv = du / l * w / 2;
        for (let k = 0; k < n; k++) { const a0 = u0 + du * k, b0 = v0 + dv * k, a1 = a0 + du, b1 = b0 + dv; G.quad(P3(a0 - pu, b0 - pv, h), P3(a1 - pu, b1 - pv, h), P3(a1 + pu, b1 + pv, h), P3(a0 + pu, b0 + pv, h), [0, 1, 0], col); }
      };
      const arc = (uc, vc, r, a0, a1, w = 0.12) => { const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 1.5)); for (let k = 0; k < n; k++) { const t0 = a0 + (a1 - a0) * k / n, t1 = a0 + (a1 - a0) * (k + 1) / n; line(uc + Math.cos(t0) * r, vc + Math.sin(t0) * r, uc + Math.cos(t1) * r, vc + Math.sin(t1) * r, w); } };
      const rect = (u0, v0, u1, v1, w) => { line(u0, v0, u1, v0, w); line(u1, v0, u1, v1, w); line(u1, v1, u0, v1, w); line(u0, v1, u0, v0, w); };
      const fill = (u0, v0, u1, v1, col, G = L, h = 0.04) => { const nu = Math.max(1, Math.ceil((u1 - u0) / 8)), nv = Math.max(1, Math.ceil((v1 - v0) / 8)); for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a0 = u0 + (u1 - u0) * i / nu, a1 = u0 + (u1 - u0) * (i + 1) / nu, b0 = v0 + (v1 - v0) * j / nv, b1 = v0 + (v1 - v0) * (j + 1) / nv; G.quad(P3(a0, b0, h), P3(a1, b0, h), P3(a1, b1, h), P3(a0, b1, h), [0, 1, 0], col); } };
      const post = (u, v, h0, h1, t, col) => { const a = P3(u, v, h0), b = P3(u, v, h1); b[0] = a[0]; b[2] = a[2]; b[1] = a[1] + (h1 - h0); S.bar(a[0], a[1], a[2], b[0], b[1], b[2], t, col); };
      const crossbar = (u, v0, v1, h, t, col) => { const a = P3(u, v0), b = P3(u, v1), y = Math.max(a[1], b[1]) + h; S.bar(a[0], y, a[2], b[0], y, b[2], t, col); };
      const hu = len / 2, hv = wid / 2;
      if (type === 0 || type === 1 || type === 2 || type === 5) {
        if (SURF[surf]) fill(-hu, -hv, hu, hv, SURF[surf], T, 0.035);
        else { const band = Math.max(4, len / 14); for (let u = -hu, k = 0; u < hu - 0.01; u += band, k++) if (k % 2 === 0) fill(u, -hv, Math.min(hu, u + band), hv, WHITE, M, 0.03); }
        rect(-hu, -hv, hu, hv, 0.12);
      }
      if (type === 0) {                                          // soccer
        const s = Math.max(0.42, Math.min(1, len / 100)), gw = s > 0.8 ? 7.32 : s > 0.6 ? 5.5 : 3.7, gh = s > 0.8 ? 2.44 : s > 0.6 ? 2 : 1.3;
        line(0, -hv, 0, hv); arc(0, 0, Math.min(9.15 * s, hv * 0.4), 0, Math.PI * 2);
        for (const e of [-1, 1]) {
          const pd = 16.5 * s, pw = Math.min(40.3 * s, wid - 3) / 2, gd = 5.5 * s, gwid = Math.min(18.3 * s, wid - 6) / 2;
          rect(Math.min(e * hu, e * (hu - pd)), -pw, Math.max(e * hu, e * (hu - pd)), pw, 0.12);
          rect(Math.min(e * hu, e * (hu - gd)), -gwid, Math.max(e * hu, e * (hu - gd)), gwid, 0.12);
          arc(e * (hu - 11 * s), 0, 0.15, 0, Math.PI * 2, 0.28);
          // the goal: two posts, a crossbar and a net behind
          const gu = e * hu, back = e * (hu + 1.6 * Math.max(0.7, s));
          for (const v of [-gw / 2, gw / 2]) { post(gu, v, 0, gh, 0.12, WHITE); post(back, v, 0, gh * 0.6, 0.06, WHITE); }
          crossbar(gu, -gw / 2, gw / 2, gh, 0.12, WHITE);
          const a = P3(gu, -gw / 2), b = P3(gu, gw / 2), c = P3(back, gw / 2), d = P3(back, -gw / 2), y0 = Math.min(a[1], b[1]);
          N.quad([a[0], y0 + gh, a[2]], [b[0], y0 + gh, b[2]], [c[0], y0 + gh * 0.6, c[2]], [d[0], y0 + gh * 0.6, d[2]], [0, 1, 0], WHITE, true);
          N.quad([d[0], y0, d[2]], [c[0], y0, c[2]], [c[0], y0 + gh * 0.6, c[2]], [d[0], y0 + gh * 0.6, d[2]], [1, 0, 0], WHITE, true);
          for (const [p, q] of [[a, d], [b, c]]) N.quad([p[0], y0, p[2]], [q[0], y0, q[2]], [q[0], y0 + gh * 0.6, q[2]], [p[0], y0 + gh, p[2]], [0, 0, 1], WHITE, true);
        }
      } else if (type === 1) {                                   // Canadian football: yard lines every 5 yards, goal posts on the goal lines
        const s = Math.max(0.5, Math.min(1, len / 137)), ez = 18.3 * s, step = 4.57 * s;
        for (let u = -hu + ez; u <= hu - ez + 0.01; u += step) line(u, -hv, u, hv, Math.abs(u) < 0.5 ? 0.2 : 0.12);
        for (const e of [-1, 1]) {
          const gu = e * (hu - ez);
          post(gu, 0, 0, 3.05, 0.16, YELLOW); crossbar(gu, -2.82, 2.82, 3.05, 0.14, YELLOW);
          for (const v of [-2.82, 2.82]) post(gu, v, 3.05, 9.1, 0.11, YELLOW);
        }
      } else if (type === 2) {                                   // rugby: halfway, 22 m lines and H posts on the try lines
        const s = Math.max(0.5, Math.min(1, len / 100));
        line(0, -hv, 0, hv);
        for (const e of [-1, 1]) {
          line(e * (hu - 22 * s), -hv, e * (hu - 22 * s), hv);
          for (const v of [-2.8, 2.8]) post(e * hu, v, 0, 8, 0.14, WHITE);
          crossbar(e * hu, -2.8, 2.8, 3, 0.12, WHITE);
        }
      } else if (type === 5) {
        line(0, -hv, 0, hv);
      } else if (type === 3) {                                   // cricket ground: the boundary rope all the way round
        const r = f[7];
        if (r) for (let k = 0; k + 3 < r.length; k += 2) {
          const ax = r[k], ay = r[k + 1], bx = r[k + 2], by = r[k + 3], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.09, ny = dx / l * 0.09;
          const ga = ground(ax, ay) + 0.1, gb = ground(bx, by) + 0.1;
          S.quad([ax - nx, ga, -(ay - ny)], [bx - nx, gb, -(by - ny)], [bx + nx, gb, -(by + ny)], [ax + nx, ga, -(ay + ny)], [0, 1, 0], WHITE);
          S.quad([ax - nx, ga - 0.1, -(ay - ny)], [bx - nx, gb - 0.1, -(by - ny)], [bx - nx, gb, -(by - ny)], [ax - nx, ga, -(ay - ny)], [0, 0, 1], WHITE, true);
        }
      } else if (type === 4) {                                   // cricket pitch: the strip, creases and stumps at 22 yards
        const ml = Math.max(len, 22.5), mw = Math.max(Math.min(wid, 3.4), 2.6), col = SURF[surf] || SURF[3];
        fill(-ml / 2, -mw / 2, ml / 2, mw / 2, col, T, 0.045);
        const sd = 10.06;
        for (const e of [-1, 1]) {
          line(e * sd, -1.32, e * sd, 1.32, 0.07, WHITE, L, 0.055);                    // bowling crease
          line(e * (sd - 1.22), -mw / 2 - 0.3, e * (sd - 1.22), mw / 2 + 0.3, 0.07, WHITE, L, 0.055);   // popping crease
          for (const v of [-1.32, 1.32]) line(e * sd, v, e * (sd - 2.44), v, 0.07, WHITE, L, 0.055);      // return creases
          for (const v of [-0.11, 0, 0.11]) post(e * sd, v, 0.04, 0.75, 0.04, [0.93, 0.88, 0.74]);
          const a = P3(e * sd, -0.12), b = P3(e * sd, 0.12), y = Math.max(a[1], b[1]) + 0.77; S.bar(a[0], y, a[2], b[0], y, b[2], 0.025, [0.85, 0.7, 0.45]);
        }
      }
    }
    const add = (G, mat, ro, shadow) => { const m = G.mesh(mat); if (m) { m.renderOrder = ro; m.receiveShadow = true; m.castShadow = !!shadow; g.add(m); } };
    add(T, this.lineMat, 3); add(M, this.stripeMat, 3); add(L, this.lineMat, 4); add(S, this.mat, 0, true); add(N, this.netMat, 6);
    this.scene.add(g); return { g };
  }
  dispose(b) { this.scene.remove(b.g); b.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  update(dt, px, py) {
    if (!D || (this.t -= dt) > 0) return; this.t = 0.6;
    const R = this.R, cx = Math.floor(px / CELL), cy = Math.floor(py / CELL), n = Math.ceil(R / CELL), want = new Set();
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const k = (cx + i) + ',' + (cy + j); if (!this.cells.has(k)) continue;
      const mx = (cx + i + 0.5) * CELL, my = (cy + j + 0.5) * CELL; if (Math.hypot(mx - px, my - py) > R + CELL * 0.71) continue;
      want.add(k);
    }
    let made = 0;
    for (const k of want) if (!this.built.has(k) && made < 2) { this.built.set(k, this.buildCell(this.cells.get(k))); made++; }
    for (const [k, b] of this.built) if (!want.has(k)) { this.dispose(b); this.built.delete(k); }
  }
}

// ---------------------------------------------------------------- the fields on the maps (paths in map coordinates: x, -north)
let MP = null;
export const FIELD_ICON = ['⚽', '🏈', '🏉', '🏏', '🏏', '🏑'];
export function fieldMapPaths() {
  if (MP || !D) return MP;
  MP = { turf: new Path2D(), lines: new Path2D(), rope: new Path2D(), strip: new Path2D(), list: D.field };
  for (const f of D.field) {
    const [t, cx, cy, len, wid, ang] = f, ca = Math.cos(ang), sa = Math.sin(ang);
    const W = (u, v) => [cx + u * ca - v * sa, -(cy + u * sa + v * ca)];
    const rect = (p, hu, hv) => { const c = [W(-hu, -hv), W(hu, -hv), W(hu, hv), W(-hu, hv)]; p.moveTo(...c[0]); for (let i = 1; i < 4; i++) p.lineTo(...c[i]); p.closePath(); };
    if (t === 3) { const r = f[7]; if (r) { for (let k = 0; k < r.length; k += 2) k ? MP.rope.lineTo(r[k], -r[k + 1]) : MP.rope.moveTo(r[k], -r[k + 1]); MP.rope.closePath(); } }
    else if (t === 4) rect(MP.strip, Math.max(len, 22.5) / 2, 1.6);
    else { rect(MP.turf, len / 2, wid / 2); rect(MP.lines, len / 2, wid / 2); MP.lines.moveTo(...W(0, -wid / 2)); MP.lines.lineTo(...W(0, wid / 2)); }
  }
  return MP;
}
// draw them on a map canvas that is already scaled to metres (s = pixels per metre)
export function drawFieldsOnMap(g, s) {
  const P = fieldMapPaths(); if (!P) return;
  g.fillStyle = '#86c46e'; g.fill(P.turf);
  g.fillStyle = 'rgba(134,196,110,.55)'; g.fill(P.rope);
  g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.2, 1.4 / s); g.stroke(P.lines); g.stroke(P.rope);
  g.fillStyle = '#d8b98a'; g.fill(P.strip);
}
// emoji markers for the fields near (x, y), as [x, y, emoji]
export function fieldIcons(x, y, r) {
  if (!D) return [];
  const out = [];
  for (const f of D.field) if (f[0] !== 4 && Math.abs(f[1] - x) < r && Math.abs(f[2] - y) < r) out.push([f[1], f[2], FIELD_ICON[f[0]]]);
  return out;
}
