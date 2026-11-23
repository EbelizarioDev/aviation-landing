// Minimap: the side profile of the approach. This is the instrument that answers
// "am I high or low, and how far am I?" — the windshield confirms it, it does
// not replace it.

import { FEET_PER_NM, glidePathAltFt } from '../physics.js';
import { VIEW, COLORS } from './layout.js';
import { pathDeviationFt } from './projection.js';

export function drawMinimap(ctx, { state, aircraft, level }) {
  const { x, y, w, h } = VIEW.minimap;
  const padLeft = 26;
  const padBottom = 18;
  const plotW = w - padLeft - 8;
  const plotH = h - padBottom - 20;

  const maxDistFt = level.distNm * FEET_PER_NM;
  const maxAltFt = glidePathAltFt(level.distNm) + 400;

  const toX = (distFt) => x + padLeft + plotW * (1 - distFt / maxDistFt);
  const toY = (altFt) => y + h - padBottom - plotH * (altFt / maxAltFt);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = 'rgba(8,12,16,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Ground and the runway block.
  const groundY = toY(0);
  ctx.fillStyle = '#2a3324';
  ctx.fillRect(x + padLeft, groundY, plotW, h - padBottom - (groundY - y));
  const runwayFt = (level.runwayM ?? aircraft.runwayM) * 3.28084;
  ctx.fillStyle = COLORS.runway;
  ctx.fillRect(toX(0), groundY - 3, Math.max(6, toX(-runwayFt) - toX(0)), 3);

  // Distance grid every nautical mile.
  ctx.strokeStyle = 'rgba(102,114,124,0.35)';
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.dim;
  ctx.font = '9px ui-monospace, monospace';
  for (let nm = 0; nm <= level.distNm; nm++) {
    const gx = toX(nm * FEET_PER_NM);
    ctx.beginPath();
    ctx.moveTo(gx, y + 16);
    ctx.lineTo(gx, groundY);
    ctx.stroke();
    ctx.fillText(`${nm}`, gx - 3, y + h - 6);
  }

  // The 3 degree path, extended past the threshold to where it meets the ground.
  ctx.strokeStyle = 'rgba(90,209,232,0.75)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(toX(-1400), toY(0));
  for (let d = 0; d <= maxDistFt; d += 250) {
    ctx.lineTo(toX(d), toY(glidePathAltFt(d / FEET_PER_NM)));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Where a stabilised approach should touch down.
  const aimX = toX(-1550);
  if (aimX > x + padLeft && aimX < x + w) {
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.moveTo(aimX, groundY - 9);
    ctx.lineTo(aimX + 4, groundY - 4);
    ctx.lineTo(aimX, groundY + 1);
    ctx.lineTo(aimX - 4, groundY - 4);
    ctx.closePath();
    ctx.fill();
  }

  // Aircraft and its trend.
  const ax = toX(Math.max(-1000, state.distFt));
  const ay = toY(state.altFt);
  const dev = pathDeviationFt(state);
  const devColor =
    Math.abs(dev) < 60 ? COLORS.green : Math.abs(dev) < 160 ? COLORS.amber : COLORS.red;

  if (!state.onGround) {
    ctx.strokeStyle = devColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, toY(glidePathAltFt(Math.max(0, state.distFt) / FEET_PER_NM)));
    ctx.stroke();
    ctx.setLineDash([]);

    // Trend: where the aircraft will be in eight seconds.
    const tx = toX(state.distFt - (state.groundSpeedKt ?? state.speedKt) * 1.68781 * 8);
    const ty = toY(Math.max(0, state.altFt + (state.vsiFpm / 60) * 8));
    ctx.strokeStyle = 'rgba(242,177,52,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  ctx.fillStyle = devColor;
  ctx.beginPath();
  ctx.moveTo(ax + 7, ay);
  ctx.lineTo(ax - 4, ay - 5);
  ctx.lineTo(ax - 2, ay);
  ctx.lineTo(ax - 4, ay + 5);
  ctx.closePath();
  ctx.fill();

  // Readouts.
  ctx.fillStyle = COLORS.text;
  ctx.font = '600 9px ui-monospace, monospace';
  ctx.fillText('APPROACH PROFILE', x + 6, y + 12);
  ctx.font = '600 10px ui-monospace, monospace';
  const distNm = Math.max(0, state.distFt) / FEET_PER_NM;
  ctx.fillText(`DIST ${distNm.toFixed(1)}NM`, x + w - 78, y + 12);
  ctx.fillStyle = devColor;
  ctx.fillText(`${dev > 0 ? '+' : ''}${Math.round(dev)}FT`, x + w - 78, y + 26);

  ctx.restore();
}
