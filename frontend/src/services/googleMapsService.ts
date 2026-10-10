/**
 * Google Maps Link Service
 *
 * Resolves Google Maps URLs (short links, full place URLs, coordinate pins)
 * into structured accommodation details (name, lat, lng, address, photo, rating).
 */

import { searchHotels, type HotelDetails } from "@/services/hotelService";
import { fetchSmartPhoto, getCuratedFallbackPhoto } from "@/services/photoService";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080";

export interface ParsedMapsUrlResult {
  name?: string;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  address?: string;
  placeId?: string;
  isShortUrl: boolean;
  cleanUrl: string;
}

/**
 * Checks if a string contains or is a valid Google Maps URL.
 */
export function isGoogleMapsUrl(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const s = input.trim().toLowerCase();
  return (
    s.includes("maps.app.goo.gl") ||
    s.includes("goo.gl/maps") ||
    s.includes("google.com/maps") ||
    s.includes("google.co.th/maps") ||
    s.includes("maps.google.com") ||
    /https?:\/\/(?:www\.)?google\.[a-z.]+\/maps/i.test(s) ||
    /https?:\/\/maps\.google\.[a-z.]+/i.test(s)
  );
}

/**
 * Extracts a Google Maps URL from a string (in case user pasted full shared text).
 */
export function extractGoogleMapsUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  const url = match[0].replace(/[.,;)>\]]+$/, "");
  return isGoogleMapsUrl(url) ? url : null;
}

/**
 * Parses full Google Maps URL on client-side using RegExp.
 * Extracts place name, exact pin coordinates (!3d!4d) or viewport coordinates (@lat,lng).
 */
export function parseGoogleMapsUrlClientSide(url: string): ParsedMapsUrlResult {
  const isShort = url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps");
  let name: string | undefined;
  let lat: number | undefined;
  let lng: number | undefined;
  let placeId: string | undefined;

  // 1. Coordinates:
  // A) Exact marker pin protobuf: !3d<lat>!4d<lng>
  const pinMatch = url.match(/!3d(-?\d+(?:\.\d+)?)[!&/]4d(-?\d+(?:\.\d+)?)/);
  if (pinMatch) {
    lat = parseFloat(pinMatch[1]);
    lng = parseFloat(pinMatch[2]);
  }

  // B) Viewport center: @<lat>,<lng>
  if (lat === undefined || lng === undefined) {
    const viewMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (viewMatch) {
      lat = parseFloat(viewMatch[1]);
      lng = parseFloat(viewMatch[2]);
    }
  }

  // C) Query parameter: q=<lat>,<lng> or ll=<lat>,<lng>
  if (lat === undefined || lng === undefined) {
    const qCoordsMatch = url.match(/[?&](?:q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (qCoordsMatch) {
      lat = parseFloat(qCoordsMatch[1]);
      lng = parseFloat(qCoordsMatch[2]);
    }
  }

  // 2. Place Name:
  // A) Path: /maps/place/<name>/
  const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/);
  if (placeMatch) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
      if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(decoded)) {
        name = decoded;
      }
    } catch {
      name = placeMatch[1].replace(/\+/g, " ");
    }
  }

  // B) Query param query= or q= (if not purely coordinates)
  if (!name) {
    const qMatch = url.match(/[?&](?:query|q)=([^&]+)/);
    if (qMatch) {
      try {
        const decodedQ = decodeURIComponent(qMatch[1].replace(/\+/g, " ")).trim();
        if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(decodedQ)) {
          name = decodedQ;
        }
      } catch {
        name = qMatch[1].replace(/\+/g, " ");
      }
    }
  }

  // 3. Place ID:
  const placeIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  if (placeIdMatch) {
    placeId = placeIdMatch[1];
  }

  // Clean trailing punctuation or details from name
  if (name) {
    if (name.includes(" · ")) {
      name = name.split(" · ")[0].trim();
    }
  }

  return {
    name,
    lat,
    lng,
    placeId,
    isShortUrl: isShort,
    cleanUrl: url,
  };
}

/**
 * Resolves a Google Maps URL (short or full link) to complete HotelDetails.
 */
