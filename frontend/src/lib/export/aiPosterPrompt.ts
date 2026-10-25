import { ExportTrip, ExportDay, ExportActivity } from "./types";

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
 * Cleans and shortens overly long Thai ceremonial titles to prevent AI font degradation
 */
function cleanLongPlaceName(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  // Strip overly formal prefixes/suffixes if long
  clean = clean.replace(/ราชวรวิหาร|ราชวรมหาวิหาร|วรมหาวิหาร|วรวิหาร/g, "").trim();
  if (clean.length > 36) {
    clean = clean.slice(0, 34).trim() + "...";
  }
  return clean;
}

/**
 * Sanitizes generic placeholder names (e.g. "Bangkok City Landmark & Park")
 * into contextual, realistic place names and cleanly formats bilingual labels.
 */
export function sanitizeActivityName(
  name: string,
  localName?: string,
  category?: string,
  destination: string = ""
): string {
  const isBKK = /bangkok|กรุงเทพ/i.test(destination);
  const rawName = (name || "").trim();

  // Handle common fallback generic strings
  if (/error\s*\/\s*unrecognized|unrecognized/i.test(rawName)) {
    return isBKK ? "Iconic Bangkok Sightseeing Spot" : "Scenic Sightseeing Spot";
  }
  if (/^bangkok\s+city\s+landmark\s*&\s*park$/i.test(rawName) || /^city\s+landmark\s*&\s*park$/i.test(rawName)) {
    return isBKK ? "Lumphini Park & Greenery" : "City Central Landmark & Park";
  }
  if (/^bangkok\s+cultural\s+center(?:\s*&\s*heritage)?$/i.test(rawName) || /^cultural\s+center(?:\s*&\s*heritage)?$/i.test(rawName)) {
    return isBKK ? "BACC & Bangkok Cultural Heritage" : "Art & Cultural Heritage Center";
  }
  if (/^street\s+food,\s*lunch\s+near\s+bangkok\s+center$/i.test(rawName) || /^local\s+eatery\s*&\s*street\s+food/i.test(rawName)) {
    return isBKK ? "Bangkok Street Food & Local Dining" : "Local Eatery & Street Food";
  }
  if (/^lunch\s+near\s+bangkok/i.test(rawName)) {
    return isBKK ? "Thai Specialties Lunch Experience" : "Local Lunch Experience";
  }
  if (/^bangkok\s+night\s+market\s*&\s*dining$/i.test(rawName)) {
    return isBKK ? "Yaowarat / Night Market & Dining" : "Evening Night Market & Dining";
  }

  // Format clean bilingual names if both Thai and English exist
  const cleanedName = cleanLongPlaceName(rawName);
  const cleanedLocal = localName ? cleanLongPlaceName(localName) : "";

  if (cleanedLocal && cleanedLocal.toLowerCase() !== cleanedName.toLowerCase()) {
    // If name is Thai and localName is English
    if (/[\u0E00-\u0E7F]/.test(cleanedName) && !/[\u0E00-\u0E7F]/.test(cleanedLocal)) {
      return `${cleanedName} (${cleanedLocal})`;
    }
    // If name is English and localName is Thai
    if (!/[\u0E00-\u0E7F]/.test(cleanedName) && /[\u0E00-\u0E7F]/.test(cleanedLocal)) {
      return `${cleanedName} (${cleanedLocal})`;
    }
  }

  return cleanedName || "Sightseeing Spot";
}

/**
 * Derives a meaningful highlight theme for a day rather than generic "Day Theme: Day X"
 */
