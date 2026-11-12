// Free-roam games with other online players (and the rival crew, who play even when you're alone): splat fights with
// six playful weapons (water gun, eggs, water balloons, snowballs, foam blaster, paintball). Every hit is one shot of
// ten: ten shots and you're out for 5 seconds. A point (⭐) for each splat; the first to 10 wins the round and everyone
// starts again. Team up in crews (red or blue: no friendly fire), ride along in a friend's car or helicopter, and race
// from checkpoint to checkpoint.
import * as THREE from 'three';
import { toast } from './hud.js?v=11112231';
import { hurt } from './health.js?v=11112231';
import { makeMarker } from './actors.js?v=11112231';
import { ground } from './terrain.js?v=11112231';
import { Challenges } from './challenges.js?v=11112231';
import { RivalCrew, setWeapons } from './crew.js?v=11112231';

const UPV = new THREE.Vector3(0, 1, 0), _dv = new THREE.Vector3();
export const DMG = 10, WIN = 10;
const WEAPONS = [{ id: 0, icon: '🙌', name: 'Hands' }, { id: 1, icon: '🔫', name: 'Water gun' }, { id: 2, icon: '🥚', name: 'Eggs' }, { id: 3, icon: '🎈', name: 'Water balloons' }, { id: 4, icon: '❄️', name: 'Snowballs' }, { id: 5, icon: '🎯', name: 'Foam blaster' }, { id: 6, icon: '🟣', name: 'Paintball' }];
// speed m/s, lift, gravity, life s, time between shots, size, colour; throw: thrown from the hand; streak: drawn long along its path
export const W = {
  1: { speed: 19, up: 0.1, g: 9.8, life: 1.1, every: 0.03, r: 0.05, col: 0x6cc4ff, streak: 5.5 },
  2: { speed: 17, up: 0.22, g: 9.8, life: 2.2, every: 0.6, r: 0.04, col: 0xfaf6ea, throw: true },
  3: { speed: 14, up: 0.36, g: 9.8, life: 2.6, every: 0.9, r: 0.16, col: 0x4fb3ff, throw: true, splash: 2.6 },
  4: { speed: 24, up: 0.09, g: 6, life: 1.6, every: 0.45, r: 0.09, col: 0xffffff, throw: true },
  5: { speed: 32, up: 0.03, g: 2, life: 1.2, every: 0.16, r: 0.025, col: 0xff7a1a, streak: 4 },
  6: { speed: 36, up: 0.02, g: 3, life: 1.1, every: 0.3, r: 0.045, col: 0xd02ae0 },
};
setWeapons(W);
const PAINT = [0xd02ae0, 0x2ad0a0, 0xffd21a, 0xff3a5a, 0x3a8cff];

