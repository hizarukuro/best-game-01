// Keyboard + mouse state for the shepherd controls. The sim reads a plain
// snapshot each step (move vector, aim point in screen space, pulse queued) so
// staged screenshot scenes can drive the exact same shape from an autopilot.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    /** Screen-space mouse, CSS pixels from the canvas top-left. */
    aimX: window.innerWidth / 2,
    aimY: window.innerHeight / 3,
    pulseQueued: false,
    paused: false,
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { state.pulseQueued = true; e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') state.paused = !state.paused;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.aimX = e.clientX - r.left;
    state.aimY = e.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) state.pulseQueued = true; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    state,
    /** WASD/arrows as a normalised vector; screen-down is +z in the world. */
    move() {
      let x = 0, z = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      const len = Math.hypot(x, z);
      return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
    },
    /** Consume the queued pulse (one pulse per press). */
    takePulse() {
      const p = state.pulseQueued;
      state.pulseQueued = false;
      return p;
    },
  };
}
