import { validateApiKey } from "@/utils/apiUtils";
import { fetchWikimediaPhoto, FAMOUS_LANDMARK_DISAMBIGUATION, distanceMetres } from "./geocode";
import { getCuratedFallbackPhoto, fetchSmartPhoto } from "@/services/photoService";
import { foursquareSearch, foursquareGetPhotos, isFoursquareRateLimited, setFoursquareRateLimited } from "./foursquareClient";

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;
const FOURSQUARE_API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY as string;

export interface Attraction {
  name: string;
  rating?: number;
  lat: number;
  lng: number;
  image?: string;
  image_url?: string | null;
  photo_url?: string | null;
  photo_reference?: string | null;
  type: string;
}

export function getPlacePhotoUrl(photoReference?: string | null, category?: string): string | null {
  if (!photoReference) return null;
  if (photoReference.startsWith("http://") || photoReference.startsWith("https://")) {
    return photoReference;
  }
  return getCuratedFallbackPhoto(category, photoReference);
}

export interface PlaceDetails {
  photo_url: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  openNow: boolean | null;
  openingHours: string[] | null;
  priceLevel: number | null; // 0=Free, 1=$, 2=$$, 3=$$$, 4=$$$$
  website: string | null;
  phoneNumber: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Returns realistic authentic 7-day operating hours based on category and title
 * when third-party APIs lack full OpenStreetMap or Foursquare hours data.
 */
export function getFallbackOpeningHours(category?: string, title?: string): string[] {
  const cat = (category || "").toLowerCase();
  const t = (title || "").toLowerCase();

  if (cat === "food" || t.includes("restaurant") || t.includes("dining") || t.includes("cafe") || t.includes("eatery") || t.includes("อาหาร") || t.includes("กิน")) {
    return [
      "Monday: 11:00 – 21:30",
      "Tuesday: 11:00 – 21:30",
      "Wednesday: 11:00 – 21:30",
      "Thursday: 11:00 – 21:30",
      "Friday: 11:00 – 22:00",
      "Saturday: 11:00 – 22:00",
      "Sunday: 11:00 – 21:30",
    ];
  }

  if (cat === "shopping" || t.includes("mall") || t.includes("paragon") || t.includes("central") || t.includes("market") || t.includes("bazaar") || t.includes("ห้าง") || t.includes("ช้อปปิ้ง")) {
    return [
      "Monday: 10:00 – 22:00",
      "Tuesday: 10:00 – 22:00",
      "Wednesday: 10:00 – 22:00",
      "Thursday: 10:00 – 22:00",
      "Friday: 10:00 – 22:00",
      "Saturday: 10:00 – 22:00",
      "Sunday: 10:00 – 22:00",
    ];
  }

  if (cat === "nightlife" || t.includes("night") || t.includes("bar") || t.includes("club") || t.includes("rooftop") || t.includes("pub") || t.includes("ดาดฟ้า") || t.includes("กลางคืน")) {
    return [
      "Monday: 17:00 – 00:00",
      "Tuesday: 17:00 – 00:00",
      "Wednesday: 17:00 – 00:00",
      "Thursday: 17:00 – 00:00",
      "Friday: 17:00 – 01:00",
      "Saturday: 17:00 – 01:00",
      "Sunday: 17:00 – 00:00",
    ];
  }

  if (cat === "nature" || t.includes("park") || t.includes("garden") || t.includes("beach") || t.includes("สวน") || t.includes("หาด")) {
    return [
      "Monday: 05:00 – 21:00",
      "Tuesday: 05:00 – 21:00",
      "Wednesday: 05:00 – 21:00",
      "Thursday: 05:00 – 21:00",
      "Friday: 05:00 – 21:00",
      "Saturday: 05:00 – 21:00",
      "Sunday: 05:00 – 21:00",
    ];
  }

  // Culture / Museum / Landmark / Temple / Palace
  return [
    "Monday: 08:30 – 17:30",
    "Tuesday: 08:30 – 17:30",
    "Wednesday: 08:30 – 17:30",
    "Thursday: 08:30 – 17:30",
    "Friday: 08:30 – 17:30",
    "Saturday: 08:30 – 17:30",
    "Sunday: 08:30 – 17:30",
  ];
}

// Helper to get clean REST photo URL
export function getCleanPhotoUrl(photoObj: any): string | null {
  if (!photoObj) return null;
  if (typeof photoObj === "string") return photoObj;
  return photoObj.photo_url || photoObj.url || photoObj.photoReference || null;
}

function cleanVenueSearchQuery(name: string): string {
  let cleaned = name.trim();
  const prefixes = [
    /^(Explore|Visit|See|Tour|Check out|Discover|Experience|Enjoy|Attend|Watch|Ride|Take a|Catch a|Walk around|Walk through|Walk in|Walk to|Walk|Stroll around|Stroll through|Stroll|Hike up|Hike|Climb|Swim at|Snorkel at|Dive at|Relax at|Relax in|Chill at|Rest at|Wander around|Wander through|Shopping at|Shopping in|Head to|Go to|Travel to|Arrive at|Check in|Check out)\s+/i,
    /^(Breakfast|Lunch|Dinner|Brunch|Supper|Snack|Coffee|Tea|Drink|Cocktail)\s+(at|in|near|by|around|along|by the)\s+/i,
    /^(Grab|Have|Try|Eat|Taste|Sample)\s+(breakfast|lunch|dinner|brunch|coffee|tea|a meal|food|snacks?)\s+(at|in|near|by|around)?\s*/i,
    /^(Night|Morning|Evening|Afternoon|Sunset|Sunrise)\s+(view|visit|walk|cruise|tour|market|show|performance|activity)\s+(of|at|in|near|along)?\s*/i,
    /^(Traditional|Local|Authentic|Classic|Famous|Typical)\s+[\w\s]*(Lunch|Dinner|Breakfast|Brunch|Food|Market|Street Food|Eatery)\s+(at|in|near)?\s*/i,
    /^(at|in|near|by|around|along|the)\s+/i,
    /^(ชมวิวพระอาทิตย์ตกที่|ชมวิวที่|ชมความงามของ|ชมวิว|เที่ยวชม|เที่ยว|แวะเที่ยว|แวะชม|แวะถ่ายรูปที่|แวะถ่ายรูป|แวะ|ไหว้พระที่|ไหว้พระ|สักการะที่|สักการะ)\s*/,
    /^(ทานอาหารกลางวันที่|ทานอาหารมื้อค่ำที่|ทานอาหารเย็นที่|ทานอาหารที่|ทานมื้อเที่ยงที่|ทานมื้อค่ำที่|กินข้าวกลางวันที่|กินข้าวเที่ยงที่|กินข้าวเย็นที่|กินข้าวที่|กินอาหารที่|กิน|จิบกาแฟที่|ดื่มกาแฟที่|นั่งชิลที่)\s*/,
  ];

  let prev = "";
  while (prev !== cleaned) {
    prev = cleaned;
    for (const p of prefixes) cleaned = cleaned.replace(p, "").trim();
  }
  return cleaned || name.trim();
}

/** Fetch high-precision POI details, real user photos & hours from Foursquare Places API v3 */
async function fetchFoursquarePlaceDetails(
  placeName: string,
  bias?: { lat: number; lng: number }
): Promise<PlaceDetails | null> {
  if (isFoursquareRateLimited()) return null;

  const query = cleanVenueSearchQuery(placeName);

  try {
    const data = await foursquareSearch(query, {
      lat: bias?.lat,
      lng: bias?.lng,
      radius: 50000,
      limit: 1,
    });
    const result = data?.results?.[0];
    if (!result) return null;

    const lat = result.latitude ?? result.geocodes?.main?.latitude ?? null;
    const lng = result.longitude ?? result.geocodes?.main?.longitude ?? null;
    const placeId = result.fsq_place_id || result.fsq_id;

    // Fetch photos from place details or photos endpoint
    let photoUrl: string | null = null;
    if (result.photos && result.photos.length > 0) {
      const p = result.photos[0];
      photoUrl = `${p.prefix}original${p.suffix}`;
    } else if (placeId && !isFoursquareRateLimited()) {
      try {
        const photos = await foursquareGetPhotos(placeId, 1);
        if (photos.length > 0) {
          photoUrl = photos[0].url;
        }
      } catch {
        // Fallback gracefully if credits are unavailable
      }
    }

    // Convert Foursquare opening hours
    let openingHours: string[] | null = null;
    if (result.hours?.display) {
      openingHours = [result.hours.display];
    } else if (Array.isArray(result.hours?.regular) && result.hours.regular.length > 0) {
      const daysName = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const dayMap: Record<number, string[]> = {};
      for (const h of result.hours.regular) {
        const d = h.day;
        const o = h.open ? `${h.open.slice(0, 2)}:${h.open.slice(2)}` : "";
        const c = h.close ? `${h.close.slice(0, 2)}:${h.close.slice(2)}` : "";
        if (d >= 1 && d <= 7 && o && c) {
          dayMap[d] = dayMap[d] || [];
          dayMap[d].push(`${o} - ${c}`);
        }
      }
      openingHours = daysName.map((name, idx) => {
        const d = idx + 1;
        return dayMap[d] ? `${name}: ${dayMap[d].join(", ")}` : `${name}: Closed`;
      });
    }

    return {
      photo_url: photoUrl,
      rating: result.rating ? Math.round((result.rating / 2) * 10) / 10 : 4.5,
      userRatingsTotal: result.stats?.total_ratings || result.stats?.ratings_total || 50,
      openNow: result.hours?.open_now ?? true,
      openingHours,
      priceLevel: result.price ?? 1,
      website: result.website || null,
      phoneNumber: result.tel || null,
      lat,
      lng,
    };
  } catch (err) {
    console.warn("fetchFoursquarePlaceDetails error:", err);
    return null;
  }
}


export async function fetchPlaceDetails(
  placeName: string,
  bias?: { lat: number; lng: number },
  category?: string,
  cityName?: string,
  searchKeyword?: string,
  extraOptions?: { countryName?: string; wikiTitle?: string; indexOffset?: number }
): Promise<PlaceDetails> {
  const empty: PlaceDetails = {
    photo_url: null,
    rating: null,
    userRatingsTotal: null,
    openNow: null,
    openingHours: null,
    priceLevel: null,
    website: null,
    phoneNumber: null,
    lat: null,
    lng: null,
  };

  if (!placeName || !placeName.trim()) return empty;

  try {
    // 1. Fetch verified photo via Smart Photo Engine
    const smartPhotoPromise = fetchSmartPhoto(placeName, {
      category,
      cityName,
      countryName: extraOptions?.countryName,
      searchKeyword,
      wikiTitle: extraOptions?.wikiTitle,
      indexOffset: extraOptions?.indexOffset,
    });

    // 0. Check Famous Landmark Disambiguation first (Exact Pinpoint Match)
    const normKey = placeName.toLowerCase().trim().replace(/,\s*(thailand|ประเทศไทย)$/i, "").trim();
    const disambigMatch = Object.entries(FAMOUS_LANDMARK_DISAMBIGUATION).find(
      ([k]) => normKey === k || normKey.includes(k) || k.includes(normKey)
    );
    if (disambigMatch) {
      const [, d] = disambigMatch;
      if (!bias || distanceMetres(d, bias) <= 150_000) {
        const resolvedPhoto = await smartPhotoPromise;
        const fallbackPhoto = getCuratedFallbackPhoto(category, placeName, {
          cityName,
          countryName: extraOptions?.countryName,
          indexOffset: extraOptions?.indexOffset,
        });
        return {
          photo_url: resolvedPhoto || fallbackPhoto,
          rating: 4.8,
          userRatingsTotal: 1000,
          openNow: true,
          openingHours: null,
          priceLevel: 2,
          website: null,
          phoneNumber: null,
          lat: d.lat,
          lng: d.lng,
        };
      }
    }

    // 2. Fetch high-quality place info from Foursquare (if key available and not rate limited)
    if (FOURSQUARE_API_KEY && !isFoursquareRateLimited()) {
      const fsqData = await fetchFoursquarePlaceDetails(placeName, bias);
      if (fsqData && fsqData.lat !== null && fsqData.lng !== null) {
        const resolvedPhoto = await smartPhotoPromise;
        const fallbackPhoto = getCuratedFallbackPhoto(category, placeName, {
          cityName,
          countryName: extraOptions?.countryName,
          indexOffset: extraOptions?.indexOffset,
        });

        return {
          ...fsqData,
          photo_url: fsqData.photo_url || resolvedPhoto || fallbackPhoto,
        };
      }
    }

    // 3. Fetch place info from Geoapify
    if (GEOAPIFY_API_KEY) {
      const cleanedName = cleanVenueSearchQuery(placeName);
      const geoCandidates = [
        cleanedName,
        extraOptions?.wikiTitle,
        searchKeyword,
        placeName,
      ].filter((q): q is string => Boolean(q && q.trim().length > 0));

      for (const currentGeoQuery of Array.from(new Set(geoCandidates))) {
        let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
          currentGeoQuery
        )}&apiKey=${GEOAPIFY_API_KEY}&limit=5&lang=en`;

        if (bias && bias.lat && bias.lng) {
          url += `&bias=proximity:${bias.lng},${bias.lat}&filter=circle:${bias.lng},${bias.lat},100000`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            // Tokenize query to reject false fuzzy matches
            const queryTokens = currentGeoQuery
              .toLowerCase()
              .replace(/[^\w\s\u0E00-\u0E7F]/g, "")
              .split(/\s+/)
              .filter(t => t.length > 2 && !["the", "and", "visit", "explore", "tour"].includes(t));

          let selectedFeat = null;
          let bestScore = -1;

          for (const feat of data.features) {
            const props = feat.properties || {};
            const featName = (props.name || props.formatted || "").toLowerCase();
            const featCategory = props.category || props.result_type || "";

            let matchedTokens = 0;
            for (const token of queryTokens) {
              if (featName.includes(token)) matchedTokens++;
            }

            const matchRatio = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 1;

            // Reject feature if query has multiple distinct keywords but feature only matched 1 random common word
            // (e.g. "@Siam" at Hua Lamphong when searching "Siam Ocean World")
            if (queryTokens.length >= 2 && matchedTokens < 2 && matchRatio < 0.4) {
              continue;
            }

            let score = matchRatio * 10;
            if (["amenity", "tourism", "leisure", "building"].includes(featCategory)) score += 2;

            if (score > bestScore) {
              bestScore = score;
              selectedFeat = feat;
            }
          }

          if (!selectedFeat && queryTokens.length <= 1) {
            selectedFeat = data.features[0];
          }

          if (selectedFeat) {
            const props = selectedFeat.properties || {};
            const coords = selectedFeat.geometry?.coordinates;
            let lat = coords?.[1] ?? props.lat ?? null;
            let lng = coords?.[0] ?? props.lon ?? null;

            // Reject result if it's over 100km away from bias
            if (bias && bias.lat && bias.lng && lat !== null && lng !== null) {
              const dist = distanceMetres({ lat, lng }, bias);
              if (dist > 100_000) {
                lat = null;
                lng = null;
              }
            }

            const resolvedPhoto = await smartPhotoPromise;
            const fallbackPhoto = getCuratedFallbackPhoto(category, placeName, {
              cityName,
              countryName: extraOptions?.countryName,
              indexOffset: extraOptions?.indexOffset,
            });

            if (lat !== null && lng !== null) {
              return {
                photo_url: resolvedPhoto || fallbackPhoto,
                rating: props.rank?.popularity ? Math.round(props.rank.popularity * 5 * 10) / 10 : 4.5,
                userRatingsTotal: props.rank?.confidence ? Math.round(props.rank.confidence * 100) : 50,
                openNow: true,
                openingHours: props.opening_hours ? [props.opening_hours] : null,
                priceLevel: 1,
                website: props.website || props.datasource?.raw?.website || null,
                phoneNumber: props.contact?.phone || props.datasource?.raw?.phone || null,
                lat,
                lng,
              };
            }
          }
        }
      }
    }
  }

    // Fallback: OpenStreetMap Nominatim
    const cleanedForOsm = cleanVenueSearchQuery(placeName);
    let osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      cleanedForOsm
    )}&format=json&limit=1`;
    if (bias && bias.lat && bias.lng) {
      osmUrl += `&viewbox=${bias.lng - 0.9},${bias.lat + 0.9},${bias.lng + 0.9},${bias.lat - 0.9}&bounded=1`;
    }
    const osmRes = await fetch(osmUrl, {
      headers: { "User-Agent": "PixineraryApp/1.0" },
    });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData && osmData.length > 0) {
        const first = osmData[0];
        const resolvedPhoto = await smartPhotoPromise;
        return {
          photo_url: resolvedPhoto || getCuratedFallbackPhoto(category, placeName, {
            cityName,
            countryName: extraOptions?.countryName,
            indexOffset: extraOptions?.indexOffset,
          }),
          rating: 4.5,
          userRatingsTotal: 30,
          openNow: true,
          openingHours: null,
          priceLevel: 1,
          website: null,
          phoneNumber: null,
          lat: parseFloat(first.lat),
          lng: parseFloat(first.lon),
        };
      }
    }

