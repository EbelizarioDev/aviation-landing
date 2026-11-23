// The instructor's narration for the demo. Ordered beats, each one naming what
// the pilot is doing and the number that matters — never a recipe to memorise.

import { glidePathSinkFpm } from './physics.js';

const nominalSink = (aircraft) => Math.round(glidePathSinkFpm(aircraft.vrefKt) / 10) * 10;

/**
 * `when(state, ctx)` fires the beat; `byT` is a fallback so a beat can never
 * block the ones behind it if its condition stops being reachable.
 * `focus` names the instrument to highlight (see PANEL_REGIONS).
 */
export const DEMO_CUES = [
  {
    id: 'controls',
    focus: null,
    when: () => true,
    byT: 0,
    text: () =>
      'I have the controls. Two miles out, already set up: flaps full, gear down.',
  },
  {
    id: 'path',
    focus: 'path',
    when: (s, c) => c.t > 4,
    byT: 6,
    text: (c) =>
      `That three degree path is my aim point. At ${c.aircraft.vrefKt} knots it means about ` +
      `${nominalSink(c.aircraft)} feet per minute of descent.`,
  },
  {
    id: 'energy',
    focus: 'speed',
    when: (s, c) => c.t > 10,
    byT: 16,
    text: () =>
      'Pitch is my path, power is my speed. Nose up bleeds speed, nose down buys it back.',
  },
  {
    id: 'diamonds',
    focus: 'path',
    when: (s) => s.altFt > 450,
    byT: 26,
    text: () =>
      'Two diamonds: the vertical one is the glide path, the horizontal one is the centreline.',
  },
  {
    id: 'wind',
    focus: 'vsi',
    when: (s) => s.altFt < 320,
    byT: 50,
    text: (c) =>
      (c.weather?.crosswindKt ?? 0) > 2
        ? 'Three hundred feet. The wind pushes us sideways, so I hold a crab into it and keep the path.'
        : 'Three hundred feet. No wind today, so no crab: just hold the path all the way down.',
  },
  {
    id: 'flare',
    focus: 'vsi',
    when: (s, c) => s.altFt < 50 && c.t > 30,
    byT: 95,
    text: () =>
      'Fifty feet. Now I flare: nose up until the sink decays to about 150 feet per minute.',
  },
  {
    id: 'touchdown',
    focus: null,
    when: (s) => s.onGround,
    byT: 130,
    text: () =>
      'Down. Timely, not gentle: under 300 feet per minute, or the gear collapses.',
  },
  {
    id: 'rollout',
    focus: 'systems',
    when: (s) => s.onGround && s.speedKt < 110,
    byT: 150,
    text: () =>
      'Brakes and reversers. Stopping is part of the landing, not an afterthought.',
  },
];

/** How many beats are due right now, counting consecutive ones from the start. */
export function dueCueCount(state, ctx) {
  let n = 0;
  while (n < DEMO_CUES.length) {
    const cue = DEMO_CUES[n];
    const fired = cue.when(state, ctx) || (cue.byT != null && ctx.t >= cue.byT);
    if (!fired) break;
    n++;
  }
  return n;
}

/** The beat currently on screen, or null before the first one. */
export function cueAt(index) {
  return index > 0 && index <= DEMO_CUES.length ? DEMO_CUES[index - 1] : null;
}
