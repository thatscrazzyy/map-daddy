import { useEffect, useMemo, useState } from 'react';
import { brightestVisible, computeMoon, computeStars, type MoonInfo, type SkyPoint } from './skyData';

/**
 * React wrapper over the pure skyData helpers. Recomputes star/moon positions on
 * a slow interval (the sky barely moves second-to-second) for the editor's
 * calibration UI — the projector renderer uses skyData/skyScene directly.
 */
export type AstronomyState = {
  stars: SkyPoint[];
  visibleStars: SkyPoint[];
  moon: MoonInfo;
  tonight: SkyPoint[];
};

export function useAstronomyEngine(
  lat: number,
  lon: number,
  refreshMs = 10_000
): AstronomyState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  return useMemo(() => {
    const date = new Date(now);
    const stars = computeStars(date, lat, lon);
    return {
      stars,
      visibleStars: stars.filter((star) => star.altDeg > 0).sort((a, b) => a.mag - b.mag),
      moon: computeMoon(date, lat, lon),
      tonight: brightestVisible(date, lat, lon, 5)
    };
  }, [now, lat, lon]);
}
