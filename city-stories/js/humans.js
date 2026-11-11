// Realistic people: skinned 3D models with a full skeleton, moved by motion-captured clips
// (idle, walk, run, talk, wave, dance, sit) that blend into each other. Every model shares the same
// bone names, so one set of clips drives them all. Until a model has loaded, the simpler built-in
// people (rig.js) stand in, so the game never waits on a download.
import * as THREE from 'three';
import { loader, warm } from './gltf.js?v=11111720';
import { clone as skClone } from '../vendor/jsm/utils/SkeletonUtils.js';
import { setGlbFactory, hatGroup } from './rig.js?v=11111720';


const MODELS = new Map();       // name -> { scene, hipsY, height } once loaded
const PENDING = new Map();      // name -> promise
let CLIPS = null;               // name -> { clip, speed, once }
export const MAIN = ['ali', 'natalia', 'chris', 'jean', 'leo', 'sofia'];
export const NPCS = ['npc_suit', 'npc_dress', 'npc_cowboy', 'npc_sikh', 'npc_hijab', 'npc_teen'];

// the standing clip looked around over both shoulders: keep a gentle breathing sway instead (each bone pulled most of
// the way to its average pose; the head and neck almost still)
function calm(bone, vals) {
  const n = vals.length / 4, m = [0, 0, 0, 0], out = new Float32Array(vals.length);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) m[k] += vals[i * 4 + k] * Math.sign(vals[3] * vals[i * 4 + 3] + vals[0] * vals[i * 4] + vals[1] * vals[i * 4 + 1] + vals[2] * vals[i * 4 + 2] || 1) / n;
  const f = /Head|neck/i.test(bone) ? 0.08 : /Spine|Hips/.test(bone) ? 0.25 : 0.4;
  for (let i = 0; i < n; i++) {
    const sg = Math.sign(m[0] * vals[i * 4] + m[1] * vals[i * 4 + 1] + m[2] * vals[i * 4 + 2] + m[3] * vals[i * 4 + 3]) || 1;
    let q = [0, 1, 2, 3].map(k => m[k] + (vals[i * 4 + k] * sg - m[k]) * f), l = Math.hypot(...q) || 1;
    for (let k = 0; k < 4; k++) out[i * 4 + k] = q[k] / l;
  }
  return out;
}
// the clips: quaternion tracks for every bone and the height of the hips, stored compactly
async function loadClips() {
  const r = await fetch('data/chars/anims.json'); if (!r.ok) throw new Error('anims ' + r.status);
  const A = await r.json(); CLIPS = {};
  for (const [name, c] of Object.entries(A.clips)) {
    const times = Float32Array.from(c.t), tracks = [];
    for (const [bone, vals] of Object.entries(c.q)) tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, name === 'idle' ? calm(bone, vals) : Float32Array.from(vals, v => v / 10000)));
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
      const m = o.material;      // the same simple lighting for everyone: one shader, quick to draw
      if (m) o.material = new THREE.MeshLambertMaterial({ map: m.map, side: THREE.FrontSide });
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
      const gl = await loader.loadAsync(`data/chars/${name}.glb`); MODELS.set(name, prep(name, gl)); warm(skClone(gl.scene)); return true; }
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
export const VIEW = new THREE.Vector3();      // the camera, for distance-based animation rates (set each frame)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
// turn a bone (in the world) so it points from itself towards `dir`, blended by w
function point(bone, child, dir, w) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); const cur = _b.sub(_a); if (cur.lengthSq() < 1e-10) return; cur.normalize();
  _q1.setFromUnitVectors(cur, dir); if (w < 1) _q1.slerp(_q2.identity(), 1 - w);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(_q1);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(wq)); bone.updateMatrixWorld(true);
}
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
  // arms on top of the clip: holding a water gun out in front, or throwing (pose = { aim: 0..1 } or { throw: seconds since the throw })
  applyPose(dt) {
    const P = this.pose, B = this.bones; if (!B.RightArm || !B.RightForeArm || !B.RightHand) return;
    this.obj.updateMatrixWorld(true);
    const g = this.g, f = _v1.set(0, 0, 1).applyQuaternion(g.getWorldQuaternion(_q0)).normalize(), up = _v2.set(0, 1, 0);
    let dir = null, w = 1, fore = null;
    if (P.throw != null) {
      const t = (P.throw += dt);          // wind up behind the shoulder, then whip forward and down
      if (t < 0.16) { dir = _v3.copy(f).multiplyScalar(-0.6).addScaledVector(up, 0.8).normalize(); w = t / 0.16; fore = _v4.copy(up); }
      else if (t < 0.42) { const u = (t - 0.16) / 0.26; dir = _v3.copy(f).multiplyScalar(-0.6 + 1.6 * u).addScaledVector(up, 0.8 - 1.1 * u).normalize(); fore = _v4.copy(dir); }
      else if (t < 0.7) { dir = _v3.copy(f).addScaledVector(up, -0.3).normalize(); w = 1 - (t - 0.42) / 0.28; fore = _v4.copy(dir); }
      else { this.pose = null; return; }
    } else if (P.aim) { dir = _v3.copy(f).addScaledVector(up, -0.08).normalize(); w = P.aim; fore = dir; }
    else if (P.glide) {            // both hands up on the glider's control bar
      const side = _v6.set(1, 0, 0).applyQuaternion(g.getWorldQuaternion(_q0));
      for (const [A, F, Hd, s] of [[B.RightArm, B.RightForeArm, B.RightHand, -1], [B.LeftArm, B.LeftForeArm, B.LeftHand, 1]]) {
        if (!A || !F || !Hd) continue;
        point(A, F, _v3.copy(up).multiplyScalar(0.9).addScaledVector(f, 0.35).addScaledVector(side, s * 0.35).normalize(), 1);
        point(F, Hd, _v4.copy(up).addScaledVector(f, 0.2).addScaledVector(side, s * 0.05).normalize(), 1);
      }
      return;
    }
    else if (P.ride) {             // both hands forward and a little down, on the handlebars
      const side = _v6.set(1, 0, 0).applyQuaternion(g.getWorldQuaternion(_q0));
      for (const [A, F, Hd, s] of [[B.RightArm, B.RightForeArm, B.RightHand, -1], [B.LeftArm, B.LeftForeArm, B.LeftHand, 1]]) {
        if (!A || !F || !Hd) continue;
        point(A, F, _v3.copy(f).multiplyScalar(0.75).addScaledVector(up, -0.55).addScaledVector(side, s * 0.18).normalize(), 1);
        point(F, Hd, _v4.copy(f).addScaledVector(up, -0.25).addScaledVector(side, s * 0.1).normalize(), 1);
      }
      return;
    }
    if (!dir) return;
    point(B.RightArm, B.RightForeArm, dir, w); point(B.RightForeArm, B.RightHand, fore || dir, w);
    if (P.aim && B.LeftArm && B.LeftForeArm && B.LeftHand) {       // both hands on the gun
      const l = _v5.copy(f).multiplyScalar(0.9).addScaledVector(_v6.set(1, 0, 0).applyQuaternion(g.getWorldQuaternion(_q0)), -0.45).normalize();
      point(B.LeftArm, B.LeftForeArm, l, w * 0.9); point(B.LeftForeArm, B.LeftHand, _v5.copy(f).addScaledVector(_v6.set(1, 0, 0).applyQuaternion(_q0), -0.6).normalize(), w * 0.9);
    }
  }
  // st: { speed (m/s), run, sit, talk, wave, dance, syncT, offset }  -> true on each footstep
  animate(dt, st = {}) {
    // people far from the camera move on fewer frames (every 2nd beyond 40 m, every 4th beyond 80 m): on a phone the
    // skinned characters cost more than the buildings
    const e = this.g.matrixWorld.elements, dd = (e[12] - VIEW.x) ** 2 + (e[13] - VIEW.y) ** 2 + (e[14] - VIEW.z) ** 2, every = dd > 6400 ? 4 : dd > 1600 ? 2 : 1;
    this.skipT = (this.skipT || 0) + dt;
    if (every > 1 && ((this.fc = (this.fc || 0) + 1) % every) !== 0) return false;
    dt = Math.min(0.25, this.skipT); this.skipT = 0;
    this.t += dt; const sp = st.speed || 0, W = {};
    for (const k in this.acts) W[k] = 0;
    let want;
    if (st.sit || st.ride) want = 'sit';      // on a motorbike: seated, hands on the bars (pose)
    if (st.ride) { if (!this.pose || !this.pose.ride) this.pose = { ride: 1 }; } else if (this.pose && this.pose.ride) this.pose = null;
    if (st.glide) { if (!this.pose || !this.pose.glide) this.pose = { glide: 1 }; } else if (this.pose && this.pose.glide) this.pose = null;
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
    if (this.pose) this.applyPose(dt);
    // a footstep each time the lower foot changes (feet positions from the last drawn frame)
    const L = this.bones.LeftFoot, R = this.bones.RightFoot;
    if (!L || !R || sp < 0.3) { this.lr = 0; return false; }
    const s = Math.sign(L.matrixWorld.elements[13] - R.matrixWorld.elements[13]), step = this.lr !== 0 && s !== 0 && s !== this.lr;
    if (s) this.lr = s; return step;
  }
}

setGlbFactory((style) => style.glb && humanReady(style.glb) ? new Human(style.glb, style) : null);
