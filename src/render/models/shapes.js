// Drawing primitives shared by every per-aircraft visual.
//
// Two rules, both enforced by the test harness:
//  - only operations Canvas 2D and the canvas stub both implement: no
//    quadraticCurveTo, bezierCurveTo, arcTo, roundRect or drawImage, which
//    throw in tests and are therefore never exercised;
//  - everything takes explicit colours, so a missing palette entry shows up as
//    `undefined` in the stub instead of silently painting black.
//
// Units are pixels, origin is whatever the caller translated to.

/** Filled and/or stroked closed polygon from [[x, y], ...]. */
export function poly(ctx, pts, { fill, stroke, width = 2 } = {}) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

/** Open polyline: a strut, a seam, a cable. */
export function line(ctx, pts, { stroke, width = 2 } = {}) {
  if (pts.length < 2 || !stroke) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Axis-aligned rectangle, the workhorse for frames and panels. */
export function band(ctx, x, y, w, h, fill) {
  if (!fill) return;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

/** Linear gradient fill over a rectangle. */
export function wash(ctx, x, y, w, h, stops) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/** Filled ellipse, the only "curve" available. */
export function disc(ctx, cx, cy, rx, ry = rx, fill, stroke, width = 2) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

/** Circle outline: gauge faces, windows, wheels. */
export function rim(ctx, cx, cy, r, stroke, width = 2) {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

const WEIGHTS = { normal: '400', semibold: '600', bold: '700' };

/** Small label: placards, panel legends, glass-display titles. */
export function label(ctx, str, x, y, opts = {}) {
  const size = opts.size ?? 9;
  ctx.fillStyle = opts.fill ?? '#cfd8dc';
  ctx.font = `${WEIGHTS[opts.weight ?? 'semibold']} ${size}px system-ui, sans-serif`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.fillText(str, x, y);
}

/**
 * Analog gauge, seen from the pilot's seat: round face, tick marks and one
 * needle. The cockpit shell owns the *style* of the instrument; the graded
 * values live on the panel below, so these are decorative but not lies: the
 * needle follows the value it is given.
 */
export function dial(ctx, o) {
  const { cx, cy, r } = o;
  const face = o.face ?? '#11161a';
  const rimColor = o.rim ?? '#8f9aa2';
  disc(ctx, cx, cy, r, r, face, rimColor, 2);
  const ticks = o.ticks ?? 8;
  for (let i = 0; i < ticks; i++) {
    const a = Math.PI * 0.75 + (i / (ticks - 1)) * Math.PI * 1.5;
    const inner = r * 0.72;
    line(
      ctx,
      [
        [cx + Math.cos(a) * inner, cy + Math.sin(a) * inner],
        [cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92],
      ],
      { stroke: o.tick ?? '#c6ced3', width: 1 },
    );
  }
  const t = clamp01(o.at ?? 0.5);
  const angle = Math.PI * 0.75 + t * Math.PI * 1.5;
  line(
    ctx,
    [
      [cx, cy],
      [cx + Math.cos(angle) * r * 0.78, cy + Math.sin(angle) * r * 0.78],
    ],
    { stroke: o.needle ?? '#f2b134', width: 2 },
  );
  disc(ctx, cx, cy, r * 0.1, r * 0.1, rimColor);
  if (o.caption) label(ctx, o.caption, cx, cy + r * 0.62, { size: o.captionSize ?? 7, fill: '#9aa4ab' });
}

/**
 * Glass display: a lit rectangle inside a bezel. `tint` is the synthetic
 * horizon the display draws, so a glass cockpit still looks like a glass
 * cockpit rather than a blue rectangle.
 */
export function screen(ctx, o) {
  const { x, y, w, h } = o;
  band(ctx, x - 2, y - 2, w + 4, h + 4, o.bezel ?? '#0b0f12');
  band(ctx, x, y, w, h, o.fill ?? '#0d1a20');
  if (o.tint !== false) {
    const split = y + h * (o.horizonAt ?? 0.5);
    band(ctx, x, y, w, split - y, o.sky ?? '#2b5d7d');
    band(ctx, x, split, w, y + h - split, o.ground ?? '#3f4a37');
    band(ctx, x, split - 0.5, w, 1, '#cfd8dc');
  }
  if (o.title) label(ctx, o.title, x + w / 2, y + h * 0.12, { size: o.titleSize ?? 6, fill: '#8fb3c2' });
  if (o.value) label(ctx, o.value, x + w / 2, y + h * 0.86, { size: o.valueSize ?? 9, fill: '#5ad1e8' });
}

/** Propeller disc: a translucent swept circle plus two blade arcs. */
export function propDisc(ctx, cx, cy, r, color = 'rgba(220,230,238,0.20)') {
  disc(ctx, cx, cy, r, r, color);
  rim(ctx, cx, cy, r, 'rgba(230,238,244,0.45)', 2);
  disc(ctx, cx, cy, r * 0.16, r * 0.16, '#2a3037');
}

/** Landing-gear wheel, drawn as a dark disc plus a hub highlight. */
export function wheel(ctx, cx, cy, r, fill = '#12161a', hub = '#6e7880') {
  disc(ctx, cx, cy, r, r, fill, '#0a0d10', 1.5);
  disc(ctx, cx, cy, r * 0.34, r * 0.34, hub);
}

/** Translucent interior shadow: cheap depth without a gradient per shape. */
export function vignette(ctx, x, y, w, h, alpha = 0.28) {
  ctx.globalAlpha = alpha;
  band(ctx, x, y, w, h, '#05070a');
  ctx.globalAlpha = 1;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
