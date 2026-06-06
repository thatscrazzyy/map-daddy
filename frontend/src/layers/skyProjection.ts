import type { SourceRect, SurfaceCalibration } from '../lib/projects/types';

/**
 * The live sky is rendered once per frame into a single wide "panorama" canvas
 * whose X axis is compass azimuth (0–360°, wrapping) and whose Y axis is
 * altitude. Every surface that shares a live layer then samples its own angular
 * slice (a sourceRect window) out of that one panorama, which is what makes the
 * corner seam between two walls seamless: adjacent azimuth ranges are literally
 * adjacent columns of the same image.
 *
 * skyProjection is the single source of truth for that mapping. Stars, the moon,
 * the ISS and aircraft all go through {@link azAltToPanorama} so everything is
 * aligned, and each surface's viewport is derived by {@link calibrationToWindow}.
 */

export const PANORAMA_WIDTH = 2880; // 8 px / deg of azimuth
export const PANORAMA_ALT_MIN = -8;
export const PANORAMA_ALT_MAX = 90;
export const PANORAMA_HEIGHT = Math.round(((PANORAMA_ALT_MAX - PANORAMA_ALT_MIN) / 360) * PANORAMA_WIDTH); // square-ish degrees

/**
 * Altitude (deg) the centre of a wall looks at before elevationOffset is applied.
 * Kept low enough that the horizon band — where aircraft and the ISS rise — sits
 * inside a typical wall's vertical field of view, with stars/aurora filling above.
 */
export const BASE_CENTER_ALT = 22;

export function normalizeAzimuth(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export type PanoramaSize = {
  width: number;
  height: number;
};

export const DEFAULT_PANORAMA: PanoramaSize = {
  width: PANORAMA_WIDTH,
  height: PANORAMA_HEIGHT
};

/**
 * Map a compass azimuth / altitude pair to a pixel position in the panorama.
 * X wraps over 360°; Y places the horizon near the bottom and the zenith at the top.
 */
export function azAltToPanorama(
  azDeg: number,
  altDeg: number,
  pano: PanoramaSize = DEFAULT_PANORAMA
): { x: number; y: number } {
  const x = (normalizeAzimuth(azDeg) / 360) * pano.width;
  const altFraction = (altDeg - PANORAMA_ALT_MIN) / (PANORAMA_ALT_MAX - PANORAMA_ALT_MIN);
  const y = pano.height - altFraction * pano.height;
  return { x, y };
}

/**
 * The angular slice of sky a wall sees, derived from its calibration and aspect.
 * Horizontal field of view is fovDeg; vertical is scaled by the wall aspect so
 * sky pixels stay roughly square. rotation/elevation offsets are fine nudges.
 */
export function calibrationToWindow(
  calibration: SurfaceCalibration,
  wallAspect: number,
  pano: PanoramaSize = DEFAULT_PANORAMA
): { centerAz: number; centerAlt: number; fovX: number; fovY: number; widthPx: number; heightPx: number } {
  const fovX = calibration.fovDeg;
  const fovY = fovX / Math.max(0.2, wallAspect);
  const centerAz = normalizeAzimuth(calibration.wallBearingDeg + calibration.rotationOffsetDeg);
  const centerAlt = BASE_CENTER_ALT + calibration.elevationOffsetDeg;
  const widthPx = (fovX / 360) * pano.width;
  const heightPx = (fovY / (PANORAMA_ALT_MAX - PANORAMA_ALT_MIN)) * pano.height;
  return { centerAz, centerAlt, fovX, fovY, widthPx, heightPx };
}

/**
 * The sourceRect (in panorama pixels) a surface samples. May extend past the
 * left/right panorama edge when the slice straddles the 0/360 seam — callers
 * that copy out of the panorama must wrap horizontally (see skyScene).
 */
export function calibrationToSourceRect(
  calibration: SurfaceCalibration,
  wallAspect: number,
  pano: PanoramaSize = DEFAULT_PANORAMA
): SourceRect {
  const win = calibrationToWindow(calibration, wallAspect, pano);
  const center = azAltToPanorama(win.centerAz, win.centerAlt, pano);
  return {
    x: center.x - win.widthPx / 2,
    y: center.y - win.heightPx / 2,
    width: win.widthPx,
    height: win.heightPx
  };
}

/**
 * Project an Alt/Az coordinate to pixel XY inside a single wall's output of size
 * (wallWidth × wallHeight), accounting for its calibration. This is the
 * per-surface equivalent of {@link azAltToPanorama} and is handy for directly
 * drawing onto a wall preview without going through the panorama.
 *
 * Returns null when the point falls outside the wall's field of view.
 */
export function projectAltAzToWall(
  azDeg: number,
  altDeg: number,
  calibration: SurfaceCalibration,
  wallWidth: number,
  wallHeight: number
): { x: number; y: number; inView: boolean } | null {
  const win = calibrationToWindow(calibration, wallWidth / Math.max(1, wallHeight));
  // shortest signed azimuth delta from the wall centre, in degrees
  let dAz = normalizeAzimuth(azDeg) - win.centerAz;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;
  const dAlt = altDeg - win.centerAlt;
  const x = (0.5 + dAz / win.fovX) * wallWidth;
  const y = (0.5 - dAlt / win.fovY) * wallHeight;
  const inView = Math.abs(dAz) <= win.fovX / 2 && Math.abs(dAlt) <= win.fovY / 2;
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y, inView };
}

/**
 * Auto-align Surface B to sit directly clockwise of Surface A so the shared edge
 * is the same bearing: B.bearing = A.bearing + A.fov.
 */
export function seamAlignedBearing(aBearingDeg: number, aFovDeg: number): number {
  return normalizeAzimuth(aBearingDeg + aFovDeg);
}
