[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/soedirman566-stack/best-flight-game-2600/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/soedirman566-stack/best-flight-game-2600/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Kestrel Ridge — a valley flight game

An entry for make.fun's **Make the best flight game**: a complete flight
game that plays offline in a desktop browser from its own files. No
libraries, no assets, nothing fetched — every pixel and every sound is made
by the game's own code.

You fly the Kestrel, a cream-and-red bush plane, down a dawn valley in one
sortie of three different jobs:

1. **Valley Rings** — thread six gold rings strung along the bends.
2. **Supply Drop** — drop three crates by parachute onto painted targets
   while a crosswind pushes them sideways.
3. **Land at Kestrel Field** — gear down, 55–75 kt over the fence, sink
   under 3 m/s, and be judged on centreline, zone and softness.

The flying is honest about its trade-offs: bank turns the aeroplane and
costs speed, slow flight stalls and drops the nose, the throttle drinks
fuel faster than level flight sips it, and a clipped ring or a hard arrival
damages the airframe. The panel is fully alive — artificial horizon,
airspeed and altimeter dials, vertical speed, compass tape, throttle, fuel,
gear lamps and warning lights — and the HUD keeps altitude, speed and
heading in big lit figures.

## Controls

- **Arrows / WASD or mouse** — pitch and bank
- **Shift / Ctrl or mouse wheel** — throttle
- **Space or click** — drop a crate
- **G** — landing gear · **P** — pause · **M** — sound

## How it runs

Open `game/index.html` in a desktop browser (or serve the folder with any
static server) and press Enter. `main.ts` is the hand-in program: run with
Node 22 it copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

## Files

- `main.ts` — the entrypoint that hands the game in.
- `game/index.html` — the page; everything it loads lives under `game/`.
- `game/src/main.js` — boot, game clock and the state machine.
- `game/src/flight.js` — the flight model: lift, stall, fuel, gear.
- `game/src/world.js` — the valley: terrain, river, rings, targets, runway.
- `game/src/render.js` — chase camera, terrain and course rendering.
- `game/src/aircraft.js` — the Kestrel, drawn in code.
- `game/src/cockpit.js` — the instrument panel and HUD.
- `game/src/missions.js` — the three legs and how each is judged.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — engine, wind and bleeps, all synthesised.
- `game/src/screens.js` — title, pause and debrief cards.
- `game/src/shots.js` — deterministic scene posing for the screenshots.
- `screenshots/` — four real renders of the game, cover first.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `LICENSE` — MIT.
