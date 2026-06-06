import { ecfToLookAngles, eciToEcf, gstime, propagate, twoline2satrec, type SatRec } from 'satellite.js';

/**
 * Non-React runtime service for the two live data feeds that can't be derived
 * purely from time + location: nearby aircraft (airplanes.live) and the ISS
 * (Celestrak TLE propagated with satellite.js).
 *
 * It is a process-wide singleton so the projector RAF loop, the editor preview
 * and the React hooks all share one set of network requests. Everything
 * degrades gracefully to empty/null when offline or blocked by CORS.
 */

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export type Flight = {
  icao: string;
  callsign: string;
  lat: number;
  lon: number;
  altFt: number;
  track: number;
  typeCode: string;
  category: string;
};

export type LookAngle = { azDeg: number; altDeg: number };

export type IssPass = {
  startMs: number;
  startAzDeg: number;
  endAzDeg: number;
  maxAltDeg: number;
};

const FLIGHT_POLL_MS = 5000;
const FLIGHT_RADIUS_NM = 50;
const ISS_CATNR = 25544;
const ISS_TLE_URL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${ISS_CATNR}&FORMAT=TLE`;
const TLE_REFRESH_MS = 6 * 60 * 60 * 1000;

class LiveSkyService {
  private flights: Flight[] = [];
  private flightTimer = 0;
  private flightSubscribers = 0;
  private flightLat = 0;
  private flightLon = 0;
  private flightInFlight = false;

  private satrec: SatRec | null = null;
  private tleFetchedAt = 0;
  private tlePending = false;

  // ---- Flights ---------------------------------------------------------

  subscribeFlights(lat: number, lon: number): () => void {
    this.flightSubscribers += 1;
    this.setFlightLocation(lat, lon);
    if (this.flightSubscribers === 1) {
      void this.pollFlights();
      this.flightTimer = window.setInterval(() => void this.pollFlights(), FLIGHT_POLL_MS);
    }
    return () => {
      this.flightSubscribers = Math.max(0, this.flightSubscribers - 1);
      if (this.flightSubscribers === 0) {
        window.clearInterval(this.flightTimer);
        this.flightTimer = 0;
        this.flights = [];
      }
    };
  }

  setFlightLocation(lat: number, lon: number) {
    if (Math.abs(lat - this.flightLat) > 0.05 || Math.abs(lon - this.flightLon) > 0.05) {
      this.flightLat = lat;
      this.flightLon = lon;
      if (this.flightSubscribers > 0) void this.pollFlights();
    }
  }

  getFlights(): Flight[] {
    return this.flights;
  }

  private async pollFlights() {
    if (this.flightInFlight) return;
    this.flightInFlight = true;
    try {
      const url = `https://api.airplanes.live/v2/point/${this.flightLat.toFixed(4)}/${this.flightLon.toFixed(4)}/${FLIGHT_RADIUS_NM}`;
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.json();
      const aircraft = Array.isArray(data?.ac) ? data.ac : [];
      this.flights = aircraft
        .filter((ac: Record<string, unknown>) => typeof ac.lat === 'number' && typeof ac.lon === 'number')
        .map((ac: Record<string, unknown>) => ({
          icao: String(ac.hex ?? '').toUpperCase(),
          callsign: String(ac.flight ?? '').trim() || String(ac.hex ?? '').toUpperCase(),
          lat: Number(ac.lat),
          lon: Number(ac.lon),
          altFt: typeof ac.alt_baro === 'number' ? ac.alt_baro : 0,
          track: typeof ac.track === 'number' ? ac.track : (typeof ac.true_heading === 'number' ? ac.true_heading : 0),
          typeCode: String(ac.t ?? ''),
          category: String(ac.category ?? '')
        }));
    } catch {
      // offline / CORS — keep last known flights, fail quiet
    } finally {
      this.flightInFlight = false;
    }
  }

  // ---- ISS -------------------------------------------------------------

  ensureTle() {
    const now = Date.now();
    if (this.tlePending) return;
    if (this.satrec && now - this.tleFetchedAt < TLE_REFRESH_MS) return;
    this.tlePending = true;
    fetch(ISS_TLE_URL)
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const l1 = lines.find((line) => line.startsWith('1 '));
        const l2 = lines.find((line) => line.startsWith('2 '));
        if (l1 && l2) {
          this.satrec = twoline2satrec(l1, l2);
          this.tleFetchedAt = Date.now();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        this.tlePending = false;
      });
  }

  hasIss(): boolean {
    return !!this.satrec;
  }

  getIssLookAngle(date: Date, latDeg: number, lonDeg: number): LookAngle | null {
    if (!this.satrec) {
      this.ensureTle();
      return null;
    }
    try {
      const propagated = propagate(this.satrec, date);
      const position = propagated.position;
      if (!position || typeof position === 'boolean') return null;
      const gmst = gstime(date);
      const ecf = eciToEcf(position, gmst);
      const look = ecfToLookAngles({ longitude: lonDeg * RAD, latitude: latDeg * RAD, height: 0 }, ecf);
      return { azDeg: ((look.azimuth * DEG) % 360 + 360) % 360, altDeg: look.elevation * DEG };
    } catch {
      return null;
    }
  }

  /** Scan forward for the next pass rising above 10° within the next ~8 hours. */
  getNextIssPass(fromDate: Date, latDeg: number, lonDeg: number): IssPass | null {
    if (!this.satrec) {
      this.ensureTle();
      return null;
    }
    const stepMs = 30_000;
    const horizonMs = 8 * 60 * 60 * 1000;
    let inPass = false;
    let pass: Partial<IssPass> = {};
    for (let elapsed = 0; elapsed <= horizonMs; elapsed += stepMs) {
      const date = new Date(fromDate.getTime() + elapsed);
      const look = this.getIssLookAngle(date, latDeg, lonDeg);
      if (!look) return null;
      if (!inPass && look.altDeg > 10) {
        inPass = true;
        pass = { startMs: date.getTime(), startAzDeg: look.azDeg, maxAltDeg: look.altDeg };
      } else if (inPass) {
        pass.maxAltDeg = Math.max(pass.maxAltDeg ?? 0, look.altDeg);
        if (look.altDeg <= 10) {
          pass.endAzDeg = look.azDeg;
          return pass as IssPass;
        }
      }
    }
    return inPass ? ({ ...pass, endAzDeg: pass.startAzDeg } as IssPass) : null;
  }
}

export const liveSkyService = new LiveSkyService();

const EARTH_RADIUS_KM = 6371;

/** Convert an aircraft's geographic position to look angles from the observer. */
export function flightLookAngle(observerLat: number, observerLon: number, flight: Flight): LookAngle {
  const lat1 = observerLat * RAD;
  const lat2 = flight.lat * RAD;
  const dLon = (flight.lon - observerLon) * RAD;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const azDeg = ((Math.atan2(y, x) * DEG) % 360 + 360) % 360;

  const dLat = (flight.lat - observerLat) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const groundKm = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  const altKm = flight.altFt * 0.0003048;
  const altDeg = Math.atan2(altKm, Math.max(0.1, groundKm)) * DEG;

  return { azDeg, altDeg };
}
