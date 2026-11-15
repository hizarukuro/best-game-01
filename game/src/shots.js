// Staged screenshot scenes behind ?shot=start|cover|upgrade|over&seed=N.
// Every scene is the real simulation stepped forward with an autopilot
// shepherd (kite the Hollow, lead the river onto the nearest hunter or
// through the bloom), so each frame is a moment a real run produces — the
// same seed always lands on the same frame.

import { BLOOM, HUNTERS } from './config.js';

function nearestHunter(world, x, z) {
  let best = null, bd = Infinity;
  for (const h of world.hunters) {
    const dd = (h.x - x) ** 2 + (h.z - z) ** 2;
    if (dd < bd) { bd = dd; best = h; }
  }
  return best;
}

/**
 * The autopilot shepherd: keep ~7 units off the nearest hunter, circle it,
 * and put the lure (and so the whole river) on the hunter — or through the
 * bloom when no hunter is close. Pulses when crowded.
 */
export function autopilot(world, { passive = false } = {}) {
  const d = world.drone;
  const near = nearestHunter(world, d.x, d.z);
  let moveX = 0, moveZ = 0;
  let aimX = near ? near.x : world.lure.x;
  let aimZ = near ? near.z : world.lure.z;

  if (world.bloom.active && (!near || Math.hypot(near.x - d.x, near.z - d.z) > 10)) {
    aimX = world.bloom.x; aimZ = world.bloom.z;
  }
  if (near) {
    const dx = d.x - near.x, dz = d.z - near.z;
    const dist = Math.max(1, Math.hypot(dx, dz));
    const want = 7;
    // Radial term keeps the gap: positive pushes away along (drone − hunter)
    // when too close, negative pulls toward the hunter when too far.
    const radial = (want - dist) * 0.22;
    moveX = (dx / dist) * radial + (-dz / dist) * 0.85;
    moveZ = (dz / dist) * radial + (dx / dist) * 0.85;
    // Drift toward the bloom side of the arena when it is open.
    if (world.bloom.active) { moveX += (world.bloom.x - d.x) * 0.012; moveZ += (world.bloom.z - d.z) * 0.012; }
  } else if (world.bloom.active) {
    moveX = (world.bloom.x - d.x) * 0.05;
    moveZ = (world.bloom.z - d.z) * 0.05;
  }
  let pulse = false;
  if (!passive) {
    let crowd = 0;
    for (const h of world.hunters) if (Math.hypot(h.x - d.x, h.z - d.z) < 8) crowd += 1;
    pulse = crowd >= 2 && d.pulseT <= 0;
  }
  const ml = Math.hypot(moveX, moveZ);
  if (ml > 1) { moveX /= ml; moveZ /= ml; }
  return { mx: moveX, mz: moveZ, aimX, aimZ, pulse };
}

/** A slow ceremonial circle for the title screen's attract mode. */
export function attractInput(world) {
  const d = world.drone;
  const a = world.time * 0.24;
  const tx = Math.cos(a) * 9, tz = Math.sin(a) * 9 + 2;
  return {
    mx: (tx - d.x) * 0.08, mz: (tz - d.z) * 0.08,
    aimX: Math.cos(a + 0.9) * 12, aimZ: Math.sin(a + 0.9) * 12 + 2,
    pulse: false,
  };
}

/**
 * Build the named scene. Returns { input(), done } — main steps the world
 * with input() until done, rendering as it goes.
 */
export function createStaging(name, world, seed) {
  world.reset(seed);
  let steps = 0;

  if (name === 'cover') {
    // A wave-6 fight at its thickest: the river bent around the shepherd,
    // two kinds of Hollow burning inside the curve, a bloom open nearby.
    world.startWave(6); // the real wave call, so the banner and feed name it right
    world.spawnQueue.length = 0;
    world.hunters.length = 0;
    world.drone.hp = 74;
    world.score = 12480;
    world.combo.chain = 13; world.combo.t = 3; world.combo.mult = 1 + 13 * 0.25;
    world.addMotes(24, 0, 6);
    world.spawnAt('stalker', 8, 1);
    world.spawnAt('stalker', -7, -9);
    world.spawnAt('stalker', 13, -3);
    world.spawnAt('maw', -12, 5);
    world.spawnAt('maw', 5, 13);
    world.spawnAt('brood', -3, -16);
    world.spawnAt('charger', 16, 9);
    world.bloom.active = true;
    world.bloom.x = 13; world.bloom.z = -10;
    world.bloom.lifeMax = BLOOM.life; world.bloom.lifeT = 15;
    // Two beats: the fight knots around a hunter; then the shepherd breaks
    // off and leads the whole river across the arena into the bloom, so the
    // frozen frame catches the swarm mid-crossing — a long curve of light
    // with the Hollow streaming after it.
    let n = 0;
    return {
      input: () => {
        n += 1;
        if (n < 92) return autopilot(world);
        const d = world.drone, b = world.bloom;
        return {
          mx: (b.x - d.x) * 0.09, mz: (b.z - d.z) * 0.09,
          aimX: b.x, aimZ: b.z,
          pulse: false,
        };
      },
      get done() { steps += 1; return steps > 152; },
    };
  }

  if (name === 'upgrade') {
    // Play wave 1 honestly until it clears; the draft screen is the shot.
    return {
      input: () => autopilot(world),
      get done() {
        steps += 1;
        if (world.phase === 'cleared') return true;
        if (steps > 60 * 45) { world.hunters.length = 0; world.step(autopilot(world)); return true; }
        return false;
      },
    };
  }

  if (name === 'over') {
    // A shepherd who stayed too long: no steering, no pulse, three Stalkers.
    world.drone.hp = 12;
    world.spawnAt('stalker', 3.5, 3);
    world.spawnAt('stalker', -3, 4.5);
    world.spawnAt('stalker', 0.5, -3.5);
    return {
      input: () => ({ mx: 0, mz: 0, aimX: world.drone.x, aimZ: world.drone.z, pulse: false }),
      get done() { steps += 1; return world.phase === 'over' || steps > 60 * 20; },
    };
  }

  // 'start' (and anything else): attract circle behind the title.
  world.spawnQueue.length = 0;
  world.hunters.length = 0;
  world.spawnAt('stalker', -20, -14);
  world.spawnAt('stalker', 22, -10);
  world.spawnAt('maw', 18, 16);
  world.bloom.active = true;
  world.bloom.x = -13; world.bloom.z = 9;
  world.bloom.lifeMax = BLOOM.life; world.bloom.lifeT = BLOOM.life;
  return {
    input: () => attractInput(world),
    get done() { steps += 1; return steps > 110; },
  };
}
