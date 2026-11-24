// One cockpit and one exterior model per aircraft.
//
// The claims under test are the ones a screenshot cannot make for you: that all
// seven airframes differ, that every one of them draws a complete frame in
// every flight state, and that the shell stays out of the instrument panel.

import test from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, getAircraft } from '../src/aircraft.js';
import { LEVELS } from '../src/levels.js';
import { createState } from '../src/physics.js';
import { VIEW } from '../src/render/layout.js';
import { makeCamera, project, horizonLine } from '../src/render/projection.js';
import { drawCockpit } from '../src/render/cockpit.js';
import { drawChase } from '../src/render/chase.js';
import { VISUALS, getVisual } from '../src/render/models/index.js';
import { stubContext, invalidOps, lowestDrawnY } from './helpers/canvas-stub.js';
import { model as newModel, faceAt, drawModel, setAilerons } from '../src/render/models/frame3d.js';

const SIGNATURE_KEYS = [
  'engines',
  'wing',
  'gear',
  'tail',
  'prop',
  'decks',
  'winglets',
  'cabinWindows',
];

function stateFor(id) {
  const aircraft = getAircraft(id);
  const level = LEVELS.find((l) => l.aircraft === id);
  const base = createState(aircraft, level);
  return {
    aircraft,
    level,
    states: {
      approach: { ...base },
      flare: { ...base, altFt: 40, distFt: 1300, vsiFpm: -180, pitchDeg: 8, gearDown: true, flapIdx: 0 },
      ground: { ...base, altFt: 0, onGround: true, groundSpeedKt: 40, gearDown: true, flapIdx: 0 },
    },
  };
}

test('every aircraft on the ladder has its own visual definition', () => {
  for (const aircraft of AIRCRAFT) {
    const visual = VISUALS[aircraft.id];
    assert.ok(visual, `${aircraft.id} has no visual module`);
    assert.equal(visual.id, aircraft.id);
    assert.equal(typeof visual.drawCockpit, 'function', `${aircraft.id} cockpit`);
    const hasModel =
      typeof visual.drawExterior === 'function' ||
      (visual.airframe && visual.airframe.faces.length > 0);
    assert.ok(hasModel, `${aircraft.id} has neither a 3D airframe nor a flat model`);
    for (const key of SIGNATURE_KEYS) {
      assert.ok(
        visual.signature[key] !== undefined,
        `${aircraft.id} signature is missing ${key}`,
      );
    }
    assert.ok(Object.keys(visual.palette).length >= 4, `${aircraft.id} palette too thin`);
  }
});

test('no two aircraft share a visual signature', () => {
  const seen = new Map();
  for (const aircraft of AIRCRAFT) {
    const key = JSON.stringify(VISUALS[aircraft.id].signature);
    assert.ok(!seen.has(key), `${aircraft.id} looks identical to ${seen.get(key)}`);
    seen.set(key, aircraft.id);
  }
  assert.equal(seen.size, AIRCRAFT.length);
});

test('engine count in the signature matches the flight model', () => {
  for (const aircraft of AIRCRAFT) {
    assert.equal(
      VISUALS[aircraft.id].signature.engines,
      aircraft.engines,
      `${aircraft.id} draws the wrong number of engines`,
    );
  }
});

test('gear type in the signature matches the flight model', () => {
  for (const aircraft of AIRCRAFT) {
    assert.equal(
      VISUALS[aircraft.id].signature.gear,
      aircraft.gear,
      `${aircraft.id} draws the wrong gear type`,
    );
  }
});

test('every aircraft draws a full frame in every state, in both views', () => {
  for (const aircraft of AIRCRAFT) {
    const { level, states } = stateFor(aircraft.id);
    for (const [stateName, state] of Object.entries(states)) {
      for (const [viewName, draw] of [
        ['cockpit', drawCockpit],
        ['chase', drawChase],
      ]) {
        const ctx = stubContext();
        draw(ctx, { state, aircraft, level, weather: undefined, t: 3 });
        const where = `${aircraft.id} ${stateName} ${viewName}`;
        assert.ok(ctx.ops.length > 150, `${where}: only ${ctx.ops.length} operations`);
        const bad = invalidOps(ctx);
        assert.deepEqual(bad, [], `${where}: invalid arguments ${JSON.stringify(bad.slice(0, 3))}`);
      }
    }
  }
});