export class Games {
  constructor(game, scene) {
    this.g = game; this.scene = scene; this.w = 0; this.held = false; this.cool = 0; this.shots = []; this.splats = []; this.team = ''; this.round = 1; this.lastHit = new Map();
    game.score = 0; game.race = null;
    this.geo = new THREE.SphereGeometry(1, 8, 6);
    this.mat = {}; for (const k in W) this.mat[k] = k == 1 ? new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.8, depthWrite: false }) : new THREE.MeshLambertMaterial({ color: W[k].col, emissive: k == 5 || k == 6 ? W[k].col : 0, emissiveIntensity: 0.3 });
    this.mat.yolk = new THREE.MeshBasicMaterial({ color: 0xffc928 }); this.mat.wet = new THREE.MeshBasicMaterial({ color: 0x5a7f9a, transparent: true, opacity: 0.28, depthWrite: false });
    this.mat.snow = new THREE.MeshBasicMaterial({ color: 0xf4f8ff }); this.paint = PAINT.map(c => new THREE.MeshBasicMaterial({ color: c }));
    this.fight = true; this.ui(); this.ch = new Challenges(game, scene, this); this.crew = new RivalCrew(game, scene, this);
    if (game.mp) game.mp.onGame = (id, name, d) => this.onNet(id, name, d);
    game.onDeath = (why, by) => this.died(why, by);
    game.ridePass = p => this.ridePass(p);
  }
  ui() {
    const bar = document.createElement('div'); bar.id = 'gamebar'; bar.innerHTML = `
      <div id="g-score">⭐ 0</div>
      <button id="g-weapon" title="Switch weapon (Q)">🙌</button>
      <button id="g-fire" title="Shoot / throw (F)" hidden>💥</button>
      <button id="g-more" title="More">⋯</button>
      <button id="g-team" title="Join a crew: red or blue, until the round ends (no friendly fire)">👥</button>
      <button id="g-ride" title="Get out (F)" hidden>🚪</button>
      <button id="g-race" class="g-x" title="Start or join a street race (R)">🏁</button>
      <div id="g-board"></div>`;
    document.body.appendChild(bar); const $ = s => bar.querySelector(s); this.$ = $;
    $('#g-weapon').onclick = () => this.cycle();
    const fire = $('#g-fire'), down = e => { e.preventDefault(); this.held = true; }, up = () => { this.held = false; };
    fire.addEventListener('pointerdown', down); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) fire.addEventListener(ev, up);
    $('#g-race').onclick = () => this.raceButton();
    $('#g-team').onclick = () => this.cycleTeam();
    $('#g-more').onclick = () => bar.classList.toggle('more');
    $('#g-ride').onclick = () => this.leaveRide();
    addEventListener('keydown', e => {
      if (!this.g.started || e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyQ') this.cycle(); else if (e.code === 'KeyF') this.held = true; else if (e.code === 'KeyR' && !e.repeat) this.raceButton(); else if (e.code === 'KeyK' && !e.repeat) this.crew.toggle();
    });
    addEventListener('keyup', e => { if (e.code === 'KeyF') this.held = false; });
  }
  show(on) { document.getElementById('gamebar').style.display = on ? '' : 'none'; }
  // free roam is peaceful (meet up, ride together, race); 🌐 Play online is the fight: crews, weapons and rounds
  setFight(on) {
    this.fight = !!on; const bar = document.getElementById('gamebar'); bar.classList.toggle('peace', !on);
    if (!on) { this.w = 0; this.held = false; this.$('#g-weapon').textContent = WEAPONS[0].icon; this.$('#g-fire').hidden = true; this.team = ''; this.updateHeld(); }
  }
  cycle() { if (!this.fight) return; this.w = (this.w + 1) % WEAPONS.length; const W0 = WEAPONS[this.w]; this.$('#g-weapon').textContent = W0.icon; this.$('#g-fire').hidden = this.w === 0; toast(`${W0.icon} ${W0.name}`); this.updateHeld(); }
  updateHeld() {
    const ch = this.g.player && this.g.player.char; if (!ch || !ch.bones) return;
    const hand = ch.bones.RightHand || ch.bones.handR; if (!hand) return;
    if (this.prop) { this.prop.parent && this.prop.parent.remove(this.prop); this.prop = null; }
    if (!this.w) return;
    // a water pistol or an egg in the right hand
    const k = hand.isBone && ch.mixer ? 100 : 1, g = new THREE.Group();
    const wd = W[this.w];
    if (!wd.throw) {        // a toy blaster in the team's colour (or blue/orange/purple)
      const col = this.w === 1 ? 0x2a8cff : this.w === 5 ? 0xff8a1a : 0x7a2ad0, b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, this.w === 1 ? 0.2 : 0.26), new THREE.MeshLambertMaterial({ color: col })), t = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), new THREE.MeshLambertMaterial({ color: this.w === 1 ? 0xffa020 : 0x222222 }));
      t.position.set(0, -0.07, -0.06); b.add(t); g.add(b);
    } else { const e = new THREE.Mesh(this.geo, this.mat[this.w]); if (this.w === 2) e.scale.set(0.045, 0.06, 0.045); else e.scale.setScalar(this.w === 3 ? 0.11 : 0.07); g.add(e); }
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
    const p = this.g.player, w = W[this.w], wi = this.w; if (!p || p.mode !== 'foot' || this.g.deadT > 0) return;
    const ch = p.char;
    if (w.throw && ch) ch.pose = { throw: 0 };
    const go = () => {
      const [fx, fy, fz] = this.aim(p), spread = wi === 1 ? 0.4 : wi === 5 ? 0.25 : 0.1, sp = w.speed * (wi === 1 ? 0.95 + Math.random() * 0.1 : 1);
      // from the blaster's muzzle / the throwing hand, a little to the right of the body
      const rx = fy, ry = -fx, fwd = w.throw ? 0.4 : 0.75, o = { x: p.x + fx * fwd + rx * 0.18, y: p.y + fy * fwd + ry * 0.18, z: p.gy + (w.throw ? 1.7 : 1.3), vx: fx * sp + (Math.random() - 0.5) * spread, vy: fy * sp + (Math.random() - 0.5) * spread, vz: (fz + w.up) * sp };
      if (wi === 6) o.c = this.team === 'r' ? 3 : this.team === 'b' ? 4 : Math.random() * PAINT.length | 0;
      this.spawn(wi, o, true);
      const mp = this.g.mp;
      if (mp && mp.on && (wi !== 1 || (this.netT = (this.netT || 0) - 1) <= 0)) { if (wi === 1) this.netT = 3; mp.game({ k: 'shot', w: wi, c: o.c, o: [o.x, o.y, o.z, o.vx, o.vy, o.vz].map(v => Math.round(v * 100) / 100) }); }
      if (this.g.sfx && this.g.sfx.pop && wi !== 1) this.g.sfx.pop();
    };
    if (w.throw) setTimeout(go, 280); else go();
  }
  // a projectile: mine (it can hit other players and rivals), theirs, or a rival's (it can hit me)
  spawn(w, o, mine, from = null) {
    const W0 = W[w] || W[1], m = new THREE.Mesh(this.geo, w === 6 && o.c != null ? this.paint[o.c % PAINT.length] : this.mat[w] || this.mat[1]);
    m.scale.setScalar(W0.r); if (w === 2) m.scale.set(0.035, 0.045, 0.035);
    this.scene.add(m); this.shots.push({ ...o, w, m, t: 0, mine, from });
    if (!mine && !from && w === 1) for (let k = 1; k <= 2; k++) {      // the other player's stream: fill in between the messages
      const d = { ...o, vx: o.vx + (Math.random() - 0.5) * 0.5, vy: o.vy + (Math.random() - 0.5) * 0.5, vz: o.vz + (Math.random() - 0.5) * 0.3 };
      setTimeout(() => { const m2 = new THREE.Mesh(this.geo, this.mat[1]); m2.scale.setScalar(W[1].r); this.scene.add(m2); this.shots.push({ ...d, w: 1, m: m2, t: 0, mine: false }); }, k * 30);
    }
  }
  splat(x, y, z, w, c) {
    if (w === 1 && this.splats.length > 60) return;
    const mat = w === 2 ? this.mat.yolk : w === 4 ? this.mat.snow : w === 6 ? this.paint[(c || 0) % PAINT.length] : w === 5 ? this.mat[5] : this.mat.wet;
    const m = new THREE.Mesh(this.geo, mat); const r = w === 2 ? 0.14 : w === 3 ? 0.9 : w === 6 ? 0.18 : w === 5 ? 0.05 : 0.08 + Math.random() * 0.1; m.scale.set(r, 0.01, r);
    m.position.set(x, z + 0.02, -y); this.scene.add(m); this.splats.push({ m, t: w === 2 || w === 6 ? 8 : w === 3 ? 3 : 1.5 });
  }
  // ---------------------------------------------------------------- teams, kills and rounds
  get myId() { return this.g.mp && this.g.mp.on ? this.g.mp.id : 'me'; }
  friend(o) { return o.tm === 'p' || !this.fight || (this.team && o.tm === this.team); }      // 'p': a player in peaceful free roam
  cycleTeam() { if (!this.fight) return;
    if (this.team && this.teamRound === this.round) { toast(`You're in the ${this.team === 'r' ? '🔴 Red' : '🔵 Blue'} crew until round ${this.round} ends.`); return; }
    this.team = this.team === 'r' ? 'b' : this.team === 'b' ? '' : 'r'; this.teamRound = this.team ? this.round : 0;
    const b = this.$('#g-team'); b.textContent = this.team === 'r' ? '🔴' : this.team === 'b' ? '🔵' : '👥';
    toast(this.team ? `${this.team === 'r' ? '🔴 Red' : '🔵 Blue'} crew until this round ends: your crew-mates won't splat you, and you can't splat them.` : '👥 Playing solo.');
    this.updateHeld();
  }
  // I hit someone (a player id, or a rival); water only counts as a shot every 0.3 s per target
  hitOther(id, w, x, y, z) {
    const now = performance.now(); if (w === 1 && now - (this.lastHit.get(id) || 0) < 300) return false; this.lastHit.set(id, now);
    const mp = this.g.mp;
    if (typeof id === 'object') this.crew.hit(id, DMG);       // a rival
    else if (mp && mp.on) { mp.game({ k: 'hit', dmg: DMG, w }, id); this.ch.hitPlayer(id); }
    this.splat(x, y, z, w); return true;
  }
  // I was splatted (or knocked out): tell everyone who got me
  died(why, by) {
    const mp = this.g.mp;
    if (by && by.startsWith && by.startsWith('crew')) this.crew.scored(by);
    else if (by && mp && mp.on) mp.game({ k: 'dead', by });
  }
  kill(name) {
    this.setScore(this.g.score + 1); this.popup(`💥 +1 ${name || ''}`);
    if (this.g.sfx && this.g.sfx.coin) this.g.sfx.coin();
    if (this.g.score >= WIN) this.winRound(this.g.mp && this.g.mp.on ? this.g.mp.name : 'You');
  }
  winRound(name, remote) {
    const mp = this.g.mp;
    if (!remote && mp && mp.on) mp.game({ k: 'round', n: this.round });
    toast(`🏆 ${remote ? name : 'You'} won round ${this.round}! New round — first to ${WIN} splats wins.`, 6000);
    this.round++; this.setScore(0); this.crew.reset();
  }
  // ---------------------------------------------------------------- riding with a friend
  ridePass(p) {
    if (this.ride) { this.leaveRide(); return true; }
    const mp = this.g.mp; if (!mp || !mp.on || p.mode !== 'foot') return false;
    for (const o of mp.others.values()) {
      if (!o.car || (o.mode !== 'car' && o.mode !== 'heli') || o.ride) continue;
      const reach = o.mode === 'heli' ? 7 : 4.5, low = o.mode !== 'heli' || (o.z - ground(o.x, o.y)) < 3;
      if (Math.hypot(o.x - p.x, o.y - p.y) > reach || !low) continue;
      this.ride = { id: o.id, name: o.name, v: { x: o.x, y: o.y, h: o.h, gy: o.z } };
      p.mode = 'ride'; this.g.rideVehicle = this.ride.v; p.sync && p.sync(); if (p.char) p.char.g.visible = false;
      mp.game({ k: 'ride', on: 1 }, o.id); this.$('#g-ride').hidden = false;
      toast(`🚗 You're riding with ${o.name}. They drive — tap 🚪 (F) to get out.`); return true;
    }
    return false;
  }
  leaveRide() {
    const R = this.ride; if (!R) return; this.ride = null; this.$('#g-ride').hidden = true;
    const p = this.g.player, mp = this.g.mp, o = mp && mp.others.get(R.id), h = o ? o.h : R.v.h;
    // out on the passenger side (the right)
    let x = R.v.x + Math.cos(h) * 2.4, y = R.v.y - Math.sin(h) * 2.4;
    if (this.g.tiles && this.g.tiles.safeSpot) { const s = this.g.tiles.safeSpot(x, y, { maxR: 30 }); x = s.x; y = s.y; }
    p.mode = 'foot'; this.g.rideVehicle = null; p.place(x, y, h); if (p.char) p.char.g.visible = true;
    if (mp && mp.on) mp.game({ k: 'ride', on: 0 }, R.id);
  }
  updateRide() {
    const R = this.ride; if (!R) return;
    const mp = this.g.mp, o = mp && mp.on && mp.others.get(R.id);
    if (!o || (o.mode !== 'car' && o.mode !== 'heli')) { this.leaveRide(); toast(o ? `${R.name} got out.` : 'Your driver left.'); return; }
    R.v.x = o.x; R.v.y = o.y; R.v.h = o.h; R.v.gy = o.mode === 'heli' ? o.z : (o.z ?? ground(o.x, o.y));
    const p = this.g.player; p.x = o.x; p.y = o.y; p.h = o.h; p.gy = R.v.gy;
  }
  // ---------------------------------------------------------------- network
  onNet(id, name, d) {
    if (!d || !d.k) return;
    if (d.k.startsWith('ch')) { this.ch.onNet(id, name, d); return; }
    if (d.k === 'shot' && Array.isArray(d.o)) {
      const [x, y, z, vx, vy, vz] = d.o, o = this.g.mp.others.get(id), w = W[d.w] ? d.w : 1;
      if (o && o.ch) { if (W[w].throw) o.ch.pose = { throw: 0.25 }; else { o.ch.pose = { aim: 1 }; clearTimeout(o.aimT); o.aimT = setTimeout(() => { if (o.ch.pose && o.ch.pose.aim) o.ch.pose = null; }, 400); } }
      this.spawn(w, { x, y, z, vx, vy, vz, c: d.c }, false);
    }
    else if (d.k === 'hit') {           // someone got you
      if (!this.fight) return;
      const o = this.g.mp.others.get(id), p = this.g.player;
      if (o && this.friend(o)) return;          // a crew-mate (their game may not know yet)
      const car = d.w === 'car', dmg = Math.max(1, Math.min(car ? 40 : 20, +d.dmg || DMG));
      let nx = 0, ny = 0; if (o) { const dx = p.x - o.x, dy = p.y - o.y, l = Math.hypot(dx, dy) || 1; nx = dx / l * 0.3; ny = dy / l * 0.3; }
      if (car) { nx *= 6; ny *= 6; }
      hurt(dmg, nx, ny, car ? 'car' : 'splash', id);
    }
    else if (d.k === 'dead') { if (d.by === this.myId) this.kill(name); else toast(`💥 ${name} was splatted`, 1800); }
    else if (d.k === 'round') this.winRound(name, true);
    else if (d.k === 'ride') toast(d.on ? `🚗 ${name} hopped in — you drive!` : `${name} got out.`);
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
        const t = now - R.t0, place = R.done.filter(f => f.t < t).length + 1;
        if (this.g.mp && this.g.mp.on) this.g.mp.game({ k: 'fin', rid: R.rid, t });
        this.popup(`🏁 ${place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : place + 'th'}`);
        toast(`🏁 Finished in ${(t / 1000).toFixed(1)} s — place ${place}!`);
        this.endRace(true); return;
      }
      R.cp = R.cps[R.i]; this.placeMarker(); if (this.g.setWaypointRaw) this.g.setWaypointRaw(R.cp);
      toast(`Checkpoint ${R.i} of ${R.cps.length}`);
    }
  }
  // ---------------------------------------------------------------- every frame
  update(dt) {
    const p = this.g.player; if (!p) return;
    this.cool -= dt; this.updateRide();
    if (this.fight && this.held && this.w && this.cool <= 0 && p.mode === 'foot' && !this.g.paused) { this.cool = W[this.w].every; this.fire(); }
    const ch = p.char, aimW = this.w && !W[this.w].throw;
    if (ch && aimW && p.mode === 'foot') { const a = this.held ? 1 : 0, cur = ch.pose && ch.pose.aim != null ? ch.pose.aim : 0, n = cur + (a - cur) * Math.min(1, dt * 12); ch.pose = n > 0.02 ? { aim: n } : null; }
    else if (ch && ch.pose && ch.pose.aim != null) ch.pose = null;
    if (this.prop && (!this.prop.parent || p.char !== this.propChar)) { this.propChar = p.char; this.updateHeld(); }
    if (!this.prop && this.w && p.char) { this.propChar = p.char; this.updateHeld(); }
    const mp = this.g.mp, others = mp && mp.on ? [...mp.others.values()] : [], bots = this.crew.alive();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], w = W[s.w]; s.t += dt;
      s.vz -= w.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.m.position.set(s.x, s.z, -s.y);
      if (w.streak) {               // a streak of water / a foam dart: long along its path
        const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, k = s.w === 1 ? 1 + s.t * 1.5 : 1;
        s.m.quaternion.setFromUnitVectors(UPV, _dv.set(s.vx / sp, s.vz / sp, -s.vy / sp)); s.m.scale.set(w.r * k, w.r * w.streak, w.r * k);
      }
      let gone = s.t > w.life, hitAt = null;
      const gz = ground(s.x, s.y); if (s.z < gz + 0.03) { gone = true; hitAt = [s.x, s.y, gz]; }
      if (!gone && s.mine) {
        for (const o of others) {
          if (this.friend(o) || o.mode !== 'foot' && o.mode !== undefined) continue;
          const dz = s.z - (o.z ?? gz); if (dz < 0 || dz > 1.9 || Math.hypot(s.x - o.x, s.y - o.y) > 0.55) continue;
          if (!w.splash) this.hitOther(o.id, s.w, o.x, o.y, o.z ?? gz); gone = true; hitAt = [s.x, s.y, o.z ?? gz]; break;
        }
        if (!gone) for (const b of bots) {
          if (b.team && b.team === this.team) continue;
          const dz = s.z - b.gy; if (dz < 0 || dz > 1.9 || Math.hypot(s.x - b.x, s.y - b.y) > 0.6) continue;
          if (!w.splash) this.hitOther(b, s.w, b.x, b.y, b.gy); gone = true; hitAt = [s.x, s.y, b.gy]; break;
        }
      }
      // a rival's shot at me (or a rival's shot at another rival, handled by the crew)
      if (!gone && s.from && s.from.bot) {
        if (p.mode === 'foot' && !this.g.deadT && !(s.from.team && s.from.team === this.team)) {
          const dz = s.z - p.gy; if (dz >= 0 && dz < 1.9 && Math.hypot(s.x - p.x, s.y - p.y) < 0.55) {
            gone = true; hitAt = [s.x, s.y, p.gy];
            if (!w.splash && (s.w !== 1 || performance.now() - (this.lastHit.get('me' + s.from.name) || 0) > 300)) { this.lastHit.set('me' + s.from.name, performance.now()); hurt(DMG, (p.x - s.from.x) * 0.02, (p.y - s.from.y) * 0.02, 'splash', s.from.id); }
          }
        }
        if (!gone) { const b = this.crew.hitTest(s); if (b) { gone = true; hitAt = [s.x, s.y, b.gy]; } }
      }
      if (gone) {
        if (hitAt) { this.splat(hitAt[0], hitAt[1], hitAt[2], s.w, s.c); if (w.splash) this.splash(s, hitAt, others, bots, p); }
        this.scene.remove(s.m); this.shots.splice(i, 1);
      }
    }
    for (let i = this.splats.length - 1; i >= 0; i--) { const s = this.splats[i]; s.t -= dt; if (s.t <= 0) { this.scene.remove(s.m); this.splats.splice(i, 1); } }
    // driving into another player (or a rival) knocks them down: three shots' worth
    if (this.fight && p.mode === 'car' && Math.abs(p.v) > 3) {
      const u = p.car && p.car.mesh.userData, L = (u && u.L) || 4.5, Wd = (u && u.W) || 1.9, fx = Math.sin(p.h), fy = Math.cos(p.h);
      for (const o of [...others, ...bots]) {
        if ((o.mode && o.mode !== 'foot') || (o.hitCool || 0) > performance.now() || this.friend(o) || (o.bot && o.team && o.team === this.team)) continue;
        const dx = o.x - p.x, dy = o.y - p.y, al = dx * fx + dy * fy, lat = dx * fy - dy * fx;
        if (Math.abs(al) > L / 2 + 0.4 || Math.abs(lat) > Wd / 2 + 0.4) continue;
        o.hitCool = performance.now() + 1500; p.v *= 0.7;
        if (o.bot) this.crew.hit(o, 3 * DMG); else { mp.game({ k: 'hit', dmg: 3 * DMG, w: 'car' }, o.id); this.ch.hitPlayer(o.id); }
      }
    }
    this.crew.update(dt);
    this.updateRace(dt);
    this.ch.update(dt);
    // the scoreboard: you, the rivals and everyone online, splats this round (crew totals when crews are playing)
    if ((this.bt = (this.bt || 0) - dt) <= 0) {
      this.bt = 1; const b = this.$('#g-board');
      const rows = [{ n: ((mp && mp.on && mp.name) || 'You') + ' (you)', s: this.g.score, me: 1, tm: this.team }, ...others.map(o => ({ n: o.name, s: o.sc || 0, tm: o.tm })), ...this.crew.board()];
      if (rows.length > 1) {
        rows.sort((a, b) => b.s - a.s);
        const red = rows.filter(r => r.tm === 'r').reduce((a, r) => a + r.s, 0), blue = rows.filter(r => r.tm === 'b').reduce((a, r) => a + r.s, 0);
        b.innerHTML = `<div class="g-round">Round ${this.round} · first to ${WIN}${red + blue ? ` · <span class="g-team-r">🔴 ${red}</span> <span class="g-team-b">🔵 ${blue}</span>` : ''}</div>` +
          rows.slice(0, 6).map(r => `<div${r.me ? ' class="me"' : ''}><span class="${r.tm ? 'g-team-' + r.tm : ''}">${r.n.replace(/[<>&]/g, '')}</span><b>${r.s}</b></div>`).join(''); b.hidden = false;
      } else b.hidden = true;
    }
  }
  // a water balloon bursts: everyone (not your crew) within a few metres gets one shot
  splash(s, at, others, bots, p) {
    const R = W[3].splash;
    if (s.mine) {
      for (const o of others) if (!this.friend(o) && Math.hypot(o.x - at[0], o.y - at[1]) < R) this.hitOther(o.id, 3, o.x, o.y, o.z ?? at[2]);
      for (const b of bots) if (!(b.team && b.team === this.team) && Math.hypot(b.x - at[0], b.y - at[1]) < R) this.hitOther(b, 3, b.x, b.y, b.gy);
    } else if (s.from && s.from.bot) {
      if (p.mode === 'foot' && !(s.from.team && s.from.team === this.team) && Math.hypot(p.x - at[0], p.y - at[1]) < R) hurt(DMG, 0, 0, 'splash', s.from.id);
      this.crew.splashAt(s.from, at, R);
    }
  }
}
function confirmLeave() { return true; }
