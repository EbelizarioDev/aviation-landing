// Beechcraft King Air 350: low wing and a T-tail, two turboprops, retractable.
//
// The T-tail is the whole point of this silhouette: from behind, the horizontal
// stabiliser reads as a bar across the TOP of the fin, not as a wing at the
// bottom of the frame. That single difference is what separates it from the
// jets next to it on the ladder.

import { VIEW, COLORS } from '../layout.js';
import { poly, line, band, disc, rim, label, wheel, vignette } from './shapes.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  interior: '#4e5459',
  interiorDark: '#383d42',
  shade: '#2c3136',
  frame: '#191d21',
  frameLight: '#333b41',
  trim: '#1d2b45',
  gold: '#b9963f',
  belly: '#d3dbe0',
};

export const b350 = {
  id: 'b350',

  signature: {
    engines: 2,
    wing: 'low',
    gear: 'retractable',
    tail: 'T',
    prop: 'turboprop',
    decks: 1,
    winglets: 'none',
    cabinWindows: 3,
  },

  palette,

  drawCockpit(ctx, { state }) {
    // Corporate interior: dark, and the header comes down further than in a
    // trainer because the windshield is shorter and more raked.
    poly(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 34],
        [W - 220, 42],
        [W / 2, 36],
        [220, 42],
        [0, 34],
      ],
      { fill: palette.interiorDark, stroke: palette.frame, width: 2 },
    );

    // Swept pillars: the rake is what says "turboprop, not trainer".
    poly(
      ctx,
      [
        [0, 30],
        [62, 42],
        [140, BOTTOM],
        [0, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );
    poly(
      ctx,
      [
        [W, 30],
        [W - 62, 42],
        [W - 140, BOTTOM],
        [W, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );

    band(ctx, 0, 30, 12, BOTTOM - 30, palette.frame);
    band(ctx, W - 12, 30, 12, BOTTOM - 30, palette.frame);

    // Deep glareshield with an annunciator strip across it.
    const shieldTop = [
      [0, 300],
      [150, 310],
      [W / 2, 316],
      [W - 150, 310],
      [W, 300],
    ];
    poly(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], {
      fill: palette.shade,
      stroke: palette.frame,
      width: 2,
    });
    line(ctx, shieldTop, { stroke: palette.frameLight, width: 1 });

    // Master warning and caution lights: a row of dark squares, two of them lit.
    for (let i = 0; i < 8; i++) {
      const lit = i === 2 || i === 5;
      band(ctx, 300 + i * 34, 318, 28, 12, lit ? (i === 2 ? COLORS.amber : COLORS.red) : '#1d2223');
    }
    label(ctx, 'MASTER', 300, 336, { size: 6, fill: '#9aa4ab' });

    // Yoke, smaller and further away than the Cessna's.
    const yx = 400;
    poly(
      ctx,
      [
        [yx - 14, BOTTOM],
        [yx + 14, BOTTOM],
        [yx + 8, 306],
        [yx - 8, 306],
      ],
      { fill: '#141a1e', stroke: '#080b0d', width: 2 },
    );
    poly(
      ctx,
      [
        [yx - 62, 306],
        [yx + 62, 306],
        [yx + 62, 314],
        [yx - 62, 314],
      ],
      { fill: '#20262b', stroke: '#080b0d', width: 2 },
    );
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [yx + side * 62, 314],
          [yx + side * 55, 284],
          [yx + side * 69, 281],
          [yx + side * 76, 312],
        ],
        { fill: '#262d33', stroke: '#080b0d', width: 2 },
      );
    }

    // Four levers: two power, two prop. The King Air has two of everything.
    const names = ['PWR L', 'PROP L', 'PWR R', 'PROP R'];
    names.forEach((name, i) => {
      const x = 138 + i * 32;
      band(ctx, x - 2, 320, 4, 32, '#7d878e');
      disc(ctx, x, 320, 7, 6, i % 2 === 0 ? '#1b2024' : '#39434b', '#0a0d10', 1.5);
      label(ctx, name, x, 342, { size: 5.5, fill: '#e6ebee' });
    });

    vignette(ctx, 0, 30, 12, BOTTOM - 30, 0.22);
    vignette(ctx, W - 12, 30, 12, BOTTOM - 30, 0.22);
  },

  drawExterior(ctx, { state, u }) {
    const gearDown = state.gearDown === true;

    // Low wing: roots below the centre line, no struts anywhere.
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [side * 0.13 * u, 0.14 * u],
          [side * 1.0 * u, 0.10 * u],
          [side * 1.0 * u, 0.19 * u],
          [side * 0.13 * u, 0.22 * u],
        ],
        { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
      );
      band(ctx, side * 1.0 * u - (side < 0 ? 0 : 6), 0.12 * u, 6, 4, side < 0 ? COLORS.red : COLORS.green);
    }

    // Nacelles with prop discs, mounted on the wing.
    for (const side of [-1, 1]) {
      disc(ctx, side * 0.46 * u, 0.06 * u, 0.10 * u, 0.22 * u, '#dfe6ea', '#1d2226', 2);
      rim(ctx, side * 0.46 * u, -0.14 * u, 0.15 * u, 'rgba(230,238,244,0.55)', 2);
      disc(ctx, side * 0.46 * u, -0.14 * u, 0.15 * u, 0.15 * u, 'rgba(220,230,238,0.16)');
    }

    disc(ctx, 0, 0.12 * u, 0.17 * u, 0.60 * u, '#f6f8f9', '#1d2226', 2);

    // Livery: navy lower half with a gold cheatline.
    poly(
      ctx,
      [
        [-0.17 * u, 0.24 * u],
        [0.17 * u, 0.24 * u],
        [0.13 * u, 0.66 * u],
        [-0.13 * u, 0.66 * u],
      ],
      { fill: palette.trim },
    );
    poly(
      ctx,
      [
        [-0.17 * u, 0.20 * u],
        [-0.15 * u, 0.20 * u],
        [-0.11 * u, 0.66 * u],
        [-0.13 * u, 0.66 * u],
      ],
      { fill: palette.gold },
    );

    // Three small oval windows, as on the 350.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const at = -0.22 + i * 0.20;
        disc(ctx, side * 0.10 * u, at * u, 0.035 * u, 0.06 * u, COLORS.glass, '#1d2226', 1);
      }
    }

    // T-tail: the horizontal stabiliser sits ON TOP of the fin.
    poly(
      ctx,
      [
        [-0.055 * u, 0.36 * u],
        [0, -0.52 * u],
        [0.055 * u, 0.36 * u],
      ],
      { fill: palette.trim, stroke: '#1d2226', width: 2 },
    );
    poly(
      ctx,
      [
        [0, -0.56 * u],
        [0.44 * u, -0.44 * u],
        [0.44 * u, -0.37 * u],
        [0, -0.48 * u],
        [-0.44 * u, -0.37 * u],
        [-0.44 * u, -0.44 * u],
      ],
      { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
    );
    band(ctx, -0.02 * u, -0.70 * u, 0.04 * u, 0.14 * u, '#dfe6ea');

    if (gearDown) {
      wheel(ctx, 0, -0.34 * u, 0.05 * u);
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.30 * u, 0.16 * u],
            [side * 0.28 * u, 0.34 * u],
          ],
          { stroke: '#8f9aa2', width: 2 },
        );
        wheel(ctx, side * 0.28 * u, 0.36 * u, 0.06 * u);
      }
    } else {
      // Gear up: the doors are the honest detail, not a wheel.
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.30 * u, 0.16 * u],
            [side * 0.28 * u, 0.24 * u],
          ],
          { stroke: '#9aa4ab', width: 1.5 },
        );
      }
      line(
        ctx,
        [
          [0, -0.30 * u],
          [0, -0.22 * u],
        ],
        { stroke: '#9aa4ab', width: 1.5 },
      );
    }
  },
};
