/**
 * Translator Service — Robust bilingual (Thai <-> English) dictionary,
 * script detection, and resilient translation cache.
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";

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
  "walking tour": "เดินเที่ยวชมเมือง",
  "street food tour": "ตระเวนชิมสตรีทฟู้ด",
  "cooking class": "คลาสเรียนทำอาหาร",
  "night tour": "ทัวร์ชมเมืองยามค่ำคืน",
  "souvenir shopping": "ช้อปปิ้งของฝาก",

  // Top Thailand & International Landmarks
  "the grand palace": "พระบรมมหาราชวัง",
  "wat phra kaew": "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
  "temple of the emerald buddha": "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
  "wat arun": "วัดอรุณราชวราราม",
  "temple of dawn": "วัดอรุณราชวราราม",
  "wat pho": "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)",
  "temple of the reclining buddha": "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)",
  "chatuchak weekend market": "ตลาดนัดจตุจักร",
  "chatuchak": "จตุจักร",
  "iconsiam": "ไอคอนสยาม",
  "siam paragon": "สยามพารากอน",
  "centralworld": "เซ็นทรัลเวิลด์",
  "mbk center": "เอ็มบีเค เซ็นเตอร์ (มาบุญครอง)",
  "terminal 21": "เทอร์มินอล 21",
  "asiatique": "เอเชียทีค",
  "asiatique the riverfront": "เอเชียทีค เดอะ ริเวอร์ฟรอนต์",
  "khao san road": "ถนนข้าวสาร",
  "khaosan road": "ถนนข้าวสาร",
  "jim thompson house": "บ้านจิม ทอมป์สัน",
  "lumphini park": "สวนลุมพินี",
  "benjakitti park": "สวนเบญจกิติ",
  "benjakitti forest park": "สวนเบญจกิติ",
  "yaowarat": "เยาวราช (ไชน่าทาวน์)",
  "yaowarat road": "ถนนเยาวราช",
  "chinatown": "เยาวราช (ไชน่าทาวน์)",
  "wat traimit": "วัดไตรมิตรวิทยาราม",
  "wat saket": "วัดสระเกศ (ภูเขาทอง)",
  "golden mount": "ภูเขาทอง (วัดสระเกศ)",
  "mahanakhon skywalk": "มหานคร สกายวอล์ก",
  "king power mahanakhon": "คิง เพาเวอร์ มหานคร",
  "safari world": "ซาฟารีเวิลด์",
  "dream world": "ดรีมเวิลด์",
  "siam amazing park": "สยามอะเมซิ่งพาร์ค",
  "wat rong khun": "วัดร่องขุ่น",
  "white temple": "วัดร่องขุ่น",
  "wat rong suea ten": "วัดร่องเสือเต้น",
  "blue temple": "วัดร่องเสือเต้น",
  "doi suthep": "ดอยสุเทพ",
  "wat phra that doi suthep": "วัดพระธาตุดอยสุเทพ",
  "chiang mai night bazaar": "เชียงใหม่ไนท์บาซาร์",
  "tha phae gate": "ประตูท่าแพ",
  "thapae gate": "ประตูท่าแพ",
  "big buddha phuket": "พระใหญ่ภูเก็ต",
  "promthep cape": "แหลมพรหมเทพ",
  "patong beach": "หาดป่าตอง",
  "kata beach": "หาดกะตะ",
  "karon beach": "หาดกะรน",
  "phi phi islands": "หมู่เกาะพีพี",
  "phi phi island": "เกาะพีพี",
  "maya bay": "อ่าวมาหยา",
  "james bond island": "เกาะเจมส์บอนด์ (เกาะเขาตะปู)",
  "railay beach": "หาดไร่เลย์",
  "erawan waterfall": "น้ำตกเอราวัณ",
  "bridge over the river kwai": "สะพานข้ามแม่น้ำแคว",
  "ayutthaya historical park": "อุทยานประวัติศาสตร์พระนครศรีอยุธยา",
  "wat mahathat": "วัดมหาธาตุ",
  "wat chaiwatthanaram": "วัดไชยวัฒนาราม",
  "wat yai chai mongkhon": "วัดใหญ่ชัยมงคล",
  "nong nooch tropical garden": "สวนนงนุช",
  "sanctuary of truth": "ปราสาทสัจธรรม",
  "pattaya floating market": "ตลาดน้ำ 4 ภาค พัทยา",
  "damnoen saduak floating market": "ตลาดน้ำดำเนินสะดวก",
  "amphawa floating market": "ตลาดน้ำอัมพวา",
  "jodd fairs": "จ๊อดแฟร์",
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

  // Top Thailand Attractions in English
  "พระบรมมหาราชวัง": "The Grand Palace",
  "วัดพระแก้ว": "Wat Phra Kaew (Temple of the Emerald Buddha)",
  "วัดพระศรีรัตนศาสดาราม": "Wat Phra Si Rattana Satsadaram (Wat Phra Kaew)",
  "วัดอรุณ": "Wat Arun (Temple of Dawn)",
  "วัดอรุณราชวราราม": "Wat Arun (Temple of Dawn)",
  "วัดโพธิ์": "Wat Pho (Temple of the Reclining Buddha)",
  "วัดพระเชตุพนวิมลมังคลาราม": "Wat Phra Chetuphon (Wat Pho)",
  "ตลาดนัดจตุจักร": "Chatuchak Weekend Market",
  "จตุจักร": "Chatuchak",
  "ไอคอนสยาม": "ICONSIAM",
  "สยามพารากอน": "Siam Paragon",
  "เซ็นทรัลเวิลด์": "CentralWorld",
  "มาบุญครอง": "MBK Center",
  "เอ็มบีเค เซ็นเตอร์": "MBK Center",
  "เทอร์มินอล 21": "Terminal 21",
  "เอเชียทีค": "Asiatique The Riverfront",
  "เอเชียทีค เดอะ ริเวอร์ฟรอนต์": "Asiatique The Riverfront",
  "ถนนข้าวสาร": "Khao San Road",
  "บ้านจิม ทอมป์สัน": "Jim Thompson House",
  "สวนลุมพินี": "Lumphini Park",
  "สวนเบญจกิติ": "Benjakitti Forest Park",
  "เยาวราช": "Yaowarat (Chinatown)",
  "ถนนเยาวราช": "Yaowarat Road",
  "วัดไตรมิตร": "Wat Traimit",
  "วัดไตรมิตรวิทยาราม": "Wat Traimit",
  "วัดสระเกศ": "Wat Saket (Golden Mount)",
  "ภูเขาทอง": "Golden Mount (Wat Saket)",
  "มหานคร สกายวอล์ก": "Mahanakhon SkyWalk",
  "ซาฟารีเวิลด์": "Safari World",
  "ดรีมเวิลด์": "Dream World",
  "สยามอะเมซิ่งพาร์ค": "Siam Amazing Park",
  "วัดร่องขุ่น": "Wat Rong Khun (White Temple)",
  "วัดร่องเสือเต้น": "Wat Rong Suea Ten (Blue Temple)",
  "ดอยสุเทพ": "Doi Suthep",
  "วัดพระธาตุดอยสุเทพ": "Wat Phra That Doi Suthep",
  "เชียงใหม่ไนท์บาซาร์": "Chiang Mai Night Bazaar",
  "ประตูท่าแพ": "Tha Phae Gate",
  "พระใหญ่ภูเก็ต": "Big Buddha Phuket",
  "แหลมพรหมเทพ": "Promthep Cape",
  "หาดป่าตอง": "Patong Beach",
  "หาดกะตะ": "Kata Beach",
  "หาดกะรน": "Karon Beach",
  "เกาะพีพี": "Phi Phi Islands",
  "หมู่เกาะพีพี": "Phi Phi Islands",
  "อ่าวมาหยา": "Maya Bay",
  "เกาะเจมส์บอนด์": "James Bond Island",
  "หาดไร่เลย์": "Railay Beach",
  "น้ำตกเอราวัณ": "Erawan Waterfall",
  "สะพานข้ามแม่น้ำแคว": "Bridge over the River Kwai",
  "อุทยานประวัติศาสตร์พระนครศรีอยุธยา": "Ayutthaya Historical Park",
  "วัดมหาธาตุ": "Wat Mahathat",
  "วัดไชยวัฒนาราม": "Wat Chaiwatthanaram",
  "วัดใหญ่ชัยมงคล": "Wat Yai Chai Mongkhon",
  "สวนนงนุช": "Nong Nooch Tropical Garden",
  "ปราสาทสัจธรรม": "Sanctuary of Truth",
  "ตลาดน้ำ 4 ภาค พัทยา": "Pattaya Floating Market",
  "ตลาดน้ำดำเนินสะดวก": "Damnoen Saduak Floating Market",
  "ตลาดน้ำอัมพวา": "Amphawa Floating Market",
  "จ๊อดแฟร์": "Jodd Fairs",
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
 * Detects and extracts dual-language (Thai and English) components from compound strings.
 * Examples:
 * - "วัดพระแก้ว (Wat Phra Kaew)" -> { th: "วัดพระแก้ว", en: "Wat Phra Kaew" }
 * - "Wat Arun (วัดอรุณราชวราราม)" -> { th: "วัดอรุณราชวราราม", en: "Wat Arun" }
 * - "ตลาดน้ำดำเนินสะดวก / Damnoen Saduak Floating Market" -> { th: "ตลาดน้ำดำเนินสะดวก", en: "Damnoen Saduak Floating Market" }
 * - "Grand Palace - พระบรมมหาราชวัง" -> { th: "พระบรมมหาราชวัง", en: "Grand Palace" }
 */
