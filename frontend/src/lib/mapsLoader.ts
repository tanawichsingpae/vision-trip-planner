/**
 * Shared Google Maps API configuration.
 * Safe wrapper for importLibrary that checks if google.maps is already initialized
 * before calling setOptions to avoid duplicate configuration warnings.
 */
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let _initialized = false;

export async function importMapsLibrary(libraryName: string) {
  if (!_initialized) {
    // Only call setOptions if Google Maps JS API hasn't loaded importLibrary yet
    if (typeof window !== "undefined" && !(window as any).google?.maps?.importLibrary) {
      try {
        setOptions({
          key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
          v: "weekly",
        });
      } catch (e) {
        // Ignore if already configured
      }
    }
    _initialized = true;
  }
  return importLibrary(libraryName);
}
