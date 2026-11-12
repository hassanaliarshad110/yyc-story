// Hero flight, earned by being kind. Every good deed (checking in on someone sleeping outside, pitching in on a 311
// issue) charges 3 minutes of flight (up to 15); the first one unlocks it. Flight drains only while you fly.
// Tap 🦸 (B): you lift off to rooftop height and hold it; the stick steers (where the camera looks), speed builds to
// 250 km/h; ⤴️ (Space) climbs, ⚡ (Shift) descends, and coming down to the ground lands you.
import * as THREE from 'three';
import { dirOf } from './player.js?v=11112205';
import { ground } from './terrain.js?v=11112205';

const KEY = 'yyc-powers', PER_DEED = 180, MAX = 900, TOP = 69.4;      // 250 km/h
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };

export class Powers {
  constructor(game, scene, player, tiles, ui = {}) {
    this.g = game; this.p = player; this.tiles = tiles; this.toast = ui.toast || (() => {}); this.sfx = ui.sfx;
    const s = load(); this.deeds = s.deeds || 0; this.energy = s.energy ?? 0; this.helped = new Set(s.helped || []);
    this.active = null; this.vel = new THREE.Vector3(); this.alt = 0; this.boost = 0;
    this.ui();
    player.powerUpdate = (dt, inp, camH) => this.update(dt, inp, camH);
    player.powerPose = () => this.pose();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ deeds: this.deeds, energy: Math.round(this.energy), helped: [...this.helped].slice(-300) })); } catch (e) {} }
  get canFly() { return this.deeds >= 1; }
  get flying() { return this.active === 'fly'; }
  // ---------------------------------------------------------------- good deeds (key: once per person / issue)
  deed(what, key) {
    if (key && this.helped.has(key)) { this.toast('You already helped here 💛'); return false; }
    if (key) this.helped.add(key);
    const first = this.deeds === 0; this.deeds++;
    this.energy = Math.min(MAX, this.energy + PER_DEED); this.save(); this.refresh();
    if (this.sfx && this.sfx.chime) this.sfx.chime();
    if (first) this.toast(`✨ Good deed: ${what}. You've earned FLIGHT! Tap 🦸 (or B) to fly. Each good deed charges 3 more minutes.`, 7000);
    else this.toast(`✨ Good deed: ${what}. Flight +3 min (${this.fmt()} charged)`, 4000);
    return true;
  }
  fmt() { const s = Math.max(0, Math.round(this.energy)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  // ---------------------------------------------------------------- the 🦸 button (left, with the game buttons)
  ui() {
    const b = document.createElement('button'); b.id = 'pw-fly'; b.className = 'pw-btn'; b.title = 'Fly (B)'; b.innerHTML = '🦸<small></small>'; b.hidden = true; b.onclick = () => this.toggle(); this.bFly = b;
    const put = () => { const bar = document.getElementById('gamebar'); if (bar) bar.prepend(b); else setTimeout(put, 500); }; put();
    addEventListener('keydown', e => { if (!e.repeat && this.g.started && e.target.tagName !== 'INPUT' && e.code === 'KeyB') this.toggle(); });
    this.refresh();
  }
  refresh() { this.bFly.hidden = !this.canFly; this.bFly.classList.toggle('on', this.flying); this.bFly.querySelector('small').textContent = this.fmt(); }
  toggle() {
    if (!this.canFly) return;
    if (this.flying) { this.stop(); return; }
    const p = this.p; if (!this.g.started || this.g.paused || p.mode !== 'foot' || p.seat || this.g.deadT > 0) return;
    if (this.energy <= 0) { this.toast('Out of flight. Do a good deed to charge it: tap a 311 marker and pitch in, or check in on someone outside (✋).', 6000); return; }
    this.active = 'fly'; p.glide = false; p.air = 0; p.vy = 0; this.boost = 0; this.vel.set(0, 0, 0);
    this.alt = Math.max(p.gy, this.floor(p.x, p.y)) + 30;            // lift off to rooftop height
    const sp = document.getElementById('speed'); if (sp) sp.hidden = false;
    this.refresh();
    this.toast(this.g.mobile ? '🦸 Flying! Stick: where to go (follows the camera) · ⤴️ climb · ⚡ descend (land on the ground) · 🦸 stop' : '🦸 Flying! W A S D: where to go (follows the camera) · Space climb · Shift descend (land on the ground) · B stop', 6000);
  }
  stop() {
    if (!this.flying) return; this.active = null; this.refresh(); this.save();
    const p = this.p; p.v = 0; const sp = document.getElementById('speed'); if (sp) sp.hidden = true;
    if (p.gy - this.floor(p.x, p.y) > 7) p.vy = -2;      // stopped high up: you drop, and the glider opens
  }
  floor(x, y) { return Math.max(ground(x, y), this.tiles.roofAt(x, y) ?? -1e9); }
  // ---------------------------------------------------------------- each frame (on foot); true while flying
  update(dt, inp, camH) {
    if (!this.flying) { if ((this.refreshT = (this.refreshT ?? 0) - dt) < 0) { this.refreshT = 1; this.refresh(); } return false; }
    if (this.p.mode !== 'foot') { this.stop(); return false; }
    this.energy -= dt; if ((this.refreshT -= dt) < 0) { this.refreshT = 0.5; this.refresh(); }
    if (this.energy <= 0) { this.energy = 0; this.toast('Your flight ran out. Good deeds charge it again ✨', 5000); this.stop(); return false; }
    const p = this.p, [fx, fy] = dirOf(camH), rx = fy, ry = -fx;
    let mx = fx * (inp.y || 0) + rx * (inp.x || 0), my = fy * (inp.y || 0) + ry * (inp.x || 0); const l = Math.min(1, Math.hypot(mx, my));
    // speed builds while you fly forward: 0 to 250 km/h in about 3 s
    this.boost = l > 0.2 ? Math.min(1, this.boost + dt * 0.4) : Math.max(0, this.boost - dt * 1.5);
    const sp = (12 + (TOP - 12) * this.boost) * l, k = Math.min(1, dt * 2.5), ml = Math.hypot(mx, my) || 1;
    this.vel.x += (mx / ml * sp - this.vel.x) * k; this.vel.y += (my / ml * sp - this.vel.y) * k;
    // altitude is held where you are; ⤴️ climbs, ⚡ descends (the run toggle and a full stick don't count here)
    const up = inp.up ? 1 : 0, down = inp.shift || inp.sprintBtn ? 1 : 0;
    this.alt += (up - down) * 18 * dt;
    let nx = p.x + this.vel.x * dt, ny = p.y + this.vel.y * dt;
    ({ nx, ny } = this.slide(p, nx, ny, p.gy));
    const fl = this.floor(nx, ny);
    if (this.alt < fl + 2.5 && !down) this.alt = fl + 2.5;             // skim over roofs and hills rather than into them
    let nz = p.gy + Math.max(-25 * dt, Math.min(30 * dt, (this.alt - p.gy) * Math.min(1, dt * 3)));
    if (nz < fl) nz = fl;
    p.x = nx; p.y = ny; p.gy = Math.min(1500, nz); p.v = Math.hypot(this.vel.x, this.vel.y);
    if (p.v > 0.5) p.h = Math.atan2(this.vel.x, this.vel.y);
    if (down && nz <= fl + 0.3) { this.stop(); return false; }         // touched down: land
    p.char.animate(dt, p.v > 4 ? { glide: 1 } : {});
    this.tilt = p.v > 4 ? Math.min(1.35, 0.45 + p.v / 50) : 0.08 * Math.sin(performance.now() / 500);
    this.bob = p.v > 4 ? 0 : 0.15 * Math.sin(performance.now() / 400);
    return true;
  }
  // a building in the way: slide along it, or stop (and climb over it)
  slide(p, nx, ny, nz) {
    const blocked = (x, y) => { const r = this.tiles.roofAt(x, y); return r != null && r > nz + 0.3; };
    if (!blocked(nx, ny)) return { nx, ny };
    const r = this.tiles.roofAt(nx, ny); if (r != null) this.alt = Math.max(this.alt, r + 4);      // hop up and over
    if (!blocked(nx, p.y)) { this.vel.y *= 0.2; return { nx, ny: p.y }; }
    if (!blocked(p.x, ny)) { this.vel.x *= 0.2; return { nx: p.x, ny }; }
    this.vel.x *= 0.2; this.vel.y *= 0.2; return { nx: p.x, ny: p.y };
  }
  // after the player is placed: lean into the flight
  pose() { if (!this.flying) return; const o = this.p.person; o.rotation.order = 'YXZ'; o.rotation.x = this.tilt || 0; o.position.y += 0.5 + (this.bob || 0); }
}