export function deriveDayHighlight(day: ExportDay, destination: string): string {
  // If the title is already descriptive and not "Day 1", "Day 2", "วันที่ 1", etc.
  if (day.title && !/^Day\s*\d+$/i.test(day.title) && !/^วันที่\s*\d+$/i.test(day.title)) {
    return day.title.trim();
  }

  const activities = day.activities || [];
  if (activities.length === 0) return `Exploring ${destination}`;

  // Analyze text and categories
  const allText = activities.map((a) => `${a.name} ${a.category || ""}`).join(" ").toLowerCase();

  const hasTemple = /temple|shrine|wat|palace|museum|heritage|วัฒนธรรม|วัด|วัง/i.test(allText);
  const hasFood = /food|dining|eat|market|restaurant|cafe|สตรีทฟู้ด|อาหาร|ก๋วยเตี๋ยว/i.test(allText);
  const hasShopping = /shopping|mall|siam|paragon|market|central|ช้อป|ห้าง/i.test(allText);
  const hasPark = /park|nature|garden|river|pier|สวน|แม่น้ำ/i.test(allText);
  const hasArrival = /airport|flight|transit|skyliner|check-in|arrival|บิน/i.test(allText);
  const hasDeparture = /check-out|departure|return|farewell/i.test(allText);

  if (hasArrival && activities.length <= 4) return "Arrival & Neighborhood Discovery";
  if (hasDeparture && activities.length <= 4) return "Farewell & Final Shopping";
  if (hasTemple && hasFood) return "Historic Temples & Authentic Street Food";
  if (hasTemple) return "Historic Temples & Cultural Heritage";
  if (hasShopping && hasFood) return "Modern City Life, Shopping & Dining";
  if (hasShopping) return "Shopping, Malls & Vibrant City";
  if (hasPark && hasFood) return "Scenic Greenery & Street Food Tasting";
  if (hasFood) return "Culinary Flavors & Street Food Discovery";

  return `Highlights & Iconic Spots of ${destination}`;
}

/**
 * Formats a clean category icon keyword for the AI prompt
 */
