import { isFoursquareRateLimited, setFoursquareRateLimited } from "./foursquareClient";

// ---------------------------------------------------------------------------
// Script / Language Detection Helpers
// ---------------------------------------------------------------------------

/** Returns true if the string contains Thai Unicode characters (U+0E00–U+0E7F) */
export function containsThaiScript(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

/** Returns the dominant script of a query: "th", "en", or "mixed" */
function detectQueryLanguage(text: string): "th" | "en" | "mixed" {
  const hasThai = containsThaiScript(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasThai && hasLatin) return "mixed";
  if (hasThai) return "th";
  return "en";
}

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
  isFallback?: boolean;
}

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
const FOURSQUARE_API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY as string;

// Rate limit circuit breakers to prevent HTTP 429 console flood
let isNominatimExhausted = false;

// Fast in-memory geocoding cache across the session
const geocodeCache = new Map<string, GeocodePlaceResult>();

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
// Place-name normalisation
// ---------------------------------------------------------------------------
function cleanPlaceName(title: string): string {
  const prefixPatterns = [
    // English action verb prefixes
    /^(Explore|Visit|See|Tour|Check out|Discover|Experience|Enjoy|Attend|Watch|Ride|Take a|Catch a|Walk around|Walk through|Walk in|Walk|Stroll around|Stroll through|Stroll|Hike up|Hike|Climb|Swim at|Snorkel at|Dive at|Relax at|Relax in|Chill at|Rest at|Wander around|Wander through|Shopping at|Shopping in|Head to|Go to|Travel to|Arrive at)\s+/i,
    /^(Breakfast|Lunch|Dinner|Brunch|Supper|Snack|Coffee|Tea)\s+(at|in|near|by|around|along|by the)\s+/i,
    /^(Grab|Have|Try|Eat|Taste|Sample)\s+(breakfast|lunch|dinner|brunch|coffee|tea|a meal|food|snacks?)\s+(at|in|near|by|around)?\s*/i,
    /^(Night|Morning|Evening|Afternoon|Sunset|Sunrise)\s+(view|visit|walk|cruise|tour|market|show|performance|activity)\s+(of|at|in|near|along)?\s*/i,
    /^(Traditional|Local|Authentic|Classic|Famous|Typical)\s+[\w\s]*(Lunch|Dinner|Breakfast|Brunch|Food|Market|Street Food)\s+(at|in|near)?\s*/i,
    /^(at|in|near|by|around|along|the)\s+/i,
    // Thai action verb prefixes (mirroring cleanVenueSearchQuery in places.ts)
    /^(ชมวิวพระอาทิตย์ตกที่|ชมวิวที่|ชมความงามของ|ชมวิว|เที่ยวชม|เที่ยว|แวะเที่ยว|แวะชม|แวะถ่ายรูปที่|แวะถ่ายรูป|แวะ|ไหว้พระที่|ไหว้พระ|สักการะที่|สักการะ)\s*/,
    /^(ทานอาหารกลางวันที่|ทานอาหารมื้อค่ำที่|ทานอาหารเย็นที่|ทานอาหารที่|ทานมื้อเที่ยงที่|ทานมื้อค่ำที่|กินข้าวกลางวันที่|กินข้าวเที่ยงที่|กินข้าวเย็นที่|กินข้าวที่|กินอาหารที่|กิน|จิบกาแฟที่|ดื่มกาแฟที่|นั่งชิลที่)\s*/,
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
// Free Smart Photo Lookup (Wikimedia Commons -> Wikipedia -> Curated)
// ---------------------------------------------------------------------------
import { fetchSmartPhoto } from "@/services/photoService";

export async function fetchWikimediaPhoto(placeName: string, cityName?: string): Promise<string | null> {
  try {
    const photo = await fetchSmartPhoto(placeName, { cityName });
    return photo || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Well-Known Landmark Disambiguation (Instant & Exact City Resolution)
// ---------------------------------------------------------------------------
export const FAMOUS_LANDMARK_DISAMBIGUATION: Record<
  string,
  { lat: number; lng: number; formattedAddress: string }
> = {
  "wat phra kaew": { lat: 13.751497, lng: 100.492659, formattedAddress: "Wat Phra Kaew (Temple of the Emerald Buddha), Phra Nakhon, Bangkok, Thailand" },
  "temple of the emerald buddha": { lat: 13.751497, lng: 100.492659, formattedAddress: "Wat Phra Kaew (Temple of the Emerald Buddha), Phra Nakhon, Bangkok, Thailand" },
  "วัดพระแก้ว": { lat: 13.751497, lng: 100.492659, formattedAddress: "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว), พระนคร, กรุงเทพมหานคร" },
  "วัดพระศรีรัตนศาสดาราม": { lat: 13.751497, lng: 100.492659, formattedAddress: "วัดพระศรีรัตนศาสดาราม, พระนคร, กรุงเทพมหานคร" },
  "grand palace": { lat: 13.7500, lng: 100.4914, formattedAddress: "The Grand Palace, Phra Nakhon, Bangkok, Thailand" },
  "the grand palace": { lat: 13.7500, lng: 100.4914, formattedAddress: "The Grand Palace, Phra Nakhon, Bangkok, Thailand" },
  "พระบรมมหาราชวัง": { lat: 13.7500, lng: 100.4914, formattedAddress: "พระบรมมหาราชวัง, พระนคร, กรุงเทพมหานคร" },
  "wat arun": { lat: 13.743898, lng: 100.488514, formattedAddress: "Wat Arun (Temple of Dawn), Bangkok Yai, Bangkok, Thailand" },
  "temple of dawn": { lat: 13.743898, lng: 100.488514, formattedAddress: "Wat Arun (Temple of Dawn), Bangkok Yai, Bangkok, Thailand" },
  "วัดอรุณ": { lat: 13.743898, lng: 100.488514, formattedAddress: "วัดอรุณราชวราราม, บางกอกใหญ่, กรุงเทพมหานคร" },
  "wat pho": { lat: 13.7465, lng: 100.4933, formattedAddress: "Wat Pho (Temple of the Reclining Buddha), Phra Nakhon, Bangkok, Thailand" },
  "temple of the reclining buddha": { lat: 13.7465, lng: 100.4933, formattedAddress: "Wat Pho, Phra Nakhon, Bangkok, Thailand" },
  "วัดโพธิ์": { lat: 13.7465, lng: 100.4933, formattedAddress: "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์), พระนคร, กรุงเทพมหานคร" },
  "wat rong khun": { lat: 19.8242, lng: 99.7633, formattedAddress: "Wat Rong Khun (White Temple), Mueang Chiang Rai, Chiang Rai, Thailand" },
  "white temple": { lat: 19.8242, lng: 99.7633, formattedAddress: "Wat Rong Khun (White Temple), Mueang Chiang Rai, Chiang Rai, Thailand" },
  "วัดร่องขุ่น": { lat: 19.8242, lng: 99.7633, formattedAddress: "วัดร่องขุ่น, อำเภอเมืองเชียงราย, เชียงราย" },
  "wat rong suea ten": { lat: 19.9234, lng: 99.8419, formattedAddress: "Wat Rong Suea Ten (Blue Temple), Mueang Chiang Rai, Chiang Rai, Thailand" },
  "blue temple": { lat: 19.9234, lng: 99.8419, formattedAddress: "Wat Rong Suea Ten (Blue Temple), Mueang Chiang Rai, Chiang Rai, Thailand" },
  "วัดร่องเสือเต้น": { lat: 19.9234, lng: 99.8419, formattedAddress: "วัดร่องเสือเต้น, อำเภอเมืองเชียงราย, เชียงราย" },
  "baan dam": { lat: 19.9920, lng: 99.8605, formattedAddress: "Baan Dam Museum (Black House), Mueang Chiang Rai, Chiang Rai, Thailand" },
  "black house": { lat: 19.9920, lng: 99.8605, formattedAddress: "Baan Dam Museum (Black House), Mueang Chiang Rai, Chiang Rai, Thailand" },
  "พิพิธภัณฑ์บ้านดำ": { lat: 19.9920, lng: 99.8605, formattedAddress: "พิพิธภัณฑ์บ้านดำ, อำเภอเมืองเชียงราย, เชียงราย" },
  "doi suthep": { lat: 18.8049, lng: 98.9216, formattedAddress: "Wat Phra That Doi Suthep, Mueang Chiang Mai, Chiang Mai, Thailand" },
  "wat phra that doi suthep": { lat: 18.8049, lng: 98.9216, formattedAddress: "Wat Phra That Doi Suthep, Mueang Chiang Mai, Chiang Mai, Thailand" },
  "ดอยสุเทพ": { lat: 18.8049, lng: 98.9216, formattedAddress: "วัดพระธาตุดอยสุเทพ, อำเภอเมืองเชียงใหม่, เชียงใหม่" },
  "chatuchak weekend market": { lat: 13.8003, lng: 100.5511, formattedAddress: "Chatuchak Weekend Market, Chatuchak, Bangkok, Thailand" },
  "chatuchak market": { lat: 13.8003, lng: 100.5511, formattedAddress: "Chatuchak Weekend Market, Chatuchak, Bangkok, Thailand" },
  "ตลาดนัดจตุจักร": { lat: 13.8003, lng: 100.5511, formattedAddress: "ตลาดนัดจตุจักร, จตุจักร, กรุงเทพมหานคร" },
  "siam ocean world": { lat: 13.746975, lng: 100.535199, formattedAddress: "SEA LIFE Bangkok Ocean World (Siam Paragon), Pathum Wan, Bangkok, Thailand" },
  "sea life bangkok": { lat: 13.746975, lng: 100.535199, formattedAddress: "SEA LIFE Bangkok Ocean World, Pathum Wan, Bangkok, Thailand" },
  "sea life bangkok ocean world": { lat: 13.746975, lng: 100.535199, formattedAddress: "SEA LIFE Bangkok Ocean World, Pathum Wan, Bangkok, Thailand" },
  "สยามโอเชี่ยนเวิลด์": { lat: 13.746975, lng: 100.535199, formattedAddress: "ซีไลฟ์ แบงคอก โอเชี่ยน เวิลด์ (สยามพารากอน), ปทุมวัน, กรุงเทพมหานคร" },
  "ซีไลฟ์ แบงคอก": { lat: 13.746975, lng: 100.535199, formattedAddress: "ซีไลฟ์ แบงคอก โอเชี่ยน เวิลด์, ปทุมวัน, กรุงเทพมหานคร" },
  "siam paragon": { lat: 13.7467, lng: 100.5349, formattedAddress: "Siam Paragon, Pathum Wan, Bangkok, Thailand" },
  "สยามพารากอน": { lat: 13.7467, lng: 100.5349, formattedAddress: "สยามพารากอน, ปทุมวัน, กรุงเทพมหานคร" },
  "centralworld": { lat: 13.7466, lng: 100.5393, formattedAddress: "CentralWorld, Pathum Wan, Bangkok, Thailand" },
  "เซ็นทรัลเวิลด์": { lat: 13.7466, lng: 100.5393, formattedAddress: "เซ็นทรัลเวิลด์, ปทุมวัน, กรุงเทพมหานคร" },
  "iconsiam": { lat: 13.7267, lng: 100.5108, formattedAddress: "ICONSIAM, Khlong San, Bangkok, Thailand" },
  "icon siam": { lat: 13.7267, lng: 100.5108, formattedAddress: "ICONSIAM, Khlong San, Bangkok, Thailand" },
  "ไอคอนสยาม": { lat: 13.7267, lng: 100.5108, formattedAddress: "ไอคอนสยาม, คลองสาน, กรุงเทพมหานคร" },
  "asiatique": { lat: 13.7042, lng: 100.5034, formattedAddress: "Asiatique The Riverfront, Bang Kho Laem, Bangkok, Thailand" },
  "asiatique the riverfront": { lat: 13.7042, lng: 100.5034, formattedAddress: "Asiatique The Riverfront, Bang Kho Laem, Bangkok, Thailand" },
  "เอเชียทีค": { lat: 13.7042, lng: 100.5034, formattedAddress: "เอเชียทีค เดอะ ริเวอร์ฟรอนท์, บางคอแหลม, กรุงเทพมหานคร" },
  "khao san road": { lat: 13.7588, lng: 100.4974, formattedAddress: "Khao San Road, Phra Nakhon, Bangkok, Thailand" },
  "ถนนข้าวสาร": { lat: 13.7588, lng: 100.4974, formattedAddress: "ถนนข้าวสาร, พระนคร, กรุงเทพมหานคร" },
  "jim thompson house": { lat: 13.7492, lng: 100.5282, formattedAddress: "Jim Thompson House Museum, Pathum Wan, Bangkok, Thailand" },
  "บ้านจิม ทอมป์สัน": { lat: 13.7492, lng: 100.5282, formattedAddress: "บ้านจิม ทอมป์สัน, ปทุมวัน, กรุงเทพมหานคร" },
  "chao phraya river cruise": { lat: 13.732996, lng: 100.498466, formattedAddress: "Chao Phraya River Cruise, Bangkok, Thailand" },
  "chao phraya cruise": { lat: 13.732996, lng: 100.498466, formattedAddress: "Chao Phraya River Cruise, Bangkok, Thailand" },
  "ล่องเรือแม่น้ำเจ้าพระยา": { lat: 13.732996, lng: 100.498466, formattedAddress: "ล่องเรือแม่น้ำเจ้าพระยา, กรุงเทพมหานคร" },
  "ล่องเรือเจ้าพระยา": { lat: 13.732996, lng: 100.498466, formattedAddress: "ล่องเรือแม่น้ำเจ้าพระยา, กรุงเทพมหานคร" },
  "lumphini park": { lat: 13.7314, lng: 100.5414, formattedAddress: "Lumphini Park, Pathum Wan, Bangkok, Thailand" },
  "lumpini park": { lat: 13.7314, lng: 100.5414, formattedAddress: "Lumphini Park, Pathum Wan, Bangkok, Thailand" },
  "สวนลุมพินี": { lat: 13.7314, lng: 100.5414, formattedAddress: "สวนลุมพินี, ปทุมวัน, กรุงเทพมหานคร" },
  "hua lamphong": { lat: 13.7371, lng: 100.5165, formattedAddress: "Bangkok Railway Station (Hua Lamphong), Rong Mueang, Pathum Wan, Bangkok, Thailand" },
  "หัวลำโพง": { lat: 13.7371, lng: 100.5165, formattedAddress: "สถานีรถไฟกรุงเทพ (หัวลำโพง), รองเมือง, ปทุมวัน, กรุงเทพมหานคร" },
};

// ---------------------------------------------------------------------------
// Mapbox Geocoding API
// ---------------------------------------------------------------------------
async function geocodeWithMapbox(query: string, bias?: Coordinates): Promise<GeocodePlaceResult | null> {
  if (!MAPBOX_ACCESS_TOKEN) return null;

  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5`;
    if (bias && bias.lat && bias.lng) {
      url += `&proximity=${bias.lng},${bias.lat}`;
    }

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;

    const queryLower = query.toLowerCase();
    const isExplicitAddress = /^(soi|ซอย|ถนน|road|st|street|ave|avenue|lane)\s+/i.test(queryLower) || /\d+/.test(query);

    // Filter and score candidate features
    let bestFeat = null;

    for (const feat of data.features) {
      const coords = feat.center; // [lng, lat]
      if (!coords || coords.length < 2) continue;

      const placeName = feat.place_name || "";
      const placeTypes: string[] = feat.place_type || [];

      // Check distance if bias provided
      if (bias && bias.lat && bias.lng) {
        const dist = distanceMetres({ lat: coords[1], lng: coords[0] }, bias);
        if (dist > 100_000) {
          continue; // Skip out-of-bounds features
        }
      }

      // If looking for a landmark/city without explicit street address,
      // reject false alleyway matches (e.g. "ซอย วัดพระแก้ว 2" in Chiang Rai when query is "Wat Phra Kaew")
      if (!isExplicitAddress && placeTypes.includes("address")) {
        const textLower = (feat.text || "").toLowerCase();
        if (textLower.startsWith("ซอย ") || textLower.startsWith("soi ") || placeName.includes("ซอย วัด")) {
          // Skip alleyway when another POI or non-address may exist
          continue;
        }
      }

      bestFeat = feat;
      break;
    }

    // Fallback to first feature only if within distance
    if (!bestFeat && data.features.length > 0 && !bias) {
      const first = data.features[0];
      const placeTypes: string[] = first.place_type || [];
      // Even if fallback, don't return an alleyway for a general place query
      if (isExplicitAddress || !placeTypes.includes("address") || !(first.text || "").startsWith("ซอย ")) {
        bestFeat = first;
      }
    }

    if (bestFeat && bestFeat.center && bestFeat.center.length >= 2) {
      return {
        lng: bestFeat.center[0],
        lat: bestFeat.center[1],
        formattedAddress: bestFeat.place_name || null,
        placeId: bestFeat.id || null,
        photoUrl: null,
        rating: null,
        userRatingsTotal: null,
      };
    }
  } catch (err) {
    console.warn("Mapbox Geocoding failed for query:", query, err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Foursquare Places Geocoding (High POI Precision for Venues / Eateries)
// ---------------------------------------------------------------------------
async function geocodeWithFoursquare(query: string, bias?: Coordinates): Promise<GeocodePlaceResult | null> {
  if (isFoursquareRateLimited()) return null;
  if (!FOURSQUARE_API_KEY || !FOURSQUARE_API_KEY.startsWith("fsq3")) return null;

  try {
    let url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(
      query
    )}&limit=1&fields=fsq_id,name,geocodes,location,photos`;

    if (bias && bias.lat && bias.lng) {
      url += `&ll=${bias.lat},${bias.lng}&radius=50000`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: FOURSQUARE_API_KEY,
        Accept: "application/json",
      },
    });

    if (res.status === 429 || res.status === 402) {
      console.warn("[geocodeWithFoursquare] Rate limit reached (429/402). Activating circuit breaker.");
      setFoursquareRateLimited(true);
      return null;
    }

    if (!res.ok) return null;

    const data = await res.json();
    const feat = data.results?.[0];
    if (feat) {
      const coords = feat.geocodes?.main;
      if (coords?.latitude && coords?.longitude) {
        let photoUrl: string | null = null;
        if (feat.photos && feat.photos.length > 0) {
          photoUrl = `${feat.photos[0].prefix}original${feat.photos[0].suffix}`;
        }

        const result: GeocodePlaceResult = {
          lat: coords.latitude,
          lng: coords.longitude,
          formattedAddress: feat.location?.formatted_address || feat.name || null,
          placeId: feat.fsq_id || null,
          photoUrl,
          rating: null,
          userRatingsTotal: null,
        };

        if (bias && bias.lat && bias.lng) {
          const dist = distanceMetres(result, bias);
          if (dist > 100_000) {
            return null;
          }
        }

        return result;
      }
    }
  } catch (err) {
    console.warn("Foursquare Geocoding failed for query:", query, err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Geoapify Geocoding API
// ---------------------------------------------------------------------------
async function geocodeWithGeoapify(query: string, bias?: Coordinates): Promise<GeocodePlaceResult | null> {
  if (!GEOAPIFY_API_KEY) return null;

  try {
    // Use the correct response language based on query script:
    // Thai queries → lang=th so Geoapify returns Thai-script formatted addresses
    // English/mixed queries → lang=en (default)
    const queryLang = detectQueryLanguage(query);
    const langParam = queryLang === "th" ? "th" : "en";

    let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=5&lang=${langParam}`;
    if (bias && bias.lat && bias.lng) {
      url += `&bias=proximity:${bias.lng},${bias.lat}`;
      url += `&filter=circle:${bias.lng},${bias.lat},100000`; // Limit to 100km radius around destination
    }

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.features && data.features.length > 0) {
      // Prioritize POI / amenity / tourism / leisure over pure street / address
      let selectedFeat = data.features[0];
      for (const f of data.features) {
        const cat = f.properties?.category || f.properties?.result_type || "";
        if (["amenity", "tourism", "leisure", "building"].includes(cat)) {
          selectedFeat = f;
          break;
        }
      }

      const coords = selectedFeat.geometry?.coordinates;
      if (coords && coords.length >= 2) {
        // For mixed-script queries, prefer the English name field if available
        // so displayed addresses stay consistent regardless of query language
        const props = selectedFeat.properties || {};
        const formattedAddress =
          (queryLang === "mixed" ? (props.name || props.formatted) : props.formatted) || null;

        const result: GeocodePlaceResult = {
          lng: coords[0],
          lat: coords[1],
          formattedAddress,
          placeId: props.place_id || null,
          photoUrl: null,
          rating: null,
          userRatingsTotal: null,
        };

        // Safety check: ensure result is within reasonable distance (< 100km)
        if (bias && bias.lat && bias.lng) {
          const dist = distanceMetres(result, bias);
          if (dist > 100_000) {
            console.warn(`[geocodeWithGeoapify] Result for "${query}" rejected: ${Math.round(dist / 1000)}km away from destination`);
            return null;
          }
        }

        return result;
      }
    }
  } catch (err) {
    console.warn("Geoapify Geocoding failed for query:", query, err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// OpenStreetMap Nominatim Fallback (100% Free)
// ---------------------------------------------------------------------------
async function geocodeWithNominatim(query: string, bias?: Coordinates): Promise<GeocodePlaceResult | null> {
  if (isNominatimExhausted) return null;
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=en`;
    if (bias && bias.lat && bias.lng) {
      // 1 degree latitude ~ 111 km, bound search tightly to destination area
      url += `&viewbox=${bias.lng - 0.9},${bias.lat + 0.9},${bias.lng + 0.9},${bias.lat - 0.9}&bounded=1`;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "PixineraryApp/1.0",
        "Accept-Language": "en",
      },
    });
    if (res.status === 429) {
      console.warn("[geocodeWithNominatim] Nominatim rate limit (429) reached. Activating circuit breaker.");
      isNominatimExhausted = true;
      return null;
    }
    if (!res.ok) return null;

    const results = await res.json();
    if (results && results.length > 0) {
      // Prioritize amenity / tourism / leisure over highway / road
      let first = results[0];
      for (const r of results) {
        if (["amenity", "tourism", "leisure", "historic", "place_of_worship"].includes(r.class) || ["place_of_worship", "museum", "attraction", "theme_park"].includes(r.type)) {
          first = r;
          break;
        }
      }

      const result: GeocodePlaceResult = {
        lat: parseFloat(first.lat),
        lng: parseFloat(first.lon),
        formattedAddress: first.display_name || null,
        placeId: first.place_id ? String(first.place_id) : null,
        photoUrl: null,
        rating: null,
        userRatingsTotal: null,
      };

      if (bias && bias.lat && bias.lng) {
        const dist = distanceMetres(result, bias);
        if (dist > 100_000) {
          return null;
        }
      }

      return result;
    }
  } catch (err) {
    console.warn("Nominatim Geocoding fallback failed for:", query, err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// PUBLIC: getCoordinates
// ---------------------------------------------------------------------------
export async function getCoordinates(
  placeName: string,
  bias?: Coordinates,
  cityName?: string
): Promise<GeocodePlaceResult> {
  const cacheKey = `${placeName.toLowerCase().trim()}|${cityName || ""}|${bias ? `${bias.lat.toFixed(3)},${bias.lng.toFixed(3)}` : ""}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const saveCache = (res: GeocodePlaceResult): GeocodePlaceResult => {
    geocodeCache.set(cacheKey, res);
    return res;
  };

  const cleaned = cleanPlaceName(placeName);
  const keyword = extractKeyword(cleaned || placeName);

  // 0. Instant Disambiguation for World-Famous / Landmark Namesakes
  const rawKey = placeName.toLowerCase().trim().replace(/,\s*(thailand|ประเทศไทย)$/i, "").trim();
  const cleanedKey = cleaned.toLowerCase().trim().replace(/,\s*(thailand|ประเทศไทย)$/i, "").trim();

  for (const [knownName, disambig] of Object.entries(FAMOUS_LANDMARK_DISAMBIGUATION)) {
    if (rawKey === knownName || cleanedKey === knownName || rawKey.includes(knownName) || knownName.includes(rawKey)) {
      if (!bias || distanceMetres(disambig, bias) <= 150_000) {
        return saveCache({
          lat: disambig.lat,
          lng: disambig.lng,
          formattedAddress: disambig.formattedAddress,
          placeId: `disambig-${encodeURIComponent(knownName)}`,
          photoUrl: null,
          rating: 4.9,
          userRatingsTotal: 1000,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Build ordered candidate queries — CRITICAL FOR ACCURACY:
  // Rule: Never combine a Thai place name with an English city name (or vice versa)
  //       in the same query string, as this creates malformed hybrid queries that
  //       confuse geocoders (e.g. "วัดโพธิ์, Bangkok" → Geoapify returns wrong pin).
  //
  // Strategy:
  //   1. Pure-same-script combos (English place + English city, Thai place + Thai city)
  //   2. Place-only (no city) in same script
  //   3. Cross-script combos only as last resort
  // ------------------------------------------------------------------
  const placeScript = detectQueryLanguage(cleaned || placeName);
  const cityScript = cityName ? detectQueryLanguage(cityName) : null;

  const candidateList: Array<string | null> = [];

  if (cityName) {
    // Same-script combos first (avoids hybrid query issues)
    if (placeScript !== "th" && cityScript !== "th") {
      // Both English/mixed → safe to combine
      candidateList.push(`${cleaned}, ${cityName}`);
      candidateList.push(`${placeName}, ${cityName}`);
      if (keyword !== cleaned && keyword !== placeName) candidateList.push(`${keyword}, ${cityName}`);
    } else if (placeScript === "th" && cityScript === "th") {
      // Both Thai → safe to combine
      candidateList.push(`${cleaned} ${cityName}`);
      candidateList.push(`${placeName} ${cityName}`);
    } else {
      // Mixed scripts → don't combine; query place-only first, city-only second
      candidateList.push(cleaned);
      candidateList.push(placeName);
      // Then fallback to cross-script combos
      candidateList.push(`${cleaned}, ${cityName}`);
      candidateList.push(`${placeName}, ${cityName}`);
    }
  }

  // Place-only candidates (always include)
  candidateList.push(cleaned);
  candidateList.push(placeName);
  if (keyword && keyword !== cleaned && keyword !== placeName) candidateList.push(keyword);

  const uniqueCandidates = Array.from(
    new Set(candidateList.filter((q): q is string => Boolean(q && q.trim().length > 0)))
  );

  // If determining destination coordinates (no bias provided), check Geoapify first
  // because Geoapify ranks real POIs/amenities above generic streets/alleyways
  if (!bias && GEOAPIFY_API_KEY) {
    for (const q of uniqueCandidates) {
      const res = await geocodeWithGeoapify(q, bias);
      if (res) {
        return saveCache(res);
      }
    }
  }

  // Strategy 1: Try Mapbox Geocoding (high precision for landmarks, cities, districts)
  for (const q of uniqueCandidates) {
    const res = await geocodeWithMapbox(q, bias);
    if (res) {
      return saveCache(res);
    }
  }

  // Strategy 2: Try Foursquare Places (pinpoint accuracy for specific venues, cafes, eateries)
  for (const q of uniqueCandidates) {
    const res = await geocodeWithFoursquare(q, bias);
    if (res) {
      return saveCache(res);
    }
  }

  // Strategy 3: Try Geoapify with local circle filter
  for (const q of uniqueCandidates) {
    const res = await geocodeWithGeoapify(q, bias);
    if (res) {
      return saveCache(res);
    }
  }

  // Strategy 4: Fallback to OpenStreetMap Nominatim bounded viewbox (with accept-language=en)
  for (const q of uniqueCandidates) {
    const res = await geocodeWithNominatim(q, bias);
    if (res) {
      return saveCache(res);
    }
  }

  // Strategy 5: Deterministic Local Anchor Fallback (never jump continents!)
  if (bias && bias.lat && bias.lng) {
    console.warn(`[getCoordinates] Could not resolve "${placeName}" locally, anchoring near destination center`);
    let hash = 0;
    for (let i = 0; i < placeName.length; i++) {
      hash = (hash << 5) - hash + placeName.charCodeAt(i);
      hash |= 0;
    }
    const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
    const distanceKm = 0.3 + ((Math.abs(hash >> 3) % 10) * 0.05); // 300m - 800m offset
    const latOffset = (distanceKm / 111) * Math.sin(angle);
    const lngOffset = (distanceKm / (111 * Math.cos((bias.lat * Math.PI) / 180))) * Math.cos(angle);

    return saveCache({
      lat: bias.lat + latOffset,
      lng: bias.lng + lngOffset,
      formattedAddress: cityName || placeName,
      placeId: null,
      photoUrl: null,
      rating: 4.5,
      userRatingsTotal: 25,
      isFallback: true,
    });
  }

  throw new Error(`All geocoding strategies exhausted for: "${placeName}"`);
}

// ---------------------------------------------------------------------------
// Google Maps URL Builder — Always uses coords + English name for accuracy
// ---------------------------------------------------------------------------

/**
 * Builds the most accurate Google Maps URL for a place.
 *
 * Priority:
 *   1. If real lat/lng exist → `maps/place/EnglishName/@lat,lng,17z`
 *      (opens a labelled pin at the exact geocoded location)
 *   2. If only name exists → `maps/search/?query=EnglishName`
 *      (lets Google Maps search and resolve the place itself)
 *
 * Always uses the English name for the query so Google Maps can correctly
 * identify the place regardless of the user's UI language setting.
 */
export function buildGoogleMapsUrl(options: {
  lat?: number | null;
  lng?: number | null;
  /** Prefer English name for reliable Google Maps lookup */
  englishName?: string | null;
  /** Fallback name (may be Thai or native language) */
  placeName?: string | null;
  /** City/country context for search disambiguation */
  cityName?: string | null;
  /** Whether coordinates were verified from a real POI (false if jitter fallback) */
  isCoordsVerified?: boolean;
  /** Mode: "directions" | "search" | "streetview" */
  mode?: "directions" | "search" | "streetview";
}): string {
  const { lat, lng, englishName, placeName, cityName, isCoordsVerified = true, mode = "search" } = options;

  const hasCoords =
    lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  // Prefer English name because Google Maps English indexing is universal worldwide
  // If englishName is absent, use placeName (which might be Thai or native language)
  let primaryName = (englishName || "").trim();
  if (!primaryName) {
    primaryName = (placeName || "").trim();
  }

  // Disambiguate with city context if not already included in place name
  let searchQuery = primaryName;
  if (cityName && cityName.trim()) {
    const cityClean = cityName.trim();
    if (!searchQuery.toLowerCase().includes(cityClean.toLowerCase())) {
      searchQuery = searchQuery ? `${searchQuery}, ${cityClean}` : cityClean;
    }
  }

  if (mode === "directions") {
    // If coords are valid AND verified by POI, navigate directly to exact GPS coordinates
    if (hasCoords && isCoordsVerified) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    // If coords are missing or unverified/jitter fallback, navigate to place name so Google Maps resolves the real spot
    if (searchQuery) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(searchQuery)}`;
    }
    if (hasCoords) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1`;
  }

  if (mode === "streetview") {
    if (hasCoords && isCoordsVerified) {
      return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    }
    if (searchQuery) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
    }
    if (hasCoords) {
      return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    }
    return `https://www.google.com/maps`;
  }

  // "search" mode (default): opens rich Google Maps place card (reviews, photos, opening hours)
  if (searchQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  }
  if (hasCoords) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps`;
}

// ---------------------------------------------------------------------------
// Coordinate Validation — Reverse-geocode to confirm a real POI exists nearby
// ---------------------------------------------------------------------------

/** Cache to avoid repeated Nominatim reverse calls for the same coordinate */
const reverseGeocodeCache = new Map<string, boolean>();

/**
 * Verifies that a given lat/lng has a real named POI within `radiusM` metres
 * using Nominatim reverse geocoding.
 *
 * Returns true if:
 *   - Nominatim finds a result tagged as amenity/tourism/leisure/historic/building, OR
 *   - The result display_name contains the place name (fuzzy match)
 *
 * Returns false (hallucinated / wrong pin) if:
 *   - Nominatim only returns a generic road / suburb / city result with no POI tag
 *   - Nominatim returns an error / unable to geocode
 *
 * Uses a simple in-memory cache so repeated renders don't hammer Nominatim.
 */
export async function verifyCoordinatesHaveNearbyPOI(
  lat: number,
  lng: number,
  placeName?: string,
  radiusM: number = 200
): Promise<boolean> {
  if (!lat || !lng || lat === 0 || lng === 0) return false;

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey)!;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17&accept-language=en`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PixineraryApp/1.0",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) {
      reverseGeocodeCache.set(cacheKey, true); // Don't block on API errors
      return true;
    }
    const data = await res.json();
    if (data.error || !data.osm_id) {
      reverseGeocodeCache.set(cacheKey, false);
      return false;
    }

    const osmClass: string = (data.class || "").toLowerCase();
    const displayName: string = (data.display_name || "").toLowerCase();

    // Accept: amenity, tourism, leisure, historic, building, shop, office, natural, man_made
    const VALID_CLASSES = ["amenity", "tourism", "leisure", "historic", "building", "shop", "office", "natural", "man_made"];
    const isRealPOI = VALID_CLASSES.includes(osmClass);

    // Reject generic road / suburb / administrative results
    const GENERIC_CLASSES = ["highway", "place", "boundary", "landuse", "waterway"];
    const isGeneric = GENERIC_CLASSES.includes(osmClass);

    // Fuzzy name match: if the place name appears in the Nominatim display_name → valid
    const nameMatches = placeName
      ? displayName.includes(placeName.toLowerCase().trim().split(" ")[0])
      : false;

    const isValid = isRealPOI || nameMatches || (!isGeneric && Boolean(data.osm_id));
    reverseGeocodeCache.set(cacheKey, isValid);
    return isValid;
  } catch {
    reverseGeocodeCache.set(cacheKey, true); // Fail open to avoid blocking
    return true;
  }
}
