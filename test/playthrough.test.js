// End-to-end: fly every level through the real input path — key presses, the
// game loop, the touchdown grade — with a simple autopilot on the keyboard.
// This is the test that catches tuning regressions: if a level stops being
// landable, it fails here rather than in front of the player.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/game.js';
import { autopilotInputs } from './helpers/autopilot.js';



/**
 * Flies the selected level to touchdown using nothing but key presses and
 * returns the finished game. Heavy aircraft flare earlier: their pitch response
 * and engine spool lag make a 50 ft flare impossible.
 */
function flyLevel(index, { maxSeconds = 400 } = {}) {
  const api = createGame({ storage: null });
  api.startLevel(index);
  api.begin();
  const game = api.game;
  const aircraft = game.aircraft;
  const level = game.level;

  // Checklist: flaps to the landing detent, gear down.
  const lastDetent = aircraft.flaps.length - 1;
  let guard = 0;
  while (game.state.flapIdx < lastDetent && guard++ < 20) {
    api.press('KeyF');
    api.release('KeyF');
  }
  if (aircraft.gear === 'retractable' && !game.state.gearDown) {
    api.press('KeyG');
    api.release('KeyG');
  }

  const held = new Set();
  const hold = (code, on) => {
    if (on && !held.has(code)) {
      api.press(code);
      held.add(code);
    } else if (!on && held.has(code)) {
      api.release(code);
      held.delete(code);
    }
  };

  let steps = 0;

  while (game.phase !== 'result' && steps++ < 60 * maxSeconds) {
    const s = game.state;

    if (s.onGround) {
      hold('Space', true);
      if (aircraft.reverse) hold('KeyB', true);
      if (aircraft.spoilers) hold('KeyX', true);
      api.update(1 / 60);
      continue;
    }

    const inputs = autopilotInputs(s, aircraft, level);
    hold('KeyW', inputs.pitch > 0.01);
    hold('KeyS', inputs.pitch < -0.01);
    hold('KeyD', inputs.aileron > 0.01);
    hold('KeyA', inputs.aileron < -0.01);
    hold('KeyE', inputs.rudder > 0.01);
    hold('KeyQ', inputs.rudder < -0.01);
    hold('ArrowUp', inputs.throttleUp);
    hold('ArrowDown', inputs.throttleDown);

    api.update(1 / 60);
  }

  return { api, seconds: steps / 60 };
}

for (const index of [0, 1, 2, 3, 4, 5, 6]) {
  test(`level ${index + 1} can be landed from the keyboard`, () => {
    const { api, seconds } = flyLevel(index);
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
