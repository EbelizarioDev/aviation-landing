// S1: difficulty is a weather axis, independent of the aircraft ladder.

import test from 'node:test';
import assert from 'node:assert/strict';

import { getAircraft } from '../src/aircraft.js';
import { LEVELS } from '../src/levels.js';
import { createState, step } from '../src/physics.js';
import {
  WEATHER,
  beyondCrosswindLimit,
  brakingFactor,
  getWeather,
  gustAt,
  hazeAmount,
} from '../src/weather.js';

test('there are four profiles, from calm to contaminated', () => {
  assert.deepEqual(
    WEATHER.map((w) => w.id),
    ['calm', 'windy', 'storm', 'snow'],
  );
  for (const w of WEATHER) {
    assert.ok(w.name && w.tagline && w.brief, `${w.id} explains itself`);
    assert.ok(w.crosswindKt >= 0);
    assert.ok(w.visibilityNm > 0);
  }
});

test('the crosswind grows from calm to storm', () => {
  const winds = WEATHER.map((w) => w.crosswindKt);
  assert.equal(winds[0], 0);
  assert.ok(winds[1] > winds[0]);
  assert.ok(winds[2] > winds[1]);
  assert.ok(winds[2] >= 15, 'a storm has to be a real crosswind');
});

test('the runway surface decides the braking', () => {
  assert.equal(brakingFactor('dry'), 1);
  assert.ok(brakingFactor('wet') < brakingFactor('dry'));
  assert.ok(brakingFactor('snow') < brakingFactor('wet'));
});

test('a contaminated runway takes longer to stop in', () => {
  const aircraft = getAircraft('b738');
  const level = LEVELS[5];
  const dryRun = (profile) => {
    let s = {
      ...createState(aircraft, level, profile),
      onGround: true,
      altFt: 0,
      speedKt: 140,
      distFt: -1500,
      touchdown: { fpm: 120, speedKt: 140, lateralFt: 0, headingDeg: 0, pastThresholdFt: 1500, rollFt: 0 },
    };
    let steps = 0;
    while (!s.stopped && steps++ < 60 * 120) {
      s = step(
        aircraft,
        s,
        { brake: 1, reverse: false, spoilers: false, throttle: 0, pitch: 0, aileron: 0, rudder: 0, brakingFactor: brakingFactor(profile.runway) },
        1 / 60,
      );
    }
    return s.rollFt;
  };
  const dry = dryRun(getWeather('windy'));
  const snow = dryRun(getWeather('snow'));
  assert.ok(snow > dry * 2, `${snow.toFixed(0)} ft in snow vs ${dry.toFixed(0)} ft dry`);
});

test('gusts are deterministic, so an approach can be replayed', () => {
  const storm = getWeather('storm');
  assert.equal(gustAt(storm, 12.5, 500), gustAt(storm, 12.5, 500));
  assert.notEqual(gustAt(storm, 12.5, 500), gustAt(storm, 13.5, 500));
  const calm = getWeather('calm');
  assert.equal(gustAt(calm, 12.5, 500), 0);
});

test('gusts fade to nothing at the surface', () => {
  const storm = getWeather('storm');
  assert.equal(gustAt(storm, 7, 0), 0);
  const low = Math.abs(gustAt(storm, 7, 20));
  const high = Math.abs(gustAt(storm, 7, 200));
  assert.ok(low < high * 0.25, `low ${low.toFixed(0)} vs high ${high.toFixed(0)}`);
  for (let t = 0; t < 60; t += 0.37) {
    assert.ok(Math.abs(gustAt(storm, t, 1000)) <= storm.gustFpm + 1e-9);
  }
});

test('visibility hides more as it drops', () => {
  assert.equal(hazeAmount(getWeather('calm')), 0);
  assert.ok(hazeAmount(getWeather('storm')) > 0);
  assert.ok(hazeAmount(getWeather('snow')) > hazeAmount(getWeather('storm')));
  assert.ok(hazeAmount(getWeather('snow')) < 1, 'the runway never disappears completely');
});

test('each level carries a resolved weather profile', () => {
  for (const level of LEVELS) {
    assert.ok(level.weather, `level ${level.n}`);
    assert.equal(typeof level.weather.crosswindKt, 'number');
    assert.equal(typeof level.weather.headwindKt, 'number');
    assert.ok(level.weather.runway);
  }
});

test('the light aircraft in a storm is flagged as beyond its limit', () => {
  const storm = getWeather('storm');
  assert.equal(beyondCrosswindLimit(getAircraft('c152'), storm), true);
  assert.equal(beyondCrosswindLimit(getAircraft('a388'), storm), false);
  assert.equal(beyondCrosswindLimit(getAircraft('c152'), getWeather('calm')), false);
});

test('the headwind is what makes the ground speed differ from the airspeed', () => {
  const aircraft = getAircraft('b738');
  const level = LEVELS[5];
  const windy = createState(aircraft, level, getWeather('windy'));
  const calm = createState(aircraft, level, getWeather('calm'));
  assert.equal(calm.groundSpeedKt, calm.speedKt);
  assert.ok(windy.groundSpeedKt < windy.speedKt, 'a headwind slows the ground speed');
  assert.equal(
    Math.round(windy.speedKt - windy.groundSpeedKt),
    getWeather('windy').headwindKt,
  );
});

test('wetter and calmer profiles still let every aircraft start configured or clean', () => {
  for (const level of LEVELS) {
    const aircraft = getAircraft(level.aircraft);
    for (const profile of WEATHER) {
      const s = createState(aircraft, level, profile);
      assert.ok(s.speedKt > s.stallKt, `${aircraft.id} starts above stall in ${profile.id}`);
      assert.ok(s.altFt > 300, `${aircraft.id} starts with an approach to fly`);
    }
  }
});
