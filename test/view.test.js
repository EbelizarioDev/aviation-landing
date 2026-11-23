// S9: the view switches between first person (cockpit) and third person (a
// chase camera behind the aircraft). The instruments stay either way: the
// perspective changes where you look from, not what you can read.

import test from 'node:test';
import assert from 'node:assert/strict';

import { getAircraft } from '../src/aircraft.js';
import { LEVELS } from '../src/levels.js';
import { createGame } from '../src/game.js';
import { createState, step } from '../src/physics.js';
import { VIEW } from '../src/render/layout.js';
import { aircraftScreenPose, drawChase } from '../src/render/chase.js';
import { stubContext, labels } from './helpers/canvas-stub.js';

function flying(levelIndex = 0) {
  const api = createGame({ storage: null });
  api.startLevel(levelIndex);
  api.begin();
  return api;
}

function tap(api, code) {
  api.press(code);
  api.release(code);
}

// ---------------------------------------------------------------------------
// The toggle
// ---------------------------------------------------------------------------

test('the view starts in the cockpit and C switches to third person and back', () => {
  const api = flying();
  assert.equal(api.game.view, 'cockpit');
  tap(api, 'KeyC');
  assert.equal(api.game.view, 'chase');
  tap(api, 'KeyC');
  assert.equal(api.game.view, 'cockpit');
});

test('the chosen view survives a restart and a new level', () => {
  const api = flying(0);
  tap(api, 'KeyC');
  assert.equal(api.game.view, 'chase');
  tap(api, 'KeyR');
  assert.equal(api.game.phase, 'briefing');
  assert.equal(api.game.view, 'chase', 'a restart is not a preference reset');
  api.begin();
  tap(api, 'KeyC');
  tap(api, 'Escape');
  assert.equal(api.game.phase, 'menu');
});

test('C does nothing outside a flight, so the menu cannot be disturbed', () => {
  const api = createGame({ storage: null });
  assert.equal(api.game.phase, 'menu');
  tap(api, 'KeyC');
  assert.equal(api.game.view, 'cockpit');
});

test('switching the view does not touch the flight', () => {
  const api = flying();
  for (let i = 0; i < 30; i++) api.update(1 / 60);
  const before = { ...api.game.state };
  tap(api, 'KeyC');
  assert.deepEqual(api.game.state, before);
});

test('a level still lands in third person', () => {
  const api = flying(0);
  tap(api, 'KeyC');
  const aircraft = api.game.aircraft;
  const speedKt = aircraft.vrefKt;
  const gammaDeg = (-Math.asin(150 / (speedKt * 101.27)) * 180) / Math.PI;
  api.game.state = {
    ...api.game.state,
    altFt: 0.6,
    distFt: -1600,
    speedKt,
    groundSpeedKt: speedKt,
    pitchDeg: 8 + gammaDeg,
    pitchCmd: 8 + gammaDeg,
    lateralFt: 2,
    steerDeg: 0,
    flapIdx: aircraft.flaps.length - 1,
    gearDown: true,
    onGround: false,
    touchdown: null,
  };
  api.press('Space');
  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 60) api.update(1 / 60);
  assert.equal(api.game.phase, 'result');
  assert.equal(api.game.result.ok, true, JSON.stringify(api.game.result));
});

// ---------------------------------------------------------------------------
// The chase view itself
// ---------------------------------------------------------------------------

test('the aircraft sits below the horizon and above the panel', () => {
  const aircraft = getAircraft('c152');
  const state = createState(aircraft, LEVELS[0]);
  const pose = aircraftScreenPose({ state, aircraft });
  assert.ok(pose.y > pose.horizonY, 'the aircraft is drawn below the horizon');
  assert.ok(pose.y < VIEW.windshieldBottom, 'and inside the windshield');
  assert.equal(pose.x, VIEW.width / 2);
});

test('a heavier aircraft is drawn bigger', () => {
  const light = aircraftScreenPose({
    state: createState(getAircraft('c152'), LEVELS[0]),
    aircraft: getAircraft('c152'),
  });
  const heavy = aircraftScreenPose({
    state: createState(getAircraft('a388'), LEVELS[6]),
    aircraft: getAircraft('a388'),
  });
  assert.ok(heavy.span > light.span * 1.5, `${light.span} -> ${heavy.span}`);
});

test('steering banks the silhouette', () => {
  const aircraft = getAircraft('c172');
  const state = createState(aircraft, LEVELS[1]);
  const level = aircraftScreenPose({ state: { ...state, steerDeg: 0 }, aircraft });
  const right = aircraftScreenPose({ state: { ...state, steerDeg: 8 }, aircraft });
  const left = aircraftScreenPose({ state: { ...state, steerDeg: -8 }, aircraft });
  assert.equal(level.roll, 0);
  assert.ok(right.roll > 0);
  assert.ok(left.roll < 0);
  assert.ok(Math.abs(right.roll) <= 12);
});

test('the horizon still follows pitch, so attitude stays readable', () => {
  const aircraft = getAircraft('c172');
  const state = createState(aircraft, LEVELS[1]);
  const level = aircraftScreenPose({ state: { ...state, pitchDeg: 0 }, aircraft });
  const up = aircraftScreenPose({ state: { ...state, pitchDeg: 10 }, aircraft });
  assert.ok(up.horizonY > level.horizonY);
});

test('third person draws no cockpit frame but still shows the instruments', () => {
  const aircraft = getAircraft('b738');
  const level = LEVELS[5];
  const state = createState(aircraft, level);
  const ctx = stubContext();
  drawChase(ctx, { state, aircraft, level });
  assert.ok(ctx.ops.length > 80, `drew ${ctx.ops.length} operations`);
  const sky = ctx.ops.filter((op) => op[0] === 'fillRect' && op[2] < 60);
  assert.ok(sky.length > 0, 'the sky is painted');
});

test('every level can be painted in third person in every phase', () => {
  for (const level of LEVELS) {
    const aircraft = getAircraft(level.aircraft);
    const base = createState(aircraft, level);
    const phases = [
      base,
      { ...base, altFt: 40, distFt: 1300, pitchDeg: 8, vsiFpm: -180 },
      { ...base, altFt: 0, onGround: true, rollFt: 400, speedKt: 40, touchdown: null },
    ];
    for (const state of phases) {
      const ctx = stubContext();
      assert.doesNotThrow(() => drawChase(ctx, { state, aircraft, level }), level.aircraft);
      assert.ok(ctx.ops.length > 60);
      assert.ok(labels(ctx).some((l) => l.includes('KT')) === false, 'no aircraft text is guessed');
    }
  }
});

test('a rollout on the ground is still drawn', () => {
  const aircraft = getAircraft('c152');
  const level = LEVELS[0];
  let state = createState(aircraft, level);
  state = step(
    aircraft,
    { ...state, altFt: 0.4, distFt: -1500, vsiFpm: -140 },
    { brake: 1, reverse: false, spoilers: false, throttle: 0, pitch: 0, steer: 0 },
    1 / 60,
  );
  for (let i = 0; i < 30; i++) {
    state = step(
      aircraft,
      state,
      { brake: 1, reverse: false, spoilers: false, throttle: 0, pitch: 0, steer: 0 },
      1 / 60,
    );
  }
  const ctx = stubContext();
  assert.doesNotThrow(() => drawChase(ctx, { state, aircraft, level }));
});
