// Traffic stops: now and then, on a main road near you, a police SUV with its lights flashing has pulled a car over to
// the curb, and an officer in uniform stands at the driver's window (Canada: the driver sits on the left, the road
// side). They clear away after a few minutes or when you're far off.
import * as THREE from 'three';
import { makeCar } from './actors.js?v=11112205';
import { makeCar3D } from './cars3d.js?v=11112205';
import { Character } from './rig.js?v=11112205';
import { loadHuman, humanReady } from './humans.js?v=11112205';
import { standY } from './tiles.js?v=11112205';

export const OFFICER = { glb: 'police_officer', skin: 0xc69373, shirt: 0x1d2a44, pants: 0x1d2a44, hair: 0x15100d };

export class TrafficStops {
  constructor(game, scene, traffic) {
    this.g = game; this.scene = scene; this.traffic = traffic; this.list = []; this.t = 20; loadHuman('police_officer');
  }
  // a straight stretch of a main road 120-350 m away
  spot(px, py) {
    const T = this.traffic;
    for (let k = 0; k < 20; k++) {
      const p = T.pieces[Math.random() * T.pieces.length | 0];
      if (!p || ![3, 4, 5].includes(p.kind) || p.len < 60 || p.zs) continue;
      const s = 25 + Math.random() * (p.len - 50), dir = p.oneway ? 1 : (Math.random() < 0.5 ? 1 : -1);
      const probe = { piece: p, dir, s, x: 0, y: 0, h: 0, mesh: new THREE.Group(), parked: true }; T.place(probe, p.w / 2 - 1.2);
      const d = Math.hypot(probe.x - px, probe.y - py); if (d < 120 || d > 350) continue;
      if (T.cars.some(o => Math.hypot(o.x - probe.x, o.y - probe.y) < 22)) continue;
      return { p, dir, s };
    }
    return null;
  }
  make(px, py) {
    if (!humanReady('police_officer')) return;
    const sp = this.spot(px, py); if (!sp) return;
    const T = this.traffic, side = sp.p.w / 2 - 1.2;
    const car = { mesh: makeCar('car'), piece: sp.p, dir: sp.dir, s: sp.s, v: 0, parked: true, x: 0, y: 0, h: 0, gy: 0, stop: true };
    const cop = { mesh: makeCar3D(Math.random() < 0.8 ? 'police' : 'peace') || makeCar('police'), piece: sp.p, dir: sp.dir, s: sp.s - 8.5, v: 0, parked: true, x: 0, y: 0, h: 0, gy: 0, stop: true };
    for (const c of [car, cop]) { T.place(c, side); this.scene.add(c.mesh); T.cars.push(c); }
    // the officer at the driver's window: beside the front door on the road side, facing the car
    const fx = Math.sin(car.h), fy = Math.cos(car.h), lx = -fy, ly = fx, W = (car.mesh.userData.W || 1.85) / 2;
    const ox = car.x + fx * 0.6 + lx * (W + 0.75), oy = car.y + fy * 0.6 + ly * (W + 0.75);
    const officer = new Character(OFFICER); officer.g.position.set(ox, standY(ox, oy), -oy); officer.g.rotation.y = Math.PI - Math.atan2(-lx, -ly); this.scene.add(officer.g);
    // now and then a second officer waits by the open door of the SUV
    let partner = null;
    if (Math.random() < 0.5) { const qx = cop.x + Math.sin(cop.h) * 0.4 + lx * ((cop.mesh.userData.W || 1.95) / 2 + 0.6), qy = cop.y + Math.cos(cop.h) * 0.4 + ly * ((cop.mesh.userData.W || 1.95) / 2 + 0.6); partner = new Character(OFFICER); partner.g.position.set(qx, standY(qx, qy), -qy); partner.g.rotation.y = Math.PI - car.h; this.scene.add(partner.g); }
    this.list.push({ car, cop, officer, partner, t: 150 + Math.random() * 120, x: car.x, y: car.y });
  }
  remove(S) {
    for (const o of [S.officer, S.partner]) if (o) this.scene.remove(o.g);
    for (const c of [S.car, S.cop]) if (!c.player) c.dead = true;
  }
  update(dt, px, py) {
    if ((this.t -= dt) <= 0) { this.t = 45 + Math.random() * 45; if (!this.list.some(S => Math.hypot(S.x - px, S.y - py) < 700)) this.make(px, py); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const S = this.list[i], d = Math.hypot(S.x - px, S.y - py);
      S.t -= dt;
      // the stop ends if it's over, you're far away, or someone drives off in one of the cars
      if (S.t <= 0 && d > 80 || d > 600 || S.car.dead || S.cop.dead || S.car.player || S.cop.player) { this.remove(S); this.list.splice(i, 1); continue; }
      if (d < 150) { S.officer.animate(dt, { talk: true }); if (S.partner) S.partner.animate(dt, {}); }
    }
  }
}
