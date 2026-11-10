// Realistic people: skinned 3D models with a full skeleton, moved by motion-captured clips
// (idle, walk, run, talk, wave, dance, sit) that blend into each other. Every model shares the same
// bone names, so one set of clips drives them all. Until a model has loaded, the simpler built-in
// people (rig.js) stand in, so the game never waits on a download.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/jsm/loaders/DRACOLoader.js';
import { clone as skClone } from '../vendor/jsm/utils/SkeletonUtils.js';
import { setGlbFactory, hatGroup } from './rig.js';

const loader = new GLTFLoader();
{ const d = new DRACOLoader(); d.setDecoderPath('./vendor/draco/'); loader.setDRACOLoader(d); }

const MODELS = new Map();       // name -> { scene, hipsY, height } once loaded
const PENDING = new Map();      // name -> promise
let CLIPS = null;               // name -> { clip, speed, once }
export const MAIN = ['ali', 'natalia', 'chris', 'jean', 'leo', 'sofia'];
export const NPCS = ['npc_suit', 'npc_dress', 'npc_cowboy', 'npc_sikh', 'npc_hijab', 'npc_teen'];

// the clips: quaternion tracks for every bone and the height of the hips, stored compactly
async function loadClips() {
  const r = await fetch('data/chars/anims.json'); if (!r.ok) throw new Error('anims ' + r.status);
  const A = await r.json(); CLIPS = {};
  for (const [name, c] of Object.entries(A.clips)) {
    const times = Float32Array.from(c.t), tracks = [];
    for (const [bone, vals] of Object.entries(c.q)) tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, Float32Array.from(vals, v => v / 10000)));
    if (c.hy) tracks.push(new THREE.NumberKeyframeTrack('Hips.position[y]', times, Float32Array.from(c.hy, v => v / 10000)));   // share of the hips' height
    CLIPS[name] = { clip: new THREE.AnimationClip(name, c.d, tracks), speed: c.sp || 0, once: !!c.once };
  }
}

function prep(name, gl) {
  const scene = gl.scene; let hips = null;
  scene.traverse(o => {
    if (o.isBone && o.name === 'Hips') hips = o;
    if (o.isMesh) {
      o.castShadow = true; o.frustumCulled = false;
      const m = o.material, npc = name.startsWith('npc_');
      if (m && npc) {      // simpler lighting for the crowd
        o.material = new THREE.MeshLambertMaterial({ map: m.map, normalMap: m.normalMap || null, side: THREE.FrontSide });
      } else if (m) { m.metalness = 0; m.roughness = Math.max(0.6, m.roughness ?? 1); m.envMapIntensity = 0; }
    }
  });
  scene.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(scene);
  return { scene, hipsY: hips ? hips.position.y : 95, height: b.max.y - b.min.y };
}

export function loadHuman(name) {
  if (MODELS.has(name)) return Promise.resolve(true);
  if (!PENDING.has(name)) PENDING.set(name, (async () => {
    try { if (!CLIPS) await (PENDING.get('_clips') || (PENDING.set('_clips', loadClips()), PENDING.get('_clips')));
      const gl = await loader.loadAsync(`data/chars/${name}.glb`); MODELS.set(name, prep(name, gl)); return true; }
    catch (e) { console.warn('model', name, e); return false; }
  })());
  return PENDING.get(name);
}
export const humanReady = name => MODELS.has(name) && !!CLIPS;
// load the main characters first, then the people on the street, without holding up the game
export async function loadHumans(first = []) {
  for (const n of first) await loadHuman(n);
  for (const n of [...MAIN, ...NPCS]) loadHuman(n);
}

