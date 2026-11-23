// End-to-end: fly every level through the real input path with the keyboard
// pilot, and require a medal. This is the guard on tuning: if a level stops
// being landable, it fails here rather than in front of the player.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/game.js';
import { flyLevel } from './helpers/keyboard-pilot.js';

for (const index of [0, 1, 2, 3, 4, 5, 6]) {
  test(`level ${index + 1} can be landed from the keyboard`, () => {
    const { api, seconds } = flyLevel({ levelIndex: index });
    const game = api.game;
    assert.equal(game.phase, 'result', 'the attempt finished');
    const r = game.result;
    assert.equal(r.ok, true, `${game.aircraft.name}: ${r.code} ${r.label}`);
    assert.ok(
      ['gold', 'silver', 'bronze'].includes(r.medal),
      `${game.aircraft.name} scored ${r.medal} (${r.points})`,
    );
    assert.ok(r.fpm < 300, `sink ${r.fpm} fpm`);
    assert.ok(Math.abs(r.speedDev) <= 10, `speed ${r.speedDev} kt off reference`);
    assert.ok(Math.abs(r.headingDev) <= 6, `nose ${r.headingDev} degrees off the axis`);
    assert.ok(seconds < 200, `${seconds.toFixed(0)} s is too long an approach`);
  });
}

test('a level can be failed on purpose, so the grade is not always a medal', () => {
  const api = createGame({ storage: null });
  api.startLevel(5);
  api.begin();

  // The remap is real: arrows carry throttle now, they no longer pitch.
  const pitchBefore = api.game.state.pitchDeg;
  api.press('ArrowDown');
  for (let i = 0; i < 20; i++) api.update(1 / 60);
  assert.ok(
    Math.abs(api.game.state.pitchDeg - pitchBefore) < 0.5,
    `pitch moved to ${api.game.state.pitchDeg}`,
  );
  api.release('ArrowDown');

  // Dive at the runway: nose down with S, power up with the up arrow.
  api.press('KeyS');
  api.press('ArrowUp');
  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 200) api.update(1 / 60);
  assert.equal(api.game.phase, 'result');
  assert.equal(api.game.result.ok, false);
});
