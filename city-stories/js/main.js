// YYC Story — a game by Hassan Ali. Main loop: renderer, sky, camera, game state.
import * as THREE from 'three';
import { initMaterials, setNight, MAT } from './materials.js';
import { setMaxAnisotropy } from './textures.js';
import { TileManager, SPEED_LIMIT, loadTreeModels, TREE_M } from './tiles.js';
import { buildWorldMeshes, prepLookups, communityAt, wardAt, loadSky3D } from './world.js';
import { Player, dirOf, angDiff, LOOKS } from './player.js';
import { Traffic } from './traffic.js';
import { Transit } from './transit.js';
import { Missions, P } from './missions.js';
import { initHUD, tilePaths, drawMinimap, openMap, closeMap, mapOpen, refreshMap, toast, setObjective, setPrompt, nextPressed, say, card, $ } from './hud.js';
import { initPhone, openPhone, closePhone, phoneOpen } from './phone.js';
import { initRealView, openReal, closeReal, realOpen } from './realview.js';
import { initInput, readInput, input, onAction } from './input.js';
import { makeCar } from './actors.js';
import { loadHero } from './rig.js';
import { loadHumans, humanReady, loadHuman, VIEW } from './humans.js';
import { loadHouses, loadCityHall, updateHouses, setHouseRange, LM_NIGHT, updateLandmarks } from './houses3d.js';
import { loadCars3D, makeCar3D } from './cars3d.js';
import { WARM } from './gltf.js';
import { Multiplayer } from './mp.js';
import { ask } from './ask.js';
import { initHealth, hurt, updateHealth } from './health.js';
import { buildPlatforms } from './platforms.js';
import { buildFuel } from './fuel.js';
import { Games } from './games.js';
import { Life } from './life.js';
import { loadVehicles, makeKarachiVehicle } from './vehicles.js';
import { sfx, unlockAudio, updateAudio } from './sound.js';
import { Sky } from './sky.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import { loadTerrain, ground } from './terrain.js';
import { loadBusinesses, Signs } from './business.js';
import { Requests311 } from './r311.js';
import { Leaves } from './leaves.js';
import { TrafficStops } from './stops.js';
import { Gatherings } from './gatherings.js';
import { loadPlazas, Plazas, PLAZA_NIGHT } from './plazas.js';
import { loadParks, ParkAssets, parksCredit } from './parks.js';
import { loadFields, Fields } from './fields.js';
import { loadLyrics, updateLyrics } from './lyrics.js';
import { GOOGLE_KEY } from './config.js';
import { music } from './music.js';
window.__music = music;
import { newHeli, idleHeli } from './heli.js';
import { Concert } from './concert.js';
import { Stampede, STAMPEDE } from './stampede.js';
import { Metro } from './metro.js';
import { Buses } from './buses.js';
import { Signals, loadSigns } from './signals.js';
import { HouseNumbers } from './numbers.js';
import { People } from './people.js';
import { initIntro } from './intro.js';
import { CHARACTERS } from './stories.js';
import { tr } from './i18n.js';
import { Billboards, loadBillboards } from './billboards.js';
import { Navigator, loadRoute } from './route.js';
import { setHalloweenNight } from './halloween.js';
import { setCarLightsNight } from './carlights.js';
import { QUALITY, guessQuality, DynRes, FpsMeter, GradeShader, setEnvNight } from './graphics.js';

const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const saved = (() => { try { return JSON.parse(localStorage.getItem('yyc-settings')) || {}; } catch (e) { return {}; } })();
// picture quality: Low / Medium / High, first guessed from the device (the first time, its shadows, glow and view distance too)
const Q0 = QUALITY[saved.q] ? saved.q : guessQuality(mobile);
if (!QUALITY[saved.q] && saved.v !== 2) { const P0 = QUALITY[Q0]; saved.shadows = P0.shadows; saved.glow = P0.glow; if (saved.v === 2) saved.radius = Math.min(saved.radius ?? P0.radius, P0.radius); }
const game = window.game = { mobile, input,
  paused: false, clock: 9.0, name: 'Ayaan', look: 'ayaan', waypoint: null, rideVehicle: null,
  settings: { v: 2, radius: saved.v === 2 ? (saved.radius ?? (mobile ? 2 : 3)) : Math.max(saved.radius || 0, mobile ? 2 : 3), shadows: saved.shadows ?? !mobile, photo: saved.photo ?? true, glow: saved.glow ?? true, q: Q0, fps: !!saved.fps },
};
game.key = (() => { try { return localStorage.getItem('yyc-gkey') || GOOGLE_KEY; } catch (e) { return GOOGLE_KEY; } })();
game.photoOn = false;          // the Google 3D city is not used in gameplay; the key is used for real street photos

// ---------------------------------------------------------------- renderer and scene
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
const dyn = new DynRes(renderer, () => composer); game.dyn = dyn; const fpsMeter = new FpsMeter(); fpsMeter.show(game.settings.fps);
const QP = () => QUALITY[game.settings.q] || QUALITY.medium;
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = game.settings.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); game.scene = scene; game.renderer = renderer;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 9000);
scene.fog = new THREE.Fog(0xbfd4e6, 500, 3200);
const sky = new Sky(scene); game.sky = sky;
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6250, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 900 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
scene.add(sun); scene.add(sun.target);
// night glow: windows, street lights and tower tops bloom softly after dusk (half resolution, off during the day)
let composer = null, bloom = null, grade = null;
dyn.setBase(Math.min(devicePixelRatio, QP().pr), QP().minScale);
function glowSetup() {
  if (composer) return;
  // on computers the picture keeps its anti-aliasing through the effects (4x MSAA)
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  composer = new EffectComposer(renderer, rt); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // any NaN pixel (a bad normal somewhere) would be smeared over the whole screen by the bloom: zero it first
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); if (!(c.r >= 0.0 && c.r < 1e4) || !(c.g >= 0.0 && c.g < 1e4) || !(c.b >= 0.0 && c.b < 1e4)) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = c; }' }));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.4, 0.86); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass(GradeShader); composer.addPass(grade);
}
game.setGlow = on => { game.settings.glow = on; saveSettings(); };
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); dyn.apply(); });

