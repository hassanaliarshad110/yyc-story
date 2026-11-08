// Halloween in Calgary: jack-o'-lanterns on the front steps, ghosts and tombstones on the lawns and orange and
// purple string lights along the eaves of houses. Placed in front of each home's street-facing wall (the same
// wall that carries its house number); everything glows after dark. Turn it off in Settings.
import * as THREE from 'three';

export const HALLOWEEN = { on: (() => { try { return localStorage.getItem('yyc-halloween') !== '0'; } catch (e) { return true; } })(), groups: new Set() };
export function setHalloween(on) {
  HALLOWEEN.on = on; try { localStorage.setItem('yyc-halloween', on ? '1' : '0'); } catch (e) { }
  for (const g of HALLOWEEN.groups) g.visible = on;
}

let M = null;
function mats() {
  if (M) return M;
  // jack-o'-lantern skin: ribbed orange with a carved face; the face glows (emissive map) at night
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H; const ge = e.getContext('2d');
  g.fillStyle = '#e8741a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) { const x = i * W / 10; const gr = g.createLinearGradient(x, 0, x + W / 10, 0); gr.addColorStop(0, 'rgba(120,40,0,.35)'); gr.addColorStop(.5, 'rgba(255,170,60,.18)'); gr.addColorStop(1, 'rgba(120,40,0,.35)'); g.fillStyle = gr; g.fillRect(x, 0, W / 10, H); }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const face = (ctx, col) => {                       // centred on u = 0.5 (faces +x on a sphere)
    ctx.fillStyle = col; const cx = W / 2;
    ctx.beginPath(); ctx.moveTo(cx - 34, 52); ctx.lineTo(cx - 18, 36); ctx.lineTo(cx - 10, 54); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 34, 52); ctx.lineTo(cx + 18, 36); ctx.lineTo(cx + 10, 54); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 4, 62); ctx.lineTo(cx + 4, 62); ctx.lineTo(cx, 70); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 38, 76); ctx.quadraticCurveTo(cx, 106, cx + 38, 76); ctx.lineTo(cx + 26, 82); ctx.lineTo(cx + 18, 76); ctx.lineTo(cx + 8, 84); ctx.lineTo(cx, 78); ctx.lineTo(cx - 8, 84); ctx.lineTo(cx - 18, 76); ctx.lineTo(cx - 26, 82); ctx.closePath(); ctx.fill();
  };
  face(g, '#3a1a06'); face(ge, '#ffcf5a');
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const emap = new THREE.CanvasTexture(e); emap.colorSpace = THREE.SRGBColorSpace;
  // ghost: white sheet with two dark eyes facing +x
  const gc = document.createElement('canvas'); gc.width = 128; gc.height = 128; const gg = gc.getContext('2d');
  gg.fillStyle = '#f4f4f8'; gg.fillRect(0, 0, 128, 128); gg.fillStyle = '#16161c';
  for (const dx of [-7, 7]) { gg.beginPath(); gg.ellipse(32 + dx, 26, 4, 6, 0, 0, Math.PI * 2); gg.fill(); }
  gg.beginPath(); gg.ellipse(32, 40, 4, 5, 0, 0, Math.PI * 2); gg.fill();
  const gmap = new THREE.CanvasTexture(gc); gmap.colorSpace = THREE.SRGBColorSpace;
  M = {
    pumpkin: new THREE.MeshLambertMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0 }),
    stem: new THREE.MeshLambertMaterial({ color: 0x3f5a22 }),
    ghost: new THREE.MeshLambertMaterial({ map: gmap, emissive: 0x8090ff, emissiveIntensity: 0, side: THREE.DoubleSide }),
    stone: new THREE.MeshLambertMaterial({ color: 0x7c7f86 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  };
  M.geo = {
    pumpkin: new THREE.SphereGeometry(0.3, 14, 10).scale(1, 0.78, 1).translate(0, 0.23, 0),
    stem: new THREE.CylinderGeometry(0.025, 0.035, 0.09, 6).translate(0, 0.49, 0),
    ghost: (() => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12, y = 1.25 - t * 1.25; const r = t < 0.35 ? Math.sin(t / 0.35 * Math.PI / 2) * 0.3 : 0.3 + (t - 0.35) * 0.35; pts.push(new THREE.Vector2(Math.max(0.001, r), y)); } return new THREE.LatheGeometry(pts, 16).rotateY(-Math.PI / 2); })(),
    stone: (() => { const s = new THREE.Shape(); s.moveTo(-0.24, 0); s.lineTo(-0.24, 0.45); s.absarc(0, 0.45, 0.24, Math.PI, 0, true); s.lineTo(0.24, 0); s.lineTo(-0.24, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }).translate(0, 0, -0.05).rotateY(Math.PI / 2); })(),
    bulb: new THREE.SphereGeometry(0.085, 6, 4),
  };
  return M;
}

