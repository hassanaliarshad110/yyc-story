// Take the CTrain from any station in free roam: walk onto a platform, press E, pick where to go,
// board when the train pulls in, ride (6x speed, or skip ahead) and step off at your stop.
import { dirOf } from './player.js?v=11112231';

const isStation = n => /CTrain/i.test(n) || (/Station/.test(n) && !/LRT|Terminal|@|Bus/.test(n));
const clean = n => (n || '').replace(/^\s*(NB|SB|EB|WB)\s+/, '').replace(/\((Free Fare Zone|NB|SB|EB|WB)\)/gi, '').replace(/\s*(CTrain\s+)?(Station|Staion|Stn)\b.*$/i, '').replace(/\s+/g, ' ').trim();

export class Metro {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.trip = null; this.boardWait = null;
    this.rail = game.transit.paths.filter(p => p.rail);
    // the CTrain platforms along each line, in order
    this.lines = this.rail.map(p => {
      const [x0, y0, x1, y1] = p.bb, stops = [];
      for (const s of game.world.stops) {
        if (!isStation(s[2] || '') || s[0] < x0 - 60 || s[0] > x1 + 60 || s[1] < y0 - 60 || s[1] > y1 + 60) continue;
        const pr = p.project(s[0], s[1]); if (pr.d < 45) stops.push({ s: pr.s, x: s[0], y: s[1], name: clean(s[2]) });
      }
      return { p, stops: stops.sort((a, b) => a.s - b.s) };
    });
    // merge stops that are the same station (both platforms, both directions)
    for (const L of this.lines) { const out = []; for (const s of L.stops) { const last = out[out.length - 1]; if (last && (last.name === s.name || s.s - last.s < 80)) continue; out.push(s); } L.stops = out; }
  }
  // the station you are standing at (within 45 m of a platform stop), or null
  stationAt(x, y) {
    let best = null, bd = 45;
    for (const L of this.lines) for (let i = 0; i < L.stops.length; i++) { const s = L.stops[i], d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = { name: s.name, x: s.x, y: s.y }; } }
    return best;
  }
  // every train you could take from here: each line and direction, with the stations still ahead
  options(x, y) {
    const out = [];
    for (const L of this.lines) {
      let i = -1, bd = 60; L.stops.forEach((s, k) => { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; i = k; } });
      if (i < 0 || i >= L.stops.length - 1) continue;
      const route = L.p.route, colour = /red/i.test(route.n || '') ? '#c8102e' : /blue/i.test(route.n || '') ? '#1f5fa8' : '#555';
      out.push({ L, from: L.stops[i], ahead: L.stops.slice(i + 1), label: (route.n || 'CTrain').split(' - ')[0], toward: L.stops[L.stops.length - 1].name, colour });
    }
    return out;
  }
  // the station picker
  open(x, y) {
    const opts = this.options(x, y); if (!opts.length) { this.ui.toast('No trains run from here.'); return; }
    const box = document.createElement('div'); box.id = 'metro';
    box.style.cssText = 'position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(5,10,15,.6)';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#fbf8f1;color:#1b1f24;border-radius:16px;max-width:min(560px,92vw);max-height:80vh;overflow:auto;padding:16px 18px;font:15px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)';
    panel.innerHTML = `<div style="font-weight:800;font-size:19px;margin-bottom:2px">🚆 ${opts[0].from.name} station</div><div style="opacity:.7;margin-bottom:10px">Where to? Youth fare $2.65 · good for 90 minutes</div>`;
    for (const o of opts) {
      const h = document.createElement('div'); h.style.cssText = `margin:10px 0 6px;font-weight:700;color:${o.colour}`; h.textContent = `${o.label} towards ${o.toward}`; panel.appendChild(h);
      const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
      for (const s of o.ahead) { const b = document.createElement('button'); b.textContent = s.name; b.style.cssText = `border:0;border-radius:999px;padding:7px 12px;background:${o.colour};color:#fff;font-weight:600;cursor:pointer`; b.onclick = () => { box.remove(); this.go(o, s); }; row.appendChild(b); }
      panel.appendChild(row);
    }
    const x2 = document.createElement('button'); x2.textContent = 'Not now'; x2.style.cssText = 'margin-top:14px;border:1px solid #bbb;background:#fff;border-radius:10px;padding:8px 14px;cursor:pointer'; x2.onclick = () => box.remove(); panel.appendChild(x2);
    box.appendChild(panel); document.body.appendChild(box);
  }
  get picking() { return !!document.getElementById('metro'); }
  go(o, to, onDone) {
    const g = this.g, T = g.transit, from = o.from, ui = this.ui;
    const v = T.add(o.L.p, Math.max(0, from.s - 140), { mission: true, keep: true });
    v.stops = [{ s: from.s, x: from.x, y: from.y, name: from.name }, { s: to.s, x: to.x, y: to.y, name: to.name }];
    v.nextStop = 0; v.holdAt = 0; this.trip = v;
    const rideUI = document.getElementById('ride'), txt = document.getElementById('ride-text'), skip = document.getElementById('ride-skip');
    rideUI.hidden = false; txt.textContent = `The ${o.label} is coming. Wait on the platform.`;
    skip.onclick = () => { v.s = Math.max(v.s, from.s - 25); v.v = 5; };
    v.onStop = (st, idx) => {
      if (idx === 0) {
        rideUI.hidden = true; ui.setPrompt(`Press E (✋) to board the ${o.label}`); ui.sfx.bell(); setTimeout(() => ui.sfx.door(), 500);
        this.boardWait = () => {
          ui.setPrompt(null); this.boardWait = null; v.holdAt = -1; v.wait = 1.5;
          if (g.buses) g.buses.pay();
          g.player.mode = 'ride'; g.rideVehicle = v; g.player.sync(); g.music && g.music.radio(true);
          rideUI.hidden = false; txt.textContent = `Riding the ${o.label} to ${to.name}`; v.fast = 6;
          skip.onclick = () => { v.s = Math.max(v.s, to.s - 160); v.wait = 0; v.v = 9; v.fast = 1; ui.toast(`Skipped ahead: almost at ${to.name}`); };
        };
      } else {
        v.fast = 1; rideUI.hidden = true;
        const [dx, dy] = dirOf(v.h);
        g.player.mode = 'foot'; g.rideVehicle = null; g.player.place(v.x + dy * 3.2, v.y - dx * 3.2, v.h);
        v.keep = false; v.mission = false; v.holdAt = -1; this.trip = null;
        ui.toast(`🚆 ${to.name} station`); ui.sfx.bell();
        setTimeout(() => { v.done = true; }, 8000);
        if (onDone) onDone();
      }
    };
  }
}