// the Rocky Mountains on the western horizon: a painted range on a curved band far away (three copies, the middle one mirrored)
function addMountains() {
  const R = 8200, A0 = 200, A1 = 350, N = 96, H = 760, B = -170, g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = (A0 + t * (A1 - A0)) * Math.PI / 180, x = Math.sin(a) * R, z = -Math.cos(a) * R, u = t * 3;
    pos.push(x, B, z, x, B + H, z); uv.push(u, 0, u, 1);
    if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 3, k, k + 3, k + 1); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const tex = new THREE.TextureLoader().load('data/mountains.webp'); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.MirroredRepeatWrapping; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  // the two outer ends fade into the haze
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.a *= smoothstep(0.0, 0.35, vMapUv.x) * smoothstep(3.0, 2.65, vMapUv.x);'); };
  const m = new THREE.Mesh(g, mat); m.renderOrder = -1; m.frustumCulled = false; scene.add(m); game.mountains = m;
}

// ---------------------------------------------------------------- loading
const status = t => { const l = $('#loading'); if (l) l.textContent = t; };
let world, tiles, player, traffic, transit, missions;
async function boot() {
  status('Loading the map of Calgary…');
  const r = await fetch('data/world.json'); world = await r.json(); game.world = world;
  for (const c of ['Ground heights: City of Calgary LiDAR bare-earth elevation model 2022–2024 (Open Government Licence – City of Calgary); outside the city, contains modified Copernicus DEM GLO-30 data (European Union, ESA)', 'Businesses and property types: City of Calgary business licences and property assessments, Open Government Licence – City of Calgary', 'Park benches, picnic tables, playgrounds, fountains and park signs: City of Calgary Parks open data, Open Government Licence – City of Calgary', 'Traffic signals and road signs: City of Calgary open data, Open Government Licence – City of Calgary', 'Ward boundaries and councillors: City of Calgary open data', 'Shops and restaurants: City of Calgary business licences and OpenStreetMap contributors', 'Sports fields (soccer, football, rugby, cricket): City of Calgary Parks Sport Surfaces open data, Open Government Licence – City of Calgary', 'People, animals, trees, homes, vehicles and landmarks (Historic City Hall, The Bow, Brookfield Place, Suncor Energy Centre, TELUS Sky, the Saddledome, Nelson Mandela High School, Real Canadian Superstores): 3D models made for this game; homes are fitted to the City of Calgary 3D building footprints and heights', '311 requests: City of Calgary 311 Service Requests open data (the last 14 days, refreshed every two weeks), Open Government Licence – City of Calgary; each icon is placed at a random spot in its community', 'Online play: positions and chat pass through the game server; voice chat goes straight between nearby players and is never recorded', 'Title song: "Under One Sky" by Hassan Ali', 'Song: "Beyond the Mask" by Hassan Ali', 'Dialogue voices: Kokoro (Apache License 2.0) and Meta MMS-TTS (CC BY-NC 4.0, non-commercial)', 'Stampede Park, its concerts and the midway are a game re-creation, not affiliated with the Calgary Stampede'])
    if (!world.credits.data.includes(c)) world.credits.data.push(c);
  $('#data-credits').innerHTML = world.credits.data.join('<br>');
  status('Building the city…');
  prepLookups(world); setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy()); initMaterials();
  status('Shaping the hills…'); await loadTerrain();
  buildWorldMeshes(scene, world); addMountains();
  if (world.b3d) { status('Raising the skyline…'); try { await loadSky3D(scene); } catch (e) { console.warn('sky3d', e); } }
  if (game.photoOn) {
    document.body.classList.add('photo');
    game.photo = null;
    renderer.shadowMap.enabled = false;
    scene.fog.near = 1500; scene.fog.far = 7000;
    for (const o of scene.children) if (o.name === 'world') o.visible = false;
    if (game.mountains) game.mountains.visible = false;
    status('Loading Google 3D city…');
  }
  status('Loading people and cars…');
  await Promise.all([loadHero(), loadVehicles(), loadBusinesses(), loadParks(), loadSigns(), loadBillboards(), loadFields(), loadLyrics(), loadTreeModels(), loadPlazas()]);
  tiles = new TileManager(scene, world, { radius: game.photoOn ? Math.max(1, game.settings.radius - 1) : game.settings.radius, meshes: !game.photoOn, onTile: (t, added) => { if (added) { tilePaths(t); buildFuel(t, tiles); } traffic && traffic.onTile(t, added); } });
  tiles.far = mobile ? 1 : 2; if (!game.photoOn) scene.fog.far = fogFar();
  game.tiles = tiles; game.signs = new Signs(scene, tiles); game.r311 = new Requests311(scene, camera, world, canvas, tiles); game.leaves = new Leaves(scene, tiles, mobile ? 60 : 220); game.plazas = new Plazas(scene);
  // compile the shaders of newly loaded models off to the side, so the first time one appears the game doesn't stall
  WARM.fn = obj => { obj.position.set(camera.position.x, -500, camera.position.z); obj.traverse(o => { o.frustumCulled = false; }); scene.add(obj);
    const done = () => scene.remove(obj); try { renderer.compileAsync(obj, camera, scene).then(done, done); } catch (e) { done(); } };
  // realistic people and homes arrive in the background; until then the simpler ones stand in
  loadHumans([(LOOKS[game.look] || {}).glb].filter(Boolean));
  if (!game.photoOn) { if (mobile) setHouseRange(110); loadHouses(tiles); loadCityHall(scene); }
  loadCars3D();
  game.parks = new ParkAssets(scene, { radius: mobile ? 300 : 420 });
  game.fields = new Fields(scene, { radius: mobile ? 320 : 450 });      // soccer, football, rugby and cricket fields
  game.concert = new Concert(scene, 385, -772, Math.PI, { crowd: mobile ? 14 : 28 });     // on the lawn north of the Saddledome, facing it
  game.stampede = new Stampede(scene, { mobile });                                            // it's Stampede time: the fair at Stampede Park and a street party at Olympic Plaza
  player = new Player(scene, tiles, game.look); game.player = player; player.parks = game.parks;
  player.onCrash = () => { if (performance.now() - (game._crash || 0) > 1500) { game._crash = performance.now(); toast('Bump! Careful.'); sfx.crash(); } };
  player.onStep = run => sfx.step(run);
  player.onPlace = () => { if (game.unstick) game.unstick.pending = true; };
  traffic = new Traffic(scene, tiles, world, { max: mobile ? 14 : 28, parked: mobile ? 16 : 32 }); game.traffic = traffic;
  transit = new Transit(scene, world, { bus: mobile ? 5 : 9, train: mobile ? 1 : 2 }); game.transit = transit; transit.cars = () => traffic.cars; traffic.transit = transit; game.stops = new TrafficStops(game, scene, traffic); game.gather = new Gatherings(game, scene);
  // trains ride on the track's own height; where a raised track's height isn't known (a gap in the data, a tile still
  // loading) they keep the height they had instead of dropping into the deck
  transit.groundY = (x, y, hint, rail) => { if (!rail) return tiles.surfaceAt(x, y, hint ?? ground(x, y), 1.5, 1); const s = tiles.surfaceAt(x, y, 0, 1e9, 3), g0 = ground(x, y); return hint != null && s < g0 + 0.3 && hint > g0 + 1 ? Math.max(s, hint - 0.01) : s; };
  missions = new Missions(game); game.missions = missions;
  game.metro = new Metro(game, { toast, setPrompt, sfx }); game.music = music;
  if (!game.photoOn) game.platforms = buildPlatforms(scene, world, transit);       // a platform to stand on at every CTrain station
  game.buses = new Buses(game, { toast, setPrompt, sfx });
  game.signals = new Signals(scene, traffic, { radius: mobile ? 180 : 260 }); game.billboards = new Billboards(scene); if (world.addr) game.numbers = new HouseNumbers(scene, tiles, { radius: 1 });
  initHealth(game); game.sfx = sfx; traffic.onHitPlayer = (v, nx, ny) => hurt(Math.min(100, 10 + v * 4), nx, ny, 'car');
  game.mp = new Multiplayer(game, scene);       // play online: other players, chat and voice near you
  game.games = new Games(game, scene); game.games.show(false);
  if (!game.photoOn) { game.life = new Life(game, scene, { mobile }); setTimeout(() => ['kid_boy', 'kid_girl', 'kid_boy2'].forEach(loadHuman), 8000); }     // children playing, rabbits and the odd bear in the parks
  game.people = new People(scene, tiles, { max: Math.round((mobile ? 8 : 16) * QP().crowd), maxDowntown: Math.round((mobile ? 18 : 40) * QP().crowd) });
  initHUD(world, game); initPhone(game); initRealView(game); initInput(canvas);
  game.updateMoney();
  intro.ready();
  status('');
  $('#btn-story').disabled = false; $('#btn-free').disabled = false; $('#btn-online').disabled = false;
  player.place(P.martinbrook.x, P.martinbrook.y, Math.PI / 2); camSnap();
  requestAnimationFrame(loop);
}
$('#btn-story').disabled = true; $('#btn-free').disabled = true;
// the intro: Calgary Insight presents -> YYC City Stories (the song from the chorus) -> language -> who you play
game.story = (() => { try { return localStorage.getItem('yyc-char') || 'ali'; } catch (e) { return 'ali'; } })();
game.look = game.story; game.name = (LOOKS[game.look] || LOOKS.ali).name;
const intro = initIntro({
  music, characters: CHARACTERS,
  onPick(key) {
    game.story = key; game.look = CHARACTERS[key].look; game.name = CHARACTERS[key].name;
    try { localStorage.setItem('yyc-char', key); } catch (e) { }
    if (player) player.setLook(game.look);
    if (missions) { missions.setStory(key); intro.storyLabel(missions.state.done.length > 0); }
  },
  get missions() { return missions; },
});
addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);
// back to the main menu (character choice) at any time; progress is saved as you go
$('#btn-menu').onclick = async () => { if (!(await ask(tr('menuAsk')))) return; location.hash = 'menu'; location.reload(); };
$('#btn-story').onclick = () => startGame('story');
$('#btn-free').onclick = () => startGame('free');
$('#btn-online').onclick = () => startGame('online');
function startGame(mode) {
  $('#title').hidden = true; $('#hud').hidden = false; game.started = true; intro.stop(); music.title(false);      // no song in the game until you get in a car
  setTimeout(() => game.buses.build(scene), 1200);
  game.clock = 21.0; game.dayN = 0;         // the game starts at night (a full-moon aurora night): the city lights are on and the Saddledome concert is playing
  // full screen on phones; inside the Calgary Insight page, that page goes full screen (so the browser names calgaryinsight.ca)
  if (mobile) {
    if (window.parent !== window) { try { window.parent.postMessage({ type: 'yyc-fullscreen' }, '*'); } catch (e) { } }
    else try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
  }
  const st = missions.state;
  if (mode === 'story') {
    const i = missions.nextIndex();
    if (i < 0) { toast('You have finished the story. Free roam!'); placeStart(); placeHeli(); return; }
    placeStart(i);                 // every story starts where its first (or next) mission begins
    missions.start(i);
  } else {
    placeStart(); if (mode === 'online') setObjective(tr('online'), 'Rival crews are out: first to 10 splats wins the round. Q switches weapon, F shoots.'); else setObjective(tr('freeTitle'), tr('freeText'));
    // free roam is online and peaceful (meet, ride together, race); 🌐 Play online adds the crews and the splat fights
    game.mode = 'free'; if (game.games) { game.games.show(true); game.games.setFight(mode === 'online'); }
    if (game.mp && !game.mp.on) { let n = ''; try { n = localStorage.getItem('yyc-mp-name') || ''; } catch (e) { } setTimeout(() => game.mp.join(n || undefined), 1500); }
  }
  placeHeli();                             // a helicopter next to you, whichever way you start
  setTimeout(() => { if (player.mode === 'foot' && game.heli && Math.hypot(game.heli.x - player.x, game.heli.y - player.y) > 60) placeHeli(); }, 2500);   // missions may move you first
}
function placeStart(i) {
  const m = i != null ? missions.list[i] : null;
  const at = m && m.startAt ? P[m.startAt] : game.story === 'chris' ? P.kerbyHome : missions.state.home ? P.home : P.martinbrook;
  player.mode = 'foot'; player.place(at.x + (m ? 6 : 0), at.y - (m ? 6 : 0), m ? 0 : Math.PI); camSnap(); game.unstick.pending = true;
  homeStreet();
}

