import { ExportTrip, ExportDay } from "./types";

export interface TripPosterChunk {
  partIndex: number;
  totalParts: number;
  dayRangeLabel: string;
  days: ExportDay[];
  aspectRatio: "16:9" | "4:3" | "9:16";
  prompt: string;
}

/**
 * Splits the trip days into optimal chunks for generating readable poster images.
 * - 1 to 4 days: 1 poster image (all days)
 * - 5 to 7 days: 2 poster images (e.g. Days 1-3, Days 4-5/7)
 * - 8+ days: 3 poster images (e.g. Days 1-3, Days 4-6, Days 7-8+)
 */
export function splitTripIntoPosterChunks(trip: ExportTrip): TripPosterChunk[] {
  const days = trip.days || [];
  const totalDays = days.length || trip.totalDays || 1;

  let partitions: ExportDay[][] = [];

  if (totalDays <= 4) {
    partitions = [days];
  } else if (totalDays <= 7) {
    const mid = Math.ceil(totalDays / 2);
    partitions = [days.slice(0, mid), days.slice(mid)];
  } else {
    const chunkSize = Math.ceil(totalDays / 3);
    partitions = [
      days.slice(0, chunkSize),
      days.slice(chunkSize, chunkSize * 2),
      days.slice(chunkSize * 2),
    ].filter((p) => p.length > 0);
  }

  const totalParts = partitions.length;

  return partitions.map((chunkDays, index) => {
    const partIndex = index + 1;
    const startDay = chunkDays[0]?.day || 1;
    const endDay = chunkDays[chunkDays.length - 1]?.day || startDay;
    const dayRangeLabel =
      startDay === endDay ? `Day ${startDay}` : `Days ${startDay} - ${endDay}`;

    const prompt = buildPosterPrompt(trip, chunkDays, partIndex, totalParts);

    return {
      partIndex,
      totalParts,
      dayRangeLabel,
      days: chunkDays,
      aspectRatio: "16:9",
      prompt,
    };
  });
}

/**
 * Formats a clean category icon keyword for the AI prompt
 */
function getIconForActivity(category: string, name: string): string {
  const text = `${category} ${name}`.toLowerCase();
  if (/airport|flight|plane|บิน|เครื่องบิน/i.test(text)) return "airplane icon";
  if (/train|subway|metro|skyliner|bts|mrt|jr|รถไฟ/i.test(text)) return "bullet train icon";
  if (/taxi|cab|car|drive|แท็กซี่|รถ/i.test(text)) return "taxi car icon";
  if (/walk|park|street|เดิน|สวน/i.test(text)) return "walking pedestrian icon";
  if (/food|restaurant|cafe|ramen|dining|coffee|กิน|อาหาร|คาเฟ่|ก๋วยเตี๋ยว/i.test(text))
    return "dining meal & drink icon";
  if (/hotel|check-in|resort|พัก|โรงแรม|นอน/i.test(text)) return "hotel bed & luggage icon";
  if (/shopping|market|mall|ช้อป|ตลาด/i.test(text)) return "shopping shopping-bag icon";
  if (/temple|shrine|wat|palace|museum|วัด|ศาลเจ้า|วัง/i.test(text))
    return "historic landmark temple icon";
  return "star location pin icon";
}

/**
 * Builds a structured, high-aesthetic English visual prompt for google/gemini-3-pro-image.
 */
export function buildPosterPrompt(
  trip: ExportTrip,
  chunkDays: ExportDay[],
  partIndex: number,
  totalParts: number
): string {
  const destination = trip.destination || "Tokyo, Japan";
  const tripTitle = trip.title || `${destination} Travel Itinerary`;
  const partText = totalParts > 1 ? ` (Part ${partIndex} of ${totalParts})` : "";

  // Column color palettes corresponding to days
  const columnPalette = [
    "Vibrant Pink",
    "Fresh Emerald Green",
    "Sky Cyan Blue",
    "Royal Purple",
    "Warm Sun Orange",
    "Coral Red",
    "Teal",
  ];

  // Build column descriptions
  const columnsDescription = chunkDays
    .map((day, idx) => {
      const color = columnPalette[idx % columnPalette.length];
      const activitiesSummary = (day.activities || [])
        .slice(0, 8)
        .map((act) => {
          const time = act.time ? `${act.time}` : "";
          const name = act.name || act.category || "Sightseeing";
          const icon = getIconForActivity(act.category, act.name);
          return `- [${time}] ${name} (${icon})`;
        })
        .join("\n        ");

      return `Column ${idx + 1} (${color} theme):
      - Header label: 'DAY ${day.day}' with date '${day.date || ""}'
      - Day Theme: '${day.title || "Exploring " + destination}'
      - Timeline entries:
        ${activitiesSummary || "- Relax and explore local spots"}`;
    })
    .join("\n\n    ");

  return `Masterpiece travel itinerary infographic poster for '${tripTitle}'${partText}.
Destination: ${destination}.
Layout: Ultra-wide 16:9 widescreen horizontal orientation.

Top Header Section:
- Beautiful artistic banner depicting ${destination}'s iconic landmarks, scenic atmosphere, and cultural motifs.
- Elegant title badge displaying '${tripTitle.toUpperCase()}'${partText}.
- Sub-badge with trip duration, date range, and traveler badge.

Main Body Grid:
Divided evenly into ${chunkDays.length} vertical colored columns representing each travel day:
${columnsDescription}

Each column has:
- Rounded colorful top badge for the Day number and date.
- Chronological vertical timeline with distinct connection line and circular nodes.
- Clear time labels (e.g. 09:30, 12:00, 15:30, 18:00).
- Flat minimalist vector icons for transit (airplane, bullet train, walking, taxi) and activities (dining, temple, shopping, hotel).
- Miniature photo-style thumbnail illustrations of landmark attractions, scenic spots, and local cuisine.

Bottom Footer Section:
- Clean card summarizing hotel accommodation, nearby station walking distance, and trip tips.
- Symbol legend showing the transport and activity icons.
- Footnote disclaimer with Google Maps and transit IC card tips.

Visual Style:
- Clean, modern Japanese travel editorial infographic design.
- Harmonious pastel color palette, soft drop shadows, crisp layout hierarchy, high typography readability.
- Professional travel agency poster quality, ultra-high definition, 4K rendering.`.trim();
}
