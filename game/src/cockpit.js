// cockpit.js — the panel the pilot flies by, and the words the game speaks.
// A dark dash across the bottom of the screen carries a working artificial
// horizon, airspeed and altitude dials with needles that tell the truth, a
// vertical-speed dial, a compass tape, throttle and fuel, gear lamps and
// warning lights. Above it, the HUD keeps ALT, SPD and HDG in big lit
// figures, with the mission's current order and the score.

import { toFeet, toKnots, headingDeg, altitudeAgl } from './flight.js';
import { phaseTitle, phaseBrief } from './missions.js';

const PANEL = '#14171d';
const BEZEL = '#23262e';
const LIT = '#ffd98a';
const LIT_GREEN = '#8ef0b0';
const LIT_BLUE = '#9fd0ff';
const DIM = '#7d8593';
const WARN = '#ff5147';

export function drawHud(ctx, view, f, sortie, t, now) {
  const { W } = view;
  ctx.save();
  // Flight-path marker at the centre of the view.
  ctx.strokeStyle = 'rgba(255,217,138,0.85)';
  ctx.lineWidth = 2;
  const cx = W / 2;
  const cy = view.H * 0.47;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.moveTo(cx, cy + 10);
  ctx.lineTo(cx, cy + 17);
  ctx.stroke();

  hudFigure(ctx, 26, 20, 'ALT', `${Math.round(toFeet(f.y))}`, 'ft', `${Math.round(toFeet(altitudeAgl(f)))} AGL`);
  hudFigure(ctx, W - 26, 20, 'SPD', `${Math.round(toKnots(f.speed))}`, 'kt', f.stalled ? 'STALL' : '');
  hudFigure(ctx, W - 26, 96, 'HDG', `${String(Math.round(headingDeg(f))).padStart(3, '0')}`, '°', '');

  // Score and sortie clock, top-left under the altitude.
  ctx.textAlign = 'left';
  ctx.fillStyle = LIT;
  ctx.font = 'bold 21px ui-monospace, monospace';
  ctx.fillText(`SCORE ${sortie.score}`, 26, 118);
  ctx.fillStyle = DIM;
  ctx.font = '14px ui-monospace, monospace';
  const elapsed = Math.max(0, (now - sortie.startedAt) / 1000);
  ctx.fillText(`TIME ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`, 26, 140);

  // Mission banner, top centre: the leg, its order, and the last call-out.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,13,20,0.55)';
  roundRectPath(ctx, W / 2 - 300, 14, 600, 58);
  ctx.fill();
  ctx.fillStyle = LIT;
  ctx.font = 'bold 17px ui-monospace, monospace';
  ctx.fillText(phaseTitle(sortie), W / 2, 38);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '14.5px ui-monospace, monospace';
  ctx.fillText(phaseBrief(sortie), W / 2, 60);
  if (sortie.message && now < sortie.messageUntil) {
    ctx.fillStyle = `rgba(10,13,20,${0.45 + Math.sin(t * 6) * 0.08})`;
    roundRectPath(ctx, W / 2 - 260, 82, 520, 32);
    ctx.fill();
    ctx.fillStyle = LIT_GREEN;
    ctx.font = 'bold 15.5px ui-monospace, monospace';
    ctx.fillText(sortie.message, W / 2, 103);
  }
  ctx.restore();
}

function hudFigure(ctx, x, y, label, value, unit, sub) {
  const right = x > 100;
  ctx.save();
  ctx.textAlign = right ? 'right' : 'left';
  ctx.fillStyle = DIM;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.fillText(label, x, y + 10);
  ctx.fillStyle = LIT;
  ctx.font = 'bold 34px ui-monospace, monospace';
  const valueWidth = ctx.measureText(value).width;
  ctx.fillText(value, x, y + 44);
  // The unit sits just outside the figures: right of a left-hand readout,
  // left of a right-hand one, so the two never share a pixel.
  ctx.fillStyle = DIM;
  ctx.font = '13px ui-monospace, monospace';
  if (right) {
    ctx.textAlign = 'right';
    ctx.fillText(unit, x - valueWidth - 7, y + 44);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(unit, x + valueWidth + 7, y + 44);
  }
  if (sub) {
    ctx.fillStyle = sub === 'STALL' ? WARN : LIT_BLUE;
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(sub, x, y + 64);
  }
  ctx.restore();
}

