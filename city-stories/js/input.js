// Keyboard, mouse and touch controls (same scheme as the Karachi game): W/S/A/D or the stick move relative to the camera,
// Shift runs (handbrake in a car, down in the helicopter), Space jumps (up in the helicopter), drag to look.
const ZMIN = 0.35, ZMAX = 4;
export const input = { x: 0, y: 0, sprint: false, brake: false, camYaw: 0, camPitch: 0.32, zoom: (() => { try { return Math.min(4, Math.max(0.35, +localStorage.getItem('yyc-zoom') || 1)); } catch (e) { return 1; } })(), pressed: new Set(), touch: false };
const keys = new Set();
const actions = new Map();     // name -> callback
export function onAction(name, cb) { actions.set(name, cb); }
export function fire(name) { const cb = actions.get(name); if (cb) cb(); }

const KEYMAP = { KeyF: 'vehicle', Enter: 'vehicle', KeyE: 'interact', KeyM: 'map', KeyP: 'phone', Escape: 'back', KeyH: 'horn', Tab: 'map', KeyJ: 'missions', KeyK: 'heli', KeyR: 'radio' };

export function initInput(canvas) {
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    if (KEYMAP[e.code] && !e.repeat) { e.preventDefault(); fire(KEYMAP[e.code]); }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) input.jump = true; }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  // mouse look (drag) and zoom
  let drag = null;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', e => {
    if (drag && e.pointerType === 'mouse') { input.camYaw -= (e.clientX - drag.x) * 0.006; input.camPitch = clamp(input.camPitch + (e.clientY - drag.y) * 0.004, -1.15, 1.3); drag = { x: e.clientX, y: e.clientY }; input.lookTime = performance.now(); }
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', e => {     // scroll up: zoom in, then keep scrolling to tilt the view up to the sky
    if (e.deltaY < 0) { if (input.zoom > ZMIN) input.zoom = clamp(input.zoom * 0.9, ZMIN, ZMAX); else input.camPitch = clamp(input.camPitch - 0.07, -1.15, 1.3); }
    else { if (input.camPitch < 0.3) input.camPitch = clamp(input.camPitch + 0.07, -1.15, 0.32); else input.zoom = clamp(input.zoom * 1.1, ZMIN, ZMAX); }
    input.lookTime = performance.now(); e.preventDefault(); }, { passive: false });
  // zoom buttons (hold to keep zooming) and the + / - keys
  const zoomBy = k => { input.zoom = clamp(input.zoom * k, ZMIN, ZMAX); try { localStorage.setItem('yyc-zoom', input.zoom.toFixed(2)); } catch (e) { } };
  for (const [id, k] of [['zoom-in', 0.94], ['zoom-out', 1 / 0.94]]) {
    const b = document.getElementById(id); if (!b) continue; let timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); zoomBy(k); stop(); timer = setInterval(() => zoomBy(k), 60); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  }
  addEventListener('keydown', e => { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === '+' || e.key === '=') zoomBy(0.88); else if (e.key === '-' || e.key === '_') zoomBy(1 / 0.88); });
  // touch: left half joystick, right half look
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const touches = new Map();
  // one finger: the left side is the movement stick, the right side looks around.
  // two fingers anywhere: pinch to zoom (a stick finger that just landed, or hasn't moved yet, joins the pinch)
  let pinching = false, pinch0 = 0, zoom0 = 1;
  const stopStick = () => { input.tx = 0; input.ty = 0; knob.style.transform = ''; stick.classList.remove('on'); };
  const pinchPair = () => {
    const A = [...touches.values()]; if (A.length < 2) return null;
    const [p, q] = A.slice(-2), now = performance.now();
    const fresh = s => s.kind === 'look' || now - s.t0 < 450 || Math.hypot(s.x - s.x0, s.y - s.y0) < 18;
    return pinching || (fresh(p) && fresh(q)) ? [p, q] : null;
  };
  canvas.addEventListener('touchstart', e => {
    input.touch = true; document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      const s = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() };
      if (t.clientX < innerWidth * 0.45) { s.kind = 'stick'; stick.style.left = (t.clientX - 60) + 'px'; stick.style.top = (t.clientY - 60) + 'px'; stick.classList.add('on'); }
      else s.kind = 'look';
      touches.set(t.identifier, s);
    }
    if (touches.size >= 2 && pinchPair()) { pinching = true; pinch0 = 0; stopStick(); }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s) { s.px = s.x; s.py = s.y; s.x = t.clientX; s.y = t.clientY; } }
    if (pinching) {
      const P = pinchPair();
      if (P) { const d = Math.hypot(P[0].x - P[1].x, P[0].y - P[1].y); if (!pinch0) { pinch0 = d; zoom0 = input.zoom; } else if (d > 10) { input.zoom = clamp(zoom0 * pinch0 / d, ZMIN, ZMAX); try { localStorage.setItem('yyc-zoom', input.zoom.toFixed(2)); } catch (err) { } } }
      e.preventDefault(); return;
    }
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier); if (!s || s.kind === 'idle') continue;
      if (s.kind === 'stick') {
        let dx = (t.clientX - s.x0) / 55, dy = (t.clientY - s.y0) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        input.tx = dx; input.ty = -dy; knob.style.transform = `translate(${dx * 40}px,${-input.ty * 40}px)`;
      } else {
        input.camYaw -= (t.clientX - s.px) * 0.008; input.camPitch = clamp(input.camPitch + (t.clientY - s.py) * 0.005, -1.15, 1.3); input.lookTime = performance.now();
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s && s.kind === 'stick') stopStick(); touches.delete(t.identifier); }
    if (touches.size < 2) { pinch0 = 0; if (!touches.size) pinching = false; }
    // after a pinch, a finger left on the screen doesn't steer until it is lifted
    if (pinching && touches.size === 1) for (const s of touches.values()) s.kind = 'idle';
    if (!touches.size) pinching = false;
  };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
  document.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.hold === 'sprintBtn' && input.onFoot) { input.runLock = !input.runLock; b.classList.toggle('on', input.runLock); return; }
      if (b.dataset.hold) { input[b.dataset.hold] = true; if (b.dataset.hold === 'upBtn') input.jump = true; } else fire(b.dataset.act);
    });
    b.addEventListener('pointerup', () => { if (b.dataset.hold) input[b.dataset.hold] = false; });
    b.addEventListener('pointerleave', () => { if (b.dataset.hold) input[b.dataset.hold] = false; });
  });
}

export function readInput() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (input.tx || input.ty) { x = input.tx; y = input.ty; }
  input.x = x; input.y = y;
  // run · handbrake · fly down. On foot the ⚡ button is a run on/off switch, and pushing the stick all the way also runs
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || !!input.sprintBtn || (input.onFoot && (input.runLock || Math.hypot(input.tx || 0, input.ty || 0) > 0.97));
  input.shift = keys.has('ShiftLeft') || keys.has('ShiftRight');                          // (flying: descend; never the run toggle)
  input.up = keys.has('Space') || !!input.upBtn;                                            // jump · fly up
  input.brake = keys.has('Space') || !!input.brakeBtn;
  return input;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
