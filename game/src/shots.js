// shots.js — poses the game for its screenshots. The page accepts
// ?shot=start|play|drop|end&seed=N, builds the valley from that seed, places
// the Kestrel mid-story, and holds the scene still so a screenshot is a real
// render of the game's own code in a known moment — the same valley, the
// same light, every time.

import { valleyCenterX, terrainHeight, RUNWAY } from './world.js';
import { PHASE } from './missions.js';

export function readShotRequest() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { name: shot, seed: Number(q.get('seed') || 7) };
}

function valleyHeading(z) {
  const slope = (valleyCenterX(z + 120) - valleyCenterX(z - 120)) / 240;
  return Math.atan(slope);
}

// Returns { mode, flightProps, apply } — apply() adjusts the fresh sortie
// and course so the scene tells its part of the story.
export function buildShotScene(name, course) {
  if (name === 'play') {
    const ring = course.rings[2];
    return {
      mode: 'flying',
      frozen: true,
      flightProps: {
        x: ring.x - 14, y: ring.y + 7, z: ring.z - 265,
        heading: valleyHeading(ring.z), bank: -0.13, pathPitch: 0.02,
        speed: 51, throttle: 0.66, fuel: 84, gearDown: false, gearTravel: 0,
      },
      apply(sortie) {
        sortie.phase = PHASE.RINGS;
        sortie.ringIndex = 2;
        sortie.score = 300;
        course.rings[0].state = 'flown';
        course.rings[1].state = 'flown';
      },
    };
  }
  if (name === 'drop') {
    const target = course.targets[1];
    return {
      mode: 'flying',
      frozen: true,
      flightProps: {
        x: target.x + 26, y: target.y + 120, z: target.z - 300,
        heading: valleyHeading(target.z), bank: 0.07, pathPitch: -0.26,
        speed: 47, throttle: 0.55, fuel: 57, gearDown: false, gearTravel: 0,
      },
      apply(sortie, flight) {
        sortie.phase = PHASE.DROPS;
        sortie.targetIndex = 1;
        sortie.cratesLeft = 2;
        sortie.score = 960;
        sortie.wind = { x: 5.5, z: -1.0 };
        course.rings.forEach((r) => { r.state = 'flown'; });
        course.targets[0].state = 'near';
        sortie.crates.push({
          x: target.x + 18, y: target.y + 62, z: target.z - 150,
          vx: 4, vy: -7, vz: 30, settled: false,
        });
        void flight;
      },
    };
  }
  if (name === 'end') {
    const z = RUNWAY.z0 + 330;
    return {
      mode: 'done',
      frozen: true,
      flightProps: {
        x: valleyCenterX(z) + 3, y: RUNWAY.elevation + 2.1, z,
        heading: valleyHeading(z), bank: 0, pathPitch: 0,
        speed: 9, throttle: 0, fuel: 34, damage: 9,
        gearDown: true, gearTravel: 1, onGround: true,
      },
      apply(sortie) {
        sortie.phase = PHASE.DONE;
        sortie.score = 2110;
        sortie.ringsFlown = 6;
        sortie.dropResults = [9, 22, 31];
        sortie.landing = {
          ok: true, points: 630, kt: 63, sink: 1.1, centre: 3,
          notes: ['on the centreline', 'a greaser', 'speed in the window', 'in the touchdown zone'],
        };
        course.rings.forEach((r) => { r.state = 'flown'; });
      },
    };
  }
  // 'start' and anything else: the title scene — a gentle bank over the
  // valley mouth with the whole course ahead.
  const z = 1350;
  return {
    mode: 'menu',
    frozen: true,
    flightProps: {
      x: valleyCenterX(z) + 30, y: terrainHeight(valleyCenterX(z), z) + 165, z,
      heading: valleyHeading(z), bank: -0.17, pathPitch: 0.01,
      speed: 46, throttle: 0.6, fuel: 100, gearDown: true, gearTravel: 1,
    },
    apply() {},
  };
}