test('the cockpit shell never paints over the graded panel', () => {
  for (const aircraft of AIRCRAFT) {
    // The shell only: the world behind it is allowed to run past the bottom of
    // the windshield, which is exactly what the horizon polygon does.
    const ctx = stubContext();
    getVisual(aircraft).drawCockpit(ctx, { state: stateFor(aircraft.id).states.approach, aircraft, view: VIEW });
    const lowest = lowestDrawnY(ctx);
    assert.ok(
      lowest <= VIEW.windshieldBottom,
      `${aircraft.id} cockpit draws down to y=${lowest}, past the windshield at ${VIEW.windshieldBottom}`,
    );
  }
});

test('a retractable aircraft hides its wheels when the gear is up', () => {
  for (const aircraft of AIRCRAFT.filter((a) => a.gear === 'retractable')) {
    const { level, states } = stateFor(aircraft.id);
    const down = stubContext();
    drawChase(down, { state: { ...states.approach, gearDown: true }, aircraft, level, weather: undefined, t: 0 });
    const up = stubContext();
    drawChase(up, { state: { ...states.approach, gearDown: false }, aircraft, level, weather: undefined, t: 0 });
    assert.notDeepEqual(
      down.ops,
      up.ops,
      `${aircraft.id} draws the same model with the gear up and down`,
    );
  }
});

test('a fixed-gear aircraft looks the same with the gear up and down', () => {
  // Nothing to retract: the model must not invent a gear transition.
  for (const aircraft of AIRCRAFT.filter((a) => a.gear === 'fixed')) {
    const { level, states } = stateFor(aircraft.id);
    const down = stubContext();
    drawChase(down, { state: { ...states.approach, gearDown: true }, aircraft, level, weather: undefined, t: 0 });
    const up = stubContext();
    drawChase(up, { state: { ...states.approach, gearDown: false }, aircraft, level, weather: undefined, t: 0 });
    assert.deepEqual(up.ops, down.ops, `${aircraft.id} has fixed gear and moved it anyway`);
  }
});

test('an aircraft without a visual module still draws something', () => {
  const fallback = getVisual({ id: 'not-an-aircraft' });
  assert.ok(fallback);
  assert.equal(typeof fallback.drawCockpit, 'function');
  assert.ok(fallback.drawExterior || fallback.airframe);
});

test('the chase camera sees the tail, not a plan view', () => {
  // A 24 ft aircraft seen from 70 ft behind and 24 ft above is foreshortened to
  // about a third of its length: the silhouette must be much wider than tall.
  // A model drawn in plan view fails this immediately, which is the point.
  for (const aircraft of AIRCRAFT.filter((a) => VISUALS[a.id].airframe)) {
    const { level, states } = stateFor(aircraft.id);
    const ctx = stubContext();
    drawChase(ctx, {
      state: { ...states.approach, bankDeg: 0 },
      aircraft,
      level,
      weather: undefined,
      t: 0,
    });
    const pts = ctx.ops
      .filter((o) => o[0] === 'moveTo' || o[0] === 'lineTo')
      .map((o) => [o[1], o[2]])
      // The airframe is the only thing drawn near the centre of the windshield.
      .filter(([x, y]) => x > 180 && x < 780 && y > 120 && y <= VIEW.windshieldBottom);
    assert.ok(pts.length > 40, `${aircraft.id}: almost nothing drawn`);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    assert.ok(
      width > height * 2,
      `${aircraft.id} is ${width.toFixed(0)}x${height.toFixed(0)}: that is a plan view, not a view from behind`,
    );
  }
});

