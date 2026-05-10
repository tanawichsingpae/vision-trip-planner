export function getGooglePlacePhoto(photoReference?: string) {
  if (!photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
}
