// Level ladder: one aircraft per level, each adding exactly one new system.
//
// The jump from level 4 to level 5 is the game's turning point: the aircraft
// stops obeying you and starts negotiating, because a jet engine takes seconds
// to answer a throttle command.

export const LEVELS = [
  {
    n: 1,
    runwayM: 1200,
    setup: 'landing',
    aircraft: 'c152',
    distNm: 2.0,
    crosswindKt: 0,
    headwindKt: 0,
    gustFpm: 0,
    wet: false,
    adds: 'Throttle and pitch',
    brief:
      'A 1200 m strip and a forgiving trainer. Hold the 3 degree path with throttle, keep 65 kt with pitch.',
  },
  {
    n: 2,
    runwayM: 1300,
    setup: 'flaps-up',
    aircraft: 'c172',
    distNm: 2.2,
    crosswindKt: 3,
    headwindKt: 5,
    gustFpm: 0,
    wet: false,
    adds: 'Flaps',
    brief:
      'Flaps pull you down and hold you up at once. A little crosswind asks you to point into it.',
  },
  {
    n: 3,
    runwayM: 1500,
    setup: 'flaps-up',
    aircraft: 'c208',
    distNm: 2.6,
    crosswindKt: 6,
    headwindKt: 6,
    gustFpm: 40,
    wet: false,
    adds: 'Turbine power with mass, and beta reverse',
    brief:
      'The Caravan answers the throttle instantly but carries three tonnes. Use beta reverse or you will run out of runway.',
  },
  {
    n: 4,
    runwayM: 1800,
    setup: 'clean',
    aircraft: 'b350',
    distNm: 3.0,
    crosswindKt: 8,
    headwindKt: 8,
    gustFpm: 60,
    wet: false,
    adds: 'Retractable gear and limit speeds',
    brief:
      'Fast enough for the gear limit to matter. Bathroom break for the gear, or it stays up.',
  },
  {
    n: 5,
    runwayM: 2400,
    setup: 'clean',
    aircraft: 'e175',
    distNm: 3.5,
    crosswindKt: 10,
    headwindKt: 10,
    gustFpm: 80,
    wet: false,
    adds: 'Jet spool-up lag',
    brief:
      'Ask for power five seconds before you need it. Get low and slow here and no engine will save you.',
  },
  {
    n: 6,
    runwayM: 2800,
    setup: 'clean',
    aircraft: 'b738',
    distNm: 4.0,
    crosswindKt: 12,
    headwindKt: 12,
    gustFpm: 100,
    wet: false,
    adds: 'Flaps 30, spoilers and reversers',
    brief:
      'Seventy tonnes and a precise stopping problem. Spoilers and reversers are part of the landing, not an afterthought.',
  },
  {
    n: 7,
    runwayM: 3800,
    setup: 'clean',
    aircraft: 'a388',
    distNm: 4.5,
    crosswindKt: 18,
    headwindKt: 14,
    gustFpm: 140,
    wet: true,
    adds: 'Fifteen knots of crosswind on a wet runway',
    brief:
      'Half a million kilos, a wet runway and the crosswind you were warned about. Everything happens a minute after you ask.',
  },
];

export function levelByNumber(n) {
  const level = LEVELS.find((l) => l.n === n);
  if (!level) throw new Error(`unknown level: ${n}`);
  return level;
}
