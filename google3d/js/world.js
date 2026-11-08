// Always-loaded city layers: base ground, big parks and rivers, far roads, the downtown skyline,
// plus lookups (which community / ward am I in, nearest place of a kind).
import * as THREE from 'three';
import { MAT } from './materials.js';
import { buildFlat, buildRibbons, buildBuildings, AREA_COL, AREA_Y } from './tiles.js';

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
  const pg = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, 1);
  pg.rotateX(-Math.PI / 2);
  const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 40, uv.getY(i) * (y1 - y0) / 40);
  const base = new THREE.Mesh(pg, MAT.base); base.position.set((x0 + x1) / 2, -0.02, -(y0 + y1) / 2); base.receiveShadow = true; g.add(base);
  world.bounds = { x0, x1, y0, y1 };
  // big parks, land use and water (always visible, also far away)
  const bigFeats = world.big.filter(b => b.k !== 99).map(b => ({ kind: b.k, rings: flatRings(b.rings) }));
  const water = world.big.filter(b => b.k === 99).map(b => ({ kind: 1, rings: flatRings(b.rings) }));
  const ga = buildFlat(bigFeats, f => AREA_COL[f.kind], f => AREA_Y(f.kind) - 0.005, 25);
  if (ga) { const m = new THREE.Mesh(ga, MAT.ground); m.receiveShadow = true; m.renderOrder = 1; g.add(m); }
  const gw = buildFlat(water, () => 0x5d8fb8, () => 0.075, 25);
  if (gw) { const m = new THREE.Mesh(gw, MAT.water); m.renderOrder = 2; g.add(m); }
  // far roads: only the bigger roads, slightly below the detailed tile roads
  const W = { 1: 11, 2: 10, 3: 9, 4: 8, 5: 7.5, 8: 6, 10: 7 };
  const far = world.overview.filter(o => W[o.c]).map(o => ({ kind: o.c, rings: flatRings([o.p]) }));
  const gr = buildRibbons(far, 0.1, f => W[f.kind] * 1.15, 0x55585c);
  if (gr) { const m = new THREE.Mesh(gr, new THREE.MeshLambertMaterial({ color: 0x55585c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.renderOrder = 3; g.add(m); }
  // skyline: every building 38 m or taller, always drawn so downtown is visible from across the city
  const sky = world.skyline.map(s => ({ kind: s.k, flags: 0, a: s.h * 10, b: s.mh * 10, rings: flatRings([s.r]) }));
  const { geos } = buildBuildings(sky, false);
  for (const [k, geo] of Object.entries(geos)) {
    if (!geo) continue;
    const m = new THREE.Mesh(geo, k === 'roof' ? MAT.roof : k === 'house' ? MAT.wallHouse : k === 'comm' ? MAT.wallComm : MAT.wallTower);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  scene.add(g);
  addSpecialLandmarks(g, world);
  return g;
}

// Calgary Tower's observation deck and the Saddledome roof: shapes a footprint cannot describe
function addSpecialLandmarks(g, world) {
  const lm = n => world.landmarks.find(l => l.label === n);
  const t = lm('Calgary Tower');
  if (t) {
    const grp = new THREE.Group(); grp.position.set(t.x, 0, -t.y);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 9, 160, 20), new THREE.MeshLambertMaterial({ color: 0xd9d4ca })); shaft.position.y = 80; grp.add(shaft);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(15, 11, 14, 28), new THREE.MeshLambertMaterial({ color: 0x6d7b86 })); pod.position.y = 165; grp.add(pod);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.4, 3, 28), new THREE.MeshLambertMaterial({ color: 0xc8102e, emissive: 0x400000 })); band.position.y = 168; grp.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 15, 6, 28), new THREE.MeshLambertMaterial({ color: 0xdedad2 })); top.position.y = 175; grp.add(top);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 14, 8), new THREE.MeshLambertMaterial({ color: 0xc8102e })); mast.position.y = 185; grp.add(mast);
    grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(grp);
  }
  const s = lm('Scotiabank Saddledome');
  if (s) {   // hyperbolic paraboloid roof (saddle)
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 22, 40, 1, true), new THREE.MeshLambertMaterial({ color: 0x9aa3a8, side: THREE.DoubleSide })); wall.position.set(s.x, 11, -s.y);
    g.add(wall);
    const roof = new THREE.Mesh(new THREE.CircleGeometry(60, 40), new THREE.MeshLambertMaterial({ color: 0xcfd3d6, side: THREE.DoubleSide }));
    const rp = roof.geometry.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i); rp.setZ(i, 26 + (x * x - y * y) / 900); }
    roof.geometry.computeVertexNormals(); roof.rotation.x = -Math.PI / 2; roof.position.set(s.x, 0, -s.y); roof.castShadow = true;
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
