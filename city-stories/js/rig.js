// Skinned characters: the hero from Grand Chori Karachi (slimmed for phones) and smooth procedural people,
// all on the same 19-bone skeleton with walk, run, idle and sit poses.
import * as THREE from 'three';
import { KC } from './kc.js?v=11112205';

const b64u8 = s => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// joints of a 1.78 m person (from the Karachi player), facing +z, feet on y = 0. L = +x.
export const J_ADULT = { hips: [0, 0.93, -0.01], spine: [0, 1.06, 0], chest: [0, 1.22, 0], neck: [0, 1.47, -0.04], head: [0, 1.54, -0.03], shL: [0.08, 1.41, -0.03], armL: [0.19, 1.4, -0.045], foreL: [0.236, 1.12, -0.06], handL: [0.292, 0.86, -0.08], thighL: [0.1, 0.92, -0.01], shinL: [0.125, 0.5, -0.04], footL: [0.16, 0.1, -0.04], shR: [-0.08, 1.41, -0.03], armR: [-0.19, 1.4, -0.045], foreR: [-0.236, 1.12, -0.06], handR: [-0.292, 0.86, -0.08], thighR: [-0.1, 0.92, -0.01], shinR: [-0.125, 0.5, -0.04], footR: [-0.16, 0.1, -0.04] };
const RP0 = { armL: [0, 0, 0.163], foreL: [0.077, 0, 0], thighL: [0, 0, 0.059], armR: [0, 0, -0.163], foreR: [0.077, 0, 0], thighR: [0, 0, -0.059] };
const CLR0 = { hips: 0.2, spine: 0.25, chest: 0.25, neck: 0.25, head: 0.2, armL: 0.12, foreL: 0.1, handL: 0.07, armR: 0.12, foreR: 0.1, handR: 0.07, thighL: 0.12, thighR: 0.12, shinL: 0.1, shinR: 0.1, footL: 0.09, footR: 0.09 };

