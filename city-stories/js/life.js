// Life in the neighbourhoods: children playing in parks and in front of homes, and wildlife in the parks
// (jackrabbits hopping about, and now and then a young black bear wandering through a wooded park).
import * as THREE from 'three';
import { L, standY } from './tiles.js';
import { ground } from './terrain.js';
import { loader, warm } from './gltf.js';
import { Character } from './rig.js';
import { humanReady } from './humans.js';

const KIDS = ['kid_boy', 'kid_girl', 'kid_boy2'];
const GREEN = new Set([5, 6, 9, 13, 14]), WOODS = 6;      // parks, woods, meadows, sports fields, playgrounds
const ANIMALS = {};
async function loadAnimal(name, len) {
  try {
    const gl = await loader.loadAsync(`data/models/${name}.glb`); let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    gl.scene.updateMatrixWorld(true); const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox(); let b = geo.boundingBox, s = b.getSize(new THREE.Vector3());
    if (s.x > s.z) geo.rotateY(-Math.PI / 2);                // models face +x: turn to face +z
    geo.computeBoundingBox(); b = geo.boundingBox; s = b.getSize(new THREE.Vector3()); const c = b.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -b.min.y, -c.z); const k = len / s.z; geo.scale(k, k, k); geo.userData.shared = true;
    ANIMALS[name] = { geo, mat: new THREE.MeshLambertMaterial({ map: mesh.material.map }) };
    warm(new THREE.Mesh(geo, ANIMALS[name].mat));
  } catch (e) { console.warn('animal', name, e); }
}