export function extractBilingualText(text?: string | null): { th?: string; en?: string } | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const hasThai = hasThaiScript(trimmed);
  const hasLatin = /[a-zA-Z]/.test(trimmed);

  // If text does not contain both Thai and Latin scripts, no compound splitting is possible
  if (!hasThai || !hasLatin) return null;

  // 1. Parentheses format: "PartA (PartB)"
  const parenMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const partA = parenMatch[1].trim();
    const partB = parenMatch[2].trim();
    const aThai = hasThaiScript(partA);
    const bThai = hasThaiScript(partB);
    const aLatin = /[a-zA-Z]/.test(partA);
    const bLatin = /[a-zA-Z]/.test(partB);

    if (aThai && !aLatin && bLatin) {
      return { th: partA, en: partB };
    }
    if (aLatin && !aThai && bThai) {
      return { th: partB, en: partA };
    }
  }

  // 2. Delimiter formats: " / ", " - ", " | ", " • ", ", "
  const delimiters = [" / ", " - ", " | ", " • ", ", "];
  for (const delim of delimiters) {
    if (trimmed.includes(delim)) {
      const parts = trimmed.split(delim);
      if (parts.length === 2) {
        const partA = parts[0].trim();
        const partB = parts[1].trim();
        const aThai = hasThaiScript(partA);
        const bThai = hasThaiScript(partB);
        const aLatin = /[a-zA-Z]/.test(partA);
        const bLatin = /[a-zA-Z]/.test(partB);

        if (aThai && !aLatin && bLatin) {
          return { th: partA, en: partB };
        }
        if (aLatin && !aThai && bThai) {
          return { th: partB, en: partA };
        }
      }
    }
  }

  return null;
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

  // 0. Dual language compound string check (e.g. "วัดพระแก้ว (Wat Phra Kaew)")
  const bilingual = extractBilingualText(trimmed);
  if (bilingual) {
    if (targetLang === "th" && bilingual.th) {
      memoryTranslationCache.set(cacheKey, bilingual.th);
      return bilingual.th;
    }
    if (targetLang === "en" && bilingual.en) {
      memoryTranslationCache.set(cacheKey, bilingual.en);
      return bilingual.en;
    }
  }

  // Already in target script check (purely in target script):
  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai && !/[a-zA-Z]/.test(trimmed)) return trimmed;
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
    // 3. Common English prefixes translation (only when matching at start of string)
    else if (/^(Hotel|Resort|Hostel|Temple|Museum|Night Market|Market|Beach|Viewpoint|Skywalk)\s+/i.test(trimmed)) {
      let replaced = trimmed;
      replaced = replaced.replace(/^Hotel\s+/i, "โรงแรม ");
      replaced = replaced.replace(/^Resort\s+/i, "รีสอร์ท ");
      replaced = replaced.replace(/^Hostel\s+/i, "โฮสเทล ");
      replaced = replaced.replace(/^Temple\s+(?:of\s+)?/i, "วัด ");
      replaced = replaced.replace(/^Museum\s+(?:of\s+)?/i, "พิพิธภัณฑ์ ");
      replaced = replaced.replace(/^Night\s+Market\s+/i, "ตลาดนัดกลางคืน ");
      replaced = replaced.replace(/^Market\s+/i, "ตลาด ");
      replaced = replaced.replace(/^Beach\s+/i, "หาด ");
      replaced = replaced.replace(/^Viewpoint\s+/i, "จุดชมวิว ");
      replaced = replaced.replace(/^Skywalk\s+/i, "สกายวอล์ก ");
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
    } else if (/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      result = place ? `Check out: ${place}` : "Check out from hotel";
    }
    // 3. Common Thai prefixes translation (only at start of string)
    else if (/^(โรงแรม|รีสอร์ท|วัด|ตลาดนัดกลางคืน|ตลาด|หาด|จุดชมวิว)\s*/.test(trimmed)) {
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
 * AI-powered translation for individual text (place name or description).
 * Uses the existing backend /ai endpoint with resilient fail-safe and caching.
 */
export async function translateWithAI(text: string, targetLang: "th" | "en"): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai && !/[a-zA-Z]/.test(trimmed)) return trimmed;
  if (targetLang === "en" && !isThai) return trimmed;

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) {
    return memoryTranslationCache.get(cacheKey)!;
  }
  try {
    const saved = localStorage.getItem(`trans_${cacheKey}`);
    if (saved) {
      memoryTranslationCache.set(cacheKey, saved);
      return saved;
    }
  } catch {}

  const targetLangName = targetLang === "th" ? "Thai (ภาษาไทย)" : "English";
  const prompt = `You are a professional travel translator. Translate this travel place name or itinerary activity description into natural, high quality ${targetLangName}.
Do not add explanations or notes. Return only a valid JSON object matching:
{"translation": "translated text here"}

Text:
${trimmed}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BACKEND_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        expect_json: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.text || "";
      let translated = "";
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          translated = parsed.translation || "";
        }
      } catch {
        translated = rawText.replace(/[\{\}\"]/g, "").trim();
      }

      if (translated && translated.trim().length > 0) {
        const clean = translated.trim();
        memoryTranslationCache.set(cacheKey, clean);
        try {
          localStorage.setItem(`trans_${cacheKey}`, clean);
        } catch {}
        return clean;
      }
    }
  } catch (err) {
    console.warn("[translatorService] AI translation fallback:", err);
  }

  // Fallback to sync translation
  return translateTextSync(trimmed, targetLang);
}

/**
 * Batch translate multiple items (titles or descriptions) in a single AI round trip.
 */
export async function batchTranslateWithAI(
  items: Array<{ id: string; text: string }>,
  targetLang: "th" | "en"
): Promise<Record<string, string>> {
  if (!items || items.length === 0) return {};

  const results: Record<string, string> = {};
  const toTranslate: Array<{ id: string; text: string }> = [];

  for (const item of items) {
    const trimmed = (item.text || "").trim();
    if (!trimmed) continue;
    const isThai = hasThaiScript(trimmed);
    if ((targetLang === "th" && isThai && !/[a-zA-Z]/.test(trimmed)) || (targetLang === "en" && !isThai)) {
      results[item.id] = trimmed;
      continue;
    }
    const cacheKey = `${targetLang}:${trimmed}`;
    if (memoryTranslationCache.has(cacheKey)) {
      results[item.id] = memoryTranslationCache.get(cacheKey)!;
      continue;
    }
    try {
      const saved = localStorage.getItem(`trans_${cacheKey}`);
      if (saved) {
        memoryTranslationCache.set(cacheKey, saved);
        results[item.id] = saved;
        continue;
      }
    } catch {}

    toTranslate.push({ id: item.id, text: trimmed });
  }

  if (toTranslate.length === 0) {
    return results;
  }

  const targetLangName = targetLang === "th" ? "Thai (ภาษาไทย)" : "English";
  const prompt = `You are a professional travel translator. Translate the following travel place names and activity descriptions into natural, polished ${targetLangName}.
