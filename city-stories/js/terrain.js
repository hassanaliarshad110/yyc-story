// Ground heights (metres above City Hall): the City of Calgary LiDAR bare-earth model at 15 m, and the Copernicus 30 m model outside the city.
// ground(x, y) gives the bare-earth height at a map point (x east, y north, metres from City Hall).
let H = null, G = null;
export const TER = { on: false, ox: 0, oy: 0 };
export async function loadTerrain() {
  try {
    const [hj, buf] = await Promise.all([fetch('data/dem.json').then(r => r.json()), fetch('data/dem.wasm').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })]);
    H = hj;
    const unzip = async () => new Int16Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if (hj.enc === 'gzip-rowdelta-int16-dm') {      // gzip, each row stored as differences: unpack and add up
      G = await unzip();
      for (let y = 0; y < hj.ny; y++) { const o = y * hj.nx; for (let x = 1; x < hj.nx; x++) G[o + x] += G[o + x - 1]; }
    } else if (hj.enc === 'gzip-pred2d-int16-dm') {  // each height stored as its difference from left + below - below-left
      G = await unzip(); const W = hj.nx;
      for (let x = 1; x < W; x++) G[x] += G[x - 1];
      for (let y = 1; y < hj.ny; y++) { const o = y * W; G[o] += G[o - W]; for (let x = 1; x < W; x++) G[o + x] += G[o + x - 1] + G[o + x - W] - G[o + x - W - 1]; }
    } else G = new Int16Array(buf);
    if (G.length !== H.nx * H.ny) throw new Error('dem size');
    TER.on = true;
  } catch (e) { console.warn('no terrain', e); H = null; G = null; TER.on = false; }
  return TER.on;
}
export function ground(x, y) {
  if (!G) return 0;
  let fx = (x - H.x0) / H.step, fy = (y - H.y0) / H.step;
  fx = Math.max(0, Math.min(H.nx - 1.001, fx)); fy = Math.max(0, Math.min(H.ny - 1.001, fy));
  const ix = fx | 0, iy = fy | 0, ux = fx - ix, uy = fy - iy, i = iy * H.nx + ix;
  const a = G[i], b = G[i + 1], c = G[i + H.nx], d = G[i + H.nx + 1];
  return ((a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy) / 10;
}
// ground at tile-local coordinates while a tile is being built
export const gl = (lx, ly) => ground(lx + TER.ox, ly + TER.oy);
