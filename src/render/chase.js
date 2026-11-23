// Third person: a chase camera sitting behind and above the aircraft, looking
// down the same runway axis. Same instruments, different place to look from.
//
// The camera is rigidly attached, so the aircraft holds a fixed position in
// frame and it is the world that moves. That is what makes attitude readable:
// pitch moves the horizon, steering banks the silhouette.

import { clamp } from '../physics.js';
import { VIEW, COLORS } from './layout.js';
import { PX_PER_DEG } from './projection.js';
import { paintExterior } from './scene.js';

const CAMERA_HEIGHT_FT = 24;
const CAMERA_BEHIND_FT = 70;
const PX_PER_DEG_ROLL = 0.9;

/** Where the aircraft silhouette sits in the windshield, and how big it is. */
export function aircraftScreenPose({ state, aircraft }) {
  const horizonY = VIEW.horizonBaseY + state.pitchDeg * PX_PER_DEG;
  const massFactor = clamp(aircraft.massT / 100, 0, 1);
  return {
    x: VIEW.width / 2,
    y: VIEW.windshieldBottom - 70,
    horizonY,
    span: 64 + 60 * massFactor,
    roll: clamp((state.bankDeg ?? 0) * PX_PER_DEG_ROLL * 2, -30, 30),
  };
}

export function drawChase(ctx, { state, aircraft, level }) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.width, VIEW.windshieldBottom);
  ctx.clip();

  paintExterior(ctx, { state, aircraft, level }, {
    altOffsetFt: CAMERA_HEIGHT_FT,
    zApronFt: CAMERA_BEHIND_FT,
  });
  drawAircraft(ctx, { state, aircraft });

  ctx.restore();
}

function drawAircraft(ctx, { state, aircraft }) {
  const pose = aircraftScreenPose({ state, aircraft });
  const half = pose.span / 2;
  const onGround = Boolean(state.onGround);

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate((pose.roll * Math.PI) / 180);

  const body = onGround ? '#c9d1d6' : '#dfe5e9';
  const shade = '#9aa4ab';
  const outline = '#1d2226';
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;

  // Wings, swept back a little so the shape reads from behind.
  ctx.fillStyle = body;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * half * 0.16, -half * 0.1);
    ctx.lineTo(side * half, half * 0.1);
    ctx.lineTo(side * half * 0.94, half * 0.2);
    ctx.lineTo(side * half * 0.16, half * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Engines under the wings: one, two or four per airframe.
  ctx.fillStyle = shade;
  const engines = aircraft.engines ?? 2;
  const stations =
    engines >= 4
      ? [-0.58, -0.32, 0.32, 0.58]
      : engines === 2
        ? [-0.42, 0.42]
        : [0];
  for (const station of stations) {
    const ex = station * half;
    const ey = half * 0.16;
    ctx.beginPath();
    ctx.ellipse(ex, ey, half * 0.09, half * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Horizontal stabiliser, nearest to the camera at the bottom of the frame.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, half * 0.34);
  ctx.lineTo(half * 0.44, half * 0.62);
  ctx.lineTo(half * 0.44, half * 0.68);
  ctx.lineTo(0, half * 0.5);
  ctx.lineTo(-half * 0.44, half * 0.68);
  ctx.lineTo(-half * 0.44, half * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Vertical fin.
  ctx.beginPath();
  ctx.moveTo(-half * 0.05, -half * 0.28);
  ctx.lineTo(0, -half * 0.78);
  ctx.lineTo(half * 0.05, -half * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fuselage.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, half * 0.06, half * 0.19, half * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Nav lights: red left, green right. Cheap, and they fix orientation at a glance.
  ctx.fillStyle = '#e2402f';
  ctx.fillRect(-half - 2, half * 0.08, 5, 4);
  ctx.fillStyle = '#4cd07a';
  ctx.fillRect(half - 3, half * 0.08, 5, 4);

  ctx.restore();

  // On the ground, a contact line at the wheels. No flying shadow: a camera 24 ft
  // above the aircraft would put the ground under it off the bottom of the
  // windshield, so a shadow would be a lie. Height is the minimap's job.
  if (onGround) {
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(pose.x - half, pose.y + half * 0.52, half * 2, 3);
  }
}
