/**
 * Builds a Google Flights search URL from IATA codes and a date.
 * No API call required — generates a pre-filled search link.
 *
 * @param origin       - Departure IATA code (e.g. "BKK")
 * @param destination  - Arrival IATA code (e.g. "NRT")
 * @param date         - Departure date in "YYYY-MM-DD" format
 * @param adults       - Number of adult passengers (default: 1)
 * @param currency     - Display currency (default: "THB")
 * @returns A Google Flights URL that opens pre-filled with the search query
 */
export function buildGoogleFlightsUrl(
  origin: string,
  destination: string,
  date: string,
  adults = 1,
  currency = "THB"
): string {
  // Format: "2026-09-05" → "Sep 5 2026"
  let formattedDate = date;
  try {
    const d = new Date(date + "T00:00:00");
    formattedDate = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    // fallback to raw date string
  }

  const q = `Flights from ${origin} to ${destination} on ${formattedDate}`;
  const params = new URLSearchParams({
    q,
    hl: "en",
    curr: currency,
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

/**
 * Returns the best booking URL for a flight offer.
 * Uses the offer's deep_link if valid, otherwise falls back to a
 * Google Flights search URL built from origin/destination/date.
 */
export function getBookingUrl(
  deepLink: string | undefined | null,
  origin: string,
  destination: string,
  date: string
): string {
  if (deepLink && deepLink.startsWith("http")) {
    return deepLink;
  }
  return buildGoogleFlightsUrl(origin, destination, date);
}
