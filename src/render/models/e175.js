// Embraer E175: the first glass cockpit on the ladder, and the first jet.
//
// From behind, the jet is read by absence: no prop discs, nacelles slung under
// the wing, and wingtip fences instead of blended winglets. Inside, the
// difference is that the panel the player reads has glass siblings on screen.

import { VIEW, COLORS } from '../layout.js';
import { poly, line, band, disc, rim, label, screen, wheel, vignette } from './shapes.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  interior: '#3f4449',
  interiorDark: '#2b3035',
  shade: '#22272b',
  frame: '#14181c',
  frameLight: '#2b333a',
  trim: '#1b3a63',
  accent: '#49b3c9',
  bezel: '#0b0f12',
};

export const e175 = {
  id: 'e175',

  signature: {
    engines: 2,
    wing: 'low',
    gear: 'retractable',
    tail: 'conventional',
    prop: 'none',
    decks: 1,
    winglets: 'fence',
    cabinWindows: 5,
  },

  palette,

  drawCockpit(ctx, { state }) {
    poly(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 40],
        [W - 210, 48],
        [W / 2, 40],
        [210, 48],
        [0, 40],
      ],
      { fill: palette.interiorDark, stroke: palette.frame, width: 2 },
    );

    // Heavily swept pillars: an airliner windshield is a raked pane, not a door.
    poly(
      ctx,
      [
        [0, 34],
        [70, 48],
        [158, BOTTOM],
        [0, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );
    poly(
      ctx,
      [
        [W, 34],
        [W - 70, 48],
        [W - 158, BOTTOM],
        [W, BOTTOM],
      ],
      { fill: palette.interior, stroke: palette.frame, width: 3 },
    );

    band(ctx, 0, 34, 13, BOTTOM - 34, palette.frame);
    band(ctx, W - 13, 34, 13, BOTTOM - 34, palette.frame);

    // Wiper on the captain's pane, parked.
    line(
      ctx,
      [
        [96, BOTTOM],
        [150, 232],
      ],
      { stroke: '#0e1216', width: 3 },
    );

    const shieldTop = [
      [0, 296],
      [160, 306],
      [W / 2, 312],
      [W - 160, 306],
      [W, 296],
    ];
    poly(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], {
      fill: palette.shade,
      stroke: palette.frame,
      width: 2,
    });
    line(ctx, shieldTop, { stroke: palette.frameLight, width: 1 });

    // Mode control panel: the row of knobs and windows above the displays.
    for (let i = 0; i < 6; i++) {
      band(ctx, 236 + i * 52, 292, 42, 12, '#10151a');
      band(ctx, 244 + i * 52, 295, 26, 6, '#1c242b');
    }
    label(ctx, 'A/P', 236, 286, { size: 6, fill: '#8fb3c2' });

    // Four displays in the standard T. PFD and ND for the pilot, MFD and EICAS
    // inboard: the arrangement every jet crew scans the same way.
    const dy = 300;
    screen(ctx, { x: 214, y: dy, w: 62, h: 48, sky: '#245068', ground: '#38493a', horizonAt: 0.46, title: 'PFD', value: '135' });
    screen(ctx, { x: 286, y: dy, w: 58, h: 48, sky: '#12303f', horizonAt: 0.5, tint: false, title: 'ND', value: 'GS 3.0' });
    screen(ctx, { x: 356, y: dy, w: 58, h: 48, sky: '#12303f', horizonAt: 0.5, tint: false, title: 'MFD', value: 'APPR' });
    screen(ctx, { x: 424, y: dy, w: 62, h: 48, sky: '#12262f', horizonAt: 0.5, tint: false, title: 'EICAS', value: 'N1 84' });

    // Yoke: E-Jets have yokes, and they sit far from the eye.
    const yx = 250;
    poly(
      ctx,
      [
        [yx - 12, BOTTOM],
        [yx + 12, BOTTOM],
        [yx + 7, 344],
        [yx - 7, 344],
      ],
      { fill: '#12181c', stroke: '#070a0c', width: 2 },
    );
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [yx + side * 12, 352],
          [yx + side * 58, 344],
          [yx + side * 52, 330],
          [yx + side * 10, 340],
        ],
        { fill: '#1d242a', stroke: '#070a0c', width: 2 },
      );
    }

    // Side console top edge: an airliner cockpit has furniture beside the seat.
    poly(
      ctx,
      [
        [0, BOTTOM],
        [118, BOTTOM],
        [96, 344],
        [0, 338],
      ],
      { fill: '#1a2026' },
    );
    label(ctx, 'FLAPS', 46, 344, { size: 6, fill: '#8fb3c2' });

    vignette(ctx, 0, 34, 13, BOTTOM - 34, 0.24);
    vignette(ctx, W - 13, 34, 13, BOTTOM - 34, 0.24);
  },

  drawExterior(ctx, { state, u }) {
    const gearDown = state.gearDown === true;

    // Swept low wing with wingtip fences: small vertical end plates.
    for (const side of [-1, 1]) {
      poly(
        ctx,
        [
          [side * 0.12 * u, 0.18 * u],
          [side * 0.99 * u, 0.02 * u],
          [side * 0.99 * u, 0.11 * u],
          [side * 0.12 * u, 0.26 * u],
        ],
        { fill: '#f2f5f6', stroke: '#1d2226', width: 2 },
      );
      band(ctx, side * 0.99 * u - (side < 0 ? 0 : 5), 0.0 * u, 5, 0.13 * u, '#e2e8ec');
      poly(
        ctx,
        [
          [side * 1.0 * u, 0.00 * u],
          [side * 1.0 * u, 0.13 * u],
          [side * 0.95 * u, 0.12 * u],
          [side * 0.95 * u, 0.01 * u],
        ],
        { fill: palette.accent, stroke: '#1d2226', width: 1 },
      );
      band(ctx, side * 1.0 * u - (side < 0 ? 0 : 5), 0.02 * u, 5, 4, side < 0 ? COLORS.red : COLORS.green);
    }

    // Two jet nacelles slung under the wing, no propeller anywhere.
    for (const side of [-1, 1]) {
      disc(ctx, side * 0.44 * u, 0.14 * u, 0.11 * u, 0.26 * u, '#dde5ea', '#1d2226', 2);
      disc(ctx, side * 0.44 * u, -0.06 * u, 0.075 * u, 0.075 * u, '#12171b', '#1d2226', 1.5);
    }

    disc(ctx, 0, 0.14 * u, 0.16 * u, 0.68 * u, '#f6f8f9', '#1d2226', 2);

    // Livery: white top, blue belly, cyan accent, navy fin.
    poly(
      ctx,
      [
        [-0.16 * u, 0.30 * u],
        [0.16 * u, 0.30 * u],
        [0.12 * u, 0.74 * u],
        [-0.12 * u, 0.74 * u],
      ],
      { fill: palette.trim },
    );
    poly(
      ctx,
      [
        [-0.16 * u, 0.26 * u],
        [-0.14 * u, 0.26 * u],
        [-0.10 * u, 0.74 * u],
        [-0.12 * u, 0.74 * u],
      ],
      { fill: palette.accent },
    );

    // Five cabin windows a side.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const at = -0.28 + i * 0.15;
        poly(
          ctx,
          [
            [side * 0.05 * u, at * u],
            [side * 0.15 * u, (at + 0.02) * u],
            [side * 0.15 * u, (at + 0.10) * u],
            [side * 0.05 * u, (at + 0.09) * u],
          ],
          { fill: COLORS.glass, stroke: '#1d2226', width: 1 },
        );
      }
    }

    // Conventional tail: stabiliser on the fuselage, well below the fin tip.
    poly(
      ctx,
      [
        [0, 0.52 * u],
        [0.40 * u, 0.76 * u],
        [0.40 * u, 0.82 * u],
        [0, 0.68 * u],
        [-0.40 * u, 0.82 * u],
        [-0.40 * u, 0.76 * u],
      ],
      { fill: '#eef2f4', stroke: '#1d2226', width: 2 },
    );
    poly(
      ctx,
      [
        [-0.05 * u, 0.56 * u],
        [-0.02 * u, 0.02 * u],
        [0.02 * u, 0.02 * u],
        [0.05 * u, 0.56 * u],
      ],
      { fill: palette.trim, stroke: '#1d2226', width: 2 },
    );

    if (gearDown) {
      wheel(ctx, 0, -0.38 * u, 0.05 * u);
      for (const side of [-1, 1]) {
        line(
          ctx,
          [
            [side * 0.26 * u, 0.20 * u],
            [side * 0.24 * u, 0.36 * u],
          ],
          { stroke: '#8f9aa2', width: 2 },
        );
        wheel(ctx, side * 0.24 * u, 0.38 * u, 0.06 * u);
      }
    } else {
      for (const side of [-1, 1]) {
        band(ctx, side * 0.26 * u - 0.04 * u, 0.20 * u, 0.08 * u, 0.05 * u, '#c6ced3');
      }
    }
  },
};
