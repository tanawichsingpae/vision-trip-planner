/**
 * Translator Service — Robust bilingual (Thai <-> English) dictionary,
 * script detection, and resilient translation cache.
 */

// Common Thai <-> English travel, place, and accommodation vocabulary
export const DICTIONARY_EN_TO_TH: Record<string, string> = {
  // Accommodations
  "hotel": "โรงแรม",
  "resort": "รีสอร์ท",
  "hostel": "โฮสเทล",
  "inn": "อินน์",
  "guesthouse": "เกสต์เฮาส์",
  "boutique hotel": "โรงแรมบูทีค",
  "luxury hotel": "โรงแรมหรู",
  "check in": "เช็คอิน",
  "check out": "เช็คเอาท์",
  "accommodation": "ที่พัก",
  "stay": "ที่พัก",

  // Attractions & Places
  "temple": "วัด",
  "wat": "วัด",
  "shrine": "ศาลเจ้า",
  "palace": "พระราชวัง",
  "grand palace": "พระบรมมหาราชวัง",
  "museum": "พิพิธภัณฑ์",
  "national park": "อุทยานแห่งชาติ",
  "park": "สวนสาธารณะ",
  "central park": "สวนสาธารณะใจกลางเมือง",
  "beach": "ชายหาด",
  "island": "เกาะ",
  "waterfall": "น้ำตก",
  "mountain": "ภูเขา",
  "peak": "ยอดเขา",
  "viewpoint": "จุดชมวิว",
  "skywalk": "สกายวอล์ก",
  "observation deck": "จุดชมวิวบนตึกสูง",
  "night market": "ตลาดนัดกลางคืน",
  "floating market": "ตลาดน้ำ",
  "market": "ตลาด",
  "walking street": "ถนนคนเดิน",
  "shopping mall": "ศูนย์การค้า",
  "arcade": "ศูนย์รวมร้านค้า",
  "street food": "สตรีทฟู้ด",
  "restaurant": "ร้านอาหาร",
  "eatery": "ร้านอาหารท้องถิ่น",
  "cafe": "คาเฟ่",
  "coffee shop": "ร้านกาแฟ",
  "bar": "บาร์",
  "rooftop bar": "รูฟท็อปบาร์",
  "pub": "ผับ",
  "spa": "สปา",
  "massage": "นวดแผนไทย",
  "hot spring": "บ่อน้ำพุร้อน",
  "onsen": "ออนเซ็น",
  "theme park": "สวนสนุก",
  "water park": "สวนน้ำ",
  "aquarium": "พิพิธภัณฑ์สัตว์น้ำ",
  "zoo": "สวนสัตว์",
  "safari": "ซาฟารี",

  // Common activities & actions
  "sightseeing": "ท่องเที่ยวชมเมือง",
  "dinner": "อาหารค่ำ",
  "lunch": "อาหารกลางวัน",
  "breakfast": "อาหารเช้า",
  "sunset": "ชมพระอาทิตย์ตก",
  "sunrise": "ชมพระอาทิตย์ขึ้น",
  "boat tour": "ล่องเรือเที่ยวชม",
  "cruise": "ล่องเรือสำราญ",
};

export const DICTIONARY_TH_TO_EN: Record<string, string> = {
  "โรงแรม": "Hotel",
  "รีสอร์ท": "Resort",
  "โฮสเทล": "Hostel",
  "เกสต์เฮาส์": "Guesthouse",
  "ที่พัก": "Accommodation",
  "เช็คอิน": "Check in",
  "เช็คเอาท์": "Check out",
  "วัด": "Wat (Temple)",
  "ศาลเจ้า": "Shrine",
  "พระราชวัง": "Palace",
  "พิพิธภัณฑ์": "Museum",
  "อุทยานแห่งชาติ": "National Park",
  "สวนสาธารณะ": "Public Park",
  "หาด": "Beach",
  "ชายหาด": "Beach",
  "เกาะ": "Island",
  "น้ำตก": "Waterfall",
  "ภูเขา": "Mountain",
  "จุดชมวิว": "Viewpoint",
  "สกายวอล์ก": "Skywalk",
  "ตลาดนัดกลางคืน": "Night Market",
  "ตลาดโต้รุ่ง": "Night Market",
  "ตลาดน้ำ": "Floating Market",
  "ตลาด": "Market",
  "ถนนคนเดิน": "Walking Street",
  "ห้างสรรพสินค้า": "Shopping Mall",
  "ศูนย์การค้า": "Shopping Mall",
  "ร้านอาหาร": "Restaurant",
  "ร้านกาแฟ": "Cafe",
  "คาเฟ่": "Cafe",
  "สปา": "Spa",
  "สวนสนุก": "Theme Park",
  "สวนน้ำ": "Water Park",
  "พิพิธภัณฑ์สัตว์น้ำ": "Aquarium",
  "สวนสัตว์": "Zoo",
};

// In-memory translation cache to avoid repeated translations
const memoryTranslationCache = new Map<string, string>();

/**
 * Checks if a string contains Thai characters
 */
export function hasThaiScript(text?: string | null): boolean {
  if (!text) return false;
  return /[\u0E00-\u0E7F]/.test(text);
}

