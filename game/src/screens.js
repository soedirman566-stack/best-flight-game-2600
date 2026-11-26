// screens.js — the game's spoken pages: the title card over the valley at
// dawn, the pause card, and the debrief after a landing or a crash. They are
// drawn over the live scene, so what is behind the words is always the game.

import { gradeFor } from './missions.js';

export function drawTitle(ctx, view, t) {
  const { W, H } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.34)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('KESTREL RIDGE', W / 2, H * 0.30);
  ctx.fillStyle = '#f3ecdc';
  ctx.font = 'italic 21px Georgia, serif';
  ctx.fillText('Thread the rings. Drop the crates. Grease the landing.', W / 2, H * 0.30 + 40);

  panel(ctx, W / 2 - 330, H * 0.44, 660, 168);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '16.5px ui-monospace, monospace';
  const lines = [
    'ARROWS / WASD or MOUSE — pitch and bank the Kestrel',
    'SHIFT / CTRL or MOUSE WHEEL — throttle      SPACE — drop crate',
    'G — landing gear        P — pause        M — sound on/off',
    'Slow flight stalls. The throttle drinks fuel. Bank costs speed.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.44 + 42 + i * 30));
  if (Math.sin(t * 3.2) > -0.35) {
    ctx.fillStyle = '#8ef0b0';
    ctx.font = 'bold 19px ui-monospace, monospace';
    ctx.fillText('PRESS ENTER OR CLICK TO FLY', W / 2, H * 0.44 + 200);
  }
  ctx.restore();
}

export function drawPaused(ctx, view) {
  const { W, H } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', W / 2, H * 0.44);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('P or ESC to fly on', W / 2, H * 0.44 + 36);
  ctx.restore();
}

export function drawDebrief(ctx, view, sortie, flight, outcome) {
  const { W, H } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (outcome.crashed) {
    ctx.fillStyle = '#ff5147';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText('THE VALLEY KEEPS THE KESTREL', W / 2, H * 0.30);
    ctx.fillStyle = '#f3ecdc';
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText(outcome.why, W / 2, H * 0.30 + 38);
  } else {
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText('DOWN AND CLEAR', W / 2, H * 0.30);
    ctx.fillStyle = '#f3ecdc';
    ctx.font = 'italic 19px Georgia, serif';
    const notes = sortie.landing ? sortie.landing.notes.join(' · ') : '';
    ctx.fillText(`Touchdown: ${notes}`, W / 2, H * 0.30 + 38);
  }
  panel(ctx, W / 2 - 300, H * 0.42, 600, 196);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '16.5px ui-monospace, monospace';
  const rows = [
    `Rings threaded        ${sortie.ringsFlown} of ${sortie.course.rings.length}`,
    `Crates on target      ${sortie.dropResults.length} dropped`,
    `Airframe damage       ${Math.round(flight.damage)}%`,
    `Fuel remaining        ${Math.round(flight.fuel)}%`,
  ];
  if (sortie.landing && sortie.landing.ok) {
    rows.push(`Landing bonus         +${sortie.landing.points}`);
  }
  rows.forEach((row, i) => ctx.fillText(row, W / 2, H * 0.42 + 40 + i * 27));
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 26px ui-monospace, monospace';
  ctx.fillText(`SCORE ${sortie.score}    GRADE ${outcome.crashed ? '—' : gradeFor(sortie.score)}`, W / 2, H * 0.42 + 40 + rows.length * 27 + 12);
  if (sortie.landing && sortie.landing.ok) {
    ctx.fillStyle = '#9fd0ff';
    ctx.font = '13.5px ui-monospace, monospace';
    ctx.fillText(`touchdown ${sortie.landing.kt.toFixed(0)} kt · sink ${sortie.landing.sink.toFixed(1)} m/s`, W / 2, H * 0.42 + 40 + rows.length * 27 + 36);
  }
  ctx.fillStyle = '#8ef0b0';
  ctx.font = 'bold 17px ui-monospace, monospace';
  ctx.fillText('ENTER — FLY THE VALLEY AGAIN', W / 2, H * 0.42 + 238);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,13,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
