// Shopping plazas: the long one-storey strip malls with several shops (City of Calgary 3D buildings with three or more
// business licences inside, long and shallow) are rebuilt from 3D strip-mall sections: storefronts with glass, a sign
// band and a canopy along the side that faces the street, repeated along the building's real length. The plain block
// from the City's data is left out (tiles.js skips it), and every shop's sign goes up on the band (business.js).
import * as THREE from 'three';
import { loader, warm } from './gltf.js?v=11111720';
import { ground } from './terrain.js?v=11111720';
import { addSkip } from './tiles.js?v=11111720';

const SEG = 30;                       // metres of plaza per model section
const VARIANTS = ['plaza_a', 'plaza_b'];
export const PLAZAS = [];             // { i, x, y, L, D, H, rot, fx, fy, ax, ay, base, v }
const MODELS = {};
export const PLAZA_NIGHT = { value: 0 };
let grid = null;
const key = (x, y) => Math.floor(x / 200) + ',' + Math.floor(y / 200);

function material(map) {
  const m = new THREE.MeshLambertMaterial({ map });
  m.onBeforeCompile = sh => {       // at night the shop windows (the dark glass low on the front) glow warm
    sh.uniforms.pNight = PLAZA_NIGHT;
    sh.vertexShader = 'varying float vPy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPy = position.y;');
    sh.fragmentShader = 'varying float vPy; uniform float pNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (pNight > 0.0) { float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); float glass = (1.0 - smoothstep(0.1, 0.2, lu)) * (1.0 - smoothstep(0.42, 0.52, vPy)) * step(0.06, vPy) * step(diffuseColor.r, diffuseColor.b + 0.04);
        totalEmissiveRadiance += vec3(1.0, 0.82, 0.55) * glass * pNight * 0.85 + diffuseColor.rgb * pNight * 0.06; }`);
  };
  m.customProgramCacheKey = () => 'plaza';
  return m;
}
// a section model, turned so its storefronts face +z and its length runs along x, scaled to 1 x 1 x 1 (base at y = 0)
async function loadModel(name, turn) {
  const gl = await loader.loadAsync(`data/models/${name}.glb`); let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  gl.scene.updateMatrixWorld(true); const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
  if (turn) geo.rotateY(turn);
  geo.computeBoundingBox(); const b = geo.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -b.min.y, -c.z); geo.scale(1 / s.x, 1 / s.y, 1 / s.z); geo.computeBoundingSphere();
  // how far forward the sign band sits (share of the depth from the middle): the front of the wall high up
  const P = geo.attributes.position; let band = -1;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > 0.62 && y < 0.86 && Math.abs(P.getX(i)) < 0.35) band = Math.max(band, P.getZ(i)); }
  MODELS[name] = { geo, mat: material(mesh.material.map), band: band > 0 ? band : 0.5 };
}
// which way each section model faces: + rotation (radians) so the storefronts face +z (set from looking at the models)
const TURN = { plaza_a: -Math.PI / 2, plaza_b: -Math.PI / 2 };   // the generated sections face +x

export async function loadPlazas() {
  try {
    const [d] = await Promise.all([fetch('data/plazas.json').then(r => r.json()), ...VARIANTS.map(v => loadModel(v, TURN[v]))]);
    if (!VARIANTS.every(v => MODELS[v])) return 0;
    grid = new Map();
    d.p.forEach(([x, y, L, h, D, rot, n], i) => {
      const fx = Math.sin(rot), fy = -Math.cos(rot), ax = Math.cos(rot), ay = Math.sin(rot);    // front (street) and along
      let gmin = ground(x, y); for (const [u, w] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) gmin = Math.min(gmin, ground(x + ax * u * L + fx * w * D, y + ay * u * L + fy * w * D));
      const H = Math.max(5.2, Math.min(8.5, h)) + Math.min(4, ground(x, y) - gmin);
      const P = { i, x, y, L, D, H, rot, fx, fy, ax, ay, base: gmin - 0.25, v: VARIANTS[(i * 7 + n) % VARIANTS.length], n }; P.band = MODELS[P.v].band;
      PLAZAS.push(P); const k = key(x, y); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(P);
      addSkip(x, y, Math.min(L, D) / 2 + 2, L, D, rot);      // leave out the City's plain block here
    });
    return PLAZAS.length;
  } catch (e) { console.warn('plazas', e); return 0; }
}
// the plaza a point belongs to (within a few metres of its walls), or null
export function plazaAt(x, y, slack = 8) {
  if (!grid) return null;
  const cx = Math.floor(x / 200), cy = Math.floor(y / 200);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const P of grid.get((cx + i) + ',' + (cy + j)) || []) {
    const dx = x - P.x, dy = y - P.y, a = dx * P.ax + dy * P.ay, f = dx * P.fx + dy * P.fy;
    if (Math.abs(a) < P.L / 2 + slack && Math.abs(f) < P.D / 2 + slack) return P;
  }
  return null;
}
export class Plazas {
  constructor(scene) {
    this.scene = scene; this.t = 0; this.meshes = {};
    for (const v of VARIANTS) { const M = MODELS[v]; if (!M) continue; const im = new THREE.InstancedMesh(M.geo, M.mat, 700); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = 'plazas ' + v; scene.add(im); this.meshes[v] = im; }
    const g = new THREE.Group(); for (const v in this.meshes) g.add(new THREE.Mesh(MODELS[v].geo, MODELS[v].mat)); warm(g);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0);
  }
  update(dt, px, py) {
    if ((this.t -= dt) > 0 || !grid) return; this.t = 1.5;
    const cnt = {}; for (const v in this.meshes) cnt[v] = 0;
    const R = 1100, n = Math.ceil(R / 200), cx = Math.floor(px / 200), cy = Math.floor(py / 200);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const P of grid.get((cx + i) + ',' + (cy + j)) || []) {
      if (Math.hypot(P.x - px, P.y - py) > R) continue;
      const im = this.meshes[P.v]; if (!im) continue;
      const k = Math.max(1, Math.round(P.L / SEG)), l = P.L / k;
      this.q.setFromAxisAngle(this.Y, P.rot);
      for (let s = 0; s < k && cnt[P.v] < 700; s++) {
        const off = -P.L / 2 + l * (s + 0.5);
        this.p.set(P.x + P.ax * off, P.base, -(P.y + P.ay * off)); this.s.set(l + 0.05, P.H, P.D);
        im.setMatrixAt(cnt[P.v]++, this.m.compose(this.p, this.q, this.s));
      }
    }
    for (const v in this.meshes) { const im = this.meshes[v]; im.count = cnt[v]; im.instanceMatrix.needsUpdate = true; }
  }
}
