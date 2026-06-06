import { Body, Equator, Horizon, Illumination, MoonPhase, Observer } from 'astronomy-engine';
import { STAR_CATALOG } from './starCatalog';

/**
 * Pure celestial-position helpers. Fixed stars are converted from RA/Dec to
 * Alt/Az with a local-sidereal-time formula (no library needed); the moon and
 * planets — which actually move — go through astronomy-engine.
 *
 * Azimuth is degrees clockwise from true north; altitude is degrees above the
 * horizon. These feed straight into skyProjection.azAltToPanorama.
 */

export type SkyPoint = {
  id: string;
  name: string;
  azDeg: number;
  altDeg: number;
  mag: number;
};

export type MoonInfo = {
  azDeg: number;
  altDeg: number;
  /** 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  phaseAngleDeg: number;
  /** Illuminated fraction 0..1. */
  illumFraction: number;
  visible: boolean;
};

const DEG = Math.PI / 180;

function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/** Local apparent sidereal time in degrees (good enough for star plotting). */
export function localSiderealTimeDeg(date: Date, lonEastDeg: number): number {
  const jd = julianDay(date);
  const d = jd - 2_451_545.0;
  const t = d / 36_525;
  let gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38_710_000;
  gmst = ((gmst % 360) + 360) % 360;
  return ((gmst + lonEastDeg) % 360 + 360) % 360;
}

export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lstDeg: number
): { azDeg: number; altDeg: number } {
  const ha = ((lstDeg - raDeg) % 360 + 360) % 360;
  const haRad = ha * DEG;
  const decRad = decDeg * DEG;
  const latRad = latDeg * DEG;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosA = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(alt) || 1e-9);
  let az = Math.acos(Math.max(-1, Math.min(1, cosA))) / DEG;
  if (Math.sin(haRad) > 0) az = 360 - az;

  return { azDeg: ((az % 360) + 360) % 360, altDeg: alt / DEG };
}

/** All catalogue stars as Alt/Az (callers filter by altitude). */
export function computeStars(date: Date, latDeg: number, lonDeg: number): SkyPoint[] {
  const lst = localSiderealTimeDeg(date, lonDeg);
  return STAR_CATALOG.map((star) => {
    const { azDeg, altDeg } = equatorialToHorizontal(star.raHours * 15, star.decDeg, latDeg, lst);
    return { id: star.id, name: star.name, azDeg, altDeg, mag: star.mag };
  });
}

function bodyAltAz(body: Body, date: Date, observer: Observer): { azDeg: number; altDeg: number } {
  const eq = Equator(body, date, observer, true, true);
  const hor = Horizon(date, observer, eq.ra, eq.dec, 'normal');
  return { azDeg: hor.azimuth, altDeg: hor.altitude };
}

export function computeMoon(date: Date, latDeg: number, lonDeg: number): MoonInfo {
  const observer = new Observer(latDeg, lonDeg, 0);
  const { azDeg, altDeg } = bodyAltAz(Body.Moon, date, observer);
  const illum = Illumination(Body.Moon, date);
  const phaseAngleDeg = MoonPhase(date);
  return {
    azDeg,
    altDeg,
    phaseAngleDeg,
    illumFraction: illum.phase_fraction,
    visible: altDeg > 0
  };
}

const PLANETS: Array<{ body: Body; name: string }> = [
  { body: Body.Venus, name: 'Venus' },
  { body: Body.Mars, name: 'Mars' },
  { body: Body.Jupiter, name: 'Jupiter' },
  { body: Body.Saturn, name: 'Saturn' }
];

export function computePlanets(date: Date, latDeg: number, lonDeg: number): SkyPoint[] {
  const observer = new Observer(latDeg, lonDeg, 0);
  return PLANETS.map(({ body, name }) => {
    const { azDeg, altDeg } = bodyAltAz(body, date, observer);
    let mag = 0;
    try {
      mag = Illumination(body, date).mag;
    } catch {
      mag = 0;
    }
    return { id: name.toLowerCase(), name, azDeg, altDeg, mag };
  });
}

/** The brightest objects currently above the horizon, for the "tonight's sky" list. */
export function brightestVisible(date: Date, latDeg: number, lonDeg: number, limit = 5): SkyPoint[] {
  const moon = computeMoon(date, latDeg, lonDeg);
  const objects: SkyPoint[] = [
    ...computeStars(date, latDeg, lonDeg),
    ...computePlanets(date, latDeg, lonDeg)
  ];
  if (moon.visible) objects.push({ id: 'moon', name: 'Moon', azDeg: moon.azDeg, altDeg: moon.altDeg, mag: -12 });
  return objects
    .filter((object) => object.altDeg > 3)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, limit);
}
