import { validateApiKey } from "@/utils/apiUtils";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface Attraction {
  name: string;
  rating?: number;
  lat: number;
  lng: number;
  image?: string;
  image_url?: string | null;
  photo_url?: string | null;
  type: string;
}

export function getPlacePhotoUrl(photoReference: string) {
  validateApiKey(API_KEY, "Google Maps");
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${API_KEY}`;
}

export interface PlaceDetails {
  photo_url: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  openNow: boolean | null;
  openingHours: string[] | null;
  priceLevel: number | null;    // 0=Free, 1=$, 2=$$, 3=$$$, 4=$$$$
  website: string | null;
  phoneNumber: string | null;
  lat: number | null;
  lng: number | null;
}

// Helper to get clean REST photo URL supporting CORS
export function getCleanPhotoUrl(photoObj: any): string | null {
  if (!photoObj) return null;
  const rawRef = photoObj.photo_reference || photoObj.photoReference;
  if (rawRef) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${rawRef}&key=${API_KEY}`;
  }
  const url = typeof photoObj.getUrl === "function" ? photoObj.getUrl({ maxWidth: 800 }) : null;
  if (url && url.includes("PhotoService.GetPhoto")) {
    const match = url.match(/[?&]1s=([^&]+)/);
    if (match && match[1]) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${decodeURIComponent(match[1])}&key=${API_KEY}`;
    }
  }
  return url;
}

export async function fetchPlaceDetails(placeName: string): Promise<PlaceDetails> {
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

  if (typeof google === "undefined" || !google.maps?.places) return empty;

  const service = new google.maps.places.PlacesService(document.createElement("div"));

  return new Promise((resolve) => {
    // Step 1: Find place_id via textSearch
    service.textSearch({ query: placeName }, (results, status) => {
      if (
        status !== google.maps.places.PlacesServiceStatus.OK ||
        !results?.length
      ) {
        resolve(empty);
        return;
      }

      const placeId = results[0].place_id;
      if (!placeId) {
        // Fallback: use whatever textSearch returned
        const photo = getCleanPhotoUrl(results[0].photos?.[0]);
        const loc = results[0].geometry?.location;
        resolve({
          photo_url: photo,
          rating: results[0].rating ?? null,
          userRatingsTotal: results[0].user_ratings_total ?? null,
          openNow: results[0].opening_hours?.isOpen?.() ?? null,
          openingHours: null,
          priceLevel: results[0].price_level ?? null,
          website: null,
          phoneNumber: null,
          lat: loc ? loc.lat() : null,
          lng: loc ? loc.lng() : null,
        });
        return;
      }

      // Step 2: getDetails for richer fields
      // Also capture textSearch geometry as a reliable fallback
      const textSearchLoc = results[0].geometry?.location;
      service.getDetails(
        {
          placeId,
          fields: ["name", "rating", "user_ratings_total", "opening_hours", "photos", "price_level", "website", "formatted_phone_number", "geometry"],
        },
        (detail, detailStatus) => {
          if (
            detailStatus !== google.maps.places.PlacesServiceStatus.OK ||
            !detail
          ) {
            resolve(empty);
            return;
          }

          const photo = getCleanPhotoUrl(detail.photos?.[0]);
          const hours = detail.opening_hours?.weekday_text ?? null;
          const detailLoc = detail.geometry?.location;
          const lat = detailLoc ? detailLoc.lat() : (textSearchLoc ? textSearchLoc.lat() : null);
          const lng = detailLoc ? detailLoc.lng() : (textSearchLoc ? textSearchLoc.lng() : null);

          resolve({
            photo_url: photo,
            rating: detail.rating ?? null,
            userRatingsTotal: detail.user_ratings_total ?? null,
            openNow: detail.opening_hours?.isOpen?.() ?? null,
            openingHours: hours,
            priceLevel: detail.price_level ?? null,
            website: detail.website ?? null,
            phoneNumber: detail.formatted_phone_number ?? null,
            lat,
            lng,
          });
        }
      );
    });
  });
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

  if (!placeId || typeof google === "undefined" || !google.maps?.places) return empty;

  const service = new google.maps.places.PlacesService(document.createElement("div"));

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ["name", "rating", "user_ratings_total", "opening_hours", "photos", "price_level", "website", "formatted_phone_number", "geometry"],
      },
      (detail, detailStatus) => {
        if (detailStatus !== google.maps.places.PlacesServiceStatus.OK || !detail) {
          resolve(empty);
          return;
        }

        const photo = getCleanPhotoUrl(detail.photos?.[0]);
        const hours = detail.opening_hours?.weekday_text ?? null;
        const loc = detail.geometry?.location;

        resolve({
          photo_url: photo,
          rating: detail.rating ?? null,
          userRatingsTotal: detail.user_ratings_total ?? null,
          openNow: detail.opening_hours?.isOpen?.() ?? null,
          openingHours: hours,
          priceLevel: detail.price_level ?? null,
          website: detail.website ?? null,
          phoneNumber: detail.formatted_phone_number ?? null,
          lat: loc ? loc.lat() : null,
          lng: loc ? loc.lng() : null,
        });
      }
    );
  });
}

export function getNearbyAttractions(
  lat: number,
  lng: number
): Promise<Attraction[]> {
  validateApiKey(API_KEY, "Google Maps");

  return new Promise((resolve, reject) => {

    const service = new google.maps.places.PlacesService(document.createElement("div"));

    service.nearbySearch(
      {
        location: new google.maps.LatLng(lat, lng),
        radius: 3000,
        type: "tourist_attraction",
      },
      (results, status) => {

        if (
          status !== google.maps.places.PlacesServiceStatus.OK &&
          status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS
        ) {
          reject(new Error(`Places search failed: ${status}`));
          return;
        }

        const attractions: Attraction[] = (results || []).map((p: any) => {

          let image: string | undefined;
          let image_url: string | null = null;
          const photo_reference = p.photos?.[0]?.photo_reference || p.photos?.[0]?.name || null;

          if (p.photos && p.photos.length > 0) {
            // SDK-based URL (legacy/internal use)
            image = p.photos[0].getUrl({
              maxWidth: 800,
              maxHeight: 600,
            });

            if (photo_reference) {
              image_url = getPlacePhotoUrl(photo_reference);
            }
          }

          return {
            name: p.name,
            rating: p.rating,
            lat: p.geometry.location.lat(),
            lng: p.geometry.location.lng(),
            image,
            image_url,
            photo_reference,
            type: "attraction",
          };
        });

        resolve(attractions);
      }
    );

  });
}