// ---- poses (angles for straight limbs; rest bends are removed by KC.eff)
export function pStance() {
  const P = KC.stance(); P.spine = [.04, 0, 0]; P.chest = [.02, 0, 0]; P.neck = [0, 0, 0]; P.head = [0, 0, 0]; P.armL = [.02, 0, .1]; P.armR = [.02, 0, -.1]; P.foreL = [-.18, 0, 0]; P.foreR = [-.18, 0, 0];
  P.thighL = [-.03, 0, .03]; P.thighR = [-.03, 0, -.03]; P.shinL = [.06, 0, 0]; P.shinR = [.06, 0, 0]; P.footL = [-.03, 0, -.03]; P.footR = [-.03, 0, .03]; P.shL = [0, 0, 0]; P.shR = [0, 0, 0]; return P;
}
export function pGait(ph, amp, run) {
  const P = KC.gait(ph, amp, run), s = Math.sin(ph);
  P.spine[0] -= .12 - .06 * run; P.chest[0] -= .1 - .05 * run; P.neck[0] += .1; P.head[0] += .12;
  P.armL[2] -= .16; P.armR[2] += .16; P.foreL[0] += .18 - .5 * run; P.foreR[0] += .18 - .5 * run; P.armL[0] += .1 * amp * s; P.armR[0] -= .1 * amp * s;
  P.thighL[0] += .1; P.thighR[0] += .1; P.thighL[2] = .03; P.thighR[2] = -.03; P.shL = [0, 0, 0]; P.shR = [0, 0, 0]; return P;
}
export function pSit() {
  const P = pStance(); P.thighL = [-1.5, 0, .22]; P.thighR = [-1.5, 0, -.22]; P.shinL = [1.55, 0, 0]; P.shinR = [1.55, 0, 0]; P.footL = [-.05, 0, 0]; P.footR = [-.05, 0, 0];
  P.spine = [.22, 0, 0]; P.chest = [.06, 0, 0]; P.head = [-.1, 0, 0]; P.armL = [-1.1, 0, .12]; P.armR = [-1.1, 0, -.12]; P.foreL = [-.55, 0, 0]; P.foreR = [-.55, 0, 0]; return P;
}
// astride a motorbike: knees out round the tank, feet back on the pegs, leaning forward to the handlebars
export function pRide() {
  const P = pStance(); P.thighL = [-1.15, 0, .3]; P.thighR = [-1.15, 0, -.3]; P.shinL = [1.45, 0, 0]; P.shinR = [1.45, 0, 0]; P.footL = [-.2, 0, 0]; P.footR = [-.2, 0, 0];
  P.spine = [.38, 0, 0]; P.chest = [.1, 0, 0]; P.head = [-.32, 0, 0]; P.armL = [-1.05, 0, .32]; P.armR = [-1.05, 0, -.32]; P.foreL = [-.5, 0, 0]; P.foreR = [-.5, 0, 0]; return P;
}
function pTalk(t) {
  const P = pStance(), a = Math.sin(t * 2.3), b = Math.sin(t * 1.7 + 1);
  P.armR = [-.35 - .25 * Math.max(0, a), 0, -.18]; P.foreR = [-1.2 - .3 * a, 0, 0]; P.armL = [-.15 - .15 * Math.max(0, b), 0, .14]; P.foreL = [-.7 - .4 * Math.max(0, b), 0, 0];
  P.head = [.05 * Math.sin(t * 3.1), .12 * Math.sin(t * .9), 0]; return P;
}
// dancing to the beat (about 114 beats a minute); style 0 arms up and sway, 1 bhangra, 2 fist pump, 3 bounce and clap
export function pDance(t, style = 0, beat = 1.9) {
  const P = pStance(), w = t * Math.PI * 2 * beat, s = Math.sin(w), c = Math.cos(w), b = Math.abs(Math.sin(w)), h = Math.sin(w / 2);
  const knees = 0.18 + 0.22 * b;
  P.thighL = [-knees, 0, 0.08]; P.thighR = [-knees, 0, -0.08]; P.shinL = [knees * 1.9, 0, 0]; P.shinR = [knees * 1.9, 0, 0];
  P.spine = [0.06 + 0.05 * b, 0.12 * h, 0.06 * s]; P.chest = [0.02, 0.1 * h, 0.04 * s]; P.head = [0.08 * b - 0.05, 0.2 * h, 0.08 * s];
  if (style === 0) { P.armL = [-0.15, 0, 2.5 + 0.35 * h]; P.armR = [-0.15, 0, -2.5 + 0.35 * h]; P.foreL = [-0.3, 0, 0.2 * s]; P.foreR = [-0.3, 0, -0.2 * s]; }
  else if (style === 1) { P.armL = [-0.25, 0, 2.1 + 0.25 * s]; P.armR = [-0.25, 0, -2.1 + 0.25 * s]; P.foreL = [-0.9 - 0.3 * b, 0, 0]; P.foreR = [-0.9 - 0.3 * b, 0, 0]; P.shL = [0, 0, 0.15 * b]; P.shR = [0, 0, -0.15 * b]; P.thighL[0] -= 0.25 * Math.max(0, h); P.thighR[0] -= 0.25 * Math.max(0, -h); }
  else if (style === 2) { P.armR = [-0.3, 0, -2.6 + 0.5 * b]; P.foreR = [-0.5 * b, 0, 0]; P.armL = [-0.2, 0, 0.25]; P.foreL = [-1.3, 0, 0]; }
  else { P.armL = [-1.1 - 0.2 * b, 0.45 + 0.25 * s, 0.2]; P.armR = [-1.1 - 0.2 * b, -0.45 - 0.25 * s, -0.2]; P.foreL = [-0.9, 0, 0]; P.foreR = [-0.9, 0, 0]; }
  return P;
}
function pWave(t) { const P = pStance(); P.armR = [-.4, 0, -2.3]; P.foreR = [-.25 + .35 * Math.sin(t * 9), 0, 0]; P.head = [.05, 0, 0]; return P; }

// ---- the hero model (data/hero/hero.json: geometry quantised, skin weights, texture)
let HERO = null, heroGeo = null, heroMat = null;
export async function loadHero() {
  try { const r = await fetch('data/hero/hero.json'); if (!r.ok) throw new Error(r.status); HERO = await r.json(); } catch (e) { console.warn('hero model missing', e); HERO = null; return false; }
  const D = HERO, n = D.n, q = new Int16Array(b64u8(D.p).buffer), p = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) p[i] = D.mn[i % 3] + (q[i] + 32768) / 65535 * D.sc[i % 3];
  const n8 = new Int8Array(b64u8(D.nm).buffer), nm = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) nm[i] = n8[i] / 127;
  const u16 = new Uint16Array(b64u8(D.uv).buffer), uv = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) uv[i] = u16[i] / 65535;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const ib = b64u8(D.i).buffer; g.setIndex(new THREE.BufferAttribute(D.i32 ? new Uint32Array(ib) : new Uint16Array(ib), 1));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(b64u8(D.si)), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(b64u8(D.sw), 4, true));
  g.computeBoundingSphere(); heroGeo = g;
  const tex = await new Promise(res => new THREE.TextureLoader().load(D.tex, res, undefined, () => res(null)));
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4; }
  heroMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
  D.p = D.nm = D.uv = D.i = D.si = D.sw = D.tex = null;
  return true;
}
export const heroReady = () => !!heroGeo;

