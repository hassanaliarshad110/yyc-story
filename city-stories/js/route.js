// GPS navigation: shortest drive (or walk) along the real road network to the waypoint or mission goal.
// Graph from tools/build_route.py (data/route.wasm): junction nodes, edges with their road shape.

let R = null, loading = null;

export function loadRoute() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await fetch('data/route.wasm'); if (!r.ok) return null;
      const buf = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      R = parse(buf);
    } catch (e) { console.warn('route graph', e); R = null; }
    return R;
  })();
  return loading;
}

function parse(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x31525959) throw new Error('bad route file');     // 'YYR1'
  const nn = dv.getUint32(4, true), ne = dv.getUint32(8, true), np = dv.getUint32(12, true);
  let o = 16;
  const nodes = new Int32Array(buf, o, nn * 2); o += nn * 8;
  const ea = new Uint32Array(buf, o, ne); o += ne * 4;
  const eb = new Uint32Array(buf, o, ne); o += ne * 4;
  const elen = new Float32Array(buf, o, ne); o += ne * 4;
  const ek = new Uint8Array(buf, o, ne); o += ne;
  const ef = new Uint8Array(buf, o, ne); o += ne; o += (-o & 3);
  const gs = new Uint32Array(buf, o, ne); o += ne * 4;
  const gn = new Uint16Array(buf, o, ne); o += ne * 2; o += (-o & 3);
  const pts = new Int32Array(buf, o, np * 2);
  // adjacency (both directions; one-way checked while searching)
  const cnt = new Uint32Array(nn + 1);
  for (let e = 0; e < ne; e++) { cnt[ea[e] + 1]++; cnt[eb[e] + 1]++; }
  for (let i = 0; i < nn; i++) cnt[i + 1] += cnt[i];
  const adjE = new Uint32Array(ne * 2), fill = cnt.slice(0, nn);
  for (let e = 0; e < ne; e++) { adjE[fill[ea[e]]++] = e; adjE[fill[eb[e]]++] = e; }
  // spatial grid of edges, 100 m cells
  const CELL = 100, grid = new Map();
  const R0 = { nn, ne, nodes, ea, eb, elen, ek, ef, gs, gn, pts, off: cnt, adjE, grid, CELL };
  for (let e = 0; e < ne; e++) {
    const P = shape(R0, e), seen = new Set();
    for (let i = 0; i + 3 < P.length; i += 2) {
      const ax = P[i], ay = P[i + 1], bx = P[i + 2], by = P[i + 3], l = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(l / 40));
      for (let j = 0; j <= k; j++) {
        const x = ax + (bx - ax) * j / k, y = ay + (by - ay) * j / k, key = Math.floor(x / CELL) * 65536 + Math.floor(y / CELL);
        if (seen.has(key)) continue; seen.add(key);
        let c = grid.get(key); if (!c) grid.set(key, c = []); c.push(e);
      }
    }
  }
  return R0;
}

// the edge's full line in metres: a, shape points, b
function shape(G, e) {
  const n = G.gn[e], out = new Float64Array((n + 2) * 2), a = G.ea[e], b = G.eb[e], s = G.gs[e];
  out[0] = G.nodes[a * 2] / 10; out[1] = G.nodes[a * 2 + 1] / 10;
  for (let i = 0; i < n; i++) { out[2 + i * 2] = G.pts[(s + i) * 2] / 10; out[3 + i * 2] = G.pts[(s + i) * 2 + 1] / 10; }
  out[2 + n * 2] = G.nodes[b * 2] / 10; out[3 + n * 2] = G.nodes[b * 2 + 1] / 10;
  return out;
}

// nearest point on the network: edge, segment, the point, metres along the edge from a
function snap(G, x, y, car) {
  let best = null, bd = Infinity;
  for (let ring = 0; ring <= 6 && (!best || bd > (ring * G.CELL) ** 2); ring++) {
    const cx = Math.floor(x / G.CELL), cy = Math.floor(y / G.CELL);
    for (let gx = cx - ring; gx <= cx + ring; gx++) for (let gy = cy - ring; gy <= cy + ring; gy++) {
      if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== ring) continue;
      const c = G.grid.get(gx * 65536 + gy); if (!c) continue;
      for (const e of c) {
        if (car && G.ek[e] === 10) continue;               // busways
        const P = shape(G, e); let along = 0;
        for (let i = 0; i + 3 < P.length; i += 2) {
          const ax = P[i], ay = P[i + 1], dx = P[i + 2] - ax, dy = P[i + 3] - ay, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const px = ax + dx * t, py = ay + dy * t, d = (px - x) ** 2 + (py - y) ** 2;
          if (d < bd) { bd = d; best = { e, seg: i / 2, x: px, y: py, along: along + l * t, P }; }
          along += l;
        }
      }
    }
  }
  if (best) { best.d = Math.sqrt(bd); best.len = G.elen[best.e]; }
  return best;
}

