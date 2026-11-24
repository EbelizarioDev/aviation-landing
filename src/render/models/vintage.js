// The polygonal language: how every airframe is drawn from now on.
//
// The reference is the flat-shaded era of flight simulation (subLOGIC FS2 and
// the DOS FS4/FS5): an aircraft read as a handful of flat faces, each one a
// single solid colour chosen by how that face meets the light, with hard edges
// between them and a dark ink outline around the silhouette. No gradients, no
// soft shading, no transparency: if a surface is not flat, it is not drawn.
//
// Three rules keep it coherent:
//  1. one colour per face, never a gradient across a face;
//  2. every face that meets another gets an ink edge, so the shape reads as
//     built rather than painted;
//  3. a shape earns its facets from geometry: top face light, side faces mid,
//     under-surfaces dark. The ramp is per aircraft, the rule is global.

import { poly } from './shapes.js';

/** The outline colour used by every facet edge. */
export const INK = '#14181c';

/**
 * A flat face: solid fill plus hard ink edge. This is the only way an exterior
 * surface should be drawn.
 */
export function face(ctx, pts, fill, { outline = INK, width = 2 } = {}) {
  poly(ctx, pts, { fill, stroke: outline, width });
}

/** A face with no edge: used where two coplanar faces must read as one. */
export function plank(ctx, pts, fill) {
  poly(ctx, pts, { fill });
}

/** Thin structural member (strut, gear leg, pitot): a quad, never a line. */
export function strut(ctx, x1, y1, x2, y2, width, fill, outline = INK) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  face(
    ctx,
    [
      [x1 + nx, y1 + ny],
      [x2 + nx, y2 + ny],
      [x2 - nx, y2 - ny],
      [x1 - nx, y1 - ny],
    ],
    fill,
    { outline },
  );
}

/** Wheel as an octagon: a circle would be a lie about the polygon count. */
export function octWheel(ctx, cx, cy, r, fill = '#20252a', hub = '#7d878e') {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  face(ctx, pts, fill);
  const inner = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    inner.push([cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4]);
  }
  plank(ctx, inner, hub);
}

/**
 * A three-step ramp for one base colour: lit top, side in shadow, and the deep
 * shade used for under-surfaces. Aircraft modules pick their own ramp; the
 * steps are what make the facets legible.
 */
export function ramp(lit, side, deep) {
  return { lit, side, deep };
}

/**
 * Cockpit shell piece: same flat rule as the exterior, but the ink edge is
 * heavier so the frame still reads against a bright sky.
 */
export function shell(ctx, pts, fill, width = 3) {
  poly(ctx, pts, { fill, stroke: INK, width });
}

/** Flat cockpit panel (glareshield, console top): no outline on the long side. */
export function slab(ctx, x, y, w, h, fill, outline = INK) {
  poly(
    ctx,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    { fill, stroke: outline, width: 2 },
  );
}
