// missions.js — one sortie, three different jobs. Thread the gold rings down
// the valley, drop three supply crates onto painted targets with the wind
// pushing them sideways, then put the Kestrel on Kestrel Field's runway
// inside a speed and sink window. Each leg scores on its own terms, and the
// sortie grade at the end is the sum of the pilot's decisions.

import { RUNWAY, terrainHeight, valleyCenterX } from './world.js';
import { toKnots } from './flight.js';

export const PHASE = { RINGS: 0, DROPS: 1, FINAL: 2, DONE: 3 };

export function createSortie(course) {
  return {
    phase: PHASE.RINGS,
    course,
    score: 0,
    ringIndex: 0,
    ringsFlown: 0,
    targetIndex: 0,
    crates: [],          // crates in the air: {x,y,z,vx,vy,vz,settled}
    cratesLeft: 3,
    dropResults: [],
    wind: { x: 2.5, z: 0.5 },
    message: '',
    messageUntil: 0,
    landing: null,       // filled by evaluateTouchdown
    startedAt: 0,
    finishedAt: 0,
  };
}

export function phaseTitle(s) {
  if (s.phase === PHASE.RINGS) return 'LEG 1 — VALLEY RINGS';
  if (s.phase === PHASE.DROPS) return 'LEG 2 — SUPPLY DROP';
  if (s.phase === PHASE.FINAL) return 'LEG 3 — LAND AT KESTREL FIELD';
  return 'SORTIE COMPLETE';
}

export function phaseBrief(s) {
  if (s.phase === PHASE.RINGS) {
    const r = s.course.rings[s.ringIndex];
    return r ? `Ring ${s.ringIndex + 1} of ${s.course.rings.length} — thread the gold ring` : '';
  }
  if (s.phase === PHASE.DROPS) {
    return `Crates aboard: ${s.cratesLeft} — SPACE drops one; mind the crosswind`;
  }
  if (s.phase === PHASE.FINAL) {
    return 'Gear down (G), 55–75 kt over the fence, sink under 3 m/s';
  }
  return '';
}

// Watch the rings: crossing a ring's plane inside its circle threads it;
// grazing the rim clips it — points, but the airframe remembers.
export function updateRings(s, f, prev, events) {
  if (s.phase !== PHASE.RINGS) return;
  const ring = s.course.rings[s.ringIndex];
  if (!ring) return;
  if (prev.z < ring.z && f.z >= ring.z) {
    const dx = f.x - ring.x;
    const dy = f.y - ring.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ring.r - 4) {
      ring.state = 'flown';
      s.ringsFlown += 1;
      s.score += 150;
      events.push('ring');
      say(s, 'Ring threaded  +150');
    } else if (dist < ring.r + 7) {
      ring.state = 'clipped';
      s.ringsFlown += 1;
      s.score += 60;
      f.damage = Math.min(100, f.damage + 9);
      f.shake = 0.8;
      events.push('clip');
      say(s, 'Rim clipped  +60 — airframe damaged');
    } else {
      ring.state = 'missed';
      events.push('miss');
      say(s, 'Ring missed');
    }
    s.ringIndex += 1;
    if (s.ringIndex >= s.course.rings.length) {
      s.phase = PHASE.DROPS;
      s.wind = { x: 5.5, z: -1.0 };
      say(s, 'Rings done — on to the supply drop. Wind is up.');
    }
  }
}

// Release a crate from the bomb bay (a hatch, honestly). It keeps the
// aeroplane's velocity, then gravity and the wind argue over where it lands.
export function dropCrate(s, f, events) {
  if (s.phase !== PHASE.DROPS || s.cratesLeft <= 0) return false;
  s.cratesLeft -= 1;
  s.crates.push({
    x: f.x, y: f.y - 3, z: f.z,
    vx: Math.sin(f.heading) * f.speed * 0.92,
    vy: f.verticalSpeed,
    vz: Math.cos(f.heading) * f.speed * 0.92,
    settled: false,
  });
  events.push('drop');
  return true;
}