// home, 78 Martinbrook Link NE: the family's cars parked along the street out front (the red Corolla, a white 2017 Kia
// Sorento, a brown 2008 Kia Rondo and an orange 2015 Hyundai Veloster), a maple in autumn colour on the front lawn and
// two little ones (a girl and a boy) playing on the grass. The cars come back whenever you return.
function homeSpot() {
  const H = P.home; let best = null;
  for (const p of traffic.pieces) {
    if (!/Martinbrook/i.test(p.name || '')) continue;
    let s0 = 0;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
      const u = Math.max(0, Math.min(1, ((H.x - a[0]) * dx + (H.y - a[1]) * dy) / (L * L))), px = a[0] + dx * u, py = a[1] + dy * u, d = Math.hypot(H.x - px, H.y - py);
      if (!best || d < best.d) best = { p, s: s0 + u * L, d, dx: dx / L, dy: dy / L, px, py };
      s0 += L;
    }
  }
  return best && best.d < 60 ? best : null;
}
function homeStreet() {
  const b = homeSpot(); if (!b) return false;
  const H = P.home, right = (H.x - b.px) * b.dy - (H.y - b.py) * b.dx > 0, dir = right ? 1 : -1;
  game.homeCars ||= [];
  const list = [['papurola', 'red', -4], ['sorento', null, 3.6], ['rondo', null, -11.6], ['veloster', null, 11]];
  list.forEach(([k, tint, off], i) => {
    const old = game.homeCars[i]; if (old && !old.dead) return;
    const mesh = k === 'papurola' ? makeKarachiVehicle('papurola', tint) : makeCar3D(k); if (!mesh) return;
    const s = Math.max(3, Math.min(b.p.len - 3, (dir > 0 ? b.s : b.p.len - b.s) + off));
    const c = { mesh, piece: b.p, dir, s, v: 0, parked: true, x: 0, y: 0, h: 0, gy: 0, home: true };
    traffic.place(c, b.p.w / 2 - 1.1); scene.add(mesh); traffic.cars.push(c); game.homeCars[i] = c;
  });
  game.familyCar = game.homeCars[0];
  // the lawn: halfway between the house and the street
  // 78's front lawn: between its frontage on the sidewalk (6734.2, 7887.5) and the house (6734.5, 7894.5), City address points
  const nl = Math.hypot(H.x - b.px, H.y - b.py) || 1, nx = (H.x - b.px) / nl, ny = (H.y - b.py) / nl, lx = 6734.3, ly = 7891.8;
  if (!game.homeTree && TREE_M.maple) {
    const tx = lx - 3.6, ty = ly - 1.2, t = new THREE.InstancedMesh(TREE_M.maple.geo, TREE_M.maple.mat, 1);
    t.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(tx, ground(tx, ty), -ty), new THREE.Quaternion(), new THREE.Vector3(3.2, 8, 3.2))); t.setColorAt(0, new THREE.Color(0.9, 0.22, 0.07)); t.castShadow = true; t.name = 'home maple'; scene.add(t); game.homeTree = t;
  }
  if (game.life) game.life.homeKids = { x: lx + 1.6, y: ly + 0.4 };
  return true;
}

