// Online challenges in free roam: short games for everyone playing nearby. Every few minutes one starts on its own
// (or tap 🎯 / press G), and anyone within reach joins in automatically:
//   🤠 Stetson Hunt  golden cowboy hats hidden on the streets around you; the first to reach a hat takes it (+2)
//   ⛰️ Chinook Hill   stand in the glowing circle to score a point every 2 s; the circle moves every 40 s
//   🍕 Pizza Rush    grab the pizza and deliver it; anyone who touches the carrier (or splashes them) steals it (+5 to deliver)
// Points go on the same scoreboard as the water fights and races.
import * as THREE from 'three';
import { toast } from './hud.js?v=11112231';
import { ground } from './terrain.js?v=11112231';

const TYPES = ['hunt', 'hill', 'pizza'];
const NAME = { hunt: '🤠 Stetson Hunt', hill: '⛰️ Chinook Hill', pizza: '🍕 Pizza Rush' };
const RULE = { hunt: 'Find the golden hats on the streets around you. First to reach one takes it: +2.', hill: 'Stand inside the glowing circle: a point every 2 seconds. It moves every 40 seconds.', pizza: 'Grab the pizza and deliver it to the 🏠. Touch or splash the carrier to steal it. Delivery: +5.' };
const LEN = { hunt: 180, hill: 160, pizza: 240 };      // seconds

function hatMesh() {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x6a4a00 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), m); brim.scale.set(1, 1, 1.25);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.36, 16), m); crown.position.y = 0.2; crown.scale.set(1, 1, 1.2);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.07, 16), new THREE.MeshBasicMaterial({ color: 0x7a1c1c })); band.position.y = 0.07; band.scale.set(1, 1, 1.2);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  glow.position.y = 15; g.add(brim, crown, band, glow); return g;
}
function pizzaMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0xd9b07a })); g.add(box);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0xc8321e })); top.rotation.x = -Math.PI / 2; top.position.y = 0.062; g.add(top);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  glow.position.y = 15; g.add(glow); return g;
}
function ringMesh(r, col) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 4, 40, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  wall.position.y = 2; const disc = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.15; g.add(wall, disc); return g;
}

