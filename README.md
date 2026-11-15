# LURELIGHT — best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**You are the shepherd; the swarm is your only weapon.** LURELIGHT is an original arena survival game built on three.js 0.187.0. You pilot Pilgrim-9, a lure-drone with no gun, in the Shepherd's Ring. What follows your signal is a river of living motes of light — and the Hollow, dark hunters with red eyes, climb over the rim to eat that light. Lead the river onto them and they burn; let it thin and they feed. Thread the swarm through each bloom ring to grow it, draft an overclock between waves, and hold the light as long as you can.

Everything is original: the mechanic, the names, the art (procedural canvas textures and geometry) and every sound (synthesized WebAudio) are made for this game. It runs fully offline from static files — no build step, no network requests.

## Play it

```sh
node serve.ts          # then open http://localhost:8080
```

Any static file server pointed at `game/` works the same.

| Key | Action |
| --- | --- |
| W A S D / arrows | Steer the shepherd |
| Mouse | Place the lure — the swarm streams to it |
| Click / Space | Pulse: throw the Hollow back, briefly stunned |
| 1 · 2 · 3 / click | Choose an overclock between waves |
| P / Esc | Pause |

## The rules of the river

- **The swarm is the weapon, and it is also the ammunition.** Each mote on a hollow burns it; the burn scales with how many motes are touching. But a hollow that is *not* overwhelmed eats the motes touching it, one by one. A thin swarm is food. A thick swarm is a fire.
- **Five kinds of Hollow.** Stalkers hunt the drone. Maws hunt the swarm itself. Brood Hollows split into Mites when killed. Lancers telegraph and charge. Every fifth wave, **the Undershepherd** comes for its flock — it only burns while the whole river holds it, and it feeds fast.
- **Blooms grow the light.** A bloom ring opens somewhere in the ring; hold at least 13 motes inside it before it withers to harvest score and +4 motes.
- **Overclocks between waves.** Draft one of three: more motes, a longer signal, a tighter river, a brighter pulse, a decoy flare, slower blooms, plating, thrusters.
- **Score is a chain.** Kills and harvests inside three seconds of each other raise the multiplier, up to ×8.

## Layout

- `main.ts` — the entry program: copies `game/` + `screenshots/` to the output and writes `dossier.json` via `vendor/makefun-game.ts` (the kit's library, unchanged).
- `game/index.html` — the page, HUD and screens; one import map pins `three` to the vendored 0.187.0 build in `game/vendor/three/`.
- `game/src/` — one module per job: `world` (drone, boid swarm, hunters, blooms, waves, score), `render` (three.js scene, mote river with trail ghosts, particles), `hud` (DOM readouts, feed, screens), `audio` (synthesized SFX and music), `textures` (procedural canvas art), `input`, `random` (seeded RNG), `config` (all tuning), `shots` (the staged screenshot scenes), `main` (fixed-step loop and state machine).
- `screenshots/` — four renders of the game itself, staged with `?shot=cover|start|upgrade|over`.

The simulation runs at a fixed 60 Hz, decoupled from rendering; the swarm's boids, the burn/feed arithmetic and the wave flow are plain state, stepped identically live and in the staged scenes.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=c23ct4sn&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
