// Shared materials. Built once; tiles reuse them.
import * as THREE from 'three';
import { facadeTexture, roadTexture, groundTexture, railTexture, nightWindowsTexture, doorTexture, sidewalkTexture, guardrailTexture } from './textures.js?v=11112231';

export const MAT = {};
// houses swapped for detailed models near you: the plain version folds away inside this circle (world x, world z, radius)
export const SWAP = { u: new THREE.Vector3(0, 0, 0) };
function swapShader(sh) {
  sh.uniforms.uSwap = { value: SWAP.u };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 hc;\nuniform vec3 uSwap;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (distance(hc, uSwap.xy) < uSwap.z) transformed = vec3(0.0);');
}
function swapped(m) { const c = m.clone(); c.userData = { ...m.userData }; c.onBeforeCompile = swapShader; c.customProgramCacheKey = () => 'swap'; return c; }

export function initMaterials() {
  // lit-window maps match each facade's window openings
  const NIGHT = {
    house: [[[18, 18, 28, 26]], 0.68, 'warm'], house_brick: [[[20, 12, 24, 22]], 0.68, 'warm'], house_stucco: [[[16, 16, 32, 28]], 0.68, 'warm'], house_stone: [[[18, 10, 28, 24]], 0.68, 'warm'],
    apt: [[[8, 10, 22, 34], [36, 14, 20, 24]], 0.5, 'warm'], comm: [[[8, 14, 48, 30]], 0.45, 'cool', true], shop: [[[2, 22, 60, 40]], 0.9, 'shop'], tower: [[[2, 4, 60, 52]], 0.55, 'cool', true],
  };
  const wall = (kind) => {
    const n = NIGHT[kind] || NIGHT.comm;
    const m = new THREE.MeshLambertMaterial({ map: facadeTexture(kind), vertexColors: true, emissive: 0xffffff, emissiveMap: nightWindowsTexture(...n), emissiveIntensity: 0 });
    m.userData.glow = kind === 'tower' ? 0.36 : kind === 'shop' ? 0.65 : kind === 'comm' ? 0.4 : 0.6;      // softer at night: windows, not floodlights
    return m;
  };
  MAT.wallHouse = wall('house');
  MAT.wallHouses = [MAT.wallHouse, wall('house_brick'), wall('house_stucco'), wall('house_stone')];
  MAT.wallApt = wall('apt');
  MAT.wallComm = wall('comm');
  MAT.wallShop = wall('shop');
  MAT.wallTower = wall('tower');
  MAT.walls = [...MAT.wallHouses, MAT.wallApt, MAT.wallComm, MAT.wallShop, MAT.wallTower];
  MAT.roof = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.wallHousesSwap = MAT.wallHouses.map(swapped); MAT.roofSwap = swapped(MAT.roof);
  MAT.walls.push(...MAT.wallHousesSwap);
  MAT.swapDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); MAT.swapDepth.onBeforeCompile = swapShader; MAT.swapDepth.customProgramCacheKey = () => 'swapd';
  MAT.concrete = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.doors = new THREE.MeshLambertMaterial({ map: doorTexture() });
  MAT.sidewalk = new THREE.MeshLambertMaterial({ map: sidewalkTexture(), polygonOffset: true, polygonOffsetFactor: -2.5, polygonOffsetUnits: -2.5 });
  MAT.drive = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.trunk = new THREE.MeshLambertMaterial({ color: 0xffffff });      // trunk colours come per tree (white birches)
  MAT.pole = new THREE.MeshLambertMaterial({ color: 0x8c9196 });
  MAT.guardrail = new THREE.MeshLambertMaterial({ map: guardrailTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  MAT.lamp = new THREE.MeshLambertMaterial({ color: 0x9a9a92, emissive: 0xffd9a0, emissiveIntensity: 0 });
  MAT.leaves = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  // night lighting on the towers: a coloured band around each crown, and coloured floodlights washing up the walls
  MAT.crown = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.wash = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // things the camera passes through (tree crowns, trunks) dissolve near the lens instead of filling the screen
  for (const m of [MAT.leaves, MAT.trunk]) nearFade(m, 1.5, 4.5);
  const gt = groundTexture('#ffffff', ['#d8d8d8', '#eeeeee', '#c8c8c8', '#f6f6f6']);
  MAT.ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: gt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  MAT.water = new THREE.MeshPhongMaterial({ color: 0x4f86b5, shininess: 80, specular: 0x8899aa, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.waterFlat = MAT.water;
  MAT.path = new THREE.MeshLambertMaterial({ map: roadTexture('path'), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.rail = new THREE.MeshLambertMaterial({ map: railTexture(), polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });   // drawn over roads at level crossings
  const road = (k, col) => new THREE.MeshLambertMaterial({ map: roadTexture(k), color: col || 0xffffff, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  MAT.road = { highway: road('highway'), major: road('major'), local: road('local'), runway: road('local', 0xb8b8b8) };
  MAT.base = new THREE.MeshLambertMaterial({ color: 0x93a86e, map: groundTexture('#ffffff', ['#e0dccb', '#f0ecd8', '#d2cfb8']) });
  // far-only copies for the city-wide layers: they sink out of sight near you, where the detailed tiles take over
  const far = mat => { const f = mat.clone(); f.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec4 wpF = modelMatrix * vec4(transformed, 1.0); float dF = distance(wpF.xz, cameraPosition.xz); transformed.y -= 30.0 * (1.0 - smoothstep(620.0, 980.0, dF)); }`); }; f.customProgramCacheKey = () => 'far'; return f; };
  MAT.baseFar = far(MAT.base); MAT.groundFar = far(MAT.ground); MAT.waterFar = far(MAT.water); MAT.far = far;
  return MAT;
}

// night: light up windows
export function setNight(k) {
  const on = Math.max(0, Math.min(1, (k - 0.35) / 0.4));      // lights come on at dusk
  for (const m of MAT.walls) m.emissiveIntensity = on * (m.userData.glow || 1);
  if (MAT.lamp) MAT.lamp.emissiveIntensity = on * 2.2;
  if (MAT.crown) { MAT.crown.opacity = on * 0.85; MAT.crown.visible = on > 0.02; }
  if (MAT.wash) { MAT.wash.opacity = on * 0.55; MAT.wash.visible = on > 0.02; }
  if (MAT.beacon) MAT.beacon.userData.on = on;
}

// screen-door fade for fragments closer than r1 to the camera (fully gone inside r0), so passing through a tree
// or a lamp post never blacks out the view
export function nearFade(mat, r0 = 1.5, r1 = 4.5) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `void main() {
  { float dC = length(vViewPosition); if (dC < ${r1.toFixed(2)}) { float a = smoothstep(${r0.toFixed(2)}, ${r1.toFixed(2)}, dC); float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (n > a) discard; } }`);
  };
  mat.customProgramCacheKey = () => 'nearfade' + r0 + '_' + r1;
}
