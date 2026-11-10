// Detailed 3D homes and Historic City Hall.
// Homes: near you, each plain house from the City's 3D buildings is replaced by a detailed model of a
// Calgary house of the same kind (bungalow, two-storey, split-level, infill, townhouse row), fitted to
// its real footprint and height and turned to face its street. Farther away the plain shapes stay.
import * as THREE from 'three';
import { loader, warm } from './gltf.js';
import { HOUSES, B3D_SKIP } from './tiles.js';
import { SWAP } from './materials.js';
import { ground } from './terrain.js';


const KINDS = ['2storey', 'bungalow', 'infill', 'split', 'townrow', 'porch'];
const MODEL = {};           // kind -> { geo, mat, dx, dy, dz } (front of the house along +x)
let R = 170;                // detailed homes within this distance (less on phones)
export const setHouseRange = r => { R = r; };
let ready = false;
const live = new Set();     // placed tiles

async function loadModel(url) {
  const gl = await loader.loadAsync(url); let mesh = null;
  gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  gl.scene.updateMatrixWorld(true);
  const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -b.min.y, -c.z); geo.computeBoundingBox(); geo.userData.shared = true;
  const m = mesh.material, mat = new THREE.MeshLambertMaterial({ map: m.map, normalMap: m.normalMap || null });
  const s = geo.boundingBox.getSize(new THREE.Vector3());
  return { geo, mat, dx: s.x, dy: s.y, dz: s.z };
}

