// render.js — everything the eye sees. A chase camera behind the Kestrel, a
// dawn sky, and the valley drawn as a grid of ground quads shaded by height
// and kind, with the course furniture — rings, targets, runway, pines, huts,
// clouds — projected through the same honest perspective. No images: every
// pixel is placed by this file and aircraft.js.

import { terrainHeight, groundKind, valleyCenterX, riverCenterX, RUNWAY } from './world.js';
import { drawAircraft } from './aircraft.js';

const FOV_TAN = 0.649; // ~66 degree vertical field of view

const KIND_COLORS = {
  meadow: [106, 148, 74],
  fieldA: [168, 152, 84],
  fieldB: [128, 158, 82],
  pine: [52, 96, 58],
  rock: [122, 110, 100],
  snow: [232, 238, 244],
  river: [74, 118, 158],
  runway: [52, 54, 60],
};
const SKY_TOP = [38, 64, 110];
const SKY_HORIZON = [238, 178, 120];
const FOG = [226, 178, 138];

export function createView(W, H) {
  return { W, H, focal: (H / 2) / FOV_TAN, cam: null };
}

// Build the chase camera from the flight state: behind and above the plane,
// looking along its heading, rolling part-way with its bank so the world
// leans but never spins.
function buildCamera(f) {
  const fh = { x: Math.sin(f.heading), z: Math.cos(f.heading) };
  const pos = {
    x: f.x - fh.x * 30,
    y: f.y + 10.5,
    z: f.z - fh.z * 30,
  };
  const lookPitch = -0.03 + f.pathPitch * 0.85;
  const fwd = norm({
    x: fh.x * Math.cos(lookPitch),
    y: Math.sin(lookPitch),
    z: fh.z * Math.cos(lookPitch),
  });
  let right = norm(cross(fwd, { x: 0, y: 1, z: 0 }));
  let up = cross(right, fwd);
  const roll = -f.bank * 0.52;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const right2 = add(scale(right, cr), scale(up, sr));
  const up2 = add(scale(up, cr), scale(right, -sr));
  right = right2;
  up = up2;
  return { pos, fwd, right, up };
}

function project(view, cam, p) {
  const vx = p.x - cam.pos.x;
  const vy = p.y - cam.pos.y;
  const vz = p.z - cam.pos.z;
  const cx = vx * cam.right.x + vy * cam.right.y + vz * cam.right.z;
  const cy = vx * cam.up.x + vy * cam.up.y + vz * cam.up.z;
  const cz = vx * cam.fwd.x + vy * cam.fwd.y + vz * cam.fwd.z;
  if (cz < 2.5) return null;
  const s = view.focal / cz;
  return { x: view.W / 2 + cx * s, y: view.H * 0.52 - cy * s, d: cz, s };
}

export function renderScene(ctx, view, f, course, sortie, t) {
  const cam = buildCamera(f);
  view.cam = cam;
  drawSky(ctx, view, cam, f, t);
  drawTerrain(ctx, view, cam);
  drawRunway(ctx, view, cam);
  drawTargets(ctx, view, cam, course, sortie, t);
  drawPlaneShadow(ctx, view, cam, f);
  drawObjects(ctx, view, cam, course, f, t);
  drawRings(ctx, view, cam, course, sortie, t);
  drawCrates(ctx, view, cam, sortie);
  drawBirds(ctx, view, cam, t);
  drawAircraftSprite(ctx, view, cam, f, t);
}

