// The autopilot lives in src/ because the in-game instructor flies it too.
// These tests import it through here, so there is exactly one implementation.

export { autopilotInputs, integrateThrottle } from '../../src/autopilot.js';
