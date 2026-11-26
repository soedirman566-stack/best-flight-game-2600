// main.js — Kestrel Ridge, assembled. Boots the canvas, owns the game clock
// and the state machine (title, flying, paused, debrief), feeds the input to
// the flight model, lets the missions judge what the flying means, and hands
// each finished frame to the renderer, the cockpit and the screens.

import { createInput } from './input.js';
import { createFlight, resetFlight, updateFlight, altitudeAgl } from './flight.js';
import { buildCourse, valleyCenterX, terrainHeight, WORLD_END_Z } from './world.js';
import { createView, renderScene } from './render.js';
import { drawHud, drawDash } from './cockpit.js';
import { drawTitle, drawPaused, drawDebrief } from './screens.js';
import {
  createSortie, updateRings, updateCrates, dropCrate, evaluateTouchdown, PHASE,
} from './missions.js';
import { createAudio } from './audio.js';
import { readShotRequest, buildShotScene } from './shots.js';

const GAME_SEED = 7;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = createView(canvas.width, canvas.height);
const input = createInput(canvas);
const audio = createAudio();

let course = buildCourse(GAME_SEED);
let flight = createFlight();
let sortie = createSortie(course);
let mode = 'menu';
let outcome = null;
let muteWasDown = false;

const START = () => {
  const z = 140;
  return {
    x: valleyCenterX(z), y: terrainHeight(valleyCenterX(z), z) + 150, z,
    heading: Math.atan((valleyCenterX(z + 120) - valleyCenterX(z - 120)) / 240),
    speed: 46, throttle: 0.62, gearDown: true, gearTravel: 1,
  };
};
resetFlight(flight, START());

// Screenshot scenes pose the game and hold it still.
const shotRequest = readShotRequest();
let frozen = false;
if (shotRequest) {
  course = buildCourse(shotRequest.seed);
  sortie = createSortie(course);
  const scene = buildShotScene(shotRequest.name, course);
  resetFlight(flight, scene.flightProps);
  scene.apply(sortie, flight);
  mode = scene.mode;
  frozen = scene.frozen;
  if (mode === 'done') outcome = { crashed: false };
  sortie.startedAt = performance.now() - 252000;
}

function fitCanvas() {
  const pad = 0;
  const aw = window.innerWidth - pad;
  const ah = window.innerHeight - pad;
  const scale = Math.min(aw / canvas.width, ah / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function startSortie(now) {
  course = buildCourse(GAME_SEED);
  sortie = createSortie(course);
  sortie.startedAt = now;
  resetFlight(flight, START());
  outcome = null;
  mode = 'flying';
  audio.unlock();
}

function endSortie(crashed, why) {
  mode = 'done';
  sortie.phase = PHASE.DONE;
  sortie.finishedAt = performance.now();
  outcome = { crashed, why };
  if (crashed) audio.crash();
}

// The title scene flies itself: a gentle autopilot that follows the valley
// bend and holds its height over the meadows.
function autopilot(dt) {
  const ahead = flight.z + 260;
  const targetHeading = Math.atan((valleyCenterX(ahead + 120) - valleyCenterX(ahead - 120)) / 240);
  let dh = targetHeading - flight.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const targetY = terrainHeight(flight.x, flight.z + 200) + 150;
  const fakeInput = {
    roll: clamp(dh * 1.6, -0.55, 0.55),
    pitch: clamp((flight.y - targetY) * 0.004, -0.3, 0.3),
  };
  updateFlight(flight, fakeInput, 0, dt, { x: 0, z: 0 });
  flight.throttle = 0.6;
  flight.fuel = 100;
  if (flight.z > WORLD_END_Z - 600) resetFlight(flight, START());
}

function step(dt, now) {
  const flags = input.takeFlags();
  const keys = input.state.keys;
  if (keys.has('KeyM') && !muteWasDown) audio.toggleMute();
  muteWasDown = keys.has('KeyM');

  if (mode === 'menu') {
    autopilot(dt);
    if (flags.confirm) startSortie(now);
    return;
  }
  if (mode === 'done') {
    if (outcome && !outcome.crashed) {
      updateFlight(flight, { pitch: 0, roll: 0 }, 0, dt, sortie.wind);
    }
    if (flight.speed > 0.4 && outcome && !outcome.crashed) {
      flight.speed = Math.max(0, flight.speed - dt * 6);
    }
    if (flags.confirm) {
      mode = 'menu';
      resetFlight(flight, START());
    }
    return;
  }
  if (flags.pause) {
    mode = mode === 'paused' ? 'flying' : 'paused';
    return;
  }
  if (mode === 'paused') return;

  // Flying.
  audio.unlock();
  const throttleDelta = input.poll(now);
  const prev = { x: flight.x, y: flight.y, z: flight.z };
  const sub = 2;
  for (let i = 0; i < sub; i++) {
    updateFlight(flight, { pitch: input.state.pitchAxis, roll: input.state.rollAxis }, throttleDelta / sub, dt / sub, sortie.wind);
  }
  const events = [];
  if (flags.gear) {
    flight.gearDown = !flight.gearDown;
    audio.gear();
  }
  if (flags.drop && dropCrate(sortie, flight, events)) {
    // the drop event is already queued by dropCrate
  }
  updateRings(sortie, flight, prev, events);
  updateCrates(sortie, dt, events);
  for (const ev of events) {
    if (ev === 'ring') audio.ring();
    else if (ev === 'clip' || ev === 'miss') audio.clip();
    else if (ev === 'drop') audio.drop();
    else if (ev === 'goodDrop') audio.goodDrop();
    else if (ev === 'poorDrop') audio.poorDrop();
  }
  if (flight.stalled) audio.stallWarn(now);
  if (flight.damage >= 100) {
    endSortie(true, 'The airframe came apart under the damage.');
    return;
  }
  // Ground contact: a landing on the strip in the final leg, or the valley.
  const agl = altitudeAgl(flight);
  if (agl <= 2.05 && flight.verticalSpeed <= 0.5) {
    if (sortie.phase === PHASE.FINAL) {
      const verdict = evaluateTouchdown(sortie, flight);
      if (verdict.ok) {
        sortie.landing = verdict;
        sortie.score += verdict.points;
        flight.onGround = true;
        audio.touchdown();
        endSortie(false, '');
      } else {
        endSortie(true, verdict.why);
      }
    } else {
      endSortie(true, 'The valley floor rose to meet you.');
    }
  }
  audio.update(flight, mode === 'flying');
}

let last = performance.now();
let frames = 0;
function frame(now) {
  const t = now / 1000;
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!frozen) step(dt, now);
  if (mode !== 'flying') audio.update(flight, false);
  renderScene(ctx, view, flight, course, sortie, frozen ? 6.4 : t);
  if (mode === 'menu') {
    drawTitle(ctx, view, frozen ? 2.0 : t);
  } else {
    drawHud(ctx, view, flight, sortie, frozen ? 6.4 : t, now);
    drawDash(ctx, view, flight, sortie, frozen ? 6.4 : t);
    if (mode === 'paused') drawPaused(ctx, view);
    if (mode === 'done' && outcome) drawDebrief(ctx, view, sortie, flight, outcome);
  }
  frames += 1;
  if (shotRequest && frames === 3) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
