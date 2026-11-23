import test from 'node:test';
import assert from 'node:assert/strict';

import { getAircraft } from '../src/aircraft.js';

import { cellKeyFor, controlsFor, createGame, selectedWeatherId } from '../src/game.js';

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

/** Press and release, the way a keyboard actually produces a single tap. */
function tap(api, code) {
  api.press(code);
  api.release(code);
}

/**
 * Put the aircraft a few feet above the runway, already flared, so the next
 * step is a touchdown at the requested sink rate.
 */
function placeOnShortFinal(api, { sinkFpm = 150, distFt = -1600, ...overrides } = {}) {
  const aircraft = api.game.aircraft;
  const speedKt = aircraft.vrefKt;
  const gammaDeg = (-Math.asin(sinkFpm / (speedKt * 101.27)) * 180) / Math.PI;
  const pitchDeg = 8 + gammaDeg; // angle of attack is 8 degrees at Vref
  api.game.state = {
    ...api.game.state,
    altFt: 0.6,
    distFt,
    speedKt,
    groundSpeedKt: speedKt - (api.game.level.weather.headwindKt ?? 0),
    pitchDeg,
    pitchCmd: pitchDeg,
    thrust: aircraft.thrustAtApproach,
    thrustCmd: aircraft.thrustAtApproach,
    lateralFt: 2,
    bankDeg: 0,
    chiDeg: 0,
    headingDeg: 0,
    betaDeg: 0,
    flapIdx: aircraft.flaps.length - 1,
    gearDown: true,
    onGround: false,
    touchdown: null,
    damage: [],
    ...overrides,
  };
}

test('the menu navigates and starts a level', () => {
  const api = createGame();
  assert.equal(api.game.phase, 'menu');
  assert.equal(api.game.levelIndex, 0);

  tap(api, 'ArrowDown');
  tap(api, 'ArrowDown');
  assert.equal(api.game.levelIndex, 2);
  assert.equal(api.levels[api.game.levelIndex].aircraft, 'c208');

  tap(api, 'Enter');
  assert.equal(api.game.phase, 'briefing');
  assert.equal(api.game.aircraft.name, 'Cessna 208B Grand Caravan');

  tap(api, 'Enter');
  assert.equal(api.game.phase, 'flying');
  assert.ok(api.game.state.altFt > 500, `starts at ${api.game.state.altFt} ft`);
});

test('the menu wraps around at both ends', () => {
  const api = createGame();
  tap(api, 'ArrowUp');
  assert.equal(api.game.levelIndex, api.levels.length - 1);
  tap(api, 'ArrowDown');
  assert.equal(api.game.levelIndex, 0);
});

test('flying updates the aircraft and pause freezes it', () => {
  const api = createGame();
  api.startLevel(0);
  api.begin();
  const before = api.game.state;
  for (let i = 0; i < 30; i++) api.update(1 / 60);
  assert.notEqual(api.game.state.groundSpeedKt, before.groundSpeedKt);

  tap(api, 'KeyP');
  assert.equal(api.game.paused, true);
  const frozen = api.game.state;
  for (let i = 0; i < 30; i++) api.update(1 / 60);
  assert.equal(api.game.state, frozen);

  tap(api, 'KeyP');
  assert.equal(api.game.paused, false);
  for (let i = 0; i < 30; i++) api.update(1 / 60);
  assert.notEqual(api.game.state, frozen);
});

test('configuration keys move flaps and gear while flying', () => {
  const api = createGame();
  api.startLevel(5); // 737, starts clean
  api.begin();
  assert.equal(api.game.state.flapIdx, 0);
  assert.equal(api.game.state.gearDown, false);

  tap(api, 'KeyF');
  assert.equal(api.game.state.flapIdx, 1);

  tap(api, 'KeyG');
  assert.equal(api.game.state.gearDown, true);

  tap(api, 'KeyX');
  assert.equal(api.game.state.spoilers, true);
});

