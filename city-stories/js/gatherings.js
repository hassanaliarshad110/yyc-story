// Places where people gather: groups walking about outside a building, coming and going and stopping to chat.
// Dashmesh Culture Centre (135 Martindale Boulevard NE): 20 people in turbans, the same 3D character as on the streets.
import { Character } from './rig.js?v=11111647';
import { humanReady, loadHuman } from './humans.js?v=11111647';
import { standY } from './tiles.js?v=11111647';

const SPOTS = [{ name: 'Dashmesh Culture Centre', x: 7194, y: 7606, n: 20, glb: 'npc_sikh', r: 34 }];

export class Gatherings {
  constructor(game, scene) { this.g = game; this.scene = scene; this.live = new Map(); this.t = 0; for (const s of SPOTS) loadHuman(s.glb); }
  // a spot outside the building, within reach of the centre
  pick(S) {
    const T = this.g.tiles;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * 6.28, r = 6 + Math.random() * S.r, x = S.x + Math.sin(a) * r, y = S.y + Math.cos(a) * r;
      if (T && T.insideBuilding && T.insideBuilding(x, y)) continue;
      return [x, y];
    }
    return [S.x + (Math.random() - 0.5) * 8, S.y - S.r];
  }
  update(dt, px, py) {
    if ((this.t -= dt) <= 0) {
      this.t = 1;
      for (const S of SPOTS) {
        const d = Math.hypot(S.x - px, S.y - py), on = this.live.get(S);
        if (!on && d < 220 && humanReady(S.glb)) {
          const people = [];
          for (let i = 0; i < S.n; i++) {
            const ch = new Character({ glb: S.glb, gscale: 0.93 + (i % 6) * 0.025 }), [x, y] = this.pick(S);
            this.scene.add(ch.g); people.push({ ch, x, y, h: Math.random() * 6.28, to: null, wait: Math.random() * 4, sp: 1.0 + Math.random() * 0.4 });
          }
          this.live.set(S, people);
        } else if (on && d > 280) { for (const q of on) this.scene.remove(q.ch.g); this.live.delete(S); }
      }
    }
    for (const [S, people] of this.live) {
      const near = Math.hypot(S.x - px, S.y - py) < 140;
      for (const q of people) {
        if (q.wait > 0) { q.wait -= dt; if (q.wait <= 0) q.to = this.pick(S); }
        let moving = false;
        if (q.to) {
          const dx = q.to[0] - q.x, dy = q.to[1] - q.y, d = Math.hypot(dx, dy);
          if (d < 0.6) { q.to = null; q.wait = 2 + Math.random() * 6; }
          else {
            const nx = q.x + dx / d * q.sp * dt, ny = q.y + dy / d * q.sp * dt, T = this.g.tiles;
            if (T && T.insideBuilding && T.insideBuilding(nx, ny)) { q.to = null; q.wait = 1; } else { q.x = nx; q.y = ny; q.h = Math.atan2(dx, dy); moving = true; }
          }
        }
        q.ch.g.position.set(q.x, standY(q.x, q.y), -q.y); q.ch.g.rotation.y = Math.PI - q.h;
        if (near) q.ch.animate(dt, { speed: moving ? q.sp : 0 });
      }
    }
  }
}
