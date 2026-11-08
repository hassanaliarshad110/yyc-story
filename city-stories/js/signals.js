// Traffic lights at real signalised intersections (City of Calgary Traffic Signals + OpenStreetMap), showing the
// same red/amber/green the traffic obeys; pedestrian flashers; and the City's own stop, yield, playground-zone,
// school-zone, speed and crosswalk signs at their surveyed spots, facing the way they face on the street.
import * as THREE from 'three';
import { ground } from './terrain.js';
import { rotY, dirOf } from './player.js';

let SIGNS = null;
export async function loadSigns() {
  try {
    const r = await fetch('data/signs.wasm'); if (!r.ok) throw new Error(r.status);
    SIGNS = JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
  } catch (e) { console.warn('no road signs', e); SIGNS = null; }
  return !!SIGNS;
}

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const MAT = {
  pole: M(0x6f757b), head: M(0x2a2c2f), back: M(0x1d1e20),
  red: [M(0x3a0d0d), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false })],
  amber: [M(0x3a2a08), new THREE.MeshBasicMaterial({ color: 0xffb300, toneMapped: false })],
  green: [M(0x0b3318), new THREE.MeshBasicMaterial({ color: 0x23ff7a, toneMapped: false })],
};
const G = {
  pole: new THREE.CylinderGeometry(0.11, 0.13, 6.2, 8).translate(0, 3.1, 0),
  arm: new THREE.CylinderGeometry(0.07, 0.09, 1, 6).rotateZ(Math.PI / 2).translate(0.5, 0, 0),
  head: new THREE.BoxGeometry(0.42, 1.15, 0.32), back: new THREE.BoxGeometry(0.7, 1.4, 0.04),
  lamp: new THREE.CircleGeometry(0.16, 12), post: new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6).translate(0, 1.15, 0),
};
// sign faces drawn once per kind/text
const FACES = new Map();
function face(kind, txt) {
  const key = kind + '|' + (txt || ''); let f = FACES.get(key); if (f) return f;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.textAlign = 'center'; g.textBaseline = 'middle';
  let w = 0.75, h = 0.75;
  if (kind === 'stop') {
    g.fillStyle = '#fff'; poly(g, 8, 62, Math.PI / 8); g.fillStyle = '#c8102e'; poly(g, 8, 56, Math.PI / 8);
    g.fillStyle = '#fff'; g.font = '800 34px Arial, sans-serif'; g.fillText('STOP', 64, 66);
  } else if (kind === 'yield') {
    g.fillStyle = '#c8102e'; tri(g, 62); g.fillStyle = '#fff'; tri(g, 40); w = 0.85; h = 0.85;
  } else if (kind === 'speed') {
    g.fillStyle = '#fff'; g.fillRect(14, 4, 100, 120); g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(18, 8, 92, 112);
    g.fillStyle = '#111'; g.font = '700 17px Arial'; g.fillText('MAXIMUM', 64, 34); g.font = '800 52px Arial'; g.fillText((txt || '').replace(/\D/g, '') || '50', 64, 82); w = 0.6; h = 0.75;
  } else if (kind === 'play' || kind === 'school') {
    g.fillStyle = kind === 'play' ? '#c9f230' : '#c9f230'; g.beginPath(); g.moveTo(64, 2); g.lineTo(126, 64); g.lineTo(64, 126); g.lineTo(2, 64); g.closePath(); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#111'; g.font = '44px sans-serif'; g.fillText(kind === 'play' ? '🛝' : '🎒', 64, 60);
    g.font = '800 13px Arial'; g.fillText(kind === 'play' ? 'PLAYGROUND' : 'SCHOOL', 64, 96); w = 0.9; h = 0.9;
  } else {        // crosswalk
    g.fillStyle = '#f7d117'; g.beginPath(); g.moveTo(64, 2); g.lineTo(126, 64); g.lineTo(64, 126); g.lineTo(2, 64); g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#111'; g.font = '56px sans-serif'; g.fillText('🚶', 64, 68); w = 0.8; h = 0.8;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  f = { mat: new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }), geo: new THREE.PlaneGeometry(w, h) };
  FACES.set(key, f); return f;
  function poly(g, n, r, a0) { g.beginPath(); for (let i = 0; i < n; i++) { const a = a0 + i * Math.PI * 2 / n; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill(); }
  function tri(g, r) { g.beginPath(); g.moveTo(64 - r, 64 - r * 0.6); g.lineTo(64 + r, 64 - r * 0.6); g.lineTo(64, 64 + r * 0.95); g.closePath(); g.fill(); }
}
const KIND = ['stop', 'yield', 'play', 'school', 'speed', 'ped'];
// merge many positioned pieces of one material into one geometry (fewer draw calls on phones)
const _m4 = new THREE.Matrix4();
function merge(parts) {
  let n = 0; for (const [geo] of parts) n += (geo.index ? geo.index.count : geo.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const [geo, mtx] of parts) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(mtx), P = g.attributes.position.array, N = g.attributes.normal.array;
    pos.set(P, o * 3); nor.set(N, o * 3); o += P.length / 3; g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.computeBoundingSphere(); return out;
}
const LAMP_ON = { red: new THREE.Color(0xff2a1a), amber: new THREE.Color(0xffb300), green: new THREE.Color(0x23ff7a) };
const LAMP_OFF = { red: new THREE.Color(0x2a0a0a), amber: new THREE.Color(0x2a1f06), green: new THREE.Color(0x082612) };
const LAMP_MAT = new THREE.MeshBasicMaterial({ toneMapped: false });

export class Signals {
  constructor(scene, traffic, opts = {}) {
    this.scene = scene; this.traffic = traffic; this.R = opts.radius ?? 240; this.clusters = new Map(); this.t = 0; this.lt = 0;
    this.signGroups = new Map();                                   // 200 m cells of City road signs
    if (SIGNS) for (const s of SIGNS.s) { const k = Math.floor(s[0] / 200) + ',' + Math.floor(s[1] / 200); let l = this.signGroups.get(k); if (!l) this.signGroups.set(k, l = { items: [], g: null }); l.items.push(s); }
  }
  update(dt, px, py) {
    if ((this.lt -= dt) <= 0) { this.lt = 0.25; for (const c of this.clusters.values()) this.paint(c); }
    if ((this.t -= dt) > 0) return; this.t = 1.0;
    this.updateLights(px, py); this.updateSigns(px, py);
  }
  // ---- traffic lights
  updateLights(px, py) {
    const T = this.traffic, R = this.R, sig = [];
    for (const k of T.ends.keys()) {
      const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1);
      if (Math.abs(x - px) > R || Math.abs(y - py) > R) continue;
      const n = T.node(k); if (n.deg >= 3 && (n.type === 'signals' || n.type === 'flasher')) sig.push(n);
    }
    // nodes of one intersection (divided roads make several) become one cluster
    const used = new Set(), want = new Set();
    for (const n of sig) {
      if (used.has(n)) continue;
      const members = [n]; used.add(n);
      for (let j = 0; j < members.length; j++) for (const m of sig) if (!used.has(m) && Math.hypot(m.x - members[j].x, m.y - members[j].y) < 32) { used.add(m); members.push(m); }
      const cx = members.reduce((a, m) => a + m.x, 0) / members.length, cy = members.reduce((a, m) => a + m.y, 0) / members.length;
      const key = Math.round(cx / 8) + ',' + Math.round(cy / 8); want.add(key);
      if (!this.clusters.has(key)) this.clusters.set(key, this.build(members, cx, cy));
    }
    for (const [k, c] of this.clusters) if (!want.has(k)) { this.scene.remove(c.g); c.g.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && o.geometry !== G.lamp) o.geometry.dispose(); }); this.clusters.delete(k); }
  }
  build(members, cx, cy) {
    const T = this.traffic, n0 = members[0], g = new THREE.Group(), keys = new Set(members.map(m => m.k));
    for (const m of members) { m.axis = n0.axis; m.offset = n0.offset; }        // one intersection, one signal timing
    const flasher = members.every(m => m.type === 'flasher');
    // the roads leaving the intersection, in four directions around its axis
    const bins = [null, null, null, null];
    for (const m of members) for (const [p, end] of T.ends.get(m.k) || []) {
      const other = end === 0 ? p.pts[p.pts.length - 1] : p.pts[0];
      if (keys.has(Math.round(other[0]) + ',' + Math.round(other[1])) || (p.len < 40 && Math.hypot(other[0] - cx, other[1] - cy) < 40)) continue;   // a link inside the intersection
      const a = end === 0 ? p.pts[Math.min(1, p.pts.length - 1)] : p.pts[Math.max(0, p.pts.length - 2)];
      const out = Math.atan2(a[0] - m.x, a[1] - m.y), rel = ((out - n0.axis) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2), b = Math.round(rel / (Math.PI / 2)) % 4;
      // how far this carriageway's outer edge is from the centre, sideways to the road
      const ob = n0.axis + b * Math.PI / 2, rxo = Math.cos(ob), ryo = -Math.sin(ob);
      const edge = Math.abs((m.x - cx) * rxo + (m.y - cy) * ryo) + (p.w || 8) / 2;
      if (!bins[b]) bins[b] = { w: edge * 2, out: ob }; else bins[b].w = Math.max(bins[b].w, edge * 2);
    }
    const heads = [], greyParts = [], darkParts = [], lamps = [];
    const O = new THREE.Object3D();
    const put = (list, geo, x, y, z, ry, sx = 1) => { O.position.set(x, y, z); O.rotation.set(0, ry, 0); O.scale.set(sx, 1, 1); O.updateMatrix(); list.push([geo, O.matrix.clone()]); };
    bins.forEach((bn, b) => {
      if (!bn) return;
      const across = Math.max(bins[(b + 1) % 4]?.w || 0, bins[(b + 3) % 4]?.w || 0) || 8;
      const hu = bn.out + Math.PI;                                  // heading of cars coming in on this road
      const R1 = across / 2 + 3, R2 = bn.w / 2 + 1.6;
      const [fx, fy] = dirOf(hu), [rx, ry] = dirOf(hu + Math.PI / 2);
      const x = cx + fx * R1 + rx * R2, y = cy + fy * R1 + ry * R2, gy = ground(x, y);
      put(greyParts, G.pole, x, gy, -y, 0);
      const armLen = Math.min(9, Math.max(3, R2 * 0.95));
      put(greyParts, G.arm, x, gy + 5.9, -y, rotY(hu - Math.PI / 2) - Math.PI / 2, armLen);
      const grp = T.group(n0, hu), face = rotY(hu + Math.PI), [bx, by] = dirOf(hu + Math.PI);
      for (const t of flasher ? [0.55] : [0.4, 0.85]) {
        const hx = x - rx * armLen * t, hy = y - ry * armLen * t;
        put(darkParts, G.head, hx, gy + 5.2, -hy, face);
        put(darkParts, G.back, hx - bx * 0.18, gy + 5.2, -(hy - by * 0.18), face);
        const cols = flasher ? ['amber', 'amber'] : ['red', 'amber', 'green'], ids = [];
        cols.forEach((col, i) => { O.position.set(hx + bx * 0.17, gy + 5.2 + (flasher ? 0.25 - i * 0.5 : 0.36 - i * 0.36), -(hy + by * 0.17)); O.rotation.set(0, face, 0); O.scale.set(1, 1, 1); O.updateMatrix(); ids.push(lamps.length); lamps.push({ m: O.matrix.clone(), col }); });
        heads.push({ grp, ids, flasher });
      }
    });
    if (greyParts.length) { const m = new THREE.Mesh(merge(greyParts), MAT.pole); m.castShadow = true; g.add(m); }
    if (darkParts.length) g.add(new THREE.Mesh(merge(darkParts), MAT.head));
    let lampMesh = null;
    if (lamps.length) { lampMesh = new THREE.InstancedMesh(G.lamp, LAMP_MAT, lamps.length); lamps.forEach((l, i) => { lampMesh.setMatrixAt(i, l.m); lampMesh.setColorAt(i, LAMP_OFF[l.col]); }); lampMesh.frustumCulled = false; g.add(lampMesh); }
    this.scene.add(g);
    const c = { g, n0, heads, lamps, lampMesh }; this.paint(c); return c;
  }
  paint(c) {
    if (!c.lampMesh) return;
    const T = this.traffic, now = performance.now() / 1000, L = c.lampMesh;
    for (const h of c.heads) {
      if (h.flasher) { const on = Math.floor(now * 2.2) % 2; L.setColorAt(h.ids[0], on ? LAMP_ON.amber : LAMP_OFF.amber); L.setColorAt(h.ids[1], on ? LAMP_OFF.amber : LAMP_ON.amber); continue; }
      const st = T.light(c.n0, h.grp);
      ['red', 'amber', 'green'].forEach((col, i) => L.setColorAt(h.ids[i], st === col ? LAMP_ON[col] : LAMP_OFF[col]));
    }
    L.instanceColor.needsUpdate = true;
  }
  // ---- City road signs, built per 200 m cell near you
  updateSigns(px, py) {
    const cx = Math.floor(px / 200), cy = Math.floor(py / 200);
    for (const [k, cell] of this.signGroups) {
      const [i, j] = k.split(',').map(Number), near = Math.abs(i - cx) <= 1 && Math.abs(j - cy) <= 1;
      if (near && !cell.g) {
        const g = cell.g = new THREE.Group(), O = new THREE.Object3D(), byFace = new Map(), posts = [];
        for (const [x, y, kd, f1, f2, txt] of cell.items) {
          const kind = KIND[kd], gy = ground(x, y);
          O.position.set(x, gy, -y); O.rotation.set(0, 0, 0); O.updateMatrix(); posts.push(O.matrix.clone());
          for (const f of f2 >= 0 ? [f1, f2] : [f1]) {
            const key = kind + '|' + (kind === 'speed' ? txt : ''), [dx, dy] = dirOf(f * Math.PI / 180);
            O.position.set(x + dx * 0.05, gy + 2.0, -(y + dy * 0.05)); O.rotation.set(0, rotY(f * Math.PI / 180), 0); O.updateMatrix();
            let l = byFace.get(key); if (!l) byFace.set(key, l = { fc: face(kind, txt), ms: [] }); l.ms.push(O.matrix.clone());
          }
        }
        const pm = new THREE.InstancedMesh(G.post, MAT.pole, posts.length); posts.forEach((m, i) => pm.setMatrixAt(i, m)); g.add(pm);
        for (const { fc, ms } of byFace.values()) { const im = new THREE.InstancedMesh(fc.geo, fc.mat, ms.length); ms.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im); }
        this.scene.add(g);
      } else if (!near && cell.g) { this.scene.remove(cell.g); cell.g.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); cell.g = null; }
    }
  }
}
