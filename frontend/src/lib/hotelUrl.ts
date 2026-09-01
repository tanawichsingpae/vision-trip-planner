/**
 * Helper utility to build pre-filled hotel search URLs for Booking.com & Agoda.
 * Allows users to jump directly to hotel booking with city & trip date context.
 */

/**
 * Builds a Booking.com search URL for a given hotel and city, optionally pre-filled with check-in/out dates.
 */
export function buildBookingUrl(
  hotelName: string,
  cityName: string,
  checkInDate?: string,  // YYYY-MM-DD
  checkOutDate?: string  // YYYY-MM-DD
): string {
  const query = `${hotelName} ${cityName}`.trim();
  const params = new URLSearchParams({
    ss: query,
    lang: "en-us",
  });

  if (checkInDate) params.append("checkin", checkInDate);
  if (checkOutDate) params.append("checkout", checkOutDate);

  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

/**
 * Builds an Agoda search URL for a given hotel and city.
 */
export function buildAgodaUrl(
  hotelName: string,
  cityName: string,
  checkInDate?: string,  // YYYY-MM-DD
  checkOutDate?: string  // YYYY-MM-DD
): string {
  const query = `${hotelName} ${cityName}`.trim();
  const params = new URLSearchParams({
    textToSearch: query,
    asq: "",
  });

  if (checkInDate) params.append("checkIn", checkInDate);
  if (checkOutDate) params.append("checkOut", checkOutDate);

  return `https://www.agoda.com/search?${params.toString()}`;
}
