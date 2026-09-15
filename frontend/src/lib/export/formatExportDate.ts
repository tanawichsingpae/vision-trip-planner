/**
 * Format dates for the export document.
 */

/**
 * Format a Date object into a human-readable date string.
 * Example: "21 Sept 2026"
 */
export function formatExportDate(
  date: Date,
  locale: string = "en-GB"
): string {
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a Date object into a day-of-week + date string.
 * Example: "Mon, 21 Sept 2026"
 */
export function formatExportDateWithDay(
  date: Date,
  locale: string = "en-GB"
): string {
  return date.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date range string.
 * Example: "21 Sept – 23 Sept 2026"
 */
export function formatDateRange(
  start: Date,
  end: Date,
  locale: string = "en-GB"
): string {
  const startStr = start.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
  const endStr = end.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}