/**
 * Normalizes string for dictionary lookup
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Synchronous dictionary-based translator for immediate UI rendering.
 * Translates known keywords, phrases, hotel check-in/out patterns, and categories.
 */
export function translateTextSync(text: string, targetLang: "th" | "en"): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) {
    return memoryTranslationCache.get(cacheKey)!;
  }

  // Already in target script check:
  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai) return trimmed;
  if (targetLang === "en" && !isThai) return trimmed;

  let result = trimmed;

  if (targetLang === "th") {
    // 1. Direct dictionary match
    const lower = normalizeKey(trimmed);
    if (DICTIONARY_EN_TO_TH[lower]) {
      result = DICTIONARY_EN_TO_TH[lower];
    }
    // 2. Hotel Check-in / Check-out patterns
    else if (/^check\s*in:?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^check\s*in:?\s*(.*)$/i);
      const place = match?.[1] ? translateTextSync(match[1], "th") : "";
      result = place ? `เช็คอิน: ${place}` : "เช็คอินเข้าที่พัก";
    } else if (/^check\s*out:?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^check\s*out:?\s*(.*)$/i);
      const place = match?.[1] ? translateTextSync(match[1], "th") : "";
      result = place ? `เช็คเอาท์: ${place}` : "เช็คเอาท์จากที่พัก";
    }
    // 3. Common English prefixes translation
    else {
      let replaced = trimmed;
      replaced = replaced.replace(/\bHotel\b/gi, "โรงแรม");
      replaced = replaced.replace(/\bResort\b/gi, "รีสอร์ท");
      replaced = replaced.replace(/\bHostel\b/gi, "โฮสเทล");
      replaced = replaced.replace(/\bTemple\b/gi, "วัด");
      replaced = replaced.replace(/\bMuseum\b/gi, "พิพิธภัณฑ์");
      replaced = replaced.replace(/\bNight Market\b/gi, "ตลาดนัดกลางคืน");
      replaced = replaced.replace(/\bMarket\b/gi, "ตลาด");
      replaced = replaced.replace(/\bBeach\b/gi, "หาด");
      replaced = replaced.replace(/\bViewpoint\b/gi, "จุดชมวิว");
      replaced = replaced.replace(/\bSkywalk\b/gi, "สกายวอล์ก");
      result = replaced;
    }
  } else {
    // Target is English
    // 1. Direct dictionary match
    const lower = normalizeKey(trimmed);
    if (DICTIONARY_TH_TO_EN[lower]) {
      result = DICTIONARY_TH_TO_EN[lower];
    }
    // 2. Thai Check-in / Check-out patterns
    else if (/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      result = place ? `Check in: ${place}` : "Check in to hotel";
    } else if (/^(เช็คเอาท์|เช็คเอาท์จากที่พัก):?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^(เช็คเอาท์|เช็คเอาท์จากที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      result = place ? `Check out: ${place}` : "Check out from hotel";
    }
    // 3. Common Thai prefixes translation
    else {
      let replaced = trimmed;
      replaced = replaced.replace(/^โรงแรม\s*/, "Hotel ");
      replaced = replaced.replace(/^รีสอร์ท\s*/, "Resort ");
      replaced = replaced.replace(/^วัด\s*/, "Wat ");
      replaced = replaced.replace(/^ตลาดนัดกลางคืน\s*/, "Night Market ");
      replaced = replaced.replace(/^ตลาด\s*/, "Market ");
      replaced = replaced.replace(/^หาด\s*/, "Beach ");
      replaced = replaced.replace(/^จุดชมวิว\s*/, "Viewpoint ");
      result = replaced;
    }
  }

  memoryTranslationCache.set(cacheKey, result);
  return result;
}

/**
 * Asynchronous translation with offline dictionary fallback & fail-safe.
 */
export async function translateTextAsync(text: string, targetLang: "th" | "en"): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai) return trimmed;
  if (targetLang === "en" && !isThai) return trimmed;

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) {
    return memoryTranslationCache.get(cacheKey)!;
  }

  // Check localStorage if available
  try {
    const saved = localStorage.getItem(`trans_${cacheKey}`);
    if (saved) {
      memoryTranslationCache.set(cacheKey, saved);
      return saved;
    }
  } catch (e) {
    // Ignore storage errors
  }

  // Fast path: Try dictionary sync first
  const syncResult = translateTextSync(trimmed, targetLang);
  if (syncResult !== trimmed) {
    memoryTranslationCache.set(cacheKey, syncResult);
    return syncResult;
  }

  // Try Google Translate API (resilient with timeout)
  try {
    const sl = targetLang === "th" ? "en" : "th";
    const tl = targetLang;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const translated = data?.[0]?.[0]?.[0];
      if (typeof translated === "string" && translated.trim().length > 0) {
        const clean = translated.trim();
        memoryTranslationCache.set(cacheKey, clean);
        try {
          localStorage.setItem(`trans_${cacheKey}`, clean);
        } catch (e) {}
        return clean;
      }
    }
  } catch (err) {
    // Fail-safe: fallback to syncResult or original
  }

  return syncResult || trimmed;
}
