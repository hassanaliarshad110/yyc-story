// A sky dome: blue gradient, sun glow, drifting clouds, stars at night. Follows the camera.
import * as THREE from 'three';

const vert = `varying vec3 vDir; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vDir = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w; }`;
const frag = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunCol; uniform float day; uniform float time; uniform vec3 glowDir; uniform float glow;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
  float s = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.22 * (0.4 + day));
  if (h > 0.0) {
    vec2 p = d.xz / (h + 0.12) * 1.3 + vec2(time * 0.006, time * 0.002);
    float c = fbm(p * 1.4);
    float cover = smoothstep(0.5, 0.78, c) * smoothstep(0.0, 0.12, h);
    float shade = 0.75 + 0.25 * smoothstep(0.5, 0.9, fbm(p * 1.4 + 0.35));
    vec3 cloud = mix(horizon * 0.55, vec3(1.0), day) * shade + sunCol * pow(s, 6.0) * 0.35;
    col = mix(col, cloud, cover * 0.88);
    // stars
    vec2 g = floor(d.xz / (h + 0.3) * 260.0);
    float st = step(0.9975, hash(g)) * (1.0 - day) * (1.0 - cover) * smoothstep(0.05, 0.3, h);
    col += vec3(st);
  }
  // city light: an orange glow low over downtown at night
  vec2 hd = normalize(d.xz + 1e-5); float gd = max(dot(hd, normalize(glowDir.xz + 1e-5)), 0.0);
  col += vec3(1.0, 0.55, 0.25) * glow * pow(gd, 5.0) * exp(-max(h, 0.0) * 7.0) * 0.55;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene) {
    this.u = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.9, 0.75) }, day: { value: 1 }, time: { value: 0 }, glowDir: { value: new THREE.Vector3(1, 0, 0) }, glow: { value: 0 } };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    this.mesh.scale.setScalar(5000); this.mesh.renderOrder = -10; this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  // day 0..1, dusk 0..1, sun direction in three space (unit)
  update(camera, day, dusk, sunDir, fogColor, dt) {
    this.mesh.position.copy(camera.position);
    const u = this.u;
    u.top.value.setRGB(0.17, 0.42, 0.8).lerp(new THREE.Color(0.02, 0.04, 0.09), 1 - day);
    u.horizon.value.setRGB(0.72, 0.84, 0.95).lerp(new THREE.Color(0.95, 0.62, 0.45), dusk * 0.7).lerp(new THREE.Color(0.05, 0.08, 0.15), (1 - day) * (1 - dusk * 0.5));
    u.ground.value.copy(fogColor);
    u.sunDir.value.copy(sunDir); u.day.value = day; u.time.value += dt;
    u.sunCol.value.setRGB(1, 0.85 - dusk * 0.25, 0.65 - dusk * 0.35);
    // downtown (City Hall is the map origin): its glow fades with distance
    const dx = 0 - camera.position.x, dz = 0 - camera.position.z, dist = Math.hypot(dx, dz);
    u.glowDir.value.set(dx, 0, dz); u.glow.value = (1 - day) * Math.max(0.15, Math.min(1, 6000 / (dist + 1500)));
  }
}
