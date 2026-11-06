// Calgary Transit buses and CTrains on their real routes (City of Calgary timetable shapes).
import * as THREE from 'three';
import { makeBus, makeTrain } from './actors.js';
import { rotY } from './player.js';

export class Path {
  constructor(pts) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  at(s) {
    s = Math.max(0, Math.min(this.len, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    const a = this.pts[lo], b = this.pts[hi], l = this.cum[hi] - this.cum[lo] || 1, u = (s - this.cum[lo]) / l;
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, h: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  }
  project(x, y) {      // nearest distance along the path and how far away the point is
    let best = 1e12, bs = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
      let u = ((x - a[0]) * dx + (y - a[1]) * dy) / L2; u = Math.max(0, Math.min(1, u));
      const d = (x - a[0] - dx * u) ** 2 + (y - a[1] - dy * u) ** 2;
      if (d < best) { best = d; bs = this.cum[i - 1] + Math.sqrt(L2) * u; }
    }
    return { s: bs, d: Math.sqrt(best) };
  }
}

export class Transit {
  constructor(scene, world, opts = {}) {
    this.scene = scene; this.world = world; this.vehicles = []; this.maxBus = opts.bus ?? 4; this.maxTrain = opts.train ?? 2;
    this.paths = [];
    for (const r of world.routes) for (const sh of r.shapes) {
      const p = new Path(sh); p.route = r; p.rail = r.t === '0' || r.t === '1' || r.t === '2';
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of sh) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      p.bb = [x0, y0, x1, y1]; this.paths.push(p);
    }
    this.ride = null; this.groundY = () => 0;
  }
  stopsOn(path) {       // stops within 25 m of the path, in order
    if (path.stops) return path.stops;
    const [x0, y0, x1, y1] = path.bb, out = [];
    for (const s of this.world.stops) {
      if (s[0] < x0 - 30 || s[0] > x1 + 30 || s[1] < y0 - 30 || s[1] > y1 + 30) continue;
      const pr = path.project(s[0], s[1]); if (pr.d < (path.rail ? 45 : 25)) out.push({ s: pr.s, x: s[0], y: s[1], name: s[2], code: s[3] });
    }
    out.sort((a, b) => a.s - b.s);
    const dedup = []; for (const o of out) if (!dedup.length || o.s - dedup[dedup.length - 1].s > 40) dedup.push(o);
    return path.stops = dedup;
  }
  spawnNear(px, py, rail) {
    const cands = this.paths.filter(p => p.rail === rail && px > p.bb[0] - 400 && px < p.bb[2] + 400 && py > p.bb[1] - 400 && py < p.bb[3] + 400);
    for (let t = 0; t < 6 && cands.length; t++) {
      const p = cands[Math.random() * cands.length | 0];
      const pr = p.project(px, py); if (pr.d > 350) continue;
      const s = pr.s + (Math.random() < 0.5 ? -1 : 1) * (150 + Math.random() * 200);
      if (s < 0 || s > p.len) continue;
      this.add(p, s); return;
    }
  }
  add(path, s, opts = {}) {
    const rail = path.rail;
    const parts = rail ? [0, 1, 2].map(() => makeTrain(1, path.route.n)) : [makeBus(path.route.r + ' ' + (path.route.n || '').split('/')[0].slice(0, 9))];
    parts.forEach(m => this.scene.add(m));
    const v = { path, s, parts, rail, v: rail ? 16 : 10, wait: 0, stops: this.stopsOn(path), nextStop: 0, ...opts };
    v.nextStop = v.stops.findIndex(st => st.s > s + 5); if (v.nextStop < 0) v.nextStop = v.stops.length;
    this.vehicles.push(v); this.place(v); return v;
  }
  place(v, dt = 0) {
    const a = v.path.at(v.s); v.x = a.x; v.y = a.y; v.h = a.h;
    if (v.gy == null || (v.gt = (v.gt || 0) - dt) <= 0) { v.gt = 0.4; const g = this.groundY(v.x, v.y, v.gy ?? null); if (g != null) v.gy = g; else if (v.gy == null) v.gy = 0; }
    v.parts.forEach((m, i) => {
      const b = i ? v.path.at(v.s - i * 25.1 - (v.rail ? 12 : 0)) : a;
      m.position.set(b.x, v.gy, -b.y); m.rotation.y = rotY(b.h);
    });
  }
  update(dt, px, py) {
    const buses = this.vehicles.filter(v => !v.rail && !v.mission).length, trains = this.vehicles.filter(v => v.rail && !v.mission).length;
    if (buses < this.maxBus && Math.random() < 0.02) this.spawnNear(px, py, false);
    if (trains < this.maxTrain && Math.random() < 0.01) this.spawnNear(px, py, true);
    for (const v of this.vehicles) {
      const fast = v.fast || 1;
      if (v.wait > 0) { v.wait -= dt * fast; continue; }
      const st = v.stops[v.nextStop];
      let target = v.rail ? 17 : 11;
      if (st) { const d = st.s - v.s; if (d < 30) target = Math.max(1.5, d * 0.5); if (d < 1) { v.s = st.s; v.wait = v.holdAt === v.nextStop ? 1e9 : (v.rail ? 12 : 6); v.nextStop++; if (v.onStop) v.onStop(st, v.nextStop - 1); } }
      v.v += Math.max(-6 * dt, Math.min(2 * dt, target - v.v)) * fast;
      v.s += v.v * dt * fast;
      if (v.s >= v.path.len) { v.done = true; if (v.onEnd) v.onEnd(); }
      this.place(v, dt);
      if (!v.mission && Math.hypot(v.x - px, v.y - py) > 700) v.done = true;
    }
    for (const v of this.vehicles) if (v.done && !v.keep) v.parts.forEach(m => this.scene.remove(m));
    this.vehicles = this.vehicles.filter(v => !v.done || v.keep);
  }
  // the best path for a route between two points (right direction)
  findPath(route, from, to) {
    let best = null;
    for (const p of this.paths) {
      if (p.route.r !== String(route)) continue;
      const a = p.project(from[0], from[1]), b = p.project(to[0], to[1]);
      if (b.s <= a.s) continue;
      const sc = a.d + b.d;
      if (!best || sc < best.sc) best = { p, a, b, sc };
    }
    return best;
  }
}
