// Shared materials. Built once; tiles reuse them.
import * as THREE from 'three';
import { facadeTexture, roadTexture, groundTexture, railTexture, nightWindowsTexture } from './textures.js';

export const MAT = {};

export function initMaterials() {
  const night = nightWindowsTexture();
  const wall = (kind) => {
    const m = new THREE.MeshLambertMaterial({ map: facadeTexture(kind), vertexColors: true, emissive: 0xffffff, emissiveMap: night, emissiveIntensity: 0 });
    return m;
  };
  MAT.wallHouse = wall('house');
  MAT.wallHouses = [MAT.wallHouse, wall('house_brick'), wall('house_stucco'), wall('house_stone')];
  MAT.wallApt = wall('apt');
  MAT.wallComm = wall('comm');
  MAT.wallTower = wall('tower');
  MAT.walls = [...MAT.wallHouses, MAT.wallApt, MAT.wallComm, MAT.wallTower];
  MAT.roof = new THREE.MeshLambertMaterial({ vertexColors: true });
  const gt = groundTexture('#ffffff', ['#d8d8d8', '#eeeeee', '#c8c8c8', '#f6f6f6']);
  MAT.ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: gt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  MAT.water = new THREE.MeshPhongMaterial({ color: 0x4f86b5, shininess: 80, specular: 0x8899aa, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.waterFlat = MAT.water;
  MAT.path = new THREE.MeshLambertMaterial({ map: roadTexture('path'), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.rail = new THREE.MeshLambertMaterial({ map: railTexture(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const road = (k, col) => new THREE.MeshLambertMaterial({ map: roadTexture(k), color: col || 0xffffff, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  MAT.road = { highway: road('highway'), major: road('major'), local: road('local'), runway: road('local', 0xb8b8b8) };
  MAT.base = new THREE.MeshLambertMaterial({ color: 0x93a86e, map: groundTexture('#ffffff', ['#e0dccb', '#f0ecd8', '#d2cfb8']) });
  return MAT;
}

// night: light up windows
export function setNight(k) {
  for (const m of MAT.walls) m.emissiveIntensity = k * 0.9;
}
