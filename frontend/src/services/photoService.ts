/**
 * photoService.ts
 *
 * Smart Multi-Tier Travel Photo Engine
 * Tier 0: In-Memory / Local Cache
 * Tier 1A: Exact Wikipedia Page Title Lookup (100% precision)
 * Tier 1B: Wikipedia Full-Text Search with Strict Title Relevance Filtering (Prevents landmark leak)
 * Tier 2: Wikidata Official Landmark Entity Photo (Property P18 with Label Match)
 * Tier 3: Wikimedia Commons MediaSearch API
 * Tier 4: Destination & Culture-Aware Contextual Fallbacks (High-Aesthetic Photography)
 */

export interface PhotoSearchOptions {
  cityName?: string;
  countryName?: string;
  category?: string;
  searchKeyword?: string;
  wikiTitle?: string;
  indexOffset?: number;
}

import { foursquareSearch, foursquareGetPhotos, isFoursquareRateLimited } from "@/api/foursquareClient";

export interface PhotoSearchResult {
  url: string;
  title: string;
  source: "wikipedia" | "wikidata" | "wikimedia" | "unsplash" | "foursquare" | "custom" | "openverse" | "google";
}

const FOURSQUARE_API_KEY = typeof import.meta !== "undefined" ? (import.meta.env?.VITE_FOURSQUARE_API_KEY as string) : "";

// In-Memory Cache for instant repeated lookups
const photoCache = new Map<string, string>();

// Track used fallback URLs per session to guarantee zero duplicates across the itinerary
const sessionUsedFallbacks = new Set<string>();

// ---------------------------------------------------------------------------
// 1. RELEVANCE VERIFICATION & QUERY CLEANER
// ---------------------------------------------------------------------------

/**
 * Checks whether a Wikipedia article title is genuinely relevant to the requested place.
 * Strictly prevents landmark false-positives (e.g., returning "Wat Phra Kaew" when searching "Suan Luang Rama 9").
 */
export function isWikiTitleRelevant(wikiTitle: string, query: string, placeName: string): boolean {
  if (!wikiTitle || !wikiTitle.trim()) return false;
  const wt = wikiTitle.toLowerCase().trim();
  const q = (query || "").toLowerCase().trim();
  const pn = (placeName || "").toLowerCase().trim();

  // Strip Wikipedia namespace/meta articles
  if (
    wt.startsWith("list of ") ||
    wt.startsWith("category:") ||
    wt.startsWith("template:") ||
    wt.startsWith("portal:") ||
    wt.includes("disambiguation") ||
    wt.includes("timeline of") ||
    wt.includes("history of")
  ) {
    return false;
  }

  // Reject generic country/city-wide articles if the place is a specific attraction
  const genericGeoArticles = [
    "thailand", "japan", "france", "italy", "united states", "united kingdom",
    "bangkok", "tokyo", "paris", "london", "rome", "kyoto", "osaka", "phuket", "chiang mai"
  ];
  if (genericGeoArticles.includes(wt) && !genericGeoArticles.includes(pn) && !genericGeoArticles.includes(q)) {
    return false;
  }

  // Direct substring matches
  if (wt.includes(pn) || pn.includes(wt) || (q && (wt.includes(q) || q.includes(wt)))) {
    return true;
  }

  const normalizeTokens = (str: string) =>
    str
      .replace(/[^a-z0-9\u0E00-\u0E7F]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);

  const stopWords = new Set([
    "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with", "by", "near"
  ]);

  const placeTokens = normalizeTokens(`${pn} ${q}`).filter((t) => !stopWords.has(t));
  const wikiTokens = normalizeTokens(wt).filter((t) => !stopWords.has(t));

  if (placeTokens.length === 0 || wikiTokens.length === 0) {
    const rawPlaceTokens = normalizeTokens(`${pn} ${q}`);
    const rawWikiTokens = normalizeTokens(wt);
    return rawPlaceTokens.some((t) => rawWikiTokens.includes(t));
  }

  // Check token overlap with transliteration tolerance
  const matchedTokens = placeTokens.filter((pt) =>
    wikiTokens.some((wtk) => {
      if (pt === wtk) return true;
      // Transliteration & numbering equivalents
      if ((pt === "talad" && wtk === "talat") || (pt === "talat" && wtk === "talad")) return true;
      if ((pt === "lumphini" && wtk === "lumpini") || (pt === "lumpini" && wtk === "lumphini")) return true;
      if ((pt === "rama" && wtk === "rama") || (pt === "9" && wtk === "ix") || (pt === "ix" && wtk === "9")) return true;
      if ((pt === "phra" && wtk === "pra") || (pt === "pra" && wtk === "phra")) return true;
      if ((pt === "kaew" && wtk === "keo") || (pt === "chatuchak" && wtk === "jatujak")) return true;
      if (pt.length >= 3 && wtk.length >= 3 && (pt.includes(wtk) || wtk.includes(pt))) return true;
      return false;
    })
  );

  return matchedTokens.length > 0;
}

