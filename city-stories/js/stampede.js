// Stampede time in Calgary: the real Stampede Park (east of Victoria Park/Stampede station) comes alive with a midway
// (Ferris wheel, swing ride, food and game booths, string lights), the Grandstand Show on the track in front of the
// Grandstand, a country music stage, an entrance arch, fireworks every night and big crowds in cowboy hats.
// Downtown gets a street party stage at Olympic Plaza. Crowds are instanced (one draw call per body part).
import { solidStage } from './stagekit.js?v=11111720';
import * as THREE from 'three';
import { drawLyricsOn } from './lyrics.js?v=11111720';
import { Character, HAT_COLORS } from './rig.js?v=11111720';
import { ground } from './terrain.js?v=11111720';
import { rotY } from './player.js?v=11111720';
import { Dancers } from './dancers.js?v=11111720';

export const STAMPEDE = { x: 420, y: -820 };             // the middle of Stampede Park (metres from City Hall)
export const PARK_SPOTS = {
  gate: { x: 324, y: -586, name: 'Stampede Park entrance' },
  midway: { x: 470, y: -585, name: 'The Stampede midway' },
  grandstand: { x: 420, y: -1160, name: 'Grandstand Show, Stampede Park' },
  plaza: { x: -60, y: 70, name: 'Olympic Plaza street party' },
};
// the stage music is full in front of a stage and fades out completely 200 m away
export const stageVolume = d => { const v = Math.max(0, Math.min(1, 1 - (d - 30) / 170)); return v * v; };
export const isShowTime = clock => clock >= 10 || clock < 2;       // stages play from 10 a.m. to 2 a.m.
export const isFireworks = clock => clock >= 21.5 || clock < 1;

const H = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
const pick = (a, h) => a[Math.floor(h * a.length) % a.length];
const SKIN = [0x8d5a3b, 0xb07a52, 0xc69373, 0xe1b899, 0x5c3a24, 0xa4704e, 0xf0cfb0, 0xd9a77e];
const TOPS = [0xc8102e, 0x1f6fd1, 0xf2b705, 0x2f8f4e, 0x111111, 0xf2f2ee, 0x7a2e8c, 0xe8742a, 0x9b2a2a, 0x3a6ea5, 0xb84a3a, 0x2a4a7a];
const BOTS = [0x2a3a5a, 0x3a4a6a, 0x23314a, 0x4a3b2a, 0x222222, 0x34405a];
const MAT = c => new THREE.MeshLambertMaterial({ color: c });
const local = (x, y, face, ax, ay) => { const s = Math.sin(face), c = Math.cos(face); return [x + ax * c + ay * s, y - ax * s + ay * c]; };

function merge(geos) {                       // non-indexed concat of position + normal
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), nm = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { p.set(g.attributes.position.array, o * 3); nm.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(p, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nm, 3)); return m;
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signTex(text, bg, fg = '#fff', sub = '') {
  return canvasTex(512, 128, (g, W, Hh) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, Hh); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, Hh - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (t, px, wt) => { let f = px; g.font = `${wt} ${f}px "Segoe UI", Roboto, sans-serif`; while (g.measureText(t).width > W - 44 && f > 12) { f -= 2; g.font = `${wt} ${f}px "Segoe UI", Roboto, sans-serif`; } };
    fit(text, sub ? 52 : 62, 800); g.fillText(text, W / 2, sub ? 50 : Hh / 2 + 2);
    if (sub) { fit(sub, 28, 600); g.fillText(sub, W / 2, 98); }
  });
}
const stripeTex = (c1, c2) => canvasTex(128, 32, (g, W, Hh) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 16, 0, 16, Hh); } });

