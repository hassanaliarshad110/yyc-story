// Always-loaded city layers: base ground, big parks and rivers, far roads, the downtown skyline,
// plus lookups (which community / ward am I in, nearest place of a kind).
import * as THREE from 'three';
import { MAT } from './materials.js';
import { buildFlat, buildRibbons, buildBuildings, buildB3D, AREA_COL, AREA_Y } from './tiles.js';
import { TER, ground } from './terrain.js';

export function toLatLon(world, x, y) {
  const p = world.proj; return [p.lat0 + y / p.ky, p.lon0 + x / p.kx];
}
export function fromLatLon(world, lat, lon) {
  const p = world.proj; return [(lon - p.lon0) * p.kx, (lat - p.lat0) * p.ky];
}

function flatRings(rings) { return rings.map(r => { const a = new Float32Array(r.length * 2); r.forEach((p, i) => { a[i * 2] = p[0]; a[i * 2 + 1] = p[1]; }); return a; }); }

export function buildWorldMeshes(scene, world) {
  const g = new THREE.Group(); g.name = 'world';
  // base ground: prairie colour across the whole city
  let xs = [], ys = [];
  for (const poly of world.city) for (const [x, y] of poly[0]) { xs.push(x); ys.push(y); }
  const x0 = Math.min(...xs) - 6000, x1 = Math.max(...xs) + 6000, y0 = Math.min(...ys) - 6000, y1 = Math.max(...ys) + 6000;
  TER.ox = 0; TER.oy = 0;
  const segs = TER.on ? 240 : 1;            // far ground follows the hills (tiles near you add a finer ground)
  const pg = new THREE.PlaneGeometry(x1 - x0, y1 - y0, segs, segs);
  pg.rotateX(-Math.PI / 2);
  const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 40, uv.getY(i) * (y1 - y0) / 40);
  const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, pp = pg.attributes.position;
  if (TER.on) { for (let i = 0; i < pp.count; i++) pp.setY(i, ground(pp.getX(i) + cxm, cym - pp.getZ(i)) - 1.6); pg.computeVertexNormals(); }
  let baseMat = TER.on ? MAT.baseFar : MAT.base;
  if (world.s2) {          // the real ground from the Sentinel-2 satellite, 20 m per pixel, far away
    const S = world.s2, U = pg.attributes.uv;
    for (let i = 0; i < pp.count; i++) U.setXY(i, (pp.getX(i) + cxm - S.x0) / S.w, (cym - pp.getZ(i) - (S.y1 - S.h)) / S.h);
    const sat0 = new THREE.MeshLambertMaterial({ color: 0x93a86e }), sat = TER.on ? MAT.far(sat0) : sat0;
    new THREE.TextureLoader().load('data/s2/far.jpg', tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; sat.map = tex; sat.color.set(0xffffff); sat.needsUpdate = true; });
    baseMat = sat;
  }
  const base = new THREE.Mesh(pg, baseMat); base.position.set(cxm, -0.02, -cym); base.receiveShadow = true; g.add(base);
  world.bounds = { x0, x1, y0, y1 };
  // big parks, land use and water (always visible, also far away)
  const bigFeats = world.big.filter(b => b.k !== 99).map(b => ({ kind: b.k, rings: flatRings(b.rings) }));
  const water = world.big.filter(b => b.k === 99).map(b => ({ kind: 1, rings: flatRings(b.rings) }));
  const ga = buildFlat(bigFeats, f => AREA_COL[f.kind], f => AREA_Y(f.kind) - (TER.on ? 1.2 : 0.005), 25, 140);
  if (ga && !world.s2) { const m = new THREE.Mesh(ga, TER.on ? MAT.groundFar : MAT.ground); m.receiveShadow = true; m.renderOrder = 1; g.add(m); }      // with the satellite ground, parks and fields show as they are
  const gw = buildFlat(water, () => 0x5d8fb8, () => TER.on ? -0.9 : 0.075, 25, 140);
  if (gw) { const m = new THREE.Mesh(gw, TER.on ? MAT.waterFar : MAT.water); m.renderOrder = 2; g.add(m); }
  // far roads: only the bigger roads, slightly below the detailed tile roads
  const W = { 1: 11, 2: 10, 3: 9, 4: 8, 5: 7.5, 8: 6, 10: 7 };
  const far = world.overview.filter(o => W[o.c]).map(o => ({ kind: o.c, rings: flatRings([o.p]) }));
  const gr = buildRibbons(far, TER.on ? -0.8 : 0.1, f => W[f.kind] * 1.15, 0x55585c);
  if (gr) { const fr = new THREE.MeshLambertMaterial({ color: 0x55585c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); const m = new THREE.Mesh(gr, TER.on ? MAT.far(fr) : fr); m.renderOrder = 3; g.add(m); }
  // skyline: every building 38 m or taller, always drawn so downtown is visible from across the city
  const sky = world.b3d ? [] : world.skyline.map(s => ({ kind: s.k, flags: 0, a: s.h * 10, b: s.mh * 10, rings: flatRings([s.r]) }));      // with the City's 3D models, loadSky3D draws them
  const { geos } = buildBuildings(sky, false);
  for (const [k, geo] of Object.entries(geos)) {
    if (!geo) continue;
    const m = new THREE.Mesh(geo, k === 'roof' ? MAT.roof : k.startsWith('house') ? MAT.wallHouses[+k.slice(5) || 0] : k === 'apt' ? MAT.wallApt : k === 'comm' ? MAT.wallComm : k === 'shop' ? MAT.wallShop : MAT.wallTower);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  scene.add(g);
  addSpecialLandmarks(g, world);
  addTowerTops(g, world);
  return g;
}

// Calgary Tower's observation deck and the Saddledome roof: shapes a footprint cannot describe
function addSpecialLandmarks(g, world) {
  const lm = n => world.landmarks.find(l => l.label === n);
  const t = lm('Calgary Tower');
  if (t) {
    const grp = new THREE.Group(); grp.position.set(t.x, ground(t.x, t.y), -t.y);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 9, 160, 20), new THREE.MeshLambertMaterial({ color: 0xd9d4ca })); shaft.position.y = 80; grp.add(shaft);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(15, 11, 14, 28), new THREE.MeshLambertMaterial({ color: 0x6d7b86 })); pod.position.y = 165; grp.add(pod);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.4, 3, 28), new THREE.MeshLambertMaterial({ color: 0xc8102e, emissive: 0x400000 })); band.position.y = 168; grp.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 15, 6, 28), new THREE.MeshLambertMaterial({ color: 0xdedad2 })); top.position.y = 175; grp.add(top);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 14, 8), new THREE.MeshLambertMaterial({ color: 0xc8102e })); mast.position.y = 185; grp.add(mast);
    grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(grp);
  }
  const s = lm('Scotiabank Saddledome');
  if (s && false) {      // the Saddledome now has its own detailed model (houses3d.js)   // hyperbolic paraboloid roof (saddle)
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 22, 40, 1, true), new THREE.MeshLambertMaterial({ color: 0x9aa3a8, side: THREE.DoubleSide })); wall.position.set(s.x, 11 + ground(s.x, s.y), -s.y);
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.CircleGeometry(60, 40), new THREE.MeshLambertMaterial({ color: 0xcfd3d6, side: THREE.DoubleSide }));
    const rp = roof.geometry.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i); rp.setZ(i, 26 + (x * x - y * y) / 900); }
    roof.geometry.computeVertexNormals(); roof.rotation.x = -Math.PI / 2; roof.position.set(s.x, ground(s.x, s.y), -s.y); roof.castShadow = true;
    g.add(roof);
  }
}

