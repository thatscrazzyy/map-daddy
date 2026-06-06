import { useEffect, useState } from 'react';
import { liveSkyService, type IssPass, type LookAngle } from './liveSkyService';

export type ISSState = {
  look: LookAngle | null;
  visible: boolean;
  nextPass: IssPass | null;
};

/**
 * Fetches the ISS TLE (via liveSkyService / Celestrak) and propagates it with
 * satellite.js, updating the current look angle every second and refreshing the
 * next-pass prediction on a slower cadence.
 */
export function useISSPosition(lat: number, lon: number): ISSState {
  const [state, setState] = useState<ISSState>({ look: null, visible: false, nextPass: null });

  useEffect(() => {
    liveSkyService.ensureTle();
    let passComputedAt = 0;
    let nextPass: IssPass | null = null;

    const tick = () => {
      const now = new Date();
      const look = liveSkyService.getIssLookAngle(now, lat, lon);
      if (now.getTime() - passComputedAt > 60_000) {
        nextPass = liveSkyService.getNextIssPass(now, lat, lon);
        passComputedAt = now.getTime();
      }
      setState({ look, visible: !!look && look.altDeg > 0, nextPass });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lat, lon]);

  return state;
}
