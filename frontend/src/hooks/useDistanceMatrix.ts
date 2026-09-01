import { useState, useEffect, useRef } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export interface TravelSegment {
  durationText: string;  // e.g. "15 mins"
  distanceText: string;  // e.g. "5.2 km"
  status: "loading" | "ok" | "error";
}

interface LatLng {
  lat: number;
  lng: number;
}

// Cache to avoid redundant API calls for the same origin→destination pair
const cache = new Map<string, TravelSegment>();

async function fetchDistanceMatrix(origin: LatLng, destination: LatLng): Promise<TravelSegment> {
  const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}->${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    // Use Routes API (preferred) via fetch — avoids deprecated DistanceMatrixService
    const url =
      `https://routes.googleapis.com/directions/v2:computeRoutes`;

    const body = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: "DRIVE",
      computeAlternativeRoutes: false,
      routeModifiers: { avoidTolls: false },
      languageCode: "en-US",
      units: "METRIC",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Routes API error: ${res.status}`);
    const data = await res.json();

    const route = data.routes?.[0];
    if (!route) throw new Error("No route found");

    const durationSec = parseInt(route.duration ?? "0", 10);
    const distanceM = route.distanceMeters ?? 0;

    const durationText = formatDuration(durationSec);
    const distanceText = distanceM >= 1000
      ? `${(distanceM / 1000).toFixed(1)} km`
      : `${distanceM} m`;

    const seg: TravelSegment = { durationText, distanceText, status: "ok" };
    cache.set(key, seg);
    return seg;
  } catch (e) {
    console.warn("[useDistanceMatrix] fetch failed:", e);
    const seg: TravelSegment = { durationText: "", distanceText: "", status: "error" };
    return seg;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Hook: compute driving distances between consecutive coordinates.
 * Returns an array of TravelSegment, length = coords.length - 1.
 */
export function useDistanceMatrix(coords: (LatLng | undefined)[]): TravelSegment[] {
  const [segments, setSegments] = useState<TravelSegment[]>([]);
  // Stable ref for in-flight prevention
  const runningRef = useRef(false);

  // Serialize coords to detect actual changes
  const coordsKey = coords
    .map(c => c ? `${c.lat.toFixed(4)},${c.lng.toFixed(4)}` : "null")
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
    setSegments(Array.from({ length: coords.length - 1 }, () => ({
      durationText: "",
      distanceText: "",
      status: "loading" as const,
    })));

    let cancelled = false;
    (async () => {
      // Fetch sequentially to respect rate limits
      const results: TravelSegment[] = Array.from({ length: coords.length - 1 }, () => ({
        durationText: "",
        distanceText: "",
        status: "error" as const,
      }));

      for (const { origin, destination, idx } of validPairs) {
        if (cancelled) return;
        const seg = await fetchDistanceMatrix(origin, destination);
        results[idx] = seg;
        setSegments([...results]);
        await new Promise(r => setTimeout(r, 50)); // small gap between requests
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsKey]);

  return segments;
}
