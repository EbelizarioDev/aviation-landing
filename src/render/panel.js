// Instrument panel: attitude, speed and altitude tapes, vertical speed, and the
// glideslope/localizer diamonds. Everything the pilot needs is a shape or a
// number, nothing requires reading a manual.

import { RUNWAY_HALF_WIDTH_FT } from '../physics.js';
import { VIEW, COLORS } from './layout.js';
import { deviationBand, pathDeviationFt } from './projection.js';

const TOP = VIEW.windshieldBottom + 12;
const HEIGHT = VIEW.height - TOP - 46;

export function drawPanel(ctx, { state, aircraft, level, cues }) {
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, VIEW.windshieldBottom, VIEW.width, VIEW.height - VIEW.windshieldBottom);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, VIEW.windshieldBottom + 1);
  ctx.lineTo(VIEW.width, VIEW.windshieldBottom + 1);
  ctx.stroke();

  drawAttitude(ctx, 62, TOP, 214, HEIGHT, state);
  drawTape(ctx, 302, TOP, 74, HEIGHT, {
    value: state.speedKt,
    label: 'KT',
    step: 10,
    range: 45,
    bug: aircraft.vrefKt,
    bugLabel: 'VREF',
  });
  drawAltTape(ctx, 566, TOP, 86, HEIGHT, state, level);
  drawVsi(ctx, 668, TOP, 92, HEIGHT, state);
  drawGlidePath(ctx, 392, TOP, 158, HEIGHT, state);
  drawSystems(ctx, 782, TOP, 156, HEIGHT, { state, aircraft, cues });
  drawAnnunciators(ctx, { state, aircraft, cues });
}

function frame(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.glass;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawAttitude(ctx, x, y, w, h, state) {
  frame(ctx, x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pxPerDeg = h / 34;
  const horizon = cy + state.pitchDeg * pxPerDeg;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.clip();
  ctx.fillStyle = '#3b6f96';
  ctx.fillRect(x, y, w, Math.max(0, horizon - y));
  ctx.fillStyle = '#5b4a33';
  ctx.fillRect(x, horizon, w, Math.max(0, y + h - horizon));
  ctx.strokeStyle = COLORS.marking;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, horizon);
  ctx.lineTo(x + w, horizon);
  ctx.stroke();

  // Pitch ladder, so a nose-up attitude reads as an angle and not a feeling.
  ctx.strokeStyle = 'rgba(236,239,241,0.75)';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(236,239,241,0.75)';
  ctx.font = '11px ui-monospace, monospace';
  for (const deg of [-10, -5, 5, 10]) {
    const ly = cy - deg * pxPerDeg;
    if (ly < y + 8 || ly > y + h - 8) continue;
    ctx.beginPath();
    ctx.moveTo(cx - 30, ly);
    ctx.lineTo(cx + 30, ly);
    ctx.stroke();
    ctx.fillText(String(deg), cx + 34, ly + 4);
  }
  ctx.restore();

  // Fixed aircraft symbol.
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 42, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.lineTo(cx - 12, cy + 7);
  ctx.moveTo(cx + 42, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx + 12, cy + 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.amber;
  ctx.fill();

  text(ctx, 'ATTITUDE', x + 6, y + 14, { size: 10, color: COLORS.dim });
}

function drawTape(ctx, x, y, w, h, { value, label, step, range, bug, bugLabel }) {
  frame(ctx, x, y, w, h);
  const cy = y + h / 2;
  const pxPerUnit = h / (range * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();

  ctx.strokeStyle = COLORS.dim;
  ctx.fillStyle = COLORS.text;
  ctx.font = '11px ui-monospace, monospace';
  ctx.lineWidth = 1;
  const first = Math.floor((value - range) / step) * step;
  for (let v = first; v <= value + range; v += step) {
    const ty = cy - (v - value) * pxPerUnit;
    if (ty < y + 4 || ty > y + h - 4) continue;
    ctx.beginPath();
    ctx.moveTo(x + w - 14, ty);
    ctx.lineTo(x + w - 4, ty);
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), x + 4, ty + 4);
  }

  if (bug != null) {
    const by = cy - (bug - value) * pxPerUnit;
    if (by > y + 4 && by < y + h - 4) {
      ctx.fillStyle = COLORS.green;
      ctx.beginPath();
      ctx.moveTo(x + 2, by);
      ctx.lineTo(x + 12, by - 5);
      ctx.lineTo(x + 12, by + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(bugLabel, x + 14, by + 4);
    }
  }
  ctx.restore();

  // Current value readout.
  ctx.fillStyle = '#0a0e11';
  ctx.fillRect(x + 2, cy - 13, w - 4, 26);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, cy - 13, w - 4, 26);
  text(ctx, String(Math.round(value)), x + w / 2, cy + 8, {
    size: 20,
    color: COLORS.marking,
    align: 'center',
  });
  text(ctx, label, x + 4, y + 13, { size: 10, color: COLORS.dim });
}

function drawAltTape(ctx, x, y, w, h, state, level) {
  frame(ctx, x, y, w, h);
  const cy = y + h / 2;
  const pxPerFt = h / 1200;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();
  ctx.strokeStyle = COLORS.dim;
  ctx.fillStyle = COLORS.text;
  ctx.font = '11px ui-monospace, monospace';
  for (let ft = Math.floor((state.altFt - 600) / 100) * 100; ft <= state.altFt + 600; ft += 100) {
    const ty = cy - (ft - state.altFt) * pxPerFt;
    if (ty < y + 4 || ty > y + h - 4) continue;
    ctx.beginPath();
    ctx.moveTo(x + 4, ty);
    ctx.lineTo(x + 14, ty);
    ctx.stroke();
    ctx.fillText(String(Math.round(ft)), x + 18, ty + 4);
  }
  ctx.restore();

  ctx.fillStyle = '#0a0e11';
  ctx.fillRect(x + 2, cy - 13, w - 4, 26);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, cy - 13, w - 4, 26);
  text(ctx, String(Math.round(state.altFt)), x + w / 2, cy + 8, {
    size: 20,
    color: COLORS.marking,
    align: 'center',
  });
  text(ctx, 'FT AGL', x + 4, y + 13, { size: 10, color: COLORS.dim });
}