/**
 * Extracts clean search candidates from place titles, stripping action verbs and prefixes.
 */
export function extractPlaceSearchQueries(rawTitle: string, cityName?: string): string[] {
  if (!rawTitle || !rawTitle.trim()) return [];

  const queries: string[] = [];
  let title = rawTitle.trim();

  // 1. Check for parentheses (e.g. "วัดพระแก้ว (Wat Phra Kaew)" or "Suan Luang Rama IX (King Rama IX Park)")
  const parenMatch = title.match(/^(.*?)\s*[\(\[\{](.*?)[\)\]\}]\s*$/);
  let mainPart = title;
  let parenPart = "";

  if (parenMatch) {
    mainPart = parenMatch[1].trim();
    parenPart = parenMatch[2].trim();
  }

  const cleanSingle = (str: string): string => {
    let s = str.trim();

    // English action verbs & prefixes
    const enPrefixes = [
      /^(Explore|Visit|See|Tour|Check out|Discover|Experience|Enjoy|Attend|Watch|Ride|Take a|Catch a|Walk around|Walk through|Walk in|Walk to|Walk|Stroll around|Stroll through|Stroll|Hike up|Hike|Climb|Swim at|Snorkel at|Dive at|Relax at|Relax in|Chill at|Rest at|Wander around|Wander through|Shopping at|Shopping in|Head to|Go to|Travel to|Arrive at|Check in|Check out)\s+/i,
      /^(Breakfast|Lunch|Dinner|Brunch|Supper|Snack|Coffee|Tea|Drink|Cocktail)\s+(at|in|near|by|around|along|by the)\s+/i,
      /^(Grab|Have|Try|Eat|Taste|Sample)\s+(breakfast|lunch|dinner|brunch|coffee|tea|a meal|food|snacks?)\s+(at|in|near|by|around)?\s*/i,
      /^(Night|Morning|Evening|Afternoon|Sunset|Sunrise)\s+(view|visit|walk|cruise|tour|market|show|performance|activity)\s+(of|at|in|near|along)?\s*/i,
      /^(Traditional|Local|Authentic|Classic|Famous|Typical)\s+[\w\s]*(Lunch|Dinner|Breakfast|Brunch|Food|Market|Street Food|Eatery)\s+(at|in|near)?\s*/i,
      /^(at|in|near|by|around|along|the)\s+/i,
    ];

    // Thai action verbs & prefixes
    const thPrefixes = [
      /^(ชมวิวพระอาทิตย์ตกที่|ชมวิวพระอาทิตย์ตก|ชมวิวที่|ชมความงามของ|ชมวิว|เที่ยวชม|เที่ยว|แวะเที่ยว|แวะชม|แวะถ่ายรูปที่|แวะถ่ายรูป|แวะ|ไหว้พระที่|ไหว้พระขอพรที่|ไหว้พระขอพร|ไหว้พระ|สักการะที่|สักการะ|ขอพรที่|ขอพร)\s*/,
      /^(ทานอาหารกลางวันที่|ทานอาหารมื้อค่ำที่|ทานอาหารเย็นที่|ทานอาหารที่|ทานมื้อเที่ยงที่|ทานมื้อค่ำที่|กินข้าวกลางวันที่|กินข้าวเที่ยงที่|กินข้าวเย็นที่|กินข้าวที่|กินอาหารที่|กิน|จิบกาแฟที่|ดื่มกาแฟที่|นั่งชิลที่)\s*/,
      /^(ช้อปปิ้งที่|ช้อปปิ้ง|เดินเล่นที่|เดินเล่น|เดินชม|พักผ่อนที่|พักผ่อน|เช็คอินที่|เช็คอิน|เดินทางถึง|เดินทางไป|เดินทางสู่)\s*/,
      /^(ร้านอาหาร|ร้านกาแฟ|คาเฟ่|ร้าน)\s*/,
    ];

    let prev = "";
    while (prev !== s) {
      prev = s;
      for (const p of enPrefixes) s = s.replace(p, "").trim();
      for (const p of thPrefixes) s = s.replace(p, "").trim();
    }

    // Remove trailing location noise (e.g. " - Day 1", " - Tokyo", " | Bangkok")
    s = s.replace(/\s*[-–—|]\s*(Day\s*\d+|Morning|Afternoon|Evening|Night).*$/i, "").trim();

    return s;
  };

  const cleanMain = cleanSingle(mainPart);
  const cleanParen = parenPart ? cleanSingle(parenPart) : "";

  // Filter out cityName if cityName looks like a landmark name (e.g. contains Wat, Temple, Palace)
  const isFakeCity = cityName && /(wat|temple|palace|shrine|museum|park|sanctuary|eatery|food)/i.test(cityName);
  const city = (!isFakeCity && cityName?.trim()) || "";

  // English letters detector
  const isEnglish = (str: string) => /^[A-Za-z0-9\s.,'-]+$/.test(str);

  if (cleanParen && isEnglish(cleanParen)) {
    queries.push(cleanParen);
    if (city) queries.push(`${cleanParen} ${city}`);
  }

  if (cleanMain) {
    queries.push(cleanMain);
    if (city) queries.push(`${cleanMain} ${city}`);

    // If multi-word venue title, extract leading brand & dish (e.g. "Thip Samai pad thai wrapped in egg" -> "Thip Samai", "Thipsamai", "pad thai")
    const words = cleanMain.split(/\s+/);
    if (words.length >= 3) {
      const brand = words.slice(0, 2).join(" ");
      if (brand.length >= 4) {
        queries.push(brand);
        queries.push(words.slice(0, 2).join(""));
        if (city) queries.push(`${brand} ${city}`);
      }
      const foodTerms = ["pad thai", "khao soi", "tom yum", "som tam", "boat noodle", "green curry", "satay", "roti"];
      for (const ft of foodTerms) {
        if (cleanMain.toLowerCase().includes(ft)) {
          queries.push(ft);
          break;
        }
      }
    }
  }

  if (cleanParen && !queries.includes(cleanParen)) {
    queries.push(cleanParen);
    if (city) queries.push(`${cleanParen} ${city}`);
  }

  if (queries.length === 0) {
    const rawClean = cleanSingle(rawTitle);
    if (rawClean) queries.push(rawClean);
  }

  return Array.from(new Set(queries));
}

export function cleanPlaceQuery(rawTitle: string): string {
  const list = extractPlaceSearchQueries(rawTitle);
  return list[0] || (rawTitle || "").trim();
}

// ---------------------------------------------------------------------------
// 2. CURATED DESTINATION & CULTURE-AWARE PHOTO COLLECTIONS
// ---------------------------------------------------------------------------

interface RegionalLibrary {
  food: string[];
  culture: string[];
  nature: string[];
  shopping: string[];
  nightlife: string[];
  spiritual: string[];
  landmark: string[];
  relax: string[];
  hotel: string[];
  adventure: string[];
  transport: string[];
  sightseeing: string[];
}

const THAILAND_PHOTOS: RegionalLibrary = {
  food: [
    "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1000&q=80", // Pad Thai & Thai street noodles
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=80", // Asian noodle soup / boat noodles
    "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?auto=format&fit=crop&w=1000&q=80", // Thai street food market vendor
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80", // Gourmet Thai dining dish
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&q=80", // Thai fresh herbs & spicy dish
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80", // Lively Asian restaurant atmosphere
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1000&q=80", // Asian local culinary kitchen
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1000&q=80", // Thai sweet dessert & mango
  ],
  culture: [
    "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1000&q=80", // Thai Grand Temple Chedi
    "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=1000&q=80", // Golden Thai Buddhist architecture
    "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=1000&q=80", // Southeast Asian heritage pavilion
    "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1000&q=80", // Historic Siamese sanctuary
    "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=1000&q=80", // Ornate temple wall & sculpture
  ],
  nature: [
    "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1000&q=80", // Tropical lush green city park with lake
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1000&q=80", // Serene botanical garden & palms
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80", // Tropical sunny beach & palms
    "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1000&q=80", // Tropical waterfall & rainforest
    "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1000&q=80", // Emerald park lake & trees
  ],
  shopping: [
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1000&q=80", // Asian night market bazaar
    "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=1000&q=80", // Modern lifestyle shopping mall
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1000&q=80", // Colorful handicrafts & market
    "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1000&q=80", // Bangkok shopping plaza
  ],
  nightlife: [
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1000&q=80", // Bangkok rooftop skyline bar
    "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1000&q=80", // Vibrant night city lights
    "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=1000&q=80", // Lively evening bar & lounge
  ],
  spiritual: [
    "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=1000&q=80", // Revered Golden Shrine
    "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1000&q=80", // Sacred Thai Mutelu Temple
    "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=1000&q=80", // Blessing & lotus offerings
  ],
  landmark: [
    "https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?auto=format&fit=crop&w=1000&q=80", // Iconic cityscape viewpoint
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1000&q=80", // Famous architectural photo spot
  ],
  relax: [
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80", // Thai wellness & spa retreat
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80", // Relaxing herbal massage ambience
  ],
  hotel: [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80", // Luxury tropical hotel resort
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80", // Boutique hospitality room
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80", // Modern hotel suite
  ],
  adventure: [
    "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1000&q=80", // Island boat tour
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80", // Tropical outdoor adventure
  ],
  transport: [
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80", // City public transit
    "https://images.unsplash.com/photo-1436491865332-7a61a109db56?auto=format&fit=crop&w=1000&q=80", // Airport flight terminal
  ],
  sightseeing: [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1000&q=80", // Sightseeing travel
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=80", // Scenic destination
  ],
};

const JAPAN_PHOTOS: RegionalLibrary = {
  food: [
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=80", // Japanese Ramen bowl
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1000&q=80", // Fresh Sushi platter
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80", // Tokyo Izakaya dining
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1000&q=80", // Japanese matcha dessert
  ],
  culture: [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=80", // Red Shinto Torii Gate
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1000&q=80", // Kyoto historic pagoda & temple
    "https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=1000&q=80", // Traditional Japanese architecture
  ],
  nature: [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=80", // Mount Fuji & Cherry Blossoms
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1000&q=80", // Japanese Zen garden & bamboo
  ],
  shopping: [
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1000&q=80", // Shibuya & Shinjuku shopping
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1000&q=80", // Akihabara shopping
  ],
  nightlife: [
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1000&q=80", // Tokyo Neon Nightlife
  ],
  spiritual: [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=80", // Shinto shrine worship
  ],
  landmark: [
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1000&q=80", // Tokyo Tower landmark
  ],
  relax: [
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80", // Japanese Onsen
  ],
  hotel: [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80", // Modern Tokyo Hotel
  ],
  adventure: [
    "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1000&q=80", // Japan scenic hike
  ],
  transport: [
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80", // Shinkansen train
  ],
  sightseeing: [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1000&q=80", // Sightseeing
  ],
};

const GLOBAL_PHOTOS: RegionalLibrary = {
  ...THAILAND_PHOTOS,
  food: [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&q=80",
  ],
};

export function detectRegion(cityName?: string, countryName?: string, seedText?: string): "thailand" | "japan" | "global" {
  const combined = `${cityName || ""} ${countryName || ""} ${seedText || ""}`.toLowerCase();

  if (
    combined.includes("thai") ||
    combined.includes("bangkok") ||
    combined.includes("phuket") ||
    combined.includes("chiang mai") ||
    combined.includes("pattaya") ||
    combined.includes("krabi") ||
    combined.includes("samui") ||
    combined.includes("กรุงเทพ") ||
    combined.includes("ไทย") ||
    combined.includes("เชียงใหม่") ||
    combined.includes("ภูเก็ต")
  ) {
    return "thailand";
  }

  if (
    combined.includes("japan") ||
    combined.includes("tokyo") ||
    combined.includes("osaka") ||
    combined.includes("kyoto") ||
    combined.includes("hokkaido") ||
    combined.includes("ญี่ปุ่น") ||
    combined.includes("โตเกียว")
  ) {
    return "japan";
  }

  return "global";
}

export function detectPhotoCategory(rawTitle: string, explicitCategory?: string): keyof RegionalLibrary {
  const text = `${explicitCategory || ""} ${rawTitle || ""}`.toLowerCase();

  if (
    text.includes("food") ||
    text.includes("restaurant") ||
    text.includes("cafe") ||
    text.includes("coffee") ||
    text.includes("tea") ||
    text.includes("breakfast") ||
    text.includes("lunch") ||
    text.includes("dinner") ||
    text.includes("dining") ||
    text.includes("snack") ||
    text.includes("eat") ||
    text.includes("noodle") ||
    text.includes("curry") ||
    text.includes("ramen") ||
    text.includes("sushi") ||
    text.includes("อาหาร") ||
    text.includes("ก๋วยเตี๋ยว") ||
    text.includes("ข้าวมันไก่") ||
    text.includes("ส้มตำ")
  ) {
    return "food";
  }

  if (
    text.includes("spiritual") ||
    text.includes("mutelu") ||
    text.includes("มูเตลู") ||
    text.includes("ขอพร") ||
    text.includes("ศาล") ||
    text.includes("พระพรหม") ||
    text.includes("พระพิฆเนศ")
  ) {
    return "spiritual";
  }

  if (
    text.includes("temple") ||
    text.includes("wat ") ||
    text.includes("shrine") ||
    text.includes("church") ||
    text.includes("palace") ||
    text.includes("monument") ||
    text.includes("museum") ||
    text.includes("culture") ||
    text.includes("heritage") ||
    text.includes("historic") ||
    text.includes("วัด") ||
    text.includes("วัง") ||
    text.includes("พิพิธภัณฑ์")
  ) {
    return "culture";
  }

  if (
    text.includes("hotel") ||
    text.includes("resort") ||
    text.includes("hostel") ||
    text.includes("stay") ||
    text.includes("check in") ||
    text.includes("check out") ||
    text.includes("โรงแรม") ||
    text.includes("ที่พัก")
  ) {
    return "hotel";
  }

  if (
    text.includes("market") ||
    text.includes("mall") ||
    text.includes("shop") ||
    text.includes("store") ||
    text.includes("bazaar") ||
    text.includes("ตลาด") ||
    text.includes("ห้าง")
  ) {
    return "shopping";
  }

  if (
    text.includes("bar") ||
    text.includes("club") ||
    text.includes("pub") ||
    text.includes("nightlife") ||
    text.includes("rooftop") ||
    text.includes("ผับ") ||
    text.includes("บาร์")
  ) {
    return "nightlife";
  }

  if (
    text.includes("spa") ||
    text.includes("onsen") ||
    text.includes("massage") ||
    text.includes("relax") ||
    text.includes("นวด") ||
    text.includes("สปา")
  ) {
    return "relax";
  }

  if (
    text.includes("park") ||
    text.includes("beach") ||
    text.includes("island") ||
    text.includes("sea") ||
    text.includes("mountain") ||
    text.includes("nature") ||
    text.includes("garden") ||
    text.includes("waterfall") ||
    text.includes("lake") ||
    text.includes("สวน") ||
    text.includes("หาด") ||
    text.includes("เขา")
  ) {
    return "nature";
  }

  if (
    text.includes("train") ||
    text.includes("station") ||
    text.includes("airport") ||
    text.includes("flight") ||
    text.includes("ferry") ||
    text.includes("boat") ||
    text.includes("สนามบิน") ||
    text.includes("สถานี")
  ) {
    return "transport";
  }

  return "sightseeing";
}

/**
 * Returns a culturally and contextually accurate fallback photo.
 * Avoids returning the same fallback photo for multiple cards by hashing with offset.
 */
export function getCuratedFallbackPhoto(
  category?: string,
  seedText: string = "default",
  options?: { cityName?: string; countryName?: string; indexOffset?: number }
): string {
  const catKey = detectPhotoCategory(seedText, category);
  const region = detectRegion(options?.cityName, options?.countryName, seedText);
  const library = region === "thailand" ? THAILAND_PHOTOS : region === "japan" ? JAPAN_PHOTOS : GLOBAL_PHOTOS;
  const list = library[catKey] || library.sightseeing;

  let hash = 0;
  const combinedSeed = `${seedText}_${options?.indexOffset || 0}`;
  for (let i = 0; i < combinedSeed.length; i++) {
    hash = (hash << 5) - hash + combinedSeed.charCodeAt(i);
    hash |= 0;
  }

  // Anti-duplicate dispenser: find the first photo in the list not yet used, or index by hash
  let selectedUrl = list[Math.abs(hash) % list.length];
  for (let step = 0; step < list.length; step++) {
    const candidate = list[(Math.abs(hash) + step) % list.length];
    if (!sessionUsedFallbacks.has(candidate)) {
      selectedUrl = candidate;
      sessionUsedFallbacks.add(candidate);
      break;
    }
  }

  return selectedUrl;
}

// ---------------------------------------------------------------------------
// 3. TIER 1A: Exact Wikipedia Title Match
// ---------------------------------------------------------------------------
export async function fetchFromWikipediaExactTitle(title: string, lang = "en"): Promise<string | null> {
  if (!title || !title.trim()) return null;
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      title.trim()
    )}&prop=pageimages&pithumbsize=1000&redirects=1&format=json&origin=*`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const pageList = Object.values(pages) as any[];
    for (const page of pageList) {
      if (page.pageid && page.pageid > 0 && page.thumbnail?.source) {
        const src = page.thumbnail.source;
        const lower = src.toLowerCase();
        if (
          !lower.endsWith(".svg") &&
          !lower.includes("flag_of") &&
          !lower.includes("coat_of_arms") &&
          !lower.includes("logo") &&
          !lower.includes("map")
        ) {
          return src;
        }
      }
    }
  } catch {
    // Non-critical, cascade
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. TIER 1B: Wikipedia Full-Text Search (Strict Relevance Filtered)
// ---------------------------------------------------------------------------
async function fetchFromWikipediaSearch(query: string, lang = "en", originalPlaceName: string = ""): Promise<string | null> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=3&prop=pageimages&pithumbsize=1000&redirects=1&format=json&origin=*`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const pageList = Object.values(pages) as any[];
    pageList.sort((a, b) => (a.index || 0) - (b.index || 0));

    for (const page of pageList) {
      // Relevance Check: Ensure article title matches the searched place
      if (!isWikiTitleRelevant(page.title, query, originalPlaceName)) {
        continue; // Skip irrelevant article (e.g. Wat Phra Kaew leaking into other searches)
      }

      const src = page.thumbnail?.source;
      if (src) {
        const lower = src.toLowerCase();
        if (
          !lower.endsWith(".svg") &&
          !lower.includes("flag_of") &&
          !lower.includes("coat_of_arms") &&
          !lower.includes("logo") &&
          !lower.includes("map")
        ) {
          return src;
        }
      }
    }
  } catch {
    // Non-critical, cascade
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. TIER 2: Wikidata Official Landmark Entity Image (Property P18)
// ---------------------------------------------------------------------------
async function fetchFromWikidata(query: string, originalPlaceName: string = ""): Promise<string | null> {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      query
    )}&language=en&limit=2&format=json&origin=*`;

    const res = await fetch(searchUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const searchData = await res.json();
    const entities = searchData.search || [];

    for (const entity of entities) {
      if (!isWikiTitleRelevant(entity.label || entity.id, query, originalPlaceName)) {
        continue;
      }

      const entityId = entity.id;
      const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;
      const entityRes = await fetch(entityUrl, { headers: { Accept: "application/json" } });
      if (!entityRes.ok) continue;

      const entityData = await entityRes.json();
      const claims = entityData.entities?.[entityId]?.claims;
      const p18Claim = claims?.P18?.[0];
      const fileName = p18Claim?.mainsnak?.datavalue?.value;

      if (fileName && typeof fileName === "string") {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
          fileName
        )}?width=1000`;
      }
    }
  } catch {
    // Non-critical, cascade
  }
  return null;
}

