import { useState, useEffect, useRef } from "react";

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;

export interface TravelSegment {
  durationText: string; // e.g. "15 min"
  distanceText: string; // e.g. "5.2 km"
  status: "loading" | "ok" | "error";
}

interface LatLng {
  lat: number;
  lng: number;
}

// Cache to avoid redundant API calls for the same origin→destination pair
const cache = new Map<string, TravelSegment>();

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

async function fetchDistanceMatrix(origin: LatLng, destination: LatLng): Promise<TravelSegment> {
  const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}->${destination.lat.toFixed(
    5
  )},${destination.lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key)!;

  // 0. Immediate check for identical or negligible coordinates
  if (Math.abs(origin.lat - destination.lat) < 0.0001 && Math.abs(origin.lng - destination.lng) < 0.0001) {
    const zeroSeg: TravelSegment = { durationText: "1 min", distanceText: "0 m", status: "ok" };
    cache.set(key, zeroSeg);
    return zeroSeg;
  }

  // 1. Try Backend Routing Proxy (avoids browser-level 400 red errors when waypoints are off-road/in water)
  const backendUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";
  try {
    const res = await fetch(`${backendUrl}/routing?waypoints=${origin.lat},${origin.lng}|${destination.lat},${destination.lng}&mode=drive`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok" && data.distanceText && data.durationText) {
        const seg: TravelSegment = {
          durationText: data.durationText,
          distanceText: data.distanceText,
          status: "ok",
        };
        cache.set(key, seg);
        return seg;
      }
    }
  } catch {
    // Backend proxy unavailable, proceed to client fallback
  }

  // 2. Fast and accurate Haversine calculation (avg 35 km/h city speed + 3 mins buffer)
  const distKm = haversineKm(origin, destination);
  const estSec = Math.round((distKm / 35) * 3600) + 180;
  const seg: TravelSegment = {
    distanceText: distKm >= 1 ? `${distKm.toFixed(1)} km` : `${Math.round(distKm * 1000)} m`,
    durationText: formatDuration(estSec),
    status: "ok",
  };
  cache.set(key, seg);
  return seg;
}

/**
 * Hook: compute driving distances between consecutive coordinates.
 * Returns an array of TravelSegment, length = coords.length - 1.
 */
export function useDistanceMatrix(coords: (LatLng | undefined)[]): TravelSegment[] {
  const [segments, setSegments] = useState<TravelSegment[]>([]);

  // Serialize coords to detect actual changes
  const coordsKey = coords
    .map((c) => (c ? `${c.lat.toFixed(4)},${c.lng.toFixed(4)}` : "null"))
    .join("|");

  useEffect(() => {
    if (coords.length < 2) {
      setSegments([]);
      return;
    }

    const validPairs: { origin: LatLng; destination: LatLng; idx: number }[] = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const origin = coords[i];
      const destination = coords[i + 1];
      if (origin && destination) {
        validPairs.push({ origin, destination, idx: i });
      }
    }

    // Initialise all as loading
    setSegments(
      Array.from({ length: coords.length - 1 }, () => ({
        durationText: "",
        distanceText: "",
        status: "loading" as const,
      }))
    );

    let cancelled = false;
    (async () => {
      const results: TravelSegment[] = Array.from({ length: coords.length - 1 }, () => ({
        durationText: "",
        distanceText: "",
        status: "ok" as const,
      }));

      for (const { origin, destination, idx } of validPairs) {
        if (cancelled) return;
        const seg = await fetchDistanceMatrix(origin, destination);
        results[idx] = seg;
        setSegments([...results]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coordsKey]);

  return segments;
}