function drawSky(ctx, view, cam, f, t) {
  const { W, H } = view;
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  g.addColorStop(0, rgb(SKY_TOP));
  g.addColorStop(0.55, '#7d9cc0');
  g.addColorStop(0.82, rgb(SKY_HORIZON));
  g.addColorStop(1, '#f6cf9d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // The sun, low over the valley mouth, placed by projecting its direction.
  const sunDir = norm({ x: -0.34, y: 0.16, z: 1 });
  const sunPos = { x: cam.pos.x + sunDir.x * 4000, y: cam.pos.y + sunDir.y * 4000, z: cam.pos.z + sunDir.z * 4000 };
  const sp = project(view, cam, sunPos);
  if (sp) {
    const glow = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 190);
    glow.addColorStop(0, 'rgba(255,236,190,0.95)');
    glow.addColorStop(0.18, 'rgba(255,205,130,0.55)');
    glow.addColorStop(1, 'rgba(255,205,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sp.x - 200, sp.y - 200, 400, 400);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 17, 0, Math.PI * 2);
    ctx.fill();
  }
  // Far ridge silhouettes, two layers leaning with the heading for parallax.
  for (const layer of [0, 1]) {
    const base = view.H * (0.47 + layer * 0.035);
    const amp = 26 - layer * 9;
    const shift = f.heading * (900 + layer * 500) + layer * 300;
    ctx.fillStyle = layer === 0 ? 'rgba(70,86,120,0.55)' : 'rgba(52,66,96,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, base + amp);
    for (let x = 0; x <= view.W; x += 32) {
      const n = Math.sin((x + shift) * 0.004) * 0.6 + Math.sin((x + shift) * 0.0113) * 0.4;
      ctx.lineTo(x, base - Math.abs(n) * amp - layer * 4);
    }
    ctx.lineTo(view.W, view.H);
    ctx.lineTo(0, view.H);
    ctx.closePath();
    ctx.fill();
  }
}

// The ground: a grid in camera space — rows running ahead, columns across —
// each quad coloured by the world's kind, shaded by its slope, and fogged
// toward the horizon so the valley has depth.
function drawTerrain(ctx, view, cam) {
  const rows = [];
  const rowCount = 30;
  for (let i = 0; i <= rowCount; i++) {
    const d = 6 * Math.pow(1.235, i);
    rows.push(d);
  }
  const colCount = 26;
  const cols = [];
  for (let i = 0; i <= colCount; i++) {
    const u = i / colCount * 2 - 1;
    cols.push(Math.tan(u * 1.15) * 900);
  }
  const pts = [];
  for (let r = 0; r <= rowCount; r++) {
    pts.push([]);
    for (let c = 0; c <= colCount; c++) {
      const wx = cam.pos.x + cam.right.x * cols[c] + cam.fwd.x * rows[r];
      const wz = cam.pos.z + cam.right.z * cols[c] + cam.fwd.z * rows[r];
      const wy = terrainHeight(wx, wz);
      pts[r].push({ w: { x: wx, y: wy, z: wz }, p: project(view, cam, { x: wx, y: wy, z: wz }), h: wy });
    }
  }
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const a = pts[r][c];
      const b = pts[r][c + 1];
      const d2 = pts[r + 1][c + 1];
      const e = pts[r + 1][c];
      if (!a.p || !b.p || !d2.p || !e.p) continue;
      const mid = {
        x: (a.w.x + d2.w.x) / 2,
        y: (a.w.y + d2.w.y) / 2,
        z: (a.w.z + d2.w.z) / 2,
      };
      const kind = groundKind(mid.x, mid.z, mid.y);
      let col = KIND_COLORS[kind];
      // Slope shade: ground that climbs toward the camera reads darker.
      const slope = clamp((e.h - a.h) * 0.02 + (b.h - a.h) * 0.008, -0.22, 0.22);
      // A whisper of per-cell variation so fields do not look printed.
      const vary = hash(mid.x, mid.z) * 0.09 - 0.045;
      const dist = a.p.d;
      const fogF = clamp(Math.pow(dist / 3300, 1.6), 0, 0.92);
      const shaded = col.map((v, i) => {
        const lit = clamp(v * (1 - slope + vary), 0, 255);
        return Math.round(lit + (FOG[i] - lit) * fogF);
      });
      ctx.fillStyle = `rgb(${shaded[0]},${shaded[1]},${shaded[2]})`;
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(d2.p.x, d2.p.y);
      ctx.lineTo(e.p.x, e.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRunway(ctx, view, cam) {
  const cxm = valleyCenterX((RUNWAY.z0 + RUNWAY.z1) / 2);
  if (cam.pos.z > RUNWAY.z1 + 400) return;
  const slices = 12;
  for (let i = 0; i < slices; i++) {
    const zA = RUNWAY.z0 + (RUNWAY.z1 - RUNWAY.z0) * (i / slices);
    const zB = RUNWAY.z0 + (RUNWAY.z1 - RUNWAY.z0) * ((i + 1) / slices);
    const quad = [
      { x: valleyCenterX(zA) - RUNWAY.halfWidth, y: RUNWAY.elevation + 0.25, z: zA },
      { x: valleyCenterX(zA) + RUNWAY.halfWidth, y: RUNWAY.elevation + 0.25, z: zA },
      { x: valleyCenterX(zB) + RUNWAY.halfWidth, y: RUNWAY.elevation + 0.25, z: zB },
      { x: valleyCenterX(zB) - RUNWAY.halfWidth, y: RUNWAY.elevation + 0.25, z: zB },
    ].map((p) => project(view, cam, p));
    if (quad.some((p) => !p)) continue;
    ctx.fillStyle = i % 2 ? '#3a3d44' : '#43464e';
    poly(ctx, quad);
    ctx.fill();
  }
  // Threshold bars and centreline dashes.
  ctx.fillStyle = 'rgba(240,244,248,0.92)';
  for (let i = 0; i < 14; i++) {
    const z = RUNWAY.z0 + 130 + i * 58;
    if (z > RUNWAY.z1 - 60) break;
    const cx = valleyCenterX(z);
    const dash = [
      { x: cx - 1.1, y: RUNWAY.elevation + 0.4, z },
      { x: cx + 1.1, y: RUNWAY.elevation + 0.4, z },
      { x: cx + 1.1, y: RUNWAY.elevation + 0.4, z: z + 26 },
      { x: cx - 1.1, y: RUNWAY.elevation + 0.4, z: z + 26 },
    ].map((p) => project(view, cam, p));
    if (dash.some((p) => !p)) continue;
    poly(ctx, dash);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = RUNWAY.z0 + 12 + i * 9;
      const cx = valleyCenterX(z) + side * (5 + i * 4.4);
      const p = project(view, cam, { x: cx, y: RUNWAY.elevation + 0.4, z });
      if (!p) continue;
      const w = clamp(p.s * 1.6, 1.5, 15);
      ctx.fillRect(p.x - w / 2, p.y - w * 0.28, w, w * 0.3);
    }
  }
  // Edge lights, warm dots down both sides.
  for (const side of [-1, 1]) {
    for (let z = RUNWAY.z0 + 20; z < RUNWAY.z1; z += 78) {
      const p = project(view, cam, { x: valleyCenterX(z) + side * (RUNWAY.halfWidth + 3), y: RUNWAY.elevation + 1.1, z });
      if (!p || p.d > 2400) continue;
      ctx.fillStyle = 'rgba(255,186,92,0.95)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, clamp(p.s * 0.55, 0.8, 4.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  void cxm;
}

function drawTargets(ctx, view, cam, course, sortie, t) {
  for (const target of course.targets) {
    if (target.state === 'lost') continue;
    const active = sortie.phase === 1 && course.targets[sortie.targetIndex] === target;
    const ringsToDraw = [
      { r: 30, col: 'rgba(226,54,44,0.85)', w: 0.10 },
      { r: 21, col: 'rgba(245,245,240,0.9)', w: 0.10 },
      { r: 12.5, col: 'rgba(226,54,44,0.95)', w: 0.12 },
    ];
    for (const ringDef of ringsToDraw) {
      ctx.strokeStyle = ringDef.col;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const wx = target.x + Math.cos(a) * ringDef.r;
        const wz = target.z + Math.sin(a) * ringDef.r;
        const p = project(view, cam, { x: wx, y: terrainHeight(wx, wz) + 0.5, z: wz });
        if (!p) { started = false; continue; }
        ctx.lineWidth = clamp(p.s * ringDef.r * ringDef.w, 0.7, 7);
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // A windsock beside the active target, telling the wind's story.
    if (active) {
      const base = project(view, cam, { x: target.x + 34, y: target.y, z: target.z + 8 });
      const top = project(view, cam, { x: target.x + 34, y: target.y + 11, z: target.z + 8 });
      if (base && top) {
        ctx.strokeStyle = '#3a3f47';
        ctx.lineWidth = Math.max(1, top.s * 0.3);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        const wave = Math.sin(t * 6) * 0.14;
        ctx.fillStyle = '#e8762c';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(top.x + top.s * 9, top.y + top.s * (1.1 + wave * 3));
        ctx.lineTo(top.x, top.y + top.s * 2.4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawPlaneShadow(ctx, view, cam, f) {
  const gy = terrainHeight(f.x, f.z);
  const p = project(view, cam, { x: f.x, y: gy + 0.4, z: f.z });
  if (!p) return;
  const agl = Math.max(0, f.y - gy);
  const alpha = clamp(0.34 - agl * 0.0016, 0.03, 0.3);
  const rx = clamp(p.s * 10, 2, 90);
  ctx.fillStyle = `rgba(20,26,20,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, rx * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Trees, huts and clouds share one pass, far to near, so nearer things
// honestly cover farther ones.
function drawObjects(ctx, view, cam, course, f, t) {
  const items = [];
  for (const tree of course.trees) {
    const d = dist2(cam.pos, tree);
    if (d < 1500 * 1500) items.push({ d, kind: 'tree', o: tree });
  }
  for (const hut of course.huts) {
    const d = dist2(cam.pos, hut);
    if (d < 1600 * 1600) items.push({ d, kind: 'hut', o: hut });
  }
  for (const cloud of course.clouds) {
    const drift = { x: cloud.x + Math.sin(t * 0.01 + cloud.z) * 30, y: cloud.y, z: cloud.z };
    const d = dist2(cam.pos, drift);
    if (d < 4200 * 4200) items.push({ d, kind: 'cloud', o: drift, tone: cloud.tone, s: cloud.s });
  }
  items.sort((a, b) => b.d - a.d);
  for (const item of items) {
    if (item.kind === 'tree') drawTree(ctx, view, cam, item.o);
    else if (item.kind === 'hut') drawHut(ctx, view, cam, item.o);
    else drawCloud(ctx, view, cam, item.o, item.s, item.tone);
  }
  void f;
  void t;
}

function drawTree(ctx, view, cam, tree) {
  const base = project(view, cam, { x: tree.x, y: tree.y, z: tree.z });
  if (!base) return;
  const hPx = base.s * tree.s;
  if (hPx < 2) return;
  const wPx = hPx * 0.42;
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(base.x - hPx * 0.03, base.y - hPx * 0.25, hPx * 0.06, hPx * 0.25);
  const green = tree.tone > 0.5 ? '#2e5d38' : '#38704a';
  ctx.fillStyle = green;
  for (let i = 0; i < 3; i++) {
    const yy = base.y - hPx * (0.18 + i * 0.26);
    const ww = wPx * (1 - i * 0.24);
    ctx.beginPath();
    ctx.moveTo(base.x - ww / 2, yy);
    ctx.lineTo(base.x + ww / 2, yy);
    ctx.lineTo(base.x, yy - hPx * 0.4);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHut(ctx, view, cam, hut) {
  const base = project(view, cam, { x: hut.x, y: hut.y, z: hut.z });
  if (!base) return;
  const w = base.s * 11;
  const h = base.s * 5.4;
  if (w < 3) return;
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(base.x - w / 2, base.y - h, w, h);
  ctx.fillStyle = '#a03d2a';
  ctx.beginPath();
  ctx.moveTo(base.x - w * 0.62, base.y - h);
  ctx.lineTo(base.x + w * 0.62, base.y - h);
  ctx.lineTo(base.x, base.y - h * 1.75);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,0.95)';
  ctx.fillRect(base.x - w * 0.12, base.y - h * 0.62, w * 0.2, h * 0.34);
}

function drawCloud(ctx, view, cam, pos, size, tone) {
  const p = project(view, cam, pos);
  if (!p) return;
  const r = p.s * size * 0.5;
  if (r < 4) return;
  const alpha = clamp(1.15 - p.d / 3600, 0.12, 0.8);
  ctx.fillStyle = `rgba(252,250,246,${alpha})`;
  const puffs = 6;
  for (let i = 0; i < puffs; i++) {
    const px = p.x + (hash(pos.z, i * 13.7) - 0.5) * r * 1.7;
    const py = p.y + (hash(pos.x, i * 7.3) - 0.5) * r * 0.5;
    const pr = r * (0.42 + hash(i, pos.z) * 0.3);
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(214,205,196,${alpha * 0.5})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.22, r * 0.95, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  void tone;
}

function drawRings(ctx, view, cam, course, sortie, t) {
  course.rings.forEach((ring, idx) => {
    const isNext = idx === sortie.ringIndex && sortie.phase === 0;
    const done = ring.state === 'flown' || ring.state === 'clipped' || ring.state === 'missed';
    if (done && !isNext) return;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      pts.push(project(view, cam, { x: ring.x + Math.cos(a) * ring.r, y: ring.y + Math.sin(a) * ring.r, z: ring.z }));
    }
    if (pts.some((p) => !p)) return;
    const near = pts[0];
    const lw = clamp(near.s * ring.r * 0.075, 1, 13);
    const pulse = isNext ? 0.72 + Math.sin(t * 5) * 0.28 : 0.5;
    ctx.lineWidth = lw * 2.6;
    ctx.strokeStyle = isNext ? `rgba(255,176,32,${0.20 * pulse})` : 'rgba(255,190,60,0.10)';
    strokePts(ctx, pts);
    ctx.lineWidth = lw;
    ctx.strokeStyle = isNext ? `rgba(255,190,40,${0.95 * pulse + 0.05})` : 'rgba(255,205,110,0.5)';
    strokePts(ctx, pts);
    ctx.strokeStyle = 'rgba(255,244,214,0.85)';
    ctx.lineWidth = Math.max(1, lw * 0.32);
    strokePts(ctx, pts);
    if (isNext) {
      const top = project(view, cam, { x: ring.x, y: ring.y + ring.r + 14 + Math.sin(t * 3) * 2.5, z: ring.z });
      if (top) {
        const s = clamp(top.s * 6, 4, 22);
        ctx.fillStyle = 'rgba(255,190,40,0.95)';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y + s);
        ctx.lineTo(top.x - s * 0.6, top.y);
        ctx.lineTo(top.x + s * 0.6, top.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
}

function drawCrates(ctx, view, cam, sortie) {
  for (const c of sortie.crates) {
    const p = project(view, cam, { x: c.x, y: c.y, z: c.z });
    if (!p) continue;
    const s = p.s;
    const box = clamp(s * 2.6, 1.5, 26);
    if (!c.settled) {
      // Parachute canopy and shroud lines above the falling crate.
      ctx.strokeStyle = 'rgba(240,240,235,0.8)';
      ctx.lineWidth = Math.max(0.7, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(p.x - box * 0.8, p.y - box * 1.7);
      ctx.lineTo(p.x, p.y);
      ctx.moveTo(p.x + box * 0.8, p.y - box * 1.7);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = '#e8762c';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - box * 1.8, box * 0.95, box * 0.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7a5c33';
    ctx.fillRect(p.x - box / 2, p.y - box / 2, box, box);
    ctx.strokeStyle = '#54401f';
    ctx.lineWidth = Math.max(0.6, box * 0.08);
    ctx.strokeRect(p.x - box / 2, p.y - box / 2, box, box);
    ctx.beginPath();
    ctx.moveTo(p.x - box / 2, p.y - box / 2);
    ctx.lineTo(p.x + box / 2, p.y + box / 2);
    ctx.moveTo(p.x + box / 2, p.y - box / 2);
    ctx.lineTo(p.x - box / 2, p.y + box / 2);
    ctx.stroke();
  }
}

// A few swifts work the valley air; they cross the view and flap.
function drawBirds(ctx, view, cam, t) {
  ctx.strokeStyle = 'rgba(30,34,40,0.8)';
  for (let i = 0; i < 4; i++) {
    const z = ((t * 26 + i * 2300) % 9800) + 300;
    const x = valleyCenterX(z) + Math.sin(i * 2.4 + t * 0.11) * 260;
    const y = terrainHeight(x, z) + 130 + Math.sin(t * 0.7 + i) * 16;
    const p = project(view, cam, { x, y, z });
    if (!p || p.d > 1500) continue;
    const w = clamp(p.s * 3.4, 1.5, 12);
    const flap = Math.sin(t * 9 + i * 1.9) * w * 0.55;
    ctx.lineWidth = Math.max(0.8, w * 0.16);
    ctx.beginPath();
    ctx.moveTo(p.x - w, p.y - flap);
    ctx.quadraticCurveTo(p.x - w * 0.3, p.y + w * 0.2, p.x, p.y);
    ctx.quadraticCurveTo(p.x + w * 0.3, p.y + w * 0.2, p.x + w, p.y - flap);
    ctx.stroke();
  }
}

function drawAircraftSprite(ctx, view, cam, f, t) {
  const p = project(view, cam, { x: f.x, y: f.y, z: f.z });
  if (!p) return;
  const pxPerMeter = p.s;
  const scale = pxPerMeter * (11.4 / 208);
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(t * 2.2) * (f.onGround ? 0 : 1.6));
  if (f.shake > 0.02) {
    ctx.translate((hash(t * 60, 1) - 0.5) * f.shake * 7, (hash(t * 60, 2) - 0.5) * f.shake * 7);
  }
  drawAircraft(ctx, {
    scale,
    bank: f.bank,
    pitch: f.pathPitch,
    gearTravel: f.gearTravel,
    propPhase: f.propPhase,
    rollDeflect: clamp(f.bank * 0.8, -1, 1),
    pitchDeflect: clamp(-f.pathPitch * 1.6, -1, 1),
    damage: f.damage,
    strobeOn: (t * 1.4) % 1 < 0.07,
  });
  ctx.restore();
}

// --- small vector helpers -------------------------------------------------
function norm(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
function strokePts(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = (a.y || 0) - (b.y || 0);
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
function hash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