// a helicopter waiting near where you start: on the street ahead of you, clear of houses
function placeHeli() {
  if (game.heli) { scene.remove(game.heli.mesh); game.heli = null; }
  const [dx, dy] = dirOf(player.h);
  let best = null;
  const tries = [];                        // in view ahead first, then anywhere close
  for (const a of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75]) for (const d of [16, 20, 26, 32, 40]) tries.push([d, a]);
  for (const a of [1.1, -1.1, 1.6, -1.6, 2.4, -2.4, 3.14]) for (const d of [12, 16, 22]) tries.push([d, a]);
  for (const [d, a] of tries) {
    const ca = Math.cos(a), sa = Math.sin(a), x = player.x + (dx * ca + dy * sa) * d, y = player.y + (dy * ca - dx * sa) * d;
    let clear = true; for (const [ox, oy] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [3.5, 3.5], [-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5]]) if (tiles.roofAt(x + ox, y + oy) != null) { clear = false; break; }
    if (clear) { best = { x, y }; break; }
  }
  if (!best) best = { x: player.x + dx * 15, y: player.y + dy * 15 };
  game.heli = newHeli(scene, best.x, best.y, player.h, ground(best.x, best.y));
  toast('🚁 Your helicopter is ready. Walk up to it and press F (🚗) to fly.', 5000);
}

