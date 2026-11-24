// Third person: a chase camera sitting behind and above the aircraft, looking
// down the same runway axis. Same instruments, different place to look from.
//
// The camera is rigidly attached, so the aircraft holds a fixed position in
// frame and it is the world that moves. That is what makes attitude readable:
// pitch moves the horizon, steering banks the silhouette.
//
// The airframe itself is drawn by the aircraft's visual module; this file only
// decides where it sits, how big it is and how far it is rolled.

import { clamp } from '../physics.js';
import { VIEW, COLORS } from './layout.js';
import { PX_PER_DEG } from './projection.js';
import { paintExterior } from './scene.js';
import { getVisual } from './models/index.js';
import { drawModel, setAilerons } from './models/frame3d.js';

const CAMERA_HEIGHT_FT = 24;
const CAMERA_BEHIND_FT = 70;
const PX_PER_DEG_ROLL = 0.9;

// Span in pixels. Big enough that a trainer's struts, wheels and window count
// are readable at 960x600 without reading a label. The upper bound is set by the
// windshield: a model 390 px wide reaches roughly 190 px above its own centre,
// and any span much beyond that would push the fin out of frame.
const SPAN_BASE_PX = 240;
const SPAN_PER_MASS_PX = 150;
// Fraction of the span kept below the aircraft centre, so the tail end never
// runs off the bottom of the windshield and under the panel.
const BOTTOM_MARGIN = 0.44;

/** Where the aircraft silhouette sits in the windshield, and how big it is. */
export function aircraftScreenPose({ state, aircraft }) {
  const horizonY = VIEW.horizonBaseY + state.pitchDeg * PX_PER_DEG;
  const massFactor = clamp(aircraft.massT / 100, 0, 1);
  const span = SPAN_BASE_PX + SPAN_PER_MASS_PX * massFactor;
  return {
    x: VIEW.width / 2,
    y: VIEW.windshieldBottom - BOTTOM_MARGIN * span,
    horizonY,
    span,
    roll: clamp((state.bankDeg ?? 0) * PX_PER_DEG_ROLL * 2, -30, 30),
  };
}

export function drawChase(ctx, { state, aircraft, level, weather, t }) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.width, VIEW.windshieldBottom);
  ctx.clip();

  paintExterior(ctx, { state, aircraft, level, weather, t }, {
    altOffsetFt: CAMERA_HEIGHT_FT,
    zApronFt: CAMERA_BEHIND_FT,
  });

  const pose = aircraftScreenPose({ state, aircraft });
  const visual = getVisual(aircraft);

  if (visual.airframe) {
    setAilerons(visual.airframe, state.aileronCmd);
    // A real model, projected from 70 ft behind and 24 ft above: the tail is
    // nearest, the fuselage is foreshortened, and banking rolls the airframe
    // about its own axis. The anchor keeps it inside the windshield.
    drawModel(ctx, visual.airframe, {
      cx: pose.x,
      horizonY: pose.horizonY,
      anchorBottomY: VIEW.windshieldBottom - 4,
      rollDeg: state.bankDeg ?? 0,
    });
  } else {
    // Legacy flat models: placed on a fixed screen pose and rotated in 2D.
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate((pose.roll * Math.PI) / 180);
    visual.drawExterior(ctx, { state, aircraft, pose, u: pose.span / 2 });
    ctx.restore();
  }

  // On the ground, a contact line at the wheels. No flying shadow: a camera 24 ft
  // above the aircraft would put the ground under it off the bottom of the
  // windshield, so a shadow would be a lie. Height is the minimap's job.
  if (state.onGround) {
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(pose.x - pose.span / 2, pose.y + pose.span * 0.26, pose.span, 3);
  }

  ctx.restore();
}
