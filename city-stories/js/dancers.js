// The people at the front of a concert crowd: real 3D people (the same models as on the streets), dancing to the beat
// with each person a little apart, cowboy hats at the Stampede. The rest of a big crowd further back stays light.
import { Character, HAT_COLORS } from './rig.js?v=11112205';
import { humanReady, loadHuman, NPCS } from './humans.js?v=11112205';
import { standY } from './tiles.js?v=11112205';
import { ground } from './terrain.js?v=11112205';

const H = (i, n) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
const EXTRA = ['teen_girl', 'npc_teen', 'npc_dress', 'npc_cowboy'];
let asked = false;
export function loadCrowdModels() { if (asked) return; asked = true; for (const n of [...NPCS, 'teen_girl']) loadHuman(n); }

export class Dancers {
  // spots: [{ x, y, h }] in map metres; opts: { hats, seed }
  constructor(parent, spots, opts = {}) { this.parent = parent; this.spots = spots; this.o = opts; this.list = null; this.t = 0; }      // the models load only once you're close
  build() {
    const names = [...NPCS, ...EXTRA], seed = this.o.seed || 1;
    if (!names.every(humanReady)) return false;
    this.list = this.spots.map((s, i) => {
      const glb = names[Math.floor(H(i + seed, 1) * names.length)], hatOk = !['npc_cowboy', 'npc_sikh', 'npc_hijab'].includes(glb);
      const ch = new Character({ glb, gscale: 0.95 + H(i + seed, 2) * 0.08, hat: this.o.hats && hatOk && H(i + seed, 3) < 0.8 ? HAT_COLORS[Math.floor(H(i + seed, 4) * HAT_COLORS.length)] : undefined });
      ch.g.position.set(s.x, s.z != null ? ground(s.x, s.y) + s.z : standY(s.x, s.y), -s.y);      // z: height above the ground (on a stage deck) ch.g.rotation.y = Math.PI - s.h; this.parent.add(ch.g);
      return [ch, Math.floor(H(i + seed, 5) * 4), H(i + seed, 6) * 2];
    });
    return true;
  }
  // near: close enough to animate; on: the show is on (dancing) or off (standing about)
  update(dt, near, on, dance = on) {
    if (!this.list) { if (!near) return; loadCrowdModels(); if (!this.build()) return; }
    this.list.forEach(([c], i) => { c.g.visible = on && !(i === 0 && this.hideLead); });      // hideLead: you're at the mic
    if (!near || !on) return;
    this.t += dt;
    for (const [c, st, off] of this.list) c.animate(dt, dance ? { dance: st, offset: off } : {});
  }
  set visible(v) { if (this.list) for (const [c] of this.list) c.g.visible = v; }
}