test('a good landing reaches the result screen and awards a medal', () => {
  const storage = fakeStorage();
  const api = createGame({ storage });
  api.startLevel(5);
  api.begin();
  placeOnShortFinal(api);
  api.press('Space'); // hold the brakes through the rollout

  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 60) api.update(1 / 60);

  assert.equal(api.game.phase, 'result');
  const r = api.game.result;
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(['gold', 'silver', 'bronze'].includes(r.medal), r.medal);
  assert.ok(r.points >= 62, `points ${r.points}`);
  assert.ok(r.endFt < r.runwayFt);

  const saved = JSON.parse(storage.getItem('aviation-landing.bests'));
  const key = cellKeyFor(6, api.game.level.weather.id);
  assert.ok(saved[key], `the best result was stored under ${key}`);
  assert.equal(saved[key].medal, r.medal);
  assert.equal(api.bestFor(6, api.game.level.weather.id).medal, r.medal);
});

test('a landing without braking runs off the end of the runway', () => {
  const api = createGame();
  api.startLevel(0); // C152 on a 1200 m strip
  api.begin();
  placeOnShortFinal(api, { distFt: -1200 });

  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 180) api.update(1 / 60);

  assert.equal(api.game.phase, 'result');
  assert.equal(api.game.result.ok, false);
  assert.equal(api.game.result.code, 'excursion');
});

test('flying past the runway without touching down is a failed approach', () => {
  const api = createGame();
  api.startLevel(1);
  api.begin();
  const level = api.game.level;
  const runwayFt = level.runwayM * 3.28084;
  api.game.state = {
    ...api.game.state,
    altFt: 300,
    distFt: -runwayFt - 50,
    vsiFpm: -300,
    onGround: false,
  };
  api.update(1 / 60);
  assert.equal(api.game.phase, 'result');
  assert.equal(api.game.result.code, 'missed');
});

test('the result screen offers retry, next level and menu', () => {
  const api = createGame();
  api.startLevel(2);
  api.begin();
  placeOnShortFinal(api);
  api.press('Space');
  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 60) api.update(1 / 60);

  api.release('Space');
  tap(api, 'KeyN');
  assert.equal(api.game.phase, 'briefing');
  assert.equal(api.game.level.n, 4, 'N advances one level');

  tap(api, 'Escape');
  assert.equal(api.game.phase, 'menu');
  assert.equal(api.game.state, null);
});

test('a hard touchdown fails even if everything else is perfect', () => {
  const api = createGame();
  api.startLevel(5);
  api.begin();
  placeOnShortFinal(api, { sinkFpm: 650 });
  api.press('Space');
  let steps = 0;
  while (api.game.phase !== 'result' && steps++ < 60 * 60) api.update(1 / 60);
  assert.equal(api.game.result.ok, false);
  assert.equal(api.game.result.code, 'hard');
});

// ---------------------------------------------------------------------------
// The weather axis in the menu
// ---------------------------------------------------------------------------

