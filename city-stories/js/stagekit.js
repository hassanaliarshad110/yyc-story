// Solid stages: you walk up the front steps onto the deck (you can't walk through it any more), and at the mic you can
// take over the show and rap the song yourself while the crowd dances. Used by the Stampede stages and the Saddledome concert.
import * as THREE from 'three';
import { PLATFORMS } from './tiles.js?v=11111647';
import { ground } from './terrain.js?v=11111647';

// solid boxes: { x, y, fx, fy, hl (half length along f), hw (half width across), top }; anything you can step up (< 0.9 m)
// or are already standing on doesn't block
export const BLOCKS = [];
export function blockPush(x, y, r, gy) {
  let hit = false;
  for (const B of BLOCKS) {
    const dx = x - B.x, dy = y - B.y; if (Math.abs(dx) > B.R + r || Math.abs(dy) > B.R + r) continue;
    if (gy >= B.top - 0.9) continue;
    const u = dx * B.fx + dy * B.fy, v = dx * B.fy - dy * B.fx, pu = B.hl + r - Math.abs(u), pv = B.hw + r - Math.abs(v);
    if (pu <= 0 || pv <= 0) continue;
    hit = true;
    if (pu < pv) { const s = Math.sign(u) || 1; x += B.fx * s * pu; y += B.fy * s * pu; }
    else { const s = Math.sign(v) || 1; x += B.fy * s * pv; y -= B.fx * s * pv; }
  }
  return { x, y, hit };
}
const lc = (x, y, face, ax, ay) => { const s = Math.sin(face), c = Math.cos(face); return [x + ax * c + ay * s, y - ax * s + ay * c]; };
// a box in the stage's own frame: ax across (right), ay towards the crowd; w across, d deep
function addBox(x, y, face, ax, ay, w, d, top, platform) {
  const [cx, cy] = lc(x, y, face, ax, ay), fx = Math.sin(face), fy = Math.cos(face);
  const b = { x: cx, y: cy, fx, fy, hl: d / 2, hw: w / 2, top, R: Math.hypot(w, d) / 2 };
  BLOCKS.push(b); if (platform) PLATFORMS.push(b);
  return b;
}

export const STAGES = [];
// x, y: front centre of the deck; face: towards the crowd; W, D: deck size; deckH: deck height; parts: extra solid boxes
// [ax, ay, w, d, h]; g: the stage's group (for the steps); band: its Dancers (the lead singer steps aside)
export function solidStage(o) {
  const { x, y, face, W, D, deckH = 1.6 } = o, g0 = ground(x, y), top = g0 + deckH;
  addBox(x, y, face, 0, -D / 2, W, D, top, true);
  // front steps: two treads up the middle
  addBox(x, y, face, 0, 0.55, 3.2, 1.1, g0 + deckH * 0.5, true);
  if (o.g) {
    const m = new THREE.MeshLambertMaterial({ color: 0x2e2f35 });
    for (const [z, h, d] of [[0.55, deckH * 0.5, 1.1]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, d), m); b.position.set(0, h / 2, z); b.receiveShadow = true; o.g.add(b); }
  }
  for (const [ax, ay, w, d, h] of o.parts || []) addBox(x, y, face, ax, ay, w, d, g0 + h, false);
  const s = { x, y, face, W, D, top, mic: lc(x, y, face, 0, o.micAy ?? -2.0), band: o.band, name: o.name || 'stage', performing: false };
  STAGES.push(s); return s;
}
// the stage deck you are standing on (and near its mic), or null
export function stageAt(px, py, gy) {
  for (const s of STAGES) {
    if (gy < s.top - 0.35) continue;
    const dx = px - s.x, dy = py - s.y, fx = Math.sin(s.face), fy = Math.cos(s.face), u = dx * fx + dy * fy, v = dx * fy - dy * fx;
    if (u < -s.D - 0.3 || u > 0.3 || Math.abs(v) > s.W / 2 + 0.3) continue;
    return { s, nearMic: Math.hypot(px - s.mic[0], py - s.mic[1]) < 3.5 };
  }
  return null;
}
// the lead singer steps aside while you perform (and comes back)
export function setPerforming(s, on) {
  s.performing = on;
  if (s.band) { s.band.hideLead = on; const lead = s.band.list && s.band.list[0]; if (lead && lead[0] && lead[0].g) lead[0].g.visible = !on; }
}
