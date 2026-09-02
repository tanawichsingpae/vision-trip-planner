export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodePlaceResult extends Coordinates {
  photoUrl?: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  placeId?: string | null;
  formattedAddress?: string | null;
}

// ---------------------------------------------------------------------------
// Haversine distance (metres) between two coordinates
// ---------------------------------------------------------------------------
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

// ---------------------------------------------------------------------------
// Internal helpers (Promise wrappers around callback-based Google APIs)
// ---------------------------------------------------------------------------

/** textSearch — fuzzy phrase matching, supports descriptive names */
function textSearchAsync(
  service: google.maps.places.PlacesService,
  query: string,
  bias?: Coordinates
): Promise<GeocodePlaceResult> {
  return new Promise((resolve, reject) => {
    const request: google.maps.places.TextSearchRequest = {
      query,
      ...(bias
        ? { location: new google.maps.LatLng(bias.lat, bias.lng), radius: 50_000 }
        : {}),
    };
    service.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
        const first = results[0];
        const loc = first.geometry?.location;
        if (loc) {
          const photoUrl = first.photos?.[0]?.getUrl?.({ maxWidth: 800, maxHeight: 600 }) || null;
          resolve({
            lat: loc.lat(),
            lng: loc.lng(),
            photoUrl,
            rating: first.rating || null,
            userRatingsTotal: first.user_ratings_total || null,
            placeId: first.place_id || null,
            formattedAddress: first.formatted_address || null,
          });
          return;
        }
      }
      reject(new Error(`textSearch failed [${status}]: ${query}`));
    });
  });
}

/** findPlaceFromQuery — exact-name matching with optional bias circle */
function findPlaceAsync(
  service: google.maps.places.PlacesService,
  query: string,
  bias?: Coordinates
): Promise<GeocodePlaceResult> {
  return new Promise((resolve, reject) => {
    const request: google.maps.places.FindPlaceFromQueryRequest = {
      query,
      fields: ["geometry", "photos", "rating", "user_ratings_total", "place_id", "formatted_address"],
    };
    if (bias) {
      (request as any).locationBias = new google.maps.Circle({
        center: bias,
        radius: 50_000,
      });
    }
    service.findPlaceFromQuery(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
        const first = results[0];
        const loc = first.geometry?.location;
        if (loc) {
          const photoUrl = first.photos?.[0]?.getUrl?.({ maxWidth: 800, maxHeight: 600 }) || null;
          resolve({
            lat: loc.lat(),
            lng: loc.lng(),
            photoUrl,
            rating: first.rating || null,
            userRatingsTotal: first.user_ratings_total || null,
            placeId: first.place_id || null,
            formattedAddress: first.formatted_address || null,
          });
          return;
        }
      }
      reject(new Error(`findPlaceFromQuery failed [${status}]: ${query}`));
    });
  });
}

/** Geocoder — address-based fallback */
function geocodeAsync(geocoder: google.maps.Geocoder, address: string): Promise<GeocodePlaceResult> {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results?.length) {
        const loc = results[0].geometry.location;
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          formattedAddress: results[0].formatted_address || null,
          placeId: results[0].place_id || null,
        });
      } else {
        reject(new Error(`Geocoder failed [${status}]: ${address}`));
      }
    });
  });
}


// ---------------------------------------------------------------------------
// Place-name normalisation
// ---------------------------------------------------------------------------

