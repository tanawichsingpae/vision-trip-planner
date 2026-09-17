/**
 * normalizeExportTrip()
 *
 * Converts the existing itinerary response (DayPlan[], VisionResult, etc.)
 * into a normalized ExportTrip that the PDF components consume.
 */
import type { ExportTrip, ExportDay, ExportActivity } from "./types";
import { DAY_ACCENTS } from "./types";
import { type DayPlan, type Activity, getActivityImage } from "@/components/TravelItinerary";
import { generateMapUrl } from "./generateMapUrl";
import { formatExportDate, formatExportDateWithDay, formatDateRange } from "./formatExportDate";
import { getLocalizedPlace, getLocalizedDescription } from "@/context/LanguageContext";

/** Category labels used in the export */
const CATEGORY_LABELS: Record<string, string> = {
  culture: "Culture",
  food: "Food",
  nature: "Nature",
  adventure: "Adventure",
  activity: "Adventure",
  shopping: "Shopping",
  nightlife: "Nightlife",
  relax: "Relax",
  rest: "Relax",
  landmark: "Landmark",
  photo: "Photo",
  entertainment: "Entertainment",
  spiritual: "Spiritual",
  hotel: "Hotel",
  transport: "Transport",
  attraction: "Attraction",
};

interface NormalizeOptions {
  itinerary: DayPlan[];
  destination: string;
  subtitle?: string;
  tripStartDate?: Date | null;
  language?: "th" | "en";
  cityName?: string;
  /** Static map URL for the route preview */
  staticMapUrl?: string;
}

/**
 * Convert Activity.openNow to ExportActivity.status
 */
function resolveStatus(
  openNow: boolean | null | undefined
): "Open" | "Closed" | "Unknown" {
  if (openNow === true) return "Open";
  if (openNow === false) return "Closed";
  return "Unknown";
}

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula)
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

/**
 * Estimate transit duration in minutes based on distance
 */
function estimateTransitMinutes(distanceKm: number): number {
  // Average city speed ~22 km/h plus 3 min buffer
  const minutes = Math.round((distanceKm / 22) * 60) + 3;
  return Math.max(5, minutes);
}

/**
 * Parse duration text like "15 min" or "1h 30min" to minutes
 */
function parseDurationMinutes(text?: string): number | undefined {
  if (!text) return undefined;
  let total = 0;
  const hourMatch = text.match(/(\d+)\s*h/);
  const minMatch = text.match(/(\d+)\s*min/);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total > 0 ? total : undefined;
}

/**
 * Parse distance text like "5.2 km" or "350 m" to km
 */
function parseDistanceKm(text?: string): number | undefined {
  if (!text) return undefined;
  const kmMatch = text.match(/([\d.]+)\s*km/i);
  if (kmMatch) return parseFloat(kmMatch[1]);
  const mMatch = text.match(/([\d.]+)\s*m$/i);
  if (mMatch) return parseFloat(mMatch[1]) / 1000;
  return undefined;
}

/**
 * Get the localized place name.
 * When language is Thai, prefer title_th or title, otherwise prefer title_en or english_name.
 */
function getLocalizedName(
  activity: Activity,
  language: "th" | "en" = "en"
): { name: string; localName?: string } {
  const primaryName = getLocalizedPlace(activity, language);
  const secondaryLang = language === "th" ? "en" : "th";
  const secondaryName = getLocalizedPlace(activity, secondaryLang);
  const localName = secondaryName !== primaryName ? secondaryName : undefined;
  return { name: primaryName || activity.title || "", localName };
}

/**
 * Main normalizer function.
 * Converts the application's itinerary data into the ExportTrip model.
 */
