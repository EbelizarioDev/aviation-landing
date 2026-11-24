// Flight model.
//
// One deliberate simplification: the aircraft is a point moving along a flight
// path, not a rigid body. What matters for a landing game is the *energy*
// relationship, and that is modelled honestly:
//
//   gamma  = pitch - angle of attack          (negative gamma = descending)
//   VSI    = speed * sin(gamma)
//   dSpeed = thrust - drag - g*sin(gamma)
//
// So nosing up raises the flight path and bleeds speed, nosing down trades
// altitude for speed, and below stall speed the angle of attack saturates and
// lift collapses. Thrust answers with the aircraft's real spool delay.

export const FEET_PER_NM = 6076.12;
export const FEET_PER_M = 3.28084;
export const KT_TO_FTS = 1.68781;
export const KT_TO_FTMIN = 101.27;
export const DEG = Math.PI / 180;
export const GLIDE_SLOPE_DEG = 3;
// A 3 degree path crosses the threshold at 50 ft, not at zero: that is why the
// touchdown follows ~950 ft past the threshold and not exactly on it.
export const THRESHOLD_CROSSING_FT = 50;

// g expressed per knot of speed per second: 32.174 ft/s^2 / 1.68781 ft/s per kt.
const GRAVITY_KT_S = 19.06;

const PITCH_RATE_DEG_S = 18;
const ROLL_RATE_DEG_S = 30;
const ROLL_STABILITY_DEG_S = 2;
const BETA_RESPONSE_PER_S = 1.5;
const MAX_SIDESLIP_DEG = 15;
export const MAX_BANK_DEG = 30;
const GEAR_UP_DRAG_RELIEF = 0.88;
const SPOILER_DRAG = 1.25;
const STALL_DRAG = 2.5;
const HARD_TOUCHDOWN_FPM = 300;
const SPEED_TOLERANCE_KT = 10;
// 45 m, the width of a real runway: the same number draws the runway on the
// windshield, positions the localizer diamond and decides "off the edge".
export const RUNWAY_HALF_WIDTH_FT = 74;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Glide path
// ---------------------------------------------------------------------------

/** Height above the threshold of a 3 degree path at a given distance. */
export function glidePathAltFt(distNm) {
  return distNm * FEET_PER_NM * Math.tan(GLIDE_SLOPE_DEG * DEG) + THRESHOLD_CROSSING_FT;
}

/** Where a 3 degree path meets the ground, in feet past the threshold. */
export function glidePathTouchdownFt() {
  return THRESHOLD_CROSSING_FT / Math.tan(GLIDE_SLOPE_DEG * DEG);
}