// ---------------------------------------------------------------------------
// 6. TIER 3: Wikimedia Commons MediaSearch API
// ---------------------------------------------------------------------------
async function fetchFromWikimediaCommons(searchTerm: string, originalPlaceName: string = ""): Promise<string | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      searchTerm
    )}&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|mime&iiurlwidth=1000&format=json&origin=*`;

    const res = await fetch(url, {
      headers: { "User-Agent": "PixineraryTravelApp/2.0" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const items = Object.values(pages) as any[];
    for (const item of items) {
      if (!isWikiTitleRelevant(item.title || "", searchTerm, originalPlaceName)) {
        continue;
      }

      const info = item.imageinfo?.[0];
      if (!info) continue;

      const imgUrl: string = info.thumburl || info.url || "";
      const lower = imgUrl.toLowerCase();

      if (
        !imgUrl ||
        lower.endsWith(".svg") ||
        lower.endsWith(".ogg") ||
        lower.endsWith(".pdf") ||
        lower.endsWith(".tif") ||
        lower.includes("flag_of") ||
        lower.includes("coat_of_arms") ||
        lower.includes("map") ||
        lower.includes("logo") ||
        lower.includes("icon") ||
        lower.includes("symbol")
      ) {
        continue;
      }

      return imgUrl;
    }
  } catch {
    // Non-critical, cascade
  }
  return null;
}

// ---------------------------------------------------------------------------
// 7. PUBLIC SMART PHOTO FETCHER
// ---------------------------------------------------------------------------
export async function fetchSmartPhoto(
  placeName: string,
  options?: PhotoSearchOptions
): Promise<string> {
  if (!placeName || !placeName.trim()) {
    return getCuratedFallbackPhoto(options?.category, "general", options);
  }

  const city = options?.cityName?.trim() || "";
  const country = options?.countryName?.trim() || "";
  const category = options?.category || "";
  const directKeyword = options?.searchKeyword?.trim() || "";
  const wikiTitle = options?.wikiTitle?.trim() || "";

  const cacheKey = `${wikiTitle}_${directKeyword || placeName}_${city}_${category}`.toLowerCase();
  if (photoCache.has(cacheKey)) {
    return photoCache.get(cacheKey)!;
  }

  // 1. Tier 1A: Direct Wikipedia Title Match (if AI supplied an exact wiki_title)
  if (wikiTitle) {
    const exactEn = await fetchFromWikipediaExactTitle(wikiTitle, "en");
    if (exactEn) {
      photoCache.set(cacheKey, exactEn);
      return exactEn;
    }
    const exactTh = await fetchFromWikipediaExactTitle(wikiTitle, "th");
    if (exactTh) {
      photoCache.set(cacheKey, exactTh);
      return exactTh;
    }
  }

  // 2. Direct exact title lookup with cleaned placeName
  const cleanedTitle = cleanPlaceQuery(placeName);
  const exactDirect = await fetchFromWikipediaExactTitle(cleanedTitle, "en");
  if (exactDirect) {
    photoCache.set(cacheKey, exactDirect);
    return exactDirect;
  }

  // 3. Generate ranked search candidate queries
  const queries = extractPlaceSearchQueries(directKeyword || placeName, city);

  // 4. Try Wikipedia Search API with Relevance Guard (EN first)
  for (const q of queries) {
    const wikiMatch = await fetchFromWikipediaSearch(q, "en", placeName);
    if (wikiMatch) {
      photoCache.set(cacheKey, wikiMatch);
      return wikiMatch;
    }
  }

  // 5. If query contains Thai characters, try Thai Wikipedia
  const hasThai = queries.some((q) => /[\u0E00-\u0E7F]/.test(q));
  if (hasThai) {
    for (const q of queries) {
      const thMatch = await fetchFromWikipediaSearch(q, "th", placeName);
      if (thMatch) {
        photoCache.set(cacheKey, thMatch);
        return thMatch;
      }
    }
  }

  // 6. Try Wikidata Official Entity Image
  for (const q of queries) {
    const wikidataMatch = await fetchFromWikidata(q, placeName);
    if (wikidataMatch) {
      photoCache.set(cacheKey, wikidataMatch);
      return wikidataMatch;
    }
  }

  // 7. Try Wikimedia Commons MediaSearch
  for (const q of queries) {
    const commonsMatch = await fetchFromWikimediaCommons(q, placeName);
    if (commonsMatch) {
      photoCache.set(cacheKey, commonsMatch);
      return commonsMatch;
    }
  }

  // 8. Try Foursquare Places Real Photo (ideal for venues, eateries, modern spots)
  if (FOURSQUARE_API_KEY && FOURSQUARE_API_KEY.trim().length > 5 && !isFoursquareRateLimited()) {
    const fsqPhoto = await fetchFromFoursquarePhoto(placeName, city);
    if (fsqPhoto) {
      photoCache.set(cacheKey, fsqPhoto);
      return fsqPhoto;
    }
  }

  // 9. Fallback: Contextual High-Aesthetic Photo (Region & Category tailored)
  const fallback = getCuratedFallbackPhoto(category, `${placeName} ${city}`, {
    cityName: city,
    countryName: country,
    indexOffset: options?.indexOffset,
  });
  photoCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Fetch open Creative Commons travel photos from Openverse API (Bypassed due to api.openverse.org 504 Gateway Timeouts)
 */
export async function fetchFromOpenverse(_query: string): Promise<string | null> {
  return null;
}

/**
 * Real venue / restaurant / cafe / attraction photos from Foursquare Places API (CORS-safe)
 */
export async function fetchFromFoursquarePhoto(placeName: string, cityName?: string): Promise<string | null> {
  if (isFoursquareRateLimited()) return null;
  try {
    const q = cityName ? `${placeName} ${cityName}` : placeName;
    const data = await foursquareSearch(q, { limit: 1 });
    const place = data?.results?.[0];
    if (place) {
      if (place.photos && place.photos.length > 0) {
        return `${place.photos[0].prefix}original${place.photos[0].suffix}`;
      }
      const placeId = place.fsq_place_id || place.fsq_id;
      if (placeId && !isFoursquareRateLimited()) {
        try {
          const photos = await foursquareGetPhotos(placeId, 1);
          if (photos.length > 0) {
            return photos[0].url;
          }
        } catch {
          // Ignore 429 / credit limits
        }
      }
    }
  } catch (err) {
    console.warn("[fetchFromFoursquarePhoto] error:", err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 8. ONLINE CANDIDATE PHOTO SEARCH (For interactive Card Photo Editor UI)
// ---------------------------------------------------------------------------
export async function searchPhotosOnline(
  query: string,
  cityName?: string
): Promise<PhotoSearchResult[]> {
  const results: PhotoSearchResult[] = [];
  const addedUrls = new Set<string>();

  const addResult = (item: PhotoSearchResult) => {
    if (item.url && !addedUrls.has(item.url)) {
      addedUrls.add(item.url);
      results.push(item);
    }
  };

  const queries = extractPlaceSearchQueries(query, cityName);

  try {
    // 0. Fetch authentic photos from Foursquare (via CORS-safe proxy)
    if (!isFoursquareRateLimited() && FOURSQUARE_API_KEY && FOURSQUARE_API_KEY.trim().length > 5) {
      try {
        const q = cityName ? `${query} ${cityName}` : query;
        const fsqData = await foursquareSearch(q, { limit: 3 });
        for (const venue of fsqData?.results || []) {
          if (venue.photos && venue.photos.length > 0) {
            venue.photos.forEach((photo: any) => {
              addResult({
                url: `${photo.prefix}original${photo.suffix}`,
                title: venue.name ? `${venue.name} (Foursquare)` : "Foursquare User Photo",
                source: "foursquare",
              });
            });
          } else {
            const placeId = venue.fsq_place_id || venue.fsq_id;
            if (placeId && !isFoursquareRateLimited()) {
              try {
                const photos = await foursquareGetPhotos(placeId, 2);
                photos.forEach((photo) => {
                  addResult({
                    url: photo.url,
                    title: venue.name ? `${venue.name} (Foursquare)` : "Foursquare User Photo",
                    source: "foursquare",
                  });
                });
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (fsqErr) {
        console.warn("[searchPhotosOnline] Foursquare search failed:", fsqErr);
      }
    }

    // 1. Fetch from Wikipedia Exact & Search
    for (const q of queries.slice(0, 2)) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        q
      )}&gsrlimit=3&prop=pageimages&pithumbsize=1000&redirects=1&format=json&origin=*`;
      const res = await fetch(wikiUrl);
      if (res.ok) {
        const data = await res.json();
        const pages = Object.values(data.query?.pages || {}) as any[];
        pages.forEach((p) => {
          if (p.thumbnail?.source) {
            addResult({
              url: p.thumbnail.source,
              title: p.title || query,
              source: "wikipedia",
            });
          }
        });
      }
    }

    // 2. Fetch from Wikimedia Commons
    for (const q of queries.slice(0, 2)) {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        q
      )}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=1000&format=json&origin=*`;
      const res = await fetch(commonsUrl, { headers: { "User-Agent": "PixineraryTravelApp/2.0" } });
      if (res.ok) {
        const data = await res.json();
        const pages = Object.values(data.query?.pages || {}) as any[];
        pages.forEach((p) => {
          const info = p.imageinfo?.[0];
          const imgUrl = info?.thumburl || info?.url;
          if (imgUrl && !imgUrl.endsWith(".svg") && !imgUrl.includes("flag_of")) {
            addResult({
              url: imgUrl,
              title: (p.title || "").replace(/^File:/i, ""),
              source: "wikimedia",
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("[searchPhotosOnline] error:", err);
  }

  // 4. Include relevant regional category stock items as fallback options if results are few
  if (results.length < 6) {
    const cat = detectPhotoCategory(query);
    const region = detectRegion(cityName);
    const lib = region === "thailand" ? THAILAND_PHOTOS : region === "japan" ? JAPAN_PHOTOS : GLOBAL_PHOTOS;
    (lib[cat] || lib.sightseeing).slice(0, 6 - results.length).forEach((url, i) => {
      addResult({
        url,
        title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Inspiration #${i + 1}`,
        source: "unsplash",
      });
    });
  }

  return results.slice(0, 16);
}