// ---------------------------------------------------------------- ground height: the Google 3D surface in photo mode, flat otherwise
game.groundY = (x, y, hint) => {
  if (!game.photo) return tiles ? tiles.surfaceAt(x, y, hint ?? ground(x, y), 1.5) : ground(x, y);
  return game.photo.groundAt(x, y, hint == null ? 600 : hint + 4);
};
// ---------------------------------------------------------------- game helpers used by missions and HUD
game.nav = new Navigator(); setTimeout(loadRoute, 4000);
game.target = () => missions && missions.goal ? missions.goal : game.waypoint;
game.setWaypoint = (x, y) => { game.waypoint = { x, y }; if (game.buses) { game.buses.stopGuide(); game.buses.offer(x, y); } };
// people sleeping outside: a respectful check-in, and how to get them connected to help
let checking = false;
async function checkIn() {
  if (checking) return; checking = true;
  const lines = ['"I\'m okay, just cold. Thanks for asking."', '"Do you have any water? Thanks, friend."', '"Shelter\'s full tonight. I\'ll be alright."', '"Thanks for not walking past."'];
  await say('Person sheltering here', lines[Math.floor(Math.random() * lines.length)]);
  await card({ tag: 'Helping someone outside', title: 'Homelessness and addiction are health issues', src: [['Calgary Police: vulnerable persons (Alpha House HELP team)', 'https://www.calgary.ca/cps/community-programs-and-resources/vulnerable-persons/vulnerable-persons.html'], ['211 Alberta', 'https://ab.211.ca/']],
    body: `<ul><li>A kind word helps. Ask if they're okay and if they'd like help.</li><li><b>Alpha House HELP team</b> (formerly DOAP), 24/7: <b>403-998-7388</b>. Outreach workers who connect people to shelter, detox and care.</li><li><b>2-1-1</b>, call or text, 24/7: shelters, food and services.</li><li>Someone not breathing or not waking up could be an overdose: call <b>9-1-1</b>. Free <b>naloxone kits</b> are available at Alberta pharmacies.</li><li>Concerns about an encampment? Report it to <b>311</b>.</li></ul>` });
  checking = false;
}
// a parked car a mission can hand you (the road test car); get in with F
game.spawnCar = (x, y, h = 0, kind = 'family') => {
  const c = { mesh: makeCar(kind), x, y, h, v: 0, parked: true }; c.gy = ground(x, y);
  c.mesh.position.set(x, c.gy, -y); c.mesh.rotation.y = Math.PI - h; scene.add(c.mesh); traffic.cars.push(c); return c;
};
// quick travel: jump to a spot (on foot or in your car; a helicopter keeps flying above it)
game.groundAt = (x, y) => ground(x, y);      // for tests and tools
game.teleport = (x, y, h = player.h) => {
  if (player.mode === 'heli' && player.heli) { const v = player.heli; v.x = x; v.y = y; v.h = h; v.v = 0; v.alt = Math.max(v.alt, ground(x, y) + 60); player.x = x; player.y = y; }
  else { player.seat = null; player.air = 0; player.place(x, y, h); }
  tiles.update(x, y); camSnap(); game.unstick.pending = true;
};
// never stuck: whenever you land inside a building or boxed in by walls (a jump, a mission start, a bad spot on the map),
// or you keep pushing and can't move, step out to the nearest open spot you can walk away from
game.unstick = { t: 0, pending: true, push: 0, px: 0, py: 0, cool: 0 };
function watchStuck(dt, inp) {
  const U = game.unstick, p = player;
  if (U.cool > 0) U.cool -= dt;
  if (game.cine || p.auto || p.seat || !(p.mode === 'foot' || p.mode === 'car')) { U.push = 0; return; }
  if ((U.t -= dt) > 0) return; U.t = 0.4;
  if (!tiles.readyAt(p.x, p.y)) return;
  const pushing = Math.hypot(inp.x || 0, inp.y || 0) > 0.3, moved = Math.hypot(p.x - U.px, p.y - U.py); U.px = p.x; U.py = p.y;
  U.push = pushing && moved < 0.3 ? U.push + 0.4 : 0;
  const onRoof = p.mode === 'foot' && p.gy > ground(p.x, p.y) + 3;
  // under a roof but free to walk away (station canopies, overhangs, skywalks): not stuck
  const inside = p.mode === 'foot' && !onRoof && tiles.insideBuilding(p.x, p.y, p.gy) && !tiles.reaches(p.x, p.y, 0.45, 10, 600, false);
  // pushing into a wall you could walk away from is not being stuck: only rescue when boxed in
  const boxed = U.push >= 1.6 && U.cool <= 0 && !tiles.reaches(p.x, p.y, p.mode === 'car' ? 1.1 : 0.45, 6, 400, false);
  if (U.push >= 1.6 && !boxed) U.push = 0;
  if (!(U.pending || inside || boxed)) return;
  const jumped = U.pending; U.pending = false; U.push = 0;
  if (onRoof && !jumped) return;                          // you climbed or landed up there: that's fine
  const s = tiles.safeSpot(p.x, p.y, { r: p.mode === 'car' ? 1.1 : 0.45, pref: p.h, car: p.mode === 'car' });
  if (!s.moved && !(onRoof && jumped)) { U.cool = 4; return; }
  const h = Math.atan2(s.x - p.x, s.y - p.y);           // face away from where you were stuck
  if (p.mode === 'car') { p.x = s.x; p.y = s.y; p.h = h; p.v = 0; p.gy = ground(s.x, s.y); p.sync(); }
  else p.place(s.x, s.y, h);
  camSnap();
}
game.setWaypointRaw = p => { game.waypoint = p ? { x: p.x, y: p.y } : null; };
game.updateMoney = () => { $('#money').textContent = '$' + (missions ? missions.money : 40).toFixed(2); };
game.snapshot = () => { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', 0.7); };
game.camera = camera;
game.setRadius = r => { game.settings.radius = r; tiles.radius = r; scene.fog.far = fogFar(); saveSettings(); };
const fogFar = () => 1000 + (game.settings.radius + (tiles ? tiles.far : 1)) * 600;
game.setShadows = s => { game.settings.shadows = s; renderer.shadowMap.enabled = s; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); saveSettings(); };
game.setQuality = q => {
  const P1 = QUALITY[q]; if (!P1) return; game.settings.q = q;
  dyn.scale = 1; dyn.setBase(Math.min(devicePixelRatio, P1.pr), P1.minScale);
  if (game.settings.shadows !== P1.shadows) game.setShadows(P1.shadows);
  game.settings.glow = P1.glow; game.setRadius(P1.radius); saveSettings();
};
game.setFps = on => { game.settings.fps = on; fpsMeter.show(on); saveSettings(); };
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
// offer the real street photo of a place for a while after arriving
game.realOK = /github\.io$/.test(location.hostname) || location.hostname === 'localhost';   // the Google key only works on the published site
game.offerReal = (place) => {
  const b = $('#realbtn'); if (!game.key || !place || !game.realOK) return;
  b.hidden = false; b.textContent = '📷 See it for real: ' + (place.name || place.label);
  b.onclick = () => { b.hidden = true; openReal(place); };
  clearTimeout(game._realT); game._realT = setTimeout(() => { b.hidden = true; }, 20000);
};
game.openReal = openReal;

