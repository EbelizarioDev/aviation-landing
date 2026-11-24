// Airbus A380-800: four engines, two passenger decks, and no yoke.
//
// The cockpit is where this airframe stops being "a bigger jet": the control is
// a side-stick on the left, the flight deck is wide enough for a third zone, and
// four engine parameter columns sit across the bottom of the displays. From
// behind, the two window rows and the four nacelles are the whole story.

import { VIEW, COLORS } from '../layout.js';
import { poly, line, band, disc, rim, label, screen, wheel, vignette } from './shapes.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  interior: '#3a4048',
  interiorDark: '#242a31',
  shade: '#1c2228',
  frame: '#101418',
  frameLight: '#2a333b',
  trim: '#16263f',
  accent: '#8c98a2',
  belly: '#b9c2c8',
  bezel: '#080b0e',
};

export const a388 = {
  id: 'a388',

  signature: {
    engines: 4,
    wing: 'low',
    gear: 'retractable',
    tail: 'conventional',
    prop: 'none',
    decks: 2,
    winglets: 'none',
    cabinWindows: 9,
  },

  palette,

  drawCockpit(ctx, { state }) {
    // The A380 flight deck is wide: a deep header and long raked pillars.
    poly(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 46],
        [W - 190, 54],
        [W / 2, 44],
        [190, 54],
        [0, 46],
      ],
      { fill: palette.interiorDark, stroke: palette.frame, width: 2 },
    );

    poly(
      ctx,
      [
        [0, 40],
        [80, 54],
        [176, BOTTOM],
        [0, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );
    poly(
      ctx,
      [
        [W, 40],
        [W - 80, 54],
        [W - 176, BOTTOM],
        [W, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );

    band(ctx, 0, 40, 15, BOTTOM - 40, palette.frame);
    band(ctx, W - 15, 40, 15, BOTTOM - 40, palette.frame);

    for (const [x0, x1] of [
      [112, 176],
      [W - 112, W - 176],
    ]) {
      line(
        ctx,
        [
          [x0, BOTTOM],
          [x1, 240],
        ],
        { stroke: '#0c1013', width: 3 },
      );
    }

    const shieldTop = [
      [0, 288],
      [180, 298],
      [W / 2, 306],
      [W - 180, 298],
      [W, 288],
    ];
    poly(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], {
      fill: palette.shade,
      stroke: palette.frame,
      width: 2,
    });
    line(ctx, shieldTop, { stroke: palette.frameLight, width: 1 });

    // FCU: the row of pull/push knobs for speed, heading, altitude and rate.
    for (let i = 0; i < 5; i++) {
      band(ctx, 250 + i * 56, 288, 48, 14, '#0d1116');
      disc(ctx, 250 + i * 56 + 24, 295, 8, 5, '#39424a', '#6e7880', 1.5);
    }
    label(ctx, 'FCU', 250, 282, { size: 6, fill: '#9fb6c2' });

    // Six large displays plus a four-column engine page: four engines, so the
    // EICAS has one column per engine and the player can count them.
    const dy = 300;
    screen(ctx, { x: 166, y: dy, w: 66, h: 48, sky: '#22455c', ground: '#35463a', horizonAt: 0.46, title: 'PFD', value: '145' });
    screen(ctx, { x: 238, y: dy, w: 62, h: 48, sky: '#122c39', horizonAt: 0.5, tint: false, title: 'ND', value: 'LOC' });
    screen(ctx, { x: 306, y: dy, w: 62, h: 48, sky: '#122c39', horizonAt: 0.5, tint: false, title: 'ND', value: 'GS' });
    screen(ctx, { x: 374, y: dy, w: 66, h: 48, sky: '#22455c', ground: '#35463a', horizonAt: 0.46, title: 'PFD', value: '144' });
    screen(ctx, { x: 446, y: dy, w: 62, h: 48, sky: '#12262f', horizonAt: 0.5, tint: false, title: 'ECAM', value: '4 ENG' });
    for (let i = 0; i < 4; i++) {
      band(ctx, 446 + i * 15, dy + 30, 12, 18, '#0d1116');
      band(ctx, 448 + i * 15, dy + 38, 8, 6, i < 3 ? '#4cd07a' : '#f2b134');
    }

    // SIDE-STICK, on the left, and no yoke anywhere: the single clearest
    // difference between an Airbus flight deck and everything below it.
    poly(
      ctx,
      [
        [34, BOTTOM],
        [96, BOTTOM],
        [90, 330],
        [40, 330],
      ],
      { fill: '#191f25' },
    );
    poly(
      ctx,
      [
        [56, 330],
        [74, 330],
        [76, 286],
        [68, 282],
        [60, 284],
      ],
      { fill: '#1d242a', stroke: '#070a0c', width: 2 },
    );
    poly(
      ctx,
      [
        [60, 284],
        [68, 282],
        [70, 268],
        [62, 266],
      ],
      { fill: '#2b333a', stroke: '#070a0c', width: 2 },
    );
    label(ctx, 'SIDE STICK', 66, 344, { size: 6, fill: '#9fb6c2' });

    // Centre pedestal edge, wide enough to carry four thrust levers.
    poly(
      ctx,
      [
        [W / 2 - 120, BOTTOM],
        [W / 2 + 120, BOTTOM],
        [W / 2 + 96, 340],
        [W / 2 - 96, 340],
      ],
      { fill: '#161c22' },
    );
    for (let i = 0; i < 4; i++) {
      band(ctx, W / 2 - 72 + i * 40, 342, 6, 10, '#8f9aa2');
      disc(ctx, W / 2 - 69 + i * 40, 341, 7, 6, '#1b2024', '#070a0c', 1.5);
    }

    vignette(ctx, 0, 40, 15, BOTTOM - 40, 0.28);
    vignette(ctx, W - 15, 40, 15, BOTTOM - 40, 0.28);
  },

  drawExterior(ctx, { state, u }) {
    const gearDown = state.gearDown === true;

    // Enormous low wing, no winglets at all.
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [side * 0.10 * u, 0.14 * u],
          [side * 1.0 * u, -0.10 * u],
          [side * 1.0 * u, 0.0 * u],
          [side * 0.10 * u, 0.24 * u],
        ],
        { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
      );
      band(ctx, side * 1.0 * u - (side < 0 ? 0 : 6), -0.08 * u, 6, 4, side < 0 ? COLORS.red : COLORS.green);
    }

    // Four nacelles: inboard pair and outboard pair, spread wide.
    const stations = [-0.34, -0.68, 0.34, 0.68];
    for (const station of stations) {
      const x = station * u;
      disc(ctx, x, 0.0 * u, 0.13 * u, 0.30 * u, '#dde5ea', '#1d2226', 2);
      disc(ctx, x, -0.26 * u, 0.095 * u, 0.095 * u, '#10161b', '#1d2226', 1.5);
      disc(ctx, x, -0.26 * u, 0.04 * u, 0.04 * u, '#4a545c');
    }

    // The double-deck fuselage is the reason this airframe reads as huge: a
    // tall body with TWO window rows, not one.
    disc(ctx, 0, 0.12 * u, 0.21 * u, 0.80 * u, '#f6f8f9', '#1d2226', 2);
    poly(
      ctx,
      [
        [-0.21 * u, 0.40 * u],
        [0.21 * u, 0.40 * u],
        [0.16 * u, 0.90 * u],
        [-0.16 * u, 0.90 * u],
      ],
      { fill: palette.belly },
    );

    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const at = -0.44 + i * 0.14;
        for (const row of [0.0, 0.075]) {
          poly(
            ctx,
            [
              [side * 0.06 * u, (at + row) * u],
              [side * 0.18 * u, (at + row + 0.02) * u],
              [side * 0.18 * u, (at + row + 0.085) * u],
              [side * 0.06 * u, (at + row + 0.075) * u],
            ],
            { fill: COLORS.glass, stroke: '#1d2226', width: 1 },
          );
        }
      }
    }

    poly(
      ctx,
      [
        [0, 0.62 * u],
        [0.48 * u, 0.88 * u],
        [0.48 * u, 0.94 * u],
        [0, 0.80 * u],
        [-0.48 * u, 0.94 * u],
        [-0.48 * u, 0.88 * u],
      ],
      { fill: '#eef2f4', stroke: '#1d2226', width: 2 },
    );

    // Very tall fin with the navy tail livery.
    poly(
      ctx,
      [
        [-0.06 * u, 0.66 * u],
        [-0.04 * u, 0.02 * u],
        [0.04 * u, 0.02 * u],
        [0.06 * u, 0.66 * u],
      ],
      { fill: palette.trim, stroke: '#1d2226', width: 2 },
    );

    if (gearDown) {
      wheel(ctx, 0, -0.48 * u, 0.05 * u);
      // Main gear: two-axle bogies, so four wheels per leg, two legs a side.
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.26 * u, 0.20 * u],
            [side * 0.24 * u, 0.40 * u],
          ],
          { stroke: '#8f9aa2', width: 2 },
        );
        for (const along of [0.38, 0.46]) {
          wheel(ctx, side * 0.21 * u, along * u, 0.045 * u);
          wheel(ctx, side * 0.27 * u, along * u, 0.045 * u);
        }
      }
    } else {
      for (const side of [-1, 1]) {
        band(ctx, side * 0.26 * u - 0.06 * u, 0.20 * u, 0.12 * u, 0.05 * u, '#c6ced3');
      }
    }
  },
};
