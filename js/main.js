// YYC Story — a game by Hassan Ali. Main loop: renderer, sky, camera, game state.
import * as THREE from 'three';
import { initMaterials, setNight, MAT } from './materials.js';
import { TileManager } from './tiles.js';
import { buildWorldMeshes, prepLookups, communityAt, wardAt } from './world.js';
import { Player, dirOf, angDiff, LOOKS } from './player.js';
import { Traffic } from './traffic.js';
import { Transit } from './transit.js';
import { Missions, P } from './missions.js';
import { initHUD, tilePaths, drawMinimap, openMap, closeMap, mapOpen, toast, setObjective, setPrompt, nextPressed, $ } from './hud.js';
import { initPhone, openPhone, closePhone, phoneOpen } from './phone.js';
import { initInput, readInput, input, onAction } from './input.js';
import { makeCar } from './actors.js';
import { GOOGLE_KEY } from './config.js';
import { PhotoCity } from './photo.js';

const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const saved = (() => { try { return JSON.parse(localStorage.getItem('yyc-settings')) || {}; } catch (e) { return {}; } })();
const game = window.game = { input,
  paused: false, clock: 9.0, name: 'Ayaan', look: 'ayaan', waypoint: null, rideVehicle: null,
  settings: { radius: saved.radius ?? (mobile ? 1 : 2), shadows: saved.shadows ?? !mobile, photo: saved.photo ?? true },
};
game.key = (() => { try { return localStorage.getItem('yyc-gkey') || GOOGLE_KEY; } catch (e) { return GOOGLE_KEY; } })();
game.photoOn = !!game.key && game.settings.photo && !/[?&]map\b/.test(location.search);

// ---------------------------------------------------------------- renderer and scene
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = game.settings.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); game.scene = scene;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 9000);
scene.fog = new THREE.Fog(0xbfd4e6, 500, 3200);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6250, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 900 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
scene.add(sun); scene.add(sun.target);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// the Rocky Mountains on the western horizon
function addMountains() {
  const g = new THREE.BufferGeometry(), pos = [], col = [], R = 8200, N = 160;
  const rnd = (i) => { const s = Math.sin(i * 91.7) * 43758.5; return s - Math.floor(s); };
  for (let i = 0; i < N; i++) {
    const a0 = (205 + i * (140 / N)) * Math.PI / 180, a1 = (205 + (i + 1) * (140 / N)) * Math.PI / 180;
    const f = Math.sin(i / N * Math.PI);
    const h0 = 40 + f * (90 + rnd(i) * 150) * (0.6 + 0.4 * rnd(i * 3)), h1 = 40 + f * (90 + rnd(i + 1) * 150) * (0.6 + 0.4 * rnd(i * 3 + 3));
    const p = (a, h) => [Math.sin(a) * R, h, -Math.cos(a) * R];
    const b0 = p(a0, -50), b1 = p(a1, -50), t0 = p(a0, h0), t1 = p(a1, h1);
    pos.push(...b0, ...b1, ...t1, ...b0, ...t1, ...t0);
    const c0 = [0.42, 0.48, 0.58], cs = [0.93, 0.95, 0.98];
    const top = h => (h > 150 ? cs : [0.55, 0.6, 0.7]);
    col.push(...c0, ...c0, ...top(h1), ...c0, ...top(h1), ...top(h0));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }));
  m.renderOrder = -1; scene.add(m); game.mountains = m;
}

