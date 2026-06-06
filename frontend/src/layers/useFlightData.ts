import { useEffect, useState } from 'react';
import { flightLookAngle, liveSkyService, type Flight, type LookAngle } from './liveSkyService';

export type FlightWithLook = Flight & { look: LookAngle };

/**
 * Subscribes to the shared airplanes.live feed and returns nearby aircraft with
 * their look angles from the observer. Polling (every 5s) is owned by
 * liveSkyService so this hook and the projector renderer share one set of
 * requests; the hook just samples the latest result on an interval.
 */
export function useFlightData(lat: number, lon: number, sampleMs = 2000): FlightWithLook[] {
  const [flights, setFlights] = useState<FlightWithLook[]>([]);

  useEffect(() => {
    const unsubscribe = liveSkyService.subscribeFlights(lat, lon);
    const sample = () => {
      setFlights(
        liveSkyService.getFlights().map((flight) => ({ ...flight, look: flightLookAngle(lat, lon, flight) }))
      );
    };
    sample();
    const id = window.setInterval(sample, sampleMs);
    return () => {
      window.clearInterval(id);
      unsubscribe();
    };
  }, [lat, lon, sampleMs]);

  return flights;
}
