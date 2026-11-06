// The player: walking, running and driving. Heading h: 0 = north, clockwise (east = PI/2).
import * as THREE from 'three';
import { makePerson, animatePerson } from './actors.js';

export const dirOf = h => [Math.sin(h), Math.cos(h)];           // (east, north)
export const rotY = h => Math.PI - h;                            // model faces +Z in three
export function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

export const LOOKS = {
  ayaan: { name: 'Ayaan', skin: 0xb07a52, shirt: 0x1f6fd1, pants: 0x2a2e38, hair: 0x15100d, bag: 0x333333 },
  zara: { name: 'Zara', skin: 0xb98260, shirt: 0xc8326b, pants: 0x283044, hair: 0x15100d, long: true, bag: 0x5a3a7a },
};

export class Player {
  constructor(scene, tiles, look = 'ayaan') {
    this.scene = scene; this.tiles = tiles;
    this.mode = 'foot'; this.x = 0; this.y = 0; this.h = 0; this.v = 0; this.car = null; this.steer = 0; this.gy = 0;
    this.setLook(look);
  }
  setLook(look) {
    if (this.person) this.scene.remove(this.person);
    this.look = look; this.person = makePerson(LOOKS[look] || LOOKS.ayaan); this.scene.add(this.person);
  }
  place(x, y, h = this.h) { this.x = x; this.y = y; this.h = h; this.v = 0; this.sync(); }
  sync() {
    if (this.mode === 'car' && this.car) {
      this.car.x = this.x; this.car.y = this.y; this.car.h = this.h;
      this.car.mesh.position.set(this.x, this.gy, -this.y); this.car.mesh.rotation.y = rotY(this.h);
      this.person.visible = false;
    } else if (this.mode === 'foot') {
      this.person.visible = true; this.person.position.set(this.x, this.gy, -this.y); this.person.rotation.y = rotY(this.h);
    } else this.person.visible = false;
  }
  update(dt, inp, camHeading) {
    if (this.mode === 'foot') this.walk(dt, inp, camHeading);
    else if (this.mode === 'car') this.drive(dt, inp);
    this.sync();
  }
  walk(dt, inp, camH) {
    const run = inp.sprint ? 7.2 : 3.4;
    let mx = 0, my = 0;
    if (inp.tx || inp.ty) {                          // joystick: relative to the camera
      const [fx, fy] = dirOf(camH), rx = fy, ry = -fx;
      mx = fx * inp.y + rx * inp.x; my = fy * inp.y + ry * inp.x;
      const m = Math.hypot(mx, my);
      if (m > 0.05) { this.h += angDiff(this.h, Math.atan2(mx, my)) * Math.min(1, dt * 10); }
      this.v = Math.min(1, m) * run;
    } else {                                         // keyboard: turn with A/D, walk with W/S
      this.h += inp.x * dt * 2.6;
      this.v = inp.y > 0 ? run : inp.y < 0 ? -2 : 0;
    }
    const [dx, dy] = dirOf(this.h);
    let nx = this.x + dx * this.v * dt, ny = this.y + dy * this.v * dt;
    const c = this.tiles.collide(nx, ny, 0.45);
    this.x = c.x; this.y = c.y;
    animatePerson(this.person, Math.abs(this.v), dt);
  }
  drive(dt, inp) {
    const car = this.car, max = inp.sprint ? 33 : 22, acc = 7.5, brake = 16;
    if (inp.y > 0) this.v += (this.v < 0 ? brake : acc) * inp.y * dt;
    else if (inp.y < 0) this.v -= (this.v > 0 ? brake : acc * 0.6) * -inp.y * dt;
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 2.5 * dt);
    if (inp.brake) this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 22 * dt);
    this.v = Math.max(-8, Math.min(max, this.v));
    this.steer += ((inp.x * 0.55 / (1 + Math.abs(this.v) / 18)) - this.steer) * Math.min(1, dt * 6);
    const wb = 2.7;
    this.h += this.v * Math.tan(this.steer) / wb * dt;
    const [dx, dy] = dirOf(this.h);
    let nx = this.x + dx * this.v * dt, ny = this.y + dy * this.v * dt;
    // three circles along the car body
    let hit = false;
    for (const off of [1.5, 0, -1.5]) {
      const cx = nx + dx * off, cy = ny + dy * off;
      const c = this.tiles.collide(cx, cy, 1.0);
      if (c.hit) { hit = true; nx += c.x - cx; ny += c.y - cy; }
    }
    if (hit) { this.v *= -0.25; if (this.onCrash) this.onCrash(); }
    this.x = nx; this.y = ny;
    // wheels spin
    car.mesh.children.forEach(o => { if (o.geometry && o.geometry.type === 'CylinderGeometry' && o.position.y < 0.6) o.rotation.x += this.v * dt / 0.36; });
  }
  enter(car) {
    this.mode = 'car'; this.car = car; this.x = car.x; this.y = car.y; this.h = car.h; this.v = 0; car.player = true; this.sync();
  }
  exit() {
    const car = this.car; if (!car) return;
    car.player = false; car.parked = true; car.v = 0;
    const [dx, dy] = dirOf(this.h);
    this.mode = 'foot'; this.car = null; this.v = 0;
    // step out on the driver's side (left)
    let ex = this.x - dy * 2.0, ey = this.y + dx * 2.0;
    const c = this.tiles.collide(ex, ey, 0.45); this.x = c.x; this.y = c.y; this.sync();
    return car;
  }
  get speedKmh() { return Math.abs(this.v) * 3.6; }
}
