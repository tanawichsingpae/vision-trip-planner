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