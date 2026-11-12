// CTrain platforms at every station: a raised concrete platform beside the track with a yellow safety
// edge, a glass shelter and the station's name, placed where Calgary Transit's own stop points are.
// You can stand on them (they join the walkable surfaces) and wait for the train.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { ground } from './terrain.js?v=11112205';
import { PLATFORMS } from './tiles.js?v=11112205';

const isStation = n => /CTrain/i.test(n) || (/Station/.test(n) && !/LRT|Terminal|@|Bus/.test(n));
const clean = n => (n || '').replace(/^\s*(NB|SB|EB|WB)\s+/, '').replace(/\((Free Fare Zone|NB|SB|EB|WB)\)/gi, '').replace(/\s*(CTrain\s+)?(Station|Staion|Stn)\b.*$/i, '').replace(/\s+/g, ' ').trim();
const TOP = 0.75, LEN = 96, EDGE = 1.65;        // platform height, length, and the gap from the middle of the track

function box(w, h, d, x, y, z, col, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  if (rotY) g.rotateY(rotY); g.translate(x, y, z);
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function signTex(name) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.fillRect(0, 76, 512, 6);
  g.font = '700 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let s = name; while (g.measureText(s).width > 490 && s.length > 4) s = s.slice(0, -1);
  g.fillText(s, 256, 40); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildPlatforms(scene, world, transit) {
  const rail = transit.paths.filter(p => p.rail), made = [], geos = [], signs = [];
  for (const p of rail) {
    const [x0, y0, x1, y1] = p.bb;
    for (const st of world.stops) {
      if (!isStation(st[2] || '') || st[0] < x0 - 50 || st[0] > x1 + 50 || st[1] < y0 - 50 || st[1] > y1 + 50) continue;
      const pr = p.project(st[0], st[1]); if (pr.d > 25) continue;
      const a = p.at(pr.s), fx = Math.sin(a.h), fy = Math.cos(a.h), rx = fy, ry = -fx;          // along the track, and to its right
      const side = ((st[0] - a.x) * rx + (st[1] - a.y) * ry) >= 0 ? 1 : -1;
      const far = Math.max(EDGE + 3.6, pr.d + 1.8), w = far - EDGE, off = (EDGE + far) / 2 * side;
      const cx = a.x + rx * off, cy = a.y + ry * off;
      if (made.some(m => Math.hypot(m.x - cx, m.y - cy) < 4 && Math.abs(Math.sin(m.h - a.h)) < 0.3)) continue;   // the same platform from the other direction
      // the platform follows the track for its length (curved tracks: short straight pieces)
      const s0 = Math.max(0, pr.s - LEN / 2), s1 = Math.min(p.len, pr.s + LEN / 2), base = ground(cx, cy);
      const name = clean(st[2]);
      const segN = Math.max(1, Math.round((s1 - s0) / 24));
      for (let k = 0; k < segN; k++) {
        const sa = s0 + (s1 - s0) * k / segN, sb = s0 + (s1 - s0) * (k + 1) / segN, A = p.at(sa), B = p.at(sb);
        const h = Math.atan2(B.x - A.x, B.y - A.y), qx = Math.cos(h), qy = -Math.sin(h);     // right of this piece
        const mx = (A.x + B.x) / 2 + qx * off, my = (A.y + B.y) / 2 + qy * off, L = Math.hypot(B.x - A.x, B.y - A.y) + 0.3;
        const gb = Math.min(base, ground(mx, my)) - 0.4;
        PLATFORMS.push({ x: mx, y: my, fx: Math.sin(h), fy: Math.cos(h), hl: L / 2, hw: w / 2, top: base + TOP });
        const ry3 = -h;     // three.js: the box's length along z, turned to the track heading
        geos.push(box(w, base + TOP - gb, L, 0, 0, 0, 0xb9b5ac).rotateY(ry3).translate(mx, gb, -my));
        // the yellow tactile strip along the track edge
        const ex = mx - qx * side * (w / 2 - 0.3), ey = my - qy * side * (w / 2 - 0.3);
        geos.push(box(0.6, 0.02, L, 0, 0, 0, 0xf2c200).rotateY(ry3).translate(ex, base + TOP, -ey));
      }
      // a glass shelter and the name sign in the middle of the platform
      const sx = cx + rx * side * 0.6, sy = cy + ry * side * 0.6, roofY = base + TOP + 2.9;
      for (const dz of [-6, 6]) for (const dl of [-1.1, 1.1]) geos.push(box(0.12, 2.9, 0.12, 0, 0, 0, 0x4a5058).translate(dl, 0, 0).rotateY(-a.h).translate(sx + fx * dz, base + TOP, -(sy + fy * dz)));
      geos.push(box(3.0, 0.12, 14, 0, 0, 0, 0x9fb3c2).rotateY(-a.h).translate(sx, roofY, -sy));
      signs.push({ x: sx - fx * 9, y: sy - fy * 9, z: base + TOP + 2.3, h: a.h, name });
      made.push({ x: cx, y: cy, h: a.h, name });
    }
  }
  if (!geos.length) return 0;
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: false }));
  mesh.receiveShadow = true; mesh.castShadow = true; mesh.name = 'ctrain platforms'; mesh.frustumCulled = true; scene.add(mesh);
  for (const g of geos) g.dispose();
  // the name signs (on two posts), made when you come near
  const signGroup = new THREE.Group(); scene.add(signGroup);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x4a5058 });
  let t = 0;
  return {
    count: made.length,
    update(dt, px, py) {
      if ((t -= dt) > 0) return; t = 1;
      for (const s of signs) {
        const near = Math.hypot(s.x - px, s.y - py) < 260;
        if (near && !s.m) {
          const g = new THREE.Group();
          const b = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTex(s.name), side: THREE.DoubleSide }));
          b.position.y = s.z; g.add(b);
          for (const d of [-1.4, 1.4]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), postMat); po.position.set(d, s.z - 1.0, 0); g.add(po); }
          g.position.set(s.x, 0, -s.y); g.rotation.y = Math.PI / 2 - s.h; signGroup.add(g); s.m = g;
        } else if (!near && s.m) { signGroup.remove(s.m); s.m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); s.m = null; }
      }
    },
  };
}
