// Game orchestration, free of the DOM so it can be driven by tests.
// main.js wires a canvas, the keyboard and requestAnimationFrame into this.

import { getAircraft } from './aircraft.js';
import { LEVELS } from './levels.js';
import * as P from './physics.js';
import { WEATHER, brakingFactor, getWeather, gustAt } from './weather.js';

const BEST_KEY = 'aviation-landing.bests';

/**
 * The controls that actually do something on this aircraft. Anything absent is
 * not fitted, and pressing its key says so instead of failing silently.
 */
export function controlsFor(aircraft) {
  const controls = [
    { key: 'W / S', action: 'Nose up / down' },
    { key: 'A / D', action: 'Aileron: bank' },
    { key: 'Q / E', action: 'Rudder: yaw' },
    { key: '↑ / ↓', action: 'Throttle' },
    { key: 'F / V', action: `Flaps (${aircraft.flaps.map((f) => f.label).join(' · ')})` },
  ];
  if (aircraft.gear === 'retractable') controls.push({ key: 'G', action: 'Gear up / down' });
  if (aircraft.spoilers) controls.push({ key: 'X', action: 'Spoilers' });
  controls.push({ key: 'Space', action: 'Brakes (on the ground)' });
  if (aircraft.reverse) controls.push({ key: 'B', action: 'Reverse thrust (on the ground)' });
  return controls;
}

/** Best results are stored per cell: one aircraft, one weather profile. */
export function cellKeyFor(levelNumber, weatherId) {
  return `${levelNumber}:${weatherId}`;
}
const FLAP_DOWN = 'KeyF';
const FLAP_UP = 'KeyV';