export class Challenges {
  constructor(game, scene, games) {
    this.g = game; this.scene = scene; this.games = games; this.c = null; this.auto = 90 + Math.random() * 60; this.objs = [];
    const bar = document.getElementById('gamebar');
    if (bar) { const b = document.createElement('button'); b.id = 'g-ch'; b.className = 'g-x'; b.title = 'Online challenge (G)'; b.textContent = '🎯'; bar.insertBefore(b, bar.querySelector('#g-board')); b.onclick = () => this.button(); this.btn = b; }
    const info = this.info = document.createElement('div'); info.id = 'g-chinfo'; info.hidden = true; document.body.appendChild(info);
    addEventListener('keydown', e => { if (this.g.started && e.code === 'KeyG' && !e.repeat && e.target.tagName !== 'INPUT') this.button(); });
  }
  get mp() { return this.g.mp && this.g.mp.on ? this.g.mp : null; }
  button() { if (this.c) { toast(`${NAME[this.c.type]}: ${RULE[this.c.type]}`, 4500); return; } this.create(); }
  // a new challenge around you, sent to everyone
  create(type) {
    const p = this.g.player, f = this.g.findRoadSpot; if (!p || !f) return;
    type ||= TYPES[Math.floor(Math.random() * TYPES.length)];
    const spot = (rmin, rmax) => { for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, r = rmin + Math.random() * (rmax - rmin), s = f(p.x + Math.sin(a) * r, p.y + Math.cos(a) * r, 0, 90); if (s) return [Math.round(s.x), Math.round(s.y)]; } return null; };
    const d = { k: 'ch', cid: Math.random().toString(36).slice(2, 8), type, t0: Date.now() + 8000, x: Math.round(p.x), y: Math.round(p.y) };
    if (type === 'hunt') d.pts = Array.from({ length: 8 }, () => spot(90, 420)).filter(Boolean);
    if (type === 'hill') d.pts = Array.from({ length: 4 }, () => spot(40, 260)).filter(Boolean);
    if (type === 'pizza') { d.pts = [spot(60, 200), spot(350, 600)].filter(Boolean); }
    if (!d.pts || d.pts.length < (type === 'hunt' ? 4 : 2)) { toast('No streets for a challenge here. Try near a road.'); return; }
    if (this.mp) this.mp.game(d);
    this.start(d, 'You');
  }
  start(d, host) {
    this.end(null);
    const c = this.c = { ...d, host, taken: new Set(), holder: null, myHold: false, hillT: 0, pz: d.type === 'pizza' ? { x: d.pts[0][0], y: d.pts[0][1] } : null };
    if (d.type === 'hunt') d.pts.forEach(([x, y], i) => { const m = hatMesh(); m.position.set(x, ground(x, y) + 0.9, -y); m.userData.i = i; this.add(m); });
    if (d.type === 'hill') { c.ring = ringMesh(12, 0x7ad0ff); this.add(c.ring); }
    if (d.type === 'pizza') { c.pmesh = pizzaMesh(); this.add(c.pmesh); const [hx, hy] = d.pts[1]; c.home = ringMesh(8, 0x5ad06a); c.home.position.set(hx, ground(hx, hy), -hy); this.add(c.home); }
    if (this.btn) this.btn.classList.add('on');
    toast(`${NAME[d.type]} ${host === 'You' ? 'starts' : `from ${host}`} in 8 s — ${RULE[d.type]}`, 6000);
  }
  add(m) { this.scene.add(m); this.objs.push(m); }
  end(msg) {
    for (const m of this.objs) this.scene.remove(m); this.objs = [];
    if (this.c && msg) toast(msg, 4500);
    this.c = null; this.info.hidden = true; if (this.btn) this.btn.classList.remove('on');
    if (this.g.setWaypointRaw && this._wp) { this.g.setWaypointRaw(null); this._wp = false; }
  }
  score(n, why) { this.games.popup(`+${n} ${why || ''}`); this.pts = (this.pts || 0) + n; if (this.g.sfx && this.g.sfx.coin) this.g.sfx.coin(); }      // challenge points (separate from splats)
  onNet(id, name, d) {
    if (d.k === 'ch') { const p = this.g.player; if (!this.c && p && Math.hypot(d.x - p.x, d.y - p.y) < 1600 && d.t0 + LEN[d.type] * 1000 > Date.now()) this.start(d, name); return; }
    const c = this.c; if (!c || d.cid !== c.cid) return;
    if (d.k === 'ch-take' && !c.taken.has(d.i)) { c.taken.add(d.i); this.removeHat(d.i); toast(`🤠 ${name} found a golden hat`); }
    else if (d.k === 'ch-hold') { c.holder = d.by === (this.mp && this.mp.id) ? null : d.by; c.myHold = d.by === (this.mp && this.mp.id); if (!c.myHold) toast(`🍕 ${name} has the pizza!`); c.stealCool = performance.now() + 1500; }
    else if (d.k === 'ch-end') this.end(`🏆 ${name} won ${NAME[c.type]}!`);
  }
  removeHat(i) { const m = this.objs.find(o => o.userData.i === i); if (m) { this.scene.remove(m); this.objs.splice(this.objs.indexOf(m), 1); } }
  // splashing the pizza carrier steals it
  hitPlayer(id) { const c = this.c; if (c && c.type === 'pizza' && c.holder === id && (c.stealCool || 0) < performance.now()) this.take(); }
  take() { const c = this.c, mp = this.mp; c.holder = null; c.myHold = true; c.stealCool = performance.now() + 1500; if (mp) mp.game({ k: 'ch-hold', cid: c.cid, by: mp.id }); toast('🍕 You have the pizza — deliver it to the 🏠!'); if (this.g.setWaypointRaw) { this.g.setWaypointRaw({ x: c.pts[1][0], y: c.pts[1][1] }); this._wp = true; } }
  update(dt) {
    const p = this.g.player, mp = this.mp; if (!p || !this.g.started) return;
    // one starts on its own now and then when other people are online (the player with the lowest id sends it)
    if (!this.c && mp && mp.others.size && (this.auto -= dt) <= 0) {
      this.auto = 240 + Math.random() * 120;
      if ([...mp.others.keys()].every(k => mp.id < k)) this.create();
    }
    const c = this.c; if (!c) return;
    const now = Date.now(), left = c.t0 + LEN[c.type] * 1000 - now, t = performance.now() / 1000;
    this.info.hidden = false;
    if (now < c.t0) { this.info.textContent = `${NAME[c.type]} starts in ${Math.ceil((c.t0 - now) / 1000)}`; return; }
    if (left <= 0) { this.end(`${NAME[c.type]} is over. Your challenge points: ${this.pts || 0}`); return; }
    const mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
    if (c.type === 'hunt') {
      const n = c.pts.length - c.taken.size; this.info.textContent = `${NAME.hunt} · ${n} hats left · ${mm}:${String(ss).padStart(2, '0')}`;
      for (const m of this.objs) { m.rotation.y += dt * 1.5; m.children[0].parent.position.y += Math.sin(t * 2 + m.userData.i) * 0.003; }
      c.pts.forEach(([x, y], i) => { if (c.taken.has(i) || Math.hypot(x - p.x, y - p.y) > 3.2) return; c.taken.add(i); this.removeHat(i); this.score(2, '🤠'); if (mp) mp.game({ k: 'ch-take', cid: c.cid, i }); });
      if (c.taken.size >= c.pts.length) { if (mp) mp.game({ k: 'ch-end', cid: c.cid }); this.end(`🤠 All the hats are found! Your challenge points: ${this.pts || 0}`); }
    } else if (c.type === 'hill') {
      const k = Math.min(c.pts.length - 1, Math.floor((now - c.t0) / 40000)), [x, y] = c.pts[k];
      c.ring.position.set(x, ground(x, y), -y); c.ring.rotation.y += dt * 0.6;
      const inside = Math.hypot(x - p.x, y - p.y) < 12;
      if (inside && (c.hillT += dt) >= 2) { c.hillT -= 2; this.score(1, '⛰️'); }
      if (k !== c.lastK) { c.lastK = k; if (this.g.setWaypointRaw) { this.g.setWaypointRaw({ x, y }); this._wp = true; } if (k) toast('⛰️ The hill moved!'); }
      this.info.textContent = `${NAME.hill} · ${inside ? 'scoring!' : `${Math.round(Math.hypot(x - p.x, y - p.y))} m away`} · ${mm}:${String(ss).padStart(2, '0')}`;
    } else if (c.type === 'pizza') {
      // where the pizza is: on the ground, with you, or with another player
      let pz = c.pz;
      if (c.myHold) pz = { x: p.x, y: p.y, z: p.gy + 2.3 };
      else if (c.holder && mp && mp.others.get(c.holder)) { const o = mp.others.get(c.holder); pz = { x: o.x, y: o.y, z: (o.z ?? ground(o.x, o.y)) + 2.3 }; }
      c.pmesh.position.set(pz.x, pz.z ?? ground(pz.x, pz.y) + 0.6, -pz.y); c.pmesh.rotation.y += dt;
      if (!c.myHold && (c.stealCool || 0) < performance.now() && Math.hypot(pz.x - p.x, pz.y - p.y) < (c.holder ? 2.4 : 2.8)) this.take();
      const [hx, hy] = c.pts[1];
      if (c.myHold && Math.hypot(hx - p.x, hy - p.y) < 8) { this.score(5, '🍕'); if (mp) mp.game({ k: 'ch-end', cid: c.cid }); this.end('🍕 Delivered! You won Pizza Rush.'); return; }
      this.info.textContent = `${NAME.pizza} · ${c.myHold ? 'deliver it to the 🏠!' : c.holder ? 'someone has it — catch them!' : 'grab the pizza!'} · ${mm}:${String(ss).padStart(2, '0')}`;
      if (!c.myHold && this.g.setWaypointRaw && (this._pzT = (this._pzT || 0) - dt) <= 0) { this._pzT = 1; this.g.setWaypointRaw({ x: pz.x, y: pz.y }); this._wp = true; }
    }
  }
}