// ---- procedural people: capsules and ellipsoids skinned to the same bones, coloured per vertex
const BI = KC.BI;
function hexRGB(c) { const k = new THREE.Color(c); return [k.r, k.g, k.b]; }
const HUMAN_CACHE = new Map();
function cachedHuman(J, st) { const k = JSON.stringify(st); let g = HUMAN_CACHE.get(k); if (!g) { g = humanGeo(J, st); HUMAN_CACHE.set(k, g); } return g; }
function humanGeo(J, st) {
  const P = [], C = [], I = [], SI = [], SW = [], NR = [];
  const SKIN = hexRGB(st.skin ?? 0xb07a52), TOP = hexRGB(st.shirt ?? 0x2a7de1), BOT = hexRGB(st.pants ?? 0x2b2f3a), HAIR = hexRGB(st.hair ?? 0x1b1410), SHOE = hexRGB(st.shoe ?? 0x2a2a2a), EYE = [0.08, 0.06, 0.05];
  const addV = (p, c, wts, n) => { const nl = Math.hypot(n[0], n[1], n[2]) || 1; NR.push(n[0] / nl, n[1] / nl, n[2] / nl); P.push(p[0], p[1], p[2]); C.push(c[0], c[1], c[2]); wts.sort((a, b) => b[1] - a[1]); const w = wts.slice(0, 4); let s = 0; for (const q of w) s += q[1]; for (let k = 0; k < 4; k++) { SI.push(w[k] ? w[k][0] : 0); SW.push(w[k] ? w[k][1] / s : 0); } };
  const grid = (nu, nv, fn) => { const base = P.length / 3; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const r = fn(i / nu, j / nv); addV(r[0], r[1], r[2], r[3]); } for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; I.push(a, b, c, b, d, c); } };
  const shade = (c, p) => { const n = 1 + Math.sin(p[0] * 40 + p[1] * 23) * Math.sin(p[2] * 31 + p[1] * 17) * 0.035; return [c[0] * n, c[1] * n, c[2] * n]; };
  function basis(d) { const l = Math.hypot(d[0], d[1], d[2]); const w = [d[0] / l, d[1] / l, d[2] / l]; let u = Math.abs(w[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; let v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]]; const vl = Math.hypot(...v); v = v.map(q => q / vl); u = [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]]; return { w, u, v, l }; }
  function capsule(a, b, r1, r2, col, own, par, chi, flat = 1) {
    const f = basis([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), L = f.l;
    grid(14, 12, (i, j) => {
      const s = j * (L + r1 + r2) - r1; let r; if (s < 0) r = r1 * Math.cos(Math.asin(Math.max(-1, s / r1))); else if (s > L) r = r2 * Math.cos(Math.asin(Math.min(1, (s - L) / r2))); else r = r1 + (r2 - r1) * s / L;
      const ang = i * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang) * flat;
      const p = [a[0] + f.w[0] * s + (f.u[0] * ca + f.v[0] * sa) * r, a[1] + f.w[1] * s + (f.u[1] * ca + f.v[1] * sa) * r, a[2] + f.w[2] * s + (f.u[2] * ca + f.v[2] * sa) * r];
      const ax = s < 0 ? s : s > L ? s - L : 0, rr = s < 0 ? r1 : s > L ? r2 : 1, nrm = [(f.u[0] * ca + f.v[0] * sa) * r + f.w[0] * ax, (f.u[1] * ca + f.v[1] * sa) * r + f.w[1] * ax, (f.u[2] * ca + f.v[2] * sa) * r + f.w[2] * ax];
      const t = Math.min(1, Math.max(0, s / L)), wt = [[BI[own], 1]];
      if (par) { const k = .5 * (1 - sst(0, .3, t)); if (k > 0) { wt[0][1] -= k; wt.push([BI[par], k]); } }
      if (chi) { const k = .5 * sst(.7, 1, t); if (k > 0) { wt[0][1] -= k; wt.push([BI[chi], k]); } }
      return [p, typeof col === 'function' ? col(p, t) : shade(col, p), wt, nrm];
    });
  }
  function ell(c, rx, ry, rz, col, wfn, nu = 14, nv = 10) {
    grid(nu, nv, (i, j) => { const th = i * Math.PI * 2, ph = j * Math.PI - Math.PI / 2; const ex = Math.cos(ph) * Math.sin(th), ey = Math.sin(ph), ez = Math.cos(ph) * Math.cos(th), p = [c[0] + ex * rx, c[1] + ey * ry, c[2] + ez * rz]; return [p, typeof col === 'function' ? col(p) : shade(col, p), wfn(p), [ex / rx, ey / ry, ez / rz]]; });
  }
  const j = J;
  const torsoW = p => { const y = p[1], w = [], add = (b, k) => { if (k > 1e-3) w.push([BI[b], k]); }; const hS = j.spine[1], hC = j.chest[1], hN = j.neck[1];
    add('hips', 1 - sst(hS - .08, hS + .04, y)); add('spine', sst(hS - .08, hS + .04, y) * (1 - sst(hC - .06, hC + .06, y))); add('chest', sst(hC - .06, hC + .06, y) * (1 - sst(hN - .04, hN + .03, y))); add('neck', sst(hN - .04, hN + .03, y));
    if (y < j.hips[1] - .03 && Math.abs(p[0]) > .04) { const tt = sst(j.hips[1] - .03, j.hips[1] - .14, y) * .6, th = p[0] > 0 ? 'thighL' : 'thighR'; for (const q of w) q[1] *= 1 - tt; w.push([BI[th], tt]); }
    return w.length ? w : [[BI.hips, 1]]; };
  const fem = !!st.fem, slim = fem ? 0.9 : 1;
  const waist = j.hips[1] + 0.06;
  const torsoCol = p => p[1] < waist ? shade(BOT, p) : shade(TOP, p);
  // torso: one lofted tube (crotch -> neck) with an elliptical cross-section per height
  const hy = j.hips[1], cy = j.chest[1], ny = j.neck[1];
  const prof = fem
    ? [[hy - .13, .02, .02, 0], [hy - .1, .12, .1, 0], [hy - .04, .175, .12, -.005], [hy + .03, .165, .11, 0], [hy + .12, .13, .095, .005], [cy - .02, .145, .1, .01], [cy + .09, .165, .118, .015], [cy + .17, .17, .1, -.005], [ny - .03, .1, .07, -.02], [ny + .02, .05, .045, -.03]]
    : [[hy - .13, .02, .02, 0], [hy - .1, .12, .1, 0], [hy - .04, .165, .115, -.005], [hy + .03, .16, .11, 0], [hy + .12, .148, .1, .005], [cy - .02, .16, .105, .01], [cy + .09, .185, .118, .01], [cy + .17, .19, .108, -.005], [ny - .03, .11, .075, -.02], [ny + .02, .05, .045, -.03]];
  const profAt = y => { let k = 0; while (k < prof.length - 2 && y > prof[k + 1][0]) k++; const a = prof[k], b = prof[k + 1], t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0]))), u = t * t * (3 - 2 * t); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u]; };
  const y0 = prof[0][0], y1 = prof[prof.length - 1][0];
  grid(20, 24, (i, jv) => { const y = y0 + (y1 - y0) * jv, [rx, rz, zc] = profAt(y), th = i * Math.PI * 2, p = [Math.sin(th) * rx, y, zc + Math.cos(th) * rz];
    const cap = jv === 0 || jv === 1; if (cap) { p[0] = 0; p[2] = zc; }
    const nrm = jv === 0 ? [0, -1, 0] : jv === 1 ? [0, 1, 0] : [Math.sin(th) / rx, 0, Math.cos(th) / rz];
    return [p, torsoCol(p), torsoW(p), nrm]; });
  if (st.bag) ell([0, j.chest[1] + .05, -.15], .14, .17, .07, hexRGB(st.bag), () => [[BI.chest, 1]], 10, 8);
  // neck + head
  capsule(j.neck, j.head, .048, .046, SKIN, 'neck', 'chest', 'head');
  const H = j.head, hw = () => [[BI.head, 1]];
  ell([H[0], H[1] + .115, H[2] + .025], .088, .115, .1, SKIN, hw);
  ell([H[0] + .03, H[1] + .13, H[2] + .113], .012, .009, .008, EYE, hw, 6, 4); ell([H[0] - .03, H[1] + .13, H[2] + .113], .012, .009, .008, EYE, hw, 6, 4);
  if (st.hijab != null) {
    const HJ = hexRGB(st.hijab);
    ell([H[0], H[1] + .12, H[2] - .012], .1, .13, .11, HJ, hw);
    capsule([0, j.neck[1] + .03, j.neck[2] - .02], [0, j.chest[1] + .14, j.chest[2] - .01], .085, .15, HJ, 'neck', 'chest', null, 0.8);
  } else if (st.long) {
    ell([H[0], H[1] + .15, H[2] + .005], .097, .1, .106, HAIR, hw);
    ell([H[0], H[1] + .05, H[2] - .06], .09, .14, .06, HAIR, p => [[BI.head, 1]]);
  } else {
    ell([H[0], H[1] + .155, H[2] + .005], .1, .088, .108, HAIR, hw);
  }
  // arms
  const sleeve = st.sleeve ?? 0.55;     // how far down the arm the sleeve goes (0..1 of the whole arm)
  for (const s of ['L', 'R']) {
    capsule(j['sh' + s], j['arm' + s], .05, .058, TOP, 'sh' + s, 'chest', 'arm' + s);
    capsule(j['arm' + s], j['fore' + s], .052, .044, TOP, 'arm' + s, 'sh' + s, 'fore' + s);
    capsule(j['fore' + s], j['hand' + s], .042, .034, (p, t) => shade(t < (sleeve - .5) * 2 ? TOP : SKIN, p), 'fore' + s, 'arm' + s, 'hand' + s);
    const h = j['hand' + s]; ell([h[0], h[1] - .07, h[2] + .005], .028, .07, .045, SKIN, () => [[BI['hand' + s], 1]], 8, 6);
    // legs
    capsule(j['thigh' + s], j['shin' + s], .078 * (fem ? 1.03 : 1), .055, BOT, 'thigh' + s, 'hips', 'shin' + s);
    capsule(j['shin' + s], j['foot' + s], .052, .04, BOT, 'shin' + s, 'thigh' + s, 'foot' + s);
    const f = j['foot' + s]; ell([f[0], f[1] - .055, f[2] + .055], .048, .045, .115, SHOE, () => [[BI['foot' + s], 1]], 10, 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(NR, 3)); g.setIndex(I); return g;
}
const humanMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// ---- cowboy hats (shared shapes, one material per colour); brim curls up at the sides
const HAT = (() => {
  const brim = new THREE.CylinderGeometry(0.2, 0.2, 0.018, 18, 1), p = brim.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r > 0.12) p.setY(i, p.getY(i) + Math.pow(Math.abs(x) / 0.2, 3) * 0.05); }
  brim.scale(1, 1, 1.12); brim.computeVertexNormals();
  const crown = new THREE.CylinderGeometry(0.085, 0.11, 0.13, 14, 1); crown.scale(1, 1, 1.18);
  const band = new THREE.CylinderGeometry(0.112, 0.112, 0.025, 14, 1, true); band.scale(1, 1, 1.18);
  return { brim, crown, band, bandMat: new THREE.MeshLambertMaterial({ color: 0x2a1a10, side: THREE.DoubleSide }) };
})();
const HAT_MATS = new Map();
const hatMat = c => { if (!HAT_MATS.has(c)) HAT_MATS.set(c, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); return HAT_MATS.get(c); };
export const HAT_COLORS = [0xf2efe6, 0x5a3a22, 0x2a2a2a, 0x8a5a32, 0xc8a070, 0xf2efe6, 0x7a1c1c, 0xd8c8a8];
const HAT_Y = { adult: 0.2, hero: 0.165 };
// a hat on its own (brim, crown, band), for any head
export function hatGroup(c) {
  const g = new THREE.Group(), m = hatMat(c);
  const brim = new THREE.Mesh(HAT.brim, m), crown = new THREE.Mesh(HAT.crown, m), band = new THREE.Mesh(HAT.band, HAT.bandMat);
  crown.position.y = 0.075; band.position.y = 0.03; g.add(brim, crown, band);
  for (const o of g.children) o.castShadow = true;
  return g;
}
// realistic models (humans.js) take over a look that names one, once it has loaded
let GLB = null;
export const setGlbFactory = f => { GLB = f; };
export const setHatY = (k, y) => { HAT_Y[k] = y; };

