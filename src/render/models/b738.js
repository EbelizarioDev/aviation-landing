// Boeing 737-800: narrowbody jet with blended winglets and a dorsal fillet.
//
// Distinctions that matter against the E175 it sits next to: the nacelles are
// much bigger and sit further forward, the winglets are blended (a curved plate
// leaning up and out) rather than a flat fence, and the fin has a fillet where
// it meets the fuselage.

import { VIEW, COLORS } from '../layout.js';
import { poly, line, band, disc, rim, label, screen, wheel, vignette } from './shapes.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  interior: '#4a4640',
  interiorDark: '#332f2b',
  shade: '#26221f',
  frame: '#15181b',
  frameLight: '#2f373d',
  trim: '#1c2f52',
  accent: '#a8342c',
  belly: '#cdd5da',
  bezel: '#0a0e11',
};

export const b738 = {
  id: 'b738',

  signature: {
    engines: 2,
    wing: 'low',
    gear: 'retractable',
    tail: 'conventional',
    prop: 'none',
    decks: 1,
    winglets: 'blended',
    cabinWindows: 7,
  },

  palette,

  drawCockpit(ctx, { state }) {
    poly(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 42],
        [W - 200, 50],
        [W / 2, 42],
        [200, 50],
        [0, 42],
      ],
      { fill: palette.interiorDark, stroke: palette.frame, width: 2 },
    );

    poly(
      ctx,
      [
        [0, 36],
        [74, 50],
        [164, BOTTOM],
        [0, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );
    poly(
      ctx,
      [
        [W, 36],
        [W - 74, 50],
        [W - 164, BOTTOM],
        [W, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );

    band(ctx, 0, 36, 14, BOTTOM - 36, palette.frame);
    band(ctx, W - 14, 36, 14, BOTTOM - 36, palette.frame);

    // Two wipers, both parked against the bottom of their pane.
    for (const [x0, x1] of [
      [104, 162],
      [W - 104, W - 162],
    ]) {
      line(
        ctx,
        [
          [x0, BOTTOM],
          [x1, 236],
        ],
        { stroke: '#0d1114', width: 3 },
      );
    }

    const shieldTop = [
      [0, 292],
      [170, 302],
      [W / 2, 308],
      [W - 170, 302],
      [W, 292],
    ];
    poly(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], {
      fill: palette.shade,
      stroke: palette.frame,
      width: 2,
    });
    line(ctx, shieldTop, { stroke: palette.frameLight, width: 1 });

    // Mode control panel across the glareshield.
    for (let i = 0; i < 6; i++) {
      band(ctx, 226 + i * 54, 290, 44, 12, '#0f1317');
      band(ctx, 234 + i * 54, 293, 28, 6, '#1b2229');
    }
    label(ctx, 'MCP', 226, 284, { size: 6, fill: '#8fb3c2' });

    // Six displays: the 737 layout puts the engine indications on the inboard
    // lower corner of each pilot's panel, which is exactly what is drawn.
    const dy = 300;
    screen(ctx, { x: 196, y: dy, w: 42, h: 48, sky: '#245068', ground: '#38493a', horizonAt: 0.46, title: 'PFD', value: '140' });
    screen(ctx, { x: 242, y: dy, w: 42, h: 48, sky: '#122e3c', horizonAt: 0.5, tint: false, title: 'ND', value: 'LOC' });
    screen(ctx, { x: 288, y: dy, w: 42, h: 48, sky: '#122e3c', horizonAt: 0.5, tint: false, title: 'ND', value: 'GS' });
    screen(ctx, { x: 380, y: dy, w: 42, h: 48, sky: '#12262f', horizonAt: 0.5, tint: false, title: 'EICAS', value: 'N1 82' });
    screen(ctx, { x: 426, y: dy, w: 42, h: 48, sky: '#12262f', horizonAt: 0.5, tint: false, title: 'EICAS', value: 'N1 83' });
    screen(ctx, { x: 334, y: dy, w: 42, h: 48, sky: '#245068', ground: '#38493a', horizonAt: 0.46, title: 'PFD', value: '139' });

    // Control column with a big horn, the Boeing signature from the seat.
    const yx = 224;
    poly(
      ctx,
      [
        [yx - 13, BOTTOM],
        [yx + 13, BOTTOM],
        [yx + 8, 344],
        [yx - 8, 344],
      ],
      { fill: '#101619', stroke: '#070a0c', width: 2 },
    );
    poly(
      ctx,
      [
        [yx - 60, 344],
        [yx + 60, 344],
        [yx + 60, 352],
        [yx - 60, 352],
      ],
      { fill: '#1d2429', stroke: '#070a0c', width: 2 },
    );
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [yx + side * 60, 352],
          [yx + side * 70, 320],
          [yx + side * 84, 322],
          [yx + side * 74, 350],
        ],
        { fill: '#242b31', stroke: '#070a0c', width: 2 },
      );
    }

    vignette(ctx, 0, 36, 14, BOTTOM - 36, 0.26);
    vignette(ctx, W - 14, 36, 14, BOTTOM - 36, 0.26);
  },

  drawExterior(ctx, { state, u }) {
    const gearDown = state.gearDown === true;

    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [side * 0.12 * u, 0.16 * u],
          [side * 0.97 * u, -0.06 * u],
          [side * 0.97 * u, 0.03 * u],
          [side * 0.12 * u, 0.24 * u],
        ],
        { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
      );
      // Blended winglet: a plate leaning up and out, wider at the join.
      poly(
        ctx,
        [
          [side * 0.92 * u, -0.05 * u],
          [side * 1.02 * u, -0.26 * u],
          [side * 1.04 * u, -0.24 * u],
          [side * 0.97 * u, 0.02 * u],
        ],
        { fill: palette.trim, stroke: '#1d2226', width: 1.5 },
      );
      band(ctx, side * 0.97 * u - (side < 0 ? 0 : 5), -0.04 * u, 5, 4, side < 0 ? COLORS.red : COLORS.green);
    }

    // Big high-bypass nacelles, hung well forward of the wing.
    for (const side of [-1, 1]) {
      disc(ctx, side * 0.42 * u, 0.02 * u, 0.14 * u, 0.32 * u, '#dde5ea', '#1d2226', 2);
      disc(ctx, side * 0.42 * u, -0.24 * u, 0.10 * u, 0.10 * u, '#10161b', '#1d2226', 1.5);
      disc(ctx, side * 0.42 * u, -0.24 * u, 0.04 * u, 0.04 * u, '#4a545c');
    }

    disc(ctx, 0, 0.14 * u, 0.17 * u, 0.74 * u, '#f6f8f9', '#1d2226', 2);

    // Livery: red cheatline over a grey belly.
    poly(
      ctx,
      [
        [-0.17 * u, 0.34 * u],
        [0.17 * u, 0.34 * u],
        [0.13 * u, 0.82 * u],
        [-0.13 * u, 0.82 * u],
      ],
      { fill: palette.belly },
    );
    poly(
      ctx,
      [
        [-0.17 * u, 0.28 * u],
        [-0.13 * u, 0.28 * u],
        [-0.09 * u, 0.82 * u],
        [-0.13 * u, 0.82 * u],
      ],
      { fill: palette.accent },
    );

    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const at = -0.32 + i * 0.14;
        poly(
          ctx,
          [
            [side * 0.05 * u, at * u],
            [side * 0.16 * u, (at + 0.02) * u],
            [side * 0.16 * u, (at + 0.09) * u],
            [side * 0.05 * u, (at + 0.08) * u],
          ],
          { fill: COLORS.glass, stroke: '#1d2226', width: 1 },
        );
      }
    }

    poly(
      ctx,
      [
        [0, 0.58 * u],
        [0.42 * u, 0.82 * u],
        [0.42 * u, 0.88 * u],
        [0, 0.74 * u],
        [-0.42 * u, 0.88 * u],
        [-0.42 * u, 0.82 * u],
      ],
      { fill: '#eef2f4', stroke: '#1d2226', width: 2 },
    );

    // Fin with a dorsal fillet: the fillet is the 737 giveaway from behind.
    poly(
      ctx,
      [
        [-0.05 * u, 0.60 * u],
        [-0.06 * u, 0.28 * u],
        [-0.02 * u, 0.06 * u],
        [0.02 * u, 0.06 * u],
        [0.06 * u, 0.28 * u],
        [0.05 * u, 0.60 * u],
      ],
      { fill: palette.trim, stroke: '#1d2226', width: 2 },
    );

    if (gearDown) {
      wheel(ctx, 0, -0.42 * u, 0.05 * u);
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.26 * u, 0.18 * u],
            [side * 0.24 * u, 0.36 * u],
          ],
          { stroke: '#8f9aa2', width: 2 },
        );
        wheel(ctx, side * 0.24 * u, 0.38 * u, 0.06 * u);
      }
    } else {
      for (const side of [-1, 1]) {
        band(ctx, side * 0.26 * u - 0.05 * u, 0.18 * u, 0.10 * u, 0.05 * u, '#c6ced3');
      }
    }
  },
};
