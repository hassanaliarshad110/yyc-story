// Photorealistic mode: Google Photorealistic 3D Tiles (Map Tiles API) as the city's look.
// The game's own data (streets, building outlines, transit) still drives traffic, walls and missions;
// the 3D tiles are only displayed, and objects are set down on the displayed surface.
import * as THREE from 'three';
import { TilesRenderer, GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TileCompressionPlugin, UnloadTilesPlugin, TilesFadePlugin, DRACOLoader } from '../vendor/tiles3d.js';

const DEG = Math.PI / 180;
export class PhotoCity {
  constructor(scene, camera, renderer, world, key, opts = {}) {
    this.world = world; this.camera = camera; this.renderer = renderer;
    this.holder = new THREE.Group(); this.holder.name = 'google 3d tiles'; this.holder.rotation.y = Math.PI;   // tiles: X west, Z north -> game: X east, Z south
    this.anchor = new THREE.Group(); this.anchor.add(this.holder); scene.add(this.anchor);
    const tiles = this.tiles = new TilesRenderer();
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true }));
    const draco = new DRACOLoader(); draco.setDecoderPath('vendor/draco/');
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());
    tiles.registerPlugin(new TilesFadePlugin());
    this.reo = new ReorientationPlugin({ lat: world.proj.lat0 * DEG, lon: world.proj.lon0 * DEG, height: 1045, recenter: true });
    tiles.registerPlugin(this.reo);
    tiles.errorTarget = opts.errorTarget ?? 10;
    tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, renderer);
    this.holder.add(tiles.group);
    this.ax = 0; this.ay = 0; this.failed = false; this.ready = false;
    tiles.addEventListener('load-tile-set', () => { this.ready = true; });
    tiles.addEventListener('load-error', e => { this.errors = (this.errors || 0) + 1; if (this.errors > 8 && !this.ready) this.failed = true; console.warn('3D tiles', e.error || e); });
    this.ray = new THREE.Raycaster(); this.ray.firstHitOnly = true;
    this.down = new THREE.Vector3(0, -1, 0);
    this.setAnchor(0, 0);
  }
  // keep the tiles' local frame near the player so the flat game map and the curved Earth line up
  setAnchor(x, y) {
    const p = this.world.proj, lat = p.lat0 + y / p.ky, lon = p.lon0 + x / p.kx;
    this.reo.transformLatLonHeightToOrigin(lat * DEG, lon * DEG, 1045);
    const r = lat * DEG, kx = 111412.84 * Math.cos(r) - 93.5 * Math.cos(3 * r);
    this.anchor.position.set(x, 0, -y);
    this.anchor.scale.set(p.kx / kx, 1, 1);              // the game map's east-west metres at this latitude
    this.ax = x; this.ay = y;
  }
  update(px, py) {
    if (Math.hypot(px - this.ax, py - this.ay) > 1500) this.setAnchor(px, py);
    this.camera.updateMatrixWorld();
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.tiles.update();
  }
  // height of the displayed surface below (x, y), searching down from `from` metres
  groundAt(x, y, from = 400) {
    this.ray.set(new THREE.Vector3(x, from, -y), this.down);
    this.ray.far = from + 300;
    const hit = this.ray.intersectObject(this.tiles.group, true)[0];
    return hit ? hit.point.y : null;
  }
  attributions() {
    const a = []; try { this.tiles.getAttributions(a); } catch (e) { }
    return a.filter(x => x.type === 'string').map(x => x.value).join('; ');
  }
  setVisible(v) { this.anchor.visible = v; }
  dispose() { this.tiles.dispose(); }
}