Preserve travel clarity and context.
Respond ONLY with a valid JSON object matching this schema:
{
  "translations": {
    "<id>": "translated text"
  }
}

Items to translate:
${JSON.stringify(toTranslate, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${BACKEND_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        expect_json: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const transMap = parsed.translations || {};
        for (const it of toTranslate) {
          if (transMap[it.id] && typeof transMap[it.id] === "string") {
            const clean = transMap[it.id].trim();
            results[it.id] = clean;
            const cacheKey = `${targetLang}:${it.text}`;
            memoryTranslationCache.set(cacheKey, clean);
            try {
              localStorage.setItem(`trans_${cacheKey}`, clean);
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn("[translatorService] Batch AI translation failed, falling back to sync:", err);
  }

  // Fill in any remaining items with sync translation fallback
  for (const it of toTranslate) {
    if (!results[it.id]) {
      const fb = translateTextSync(it.text, targetLang);
      results[it.id] = fb;
    }
  }

  return results;
}

/**
 * Asynchronous translation with AI & offline dictionary fallback.
 */
export async function translateTextAsync(text: string, targetLang: "th" | "en"): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai && !/[a-zA-Z]/.test(trimmed)) return trimmed;
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
  } catch (e) {}

  // Fast path: Exact dictionary sync first
  const lower = normalizeKey(trimmed);
  if (targetLang === "th" && DICTIONARY_EN_TO_TH[lower]) {
    const res = DICTIONARY_EN_TO_TH[lower];
    memoryTranslationCache.set(cacheKey, res);
    return res;
  }
  if (targetLang === "en" && DICTIONARY_TH_TO_EN[lower]) {
    const res = DICTIONARY_TH_TO_EN[lower];
    memoryTranslationCache.set(cacheKey, res);
    return res;
  }

  // Primary: Use AI translation
  return await translateWithAI(trimmed, targetLang);
}