// ---------------------------------------------------------------- lookups
function pip(x, y, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) ins = !ins;
  }
  return ins;
}
function inPolys(x, y, polys) {
  for (const poly of polys) if (pip(x, y, poly[0]) && !poly.slice(1).some(h => pip(x, y, h))) return true;
  return false;
}
export function prepLookups(world) {
  for (const c of [...world.communities, ...world.wards]) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const poly of c.polys) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    c.bb = [x0, y0, x1, y1];
  }
}
export function communityAt(world, x, y) {
  for (const c of world.communities) { const b = c.bb; if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inPolys(x, y, c.polys)) return c; }
  return null;
}
export function wardAt(world, x, y) {
  for (const c of world.wards) { const b = c.bb; if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inPolys(x, y, c.polys)) return c; }
  return null;
}
export function inCity(world, x, y) { return inPolys(x, y, world.city); }
export function nearest(list, x, y, filter = () => true) {
  let best = null, bd = 1e12;
  for (const p of list) { if (!filter(p)) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
  return best ? { ...best, d: Math.sqrt(bd) } : null;
}

// ---------------------------------------------------------------- the real downtown skyline: roof crowns of named towers and red aircraft beacons
const CROWNS = {
  'Bankers Hall West Tower': { type: 'pyramid', h: 18, col: 0x9a7448, glow: 0xffc870 },        // the twin peaked copper roofs
  'Bankers Hall East Tower': { type: 'pyramid', h: 18, col: 0x9a7448, glow: 0xffc870 },
  'Suncor Energy Centre - West': { type: 'wedge', h: 22, col: 0x8a5b55 },                      // sloped tops
  'Suncor Energy Centre - East': { type: 'wedge', h: 14, col: 0x8a5b55 },
  'Eighth Avenue Place East': { type: 'pyramid', h: 16, col: 0x9fb6c8, glow: 0xbfe4ff },       // faceted glass crowns, lit at night
  'Eighth Avenue Place West': { type: 'pyramid', h: 13, col: 0x9fb6c8, glow: 0xbfe4ff },
  'Centennial Place - East Tower': { type: 'wedge', h: 16, col: 0x8fa9bd, glow: 0x9fd0ff },
  'Centennial Place - West Tower': { type: 'wedge', h: 14, col: 0x8fa9bd, glow: 0x9fd0ff },
  'Brookfield Place': { type: 'band', h: 6, col: 0xdfe6ec, glow: 0xffffff },
  'The Bow': { type: 'band', h: 4, col: 0xc9d6e0, glow: 0xdfefff },
  'TC Energy Tower': { type: 'band', h: 5, col: 0xa9b8c4, glow: 0xffffff },
  'Livingston Place West Tower': { type: 'band', h: 4, col: 0xb7c5cf, glow: 0x9fd8ff },
};
export const BEACONS = [];
function addTowerTops(g, world) {
  const glowMats = [];
  for (const s of world.skyline) {
    const ring = s.r; if (!ring || ring.length < 3) continue;
    const base = Math.min(...ring.map(p => ground(p[0], p[1]))) - 0.1, top = base + s.h;
    let cx = 0, cy = 0; for (const p of ring) { cx += p[0]; cy += p[1]; } cx /= ring.length; cy /= ring.length;
    if (s.h >= 110) BEACONS.push(new THREE.Vector3(cx, top + 2.5, -cy));
    const c = !world.b3d && s.n && CROWNS[s.n]; if (!c) continue;       // the 3D models have the real crowns
    const pos = [], add = (a, ya, b, yb, d, yd) => pos.push(a[0], ya, -a[1], b[0], yb, -b[1], d[0], yd, -d[1]);
    const pts = ring.slice(); let area = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    if (area < 0) pts.reverse();
    if (c.type === 'pyramid') { for (let i = 0; i < pts.length; i++) add(pts[i], top, pts[(i + 1) % pts.length], top, [cx, cy], top + c.h); }
    else if (c.type === 'wedge') {   // a roof sloping up across the tower
      let ax = 1, ay = 0, best = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > best) { best = l; ax = (b[1] - a[1]) / l; ay = -(b[0] - a[0]) / l; } }
      const proj = p => (p[0] - cx) * ax + (p[1] - cy) * ay, lo = Math.min(...pts.map(proj)), hi = Math.max(...pts.map(proj)), hz = p => top + c.h * (proj(p) - lo) / (hi - lo || 1);
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; add(a, top, b, top, b, hz(b)); add(a, top, b, hz(b), a, hz(a)); }
      for (let i = 1; i < pts.length - 1; i++) add(pts[0], hz(pts[0]), pts[i], hz(pts[i]), pts[i + 1], hz(pts[i + 1]));
    } else {          // a lit band around the top floors
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], o = 0.4, n = [b[1] - a[1], -(b[0] - a[0])], l = Math.hypot(n[0], n[1]) || 1, A = [a[0] + n[0] / l * o, a[1] + n[1] / l * o], B = [b[0] + n[0] / l * o, b[1] + n[1] / l * o]; add(A, top - c.h, B, top - c.h, B, top); add(A, top - c.h, B, top, A, top); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: c.col, side: THREE.DoubleSide, emissive: c.glow || 0x000000, emissiveIntensity: 0 });
    if (c.glow) glowMats.push(mat);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m);
  }
  // red aircraft-warning lights on the tall towers, blinking at night
  const bg = new THREE.BufferGeometry(); bg.setFromPoints(BEACONS);
  const bm = new THREE.PointsMaterial({ color: 0xff2a1a, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
  const beacons = new THREE.Points(bg, bm); beacons.frustumCulled = false; g.add(beacons);
  world.towerGlow = (night, t) => {
    for (const m of glowMats) m.emissiveIntensity = night * 0.9;
    bm.opacity = night > 0.3 ? (Math.sin(t * 3) > -0.2 ? 1 : 0.15) : 0;
  };
}

// the City's 3D models of every building 38 m and up (real setbacks and crowns), always drawn so downtown is visible from far away
export async function loadSky3D(scene) {
  const r = await fetch('data/b3d_sky.wasm'); if (!r.ok) return 0;
  const buf = await r.arrayBuffer(), dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x31535959) return 0;        // 'YYS1'
  const n = dv.getUint32(4, true); let o = 8, total = 0;
  const g = new THREE.Group(); g.name = 'sky3d';
  for (let i = 0; i < n; i++) {
    const ix = dv.getInt16(o, true), iy = dv.getInt16(o + 2, true), len = dv.getUint32(o + 4, true); o += 8;
    const ox = ix * 500, oy = iy * 500;
    const { geos, n: nb } = buildB3D(new Uint8Array(buf, o, len), false, (x, y) => ground(x + ox, y + oy), { ox, oy }); o += len; total += nb;
    const tg = new THREE.Group(); tg.position.set(ox, 0, -oy);
    const add = (geo, mat) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; tg.add(m); };
    for (let k = 0; k < 4; k++) add(geos['house' + k], MAT.wallHouses[k]);
    add(geos.apt, MAT.wallApt); add(geos.comm, MAT.wallComm); add(geos.shop, MAT.wallShop); add(geos.tower, MAT.wallTower); add(geos.roof, MAT.roof);
    for (const [k, m] of [['crown', MAT.crown], ['wash', MAT.wash]]) if (geos[k]) { const me = new THREE.Mesh(geos[k], m); me.renderOrder = 6; tg.add(me); }
    g.add(tg);
  }
  scene.add(g);
  return total;
}
