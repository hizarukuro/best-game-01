// LURELIGHT — boot, state machine and the fixed-step loop.
// States: title (attract circle behind the menu) → playing → upgrade draft
// between waves → over; pause overlays playing. The sim only ever advances
// in STEP slices, however fast the display runs. ?shot= scenes stage a real
// run with the autopilot and freeze it for the entry's screenshots.

import { STEP, UPGRADES } from './config.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createRender } from './render.js';
import { attractInput, createStaging } from './shots.js';
import { createWorld } from './world.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const canvas = document.getElementById('game');

const world = createWorld(1);
try { world.best = parseInt(localStorage.getItem('lurelight-best') ?? '0', 10) || 0; } catch { world.best = 0; }
const render = createRender(canvas, world);
const audio = createAudio();
const input = createInput(canvas);

let state = 'title';
let currentDealt = [];
const feedThrottle = new Map();
function throttled(key, ms) {
  const now = performance.now();
  if (now - (feedThrottle.get(key) ?? -1e9) < ms) return false;
  feedThrottle.set(key, now);
  return true;
}

const hud = createHud({ onUpgrade: (u) => upgradePick(u) });

function upgradePick(u) {
  if (state !== 'upgrade') return;
  u.apply(world);
  world.fitted[u.id] = (world.fitted[u.id] ?? 0) + 1; // the loadout panel reads this
  audio.upgrade();
  hud.hideUpgrade();
  hud.feed(`${u.name.toUpperCase()} FITTED`, 'good');
  world.startWave(world.wave + 1);
  state = 'playing';
}

function dealUpgrades() {
  hud.clearBanner(); // the draft screen has its own heading; don't stack them
  const pool = [...UPGRADES];
  currentDealt = [];
  for (let i = 0; i < 3; i += 1) currentDealt.push(pool.splice(Math.floor(world.rng.next() * pool.length), 1)[0]);
  hud.showUpgrade(currentDealt);
  state = 'upgrade';
}

world.emit = (type, data) => {
  render.handleEvent(type, data);
  if (state === 'title') return; // the attract circle stays quiet behind the menu
  if (type === 'wave') {
    audio.wave();
    if (data.boss) audio.boss();
    hud.banner(data.line, data.boss
      ? 'IT BURNS ONLY WHEN THE WHOLE RIVER HOLDS IT'
      : (data.veil ? `VEIL — ${data.veil.name}: ${data.veil.desc.toUpperCase()}` : ''));
    hud.feed(data.line, data.boss ? 'bad' : '');
    if (data.veil && !data.boss) hud.feed(`VEIL — ${data.veil.name}: ${data.veil.desc}`, 'good');
  } else if (type === 'waveClear') {
    hud.banner(`WAVE ${data.wave} CLEARED`, 'CHOOSE AN OVERCLOCK');
    if (!SHOT && state === 'playing') {
      setTimeout(() => { if (state === 'playing' && world.phase === 'cleared') dealUpgrades(); }, 700);
    }
  } else if (type === 'harvest') {
    audio.harvest();
    hud.feed(data.kind === 'sun' ? `SUNBLOOM HARVESTED +${data.gained} · +8 MOTES` : `BLOOM HARVESTED +${data.gained} · +4 MOTES`, 'good');
  } else if (type === 'bloomSpawn') hud.feed(data.kind === 'sun' ? 'A SUNBLOOM OPENS — RICHER LIGHT' : 'A BLOOM OPENS', data.kind === 'sun' ? 'good' : '');
  else if (type === 'bloomFade') hud.feed('THE BLOOM WITHERS', 'bad');
  else if (type === 'shriek') { audio.shriek(); if (throttled('shriek', 2000)) hud.feed('THE WAILER SHRIEKS — THE RIVER SCATTERS', 'bad'); }
  else if (type === 'burnDeath') {
    audio.burn();
    if (data.kind === 'undershepherd') hud.banner('THE UNDERSHEPHERD BURNS', `+${data.gained}`);
    else if (throttled('kill', 1400)) hud.feed(`HOLLOW BURNED +${data.gained}`);
  } else if (type === 'eaten') { if (throttled('eaten', 300)) audio.eaten(); }
  else if (type === 'hurt') { audio.hurt(); hud.flashDamage(); if (throttled('hurt', 2600)) hud.feed('HULL BREACH — THE DARK BITES', 'bad'); }
  else if (type === 'pulse') audio.pulse();
  else if (type === 'flare') hud.feed('DECOY FLARE LIT', 'good');
  else if (type === 'gameOver') {
    audio.over();
    try { localStorage.setItem('lurelight-best', String(world.best)); } catch { /* private mode: the session best still stands */ }
    if (!SHOT) setTimeout(() => { if (world.phase === 'over') { state = 'over'; hud.showOver(world); } }, 1000);
  }
};

