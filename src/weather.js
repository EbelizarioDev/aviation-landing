// Weather profiles: the difficulty axis, independent of the aircraft ladder.
//
// Each profile only changes numbers and theme. Nothing here knows about a
// particular aircraft, which is what makes the 4 x 7 matrix possible later.

export const WEATHER = [
  {
    id: 'calm',
    name: 'Calm',
    tagline: 'Clear sky, no wind',
    crosswindKt: 0,
    headwindKt: 0,
    gustFpm: 0,
    gustAmpKt: 0,
    visibilityNm: 10,
    runway: 'dry',
    precip: 'none',
    brief: 'Nothing to fight. The air is still and the runway is dry: this is the profile to learn the aircraft in.',
  },
  {
    id: 'windy',
    name: 'Windy',
    tagline: 'Steady crosswind with gusts',
    crosswindKt: 12,
    headwindKt: 8,
    gustFpm: 90,
    gustAmpKt: 5,
    visibilityNm: 10,
    runway: 'dry',
    precip: 'none',
    brief: 'Twelve knots across the runway. You fly it crabbed all the way down and roll the crab out in the flare.',
  },
  {
    id: 'storm',
    name: 'Storm',
    tagline: 'Heavy gusts, rain, wet runway',
    crosswindKt: 18,
    headwindKt: 14,
    gustFpm: 180,
    gustAmpKt: 8,
    visibilityNm: 3,
    runway: 'wet',
    precip: 'rain',
    brief: 'Eighteen knots across, gusts on top, and a wet runway that gives back a third of the braking. Ask for power early.',
  },
  {
    id: 'snow',
    name: 'Snow',
    tagline: 'Low visibility, contaminated runway',
    crosswindKt: 8,
    headwindKt: 6,
    gustFpm: 60,
    gustAmpKt: 4,
    visibilityNm: 2,
    runway: 'snow',
    precip: 'snow',
    brief: 'You can barely see the runway and the surface is contaminated: braking is a third of what it was. Land short and gently.',
  },
];

const BY_ID = new Map(WEATHER.map((w) => [w.id, w]));

export function getWeather(id) {
  const w = BY_ID.get(id);
  if (!w) throw new Error(`unknown weather profile: ${id}`);
  return w;
}

/** Braking multiplier for the runway surface. */
export function brakingFactor(runway) {
  switch (runway) {
    case 'wet':
      return 0.62;
    case 'snow':
      return 0.35;
    default:
      return 1;
  }
}

/**
 * Deterministic gust in feet per minute at time t and height above ground.
 * No randomness: two runs of the same approach must be identical or the tests
 * cannot promise anything. The gust fades to nothing at zero feet, because
 * surface friction kills it there and a gust at touchdown would otherwise be
 * charged to the pilot as a hard landing.
 */
export function gustAt(weather, t, altFt = Infinity) {
  if (!weather.gustFpm) return 0;
  const fade = altFt === Infinity ? 1 : Math.max(0, Math.min(1, altFt / 100));
  return weather.gustFpm * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.9 + 1) * 0.4) * fade;
}

/** How much the visibility hides: 0 = clear, 1 = you see nothing. */
export function hazeAmount(weather) {
  const nm = weather.visibilityNm ?? 10;
  return Math.max(0, Math.min(0.85, 1 - nm / 10));
}

/** True when the crosswind is beyond the aircraft's demonstrated limit. */
export function beyondCrosswindLimit(aircraft, weather) {
  return Math.abs(weather.crosswindKt) > (aircraft.maxCrosswindKt ?? Infinity);
}
