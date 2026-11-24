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

export function makeCamera(
  state,
  { cx, horizonY, altOffsetFt = 0, zApronFt = 0, rollWithBank = false, pivotY = null },
) {
  return {
    cx,
    horizonY: horizonY + state.pitchDeg * PX_PER_DEG,
    altFt: Math.max(0, state.altFt) + altOffsetFt,
    offsetFt: state.lateralFt ?? 0,
    focal: FOCAL_PX,
    zApronFt,
    // Banking must be visible from the pilot's seat: the eye rolls with the
    // aircraft, so the world rotates the other way around it. Without this the
    // ailerons produce a rate with no visual consequence.
    rollRad: rollWithBank ? -((state.bankDeg ?? 0) * Math.PI) / 180 : 0,
    pivotY: pivotY ?? horizonY,
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
  const x = cam.cx + ((worldXFt - cam.offsetFt) * cam.focal) / z;
  const y = cam.horizonY + ((cam.altFt - worldYFt) * cam.focal) / z;
  const roll = cam.rollRad ?? 0;
  if (roll === 0) return { x, y, scale: cam.focal / z };
  const dx = x - cam.cx;
  const dy = y - cam.pivotY;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return {
    x: cam.cx + dx * c - dy * s,
    y: cam.pivotY + dx * s + dy * c,
    scale: cam.focal / z,
  };
}

/** The horizon after roll: where the sky meets the ground in this frame. */
export function horizonLine(cam) {
  const roll = cam.rollRad ?? 0;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const dy = cam.horizonY - cam.pivotY;
  const px = cam.cx - dy * s;
  const py = cam.pivotY + dy * c;
  const far = 4000;
  return [
    [px - far * c, py - far * s],
    [px + far * c, py + far * s],
  ];
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
