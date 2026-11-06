// Procedural textures drawn on canvases: building facades, roads, ground. No image files needed.
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
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

export function nightWindowsTexture() {     // emissive map: some windows lit
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    if (Math.random() < 0.45) { g.fillStyle = `rgba(255,${200 + Math.random() * 40 | 0},${120 + Math.random() * 60 | 0},1)`; g.fillRect(x * 64 + 10, y * 64 + 16, 44, 28); }
  }
  return tex(c);
}

// Road: u across the road (0..1), v along the road (1 unit = 10 m). Asphalt with lane markings.
export function roadTexture(kind) {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#3b3e42'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i++) { const v = 50 + Math.random() * 18 | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 5})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = '#d9d9d9';
  if (kind === 'major') {
    g.fillRect(3, 0, 3, 256); g.fillRect(122, 0, 3, 256);              // edge lines
    g.fillStyle = '#e5b931'; g.fillRect(60, 0, 3, 256); g.fillRect(65, 0, 3, 256);   // double yellow centre
    g.fillStyle = '#d9d9d9';
    for (let y = 0; y < 256; y += 64) { g.fillRect(31, y, 3, 32); g.fillRect(94, y, 3, 32); }   // lane dashes
  } else if (kind === 'highway') {
    g.fillStyle = '#e5b931'; g.fillRect(3, 0, 3, 256); g.fillStyle = '#d9d9d9'; g.fillRect(122, 0, 3, 256);
    for (let y = 0; y < 256; y += 85) { g.fillRect(41, y, 3, 30); g.fillRect(84, y, 3, 30); }
  } else if (kind === 'local') {
    g.fillStyle = 'rgba(220,220,220,0.0)';
  } else if (kind === 'path') {
    g.fillStyle = '#a9a69f'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 500; i++) { const v = 150 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  }
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
