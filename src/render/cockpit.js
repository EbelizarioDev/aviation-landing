// First person: the view from the pilot's seat, framed by the windshield.

import { VIEW } from './layout.js';
import { paintExterior, drawWindshieldFrame } from './scene.js';

export function drawCockpit(ctx, { state, aircraft, level }) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.width, VIEW.windshieldBottom);
  ctx.clip();

  paintExterior(ctx, { state, aircraft, level });
  drawWindshieldFrame(ctx);

  ctx.restore();
}
