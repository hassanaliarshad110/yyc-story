// The player: walking, running and driving. Heading h: 0 = north, clockwise (east = PI/2).
import * as THREE from 'three';
import { Character, heroReady } from './rig.js?v=11112205';
import { spinWheels } from './vehicles.js?v=11112205';
import { lightsOn } from './carlights.js?v=11112205';
import { blockPush } from './stagekit.js?v=11112205';
import { ground } from './terrain.js?v=11112205';
import { syncHeli } from './heli.js?v=11112205';

export const dirOf = h => [Math.sin(h), Math.cos(h)];           // (east, north)
export const rotY = h => Math.PI - h;
export const TYRE_Y = 0.2, FOOT_Y = 0.03, BIKE_SEAT = 0.3, BIKE_BACK = 0.2;      // BIKE_SEAT: the rider's hips sit on the saddle, not in it                 // road ribbons sit a little above the ground: wheels and feet rest on top
const SEAT_Y = 0.0;                                       // how far the sitting pose is lifted onto a bench seat
export function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

export const LOOKS = {
  ayaan: { name: 'Ayaan', hero: true, skin: 0xb07a52, shirt: 0x1f6fd1, pants: 0x2a2e38, hair: 0x15100d, bag: 0x333333 },
  zara: { name: 'Zara', skin: 0xb98260, shirt: 0xc8326b, pants: 0x283044, hair: 0x15100d, long: true, fem: true, bag: 0x5a3a7a, scale: 0.95 },
  ali: { glb: 'ali', name: 'Ali', hero: true, skin: 0xb07a52, shirt: 0x1f6fd1, pants: 0x2a2e38, hair: 0x15100d },
  natalia: { glb: 'natalia', hero: true, name: 'Natalia', skin: 0xd9a77e, shirt: 0x7a3fa0, pants: 0x2b3a55, hair: 0x4a2e1a, long: true, fem: true, bag: 0xd0453a, scale: 0.92 },
  chris: { glb: 'chris', hero: true, name: 'Chris', skin: 0xe0b896, shirt: 0x6b5a46, pants: 0x4a4e57, hair: 0xd2d0cc, shoe: 0x3a2a20, scale: 0.97 },
  jean: { glb: 'jean', hero: true, name: 'Jean', skin: 0x8d5a3b, shirt: 0x2f8f5a, pants: 0x30343c, hair: 0x15100d },
  leo: { glb: 'leo', hero: true, name: 'Leo', skin: 0xe8c4a0, shirt: 0xe07020, pants: 0x3a4a3a, hair: 0xa0703a, bag: 0x2a4a6a },
};

