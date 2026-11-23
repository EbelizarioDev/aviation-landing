// A recording stand-in for CanvasRenderingContext2D: enough surface for the
// renderers, and it records what was drawn so "nothing threw" is not the only
// thing a test can assert.

import { VIEW } from '../../src/render/layout.js';

export function stubContext() {
  const ops = [];
  const gradient = { addColorStop() {} };
  const noop = () => {};
  const ctx = {
    ops,
    canvas: { width: VIEW.width, height: VIEW.height },
    fillStyle: '#000',
    strokeStyle: '#000',
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
    rect: noop,
    arc: noop,
    ellipse: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    clip: noop,
    fill: () => ops.push(['fill', ctx.fillStyle]),
    stroke: () => ops.push(['stroke']),
    fillRect: (x, y, w, h) => ops.push(['fillRect', x, y, w, h]),
    strokeRect: noop,
    fillText: (s, x, y) => ops.push(['fillText', String(s), x, y]),
    setLineDash: noop,
    createLinearGradient: () => gradient,
    measureText: (s) => ({ width: String(s).length * 8 }),
  };
  return ctx;
}

export function labels(ctx) {
  return ctx.ops.filter((op) => op[0] === 'fillText').map((op) => op[1]);
}