export async function resolveGoogleMapsUrl(
  input: string,
  options?: {
    destinationCoords?: { lat: number; lng: number };
    destinationName?: string;
  }
): Promise<HotelDetails> {
  const extractedUrl = extractGoogleMapsUrl(input) || input.trim();

  if (!isGoogleMapsUrl(extractedUrl)) {
    throw new Error("ลิงก์ที่ระบุไม่ใช่ลิงก์ Google Maps ที่ถูกต้อง (Invalid Google Maps URL)");
  }

  // 1. Try Client-Side Parsing
  const clientParsed = parseGoogleMapsUrlClientSide(extractedUrl);

  let finalName = clientParsed.name;
  let finalLat = clientParsed.lat;
  let finalLng = clientParsed.lng;
  let finalPhotoUrl: string | undefined;
  let finalAddress: string | undefined;
  let finalPlaceId: string | undefined = clientParsed.placeId;

  // 2. If it's a short URL OR coordinates/name are missing, call backend resolver
  if (clientParsed.isShortUrl || !finalName || finalLat === undefined || finalLng === undefined) {
    try {
      // Try backend endpoint
      const resolveEndpoint = `/resolve_maps_url?url=${encodeURIComponent(extractedUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(resolveEndpoint, {
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to direct BACKEND_URL
        return fetch(`${BACKEND_URL}/resolve_maps_url?url=${encodeURIComponent(extractedUrl)}`, {
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);

      if (resp && resp.ok) {
        const data = await resp.json();
        if (data.success) {
          if (!finalName && data.name) finalName = data.name;
          if (finalLat === undefined && data.lat !== undefined) finalLat = data.lat;
          if (finalLng === undefined && data.lng !== undefined) finalLng = data.lng;
          if (!finalPhotoUrl && data.photo_url) finalPhotoUrl = data.photo_url;
          if (!finalAddress && data.address) finalAddress = data.address;
        }
      }
    } catch (backendErr) {
      console.warn("[googleMapsService] Backend URL resolver request failed:", backendErr);
    }
  }

  // 3. Fallback: If it's a short URL and backend could not resolve it:
  if (clientParsed.isShortUrl && !finalName && (finalLat === undefined || finalLng === undefined)) {
    throw new Error(
      "ไม่สามารถเปิดลิงก์แบบย่อนี้ได้ กรุณาเปิดลิงก์ในเบราว์เซอร์แล้วคัดลอก URL เต็ม (เช่น google.com/maps/place/...) มาวางแทน"
    );
  }

  // Fallback for name if only coordinates found
  if (!finalName && finalLat !== undefined && finalLng !== undefined) {
    finalName = `โรงแรม/ที่พัก (${finalLat.toFixed(4)}, ${finalLng.toFixed(4)})`;
  }

  if (!finalName) {
    throw new Error("ไม่สามารถระบุชื่อหรือตำแหน่งที่พักจากลิงก์ Google Maps นี้ได้");
  }

  // 4. Multi-tier enrichment via hotelService (Mapbox, Geoapify, Foursquare)
  let enrichedDetails: HotelDetails | null = null;
  try {
    const proximity =
      finalLat !== undefined && finalLng !== undefined
        ? { lat: finalLat, lng: finalLng }
        : options?.destinationCoords;

    const candidates = await searchHotels(finalName, {
      proximity,
      destinationName: options?.destinationName,
      limit: 3,
    });

    if (candidates && candidates.length > 0) {
      // Find candidate closest to our coords if available, or first result
      if (finalLat !== undefined && finalLng !== undefined) {
        const matched = candidates.find((c) => {
          if (!c.lat || !c.lng) return false;
          const dLat = Math.abs(c.lat - (finalLat as number));
          const dLng = Math.abs(c.lng - (finalLng as number));
          return dLat < 0.05 && dLng < 0.05; // within ~5km
        });
        enrichedDetails = matched || candidates[0];
      } else {
        enrichedDetails = candidates[0];
      }
    }
  } catch (enrichErr) {
    console.warn("[googleMapsService] Enrichment failed, using extracted info:", enrichErr);
  }

  // 5. Smart Photo Fallback
  if (!finalPhotoUrl && enrichedDetails?.photoUrl) {
    finalPhotoUrl = enrichedDetails.photoUrl;
  }
  if (!finalPhotoUrl) {
    try {
      finalPhotoUrl = (await fetchSmartPhoto(finalName, "hotel")) || undefined;
    } catch {
      finalPhotoUrl = getCuratedFallbackPhoto("hotel", finalName);
    }
  }

  let resolvedName = finalName || enrichedDetails?.name || "Selected Accommodation";
  if (finalName && enrichedDetails?.name) {
    const finalLower = finalName.toLowerCase();
    const enrichedLower = enrichedDetails.name.toLowerCase();
    const words = finalLower.split(/\s+/).filter((w) => w.length > 2);
    const hasWordMatch = words.some((w) => enrichedLower.includes(w));
    if (hasWordMatch) {
      resolvedName = enrichedDetails.name;
    } else {
      resolvedName = finalName;
    }
  }

  const result: HotelDetails = {
    name: resolvedName,
    lat: finalLat !== undefined ? finalLat : enrichedDetails?.lat,
    lng: finalLng !== undefined ? finalLng : enrichedDetails?.lng,
    photoUrl: finalPhotoUrl,
    address: enrichedDetails?.address || finalAddress,
    rating: enrichedDetails?.rating,
    userRatingsTotal: enrichedDetails?.userRatingsTotal,
    website: enrichedDetails?.website,
    phone: enrichedDetails?.phone,
    placeId: finalPlaceId || enrichedDetails?.placeId,
  };

  return result;
}