// ---------------------------------------------------------------- loading
const status = t => { const l = $('#loading'); if (l) l.textContent = t; };
let world, tiles, player, traffic, transit, missions;
async function boot() {
  status('Loading the map of Calgary…');
  const r = await fetch('data/world.json'); world = await r.json(); game.world = world;
  $('#data-credits').innerHTML = world.credits.data.join('<br>');
  status('Building the city…');
  prepLookups(world); initMaterials();
  buildWorldMeshes(scene, world); addMountains();
  if (game.photoOn) {
    document.body.classList.add('photo');
    game.photo = new PhotoCity(scene, camera, renderer, world, game.key, { errorTarget: mobile ? 10 : 5 });
    renderer.shadowMap.enabled = false;
    scene.fog.near = 1500; scene.fog.far = 7000;
    for (const o of scene.children) if (o.name === 'world') o.visible = false;
    if (game.mountains) game.mountains.visible = false;
    status('Loading Google 3D city…');
  }
  tiles = new TileManager(scene, world, { radius: game.photoOn ? Math.max(1, game.settings.radius - 1) : game.settings.radius, meshes: !game.photoOn, onTile: (t, added) => { if (added) tilePaths(t); traffic && traffic.onTile(t, added); } });
  game.tiles = tiles;
  player = new Player(scene, tiles, game.look); game.player = player;
  player.onCrash = () => { if (performance.now() - (game._crash || 0) > 1500) { game._crash = performance.now(); toast('Bump! Careful.'); } };
  traffic = new Traffic(scene, tiles, world, { max: mobile ? 14 : 28, parked: mobile ? 10 : 18 }); game.traffic = traffic;
  transit = new Transit(scene, world, { bus: mobile ? 2 : 4, train: mobile ? 1 : 2 }); game.transit = transit;
  traffic.groundY = transit.groundY = game.groundY;
  missions = new Missions(game); game.missions = missions;
  initHUD(world, game); initPhone(game); initInput(canvas);
  game.updateMoney();
  const has = missions.state.done.length > 0;
  $('#btn-story').textContent = has ? 'Continue the story' : 'Start the story';
  status('');
  $('#btn-story').disabled = false; $('#btn-free').disabled = false;
  player.place(P.downtownStop.x, P.downtownStop.y, Math.PI); camSnap();
  requestAnimationFrame(loop);
}
$('#btn-story').disabled = true; $('#btn-free').disabled = true;
document.querySelectorAll('.who-btn').forEach(b => b.onclick = () => {
  document.querySelectorAll('.who-btn').forEach(x => x.classList.toggle('on', x === b));
  game.look = b.dataset.look; game.name = LOOKS[game.look].name; if (player) player.setLook(game.look);
});
$('#btn-story').onclick = () => startGame('story');
$('#btn-free').onclick = () => startGame('free');
function startGame(mode) {
  $('#title').hidden = true; $('#hud').hidden = false; game.started = true;
  try { document.documentElement.requestFullscreen && mobile && document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
  const st = missions.state;
  if (mode === 'story') {
    const i = missions.nextIndex();
    if (i < 0) { toast('You have finished the story. Free roam!'); placeStart(); return; }
    if (i > 0) placeStart(i);
    missions.start(i);
  } else { placeStart(); setObjective('Free roam', 'Explore the real Calgary. Press M for the map, P for your phone.'); }
}
function placeStart(i) {
  const m = i != null ? missions.list[i] : null;
  const at = m && m.startAt ? P[m.startAt] : missions.state.home ? P.home : { x: -352, y: -40 };
  player.mode = 'foot'; player.place(at.x + (m ? 6 : 0), at.y - (m ? 6 : 0), m ? 0 : Math.PI); camSnap();
  // a family car outside home
  if (missions.state.home && Math.hypot(player.x - P.home.x, player.y - P.home.y) < 200 && !game.familyCar) {
    const spot = game.findRoadSpot(P.home.x, P.home.y, 0, 60);
    if (spot) { const c = { mesh: makeCar('suv', 0x1d3f7a), x: spot.x, y: spot.y, h: spot.h, v: 0, parked: true }; c.mesh.position.set(c.x, 0, -c.y); c.mesh.rotation.y = Math.PI - c.h; scene.add(c.mesh); traffic.cars.push(c); game.familyCar = c; }
  }
}

// ---------------------------------------------------------------- ground height: the Google 3D surface in photo mode, flat otherwise
game.groundY = (x, y, hint) => {
  if (!game.photo) return 0;
  return game.photo.groundAt(x, y, hint == null ? 600 : hint + 4);
};
// ---------------------------------------------------------------- game helpers used by missions and HUD
game.target = () => missions && missions.goal ? missions.goal : game.waypoint;
game.setWaypoint = (x, y) => { game.waypoint = { x, y }; };
game.setWaypointRaw = p => { game.waypoint = p ? { x: p.x, y: p.y } : null; };
game.updateMoney = () => { $('#money').textContent = '$' + (missions ? missions.money : 40).toFixed(2); };
game.snapshot = () => { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', 0.7); };
game.setRadius = r => { game.settings.radius = r; tiles.radius = r; scene.fog.far = 1600 + r * 800; saveSettings(); };
game.setShadows = s => { game.settings.shadows = s; renderer.shadowMap.enabled = s; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); saveSettings(); };
function saveSettings() { try { localStorage.setItem('yyc-settings', JSON.stringify(game.settings)); } catch (e) { } }
game.findRoadSpot = (x, y, dmin, dmax) => {
  let best = null;
  for (const p of traffic.pieces) {
    if (p.kind !== 6) continue;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, d = Math.hypot(mx - x, my - y);
      if (d >= dmin && d <= dmax && (!best || Math.abs(d - (dmin + dmax) / 2) < best.score)) best = { x: mx, y: my, h: Math.atan2(b[0] - a[0], b[1] - a[1]), score: Math.abs(d - (dmin + dmax) / 2) };
    }
  }
  return best;
};
game.addPothole = (x, y) => {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.3, 18), new THREE.MeshLambertMaterial({ color: 0x1c1c1c })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.23; hole.scale.set(1.3, 0.8, 1); g.add(hole);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 10), new THREE.MeshLambertMaterial({ color: 0xff6a00 })); cone.position.set(1.8, 0.4, 0); g.add(cone);
  g.position.set(x, game.groundY(x, y, player.gy) ?? player.gy, -y); scene.add(g); return g;
};
game.removePothole = g => scene.remove(g);
game.camSnap = camSnap;

