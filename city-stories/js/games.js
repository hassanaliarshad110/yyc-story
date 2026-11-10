// Free-roam games with other online players: water-gun fights and egg throwing (a point for every hit,
// a hit costs health and at zero you respawn nearby), and street races from checkpoint to checkpoint.
import * as THREE from 'three';
import { toast } from './hud.js';
import { hurt } from './health.js';
import { makeMarker } from './actors.js';
import { ground } from './terrain.js';

const WEAPONS = [{ id: 0, icon: '🙌', name: 'Hands' }, { id: 1, icon: '🔫', name: 'Water gun' }, { id: 2, icon: '🥚', name: 'Eggs' }];
const W = { 1: { speed: 24, up: 0.06, g: 4, life: 0.85, dmg: 6, every: 0.07, r: 0.09, col: 0x5ab4ff }, 2: { speed: 17, up: 0.22, g: 9.8, life: 2.2, dmg: 20, every: 0.5, r: 0.07, col: 0xfaf6ea } };

export class Games {
  constructor(game, scene) {
    this.g = game; this.scene = scene; this.w = 0; this.held = false; this.cool = 0; this.shots = []; this.splats = [];
    game.score = 0; game.race = null;
    this.geo = { 1: new THREE.SphereGeometry(1, 6, 4), 2: new THREE.SphereGeometry(1, 8, 6) };
    this.mat = { 1: new THREE.MeshBasicMaterial({ color: W[1].col, transparent: true, opacity: 0.75 }), 2: new THREE.MeshLambertMaterial({ color: W[2].col }), yolk: new THREE.MeshBasicMaterial({ color: 0xffc928 }), wet: new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.6 }) };
    this.ui();
    if (game.mp) game.mp.onGame = (id, name, d) => this.onNet(id, name, d);
  }
  ui() {
    const bar = document.createElement('div'); bar.id = 'gamebar'; bar.innerHTML = `
      <div id="g-score">⭐ 0</div>
      <button id="g-weapon" title="Switch: hands, water gun, eggs (Q)">🙌</button>
      <button id="g-fire" title="Shoot / throw (F)" hidden>💥</button>
      <button id="g-race" title="Start or join a street race (R)">🏁</button>
      <div id="g-board"></div>`;
    document.body.appendChild(bar); const $ = s => bar.querySelector(s); this.$ = $;
    $('#g-weapon').onclick = () => this.cycle();
    const fire = $('#g-fire'), down = e => { e.preventDefault(); this.held = true; }, up = () => { this.held = false; };
    fire.addEventListener('pointerdown', down); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) fire.addEventListener(ev, up);
    $('#g-race').onclick = () => this.raceButton();
    addEventListener('keydown', e => {
      if (!this.g.started || e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyQ') this.cycle(); else if (e.code === 'KeyF') this.held = true; else if (e.code === 'KeyR' && !e.repeat) this.raceButton();
    });
    addEventListener('keyup', e => { if (e.code === 'KeyF') this.held = false; });
  }
  show(on) { document.getElementById('gamebar').style.display = on ? '' : 'none'; }
  cycle() { this.w = (this.w + 1) % WEAPONS.length; const W0 = WEAPONS[this.w]; this.$('#g-weapon').textContent = W0.icon; this.$('#g-fire').hidden = this.w === 0; toast(`${W0.icon} ${W0.name}`); this.updateHeld(); }
  updateHeld() {
    const ch = this.g.player && this.g.player.char; if (!ch || !ch.bones) return;
    const hand = ch.bones.RightHand || ch.bones.handR; if (!hand) return;
    if (this.prop) { this.prop.parent && this.prop.parent.remove(this.prop); this.prop = null; }
    if (!this.w) return;
    // a water pistol or an egg in the right hand
    const k = hand.isBone && ch.mixer ? 100 : 1, g = new THREE.Group();
    if (this.w === 1) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), new THREE.MeshLambertMaterial({ color: 0x2a8cff })), t = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), new THREE.MeshLambertMaterial({ color: 0xffa020 })); t.position.set(0, -0.07, -0.06); b.add(t); g.add(b); }
    else { const e = new THREE.Mesh(this.geo[2], this.mat[2]); e.scale.set(0.045, 0.06, 0.045); g.add(e); }
    g.scale.setScalar(k); g.position.set(0, 0.08 * k, 0.02 * k); hand.add(g); this.prop = g;
  }
  setScore(n) { this.g.score = n; this.$('#g-score').textContent = '⭐ ' + n; }
  popup(text, col = '#ffe14a') {
    const d = document.createElement('div'); d.className = 'g-pop'; d.textContent = text; d.style.color = col; document.body.appendChild(d); setTimeout(() => d.remove(), 1100);
  }
  // ---------------------------------------------------------------- shooting
  aim(p) {
    // straight ahead, or at the nearest player in front of you (within 30 m and 30 degrees)
    let fx = Math.sin(p.h), fy = Math.cos(p.h), fz = 0, best = null, bd = 30;
    const mp = this.g.mp;
    if (mp && mp.on) for (const o of mp.others.values()) {
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy); if (d > bd || d < 0.5) continue;
      if ((dx * fx + dy * fy) / d < 0.86) continue; best = o; bd = d;
    }
    if (best) { const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy); fx = dx / d; fy = dy / d; fz = ((best.z ?? p.gy) - p.gy) / Math.max(4, d); }
    return [fx, fy, fz];
  }
  fire() {
    const p = this.g.player, w = W[this.w]; if (!p || p.mode !== 'foot') return;
    const [fx, fy, fz] = this.aim(p);
    const o = { x: p.x + fx * 0.6, y: p.y + fy * 0.6, z: p.gy + 1.35, vx: fx * w.speed, vy: fy * w.speed, vz: (fz + w.up) * w.speed };
    this.spawn(this.w, o, true);
    if (this.g.mp && this.g.mp.on) this.g.mp.game({ k: 'shot', w: this.w, o: [o.x, o.y, o.z, o.vx, o.vy, o.vz].map(v => Math.round(v * 100) / 100) });
    if (this.g.sfx && this.g.sfx.step) this.g.sfx.step(false);
  }
  spawn(w, o, mine) {
    const m = new THREE.Mesh(this.geo[w], this.mat[w]); m.scale.setScalar(W[w].r); if (w === 2) m.scale.set(0.07, 0.09, 0.07);
    this.scene.add(m); this.shots.push({ ...o, w, m, t: 0, mine });
  }
  splat(x, y, z, w) {
    const m = new THREE.Mesh(this.geo[1], w === 2 ? this.mat.yolk : this.mat.wet); m.scale.set(w === 2 ? 0.18 : 0.25, 0.02, w === 2 ? 0.18 : 0.25);
    m.position.set(x, z + 0.02, -y); this.scene.add(m); this.splats.push({ m, t: w === 2 ? 6 : 1.5 });
  }
  // ---------------------------------------------------------------- network
  onNet(id, name, d) {
    if (!d || !d.k) return;
    if (d.k === 'shot' && Array.isArray(d.o)) { const [x, y, z, vx, vy, vz] = d.o; this.spawn(d.w === 2 ? 2 : 1, { x, y, z, vx, vy, vz }, false); }
    else if (d.k === 'hit') {           // someone got you
      const dmg = Math.max(1, Math.min(40, +d.dmg || 5)), o = this.g.mp.others.get(id), p = this.g.player;
      let nx = 0, ny = 0; if (o) { const dx = p.x - o.x, dy = p.y - o.y, l = Math.hypot(dx, dy) || 1; nx = dx / l * 0.3; ny = dy / l * 0.3; }
      hurt(dmg, nx, ny, 'splash'); this.popup(d.w === 2 ? `🥚 ${name}` : `💦 ${name}`, '#8fd0ff');
    }
    else if (d.k === 'race') this.invite(name, d);
    else if (d.k === 'fin' && this.g.race && this.g.race.rid === d.rid) { this.g.race.done.push({ name, t: d.t }); toast(`🏁 ${name} finished: ${(d.t / 1000).toFixed(1)} s`); }
  }
  // ---------------------------------------------------------------- races
  raceButton() {
    const R = this.g.race;
    if (R && R.pending) { this.join(R); return; }
    if (R && R.on) { if (confirmLeave()) this.endRace(false); return; }
    this.createRace();
  }
  createRace() {
    const p = this.g.player, f = this.g.findRoadSpot; if (!f) return;
    const cps = []; let x = p.x, y = p.y, h = p.h;
    for (let i = 0; i < 6; i++) {
      // the next checkpoint a few hundred metres on, preferring the way you're going
      let best = null;
      for (let k = 0; k < 6; k++) {
        const a = h + (Math.random() - 0.5) * 1.6, tx = x + Math.sin(a) * 320, ty = y + Math.cos(a) * 320, s = f(tx, ty, 0, 160);
        if (s && (!best || Math.hypot(s.x - tx, s.y - ty) < best.d)) best = { ...s, d: Math.hypot(s.x - tx, s.y - ty) };
      }
      if (!best) break;
      h = Math.atan2(best.x - x, best.y - y); x = best.x; y = best.y; cps.push([Math.round(x), Math.round(y)]);
    }
    if (cps.length < 3) { toast('No streets for a race here. Try near a main road.'); return; }
    const rid = Math.random().toString(36).slice(2, 8), t0 = Date.now() + 15000, d = { k: 'race', rid, cps, t0 };
    if (this.g.mp && this.g.mp.on) this.g.mp.game(d);
    this.start(this.g.mp && this.g.mp.name || 'You', d, true);
    toast('🏁 Race in 15 s! Get in a car (or run). Players nearby can join with 🏁.');
  }
  invite(name, d) {
    const p = this.g.player; if (this.g.race && this.g.race.on) return;
    if (!d.cps || !d.cps.length || Math.hypot(d.cps[0][0] - p.x, d.cps[0][1] - p.y) > 1200 || d.t0 < Date.now()) return;
    this.g.race = { pending: true, d, host: name };
    toast(`🏁 ${name} started a race nearby — press 🏁 (R) to join!`);
    this.$('#g-race').classList.add('blink');
    setTimeout(() => { if (this.g.race && this.g.race.pending) { this.g.race = null; this.$('#g-race').classList.remove('blink'); } }, Math.max(1000, d.t0 - Date.now()));
  }
  join(R) { this.$('#g-race').classList.remove('blink'); this.start(R.host, R.d, false); toast('🏁 You joined the race. Get to the start line!'); }
  start(host, d, mine) {
    const cps = d.cps.map(([x, y]) => ({ x, y }));
    const R = this.g.race = { on: true, rid: d.rid, t0: d.t0, cps, i: 0, cp: cps[0], done: [], mine, marker: makeMarker(0x2ad06a) };
    this.scene.add(R.marker); this.placeMarker();
    if (this.g.setWaypointRaw) this.g.setWaypointRaw(R.cp);
    this.$('#g-race').classList.add('on');
  }
  placeMarker() { const R = this.g.race; if (!R || !R.cp) return; R.marker.position.set(R.cp.x, ground(R.cp.x, R.cp.y), -R.cp.y); }
  endRace(finished) {
    const R = this.g.race; if (!R) return;
    if (R.marker) this.scene.remove(R.marker);
    this.g.race = null; this.$('#g-race').classList.remove('on'); const cd = document.getElementById('g-count'); if (cd) cd.remove();
    if (this.g.setWaypointRaw) this.g.setWaypointRaw(null);
    if (!finished) toast('Race left.');
  }
  updateRace(dt) {
    const R = this.g.race; if (!R || !R.on) return;
    const p = this.g.player, now = Date.now(), left = R.t0 - now;
    let cd = document.getElementById('g-count');
    if (left > -1200) { if (!cd) { cd = document.createElement('div'); cd.id = 'g-count'; document.body.appendChild(cd); } cd.textContent = left > 0 ? Math.ceil(left / 1000) : 'GO!'; }
    else if (cd) cd.remove();
    if (left > 0) return;
    if (R.marker && R.marker.userData.arrow) R.marker.userData.arrow.rotation.y += dt * 3;
    if (Math.hypot(R.cp.x - p.x, R.cp.y - p.y) < 14) {
      R.i++; if (this.g.sfx && this.g.sfx.coin) this.g.sfx.coin();
      if (R.i >= R.cps.length) {
        const t = now - R.t0, place = R.done.filter(f => f.t < t).length + 1, pts = place === 1 ? 5 : place === 2 ? 3 : place === 3 ? 2 : 1;
        if (this.g.mp && this.g.mp.on) this.g.mp.game({ k: 'fin', rid: R.rid, t });
        this.setScore(this.g.score + pts); this.popup(`+${pts}`);
        toast(`🏁 Finished in ${(t / 1000).toFixed(1)} s — place ${place}! +${pts} points`);
        this.endRace(true); return;
      }
      R.cp = R.cps[R.i]; this.placeMarker(); if (this.g.setWaypointRaw) this.g.setWaypointRaw(R.cp);
      toast(`Checkpoint ${R.i} of ${R.cps.length}`);
    }
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    const p = this.g.player; if (!p) return;
    this.cool -= dt;
    if (this.held && this.w && this.cool <= 0 && p.mode === 'foot' && !this.g.paused) { this.cool = W[this.w].every; this.fire(); }
    if (this.prop && (!this.prop.parent || p.char !== this.propChar)) { this.propChar = p.char; this.updateHeld(); }
    if (!this.prop && this.w && p.char) { this.propChar = p.char; this.updateHeld(); }
    const mp = this.g.mp, others = mp && mp.on ? [...mp.others.values()] : [];
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], w = W[s.w]; s.t += dt;
      s.vz -= w.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.m.position.set(s.x, s.z, -s.y);
      let gone = s.t > w.life;
      const gz = ground(s.x, s.y); if (s.z < gz + 0.03) { gone = true; this.splat(s.x, s.y, gz, s.w); }
      if (!gone && s.mine) for (const o of others) {
        const dz = s.z - (o.z ?? gz); if (dz < 0 || dz > 1.9 || Math.hypot(s.x - o.x, s.y - o.y) > 0.55) continue;
        mp.game({ k: 'hit', dmg: w.dmg, w: s.w }, o.id);
        this.setScore(this.g.score + 1); this.popup('+1'); this.splat(o.x, o.y, o.z ?? gz, s.w); gone = true; break;
      }
      if (gone) { this.scene.remove(s.m); this.shots.splice(i, 1); }
    }
    for (let i = this.splats.length - 1; i >= 0; i--) { const s = this.splats[i]; s.t -= dt; if (s.t <= 0) { this.scene.remove(s.m); this.splats.splice(i, 1); } }
    this.updateRace(dt);
    // the scoreboard: you and everyone online
    if ((this.bt = (this.bt || 0) - dt) <= 0) {
      this.bt = 1; const b = this.$('#g-board');
      if (mp && mp.on && others.length) {
        const rows = [{ n: (mp.name || 'You') + ' (you)', s: this.g.score, me: 1 }, ...others.map(o => ({ n: o.name, s: o.sc || 0 }))].sort((a, b) => b.s - a.s).slice(0, 6);
        b.innerHTML = rows.map(r => `<div${r.me ? ' class="me"' : ''}><span>${r.n.replace(/[<>&]/g, '')}</span><b>${r.s}</b></div>`).join(''); b.hidden = false;
      } else b.hidden = true;
    }
  }
}
function confirmLeave() { return true; }