export function createGame({ storage = null } = {}) {
  const keys = new Set();
  const game = {
    phase: 'menu',
    levelIndex: 0,
    aircraft: null,
    level: null,
    weather: null,
    state: null,
    result: null,
    throttle: 0.45,
    paused: false,
    view: 'cockpit',
    weatherId: null,
    notice: null,
    t: 0,
    bests: loadBests(storage),
  };

  function startLevel(index) {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, index));
    game.levelIndex = clamped;
    game.level = LEVELS[clamped];
    game.aircraft = getAircraft(game.level.aircraft);
    game.weather = getWeather(selectedWeatherId(game));
    game.state = null;
    game.result = null;
    game.paused = false;
    game.t = 0;
    game.throttle = game.aircraft.thrustAtApproach;
    game.phase = 'briefing';
  }

  function begin() {
    if (!game.aircraft) return;
    game.state = P.createState(game.aircraft, game.level, game.weather);
    game.throttle = game.aircraft.thrustAtApproach;
    game.t = 0;
    game.result = null;
    game.paused = false;
    game.phase = 'flying';
  }

  function toMenu() {
    game.phase = 'menu';
    game.state = null;
    game.result = null;
    game.paused = false;
  }

  function press(code) {
    const repeat = keys.has(code);
    keys.add(code);
    if (repeat) return;

    switch (game.phase) {
      case 'menu':
        if (code === 'ArrowUp' || code === 'KeyW') {
          game.levelIndex = (game.levelIndex + LEVELS.length - 1) % LEVELS.length;
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          game.levelIndex = (game.levelIndex + 1) % LEVELS.length;
        } else if (code === 'ArrowLeft' || code === 'ArrowRight') {
          const step = code === 'ArrowLeft' ? -1 : 1;
          const current = selectedWeatherId(game);
          const index = WEATHER.findIndex((w) => w.id === current);
          const next = (index + step + WEATHER.length) % WEATHER.length;
          game.weatherId = WEATHER[next].id;
        } else if (code === 'Enter') {
          startLevel(game.levelIndex);
        }
        break;
      case 'briefing':
        if (code === 'Enter') begin();
        else if (code === 'Escape') toMenu();
        break;
      case 'flying':
      case 'rollout':
        if (code === 'KeyP') game.paused = !game.paused;
        else if (code === 'KeyR') startLevel(game.levelIndex);
        else if (code === 'Escape') toMenu();
        else if (code === 'KeyC') {
          // Where you look from, not what you can read: allowed even when paused.
          game.view = game.view === 'cockpit' ? 'chase' : 'cockpit';
        } else if (!game.paused && game.state) {
          if (code === FLAP_DOWN) {
            const before = game.state.flapIdx;
            game.state = P.setFlapSetting(game.aircraft, game.state, +1);
            if (game.state.flapIdx === before) notify('FLAPS: ALREADY FULL');
          } else if (code === FLAP_UP) {
            const before = game.state.flapIdx;
            game.state = P.setFlapSetting(game.aircraft, game.state, -1);
            if (game.state.flapIdx === before) notify('FLAPS: ALREADY UP');
          } else if (code === 'KeyG') {
            if (game.aircraft.gear !== 'retractable') notify('GEAR: FIXED ON THIS AIRCRAFT');
            else game.state = P.setGearDown(game.aircraft, game.state, !game.state.gearDown);
          } else if (code === 'KeyX') {
            if (!game.aircraft.spoilers) notify('SPOILERS: NOT FITTED');
            else game.state = P.setSpoilers(game.aircraft, game.state, !game.state.spoilers);
          } else if (code === 'KeyB') {
            if (!game.aircraft.reverse) notify('REVERSE: NOT FITTED');
          }
        }
        break;
      case 'result':
        if (code === 'Enter') startLevel(game.levelIndex);
        else if (code === 'KeyN') startLevel(game.levelIndex + 1);
        else if (code === 'Escape') toMenu();
        break;
      default:
        break;
    }
  }

  /** A control that does not apply answers instead of doing nothing. */
  function notify(text) {
    game.notice = { text, at: game.t };
  }

  function release(code) {
    keys.delete(code);
  }

  function clearKeys() {
    keys.clear();
  }

  function readControls(dt) {
    const state = game.state;
    const weather = game.weather;
    // W/S pitch, A/D aileron, Q/E rudder, arrows throttle. Pitch is never
    // removed from an aircraft: without it there is no path and no flare.
    const noseUp = keys.has('KeyW');
    const noseDown = keys.has('KeyS');
    const bankLeft = keys.has('KeyA');
    const bankRight = keys.has('KeyD');
    const yawLeft = keys.has('KeyQ');
    const yawRight = keys.has('KeyE');

    const throttleInput = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
    game.throttle = P.clamp(game.throttle + throttleInput * 0.5 * dt, 0, 1);

    const gustFpm = gustAt(weather, game.t, state.altFt);

    return {
      pitch: (noseUp ? 1 : 0) + (noseDown ? -1 : 0),
      aileron: (bankRight ? 1 : 0) + (bankLeft ? -1 : 0),
      rudder: (yawRight ? 1 : 0) + (yawLeft ? -1 : 0),
      throttle: game.throttle,
      brake: keys.has('Space') ? 1 : 0,
      reverse: keys.has('KeyB'),
      spoilers: state.spoilers,
      crosswindKt: weather.crosswindKt,
      headwindKt: weather.headwindKt,
      gustFpm,
      brakingFactor: brakingFactor(weather.runway),
      wet: weather.runway !== 'dry',
    };
  }

  function update(dt) {
    if (game.paused) return;
    if (game.phase !== 'flying' && game.phase !== 'rollout') return;

    game.t += dt;
    const aircraft = game.aircraft;
    const level = game.level;
    const prev = game.state;
    const next = P.step(aircraft, prev, readControls(dt), dt);
    game.state = next;

    if (!prev.onGround && next.onGround) game.phase = 'rollout';

    const runwayFt = (level.runwayM ?? aircraft.runwayM) * P.FEET_PER_M;

    if (next.onGround) {
      const endFt = next.touchdown.pastThresholdFt + next.rollFt;
      if (endFt > runwayFt) {
        finish(next, { excursion: true });
        return;
      }
      if (next.stopped) finish(next, {});
    } else if (next.distFt < -runwayFt) {
      finish(next, { missed: true });
    }
  }

  function finish(state, { excursion = false, missed = false } = {}) {
    // Flying past the runway never produced a touchdown record, so build the
    // shape the grader expects rather than trusting state.touchdown to exist.
    const td = state.touchdown ?? {
      fpm: Math.abs(state.vsiFpm ?? 0),
      speedKt: state.speedKt,
      lateralFt: state.lateralFt ?? 0,
      pastThresholdFt: -state.distFt,
      rollFt: 0,
    };
    const grade = P.classifyTouchdown(game.aircraft, game.level, td);
    if (excursion) {
      Object.assign(grade, {
        ok: false,
        code: 'excursion',
        label: 'Runway excursion: you ran off the end',
        medal: null,
      });
    }
    if (missed) {
      Object.assign(grade, {
        ok: false,
        code: 'missed',
        label: 'You flew past the runway without touching down',
        medal: null,
      });
    }
    game.result = {
      ...grade,
      rollFt: Math.round(state.rollFt),
      endFt: Math.round(td.pastThresholdFt + state.rollFt),
    };
    game.phase = 'result';
    if (grade.ok) saveBest(game.level.n, grade);
  }

  function saveBest(levelNumber, grade) {
    const order = { gold: 3, silver: 2, bronze: 1, rough: 0 };
    const key = cellKeyFor(levelNumber, game.weather.id);
    const prev = game.bests[key];
    const prevScore = prev ? order[prev.medal] ?? 0 : -1;
    if ((order[grade.medal] ?? 0) <= prevScore) return;
    game.bests[key] = { medal: grade.medal, points: grade.points };
    if (!storage) return;
    try {
      storage.setItem(BEST_KEY, JSON.stringify(game.bests));
    } catch {
      /* storage unavailable: the medal still shows for this session */
    }
  }

  function bestFor(levelNumber, weatherId) {
    return game.bests[cellKeyFor(levelNumber, weatherId)];
  }

  return {
    game,
    bestFor,
    notify,
    press,
    release,
    clearKeys,
    update,
    startLevel,
    begin,
    toMenu,
    levels: LEVELS,
  };
}

function loadBests(storage) {
  if (!storage) return {};
  let parsed;
  try {
    parsed = JSON.parse(storage.getItem(BEST_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
  // Older builds stored one medal per level number. Fold those into the cell
  // the level's own profile occupies instead of dropping them.
  for (const level of LEVELS) {
    if (!parsed[level.n]) continue;
    const key = cellKeyFor(level.n, level.weather.id);
    if (!parsed[key]) parsed[key] = parsed[level.n];
    delete parsed[level.n];
  }
  return parsed;
}

/** The profile the menu is pointing at: an explicit choice, else the level's own. */
export function selectedWeatherId(game) {
  // In the menu no level is loaded yet, so fall back to the highlighted row:
  // the display must match what pressing ENTER will actually fly.
  return (
    game.weatherId ??
    game.level?.weather?.id ??
    LEVELS[game.levelIndex]?.weather?.id ??
    WEATHER[0].id
  );
}
