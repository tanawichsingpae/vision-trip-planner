import { safeFetch, validateApiKey } from "@/utils/apiUtils";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface Coordinates {
  lat: number;
  lng: number;
}

export async function getCoordinates(placeName: string): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      reject(new Error("Google Maps Places SDK not loaded."));
      return;
    }

    const service = new google.maps.places.PlacesService(document.createElement('div'));

    service.findPlaceFromQuery(
      {
        query: placeName,
        fields: ["name", "geometry"]
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const location = results[0].geometry?.location;
          if (location) {
            resolve({
              lat: location.lat(),
              lng: location.lng(),
            });
          } else {
            reject(new Error(`Location geometry missing for: ${placeName}`));
          }
        } else {
          reject(new Error(`Places search failed for ${placeName}: ${status}`));
        }
      }
    );
  });
}