function cleanPlaceName(title: string): string {
  const prefixPatterns = [
    /^(Explore|Visit|See|Tour|Check out|Discover|Experience|Enjoy|Attend|Watch|Ride|Take a|Catch a|Walk|Stroll|Hike|Climb|Swim at|Snorkel at|Dive at)\s+/i,
    /^(Breakfast|Lunch|Dinner|Brunch|Supper|Snack)\s+(at|in|near|by|around|along|by the)\s+/i,
    /^(Grab|Have|Try|Eat|Taste|Sample)\s+(breakfast|lunch|dinner|brunch|coffee|tea|a meal|food|snacks?)\s+(at|in|near|by|around)?\s*/i,
    /^(Night|Morning|Evening|Afternoon|Sunset|Sunrise)\s+(view|visit|walk|cruise|tour|market|show|performance|activity)\s+(of|at|in|near|along)?\s*/i,
    /^(Traditional|Local|Authentic|Classic|Famous|Typical)\s+[\w\s]*(Lunch|Dinner|Breakfast|Brunch)\s+(at|in|near)?\s*/i,
    /^(at|in|near|by|around|along|the)\s+/i,
  ];

  let cleaned = title.trim();
  let prev = "";
  while (prev !== cleaned) {
    prev = cleaned;
    for (const p of prefixPatterns) cleaned = cleaned.replace(p, "").trim();
  }

  const andIdx = cleaned.search(/\s+and\s+/i);
  if (andIdx > 0) cleaned = cleaned.slice(0, andIdx).trim();

  return cleaned.length > 0
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : title.trim();
}

/** Extract the longest sequence of capitalised words (likely a proper noun) */
function extractKeyword(title: string): string {
  const matches = title.match(/([A-Z][a-zA-Z''-]+(?:\s+[A-Z][a-zA-Z''-]+)*)/g);
  if (matches?.length) return matches.sort((a, b) => b.length - a.length)[0];
  return title.trim();
}

// ---------------------------------------------------------------------------
// PUBLIC: getCoordinates
//
// Waterfall (most flexible → most specific):
//   1. textSearch("raw title, city")       ← tries first — handles descriptive names
//   2. textSearch("cleaned title, city")   ← stripped of AI prefixes
//   3. textSearch("keyword, city")         ← proper-noun fragment only
//   4. findPlaceFromQuery("cleaned, city") ← exact-name match
//   5. geocode("cleaned, city")            ← address-based last resort
//
// All steps use `bias` (city centre coords) to prefer local results.
//
// Returns the resolved Coordinates or throws if all strategies fail.
// ---------------------------------------------------------------------------
export async function getCoordinates(
  placeName: string,
  bias?: Coordinates,
  cityName?: string
): Promise<GeocodePlaceResult> {
  if (typeof google === "undefined" || !google.maps) {
    throw new Error("Google Maps SDK not loaded.");
  }

  const cleaned = cleanPlaceName(placeName);
  const keyword = extractKeyword(cleaned || placeName);
  const city = cityName ? `, ${cityName}` : "";

  // Build candidate query list (deduplicated)
  const candidates = [
    `${placeName}${city}`,    // 1. Raw title + city (textSearch handles descriptive phrasing)
    `${cleaned}${city}`,      // 2. Cleaned title + city
    `${keyword}${city}`,      // 3. Keyword-only + city
    placeName,                 // 4. Raw title alone (no city, last chance)
  ].filter((q, i, arr) => arr.indexOf(q) === i && q.trim().length > 0);

  if (!google.maps.places) {
    // PlacesService unavailable — geocoder only
    const geocoder = new google.maps.Geocoder();
    for (const q of candidates) {
      try { return await geocodeAsync(geocoder, q); } catch (_) { /* try next */ }
    }
    throw new Error(`All geocoding failed for: "${placeName}"`);
  }

  const service = new google.maps.places.PlacesService(document.createElement("div"));
  const geocoder = new google.maps.Geocoder();

  // --- Strategy 1 & 2: textSearch for each candidate (most flexible) ---
  for (const q of candidates) {
    try { return await textSearchAsync(service, q, bias); } catch (_) { /* try next */ }
  }

  // --- Strategy 3: findPlaceFromQuery for each candidate (exact-name) ---
  for (const q of candidates) {
    try { return await findPlaceAsync(service, q, bias); } catch (_) { /* try next */ }
  }

  // --- Strategy 4: Geocoder (address-based) ---
  for (const q of [`${cleaned}${city}`, `${keyword}${city}`, placeName]) {
    try { return await geocodeAsync(geocoder, q); } catch (_) { /* try next */ }
  }

  throw new Error(`All geocoding strategies exhausted for: "${placeName}"`);
}