// which model suits a house: townhouse rows and duplexes have their own; detached homes by height and age
function kindFor(c) {
  if (c.k === 19) return 'townrow';
  if (c.k === 18) return 'infill';
  const v = c.hs * 7 % 1;
  if (c.h < 6.5) return c.era >= 3 && v < 0.6 ? 'split' : 'bungalow';
  if (c.era >= 4) return v < 0.7 ? 'porch' : '2storey';
  return v < 0.65 ? '2storey' : 'porch';
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// a tile's homes: one instanced mesh per kind; each placement keeps its matrix and centre
function place(cands, nearRoad, group, ox, oy) {
  const by = {};
  for (const c of cands) {
    // the front faces the nearest street: pick the side of the footprint that points at it
    const ux = Math.cos(c.ang), uy = Math.sin(c.ang), rp = nearRoad(c.x, c.y);
    const sides = [[ux, uy, c.du, c.dv], [-ux, -uy, c.du, c.dv], [-uy, ux, c.dv, c.du], [uy, -ux, c.dv, c.du]];
    let best = sides[0];
    if (rp) { const tx = rp[0] - c.x, ty = rp[1] - c.y; let bs = -Infinity; for (const sd of sides) { const sc = sd[0] * tx + sd[1] * ty; if (sc > bs) { bs = sc; best = sd; } } }
    const [fx, fy, depth, width] = best, kind = kindFor(c);
    (by[kind] ||= []).push({ c, fx, fy, depth, width, wx: c.x + ox, wy: c.y + oy });
  }
  const T = { group, list: [] };
  for (const [kind, arr] of Object.entries(by)) {
    const md = MODEL[kind]; if (!md) continue;
    const im = new THREE.InstancedMesh(md.geo, md.mat, arr.length); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    for (const a of arr) {
      // model front (+x) turned to the street: three.js heading of the front direction (east = +x, north = -z)
      Q.setFromAxisAngle(UP, Math.atan2(a.fy, a.fx));
      S.set(a.depth * 0.97 / md.dx, Math.max(3, a.c.h) / md.dy, a.width * 0.97 / md.dz);
      P.set(a.c.x, a.c.base - 0.15, -a.c.y);
      a.m = new THREE.Matrix4().compose(P, Q, S);
    }
    group.add(im); T.list.push({ im, arr });
  }
  live.add(T); T.dirty = true;
  return T;
}
function drop(T) { live.delete(T); for (const { im } of T.list) im.dispose(); }

// every half second: the homes within reach get their models, the rest keep the plain shapes
let tick = 0;
export function updateHouses(dt, px, py) {
  if (!ready || (tick -= dt) > 0) return; tick = 0.5;
  SWAP.u.set(px, -py, R);
  for (const T of live) for (const { im, arr } of T.list) {
    let n = 0;
    for (const a of arr) if (Math.hypot(a.wx - px, a.wy - py) < R) im.setMatrixAt(n++, a.m);
    im.count = n; im.instanceMatrix.needsUpdate = true;
  }
}

export async function loadHouses(tiles) {
  try {
    await Promise.all(KINDS.map(async k => { MODEL[k] = await loadModel(`data/models/lod_house_${k}.glb`); }));
    HOUSES.place = place; HOUSES.drop = drop; ready = true;
    { const g = new THREE.Group(); for (const k of KINDS) { const im = new THREE.InstancedMesh(MODEL[k].geo, MODEL[k].mat, 1); im.setMatrixAt(0, new THREE.Matrix4()); im.castShadow = true; g.add(im); } warm(g); }
    for (const t of tiles.tiles.values()) if (t.hcands && !t.houses) t.houses = place(...t.hcands);     // tiles built while the models were loading
    return true;
  } catch (e) { console.warn('houses', e); return false; }
}

// ---- landmarks drawn by their own models, each on its real footprint (the City's plain 3D building is left out there)
// size: [east-west, height, north-south] in metres before turning; rot: turn (radians, anticlockwise from above); front: the model's +x
export const LANDMARKS = [
  // Historic City Hall (1911), Macleod Trail and 7 Avenue SE; the clock tower faces Macleod Trail (west)
  { file: 'cityhall', x: 52.2, y: 84.5, size: [39, 32.6, 34], rot: Math.PI - 0.06, skip: [51, 85, 8] },
  // The Bow (2012), Centre Street and 5 Avenue SE: a curved tower, its long side running north-east
  { file: 'bow', x: -289, y: 286, size: [92, 236, 46], rot: Math.PI / 4, skip: [-288.7, 285.8, 10] },
  // Brookfield Place East (2017), 6 Avenue SW
  { file: 'brookfield', x: -408, y: 290, size: [56, 247, 44], rot: 0, skip: [-408.1, 288.1, 10] },
  // TELUS Sky (2019), Centre Street and 7 Avenue SW
  { file: 'telussky', x: -379, y: 162, size: [46, 222, 40], rot: 0, skip: [-378.9, 162.2, 10] },
  // Scotiabank Saddledome (1983), Stampede Park
  { file: 'saddledome', x: 431, y: -877, size: [150, 43, 150], rot: 0, skip: [429.8, -872.8, 12] },
  // Nelson Mandela High School (2016), 45 Saddletowne Circle NE; entrance to the north
  { file: 'mandela', x: 7623.4, y: 8542.5, size: [128, 16.3, 133], rot: Math.PI / 2, skip: [7643.3, 8540.8, 10] },
  // Real Canadian Superstore, 3633 Westwinds Drive NE (2005)
  { file: 'superstore', x: 6060.9, y: 7167.1, size: [153.7, 13.7, 116], rot: Math.PI / 2, skip: [6066, 7135.5, 10] },
];
for (const L of LANDMARKS) B3D_SKIP.push(L.skip);
export async function loadLandmarks(scene) {
  const out = [];
  await Promise.all(LANDMARKS.map(async L => {
    try {
      const gl = await loader.loadAsync(`data/models/${L.file}.glb`); const o = gl.scene;
      o.traverse(n => { if (n.isMesh) { const m = n.material; n.material = new THREE.MeshLambertMaterial({ map: m.map, normalMap: m.normalMap || null }); n.castShadow = true; n.receiveShadow = true; } });
      const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const inner = new THREE.Group(); inner.add(o); o.position.set(-c.x, -b.min.y, -c.z);
      inner.scale.set(L.size[0] / sz.x, L.size[1] / sz.y, L.size[2] / sz.z);
      const g = new THREE.Group(); g.add(inner);
      g.position.set(L.x, ground(L.x, L.y) - 0.3, -L.y); g.rotation.y = L.rot;
      g.name = L.file; warm(g.clone()); scene.add(g); out.push(g);
    } catch (e) { console.warn('landmark', L.file, e); }
  }));
  return out;
}
export const loadCityHall = loadLandmarks;
