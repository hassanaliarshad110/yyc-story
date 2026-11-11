// The street crews: 20 players run by the game, always around you in free roam, each with a name. Half are the Red
// crew, half the Blue crew. They roam the sidewalks and parks and splat anyone not in their crew (rival crew members
// and you, unless you've joined their crew with 👥), with the same toy weapons. Ten shots and they're out for 5 s.
// Each splat is a point; they're on the scoreboard and can win the round too. ⚔️ calls a truce (they stop shooting).
import * as THREE from 'three';
import { Character } from './rig.js';
import { humanReady, loadHuman, NPCS } from './humans.js';
import { standY } from './tiles.js';
import { toast } from './hud.js';

const NAMES = ['Paramjeet', 'Chris', 'Maryam', 'Simi', 'Ali', 'Hassan', 'Hussain', 'Fatima', 'Muhammad', 'Emma', 'Liam', 'Olivia', 'Noah', 'Sophie', 'Jack',
  'Emily', 'Ryan', 'Grace', 'Daniel', 'Hannah'];
const LOOKS = [...NPCS, 'teen_girl', 'kid_boy2'];
const COL = { r: '#ff4a4a', b: '#4a9aff' };

function tagSprite(name, team) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.font = '700 26px system-ui, sans-serif'; const w = Math.min(244, g.measureText(name).width + 40);
  g.fillStyle = 'rgba(10,16,26,.72)'; g.beginPath(); g.roundRect((256 - w) / 2, 10, w, 42, 12); g.fill();
  g.fillStyle = COL[team]; g.beginPath(); g.arc((256 - w) / 2 + 16, 31, 7, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128 + 8, 31);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  s.scale.set(1.5, 0.375, 1); s.position.y = 2.2; s.renderOrder = 20; return s;
}

