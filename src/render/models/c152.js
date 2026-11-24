// Cessna 152, flight-school livery, as a low-poly 3D airframe plus a cockpit
// built from flat faces.
//
// The exterior is a real model: 3-D vertices in feet, projected through the
// chase camera. Seen from 70 ft behind and 24 ft above, 24 ft of aeroplane is
// foreshortened to about a third of its length, so what reads is the TAIL, the
// wide high wing, and a short white fuselage with a red lower half.
//
// Livery: white upper, red lower and cheatline, red fin, red wingtips and
// spinner, red placards inside. Trim colours live in `palette` and are the first
// thing to change if the school wants blue.

import { VIEW, COLORS } from '../layout.js';
import { plank, shell, slab, INK } from './vintage.js';
import { disc, rim, label } from './shapes.js';
import { model, faceAt, hull, box, hinge, CAM_BEHIND_FT } from './frame3d.js';

const W = VIEW.width;
const BOTTOM = VIEW.windshieldBottom;

const palette = {
  white: '#f2f5f6',
  whiteShade: '#c4ced4',
  red: '#c0342b',
  redDeep: '#8d221c',
  grey: '#9aa4ab',
  dark: '#20252a',
  tire: '#1a1f23',
  interior: '#6b6257',
  interiorShade: '#544d44',
  glareshield: '#2f2b27',
  glass: '#1b2a33',
};

const Z = CAM_BEHIND_FT; // the aircraft's centre, in feet ahead of the camera

function buildAirframe() {
  const m = model();

  // Fuselage: six cross-sections from spinner to tail cone, so the facets come
  // from the geometry instead of from shading.
  hull(
    m,
    [
      { z: Z + 12.5, hw: 0.18, y0: 1.05, y1: 1.75 },
      { z: Z + 9.0, hw: 0.85, y0: 0.75, y1: 2.35 },
      { z: Z + 4.0, hw: 1.15, y0: 0.62, y1: 2.85 },
      { z: Z - 6.0, hw: 1.25, y0: 0.6, y1: 3.15 },
      { z: Z - 12.0, hw: 1.15, y0: 0.7, y1: 3.0 },
      { z: Z - 14.0, hw: 0.55, y0: 1.1, y1: 2.6 },
    ],
    { top: palette.white, upper: palette.white, lower: palette.red, bottom: palette.whiteShade },
    1.95,
  );

  // High wing: tapered plate, roots at the cabin roof. Leading edge and tip in
  // red so the livery is legible from above as well as from behind.
  for (const side of [-1, 1]) {
    const root = side * 1.2;
    const tip = side * 16.65;
    const yRoot = 3.45;
    const yTip = 3.4;
    faceAt(m, palette.white, [
      [root, yRoot, Z + 4],
      [tip, yTip, Z + 2.5],
      [tip, yTip, Z - 3.5],
      [root, yRoot, Z - 6],
    ]);
    faceAt(m, palette.whiteShade, [
      [root, yRoot - 0.45, Z + 4],
      [tip, yTip - 0.45, Z + 2.5],
      [tip, yTip - 0.45, Z - 3.5],
      [root, yRoot - 0.45, Z - 6],
    ]);
    faceAt(m, palette.red, [
      [root, yRoot, Z + 4],
      [tip, yTip, Z + 2.5],
      [tip, yTip - 0.45, Z + 2.5],
      [root, yRoot - 0.45, Z + 4],
    ]);
    faceAt(m, palette.redDeep, [
      [tip, yTip, Z + 2.5],
      [tip, yTip, Z - 3.5],
      [tip, yTip - 0.45, Z - 3.5],
      [tip, yTip - 0.45, Z + 2.5],
    ]);
    // Aileron: a separate panel on the trailing edge, outboard, with its hinge
    // registered so the stick can deflect it. The trailing vertices are the two
    // that move; the hinge line stays put.
    const yAil = yTip - 0.02;
    const before = m.verts.length;
    faceAt(m, palette.white, [
      [side * 10.0, yAil, Z - 4.2],
      [side * 15.9, yAil, Z - 3.0],
      [side * 15.9, yAil, Z - 4.7],
      [side * 10.0, yAil, Z - 6.3],
    ]);
    hinge(m, { trail: [before + 2, before + 3], baseY: yAil, chord: 2.2, dir: side });

    // Lift strut: a thin flat member, visible because the wing is high.
    faceAt(m, palette.grey, [
      [side * 5.2, 3.0, Z - 2.6],
      [side * 1.3, 1.15, Z - 3.0],
      [side * 1.3, 1.15, Z - 2.8],
      [side * 5.2, 3.0, Z - 2.4],
    ]);
    // Horizontal stabiliser, red tips.
    faceAt(m, palette.white, [
      [side * 0.5, 2.05, Z - 12.2],
      [side * 6.2, 1.95, Z - 13.2],
      [side * 6.2, 1.95, Z - 14.6],
      [side * 0.5, 2.05, Z - 14.2],
    ]);
    faceAt(m, palette.red, [
      [side * 5.6, 1.96, Z - 13.0],
      [side * 6.2, 1.95, Z - 13.2],
      [side * 6.2, 1.95, Z - 14.6],
      [side * 5.6, 1.96, Z - 14.5],
    ]);
  }

  // Fin: a red blade on the centreline, swept back, the highest thing on the
  // aircraft and therefore the first shape the chase camera sees.
  for (const side of [-1, 1]) {
    faceAt(m, side < 0 ? palette.red : palette.redDeep, [
      [side * 0.12, 2.6, Z - 11.5],
      [side * 0.12, 6.4, Z - 12.6],
      [side * 0.12, 6.4, Z - 13.6],
      [side * 0.12, 2.6, Z - 14.2],
    ]);
  }
  faceAt(m, palette.white, [
    [-0.12, 6.4, Z - 12.6],
    [0.12, 6.4, Z - 12.6],
    [0.12, 6.4, Z - 13.6],
    [-0.12, 6.4, Z - 13.6],
  ]);

  // Cabin windows on both flanks, set a hair outside the hull so they read as
  // glass rather than as a painted line.
  for (const side of [-1, 1]) {
    for (const [z0, z1] of [
      [Z + 1.5, Z - 2.0],
      [Z - 3.0, Z - 6.5],
    ]) {
      faceAt(m, palette.glass, [
        [side * 1.27, 2.05, z0],
        [side * 1.27, 2.05, z1],
        [side * 1.27, 2.85, z1],
        [side * 1.27, 2.85, z0],
      ]);
    }
  }

  // Spinner and propeller: the prop is a flat bar, not a blurred disc.
  box(m, { x: 0, y: 1.15, z: Z + 12.6, w: 0.7, h: 0.7, d: 0.9, top: palette.red, side: palette.redDeep, front: palette.red, bottom: palette.redDeep });
  box(m, { x: 0, y: 1.35, z: Z + 12.7, w: 11.2, h: 0.3, d: 0.18, top: palette.dark, side: palette.dark, bottom: palette.dark, front: palette.dark });

  // Fixed tricycle gear: there is nothing to retract, so this never reads state.
  faceAt(m, palette.grey, [
    [-0.12, 0.95, Z + 3.2],
    [0.12, 0.95, Z + 3.2],
    [0.12, 0.2, Z + 3.4],
    [-0.12, 0.2, Z + 3.4],
  ]);
  box(m, { x: 0, y: 0, z: Z + 3.0, w: 0.45, h: 1.0, d: 1.2, top: palette.tire, side: palette.tire, bottom: palette.tire });
  for (const side of [-1, 1]) {
    box(m, { x: side * 3.6, y: 0, z: Z - 8.4, w: 0.5, h: 1.15, d: 1.6, top: palette.tire, side: palette.tire, bottom: palette.tire });
    faceAt(m, palette.grey, [
      [side * 3.5, 1.05, Z - 8.6],
      [side * 1.3, 2.2, Z - 8.4],
      [side * 1.3, 2.2, Z - 8.0],
      [side * 3.5, 1.05, Z - 8.2],
    ]);
  }

  return m;
}

