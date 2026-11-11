// Hero powers, earned by being kind. Every good deed (checking in on someone sleeping outside, pitching in on a 311
// issue) charges your power (3 minutes each, up to 15). The first deed unlocks FLIGHT, the second the WEB LINE:
// shoot a line to the rooftops and swing through the city. Powers drain only while you use them.
import * as THREE from 'three';
import { dirOf } from './player.js?v=11111720';
import { ground } from './terrain.js?v=11111720';

const KEY = 'yyc-powers', PER_DEED = 180, MAX = 900;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };

export class Powers {
  constructor(game, scene, player, tiles, ui = {}) {
    this.g = game; this.scene = scene; this.p = player; this.tiles = tiles; this.toast = ui.toast || (() => {}); this.sfx = ui.sfx;
    const s = load(); this.deeds = s.deeds || 0; this.energy = s.energy ?? 0; this.helped = new Set(s.helped || []);
    this.active = null;            // 'fly' | 'web' | null
    this.vel = new THREE.Vector3(); this.anchor = null; this.L = 0; this.swinging = false;
    // the web line and where it sticks
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf4f7ff, transparent: true, opacity: 0.9 })); this.line.frustumCulled = false; this.line.visible = false; scene.add(this.line);
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); this.dot.visible = false; scene.add(this.dot);
    this.ui();
    player.powerUpdate = (dt, inp, camH) => this.update(dt, inp, camH);
    player.powerPose = () => this.pose();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ deeds: this.deeds, energy: Math.round(this.energy), helped: [...this.helped].slice(-300) })); } catch (e) {} }
  get canFly() { return this.deeds >= 1; }
  get canWeb() { return this.deeds >= 2; }
  // ---------------------------------------------------------------- good deeds
  // key: once per person / issue (no farming the same deed)
  deed(what, key) {
    if (key && this.helped.has(key)) { this.toast('You already helped here 💛'); return false; }
    if (key) this.helped.add(key);
    const first = this.deeds === 0, second = this.deeds === 1; this.deeds++;
    this.energy = Math.min(MAX, this.energy + PER_DEED); this.save(); this.refresh();
    if (this.sfx) this.sfx.chime();
    if (first) this.toast(`✨ Good deed: ${what}. You've earned a power: FLIGHT! Tap 🦸 (or B) to fly. Each good deed charges 3 more minutes.`, 7000);
    else if (second) this.toast(`✨ Good deed: ${what}. New power: the WEB LINE! Tap 🕸️ (or X) to shoot a line at the rooftops and swing.`, 7000);
    else this.toast(`✨ Good deed: ${what}. Power +3 min (${this.fmt()} charged)`, 4000);
    return true;
  }
  fmt() { const s = Math.max(0, Math.round(this.energy)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  // ---------------------------------------------------------------- buttons (on the left, with the game buttons)
  ui() {
    const mk = (id, icon, title, fn) => { const b = document.createElement('button'); b.id = id; b.className = 'pw-btn'; b.title = title; b.innerHTML = icon + '<small></small>'; b.onclick = fn; b.hidden = true; return b; };
    this.bFly = mk('pw-fly', '🦸', 'Fly (B)', () => this.toggleFly()); this.bWeb = mk('pw-web', '🕸️', 'Web line (X)', () => this.web());
    const put = () => { const bar = document.getElementById('gamebar'); if (bar) { bar.prepend(this.bWeb); bar.prepend(this.bFly); } else setTimeout(put, 500); }; put();
    addEventListener('keydown', e => { if (e.repeat || !this.g.started || e.target.tagName === 'INPUT') return; if (e.code === 'KeyB') this.toggleFly(); if (e.code === 'KeyX') this.web(); });
    this.refresh();
  }
  refresh() {
    this.bFly.hidden = !this.canFly; this.bWeb.hidden = !this.canWeb;
    this.bFly.classList.toggle('on', this.active === 'fly'); this.bWeb.classList.toggle('on', this.active === 'web');
    for (const b of [this.bFly, this.bWeb]) b.querySelector('small').textContent = this.fmt();
  }
  usable() { const p = this.p; return this.g.started && !this.g.paused && p.mode === 'foot' && !p.seat && !(this.g.deadT > 0); }
  noEnergy() { this.toast('Out of power. Do a good deed to charge it: check in on someone outside (✋), or help with a 311 issue (tap a 311 marker).', 6000); }
  toggleFly() {
    if (!this.canFly) return;
    if (this.active === 'fly') { this.stop(); return; }
    if (!this.usable()) return; if (this.energy <= 0) return this.noEnergy();
    this.stopWeb(); this.active = 'fly'; this.p.glide = false; this.vel.set(0, 0, 4); this.p.gy += 0.5; this.refresh();
    if (!this.toldFly) { this.toldFly = true; this.toast(this.g.mobile ? 'Flying! Stick: where to go (it follows the camera) · ⤴️ up · ⚡ down · 🦸 to land' : 'Flying! W/A/S/D: where to go (follows the camera) · Space up · Shift down · B to stop', 6000); }
  }
  stop() {
    const was = this.active; this.active = null; this.stopWeb(); this.refresh();
    if (was === 'fly' && this.p.gy - this.floor(this.p.x, this.p.y) > 7) { this.p.vy = -2; }      // high up: you drop, and the glider opens
  }
  floor(x, y) { return Math.max(ground(x, y), this.tiles.roofAt(x, y) ?? -1e9); }
  // ---------------------------------------------------------------- the web line
  web() {
    if (!this.canWeb) return;
    if (this.anchor) { this.release(); return; }
    if (!this.usable()) return; if (this.energy <= 0) return this.noEnergy();
    const p = this.p, camH = this.g.camHeading ?? p.h, [fx, fy] = dirOf(camH), rx = fy, ry = -fx;
    // the best rooftop ahead and up (a tall building about 30 m ahead); out in the suburbs, the line still catches (above a house or a tree)
    let best = null;
    for (const d of [18, 26, 34, 44, 56]) for (const s of [0, -8, 8, -16, 16]) {
      const x = p.x + fx * d + rx * s, y = p.y + fy * d + ry * s, r = this.tiles.roofAt(x, y);
      if (r == null || r < p.gy + 6) continue;
      const score = Math.abs(d - 30) * 0.5 + Math.abs(s) * 0.4 - Math.min(40, r - p.gy) * 0.3;
      if (!best || score < best.score) best = { x, y, z: r - 0.5, score };
    }
    // stick to the building's face on your side (not the middle of its roof), no higher than 35 m above you: the swing
    // then runs along the street beside it
    if (best) {
      let ex = best.x, ey = best.y; const dx = p.x - best.x, dy = p.y - best.y, dl = Math.hypot(dx, dy) || 1;
      for (let k = 1; k < 60; k++) { const x = best.x + dx / dl * k, y = best.y + dy / dl * k, r = this.tiles.roofAt(x, y); if (r == null || r < p.gy + 4) { ex = x; ey = y; break; } }
      best = { x: ex, y: ey, z: Math.min(best.z, p.gy + 35) };
    }
    if (!best) best = { x: p.x + fx * 26, y: p.y + fy * 26, z: Math.max(p.gy + 20, this.floor(p.x + fx * 26, p.y + fy * 26) + 18) };
    this.anchor = new THREE.Vector3(best.x, best.y, best.z);
    if (this.active !== 'web') { this.active = 'web'; this.vel.set(fx * Math.max(4, p.v || 0), fy * Math.max(4, p.v || 0), 3); this.p.glide = false; }
    if (!this.swinging) { this.swinging = true; this.vel.x += fx * 12; this.vel.y += fy * 12; this.vel.z = Math.max(this.vel.z, 9); }      // the first line yanks you up and away
    const dx = p.x - best.x, dy = p.y - best.y, dz = p.gy + 1.6 - best.z; this.L = Math.max(6, Math.hypot(dx, dy, dz) * 0.92);
    this.dot.position.set(best.x, best.z, -best.y); this.dot.visible = true; this.line.visible = true; this.refresh();
    if (this.sfx) this.sfx.blip();
    if (!this.toldWeb) { this.toldWeb = true; this.toast('Swing! Push forward to pump, tap 🕸️ (X) to let go and again to catch the next roof.', 6000); }
  }
  release() { this.anchor = null; this.line.visible = false; this.dot.visible = false; }
  stopWeb() { this.release(); this.swinging = false; if (this.active === 'web') this.active = null; }
  // ---------------------------------------------------------------- each frame (on foot); true when a power moved you
  update(dt, inp, camH) {
    if (this.active && this.p.mode !== 'foot') this.stop();
    if (!this.active) { if (this.refreshT == null || (this.refreshT -= dt) < 0) { this.refreshT = 1; this.refresh(); } return false; }
    this.energy -= dt; if ((this.refreshT -= dt) < 0) { this.refreshT = 0.5; this.refresh(); }
    if (this.energy <= 0) { this.energy = 0; this.save(); this.toast('Your power ran out. Good deeds charge it again ✨', 5000); this.stop(); return false; }
    if ((this.saveT = (this.saveT || 0) - dt) < 0) { this.saveT = 5; this.save(); }
    return this.active === 'fly' ? this.fly(dt, inp, camH) : this.swing(dt, inp, camH);
  }
  fly(dt, inp, camH) {
    const p = this.p, [fx, fy] = dirOf(camH), rx = fy, ry = -fx;
    let mx = fx * (inp.y || 0) + rx * (inp.x || 0), my = fy * (inp.y || 0) + ry * (inp.x || 0); const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    // speed builds up the longer you fly forward (cruise 20 m/s, up to 60)
    this.boost = l > 0.3 ? Math.min(1, (this.boost || 0) + dt * 0.35) : Math.max(0, (this.boost || 0) - dt);
    const sp = 20 + 40 * this.boost * this.boost, up = (inp.up ? 1 : 0) - (inp.sprint ? 1 : 0);
    const k = Math.min(1, dt * 3);
    this.vel.x += (mx * sp - this.vel.x) * k; this.vel.y += (my * sp - this.vel.y) * k; this.vel.z += (up * 14 + (l < 0.1 && !up ? Math.sin(performance.now() / 600) * 0.4 : 0) - this.vel.z) * k;
    let nx = p.x + this.vel.x * dt, ny = p.y + this.vel.y * dt, nz = p.gy + this.vel.z * dt;
    // buildings: fly up and over, don't pass through
    ({ nx, ny } = this.slide(p, nx, ny, nz, 0.2));
    const fl = this.floor(nx, ny);
    if (nz < fl) { nz = fl; if (this.vel.z < 0) this.vel.z = 0; }
    p.x = nx; p.y = ny; p.gy = Math.min(1200, nz); p.v = Math.hypot(this.vel.x, this.vel.y);
    if (p.v > 0.5) p.h = Math.atan2(this.vel.x, this.vel.y);
    // touching down: land (back on your feet)
    if (nz <= fl + 0.05 && up < 0) { this.stop(); return false; }
    p.char.animate(dt, p.v > 3 ? { glide: 1 } : {});
    this.tilt = p.v > 3 ? Math.min(1.25, p.v / 30 + 0.5) : 0;
    return true;
  }
  swing(dt, inp, camH) {
    const p = this.p, [fx, fy] = dirOf(camH), v = this.vel;
    v.z -= 18 * dt;
    v.x += fx * (inp.y || 0) * 12 * dt; v.y += fy * (inp.y || 0) * 12 * dt;                     // pump forward
    const [rx, ry] = [fy, -fx]; v.x += rx * (inp.x || 0) * 6 * dt; v.y += ry * (inp.x || 0) * 6 * dt;      // and steer
    v.multiplyScalar(Math.pow(0.97, dt));
    let nx = p.x + v.x * dt, ny = p.y + v.y * dt, nz = p.gy + v.z * dt;
    if (this.anchor) {          // the line holds you to its length
      if (inp.up) this.L = Math.max(5, this.L - 8 * dt);          // reel in
      const A = this.anchor, dx = nx - A.x, dy = ny - A.y, dz = nz + 1.6 - A.z, d = Math.hypot(dx, dy, dz);
      if (d > this.L) {
        const ux = dx / d, uy = dy / d, uz = dz / d; nx = A.x + ux * this.L; ny = A.y + uy * this.L; nz = A.z + uz * this.L - 1.6;
        const vr = v.x * ux + v.y * uy + v.z * uz; if (vr > 0) { v.x -= ux * vr; v.y -= uy * vr; v.z -= uz * vr; }
      }
      // the line runs from your hand to the roof
      const a = this.line.geometry.attributes.position.array; a[0] = nx; a[1] = nz + 1.7; a[2] = -ny; a[3] = A.x; a[4] = A.z; a[5] = -A.y; this.line.geometry.attributes.position.needsUpdate = true;
    }
    ({ nx, ny } = this.slide(p, nx, ny, nz, 0.3));
    const fl = this.floor(nx, ny);
    if (nz <= fl) {
      nz = fl;
      if (!this.anchor || v.z < -2) { p.x = nx; p.y = ny; p.gy = fl; this.stopWeb(); this.refresh(); p.v = 0; return false; }      // landed
      v.z = Math.max(0, v.z);
    }
    p.x = nx; p.y = ny; p.gy = nz; p.v = Math.hypot(v.x, v.y);
    if (p.v > 0.5) p.h = Math.atan2(v.x, v.y);
    p.char.animate(dt, { glide: 1 });
    this.tilt = Math.max(-0.4, Math.min(0.6, -v.z * 0.03 + p.v * 0.015));
    return true;
  }
  // a wall in the way (a roof above you there): slide along it, or stop
  slide(p, nx, ny, nz, bounce) {
    const blocked = (x, y) => { const r = this.tiles.roofAt(x, y); return r != null && r > nz + 0.3 && r - p.gy > 1; };
    if (!blocked(nx, ny)) return { nx, ny };
    if (!blocked(nx, p.y)) { this.vel.y *= -bounce; return { nx, ny: p.y }; }
    if (!blocked(p.x, ny)) { this.vel.x *= -bounce; return { nx: p.x, ny }; }
    this.vel.x *= -bounce; this.vel.y *= -bounce; return { nx: p.x, ny: p.y };
  }
  // after the player is placed: lean into the flight
  pose() {
    if (!this.active) return; const o = this.p.person; o.rotation.order = 'YXZ'; o.rotation.x = this.tilt || 0;
    if (this.active === 'fly') o.position.y += 0.6;
  }
}
