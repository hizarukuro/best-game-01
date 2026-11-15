// LURELIGHT — tuning constants. One place for every number the sim, the renderer
// and the HUD agree on: the round arena, the shepherd drone, the mote swarm
// (boids + burn rules), the hollow hunters, bloom rings, waves and upgrades.
// Nothing here touches the DOM or three.js.

/** The arena is a ring: playable radius from the centre. */
export const ARENA_RADIUS = 33;
/** Fixed simulation step, seconds. The loop never steps with anything else. */
export const STEP = 1 / 60;

export const DRONE = {
  radius: 0.95,
  speed: 16,
  hp: 100,
  /** How far from the drone the lure point (the mouse) can lead the swarm. */
  lureRange: 13,
  pulseRadius: 11.5,
  pulseForce: 46,
  pulseStun: 1.25,
  pulseCooldown: 4.5,
  contactGrace: 0.6,
};

export const SWARM = {
  start: 42,
  max: 110,
  /** Boids weights: the river look comes from strong lure pull + soft cohesion. */
  maxSpeed: 22.5,
  maxForce: 68,
  separationRadius: 1.15, separation: 1.7,
  alignmentRadius: 3.2, alignment: 0.55,
  cohesionRadius: 3.6, cohesion: 0.5,
  lurePull: 3.4,
  dronePull: 0.4,
  /** Burn: each mote within this radius of a hollow deals dps. */
  burnRadius: 1.8,
  burnDps: 8,
  /** A hollow ringed by at least this many motes cannot feed — it only burns. */
  overwhelm: 12,
};

/** Hunter archetypes. All of them hunt the light; each hunts it differently. */
export const HUNTERS = {
  stalker: { radius: 1.0, hp: 95, speed: 9.6, contact: 9, score: 60, label: 'Stalker', eatEvery: 0.95, eatRadius: 1.6, hunts: 'drone' },
  maw: { radius: 1.45, hp: 150, speed: 8.1, contact: 7, score: 110, label: 'Maw', eatEvery: 0.55, eatRadius: 2.3, hunts: 'swarm' },
  brood: { radius: 1.5, hp: 130, speed: 8.4, contact: 8, score: 100, label: 'Brood Hollow', eatEvery: 0.9, eatRadius: 1.7, hunts: 'drone', children: 2 },
  mite: { radius: 0.62, hp: 34, speed: 11.5, contact: 5, score: 30, label: 'Mite', eatEvery: 1.1, eatRadius: 1.2, hunts: 'drone' },
  charger: { radius: 1.1, hp: 120, speed: 7.0, contact: 14, score: 130, label: 'Lancer', eatEvery: 0.95, eatRadius: 1.6, hunts: 'drone', dashSpeed: 31, dashEvery: 3.4, telegraph: 0.7 },
  undershepherd: { radius: 3.1, hp: 1900, speed: 5.4, contact: 20, score: 2500, label: 'The Undershepherd', eatEvery: 0.5, eatRadius: 3.4, hunts: 'drone', overwhelm: 18, burnFactor: 0.62 },
};

/** Bloom rings: shepherd enough of the swarm inside one to harvest it. */
export const BLOOM = {
  radius: 4.3,
  need: 13,
  life: 16,
  respawn: 2.5,
  score: 150,
  motes: 4,
};

/** Score chain: kills and harvests inside the window raise the multiplier. */
export const COMBO = { window: 3.0, perLink: 0.25, maxMult: 8 };

/** The eight upgrades dealt three-at-a-time between waves. */
export const UPGRADES = [
  { id: 'sparks', name: 'New Sparks', desc: '+12 motes join the swarm at once. More light, more teeth.', apply: (w) => w.addMotes(12) },
  { id: 'signal', name: 'Longer Signal', desc: 'Lure range +45%. Lead the river from farther back.', apply: (w) => { w.drone.lureRange *= 1.45; } },
  { id: 'pull', name: 'Tighter River', desc: 'The swarm answers faster and holds a denser, hotter knot.', apply: (w) => { w.swarm.lurePull *= 1.3; w.swarm.maxSpeed *= 1.1; } },
  { id: 'pulse', name: 'Bright Pulse', desc: 'Pulse hits harder, stuns longer, returns 35% sooner.', apply: (w) => { w.drone.pulseForce *= 1.4; w.drone.pulseStun *= 1.4; w.drone.pulseCooldown *= 0.65; } },
  { id: 'flare', name: 'Decoy Flare', desc: 'Every 14 s a flare drops where you stand; the Hollow hunt it for 4 s.', apply: (w) => { w.flareEvery = Math.max(6, (w.flareEvery ?? 14) - 3); } },
  { id: 'slowbloom', name: 'Slow Bloom', desc: 'Bloom rings fade 40% slower. More time to thread the river through.', apply: (w) => { w.bloomLifeFactor *= 1.4; } },
  { id: 'plating', name: 'Pilgrim Plating', desc: '+30 max hull and patch 30 now. The dark bites; bite back less.', apply: (w) => { w.drone.hpMax += 30; w.drone.hp = Math.min(w.drone.hpMax, w.drone.hp + 30); } },
  { id: 'thrusters', name: 'Swift Thrusters', desc: '+15% thrust. A shepherd is only alive while moving.', apply: (w) => { w.drone.speed *= 1.15; } },
];

/** Wave recipe: what the dark sends, before trickle timing. */
export function waveRecipe(wave) {
  const r = { stalker: 3 + wave * 2, maw: 0, brood: 0, charger: 0, undershepherd: 0 };
  if (wave >= 2) r.maw = wave - 1;
  if (wave >= 3) r.brood = Math.floor((wave - 1) / 2);
  if (wave >= 4) chargerFix(r, wave);
  if (wave % 5 === 0) { r.undershepherd = 1; r.stalker += 4; r.maw += 2; }
  return r;
}
function chargerFix(r, wave) { r.charger = Math.floor((wave - 2) / 2); }

/** Hit points scale a little each wave so late waves stay dangerous. */
export function hpScale(wave) { return 1 + (wave - 1) * 0.12; }

/** Named callouts for the feed as each wave arrives. */
export const WAVE_LINES = {
  1: 'WAVE 1 — STALKERS AT THE RIM',
  2: 'WAVE 2 — MAWS COME TO FEED ON THE SWARM',
  3: 'WAVE 3 — BROOD HOLLOWS, THEY SPLIT WHEN KILLED',
  4: 'WAVE 4 — LANCERS CHARGE THE SHEPHERD',
  5: 'WAVE 5 — THE UNDERSHEPHERD COMES FOR ITS FLOCK',
};
export function waveLine(wave) {
  return WAVE_LINES[wave] ?? (wave % 5 === 0 ? `WAVE ${wave} — THE UNDERSHEPHERD AGAIN` : `WAVE ${wave} — THE DARK PRESSES IN`);
}