let cached = null;
function airframe() {
  cached ??= buildAirframe();
  return cached;
}

export const c152 = {
  id: 'c152',

  signature: {
    engines: 1,
    wing: 'high',
    gear: 'fixed',
    tail: 'conventional',
    prop: 'tractor',
    decks: 1,
    winglets: 'none',
    cabinWindows: 1,
  },

  palette,

  /** 3D airframe for the chase camera; see frame3d.js. */
  get airframe() {
    return airframe();
  },

  drawCockpit(ctx) {
    shell(ctx, [[0, 24], [18, 28], [28, BOTTOM], [0, BOTTOM]], palette.interiorShade);
    shell(ctx, [[W, 24], [W - 18, 28], [W - 28, BOTTOM], [W, BOTTOM]], palette.interiorShade);

    shell(
      ctx,
      [
        [0, 0],
        [W, 0],
        [W, 26],
        [W - 250, 31],
        [W / 2, 24],
        [250, 31],
        [0, 26],
      ],
      palette.interior,
    );

    shell(ctx, [[0, 26], [48, 30], [106, BOTTOM], [0, BOTTOM]], palette.interior);
    shell(ctx, [[W, 26], [W - 48, 30], [W - 106, BOTTOM], [W, BOTTOM]], palette.interior);

    shell(ctx, [[8, 30], [20, 34], [30, BOTTOM], [8, BOTTOM]], palette.interiorShade);
    slab(ctx, 12, 300, 12, 46, palette.red);
    label(ctx, 'C152', 18, 322, { size: 7, fill: palette.white });

    const shieldTop = [
      [0, 306],
      [120, 313],
      [W / 2, 318],
      [W - 120, 313],
      [W, 306],
    ];
    shell(ctx, [...shieldTop, [W, BOTTOM], [0, BOTTOM]], palette.glareshield, 2);
    plank(
      ctx,
      [
        [0, 306],
        [120, 313],
        [W / 2, 318],
        [W - 120, 313],
        [W, 306],
        [W, 311],
        [W - 120, 318],
        [W / 2, 323],
        [120, 318],
        [0, 311],
      ],
      palette.dark,
    );

    const yx = 402;
    shell(ctx, [[yx - 14, BOTTOM], [yx + 14, BOTTOM], [yx + 8, 300], [yx - 8, 300]], palette.dark, 2);
    shell(ctx, [[yx - 74, 296], [yx + 74, 296], [yx + 74, 308], [yx - 74, 308]], palette.dark, 2);
    for (const side of [-1, 1]) {
      shell(
        ctx,
        [
          [yx + side * 74, 308],
          [yx + side * 66, 262],
          [yx + side * 84, 258],
          [yx + side * 92, 306],
        ],
        palette.dark,
        2,
      );
    }

    for (const [i, text] of ['THR', 'MIX'].entries()) {
      const x = 168 + i * 32;
      slab(ctx, x - 2, 336, 4, 16, palette.grey);
      disc(ctx, x, 332, 9, 9, palette.dark, INK, 2);
      plank(ctx, [[x, 332], [x + 6, 326], [x + 8, 330]], palette.white);
      label(ctx, text, x, 346, { size: 6, fill: palette.white });
    }

    slab(ctx, 96, 340, 40, 12, palette.red);
    label(ctx, 'AIRSPEED', 116, 346, { size: 6, fill: palette.white });
  },
};