export function drawDash(ctx, view, f, sortie, t) {
  const { W, H } = view;
  const dashH = Math.round(H * 0.265);
  const top = H - dashH;
  ctx.save();
  // The panel itself, with a lit top edge and a soft shadow over the view.
  const grad = ctx.createLinearGradient(0, top - 14, 0, top + 8);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, top - 14, W, 22);
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.moveTo(0, top + 16);
  ctx.lineTo(W * 0.16, top);
  ctx.lineTo(W * 0.84, top);
  ctx.lineTo(W, top + 16);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333845';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top + 16);
  ctx.lineTo(W * 0.16, top);
  ctx.lineTo(W * 0.84, top);
  ctx.lineTo(W, top + 16);
  ctx.stroke();

  const cy = top + dashH * 0.54;
  const R = Math.min(56, dashH * 0.31);
  drawHorizon(ctx, W * 0.30, cy, R, f);
  drawSpeedDial(ctx, W * 0.415, cy, R, f);
  drawAltDial(ctx, W * 0.53, cy, R, f);
  drawVsiDial(ctx, W * 0.625, cy, R * 0.72, f);
  drawCompassTape(ctx, W / 2, top + 24, 300, f);

  // Right cluster: throttle, fuel, gear, and the lamps that matter.
  drawThrottle(ctx, W * 0.70, top + 26, dashH - 52, f);
  drawFuel(ctx, W * 0.755, top + 30, 120, 16, f);
  drawGearLamps(ctx, W * 0.755, top + 78, f, t);
  drawDamage(ctx, W * 0.755, top + 122, 120, 12, f);
  drawLamps(ctx, W * 0.90, top + 34, f, sortie, t);
  ctx.restore();
}