// a hang glider: a bright delta wing with a keel and a control bar you hold
function makeGlider() {
  const g = new THREE.Group(), sail = new THREE.MeshLambertMaterial({ color: 0xff3d2e, side: THREE.DoubleSide }), sail2 = new THREE.MeshLambertMaterial({ color: 0xffd23a, side: THREE.DoubleSide }), bar = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const tri = (pts, m) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, m)); };
  // nose at +z (forward), wing tips out to the sides and back
  tri([[0, 0.15, 2.2], [-4.6, -0.25, -1.4], [0, 0.05, -0.9]], sail); tri([[0, 0.15, 2.2], [0, 0.05, -0.9], [4.6, -0.25, -1.4]], sail2);
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), bar); keel.rotation.x = Math.PI / 2; keel.position.set(0, 0.08, 0.6); g.add(keel);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 5), bar); st.position.set(s * 0.32, -0.66, 0.35); st.rotation.z = s * 0.38; g.add(st); }
  const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), bar); cb.rotation.z = Math.PI / 2; cb.position.set(0, -1.32, 0.35); g.add(cb);
  return g;
}
export class Player {
  constructor(scene, tiles, look = 'ayaan') {
    this.scene = scene; this.tiles = tiles;
    this.mode = 'foot'; this.x = 0; this.y = 0; this.h = 0; this.v = 0; this.car = null; this.steer = 0; this.gy = 0;
    this.setLook(look);
  }
  setLook(look) {
    if (this.person) this.scene.remove(this.person);
    this.look = look; this.char = new Character(LOOKS[look] || LOOKS.ayaan); this.person = this.char.g; this.scene.add(this.person);
  }
  place(x, y, h = this.h) { this.x = x; this.y = y; this.h = h; this.v = 0; this.gy = ground(x, y); this.vy = 0; this.sync(); if (this.onPlace) this.onPlace(); }
  sync() {
    if (this.mode === 'car' && this.car) {
      this.car.x = this.x; this.car.y = this.y; this.car.h = this.h;
      this.car.mesh.position.set(this.x, this.gy + TYRE_Y, -this.y); this.car.mesh.rotation.order = 'YXZ'; this.car.mesh.rotation.y = rotY(this.h); this.car.mesh.rotation.x = -(this.pitch || 0);      // nose follows the slope so no wheel sinks in
      if (this.onBike) {          // sit on the motorbike, leaning into turns
        const lean = -this.steer * Math.min(1, Math.abs(this.v) / 15) * 0.35;
        this.car.mesh.rotation.z = lean; this.car.mesh.rotation.order = 'YXZ';
        this.person.visible = true; this.person.position.set(this.x, this.gy + BIKE_SEAT + TYRE_Y, -this.y); this.person.rotation.set(-(this.pitch || 0), rotY(this.h), 0); this.person.rotation.order = 'YXZ'; this.person.rotation.z = lean;
        const [dx, dy] = dirOf(this.h); this.person.position.x -= dx * BIKE_BACK; this.person.position.z += dy * BIKE_BACK;
      } else this.person.visible = false;
    } else if (this.mode === 'foot') {
      this.person.visible = true; this.person.position.set(this.x, this.gy + FOOT_Y, -this.y); this.person.rotation.set(0, rotY(this.h), 0);
    } else this.person.visible = false;
    // the glider over your head while you glide
    if (this.glide && !this.wing) { this.wing = makeGlider(); this.person.parent && this.person.parent.add(this.wing); }
    if (this.wing) {
      this.wing.visible = !!this.glide && this.mode === 'foot';
      if (this.wing.visible) { this.wing.position.set(this.x, this.gy + 2.25, -this.y); this.wing.rotation.order = 'YXZ'; this.wing.rotation.set(-0.12, rotY(this.h), 0); }
    }
  }
  // sit down on the nearest park bench or picnic table (E), get up by moving or pressing E again
  toggleSeat() {
    if (this.seat) { this.standUp(); return true; }
    const s = this.parks && this.parks.seatNear(this.x, this.y); if (!s) return false;
    this.seat = s; this.x = s.x; this.y = s.y; this.h = s.h; this.v = 0; return true;
  }
  standUp() { const s = this.seat; if (!s) return; this.seat = null; const [dx, dy] = dirOf(s.h); this.x = s.x + dx * 0.7; this.y = s.y + dy * 0.7; }
  update(dt, inp, camHeading) {
    if (this.mode === 'foot' && this.seat) {
      if (Math.abs(inp.x) > 0.3 || Math.abs(inp.y) > 0.3) this.standUp();
      else { this.x = this.seat.x; this.y = this.seat.y; this.h = this.seat.h; this.v = 0; this.char.animate(dt, { sit: true }); this.height(dt); this.sync(); this.person.position.y += SEAT_Y; return; }
    }
    if (this.mode === 'foot' && !this.seat && this.powerUpdate && this.powerUpdate(dt, inp, camHeading)) { this.sync(); if (this.powerPose) this.powerPose(); return; }      // flying, swinging
    if (this.mode === 'foot') {
      this.walk(dt, inp, camHeading);
      if ((this.inT = (this.inT || 0) - dt) <= 0) { this.inT = 0.3; const o = this.gy - ground(this.x, this.y) < 3 && this.tiles.outside(this.x, this.y); if (o) { this.x = o.x; this.y = o.y; } }   // never stuck inside a building
    }
    else if (this.mode === 'car') { this.drive(dt, inp); if (this.onBike) this.char.animate(dt, { ride: true }); }
    else if (this.mode === 'heli') { this.fly(dt, inp); this.sync(); return; }
    this.height(dt);
    if (this.air > 0) { this.vy -= 16 * dt; this.air = Math.max(0, this.air + this.vy * dt); if (this.air <= 0) this.vy = 0; }
    this.sync();
    if (this.air > 0 && this.mode === 'foot') this.person.position.y += this.air;
  }
  // stand on bridges and ramps; fall off edges
  height(dt) {
    const target = this.tiles.surfaceAt(this.x, this.y, this.gy, this.mode === 'car' ? 1.0 : 0.8, 0, this.mode === 'foot');      // on foot: stand on the road paint and sidewalks
    const slope = this.mode === 'car' ? 0.25 + Math.abs(this.v) * dt * 0.35 : 0.05;   // driving downhill follows the road instead of hopping
    if (this.mode === 'car') {      // pitch from the surface under the front and back wheels
      const [dx, dy] = dirOf(this.h), wb = this.onBike ? 0.7 : 1.4;
      const zf = this.tiles.surfaceAt(this.x + dx * wb, this.y + dy * wb, this.gy, 1.0), zb = this.tiles.surfaceAt(this.x - dx * wb, this.y - dy * wb, this.gy, 1.0);
      const want = Math.abs(zf - zb) < wb * 0.9 ? Math.atan2(zf - zb, wb * 2) : (this.pitch || 0);
      this.pitch = (this.pitch || 0) + (want - (this.pitch || 0)) * Math.min(1, dt * 10);
    } else this.pitch = 0;
    if (this.air > 0) { this.gy += (target - this.gy) * Math.min(1, dt * 18); return; }
    if (target >= this.gy - slope) { this.gy += (target - this.gy) * Math.min(1, dt * 18); this.vy = 0; if (this.glide) this.landGlide(); }
    else {
      this.vy = (this.vy || 0) - 22 * dt;
      // falling on foot from high up (off a tower, out of the helicopter): the glider opens
      if (this.mode === 'foot' && !this.glide && this.gy - target > 7 && this.vy < -5) this.glide = true;
      if (this.glide) this.vy = Math.max(this.vy, -2.8 - Math.max(0, (this.gv || 12) - 12) * 0.35);
      this.gy = Math.max(target, this.gy + this.vy * dt); if (this.gy <= target) { this.vy = 0; if (this.glide) this.landGlide(); }
    }
  }
  // building walls only matter near the ground
  // up high (on a roof, gliding): the only walls are taller buildings; stages and other solid boxes everywhere
  collide(x, y, r) {
    if (this.gy - ground(this.x, this.y) > 3.5) {
      const rf = this.tiles.roofAt(x, y); if (rf != null && rf > this.gy + 0.6) return { x: this.x, y: this.y, hit: true };
      return blockPush(x, y, r, this.gy);
    }
    const c = this.tiles.collide(x, y, r), b = blockPush(c.x, c.y, r, this.gy);
    return { x: b.x, y: b.y, hit: c.hit || b.hit };
  }
  // on foot, the Karachi way: W/S/A/D (or the stick) move relative to the camera and you turn to face where you go
  walk(dt, inp, camH) {
    if (this.auto) {                 // scripted walk in a cutscene
      const a = this.auto, dx = a.x - this.x, dy = a.y - this.y, d = Math.hypot(dx, dy);
      if (d < 0.2) { this.v = 0; this.auto = null; if (a.res) a.res(); }
      else { const st = Math.min(d, a.sp * dt); this.x += dx / d * st; this.y += dy / d * st; this.v = a.sp; this.h += angDiff(this.h, Math.atan2(dx, dy)) * Math.min(1, dt * 10); }
      this.char.animate(dt, { speed: this.v, ...(this.act || {}) });
      return;
    }
    if (this.glide) {                // under the glider: always moving forward; steer, dive (forward) or float (back)
      this.h += (inp.x || 0) * 1.3 * dt; this.gv = 12 + Math.max(-1, Math.min(1, inp.y || 0)) * 5;
      const [gx, gy] = dirOf(this.h), c = this.collide(this.x + gx * this.gv * dt, this.y + gy * this.gv * dt, 0.45);
      if (c.hit) this.gv *= 0.5; this.x = c.x; this.y = c.y; this.v = this.gv; inp.jump = false;
      this.char.animate(dt, { glide: 1 }); return;
    }
    let sp = 2.6, running = false;
    const [fx, fy] = dirOf(camH), rx = fy, ry = -fx;                 // forward and right of the camera
    let mx = fx * inp.y + rx * inp.x, my = fy * inp.y + ry * inp.x;
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    const moving = l > 0.08;
    if (inp.sprint && moving) { sp = 5.4; running = true; }
    if (moving) this.h += angDiff(this.h, Math.atan2(mx, my)) * Math.min(1, dt * 12);
    this.v = moving ? Math.min(1, l) * sp : 0;
    const c = this.collide(this.x + mx * sp * dt, this.y + my * sp * dt, 0.45);
    this.x = c.x; this.y = c.y;
    if (inp.jump && !(this.air > 0)) { this.vy = 5.6; this.air = 0.001; }
    inp.jump = false;
    if (!moving && this.faceH != null) this.h += angDiff(this.h, this.faceH) * Math.min(1, dt * 6);
    if (moving) this.faceH = null;
    const step = this.char.animate(dt, { speed: this.v, run: running, ...(moving ? {} : this.act || {}) });
    if (step && this.onStep) this.onStep(running);
  }
  // driving, the Karachi way: steering turns the car at a fixed rate scaled by speed, Shift is the handbrake
  drive(dt, inp) {
    const car = this.car, bike = this.onBike, SP = bike ? { max: 50, accel: 14, steer: 2.7 } : { max: 55.6, accel: 12, steer: 1.9 };     // top speed 200 km/h (bikes 180)
    const hand = inp.sprint;
    if (inp.y > 0) { if (this.v < -0.5) this.v += SP.accel * 2.2 * dt; else this.v += SP.accel * inp.y * dt * (1 - Math.max(0, this.v) / SP.max); }
    else if (inp.y < 0) { if (this.v > 0.5) this.v -= SP.accel * 2.4 * dt; else this.v = Math.max(-5, this.v - SP.accel * 0.6 * dt); }
    else this.v *= Math.pow(0.55, dt);
    if (hand || inp.brake) this.v *= Math.pow(0.15, dt);
    const grip = Math.max(-1, Math.min(1, this.v / 5));
    // Karachi steering, with finer control near the middle of the stick and gentler turns at highway speed
    const sx = Math.sign(inp.x) * Math.pow(Math.abs(inp.x), inp.tx || inp.ty ? 1.6 : 1);
    const fast = 1 / (1 + Math.max(0, Math.abs(this.v) - 10) / 14);
    this.steer += (sx - this.steer) * Math.min(1, dt * 10);
    this.h += this.steer * SP.steer * (hand ? 1.6 : 1) * grip * fast * dt;
    const [dx, dy] = dirOf(this.h);
    let nx = this.x + dx * this.v * dt, ny = this.y + dy * this.v * dt;
    // circles along the car body
    let hit = false;
    for (const off of bike ? [0.6, -0.6] : [1.5, 0, -1.5]) {
      const cx = nx + dx * off, cy = ny + dy * off;
      const c = this.collide(cx, cy, bike ? 0.45 : 1.0);
      if (c.hit) { hit = true; nx += c.x - cx; ny += c.y - cy; }
    }
    if (hit) { if (Math.abs(this.v) > 5) { this.v *= -0.3; if (this.onCrash) this.onCrash(); } else this.v *= 0.9; }
    // guardrails and bridge railings: slide along them (a hard hit bounces you off)
    if (this.tiles.railHit) {
      const reach = (bike ? 0.9 : 2.3) * Math.sign(this.v || 1), mvx = nx - this.x, mvy = ny - this.y;
      const rail = this.tiles.railHit(this.x, this.y, nx + dx * reach, ny + dy * reach, this.gy) || this.tiles.railHit(this.x - dx * reach, this.y - dy * reach, nx, ny, this.gy);
      if (rail) {
        const along = mvx * rail[0] + mvy * rail[1], cosA = Math.abs(dx * rail[0] + dy * rail[1]);
        // push back a little from the rail, keep only the movement along it
        const nrx = -rail[1], nry = rail[0], side = Math.sign((this.x - nx) * nrx + (this.y - ny) * nry) || 1;
        nx = this.x + rail[0] * along + nrx * side * 0.05; ny = this.y + rail[1] * along + nry * side * 0.05;
        if (cosA < 0.8 && Math.abs(this.v) > 8) { this.v *= -0.25; if (this.onCrash) this.onCrash(); }
        else { this.v *= Math.pow(0.4 * (0.5 + 0.5 * cosA), dt); this.h += angDiff(this.h, Math.atan2(rail[0] * Math.sign(dx * rail[0] + dy * rail[1] || 1), rail[1] * Math.sign(dx * rail[0] + dy * rail[1] || 1))) * Math.min(1, dt * 4); }
      }
    }
    this.x = nx; this.y = ny;
    if (car.mesh.userData.wheels) spinWheels(car.mesh, this.v * dt, this.steer * 0.45);
    else car.mesh.children.forEach(o => { if (o.geometry && o.geometry.type === 'CylinderGeometry' && o.position.y < 0.6) o.rotation.x += this.v * dt / 0.36; });
  }
  // helicopter, the Karachi way: Space up, Shift down, W/S forward and back, A/D turn, F to get out on the ground
  landGlide() { this.glide = false; this.gv = 0; this.v = 0; if (this.onLand) this.onLand(); }
  heliFloor(x, y) { const r = this.tiles.roofAt ? this.tiles.roofAt(x, y) : null; return Math.max(ground(x, y), r ?? -1e9); }
  fly(dt, inp) {
    const v = this.heli, floor = this.heliFloor(v.x, v.y);
    v.rot = Math.min(1, (v.rot || 0) + dt * 0.6);
    const up = inp.up ? 1 : 0, down = inp.sprint ? 1 : 0, air = v.alt - floor > 0.4;
    let tvy = (up - down) * 7 * v.rot; if (!air && tvy < 0) tvy = 0;
    v.vy += (tvy - v.vy) * Math.min(1, dt * 2.2); if (v.rot < 0.8 && tvy > 0) v.vy = Math.min(v.vy, 0.3);
    v.alt = Math.max(floor, Math.min(400, v.alt + v.vy * dt));
    if (v.alt <= floor + 0.01) { if (v.vy < -5 && this.onCrash) this.onCrash(); v.vy = Math.max(0, v.vy); }
    const flying = v.alt - floor > 0.4 || (v.alt > floor + 0.1 && up);
    if (flying) { v.v += inp.y * (inp.y > 0 ? 19 : 14) * dt; v.h += inp.x * 1.5 * dt; }
    v.v *= Math.pow(flying ? 0.8 : 0.05, dt); v.v = Math.max(-15, Math.min(83.3, v.v));      // top speed 300 km/h
    const [dx, dy] = dirOf(v.h), nx = v.x + dx * v.v * dt, ny = v.y + dy * v.v * dt;
    if (v.alt < this.heliFloor(nx, ny) - 0.3) { if (Math.abs(v.v) > 6 && this.onCrash) this.onCrash(); v.v *= -0.25; } else { v.x = nx; v.y = ny; }
    v.pitch += ((flying ? inp.y * 0.2 + v.v * 0.004 : 0) - v.pitch) * Math.min(1, dt * 3);
    v.roll += ((flying ? inp.x * 0.28 : 0) - v.roll) * Math.min(1, dt * 3);
    v.spin = (v.spin || 0) + dt * 26 * v.rot;
    this.x = v.x; this.y = v.y; this.h = v.h; this.v = v.v; this.gy = v.alt;
    syncHeli(v);
  }
  enterHeli(hc) { this.seat = null; this.mode = 'heli'; this.heli = hc; hc.rot = hc.rot || 0; this.x = hc.x; this.y = hc.y; this.h = hc.h; this.v = 0; this.gy = hc.alt; this.sync(); }
  exitHeli() {
    const v = this.heli; if (!v) return false;
    const [dx, dy] = dirOf(v.h), floor = this.heliFloor(v.x, v.y);
    if (v.alt - floor > 0.7) {             // in the air: jump out (the glider opens as you fall); the helicopter comes down on its own
      this.mode = 'foot'; this.heli = null; v.falling = true; v.rot = Math.max(v.rot, 0.5);
      this.x = v.x - dy * 2.2; this.y = v.y + dx * 2.2; this.gy = v.alt - 0.5; this.vy = -6; this.v = 0; this.sync(); return 'eject';
    }
    this.mode = 'foot'; this.heli = null; v.v = 0; v.vy = 0;
    // step out beside it: onto the roof if it landed on one (or the ground)
    const sx = v.x - dy * 2.6, sy = v.y + dx * 2.6, onRoof = floor - ground(v.x, v.y) > 2;
    const c = onRoof ? { x: sx, y: sy } : this.tiles.collide(sx, sy, 0.45);
    this.x = c.x; this.y = c.y; this.gy = onRoof ? Math.max(this.heliFloor(c.x, c.y), floor - 0.2) : ground(this.x, this.y); if (onRoof && this.heliFloor(c.x, c.y) < floor - 1) { this.x = v.x - dy * 1.4; this.y = v.y + dx * 1.4; this.gy = floor; }
    this.v = 0; this.sync(); return true;
  }
  enter(car) {
    this.seat = null; this.onBike = car.mesh.userData.kind === 'bike'; if (car.mesh.userData.rider) { car.mesh.remove(car.mesh.userData.rider.g); car.mesh.userData.rider = null; }
    this.mode = 'car'; this.car = car; this.x = car.x; this.y = car.y; this.h = car.h; this.v = 0; car.player = true; lightsOn(car.mesh, true); this.sync();
  }
  exit() {
    const car = this.car; if (!car) return;
    car.player = false; car.parked = true; car.v = 0; lightsOn(car.mesh, false); car.mesh.rotation.z = 0; this.onBike = false; this.person.rotation.set(0, 0, 0);
    const [dx, dy] = dirOf(this.h);
    this.mode = 'foot'; this.car = null; this.v = 0;
    // step out on the driver's side (left)
    let ex = this.x - dy * 2.0, ey = this.y + dx * 2.0;
    const c = this.tiles.collide(ex, ey, 0.45); this.x = c.x; this.y = c.y; this.sync();
    return car;
  }
  get speedKmh() { return Math.abs(this.v) * 3.6; }
  // what the car's speedometer shows: the game world is compact, so the dial reads half (top speed shows 100)
  get dialKmh() { return this.speedKmh / 2; }
}