// ---------------------------------------------------------------- actions
onAction('vehicle', () => {
  if (!game.started || game.paused || player.mode === 'ride') return;
  if (player.mode === 'foot') {
    const c = traffic.nearestCar(player.x, player.y, 5);
    if (c) { traffic.take(c); player.enter(c); $('#speed').hidden = false; toast(c === game.familyCar ? 'The family car' : 'Hopped in. Drive safely!'); }
    else toast('No car close by. Walk up to a parked car.');
  } else if (player.mode === 'car') { const c = player.exit(); traffic.release(c); $('#speed').hidden = true; }
});
onAction('interact', () => { if (nextPressed()) return; if (!game.started) return; if (missions.interact()) return; });
onAction('map', () => { if (!game.started) return; if (mapOpen()) closeMap(); else { if (phoneOpen()) closePhone(); openMap(); } });
onAction('phone', () => { if (!game.started) return; if (phoneOpen()) closePhone(); else openPhone(); });
onAction('back', () => { if (mapOpen()) closeMap(); else if (phoneOpen()) closePhone(); });
onAction('missions', () => { if (!game.started || missions.active) return; const i = missions.nextIndex(); if (i >= 0) missions.start(i); });

// ---------------------------------------------------------------- camera
let camH = 0, camDist = 7, camPos = new THREE.Vector3();
function camSnap() { camH = player.h; camPos.set(NaN, 0, 0); game._gyKnown = false; }
function updateCamera(dt) {
  if (game.debugCam) { const d = game.debugCam, gy = player.gy; camera.position.set(d[0], d[2] + gy, -d[1]); camera.lookAt(d[3], d[5] + gy, -d[4]); return camH; }
  let fx = player.x, fy = player.y, fh = player.h, dist = 7.5, hgt = 2.2, look = 1.6;
  if (player.mode === 'car') { dist = 11; hgt = 2.6; look = 1.4; }
  if (player.mode === 'ride' && game.rideVehicle) { const v = game.rideVehicle; fx = v.x; fy = v.y; fh = v.h; dist = v.rail ? 30 : 18; hgt = 5; look = 3; }
  const gy = player.mode === 'ride' && game.rideVehicle ? (game.rideVehicle.gy || 0) : player.gy;
  dist *= input.zoom;
  const manual = performance.now() - (input.lookTime || 0) < 2500;
  const follow = player.mode !== 'foot' || (Math.abs(player.v) > 0.5 && !(input.tx || input.ty)) || (Math.abs(player.v) > 0.5 && Math.hypot(input.tx, input.ty) > 0.2 && Math.abs(input.ty) > 0.6);
  if (input.camYaw) { camH += input.camYaw; input.camYaw = 0; }
  if (follow && !manual) camH += angDiff(camH, fh + (player.v < -0.5 && player.mode === 'car' ? 0 : 0)) * Math.min(1, dt * (player.mode === 'car' ? 2.5 : 1.8));
  const pitch = input.camPitch;
  const [dx, dy] = dirOf(camH);
  const back = dist * Math.cos(pitch), up = dist * Math.sin(pitch) + hgt;
  const want = new THREE.Vector3(fx - dx * back, up + gy, -(fy - dy * back));
  if (isNaN(camPos.x)) camPos.copy(want); else camPos.lerp(want, Math.min(1, dt * 8));
  camera.position.copy(camPos);
  camera.lookAt(fx, look + gy, -fy);
  return camH;
}