function drawVsi(ctx, x, y, w, h, state) {
  frame(ctx, x, y, w, h);
  const cy = y + h / 2;
  const maxFpm = 1500;
  const pxPerFpm = (h / 2 - 12) / maxFpm;

  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 1;
  for (const fpm of [-1500, -1000, -500, 0, 500, 1000, 1500]) {
    const ty = cy - fpm * pxPerFpm;
    ctx.beginPath();
    ctx.moveTo(x + 4, ty);
    ctx.lineTo(x + w - 20, ty);
    ctx.stroke();
  }

  // Required sink rate for the 3 degree path: the target needle.
  const target = -requiredSink(state);
  const targetY = cy - target * pxPerFpm;
  ctx.fillStyle = COLORS.green;
  ctx.beginPath();
  ctx.moveTo(x + w - 20, targetY);
  ctx.lineTo(x + w - 8, targetY - 6);
  ctx.lineTo(x + w - 8, targetY + 6);
  ctx.closePath();
  ctx.fill();

  const vy = cy - state.vsiFpm * pxPerFpm;
  ctx.fillStyle = COLORS.amber;
  ctx.fillRect(x + w - 34, vy - 3, 26, 6);
  text(ctx, String(Math.round(state.vsiFpm)), x + w - 38, vy - 8, {
    size: 12,
    color: COLORS.marking,
    align: 'right',
  });
  text(ctx, 'VSI', x + 4, y + 13, { size: 10, color: COLORS.dim });
}

function requiredSink(state) {
  return (state.groundSpeedKt ?? state.speedKt) * 101.27 * Math.sin(3 * (Math.PI / 180));
}

