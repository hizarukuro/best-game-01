// three.js rendering for LURELIGHT. Reads the world state each frame and syncs
// meshes: the golden mote river (points + fading trail ghosts), the shepherd
// drone with its signal beam to the lure point, the Hollow as dark shards with
// red eyes, bloom rings, a decoy flare, and a pooled particle system for
// burns, feedings and harvests. All art is geometry + the canvas textures.

import * as THREE from 'three';
import { ARENA_RADIUS, BLOOM, SWARM } from './config.js';
import { eyeTexture, floorTexture, glowTexture } from './textures.js';

const TRAIL = 8; // ghost points per mote
const MAX_PARTICLES = 700;

/** Each kind's silhouette: no two Hollow read alike at a glance. */
const HUNTER_GEO = {
  stalker: () => new THREE.OctahedronGeometry(1.0),
  maw: () => new THREE.IcosahedronGeometry(1.45, 1),
  brood: () => new THREE.IcosahedronGeometry(1.5, 0),
  mite: () => new THREE.TetrahedronGeometry(0.66),
  charger: () => new THREE.ConeGeometry(0.82, 2.7, 4),
  wailer: () => new THREE.TorusGeometry(1.02, 0.42, 10, 5),
  undershepherd: () => new THREE.IcosahedronGeometry(3.1, 1),
};

/** The coloured dread-light pooling under each kind (matches the manifest). */
const UNDER_GLOW = {
  stalker: 0x901818, maw: 0xa83c10, brood: 0x5a1890, mite: 0x901850,
  charger: 0xb02020, wailer: 0x0f6a72, undershepherd: 0xa01818,
};

