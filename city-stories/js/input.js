// Keyboard, mouse and touch controls (same scheme as the Karachi game): W/S/A/D or the stick move relative to the camera,
// Shift runs (handbrake in a car, down in the helicopter), Space jumps (up in the helicopter), drag to look.
export const input = { x: 0, y: 0, sprint: false, brake: false, camYaw: 0, camPitch: 0.32, zoom: 1, pressed: new Set(), touch: false };
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
    if (e.deltaY < 0) { if (input.zoom > 0.6) input.zoom = clamp(input.zoom * 0.9, 0.6, 4); else input.camPitch = clamp(input.camPitch - 0.07, -1.15, 1.3); }
    else { if (input.camPitch < 0.3) input.camPitch = clamp(input.camPitch + 0.07, -1.15, 0.32); else input.zoom = clamp(input.zoom * 1.1, 0.6, 4); }
    input.lookTime = performance.now(); e.preventDefault(); }, { passive: false });
  // touch: left half joystick, right half look
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const touches = new Map();
  canvas.addEventListener('touchstart', e => {
    input.touch = true; document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45) { touches.set(t.identifier, { kind: 'stick', x0: t.clientX, y0: t.clientY }); stick.style.left = (t.clientX - 60) + 'px'; stick.style.top = (t.clientY - 60) + 'px'; stick.classList.add('on'); }
      else touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier); if (!s) continue;
      if (s.kind === 'stick') {
        let dx = (t.clientX - s.x0) / 55, dy = (t.clientY - s.y0) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        input.tx = dx; input.ty = -dy; knob.style.transform = `translate(${dx * 40}px,${-input.ty * 40}px)`;
      } else {
        input.camYaw -= (t.clientX - s.x) * 0.008; input.camPitch = clamp(input.camPitch + (t.clientY - s.y) * 0.005, -1.15, 1.3); s.x = t.clientX; s.y = t.clientY; input.lookTime = performance.now();
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s && s.kind === 'stick') { input.tx = 0; input.ty = 0; knob.style.transform = ''; stick.classList.remove('on'); } touches.delete(t.identifier); } };
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
  input.up = keys.has('Space') || !!input.upBtn;                                            // jump · fly up
  input.brake = keys.has('Space') || !!input.brakeBtn;
  return input;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