export class Life {
  constructor(game, scene, { kids = 10, rabbits = 8, mobile = false } = {}) {
    this.g = game; this.scene = scene; this.max = { kids: mobile ? Math.round(kids * 0.6) : kids, rabbits: mobile ? 5 : rabbits, bears: mobile ? 1 : 2 };
    this.kids = []; this.animals = []; this.t = 0;
    loadAnimal('rabbit', 0.55); loadAnimal('bear', 1.25);
  }
  // a random green spot (park, woods, grass) near (x, y); woods only if asked
  greenSpot(px, py, rmin, rmax, woods = false) {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, d = rmin + Math.random() * (rmax - rmin), x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      const t = this.g.tiles.tileAt(x, y); if (!t || !t.layers || !t.layers[L.AREA]) continue;
      const lx = x - t.ox, ly = y - t.oy;
      for (const f of t.layers[L.AREA]) {
        if (woods ? f.kind !== WOODS : !GREEN.has(f.kind)) continue;
        const r = f.rings[0]; let inside = false;
        for (let i = 0, j = r.length / 2 - 1; i < r.length / 2; j = i++) { const yi = r[i * 2 + 1], yj = r[j * 2 + 1]; if ((yi > ly) !== (yj > ly) && lx < (r[j * 2] - r[i * 2]) * (ly - yi) / (yj - yi) + r[i * 2]) inside = !inside; }
        if (inside && this.g.tiles.standable(x, y)) return { x, y, woods: f.kind === WOODS };
      }
    }
    return null;
  }
  // the front yard of a nearby detailed home
  yardSpot(px, py) {
    for (const t of this.g.tiles.tiles.values()) {
      if (!t.houses) continue;
      for (const { arr } of t.houses.list) for (let k = 0; k < 4; k++) {
        const a = arr[Math.floor(Math.random() * arr.length)]; if (!a) continue;
        const x = a.wx + a.fx * (a.depth / 2 + 4), y = a.wy + a.fy * (a.depth / 2 + 4), d = Math.hypot(x - px, y - py);
        if (d > 40 && d < 150 && this.g.tiles.standable(x, y)) return { x, y };
      }
    }
    return null;
  }
  spawnKids(px, py) {
    if (!humanReady(KIDS[0])) return;
    const spot = Math.random() < 0.5 ? this.yardSpot(px, py) : this.greenSpot(px, py, 50, 160);
    if (!spot) return;
    const n = 2 + Math.floor(Math.random() * 3), game = Math.random();         // chasing in a circle, or walking along
    for (let i = 0; i < n; i++) {
      const name = KIDS[(i + Math.floor(Math.random() * 3)) % KIDS.length], ch = new Character({ glb: name, gscale: 0.95 + Math.random() * 0.1 });
      this.scene.add(ch.g);
      this.kids.push({ ch, cx: spot.x, cy: spot.y, a: i / n * Math.PI * 2, r: 3 + Math.random() * 3, sp: game < 0.65 ? 2.6 + Math.random() : 1.1, mode: game < 0.65 ? 'chase' : 'walk', h: Math.random() * 6.28, x: spot.x, y: spot.y, t: Math.random() * 3 });
    }
  }
  spawnAnimal(px, py) {
    const bears = this.animals.filter(a => a.kind === 'bear').length, bear = ANIMALS.bear && bears < this.max.bears && Math.random() < 0.45, kind = bear ? 'bear' : 'rabbit'; if (!ANIMALS[kind]) return;
    // bears wander through wooded parks first, and any big green space when there's no woods close by
    const spot = bear ? (this.greenSpot(px, py, 30, 160, true) || this.greenSpot(px, py, 40, 150)) : this.greenSpot(px, py, 35, 140); if (!spot) return;
    const m = new THREE.Mesh(ANIMALS[kind].geo, ANIMALS[kind].mat); m.castShadow = true; this.scene.add(m);
    this.animals.push({ m, kind, x: spot.x, y: spot.y, h: Math.random() * 6.28, t: 0, hop: 0, pause: Math.random() * 2, home: spot });
  }
  update(dt, px, py) {
    if ((this.t -= dt) <= 0) {
      this.t = 0.8;
      // the two little ones on the lawn at home: a girl and a boy playing tag in a small circle, always there
      const H = this.homeKids;
      if (H && humanReady('kid_girl') && humanReady('kid_boy') && Math.hypot(H.x - px, H.y - py) < 180 && !this.kids.some(k => k.home)) {
        ['kid_girl', 'kid_boy'].forEach((name, i) => {
          const ch = new Character({ glb: name, gscale: 0.82 }); this.scene.add(ch.g);
          this.kids.push({ ch, cx: H.x, cy: H.y, a: i * Math.PI, r: 1.4, sp: 1.5 + i * 0.1, mode: 'chase', h: 0, x: H.x, y: H.y, t: i * 3, home: true });
        });
      }
      if (this.kids.length < this.max.kids) this.spawnKids(px, py);
      if (this.animals.filter(a => a.kind === 'rabbit').length < this.max.rabbits || (ANIMALS.bear && this.animals.filter(a => a.kind === 'bear').length < this.max.bears)) this.spawnAnimal(px, py);
    }
    // children: running round in a game of tag, or out for a walk
    for (let i = this.kids.length - 1; i >= 0; i--) {
      const k = this.kids[i], far = Math.hypot(k.x - px, k.y - py);
      if (far > 220) { this.scene.remove(k.ch.g); this.kids.splice(i, 1); continue; }
      k.t += dt;
      let nx = k.x, ny = k.y;
      if (k.mode === 'chase') { k.a += dt * k.sp / k.r * (Math.sin(k.t * 0.3) > -0.7 ? 1 : 0); nx = k.cx + Math.cos(k.a) * k.r; ny = k.cy + Math.sin(k.a) * k.r; }
      else { const fx = Math.sin(k.h), fy = Math.cos(k.h); nx = k.x + fx * k.sp * dt; ny = k.y + fy * k.sp * dt; if (!this.g.tiles.standable(nx, ny) || Math.hypot(nx - k.cx, ny - k.cy) > 40) { k.h += Math.PI * (0.6 + Math.random() * 0.8); nx = k.x; ny = k.y; } }
      const moved = Math.hypot(nx - k.x, ny - k.y);
      if (moved > 1e-3) k.h = Math.atan2(nx - k.x, ny - k.y);
      k.x = nx; k.y = ny;
      k.ch.g.position.set(k.x, standY(k.x, k.y), -k.y); k.ch.g.rotation.y = Math.PI - k.h;
      if (far < 120 || Math.random() < 0.4) k.ch.animate(far < 120 ? dt : dt * 2.5, { speed: moved / Math.max(dt, 1e-3), run: k.mode === 'chase' });
    }
    // rabbits hop in short bursts and stop to look around; a bear ambles slowly
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i], far = Math.hypot(a.x - px, a.y - py);
      if (far > 230) { this.scene.remove(a.m); this.animals.splice(i, 1); continue; }
      let y = 0;
      if (a.pause > 0) { a.pause -= dt; if (a.kind === 'rabbit' && far < 8) { a.pause = 0; a.h = Math.atan2(a.x - px, a.y - py); a.hop = 6; } }      // startled
      else if (a.kind === 'rabbit') {
        a.t += dt * 3.2; const ph = a.t % 1; y = Math.sin(ph * Math.PI) * 0.35;
        const nx = a.x + Math.sin(a.h) * 2.4 * dt * 1.6, ny = a.y + Math.cos(a.h) * 2.4 * dt * 1.6;
        if (Math.hypot(nx - a.home.x, ny - a.home.y) < 35) { a.x = nx; a.y = ny; } else a.h += Math.PI;
        if (a.t >= (a.hop || 3)) { a.t = 0; a.hop = 2 + Math.floor(Math.random() * 4); a.pause = 1 + Math.random() * 4; a.h += (Math.random() - 0.5) * 2; }
      } else {
        a.t += dt; const nx = a.x + Math.sin(a.h) * 0.9 * dt, ny = a.y + Math.cos(a.h) * 0.9 * dt;
        if (Math.hypot(nx - a.home.x, ny - a.home.y) < 60) { a.x = nx; a.y = ny; } else a.h += Math.PI * 0.8;
        y = Math.abs(Math.sin(a.t * 2.2)) * 0.04; a.m.rotation.z = Math.sin(a.t * 2.2) * 0.04;
        if (Math.random() < dt * 0.05) a.pause = 3 + Math.random() * 5; else a.h += (Math.random() - 0.5) * dt * 0.4;
      }
      a.m.position.set(a.x, ground(a.x, a.y) + y, -a.y); a.m.rotation.y = Math.PI - a.h;
    }
  }
}