export function setHalloweenNight(k) {
  if (!M) return;
  const on = Math.max(0, Math.min(1, (k - 0.3) / 0.4));
  M.pumpkin.emissiveIntensity = on * 2.2;
  M.ghost.emissiveIntensity = on * 0.35;
  M.bulb.color.setScalar(0.55 + on * 1.6);
}

const hash = (x, y, s) => { const h = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return h - Math.floor(h); };
const ORANGE = new THREE.Color(1, 0.42, 0.05), PURPLE = new THREE.Color(0.55, 0.15, 1), GREEN = new THREE.Color(0.3, 1, 0.2);

// spots: front walls of homes in tile-local metres: { x, y (point on the wall), nx, ny (out to the street), ex, ey (along), len, z0 (ground), z1 (eave) }
export function buildHalloween(spots, gl) {
  const m = mats(), group = new THREE.Group(); group.name = 'halloween';
  const P = [], S = [], G = [], T = [], B = [], BC = [];
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  const put = (arr, x, y, z, rot, s = 1) => { q.setFromAxisAngle(up, rot); sc.setScalar(s); arr.push(mtx.compose(v.set(x, z, -y), q, sc).clone()); };
  for (const p of spots) {
    const r = hash(p.x, p.y, 1); if (r < 0.12) continue;                    // a few houses don't decorate
    const rot = Math.atan2(p.ny, p.nx);                                     // +x of each decoration faces the street
    // jack-o'-lanterns by the door
    const nP = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
    for (let i = 0; i < nP; i++) {
      const off = (i - (nP - 1) / 2) * 0.55 + (hash(p.x, p.y, 2) - 0.5) * 0.6, x = p.x + p.nx * 1.1 + p.ex * off, y = p.y + p.ny * 1.1 + p.ey * off;
      const s = 0.8 + hash(p.x, p.y, 3 + i) * 0.5, z = gl(x, y); put(P, x, y, z, rot + (hash(p.x, p.y, 7 + i) - 0.5) * 0.5, s); put(S, x, y, z, rot, s);
    }
    // a ghost or two tombstones on the lawn
    const r2 = hash(p.x, p.y, 4);
    if (r2 < 0.3) { const d = 3.2 + hash(p.x, p.y, 5) * 2, a = (hash(p.x, p.y, 6) - 0.5) * 3, x = p.x + p.nx * d + p.ex * a, y = p.y + p.ny * d + p.ey * a; put(G, x, y, gl(x, y), rot, 0.9 + hash(p.x, p.y, 9) * 0.4); }
    else if (r2 < 0.55) for (let i = 0; i < 2 + (r2 < 0.42 ? 1 : 0); i++) { const d = 3 + hash(p.x, p.y, 10 + i) * 2.5, a = (i - 1) * 0.9 + (hash(p.x, p.y, 13 + i) - 0.5) * 0.5, x = p.x + p.nx * d + p.ex * a, y = p.y + p.ny * d + p.ey * a; put(T, x, y, gl(x, y), rot + (hash(p.x, p.y, 16 + i) - 0.5) * 0.3, 0.8 + hash(p.x, p.y, 19 + i) * 0.4); }
    // string lights along the eave (about two houses in three)
    if (hash(p.x, p.y, 8) < 0.68 && p.z1 - p.z0 > 2) {
      const scheme = hash(p.x, p.y, 21), n = Math.floor(p.len / 0.5), start = -p.len * p.u0;
      for (let i = 0; i <= n; i++) {
        const a = start + i * 0.5, f = (i % 6) / 6, sag = Math.sin(f * Math.PI) * 0.12;
        const x = p.x + p.ex * a + p.nx * 0.18, y = p.y + p.ey * a + p.ny * 0.18;
        B.push(mtx.compose(v.set(x, p.z1 - 0.12 - sag, -y), q.identity(), sc.setScalar(1)).clone());
        BC.push(scheme < 0.45 ? (i % 2 ? PURPLE : ORANGE) : scheme < 0.8 ? ORANGE : (i % 3 === 0 ? GREEN : i % 3 === 1 ? PURPLE : ORANGE));
      }
    }
  }
  const inst = (geo, mat, list, colors) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    if (colors) colors.forEach((c, i) => im.setColorAt(i, c));
    im.frustumCulled = false; im.castShadow = false; group.add(im);
  };
  inst(m.geo.pumpkin, m.pumpkin, P); inst(m.geo.stem, m.stem, S); inst(m.geo.ghost, m.ghost, G); inst(m.geo.stone, m.stone, T); inst(m.geo.bulb, m.bulb, B, BC);
  group.visible = HALLOWEEN.on; HALLOWEEN.groups.add(group);
  return group;
}
