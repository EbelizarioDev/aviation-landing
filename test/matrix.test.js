// S7 of the difficulty feature: every one of the 28 aircraft x weather cells
// has to be landable. This is the whole point of the matrix — it is generated
// and proven, not hand-tuned.

import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS } from '../src/levels.js';
import { WEATHER } from '../src/weather.js';
import { flyLevel } from './helpers/keyboard-pilot.js';

for (const profile of WEATHER) {
  test(`every aircraft can be landed in ${profile.name.toLowerCase()}`, () => {
    const failures = [];
    const medals = [];
    for (let index = 0; index < LEVELS.length; index++) {
      const { api, seconds } = flyLevel({ levelIndex: index, weatherId: profile.id });
      const game = api.game;
      assert.equal(game.weather.id, profile.id, 'the profile was actually applied');
      const r = game.result;
      if (!r || !r.ok) {
        failures.push(`${game.aircraft.name}: ${r ? r.code : 'no result'}`);
      } else {
        medals.push(`${game.aircraft.id}=${r.medal}`);
      }
      assert.ok(seconds < 260, `${game.aircraft.name} took ${seconds.toFixed(0)} s`);
    }
    assert.deepEqual(failures, [], `cells that cannot be landed: ${failures.join(', ')}`);
    assert.equal(medals.length, LEVELS.length);
  });
}

test('the same aircraft is harder in a worse sky', () => {
  const calm = flyLevel({ levelIndex: 5, weatherId: 'calm' }).api.game.result;
  const storm = flyLevel({ levelIndex: 5, weatherId: 'storm' }).api.game.result;
  assert.ok(calm.points > storm.points, `calm ${calm.points} vs storm ${storm.points}`);
});

test('weather changes the numbers, not the aircraft', () => {
  const calm = flyLevel({ levelIndex: 2, weatherId: 'calm' }).api.game;
  const snow = flyLevel({ levelIndex: 2, weatherId: 'snow' }).api.game;
  assert.equal(calm.aircraft.id, snow.aircraft.id);
  assert.notEqual(calm.weather.id, snow.weather.id);
  assert.ok(snow.result.endFt > calm.result.endFt, 'the contaminated runway costs rollout');
});
