/**
 * Foursquare Places API Client
 *
 * Direct browser calls to https://places-api.foursquare.com trigger CORS errors because
 * Foursquare does not permit browser preflight requests.
 *
 * This client routes requests through:
 * 1. Vite dev server proxy (/fsq-api/...) in development mode (same-origin, 0% CORS issues).
 * 2. Backend server proxy (/foursquare/...) in production / staging.
 */

const IS_DEV = import.meta.env.DEV;
const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080";
const FOURSQUARE_API_KEY = (import.meta.env.VITE_FOURSQUARE_API_KEY as string) || "";

export interface FoursquareVenue {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  geocodes?: {
    main?: {
      latitude: number;
      longitude: number;
    };
  };
  categories?: Array<{
    fsq_category_id: string;
    name: string;
    icon?: {
      prefix: string;
      suffix: string;
    };
  }>;
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    country?: string;
    formatted_address?: string;
  };
  photos?: Array<{
    id?: string;
    prefix: string;
    suffix: string;
    width?: number;
    height?: number;
  }>;
  rating?: number;
  stats?: {
    total_ratings?: number;
    ratings_total?: number;
  };
  hours?: {
    display?: string;
    open_now?: boolean;
    regular?: Array<{
      day: number;
      open: string;
      close: string;
    }>;
  };
  price?: number;
  website?: string;
  tel?: string;
}

export interface FoursquareSearchResponse {
  results?: FoursquareVenue[];
  context?: any;
}

// Circuit breaker: If Foursquare reports 429 (Requires paid credits / rate limited),
// we silence further requests for the rest of the session to avoid spamming the console.
const IS_CLIENT = typeof window !== "undefined";
let isSearchApiExhausted = IS_CLIENT && window.sessionStorage?.getItem("fsq_exhausted") === "1";
let isPhotoApiExhausted = isSearchApiExhausted;

export function isFoursquareRateLimited(): boolean {
  return isSearchApiExhausted || isPhotoApiExhausted;
}

export function setFoursquareRateLimited(limited: boolean = true) {
  isSearchApiExhausted = limited;
  isPhotoApiExhausted = limited;
  if (IS_CLIENT) {
    try {
      if (limited) {
        window.sessionStorage?.setItem("fsq_exhausted", "1");
      } else {
        window.sessionStorage?.removeItem("fsq_exhausted");
      }
    } catch {
      // Ignore sessionStorage issues
    }
  }
}

/**
 * Perform a venue search with automatic CORS-safe proxy routing.
 */
export async function foursquareSearch(
  query: string,
  options?: {
    lat?: number | null;
    lng?: number | null;
    radius?: number;
    limit?: number;
  }
): Promise<FoursquareSearchResponse | null> {
  const cleanQ = query.trim();
  if (!cleanQ || isFoursquareRateLimited()) return null;

  const limit = options?.limit ?? 1;
  const radius = options?.radius ?? 50000;
  let llParam = "";
  if (options?.lat != null && options?.lng != null) {
    llParam = `${options.lat},${options.lng}`;
  }

  // 1. In development, prefer Vite same-origin proxy (avoids CORS completely)
  if (IS_DEV) {
    try {
      let url = `/fsq-api/places/search?query=${encodeURIComponent(cleanQ)}&limit=${limit}`;
      if (llParam) {
        url += `&ll=${llParam}&radius=${radius}`;
      }
      const res = await fetch(url);
      if (res.status === 429 || res.status === 402 || res.headers.get("x-foursquare-exhausted") === "true") {
        setFoursquareRateLimited(true);
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.exhausted || data?.message?.includes("credits")) {
          setFoursquareRateLimited(true);
          return null;
        }
        if (Array.isArray(data?.results)) {
          return data as FoursquareSearchResponse;
        }
      }
    } catch (err) {
      console.warn("[foursquareSearch] Vite proxy attempt failed, trying backend proxy...", err);
    }
  }

  if (isFoursquareRateLimited()) return null;

  // 2. Production or fallback: Backend server proxy
  try {
    let url = `${BACKEND_URL}/foursquare/search?query=${encodeURIComponent(cleanQ)}&limit=${limit}`;
    if (llParam) {
      url += `&ll=${llParam}&radius=${radius}`;
    }
    const res = await fetch(url);
    if (res.status === 429 || res.status === 402) {
      setFoursquareRateLimited(true);
      return null;
    }
    if (res.ok) {
      const data = await res.json();
      if (data?.exhausted || data?.message?.includes("credits")) {
        setFoursquareRateLimited(true);
        return null;
      }
      if (Array.isArray(data?.results)) {
        return data as FoursquareSearchResponse;
      }
    }
  } catch (err) {
    console.warn("[foursquareSearch] Backend proxy failed:", err);
  }

  return null;
}

/**
 * Fetch venue photos with automatic CORS-safe proxy routing.
 */
export async function foursquareGetPhotos(
  placeId: string,
  limit: number = 10
): Promise<Array<{ prefix: string; suffix: string; url: string }>> {
  if (!placeId || isFoursquareRateLimited()) return [];

  // 1. In development, prefer Vite same-origin proxy
  if (IS_DEV) {
    try {
      const res = await fetch(`/fsq-api/places/${placeId}/photos?limit=${limit}`);
      if (res.status === 429 || res.status === 402 || res.headers.get("x-foursquare-exhausted") === "true") {
        setFoursquareRateLimited(true);
        return [];
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((p: any) => ({
            prefix: p.prefix,
            suffix: p.suffix,
            url: `${p.prefix}original${p.suffix}`,
          }));
        }
        if (data?.exhausted || data?.message?.includes("credits")) {
          setFoursquareRateLimited(true);
          return [];
        }
      }
    } catch {
      // Ignore credit limit / network errors
    }
  }

  if (isFoursquareRateLimited()) return [];

  // 2. Production or fallback: Backend server proxy
  try {
    const res = await fetch(`${BACKEND_URL}/foursquare/photos/${placeId}?limit=${limit}`);
    if (res.status === 429 || res.status === 402) {
      setFoursquareRateLimited(true);
      return [];
    }
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          prefix: p.prefix,
          suffix: p.suffix,
          url: `${p.prefix}original${p.suffix}`,
        }));
      }
      if (data?.exhausted || data?.message?.includes("credits")) {
        setFoursquareRateLimited(true);
        return [];
      }
    }
  } catch {
    // Ignore errors
  }

  return [];
}