const LOCO = ['idle', 'walk', 'run'];
export class Human {
  constructor(name, style = {}) {
    const M = MODELS.get(name);
    this.name = name; this.style = style;
    const obj = skClone(M.scene);
    this.g = new THREE.Group(); this.g.add(obj); this.obj = obj;
    if (style.gscale) this.g.scale.setScalar(style.gscale);       // the models already have each person's real height
    this.bones = {}; obj.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.bones.head = this.bones.Head;
    this.mixer = new THREE.AnimationMixer(obj);
    this.acts = {}; this.w = {};
    for (const [k, c] of Object.entries(CLIPS)) {
      const clip = c.clip.clone();          // hips height scaled to this person
      for (const t of clip.tracks) if (t.name === 'Hips.position[y]') t.values = t.values.map(v => v * M.hipsY);
      const a = this.mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); a.play();
      if (c.once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      a.time = Math.random() * clip.duration * (c.once ? 0 : 1);
      this.acts[k] = a; this.w[k] = k === 'idle' ? 1 : 0;
    }
    this.acts.idle.setEffectiveWeight(1);
    this.t = Math.random() * 10; this.lr = 0; this.cur = null;
    this.g.userData.char = this;
    if (style.hat) this.setHat(style.hat);
  }
  setHat(c) {
    this.hatC = c ?? null;
    const head = this.bones.Head; if (!head) return;
    if (this.hat) { head.remove(this.hat); this.hat = null; }
    if (c == null) return;
    const g = this.hat = hatGroup(c), end = this.bones.head_end;
    // bones are in centimetres: undo the armature's scale; sit the brim just above the ears
    g.scale.setScalar(100); const p = end ? end.position.clone().multiplyScalar(0.86) : new THREE.Vector3(0, 12, 0);
    g.position.set(p.x, p.y, p.z + 0.4); g.rotation.x = -0.12;
    head.add(g);
  }
  // st: { speed (m/s), run, sit, talk, wave, dance, syncT, offset }  -> true on each footstep
  animate(dt, st = {}) {
    this.t += dt; const sp = st.speed || 0, W = {};
    for (const k in this.acts) W[k] = 0;
    let want;
    if (st.sit) want = 'sit';
    else if (sp > 0.3) want = st.run || sp > 3.6 ? 'run' : 'walk';
    else if (st.dance != null) want = 'dance';
    else if (st.wave) want = 'wave';
    else if (st.talk) want = 'talk';
    else want = 'idle';
    if (!this.acts[want]) want = 'idle';
    W[want] = 1;
    if (want !== this.cur) {          // starting a clip that plays once (sitting down): from the start
      const c = CLIPS[want]; if (c && c.once) { this.acts[want].reset(); this.acts[want].play(); }
      this.cur = want;
    }
    // walking and running speed up with the person, so feet don't slide
    if (want === 'walk' || want === 'run') { const c = CLIPS[want]; this.acts[want].timeScale = c.speed ? Math.max(0.5, Math.min(1.8, sp / c.speed)) : 1; }
    if (want === 'dance') {          // on the song's beat, each person a little apart
      const a = this.acts.dance, d = a.getClip().duration; a.timeScale = 0;
      a.time = (((st.syncT ?? this.t) + (st.offset || 0) + (st.dance || 0) * d / 4) % d + d) % d;
    }
    const k = 1 - Math.exp(-dt * (want === 'sit' ? 6 : 9));
    let sum = 0;
    for (const n in this.acts) { this.w[n] += (W[n] - this.w[n]) * k; if (this.w[n] < 0.002) this.w[n] = 0; sum += this.w[n]; }
    for (const n in this.acts) this.acts[n].setEffectiveWeight(sum > 0 ? this.w[n] / sum : 0);
    this.mixer.update(dt);
    // a footstep each time the lower foot changes (feet positions from the last drawn frame)
    const L = this.bones.LeftFoot, R = this.bones.RightFoot;
    if (!L || !R || sp < 0.3) { this.lr = 0; return false; }
    const s = Math.sign(L.matrixWorld.elements[13] - R.matrixWorld.elements[13]), step = this.lr !== 0 && s !== 0 && s !== this.lr;
    if (s) this.lr = s; return step;
  }
}

setGlbFactory((style) => style.glb && humanReady(style.glb) ? new Human(style.glb, style) : null);
