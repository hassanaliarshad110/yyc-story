// A concert at the Scotiabank Saddledome every night: a stage with lights and a big screen, a dancing crowd,
// and "Under One Sky" playing (louder the closer you get).
import { solidStage } from './stagekit.js?v=11111647';
import * as THREE from 'three';
import { drawLyricsOn } from './lyrics.js?v=11111647';
import { Character, HAT_COLORS } from './rig.js?v=11111647';
import { ground } from './terrain.js?v=11111647';
import { rotY } from './player.js?v=11111647';
import { Dancers } from './dancers.js?v=11111647';

export const isConcertTime = clock => clock >= 19 || clock < 3;
const SKIN = [0x8d5a3b, 0xb07a52, 0xc69373, 0xe1b899, 0x5c3a24, 0xa4704e];
const TOPS = [0xc8102e, 0x1f6fd1, 0xf2b705, 0x2f8f4e, 0x111111, 0xf2f2ee, 0x7a2e8c, 0xe8742a, 0x2bb3c0];
const BOTS = [0x2a2e38, 0x3b3f4a, 0x1d3557, 0x4a3b2a, 0x222222];
const H = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;

export class Concert {
  // (x, y): front centre of the stage; face: the way the stage faces (towards the crowd), 0 = north, clockwise
  constructor(scene, x, y, face, opts = {}) {
    this.scene = scene; this.x = x; this.y = y; this.face = face; this.n = opts.crowd ?? 28; this.built = false; this.on = false; this.t = 0;
  }
  local(ax, ay) { const s = Math.sin(this.face), c = Math.cos(this.face); return [this.x + ax * c + ay * s, this.y - ax * s + ay * c]; }   // ax across the stage (right), ay towards the crowd
  build() {
    this.built = true;
    const g = this.g = new THREE.Group(), gy = this.gy = ground(this.x, this.y);
    g.position.set(this.x, gy, -this.y); g.rotation.y = rotY(this.face); this.scene.add(g);
    const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    // stage deck, back wall, roof truss and towers (local +z faces the crowd)
    const black = M(0x1a1b1f), truss = M(0x8d9298);
    box(26, 1.6, 12, black, 0, 0.8, -6);
    box(26, 0.1, 12, M(0x2a2c33), 0, 1.65, -6);
    for (const x of [-12.6, 12.6]) for (const z of [-0.6, -11.4]) box(0.5, 11, 0.5, truss, x, 5.5, z);
    box(26, 0.5, 0.5, truss, 0, 11, -0.6); box(26, 0.5, 0.5, truss, 0, 11, -11.4); for (const x of [-12.6, 0, 12.6]) box(0.5, 0.5, 11, truss, x, 11, -6);
    // the big screen
    const cv = this.cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; this.cx = cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false })); scr.position.set(0, 7, -11.2); g.add(scr);
    box(17, 9, 0.4, black, 0, 7, -11.5);
    // speaker stacks
    for (const x of [-15.5, 15.5]) { box(3, 6, 2.4, black, x, 3, -3); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), M(0x33363d)); c.position.set(x, 1 + k * 1.4, -1.78); g.add(c); } }
    // light beams (additive cones) and coloured washes
    this.beams = [];
    const beamMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    [0xff2a6d, 0x05d9e8, 0xffd319, 0x8b5cf6, 0x39ff14, 0xff7b00].forEach((c, i) => {
      const geo = new THREE.ConeGeometry(2.2, 40, 16, 1, true); geo.translate(0, -20, 0);
      const b = new THREE.Mesh(geo, beamMat(c)); b.position.set(-11 + i * 4.4, 10.8, -1); g.add(b); this.beams.push(b);
    });
    this.wash = [new THREE.PointLight(0xff2a6d, 0, 60, 1.5), new THREE.PointLight(0x05d9e8, 0, 60, 1.5)];
    this.wash[0].position.set(-8, 9, 6); this.wash[1].position.set(8, 9, 6); for (const w of this.wash) g.add(w);
    // the singer and two dancers on stage, and the crowd in front: 3D people dancing to the song
    const band = [[0, -3], [-6, -5], [6, -5]].map(([ax, ay]) => { const [x, y] = this.local(ax, ay); return { x, y, h: this.face, z: 1.7 }; });
    this.band = new Dancers(this.scene, band, { seed: 5 });
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), truss); mic.position.set(0, 2.45, -2.5); g.add(mic);
    // solid: deck (front steps), speakers, the screen; take the mic and the show is yours
    this.kit = solidStage({ x: this.x, y: this.y, face: this.face, W: 26, D: 12, deckH: 1.7, g, band: this.band, name: 'SADDLEDOME', micAy: -2.5, parts: [[-15.5, -3, 3, 2.4, 6], [15.5, -3, 3, 2.4, 6], [0, -11.5, 17, 0.6, 11.5]] });
    const crowd = [];
    for (let i = 0; i < this.n; i++) {
      const row = Math.floor(i / 7), col = i % 7, ax = (col - 3) * 2.6 + (H(i, 8) - 0.5) * 1.4 + (row % 2) * 1.3, ay = 4 + row * 2.4 + (H(i, 9) - 0.5) * 1.0;
      const [wx, wy] = this.local(ax, ay); crowd.push({ x: wx, y: wy, h: this.face + Math.PI + (H(i, 10) - 0.5) * 0.5 });
    }
    this.crowd = new Dancers(this.scene, crowd, { seed: 9 });
  }
  setVisible(on) { if (!this.built) return; this.on = on; for (const b of this.beams) b.visible = on; for (const w of this.wash) w.intensity = on ? 40 : 0; this.crowd.visible = on; this.band.visible = on; }
  drawScreen(t) {
    const g = this.cx, W = 512, Hh = 256;
    const grd = g.createLinearGradient(0, 0, W, Hh); grd.addColorStop(0, `hsl(${(t * 40) % 360},80%,25%)`); grd.addColorStop(1, `hsl(${(t * 40 + 120) % 360},80%,15%)`);
    g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 32; i++) { const v = 0.25 + 0.75 * Math.abs(Math.sin(t * 6 + i * 0.7) * Math.sin(t * 2.3 + i * 0.31)); g.fillStyle = `hsla(${(i * 11 + t * 60) % 360},90%,60%,0.75)`; g.fillRect(8 + i * 15.6, Hh - v * 120, 11, v * 120); }
    g.fillStyle = '#fff'; g.font = '800 54px "Segoe UI", Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('UNDER ONE SKY', W / 2, 70);
    g.font = '600 26px "Segoe UI", Roboto, sans-serif'; g.fillText(this.kit && this.kit.performing ? '🎤 LIVE ON STAGE: ' + (this.kit.who || 'YOU') : 'LIVE TONIGHT · SADDLEDOME', W / 2, 118);
    drawLyricsOn(g, W);            // the song's words on the big screen while it plays
    this.tex.needsUpdate = true;
  }
  // returns how loud the concert should be where the player is (0..1)
  update(dt, px, py, clock) {
    const d = Math.hypot(px - this.x, py - this.y), night = isConcertTime(clock) || !!(this.kit && this.kit.performing);
    if (!this.built) { if (d < 900) this.build(); else return 0; }
    if (night !== this.on) this.setVisible(night);
    if (!night) return 0;
    this.t += dt;
    if (d < 700) {
      this.band.update(dt, true, true); this.crowd.update(dt, d < 350, true);
      this.beams.forEach((b, i) => { b.rotation.z = Math.sin(this.t * 0.9 + i) * 0.55; b.rotation.x = 0.35 + Math.sin(this.t * 0.7 + i * 1.7) * 0.35; });
      this.wash[0].color.setHSL((this.t * 0.1) % 1, 1, 0.5); this.wash[1].color.setHSL((this.t * 0.1 + 0.5) % 1, 1, 0.5);
      if ((this.st = (this.st || 0) - dt) <= 0) { this.st = 0.12; this.drawScreen(this.t); }
    }
    if (this.kit.performing) return 1;
    const v = Math.max(0, Math.min(1, 1 - (d - 30) / 170)); return v * v;      // full in front of the stage, silent 200 m away
  }
}
