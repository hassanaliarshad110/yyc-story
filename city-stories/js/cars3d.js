// Detailed vehicle models: pickup truck, off-road SUV, city police SUV, community peace officer SUV,
// the city bus and the CTrain car. Each is fitted to its real length, width and height and faces +z
// like the other vehicles. Until a model has loaded, the simpler vehicles stand in.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/jsm/loaders/DRACOLoader.js';

const loader = new GLTFLoader();
{ const d = new DRACOLoader(); d.setDecoderPath('./vendor/draco/'); loader.setDRACOLoader(d); }

// real sizes (metres): length, width, height
export const CAR3D = {
  pickup: { L: 5.9, W: 2.03, H: 1.96 },
  offroad: { L: 4.88, W: 1.89, H: 1.85 },
  police: { L: 4.78, W: 1.93, H: 1.9 },
  peace: { L: 5.05, W: 2.0, H: 1.95 },
  bus: { L: 12.2, W: 2.59, H: 3.2 },
  ctrain: { L: 24.8, W: 2.65, H: 3.9 },
};
const READY = {};

async function load(kind) {
  const gl = await loader.loadAsync(`data/veh/${kind}.glb`); let mesh = null;
  gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  gl.scene.updateMatrixWorld(true);
  const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox(); let b = geo.boundingBox, s = b.getSize(new THREE.Vector3());
  if (s.x > s.z) geo.rotateY(-Math.PI / 2);           // the models come facing +x: turn them to face +z
  geo.computeBoundingBox(); b = geo.boundingBox; s = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3()), R = CAR3D[kind];
  geo.translate(-c.x, -b.min.y, -c.z); geo.scale(R.W / s.x, R.H / s.y, R.L / s.z);
  geo.computeBoundingSphere(); geo.userData.shared = true;
  const m = mesh.material;
  READY[kind] = { geo, mat: new THREE.MeshLambertMaterial({ map: m.map, normalMap: m.normalMap || null }) };
}
export async function loadCars3D() { await Promise.all(Object.keys(CAR3D).map(k => load(k).catch(e => console.warn('vehicle model', k, e)))); }
export const car3dReady = k => !!READY[k];

// a Group facing +z with userData { L, W, kind } like the other vehicles; null if the model hasn't loaded
export function makeCar3D(kind) {
  const r = READY[kind]; if (!r) return null;
  const g = new THREE.Group(), m = new THREE.Mesh(r.geo, r.mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const R = CAR3D[kind];
  g.userData = { L: R.L, W: R.W, kind: kind === 'pickup' ? 'truck' : kind === 'offroad' ? 'suv' : kind, model: kind, wheels: [], front: [] };
  if (kind === 'police' || kind === 'peace') {          // flashing roof lights for the chase
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: kind === 'peace' ? 0xffa020 : 0xff2020 }));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x2a5cff }));
    a.position.set(-0.3, R.H + 0.02, -0.3); b.position.set(0.3, R.H + 0.02, -0.3); g.add(a, b);
    g.userData.beacons = [a, b]; g.userData.police = true; g.userData.peace = kind === 'peace';
  }
  return g;
}
