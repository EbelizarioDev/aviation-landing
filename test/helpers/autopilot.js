// A simple autopilot shared by the tests: it flies the 3 degree path with pitch,
// holds the centreline by banking, and rolls the crab out before touchdown.

import { alphaDeg, clamp, glidePathSinkFpm } from '../../src/physics.js';

const DEG = Math.PI / 180;

/**
 * Returns the control intent, each in -1..1, plus throttle up/down booleans, so
 * a caller can drive the physics directly or turn it into key presses.
 */
export function autopilotInputs(state, aircraft, level, options = {}) {
  const flareFt = options.flareFt ?? (aircraft.massT > 20 ? 80 : 50);
  const touchdownSink = options.touchdownSink ?? 150;
  const speed = Math.max(40, state.groundSpeedKt ?? state.speedKt);

  // --- vertical: hold the path, then flare.
  const pathSink = glidePathSinkFpm(speed);
  const sinkTarget =
    state.altFt < flareFt
      ? touchdownSink + (pathSink - touchdownSink) * (state.altFt / flareFt)
      : pathSink;
  const gammaDeg = -Math.asin(Math.min(0.9, sinkTarget / (state.speedKt * 101.27))) / DEG;
  const pitchTarget = clamp(alphaDeg(aircraft, state.speedKt) + gammaDeg, 0, 20);
  const pitch = clamp((pitchTarget - state.pitchDeg) * 3, -0.5, 0.5);

  // --- lateral. The flight path (chi) is held by banking; the rudder only puts
  // the nose off the path, which is the de-crab.
  // The active profile is what the aircraft is flying through, and it is not
  // always the level's default one.
  const weather = options.weather ?? level.weather ?? level;
  const crosswindKt = weather.crosswindKt ?? 0;
  // The crab cancels the wind against the speed *through the air*, not over the
  // ground: that is what the drift equation in the physics uses.
  const crabDeg = -Math.asin(clamp(crosswindKt / Math.max(1, state.speedKt), -0.6, 0.6)) / DEG;
  const rollingOut = state.altFt < Math.max(45, flareFt * 0.85);

  const chiTarget = clamp(crabDeg - state.lateralFt / 300, -25, 25);
  const chiError = chiTarget - state.chiDeg;
  const bankTarget = rollingOut ? 0 : clamp(chiError * 2.5, -15, 15);
  const aileron = clamp((bankTarget - state.bankDeg) / 4, -1, 1);

  // Align the nose with the axis: heading = chi + beta = 0 means beta = -chi.
  const betaWanted = rollingOut ? -state.chiDeg : 0;
  const rudder = clamp((betaWanted - state.betaDeg) / 5, -1, 1);

  return {
    pitch,
    aileron,
    rudder,
    throttleUp: state.speedKt < aircraft.vrefKt - 1,
    throttleDown: state.speedKt > aircraft.vrefKt + 1,
  };
}

/** Folds the throttle booleans into a held throttle value, like the game does. */
export function integrateThrottle(throttle, inputs, dt) {
  const delta = (inputs.throttleUp ? 1 : 0) - (inputs.throttleDown ? 1 : 0);
  return clamp(throttle + delta * 0.5 * dt, 0, 1);
}
