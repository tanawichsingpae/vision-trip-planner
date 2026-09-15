/**
 * Generate a Google Maps search URL for given coordinates.
 * Returns undefined if coordinates are missing.
 */
export function generateMapUrl(
  lat: number | undefined | null,
  lng: number | undefined | null
): string | undefined {
  if (lat == null || lng == null) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
