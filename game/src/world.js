// world.js — the Kestrel Ridge valley: one deterministic heightfield, a river,
// patchwork fields, pine slopes, and the course that missions fly — six gold
// rings, three supply targets and Kestrel Field's runway at the valley's end.
// Everything is placed from a seed, so a sortie is the same valley every time
// and the screenshot scenes can pose inside it.

export const RUNWAY = { z0: 8800, z1: 9680, elevation: 642, halfWidth: 23 };
export const WORLD_END_Z = 10200;

// A small, fast seeded random: mulberry32.
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The valley bends gently so the pilot must actually steer a heading.
export function valleyCenterX(z) {
  return 210 * Math.sin(z * 0.00042) + 90 * Math.sin(z * 0.0011 + 1.3);
}

// The river hugs the valley floor, wandering a little more than the centre.
export function riverCenterX(z) {
  return valleyCenterX(z) + 46 * Math.sin(z * 0.0016 + 0.6);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Height of the ground in metres above sea level at (x, z).
export function terrainHeight(x, z) {
  const cx = valleyCenterX(z);
  const d = Math.abs(x - cx);
  // Valley floor: soft meadows rolling along z.
  let h = 618 + 34 * Math.sin(z * 0.0011) + 15 * Math.sin(z * 0.0037 + 1.7) + 7 * Math.sin(x * 0.004 + z * 0.002);
  // Ridges climb on both sides, higher and rougher with distance.
  const ridge = Math.pow(smoothstep(240, 1500, d), 1.55) * 820 * (0.78 + 0.22 * Math.sin(z * 0.0006 + 2.0));
  const crag = (Math.sin(x * 0.011 + z * 0.004) * Math.cos(z * 0.006 - x * 0.002)) * 30 * smoothstep(180, 700, d);
  h += ridge + crag;
  // Kestrel Field: a flat shelf blasted into the valley end for the runway.
  if (z > RUNWAY.z0 - 320 && z < RUNWAY.z1 + 320) {
    const along = smoothstep(RUNWAY.z0 - 320, RUNWAY.z0 + 60, z) * (1 - smoothstep(RUNWAY.z1 - 60, RUNWAY.z1 + 320, z));
    const across = 1 - smoothstep(RUNWAY.halfWidth + 26, RUNWAY.halfWidth + 130, d);
    const flat = Math.min(along, across * 1.4);
    h = h * (1 - flat) + RUNWAY.elevation * flat;
  }
  return h;
}

// Ground colour family for a point, by height and slope: the renderer shades
// it, the world only names it — meadow, field, pine, rock, snow, river sand.
export function groundKind(x, z, h) {
  const cx = valleyCenterX(z);
  const d = Math.abs(x - cx);
  if (Math.abs(x - riverCenterX(z)) < 15 && d < 200) return 'river';
  if (z > RUNWAY.z0 - 6 && z < RUNWAY.z1 + 6 && d < RUNWAY.halfWidth + 4) return 'runway';
  if (h > 1240) return 'snow';
  if (h > 980) return 'rock';
  if (d > 300) return 'pine';
  // Patchwork fields on the floor: a calm checker of big rectangles.
  const cell = (Math.floor((x - cx + 4000) / 170) + Math.floor(z / 210)) % 3;
  return cell === 0 ? 'fieldA' : cell === 1 ? 'fieldB' : 'meadow';
}

// Build the course for one sortie: rings down the valley, then the drop
// targets on the floor, then the runway. Deterministic for a given seed.
export function buildCourse(seed) {
  const rng = createRng(seed);
  const rings = [];
  const ringZ = [900, 1750, 2600, 3500, 4450, 5400];
  for (let i = 0; i < ringZ.length; i++) {
    const z = ringZ[i];
    const cx = valleyCenterX(z);
    const x = cx + (rng() * 2 - 1) * 120;
    const floor = terrainHeight(cx, z);
    const y = floor + 95 + rng() * 70;
    rings.push({ index: i, x, y, z, r: 27, state: 'next' });
  }
  const targets = [];
  const targetZ = [6100, 6850, 7650];
  for (let i = 0; i < targetZ.length; i++) {
    const z = targetZ[i];
    const cx = valleyCenterX(z);
    const x = cx + (rng() * 2 - 1) * 95;
    targets.push({ index: i, x, z, y: terrainHeight(x, z), state: 'next', result: null });
  }
  const trees = [];
  for (let i = 0; i < 900; i++) {
    const z = rng() * WORLD_END_Z;
    const cx = valleyCenterX(z);
    const side = rng() < 0.5 ? -1 : 1;
    const d = 120 + rng() * 900;
    const x = cx + side * d;
    const h = terrainHeight(x, z);
    if (h > 1150) continue;
    trees.push({ x, z, y: h, s: 7 + rng() * 9, tone: rng() });
  }
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: (rng() * 2 - 1) * 2600,
      y: 980 + rng() * 420,
      z: rng() * (WORLD_END_Z + 1500) - 500,
      s: 60 + rng() * 130,
      tone: rng(),
    });
  }
  const huts = [];
  for (let i = 0; i < 14; i++) {
    const z = 500 + rng() * 7800;
    const cx = valleyCenterX(z);
    const x = cx + (rng() * 2 - 1) * 150;
    huts.push({ x, z, y: terrainHeight(x, z), rot: rng() * Math.PI });
  }
  return { rings, targets, trees, clouds, huts };
}