/** Sink rate that holds the 3 degree path at a given ground speed. */
export function glidePathSinkFpm(groundSpeedKt) {
  return groundSpeedKt * KT_TO_FTMIN * Math.sin(GLIDE_SLOPE_DEG * DEG);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function flapConfig(aircraft, flapIdx) {
  return aircraft.flaps[clamp(flapIdx, 0, aircraft.flaps.length - 1)];
}

/** Stall speed in the current flap configuration (1/sqrt(lift) scaling).
 *  A banked wing carries load: the stall speed rises with the load factor. */
export function stallKt(aircraft, flapIdx, bankDeg = 0) {
  const base = aircraft.vsoKt / Math.sqrt(flapConfig(aircraft, flapIdx).lift);
  return base / Math.sqrt(Math.cos((clamp(bankDeg, -60, 60) * Math.PI) / 180));
}

/**
 * Drag at Vref in the full landing configuration, in kt/s, pinned so that the
 * aircraft holds Vref on a 3 degree path at its reference approach thrust.
 */
export function approachDragK(aircraft) {
  return (
    aircraft.thrustAtApproach * aircraft.powerKtS +
    GRAVITY_KT_S * Math.sin(GLIDE_SLOPE_DEG * DEG)
  );
}

export function dragAccelKtS(aircraft, s) {
  const ratio = (s.speedKt / aircraft.vrefKt) ** 2;
  const flap = flapConfig(aircraft, s.flapIdx).drag;
  const gear = s.gearDown ? 1 : GEAR_UP_DRAG_RELIEF;
  const spoilers = s.spoilers && aircraft.spoilers ? SPOILER_DRAG : 1;
  const stalled = s.stalled ? STALL_DRAG : 1;
  return approachDragK(aircraft) * ratio * flap * gear * spoilers * stalled;
}

export function speedAccelKtS(aircraft, s, gammaDeg) {
  const thrust = s.thrust * aircraft.powerKtS;
  return thrust - dragAccelKtS(aircraft, s) - GRAVITY_KT_S * Math.sin(gammaDeg * DEG);
}

export function alphaDeg(aircraft, speedKt) {
  return clamp(8 + (aircraft.vrefKt - speedKt) * 0.5, 2, 18);
}

export function verticalSpeedFpm(speedKt, gammaDeg) {
  return speedKt * KT_TO_FTMIN * Math.sin(gammaDeg * DEG);
}

export function horizontalFts(groundSpeedKt, gammaDeg) {
  return groundSpeedKt * KT_TO_FTS * Math.cos(gammaDeg * DEG);
}

/** First-order engine response: accelerates faster than it spools down. */
export function stepThrust(actual, cmd, spoolS, dt) {
  const rate = cmd > actual ? 1 / spoolS : 1 / (spoolS * 0.6);
  const next = actual + (cmd - actual) * clamp(rate * dt, 0, 1);
  return clamp(next, 0, 1);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createState(aircraft, level, weather = level.weather) {
  // "landing" starts already configured; "flaps-up" and "clean" make the player
  // do the approach configuration, which is the level's lesson.
  const setup = level.setup ?? 'landing';
  const flapIdx = setup === 'landing' ? aircraft.flaps.length - 1 : 0;
  const gearDown = setup === 'landing' || aircraft.gear !== 'retractable';
  const speedKt = aircraft.vrefKt + (setup === 'landing' ? 8 : 5);
  const pitchDeg = setup === 'landing' ? 5 : 3;
  const groundSpeedKt = speedKt - (weather?.headwindKt ?? 0);
  return {
    altFt: glidePathAltFt(level.distNm),
    distFt: level.distNm * FEET_PER_NM,
    speedKt,
    pitchCmd: pitchDeg,
    pitchDeg,
    alphaDeg: alphaDeg(aircraft, speedKt),
    gammaDeg: pitchDeg - alphaDeg(aircraft, speedKt),
    vsiFpm: 0,
    groundSpeedKt,
    thrust: aircraft.thrustAtApproach,
    thrustCmd: aircraft.thrustAtApproach,
    flapIdx,
    gearDown,
    spoilers: false,
    lateralFt: 18,
    bankDeg: 0,
    chiDeg: 0,
    headingDeg: 0,
    betaDeg: 0,
    onGround: false,
    rollFt: 0,
    stalled: false,
    stallKt: stallKt(aircraft, flapIdx),
    damage: [],
    touchdown: null,
    stopped: false,
  };
}

/**
 * One fixed-timestep integration step.
 *
 * controls: { pitch, aileron, rudder, throttle, brake, reverse, spoilers,
 *             crosswindKt, headwindKt, gustFpm, wet }
 */
export function step(aircraft, s, controls, dt) {
  const next = { ...s, damage: s.damage };

  if (s.onGround) {
    return stepGround(aircraft, s, controls, dt);
  }

  const throttle = clamp(controls.throttle ?? s.thrustCmd, 0, 1);
  next.thrustCmd = throttle;
  next.thrust = stepThrust(s.thrust, throttle, aircraft.spoolS, dt);

  // --- lateral: the aileron banks, the bank turns, the rudder yaws the nose.
  const aileron = clamp(controls.aileron ?? 0, -1, 1);
  const rudder = clamp(controls.rudder ?? 0, -1, 1);
  // Kept on the state because the airframe draws the ailerons where this says:
  // a control surface that never moves makes the input feel decorative.
  next.aileronCmd = aileron;
  if (Math.abs(aileron) > 0.01) {
    const rollRate = aircraft.rollRateDegS ?? ROLL_RATE_DEG_S;
    next.bankDeg = clamp(s.bankDeg + aileron * rollRate * dt, -MAX_BANK_DEG, MAX_BANK_DEG);
  } else {
    // Dihedral: a stable aircraft rolls itself back toward level when let go.
    const stability = aircraft.rollStabilityDegS ?? ROLL_STABILITY_DEG_S;
    const relax = Math.min(Math.abs(s.bankDeg), stability * dt);
    next.bankDeg = s.bankDeg - Math.sign(s.bankDeg) * relax;
  }

  // The bank turns the flight path. The rudder does not: it puts the nose off
  // the flight path, which is what a de-crab is. Heading = path + sideslip.
  const vMs = Math.max(25, s.speedKt * 0.514444);
  const turnRateDegS =
    ((9.81 * Math.tan((next.bankDeg * Math.PI) / 180)) / vMs) * (180 / Math.PI);
  next.chiDeg = clamp(s.chiDeg + turnRateDegS * dt, -45, 45);

  const betaMax = aircraft.maxSideslipDeg ?? MAX_SIDESLIP_DEG;
  const betaWanted = rudder * betaMax;
  const betaResponse = aircraft.betaResponsePerS ?? BETA_RESPONSE_PER_S;
  next.betaDeg = clamp(
    s.betaDeg + (betaWanted - s.betaDeg) * clamp(betaResponse * dt, 0, 1),
    -betaMax,
    betaMax,
  );
  next.headingDeg = clamp(next.chiDeg + next.betaDeg, -60, 60);

  // Stall is decided on the speed carried in from the previous step, and a
  // banked wing carries load, so the wing gives up sooner.
  const vStall = stallKt(aircraft, s.flapIdx, next.bankDeg);
  next.stallKt = vStall;
  next.stalled = s.speedKt < vStall;

  let pitchCmd = clamp(s.pitchCmd + (controls.pitch ?? 0) * PITCH_RATE_DEG_S * dt, 0, 20);
  if (next.stalled) {
    // Control authority is gone: pitch decays to a nose-down mush.
    pitchCmd = Math.max(-12, Math.min(pitchCmd, s.pitchCmd - 10 * dt));
  }
  next.pitchCmd = pitchCmd;
  next.pitchDeg = s.pitchDeg + (pitchCmd - s.pitchDeg) * (1 - Math.exp(-dt / aircraft.pitchLagS));

  let alpha = alphaDeg(aircraft, s.speedKt);
  if (next.stalled) alpha = Math.min(24, alpha + (vStall - s.speedKt) * 2.5);
  next.alphaDeg = alpha;
  next.gammaDeg = next.pitchDeg - alpha;

  const accel = speedAccelKtS(
    aircraft,
    {
      speedKt: s.speedKt,
      thrust: next.thrust,
      flapIdx: s.flapIdx,
      gearDown: s.gearDown,
      spoilers: s.spoilers,
      stalled: next.stalled,
    },
    next.gammaDeg,
  );
  next.speedKt = Math.max(0, s.speedKt + accel * dt);

  const headwindKt = controls.headwindKt ?? 0;
  const groundKt = Math.max(0, next.speedKt - headwindKt);
  next.groundSpeedKt = groundKt;

  const vsi = verticalSpeedFpm(next.speedKt, next.gammaDeg);
  const gustFpm = controls.gustFpm ?? 0;
  // Banking costs glide path: the vertical component of lift falls by 1 - cos(phi).
  const bankSink = Math.abs(vsi) * (1 / Math.cos((next.bankDeg * Math.PI) / 180) - 1);
  next.vsiFpm = vsi - bankSink + gustFpm;
  next.altFt = s.altFt + ((vsi - bankSink + gustFpm) / 60) * dt;
  next.distFt = s.distFt - horizontalFts(groundKt, next.gammaDeg) * dt;

  // Ground track = the flight path through the air, plus the wind.
  const driftFts =
    next.speedKt * KT_TO_FTS * Math.sin((next.chiDeg * Math.PI) / 180) +
    (controls.crosswindKt ?? 0) * KT_TO_FTS;
  next.lateralFt = s.lateralFt + driftFts * dt;

  next.damage = limitSpeedDamage(aircraft, next, s);

  if (next.altFt <= 0) {
    next.altFt = 0;
    next.onGround = true;
    next.touchdown = {
      fpm: Math.abs(next.vsiFpm),
      speedKt: next.speedKt,
      lateralFt: next.lateralFt,
      headingDeg: next.headingDeg,
      betaDeg: next.betaDeg,
      pastThresholdFt: -next.distFt,
      rollFt: 0,
    };
  }

  return next;
}

function stepGround(aircraft, s, controls, dt) {
  const next = { ...s };
  if (s.stopped) return next;

  const brake = clamp(controls.brake ?? 0, 0, 1) * aircraft.brakeKtS;
  // Dry, wet or contaminated: the surface decides how much of the brake arrives.
  const braking = controls.brakingFactor ?? (controls.wet ? 0.62 : 1);
  const reverse = controls.reverse && aircraft.reverse ? 3.4 : 0;
  const spoilers = controls.spoilers && aircraft.spoilers ? 2.0 : 0;
  const decel = 1.0 + brake * braking + reverse + spoilers;

  next.speedKt = Math.max(0, s.speedKt - decel * dt);
  next.vsiFpm = 0;
  next.gammaDeg = 0;
  next.stalled = false;
  next.thrust = stepThrust(s.thrust, clamp(controls.throttle ?? 0, 0, 1), aircraft.spoolS, dt);

  const rollDelta = s.speedKt * KT_TO_FTS * dt;
  next.rollFt = s.rollFt + rollDelta;
  // On the wheels the tyres absorb the nose alignment: a crabbed touchdown is
  // graded, never fatal, so only a fraction of the crosswind scrubs sideways.
  next.lateralFt =
    s.lateralFt + (controls.crosswindKt ?? 0) * 0.35 * KT_TO_FTS * dt;

  next.touchdown = s.touchdown
    ? { ...s.touchdown, rollFt: next.rollFt, endPastThresholdFt: s.touchdown.pastThresholdFt + next.rollFt }
    : s.touchdown;

  if (next.speedKt <= 0.2) {
    next.speedKt = 0;
    next.stopped = true;
  }
  return next;
}

function limitSpeedDamage(aircraft, next, prev) {
  const damage = prev.damage ?? [];
  if (next.flapIdx > 0 && next.speedKt > aircraft.vfeKt && !damage.includes('flaps')) {
    return [...damage, 'flaps'];
  }
  if (
    aircraft.vleKt &&
    next.gearDown &&
    next.speedKt > aircraft.vleKt &&
    !damage.includes('gear')
  ) {
    return [...damage, 'gear'];
  }
  return damage;
}

// ---------------------------------------------------------------------------
// Discrete configuration changes
// ---------------------------------------------------------------------------

/** Move one flap detent. Returns the same state when nothing changes. */
export function setFlapSetting(aircraft, s, delta) {
  if (s.onGround) return s;
  const flapIdx = clamp(s.flapIdx + delta, 0, aircraft.flaps.length - 1);
  if (flapIdx === s.flapIdx) return s;
  return { ...s, flapIdx, stallKt: stallKt(aircraft, flapIdx) };
}

/** Retractable gear only; fixed-gear aircraft ignore the command. */
export function setGearDown(aircraft, s, down) {
  if (aircraft.gear !== 'retractable' || s.onGround || s.gearDown === down) return s;
  return { ...s, gearDown: down };
}

export function setSpoilers(aircraft, s, on) {
  if (!aircraft.spoilers || s.spoilers === on) return s;
  return { ...s, spoilers: on };
}

// ---------------------------------------------------------------------------
// Touchdown evaluation
// ---------------------------------------------------------------------------

export function touchdownZoneFt(aircraft, level) {
  const runwayFt = (level.runwayM ?? aircraft.runwayM) * FEET_PER_M;
  return Math.min(3000, runwayFt * 0.6);
}

/** Where a stabilised approach with a normal flare actually touches down. */
export function idealTouchdownFt() {
  return glidePathTouchdownFt() + 600;
}

/**
 * Grades a touchdown. `td` is the record written by step():
 * { fpm, speedKt, lateralFt, pastThresholdFt }.
 */
export function classifyTouchdown(aircraft, level, td) {
  const runwayFt = (level.runwayM ?? aircraft.runwayM) * FEET_PER_M;
  const tdzFt = touchdownZoneFt(aircraft, level);
  const idealFt = idealTouchdownFt();
  const speedDev = td.speedKt - aircraft.vrefKt;
  const headingDev = td.headingDeg ?? 0;
  const base = {
    fpm: Math.round(td.fpm),
    speedKt: Math.round(td.speedKt),
    speedDev: Math.round(speedDev),
    pastThresholdFt: Math.round(td.pastThresholdFt),
    lateralFt: Math.round(td.lateralFt),
    headingDev: Math.round(headingDev * 10) / 10,
    tdzFt: Math.round(tdzFt),
    runwayFt: Math.round(runwayFt),
  };

  if (td.fpm > HARD_TOUCHDOWN_FPM) {
    return { ...base, ok: false, code: 'hard', label: 'Gear collapse: you slammed it down' };
  }
  if (td.pastThresholdFt < 0) {
    return { ...base, ok: false, code: 'short', label: 'Undershoot: you touched down before the runway' };
  }
  if (td.pastThresholdFt > tdzFt) {
    return { ...base, ok: false, code: 'long', label: 'Overrun: you wasted the touchdown zone' };
  }
  if (Math.abs(td.lateralFt) > RUNWAY_HALF_WIDTH_FT) {
    return { ...base, ok: false, code: 'edge', label: 'Off the runway edge' };
  }
  if (Math.abs(speedDev) > SPEED_TOLERANCE_KT) {
    return {
      ...base,
      ok: false,
      code: 'speed',
      label: speedDev > 0 ? 'Too fast at touchdown' : 'Too slow at touchdown',
    };
  }

  const fpmPenalty = Math.max(0, (td.fpm - 150) / (HARD_TOUCHDOWN_FPM - 150)) * 30;
  const speedPenalty = Math.max(0, (Math.abs(speedDev) - 3) / (SPEED_TOLERANCE_KT - 3)) * 25;
  const latPenalty =
    Math.max(0, (Math.abs(td.lateralFt) - 10) / (RUNWAY_HALF_WIDTH_FT - 10)) * 20;
  const zoneError = Math.abs(td.pastThresholdFt - idealFt);
  const zonePenalty = Math.max(0, (zoneError - 500) / Math.max(1, tdzFt - 500)) * 25;
  // Alignment is scored, never fatal: the nose should meet the runway axis, so
  // the de-crab at the flare costs precision but can never collapse the gear.
  const alignPenalty = Math.max(0, (Math.abs(headingDev) - 2) / 8) * 20;
  const points = Math.round(
    clamp(100 - fpmPenalty - speedPenalty - latPenalty - zonePenalty - alignPenalty, 1, 100),
  );

  const medal = points >= 90 ? 'gold' : points >= 78 ? 'silver' : points >= 62 ? 'bronze' : 'rough';
  return { ...base, ok: true, code: 'ok', label: 'Landed', medal, points };
}

/** True when the rollout ran past the end of the runway. */
export function isRunwayExcursion(aircraft, level, td, rollFt) {
  const runwayFt = (level.runwayM ?? aircraft.runwayM) * FEET_PER_M;
  return td.pastThresholdFt + rollFt > runwayFt;
}