// how much a metre of each road class costs (faster roads are cheaper)
const CAR = [1, 0.55, 0.6, 0.7, 0.78, 0.86, 1, 1.6, 0.62, 0.75, 99];
const WALK = [1, 9, 3, 1.3, 1.15, 1.05, 1, 1, 9, 3, 99];

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(k, v) { const K = this.k, V = this.v; let i = K.length; K.push(k); V.push(v); while (i) { const p = (i - 1) >> 1; if (K[p] <= k) break; K[i] = K[p]; V[i] = V[p]; i = p; } K[i] = k; V[i] = v; }
  pop() {
    const K = this.k, V = this.v, top = V[0], k = K.pop(), v = V.pop(), n = K.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= k) break; K[i] = K[c]; V[i] = V[c]; i = c; } K[i] = k; V[i] = v; }
    return top;
  }
  get size() { return this.k.length; }
}

// points (metres) from (sx, sy) to (tx, ty) along roads; null if no path
export function findRoute(sx, sy, tx, ty, car = true) {
  const G = R; if (!G) return null;
  const A = snap(G, sx, sy, car), B = snap(G, tx, ty, car); if (!A || !B) return null;
  const W = car ? CAR : WALK, cost = e => G.elen[e] * W[G.ek[e]];
  const can = (e, from) => !car || !G.ef[e] || G.ea[e] === from;       // one way: only a -> b
  const nn = G.nn, dist = new Float64Array(nn).fill(Infinity), prevE = new Int32Array(nn).fill(-1), done = new Uint8Array(nn);
  const tnx = B.x, tny = B.y, hmin = car ? 0.55 : 1, h = n => Math.hypot(G.nodes[n * 2] / 10 - tnx, G.nodes[n * 2 + 1] / 10 - tny) * hmin;
  const heap = new Heap();
  const fA = A.len > 0 ? A.along / A.len : 0, wA = W[G.ek[A.e]];
  // start: drive from the snapped point to either end of its edge (if one way allows)
  const seed = (n, c) => { if (c < dist[n]) { dist[n] = c; prevE[n] = -2; heap.push(c + h(n), n); } };
  if (!car || !G.ef[A.e]) seed(G.ea[A.e], A.along * wA);
  seed(G.eb[A.e], (A.len - A.along) * wA);
  // goal: reached through either end of B's edge
  const fB = B.len > 0 ? B.along / B.len : 0, wB = W[G.ek[B.e]];
  const endA = G.ea[B.e], endB = G.eb[B.e];
  let bestEnd = -1, bestC = Infinity;
  // same edge, straight along it
  let direct = Infinity;
  if (A.e === B.e && (!car || !G.ef[A.e] || B.along >= A.along)) direct = Math.abs(B.along - A.along) * wA;
  let it = 0;
  while (heap.size && it++ < 400000) {
    const n = heap.pop(); if (done[n]) continue; done[n] = 1;
    const c = dist[n];
    if (c + h(n) >= Math.min(bestC, direct)) break;
    if (n === endA) { const t = c + B.along * wB; if (t < bestC) { bestC = t; bestEnd = n; } }
    if (n === endB && (!car || !G.ef[B.e])) { const t = c + (B.len - B.along) * wB; if (t < bestC) { bestC = t; bestEnd = n; } }
    for (let k = G.off[n]; k < G.off[n + 1]; k++) {
      const e = G.adjE[k]; if (!can(e, n)) continue;
      if (car && G.ek[e] === 10) continue;
      const m = G.ea[e] === n ? G.eb[e] : G.ea[e], nc = c + cost(e);
      if (nc < dist[m]) { dist[m] = nc; prevE[m] = e; heap.push(nc + h(m), m); }
    }
  }
  void fA; void fB;
  const out = [sx, sy];
  if (direct <= bestC) {
    pushPart(out, A, A.along, B.along); out.push(tx, ty); return finish(out);
  }
  if (bestEnd < 0) return null;
  // walk back from the end node to the start edge
  const chain = []; let n = bestEnd;
  while (prevE[n] >= 0) { const e = prevE[n]; chain.push([e, n]); n = G.ea[e] === n ? G.eb[e] : G.ea[e]; }
  // n is now the end of A's edge we left by
  pushPart(out, A, A.along, n === G.ea[A.e] ? 0 : A.len);
  for (let i = chain.length - 1; i >= 0; i--) {
    const [e, to] = chain[i], P = shape(G, e), fwd = G.eb[e] === to, m = P.length / 2;
    for (let j = 1; j < m; j++) { const q = fwd ? j : m - 1 - j; out.push(P[q * 2], P[q * 2 + 1]); }
  }
  pushPart(out, B, bestEnd === G.ea[B.e] ? 0 : B.len, B.along);
  out.push(tx, ty);
  return finish(out);
}

