// Game orchestration, free of the DOM so it can be driven by tests.
// main.js wires a canvas, the keyboard and requestAnimationFrame into this.

import { getAircraft } from './aircraft.js';
import { LEVELS } from './levels.js';
import * as P from './physics.js';
import { brakingFactor, getWeather, gustAt } from './weather.js';

const BEST_KEY = 'aviation-landing.bests';
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
    t: 0,
    bests: loadBests(storage),
  };

  function startLevel(index) {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, index));
    game.levelIndex = clamped;
    game.level = LEVELS[clamped];
    game.aircraft = getAircraft(game.level.aircraft);
    game.weather = game.weatherId ? getWeather(game.weatherId) : game.level.weather;
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
          if (code === FLAP_DOWN) game.state = P.setFlapSetting(game.aircraft, game.state, +1);
          else if (code === FLAP_UP) game.state = P.setFlapSetting(game.aircraft, game.state, -1);
          else if (code === 'KeyG') {
            game.state = P.setGearDown(game.aircraft, game.state, !game.state.gearDown);
          } else if (code === 'KeyX') {
            game.state = P.setSpoilers(game.aircraft, game.state, !game.state.spoilers);
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
    const prev = game.bests[levelNumber];
    const prevScore = prev ? order[prev.medal] ?? 0 : -1;
    if ((order[grade.medal] ?? 0) <= prevScore) return;
    game.bests[levelNumber] = { medal: grade.medal, points: grade.points };
    if (!storage) return;
    try {
      storage.setItem(BEST_KEY, JSON.stringify(game.bests));
    } catch {
      /* storage unavailable: the medal still shows for this session */
    }
  }

  return {
    game,
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
  try {
    return JSON.parse(storage.getItem(BEST_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
