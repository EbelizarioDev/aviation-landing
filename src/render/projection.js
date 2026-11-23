// Perspective for the windshield.
//
// A pinhole camera sitting at the aircraft's height above the runway, looking
// straight down the runway axis. Everything on the runway plane is projected
// with the same two lines, so the runway, its markings and the approach lights
// stay consistent with each other and with the glide path.

import { FEET_PER_NM, clamp, glidePathAltFt } from '../physics.js';

export const FOCAL_PX = 520;
export const PX_PER_DEG = 9.5;
const NEAR_FT = 8;

export function makeCamera(state, { cx, horizonY, altOffsetFt = 0, zApronFt = 0 }) {
  return {
    cx,
    horizonY: horizonY + state.pitchDeg * PX_PER_DEG,
    altFt: Math.max(0, state.altFt) + altOffsetFt,
    offsetFt: state.lateralFt ?? 0,
    focal: FOCAL_PX,
    zApronFt,
  };
}

/**
 * Project a world point onto the windshield.
 * worldXFt: lateral offset from the runway centreline, + to the right.
 * worldYFt: height above the runway surface.
 * zFt: distance ahead of the aircraft along the runway axis.
 */
export function project(cam, worldXFt, worldYFt, zFt) {
  const z = Math.max(NEAR_FT, zFt + (cam.zApronFt ?? 0));
  return {
    x: cam.cx + ((worldXFt - cam.offsetFt) * cam.focal) / z,
    y: cam.horizonY + ((cam.altFt - worldYFt) * cam.focal) / z,
    scale: cam.focal / z,
  };
}

/** Horizontal offset of the 3 degree path at the aircraft's position. */
export function pathDeviationFt(state) {
  return state.altFt - glidePathAltFt(Math.max(0, state.distFt) / FEET_PER_NM);
}

/** -1 (well below path) .. 0 (on path) .. +1 (well above). */
export function deviationBand(state, scaleFt = 70) {
  return clamp(pathDeviationFt(state) / scaleFt, -1, 1);
}

/**
 * PAPI: a real 4-light unit shows 2 white / 2 red when you are on the path,
 * more white when high, more red when low.
 */
export function papiWhiteCount(state) {
  const whites = Math.round(2 + pathDeviationFt(state) / 25);
  return clamp(whites, 0, 4);
}
