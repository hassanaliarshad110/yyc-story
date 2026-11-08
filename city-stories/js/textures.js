// Procedural textures drawn on canvases: building facades, roads, ground. No image files needed.
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let ANISO = 8;
export function setMaxAnisotropy(n) { ANISO = Math.max(1, Math.min(16, n || 1)); }
function tex(c, rep = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = ANISO;          // keeps roads sharp far ahead
  return t;
}

// Facade: one texture tile = 4 m wide x 3.5 m tall (one window, one storey). Grey-scale so vertex colour tints it.
export function facadeTexture(kind) {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 64, 64);
  if (kind === 'tower') {               // glass curtain wall
    g.fillStyle = '#8ea4b8'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#6f879d'; g.fillRect(2, 4, 60, 52);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(4, 6, 24, 48);
    g.fillStyle = '#c9d3dc'; g.fillRect(0, 58, 64, 6); g.fillRect(31, 0, 2, 64);
  } else if (kind === 'house') {
    g.fillStyle = '#d9d4cc'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 6) { g.fillStyle = y % 12 ? '#cfc9bf' : '#ddd8cf'; g.fillRect(0, y, 64, 1); }   // siding
    g.fillStyle = '#4d5964'; g.fillRect(18, 18, 28, 26);
    g.fillStyle = '#f3f3f3'; g.fillRect(16, 16, 32, 2); g.fillRect(16, 44, 32, 3); g.fillRect(31, 18, 2, 26);
  } else if (kind === 'house_brick') {          // brick lower half, siding upper half
    g.fillStyle = '#d9d4cc'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 30; y += 5) { g.fillStyle = y % 10 ? '#cfc9bf' : '#ddd8cf'; g.fillRect(0, y, 64, 1); }
    g.fillStyle = '#9a6a52'; g.fillRect(0, 30, 64, 34);
    g.fillStyle = '#b98a72'; for (let y = 30; y < 64; y += 4) for (let x = (y / 4 % 2) * 4; x < 64; x += 8) g.fillRect(x, y, 7, 3);
    g.fillStyle = '#4d5964'; g.fillRect(20, 12, 24, 22); g.fillStyle = '#f3f3f3'; g.fillRect(18, 10, 28, 2); g.fillRect(31, 12, 2, 22);
  } else if (kind === 'house_stucco') {
    g.fillStyle = '#e3dccd'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.5 ? '#d8d0bf' : '#ece6d8'; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
    g.fillStyle = '#3f4a55'; g.fillRect(16, 16, 32, 28); g.fillStyle = '#6b5240'; g.fillRect(14, 44, 36, 4); g.fillRect(14, 14, 36, 3);
    g.fillStyle = '#f5f2ea'; g.fillRect(31, 16, 2, 28); g.fillRect(16, 29, 32, 2);
  } else if (kind === 'house_stone') {           // stone base, board-and-batten above
    g.fillStyle = '#c9cbc4'; g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 8) { g.fillStyle = '#b9bbb4'; g.fillRect(x, 0, 2, 40); }
    g.fillStyle = '#8f8a80'; g.fillRect(0, 40, 64, 24);
    for (let i = 0; i < 40; i++) { const v = 110 + Math.random() * 60 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(Math.random() * 60, 40 + Math.random() * 20, 6 + Math.random() * 8, 4 + Math.random() * 3); }
    g.fillStyle = '#2f3940'; g.fillRect(18, 10, 28, 24); g.fillStyle = '#eee'; g.fillRect(31, 10, 2, 24);
  } else if (kind === 'shop') {                  // storefront: glass and doors below, sign band above (one storey per texture)
    g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3c4a55'; g.fillRect(2, 22, 60, 40);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(4, 24, 18, 36); g.fillRect(36, 24, 8, 36);
    g.fillStyle = '#9aa3a8'; g.fillRect(31, 22, 2, 40); g.fillRect(2, 40, 60, 1);
    g.fillStyle = '#b8b3aa'; g.fillRect(0, 16, 64, 6); g.fillStyle = '#8e8a84'; g.fillRect(0, 62, 64, 2);
  } else if (kind === 'apt') {                   // apartment block: balconies
    g.fillStyle = '#d7d1c6'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#56646f'; g.fillRect(8, 10, 22, 34); g.fillRect(36, 14, 20, 24);
    g.fillStyle = '#8e8a84'; g.fillRect(4, 42, 30, 4); g.fillStyle = '#2e3134'; for (let x = 5; x < 34; x += 3) g.fillRect(x, 34, 1, 8);
  } else if (kind === 'brick') {
    g.fillStyle = '#b8a493'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#56636e'; g.fillRect(14, 14, 36, 30);
    g.fillStyle = '#dcd3c8'; g.fillRect(12, 44, 40, 4);
  } else {                              // generic commercial: windows in rows
    g.fillStyle = '#d8d8d4'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#5d6d7a'; g.fillRect(8, 14, 48, 30);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(10, 16, 14, 26);
  }
  return tex(c);
}

