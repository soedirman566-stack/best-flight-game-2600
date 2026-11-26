// input.js — keyboard and mouse state for Kestrel Ridge.
// One job: turn raw browser events into a calm, polled control state that the
// flight model reads once a frame. Keyboard steers and works the throttle;
// the mouse steers by offset from the screen centre and its wheel trims the
// throttle, so either hand can fly the whole sortie.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    pitchAxis: 0,      // -1 nose up .. +1 nose down, after keyboard/mouse merge
    rollAxis: 0,       // -1 bank left .. +1 bank right
    throttleDelta: 0,  // accumulated throttle steps from keys/wheel, consumed by flight
    mouseX: 0,         // -1..1 offset of the pointer from canvas centre
    mouseY: 0,
    mouseSeenAt: -1e9, // last time the pointer moved, ms
    dropPressed: false,
    gearPressed: false,
    pausePressed: false,
    confirmPressed: false,
    anyKeyAt: -1e9,
  };

  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyG', 'KeyP', 'KeyM',
    'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Enter',
  ]);

  window.addEventListener('keydown', (ev) => {
    if (GAME_KEYS.has(ev.code)) ev.preventDefault();
    if (!ev.repeat) {
      if (ev.code === 'Space') state.dropPressed = true;
      if (ev.code === 'KeyG') state.gearPressed = true;
      if (ev.code === 'KeyP' || ev.code === 'Escape') state.pausePressed = true;
      if (ev.code === 'Enter') state.confirmPressed = true;
    }
    keys.add(ev.code);
    state.anyKeyAt = performance.now();
  });
  window.addEventListener('keyup', (ev) => keys.delete(ev.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = ((ev.clientX - r.left) / r.width) * 2 - 1;
    state.mouseY = ((ev.clientY - r.top) / r.height) * 2 - 1;
    state.mouseSeenAt = performance.now();
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) state.dropPressed = true;
    state.confirmPressed = true;
    state.anyKeyAt = performance.now();
  });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    state.throttleDelta += ev.deltaY < 0 ? 0.06 : -0.06;
  }, { passive: false });

  // Merge the two steering sources. Keyboard wins while a key is held; the
  // mouse takes over only when it has moved recently and no key is down.
  function poll(now) {
    let pitch = 0;
    let roll = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch += 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (pitch === 0 && roll === 0 && now - state.mouseSeenAt < 4000) {
      const dead = 0.06;
      const mx = Math.abs(state.mouseX) < dead ? 0 : state.mouseX;
      const my = Math.abs(state.mouseY) < dead ? 0 : state.mouseY;
      roll = clamp(mx * 1.15, -1, 1);
      pitch = clamp(my * 0.9, -1, 1);
    }
    state.pitchAxis = pitch;
    state.rollAxis = roll;

    let thr = state.throttleDelta;
    state.throttleDelta = 0;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('PageUp')) thr += 0.55 / 60;
    if (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('PageDown')) thr -= 0.55 / 60;
    return thr;
  }

  // One-shot flags are consumed by the caller each frame.
  function takeFlags() {
    const f = {
      drop: state.dropPressed,
      gear: state.gearPressed,
      pause: state.pausePressed,
      confirm: state.confirmPressed,
    };
    state.dropPressed = state.gearPressed = state.pausePressed = state.confirmPressed = false;
    return f;
  }

  return { state, poll, takeFlags };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