function attractSetup() {
  world.reset(7);
  world.spawnQueue.length = 0;
  world.hunters.length = 0;
  world.spawnAt('stalker', -20, -14);
  world.spawnAt('stalker', 22, -10);
  world.spawnAt('maw', 18, 16);
  world.bloom.active = true;
  world.bloom.x = -13; world.bloom.z = 9;
  world.bloom.lifeT = world.bloom.lifeMax = 16;
}

function startGame() {
  audio.start();
  hud.hideTitle();
  hud.hideOver();
  world.reset((Date.now() % 2147483646) + 1);
  state = 'playing';
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  else if (state === 'over' && (e.code === 'KeyR' || e.code === 'Enter')) startGame();
  else if (state === 'upgrade') {
    const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (idx >= 0 && currentDealt[idx]) upgradePick(currentDealt[idx]);
  }
});

// --- staged screenshot scenes ----------------------------------------------
let liveStaging = null;
if (SHOT) {
  const seed = parseInt(params.get('seed') ?? '1', 10) || 1;
  state = SHOT === 'start' ? 'title' : 'playing';
  const staging = createStaging(SHOT, world, seed);
  const renderEvery = SHOT === 'upgrade' ? 12 : 3;
  let i = 0;
  while (!staging.done) {
    world.step(staging.input());
    i += 1;
    if (i % renderEvery === 0) render.update(STEP * renderEvery);
    if (i > 60 * 180) break;
  }
  render.update(STEP);
  if (SHOT === 'start') hud.showTitle();
  if (SHOT === 'upgrade') dealUpgrades();
  if (SHOT === 'cover') hud.clearBanner(); // the boss bar + directive carry the same facts, without crossing the panels
  if (SHOT === 'over') { hud.clearBanner(); hud.showOver(world); }
  window.__shotReady = true;
  if (params.get('live') === '1') liveStaging = staging;
} else {
  attractSetup();
  hud.showTitle();
}

window.__lr = { world, get state() { return state; } };

// --- the loop ------------------------------------------------------------------
let last = performance.now();
let acc = 0;
let pausedShown = false;
function frame(now) {
  requestAnimationFrame(frame);
  // Clamp both ways: after a long block (a staged scene, a hidden tab) the
  // rAF timestamp can jump or even run behind performance.now(), and a
  // negative dt would run every lerp and timer in the game backwards.
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;

  const paused = input.state.paused && state === 'playing' && !SHOT;
  if (paused !== pausedShown) { pausedShown = paused; hud.showPause(paused); }

  if (!paused) {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 8) {
      guard += 1;
      acc -= STEP;
      if (SHOT && !liveStaging) break;
      if (state === 'title') {
        world.step(attractInput(world));
        if (world.phase === 'over') attractSetup();
      } else if (state === 'playing') {
        if (liveStaging) world.step(liveStaging.input());
        else {
          const move = input.move();
          const aim = render.screenToWorld(input.state.aimX, input.state.aimY);
          world.step({ mx: move.x, mz: move.z, aimX: aim.x, aimZ: aim.z, pulse: input.takePulse() });
        }
      }
    }
  }

  render.update(Math.min(0.05, dt));
  hud.update(world, dt);
  if (world.bloom.active) {
    const p = render.project(world.bloom.x, world.bloom.z);
    hud.setBloomTag(p.x, p.y, !p.behind, world.bloom);
  } else hud.setBloomTag(0, 0, false, world.bloom);
}
requestAnimationFrame(frame);