export function normalizeExportTrip(options: NormalizeOptions): ExportTrip {
  const {
    itinerary,
    destination,
    subtitle,
    tripStartDate,
    language = "en",
    cityName,
    staticMapUrl,
  } = options;

  const totalDays = itinerary.length;
  const totalActivities = itinerary.reduce(
    (sum, day) => sum + day.activities.length,
    0
  );

  // Compute date range
  const startDate = tripStartDate
    ? formatExportDate(tripStartDate, language === "th" ? "th-TH" : "en-GB")
    : "";
  const endDate = tripStartDate
    ? (() => {
        const end = new Date(tripStartDate);
        end.setDate(end.getDate() + totalDays - 1);
        return formatExportDate(end, language === "th" ? "th-TH" : "en-GB");
      })()
    : "";

  // Build route coordinates from all activities
  const allCoordinates: Array<{ lat: number; lng: number }> = [];
  itinerary.forEach((day) => {
    day.activities.forEach((act) => {
      if (act.lat && act.lng) {
        allCoordinates.push({ lat: act.lat, lng: act.lng });
      }
    });
  });

  // Build days
  let totalRouteDistanceKm = 0;
  const days: ExportDay[] = itinerary.map((dayPlan, dayIndex) => {
    const accentColor = DAY_ACCENTS[dayIndex % DAY_ACCENTS.length];

    // Compute day date
    let dayDate = dayPlan.date || "";
    if (tripStartDate) {
      const d = new Date(tripStartDate);
      d.setDate(d.getDate() + dayIndex);
      dayDate = formatExportDateWithDay(
        d,
        language === "th" ? "th-TH" : "en-GB"
      );
    }

    // Day title
    const dayTitle =
      language === "th"
        ? `วันที่ ${dayPlan.day}`
        : `Day ${dayPlan.day}`;

    // Track total transit for this day
    let totalDayTransitMinutes = 0;
    let totalDayTransitKm = 0;

    // Build activities
    const activities: ExportActivity[] = dayPlan.activities.map(
      (act, actIndex) => {
        const { name, localName } = getLocalizedName(act, language);
        const imageUrl = getActivityImage(act, cityName);
        const mapUrl = generateMapUrl(act.lat, act.lng);
        const category =
          CATEGORY_LABELS[act.type] || act.type || "Activity";

        // Calculate transit to next activity
        let transit: { durationMinutes?: number; distanceKm?: number } | undefined = undefined;
        const nextAct = dayPlan.activities[actIndex + 1];
        if (nextAct && act.lat && act.lng && nextAct.lat && nextAct.lng) {
          const dist = calculateDistanceKm(act.lat, act.lng, nextAct.lat, nextAct.lng);
          const dur = estimateTransitMinutes(dist);
          transit = { distanceKm: dist, durationMinutes: dur };
          totalDayTransitMinutes += dur;
          totalDayTransitKm += dist;
          totalRouteDistanceKm += dist;
        }

        // Description
        const description = getLocalizedDescription(act, language) || undefined;

        return {
          index: actIndex + 1,
          time: act.time || "",
          name,
          localName,
          category,
          description,
          imageUrl,
          rating: act.rating ?? undefined,
          reviewCount: act.userRatingsTotal ?? undefined,
          status: resolveStatus(act.openNow),
          latitude: act.lat,
          longitude: act.lng,
          mapUrl,
          transit,
        } as ExportActivity;
      }
    );

    return {
      day: dayPlan.day,
      date: dayDate,
      title: dayTitle,
      accentColor,
      transit: {
        durationMinutes: totalDayTransitMinutes,
        distanceKm: parseFloat(totalDayTransitKm.toFixed(1)),
      },
      activities,
    };
  });

  // Compute title based on date range
  let title = destination;
  let dateRangeStr = "";
  if (tripStartDate) {
    const end = new Date(tripStartDate);
    end.setDate(end.getDate() + totalDays - 1);
    dateRangeStr = formatDateRange(
      tripStartDate,
      end,
      language === "th" ? "th-TH" : "en-GB"
    );
  }

  return {
    title,
    subtitle: subtitle || (language === "th" ? "แผนการท่องเที่ยวอันน่าประทับใจ" : "Heritage & soul"),
    destination,
    startDate,
    endDate,
    totalDays,
    totalActivities,
    days,
    route:
      allCoordinates.length > 0
        ? {
            distanceKm: parseFloat(totalRouteDistanceKm.toFixed(1)),
            coordinates: allCoordinates,
            imageUrl: staticMapUrl,
          }
        : undefined,
  };
}