// ---------------------------------------------------------------- sky and time of day (sun from the south, Calgary latitude)
const skyDay = new THREE.Color(0x9cc7ee), skyDusk = new THREE.Color(0xf0a27a), skyNight = new THREE.Color(0x0b1424), tmp = new THREE.Color();
function updateSky(px, py) {
  const h = game.clock % 24;
  const elev = Math.sin((h - 6) / 12 * Math.PI);           // >0 day
  const az = (h - 12) / 12 * Math.PI;                       // sun moves east -> south -> west
  const day = Math.max(0, Math.min(1, elev * 3 + 0.25)), dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (h > 4 && h < 21 ? 1 : 0);
  tmp.copy(skyNight).lerp(skyDay, day).lerp(skyDusk, dusk * 0.6);
  scene.background = tmp.clone(); scene.fog.color.copy(tmp).lerp(new THREE.Color(0xffffff), 0.12 * day);
  sun.intensity = 0.15 + day * 2.4; hemi.intensity = 0.35 + day * 1.3;
  const e = Math.max(0.15, elev);
  sun.position.set(px + Math.sin(az) * 300, 120 + e * 380, -py + Math.cos(az) * 300);
  sun.target.position.set(px, 0, -py);
  sun.color.setHSL(0.1, 0.6, 0.6 + day * 0.35);
  setNight(1 - day);
  if (game.mountains) game.mountains.material.opacity = 0.3 + day * 0.5;
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), hudT = 0, locT = 0, prevComm = null;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const inp = readInput();
  const blocked = game.paused || mapOpen() || phoneOpen();
  if (game.started && !blocked) {
    game.clock = (game.clock + dt / 60) % 24;
    player.update(dt, inp, camH);
    if (player.mode === 'ride' && game.rideVehicle) { player.x = game.rideVehicle.x; player.y = game.rideVehicle.y; }
    traffic.update(dt, player);
    transit.update(dt, player.x, player.y);
    missions.update(dt);
  }
  if (game.photo) {
    if ((game._gT = (game._gT || 0) - dt) <= 0 || player.mode === 'car') {
      game._gT = 0.1;
      const g = game.photo.groundAt(player.x, player.y, game._gyKnown ? player.gy + (player.mode === 'car' ? 3 : 2.2) : 700);
      if (g != null) { player.gy = game._gyKnown ? player.gy + (g - player.gy) * 0.5 : g; game._gyKnown = true; }
    }
    player.sync();
    if (missions && missions.marker.visible) missions.marker.position.y = player.gy;
    for (const n of (missions ? missions.npcs : [])) if (!n.userData.gy) { const g = game.groundY(n.position.x, -n.position.z, null); if (g != null) { n.position.y = g; n.userData.gy = true; } }
  }
  tiles.update(player.x, player.y);
  tiles.pump(); if (tiles.queue.length > 6) tiles.pump();
  updateCamera(dt);
  updateSky(player.x, player.y);
  if (game.photo) game.photo.update(player.x, player.y);
  renderer.render(scene, camera);
  if (!game.started) return;
  // HUD
  if (now - hudT > 90) {
    hudT = now;
    drawMinimap(player, tiles, camH, game.target());
    if (player.mode === 'car') $('#speed').textContent = Math.round(player.speedKmh) + ' km/h';
    const hh = Math.floor(game.clock), mm = Math.floor((game.clock - hh) * 60);
    $('#clock').textContent = `${(hh % 12) || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
    // prompts
    if (player.mode === 'foot' && !missions.boardWait) { const c = traffic.nearestCar(player.x, player.y, 5); setPrompt(c ? 'Press F (🚗) to get in the car' : null); }
    else if (player.mode === 'car') setPrompt(null);
    const tg = game.target(); if (tg && !missions.goal && game.waypoint) { const d = Math.hypot(tg.x - player.x, tg.y - player.y); if (d < 30) { game.waypoint = null; toast('You reached your waypoint'); } }
  }
  if (now - locT > 700) {
    locT = now;
    if (game.photo) {
      $('#gattr-data').textContent = game.photo.attributions();
      game._photoT = (game._photoT || now);
      if (!game._warned && (game.photo.failed || (!game.photo.ready && now - game._photoT > 45000))) {   // fall back to the map-drawn city
        game._warned = true; toast('The Google 3D city could not load here, so the map-drawn city is shown instead.', 6000);
        setTimeout(() => location.replace(location.pathname + '?map'), 2500);
      }
    }
    const cm = communityAt(world, player.x, player.y);
    const name = cm ? cm.n : 'Outside the city';
    $('#loc-comm').textContent = name;
    const st = tiles.streetAt(player.x, player.y, 35);
    $('#loc-street').textContent = st ? st.name : '';
    if (name !== prevComm && prevComm !== null && cm) { const w = wardAt(world, player.x, player.y); toast(`Welcome to ${name}${w ? ' · Ward ' + w.n : ''}`, 2200); }
    prevComm = name;
  }
}

boot().catch(e => { console.error(e); status('Could not load the city: ' + e.message); });
