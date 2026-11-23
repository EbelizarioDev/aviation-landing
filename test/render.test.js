import test from 'node:test';
import assert from 'node:assert/strict';

import { getAircraft } from '../src/aircraft.js';
import { LEVELS } from '../src/levels.js';
import { createState, step } from '../src/physics.js';
import { VIEW } from '../src/render/layout.js';
import { drawCockpit } from '../src/render/cockpit.js';
import { drawPanel } from '../src/render/panel.js';
import { drawMinimap } from '../src/render/minimap.js';
import { labels, stubContext } from './helpers/canvas-stub.js';
import { WEATHER } from '../src/weather.js';
import {
  makeCamera,
  pathDeviationFt,
  papiWhiteCount,
  project,
} from '../src/render/projection.js';

// ---------------------------------------------------------------------------
// A recording stub for CanvasRenderingContext2D: enough surface for the three
// renderers, and it records what was drawn so "nothing throws" is not the only
// thing we can assert.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function stateAt(distNm, altFt, extra = {}) {
  return {
    altFt,
    distFt: distNm * 6076.12,
    pitchDeg: 5,
    lateralFt: 0,
    speedKt: 70,
    groundSpeedKt: 70,
    vsiFpm: -400,
    ...extra,
  };
}

test('the runway converges toward the horizon as it recedes', () => {
  const cam = makeCamera(stateAt(3, 1000), { cx: 480, horizonY: 200 });
  const near = project(cam, 49, 0, 1000);
  const far = project(cam, 49, 0, 20000);
  const distant = project(cam, 49, 0, 400000);
  assert.ok(near.x - cam.cx > far.x - cam.cx, 'the right edge moves toward the centre');
  assert.ok(far.y < near.y, 'the far edge sits higher');
  assert.ok(distant.y > cam.horizonY, 'but never above the horizon');
  assert.ok(distant.y - cam.horizonY < 5, 'and it approaches it');
});

test('the runway centreline dead ahead projects to the centre of the windshield', () => {
  const cam = makeCamera(stateAt(3, 800), { cx: 480, horizonY: 200 });
  const p = project(cam, 0, 0, 5000);
  assert.ok(Math.abs(p.x - 480) < 0.001);
});

test('a lateral offset shifts the runway to the other side of the sight line', () => {
  const cam = makeCamera(stateAt(3, 800, { lateralFt: 40 }), { cx: 480, horizonY: 200 });
  const p = project(cam, 0, 0, 5000);
  assert.ok(p.x < 480, 'right of centreline means the centreline appears left');
});

test('nose up lowers the horizon on the windshield', () => {
  const level = makeCamera(stateAt(3, 800, { pitchDeg: 0 }), { cx: 480, horizonY: 200 });
  const nose = makeCamera(stateAt(3, 800, { pitchDeg: 8 }), { cx: 480, horizonY: 200 });
  assert.ok(nose.horizonY > level.horizonY);
});

test('the PAPI shows two white on the path, four when high, none when low', () => {
  const on = stateAt(3, 3 * 318.44 + 50);
  assert.equal(papiWhiteCount(on), 2);
  assert.ok(pathDeviationFt(on) < 1);
  assert.equal(papiWhiteCount(stateAt(3, 3 * 318.44 + 50 + 200)), 4);
  assert.equal(papiWhiteCount(stateAt(3, 3 * 318.44 + 50 - 200)), 0);
});

// ---------------------------------------------------------------------------
// The three renderers, on every level and every phase
// ---------------------------------------------------------------------------

function sampleStates(aircraft, level) {
  const states = [];
  const initial = createState(aircraft, level);
  states.push({ name: 'approach', state: initial });

  // Flare: 40 ft above the ground on the path.
  const flare = { ...initial, altFt: 40, distFt: 1300, vsiFpm: -180, pitchDeg: 8 };
  states.push({ name: 'flare', state: flare });

  // Touchdown and rollout.
  let rolled = step(
    aircraft,
    { ...initial, altFt: 0.5, distFt: 1200, vsiFpm: -150, touchdown: null },
    {
      pitch: 0,
      throttle: 0,
      steer: 0,
      brake: 1,
      reverse: true,
      spoilers: true,
      crosswindKt: 0,
      headwindKt: 0,
    },
    1 / 60,
  );
  for (let i = 0; i < 40; i++) {
    rolled = step(
      aircraft,
      rolled,
      { brake: 1, reverse: true, spoilers: true, throttle: 0, pitch: 0, steer: 0 },
      1 / 60,
    );
  }
  states.push({ name: 'rollout', state: rolled });
  return states;
}

