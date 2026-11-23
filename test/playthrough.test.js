// End-to-end: fly every level through the real input path — key presses, the
// game loop, the touchdown grade — with a simple autopilot on the keyboard.
// This is the test that catches tuning regressions: if a level stops being
// landable, it fails here rather than in front of the player.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/game.js';
import { alphaDeg, glidePathSinkFpm } from '../src/physics.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

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

  const flareFt = aircraft.massT > 20 ? 80 : 50;
  const touchdownSink = 150;
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

    const groundKt = Math.max(30, s.groundSpeedKt ?? s.speedKt);
    const pathSink = glidePathSinkFpm(groundKt);
    const sinkTarget =
      s.altFt < flareFt ? touchdownSink + (pathSink - touchdownSink) * (s.altFt / flareFt) : pathSink;

    const gammaDeg = (-Math.asin(Math.min(0.9, sinkTarget / (s.speedKt * 101.27))) * 180) / Math.PI;
    const pitchTarget = clamp(alphaDeg(aircraft, s.speedKt) + gammaDeg, 0, 20);
    hold('ArrowUp', s.pitchDeg < pitchTarget - 0.3);
    hold('ArrowDown', s.pitchDeg > pitchTarget + 0.3);

    hold('KeyE', s.speedKt < aircraft.vrefKt - 1);
    hold('KeyQ', s.speedKt > aircraft.vrefKt + 1);

    const crabDeg =
      (Math.asin(clamp(level.crosswindKt / Math.max(1, groundKt), -0.5, 0.5)) * 180) / Math.PI;
    const steerTarget = clamp(-crabDeg - s.lateralFt / 250, -12, 12);
    hold('ArrowRight', s.steerDeg < steerTarget - 0.2);
    hold('ArrowLeft', s.steerDeg > steerTarget + 0.2);

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
  // Dive at the runway with the nose down and full power.
  api.press('ArrowDown');
  api.press('KeyE');
  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 200) api.update(1 / 60);
  assert.equal(api.game.phase, 'result');
  assert.equal(api.game.result.ok, false);
});
