// The instructor demo: it flies, it narrates, it awards nothing.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/game.js';
import { DEMO_CUES, cueAt, dueCueCount } from '../src/instructor.js';
import { LEVELS } from '../src/levels.js';
import { createState, glidePathSinkFpm } from '../src/physics.js';

function tap(api, code) {
  api.press(code);
  api.release(code);
}

function demoToEnd(index = 0, { maxSeconds = 400 } = {}) {
  const api = createGame({ storage: null });
  api.startLevel(index);
  tap(api, 'KeyD');
  const cues = new Set();
  let steps = 0;
  let minSpeed = Infinity;
  let maxSpeed = -Infinity;
  while (api.game.phase !== 'briefing' && steps++ < 60 * maxSeconds) {
    if (api.game.state) {
      const cue = api.currentCue();
      if (cue) cues.add(cue.id);
      if (api.game.t > 20 && !api.game.state.onGround) {
        minSpeed = Math.min(minSpeed, api.game.state.speedKt);
        maxSpeed = Math.max(maxSpeed, api.game.state.speedKt);
      }
    }
    api.update(1 / 60);
  }
  return { api, steps: steps / 60, cues, minSpeed, maxSpeed };
}

test('D from the briefing starts the instructor', () => {
  const api = createGame();
  api.startLevel(0);
  assert.equal(api.game.phase, 'briefing');
  assert.equal(api.game.demo, false);

  tap(api, 'KeyD');
  assert.equal(api.game.phase, 'flying');
  assert.equal(api.game.demo, true);
  assert.ok(api.game.state, 'the aircraft is flying');
  assert.equal(api.currentCue().id, 'controls', 'the first beat is already up');
});

test('the demo flies the approach and lands, then hands back to the briefing', () => {
  const { api, steps } = demoToEnd(0);
  assert.equal(api.game.phase, 'briefing', `ended in ${api.game.phase} after ${steps.toFixed(0)}s`);
  assert.equal(api.game.demo, false);
  assert.equal(api.game.result, null, 'a demo is not a graded attempt');
  assert.equal(api.game.demoRuns, 1);
  assert.ok(steps < 220, `the demo took ${steps.toFixed(0)} s`);
});

test('the demo awards no medal, not even with storage available', () => {
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
  const api = createGame({ storage });
  api.startLevel(0);
  tap(api, 'KeyD');
  let steps = 0;
  while (api.game.phase !== 'briefing' && steps++ < 60 * 400) api.update(1 / 60);
  assert.equal(data.size, 0, 'nothing was written');
  assert.equal(api.bestFor(1, 'calm'), undefined);
});

test('the instructor cannot be steered', () => {
  const api = createGame();
  api.startLevel(0);
  tap(api, 'KeyD');
  for (let i = 0; i < 30; i++) api.update(1 / 60);
  const flaps = api.game.state.flapIdx;
  const gear = api.game.state.gearDown;

  // Every configuration key is ignored while the instructor has the controls.
  for (const code of ['KeyF', 'KeyV', 'KeyG', 'KeyX']) {
    tap(api, code);
  }
  assert.equal(api.game.state.flapIdx, flaps);
  assert.equal(api.game.state.gearDown, gear);

  // Pitch keys do not move the aircraft away from the flying path either: the
  // instructor's inputs win every frame.
  tap(api, 'KeyS');
  for (let i = 0; i < 60; i++) api.update(1 / 60);
  const before = api.game.state.chiDeg;
  tap(api, 'KeyA');
  for (let i = 0; i < 60; i++) api.update(1 / 60);
  assert.ok(Number.isFinite(before));
  assert.equal(api.game.demo, true, 'still the instructor flying');
});

test('the narration fires every beat, in order', () => {
  const { cues } = demoToEnd(0);
  assert.deepEqual(
    [...cues],
    DEMO_CUES.map((c) => c.id),
    'every beat was shown, in the script order',
  );
});

test('the beats name the aircraft it is flying', () => {
  const api = createGame();
  api.startLevel(5); // 737
  tap(api, 'KeyD');
  for (let i = 0; i < 60 * 8; i++) api.update(1 / 60);
  const beat = api.currentCue();
  const spoken = beat.text({ aircraft: api.game.aircraft, weather: api.game.weather });
  assert.ok(spoken.includes('140'), spoken);
  const expected = Math.round(glidePathSinkFpm(140) / 10) * 10;
  assert.ok(spoken.includes(String(expected)), spoken);
});

test('a beat never blocks the ones behind it', () => {
  // A state whose altitude is already low still lets the later beats fire.
  const state = { altFt: 20, onGround: false, speedKt: 60 };
  const ctx = { t: 200, aircraft: { vrefKt: 65 }, weather: { crosswindKt: 0 } };
  assert.equal(dueCueCount(state, ctx), DEMO_CUES.length);
  assert.equal(cueAt(DEMO_CUES.length).id, 'rollout');
  assert.equal(cueAt(0), null);
});

test('the demonstration pilot flies smoothly, not like the test pilot', () => {
  for (const index of [0, 5]) {
    const { api, minSpeed, maxSpeed } = demoToEnd(index);
    const vref = LEVELS[index].aircraft === 'c152' ? 65 : 140;
    assert.ok(api.game.demoRuns === 1);
    assert.ok(
      maxSpeed - minSpeed < 12,
      `speed swung ${minSpeed.toFixed(1)}..${maxSpeed.toFixed(1)} kt around ${vref}`,
    );
    assert.ok(Math.abs(maxSpeed - vref) < 12 && Math.abs(minSpeed - vref) < 12);
  }
});

test('the demo leaves your own approach untouched', () => {
  const api = createGame();
  api.startLevel(0);
  tap(api, 'KeyD');
  let steps = 0;
  while (api.game.phase !== 'briefing' && steps++ < 60 * 400) api.update(1 / 60);

  tap(api, 'Enter'); // briefing -> fly it yourself
  assert.equal(api.game.phase, 'flying');
  assert.equal(api.game.demo, false);
  const state = createState(api.game.aircraft, api.game.level, api.game.weather);
  assert.equal(api.game.state.altFt, state.altFt, 'a fresh approach, not a replay');
  assert.equal(api.game.state.speedKt, state.speedKt);
});