for (const level of LEVELS) {
  test(`level ${level.n} renders every phase without throwing`, () => {
    const aircraft = getAircraft(level.aircraft);
    for (const { name, state } of sampleStates(aircraft, level)) {
      const ctx = stubContext();
      const cues = { stall: false, flare: name === 'flare' };
      assert.doesNotThrow(
        () => drawCockpit(ctx, { state, aircraft, level }),
        `cockpit ${name}`,
      );
      assert.doesNotThrow(
        () => drawMinimap(ctx, { state, aircraft, level }),
        `minimap ${name}`,
      );
      assert.doesNotThrow(
        () => drawPanel(ctx, { state, aircraft, level, cues }),
        `panel ${name}`,
      );
      assert.ok(ctx.ops.length > 60, `${name} drew ${ctx.ops.length} operations`);
      const labels = ctx.ops.filter((o) => o[0] === 'fillText').map((o) => o[1]);
      assert.ok(
        labels.some((l) => l.includes('KT')),
        `${name} shows a speed`,
      );
      assert.ok(
        labels.some((l) => l.includes('FT')),
        `${name} shows an altitude`,
      );
      assert.ok(
        labels.some((l) => l.startsWith('DIST')),
        `${name} shows a distance`,
      );
    }
  });
}

test('the panel warns about a stall', () => {
  const aircraft = getAircraft('c152');
  const level = LEVELS[0];
  const state = { ...createState(aircraft, level), stalled: true, speedKt: 38 };
  const ctx = stubContext();
  drawPanel(ctx, { state, aircraft, level, cues: { stall: true, flare: false } });
  const labels = ctx.ops.filter((o) => o[0] === 'fillText').map((o) => o[1]);
  assert.ok(labels.includes('STALL'));
});

test('the panel shows gear up when the aircraft is not configured', () => {
  const aircraft = getAircraft('b738');
  const level = LEVELS[5];
  const state = createState(aircraft, level);
  assert.equal(state.gearDown, false);
  const ctx = stubContext();
  drawPanel(ctx, { state, aircraft, level, cues: {} });
  const labels = ctx.ops.filter((o) => o[0] === 'fillText').map((o) => o[1]);
  assert.ok(labels.includes('UP'), 'gear reads UP');
});

test('every weather profile can be drawn in both views in every phase', () => {
  for (const level of LEVELS) {
    const aircraft = getAircraft(level.aircraft);
    for (const { name, state } of sampleStates(aircraft, level)) {
      for (const weather of WEATHER) {
        const ctx = stubContext();
        const view = { state, aircraft, level, weather, t: 12.5 };
        assert.doesNotThrow(() => drawCockpit(ctx, view), `${level.aircraft} ${weather.id} cockpit`);
        assert.doesNotThrow(() => drawMinimap(ctx, view), `${level.aircraft} ${weather.id} minimap`);
        assert.doesNotThrow(
          () => drawPanel(ctx, { ...view, cues: { stall: false, flare: name === 'flare' } }),
          `${level.aircraft} ${weather.id} panel`,
        );
        assert.ok(ctx.ops.length > 60, `${level.aircraft} ${weather.id} drew something`);
      }
    }
  }
});

test('the panel announces the wind, the gusts and the surface', () => {
  const aircraft = getAircraft('b738');
  const level = LEVELS[5];
  const state = createState(aircraft, level, WEATHER[2]);
  const ctx = stubContext();
  drawPanel(ctx, { state, aircraft, level, weather: WEATHER[2], cues: {} });
  const shown = labels(ctx);
  assert.ok(shown.some((l) => l.startsWith('WIND')), shown.join(' | '));
  assert.ok(shown.some((l) => l.startsWith('GUST')));
  assert.ok(shown.includes('WET'));
});

test('a contaminated runway is drawn differently from a dry one', () => {
  const aircraft = getAircraft('c152');
  const level = LEVELS[0];
  const state = createState(aircraft, level);
  const dry = stubContext();
  drawCockpit(dry, { state, aircraft, level, weather: WEATHER[0], t: 0 });
  const snow = stubContext();
  drawCockpit(snow, { state, aircraft, level, weather: WEATHER[3], t: 0 });
  const fills = (ctx) => ctx.ops.filter((op) => op[0] === 'fill').map((op) => op[1]);
  assert.notDeepEqual(fills(dry), fills(snow), 'the surface colour changes');
});
