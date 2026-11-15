// LURELIGHT's simulation: the shepherd drone, the mote swarm (boids), the
// Hollow hunters, bloom rings, waves and score. Pure state + step function —
// no DOM, no three.js — so staged scenes and the live game run identical code.
//
// The one mechanic everything hangs on: motes are the only weapon. A hollow
// touched by the swarm burns (damage scales with how many motes are on it),
// but a hollow that is NOT overwhelmed eats the motes touching it, one by one.
// A thin swarm is food. A thick swarm is a fire.

import { ARENA_RADIUS, BLOOM, COMBO, DRONE, HUNTERS, STEP, SWARM, hpScale, waveLine, waveRecipe } from './config.js';
import { makeRng } from './random.js';

const TAU = Math.PI * 2;

export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    rng,
    time: 0,
    phase: 'combat', // 'combat' | 'cleared' | 'over'
    wave: 0,
    score: 0,
    kills: 0,
    harvested: 0,
    bestCombo: 0,
    combo: { chain: 0, t: 0, mult: 1 },
    drone: null,
    lure: { x: 0, z: -6 },
    swarm: { lurePull: SWARM.lurePull, maxSpeed: SWARM.maxSpeed },
    bloomLifeFactor: 1,
    flareEvery: 0,
    flare: { active: false, x: 0, z: 0, t: 0 },
    flareT: 0,
    bloom: { active: false, x: 0, z: 0, lifeT: 0, lifeMax: BLOOM.life, inside: 0, respawnT: 1.2 },
    hunters: [],
    spawnQueue: [],
    spawnT: 0,
    centroid: { x: 0, z: 0 },
    emit: () => {},
    // Mote storage: parallel arrays, compacted on death (swap-with-last).
    moteCount: 0,
    mx: new Float32Array(SWARM.max), mz: new Float32Array(SWARM.max),
    mvx: new Float32Array(SWARM.max), mvz: new Float32Array(SWARM.max),
    mphase: new Float32Array(SWARM.max),
  };

  world.reset = (newSeed) => {
    if (newSeed !== undefined) world.rng = makeRng(newSeed);
    const r = world.rng;
    world.time = 0;
    world.phase = 'combat';
    world.score = 0; world.kills = 0; world.harvested = 0; world.bestCombo = 0;
    world.combo = { chain: 0, t: 0, mult: 1 };
    world.swarm = { lurePull: SWARM.lurePull, maxSpeed: SWARM.maxSpeed };
    world.bloomLifeFactor = 1;
    world.flareEvery = 0; world.flare = { active: false, x: 0, z: 0, t: 0 }; world.flareT = 0;
    world.drone = {
      x: 0, z: 6, vx: 0, vz: 0, hp: DRONE.hp, hpMax: DRONE.hp,
      speed: DRONE.speed, lureRange: DRONE.lureRange,
      pulseRadius: DRONE.pulseRadius, pulseForce: DRONE.pulseForce,
      pulseStun: DRONE.pulseStun, pulseCooldown: DRONE.pulseCooldown,
      pulseT: 0, graceT: 0, facing: -Math.PI / 2, pulseAnim: 0,
    };
    world.lure = { x: 0, z: -4 };
    world.hunters = [];
    world.moteCount = 0;
    world.addMotes(SWARM.start, 0, 6);
    world.bloom = { active: false, x: 0, z: 0, lifeT: 0, lifeMax: BLOOM.life, inside: 0, respawnT: 1.4 };
    world.startWave(1);
  };

  world.addMotes = (n, atX, atZ) => {
    const r = world.rng;
    const cx = atX ?? world.drone.x, cz = atZ ?? world.drone.z;
    for (let k = 0; k < n && world.moteCount < SWARM.max; k += 1) {
      const i = world.moteCount;
      const a = r.next() * TAU, d = r.range(0.5, 3.2);
      world.mx[i] = cx + Math.cos(a) * d;
      world.mz[i] = cz + Math.sin(a) * d;
      world.mvx[i] = Math.cos(a) * 4;
      world.mvz[i] = Math.sin(a) * 4;
      world.mphase[i] = r.next() * TAU;
      world.moteCount += 1;
    }
  };

  function killMote(i) {
    const last = world.moteCount - 1;
    world.mx[i] = world.mx[last]; world.mz[i] = world.mz[last];
    world.mvx[i] = world.mvx[last]; world.mvz[i] = world.mvz[last];
    world.mphase[i] = world.mphase[last];
    world.moteCount = last;
  }

  world.startWave = (n) => {
    world.wave = n;
    const recipe = waveRecipe(n);
    const queue = [];
    for (const [kind, count] of Object.entries(recipe)) for (let i = 0; i < count; i += 1) queue.push(kind);
    // Shuffle so kinds interleave through the trickle.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(world.rng.next() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    world.spawnQueue = queue;
    world.spawnT = 1.0;
    world.phase = 'combat';
    world.emit('wave', { wave: n, line: waveLine(n), boss: recipe.undershepherd > 0 });
  };

  function spawnHunter(kind) {
    const a = world.rng.range(0, TAU);
    const dist = ARENA_RADIUS - 1.2;
    world.spawnAt(kind, Math.cos(a) * dist, Math.sin(a) * dist);
  }

  /** Place a hunter directly (rim spawns and staged screenshot scenes). */
  world.spawnAt = (kind, x, z) => {
    const def = HUNTERS[kind];
    const hp = def.hp * hpScale(world.wave) * (kind === 'undershepherd' ? 1 + (world.wave / 5 - 1) * 0.35 : 1);
    world.hunters.push({
      kind, def, x, z, vx: 0, vz: 0,
      hp, hpMax: hp, eatT: world.rng.range(0.2, 0.8), stunT: 0, flash: 0,
      state: 'stalk', stateT: 0, dashX: 0, dashZ: 0, dashT: world.rng.range(1, 2.4),
      phase: world.rng.range(0, TAU), hitT: 0,
    });
    world.emit('spawn', { kind, x, z });
  };

  function comboLink() {
    const c = world.combo;
    c.chain += 1;
    c.t = COMBO.window;
    c.mult = Math.min(COMBO.maxMult, 1 + c.chain * COMBO.perLink);
    if (c.chain > world.bestCombo) world.bestCombo = c.chain;
  }

  function killHunter(h, index) {
    world.hunters.splice(index, 1);
    const gained = Math.round(h.def.score * world.combo.mult);
    world.score += gained;
    world.kills += 1;
    comboLink();
    world.emit('burnDeath', { x: h.x, z: h.z, radius: h.def.radius, kind: h.kind, gained });
    if (h.kind === 'brood') {
      for (let k = 0; k < h.def.children; k += 1) {
        const a = world.rng.range(0, TAU);
        const def = HUNTERS.mite;
        const hp = def.hp * hpScale(world.wave);
        world.hunters.push({
          kind: 'mite', def, x: h.x + Math.cos(a) * 1.6, z: h.z + Math.sin(a) * 1.6, vx: Math.cos(a) * 6, vz: Math.sin(a) * 6,
          hp, hpMax: hp, eatT: 0.6, stunT: 0, flash: 0, state: 'stalk', stateT: 0, dashX: 0, dashZ: 0, dashT: 2, phase: world.rng.range(0, TAU), hitT: 0,
        });
      }
    }
    if (h.kind === 'undershepherd') world.emit('bossDown', { x: h.x, z: h.z });
  }

  /** Advance one fixed step. `input`: {mx, mz, aimX, aimZ, pulse}. */
  world.step = (input) => {
    const dt = STEP;
    const d = world.drone;
    world.time += dt;
    if (d.pulseT > 0) d.pulseT -= dt;
    if (d.graceT > 0) d.graceT -= dt;
    if (d.pulseAnim > 0) d.pulseAnim -= dt * 2.4;
    if (world.combo.t > 0) { world.combo.t -= dt; if (world.combo.t <= 0) { world.combo.chain = 0; world.combo.mult = 1; } }

    // --- drone movement -------------------------------------------------
    const moveLen = Math.hypot(input.mx, input.mz);
    const tvx = moveLen > 0 ? (input.mx / Math.max(1, moveLen)) * d.speed : 0;
    const tvz = moveLen > 0 ? (input.mz / Math.max(1, moveLen)) * d.speed : 0;
    d.vx += (tvx - d.vx) * Math.min(1, dt * 10);
    d.vz += (tvz - d.vz) * Math.min(1, dt * 10);
    d.x += d.vx * dt; d.z += d.vz * dt;
    const dc = Math.hypot(d.x, d.z), dMax = ARENA_RADIUS - DRONE.radius;
    if (dc > dMax) { d.x *= dMax / dc; d.z *= dMax / dc; }
    if (moveLen > 0) d.facing = Math.atan2(input.mz, input.mx);

    // --- lure point: the mouse, clamped to signal range -----------------
    let lx = input.aimX, lz = input.aimZ;
    const ldx = lx - d.x, ldz = lz - d.z, ld = Math.hypot(ldx, ldz);
    if (ld > d.lureRange) { lx = d.x + (ldx / ld) * d.lureRange; lz = d.z + (ldz / ld) * d.lureRange; }
    const lc = Math.hypot(lx, lz), lMax = ARENA_RADIUS - 0.5;
    if (lc > lMax) { lx *= lMax / lc; lz *= lMax / lc; }
    world.lure.x += (lx - world.lure.x) * Math.min(1, dt * 14);
    world.lure.z += (lz - world.lure.z) * Math.min(1, dt * 14);

    // --- pulse -----------------------------------------------------------
    if (input.pulse && d.pulseT <= 0 && world.phase === 'combat') {
      d.pulseT = d.pulseCooldown;
      d.pulseAnim = 1;
      for (const h of world.hunters) {
        const hx = h.x - d.x, hz = h.z - d.z, hd = Math.hypot(hx, hz);
        if (hd < d.pulseRadius + h.def.radius && hd > 0.01) {
          const push = d.pulseForce * (1 - hd / (d.pulseRadius + h.def.radius) * 0.5);
          h.vx += (hx / hd) * push; h.vz += (hz / hd) * push;
          h.stunT = Math.max(h.stunT, d.pulseStun);
        }
      }
      world.emit('pulse', { x: d.x, z: d.z, radius: d.pulseRadius });
    }

    stepSwarm(dt);
    stepBloom(dt);
    stepFlare(dt);
    stepHunters(dt);

    // --- spawning / wave flow -------------------------------------------
    if (world.spawnQueue.length > 0) {
      world.spawnT -= dt;
      if (world.spawnT <= 0) {
        spawnHunter(world.spawnQueue.shift());
        world.spawnT = world.wave >= 6 ? 0.8 : 1.05;
      }
    } else if (world.hunters.length === 0 && world.phase === 'combat') {
      world.phase = 'cleared';
      world.emit('waveClear', { wave: world.wave });
    }
  };

  function stepSwarm(dt) {
    const { mx, mz, mvx, mvz } = world;
    const n = world.moteCount;
    const lure = world.lure, d = world.drone;
    let cx = 0, cz = 0;
    for (let i = 0; i < n; i += 1) { cx += mx[i]; cz += mz[i]; }
    if (n > 0) { world.centroid.x = cx / n; world.centroid.z = cz / n; }

    // Steering is velocity-based (Reynolds): each mote has a desired velocity
    // — toward the lure, arriving softly — and steers its own velocity toward
    // it. That is what makes the swarm flow as a river and settle into a knot
    // on the lure instead of sloshing past it.
    const response = 3.1 * (world.swarm.lurePull / SWARM.lurePull);
    for (let i = 0; i < n; i += 1) {
      let ax = 0, az = 0, near = 0, avx = 0, avz = 0, apx = 0, apz = 0;
      for (let j = 0; j < n; j += 1) {
        if (j === i) continue;
        const ox = mx[i] - mx[j], oz = mz[i] - mz[j];
        const d2 = ox * ox + oz * oz;
        if (d2 < SWARM.cohesionRadius * SWARM.cohesionRadius && d2 > 0.0001) {
          near += 1; avx += mvx[j]; avz += mvz[j]; apx += mx[j]; apz += mz[j];
          if (d2 < SWARM.separationRadius * SWARM.separationRadius) {
            const dist = Math.sqrt(d2);
            const push = (SWARM.separationRadius - dist) * 30 * SWARM.separation;
            ax += (ox / dist) * push; az += (oz / dist) * push;
          }
        }
      }
      if (near > 0) {
        ax += ((avx / near) - mvx[i]) * SWARM.alignment * 3;
        az += ((avz / near) - mvz[i]) * SWARM.alignment * 3;
        ax += ((apx / near) - mx[i]) * SWARM.cohesion * 1.6;
        az += ((apz / near) - mz[i]) * SWARM.cohesion * 1.6;
      }
      // The lure: desired velocity points at it, easing off as we arrive —
      // plus a tangential swirl near the point, so the swarm does not pool
      // into a ball but keeps flowing around it as a ring of light. That
      // orbit is also how the river surrounds a hollow to burn it.
      const tx = lure.x - mx[i], tz = lure.z - mz[i];
      const td = Math.hypot(tx, tz);
      if (td > 0.01) {
        const arrive = Math.min(1, td / 6.5);
        const dvx = (tx / td) * world.swarm.maxSpeed * (0.25 + 0.75 * arrive);
        const dvz = (tz / td) * world.swarm.maxSpeed * (0.25 + 0.75 * arrive);
        ax += (dvx - mvx[i]) * response;
        az += (dvz - mvz[i]) * response;
        const swirl = 22 * Math.max(0, 1 - td / 5.5);
        ax += (-tz / td) * swirl;
        az += (tx / td) * swirl;
      }
      // The shepherd: a gentle tether so the flock never fully leaves it.
      const sx = d.x - mx[i], sz = d.z - mz[i];
      const sd = Math.hypot(sx, sz);
      if (sd > 9) { ax += (sx / sd) * (sd - 9) * SWARM.dronePull * 2.4; az += (sz / sd) * (sd - 9) * SWARM.dronePull * 2.4; }
      // Rim: turn back inside.
      const rc = Math.hypot(mx[i], mz[i]);
      if (rc > ARENA_RADIUS - 2.2) {
        ax += (-mx[i] / rc) * (rc - (ARENA_RADIUS - 2.2)) * 30;
        az += (-mz[i] / rc) * (rc - (ARENA_RADIUS - 2.2)) * 30;
      }
      // Cap acceleration, integrate, clamp speed (with a floor so it flows).
      const al = Math.hypot(ax, az);
      const maxA = SWARM.maxForce * 2.4;
      if (al > maxA) { ax *= maxA / al; az *= maxA / al; }
      mvx[i] += ax * dt; mvz[i] += az * dt;
      const sp = Math.hypot(mvx[i], mvz[i]);
      const maxS = world.swarm.maxSpeed;
      if (sp > maxS) { mvx[i] *= maxS / sp; mvz[i] *= maxS / sp; }
      else if (sp < 2.2 && sp > 0.01) { mvx[i] *= 2.2 / sp; mvz[i] *= 2.2 / sp; }
      mx[i] += mvx[i] * dt; mz[i] += mvz[i] * dt;
      const pc = Math.hypot(mx[i], mz[i]);
      if (pc > ARENA_RADIUS - 0.4) { mx[i] *= (ARENA_RADIUS - 0.4) / pc; mz[i] *= (ARENA_RADIUS - 0.4) / pc; }
    }
  }

  function stepBloom(dt) {
    const b = world.bloom;
    if (!b.active) {
      b.respawnT -= dt;
      if (b.respawnT <= 0 && world.phase === 'combat') {
        for (let tries = 0; tries < 12; tries += 1) {
          const a = world.rng.range(0, TAU), dist = world.rng.range(6, ARENA_RADIUS - 7);
          const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
          if (Math.hypot(x - world.drone.x, z - world.drone.z) < 11) continue;
          b.x = x; b.z = z; break;
        }
        b.lifeMax = BLOOM.life * world.bloomLifeFactor;
        b.lifeT = b.lifeMax;
        b.active = true;
        world.emit('bloomSpawn', { x: b.x, z: b.z });
      }
      return;
    }
    b.lifeT -= dt;
    let inside = 0;
    for (let i = 0; i < world.moteCount; i += 1) {
      if (Math.hypot(world.mx[i] - b.x, world.mz[i] - b.z) < BLOOM.radius) inside += 1;
    }
    b.inside = inside;
    if (inside >= BLOOM.need) {
      const gained = Math.round(BLOOM.score * world.combo.mult);
      world.score += gained;
      world.harvested += 1;
      comboLink();
      world.addMotes(BLOOM.motes, b.x, b.z);
      world.emit('harvest', { x: b.x, z: b.z, gained });
      b.active = false;
      b.respawnT = BLOOM.respawn;
    } else if (b.lifeT <= 0) {
      world.emit('bloomFade', { x: b.x, z: b.z });
      b.active = false;
      b.respawnT = BLOOM.respawn * 0.6;
    }
  }

  function stepFlare(dt) {
    const f = world.flare;
    if (f.active) { f.t -= dt; if (f.t <= 0) f.active = false; }
    if (world.flareEvery > 0 && world.phase === 'combat') {
      world.flareT -= dt;
      if (world.flareT <= 0) {
        f.active = true; f.x = world.drone.x; f.z = world.drone.z; f.t = 4;
        world.flareT = world.flareEvery;
        world.emit('flare', { x: f.x, z: f.z });
      }
    }
  }

  function stepHunters(dt) {
    const d = world.drone;
    for (let hi = world.hunters.length - 1; hi >= 0; hi -= 1) {
      const h = world.hunters[hi];
      if (h.flash > 0) h.flash -= dt * 3;
      if (h.hitT > 0) h.hitT -= dt;

      // --- count the swarm on this hollow: burn and feeding -------------
      let onIt = 0, nearestMote = -1, nearestD = Infinity;
      const reach = h.def.radius + SWARM.burnRadius;
      for (let i = 0; i < world.moteCount; i += 1) {
        const ox = world.mx[i] - h.x, oz = world.mz[i] - h.z;
        const dd = ox * ox + oz * oz;
        if (dd < reach * reach) { onIt += 1; if (dd < nearestD) { nearestD = dd; nearestMote = i; } }
      }
      const overwhelm = h.def.overwhelm ?? SWARM.overwhelm;
      const isBoss = h.kind === 'undershepherd';
      h.ring = onIt;
      if (onIt > 0 && (!isBoss || onIt >= overwhelm)) {
        const factor = h.def.burnFactor ?? 1;
        h.hp -= onIt * SWARM.burnDps * factor * dt;
        h.flash = Math.min(1, 0.35 + onIt / 30);
        if (world.rng.chance(dt * 6)) world.emit('burnTick', { x: h.x, z: h.z });
      }
      if (h.hp <= 0) { killHunter(h, hi); continue; }

      // --- feeding: an un-overwhelmed hollow eats the light -------------
      if (onIt < overwhelm) {
        h.eatT -= dt;
        if (h.eatT <= 0) {
          h.eatT = h.def.eatEvery;
          if (nearestMote >= 0 && nearestD < (h.def.radius + h.def.eatRadius) ** 2) {
            world.emit('eaten', { x: world.mx[nearestMote], z: world.mz[nearestMote] });
            killMote(nearestMote);
          }
        }
      }

      // --- movement ------------------------------------------------------
      let tx = d.x, tz = d.z;
      if (world.flare.active) { tx = world.flare.x; tz = world.flare.z; }
      else if (h.def.hunts === 'swarm') { tx = world.centroid.x; tz = world.centroid.z; }

      if (h.stunT > 0) {
        h.stunT -= dt;
        h.vx *= 1 - Math.min(1, dt * 6); h.vz *= 1 - Math.min(1, dt * 6);
      } else if (h.kind === 'charger') {
        h.stateT -= dt;
        if (h.state === 'stalk') {
          steer(h, tx, tz, h.def.speed, dt);
          h.dashT -= dt;
          if (h.dashT <= 0 && Math.hypot(tx - h.x, tz - h.z) < 17) { h.state = 'telegraph'; h.stateT = h.def.telegraph; }
        } else if (h.state === 'telegraph') {
          h.vx *= 1 - Math.min(1, dt * 8); h.vz *= 1 - Math.min(1, dt * 8);
          if (h.stateT <= 0) {
            const a = Math.atan2(tz - h.z, tx - h.x);
            h.dashX = Math.cos(a); h.dashZ = Math.sin(a);
            h.state = 'dash'; h.stateT = 0.42;
            world.emit('charge', { x: h.x, z: h.z });
          }
        } else if (h.state === 'dash') {
          h.vx = h.dashX * h.def.dashSpeed; h.vz = h.dashZ * h.def.dashSpeed;
          if (h.stateT <= 0) { h.state = 'stalk'; h.dashT = h.def.dashEvery; }
        }
      } else {
        steer(h, tx, tz, h.def.speed, dt);
      }
      // Soft separation from other hunters.
      for (const o of world.hunters) {
        if (o === h) continue;
        const ox = h.x - o.x, oz = h.z - o.z;
        const rr = h.def.radius + o.def.radius + 0.4;
        const dd = ox * ox + oz * oz;
        if (dd < rr * rr && dd > 0.001) {
          const l = Math.sqrt(dd);
          h.vx += (ox / l) * 6 * dt * 10; h.vz += (oz / l) * 6 * dt * 10;
        }
      }
      h.x += h.vx * dt; h.z += h.vz * dt;
      const hc = Math.hypot(h.x, h.z), hMax = ARENA_RADIUS - h.def.radius * 0.5;
      if (hc > hMax) { h.x *= hMax / hc; h.z *= hMax / hc; }

      // --- biting the shepherd -------------------------------------------
      const bd = Math.hypot(h.x - d.x, h.z - d.z);
      if (bd < h.def.radius + DRONE.radius && d.graceT <= 0 && world.phase === 'combat') {
        d.hp -= h.def.contact;
        d.graceT = DRONE.contactGrace;
        h.hitT = 0.3;
        world.emit('hurt', { x: d.x, z: d.z, hp: d.hp });
        if (d.hp <= 0) {
          d.hp = 0;
          world.phase = 'over';
          world.emit('gameOver', { score: world.score, wave: world.wave });
        }
      }
    }
  }

  function steer(h, tx, tz, speed, dt) {
    const wander = Math.sin(world.time * 1.7 + h.phase) * 0.35;
    const a = Math.atan2(tz - h.z, tx - h.x) + wander * 0.3;
    const tvx = Math.cos(a) * speed, tvz = Math.sin(a) * speed;
    h.vx += (tvx - h.vx) * Math.min(1, dt * 3.2);
    h.vz += (tvz - h.vz) * Math.min(1, dt * 3.2);
  }

  world.reset(seed);
  return world;
}