export function updateCrates(s, dt, events) {
  const target = s.course.targets[s.targetIndex];
  for (const c of s.crates) {
    if (c.settled) continue;
    c.vy -= 9.81 * dt * 0.62;                    // the parachute checks the fall
    c.vx += (s.wind.x - c.vx) * dt * 0.55;       // and the wind takes its share
    c.vz += (s.wind.z - c.vz) * dt * 0.55;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.z += c.vz * dt;
    const ground = terrainHeight(c.x, c.z);
    if (c.y <= ground + 1) {
      c.y = ground + 1;
      c.settled = true;
      if (target && target.state === 'next') {
        const dist = Math.hypot(c.x - target.x, c.z - target.z);
        c.result = dist;
        if (dist < 13) { target.state = 'bullseye'; s.score += 220; events.push('goodDrop'); say(s, `Bullseye! ${dist.toFixed(0)} m  +220`); }
        else if (dist < 34) { target.state = 'near'; s.score += 120; events.push('goodDrop'); say(s, `Close — ${dist.toFixed(0)} m  +120`); }
        else if (dist < 70) { target.state = 'far'; s.score += 45; events.push('poorDrop'); say(s, `${dist.toFixed(0)} m away  +45`); }
        else { target.state = 'lost'; events.push('poorDrop'); say(s, `Crate lost in the valley — ${dist.toFixed(0)} m off`); }
        s.dropResults.push(dist);
        s.targetIndex += 1;
        if (s.targetIndex >= s.course.targets.length) {
          s.phase = PHASE.FINAL;
          s.wind = { x: 1.5, z: 0 };
          say(s, 'Drops done — Kestrel Field ahead. Gear down, mind the sink.');
        }
      }
    }
  }
  s.crates = s.crates.filter((c) => !c.settled || performance.now() < (c.settledAt || (c.settledAt = performance.now())) + 4000);
}

// The landing is judged the moment the wheels meet the ground: where, how
// fast, how hard, and whether the gear was down to meet it.
export function evaluateTouchdown(s, f) {
  const cx = valleyCenterX(f.z);
  const onStrip = f.z > RUNWAY.z0 && f.z < RUNWAY.z1 && Math.abs(f.x - cx) < RUNWAY.halfWidth + 6;
  const kt = toKnots(f.speed);
  const sink = -f.verticalSpeed;
  if (!onStrip) return { ok: false, why: 'You came down off the runway.' };
  if (f.gearTravel < 0.9) return { ok: false, why: 'Gear up — the belly took the landing.' };
  if (sink > 6.5) return { ok: false, why: `Sink of ${sink.toFixed(1)} m/s broke the gear.` };
  if (kt > 96) return { ok: false, why: `Touchdown at ${kt.toFixed(0)} kt — far too fast.` };
  let points = 300;
  const notes = [];
  const centre = Math.abs(f.x - cx);
  if (centre < 6) { points += 120; notes.push('on the centreline'); }
  else if (centre < 14) { points += 50; notes.push('near the centreline'); }
  else notes.push('well off centre');
  if (sink < 1.4) { points += 130; notes.push('a greaser'); }
  else if (sink < 3) { points += 70; notes.push('firm but tidy'); }
  else notes.push('a heavy arrival');
  if (kt >= 55 && kt <= 75) { points += 80; notes.push('speed in the window'); }
  else notes.push(`speed ${kt.toFixed(0)} kt, outside 55–75`);
  const zone = f.z - RUNWAY.z0;
  if (zone > 120 && zone < 520) { points += 70; notes.push('in the touchdown zone'); }
  return { ok: true, points, notes, kt, sink, centre };
}

export function gradeFor(score) {
  if (score >= 1650) return 'S';
  if (score >= 1350) return 'A';
  if (score >= 1000) return 'B';
  if (score >= 650) return 'C';
  return 'D';
}

function say(s, text) {
  s.message = text;
  s.messageUntil = performance.now() + 3400;
}