// ---------------------------------------------------------------- actions
onAction('vehicle', () => {
  if (game.started && !game.paused && game.ridePass && game.ridePass(player)) return;      // riding with another player
  if (!game.started || game.paused || player.mode === 'ride' || game.deadT > 0) return;
  if (player.mode === 'heli') {
    if (player.exitHeli()) { sfx.door(); $('#speed').hidden = true; } else toast('Land first: hold Shift (⚡) to go down.');
    return;
  }
  if (player.mode === 'foot' && game.heli && Math.hypot(game.heli.x - player.x, game.heli.y - player.y) < 6) {
    player.enterHeli(game.heli); sfx.door(); $('#speed').hidden = false; music.radio(true);
    toast(input.touch ? 'Helicopter! ⤴️ up · ⚡ down · stick: forward and turn · 🚗 get out (on the ground)' : 'Helicopter! Space: up · Shift: down · W/S: forward/back · A/D: turn · F: get out (on the ground)', 6000);
    return;
  }
  if (player.mode === 'foot') {
    const c = traffic.nearestCar(player.x, player.y, 5);
    if (c) { traffic.take(c); player.enter(c); sfx.enter(); music.radio(true); $('#speed').hidden = false; toast(c === game.familyCar ? 'The family car' : player.onBike ? 'On the motorbike. Helmet on, ride safely!' : 'Hopped in. Drive safely!'); }
    else toast('No car close by. Walk up to a parked car.');
  } else if (player.mode === 'car') { const c = player.exit(); traffic.release(c); sfx.enter(); $('#speed').hidden = true; }
});
document.querySelectorAll('[data-act=radio]').forEach(b => b.classList.toggle('off', music.radioOff));
const musicLabel = () => { const on = !music.radioOff, b = $('#btn-music'); b.textContent = on ? '🎵 Music: on' : '🔇 Music: off'; b.classList.toggle('off', !on); document.querySelectorAll('[data-act=radio]').forEach(x => x.classList.toggle('off', !on)); };
onAction('radio', () => {
  if (!game.started) return; const on = music.toggleRadio(); toast(on ? '🎵 Music on' : '🔇 Music off'); musicLabel();
});
$('#btn-music').onclick = e => { e.stopPropagation(); const on = music.toggleRadio(); toast(on ? '🎵 Music on' : '🔇 Music off'); musicLabel(); };
musicLabel();
onAction('heli', () => {                   // call the helicopter to where you are
  if (!game.started || player.mode !== 'foot') { toast('Get out first, then call the helicopter.'); return; }
  placeHeli(); sfx.blip();
});
onAction('horn', () => { if (game.started && player.mode === 'car') sfx.horn(player.onBike); });
onAction('interact', () => {
  if (nextPressed()) return; if (game.cine && missions.skipLine()) return; if (game.cine) return; if (!game.started) return; if (missions.interact()) return;
  if (game.metro.boardWait) { game.metro.boardWait(); return; }
  if (game.buses.boardWait) { game.buses.boardWait(); return; }
  if (player.mode === 'foot' && game.people && game.people.near) { checkIn(); return; }
  if (player.mode === 'foot' && !player.seat && !game.metro.trip && !missions.boardWait && game.metro.stationAt(player.x, player.y)) { game.metro.open(player.x, player.y); return; }
  if (player.mode === 'foot' && !player.seat && !game.buses.trip && !game.metro.trip && !missions.boardWait) { const bs = game.buses.stopAt(player.x, player.y); if (bs) { game.buses.open(bs); return; } }
  if (player.mode === 'foot') player.toggleSeat();
});
onAction('map', () => { if (!game.started) return; if (mapOpen()) closeMap(); else { if (phoneOpen()) closePhone(); openMap(); } });
onAction('phone', () => { if (!game.started) return; if (phoneOpen()) closePhone(); else openPhone(); });
onAction('back', () => { if (realOpen()) closeReal(); else if (mapOpen()) closeMap(); else if (phoneOpen()) closePhone(); });
onAction('missions', () => { if (!game.started || missions.active) return; const i = missions.nextIndex(); if (i >= 0) missions.start(i); });

