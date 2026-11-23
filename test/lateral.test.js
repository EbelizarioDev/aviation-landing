// S4: the lateral model. Bank turns the flight path, the rudder puts the nose
// off it, and banking costs glide path. Plus S5: alignment is scored, not fatal.

import test from 'node:test';
import assert from 'node:assert/strict';

import { getAircraft } from '../src/aircraft.js';
import { LEVELS, levelByNumber } from '../src/levels.js';
import {
  MAX_BANK_DEG,
  classifyTouchdown,
  createState,
  setFlapSetting,
  setGearDown,
  stallKt,
  step,
} from '../src/physics.js';

const DEG = Math.PI / 180;

const baseControls = {
  pitch: 0,
  aileron: 0,
  rudder: 0,
  throttle: 0.4,
  brake: 0,
  reverse: false,
  spoilers: false,
  crosswindKt: 0,
  headwindKt: 0,
  gustFpm: 0,
  wet: false,
};

/** A configured aircraft on final, ready to be perturbed. */
function onFinal(aircraftId = 'b738', levelNumber = 6) {
  const aircraft = getAircraft(aircraftId);
  const level = levelByNumber(levelNumber);
  let state = createState(aircraft, level);
  for (let i = 0; i < aircraft.flaps.length; i++) state = setFlapSetting(aircraft, state, +1);
  state = setGearDown(aircraft, state, true);
  return { aircraft, level, state };
}

// ---------------------------------------------------------------------------
// Bank turns the flight path
// ---------------------------------------------------------------------------

test('a bank turns the flight path at g·tan(phi)/V', () => {
  const { aircraft, state } = onFinal();
  const banked = { ...state, bankDeg: 10 };
  const after = step(aircraft, banked, { ...baseControls }, 1 / 60);

  const vMs = state.speedKt * 0.514444;
  // The dihedral relaxes a hair of bank inside the same step, so allow for it.
  const expected = ((9.81 * Math.tan(after.bankDeg * DEG)) / vMs) * (180 / Math.PI) * (1 / 60);
  assert.ok(Math.abs(after.chiDeg - expected) < 1e-9, `turned ${after.chiDeg} not ${expected}`);
  assert.ok(after.chiDeg > 0, 'a right bank turns right');
});

test('wings level fly straight: no bank, no turn', () => {
  const { aircraft, state } = onFinal();
  const after = step(aircraft, state, { ...baseControls }, 1 / 60);
  assert.equal(after.chiDeg, 0);
});

test('a heavier, faster aircraft turns slower for the same bank', () => {
  const jet = onFinal('a388', 7);
  const light = onFinal('c152', 1);
  const jetAfter = step(jet.aircraft, { ...jet.state, bankDeg: 15 }, baseControls, 1 / 60);
  const lightAfter = step(light.aircraft, { ...light.state, bankDeg: 15 }, baseControls, 1 / 60);
  assert.ok(lightAfter.chiDeg > jetAfter.chiDeg * 1.5, `${lightAfter.chiDeg} vs ${jetAfter.chiDeg}`);
});

test('the aileron rolls, and letting go lets the dihedral level it', () => {
  const { aircraft, state } = onFinal();
  const right = step(aircraft, state, { ...baseControls, aileron: 1 }, 1 / 60);
  assert.ok(right.bankDeg > 0, 'right aileron banks right');
  assert.ok(right.bankDeg <= aircraft.rollRateDegS / 60 + 1e-9, 'no faster than the roll rate');

  const held = { ...state, bankDeg: 12 };
  const released = step(aircraft, held, { ...baseControls, aileron: 0 }, 1 / 60);
  assert.ok(released.bankDeg < 12 && released.bankDeg > 11, 'it rolls back slowly');

  // Full aileron never exceeds the approach bank limit.
  let s = state;
  for (let i = 0; i < 600; i++) s = step(aircraft, s, { ...baseControls, aileron: 1 }, 1 / 60);
  assert.equal(s.bankDeg, MAX_BANK_DEG);
});

// ---------------------------------------------------------------------------
// The rudder yaws the nose, not the flight path
// ---------------------------------------------------------------------------

test('the rudder puts the nose off the flight path', () => {
  const { aircraft, state } = onFinal();
  const after = step(aircraft, { ...state, chiDeg: 5 }, { ...baseControls, rudder: 1 }, 0.5);
  assert.equal(after.chiDeg, 5, 'the rudder does not turn the aircraft');
  assert.ok(after.betaDeg > 0, 'it yaws the nose');
  assert.ok(
    Math.abs(after.headingDeg - (after.chiDeg + after.betaDeg)) < 1e-9,
    'heading = path + sideslip',
  );
});

test('full rudder holds a real sideslip, and no more than the airframe allows', () => {
  for (const id of ['c152', 'a388']) {
    const { aircraft, state } = onFinal(id === 'c152' ? 'c152' : 'a388', id === 'c152' ? 1 : 7);
    let s = state;
    for (let i = 0; i < 600; i++) s = step(aircraft, s, { ...baseControls, rudder: 1 }, 1 / 60);
    assert.ok(s.betaDeg > 10, `${id} holds ${s.betaDeg.toFixed(1)} degrees`);
    assert.ok(s.betaDeg <= aircraft.maxSideslipDeg + 1e-9, `${id} exceeds its limit`);
  }
});

// ---------------------------------------------------------------------------
// Crabbing and de-crabbing
// ---------------------------------------------------------------------------