function gaugeFace(ctx, x, y, r) {
  ctx.fillStyle = BEZEL;
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawHorizon(ctx, x, y, r, f) {
  gaugeFace(ctx, x, y, r);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-f.bank);
  const pitchPx = f.pathPitch * r * 2.4;
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#5d8fc4';
  ctx.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 1.6);
  ctx.fillStyle = '#7a5c3d';
  ctx.fillRect(-r * 1.6, 0, r * 3.2, r * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (const p of [-20, -10, 10, 20]) {
    const yy = -p * r * 0.055;
    const w = p % 20 === 0 ? r * 0.42 : r * 0.24;
    ctx.beginPath();
    ctx.moveTo(-w / 2, yy);
    ctx.lineTo(w / 2, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 1.6, 0);
  ctx.lineTo(r * 1.6, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol and the bank pointer.
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.52, y);
  ctx.lineTo(x - r * 0.16, y);
  ctx.lineTo(x, y + r * 0.12);
  ctx.lineTo(x + r * 0.16, y);
  ctx.lineTo(x + r * 0.52, y);
  ctx.stroke();
  ctx.fillStyle = '#ffb02e';
  const ba = -f.bank;
  ctx.beginPath();
  ctx.moveTo(x + Math.sin(ba) * (r - 9), y - Math.cos(ba) * (r - 9));
  ctx.lineTo(x + Math.sin(ba - 0.16) * (r - 1), y - Math.cos(ba - 0.16) * (r - 1));
  ctx.lineTo(x + Math.sin(ba + 0.16) * (r - 1), y - Math.cos(ba + 0.16) * (r - 1));
  ctx.closePath();
  ctx.fill();
  gaugeLabel(ctx, x, y + r + 16, 'ATTITUDE');
}

function drawSpeedDial(ctx, x, y, r, f) {
  gaugeFace(ctx, x, y, r);
  const kt = toKnots(f.speed);
  dialTicks(ctx, x, y, r, 0, 200, 20, -225, 45, (v) => (v % 40 === 0 ? String(v) : ''));
  // Green band of honest flying speeds, red beyond the redline.
  arcBand(ctx, x, y, r - 4, 45, 115, 0, 200, -225, 45, '#3fae5c');
  arcBand(ctx, x, y, r - 4, 168, 200, 0, 200, -225, 45, WARN);
  needle(ctx, x, y, r * 0.78, angleFor(kt, 0, 200, -225, 45));
  digital(ctx, x, y + r * 0.52, `${Math.round(kt)}`);
  gaugeLabel(ctx, x, y + r + 16, 'AIRSPEED KT');
}

function drawAltDial(ctx, x, y, r, f) {
  gaugeFace(ctx, x, y, r);
  const ft = toFeet(f.y);
  dialTicks(ctx, x, y, r, 0, 10, 1, -90, 270, (v) => String(v));
  needle(ctx, x, y, r * 0.8, angleFor((ft % 1000) / 100, 0, 10, -90, 270));
  needleThin(ctx, x, y, r * 0.58, angleFor((ft % 10000) / 1000, 0, 10, -90, 270));
  digital(ctx, x, y + r * 0.52, `${Math.round(ft)}`);
  gaugeLabel(ctx, x, y + r + 16, 'ALTIMETER FT');
}

function drawVsiDial(ctx, x, y, r, f) {
  gaugeFace(ctx, x, y, r);
  const fpm = f.verticalSpeed * 196.85;
  dialTicks(ctx, x, y, r, -20, 20, 5, -210, 30, (v) => (v % 10 === 0 ? String(Math.abs(v)) : ''));
  needle(ctx, x, y, r * 0.74, angleFor(fpm / 100, -20, 20, -210, 30));
  gaugeLabel(ctx, x, y + r + 13, 'VERT SPEED');
}

function drawCompassTape(ctx, cx, y, w, f) {
  const hdg = headingDeg(f);
  ctx.save();
  ctx.fillStyle = '#0b0e14';
  roundRectPath(ctx, cx - w / 2, y - 13, w, 26);
  ctx.fill();
  ctx.strokeStyle = '#333845';
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y - 13, w, 26);
  ctx.clip();
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const deg = ((Math.round((hdg + d) / 5) * 5) % 360 + 360) % 360;
    const off = (deg - hdg + 540) % 360 - 180;
    if (Math.abs(off) > 58) continue;
    const x = cx + off * (w / 120);
    ctx.fillStyle = DIM;
    ctx.fillRect(x, y + 4, 1.4, 6);
    if (deg % 30 === 0) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      ctx.fillStyle = LIT;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(names[deg] || String(deg / 10), x, y + 1);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(cx, y - 16);
  ctx.lineTo(cx - 5, y - 22);
  ctx.lineTo(cx + 5, y - 22);
  ctx.closePath();
  ctx.fill();
}

function drawThrottle(ctx, x, y, h, f) {
  ctx.save();
  ctx.fillStyle = '#0b0e14';
  roundRectPath(ctx, x, y, 26, h);
  ctx.fill();
  ctx.strokeStyle = '#333845';
  ctx.stroke();
  const knobY = y + h - 12 - f.throttle * (h - 24);
  ctx.fillStyle = '#1d2026';
  ctx.fillRect(x + 11, y + 8, 4, h - 16);
  ctx.fillStyle = f.engineOut ? WARN : '#ffb02e';
  roundRectPath(ctx, x - 4, knobY - 8, 34, 16);
  ctx.fill();
  ctx.fillStyle = LIT;
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THR', x + 13, y + h + 14);
  ctx.fillText(`${Math.round(f.throttle * 100)}%`, x + 13, y - 6);
  ctx.restore();
}

function drawFuel(ctx, x, y, w, h, f) {
  ctx.save();
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', x, y - 4);
  ctx.fillStyle = '#0b0e14';
  roundRectPath(ctx, x, y, w, h);
  ctx.fill();
  const frac = f.fuel / 100;
  ctx.fillStyle = f.fuel < 22 ? WARN : '#e8a33d';
  if (frac > 0.01) {
    roundRectPath(ctx, x + 2, y + 2, (w - 4) * frac, h - 4);
    ctx.fill();
  }
  ctx.fillStyle = LIT;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(f.fuel)}%`, x + w, y - 4);
  ctx.restore();
}

function drawDamage(ctx, x, y, w, h, f) {
  ctx.save();
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('AIRFRAME', x, y - 4);
  ctx.fillStyle = '#0b0e14';
  roundRectPath(ctx, x, y, w, h);
  ctx.fill();
  if (f.damage > 0.5) {
    ctx.fillStyle = f.damage > 65 ? WARN : '#c46a2d';
    roundRectPath(ctx, x + 2, y + 2, (w - 4) * (f.damage / 100), h - 4);
    ctx.fill();
  }
  ctx.fillStyle = LIT;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(f.damage)}%`, x + w, y - 4);
  ctx.restore();
}