function drawGlidePath(ctx, x, y, w, h, state) {
  frame(ctx, x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Localizer: horizontal. Glideslope: vertical.
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, cy);
  ctx.lineTo(x + w - 10, cy);
  ctx.moveTo(cx, y + 10);
  ctx.lineTo(cx, y + h - 10);
  ctx.stroke();

  const band = deviationBand(state);
  const gsY = cy - band * (h / 2 - 16);
  const latBand = Math.max(-1, Math.min(1, (state.lateralFt ?? 0) / RUNWAY_HALF_WIDTH_FT));
  const locX = cx + latBand * (w / 2 - 16);

  const onPath = Math.abs(band) < 0.25 && Math.abs(latBand) < 0.25;
  ctx.fillStyle = onPath ? COLORS.green : COLORS.amber;
  diamond(ctx, locX, cy, 8);
  diamond(ctx, cx, gsY, 8);

  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 6);
  ctx.lineTo(cx + 4, cy - 6);
  ctx.moveTo(cx - 4, cy + 6);
  ctx.lineTo(cx + 4, cy + 6);
  ctx.stroke();

  const dev = Math.round(pathDeviationFt(state));
  text(ctx, `PATH ${dev > 0 ? '+' : ''}${dev} FT`, cx, y + h - 10, {
    size: 11,
    color: onPath ? COLORS.green : COLORS.amber,
    align: 'center',
  });
  text(ctx, 'G/S · LOC', x + 6, y + 13, { size: 10, color: COLORS.dim });
}

function drawSystems(ctx, x, y, w, h, { state, aircraft, cues }) {
  frame(ctx, x, y, w, h);
  const rows = [
    { label: 'GEAR', value: aircraft.gear === 'fixed' ? 'FIXED' : state.gearDown ? 'DOWN' : 'UP', ok: state.gearDown || aircraft.gear === 'fixed' },
    { label: 'FLAPS', value: state.flapIdx === 0 ? 'UP' : flapLabel(aircraft, state.flapIdx), ok: true },
    { label: 'SPD BRK', value: aircraft.spoilers ? (state.spoilers ? 'OUT' : 'STOW') : 'N/A', ok: !state.spoilers },
    { label: 'THR', value: `${Math.round(state.thrust * 100)}%`, ok: true },
  ];
  let ry = y + 26;
  for (const row of rows) {
    text(ctx, row.label, x + 8, ry, { size: 11, color: COLORS.dim });
    text(ctx, row.value, x + w - 8, ry, {
      size: 13,
      color: row.ok ? COLORS.green : COLORS.amber,
      align: 'right',
    });
    ry += 26;
  }

  // Thrust bar.
  const barY = ry + 6;
  const barH = y + h - barY - 10;
  ctx.fillStyle = '#0a0e11';
  ctx.fillRect(x + 8, barY, w - 16, barH);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(x + 8, barY + barH * (1 - state.thrust), w - 16, barH * state.thrust);

  if (cues?.flare) {
    text(ctx, 'FLARE', x + w / 2, barY - 6, { size: 13, color: COLORS.amber, align: 'center' });
  }
}

function drawAnnunciators(ctx, { state, aircraft, cues }) {
  const y = VIEW.height - 34;
  const items = [];
  items.push({ text: aircraft.name.toUpperCase(), color: COLORS.text });
  items.push({ text: `${aircraft.vrefKt} KT`, color: COLORS.green });
  if (cues?.stall) items.push({ text: 'STALL', color: COLORS.red });
  if (cues?.flare) items.push({ text: 'FLARE', color: COLORS.amber });
  if (state.onGround) items.push({ text: 'ON GROUND', color: COLORS.text });
  if (state.damage?.length) items.push({ text: `DAMAGE: ${state.damage.join(', ')}`, color: COLORS.red });
  items.push({
    text: `DIST ${Math.max(0, (state.distFt / 6076.12)).toFixed(1)} NM`,
    color: COLORS.text,
  });

  let x = 12;
  for (const item of items) {
    ctx.font = '600 12px ui-monospace, monospace';
    const w = ctx.measureText(item.text).width + 16;
    ctx.fillStyle = '#0d1114';
    ctx.fillRect(x, y, w, 24);
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 23);
    text(ctx, item.text, x + 8, y + 16, { size: 12, color: item.color });
    x += w + 8;
    if (x > VIEW.width - 120) break;
  }
}

function flapLabel(aircraft, flapIdx) {
  return aircraft.flaps[Math.max(0, Math.min(aircraft.flaps.length - 1, flapIdx))].label;
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

function text(ctx, str, x, y, { size = 12, color = COLORS.text, align = 'left' } = {}) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}
