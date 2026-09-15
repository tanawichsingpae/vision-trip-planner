export function getGooglePlacePhoto(photoReference?: string | null) {
  if (!photoReference) return null;
  if (photoReference.startsWith("http://") || photoReference.startsWith("https://")) {
    return photoReference;
  }
  return null;
}