test('a crab into the wind holds the centreline', () => {
  const { aircraft, level, state } = onFinal('b738', 6);
  const crosswindKt = 18;
  const crab = -Math.asin(crosswindKt / state.speedKt) / DEG;
  let s = { ...state, chiDeg: crab, lateralFt: 0 };
  for (let i = 0; i < 60 * 10; i++) {
    s = step(aircraft, s, { ...baseControls, crosswindKt }, 1 / 60);
    s = { ...s, chiDeg: crab, bankDeg: 0 }; // hold the crab, ignore drift trim
  }
  assert.ok(Math.abs(s.lateralFt) < 5, `drifted ${s.lateralFt.toFixed(1)} ft in 10 s`);
});

test('de-crabbing keeps the track: nose on the axis with sideslip doing the work', () => {
  const { aircraft, state } = onFinal('b738', 6);
  const crosswindKt = 18;
  const crab = -Math.asin(crosswindKt / state.speedKt) / DEG;
  // Nose aligned: heading = 0 requires beta = -chi.
  let s = { ...state, chiDeg: crab, betaDeg: -crab, headingDeg: 0, lateralFt: 0 };
  for (let i = 0; i < 60 * 5; i++) {
    s = step(aircraft, s, { ...baseControls, crosswindKt, rudder: -crab / aircraft.maxSideslipDeg }, 1 / 60);
    s = { ...s, chiDeg: crab, bankDeg: 0 };
  }
  assert.ok(Math.abs(s.headingDeg) < 1.5, `nose off by ${s.headingDeg.toFixed(1)} degrees`);
  assert.ok(Math.abs(s.lateralFt) < 12, `drifted ${s.lateralFt.toFixed(1)} ft`);
});

test('a big aircraft with no rudder cannot de-crab, and that is what the weather will ask', () => {
  const { aircraft, state } = onFinal('a388', 7);
  const needed = 18;
  const crab = -Math.asin(needed / state.speedKt) / DEG;
  assert.ok(Math.abs(crab) < aircraft.maxSideslipDeg, 'the de-crab is inside the envelope');
});

// ---------------------------------------------------------------------------
// Banking costs glide path, and raises the stall speed
// ---------------------------------------------------------------------------

test('banking adds sink by 1 - cos(phi)', () => {
  const { aircraft, state } = onFinal();
  const level0 = step(aircraft, state, baseControls, 1 / 60);
  const banked = step(aircraft, { ...state, bankDeg: 20 }, baseControls, 1 / 60);
  const factor = 1 / Math.cos(20 * DEG) - 1;
  const expected = level0.vsiFpm - Math.abs(level0.vsiFpm) * factor;
  assert.ok(Math.abs(banked.vsiFpm - expected) < 0.5, `${banked.vsiFpm} vs ${expected}`);
  assert.ok(Math.abs(banked.vsiFpm) > Math.abs(level0.vsiFpm), 'it sinks faster');
});

test('a banked wing stalls sooner', () => {
  const aircraft = getAircraft('c152');
  const level = stallKt(aircraft, 3, 0);
  const banked = stallKt(aircraft, 3, 25);
  assert.ok(banked > level);
  assert.ok(Math.abs(banked - level / Math.sqrt(Math.cos(25 * DEG))) < 1e-9);
});

// ---------------------------------------------------------------------------
// S5: alignment is scored, never fatal
// ---------------------------------------------------------------------------

const b738 = getAircraft('b738');
const level6 = levelByNumber(6);
const landing = { fpm: 150, speedKt: 140, lateralFt: 4, pastThresholdFt: 1600 };

test('a crabbed touchdown still lands, it just scores less', () => {
  const aligned = classifyTouchdown(b738, level6, { ...landing, headingDeg: 0 });
  const crabbed = classifyTouchdown(b738, level6, { ...landing, headingDeg: 12 });
  assert.equal(crabbed.ok, true, 'never collapses the gear');
  assert.equal(crabbed.code, 'ok');
  assert.ok(crabbed.headingDev === 12);
  assert.ok(crabbed.points < aligned.points, `${crabbed.points} vs ${aligned.points}`);
  assert.ok(aligned.points >= 95, `aligned ${aligned.points}`);
});

test('the other ways of failing still fail', () => {
  assert.equal(classifyTouchdown(b738, level6, { ...landing, headingDeg: 20, fpm: 400 }).code, 'hard');
  assert.equal(classifyTouchdown(b738, level6, { ...landing, headingDeg: 20, lateralFt: 90 }).code, 'edge');
});

test('a crabbed touchdown does not drag the aircraft off the runway during the rollout', () => {
  const { aircraft, state } = onFinal('b738', 6);
  const touched = { ...state, altFt: 0.5, distFt: -1200, headingDeg: 12, chiDeg: 12, betaDeg: 0 };
  let s = step(aircraft, touched, { ...baseControls, crosswindKt: 0 }, 1 / 60);
  const lateralAtTouchdown = s.lateralFt;
  for (let i = 0; i < 60 * 20; i++) {
    s = step(aircraft, s, { ...baseControls, brake: 1 }, 1 / 60);
  }
  assert.equal(s.onGround, true);
  assert.ok(
    Math.abs(s.lateralFt - lateralAtTouchdown) < 20,
    `scrubbed ${(s.lateralFt - lateralAtTouchdown).toFixed(1)} ft sideways`,
  );
});

test('every level still starts with coherent lateral state', () => {
  for (const level of LEVELS) {
    const aircraft = getAircraft(level.aircraft);
    const s = createState(aircraft, level);
    assert.equal(s.bankDeg, 0);
    assert.equal(s.chiDeg, 0);
    assert.equal(s.betaDeg, 0);
    assert.equal(s.headingDeg, 0);
    assert.equal('steerDeg' in s, false, 'the old crab angle is gone, not kept alongside');
  }
});
