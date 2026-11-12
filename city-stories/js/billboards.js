// Welcome billboards where main roads enter each ward, with a welcome from that ward's councillor.
import * as THREE from 'three';
import { ground } from './terrain.js?v=11112205';
import { rotY, dirOf } from './player.js?v=11112205';

let DATA = null;
export async function loadBillboards() { try { DATA = await (await fetch('data/billboards.json')).json(); } catch (e) { DATA = null; } return !!DATA; }
const TEX = new Map();
function wardTexture(n, councillor) {
  let t = TEX.get(n); if (t) return t;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 432; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1024, 432); grd.addColorStop(0, '#0b3d6e'); grd.addColorStop(1, '#0f6d8c'); g.fillStyle = grd; g.fillRect(0, 0, 1024, 432);
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 1024, 18); g.fillRect(0, 414, 1024, 18);
  // a skyline strip along the bottom
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 40; i++) { const w = 18 + (i * 37 % 30), h = 30 + (i * 53 % 90); g.fillRect(i * 27, 400 - h, w, h); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
  g.font = '800 92px "Segoe UI", Roboto, Arial, sans-serif'; g.fillText(`Welcome to Ward ${n}`, 512, 120);
  g.font = '600 46px "Segoe UI", Roboto, Arial, sans-serif'; g.fillStyle = '#ffe28a'; g.fillText('A warm welcome from your councillor', 512, 218);
  let fs = 72; g.font = `800 ${fs}px "Segoe UI", Roboto, Arial, sans-serif`; while (g.measureText(councillor).width > 940 && fs > 40) { fs -= 4; g.font = `800 ${fs}px "Segoe UI", Roboto, Arial, sans-serif`; }
  g.fillStyle = '#ffffff'; g.fillText(councillor, 512, 300);
  g.font = '500 30px "Segoe UI", Roboto, Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText('Calgary · YYC Story', 512, 372);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX.set(n, t); return t;
}
const postMat = new THREE.MeshLambertMaterial({ color: 0x5f656b }), backMat = new THREE.MeshLambertMaterial({ color: 0x2b2f34 });
export class Billboards {
  constructor(scene) { this.scene = scene; this.items = (DATA ? DATA.boards : []).map(b => ({ ...b, g: null })); this.t = 0; }
  update(dt, px, py, night) {
    if ((this.t -= dt) > 0) return; this.t = 1;
    for (const b of this.items) {
      const d = Math.hypot(b.x - px, b.y - py);
      if (d < 1200 && !b.g) {
        const g = b.g = new THREE.Group(), gy = ground(b.x, b.y);
        g.position.set(b.x, gy, -b.y); g.rotation.y = rotY(b.h);
        for (const x of [-3.6, 3.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7, 0.45), postMat); p.position.set(x, 3.5, -0.3); p.castShadow = true; g.add(p); }
        const back = new THREE.Mesh(new THREE.BoxGeometry(12.4, 5.4, 0.3), backMat); back.position.set(0, 9.3, -0.3); back.castShadow = true; g.add(back);
        b.mat = new THREE.MeshBasicMaterial({ map: wardTexture(b.ward, b.councillor), toneMapped: false });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.06), b.mat); face.position.set(0, 9.3, -0.14); g.add(face);
        this.scene.add(g);
      } else if (d > 1500 && b.g) { this.scene.remove(b.g); b.g = null; }
      if (b.mat) b.mat.color.setScalar(night ? 0.95 : 0.85);
    }
  }
}
