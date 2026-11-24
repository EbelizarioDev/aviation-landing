// Vintage 3D: an airframe is a list of flat faces in feet, projected through the
// same pinhole camera as the runway.
//
// This exists because a 2D silhouette drawn side-on or in plan view cannot show
// what the chase camera actually sees. From 70 ft behind and 24 ft above, a
// 24-ft aircraft is foreshortened to about a third of its length: it reads wide
// and short, tail nearest, nose furthest. That foreshortening is geometry, not
// art direction, so it comes from a projection and not from hand-placed points.
//
// The polygonal look is a consequence of the model being low-poly and every face
// declared with one flat colour. No lighting model, no gradients: the author
// picks the colour of each face, exactly as the flat-shaded era did.

import { INK } from './vintage.js';

// Local camera: the eye sits this far above the wheels and this far behind the
// aircraft's centre, matching the chase view in chase.js.
export const CAM_HEIGHT_FT = 24;
export const CAM_BEHIND_FT = 70;

/** Full-travel aileron deflection, in degrees. Real travel is roughly this. */
export const MAX_AILERON_DEG = 14;

/**
 * Travel is exaggerated on screen. At true scale a 14 degree deflection on a
 * 2 ft aileron moves the trailing edge about 3 px, which is invisible: the
 * surfaces have to be readable or the stick feels disconnected from the model.
 */
export const VISUAL_TRAVEL = 3;

/**
 * Register a control surface: the vertices that move when it is deflected.
 * `dir` is +1 on the right wing and -1 on the left, because ailerons move in
 * opposition: rolling right raises the right one and lowers the left.
 */
export function hinge(m, surface) {
  (m.hinges ??= []).push(surface);
  return m;
}

/**
 * Deflect every hingeable surface for the current stick position.
 * command: -1 full left .. 0 neutral .. +1 full right.
 * Applied absolutely from the stored base height, never incrementally, so the
 * model can be mutated every frame without drifting.
 */
export function setAilerons(m, command) {
  if (!m.hinges) return;
  const cmd = Math.max(-1, Math.min(1, command ?? 0));
  for (const h of m.hinges) {
    const deg = h.dir * cmd * MAX_AILERON_DEG;
    const dy = Math.sin((deg * Math.PI) / 180) * h.chord * VISUAL_TRAVEL;
    for (const vi of h.trail) m.verts[vi][1] = h.baseY + dy;
  }
}

/** An empty model: vertices and flat faces. */
export function model() {
  return { verts: [], faces: [] };
}

/**
 * One flat face. Vertices are [x, y, z] in feet: x to the right, y up from the
 * wheels, z forward along the runway axis (larger z is further from the camera).
 */
export function faceAt(m, color, pts, options = {}) {
  const v = [];
  for (const p of pts) {
    v.push(m.verts.length);
    m.verts.push(p);
  }
  m.faces.push({ v, color, edge: options.edge ?? INK, width: options.width ?? 2 });
  return m;
}

/** Six faces of an axis-aligned box. Cheapest way to build a faceted airframe. */
export function box(
  m,
  { x = 0, y = 0, z = 0, w, h, d, top, side, bottom, front, back },
  options = {},
) {
  const [x0, x1] = [x - w / 2, x + w / 2];
  const [y0, y1] = [y, y + h];
  const [z0, z1] = [z, z + d];
  const sideColor = side ?? top;
  // Order matters when two faces share a depth: the top is pushed last so it
  // wins the painter's sort against the bottom of the same box.
  faceAt(m, bottom ?? sideColor, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], options);
  faceAt(m, sideColor, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], options);
  faceAt(m, sideColor, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], options);
  faceAt(m, front ?? sideColor, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], options);
  faceAt(m, back ?? sideColor, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], options);
  faceAt(m, top, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], options);
  return m;
}

/**
 * A tapered tube: a ring of cross-sections connected by quads. This is how a
 * fuselage gets its facets without a single curve.
 * rings: [{ z, hw, y0, y1 }] ordered nose (far) to tail (near).
 */
export function hull(m, rings, colors, stripe) {
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    // Bottom first, then sides, then top: painter's order for equal depths.
    faceAt(m, colors.bottom, [
      [-a.hw, a.y0, a.z],
      [a.hw, a.y0, a.z],
      [b.hw, b.y0, b.z],
      [-b.hw, b.y0, b.z],
    ]);
    for (const side of [-1, 1]) {
      // Sides are split at the stripe height, which is how a cheatline is drawn
      // on a box: two flat faces instead of a texture.
      faceAt(m, colors.lower, [
        [side * a.hw, a.y0, a.z],
        [side * b.hw, b.y0, b.z],
        [side * b.hw, stripe, b.z],
        [side * a.hw, stripe, a.z],
      ]);
      faceAt(m, colors.upper, [
        [side * a.hw, stripe, a.z],
        [side * b.hw, stripe, b.z],
        [side * b.hw, b.y1, b.z],
        [side * a.hw, a.y1, a.z],
      ]);
    }
    faceAt(m, colors.top, [
      [-a.hw, a.y1, a.z],
      [a.hw, a.y1, a.z],
      [b.hw, b.y1, b.z],
      [-b.hw, b.y1, b.z],
    ]);
  }
  return m;
}

/**
 * Draw a model as the chase camera sees it.
 *
 * The projected shape is then translated on screen so the model stays fully
 * inside the windshield: a rigid translation preserves the foreshortening that
 * makes the view honest, while the placement stays a game decision.
 *
 * rollDeg rotates the airframe about its own longitudinal axis, so a banked
 * aircraft shows a banked silhouette from behind.
 */
export function drawModel(ctx, m, options) {
  const {
    cx,
    horizonY,
    anchorBottomY,
    rollDeg = 0,
    pivotY = 2,
    camHeightFt = CAM_HEIGHT_FT,
    focal = 520,
  } = options;

  // Model space has y up; the screen has y down. A positive canvas rotation is
  // therefore clockwise on screen while a positive rotation here is the other
  // way round, so the bank angle is negated: bankDeg > 0 (right bank) must put
  // the right wingtip LOW on screen, exactly as the 2-D legacy models did.
  const rot = (-rollDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  // Project every vertex once. Roll happens in 3D, before perspective.
  const screen = m.verts.map(([x, y, z]) => {
    const dy = y - pivotY;
    const xr = x * cos - dy * sin;
    const yr = x * sin + dy * cos + pivotY;
    const depth = Math.max(6, z);
    return {
      x: cx + (xr * focal) / depth,
      y: horizonY + ((camHeightFt - yr) * focal) / depth,
      depth,
    };
  });

  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of screen) {
    if (p.y > maxY) maxY = p.y;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  const shiftX = cx - (minX + maxX) / 2;
  const shiftY = anchorBottomY - maxY;

  // Painter's algorithm: furthest face first. Depth is the face's mean z.
  const order = m.faces
    .map((f, i) => ({
      i,
      depth: f.v.reduce((sum, vi) => sum + screen[vi].depth, 0) / f.v.length,
    }))
    .sort((a, b) => b.depth - a.depth);

  for (const { i } of order) {
    const face = m.faces[i];
    ctx.beginPath();
    for (let k = 0; k < face.v.length; k++) {
      const p = screen[face.v[k]];
      const x = p.x + shiftX;
      const y = p.y + shiftY;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    if (face.edge) {
      ctx.strokeStyle = face.edge;
      ctx.lineWidth = face.width;
      ctx.stroke();
    }
  }

  return {
    width: maxX - minX,
    height: maxY - Math.min(...screen.map((p) => p.y)),
  };
}
