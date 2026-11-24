// A recording stand-in for CanvasRenderingContext2D: enough surface for the
// renderers, and it records what was drawn so "nothing threw" is not the only
// thing a test can assert.
//
// It records every path and transform call with its numeric arguments, and it
// records style assignments through accessors. Both exist for one reason: a
// NaN coordinate or an undefined colour is invisible in a real canvas and
// silent in a stub that ignores arguments, but it is a broken frame.

import { VIEW } from '../../src/render/layout.js';

export function stubContext() {
  const ops = [];
  const gradient = { addColorStop() {} };
  const noop = () => {};
  const ctx = {
    ops,
    canvas: { width: VIEW.width, height: VIEW.height },
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: (x, y) => ops.push(['moveTo', x, y]),
    lineTo: (x, y) => ops.push(['lineTo', x, y]),
    rect: (x, y, w, h) => ops.push(['rect', x, y, w, h]),
    arc: (x, y, r, a0, a1) => ops.push(['arc', x, y, r, a0, a1]),
    ellipse: (x, y, rx, ry, rot, a0, a1) => ops.push(['ellipse', x, y, rx, ry, rot, a0, a1]),
    translate: (x, y) => ops.push(['translate', x, y]),
    rotate: (a) => ops.push(['rotate', a]),
    scale: (x, y) => ops.push(['scale', x, y]),
    clip: noop,
    fill: () => ops.push(['fill', ctx.fillStyle]),
    stroke: () => ops.push(['stroke', ctx.strokeStyle]),
    fillRect: (x, y, w, h) => ops.push(['fillRect', x, y, w, h]),
    strokeRect: (x, y, w, h) => ops.push(['strokeRect', x, y, w, h]),
    fillText: (s, x, y) => ops.push(['fillText', String(s), x, y]),
    setLineDash: noop,
    createLinearGradient: () => gradient,
    measureText: (s) => ({ width: String(s).length * 8 }),
  };

  // Styles are recorded, because a missing palette entry arrives here as
  // `undefined` and would silently paint black in a browser. A gradient is
  // recorded as a marker, not as the object: two gradients are never reference
  // equal, and comparing two frames must not fail on that.
  const recordable = (v) => (v && typeof v === 'object' ? '[gradient]' : v);
  let fillStyle = '#000';
  let strokeStyle = '#000';
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => recordable(fillStyle),
    set: (v) => {
      fillStyle = v;
      ops.push(['fillStyle', recordable(v)]);
    },
  });
  Object.defineProperty(ctx, 'strokeStyle', {
    get: () => recordable(strokeStyle),
    set: (v) => {
      strokeStyle = v;
      ops.push(['strokeStyle', recordable(v)]);
    },
  });

  return ctx;
}

export function labels(ctx) {
  return ctx.ops.filter((op) => op[0] === 'fillText').map((op) => op[1]);
}

/** Operations carrying a non-finite number or a missing value. */
export function invalidOps(ctx) {
  const bad = [];
  for (const op of ctx.ops) {
    for (const arg of op.slice(1)) {
      const broken =
        arg === undefined ||
        (typeof arg === 'number' && !Number.isFinite(arg)) ||
        (typeof arg === 'string' && (arg === 'undefined' || arg === 'NaN' || arg.includes('NaN')));
      if (broken) {
        bad.push(op);
        break;
      }
    }
  }
  return bad;
}

/**
 * The lowest point anything was drawn at. Used to prove a cockpit shell never
 * paints over the graded instrument panel below the windshield.
 */
export function lowestDrawnY(ctx) {
  let lowest = -Infinity;
  for (const op of ctx.ops) {
    const [, a, b, c, d] = op;
    switch (op[0]) {
      case 'moveTo':
      case 'lineTo':
      case 'arc':
      case 'ellipse':
      case 'translate':
        lowest = Math.max(lowest, b);
        break;
      case 'fillRect':
      case 'strokeRect':
      case 'rect':
        lowest = Math.max(lowest, b + d);
        break;
      default:
        break;
    }
  }
  return lowest;
}