// the part of a snapped edge between two distances along it
function pushPart(out, S, from, to) {
  const P = S.P, m = P.length / 2, cum = [0];
  for (let i = 1; i < m; i++) cum.push(cum[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]));
  const at = d => { for (let i = 1; i < m; i++) if (cum[i] >= d || i === m - 1) { const l = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (d - cum[i - 1]) / l)); return [P[i * 2 - 2] + (P[i * 2] - P[i * 2 - 2]) * t, P[i * 2 - 1] + (P[i * 2 + 1] - P[i * 2 - 1]) * t]; } return [P[0], P[1]]; };
  out.push(...at(from));
  if (from <= to) { for (let i = 1; i < m - 1; i++) if (cum[i] > from && cum[i] < to) out.push(P[i * 2], P[i * 2 + 1]); }
  else { for (let i = m - 2; i >= 1; i--) if (cum[i] < from && cum[i] > to) out.push(P[i * 2], P[i * 2 + 1]); }
  out.push(...at(to));
}

function finish(out) {
  const a = new Float32Array(out); let len = 0;
  for (let i = 2; i < a.length; i += 2) len += Math.hypot(a[i] - a[i - 2], a[i + 1] - a[i - 1]);
  return { pts: a, len };
}

// keeps a route to the current target fresh as the player moves
export class Navigator {
  constructor() { this.route = null; this.key = ''; this.t = 0; this.prog = 0; this.ver = 0; }
  clear() { this.route = null; this.key = ''; }
  update(dt, player, target) {
    if (!target || player.mode === 'heli' || player.mode === 'ride') { if (this.route) this.ver++; this.route = null; this.key = ''; return; }
    if (!R) { loadRoute(); return; }
    const car = player.mode === 'car', key = `${target.x.toFixed(0)},${target.y.toFixed(0)},${car}`;
    this.t -= dt;
    let off = 0;
    if (this.route) off = this.trim(player.x, player.y);
    if (key !== this.key || (off > 40 && this.t <= 0) || (this.route === null && this.t <= 0)) {
      this.key = key; this.t = 1.5;
      if (Math.hypot(target.x - player.x, target.y - player.y) < 25) { this.route = null; return; }
      this.route = findRoute(player.x, player.y, target.x, target.y, car); this.prog = 0; this.ver++;
      if (this.route) this.trim(player.x, player.y);
    }
  }
  // move the start of the line up to the player, return how far the player is from the line
  trim(x, y) {
    const P = this.route.pts; let best = Infinity, bi = this.prog, bx = x, by = y;
    const end = Math.min(P.length / 2 - 1, this.prog + 40);
    for (let i = this.prog; i < end; i++) {
      const ax = P[i * 2], ay = P[i * 2 + 1], dx = P[i * 2 + 2] - ax, dy = P[i * 2 + 3] - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0, px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
      if (d < best) { best = d; bi = i; bx = px; by = py; }
    }
    this.prog = bi; this.head = [bx, by];
    let rem = Math.hypot(P[bi * 2 + 2] - bx, P[bi * 2 + 3] - by);
    for (let i = bi + 1; i < P.length / 2 - 1; i++) rem += Math.hypot(P[i * 2 + 2] - P[i * 2], P[i * 2 + 3] - P[i * 2 + 1]);
    this.remaining = rem;
    return best;
  }
  // the remaining line as a Path2D in map space (x, -y)
  path() {
    const r = this.route; if (!r) return null;
    const P = r.pts, p = new Path2D(), h = this.head || [P[0], P[1]];
    p.moveTo(h[0], -h[1]);
    for (let i = this.prog + 1; i < P.length / 2; i++) p.lineTo(P[i * 2], -P[i * 2 + 1]);
    return p;
  }
}