// ---- a character: Group with a SkinnedMesh and a skeleton, driven by animate()
export class Character {
  constructor(style = {}) {
    if (GLB && style.glb) { const h = GLB(style); if (h) return h; }
    const hero = style.hero && heroGeo;
    const J = hero ? HERO.J : J_ADULT;
    this.R = { J, off: KC.offsets(J), RP: hero ? HERO.RP : RP0, CLR: hero ? HERO.CLR : CLR0 };
    const bones = {};
    for (const b of KC.B) { const bo = new THREE.Bone(); bo.name = b; const o = this.R.off[b]; bo.position.set(o[0], o[1], o[2]); bones[b] = bo; if (KC.PAR[b]) bones[KC.PAR[b]].add(bo); }
    const geo = hero ? heroGeo : cachedHuman(J, style);
    const mesh = new THREE.SkinnedMesh(geo, hero ? heroMat : humanMat);
    mesh.add(bones.hips); mesh.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(KC.B.map(b => bones[b]));
    if (hero) mesh.bind(skel, new THREE.Matrix4().fromArray(HERO.bind)); else mesh.bind(skel);
    mesh.castShadow = true; mesh.frustumCulled = false;
    this.g = new THREE.Group(); this.g.add(mesh); this.mesh = mesh; this.bones = bones;
    if (style.scale) this.g.scale.setScalar(style.scale);
    this.cur = pStance(); this.phase = 0; this.t = Math.random() * 10; this.dy = 0;
    this.g.userData.char = this;
    if (style.hat) this.setHat(style.hat);
  }
  // a cowboy hat on the head bone (colour, or null to take it off)
  setHat(c) {
    this.hatC = c ?? null;
    if (this.hat) { this.bones.head.remove(this.hat); this.hat = null; }
    if (c == null) return;
    const g = this.hat = hatGroup(c), hero = this.R.J !== J_ADULT;
    g.position.set(0, hero ? HAT_Y.hero : HAT_Y.adult, 0.01); g.rotation.x = -0.12;
    this.bones.head.add(g);
  }
  // st: { speed (m/s), run (bool), sit, talk, wave }
  animate(dt, st = {}) {
    this.t += dt; const t = this.t, sp = st.speed || 0, ph0 = this.phase;
    let tg;
    if (st.ride) tg = pRide();
    else if (st.sit) tg = pSit();
    else if (sp > 0.3) { const run = st.run ? 1 : 0; this.phase += dt * (run ? 11 * sp / 6.2 : 7 * sp / 2.9); tg = pGait(this.phase, run ? 1.15 : Math.min(.9, .45 + sp * .15), run); }
    else if (st.dance != null) tg = pDance((st.syncT ?? t) + (st.offset || 0), st.dance, st.beat || 1.9);   // syncT/beat: dance on a song's beat
    else if (st.wave) tg = pWave(t);
    else if (st.talk) tg = pTalk(t);
    else { tg = pStance(); const b = Math.sin(t * 1.7); tg.chest[0] += .015 * b; tg.head[1] = .15 * Math.sin(t * .37); tg.armL[0] += .02 * b; tg.armR[0] += .02 * b; }
    const fast = 1 - Math.exp(-dt * 16), slow = 1 - Math.exp(-dt * 10);
    for (const b of KC.B) { const c = this.cur[b], v = tg[b] || [0, 0, 0], a = (b === 'head' || b === 'neck' || b.startsWith('fore') || b.startsWith('hand')) ? slow : fast; c[0] += (v[0] - c[0]) * a; c[1] += (v[1] - c[1]) * a; c[2] += (v[2] - c[2]) * a; }
    const ef = KC.eff(this.cur, this.R.RP); for (const b of KC.B) { const e = ef[b]; this.bones[b].rotation.set(e[0], e[1], e[2]); }
    const gy = st.sit || st.ride ? 0 : st.dance != null ? Math.min(.02, KC.ground(this.R.J, this.R.off, ef, this.R.CLR)) : Math.min(.02, KC.ground(this.R.J, this.R.off, ef, this.R.CLR));
    this.dy += (gy - this.dy) * Math.min(1, dt * 20); this.bones.hips.position.y = this.R.off.hips[1] + this.dy;
    return Math.floor(ph0 / Math.PI) !== Math.floor(this.phase / Math.PI);   // true on each footstep
  }
}
