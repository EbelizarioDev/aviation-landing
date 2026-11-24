// First person: the view from the pilot's seat, framed by the aircraft's own
// cockpit. The shell comes from the aircraft's visual module, so a C152 and an
// A380 do not share a window frame any more.

import { VIEW } from './layout.js';
import { paintExterior } from './scene.js';
import { getVisual } from './models/index.js';

export function drawCockpit(ctx, { state, aircraft, level, weather, t }) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.width, VIEW.windshieldBottom);
  ctx.clip();

  // rollWithBank is the whole point of the ailerons in first person: the eye
  // is fixed to the aircraft, so the world rotates about the windshield centre.
  paintExterior(ctx, { state, aircraft, level, weather, t }, {
    rollWithBank: true,
    pivotY: VIEW.windshieldBottom / 2,
  });
  getVisual(aircraft).drawCockpit(ctx, { state, aircraft, level, weather, t, view: VIEW });

  ctx.restore();
}
