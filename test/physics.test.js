import test from 'node:test';
import assert from 'node:assert/strict';

import { AIRCRAFT, getAircraft } from '../src/aircraft.js';
import { LEVELS, levelByNumber } from '../src/levels.js';
import { autopilotInputs, integrateThrottle } from './helpers/autopilot.js';
import {
  alphaDeg,
  classifyTouchdown,
  createState,
  glidePathAltFt,
  glidePathSinkFpm,
  glidePathTouchdownFt,
  setFlapSetting,
  setGearDown,
  speedAccelKtS,
  stallKt,
  step,
  stepThrust,
} from '../src/physics.js';

const FLAPS_FULL = (a) => a.flaps.length - 1;

// ---------------------------------------------------------------------------
// S3 / S4 - the aircraft ladder
// ---------------------------------------------------------------------------

test('ladder has seven levels, trainer first, A380 last', () => {
  assert.equal(LEVELS.length, 7);
  assert.deepEqual(
    LEVELS.map((l) => l.n),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(levelByNumber(1).aircraft, 'c152');
  assert.equal(levelByNumber(7).aircraft, 'a388');
});

test('level 3 is the Cessna 208B Grand Caravan', () => {
  const level = levelByNumber(3);
  assert.equal(level.aircraft, 'c208');
  const caravan = getAircraft(level.aircraft);
  assert.equal(caravan.name, 'Cessna 208B Grand Caravan');
  assert.equal(caravan.kind, 'turboprop');
  assert.equal(caravan.reverse, true);
  // It is heavier than the 172 it follows and lighter than the King Air after it.
  assert.ok(caravan.massT > getAircraft('c172').massT);
  assert.ok(caravan.massT < getAircraft('b350').massT);
  assert.ok(caravan.vrefKt > getAircraft('c172').vrefKt);
});

test('the displaced aircraft kept their order and each level flies its own aircraft', () => {
  assert.deepEqual(
    LEVELS.map((l) => l.aircraft),
    ['c152', 'c172', 'c208', 'b350', 'e175', 'b738', 'a388'],
  );
  for (const level of LEVELS) {
    assert.ok(getAircraft(level.aircraft), `level ${level.n} has an aircraft`);
  }
});

test('approach speed and mass grow across the ladder', () => {
  const seq = LEVELS.map((l) => getAircraft(l.aircraft));
  for (let i = 1; i < seq.length; i++) {
    assert.ok(seq[i].vrefKt > seq[i - 1].vrefKt, `${seq[i].name} is faster`);
    if (seq[i].id !== 'c208') {
      // The Caravan is intentionally the light, high-drag step between two heavies.
      assert.ok(seq[i].massT > seq[i - 1].massT, `${seq[i].name} is heavier`);
    }
  }
});

// ---------------------------------------------------------------------------
// S6 - glide path and energy
// ---------------------------------------------------------------------------

test('the 3 degree path climbs 318 ft per nautical mile and crosses the threshold at 50 ft', () => {
  assert.ok(Math.abs(glidePathAltFt(1) - 368.4) < 0.5);
  assert.ok(Math.abs(glidePathAltFt(5) - 1641.9) < 2);
  assert.equal(glidePathAltFt(0), 50);
  assert.ok(Math.abs(glidePathTouchdownFt() - 954) < 2);
});

test('a 737 at 140 kt on the 3 degree path sinks about 740 fpm', () => {
  const fpm = glidePathSinkFpm(140);
  assert.ok(fpm > 700 && fpm < 780, `got ${fpm}`);
});

test('every aircraft holds Vref on the 3 degree path at approach thrust', () => {
  for (const a of AIRCRAFT) {
    const accel = speedAccelKtS(
      a,
      {
        speedKt: a.vrefKt,
        thrust: a.thrustAtApproach,
        flapIdx: FLAPS_FULL(a),
        gearDown: true,
        spoilers: false,
        stalled: false,
      },
      -3,
    );
    assert.ok(Math.abs(accel) < 0.05, `${a.name} drifts ${accel.toFixed(3)} kt/s`);
  }
});

test('nosing up off the path bleeds speed', () => {
  const a = getAircraft('b738');
  const base = {
    speedKt: a.vrefKt,
    thrust: a.thrustAtApproach,
    flapIdx: FLAPS_FULL(a),
    gearDown: true,
    spoilers: false,
    stalled: false,
  };
  const path = speedAccelKtS(a, base, -3);
  const shallower = speedAccelKtS(a, base, -1);
  const steeper = speedAccelKtS(a, base, -5);
  assert.ok(shallower < path - 0.5, 'raising the flight path decelerates');
  assert.ok(steeper > path + 0.5, 'lowering the flight path accelerates');
});

test('more flaps lower stall speed and add drag', () => {
  const a = getAircraft('c152');
  assert.ok(stallKt(a, 0) > stallKt(a, FLAPS_FULL(a)));
  assert.ok(Math.abs(stallKt(a, FLAPS_FULL(a)) - a.vsoKt) < 0.01);
});

test('a jet spools far slower than a piston', () => {
  const spoolSeconds = (spoolS, fraction) => {
    let actual = 0;
    let t = 0;
    const dt = 1 / 60;
    while (t < 60 && actual < fraction) {
      actual = stepThrust(actual, 1, spoolS, dt);
      t += dt;
    }
    return t;
  };
  const jet = spoolSeconds(getAircraft('a388').spoolS, 0.5);
  const piston = spoolSeconds(getAircraft('c152').spoolS, 0.5);
  assert.ok(jet > 4, `A380 reaches half thrust in ${jet.toFixed(1)}s`);
  assert.ok(piston < 1, `C152 reaches half thrust in ${piston.toFixed(1)}s`);
  assert.ok(jet > 6 * piston);
});

test('retractable gear only moves on retractable aircraft', () => {
  const jet = getAircraft('b738');
  const level = levelByNumber(6);
  const clean = createState(jet, level);
  assert.equal(clean.gearDown, false);
  const dirty = setGearDown(jet, clean, true);
  assert.equal(dirty.gearDown, true);
  // Gear down adds drag, so the aircraft accelerates less for the same path.
  assert.ok(speedAccelKtS(jet, dirty, -3) < speedAccelKtS(jet, clean, -3));

  const trainer = getAircraft('c152');
  const trainerState = createState(trainer, levelByNumber(1));
  assert.equal(setGearDown(trainer, trainerState, false).gearDown, true);
});

test('flaps move one detent and stop at the ends', () => {
  const a = getAircraft('c172');
  let s = createState(a, levelByNumber(1));
  const full = FLAPS_FULL(a);
  assert.equal(s.flapIdx, full);
  s = setFlapSetting(a, s, -1);
  assert.equal(s.flapIdx, full - 1);
  assert.ok(s.stallKt > a.vsoKt);
  for (let i = 0; i < 6; i++) s = setFlapSetting(a, s, -1);
  assert.equal(s.flapIdx, 0);
  for (let i = 0; i < 6; i++) s = setFlapSetting(a, s, +1);
  assert.equal(s.flapIdx, full);
});

// ---------------------------------------------------------------------------
// S7 - touchdown evaluation
// ---------------------------------------------------------------------------

const b738 = getAircraft('b738');
const level6 = levelByNumber(6);
const good = { fpm: 120, speedKt: 140, lateralFt: 4, pastThresholdFt: 1000 };

test('a smooth landing inside the zone is scored with a medal', () => {
  const r = classifyTouchdown(b738, level6, good);
  assert.equal(r.ok, true);
  assert.equal(r.code, 'ok');
  assert.equal(r.medal, 'gold');
  assert.ok(r.points > 0 && r.points <= 100);
});

test('a hard touchdown collapses the gear', () => {
  assert.equal(classifyTouchdown(b738, level6, { ...good, fpm: 350 }).code, 'hard');
  // The 300 fpm limit itself is still a landing.
  assert.equal(classifyTouchdown(b738, level6, { ...good, fpm: 300 }).code, 'ok');
  assert.equal(classifyTouchdown(b738, level6, { ...good, fpm: 301 }).code, 'hard');
});

test('touching down short of the threshold is an undershoot', () => {
  assert.equal(classifyTouchdown(b738, level6, { ...good, pastThresholdFt: -40 }).code, 'short');
});

test('touching down past the zone is an overrun', () => {
  const tdzFt = classifyTouchdown(b738, level6, good).tdzFt;
  assert.equal(tdzFt, 3000);
  assert.equal(classifyTouchdown(b738, level6, { ...good, pastThresholdFt: tdzFt - 1 }).code, 'ok');
  assert.equal(classifyTouchdown(b738, level6, { ...good, pastThresholdFt: tdzFt + 1 }).code, 'long');
  // A short strip is checked against its own, smaller zone.
  const shortField = classifyTouchdown(getAircraft('c152'), levelByNumber(1), {
    fpm: 120,
    speedKt: 65,
    lateralFt: 0,
    pastThresholdFt: 2400,
  });
  assert.equal(shortField.tdzFt, 2362);
  assert.equal(shortField.code, 'long');
  // A stabilised approach with a normal flare lands inside it.
  assert.equal(
    classifyTouchdown(getAircraft('c152'), levelByNumber(1), {
      fpm: 150,
      speedKt: 65,
      lateralFt: 4,
      pastThresholdFt: 1454,
    }).code,
    'ok',
  );
});

test('leaving the runway edge fails the landing', () => {
  assert.equal(classifyTouchdown(b738, level6, { ...good, lateralFt: 80 }).code, 'edge');
});

test('speed outside 10 kt of reference fails the landing', () => {
  assert.equal(classifyTouchdown(b738, level6, { ...good, speedKt: 155 }).code, 'speed');
  assert.equal(classifyTouchdown(b738, level6, { ...good, speedKt: 125 }).code, 'speed');
  assert.equal(classifyTouchdown(b738, level6, { ...good, speedKt: 149 }).code, 'ok');
});

test('precision changes the medal, not just the pass', () => {
  const sloppy = classifyTouchdown(b738, level6, {
    fpm: 240,
    speedKt: 147,
    lateralFt: 30,
    pastThresholdFt: 2600,
  });
  assert.equal(sloppy.ok, true);
  assert.ok(['bronze', 'rough'].includes(sloppy.medal), sloppy.medal);
  assert.ok(sloppy.points < classifyTouchdown(b738, level6, good).points);
});

// ---------------------------------------------------------------------------
// S6 - closed loop: the model can actually be flown to a landing
// ---------------------------------------------------------------------------

function flyLevel(aircraft, level) {
  const dt = 1 / 60;
  let s = createState(aircraft, level);
  // The pilot runs the approach checklist before joining the path.
  for (let i = 0; i < aircraft.flaps.length; i++) s = setFlapSetting(aircraft, s, +1);
  s = setGearDown(aircraft, s, true);

  let throttle = aircraft.thrustAtApproach;
  let t = 0;
  const controls = {
    crosswindKt: level.crosswindKt,
    headwindKt: level.headwindKt,
    gustFpm: 0,
    wet: level.wet,
  };

  while (t < 400 && !s.stopped) {
    if (!s.onGround) {
      const inputs = autopilotInputs(s, aircraft, level);
      throttle = integrateThrottle(throttle, inputs, dt);
      Object.assign(controls, {
        pitch: inputs.pitch,
        aileron: inputs.aileron,
        rudder: inputs.rudder,
        throttle,
        brake: 0,
        reverse: false,
        spoilers: false,
      });
    } else {
      Object.assign(controls, {
        pitch: 0,
        aileron: 0,
        rudder: 0,
        throttle: 0,
        brake: 1,
        reverse: true,
        spoilers: true,
      });
    }
    s = step(aircraft, s, controls, dt);
    t += dt;
  }
  return s;
}

test('the first level starts configured, later levels make you configure', () => {
  const trainer = createState(getAircraft('c152'), levelByNumber(1));
  assert.equal(trainer.flapIdx, getAircraft('c152').flaps.length - 1);
  assert.equal(trainer.gearDown, true);

  const caravan = getAircraft('c208');
  const caravanState = createState(caravan, levelByNumber(3));
  assert.equal(caravanState.flapIdx, 0);

  const jet = getAircraft('b738');
  const jetState = createState(jet, levelByNumber(6));
  assert.equal(jetState.flapIdx, 0);
  assert.equal(jetState.gearDown, false);
});

test('the closed-loop model lands the Cessna 152 in limits', () => {
  const a = getAircraft('c152');
  const level = levelByNumber(1);
  const s = flyLevel(a, level);
  assert.ok(s.touchdown, 'the aircraft reached the ground');
  const r = classifyTouchdown(a, level, s.touchdown);
  assert.equal(r.code, 'ok', JSON.stringify(r));
  assert.ok(r.fpm < 300);
  assert.ok(Math.abs(r.speedDev) <= 10);
});

test('the closed-loop model lands the A380 in limits', () => {
  const a = getAircraft('a388');
  const level = levelByNumber(7);
  const s = flyLevel(a, level);
  assert.ok(s.touchdown, 'the aircraft reached the ground');
  const r = classifyTouchdown(a, level, s.touchdown);
  assert.equal(r.code, 'ok', JSON.stringify(r));
});

test('an aircraft left nose-up with idle power stalls before the runway', () => {
  const a = getAircraft('b738');
  const level = levelByNumber(6);
  let s = createState(a, level);
  const controls = {
    pitch: 1,
    aileron: 0,
    rudder: 0,
    throttle: 0,
    crosswindKt: 0,
    headwindKt: 0,
  };
  let sawStall = false;
  for (let i = 0; i < 60 * 240 && !s.onGround; i++) {
    s = step(a, s, controls, 1 / 60);
    if (s.stalled) sawStall = true;
  }
  assert.ok(sawStall, 'the wing gave up');
  assert.ok(s.onGround, 'and it came down hard');
  assert.ok(s.touchdown.fpm > 300, `sink ${Math.round(s.touchdown.fpm)} fpm`);
});
