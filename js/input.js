// Unified input: desktop (WASD + pointer lock mouse) and mobile touch (virtual stick + drag look + buttons).
export const input = {
  mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, ads: false, sprint: false,
  jump: false, reload: false, swap: null, pause: false, touch: false, nade: false, tac: false, enter: false,
  keys: new Set(),
};

let canvas, isPlaying = () => false, onPauseReq = () => {};
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let lookId = null, lookLX = 0, lookLY = 0, fireId = null;

export function initInput(cv, playingFn, pauseFn) {
  canvas = cv; isPlaying = playingFn; onPauseReq = pauseFn;
  // keyboard
  addEventListener('keydown', e => {
    if (!isPlaying()) return;
    input.keys.add(e.code);
    if (e.code === 'KeyR') input.reload = true;
    if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
    if (e.code === 'Digit1') input.swap = 0; if (e.code === 'Digit2') input.swap = 1; if (e.code === 'Digit3') input.swap = 2;
    if (e.code === 'KeyQ') input.swap = 'next';
    if (e.code === 'KeyG') input.nade = true; if (e.code === 'KeyT' || e.code === 'KeyF') input.tac = true; if (e.code === 'KeyE') input.enter = true;
    if (e.code === 'KeyP') onPauseReq();
  });
  addEventListener('keyup', e => input.keys.delete(e.code));
  addEventListener('blur', () => { input.keys.clear(); input.fire = false; input.ads = false; });
  // mouse
  canvas.addEventListener('mousedown', e => {
    if (!isPlaying() || input.touch) return;
    if (document.pointerLockElement !== canvas) { lock(); return; }
    if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; });
  addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { input.lookX += e.movementX * 0.0022; input.lookY += e.movementY * 0.0022; } });
  addEventListener('wheel', e => { if (isPlaying() && document.pointerLockElement === canvas) input.swap = e.deltaY > 0 ? 'next' : 'prev'; }, { passive: true });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && isPlaying() && !input.touch) { input.fire = false; input.ads = false; onPauseReq(); } });

  // touch
  const layer = document.getElementById('touch');
  const knob = document.getElementById('knob'), base = document.getElementById('joy');
  const R = 55;
  const btn = (t) => { const el = t.target && t.target.closest ? t.target.closest('[data-b]') : null; return el ? el.dataset.b : null; };
  layer.addEventListener('touchstart', e => {
    e.preventDefault(); input.touch = true;
    for (const t of e.changedTouches) {
      const b = btn(t);
      if (b) {
        const el = t.target.closest('[data-b]'); el.classList.add('on');
        if (b === 'fire') { input.fire = true; fireId = t.identifier; if (lookId === null) { lookId = t.identifier; lookLX = t.clientX; lookLY = t.clientY; } }
        else if (b === 'ads') input.ads = !input.ads;
        else if (b === 'reload') input.reload = true;
        else if (b === 'swap') input.swap = 'next';
        else if (b === 'jump') input.jump = true;
        else if (b === 'nade') input.nade = true;
        else if (b === 'tac') input.tac = true;
        else if (b === 'enter') input.enter = true;
        else if (b === 'pause') onPauseReq();
        continue;
      }
      if (t.clientX < innerWidth * 0.42 && joy.id === null) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0;
        base.style.left = (t.clientX - 65) + 'px'; base.style.top = (t.clientY - 65) + 'px'; base.classList.add('on'); knob.style.transform = 'translate(0px,0px)';
      } else if (lookId === null) { lookId = t.identifier; lookLX = t.clientX; lookLY = t.clientY; }
    }
  }, { passive: false });
  layer.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
      }
      if (t.identifier === lookId) {
        input.lookX += (t.clientX - lookLX) * 0.0068; input.lookY += (t.clientY - lookLY) * 0.0068;
        lookLX = t.clientX; lookLY = t.clientY;
      }
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      const el = t.target && t.target.closest ? t.target.closest('[data-b]') : null; if (el && el.dataset.b !== 'ads') el.classList.remove('on');
      if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; base.classList.remove('on'); }
      if (t.identifier === lookId) lookId = null;
      if (t.identifier === fireId) { fireId = null; input.fire = false; }
    }
  };
  layer.addEventListener('touchend', end); layer.addEventListener('touchcancel', end);
}

export function lock() { if (!input.touch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
export function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

export function pollMove() {
  const k = input.keys;
  let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), y = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  if (k.has('ArrowRight')) x += 1; if (k.has('ArrowLeft')) x -= 1; if (k.has('ArrowUp')) y += 1; if (k.has('ArrowDown')) y -= 1;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  if (joy.id !== null) { x = joy.x; y = -joy.y; }
  input.mx = x; input.my = y;
  input.sprint = k.has('ShiftLeft') || k.has('ShiftRight') || (joy.id !== null && Math.hypot(joy.x, joy.y) > 0.97 && joy.y < -0.7);
  if (input.touch) document.getElementById('b-ads').classList.toggle('on', input.ads);
}

export function resetInput() { input.nade = input.tac = input.enter = false; input.fire = false; input.ads = false; input.jump = false; input.reload = false; input.swap = null; input.lookX = input.lookY = 0; input.keys.clear(); joy.id = null; joy.x = joy.y = 0; lookId = null; fireId = null; document.querySelectorAll('#touch .on').forEach(e => e.classList.remove('on')); }
