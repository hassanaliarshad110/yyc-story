// Cars on the real streets: keep right, follow the car ahead, stop at red lights and stop signs,
// take turns at intersections, and give way to bigger roads. Parked cars line residential streets.
import { makeCar } from './actors.js';
import { spinWheels } from './vehicles.js';
import { ground } from './terrain.js';
import { L } from './tiles.js';
import { dirOf, rotY, TYRE_Y } from './player.js';

const SPEED = { 1: 27, 2: 20, 3: 15, 4: 13.5, 5: 12, 6: 9, 7: 5.5, 8: 14, 9: 11, 10: 11 };
const DRIVE = new Set([1, 2, 3, 4, 5, 6, 8, 9]);
const GREEN = 18, AMBER = 3.5, ALLRED = 2;                 // signal timing, seconds
const CYCLE = 2 * (GREEN + AMBER + ALLRED);
const nkey = p => Math.round(p[0]) + ',' + Math.round(p[1]);

// closest distance between two car axes (centre, unit direction, half-length): returns d and the vector from B to A
function segClosest(ax, ay, afx, afy, ah, bx, by, bfx, bfy, bh) {
  let best = { d: 1e9, dx: 0, dy: 0 };
  const test = (px, py, qx, qy, qfx, qfy, qh, flip) => {
    let t = (px - qx) * qfx + (py - qy) * qfy; t = Math.max(-qh, Math.min(qh, t));
    const cx = qx + qfx * t, cy = qy + qfy * t, dx = (px - cx) * flip, dy = (py - cy) * flip, d = Math.hypot(dx, dy);
    if (d < best.d) best = { d, dx, dy };
  };
  for (const s of [-ah, 0, ah]) test(ax + afx * s, ay + afy * s, bx, by, bfx, bfy, bh, 1);
  for (const s of [-bh, 0, bh]) test(bx + bfx * s, by + bfy * s, ax, ay, afx, afy, ah, -1);
  return best;
}
export class Traffic {
  constructor(scene, tiles, world, opts = {}) {
    this.scene = scene; this.tiles = tiles; this.world = world;
    this.max = opts.max ?? 28; this.maxParked = opts.parked ?? 18;
    this.cars = []; this.pieces = []; this.ends = new Map(); this.nodes = new Map(); this.time = 0;
    this.groundY = () => 0;
    // traffic signals and stop signs from OpenStreetMap, in a 50 m grid
    this.ctrl = new Map();
    for (const c of world.ctrl || []) { const k = Math.floor(c[0] / 50) + ',' + Math.floor(c[1] / 50); let l = this.ctrl.get(k); if (!l) this.ctrl.set(k, l = []); l.push(c); }
  }
  ctrlNear(x, y, r) {
    let best = null, bd = r;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const c of this.ctrl.get((Math.floor(x / 50) + dx) + ',' + (Math.floor(y / 50) + dy)) || []) {
        const d = Math.hypot(c[0] - x, c[1] - y);
        if (d < bd && (!best || rank(c[2]) >= rank(best[2]))) { bd = d; best = c; }
      }
    }
    return best;
    function rank(t) { return t === 'signals' ? 3 : t === 'stop' ? 2 : 1; }
  }
  onTile(t, added) {
    if (added) {
      for (const f of (t.layers[L.ROAD] || [])) {
        if (!DRIVE.has(f.kind) || (f.flags & 4)) continue;
        const r = f.rings[0], n = r.length / 2; if (n < 2) continue;
        const pts = []; let len = 0;
        for (let i = 0; i < n; i++) { const p = [r[i * 2] + t.ox, r[i * 2 + 1] + t.oy]; if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); pts.push(p); }
        if (len < 0.5) continue;
        const piece = { pts, len, kind: f.kind, oneway: !!(f.flags & 1), w: f.a / 10, tile: t, name: f.name, zs: r.z || null };
        this.pieces.push(piece);
        for (const [end, p] of [[0, pts[0]], [1, pts[n - 1]]]) { const k = nkey(p); let l = this.ends.get(k); if (!l) this.ends.set(k, l = []); l.push([piece, end]); }
      }
      this.nodes.clear();      // rebuilt lazily
    } else {
      this.pieces = this.pieces.filter(p => p.tile !== t);
      for (const [k, l] of this.ends) { const m = l.filter(([p]) => p.tile !== t); if (m.length) this.ends.set(k, m); else this.ends.delete(k); }
      for (const c of this.cars) if (c.piece && c.piece.tile === t && !c.player) c.dead = true;
      this.nodes.clear();
    }
  }
  // an intersection: where three or more road pieces meet (pieces cut at tile edges don't count)
  node(k) {
    let n = this.nodes.get(k);
    if (n) return n;
    const list = (this.ends.get(k) || []).filter(([p]) => DRIVE.has(p.kind));
    const [x, y] = k.split(',').map(Number);
    n = { k, x, y, deg: list.length, holder: null, holdT: 0, type: 'none', axis: 0, offset: 0, maxKind: 9 };
    if (list.length >= 3) {
      const c = this.ctrlNear(x, y, 28);
      n.type = c ? c[2] : 'yield';
      n.maxKind = Math.min(...list.map(([p]) => p.kind));
      const [p0, e0] = list[0], a = e0 === 0 ? p0.pts[1] : p0.pts[p0.pts.length - 2];
      n.axis = Math.atan2(a[0] - x, a[1] - y);
      n.offset = ((x * 7.13 + y * 3.71) % CYCLE + CYCLE) % CYCLE;
    }
    this.nodes.set(k, n); return n;
  }
  // which approach group (0 or 1) a heading belongs to at a signal
  group(n, h) { const d = Math.abs(Math.sin(h - n.axis)); return d < 0.7071 ? 0 : 1; }
  light(n, grp) {
    const t = (this.time + n.offset) % CYCLE, half = GREEN + AMBER + ALLRED;
    const tt = grp === 0 ? t : (t + half) % CYCLE;
    return tt < GREEN ? 'green' : tt < GREEN + AMBER ? 'amber' : 'red';
  }
  spawn(px, py) {
    if (!this.pieces.length) return;
    for (let tries = 0; tries < 14; tries++) {
      const p = this.pieces[Math.random() * this.pieces.length | 0];
      if (p.kind === 7) continue;
      const mid = p.pts[p.pts.length >> 1], d = Math.hypot(mid[0] - px, mid[1] - py);
      if (d < 80 || d > 380) continue;
      const dir = p.oneway ? 1 : (Math.random() < 0.5 ? 1 : -1);
      const r0 = Math.random(), cops = this.cars.reduce((n, c) => n + (c.mesh.userData.police ? 1 : 0), 0), car = { mesh: makeCar(cops < 2 || r0 < 0.06 ? 'police' : r0 < 0.22 ? 'truck' : Math.random() < 0.35 ? 'suv' : 'car'), piece: p, dir, s: Math.random() * p.len, v: SPEED[p.kind] * 0.7, x: 0, y: 0, h: 0, gy: 0, wait: 0 };
      this.place(car);
      if (this.cars.some(o => Math.hypot(o.x - car.x, o.y - car.y) < 12)) continue;      // never spawn on top of another car
      car.mesh.position.y = car.gy + TYRE_Y;
      this.scene.add(car.mesh); this.cars.push(car); return;
    }
  }
  spawnParked(px, py) {
    for (let tries = 0; tries < 12; tries++) {
      const p = this.pieces[Math.random() * this.pieces.length | 0];
      if (!p || ![5, 6].includes(p.kind) || p.oneway) continue;
      const mid = p.pts[p.pts.length >> 1], d = Math.hypot(mid[0] - px, mid[1] - py);
      if (d < 25 || d > 220) continue;
      const r1 = Math.random(), car = { mesh: makeCar(r1 < 0.15 ? 'bike' : r1 < 0.19 ? 'police' : Math.random() < 0.1 ? 'truck' : 'car'), piece: p, dir: Math.random() < 0.5 ? 1 : -1, s: 10 + Math.random() * Math.max(1, p.len - 20), v: 0, parked: true, x: 0, y: 0, h: 0, gy: 0 };
      if (p.len < 30) continue;
      this.place(car, p.w / 2 - 1.1);          // at the curb, inside the road
      if (this.tiles.collide(car.x, car.y, 1.1).hit || this.cars.some(o => Math.hypot(o.x - car.x, o.y - car.y) < 7)) continue;
      car.mesh.position.y = car.gy + TYRE_Y;
      this.scene.add(car.mesh); this.cars.push(car); return;
    }
  }
  // a point along a road piece in the car's lane: s metres from the start in the direction of travel
  pathAt(p, dir, s, side) {
    s = Math.max(0, Math.min(p.len, s)); const ss = dir > 0 ? s : p.len - s;
    let acc = 0;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + l >= ss || i === p.pts.length - 1) {
        const u = l ? Math.min(1, Math.max(0, (ss - acc) / l)) : 0;
        let h = Math.atan2(b[0] - a[0], b[1] - a[1]); if (dir < 0) h += Math.PI;
        const off = side ?? (p.oneway ? 0 : Math.max(1.8, p.w / 4));
        const z = p.zs ? p.zs[i - 1] + (p.zs[i] - p.zs[i - 1]) * u : null;
        const [dx, dy] = dirOf(h);
        return { x: a[0] + (b[0] - a[0]) * u + dy * off, y: a[1] + (b[1] - a[1]) * u - dx * off, h, z };   // keep right
      }
      acc += l;
    }
    return { x: p.pts[0][0], y: p.pts[0][1], h: 0, z: null };
  }
  // the curve a car follows through an intersection: from R metres before the corner to R metres into the next road
  turnCurve(c) {
    const p = c.piece, [q, e] = c.next, qd = e === 0 ? 1 : -1, R = Math.min(9, p.len * 0.45, q.len * 0.45);
    return { R, P0: this.pathAt(p, c.dir, p.len - R), P1: this.pathAt(p, c.dir, p.len), P2: this.pathAt(q, qd, R) };
  }
  place(car, side) {
    const p = car.piece;
    let pt = this.pathAt(p, car.dir, car.s, side), T = null, t = 0;
    if (side == null && !car.parked) {
      if (car.next && p.len - car.s < (car.turnR ?? 9)) { T = car.turn || (car.turn = this.turnCurve(car)); car.turnR = T.R; t = (T.R - (p.len - car.s)) / (2 * T.R); }
      else if (car.prevTurn && car.s < car.prevTurn.R) { T = car.prevTurn; t = 0.5 + car.s / (2 * T.R); }
      else car.prevTurn = null;
    }
    if (T && t >= 0 && t <= 1) {            // smooth arc round the corner (a quadratic curve), facing along it
      const u = 1 - t, A = T.P0, B = T.P1, C = T.P2;
      const x = u * u * A.x + 2 * u * t * B.x + t * t * C.x, y = u * u * A.y + 2 * u * t * B.y + t * t * C.y;
      const tx = 2 * u * (B.x - A.x) + 2 * t * (C.x - B.x), ty = 2 * u * (B.y - A.y) + 2 * t * (C.y - B.y);
      pt = { x, y, h: Math.hypot(tx, ty) > 1e-4 ? Math.atan2(tx, ty) : pt.h, z: pt.z };
    }
    if (!car.placed) { car.x = pt.x; car.y = pt.y; car.h = pt.h; car.placed = true; }
    else {   // gentle through bends
      const k = T ? 0.6 : 0.35;
      car.x += (pt.x - car.x) * k; car.y += (pt.y - car.y) * k;
      const dh = Math.atan2(Math.sin(pt.h - car.h), Math.cos(pt.h - car.h)); car.h += dh * k;
    }
    car.gy = pt.z != null ? pt.z : ground(car.x, car.y);
    car.mesh.position.set(car.x, car.gy + TYRE_Y, -car.y); car.mesh.rotation.y = rotY(car.h);
    car.steer = T ? Math.max(-0.5, Math.min(0.5, Math.atan2(Math.sin(pt.h - (car.lastH ?? pt.h)), 1) * 8)) : 0; car.lastH = pt.h;
  }
  endKey(car) { const p = car.piece; return nkey(car.dir > 0 ? p.pts[p.pts.length - 1] : p.pts[0]); }
  pickNext(car) {
    const p = car.piece, k = this.endKey(car);
    const opts = (this.ends.get(k) || []).filter(([q, e]) => q !== p && DRIVE.has(q.kind) && !(q.oneway && e === 1));
    if (!opts.length) return null;
    const hIn = car.h;
    const score = ([q, e]) => {
      const pts = q.pts, a = e === 0 ? pts[0] : pts[pts.length - 1], b = e === 0 ? pts[1] : pts[pts.length - 2];
      const h = Math.atan2(b[0] - a[0], b[1] - a[1]); const d = Math.abs(Math.atan2(Math.sin(h - hIn), Math.cos(h - hIn)));
      if (d > 2.6) return 99;                       // no U-turns
      return d * 0.8 + Math.abs(q.kind - p.kind) * 0.25 + Math.random() * 1.0;
    };
    opts.sort((a, b) => score(a) - score(b));
    return score(opts[0]) >= 99 ? null : opts[0];
  }
  update(dt, player) {
    this.time += dt;
    const px = player.x, py = player.y;
    const moving = this.cars.filter(c => !c.parked && !c.player).length, parked = this.cars.filter(c => c.parked).length;
    if (moving < this.max && Math.random() < 0.4) this.spawn(px, py);
    if (parked < this.maxParked && Math.random() < 0.25) this.spawnParked(px, py);
    // the buses on the road: three points along each, so cars stop behind them and never drive through one
    this.busPts = [];
    for (const v of (this.transit && this.transit.vehicles) || []) if (!v.rail) for (const m of v.parts) { const bx = m.position.x, by = -m.position.z, h = Math.PI - m.rotation.y, hx = Math.sin(h), hy = Math.cos(h); for (const k of [-4.5, 0, 4.5]) this.busPts.push([bx + hx * k, by + hy * k, 1.7]); }
    for (const c of this.cars) {
      if (c.player || c.dead) continue;
      if (Math.hypot(c.x - px, c.y - py) > 480) { c.dead = true; continue; }
      if (c.parked) continue;
      const p = c.piece, toEnd = p.len - c.s;
      let target = SPEED[p.kind];
      if (p.len < 200 && toEnd < 25) target = Math.min(target, 9);
      // the intersection ahead
      const k = this.endKey(c), n = this.node(k);
      if (!c.next && toEnd < 12) c.next = this.pickNext(c);
      if (n.deg >= 3) {
        if (!c.next) c.next = this.pickNext(c);
        const stopAt = Math.max(0, toEnd - 7);     // stop line, 7 m before the middle of the intersection
        let mustStop = false;
        if (n.holder && n.holder !== c && !n.holder.dead) {
          // someone is in the intersection: wait unless they are on the same green and going the same way
          if (!(n.type === 'signals' && this.group(n, n.holder.h) === this.group(n, c.h))) mustStop = true;
        }
        if (n.type === 'signals') {
          const st = this.light(n, this.group(n, c.h));
          if (st === 'red' || (st === 'amber' && stopAt > 12)) mustStop = true;
        } else if (n.type === 'stop' || n.type === 'give_way' || (n.type === 'yield' && p.kind > n.maxKind)) {
          if (!c.stopped && n.type === 'stop') mustStop = true;           // a full stop first
          if (n.holder && n.holder !== c) mustStop = true;
        }
        if (mustStop) {
          target = Math.min(target, stopAt < 0.8 ? 0 : Math.sqrt(2 * 5 * stopAt));
          if (stopAt < 1.5 && c.v < 0.3) { c.waitT = (c.waitT || 0) + dt; if (c.waitT > 1.5) c.stopped = true; }
          if (c.waitT > 25) { c.dead = true; continue; }                  // give up (despawn) rather than block forever
        } else if (toEnd < 9 && !n.holder) { n.holder = c; n.holdT = 0; }
      }
      // follow the car ahead, and stop for the player
      const [fx, fy] = dirOf(c.h);
      const blockers = [[px, py, player.mode === 'car' ? 2.2 : 1.2]];
      for (const o of this.cars) if (o !== c && !o.dead && Math.abs(o.x - c.x) < 22 && Math.abs(o.y - c.y) < 22) blockers.push([o.x, o.y, 1.4]);
      for (const b of this.busPts || []) if (Math.abs(b[0] - c.x) < 24 && Math.abs(b[1] - c.y) < 24) blockers.push(b);        // buses (and their length)
      for (const [bx, by, br] of blockers) {
        const rx = bx - c.x, ry = by - c.y, ahead = rx * fx + ry * fy, lat = Math.abs(rx * fy - ry * fx);
        if (ahead > 0 && ahead < 20 && lat < br + 1.0) target = Math.min(target, Math.max(0, (ahead - 7) * 1.1));
      }
      c.v += Math.max(-9 * dt, Math.min(3 * dt, target - c.v));
      if (c.v < 0) c.v = 0;
      c.s += c.v * dt;
      if (c.s > p.len) {
        const nx = c.next || this.pickNext(c);
        if (!nx) { c.dead = true; continue; }
        if (n.holder === c) setTimeout(() => { if (n.holder === c) n.holder = null; }, 900);
        c.next = nx; c.prevTurn = c.turn || this.turnCurve(c); c.turn = null; c.turnR = null;
        const [q, e] = nx; c.s -= p.len; c.piece = q; c.dir = e === 0 ? 1 : -1; c.next = null; c.stopped = false; c.waitT = 0;
      }
      this.place(c); spinWheels(c.mesh, c.v * dt, c.steer || 0);
      // ground height (photo mode) every few frames
      c.mesh.position.y = c.gy + TYRE_Y;
    }
    for (const n of this.nodes.values()) if (n.holder && (n.holder.dead || (n.holdT += dt) > 8)) n.holder = null;
    // the player bumping into traffic: cars are capsules along their length; push apart sideways and only slow
    // the speed going into the other car, so you can always steer or reverse away
    if (player.mode !== 'ride') {
      const pc = player.mode === 'car' && player.car, pL = pc ? (pc.mesh.userData.L || 4.5) : 0.5, pW = pc ? (pc.mesh.userData.W || 1.85) : 0.6;
      const [pfx, pfy] = dirOf(player.h);
      for (const c of this.cars) {
        if (c.player || c.dead) continue;
        if (Math.abs(c.x - player.x) > 12 || Math.abs(c.y - player.y) > 12) continue;
        const u = c.mesh.userData, cL = u.L || 4.5, cW = u.W || 1.85, [cfx, cfy] = dirOf(c.h);
        const a = segClosest(player.x, player.y, pfx, pfy, Math.max(0, pL / 2 - pW / 2), c.x, c.y, cfx, cfy, Math.max(0, cL / 2 - cW / 2));
        const R = (pW + cW) / 2 * 0.95;
        if (a.d < R) {
          let nx = a.dx, ny = a.dy, d = a.d; if (d < 0.01) { nx = player.x - c.x; ny = player.y - c.y; d = Math.hypot(nx, ny) || 1; }
          nx /= d; ny /= d;
          const push = R - a.d; player.x += nx * push; player.y += ny * push;
          if (!pc && c.v > 2.5 && this.onHitPlayer) this.onHitPlayer(c.v, nx, ny);        // a moving car hits you on foot
          if (pc) { const into = -(pfx * nx + pfy * ny) * Math.sign(player.v); if (into > 0.3 && Math.abs(player.v) > 2) { player.v *= 0.55; if (player.onCrash) player.onCrash(); } }
        }
      }
    }
    for (const c of this.cars) if (c.dead) { this.scene.remove(c.mesh); if (!c.mesh.userData.model) c.mesh.traverse(o => o.geometry && o.geometry.dispose()); for (const n of this.nodes.values()) if (n.holder === c) n.holder = null; }
    this.cars = this.cars.filter(c => !c.dead);
  }
  nearestCar(x, y, maxD = 4.5) {
    let best = null, bd = maxD;
    for (const c of this.cars) { if (c.player) continue; const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  take(car) { car.parked = true; car.player = true; }
  release(car) { car.player = false; car.parked = true; }
  // signal states near a point (for drawing traffic lights)
  signalsNear(x, y, r = 250) {
    const out = [];
    for (const n of this.nodes.values()) if (n.type === 'signals' && Math.abs(n.x - x) < r && Math.abs(n.y - y) < r) out.push(n);
    return out;
  }
}
