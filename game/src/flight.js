// flight.js — the Kestrel's flight model. Arcade in spirit but honest in its
// trade-offs: bank turns the aeroplane and costs speed, the nose trades speed
// for height, slow flight stalls and drops the nose, the throttle drinks fuel
// faster than level flight sips it, and the gear only travels when told to.

import { terrainHeight } from './world.js';

export const MIN_SPEED = 21;      // m/s, below this the wing gives up
export const MAX_SPEED = 96;      // m/s, airframe redline

export function createFlight() {
  return {
    x: 0, y: 0, z: 0,             // position, metres (y is altitude ASL)
    heading: 0,                   // radians, 0 = north (+z), + turns east
    bank: 0,                      // radians, + right wing down
    pathPitch: 0,                 // flight-path angle, radians, + climbing
    speed: 44,                    // m/s
    throttle: 0.62,               // 0..1
    fuel: 100,                    // percent
    damage: 0,                    // 0 sound .. 100 wrecked
    gearDown: true,
    gearTravel: 1,                // 0 up .. 1 down, animates between
    stalled: false,
    engineOut: false,
    onGround: false,
    verticalSpeed: 0,             // m/s, for touchdown judgement
    shake: 0,                     // buffet / impact shake, decays
    propPhase: 0,
  };
}

export function resetFlight(f, start) {
  Object.assign(f, createFlight(), start);
}

// Advance the model by dt seconds. input: {pitch, roll} in -1..1 and a
// throttle delta already integrated by the caller.
export function updateFlight(f, input, throttleDelta, dt, wind) {
  f.throttle = clamp(f.throttle + throttleDelta, 0, 1);
  if (f.fuel <= 0) {
    f.engineOut = true;
    f.throttle = 0;
  }

  // Controls answer less as the air thins over the wing.
  const authority = clamp((f.speed - 12) / 26, 0.25, 1);
  const targetBank = input.roll * 1.05 * authority + input.roll * 0.25;
  f.bank += (targetBank - f.bank) * Math.min(1, dt * 3.4);

  // Pitch: the stick asks for a flight-path angle; the wing answers slowly.
  const targetPitch = -input.pitch * 0.42 * authority + (f.stalled ? -0.24 : 0);
  f.pathPitch += (targetPitch - f.pathPitch) * Math.min(1, dt * (f.stalled ? 3.2 : 1.9));
  f.pathPitch = clamp(f.pathPitch, -0.62, 0.5);

  // Turning: banked lift leans the velocity around; tight turns bleed speed.
  const turnRate = (9.81 * Math.tan(clamp(f.bank, -1.2, 1.2))) / Math.max(f.speed, 18);
  f.heading += turnRate * dt;

  // Speed: thrust against drag, gravity along the path, turn and gear drag.
  const thrust = f.engineOut ? 0 : f.throttle * 9.4;
  const drag = 0.0038 * f.speed * f.speed + Math.abs(f.bank) * 2.1 + (1 - f.gearTravel) * -0.4 + f.gearTravel * 0.55;
  const gravity = -9.81 * Math.sin(f.pathPitch);
  f.speed += (thrust - drag * 0.62 + gravity) * dt;
  f.speed = clamp(f.speed, 8, MAX_SPEED + 14);

  // Stall: below flying speed the nose falls and the airframe shudders.
  f.stalled = f.speed < MIN_SPEED + 3 && !f.onGround;
  if (f.stalled) f.shake = Math.max(f.shake, 0.35);

  // Fuel: the throttle drinks; a sortie is planned around this burn.
  if (!f.engineOut) {
    f.fuel = Math.max(0, f.fuel - dt * (0.055 + Math.pow(f.throttle, 1.6) * 0.30));
  }

  // Gear travel takes a few seconds and clunks at the ends (audio in main).
  const gearTarget = f.gearDown ? 1 : 0;
  if (f.gearTravel !== gearTarget) {
    const step = dt / 2.6;
    f.gearTravel = clamp(f.gearTravel + (gearTarget > f.gearTravel ? step : -step), 0, 1);
  }

  // Integrate the position along heading and flight path, plus wind drift.
  const vh = Math.cos(f.pathPitch) * f.speed;
  f.verticalSpeed = Math.sin(f.pathPitch) * f.speed;
  f.x += Math.sin(f.heading) * vh * dt + wind.x * dt;
  f.z += Math.cos(f.heading) * vh * dt + wind.z * dt;
  f.y += f.verticalSpeed * dt;
  f.propPhase += dt * (4 + f.throttle * 46 + f.speed * 0.12);
  f.shake = Math.max(0, f.shake - dt * 1.6);
  return f;
}

// Metres above the ground directly below — the number a pilot actually fears.
export function altitudeAgl(f) {
  return f.y - terrainHeight(f.x, f.z);
}

// Display conversions, kept here so the cockpit never converts twice.
export function toFeet(m) { return m * 3.28084; }
export function toKnots(ms) { return ms * 1.94384; }
export function headingDeg(f) {
  const d = (f.heading * 180 / Math.PI) % 360;
  return d < 0 ? d + 360 : d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