// ---------------------------------------------------------------- the crowd (instanced low-poly people with hats)
class Crowd {
  constructor(scene, max) {
    const cyl = (r0, r1, h, x, y, z = 0, sz = 1) => new THREE.CylinderGeometry(r0, r1, h, 7).scale(1, 1, sz).translate(x, y, z);
    const legs = merge([cyl(0.085, 0.065, 0.84, 0.1, 0.46), cyl(0.085, 0.065, 0.84, -0.1, 0.46), new THREE.BoxGeometry(0.12, 0.07, 0.24).translate(0.1, 0.035, 0.05), new THREE.BoxGeometry(0.12, 0.07, 0.24).translate(-0.1, 0.035, 0.05), cyl(0.19, 0.17, 0.16, 0, 0.88, 0, 0.65)]);
    const torso = merge([cyl(0.2, 0.17, 0.52, 0, 1.2, 0, 0.62), new THREE.SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.35, 0.62).translate(0, 1.46, 0)]);
    const head = merge([new THREE.SphereGeometry(0.115, 10, 8).scale(0.92, 1.08, 1).translate(0, 1.62, 0.01), cyl(0.05, 0.055, 0.1, 0, 1.5)]);
    const brim = new THREE.CylinderGeometry(0.21, 0.21, 0.02, 14).scale(1, 1, 1.15).translate(0, 1.725, 0);
    const crown = new THREE.CylinderGeometry(0.085, 0.11, 0.13, 10).scale(1, 1, 1.15).translate(0, 1.8, 0);
    const hat = merge([brim, crown]);
    const arms = merge([cyl(0.055, 0.045, 0.56, 0.235, -0.28), cyl(0.055, 0.045, 0.56, -0.235, -0.28), new THREE.SphereGeometry(0.05, 6, 4).translate(0.235, -0.58, 0), new THREE.SphereGeometry(0.05, 6, 4).translate(-0.235, -0.58, 0)]);
    const mk = geo => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), max); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; scene.add(m); return m; };
    this.parts = { legs: mk(legs), torso: mk(torso), head: mk(head), hat: mk(hat), arms: mk(arms) };
    this.P = []; this.max = max; this.t = 0;
    this.m = new THREE.Matrix4(); this.m2 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0);
    this.sh = new THREE.Matrix4(); this.rx = new THREE.Matrix4(); this.c = new THREE.Color();
  }
  // p: { x, y, h, dance?: true, zone?: {x0,x1,y0,y1,avoid:[[x,y,r]]} }
  add(p, seed) {
    if (this.P.length >= this.max) return;
    const i = this.P.length, P = this.parts;
    p.s = 0.9 + H(seed, 1) * 0.18; p.off = H(seed, 2) * 6.3; p.beat = 1.9 + H(seed, 3) * 0.3; p.up = H(seed, 4); p.sp = 1 + H(seed, 5) * 0.5; p.pause = H(seed, 6) * 3; p.gy = ground(p.x, p.y);
    const hat = H(seed, 7) < 0.82;
    P.legs.setColorAt(i, this.c.set(pick(BOTS, H(seed, 8)))); P.torso.setColorAt(i, this.c.set(pick(TOPS, H(seed, 9)))); P.arms.setColorAt(i, this.c.set(pick(TOPS, H(seed, 9))));
    P.head.setColorAt(i, this.c.set(pick(SKIN, H(seed, 10)))); P.hat.setColorAt(i, this.c.set(hat ? pick(HAT_COLORS, H(seed, 11)) : pick(SKIN, H(seed, 10))));
    if (!hat) p.nohat = true;
    this.P.push(p);
    for (const k in P) { P[k].count = this.P.length; if (P[k].instanceColor) P[k].instanceColor.needsUpdate = true; }
  }
  target(p) {
    const z = p.zone;
    for (let k = 0; k < 8; k++) {
      const x = z.x0 + Math.random() * (z.x1 - z.x0), y = z.y0 + Math.random() * (z.y1 - z.y0);
      if (!(z.avoid || []).some(a => Math.hypot(x - a[0], y - a[1]) < a[2])) { p.tx = x; p.ty = y; return; }
    }
    p.tx = p.x; p.ty = p.y;
  }
  update(dt, px, py) {
    this.t += dt; const t = this.t, P = this.parts, m = this.m, q = this.q, v = this.v, s = this.s;
    for (let i = 0; i < this.P.length; i++) {
      const p = this.P[i]; let bounce = 0, arm = 0, yaw = p.h;
      if (p.dance) {
        const b = Math.sin(t * p.beat * Math.PI + p.off);
        bounce = Math.max(0, b) * 0.11; yaw = p.h + Math.sin(t * 0.6 + p.off) * 0.2;
        arm = p.up > 0.55 ? 2.7 + Math.sin(t * p.beat * Math.PI * 0.5 + p.off) * 0.35 : p.up > 0.3 ? 0.6 + b * 0.5 : b * 0.15;
      } else if (p.zone) {
        if (p.pause > 0) { p.pause -= dt; arm = Math.sin(t + p.off) * 0.05; }
        else {
          if (p.tx == null) this.target(p);
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
          if (d < 0.6) { p.tx = null; p.pause = Math.random() < 0.5 ? 1 + Math.random() * 6 : 0; }
          else {
            const st = Math.min(d, p.sp * dt); p.x += dx / d * st; p.y += dy / d * st; p.h = Math.atan2(dx, dy); yaw = p.h;
            p.ph = (p.ph || 0) + dt * p.sp * 5.5; bounce = Math.abs(Math.sin(p.ph)) * 0.035; arm = Math.sin(p.ph) * 0.35;
            if ((p.gt = (p.gt || 0) - dt) <= 0) { p.gt = 0.5; p.gy = ground(p.x, p.y); }
          }
        }
      }
      q.setFromAxisAngle(this.Y, rotY(yaw)); v.set(p.x, p.gy + bounce, -p.y); s.setScalar(p.s);
      m.compose(v, q, s);
      P.legs.setMatrixAt(i, m); P.torso.setMatrixAt(i, m); P.head.setMatrixAt(i, m); P.hat.setMatrixAt(i, m);
      this.sh.makeTranslation(0, 1.43, 0); this.rx.makeRotationX(-arm); this.m2.multiplyMatrices(m, this.sh).multiply(this.rx);
      P.arms.setMatrixAt(i, this.m2);
    }
    for (const k in P) P[k].instanceMatrix.needsUpdate = true;
  }
  set visible(on) { for (const k in this.parts) this.parts[k].visible = on; }
}