// ---------------------------------------------------------------- camera
let camH = 0, camDist = 7, camPos = new THREE.Vector3(), camBack = null; const tmpV = new THREE.Vector3();
function camSnap() { camH = player.h; camPos.set(NaN, 0, 0); game._gyKnown = false; }
game.camSnap = () => camSnap();
function updateCamera(dt) {
  if (game.cineCam) {
    const c = game.cineCam, k = c.snap || camPos.x !== camPos.x ? 1 : Math.min(1, dt * 2.2);      // snap: the music video moves the camera itself
    if (!game._cineT) game._cineT = new THREE.Vector3(...c.t);
    camPos.lerp(tmpV.set(...c.p), k); if (camPos.x !== camPos.x) camPos.set(...c.p);
    game._cineT.lerp(tmpV.set(...c.t), k);
    camera.position.copy(camPos); camera.lookAt(game._cineT); return camH;
  }
  game._cineT = null;
  if (game.debugCam) { const d = game.debugCam, gy = player.gy; camera.position.set(d[0], d[2] + gy, -d[1]); camera.lookAt(d[3], d[5] + gy, -d[4]); return camH; }
  let fx = player.x, fy = player.y, fh = player.h, dist = 5.5, hgt = 2.0, look = 1.5;
  if (player.mode === 'car') { dist = player.onBike ? 6.5 : 8.5; hgt = 2.4; look = 1.3; }
  if (player.mode === 'heli') { dist = 14; hgt = 3.5; look = 2; }
  if (player.mode === 'ride' && game.rideVehicle) { const v = game.rideVehicle; fx = v.x; fy = v.y; fh = v.h; dist = v.rail ? 30 : 18; hgt = 5; look = 3; }
  const gy = player.mode === 'ride' && game.rideVehicle ? (game.rideVehicle.gy || 0) : player.gy;
  dist *= input.zoom;
  // the Karachi camera: drag to look; it swings back behind a vehicle after 1.2 s, and slowly behind you when you walk
  const since = (performance.now() - (input.lookTime || 0)) / 1000;
  if (input.camYaw) { camH += input.camYaw; input.camYaw = 0; }
  if (player.mode === 'car' || player.mode === 'heli' || player.mode === 'ride') { if (since > 1.2 && player.v > -1) camH += angDiff(camH, fh) * Math.min(1, dt * 2.6); }
  else if (player.mode === 'foot' && Math.abs(player.v) > 0.3 && since > 1.5) camH += angDiff(camH, fh) * Math.min(1, dt * 0.6);
  // pitch below ~0.08 keeps the camera low behind the player and tilts the view up, all the way to the sky
  const pitch = input.camPitch, pp = Math.max(pitch, 0.08), tilt = pp - pitch;
  const [dx, dy] = dirOf(camH);
  const near = 1 - Math.min(0.35, tilt * 0.3);
  const back = dist * Math.cos(pp) * near, up = dist * Math.sin(pp) + hgt * (1 - Math.min(0.5, tilt * 0.4));
  // don't let walls hide the player: pull the camera in front of the first building between it and you
  let backC = back;
  if (player.mode !== 'ride' && !(player.mode === 'heli' && gy - ground(fx, fy) > 8)) { const th = tiles.rayHit(fx, fy, fx - dx * back, fy - dy * back); if (th < 1) backC = Math.max(1.6, back * th - 0.8); }
  camBack = camBack == null ? backC : (backC < camBack ? backC : camBack + (backC - camBack) * Math.min(1, dt * 3));
  const want = new THREE.Vector3(fx - dx * camBack, up + gy, -(fy - dy * camBack));
  if (isNaN(camPos.x)) camPos.copy(want); else { camPos.lerp(want, Math.min(1, dt * 8)); const fwd = Math.hypot(camPos.x - fx, -camPos.z - fy); if (fwd > camBack + 0.5) { const k = (camBack + 0.5) / fwd; camPos.x = fx + (camPos.x - fx) * k; camPos.z = -fy + (camPos.z + fy) * k; } }
  // never under the ground or a bridge deck
  const floor = tiles.surfaceAt(camPos.x, -camPos.z, gy, 2) + 0.6; if (camPos.y < floor) camPos.y = floor;
  camera.position.copy(camPos);
  camera.lookAt(fx, look + gy, -fy);
  if (tilt > 0) camera.rotateX(tilt);
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
  sun.target.position.set(px, player ? player.gy : 0, -py); sun.position.y += player ? player.gy : 0;
  sun.color.setHSL(0.1, 0.6, 0.6 + day * 0.35);
  setNight(1 - day); setHalloweenNight(1 - day); game.day = day; LM_NIGHT.value = PLAZA_NIGHT.value = Math.max(0, Math.min(1, ((1 - day) - 0.35) / 0.4));
  game._sunDir = (game._sunDir || new THREE.Vector3()).copy(sun.position).sub(sun.target.position).normalize();
  game._skyArgs = [day, dusk];
  if (game.mountains) { const mc = game.mountains.material.color; mc.setRGB(0.2, 0.25, 0.38).lerp(tmp.setRGB(1, 1, 1), day); if (dusk > 0) mc.lerp(tmp.setRGB(1, 0.72, 0.6), dusk * 0.4); game.mountains.position.set(px, (player ? player.gy : 0) * 0.3, -py); }
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), hudT = 0, locT = 0, prevComm = null;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(game.dtMax || 0.05, (now - last) / 1000); last = now;
  input.onFoot = !!player && player.mode === 'foot';
  const inp = readInput();
  if (game.cine || game.deadT > 0) { inp.x = 0; inp.y = 0; inp.sprint = false; inp.jump = false; }
  const blocked = game.paused || mapOpen() || phoneOpen() || realOpen();
  if (game.started && player) watchStuck(dt, blocked ? { x: 0, y: 0 } : inp);       // runs during dialogs too, so you are never left inside a wall
  if (game.started && !blocked) {
    { const c0 = game.clock; game.clock = (game.clock + dt / 60) % 24; if (game.clock < c0) game.dayN = (game.dayN || 0) + 1; }
    player.update(dt, inp, camH);
    if (player.mode === 'ride' && game.rideVehicle) { player.x = game.rideVehicle.x; player.y = game.rideVehicle.y; }
    traffic.update(dt, player);
    transit.update(dt, player.x, player.y);
    if (game.stops) game.stops.update(dt, player.x, player.y);
    if (game.gather) game.gather.update(dt, player.x, player.y);
    { const V = []; for (const v of transit.vehicles) for (const m of v.parts) { const u = m.userData; V.push({ x: m.position.x, y: -m.position.z, h: Math.PI - m.rotation.y, L: u.L > 30 ? 24.8 : (u.L || 12), W: u.W || 2.6, v: v.v || 0, kind: v.rail ? 'train' : 'bus' }); } if (game.mp && game.mp.on) for (const o of game.mp.others.values()) if (o.car && o.vm !== 'heli') { const u = o.car.userData; V.push({ x: o.x, y: o.y, h: o.h, L: u.L || 4.5, W: u.W || 1.9, v: 0, kind: 'car' }); }      // other players' cars: solid
      updateHealth(dt, V); }
    missions.update(dt);
    for (const n of missions.npcs) { const ch = n.userData.char; if (ch) { const near = Math.hypot(n.position.x - player.x, -n.position.z - player.y) < 7; ch.animate(dt, { talk: near && !!missions.active }); } }
  }
  if (player && (game._hT = (game._hT || 0) - dt) <= 0) {      // the player's realistic model, once it has loaded
    game._hT = 1; const L = LOOKS[player.look];
    if (L && L.glb && !player.char.mixer && humanReady(L.glb)) { const hc = player.char.hatC; player.setLook(player.look); if (hc != null) player.char.setHat(hc); }
  }
  if (game.started) {
    updateHouses(dt, player.x, player.y, player.mode === 'heli' && player.gy - ground(player.x, player.y) > 18);
    if (game.platforms) game.platforms.update(dt, player.x, player.y);
    if (game.life) game.life.update(dt, player.x, player.y);
    if (game.mp) game.mp.update(dt, player, camH);
    if (game.games && game.mode === 'free') game.games.update(dt);
    let near = 0; for (const c of traffic.cars) if (!c.parked && Math.abs(c.x - player.x) < 120 && Math.abs(c.y - player.y) < 120) near++;
    const radio = player.mode === 'car' || player.mode === 'heli';
    updateAudio(dt, { driving: player.mode === 'car' && !blocked, bike: player.onBike, speed: player.v, throttle: Math.max(0, inp.y), day: game.day ?? 1, cars: near, foot: player.mode === 'foot', heli: player.mode === 'heli', rotor: game.heli ? game.heli.rot : 0, radio });
    music.radio(radio);
    const cLvl = game.concert ? game.concert.update(dt, player.x, player.y, game.clock) : 0, sLvl = game.stampede ? game.stampede.update(dt, player.x, player.y, game.clock) : 0;
    music.concert(Math.max(cLvl, sLvl));
    updateLyrics(Math.max(cLvl, sLvl), music.el, !!game.cine || game.paused);
    if (game.heli && player.mode !== 'heli') idleHeli(game.heli, dt);
  }
  music.update(dt);
  inp.jump = false;
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
  { const sp = player.mode === 'foot' ? 0 : player.v || 0, d = dirOf(player.h); tiles.update(player.x, player.y, d[0] * sp, d[1] * sp); }
  tiles.pumpFor(!game.started ? 40 : tiles.queue.length > 8 ? (mobile ? 10 : 14) : (mobile ? 5 : 8), player.x, player.y);
  if (game.started) game.signs.update(dt, player.x, player.y);
  if (game.started && game.r311 && player.mode !== 'heli') game.r311.update(dt, player.x, player.y);
  if (game.started && (game._homeT = (game._homeT || 0) - dt) <= 0) { game._homeT = 2; if (Math.hypot(player.x - P.home.x, player.y - P.home.y) < 320 && (!game.homeCars || game.homeCars.some(c => !c || c.dead) || !game.homeTree)) homeStreet(); }
  if (game.plazas) game.plazas.update(dt, player.x, player.y);
  if (game.started && game.leaves) game.leaves.update(dt, player.x, player.y, player.mode !== 'heli');
  if (game.started && game.parks) game.parks.update(dt, player.x, player.y);
  if (game.started && game.fields) game.fields.update(dt, player.x, player.y);
  if (game.started && game.signals) game.signals.update(dt, player.x, player.y);
  if (game.started && game.billboards) game.billboards.update(dt, player.x, player.y, (1 - (game.day ?? 1)) > 0.4);
  if (game.started && game.numbers && player.mode !== 'heli') game.numbers.update(dt, player.x, player.y);
  if (game.started && game.people) game.people.update(dt, player.x, player.y);
  if (game.started && traffic) {      // police and ambulance light bars flash red and blue
    const ph = Math.floor(now / 160) % 4;
    for (const c of traffic.cars) { const b = c.mesh.userData.beacons; if (b) { b[0].visible = ph === 0 || ph === 2; b[1].visible = ph === 1 || ph === 3; } }
  }
  updateCamera(dt); VIEW.copy(camera.position);
  updateSky(player.x, player.y);
  updateLandmarks(dt);
  sky.auroraNight = ((game.dayN || 0) - (game.clock % 24 < 12 ? 1 : 0)) % 2 === 0;
  sky.update(camera, game._skyArgs[0], game._skyArgs[1], game._sunDir, scene.fog.color, dt);
  if (game.photo) game.photo.update(player.x, player.y);
  const night = 1 - (game.day ?? 1); setCarLightsNight(night);
  if (world.towerGlow) world.towerGlow(night, now / 1000);
  setEnvNight(night); dyn.tick(dt); fpsMeter.tick(dt, () => `${QP().name} · ${Math.round(renderer.getPixelRatio() * 100)}% · ${renderer.info.render.calls} draws`);
  const glowOn = game.settings.glow && night > 0.3, gradeOn = QP().grade;
  if (glowOn || gradeOn) {
    glowSetup(); bloom.enabled = glowOn; if (glowOn) bloom.strength = Math.min(1, (night - 0.3) * 2) * 0.32;
    grade.enabled = gradeOn; if (gradeOn) { const u = grade.uniforms; u.uTone.value = 1 - night * 0.5; u.uContrast.value = 0.4 - night * 0.15; u.uSat.value = 1.22 + night * 0.04; u.uVig.value = 0.32 + night * 0.12; }
    composer.render(dt);
  } else renderer.render(scene, camera);
  if (!game.started) return;
  // HUD
  if (now - hudT > 90) {
    hudT = now;
    const icons = []; if (game.heli && player.mode !== 'heli') icons.push({ x: game.heli.x, y: game.heli.y, e: '🚁' });
    if (game.concert && (game.clock >= 19 || game.clock < 3)) icons.push({ x: game.concert.x, y: game.concert.y, e: '🎤' });
    icons.push({ x: STAMPEDE.x, y: STAMPEDE.y + 200, e: '🎡' });
    if (game.billboards) { let best = null, bd = 3000; for (const b of game.billboards.items) { const d = Math.hypot(b.x - player.x, b.y - player.y); if (d < bd) { bd = d; best = b; } } if (best) icons.push({ x: best.x, y: best.y, e: '🪧' }); }
    const nv = game.nav.ver; game.nav.update(0.09, player, game.target()); if (nv !== game.nav.ver) refreshMap();
    game.buses.tick();
    drawMinimap(player, tiles, camH, game.target(), icons, game.nav, !!(missions && missions.goal));
    if (player.mode === 'heli') { $('#speed').innerHTML = Math.round(player.speedKmh) + ' km/h <small style="opacity:.8">· ' + Math.round(player.gy - ground(player.x, player.y)) + ' m up</small>'; $('#speed').style.color = ''; }
    if (player.mode === 'car') { const st = tiles.streetAt(player.x, player.y, 25), lim = st ? SPEED_LIMIT[st.kind] : null, kmh = Math.round(player.dialKmh); $('#speed').innerHTML = kmh + ' km/h' + (lim ? ` <small style="opacity:.8">· limit ${lim}</small>` : ''); $('#speed').style.color = lim && kmh > lim + 5 ? '#ff6b5b' : ''; }
    $('#btn-music').hidden = !(player.mode === 'car' || player.mode === 'heli');
    const hh = Math.floor(game.clock), mm = Math.floor((game.clock - hh) * 60);
    $('#clock').textContent = `${(hh % 12) || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
    // prompts
    if (player.mode === 'foot' && !missions.boardWait) {
      const nearHeli = game.heli && Math.hypot(game.heli.x - player.x, game.heli.y - player.y) < 6;
      const c = !nearHeli && traffic.nearestCar(player.x, player.y, 5), seat = !c && !nearHeli && !player.seat && game.parks && game.parks.seatNear(player.x, player.y);
      const stn = !nearHeli && !c && !game.metro.trip && !game.metro.boardWait && game.metro.stationAt(player.x, player.y);
      const bstop = !nearHeli && !c && !stn && !game.buses.trip && !game.buses.boardWait && game.buses.stopAt(player.x, player.y);
      if (game.metro.boardWait || game.buses.boardWait) { /* the board prompt is already showing */ }
      else if (bstop && !(game.people && game.people.near)) setPrompt(`Press E (✋) to catch a bus at ${bstop.name}`);
      else setPrompt(game.people && game.people.near ? 'Press E (✋) to check in on them' : nearHeli ? 'Press F (🚗) to fly the helicopter' : stn ? `Press E (✋) to take the CTrain from ${stn.name}` : c ? (c.mesh.userData.kind === 'bike' ? 'Press F (🚗) to ride the motorbike' : 'Press F (🚗) to get in the car') : player.seat ? 'Move or press E (✋) to get up' : seat ? (seat.kind === 'table' ? 'Press E (✋) to sit at the picnic table' : 'Press E (✋) to sit on the bench') : null);
    }
    else if (player.mode === 'car') setPrompt(null);
    const tg = game.target(); if (tg && !missions.goal && game.waypoint && !game.waypoint.guide) { const d = Math.hypot(tg.x - player.x, tg.y - player.y); if (d < 30) { game.waypoint = null; toast('You reached your waypoint'); } }
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
    if (name !== prevComm && prevComm !== null && cm) { const w = wardAt(world, player.x, player.y); toast(w ? `Welcome to ${name} · Ward ${w.n}` : `Welcome to ${name}`, 2200); }
    prevComm = name;
  }
}

boot().catch(e => { console.error(e); status('Could not load the city: ' + e.message); });