export class RivalCrew {
  constructor(game, scene, games, n = 20) {
    if (game.mobile) n = 12;
    this.g = game; this.scene = scene; this.games = games; this.n = n; this.bots = []; this.on = true; this.t = 0;
    this.looks = game.mobile ? LOOKS.slice(0, 4) : LOOKS;      // fewer different models on phones (memory)
    for (const l of this.looks) loadHuman(l);
  }
  toggle() {
    this.on = !this.on; const b = this.games.$('#g-crew'); if (b) b.classList.toggle('off', !this.on);
    toast(this.on ? '⚔️ The crews are fighting again — 10 shots and you\'re out.' : '🕊️ Truce: the crews won\'t shoot.');
  }
  // somewhere to stand: a sidewalk or park spot 40-150 m from you (never inside a building)
  spot(px, py, rmin = 40, rmax = 150) {
    const T = this.g.tiles;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * 6.28, r = rmin + Math.random() * (rmax - rmin); let x = px + Math.sin(a) * r, y = py + Math.cos(a) * r;
      if (T && T.safeSpot) { const s = T.safeSpot(x, y, { maxR: 30 }); if (!s) continue; x = s.x; y = s.y; }
      if (T && T.insideBuilding && T.insideBuilding(x, y)) continue;
      return [x, y];
    }
    return null;
  }
  build() {
    if (!this.looks.every(humanReady)) return false;
    const p = this.g.player;
    for (let i = 0; i < this.n; i++) {
      const team = i % 2 ? 'b' : 'r', ch = new Character({ glb: this.looks[i % this.looks.length], gscale: 0.96 + (i % 5) * 0.02 });
      ch.g.add(tagSprite(NAMES[i], team)); ch.g.visible = false; this.scene.add(ch.g);
      const b = { id: 'crew' + i, bot: true, name: NAMES[i], team, ch, x: p.x, y: p.y, h: 0, gy: 0, hp: 100, kills: 0, deadT: 0, cool: Math.random(), w: [1, 3, 4, 5, 6, 1, 5][i % 7], t: Math.random() * 10, tgt: null, home: null, v: 0 };
      this.bots.push(b); this.place(b);
    }
    return true;
  }
  place(b) {
    const p = this.g.player, s = this.spot(p.x, p.y); if (!s) return;
    b.x = s[0]; b.y = s[1]; b.home = [b.x, b.y]; b.gy = standY(b.x, b.y); b.hp = 100; b.deadT = 0; b.wander = null;
  }
  alive() { return this.on ? this.bots.filter(b => !b.deadT && b.near) : []; }
  board() { return this.bots.map(b => ({ n: b.name, s: b.kills, tm: b.team })); }
  reset() { for (const b of this.bots) b.kills = 0; }
  // the player hit a crew member
  hit(b, dmg) {
    if (b.deadT) return; b.hp -= dmg; b.flash = 0.15;
    if (b.hp <= 0) { this.down(b); this.games.kill(b.name); }
  }
  down(b) { b.deadT = 5; b.ch.g.visible = false; }
  // I got splatted by a crew member: their point
  scored(by) { const b = this.bots.find(x => x.id === by); if (b) this.botKill(b, 'you'); }
  botKill(b, victim) {
    b.kills++;
    if (b.kills >= 10) this.games.winRound(b.name, true);
  }
  // a crew member's shot at another crew member
  hitTest(s) {
    for (const b of this.bots) {
      if (b.deadT || !b.near || b === s.from || b.team === s.from.team) continue;
      const dz = s.z - b.gy; if (dz < 0 || dz > 1.9 || Math.hypot(s.x - b.x, s.y - b.y) > 0.6) continue;
      if (s.w !== 3) this.botHit(b, s.from); return b;
    }
    return null;
  }
  splashAt(from, at, R) { for (const b of this.bots) if (!b.deadT && b.near && b !== from && b.team !== from.team && Math.hypot(b.x - at[0], b.y - at[1]) < R) this.botHit(b, from); }
  botHit(b, from) { b.hp -= 10; b.flash = 0.15; if (b.hp <= 0) { this.down(b); this.botKill(from, b); } }
  update(dt) {
    const p = this.g.player; if (!p || this.g.mode !== 'free') return;
    if (!this.bots.length) { if ((this.t -= dt) <= 0) { this.t = 1; this.build(); } return; }
    const me = this.games.team, alive = !(this.g.deadT > 0) && p.mode === 'foot';
    for (const b of this.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d > 320) { this.place(b); continue; }          // keep them around you
      if (b.deadT) { if ((b.deadT -= dt) <= 0) { this.place(b); b.deadT = 0; } continue; }
      const R = this.g.mobile ? 100 : 150; b.near = d < R; b.ch.g.visible = d < R + 20;
      if (!b.near) continue;
      b.t += dt; b.cool -= dt;
      // pick a target every second: the nearest rival (another crew's member, or you if you're not in their crew)
      if ((b.retarget = (b.retarget || 0) - dt) <= 0) {
        b.retarget = 0.7; b.tgt = null; let bd = 45;
        if (this.on) {
          // you come first: anyone not in your crew hunts you down from up to 90 m away
          if (alive && me !== b.team && d < 90) b.tgt = 'me';
          else for (const o of this.bots) if (o !== b && !o.deadT && o.near && o.team !== b.team) { const od = Math.hypot(o.x - b.x, o.y - b.y); if (od < bd) { bd = od; b.tgt = o; } }
        }
      }
      const T = b.tgt === 'me' ? { x: p.x, y: p.y, gy: p.gy } : b.tgt;
      let mx = 0, my = 0, sp = 0;
      if (T) {
        const dx = T.x - b.x, dy = T.y - b.y, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd;
        const want = 6 + (b.id.charCodeAt(4) % 4), toward = dd > want + 1.5 ? 1 : dd < want - 2.5 ? -0.5 : 0, side = Math.sin(b.t * 1.1 + b.id.length) * 0.7;
        mx = ux * toward - uy * side; my = uy * toward + ux * side; sp = dd > 25 ? 4.4 : 3.6;
        b.h = Math.atan2(dx, dy);
        if (dd < 30 && b.cool <= 0) { this.shoot(b, T, dd); }
      } else {
        // wander about home
        if (!b.wander || Math.hypot(b.wander[0] - b.x, b.wander[1] - b.y) < 1.5) { const a = Math.random() * 6.28, r = 6 + Math.random() * 30; b.wander = [b.home[0] + Math.sin(a) * r, b.home[1] + Math.cos(a) * r]; }
        const dx = b.wander[0] - b.x, dy = b.wander[1] - b.y, dd = Math.hypot(dx, dy) || 1; mx = dx / dd; my = dy / dd; sp = 1.3; b.h = Math.atan2(dx, dy);
      }
      const ml = Math.hypot(mx, my);
      if (ml > 0.01) {
        const nx = b.x + mx / ml * sp * dt, ny = b.y + my / ml * sp * dt, Tl = this.g.tiles;
        if (Tl && Tl.insideBuilding && Tl.insideBuilding(nx, ny)) b.wander = null; else { b.x = nx; b.y = ny; }
      }
      b.v = ml > 0.01 ? sp : 0; b.gy = standY(b.x, b.y);
      b.ch.g.position.set(b.x, b.gy, -b.y); b.ch.g.rotation.y = Math.PI - b.h;
      if (b.flash > 0) b.flash -= dt;
      b.ch.animate(dt, { speed: b.v, run: b.v > 2.5 });
    }
  }
  shoot(b, T, dd) {
    const w = b.w, ws = WEAP(w);
    b.cool = Math.max(0.22, ws.every * (w === 1 ? 4 : 1.6)) + Math.random() * 0.15;
    const err = 0.025 + dd * 0.0025, a = b.h + (Math.random() - 0.5) * err * 2, fx = Math.sin(a), fy = Math.cos(a), fz = ((T.gy ?? b.gy) - b.gy) / Math.max(4, dd);
    // lob throws so they come down near the target
    const lob = ws.throw ? Math.min(0.6, 0.12 + dd * 0.012) : ws.up;
    const o = { x: b.x + fx * 0.6, y: b.y + fy * 0.6, z: b.gy + (ws.throw ? 1.7 : 1.3), vx: fx * ws.speed, vy: fy * ws.speed, vz: (fz + lob) * ws.speed, c: b.team === 'r' ? 3 : 4 };
    this.games.spawn(w, o, false, b);
    if (b.ch) { if (ws.throw) b.ch.pose = { throw: 0.25 }; else { b.ch.pose = { aim: 1 }; clearTimeout(b.aimT); b.aimT = setTimeout(() => { if (b.ch.pose && b.ch.pose.aim) b.ch.pose = null; }, 350); } }
  }
}
let WEAPS = null;
export function setWeapons(w) { WEAPS = w; }
const WEAP = w => WEAPS[w] || WEAPS[1];