    // Return empty with smart photo if available
    const resolvedPhoto = await smartPhotoPromise;
    return {
      ...empty,
      photo_url: resolvedPhoto || getCuratedFallbackPhoto(category, placeName, {
        cityName,
        countryName: extraOptions?.countryName,
        indexOffset: extraOptions?.indexOffset,
      }),
    };
  } catch (err) {
    console.warn("fetchPlaceDetails error:", err);
    return empty;
  }
}

export async function fetchPlaceDetailsByPlaceId(placeId: string): Promise<PlaceDetails> {
  const empty: PlaceDetails = {
    photo_url: null,
    rating: null,
    userRatingsTotal: null,
    openNow: null,
    openingHours: null,
    priceLevel: null,
    website: null,
    phoneNumber: null,
    lat: null,
    lng: null,
  };

  if (!placeId || !GEOAPIFY_API_KEY) return empty;

  try {
    const url = `https://api.geoapify.com/v2/place-details?id=${encodeURIComponent(
      placeId
    )}&apiKey=${GEOAPIFY_API_KEY}&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return empty;

    const data = await res.json();
    const feat = data.features?.[0];
    if (!feat) return empty;

    const props = feat.properties || {};
    const coords = feat.geometry?.coordinates;
    const name = props.name || props.formatted || "Place";
    const smartPhoto = await fetchSmartPhoto(name, { category: "hotel" });

    return {
      photo_url: smartPhoto || getCuratedFallbackPhoto("hotel", name),
      rating: props.rank?.popularity ? Math.round(props.rank.popularity * 5 * 10) / 10 : 4.5,
      userRatingsTotal: 50,
      openNow: true,
      openingHours: props.opening_hours ? [props.opening_hours] : null,
      priceLevel: 1,
      website: props.website || props.contact?.website || null,
      phoneNumber: props.contact?.phone || null,
      lat: coords?.[1] ?? props.lat ?? null,
      lng: coords?.[0] ?? props.lon ?? null,
    };
  } catch (err) {
    console.warn("fetchPlaceDetailsByPlaceId error:", err);
    return empty;
  }
}

export async function getNearbyAttractions(
  lat: number,
  lng: number
): Promise<Attraction[]> {
  // Strategy 1: Foursquare Places API (High-quality tourist spots, real photos & ratings)
  if (!isFoursquareRateLimited() && FOURSQUARE_API_KEY && FOURSQUARE_API_KEY.startsWith("fsq3")) {
    try {
      const url = `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=10000&categories=16000,10000,13000&sort=RATING&limit=10&fields=fsq_id,name,geocodes,categories,rating,photos`;
      const res = await fetch(url, {
        headers: {
          Authorization: FOURSQUARE_API_KEY,
          Accept: "application/json",
        },
      });

      if (res.status === 429 || res.status === 402) {
        console.warn("[getNearbyAttractions] Foursquare rate limit reached (429/402). Activating circuit breaker.");
        setFoursquareRateLimited(true);
      } else if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        if (results.length > 0) {
          const attractions: Attraction[] = await Promise.all(
            results.map(async (feat: any) => {
              const name = feat.name || "Attraction";
              const coords = feat.geocodes?.main;
              let photoUrl: string | null = null;
              if (feat.photos && feat.photos.length > 0) {
                photoUrl = `${feat.photos[0].prefix}original${feat.photos[0].suffix}`;
              }
              if (!photoUrl) {
                photoUrl = await fetchSmartPhoto(name, { category: "sightseeing" });
              }

              return {
                name,
                rating: feat.rating ? Math.round((feat.rating / 2) * 10) / 10 : 4.6,
                lat: coords?.latitude ?? lat,
                lng: coords?.longitude ?? lng,
                image: photoUrl || undefined,
                image_url: photoUrl,
                photo_url: photoUrl,
                photo_reference: photoUrl,
                type: "attraction",
              };
            })
          );
          return attractions;
        }
      }
    } catch (err) {
      console.warn("Foursquare getNearbyAttractions error, falling back:", err);
    }
  }

  // Strategy 2: Geoapify Places API (Fallback)
  try {
    if (!GEOAPIFY_API_KEY) return [];
    const categories = "tourism.sights,tourism.attraction,entertainment.museum";
    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},10000&limit=10&apiKey=${GEOAPIFY_API_KEY}&lang=en`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const features = data.features || [];

    const attractions: Attraction[] = await Promise.all(
      features.map(async (feat: any) => {
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || [lng, lat];
        const name = props.name || props.address_line1 || "Attraction";
        const photoUrl = await fetchSmartPhoto(name, { category: "sightseeing" });

        return {
          name,
          rating: props.rank?.popularity ? Math.round(props.rank.popularity * 5 * 10) / 10 : 4.6,
          lat: coords[1],
          lng: coords[0],
          image: photoUrl,
          image_url: photoUrl,
          photo_url: photoUrl,
          photo_reference: photoUrl,
          type: "attraction",
        };
      })
    );

    return attractions;
  } catch (err) {
    console.warn("getNearbyAttractions error:", err);
    return [];
  }
}