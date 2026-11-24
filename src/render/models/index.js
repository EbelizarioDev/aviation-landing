// Registry of per-aircraft visuals.
//
// One module per airframe, keyed by the aircraft id in src/aircraft.js. The
// fallback is deliberate: an aircraft added without a visual still flies and
// still draws, it simply draws as a C152 until someone gives it a module.

import { c152 } from './c152.js';
import { c172 } from './c172.js';
import { c208 } from './c208.js';
import { b350 } from './b350.js';
import { e175 } from './e175.js';
import { b738 } from './b738.js';
import { a388 } from './a388.js';

export const VISUALS = {
  c152,
  c172,
  c208,
  b350,
  e175,
  b738,
  a388,
};

/** The visual definition for an aircraft, never null. */
export function getVisual(aircraft) {
  return VISUALS[aircraft?.id] ?? c152;
}
