// Cessna 208B Grand Caravan: high wing, one turboprop, and a cargo pod.
//
// The pod and the tall fin are what make this silhouette unlike the two Cessnas
// next to it on the ladder; the three-lever quadrant is what makes the cockpit
// unlike them.

import { VIEW, COLORS } from '../layout.js';
import { poly, line, band, disc, rim, label, wheel, vignette } from './shapes.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  interior: '#84898d',
  interiorDark: '#5c6165',
  shade: '#474c50',
  frame: '#1f2428',
  frameLight: '#3c454b',
  trim: '#1f3d63',
  accent: '#b03a2e',
  pod: '#a7b0b6',
};

export const c208 = {
  id: 'c208',

  signature: {
    engines: 1,
    wing: 'high',
    gear: 'fixed',
    tail: 'conventional',
    prop: 'turboprop',
    decks: 1,
    winglets: 'none',
    cabinWindows: 4,
  },

  palette,

  drawCockpit(ctx, { state }) {
    poly(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 30],
        [W - 230, 36],
        [W / 2, 30],
        [230, 36],
        [0, 30],
      ],
      { fill: palette.interiorDark, stroke: palette.frame, width: 2 },
    );

    // Utility cabin: fatter pillars, less trim, a working aircraft.
    poly(
      ctx,
      [
        [0, 27],
        [58, 32],
        [118, BOTTOM],
        [0, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );
    poly(
      ctx,
      [
        [W, 27],
        [W - 58, 32],
        [W - 118, BOTTOM],
        [W, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );

    band(ctx, 0, 27, 12, BOTTOM - 27, palette.frame);
    band(ctx, W - 12, 27, 12, BOTTOM - 27, palette.frame);

    const shieldTop = [
      [0, 314],
      [140, 320],
      [W / 2, 324],
      [W - 140, 320],
      [W, 314],
    ];
    poly(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], {
      fill: palette.shade,
      stroke: palette.frame,
      width: 2,
    });
    line(ctx, shieldTop, { stroke: palette.frameLight, width: 1 });

    // Torque and ITT gauge hints on the captain's side of the glareshield: the
    // measurements a PT6 pilot actually watches.
    disc(ctx, 96, 330, 15, 11, '#11161a', '#8f9aa2', 2);
    disc(ctx, 132, 330, 15, 11, '#11161a', '#8f9aa2', 2);
    label(ctx, 'TRQ', 96, 344, { size: 6, fill: '#c6ced3' });
    label(ctx, 'ITT', 132, 344, { size: 6, fill: '#c6ced3' });

    // Yoke: further from the eye than in the Cessnas, because the panel is deeper.
    const yx = 388;
    poly(
      ctx,
      [
        [yx - 13, BOTTOM],
        [yx + 13, BOTTOM],
        [yx + 7, 304],
        [yx - 7, 304],
      ],
      { fill: palette.frame, stroke: '#0a0d10', width: 2 },
    );
    poly(
      ctx,
      [
        [yx - 60, 304],
        [yx + 60, 304],
        [yx + 60, 312],
        [yx - 60, 312],
      ],
      { fill: '#1b2024', stroke: '#0a0d10', width: 2 },
    );
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [yx + side * 60, 312],
          [yx + side * 53, 280],
          [yx + side * 67, 276],
          [yx + side * 74, 310],
        ],
        { fill: '#242a2f', stroke: '#0a0d10', width: 2 },
      );
    }

    // Three levers: power, prop, condition. Turboprop, unmistakably.
    const levers = [
      ['PWR', '#1b2024'],
      ['PROP', '#2f3a42'],
      ['COND', '#3c4349'],
    ];
    levers.forEach(([name, fill], i) => {
      const x = 150 + i * 34;
      band(ctx, x - 2, 322, 4, 30, '#8f9aa2');
      disc(ctx, x, 322 + i * 2, 7, 6, fill, '#0a0d10', 1.5);
      label(ctx, name, x, 344, { size: 6, fill: '#e6ebee' });
    });

    vignette(ctx, 0, 27, 12, BOTTOM - 27, 0.18);
    vignette(ctx, W - 12, 27, 12, BOTTOM - 27, 0.18);
  },

  drawExterior(ctx, { state, u }) {
    // Fixed gear: always down, whatever the panel says.
    const gearDown = true;

    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [side * 0.12 * u, -0.14 * u],
          [side * 1.02 * u, -0.02 * u],
          [side * 1.02 * u, 0.07 * u],
          [side * 0.12 * u, 0.01 * u],
        ],
        { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
      );
      line(
        ctx,
        [
          [side * 0.62 * u, 0.03 * u],
          [side * 0.13 * u, 0.34 * u],
        ],
        { stroke: '#9aa4ab', width: 2 },
      );
      band(ctx, side * 1.02 * u - (side < 0 ? 0 : 6), -0.01 * u, 6, 4, side < 0 ? COLORS.red : COLORS.green);
    }

    // Long fuselage for a single: this is the aircraft that carries a pallet.
    disc(ctx, 0, 0.12 * u, 0.18 * u, 0.72 * u, '#f6f8f9', '#1d2226', 2);

    // Cargo pod under the belly, the signature Caravan bulge.
    poly(
      ctx,
      [
        [-0.20 * u, 0.10 * u],
        [0.20 * u, 0.10 * u],
        [0.24 * u, 0.62 * u],
        [-0.24 * u, 0.62 * u],
      ],
      { fill: palette.pod, stroke: '#1d2226', width: 2 },
    );

    // Livery: navy lower stripe with a red accent line above it.
    poly(
      ctx,
      [
        [-0.17 * u, -0.10 * u],
        [-0.10 * u, -0.10 * u],
        [-0.10 * u, 0.76 * u],
        [-0.17 * u, 0.74 * u],
      ],
      { fill: palette.trim },
    );
    poly(
      ctx,
      [
        [-0.19 * u, -0.16 * u],
        [-0.17 * u, -0.16 * u],
        [-0.17 * u, 0.78 * u],
        [-0.19 * u, 0.76 * u],
      ],
      { fill: palette.accent },
    );

    // Four cabin windows a side.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const at = -0.30 + i * 0.16;
        poly(
          ctx,
          [
            [side * 0.06 * u, at * u],
            [side * 0.16 * u, (at + 0.03) * u],
            [side * 0.16 * u, (at + 0.13) * u],
            [side * 0.06 * u, (at + 0.12) * u],
          ],
          { fill: COLORS.glass, stroke: '#1d2226', width: 1 },
        );
      }
    }

    poly(
      ctx,
      [
        [0, 0.56 * u],
        [0.44 * u, 0.82 * u],
        [0.44 * u, 0.88 * u],
        [0, 0.72 * u],
        [-0.44 * u, 0.88 * u],
        [-0.44 * u, 0.82 * u],
      ],
      { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
    );

    // Tall fin, conventional tail: no T-tail here, unlike the King Air.
    poly(
      ctx,
      [
        [-0.06 * u, 0.44 * u],
        [0, -0.34 * u],
        [0.06 * u, 0.44 * u],
      ],
      { fill: palette.trim, stroke: '#1d2226', width: 2 },
    );

    // Big turboprop disc, plus the PT6 exhaust stub low on the nose.
    rim(ctx, 0, -0.58 * u, 0.20 * u, 'rgba(230,238,244,0.55)', 2);
    disc(ctx, 0, -0.58 * u, 0.20 * u, 0.20 * u, 'rgba(220,230,238,0.16)');
    band(ctx, -0.05 * u, -0.46 * u, 0.10 * u, 0.06 * u, '#6e7880');

    if (gearDown) {
      wheel(ctx, 0, -0.44 * u, 0.05 * u);
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.34 * u, 0.08 * u],
            [side * 0.32 * u, 0.30 * u],
          ],
          { stroke: '#8f9aa2', width: 2 },
        );
        wheel(ctx, side * 0.32 * u, 0.32 * u, 0.07 * u);
      }
    }
  },
};
