// Flies a scenario through the real input path — key presses, the game loop,
// the touchdown grade — with the shared autopilot on the keyboard.

import { createGame } from '../../src/game.js';
import { autopilotInputs } from './autopilot.js';

/**
 * @param {object} options
 * @param {number} options.levelIndex  which aircraft
 * @param {string|null} options.weatherId  which profile; null = the level's own
 * @returns {{ api: object, seconds: number }}
 */
export function flyLevel({ levelIndex, weatherId = null, maxSeconds = 400 }) {
  const api = createGame({ storage: null });
  if (weatherId) api.game.weatherId = weatherId;
  api.startLevel(levelIndex);
  api.begin();
  const game = api.game;
  const aircraft = game.aircraft;

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

    const inputs = autopilotInputs(s, aircraft, game.level, { weather: game.weather });
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
