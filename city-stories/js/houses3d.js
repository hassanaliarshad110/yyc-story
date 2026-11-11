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
  const m = mesh.material, mat = homeWindows(new THREE.MeshLambertMaterial({ map: m.map }));
  const s = geo.boundingBox.getSize(new THREE.Vector3());
  return { geo, mat, dx: s.x, dy: s.y, dz: s.z };
}

// lit windows after dark, like the plain houses farther away: the glass in each model's own texture (dark, bluish,
// on a wall) glows warm; about two homes in three have lights on, and not every window in a lit home
function homeWindows(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.lmNight = LM_NIGHT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHW; varying float vLit;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 hw = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vHW = hw.xyz; vec3 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vLit = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float lmNight; varying vec3 vHW; varying float vLit;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (lmNight > 0.01 && vLit < 0.68) {
          vec3 tc = diffuseColor.rgb; float lu = dot(tc, vec3(0.299, 0.587, 0.114));
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float glass = step(abs(wn.y), 0.35) * smoothstep(0.5, 0.3, lu) * smoothstep(0.0, 0.03, tc.b - tc.r);
          float cell = fract(sin(dot(floor(vHW * vec3(0.55, 0.45, 0.55)), vec3(12.99, 78.23, 37.71))) * 43758.55);
          totalEmissiveRadiance += glass * step(cell, 0.75) * lmNight * mix(vec3(1.0, 0.66, 0.32), vec3(0.95, 0.78, 0.5), cell) * 0.8;
        }`);
  };
  mat.customProgramCacheKey = () => 'home-windows';
  return mat;
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
// high: flying well above the roofs; the detailed homes are left out then (from up there they only added a ring of
// homes that changed shape and went dark around you as you flew)
let wasHigh = false;
export function updateHouses(dt, px, py, high = false) {
  if (!ready) return;
  if (high !== wasHigh) { wasHigh = high; tick = 0; }
  if ((tick -= dt) > 0) return; tick = 0.5;
  const r = high ? 0 : R;
  SWAP.u.set(px, -py, r);
  for (const T of live) for (const { im, arr } of T.list) {
    let n = 0;
    for (const a of arr) if (Math.hypot(a.wx - px, a.wy - py) < r) im.setMatrixAt(n++, a.m);
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
  // Brookfield Place East (2017), 225 6 Avenue SW (the City's 3D data has only its crown)
  { file: 'brookfield', x: -556, y: 208, size: [52, 247, 42], rot: 0, skip: [-553.6, 210.4, 8] },
  // Suncor Energy Centre (1984), 150 6 Avenue SW: the 215 m west tower and the 33-storey east tower
  { file: 'suncor', x: -411.7, y: 293.2, size: [127, 215, 82], rot: 0, skip: [-408.1, 288.1, 10] },
  // TELUS Sky (2019), Centre Street and 7 Avenue SW
  { file: 'telussky', x: -379, y: 162, size: [46, 222, 40], rot: 0, skip: [-378.9, 162.2, 10] },
  // Scotiabank Saddledome (1983), Stampede Park
  { file: 'saddledome', x: 431, y: -877, size: [150, 43, 150], rot: 0, skip: [429.8, -872.8, 12] },
  // Nelson Mandela High School (2016), 45 Saddletowne Circle NE; entrance to the north
  { file: 'mandela', x: 7623.4, y: 8542.5, size: [128, 16.3, 133], rot: Math.PI / 2, skip: [7643.3, 8540.8, 10] },
  // Real Canadian Superstores (the big stores; the smaller downtown and north-central ones keep the City's shapes)
  { file: 'superstore', x: 5201, y: 2643.7, size: [146.8, 10.8, 116.5], rot: 2.732, skip: [5193.9, 2658.3, 8] },      // 3575 20 Avenue NE
  { file: 'superstore', x: -7232.2, y: 10142.6, size: [151.2, 14.4, 106.3], rot: 0.205, skip: [-7236.9, 10148.5, 8] },      // 5251 Country Hills Boulevard NW
  { file: 'superstore', x: -799.8, y: 12987.5, size: [165.9, 13.7, 97.7], rot: 0.001, skip: [-817.2, 12975, 8] },      // 100 Country Village Road NE
  { file: 'superstore', x: 6378.2, y: -12350, size: [151.4, 13.5, 106.6], rot: 3.143, skip: [6382.2, -12361, 8] },      // 4700 130 Avenue SE
  { file: 'superstore', x: -667.6, y: -15051.5, size: [146.1, 15, 102.5], rot: 3.511, skip: [-669.2, -15054.4, 8] },      // 15915 Macleod Trail SE
  { file: 'superstore', x: 6060.9, y: 7167.1, size: [153.7, 13.7, 116], rot: 1.571, skip: [6066, 7135.5, 8] },      // 3633 Westwinds Drive NE
  { file: 'superstore', x: -1144, y: -9284.7, size: [146.3, 12.1, 116.2], rot: 6.282, skip: [-1118.8, -9302.7, 8] },      // 10505 Southport Road SW
  { file: 'superstore', x: 1136.1, y: -6545.8, size: [155, 12.4, 115], rot: 3.195, skip: [1145.3, -6537.6, 8] },      // 20 Heritage Meadows Way SE
  { file: 'superstore', x: 6807.2, y: -18850.2, size: [95, 15.6, 58.4], rot: 1.792, skip: [6812.4, -18850.4, 8] },      // 19655 Seton Way SE
];
for (const L of LANDMARKS) B3D_SKIP.push(L.skip);
const FILES = {};
export const LM_GROUPS = [];
// night on the landmarks: lit windows (a random mix of warm and cool offices, floor by floor), a soft floodlight wash up
// the walls and a brighter crown; LM_NIGHT is set with the city's other night lights (0 day .. 1 night)
export const LM_NIGHT = { value: 0 }, LM_TIME = { value: 0 };
function nightLit(mat, mode, fl, base, top) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { lmNight: LM_NIGHT, lmBase: { value: base }, lmTop: { value: top }, lmFloor: { value: new THREE.Vector2(fl[0], fl[1]) }, lmMode: { value: mode } });
    sh.vertexShader = 'varying vec3 vLmWP; varying vec3 vLmWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vLmWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vLmWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = 'varying vec3 vLmWP; varying vec3 vLmWN; uniform float lmNight; uniform float lmBase; uniform float lmTop; uniform vec2 lmFloor; uniform float lmMode;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (lmNight > 0.0) {
        vec3 wn = normalize(vLmWN); float hgt = vLmWP.y - lmBase;
        if (lmMode > 0.5 && abs(wn.y) < 0.45 && hgt > 4.5 && hgt < lmTop - 2.5) {
          vec2 sd = normalize(vec2(-wn.z, wn.x) + 1e-5); float s = dot(vLmWP.xz, sd);
          vec2 c = vec2(s / lmFloor.y, hgt / lmFloor.x), cell = floor(c), f = fract(c);
          float win = step(0.14, f.x) * step(f.x, 0.86) * step(0.2, f.y) * step(f.y, 0.8);
          float h1 = fract(sin(dot(cell + floor(wn.xz * 2.5) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
          float lit = win * step(0.4, h1) * (0.55 + 0.45 * fract(h1 * 7.0));
          vec3 wc = mix(vec3(1.0, 0.8, 0.52), vec3(0.82, 0.9, 1.0), step(0.72, fract(h1 * 13.0)));
          totalEmissiveRadiance += wc * lit * lmNight * 1.15;
        }
        totalEmissiveRadiance += diffuseColor.rgb * lmNight * (0.1 + (lmMode > 0.5 && lmTop > 60.0 ? 0.45 * smoothstep(lmTop - 16.0, lmTop, hgt) : 0.0));
      }`);
  };
  mat.customProgramCacheKey = () => 'lmnight';
  return mat;
}
// the Saddledome's roof lights: LED strips around the rim and across the saddle roof, slowly changing colour at night
// (traced on the model itself: rays straight down find the roof)
function roofLEDs(g, L) {
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), cx = L.x, cy = L.y, R = L.size[0] / 2;
  const roofAt = (x, y) => { ray.set(new THREE.Vector3(x, 400, -y), down); const h = ray.intersectObject(g, true)[0]; return h ? h.point.y : null; };
  const lines = [];
  for (const rf of [0.9, 0.6]) {       // the rim and an inner ring
    const pts = [];
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, x = cx + Math.cos(a) * R * rf, y = cy + Math.sin(a) * R * rf, h = roofAt(x, y); if (h != null) pts.push(new THREE.Vector3(x, h + 0.35, -y)); }
    if (pts.length > 60) lines.push({ pts, closed: true });
  }
  for (let k = 0; k < 8; k++) {        // strips from the middle out to the rim
    const a = k / 8 * Math.PI * 2, pts = [];
    for (let i = 0; i <= 30; i++) { const r = R * 0.9 * i / 30, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, h = roofAt(x, y); if (h != null) pts.push(new THREE.Vector3(x, h + 0.35, -y)); }
    if (pts.length > 10) lines.push({ pts, closed: false });
  }
  if (!lines.length) return null;
  const geos = lines.map(l => { const c = new THREE.CatmullRomCurve3(l.pts, l.closed); return new THREE.TubeGeometry(c, l.pts.length * 2, l.closed ? 0.4 : 0.25, 5, l.closed); });
  const mat = new THREE.ShaderMaterial({
    uniforms: { night: LM_NIGHT, time: LM_TIME }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float night; uniform float time; varying vec3 vP;
      vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float a = atan(vP.z + ${(cy).toFixed(1)}, vP.x - ${cx.toFixed(1)});
        float chase = 0.55 + 0.45 * sin(a * 12.0 - time * 3.0);
        float mode = mod(floor(time / 12.0), 3.0);
        vec3 c = mode < 0.5 ? mix(vec3(0.9, 0.05, 0.08), vec3(1.0), step(0.75, chase)) : mode < 1.5 ? hue(fract(a / 6.2832 + time * 0.05)) : mix(vec3(1.0, 0.75, 0.15), vec3(0.9, 0.05, 0.08), 0.5 + 0.5 * sin(time * 1.5));
        gl_FragColor = vec4(c * (0.6 + 0.6 * chase) * 1.6, night); }`,
  });
  const grp = new THREE.Group(); for (const gg of geos) grp.add(new THREE.Mesh(gg, mat)); grp.name = 'saddledome-leds';
  grp.onBeforeRender = () => {}; LEDS.push(grp); return grp;
}
const LEDS = [];
export function updateLandmarks(dt) { LM_TIME.value += dt; for (const l of LEDS) l.visible = LM_NIGHT.value > 0.02; }      // the landmark models in the scene (store signs snap onto their walls)
export async function loadLandmarks(scene) {
  const out = [];
  await Promise.all(LANDMARKS.map(async L => {
    try {
      const gl0 = await (FILES[L.file] ||= loader.loadAsync(`data/models/${L.file}.glb`)); const o = gl0.scene.clone(true), gl = { scene: o };
      const tall = L.size[1] > 60, mode = tall || L.file === 'cityhall' || L.file === 'mandela' ? 1 : 0;
      const fl = tall ? [3.9, 1.8] : [4.4, 2.8], base = ground(L.x, L.y) - 0.3;
      o.traverse(n => { if (n.isMesh) { const m = n.material; n.material = nightLit(new THREE.MeshLambertMaterial({ map: m.map }), mode, fl, base, L.size[1]); n.castShadow = true; n.receiveShadow = true; } });
      const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const inner = new THREE.Group(); inner.add(o); o.position.set(-c.x, -b.min.y, -c.z);
      // stand on the lowest ground under the footprint (never floating over a slope); the walls reach down to it
      const g0 = ground(L.x, L.y), cR = Math.cos(L.rot), sR = Math.sin(L.rot); let gmin = g0;
      for (const [u, w] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, -0.5], [0, 0.5], [-0.5, 0], [0.5, 0]]) { const ax = u * L.size[0], az = w * L.size[2]; gmin = Math.min(gmin, ground(L.x + ax * cR + az * sR, L.y + ax * sR - az * cR)); }
      const extra = Math.min(6, g0 - gmin);
      inner.scale.set(L.size[0] / sz.x, (L.size[1] + extra) / sz.y, L.size[2] / sz.z);
      const g = new THREE.Group(); g.add(inner);
      g.position.set(L.x, g0 - extra - 0.3, -L.y); g.rotation.y = L.rot;
      if (L.file === 'saddledome') { g.updateMatrixWorld(true); const led = roofLEDs(g, L); if (led) scene.add(led); }
      g.name = L.file; g.userData.bld = 1; g.userData.lm = L; warm(g.clone()); scene.add(g); out.push(g); LM_GROUPS.push(g);
    } catch (e) { console.warn('landmark', L.file, e); }
  }));
  return out;
}
export const loadCityHall = loadLandmarks;