// ---------------------------------------------------------------- a concert stage (front centre x,y, facing `face`)
class Stage {
  constructor(parent, x, y, face, o) {
    this.x = x; this.y = y; this.face = face; this.o = o;
    const g = this.g = new THREE.Group(), W = o.w;
    g.position.set(x, ground(x, y), -y); g.rotation.y = rotY(face); parent.add(g);
    const box = (w, h, d, m, bx, by, bz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(bx, by, bz); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    const black = MAT(0x1a1b1f), truss = MAT(0x9aa0a6), D = o.d || 10, HT = o.h || 10;
    box(W, 1.5, D, black, 0, 0.75, -D / 2); box(W, 0.1, D, MAT(0x3a2a1c), 0, 1.55, -D / 2);
    for (const sx of [-W / 2 + 0.4, W / 2 - 0.4]) for (const z of [-0.5, -D + 0.5]) box(0.5, HT, 0.5, truss, sx, HT / 2, z);
    box(W, 0.5, 0.5, truss, 0, HT, -0.5); box(W, 0.5, 0.5, truss, 0, HT, -D + 0.5); for (const sx of [-W / 2 + 0.4, 0, W / 2 - 0.4]) box(0.5, 0.5, D, truss, sx, HT, -D / 2);
    if (o.roof) { const r = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.3, D + 1), MAT(o.roof)); r.position.set(0, HT + 0.5, -D / 2); g.add(r); }
    // the screen
    const cv = this.cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; this.cx = cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    const sw = Math.min(W * 0.62, 18), sh = sw / 2;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false })); scr.position.set(0, 1.6 + Math.min(HT - 2.4, sh / 2 + 1.6) , -D + 0.75); g.add(scr);
    box(sw + 1, sh + 1, 0.4, black, 0, scr.position.y, -D + 0.5);
    // a banner over the stage
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.7, W * 0.7 / 4), new THREE.MeshBasicMaterial({ map: signTex(o.title, o.color, '#fff', o.sub), toneMapped: false, side: THREE.DoubleSide }));
    ban.position.set(0, HT + 0.5 + W * 0.7 / 8 + 0.3, -0.3); g.add(ban);
    // speakers
    for (const sx of [-W / 2 - 1.8, W / 2 + 1.8]) box(2.6, 5, 2.2, black, sx, 2.5, -2.5);
    // lights
    this.beams = [];
    const bm = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const nb = Math.max(3, Math.round(W / 5));
    for (let i = 0; i < nb; i++) {
      const geo = new THREE.ConeGeometry(1.8, 34, 14, 1, true); geo.translate(0, -17, 0);
      const b = new THREE.Mesh(geo, bm([0xff2a6d, 0x05d9e8, 0xffd319, 0x8b5cf6, 0x39ff14, 0xff7b00][i % 6])); b.position.set(-W / 2 + 1.5 + i * (W - 3) / (nb - 1), HT - 0.2, -1); g.add(b); this.beams.push(b);
    }
    this.wash = new THREE.PointLight(0xffaa55, 0, 50, 1.5); this.wash.position.set(0, HT - 1, 6); g.add(this.wash);
    // the band (3D people in hats) and the front rows of the crowd: real people dancing; further back the light crowd
    const n = o.band || 3, bandSpots = [];
    for (let i = 0; i < n; i++) { const lead = i === 0, sx = lead ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * W / (n + 1), sz = lead ? -2.5 : -4.5 - (i % 2); const [bx, by] = local(x, y, face, sx, sz); bandSpots.push({ x: bx, y: by, h: face, z: 1.6 }); }
    this.band = new Dancers(parent, bandSpots, { hats: true, seed: o.seed });
    const front = [], nf = o.front || 16;
    for (let i = 0; i < nf; i++) { const ax = (H(i + o.seed, 51) - 0.5) * W * 0.85, ay = 2.5 + H(i + o.seed, 52) * (o.frontD || 6.5); const [fx, fy] = local(x, y, face, ax, ay); front.push({ x: fx, y: fy, h: face + Math.PI + (H(i + o.seed, 53) - 0.5) * 0.4 }); }
    this.front = new Dancers(parent, front, { hats: true, seed: o.seed + 7 });
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), truss); mic.position.set(0, 2.35, -2); g.add(mic);
    this.t = H(o.seed, 9) * 10; this.st = 0;
    // solid: the deck (up the front steps), the speakers and the screen wall; the mic is yours if you want it
    this.kit = solidStage({ x, y, face, W, D, deckH: 1.6, g, band: this.band, name: o.title, micAy: -2, parts: [[-W / 2 - 1.8, -2.5, 2.6, 2.2, 5], [W / 2 + 1.8, -2.5, 2.6, 2.2, 5], [0, -D + 0.5, sw + 1, 0.6, 1.6 + sh + 2]] });
  }
  draw(t) {
    const g = this.cx, W = 512, Hh = 256, o = this.o;
    const grd = g.createLinearGradient(0, 0, W, Hh); grd.addColorStop(0, `hsl(${(t * 35 + o.hue) % 360},80%,26%)`); grd.addColorStop(1, `hsl(${(t * 35 + o.hue + 120) % 360},80%,14%)`);
    g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 32; i++) { const v = 0.25 + 0.75 * Math.abs(Math.sin(t * 6 + i * 0.7) * Math.sin(t * 2.3 + i * 0.31)); g.fillStyle = `hsla(${(i * 11 + t * 60) % 360},90%,60%,0.7)`; g.fillRect(8 + i * 15.6, Hh - v * 110, 11, v * 110); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 50px "Segoe UI", Roboto, sans-serif'; g.fillText(o.screen, W / 2, 66);
    g.font = '600 26px "Segoe UI", Roboto, sans-serif'; g.fillText(this.kit && this.kit.performing ? '🎤 LIVE ON STAGE: ' + (this.kit.who || 'YOU') : o.screenSub, W / 2, 116);
    if (!o.quiet || (this.kit && this.kit.performing)) drawLyricsOn(g, W);            // the song's words on the big screen while it plays
    this.tex.needsUpdate = true;
  }
  update(dt, near, night, live) {
    this.t += dt; if (this.kit && this.kit.performing) live = true;      // you're on: the show is on, whatever the time
    for (const b of this.beams) b.visible = night && live;
    this.wash.intensity = night && live ? 30 : 0;
    if (!near) return;
    this.band.update(dt, near, true, live); this.front.update(dt, near, live);
    if (night && live) { this.beams.forEach((b, i) => { b.rotation.z = Math.sin(this.t * 0.9 + i) * 0.55; b.rotation.x = 0.35 + Math.sin(this.t * 0.7 + i * 1.7) * 0.35; }); this.wash.color.setHSL((this.t * 0.08) % 1, 1, 0.55); }
    if ((this.st -= dt) <= 0) { this.st = 0.12; this.draw(this.t); }
  }
}