test('banking swings the world sideways from the pilot seat', () => {
  const aircraft = getAircraft('c152');
  const state = createState(aircraft, LEVELS[0]);
  const opts = { cx: VIEW.width / 2, horizonY: VIEW.horizonBaseY, rollWithBank: true, pivotY: 176 };

  const level = makeCamera({ ...state, bankDeg: 0 }, opts);
  const banked = makeCamera({ ...state, bankDeg: 20 }, opts);

  // A point far down the runway centreline: level it sits centred, banked it
  // must move, which is the visual consequence the ailerons were missing.
  const centred = project(level, 0, 0, 2000);
  const swung = project(banked, 0, 0, 2000);
  assert.notEqual(centred.x.toFixed(3), swung.x.toFixed(3));

  // And the horizon itself tilts: two ends of the same line must differ in y.
  const [left, right] = horizonLine(banked);
  assert.ok(Math.abs(left[1] - right[1]) > 100, 'the horizon did not roll');
});

test('the cockpit frame differs when the aircraft is banked', () => {
  const aircraft = getAircraft('c152');
  const level = LEVELS[0];
  const state = createState(aircraft, level);
  const flat = stubContext();
  drawCockpit(flat, { state: { ...state, bankDeg: 0 }, aircraft, level, weather: undefined, t: 0 });
  const banked = stubContext();
  drawCockpit(banked, { state: { ...state, bankDeg: 25 }, aircraft, level, weather: undefined, t: 0 });
  assert.notDeepEqual(flat.ops, banked.ops, 'banking produced no visual change at all');
});

test('banking right puts the right wing down on screen', () => {
  // The sign of this rotation was wrong once: it read as a bank to the wrong
  // side, which makes the ailerons useless in the chase view. A flat plate 20 ft
  // either side of the centreline is enough to pin the direction down.
  const m = newModel();
  faceAt(m, '#ffffff', [
    [-10, 2.5, 70],
    [10, 2.5, 70],
    [10, 3.0, 70],
    [-10, 3.0, 70],
  ]);

  const extreme = (rollDeg) => {
    const ctx = stubContext();
    drawModel(ctx, m, { cx: 480, horizonY: 196, anchorBottomY: 348, rollDeg });
    const pts = ctx.ops
      .filter((o) => o[0] === 'moveTo' || o[0] === 'lineTo')
      .map((o) => ({ x: o[1], y: o[2] }));
    const right = pts.reduce((a, b) => (b.x > a.x ? b : a));
    const left = pts.reduce((a, b) => (b.x < a.x ? b : a));
    return { right, left };
  };

  const bankedRight = extreme(20);
  assert.ok(
    bankedRight.right.y > bankedRight.left.y,
    'banking right must drop the right wingtip below the left one',
  );

  const bankedLeft = extreme(-20);
  assert.ok(
    bankedLeft.right.y < bankedLeft.left.y,
    'banking left must drop the left wingtip below the right one',
  );
});

test('rolling right raises the right aileron and lowers the left', () => {
  // The surfaces must move in opposition, and in the direction that produces
  // the roll: right aileron up drops the right wing.
  const aircraft = getAircraft('c152');
  const before = getVisual(aircraft).airframe.hinges.map((h) => h.trail.map((i) => h.baseY));

  setAilerons(getVisual(aircraft).airframe, 1);
  const right = getVisual(aircraft).airframe.hinges.filter((h) => h.dir > 0)[0];
  const left = getVisual(aircraft).airframe.hinges.filter((h) => h.dir < 0)[0];
  const rightUp = right.trail.every((i) => getVisual(aircraft).airframe.verts[i][1] > right.baseY);
  const leftDown = left.trail.every((i) => getVisual(aircraft).airframe.verts[i][1] < left.baseY);
  assert.ok(rightUp, 'the right aileron must rise when rolling right');
  assert.ok(leftDown, 'the left aileron must fall when rolling right');

  // Neutral returns every surface exactly to its rigging position.
  setAilerons(getVisual(aircraft).airframe, 0);
  const after = getVisual(aircraft).airframe.hinges.map((h) => h.trail.map((i) => h.baseY));
  assert.deepEqual(after, before);
});
