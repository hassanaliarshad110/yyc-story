// Picture quality: three levels (Low / Medium / High) picked from the device, a resolution that drops a little when the
// frame rate does (and comes back), an FPS counter, the film-style colour grade, and the sky reflected in car paint.
import * as THREE from 'three';

// ---------------------------------------------------------------- quality levels
export const QUALITY = {
  low: { name: 'Low', pr: 0.85, minScale: 0.6, shadows: false, grade: false, glow: false, radius: 1, crowd: 0.5 },
  medium: { name: 'Medium', pr: 1.2, minScale: 0.7, shadows: false, grade: true, glow: true, radius: 2, crowd: 0.75 },
  high: { name: 'High', pr: 1.75, minScale: 0.75, shadows: true, grade: true, glow: true, radius: 3, crowd: 1 },
};
// a first guess from the device: phones with little memory or few cores start on Low
export function guessQuality(mobile) {
  if (!mobile) return 'high';
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  return mem <= 3 || cores <= 4 ? 'low' : 'medium';
}

// ---------------------------------------------------------------- resolution that follows the frame rate
export class DynRes {
  constructor(renderer, getComposer) { this.r = renderer; this.getComposer = getComposer; this.scale = 1; this.acc = 0; this.n = 0; this.t = 0; this.base = 1; this.min = 0.7; this.fps = 60; this.on = true; }
  setBase(pr, min) { this.base = pr; this.min = min; this.apply(); }
  apply() {
    const pr = Math.max(0.5, this.base * this.scale); this.r.setPixelRatio(pr);
    const c = this.getComposer(); if (c) { c.setPixelRatio(pr); c.setSize(innerWidth, innerHeight); }
  }
  // dt in seconds of each frame; every 2 s: below ~40 fps, drop 12%; above ~55 fps, climb back 6%
  tick(dt) {
    this.acc += dt; this.n++; this.t += dt;
    if (this.t < 2) return;
    const avg = this.acc / this.n; this.fps = 1 / avg; this.acc = 0; this.n = 0; this.t = 0;
    if (!this.on || document.hidden) return;
    const s0 = this.scale;
    if (this.fps < 40) this.scale = Math.max(this.min, this.scale - 0.12);
    else if (this.fps > 55) this.scale = Math.min(1, this.scale + 0.06);
    if (Math.abs(this.scale - s0) > 0.001) this.apply();
  }
}

// ---------------------------------------------------------------- FPS counter
export class FpsMeter {
  constructor() { this.el = document.createElement('div'); this.el.id = 'fps'; this.el.hidden = true; document.body.appendChild(this.el); this.f = 0; this.t = 0; this.worst = 0; }
  show(on) { this.el.hidden = !on; }
  tick(dt, info) {
    if (this.el.hidden) return;
    this.f++; this.t += dt; this.worst = Math.max(this.worst, dt);
    if (this.t >= 0.5) { this.el.textContent = `${Math.round(this.f / this.t)} fps · worst ${Math.round(this.worst * 1000)} ms${info ? ' · ' + info() : ''}`; this.f = 0; this.t = 0; this.worst = 0; }
  }
}

// ---------------------------------------------------------------- the colour grade (after the picture is in screen colours)
// a gentle S-curve, a little more colour, warm highlights and cool shadows, and a soft vignette: the "GTA" look
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uContrast: { value: 0.4 }, uSat: { value: 1.22 }, uTone: { value: 1 }, uVig: { value: 0.32 }, uLift: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uContrast, uSat, uTone, uVig, uLift; varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = clamp(t.rgb, 0.0, 1.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c += uTone * (vec3(0.06, 0.02, -0.04) * smoothstep(0.4, 1.0, l) + vec3(-0.025, 0.006, 0.045) * (1.0 - smoothstep(0.0, 0.42, l)));
      c += uLift;
      vec2 d = vUv - 0.5; c *= 1.0 - uVig * dot(d, d) * 1.7;
      gl_FragColor = vec4(c, t.a);
    }`,
};

// ---------------------------------------------------------------- sky and street reflected in car paint
// a small painted panorama (sky, horizon, a row of buildings, the road), repainted for day, dusk and night
const ENV = { tex: null, state: '' };
function paintEnv(cv, state) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sky = state === 'night' ? ['#0b1430', '#1a2448', '#3a3550'] : state === 'dusk' ? ['#2a3c6e', '#c77a5a', '#f2b07a'] : ['#4f86c6', '#9cc4e8', '#e6f0f8'];
  let gr = g.createLinearGradient(0, 0, 0, H * 0.5); gr.addColorStop(0, sky[0]); gr.addColorStop(0.7, sky[1]); gr.addColorStop(1, sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.5);
  // buildings along the horizon (lit windows at night)
  let x = 0; const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  while (x < W) {
    const w = 6 + R() * 18, h = 4 + R() * 26; g.fillStyle = state === 'night' ? '#141822' : state === 'dusk' ? '#4a4048' : '#8a929c'; g.fillRect(x, H * 0.5 - h, w, h);
    if (state !== 'day') { g.fillStyle = state === 'night' ? '#ffd890' : '#ffcf9a'; for (let k = 0; k < h / 4; k++) if (R() < 0.45) g.fillRect(x + 1 + R() * (w - 3), H * 0.5 - h + 2 + R() * (h - 4), 1.5, 1.5); }
    x += w + R() * 6;
  }
  if (state === 'day') { g.fillStyle = 'rgba(255,250,235,0.95)'; g.beginPath(); g.arc(W * 0.3, H * 0.16, 7, 0, 7); g.fill(); }
  gr = g.createLinearGradient(0, H * 0.5, 0, H); gr.addColorStop(0, state === 'night' ? '#20232a' : '#6c6f72'); gr.addColorStop(1, state === 'night' ? '#0c0d10' : '#3a3c40');
  g.fillStyle = gr; g.fillRect(0, H * 0.5, W, H * 0.5);
  if (state === 'night') { g.fillStyle = 'rgba(255,190,110,0.5)'; for (let k = 0; k < 14; k++) g.fillRect(R() * W, H * 0.5 + 2 + R() * 10, 3, 1.5); }      // street lights on the road
}
export function envTexture() {
  if (ENV.tex) return ENV.tex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; paintEnv(cv, 'day'); ENV.state = 'day'; ENV.cv = cv;
  const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; ENV.tex = t; return t;
}
// 0 day .. 1 night
export function setEnvNight(n) {
  if (!ENV.tex) return; const s = n > 0.7 ? 'night' : n > 0.3 ? 'dusk' : 'day';
  if (s !== ENV.state) { ENV.state = s; paintEnv(ENV.cv, s); ENV.tex.needsUpdate = true; }
}
// car paint (Lambert materials with the paint baked into the texture): mix in a little of the reflection
const SHINY = new Set();
export function shiny(m, k = 0.16) {
  if (!m || SHINY.has(m)) return m;
  m.envMap = envTexture(); m.combine = THREE.MixOperation; m.reflectivity = k; m.needsUpdate = true; SHINY.add(m); return m;
}
