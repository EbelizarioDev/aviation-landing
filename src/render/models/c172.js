// Cessna 172S: same family as the 152, bigger cabin, two windows a side.
//
// A pilot should be able to tell them apart without reading a label, so the
// differences are geometric, not cosmetic: a longer fuselage, a wider cabin,
// a second cabin window per side and a little more wingspan.

import { VIEW, COLORS } from '../layout.js';
import { poly, line, band, disc, rim, label, wheel, vignette } from './shapes.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  interior: '#8b8b86',
  interiorDark: '#63635f',
  shade: '#4d4d49',
  frame: '#22272b',
  frameLight: '#414a50',
  trim: '#2f6ea8',
  belly: '#c3cdd4',
};

export const c172 = {
  id: 'c172',

  signature: {
    engines: 1,
    wing: 'high',
    gear: 'fixed',
    tail: 'conventional',
    prop: 'tractor',
    decks: 1,
    winglets: 'none',
    cabinWindows: 2,
  },

  palette,

  drawCockpit(ctx, { state }) {
    // Deeper header than the C152: the 172 has more roof above the pilot.
    poly(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 27],
        [W - 240, 33],
        [W / 2, 27],
        [240, 33],
        [0, 27],
      ],
      { fill: palette.interiorDark, stroke: palette.frame, width: 2 },
    );

    // Sun visors on the header: a 172 cabin is wide enough to have them.
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [W / 2 + side * 40, 26],
          [W / 2 + side * 250, 31],
          [W / 2 + side * 250, 46],
          [W / 2 + side * 40, 40],
        ],
        { fill: '#2a2f34' },
      );
    }

    // A-pillars, set wider apart than the C152 so the cabin reads as roomier.
    poly(
      ctx,
      [
        [0, 24],
        [44, 28],
        [96, BOTTOM],
        [0, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );
    poly(
      ctx,
      [
        [W, 24],
        [W - 44, 28],
        [W - 96, BOTTOM],
        [W, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );

    band(ctx, 0, 24, 11, BOTTOM - 24, palette.frame);
    band(ctx, W - 11, 24, 11, BOTTOM - 24, palette.frame);

    // Glareshield, shallower than the trainer's because the panel is deeper.
    const shieldTop = [
      [0, 311],
      [130, 317],
      [W / 2, 321],
      [W - 130, 317],
      [W, 311],
    ];
    poly(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], {
      fill: palette.shade,
      stroke: palette.frame,
      width: 2,
    });
    line(ctx, shieldTop, { stroke: palette.frameLight, width: 1 });

    // Yoke: same two-horn shape as the 152, sitting slightly lower because the
    // pilot sits further from the panel in the wider cabin.
    const yx = 396;
    poly(
      ctx,
      [
        [yx - 15, BOTTOM],
        [yx + 15, BOTTOM],
        [yx + 8, 296],
        [yx - 8, 296],
      ],
      { fill: palette.frame, stroke: '#0a0d10', width: 2 },
    );
    poly(
      ctx,
      [
        [yx - 70, 296],
        [yx + 70, 296],
        [yx + 70, 305],
        [yx - 70, 305],
      ],
      { fill: '#1b2024', stroke: '#0a0d10', width: 2 },
    );
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [yx + side * 70, 305],
          [yx + side * 62, 268],
          [yx + side * 78, 264],
          [yx + side * 86, 303],
        ],
        { fill: '#242a2f', stroke: '#0a0d10', width: 2 },
      );
    }

    // Throttle and mixture, low left.
    for (const [i, fill] of ['#1b2024', '#3c4349'].entries()) {
      band(ctx, 158 + i * 31 - 2, 338, 4, 14, '#8f9aa2');
      disc(ctx, 158 + i * 31, 334, 8, 6, fill, '#0a0d10', 1.5);
      label(ctx, i === 0 ? 'THR' : 'MIX', 158 + i * 31, 346, { size: 6, fill: '#c6ced3' });
    }

    vignette(ctx, 0, 24, 11, BOTTOM - 24, 0.18);
    vignette(ctx, W - 11, 24, 11, BOTTOM - 24, 0.18);
  },

  drawExterior(ctx, { state, u }) {
    // Fixed gear: always down, whatever the panel says.
    const gearDown = true;

    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [side * 0.13 * u, -0.12 * u],
          [side * 1.0 * u, 0.0 * u],
          [side * 1.0 * u, 0.09 * u],
          [side * 0.13 * u, 0.03 * u],
        ],
        { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
      );
      line(
        ctx,
        [
          [side * 0.60 * u, 0.05 * u],
          [side * 0.14 * u, 0.32 * u],
        ],
        { stroke: '#9aa4ab', width: 2 },
      );
      band(ctx, side * 1.0 * u - (side < 0 ? 0 : 6), 0.01 * u, 6, 4, side < 0 ? COLORS.red : COLORS.green);
    }

    // Longer fuselage than the 152, and a lighter belly.
    disc(ctx, 0, 0.10 * u, 0.19 * u, 0.60 * u, '#f6f8f9', '#1d2226', 2);
    poly(
      ctx,
      [
        [-0.17 * u, -0.26 * u],
        [-0.07 * u, -0.26 * u],
        [-0.07 * u, 0.60 * u],
        [-0.17 * u, 0.58 * u],
      ],
      { fill: palette.trim },
    );
    poly(
      ctx,
      [
        [-0.15 * u, 0.18 * u],
        [0.15 * u, 0.18 * u],
        [0.12 * u, 0.62 * u],
        [-0.12 * u, 0.62 * u],
      ],
      { fill: palette.belly },
    );

    // Two cabin windows per side: the shape difference from the C152.
    for (const side of [-1, 1]) {
      for (const at of [-0.18, 0.06]) {
        poly(
          ctx,
          [
            [side * 0.07 * u, at * u],
            [side * 0.17 * u, (at + 0.03) * u],
            [side * 0.17 * u, (at + 0.15) * u],
            [side * 0.07 * u, (at + 0.14) * u],
          ],
          { fill: COLORS.glass, stroke: '#1d2226', width: 1 },
        );
      }
    }

    poly(
      ctx,
      [
        [0, 0.46 * u],
        [0.48 * u, 0.74 * u],
        [0.48 * u, 0.80 * u],
        [0, 0.64 * u],
        [-0.48 * u, 0.80 * u],
        [-0.48 * u, 0.74 * u],
      ],
      { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
    );

    poly(
      ctx,
      [
        [-0.055 * u, 0.36 * u],
        [0, -0.14 * u],
        [0.055 * u, 0.36 * u],
      ],
      { fill: palette.trim, stroke: '#1d2226', width: 2 },
    );

    rim(ctx, 0, -0.50 * u, 0.16 * u, 'rgba(230,238,244,0.55)', 2);
    disc(ctx, 0, -0.50 * u, 0.16 * u, 0.16 * u, 'rgba(220,230,238,0.16)');

    if (gearDown) {
      wheel(ctx, 0, -0.38 * u, 0.05 * u);
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.32 * u, 0.07 * u],
            [side * 0.30 * u, 0.28 * u],
          ],
          { stroke: '#8f9aa2', width: 2 },
        );
        wheel(ctx, side * 0.30 * u, 0.30 * u, 0.06 * u);
      }
    }
  },
};