// night: which windows are lit. 8 x 8 facade tiles per texture (repeat 1/8) so the pattern doesn't repeat every window.
// rects are the window openings of that facade in its 64 px tile; tone: warm homes, cool-white offices.
export function nightWindowsTexture(rects = [[10, 16, 44, 28]], p = 0.45, tone = 'warm', floors = false) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++) {
    const floorOn = floors ? Math.random() < 0.75 : true, fp = floors ? (floorOn ? p * 1.3 : p * 0.25) : p;
    for (let x = 0; x < 8; x++) {
      if (Math.random() > fp) continue;
      const k = 0.55 + Math.random() * 0.45;
      const col = tone === 'cool' ? [215 + Math.random() * 40, 228 + Math.random() * 27, 255] : tone === 'shop' ? [255, 236, 200] : [255, 190 + Math.random() * 45, 110 + Math.random() * 60];
      g.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
      for (const [rx, ry, rw, rh] of rects) g.fillRect(x * 64 + rx, y * 64 + ry, rw, rh);
    }
  }
  const tx = tex(c); tx.repeat.set(1 / 8, 1 / 8); return tx;
}

// Road: u across the road (0..1), v along the road (1 unit = 10 m). Asphalt with lane markings.
export function roadTexture(kind) {
  // one texture tile spans the road's width (u) and 10 m of length (v); drawn at 512 x 1024 so markings stay crisp
  const W = 512, H = 1024, [c, g] = canvas(W, H), px = W / 10;           // ~51 px per metre across a 10 m road
  // Calgary asphalt: the main roads stay dark, residential streets are sun-bleached light grey with darker wheel paths
  const local = kind === 'local';
  g.fillStyle = kind === 'highway' ? '#3a3d41' : local ? '#8f8c86' : '#4a4d51'; g.fillRect(0, 0, W, H);
  const b0 = kind === 'highway' ? 52 : local ? 128 : 66;
  for (let i = 0; i < 12000; i++) { const v = b0 + Math.random() * 26 | 0; g.fillStyle = `rgb(${v},${v - 1},${v - 4})`; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 2, 2 + Math.random() * 2); }
  if (local) {      // wheel paths and a few crack-seal lines
    g.fillStyle = 'rgba(60,58,55,0.06)'; for (const x of [0.27, 0.73]) g.fillRect(W * x - 50, 0, 100, H);
    g.strokeStyle = 'rgba(40,40,40,0.18)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); let x = Math.random() * W, y = Math.random() * H; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 80; y += Math.random() * 60; g.lineTo(x, y); } g.stroke(); }
  }
  const line = (x, w, col, dash, gap, off = 0) => { g.fillStyle = col; if (!dash) { g.fillRect(x, 0, w, H); return; } for (let y = off; y < H; y += dash + gap) g.fillRect(x, y, w, dash); };
  const gutter = () => { g.fillStyle = '#b4b1aa'; g.fillRect(0, 0, 26, H); g.fillRect(W - 26, 0, 26, H); g.fillStyle = '#9b9891'; g.fillRect(26, 0, 4, H); g.fillRect(W - 30, 0, 4, H); for (let y = 0; y < H; y += 150) { g.fillStyle = '#8d8a84'; g.fillRect(0, y, 26, 2); g.fillRect(W - 26, y, 26, 2); } };   // rolled concrete curb
  if (kind === 'major') {
    gutter();
    line(28, 7, '#ededed'); line(W - 35, 7, '#ededed');                                   // edge lines
    line(W / 2 - 12, 7, '#e5b931'); line(W / 2 + 5, 7, '#e5b931');                        // double yellow centre
    line(W / 4 - 3, 6, '#ededed', 300, 300); line(W * 3 / 4 - 3, 6, '#ededed', 300, 300);   // lane dashes (3 m / 3 m)
  } else if (kind === 'highway') {
    line(14, 8, '#e5b931'); line(W - 22, 8, '#ededed');
    line(W / 3 - 3, 7, '#ededed', 300, 600); line(W * 2 / 3 - 3, 7, '#ededed', 300, 600);
  } else if (kind === 'local') {
    gutter();
  } else if (kind === 'path') {
    g.fillStyle = '#a9a69f'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) { const v = 150 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
  }
  return tex(c);
}
// concrete sidewalk with expansion joints every 1.5 m
export function sidewalkTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#c4c1ba'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 1500; i++) { const v = 170 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = '#9d9a94'; for (let y = 0; y < 256; y += 96) g.fillRect(0, y, 128, 3);
  g.fillStyle = '#a8a59f'; g.fillRect(0, 0, 6, 256);
  return tex(c);
}

