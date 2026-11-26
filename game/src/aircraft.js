// aircraft.js — the Kestrel herself, drawn in code from behind and above:
// a high-wing bush plane in cream and signal red, with a blurred prop, struts,
// tundra tyres when the gear is down, control surfaces that move with the
// stick, and wingtip lights that know port from starboard.

export function drawAircraft(ctx, o) {
  const s = o.scale;
  ctx.save();
  ctx.scale(s, s * (1 - o.pitch * 0.16));
  ctx.rotate(o.bank * 0.92);

  const cream = '#f3ecdc';
  const creamShade = '#ddd2ba';
  const red = '#cf4526';
  const dark = '#2c2f36';

  // Tailplane and fin, furthest away, drawn first.
  ctx.fillStyle = creamShade;
  roundRect(ctx, -40, -66, 80, 13, 6);
  ctx.fill();
  ctx.fillStyle = red;
  roundRect(ctx, -40, -66, 13, 13, 6);
  ctx.fill();
  roundRect(ctx, 27, -66, 13, 13, 6);
  ctx.fill();
  // Elevator deflection.
  ctx.save();
  ctx.translate(0, -53);
  ctx.rotate(o.pitchDeflect * 0.3);
  ctx.fillStyle = '#cbbd9f';
  roundRect(ctx, -36, -3, 72, 7, 3);
  ctx.fill();
  ctx.restore();
  // Vertical fin with the registration.
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-4, -88);
  ctx.lineTo(9, -88);
  ctx.lineTo(13, -56);
  ctx.lineTo(-7, -56);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6ea';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KR-1', 3, -68);

  // Fuselage: a tapered capsule, tail at the top, nose at the bottom.
  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, creamShade);
  body.addColorStop(0.5, '#faf5e9');
  body.addColorStop(1, creamShade);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-8, -58);
  ctx.bezierCurveTo(-15, -30, -17, 2, -13, 22);
  ctx.bezierCurveTo(-10, 34, 10, 34, 13, 22);
  ctx.bezierCurveTo(17, 2, 15, -30, 8, -58);
  ctx.closePath();
  ctx.fill();
  // Livery cheatline.
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-15.5, 2);
  ctx.lineTo(15.5, 2);
  ctx.lineTo(14.2, 10);
  ctx.lineTo(-14.2, 10);
  ctx.closePath();
  ctx.fill();

  // Wing struts down to the fuselage.
  ctx.strokeStyle = '#8d8271';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-54, -26);
  ctx.lineTo(-12, 8);
  ctx.moveTo(54, -26);
  ctx.lineTo(12, 8);
  ctx.stroke();

  // Main wing across the top of the fuselage, red tips, moving ailerons.
  ctx.fillStyle = cream;
  roundRect(ctx, -104, -38, 208, 17, 8);
  ctx.fill();
  ctx.fillStyle = red;
  roundRect(ctx, -104, -38, 20, 17, 8);
  ctx.fill();
  roundRect(ctx, 84, -38, 20, 17, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(44,47,54,0.16)';
  roundRect(ctx, -104, -38, 208, 5, 3);
  ctx.fill();
  drawAileron(ctx, -100, o.rollDeflect, true);
  drawAileron(ctx, 100, -o.rollDeflect, false);

  // Canopy with a sky glint.
  const glass = ctx.createLinearGradient(0, -26, 0, 2);
  glass.addColorStop(0, '#9fc6de');
  glass.addColorStop(0.55, '#5d87a3');
  glass.addColorStop(1, '#33506a');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -12, 10.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-3.5, -19, 3, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Nose and the spinning prop: a blurred disc, a spinner, two blade ghosts.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(0, 30, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, 33);
  ctx.fillStyle = 'rgba(30,30,34,0.20)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.sin(o.propPhase) * 0.06);
  ctx.fillStyle = 'rgba(30,30,34,0.35)';
  const blade = (Math.sin(o.propPhase * 7) * 0.5 + 0.5) * 40 + 6;
  ctx.fillRect(-blade, -1.6, blade * 2, 3.2);
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Gear: legs and tundra tyres, travelling with gearTravel.
  if (o.gearTravel > 0.03) {
    const g = o.gearTravel;
    ctx.strokeStyle = '#4a4d55';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-11, 16);
    ctx.lineTo(-19, 16 + 22 * g);
    ctx.moveTo(11, 16);
    ctx.lineTo(19, 16 + 22 * g);
    ctx.stroke();
    ctx.fillStyle = '#1d1f24';
    for (const sx of [-19, 19]) {
      ctx.beginPath();
      ctx.ellipse(sx, 20 + 24 * g, 6.4, 8.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9aa0ab';
      ctx.beginPath();
      ctx.ellipse(sx, 20 + 24 * g, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d1f24';
    }
  }

  // Navigation lights: port red, starboard green, and a white strobe that
  // blinks — small things, but a plane at dusk is known by them.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-103, -29, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2eff7a';
  ctx.beginPath(); ctx.arc(103, -29, 3, 0, Math.PI * 2); ctx.fill();
  if (o.strobeOn) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(0, -88, 3.4, 0, Math.PI * 2); ctx.fill();
  }

  // Damage smoke: grey puffs trailing the cowling when the airframe hurts.
  if (o.damage > 45) {
    const n = o.damage > 75 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const ph = (o.propPhase * 0.7 + i * 1.7) % 3;
      ctx.fillStyle = `rgba(70,70,76,${0.30 - ph * 0.09})`;
      ctx.beginPath();
      ctx.arc(Math.sin(i * 4.1) * 6, -34 - ph * 22, 5 + ph * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawAileron(ctx, tipX, deflect, left) {
  ctx.save();
  ctx.translate(tipX, -22);
  ctx.rotate(deflect * 0.35);
  ctx.fillStyle = '#e7dcc4';
  const w = left ? -52 : 52;
  roundRect(ctx, left ? w : 0, -3.4, Math.abs(w), 7, 3);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, h / 2, Math.abs(w) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
