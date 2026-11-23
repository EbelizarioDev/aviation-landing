// The windshield: sky, ground, the runway in perspective, approach lights and
// the PAPI that tells you, without numbers, whether you are on the path.

import { FEET_PER_M, RUNWAY_HALF_WIDTH_FT } from '../physics.js';
import { VIEW, COLORS } from './layout.js';
import { makeCamera, project, papiWhiteCount } from './projection.js';

const HALF_WIDTH_FT = RUNWAY_HALF_WIDTH_FT;
const RUNWAY_EDGE_LIGHT_SPACING_FT = 200;
const APPROACH_LIGHT_SPACING_FT = 200;

export function drawCockpit(ctx, { state, aircraft, level }) {
  const w = VIEW.width;
  const h = VIEW.windshieldBottom;
  const cam = makeCamera(state, { cx: w / 2, horizonY: VIEW.horizonBaseY });

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  drawSky(ctx, cam, w, h);
  drawGround(ctx, cam, w, h);
  drawRunway(ctx, cam, state, aircraft, level);
  drawApproachLights(ctx, cam, state, level);
  drawFrame(ctx, w, h);

  ctx.restore();
}

function drawSky(ctx, cam, w, h) {
  const horizon = Math.max(-h, Math.min(h * 2, cam.horizonY));
  const grad = ctx.createLinearGradient(0, Math.min(0, horizon - h), 0, horizon);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, Math.max(0, horizon));
  // Low cloud bands give the eye something to bank against.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 5; i++) {
    const y = horizon - 40 - i * 46;
    if (y < -20) break;
    ctx.fillRect(0, y, w, 9);
  }
}

function drawGround(ctx, cam, w, h) {
  const top = Math.max(0, Math.min(h, cam.horizonY));
  const grad = ctx.createLinearGradient(0, top, 0, h);
  grad.addColorStop(0, COLORS.groundFar);
  grad.addColorStop(1, COLORS.ground);
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, w, h - top);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, top);
  ctx.stroke();
}

function drawRunway(ctx, cam, state, aircraft, level) {
  const runwayFt = (level.runwayM ?? aircraft.runwayM) * FEET_PER_M;
  const thresholdZ = state.distFt;
  const zNear = Math.max(8, thresholdZ);
  const zFar = thresholdZ + runwayFt;
  if (zFar <= 12) return;

  const nearL = project(cam, -HALF_WIDTH_FT, 0, zNear);
  const nearR = project(cam, HALF_WIDTH_FT, 0, zNear);
  const farL = project(cam, -HALF_WIDTH_FT, 0, zFar);
  const farR = project(cam, HALF_WIDTH_FT, 0, zFar);

  ctx.fillStyle = level.wet ? COLORS.runwayWet : COLORS.runway;
  ctx.beginPath();
  ctx.moveTo(nearL.x, nearL.y);
  ctx.lineTo(nearR.x, nearR.y);
  ctx.lineTo(farR.x, farR.y);
  ctx.lineTo(farL.x, farL.y);
  ctx.closePath();
  ctx.fill();

  if (level.wet) {
    // Standing water catches the sky: a lighter streak down the centre.
    ctx.fillStyle = 'rgba(160,190,205,0.16)';
    const c1 = project(cam, 0, 0, zNear);
    const c2 = project(cam, 0, 0, zFar);
    ctx.beginPath();
    ctx.moveTo(c1.x - 6, c1.y);
    ctx.lineTo(c2.x - 2, c2.y);
    ctx.lineTo(c2.x + 2, c2.y);
    ctx.lineTo(c1.x + 6, c1.y);
    ctx.closePath();
    ctx.fill();
  }

  // Threshold stripes, anchored at the threshold, not at the aircraft.
  ctx.fillStyle = COLORS.marking;
  const stripeStart = Math.max(8, thresholdZ);
  const stripeEnd = Math.max(stripeStart + 20, thresholdZ + 100);
  for (let i = 0; i < 8; i++) {
    const x0 = -HALF_WIDTH_FT + 4 + i * ((HALF_WIDTH_FT * 2 - 8) / 8);
    const x1 = x0 + (HALF_WIDTH_FT * 2 - 8) / 8 - 4;
    quad(ctx, cam, x0, x1, stripeStart, stripeEnd);
  }

  // Centreline dashes, then the aiming point bars: "put the wheels here".
  ctx.fillStyle = COLORS.marking;
  for (let z = thresholdZ + 220; z + 120 < zFar; z += 320) {
    if (z < 8) continue;
    quad(ctx, cam, -2.5, 2.5, z, z + 120, 0.75);
  }

  const aimZ = thresholdZ + 1200;
  if (aimZ + 150 < zFar) {
    ctx.fillStyle = COLORS.marking;
    quad(ctx, cam, -26, -18, aimZ, aimZ + 150);
    quad(ctx, cam, 18, 26, aimZ, aimZ + 150);
  }

  // Edge lights.
  ctx.fillStyle = COLORS.edgeLight;
  for (let z = Math.max(8, thresholdZ); z < zFar; z += RUNWAY_EDGE_LIGHT_SPACING_FT) {
    for (const x of [-HALF_WIDTH_FT - 4, HALF_WIDTH_FT + 4]) {
      const p = project(cam, x, 0, z);
      const r = Math.max(1, Math.min(4, p.scale * 6));
      if (p.y > -20 && p.y < VIEW.windshieldBottom + 20) {
        ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      }
    }
  }
}

function drawApproachLights(ctx, cam, state, level) {
  const thresholdZ = state.distFt;

  // Centreline approach lights, before the threshold.
  for (let i = 1; i <= 7; i++) {
    const z = thresholdZ - i * APPROACH_LIGHT_SPACING_FT;
    if (z < 20) break;
    const w = 26;
    ctx.fillStyle = COLORS.edgeLight;
    quad(ctx, cam, -w / 2, w / 2, z, z + 26);
  }

  // PAPI: 4 boxes, left of the runway, one kilometre before the threshold.
  const papiZ = thresholdZ - 1000;
  if (papiZ > 30) {
    const whites = papiWhiteCount(state);
    for (let i = 0; i < 4; i++) {
      const p = project(cam, -HALF_WIDTH_FT - 46, 0, papiZ);
      const size = Math.max(2, Math.min(16, p.scale * 26));
      const x = p.x - size * 2.4 + i * size * 1.15;
      ctx.fillStyle = i < whites ? COLORS.papiWhite : COLORS.papiRed;
      ctx.fillRect(x - size / 2, p.y - size / 2, size * 0.85, size);
    }
  }
}

function drawFrame(ctx, w, h) {
  ctx.fillStyle = COLORS.frame;
  ctx.fillRect(0, 0, w, 12);
  ctx.fillRect(0, h - 26, w, 26);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(58, 0);
  ctx.lineTo(112, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w - 58, 0);
  ctx.lineTo(w - 112, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function quad(ctx, cam, x0, x1, z0, z1, alpha = 1) {
  const a = project(cam, x0, 0, z0);
  const b = project(cam, x1, 0, z0);
  const c = project(cam, x1, 0, z1);
  const d = project(cam, x0, 0, z1);
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  if (alpha < 1) ctx.globalAlpha = 1;
}