function fakeStorageWith(entries) {
  const data = new Map();
  for (const [k, v] of Object.entries(entries)) data.set(k, JSON.stringify(v));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

test('the menu picks the weather with the arrows and wraps around', () => {
  const api = createGame();
  assert.equal(api.game.weatherId, null, 'no explicit choice yet');
  assert.equal(selectedWeatherId(api.game), 'calm', 'level 1 flies calm by default');
  tap(api, 'ArrowRight');
  assert.equal(api.game.weatherId, 'windy');
  tap(api, 'ArrowLeft');
  assert.equal(api.game.weatherId, 'calm');
  tap(api, 'ArrowLeft');
  assert.equal(api.game.weatherId, 'snow', 'it wraps');
});

test('the chosen weather is what the level actually flies', () => {
  const api = createGame();
  tap(api, 'ArrowRight'); // windy: 12 kt across, 8 kt headwind
  tap(api, 'Enter');
  tap(api, 'Enter');
  assert.equal(api.game.phase, 'flying');
  assert.equal(api.game.weather.id, 'windy');
  assert.equal(
    Math.round(api.game.state.speedKt - api.game.state.groundSpeedKt),
    8,
    'the headwind shows up as the gap between air and ground speed',
  );
});

test('the menu shows the weather the highlighted aircraft will fly', () => {
  const api = createGame();
  tap(api, 'ArrowDown'); // level 2 is a windy level
  tap(api, 'ArrowDown');
  tap(api, 'ArrowDown');
  tap(api, 'ArrowDown');
  tap(api, 'ArrowDown'); // level 6 is a storm level
  assert.equal(selectedWeatherId(api.game), 'storm');
  tap(api, 'Enter');
  tap(api, 'Enter');
  assert.equal(api.game.weather.id, 'storm', 'the display matched what flew');
});

test('a different aircraft keeps the weather you chose', () => {
  const api = createGame();
  tap(api, 'ArrowRight');
  tap(api, 'ArrowDown');
  assert.equal(api.game.levelIndex, 1);
  assert.equal(api.game.weatherId, 'windy');
});

test('best results are per cell, and old per-level medals migrate', () => {
  const storage = fakeStorageWith({
    'aviation-landing.bests': { 6: { medal: 'gold', points: 92 } },
  });
  const api = createGame({ storage });
  // Level 6's own profile is the storm, so the old medal lands in that cell.
  assert.equal(api.bestFor(6, 'storm').medal, 'gold');
  assert.equal(api.bestFor(6, 'calm'), undefined);
  assert.equal(api.bestFor(6, 'snow'), undefined);
});

// ---------------------------------------------------------------------------
// S3: an aircraft only exposes the systems it has
// ---------------------------------------------------------------------------

test('the control list matches the airframe', () => {
  const trainer = controlsFor(getAircraft('c152'));
  const keys = trainer.map((c) => c.key);
  assert.ok(keys.includes('W / S'), 'pitch is never removed');
  assert.ok(keys.includes('↑ / ↓'), 'throttle is never removed');
  assert.ok(keys.includes('F / V'));
  assert.ok(!keys.includes('G'), 'fixed gear has no gear control');
  assert.ok(!keys.includes('X'), 'no spoilers fitted');
  assert.ok(!keys.includes('B'), 'no reverse fitted');

  const jet = controlsFor(getAircraft('b738'));
  const jetKeys = jet.map((c) => c.key);
  assert.ok(jetKeys.includes('G'));
  assert.ok(jetKeys.includes('X'));
  assert.ok(jetKeys.includes('B'));

  const caravan = controlsFor(getAircraft('c208'));
  const caravanKeys = caravan.map((c) => c.key);
  assert.ok(!caravanKeys.includes('G'), 'the Caravan has fixed gear');
  assert.ok(caravanKeys.includes('B'), 'but it does have beta reverse');
});

test('a key with no effect answers instead of failing silently', () => {
  const api = createGame();
  api.startLevel(0); // C152
  api.begin();
  tap(api, 'KeyG');
  assert.equal(api.game.notice.text, 'GEAR: FIXED ON THIS AIRCRAFT');
  tap(api, 'KeyX');
  assert.equal(api.game.notice.text, 'SPOILERS: NOT FITTED');
  tap(api, 'KeyB');
  assert.equal(api.game.notice.text, 'REVERSE: NOT FITTED');
});

test('a key that does apply stays quiet', () => {
  const api = createGame();
  api.startLevel(5); // 737, starts clean
  api.begin();
  tap(api, 'KeyG');
  assert.equal(api.game.notice, null);
  assert.equal(api.game.state.gearDown, true);
  tap(api, 'KeyX');
  assert.equal(api.game.notice, null);
  assert.equal(api.game.state.spoilers, true);
});

test('flaps at the end of travel say so', () => {
  const api = createGame();
  api.startLevel(0); // starts at the landing detent
  api.begin();
  tap(api, 'KeyF');
  assert.equal(api.game.notice.text, 'FLAPS: ALREADY FULL');
});