function drawGearLamps(ctx, x, y, f, t) {
  ctx.save();
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('GEAR', x, y - 4);
  for (let i = 0; i < 3; i++) {
    const cx = x + 14 + i * 30;
    let col = '#23262e';
    if (f.gearTravel === 1) col = LIT_GREEN;
    else if (f.gearTravel === 0) col = '#23262e';
    else col = Math.sin(t * 9) > 0 ? WARN : '#5c2320';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, y + 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333845';
    ctx.stroke();
  }
  ctx.fillStyle = LIT;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(f.gearTravel === 1 ? 'DOWN' : f.gearTravel === 0 ? 'UP' : 'MOVING', x + 108, y + 14);
  ctx.restore();
}

function drawLamps(ctx, x, y, f, sortie, t) {
  const lamps = [
    { label: 'STALL', on: f.stalled, col: WARN },
    { label: 'FUEL LOW', on: f.fuel < 22 && f.fuel > 0, col: '#ffb02e' },
    { label: 'ENGINE OUT', on: f.engineOut, col: WARN },
    { label: 'WIND →', on: sortie.phase === 1, col: LIT_BLUE },
  ];
  ctx.save();
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  lamps.forEach((lamp, i) => {
    const ly = y + i * 30;
    const blink = lamp.label === 'STALL' && Math.sin(t * 10) < 0;
    ctx.fillStyle = lamp.on && !blink ? lamp.col : '#1d2026';
    roundRectPath(ctx, x, ly, 96, 21);
    ctx.fill();
    ctx.fillStyle = lamp.on && !blink ? '#14100a' : DIM;
    ctx.fillText(lamp.label, x + 48, ly + 15);
  });
  ctx.restore();
}

// --- dial plumbing ----------------------------------------------------------
function angleFor(v, lo, hi, a0, a1) {
  const frac = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return ((a0 + (a1 - a0) * frac - 90) * Math.PI) / 180;
}
function dialTicks(ctx, x, y, r, lo, hi, step, a0, a1, label) {
  ctx.save();
  ctx.strokeStyle = '#aeb6c2';
  ctx.fillStyle = '#dfe6f2';
  ctx.font = `${Math.max(9, r * 0.19)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  for (let v = lo; v <= hi + 0.001; v += step) {
    const a = angleFor(v, lo, hi, a0, a1);
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + c * (r - 7), y + s * (r - 7));
    ctx.lineTo(x + c * (r - 1.5), y + s * (r - 1.5));
    ctx.stroke();
    const text = label(v);
    if (text) ctx.fillText(text, x + c * (r - 17), y + s * (r - 17) + 3.5);
  }
  ctx.restore();
}
function arcBand(ctx, x, y, r, v0, v1, lo, hi, a0, a1, col) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, angleFor(v0, lo, hi, a0, a1), angleFor(v1, lo, hi, a0, a1));
  ctx.stroke();
  ctx.restore();
}
function needle(ctx, x, y, len, a) {
  ctx.save();
  ctx.strokeStyle = '#ffb02e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * len * 0.18, y - Math.sin(a) * len * 0.18);
  ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  ctx.stroke();
  ctx.fillStyle = '#39404d';
  ctx.beginPath();
  ctx.arc(x, y, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function needleThin(ctx, x, y, len, a) {
  ctx.save();
  ctx.strokeStyle = '#dfe6f2';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  ctx.stroke();
  ctx.restore();
}
function digital(ctx, x, y, text) {
  ctx.save();
  ctx.fillStyle = LIT_BLUE;
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}
function gaugeLabel(ctx, x, y, text) {
  ctx.save();
  ctx.fillStyle = DIM;
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}
function roundRectPath(ctx, x, y, w, h) {
  const r = Math.min(7, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