// ---------------------------------------------------------------------------
// 9. USER-UPLOADED PHOTO BINDING HELPER
// ---------------------------------------------------------------------------
export function findMatchingUserPhoto(
  activityTitle: string,
  englishName?: string,
  imageKeyword?: string,
  detectedLocations: Array<{ place?: string; uploadedImageUrl?: string; photoUrl?: string }> = [],
  wikiTitle?: string
): string | null {
  if (!detectedLocations || detectedLocations.length === 0) return null;

  const normalize = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u0E00-\u0E7F]/g, " ")
      .trim();

  const actNorm = normalize(activityTitle);
  const engNorm = englishName ? normalize(englishName) : "";
  const keyNorm = imageKeyword ? normalize(imageKeyword) : "";
  const wikiNorm = wikiTitle ? normalize(wikiTitle) : "";

  for (const loc of detectedLocations) {
    const locNorm = normalize(loc.place || "");
    if (!locNorm || locNorm.length < 2) continue;

    const userImg = loc.uploadedImageUrl || loc.photoUrl;
    if (!userImg) continue;

    // Check if place name is contained in activity title, english name, keyword, or wiki title
    if (
      actNorm.includes(locNorm) ||
      locNorm.includes(actNorm) ||
      (engNorm && (engNorm.includes(locNorm) || locNorm.includes(engNorm))) ||
      (keyNorm && (keyNorm.includes(locNorm) || locNorm.includes(keyNorm))) ||
      (wikiNorm && (wikiNorm.includes(locNorm) || locNorm.includes(wikiNorm)))
    ) {
      return userImg;
    }
  }

  return null;
}
