export function getPlaceImage(place: {
  name: string;
  photo_reference?: string | null;
  type?: string;
}) {
  if (place.photo_reference) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
  }

  const encodedName = encodeURIComponent(place.name);
  return `https://source.unsplash.com/800x600/?${encodedName},travel`;
}