export function createRender(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060e);
  scene.fog = new THREE.Fog(0x04060e, 55, 115);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 300);
  const focus = new THREE.Vector3(0, 0, 2);
  let shake = 0;

  scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x0a0c18, 0.6));
  const sun = new THREE.DirectionalLight(0xbfd4ff, 1.1);
  sun.position.set(18, 32, 10);
  scene.add(sun);

  const glowTex = glowTexture();
  const eyeTex = eyeTexture();

  // --- arena -------------------------------------------------------------
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS + 4, 72),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92, metalness: 0.08 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS + 0.4, 0.32, 10, 140),
    new THREE.MeshStandardMaterial({ color: 0x0d1626, emissive: 0x1d5f8a, emissiveIntensity: 0.9, roughness: 0.5 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.35;
  scene.add(rim);

  const gateMat = new THREE.MeshStandardMaterial({ color: 0x140b0d, emissive: 0x8a1d12, emissiveIntensity: 1.4, roughness: 0.6 });
  const gateGeo = new THREE.BoxGeometry(1.6, 2.6, 0.7);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const gate = new THREE.Mesh(gateGeo, gateMat);
    gate.position.set(Math.cos(a) * (ARENA_RADIUS + 0.4), 1.3, Math.sin(a) * (ARENA_RADIUS + 0.4));
    gate.rotation.y = -a + Math.PI / 2;
    scene.add(gate);
  }

  // Standing stones inside the rim: old shepherd-markers, each capped with a
  // faint gold rune-band, so the ring has landmarks the eye can steer by.
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x131c30, roughness: 0.85, metalness: 0.15, flatShading: true });
  const runeMat = new THREE.MeshStandardMaterial({ color: 0x2a1c05, emissive: 0xffb84d, emissiveIntensity: 0.55, roughness: 0.5 });
  const stoneGeo = new THREE.BoxGeometry(1.1, 3.4, 0.8);
  const runeGeo = new THREE.BoxGeometry(1.14, 0.28, 0.84);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.39;
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(Math.cos(a) * (ARENA_RADIUS - 4.6), 1.7, Math.sin(a) * (ARENA_RADIUS - 4.6));
    stone.rotation.y = -a + Math.PI / 2;
    stone.rotation.z = (i % 3 - 1) * 0.045;
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.y = 1.05;
    stone.add(rune);
    scene.add(stone);
  }

  // Ambient dust: two hundred motes of plain night air, drifting slowly, so
  // the dark between the lights has depth instead of flat black.
  const DUST = 220;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i += 1) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ARENA_RADIUS + 6);
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = 0.4 + Math.random() * 5.5;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
    dustSeed[i] = Math.random() * Math.PI * 2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.32, map: glowTex, color: 0x5a76b8, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  dust.frustumCulled = false;
  scene.add(dust);

  // --- the shepherd -------------------------------------------------------
  const droneGroup = new THREE.Group();
  const droneBody = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 0),
    new THREE.MeshStandardMaterial({ color: 0xd9a441, emissive: 0xa86f14, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.55, flatShading: true }),
  );
  droneBody.scale.y = 0.62;
  droneGroup.add(droneBody);
  const droneCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0 }),
  );
  droneGroup.add(droneCore);
  const droneRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.09, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x8a6420, emissive: 0xffb84d, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.6 }),
  );
  droneRing.rotation.x = Math.PI / 2.4;
  droneGroup.add(droneRing);
  const droneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc873, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  droneGlow.scale.setScalar(7.5);
  droneGroup.add(droneGlow);
  const droneLight = new THREE.PointLight(0xffbe6e, 260, 34, 1.9);
  droneLight.position.y = 2.5;
  droneGroup.add(droneLight);
  scene.add(droneGroup);

  // Signal beam drone → lure, and the lure marker itself.
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(beam);
  const lureGroup = new THREE.Group();
  const lureRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.07, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xffe1a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  lureRing.rotation.x = Math.PI / 2;
  lureGroup.add(lureRing);
  const lureGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd98a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  lureGlow.scale.setScalar(3.4);
  lureGroup.add(lureGlow);
  scene.add(lureGroup);

  // --- the swarm: heads + trail ghosts in two point clouds -----------------
  function makePoints(count, size, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return points;
  }
  const heads = makePoints(SWARM.max, 1.85, 0.95);
  const ghosts = makePoints(SWARM.max * TRAIL, 1.45, 0.72);
  const history = new Float32Array(SWARM.max * TRAIL * 2); // x,z per ghost slot
  let histTick = 0;

  // --- hunters --------------------------------------------------------------
  const hunterMeshes = new Map(); // hunter object -> group
  function hunterGroup(h) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: h.kind === 'brood' ? 0x0a0610 : 0x05070d, roughness: 0.95, metalness: 0.1, flatShading: true, emissive: 0x000000 });
    const body = new THREE.Mesh(HUNTER_GEO[h.kind](), mat);
    body.position.y = h.def.radius + 0.35;
    if (h.kind === 'stalker') body.scale.set(1, 1.35, 1);
    if (h.kind === 'charger') { body.rotation.x = Math.PI / 2; body.position.y = 1.2; }
    if (h.kind === 'wailer') { body.rotation.x = Math.PI / 2; body.position.y = 1.5; }
    group.add(body);
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
    eye.renderOrder = 5;
    const eyeScale = h.kind === 'undershepherd' ? 2.6 : h.kind === 'maw' ? 1.7 : h.kind === 'wailer' ? 1.35 : 1.1;
    eye.scale.setScalar(eyeScale);
    eye.position.y = h.def.radius + 0.55;
    group.add(eye);
    const under = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: UNDER_GLOW[h.kind] ?? 0x901818, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }));
    under.scale.setScalar(h.def.radius * 3.4);
    under.position.y = 0.25;
    group.add(under);
    // (No point light of its own for the boss: its dread-light sprite, eye
    // and ember flash carry it, and one fewer light keeps every standard
    // material in the scene cheaper to shade.)
    let shards = null;
    if (h.kind === 'undershepherd') {
      shards = new THREE.Group();
      const shardGeo = new THREE.OctahedronGeometry(0.55);
      for (let i = 0; i < 5; i += 1) {
        const s = new THREE.Mesh(shardGeo, mat);
        const a = (i / 5) * Math.PI * 2;
        s.position.set(Math.cos(a) * 4.3, 3.4 + Math.sin(i * 2.3) * 0.5, Math.sin(a) * 4.3);
        shards.add(s);
      }
      group.add(shards);
    }
    group.userData = { body, mat, eye, shards, eyeScale };
    scene.add(group);
    hunterMeshes.set(h, group);
    return group;
  }

  // --- bloom ring + flare ---------------------------------------------------
  const bloomGroup = new THREE.Group();
  const bloomRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(BLOOM.radius, 0.24, 10, 72),
    new THREE.MeshBasicMaterial({ color: 0x8dff9e, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  bloomRingMesh.rotation.x = Math.PI / 2;
  bloomRingMesh.position.y = 0.3;
  bloomGroup.add(bloomRingMesh);
  const bloomDisc = new THREE.Mesh(
    new THREE.CircleGeometry(BLOOM.radius, 48),
    new THREE.MeshBasicMaterial({ color: 0x3fae5f, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  bloomDisc.rotation.x = -Math.PI / 2;
  bloomDisc.position.y = 0.12;
  bloomGroup.add(bloomDisc);
  const bloomLight = new THREE.PointLight(0x7dff9a, 120, 22, 1.9);
  bloomLight.position.y = 2.2;
  bloomGroup.add(bloomLight);
  // A pillar of light over the ring, so a bloom calls from across the arena.
  const bloomPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(BLOOM.radius * 0.92, BLOOM.radius * 0.92, 8, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x8dff9e, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  bloomPillar.position.y = 4;
  bloomGroup.add(bloomPillar);
  bloomGroup.visible = false;
  scene.add(bloomGroup);

  const flareSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3cf, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  flareSprite.scale.setScalar(6);
  flareSprite.visible = false;
  scene.add(flareSprite);

  // --- particles + pulse rings ----------------------------------------------
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
  const pPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.8, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pPoints.frustumCulled = false;
  scene.add(pPoints);
  const particles = [];
  function burst(x, z, { count = 12, color = [1, 0.72, 0.3], speed = 9, y = 1.2, life = 0.6, up = 5 } = {}) {
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i += 1) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y: y + Math.random() * 0.8, z, vx: Math.cos(a) * s, vy: Math.random() * up, vz: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.7), maxLife: life, r: color[0], g: color[1], b: color[2] });
    }
  }
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.09, 8, 48);
  function pulseRing(x, z, maxR, color = 0xffd98a) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 0.5, z);
    scene.add(m);
    rings.push({ m, t: 0, maxR });
  }

  function handleEvent(type, data) {
    if (type === 'burnDeath') burst(data.x, data.z, { count: Math.round(16 * data.radius) + 8, color: [1, 0.66, 0.25], speed: 11, life: 0.8, up: 7 });
    else if (type === 'burnTick') burst(data.x, data.z, { count: 2, color: [1, 0.6, 0.2], speed: 5, life: 0.4, up: 4 });
    else if (type === 'eaten') burst(data.x, data.z, { count: 5, color: [0.55, 0.65, 1], speed: 3.5, life: 0.5, up: 2.5 });
    else if (type === 'harvest') { burst(data.x, data.z, { count: 42, color: [0.55, 1, 0.6], speed: 10, life: 1, up: 10 }); pulseRing(data.x, data.z, BLOOM.radius + 2.5, 0x8dff9e); }
    else if (type === 'pulse') { pulseRing(data.x, data.z, data.radius, 0xffd98a); shake = Math.max(shake, 0.25); }
    else if (type === 'shriek') { pulseRing(data.x, data.z, data.radius, 0x39d0d8); burst(data.x, data.z, { count: 14, color: [0.25, 0.85, 0.9], speed: 12, life: 0.5, up: 4 }); shake = Math.max(shake, 0.3); }
    else if (type === 'hurt') { shake = Math.max(shake, 0.55); burst(data.x, data.z, { count: 10, color: [1, 0.3, 0.2], speed: 7, life: 0.5 }); }
    else if (type === 'bossDown') { burst(data.x, data.z, { count: 90, color: [1, 0.7, 0.3], speed: 16, life: 1.3, up: 11 }); shake = Math.max(shake, 0.8); }
    else if (type === 'spawn') burst(data.x, data.z, { count: 6, color: [0.9, 0.25, 0.2], speed: 4, life: 0.5, up: 3 });
  }

  // --- per-frame sync ---------------------------------------------------------
  const v3 = new THREE.Vector3();
  function update(dt) {
    const t = world.time;
    const d = world.drone;

    // Drone.
    droneGroup.position.set(d.x, 1.15 + Math.sin(t * 2.1) * 0.13, d.z);
    droneBody.rotation.y = t * 0.7;
    droneRing.rotation.z = t * 1.4;
    const hurtFlash = d.graceT > 0.2 ? 0.5 + Math.sin(t * 40) * 0.3 : 0;
    droneGlow.material.opacity = 0.75 + Math.sin(t * 3.2) * 0.12 + hurtFlash * 0.3;
    droneLight.intensity = 240 + Math.sin(t * 3.2) * 40;

    // Lure + beam.
    lureGroup.position.set(world.lure.x, 0.35 + Math.sin(t * 4) * 0.08, world.lure.z);
    lureRing.rotation.z = t * 2;
    const pos = beam.geometry.attributes.position;
    pos.setXYZ(0, d.x, 1.2, d.z);
    pos.setXYZ(1, world.lure.x, 0.5, world.lure.z);
    pos.needsUpdate = true;

    // Swarm points.
    histTick += 1;
    const hp = heads.geometry.attributes.position, hc = heads.geometry.attributes.color;
    const gp = ghosts.geometry.attributes.position, gc = ghosts.geometry.attributes.color;
    if (histTick % 3 === 0) {
      for (let i = SWARM.max - 1; i >= 0; i -= 1) {
        for (let k = TRAIL - 1; k > 0; k -= 1) {
          history[(i * TRAIL + k) * 2] = history[(i * TRAIL + k - 1) * 2];
          history[(i * TRAIL + k) * 2 + 1] = history[(i * TRAIL + k - 1) * 2 + 1];
        }
        history[i * TRAIL * 2] = world.mx[i];
        history[i * TRAIL * 2 + 1] = world.mz[i];
      }
    }
    for (let i = 0; i < SWARM.max; i += 1) {
      const alive = i < world.moteCount;
      const y = alive ? 1.15 + Math.sin(t * 2.3 + world.mphase[i]) * 0.3 : -50;
      hp.setXYZ(i, alive ? world.mx[i] : 0, y, alive ? world.mz[i] : 0);
      const tw = 0.82 + Math.sin(t * 5 + world.mphase[i] * 3) * 0.18;
      hc.setXYZ(i, tw, tw * 0.8, tw * 0.45);
      for (let k = 0; k < TRAIL; k += 1) {
        const gi = i * TRAIL + k;
        const fade = alive ? (1 - (k + 1) / (TRAIL + 1)) * 0.55 : 0;
        gp.setXYZ(gi, history[gi * 2], alive ? 1.15 + Math.sin(t * 2.3 + world.mphase[i] - k * 0.4) * 0.3 : -50, history[gi * 2 + 1]);
        gc.setXYZ(gi, fade, fade * 0.78, fade * 0.4);
      }
    }
    hp.needsUpdate = true; hc.needsUpdate = true; gp.needsUpdate = true; gc.needsUpdate = true;

    // Hunters.
    const seen = new Set();
    for (const h of world.hunters) {
      seen.add(h);
      const group = hunterMeshes.get(h) ?? hunterGroup(h);
      group.position.set(h.x, Math.sin(t * 1.8 + h.phase) * 0.14, h.z);
      const u = group.userData;
      u.body.rotation.y = t * 0.5 + h.phase;
      if (h.kind === 'charger') {
        const a = Math.atan2(world.drone.z - h.z, world.drone.x - h.x);
        u.body.rotation.z = -a;
        if (h.state === 'telegraph') {
          group.position.x += (Math.random() - 0.5) * 0.14;
          group.position.z += (Math.random() - 0.5) * 0.14;
          u.eye.scale.setScalar(u.eyeScale * (1.5 + Math.sin(t * 30) * 0.25));
        } else u.eye.scale.setScalar(u.eyeScale);
      }
      if (h.kind === 'wailer') {
        u.body.rotation.z = t * 1.1;
        // The shriek gathers: the eye swells and the ring shivers first.
        if (h.state === 'telegraph') {
          group.position.x += (Math.random() - 0.5) * 0.1;
          group.position.z += (Math.random() - 0.5) * 0.1;
          u.eye.scale.setScalar(u.eyeScale * (1.6 + Math.sin(t * 26) * 0.3));
        } else u.eye.scale.setScalar(u.eyeScale);
      }
      if (u.shards) u.shards.rotation.y = t * 0.8;
      // Burn flash: embers in the cracks of the shell, never a full glow —
      // a burning hollow stays a dark shape with fire inside it. The level
      // is kept low and it flickers, so even the Undershepherd at full burn
      // reads as a black mass with a living ember light, not a lit disc.
      const f = Math.max(0, Math.min(1, h.flash)) * (0.78 + 0.22 * Math.sin(t * 23 + h.phase * 7));
      // The Undershepherd shades darker than its brood: at its size the
      // shepherd's own light would otherwise wash it tan, and it should
      // read as the blackest mass on the field, known by its eye.
      const tone = h.kind === 'undershepherd' ? 0.5 : 1;
      u.mat.emissive.setRGB(f * 0.21 * tone, f * 0.07 * tone, f * 0.013 * tone);
      u.mat.color.setRGB((0.02 + f * 0.05) * tone, (0.03 + f * 0.02) * tone, 0.05 * tone);
    }
    for (const [h, group] of hunterMeshes) {
      if (!seen.has(h)) { scene.remove(group); hunterMeshes.delete(h); }
    }

    // Bloom. A plain bloom is green and hurries as it fades; a sunbloom is
    // gold the whole of its longer life, with a taller pillar.
    const b = world.bloom;
    bloomGroup.visible = b.active;
    if (b.active) {
      bloomGroup.position.set(b.x, 0, b.z);
      const frac = Math.max(0, b.lifeT / b.lifeMax);
      const urgency = 1 + Math.sin(t * (2 + (1 - frac) * 6)) * 0.05;
      bloomRingMesh.scale.setScalar(urgency * (0.4 + frac * 0.6));
      const sun = b.kind === 'sun';
      if (sun) bloomRingMesh.material.color.setHex(0xffd34d);
      else bloomRingMesh.material.color.setHSL(0.36 - (1 - frac) * 0.22, 1, 0.65);
      bloomDisc.material.color.setHex(sun ? 0xae8a3f : 0x3fae5f);
      bloomDisc.material.opacity = 0.16 + (b.inside / b.need) * 0.38;
      bloomLight.color.setHex(sun ? 0xffd34d : 0x7dff9a);
      bloomLight.intensity = 120 + b.inside * 9;
      bloomPillar.material.color.setHex(sun ? 0xffd34d : 0x8dff9e);
      bloomPillar.material.opacity = 0.07 + (b.inside / b.need) * 0.08;
      bloomPillar.scale.y = sun ? 1.5 : 1;
    }

    // Flare.
    flareSprite.visible = world.flare.active;
    if (world.flare.active) {
      flareSprite.position.set(world.flare.x, 1.6 + Math.sin(t * 9) * 0.2, world.flare.z);
      flareSprite.material.opacity = 0.6 + Math.sin(t * 12) * 0.3;
    }

    // Particles.
    const pp = pPoints.geometry.attributes.position, pc = pPoints.geometry.attributes.color;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy -= 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.15) p.y = 0.15;
    }
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = particles[i];
      if (!p) { pp.setXYZ(i, 0, -60, 0); pc.setXYZ(i, 0, 0, 0); continue; }
      const f = p.life / p.maxLife;
      pp.setXYZ(i, p.x, p.y, p.z);
      pc.setXYZ(i, p.r * f, p.g * f, p.b * f);
    }
    pp.needsUpdate = true; pc.needsUpdate = true;

    // Pulse rings.
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.t += dt * 2.2;
      const s = 0.3 + r.t * r.maxR;
      r.m.scale.setScalar(s);
      r.m.material.opacity = Math.max(0, 0.8 * (1 - r.t));
      if (r.t >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
    }

    // Dust drift: a slow sideways breath through the whole arena.
    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i += 1) {
      dp.array[i * 3] += Math.sin(t * 0.22 + dustSeed[i]) * dt * 0.55;
      dp.array[i * 3 + 2] += Math.cos(t * 0.17 + dustSeed[i] * 1.7) * dt * 0.55;
    }
    dp.needsUpdate = true;

    // Camera: follow the shepherd, leaning toward the lure; shake on hits.
    const fx = d.x * 0.74 + world.lure.x * 0.26;
    const fz = d.z * 0.74 + world.lure.z * 0.26;
    focus.x += (fx - focus.x) * Math.min(1, dt * 3.2);
    focus.z += (fz - focus.z) * Math.min(1, dt * 3.2);
    shake = Math.max(0, shake - dt * 1.8);
    const shx = (Math.random() - 0.5) * shake * 1.4, shz = (Math.random() - 0.5) * shake * 1.4;
    camera.position.set(focus.x + shx, 38, focus.z + 19.5 + shz);
    v3.set(focus.x + shx * 0.4, 0, focus.z - 2 + shz * 0.4);
    camera.lookAt(v3);

    renderer.render(scene, camera);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /** World → screen pixels, for HUD tags that track world objects. */
  function project(x, z) {
    v3.set(x, 1, z).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight, behind: v3.z > 1 };
  }

  /** Screen pixels → world point on the drone's hover plane (mouse aim). */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function screenToWorld(sx, sy) {
    ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, dir = raycaster.ray.direction;
    const t = (1 - o.y) / dir.y;
    return { x: o.x + dir.x * t, z: o.z + dir.z * t };
  }

  return { update, handleEvent, project, screenToWorld, renderer };
}