// ---------------------------------------------------------------- fireworks over the Grandstand
class Fireworks {
  constructor(parent, x, y) {
    this.x = x; this.y = y; this.gy = ground(x, y); this.N = 10; this.K = 160; const n = this.N * this.K;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.base = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 5, map: canvasTex(32, 32, (g2, W) => { const r = g2.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = r; g2.fillRect(0, 0, 32, 32); }), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true }));
    this.pts.frustumCulled = false; parent.add(this.pts);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;
    this.next = 0; this.slot = 0; this.c = new THREE.Color();
  }
  burst() {
    const s = this.slot++ % this.N, K = this.K, cx = this.x + (Math.random() - 0.5) * 140, cy = this.y + (Math.random() - 0.5) * 60, ch = this.gy + 70 + Math.random() * 60;
    this.c.setHSL(Math.random(), 1, 0.6); const c2 = new THREE.Color().setHSL(Math.random(), 1, 0.65), sp = 24 + Math.random() * 16;
    for (let k = 0; k < K; k++) {
      const i = s * K + k, u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), v = sp * (0.85 + Math.random() * 0.15);
      this.pos[i * 3] = cx; this.pos[i * 3 + 1] = ch; this.pos[i * 3 + 2] = -cy;
      this.vel[i * 3] = r * Math.cos(a) * v; this.vel[i * 3 + 1] = u * v; this.vel[i * 3 + 2] = r * Math.sin(a) * v;
      const cc = k % 3 ? this.c : c2; this.base[i * 3] = cc.r * 0.75; this.base[i * 3 + 1] = cc.g * 0.75; this.base[i * 3 + 2] = cc.b * 0.75; this.life[i] = 2.2 + Math.random() * 0.8;
    }
    return { x: cx, y: cy };
  }
  update(dt, on) {
    const n = this.N * this.K, P = this.pos, V = this.vel, C = this.col, B = this.base, L = this.life;
    if (on && (this.next -= dt) <= 0) { this.next = 0.5 + Math.random() * 1.3; this.burst(); if (this.onBoom) this.onBoom(); }
    for (let i = 0; i < n; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt; const f = Math.max(0, Math.min(1, L[i] / 1.4));
      V[i * 3] *= 1 - dt * 1.2; V[i * 3 + 1] = V[i * 3 + 1] * (1 - dt * 1.2) - 9.8 * dt * 0.35; V[i * 3 + 2] *= 1 - dt * 1.2;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      C[i * 3] = B[i * 3] * f; C[i * 3 + 1] = B[i * 3 + 1] * f; C[i * 3 + 2] = B[i * 3 + 2] * f;
      if (L[i] <= 0) P[i * 3 + 1] = -9999;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the whole fair
export class Stampede {
  constructor(scene, { mobile = false } = {}) {
    this.scene = scene; this.mobile = mobile; this.built = false; this.t = 0; this.level = 0;
    this.g = new THREE.Group(); this.g.name = 'stampede'; this.g.visible = false; scene.add(this.g);
    this.plazaG = new THREE.Group(); this.plazaG.visible = false; scene.add(this.plazaG);
  }
  build() {
    this.built = true; const g = this.g, mob = this.mobile;
    this.crowd = new Crowd(g, mob ? 380 : 1000);
    this.stages = [];
    // the Grandstand Show: a big stage on the track, facing the Grandstand to the north
    const gs = new Stage(g, 420, -1192, 0, { front: mob ? 18 : 44, frontD: 15, w: 34, d: 12, h: 13, title: 'GRANDSTAND SHOW', sub: 'CALGARY STAMPEDE', color: '#8b1a1a', screen: 'GRANDSTAND SHOW', screenSub: 'LIVE TONIGHT · FIREWORKS AT 10:30', hue: 20, band: 5, seed: 3, shirt: 0xf2efe6 });
    this.stages.push(gs);
    let seed = 1;
    const fill = (st, n, w, d0, d1) => { for (let i = 0; i < n; i++, seed++) { const ax = (H(seed, 20) - 0.5) * w, ay = d0 + H(seed, 21) * (d1 - d0); const [x, y] = local(st.x, st.y, st.face, ax, ay); this.crowd.add({ x, y, h: st.face + Math.PI + (H(seed, 22) - 0.5) * 0.4, dance: true }, seed); } };
    fill(gs, mob ? 120 : 330, 52, 18, 46);
    // the country stage at the east end of the midway
    const cs = new Stage(g, 688, -608, Math.PI * 1.5, { front: mob ? 8 : 18, frontD: 9, w: 16, d: 8, h: 9, roof: 0x5a3a22, title: 'COUNTRY STAGE', sub: 'LIVE MUSIC ALL DAY', color: '#5a3a22', screen: 'COUNTRY NIGHT', screenSub: 'BOOTS ON · HATS ON', hue: 30, band: 4, seed: 11 });
    this.stages.push(cs);
    fill(cs, mob ? 40 : 100, 22, 12, 30);
    // the midway: Ferris wheel, swing ride, booths, food trucks, lights
    this.ferris = this.makeFerris(520, -640);
    this.swing = this.makeSwing(372, -528);
    this.makeBooths();
    this.makeArch(324, -586, Math.PI * 1.5);
    this.carousel = this.makeCarousel(400, -640);
    this.drop = this.makeDropTower(545, -522);
    const avoid = [[520, -640, 14], [372, -528, 11], [400, -640, 9], [545, -522, 6]];
    const aisle = { x0: 338, x1: 548, y0: -594, y1: -578, avoid }, cross = { x0: 436, x1: 444, y0: -668, y1: -500, avoid }, wide = { x0: 336, x1: 552, y0: -668, y1: -500, avoid };
    for (let i = 0; i < (mob ? 170 : 460); i++, seed++) {
      const r = H(seed, 33), zone = r < 0.5 ? aisle : r < 0.65 ? cross : wide;
      const x = zone.x0 + H(seed, 30) * (zone.x1 - zone.x0), y = zone.y0 + H(seed, 31) * (zone.y1 - zone.y0);
      if (avoid.some(a => Math.hypot(x - a[0], y - a[1]) < a[2])) continue;
      this.crowd.add({ x, y, h: H(seed, 32) * 6.28, zone }, seed);
    }
    // people lining up at the Ferris wheel and watching the swing ride
    for (let i = 0; i < 14; i++, seed++) this.crowd.add({ x: 503 - i * 0.9, y: -626 + (i % 2) * 0.7, h: Math.PI * 0.5 }, seed);
    this.fireworks = new Fireworks(g, 420, -1260);
    // downtown: a street party stage at Olympic Plaza
    const ps = new Stage(this.plazaG, -62, 34, 0, { front: mob ? 6 : 10, w: 14, d: 7, h: 8.5, title: 'STREET PARTY', sub: 'STAMPEDE ON OLYMPIC PLAZA', color: '#1d4e8f', screen: 'YAHOO!', screenSub: 'STAMPEDE STREET PARTY', hue: 200, band: 3, seed: 21, quiet: true });
    this.plazaStage = ps;
    this.plazaCrowd = new Crowd(this.plazaG, mob ? 70 : 150);
    for (let i = 0; i < (mob ? 70 : 150); i++, seed++) { const [x, y] = local(ps.x, ps.y, 0, (H(seed, 40) - 0.5) * 34, 4 + H(seed, 41) * 40); this.plazaCrowd.add({ x, y, h: Math.PI + (H(seed, 42) - 0.5) * 0.5, dance: H(seed, 43) < 0.8, zone: H(seed, 43) < 0.8 ? null : { x0: -110, x1: -15, y0: 40, y1: 118 } }, seed); }
    this.makeGrill(-100, 90);
  }
  // ---- the Ferris wheel (wheel turns about the east-west axis)
  makeFerris(x, y) {
    const g = new THREE.Group(), gy = ground(x, y), R = 17, HUB = 20; g.position.set(x, gy, -y); this.g.add(g);
    const steel = MAT(0xe8e8ea), red = MAT(0xc8102e);
    for (const sx of [-2.6, 2.6]) for (const sz of [-1, 1]) {      // A-frames on both sides of the wheel, spread north-south
      const len = Math.hypot(8.5, HUB), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, len, 8), steel);
      leg.position.set(sx, HUB / 2, sz * 4.25); leg.rotation.x = -sz * Math.atan2(8.5, HUB); leg.castShadow = true; g.add(leg);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 12), MAT(0x4a4a50)); base.position.y = 0.3; g.add(base);
    const wheel = new THREE.Group(); wheel.position.y = HUB; g.add(wheel);
    // rotate so the wheel plane is north-south (axle along x)
    const disc = new THREE.Group(); disc.rotation.y = Math.PI / 2; wheel.add(disc);
    for (const z of [-1.3, 1.3]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 6, 64), red); rim.position.z = z; disc.add(rim); const inner = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.18, 6, 48), steel); inner.position.z = z; disc.add(inner); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.6, 16), steel); hub.rotation.x = Math.PI / 2; disc.add(hub);
    const NS = 18;
    for (let k = 0; k < NS; k++) for (const z of [-1.3, 1.3]) { const a = k / NS * Math.PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(0.16, R, 0.16), steel); sp.position.set(Math.sin(a) * R / 2, Math.cos(a) * R / 2, z); sp.rotation.z = -a; disc.add(sp); }
    // bulbs on the rims and spokes
    const NB = NS * 10, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NB * 2);
    const m = new THREE.Matrix4(), c = new THREE.Color(); let bi = 0;
    for (const z of [-1.45, 1.45]) for (let k = 0; k < NB; k++) {
      const spoke = k % 10 >= 5, a = (spoke ? Math.floor(k / 10) / NS : k / NB) * Math.PI * 2, r = spoke ? R * (0.3 + (k % 5) * 0.14) : R;
      m.makeTranslation(Math.sin(a) * r, Math.cos(a) * r, z); bulbs.setMatrixAt(bi, m); bulbs.setColorAt(bi, c.setHSL((k / NB * 3) % 1, 1, 0.6)); bi++;
    }
    disc.add(bulbs); this.ferrisBulbs = bulbs; this.bulbBase = bulbs.instanceColor.array.slice();
    // gondolas hang level
    const cols = [0xc8102e, 0x1f6fd1, 0xf2b705, 0x2f8f4e, 0xe8742a, 0x7a2e8c];
    this.gondolas = [];
    for (let k = 0; k < NS; k++) {
      const gd = new THREE.Group(), cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.8), MAT(cols[k % cols.length])), roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 4), MAT(0xf2f2ee));
      cab.position.y = -1.6; roof.position.y = -0.55; roof.rotation.y = Math.PI / 4; const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 4), steel); rod.position.y = -0.2;
      gd.add(cab, roof, rod); g.add(gd); this.gondolas.push(gd);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: signTex('SKY WHEEL', '#c8102e'), toneMapped: false, side: THREE.DoubleSide }));
    sign.position.set(0, 3.2, -9.5); sign.rotation.y = Math.PI; g.add(sign);
    return { g, wheel, R, HUB, a: 0 };
  }
  makeSwing(x, y) {
    const g = new THREE.Group(), gy = ground(x, y); g.position.set(x, gy, -y); this.g.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 16, 12), MAT(0xf2b705)); pole.position.y = 8; pole.castShadow = true; g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.6, 20), MAT(0x1f6fd1)); base.position.y = 0.3; g.add(base);
    const top = new THREE.Group(); top.position.y = 15; g.add(top);
    const tex = stripeTex('#c8102e', '#f2f2ee'); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(4, 1);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.6, 24, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); canopy.position.y = 1.4; top.add(canopy);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.12, 4, 32), MAT(0xf2b705)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; top.add(ring);
    const NB = 40, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NB), m = new THREE.Matrix4(), c = new THREE.Color();
    for (let k = 0; k < NB; k++) { const a = k / NB * Math.PI * 2; m.makeTranslation(Math.cos(a) * 6.2, 0.05, Math.sin(a) * 6.2); bulbs.setMatrixAt(k, m); bulbs.setColorAt(k, c.set(k % 2 ? 0xffd27a : 0xff4a6a)); }
    top.add(bulbs); this.swingBulbs = bulbs;
    const hangs = [], chainM = MAT(0x777777), seatM = [MAT(0xc8102e), MAT(0x1f6fd1), MAT(0xf2b705), MAT(0x2f8f4e)];
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, piv = new THREE.Group(); piv.position.set(Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4); piv.rotation.y = -a; top.add(piv);
      const h = new THREE.Group(); piv.add(h);
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 3), chainM); ch.position.y = -3; h.add(ch);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), seatM[k % 4]); seat.position.y = -6; h.add(seat);
      if (k % 3 !== 1) { const rider = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.3), MAT(pick(TOPS, H(k, 50)))); rider.position.y = -5.6; h.add(rider); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), MAT(pick(SKIN, H(k, 51)))); hd.position.y = -5.1; h.add(hd); }
      hangs.push(h);
    }
    return { g, top, hangs, spin: 0, ph: 0 };
  }
  makeBooths() {
    const L = [['MINI DONUTS', '#c8102e'], ['CORN DOGS', '#e8742a'], ['LEMONADE', '#d8a800'], ['RING TOSS', '#1f6fd1'], ['BBQ', '#7a3a1c'], ['CANDY APPLES', '#b0103a'], ['FUNNEL CAKES', '#7a2e8c'], ['PANCAKES', '#2f8f4e'], ['POUTINE', '#1f4f7f'], ['DUCK POND', '#1f9bb0'], ['COTTON CANDY', '#d0508a'], ['BALLOON DARTS', '#c8102e'], ['ICE CREAM', '#3a6ea5'], ['BIG PRIZES', '#e0a020'], ['FRIED PICKLES', '#5a7a2a'], ['TURKEY LEGS', '#8a4a1a']];
    const spots = [];
    for (const [y, face] of [[-573, Math.PI], [-599, 0]]) for (let x = 345; x <= 535; x += 10) if (Math.abs(x - 440) > 6) spots.push([x, y, face]);
    for (let x = 352; x <= 540; x += 12) spots.push([x, -496, Math.PI]);
    for (let x = 350; x <= 480; x += 13) if (Math.abs(x - 400) > 12) spots.push([x, -664, 0]);
    const N = spots.length, rt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), c = new THREE.Color();
    const part = (geo, mat, n = N) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; this.g.add(m); return m; };
    const roofTex = canvasTex(128, 32, (g2, W, Hh) => { for (let i = 0; i < 8; i++) { g2.fillStyle = i % 2 ? '#ffffff' : '#9a9a9a'; g2.fillRect(i * 16, 0, 16, Hh); } }); roofTex.wrapS = THREE.RepeatWrapping; roofTex.repeat.set(2, 1);
    const counter = part(new THREE.BoxGeometry(5, 1.1, 1).translate(0, 0.55, 0.9), MAT(0xf2efe6));
    const back = part(new THREE.BoxGeometry(5, 2.6, 3).translate(0, 1.3, -1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const roof = part(new THREE.BoxGeometry(5.6, 0.25, 4.6).rotateX(-0.12).translate(0, 3.1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, map: roofTex }));
    const poles = part(merge([new THREE.CylinderGeometry(0.06, 0.06, 3, 5).translate(-2.6, 1.5, 1.6), new THREE.CylinderGeometry(0.06, 0.06, 3, 5).translate(2.6, 1.5, 1.6)]), MAT(0xdddddd));
    const byLabel = new Map();
    spots.forEach(([x, y, face], i) => {
      const k = (i * 7 + Math.floor(i / 3)) % L.length, [label, col] = L[k];
      q.setFromAxisAngle(Y, rotY(face)); v.set(x, ground(x, y), -y); rt.compose(v, q, one);
      for (const m of [counter, back, roof, poles]) m.setMatrixAt(i, rt);
      back.setColorAt(i, c.set(col).multiplyScalar(0.8)); roof.setColorAt(i, c.set(col));
      if (!byLabel.has(k)) byLabel.set(k, []); byLabel.get(k).push(rt.clone());
    });
    for (const [k, mats] of byLabel) {
      const [label, col] = L[k], sg = new THREE.PlaneGeometry(4.6, 1.15).translate(0, 3.8, 1.9);
      const m = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: signTex(label, col), toneMapped: false }), mats.length);
      mats.forEach((mm, i) => m.setMatrixAt(i, mm)); this.g.add(m);
    }
    const trucks = [['TACOS', 0xf2b705], ['PIZZA', 0xc8102e], ['BURGERS', 0x1f6fd1], ['SMOOTHIES', 0x2f8f4e], ['PEROGIES', 0x7a2e8c]];
    trucks.forEach(([t, cc], i) => this.truck(456 + i * 13, -618, 0, t, cc));
    // string lights along the main aisle and the cross aisle
    const runs = [];
    for (const y of [-577, -595]) runs.push(Array.from({ length: 11 }, (_, i) => [338 + i * 21, y]));
    for (const x of [434, 446]) runs.push(Array.from({ length: 9 }, (_, i) => [x, -500 - i * 21]));
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 6, 6), pm = MAT(0x5a3a22);
    const NB = runs.reduce((a, r) => a + (r.length - 1) * 14, 0), bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NB), m = new THREE.Matrix4();
    const wire = []; let bi = 0;
    for (const r of runs) {
      for (const [x, y] of r) { const p = new THREE.Mesh(pole, pm); p.position.set(x, ground(x, y) + 3, -y); this.g.add(p); }
      for (let j = 0; j + 1 < r.length; j++) {
        const [ax, ay] = r[j], [bx, by] = r[j + 1], ga = ground(ax, ay) + 5.9, gb = ground(bx, by) + 5.9; let px, py, pz;
        for (let k = 0; k <= 14; k++) {
          const u = k / 14, x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = ga + (gb - ga) * u - Math.sin(u * Math.PI) * 1.1;
          if (k > 0) wire.push(px, pz, py, x, z, -y); px = x; py = -y; pz = z;
          if (k < 14) { m.makeTranslation(x, z - 0.15, -y); bulbs.setMatrixAt(bi, m); bulbs.setColorAt(bi, c.set([0xffd27a, 0xff4a6a, 0x6ac8ff, 0x8aff6a][bi % 4])); bi++; }
        }
      }
    }
    bulbs.count = bi; this.g.add(bulbs); this.aisleBulbs = bulbs;
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); this.g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  }
  // ---- a carousel (merry-go-round) with horses that rise and fall
  makeCarousel(x, y) {
    const g = new THREE.Group(), gy = ground(x, y); g.position.set(x, gy, -y); this.g.add(g);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.2, 0.6, 28), MAT(0x7a2e8c)); deck.position.y = 0.3; g.add(deck);
    const spin = new THREE.Group(); spin.position.y = 0.6; g.add(spin);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.6, 16), MAT(0xf2b705)); col.position.y = 2.3; spin.add(col);
    const tex = stripeTex('#c8102e', '#f7f3ea'); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(5, 1);
    const top = new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.4, 28, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); top.position.y = 5.8; spin.add(top);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.8, 28, 1, true), new THREE.MeshLambertMaterial({ color: 0xf2b705, side: THREE.DoubleSide })); rim.position.y = 4.4; spin.add(rim);
    const NB = 36, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false }), NB), mm = new THREE.Matrix4();
    for (let k = 0; k < NB; k++) { const a = k / NB * Math.PI * 2; mm.makeTranslation(Math.cos(a) * 7.7, 4.4, Math.sin(a) * 7.7); bulbs.setMatrixAt(k, mm); } spin.add(bulbs);
    const horseCols = [0xf2efe6, 0x5a3a22, 0x2a2a2a, 0xc8a070];
    this.horses = [];
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, r = k % 2 ? 5.6 : 4.2, h = new THREE.Group(); h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); h.rotation.y = -a; spin.add(h);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 5), MAT(0xe0c060)); pole.position.y = 2.2; h.add(pole);
      const hb = new THREE.Group(); h.add(hb); const m = MAT(horseCols[k % 4]);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 1.4), m); body.position.y = 1.4; hb.add(body);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.35), m); neck.position.set(0, 1.85, 0.6); neck.rotation.x = 0.4; hb.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.55), m); head.position.set(0, 2.15, 0.85); hb.add(head);
      for (const [lx, lz] of [[-0.15, 0.5], [0.15, 0.5], [-0.15, -0.5], [0.15, -0.5]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), m); l.position.set(lx, 0.85, lz); hb.add(l); }
      this.horses.push([hb, k * 0.9]);
    }
    return { spin };
  }
  // ---- a drop tower: the ring of seats climbs slowly and falls fast
  makeDropTower(x, y) {
    const g = new THREE.Group(), gy = ground(x, y); g.position.set(x, gy, -y); this.g.add(g);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 46, 12), MAT(0x1f6fd1)); tower.position.y = 23; tower.castShadow = true; g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 12), MAT(0xc8102e)); cap.position.y = 47.5; g.add(cap);
    const NB = 24, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NB), mm = new THREE.Matrix4(), c = new THREE.Color();
    for (let k = 0; k < NB; k++) { mm.makeTranslation(Math.cos(k * 2.4) * 1.3, 2 + k * 1.9, Math.sin(k * 2.4) * 1.3); bulbs.setMatrixAt(k, mm); bulbs.setColorAt(k, c.setHSL(k / NB, 1, 0.6)); } g.add(bulbs);
    const ring = new THREE.Group(); g.add(ring);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1, 16, 1, true), new THREE.MeshLambertMaterial({ color: 0xf2b705, side: THREE.DoubleSide })); ring.add(band);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5), MAT(pick(TOPS, H(k, 70)))); s.position.set(Math.cos(a) * 2.9, -0.6, Math.sin(a) * 2.9); s.rotation.y = -a; ring.add(s); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.6, 16), MAT(0x4a4a50)); base.position.y = 0.3; g.add(base);
    return { ring, t: 0 };
  }
  truck(x, y, face, label, color) {
    const g = new THREE.Group(); g.position.set(x, ground(x, y), -y); g.rotation.y = rotY(face); this.g.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 6), MAT(color)); body.position.set(0, 1.9, -0.6); body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.9, 1.8), MAT(0xf2f2ee)); cab.position.set(0, 1.45, 3.2); g.add(cab);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), new THREE.MeshBasicMaterial({ color: 0x222831 })); win.position.set(1.26, 2.2, -0.6); win.rotation.y = Math.PI / 2; g.add(win);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signTex(label, '#' + new THREE.Color(color).getHexString()), toneMapped: false })); sign.position.set(1.27, 3.05, -0.6); sign.rotation.y = Math.PI / 2; g.add(sign);
    for (const [wx, wz] of [[-1.25, 2.6], [1.25, 2.6], [-1.25, -2.6], [1.25, -2.6]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), MAT(0x1a1a1a)); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.45, wz); g.add(w); }
  }
  makeArch(x, y, face) {
    const g = new THREE.Group(); g.position.set(x, ground(x, y), -y); g.rotation.y = rotY(face); this.g.add(g);
    const log = MAT(0x7a4a24);
    for (const sx of [-8, 8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 9, 10), log); p.position.set(sx, 4.5, 0); p.castShadow = true; g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.9, 0.9), log); beam.position.y = 8.6; g.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTex('CALGARY STAMPEDE', '#8b1a1a', '#ffd27a', 'WELCOME TO STAMPEDE PARK · YAHOO!'), toneMapped: false, side: THREE.DoubleSide }));
    sign.position.set(0, 10.9, 0); g.add(sign);
    const NB = 30, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), NB), m = new THREE.Matrix4();
    for (let k = 0; k < NB; k++) { m.makeTranslation(-7 + k * 14 / (NB - 1), 12.75, 0.05); bulbs.setMatrixAt(k, m); } g.add(bulbs);
  }
  makeGrill(x, y) {            // a free pancake breakfast at the plaza
    const g = new THREE.Group(); g.position.set(x, ground(x, y), -y); this.plazaG.add(g);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 1.4), MAT(0xf2efe6)); t.position.set(i * 7, 0.45, 0); g.add(t); const gr = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 1.2), MAT(0x2a2a2a)); gr.position.set(i * 7, 0.96, 0); g.add(gr); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: signTex('FREE PANCAKE BREAKFAST', '#2f8f4e'), toneMapped: false, side: THREE.DoubleSide })); sign.position.set(7, 3, 0); g.add(sign);
    for (const sx of [3.5, 10.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), MAT(0xdddddd)); p.position.set(sx, 1.2 + 0.6, 0); g.add(p); }
    this.cooks = [];
    for (let i = 0; i < 3; i++) { const ch = new Character({ skin: pick(SKIN, H(i, 60)), shirt: 0xf2f2ee, pants: 0x2a3a5a, hair: 0x15100d, hat: 0xf2efe6 }); ch.g.position.set(i * 7, 0, -1.2); g.add(ch.g); this.cooks.push(ch); }
  }
  // returns how loud the stage music should be where the player is (0..1)
  update(dt, px, py, clock) {
    const dPark = Math.hypot(px - STAMPEDE.x, py - STAMPEDE.y), dPlaza = Math.hypot(px - PARK_SPOTS.plaza.x, py - PARK_SPOTS.plaza.y);
    if (!this.built) { if (dPark < 1500 || dPlaza < 900) this.build(); else return 0; }
    this.t += dt;
    const night = clock >= 20.5 || clock < 5.5, live = isShowTime(clock), park = dPark < 2200, plaza = dPlaza < 1200;
    this.g.visible = park; this.plazaG.visible = plaza;
    let level = 0;
    if (park) {
      const near = dPark < 900;
      if (near) {
        if (dPark < 600 || (this._ct = (this._ct || 0) + 1) % 3 === 0) this.crowd.update(dPark < 600 ? dt : dt * 3, px, py);
        for (const s of this.stages) { const d = Math.hypot(px - s.x, py - s.y); s.update(dt, d < 500, night, live); if (live || s.kit.performing) level = Math.max(level, s.kit.performing ? 1 : stageVolume(d)); }
        // the Ferris wheel and swing ride
        const f = this.ferris; f.a += dt * 0.09; f.wheel.rotation.x = f.a;
        this.gondolas.forEach((gd, k) => { const a = f.a + k / this.gondolas.length * Math.PI * 2; gd.position.set(0, f.HUB + Math.cos(a) * f.R, Math.sin(a) * f.R); });
        const sw = this.swing; sw.ph += dt; const target = (sw.ph % 40) < 30 ? 1.6 : 0; sw.spin += (target - sw.spin) * Math.min(1, dt * 0.25); sw.top.rotation.y += sw.spin * dt;
        for (const h of sw.hangs) h.rotation.z = -Math.min(0.9, sw.spin * sw.spin * 0.32);
        this.carousel.spin.rotation.y += dt * 0.45; for (const [hb, o] of this.horses) hb.position.y = Math.sin(this.t * 2.2 + o) * 0.3;
        const dr = this.drop; dr.t = (dr.t + dt) % 16; const u = dr.t; dr.ring.position.y = u < 9 ? 2 + u / 9 * 40 : u < 11 ? 42 : u < 12 ? 42 - 40 * Math.pow(u - 11, 2) : 2;
        // twinkle
        if ((this._tw = (this._tw || 0) - dt) <= 0) { this._tw = 0.25; const b = this.ferrisBulbs, a = b.instanceColor.array, base = this.bulbBase, k0 = Math.floor(this.t * 4); for (let i = 0; i < a.length / 3; i++) { const on = ((i + k0) % 6) < 4 || !night ? 1 : 0.25; a[i * 3] = base[i * 3] * on; a[i * 3 + 1] = base[i * 3 + 1] * on; a[i * 3 + 2] = base[i * 3 + 2] * on; } b.instanceColor.needsUpdate = true; }
      }
      this.fireworks.update(dt, isFireworks(clock) || this.show > 0);
      if (this.show > 0) this.show -= dt;
    }
    if (plaza) {
      const d = Math.hypot(px - this.plazaStage.x, py - this.plazaStage.y), near = d < 400;
      if (near) { this.plazaCrowd.update(dt, px, py); for (const c of this.cooks) c.animate(dt, { talk: true }); }
      this.plazaStage.update(dt, near, night, false);      // the street party has no live band: the song plays only at Stampede Park (unless you take the mic)
      if (this.plazaStage.kit.performing) level = 1;
    }
    return (this.level = Math.max(0, Math.min(1, level)));
  }
  // fireworks now, for a few seconds (the mission's finale)
  showFireworks(sec = 12) { this.show = sec; if (this.fireworks) { this.fireworks.next = 0; } }
}
