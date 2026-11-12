// Calgary Transit in free roam: every real bus stop (City of Calgary open data), catching any bus that serves it,
// real 2026 fares with the 90-minute transfer, and trip planning: "how do I get there by transit?", step by step.
import * as THREE from 'three';
import { ground } from './terrain.js?v=11112231';
import { dirOf, rotY } from './player.js?v=11112231';
import { tx, rtl } from './i18n.js?v=11112231';

const isStation = n => /CTrain/i.test(n) || (/Station/.test(n) && !/LRT|Terminal|@|Bus/.test(n));
const FARE = { adult: 4.0, youth: 2.65 }, WALK = 1.25, MAXW = 750;
const cleanStop = n => (n || '').replace(/\s+/g, ' ').trim();
const mins = s => Math.max(1, Math.round(s / 60));

export class Buses {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.T = game.transit; this.trip = null; this.boardWait = null; this.fareUntil = 0; this.guide = null;
    this.stops = game.world.stops.filter(s => !isStation(s[2] || '')).map(s => ({ x: s[0], y: s[1], name: cleanStop(s[2]), code: s[3] }));
    this.grid = new Map();
    for (const s of this.stops) { const k = this.key(s.x, s.y); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(s); }
    this.busPaths = this.T.paths.filter(p => !p.rail);
    this.built = false;
  }
  key(x, y, c = 100) { return Math.floor(x / c) * 100000 + Math.floor(y / c); }
  near(x, y, r) {
    const out = [], c = 100, n = Math.ceil(r / c);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const l = this.grid.get((Math.floor(x / c) + i) * 100000 + Math.floor(y / c) + j); if (l) for (const s of l) { const d = Math.hypot(s.x - x, s.y - y); if (d <= r) out.push([s, d]); } }
    return out.sort((a, b) => a[1] - b[1]);
  }
  // ---------------------------------------------------------------- the stops you can see: a blue sign on a pole, a bench, a shelter at busier stops
  build(scene) {
    if (this.built) return; this.built = true;
    const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#c8102e'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#fff'; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.fillText('🚌', 64, 58);
    g.font = 'bold 14px sans-serif'; g.fillText('CALGARY TRANSIT', 64, 86);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const M = {
      pole: new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }), sign: new THREE.MeshLambertMaterial({ map: tex }),
      glass: new THREE.MeshLambertMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.35 }), frame: new THREE.MeshLambertMaterial({ color: 0x3a3f45 }), bench: new THREE.MeshLambertMaterial({ color: 0x5b4636 }),
    };
    const G = {
      pole: new THREE.CylinderGeometry(0.05, 0.05, 2.9, 6).translate(0, 1.45, 0),
      sign: new THREE.BoxGeometry(0.06, 0.6, 0.8).translate(0, 2.55, 0),
      roof: new THREE.BoxGeometry(1.5, 0.08, 3.2).translate(-0.6, 2.4, 0),
      back: new THREE.BoxGeometry(0.05, 1.9, 3.2).translate(-1.3, 1.25, 0),
      bench: new THREE.BoxGeometry(0.45, 0.08, 1.8).translate(-0.9, 0.45, 0),
    };
    const lists = { pole: [], sign: [], roof: [], back: [], bench: [] };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    for (const s of this.stops) {
      // face the street: along the nearest bus route
      let h = 0, bd = 40;
      for (const p of this.busPaths) {
        if (s.x < p.bb[0] - 40 || s.x > p.bb[2] + 40 || s.y < p.bb[1] - 40 || s.y > p.bb[3] + 40) continue;
        const pr = p.project(s.x, s.y); if (pr.d < bd) { bd = pr.d; h = p.at(pr.s).h; s.path = p; }
      }
      s.h = h;
      const [dx, dy] = dirOf(h), z = ground(s.x, s.y) + 0.12;
      // which side of the road the stop is on: put the shelter behind it (away from the road)
      let side = 1; if (s.path) { const a = s.path.at(s.path.project(s.x, s.y).s); side = ((s.x - a.x) * dy - (s.y - a.y) * dx) >= 0 ? 1 : -1; }
      q.setFromAxisAngle(up, rotY(h) + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
      const mtx = m4.compose(v.set(s.x, z, -s.y), q, one).clone();
      lists.pole.push(mtx); lists.sign.push(mtx);
      const hs = Math.abs(Math.sin(s.x * 12.9898 + s.y * 78.233) * 43758.5453) % 1;
      if (hs < 0.3) { lists.roof.push(mtx); lists.back.push(mtx); lists.bench.push(mtx); }
      else if (hs < 0.6) lists.bench.push(mtx);
    }
    const grp = new THREE.Group(); grp.name = 'bus-stops';
    for (const [k, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const mat = k === 'pole' ? M.pole : k === 'sign' ? M.sign : k === 'roof' ? M.frame : k === 'back' ? M.glass : M.bench;
      const im = new THREE.InstancedMesh(G[k], mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; grp.add(im);
    }
    scene.add(grp);
  }
  stopAt(x, y) { const n = this.near(x, y, 7); return n.length ? n[0][0] : null; }
  // ---------------------------------------------------------------- the buses that call at a stop, each direction once
  linesAt(stop) {
    const out = new Map();
    for (const p of this.busPaths) {
      if (stop.x < p.bb[0] - 40 || stop.x > p.bb[2] + 40 || stop.y < p.bb[1] - 40 || stop.y > p.bb[3] + 40) continue;
      const st = this.T.stopsOn(p); let i = -1, bd = 30;
      st.forEach((s, k) => { const d = Math.hypot(s.x - stop.x, s.y - stop.y); if (d < bd) { bd = d; i = k; } });
      if (i < 0 || i >= st.length - 1) continue;
      const r = p.route, toward = cleanStop(st[st.length - 1].name), key = r.r + '|' + toward;
      const o = { p, from: st[i], ahead: st.slice(i + 1), label: `Route ${r.r}`, name: r.n || '', toward, colour: '#c8102e', bus: true };
      const prev = out.get(key); if (!prev || prev.ahead.length < o.ahead.length) out.set(key, o);
    }
    return [...out.values()].sort((a, b) => (parseInt(a.p.route.r) || 999) - (parseInt(b.p.route.r) || 999));
  }
  fareFor() { const youth = this.g.story === 'natalia'; return { amt: youth ? FARE.youth : FARE.adult, kind: youth ? 'youth' : 'adult' }; }
  // pay once; a fare is good for 90 minutes of transfers on buses and CTrains
  pay() {
    const now = Date.now(), M = this.g.missions;
    if (now < this.fareUntil) { this.ui.toast(tx('Your fare is still good: transfers are free for 90 minutes')); return; }
    const f = this.fareFor(); if (M && M.pay) M.pay(f.amt); this.fareUntil = now + 90 * 60 * 1000;
    this.ui.toast(f.kind === 'youth' ? tx(`Paid the youth fare: $${f.amt.toFixed(2)} (good for 90 minutes)`) : tx(`Paid the adult fare: $${f.amt.toFixed(2)} (good for 90 minutes)`));
  }
  // ---------------------------------------------------------------- picker: which bus, then which stop
  open(stop) {
    const opts = this.linesAt(stop); if (!opts.length) { this.ui.toast(tx('No buses stop here right now.')); return; }
    const box = document.createElement('div'); box.id = 'busbox'; box.dir = rtl() ? 'rtl' : 'ltr';
    box.style.cssText = 'position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(5,10,15,.6)';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#fbf8f1;color:#1b1f24;border-radius:16px;width:min(560px,92vw);max-height:80vh;overflow:auto;padding:16px 18px;font:15px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)';
    const f = this.fareFor();
    const head = `<div style="font-weight:800;font-size:18px">🚏 ${stop.name}</div><div style="opacity:.7;margin:2px 0 10px">${tx(`Fare $${f.amt.toFixed(2)}, good for 90 minutes on buses and CTrains`)}</div>`;
    const list = () => {
      panel.innerHTML = head + `<div style="font-weight:700;margin-bottom:6px">${tx('Which bus?')}</div>`;
      for (const o of opts) {
        const b = document.createElement('button');
        b.style.cssText = 'display:flex;gap:10px;align-items:center;width:100%;text-align:start;border:1px solid #ddd;background:#fff;border-radius:12px;padding:9px 12px;margin:5px 0;cursor:pointer;font:inherit';
        b.innerHTML = `<b style="background:#c8102e;color:#fff;border-radius:8px;padding:3px 8px;min-width:34px;text-align:center">${o.p.route.r}</b><span><b>${o.name}</b><br><small style="opacity:.75">${tx(`towards ${o.toward}`)}</small></span>`;
        b.onclick = () => pickStop(o); panel.appendChild(b);
      }
      close();
    };
    const pickStop = o => {
      panel.innerHTML = head + `<div style="font-weight:700;margin-bottom:6px">${o.label} · ${o.name}<br><small style="font-weight:400;opacity:.75">${tx('Where do you want to get off?')}</small></div>`;
      const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-direction:column;gap:4px';
      o.ahead.forEach((s, i) => { const b = document.createElement('button'); b.textContent = `${i + 1}. ${cleanStop(s.name)}`; b.style.cssText = 'border:0;border-radius:10px;padding:8px 12px;background:#f0e9df;text-align:start;cursor:pointer;font:inherit'; b.onclick = () => { box.remove(); this.go(o, s); }; row.appendChild(b); });
      panel.appendChild(row);
      const back = document.createElement('button'); back.textContent = tx('Back'); back.style.cssText = 'margin-top:12px;border:1px solid #bbb;background:#fff;border-radius:10px;padding:8px 14px;cursor:pointer'; back.onclick = list; panel.appendChild(back);
    };
    const close = () => { const x2 = document.createElement('button'); x2.textContent = tx('Not now'); x2.style.cssText = 'margin-top:12px;border:1px solid #bbb;background:#fff;border-radius:10px;padding:8px 14px;cursor:pointer'; x2.onclick = () => box.remove(); panel.appendChild(x2); };
    list(); box.appendChild(panel); document.body.appendChild(box);
  }
  get picking() { return !!document.getElementById('busbox'); }
  // ---------------------------------------------------------------- the ride: the bus comes, you board, it runs at 6x, you step off at your stop
  go(o, to, onDone) {
    const g = this.g, T = this.T, from = o.from, ui = this.ui;
    const v = T.add(o.p, Math.max(0, from.s - 230), { mission: true, keep: true });
    v.stops = [{ s: from.s, x: from.x, y: from.y, name: from.name }, { s: to.s, x: to.x, y: to.y, name: to.name }];
    v.nextStop = 0; v.holdAt = 0; this.trip = v;
    const rideUI = document.getElementById('ride'), txt = document.getElementById('ride-text'), skip = document.getElementById('ride-skip');
    rideUI.hidden = false; txt.textContent = tx(`The ${o.label} is on its way`);
    skip.onclick = () => { v.s = Math.max(v.s, from.s - 25); v.v = 5; };
    v.onStop = (st, idx) => {
      if (idx === 0) {
        rideUI.hidden = true; ui.setPrompt(tx(`Press E (✋) to board the ${o.label}`)); ui.sfx.bell(); setTimeout(() => ui.sfx.door(), 500);
        this.boardWait = () => {
          ui.setPrompt(null); this.boardWait = null; v.holdAt = -1; v.wait = 1.5; this.pay();
          g.player.mode = 'ride'; g.rideVehicle = v; g.player.sync();
          rideUI.hidden = false; txt.textContent = tx(`Riding the ${o.label} to ${cleanStop(to.name)}`); v.fast = 6;
          skip.onclick = () => { v.s = Math.max(v.s, to.s - 120); v.wait = 0; v.v = 8; v.fast = 1; ui.toast(tx(`Skipped ahead: almost at ${cleanStop(to.name)}`)); };
        };
      } else {
        v.fast = 1; rideUI.hidden = true;
        const [dx, dy] = dirOf(v.h);
        g.player.mode = 'foot'; g.rideVehicle = null; g.player.place(v.x + dy * 3.2, v.y - dx * 3.2, v.h);
        v.keep = false; v.mission = false; v.holdAt = -1; this.trip = null;
        ui.toast(`🚏 ${cleanStop(to.name)}`); ui.sfx.bell();
        setTimeout(() => { v.done = true; }, 8000);
        if (onDone) onDone();
      }
    };
  }
  // ---------------------------------------------------------------- trip planner: walk, bus/CTrain, (transfer), walk
  lines() {
    if (this._lines) return this._lines;
    const L = [];
    for (const p of this.busPaths) { const st = this.T.stopsOn(p); if (st.length > 1) L.push({ p, stops: st, rail: false, label: `Route ${p.route.r}`, name: p.route.n || '', toward: cleanStop(st[st.length - 1].name), v: 7, wait: 360 }); }
    for (const M of this.g.metro.lines) if (M.stops.length > 1) { const n = (M.p.route.n || 'CTrain').split(' - ')[0]; L.push({ p: M.p, stops: M.stops, rail: true, metro: M, label: n, name: n, toward: M.stops[M.stops.length - 1].name, v: 11, wait: 240 }); }
    for (const l of L) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const s of l.stops) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); } l.bb = [x0, y0, x1, y1]; }
    return this._lines = L;
  }
  plan(fx, fy, tx2, ty) {
    const direct = Math.hypot(tx2 - fx, ty - fy), walkOnly = direct * 1.3 / WALK;
    const L = this.lines(), within = (l, x, y) => x > l.bb[0] - MAXW && x < l.bb[2] + MAXW && y > l.bb[1] - MAXW && y < l.bb[3] + MAXW;
    const nearIdx = (l, x, y) => { const out = []; l.stops.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y) * 1.25; if (d < MAXW) out.push([i, d]); }); return out; };
    const LO = L.filter(l => within(l, fx, fy)), LD = L.filter(l => within(l, tx2, ty));
    let best = null;
    const consider = (cost, legs) => { if (!best || cost < best.cost) best = { cost, legs }; };
    // one ride
    for (const l of LO) {
      const oi = nearIdx(l, fx, fy); if (!oi.length) continue; const di = nearIdx(l, tx2, ty); if (!di.length) continue;
      for (const [i, w0] of oi) for (const [j, w1] of di) if (j > i) consider(w0 / WALK + l.wait + (l.stops[j].s - l.stops[i].s) / l.v + w1 / WALK, [{ l, i, j, w0, w1 }]);
    }
    // one transfer: ride A, walk a little, ride B
    const tails = new Map();
    for (const l of LD) {
      const di = nearIdx(l, tx2, ty); if (!di.length) continue;
      const tail = new Array(l.stops.length).fill(null);
      for (let m = l.stops.length - 2; m >= 0; m--) {
        let bm = null;
        for (const [j, w1] of di) if (j > m) { const c = (l.stops[j].s - l.stops[m].s) / l.v + w1 / WALK; if (!bm || c < bm.c) bm = { c, j, w1 }; }
        tail[m] = bm;
      }
      const g = new Map(); l.stops.forEach((s, m) => { if (!tail[m]) return; const k = this.key(s.x, s.y, 200); let a = g.get(k); if (!a) g.set(k, a = []); a.push(m); });
      tails.set(l, { tail, g });
    }
    for (const A of LO) {
      const oi = nearIdx(A, fx, fy); if (!oi.length) continue;
      for (const [i, w0] of oi.slice(0, 3)) for (let k = i + 1; k < A.stops.length; k++) {
        const sk = A.stops[k], rideA = (sk.s - A.stops[i].s) / A.v; if (rideA > 3600) break;
        for (const [B, T] of tails) {
          if (B === A) continue;
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
            const ms = T.g.get((Math.floor(sk.x / 200) + a) * 100000 + Math.floor(sk.y / 200) + b); if (!ms) continue;
            for (const m of ms) { const sm = B.stops[m], wt = Math.hypot(sm.x - sk.x, sm.y - sk.y); if (wt > 200) continue; const t = T.tail[m];
              consider(w0 / WALK + A.wait + rideA + wt / WALK + B.wait + t.c + 120, [{ l: A, i, j: k, w0, w1: 0 }, { l: B, i: m, j: t.j, w0: wt, w1: t.w1 }]); }
          }
        }
      }
    }
    if (!best || best.cost > walkOnly * 0.95) return { walk: true, time: walkOnly, dist: direct };
    return { legs: best.legs, time: best.cost };
  }
  // ---------------------------------------------------------------- directions card and the step-by-step guide
  offer(x, y) {
    const p = this.g.player; this.closeCard();
    if (p.mode !== 'foot' || Math.hypot(x - p.x, y - p.y) < 900) return;
    const plan = this.plan(p.x, p.y, x, y);
    const card = document.createElement('div'); card.id = 'dirs'; card.dir = rtl() ? 'rtl' : 'ltr';
    card.style.cssText = 'position:fixed;left:10px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:21;width:min(400px,72vw);max-height:46vh;overflow:auto;background:rgba(14,20,30,.92);color:#fff;border-radius:14px;padding:12px 14px;font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    const f = this.fareFor();
    if (plan.walk) card.innerHTML = `<b>🚶 ${tx(`Walk about ${mins(plan.time)} min`)}</b><div style="opacity:.75;margin-top:4px">${tx('No bus or CTrain is faster for this trip. Follow the purple line.')}</div>`;
    else {
      const rows = []; let n = 0;
      for (const [k, leg] of plan.legs.entries()) {
        const from = leg.l.stops[leg.i], to = leg.l.stops[leg.j], icon = leg.l.rail ? '🚆' : '🚌', stops = leg.j - leg.i;
        rows.push(`🚶 ${k === 0 ? tx(`Walk ${mins(leg.w0 / WALK)} min to ${cleanStop(from.name)}`) : tx(`Transfer: walk ${mins(leg.w0 / WALK)} min to ${cleanStop(from.name)}`)}`);
        rows.push(`${icon} <b>${leg.l.label}</b> ${leg.l.rail ? '' : '· ' + leg.l.name} <span style="opacity:.75">${tx(`towards ${leg.l.toward}`)}</span><br><span style="opacity:.85">${tx(`Ride ${stops} stops (${mins((to.s - from.s) / leg.l.v)} min), get off at ${cleanStop(to.name)}`)}</span>`);
        n = k;
      }
      rows.push(`🚶 ${tx(`Walk ${mins(plan.legs[n].w1 / WALK)} min to your destination`)}`);
      card.innerHTML = `<b>${tx(`By transit: about ${mins(plan.time)} min`)}</b> <span style="opacity:.75">· ${tx(`fare $${f.amt.toFixed(2)}, transfers free for 90 minutes`)}</span><ol style="margin:8px 0 6px;padding-inline-start:20px;line-height:1.45">${rows.map(r => `<li style="margin:3px 0">${r}</li>`).join('')}</ol>`;
      const go = document.createElement('button'); go.textContent = tx('Guide me by transit'); go.style.cssText = 'border:0;border-radius:10px;padding:8px 14px;background:#ffc400;color:#111;font-weight:800;cursor:pointer;margin-inline-end:8px';
      go.onclick = () => { this.startGuide(plan, x, y); card.remove(); };
      card.appendChild(go);
    }
    const x2 = document.createElement('button'); x2.textContent = '✕'; x2.style.cssText = 'border:0;border-radius:10px;padding:8px 12px;background:#2c3646;color:#fff;cursor:pointer'; x2.onclick = () => card.remove();
    card.appendChild(x2); document.body.appendChild(card);
  }
  closeCard() { const c = document.getElementById('dirs'); if (c) c.remove(); }
  startGuide(plan, x, y) { this.guide = { legs: plan.legs, k: 0, phase: 'walk', dest: { x, y } }; this.stepGuide(); }
  stopGuide() { this.guide = null; const s = document.getElementById('guide'); if (s) s.remove(); }
  banner(t) {
    let s = document.getElementById('guide');
    if (!s) { s = document.createElement('div'); s.id = 'guide'; s.style.cssText = 'position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translateX(-50%);z-index:21;max-width:min(520px,80vw);background:#ffc400;color:#111;border-radius:12px;padding:8px 12px;font:600 14px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);text-align:center'; document.body.appendChild(s); s.onclick = () => this.stopGuide(); }
    s.dir = rtl() ? 'rtl' : 'ltr'; s.innerHTML = t + ' <small style="opacity:.6">✕</small>';
  }
  stepGuide() {
    const G = this.guide; if (!G) return;
    const g = this.g;
    if (G.k >= G.legs.length) { g.waypoint = { x: G.dest.x, y: G.dest.y }; this.banner('🚶 ' + tx('Walk to your destination: follow the purple line')); G.phase = 'last'; return; }
    const leg = G.legs[G.k], from = leg.l.stops[leg.i];
    g.waypoint = { x: from.x, y: from.y, name: from.name, guide: true };
    this.banner(`🚶 ${tx(`Walk to ${cleanStop(from.name)}`)} · ${leg.l.rail ? '🚆' : '🚌'} ${leg.l.label}`);
    G.phase = 'walk';
  }
  // called every HUD tick
  tick() {
    const G = this.guide; if (!G) return;
    const p = this.g.player;
    if (G.phase === 'last') { if (Math.hypot(G.dest.x - p.x, G.dest.y - p.y) < 30) { this.ui.toast(tx('You have arrived')); this.stopGuide(); } return; }
    if (G.phase !== 'walk') return;
    const leg = G.legs[G.k], from = leg.l.stops[leg.i], to = leg.l.stops[leg.j];
    if (p.mode !== 'foot' || Math.hypot(from.x - p.x, from.y - p.y) > 14) return;
    G.phase = 'ride'; this.g.waypoint = null;
    this.banner(`${leg.l.rail ? '🚆' : '🚌'} ${tx(`Wait here for the ${leg.l.label} towards ${leg.l.toward}`)}`);
    const done = () => { G.k++; this.stepGuide(); };
    if (leg.l.rail) this.g.metro.go({ L: leg.l.metro, from, label: leg.l.label, toward: leg.l.toward, colour: '#c8102e' }, to, done);
    else this.go({ p: leg.l.p, from, label: leg.l.label }, to, done);
  }
}