export function groundTexture(base, speck) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { g.fillStyle = speck[i % speck.length]; g.globalAlpha = 0.25 + Math.random() * 0.3; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  g.globalAlpha = 1;
  return tex(c);
}

export function railTexture() {
  const [c, g] = canvas(64, 128);
  g.fillStyle = '#6b6259'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#4a3b2c'; for (let y = 0; y < 128; y += 16) g.fillRect(4, y, 56, 7);
  g.fillStyle = '#9aa0a6'; g.fillRect(16, 0, 4, 128); g.fillRect(44, 0, 4, 128);
  return tex(c);
}

// Label sprite (for landmarks and places)
export function labelTexture(text, opts = {}) {
  const fs = opts.size || 34, pad = 14;
  const [m, mg] = canvas(8, 8); mg.font = `700 ${fs}px "Segoe UI", Roboto, sans-serif`;
  const w = Math.ceil(mg.measureText(text).width) + pad * 2 + (opts.icon ? fs + 8 : 0), h = fs + pad * 1.6;
  const [c, g] = canvas(w, h);
  g.fillStyle = opts.bg || 'rgba(16,22,30,0.82)';
  const r = h / 2; g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, h); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.font = `700 ${fs}px "Segoe UI", Roboto, sans-serif`; g.textBaseline = 'middle';
  let x = pad;
  if (opts.icon) { g.fillText(opts.icon, x, h / 2 + 2); x += fs + 8; }
  g.fillStyle = opts.color || '#fff'; g.fillText(text, x, h / 2 + 2);
  const t = tex(c, false); t.minFilter = THREE.LinearFilter;
  return { tex: t, w, h };
}

export function busSignTexture(route) {
  const [c, g] = canvas(256, 48);
  g.fillStyle = '#111'; g.fillRect(0, 0, 256, 48);
  g.fillStyle = '#ffb000'; g.font = '700 34px monospace'; g.textBaseline = 'middle'; g.fillText(String(route).slice(0, 14), 8, 25);
  const t = tex(c, false); return t;
}

// front door (left quarter) and garage door (right three quarters)
export function doorTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#ececea'; g.fillRect(0, 0, 256, 128);
  // door: painted panel door in a white frame, little window, brass knob
  const cols = ['#6b3f2a', '#24384f', '#7a1f24', '#2f4a36'];
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = cols[0]; g.fillRect(6, 6, 52, 122);
  g.fillStyle = 'rgba(0,0,0,0.22)'; for (const [x, y, w, h] of [[12, 40, 17, 34], [35, 40, 17, 34], [12, 82, 17, 38], [35, 82, 17, 38]]) { g.fillRect(x, y, w, h); }
  g.fillStyle = '#a9c4d6'; g.fillRect(14, 12, 36, 20); g.fillStyle = '#ffffff55'; g.fillRect(14, 12, 12, 20);
  g.fillStyle = '#d6b45a'; g.beginPath(); g.arc(50, 76, 3, 0, 7); g.fill();
  // garage door: white sectional panels with a row of small windows
  g.fillStyle = '#e9e8e3'; g.fillRect(64, 0, 192, 128);
  g.strokeStyle = '#b9b8b2'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(64, i * 32); g.lineTo(256, i * 32); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) g.fillRect(70 + k * 47, r * 32 + 6, 40, 20);
  g.fillStyle = '#7f98aa'; for (let k = 0; k < 4; k++) g.fillRect(72 + k * 47, 7, 36, 16);
  g.strokeStyle = '#9a9a94'; g.lineWidth = 4; g.strokeRect(64, 0, 192, 128);
  return tex(c, false);
}

// steel W-beam guardrail: one post every 2 m (texture spans 2 m x 0.82 m), see-through between posts
export function guardrailTexture() {
  const [c, g] = canvas(128, 64);
  g.clearRect(0, 0, 128, 64);
  g.fillStyle = '#5d6166'; g.fillRect(56, 0, 14, 64);                    // post
  const grd = g.createLinearGradient(0, 4, 0, 30); grd.addColorStop(0, '#d9dde0'); grd.addColorStop(0.45, '#9ea4a9'); grd.addColorStop(0.55, '#c7ccd0'); grd.addColorStop(1, '#8a9096');
  g.fillStyle = grd; g.fillRect(0, 4, 128, 26);                           // the beam
  g.fillStyle = '#6e7378'; g.fillRect(0, 16, 128, 2);
  return tex(c);
}
