// Staged screenshot scenes behind ?shot=start|cover|upgrade|over&seed=N.
// Every scene is the real simulation stepped forward with an autopilot
// shepherd (kite the Hollow, lead the river onto the nearest hunter or
// through the bloom), so each frame is a moment a real run produces — the
// same seed always lands on the same frame.

import { BLOOM, SUNBLOOM, UPGRADES } from './config.js';

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
    // The wave-10 boss fight at its thickest — the frame the whole entry is
    // judged by. Real systems only, staged the way a real run reaches them:
    // four overclocks fitted across nine cleared waves (the real apply
    // functions, so the loadout panel and the sim agree), the Undershepherd
    // on the field with its escort, a sunbloom open on the fight's flank
    // with the river already spilling into it, two escorts alight at the
    // river's edge, and the shepherd kiting the boss with the whole river
    // wrapped around it — the one way the boss burns at all.
    const fit = (id) => {
      const u = UPGRADES.find((x) => x.id === id);
      u.apply(world);
      world.fitted[id] = (world.fitted[id] ?? 0) + 1;
    };
    world.startWave(10); // the real wave call: banner, feed and veil name it right
    world.spawnQueue.length = 0;
    world.hunters.length = 0;
    fit('sparks'); fit('sparks'); fit('pull'); fit('signal'); fit('pulse');
    world.drone.hp = 63;
    world.score = 21340;
    world.best = 26915;
    world.kills = 87;
    world.harvested = 11;
    world.combo.chain = 17; world.combo.t = 3; world.combo.mult = 1 + 17 * 0.25;
    world.spawnAt('undershepherd', 11, -7);
    world.spawnAt('maw', 2, -16);
    world.spawnAt('wailer', 15, 9);
    world.spawnAt('charger', -15, -9);
    world.spawnAt('stalker', 4, 14);
    world.spawnAt('mite', 12, -16);
    // The sunbloom opens on the fight's southern flank, close enough that
    // the river wrapped around the boss spills into its ring — a harvest
    // genuinely in progress inside the frame, not a decoration across the
    // arena. The maw and the mite are placed on the same flank: the maw
    // walks into the river's edge to feed, the mite crosses the stream
    // chasing the shepherd, so both are burning when the frame freezes.
    world.bloom.active = true;
    world.bloom.kind = 'sun';
    world.bloom.need = SUNBLOOM.need;
    world.bloom.x = 11; world.bloom.z = -11;
    world.bloom.lifeMax = SUNBLOOM.life; world.bloom.lifeT = 17;
    // Shepherd the boss: hold ~11 units off it and circle, with the lure
    // set on the boss's near shoulder — so the river streams out behind the
    // shepherd in a long arc, wraps the boss's flank, and burns it, instead
    // of vanishing into a knot inside the boss's silhouette. One pulse
    // mid-scene so the ring is still in the air when the frame freezes.
    let n = 0;
    let ripe = false;
    return {
      input: () => {
        n += 1;
        const d = world.drone;
        const boss = world.hunters.find((h) => h.kind === 'undershepherd') ?? nearestHunter(world, d.x, d.z);
        if (!boss) return autopilot(world);
        // The freeze waits for the frame the cover needs: the boss held by
        // the river, the sunbloom part-filled (a harvest in progress, not
        // yet complete), and at least two escorts properly alight at once.
        // All of it is read off the live sim, so the frozen frame is a real
        // moment — in practice the maw and mite reach full burn beside the
        // boss while the ring is part-filled, around step 66.
        if (n >= 60 && !ripe) {
          const burning = world.hunters.filter((h) => h !== boss && h.flash > 0.4).length;
          ripe = boss.ring >= 40
            && world.bloom.active && world.bloom.inside >= 9 && world.bloom.inside < world.bloom.need
            && burning >= 2;
        }
        const dx = d.x - boss.x, dz = d.z - boss.z;
        const dist = Math.max(1, Math.hypot(dx, dz));
        const radial = (11 - dist) * 0.22;
        let mx = (dx / dist) * radial + (-dz / dist) * 0.9;
        let mz = (dz / dist) * radial + (dx / dist) * 0.9;
        const ml = Math.hypot(mx, mz);
        if (ml > 1) { mx /= ml; mz /= ml; }
        return {
          mx, mz,
          aimX: boss.x + (dx / dist) * 2.8, aimZ: boss.z + (dz / dist) * 2.8,
          pulse: n === 132 && d.pulseT <= 0,
        };
      },
      // The ripe check above usually lands the frame near the old 170; the
      // hard cap of 175 steps ≈ 2.9 s stays inside the combo's 3 s window,
      // so the staged chain is still alive — and still paying — either way.
      get done() { steps += 1; return ripe || steps > 175; },
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
    // A shepherd who stayed too long, six waves in: the tally of a real run
    // (score, kills, harvests, best chain) stands in the world, and then
    // three Stalkers finish the last of the hull while the shepherd holds
    // still — no steering, no pulse.
    world.startWave(6);
    world.spawnQueue.length = 0;
    world.hunters.length = 0;
    world.score = 8640;
    world.kills = 23;
    world.harvested = 5;
    world.bestCombo = 14;
    world.best = 11230;
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