function getIconForActivity(category: string, name: string): string {
  const text = `${category} ${name}`.toLowerCase();
  if (/airport|flight|plane|บิน|เครื่องบิน/i.test(text)) return "airplane transit icon";
  if (/train|subway|metro|skyliner|bts|mrt|jr|รถไฟ/i.test(text)) return "train transit icon";
  if (/taxi|cab|car|drive|แท็กซี่|รถ/i.test(text)) return "taxi car icon";
  if (/walk|park|street|เดิน|สวน/i.test(text)) return "walking pedestrian icon";
  if (/food|restaurant|cafe|ramen|dining|coffee|กิน|อาหาร|คาเฟ่|ก๋วยเตี๋ยว/i.test(text))
    return "dining food icon";
  if (/hotel|check-in|check-out|resort|พัก|โรงแรม|นอน/i.test(text)) return "hotel bed icon";
  if (/shopping|market|mall|ช้อป|ตลาด/i.test(text)) return "shopping bag icon";
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
  const totalDays = trip.totalDays || trip.days?.length || chunkDays.length || 1;
  const startDay = chunkDays[0]?.day || 1;
  const endDay = chunkDays[chunkDays.length - 1]?.day || startDay;
  const partText = totalParts > 1 ? ` (Part ${partIndex} of ${totalParts})` : "";
  const partRangeText =
    totalParts > 1 ? ` (Part ${partIndex} of ${totalParts}: Days ${startDay}-${endDay})` : "";

  // Date range formatted nicely
  const dateRangeText =
    trip.startDate && trip.endDate
      ? `${trip.startDate} - ${trip.endDate}`
      : chunkDays[0]?.date && chunkDays[chunkDays.length - 1]?.date
      ? `${chunkDays[0]?.date} - ${chunkDays[chunkDays.length - 1]?.date}`
      : "Upcoming Trip";

  // Search for hotel from activities or trip
  let detectedHotel = "";
  for (const d of trip.days || []) {
    for (const a of d.activities || []) {
      if (/check[\s-]*in|hotel|resort|โรงแรม/i.test(a.name) || a.category === "hotel") {
        detectedHotel = a.name.replace(/^check[\s-]*in:?\s*/i, "").trim();
        break;
      }
    }
    if (detectedHotel) break;
  }
  const hotelInfo = detectedHotel || `Centrally located accommodation in ${destination}`;

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

  // Build column descriptions with strict location name labeling
  const columnsDescription = chunkDays
    .map((day, idx) => {
      const color = columnPalette[idx % columnPalette.length];
      const highlight = deriveDayHighlight(day, destination);

      const activitiesSummary = (day.activities || [])
        .slice(0, 8)
        .map((act) => {
          const time = act.time ? `${act.time}` : "Flexible";
          const sanitizedName = sanitizeActivityName(
            act.name,
            act.localName,
            act.category,
            destination
          );
          const icon = getIconForActivity(act.category, act.name);
          return `- Stop [${time}]: Icon '${icon}', Location Name: "${sanitizedName}". MANDATORY: Visibly print the place name "${sanitizedName}" right beside its icon and thumbnail card.`;
        })
        .join("\n        ");

      return `Column ${idx + 1} (${color} theme):
      - Header label: 'DAY ${day.day}' with date '${day.date || ""}'
      - Highlight Subtitle: '${highlight}' (small subtitle under Day badge; DO NOT print the literal label words 'Day Theme')
      - Timeline entries:
        ${activitiesSummary || "- Relax and explore local spots"}`;
    })
    .join("\n\n    ");

  return `Masterpiece travel itinerary infographic poster for '${tripTitle}'${partText}.
Destination: ${destination}.
Layout: Ultra-wide 16:9 widescreen horizontal orientation.

CRITICAL MANDATORY REQUIREMENT - EVERY LOCATION MUST HAVE A VISIBLE TEXT NAME:
- Every single activity stop/node MUST feature its exact location name printed in bold, legible typography immediately next to or above its photo thumbnail.
- NEVER generate an empty node, an orphan photo card without its place name, or a standalone icon with no title.
- If there is a photo card, the location name MUST be visibly written on or directly beside the card.
- Text rendering must be crisp, high contrast, sharp, and easy to read.

Top Header Section:
- Beautiful artistic panoramic banner depicting ${destination}'s iconic landmarks, scenic atmosphere, skyline, and cultural motifs.
- Elegant title badge displaying '${tripTitle.toUpperCase()}'${partText}.
- Header Sub-badge exact text (mandatory):
  'TRIP DURATION: ${totalDays} DAYS${partRangeText} | DATE RANGE: ${dateRangeText} | TRAVELER: EXPLORER'

Main Body Grid:
Divided evenly into ${chunkDays.length} vertical colored columns representing each travel day:
${columnsDescription}

Each column has:
- Rounded colorful top badge for the Day number and date.
- Clean Single-Column Linear Vertical Timeline (timeline line on the left, node icon on the line, place name and photo card aligned neatly to the right). NO confusing zigzag left-right layouts so text and icons stay firmly paired.
- Clear time labels (e.g. 09:30, 12:00, 15:30, 18:00).
- Flat minimalist vector icons for transit (airplane, bullet train, walking, taxi) and activities (dining, temple, shopping, hotel).
- Miniature photo-style thumbnail illustrations of landmark attractions, scenic spots, and local cuisine.
- Even Vertical Distribution: Distribute timeline nodes evenly along the vertical height of each column so there are no awkward empty gaps at the bottom.

Bottom Footer Section:
- Clean card summarizing hotel accommodation ('Hotel: ${hotelInfo}'), nearby station walking distance, and trip tips.
- Standard Symbol Legend showing uniform icons:
  [Walking Pedestrian], [Transit/Train], [Taxi/Vehicle], [Dining/Food], [Historic Temple/Landmark], [Shopping], [Hotel/Stay].
- Footnote disclaimer with Google Maps and transit IC card tips.

Visual Style:
- Clean, modern Japanese travel editorial infographic design.
- Harmonious pastel color palette, soft drop shadows, crisp layout hierarchy, high typography readability.
- Professional travel agency poster quality, ultra-high definition, 4K rendering.`.trim();
}

