// Health: cars, buses and trains hurt you; at zero you wake up a few metres away with full health.
import { toast } from './hud.js';
let G = null, bar = null, fill = null, inv = 0, regenT = 0;
export function initHealth(game) {
  G = game; game.hp = 100;
  bar = document.createElement('div'); bar.id = 'hpbar'; bar.innerHTML = '<span>❤</span><div class="hp-in"><div class="hp-fill"></div></div>';
  const stats = document.querySelector('#stats'); (stats ? stats.parentNode : document.body).insertBefore(bar, stats ? stats.nextSibling : null);
  fill = bar.querySelector('.hp-fill'); draw();
}
function draw() { if (fill) { fill.style.width = Math.max(0, G.hp) + '%'; fill.style.background = G.hp > 50 ? '#4cd964' : G.hp > 25 ? '#ffcc00' : '#ff3b30'; } }
// amount of damage, and the direction you get knocked (unit vector, map x/y)
export function hurt(amount, nx = 0, ny = 0, why = '') {
  const p = G.player; if (!p || inv > 0 || G.cine) return false;
  inv = 0.8; G.hp -= amount; regenT = 6;
  p.x += nx * 1.2; p.y += ny * 1.2; if (p.mode === 'foot') { p.vy = 4.5; p.air = 0.001; }
  if (G.sfx) G.sfx.crash && G.sfx.crash();
  document.body.classList.add('hurt'); setTimeout(() => document.body.classList.remove('hurt'), 250);
  if (G.hp <= 0) respawn(why); draw(); if (G.onHurt) G.onHurt(amount, why); return true;
}
export function heal(n) { G.hp = Math.min(100, G.hp + n); draw(); }
function respawn(why) {
  const p = G.player, a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 10;
  let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
  if (G.tiles && G.tiles.safeSpot) { const s = G.tiles.safeSpot(x, y, { maxR: 40 }); x = s.x; y = s.y; }
  p.place(x, y, p.h); G.hp = 100; inv = 2;
  toast(why === 'splash' ? '💦 Soaked! Back in the game.' : '🚑 Ouch! You got patched up nearby.');
  if (G.onRespawn) G.onRespawn(why);
}
// every frame: buses and trains (they don't stop for you) push you aside, and hurt when they're moving
export function updateHealth(dt, vehicles) {
  if (!G || !G.player) return; if (inv > 0) inv -= dt;
  if ((regenT -= dt) <= 0 && G.hp < 100) { G.hp = Math.min(100, G.hp + dt * 4); draw(); }
  const p = G.player; if (p.mode !== 'foot') return;
  for (const o of vehicles) {
    const dx = p.x - o.x, dy = p.y - o.y; if (dx * dx + dy * dy > (o.L / 2 + 3) ** 2) continue;
    const fx = Math.sin(o.h), fy = Math.cos(o.h), al = dx * fx + dy * fy, lat = dx * fy - dy * fx;
    const hl = o.L / 2 + 0.35, hw = o.W / 2 + 0.35;
    if (Math.abs(al) > hl || Math.abs(lat) > hw) continue;
    // out the nearest side
    const pa = hl - Math.abs(al), pl = hw - Math.abs(lat);
    let nx, ny;
    if (pl < pa) { const s = Math.sign(lat) || 1; nx = fy * s; ny = -fx * s; p.x += nx * pl; p.y += ny * pl; }
    else { const s = Math.sign(al) || 1; nx = fx * s; ny = fy * s; p.x += nx * pa; p.y += ny * pa; }
    if (o.v > 2) hurt(Math.min(100, 12 + o.v * 4.5), nx, ny, o.kind);
  }
}
