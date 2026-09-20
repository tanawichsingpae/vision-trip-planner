import React, { createContext, useContext, useState, useCallback } from "react";
import {
  hasThaiScript,
  DICTIONARY_EN_TO_TH,
  DICTIONARY_TH_TO_EN,
  extractBilingualText,
  translateTextSync,
  translateTextAsync,
} from "@/services/translatorService";

export type Language = "th" | "en";

export interface LocalizablePlace {
  title_th?: string;
  title_en?: string;
  name_th?: string;
  name_en?: string;
  english_name?: string;
  title?: string;
  name?: string;
  place_th?: string;
  place_en?: string;
  place?: string;
}

export interface LocalizableDescription {
  description_th?: string;
  description_en?: string;
  description?: string;
}

export const UI_STRINGS = {
  th: {
    myTrips: "ทริปของฉัน",
    saveTrip: "บันทึกทริป",
    newTrip: "สร้างทริปใหม่",
    step1: "อัปโหลดภาพ",
    step2: "สถานที่ท่องเที่ยว",
    step3: "ความต้องการเดินทาง",
    step4: "แผนการเดินทาง",
    continue: "ดำเนินการต่อ",
    back: "ย้อนกลับ",
    uploadNewPhotos: "อัปโหลดภาพใหม่",
    exportPdf: "ส่งออก PDF",
    share: "แชร์ทริป",
    reorder: "จัดระเบียบเส้นทางด้วย AI",
    preferences: "ความต้องการเดินทาง",
    suggestedPlaces: "สถานที่แนะนำเพิ่มเติม",
    stays: "ที่พัก & โรงแรม",
    flights: "เที่ยวบิน & การเดินทาง",
    weather: "สภาพอากาศ",
    airQuality: "คุณภาพอากาศ",
    itineraryTitle: "แผนการท่องเที่ยวของคุณ",
    daysCount: "วัน",
    dayPrefix: "วันที่",
    identifiedLocations: "สถานที่ท่องเที่ยวที่ตรวจพบ",
    reloadMap: "โหลดแผนที่ใหม่",
    aiReview: "AI Review & จัดระเบียบ",
    cancel: "ยกเลิก",
    confirm: "ยืนยัน",
    generatePlan: "สร้างแผนการท่องเที่ยว ✨",
    dropToAdd: "วางลงในวันนี้เพื่อเพิ่ม",

    // Interactive Map
    interactiveMap: "แผนที่แบบโต้ตอบ",
    mapVisualRoute: "เส้นทางการเดินทางและตำแหน่งสถานที่ขับเคลื่อนโดย Mapbox & OpenStreetMap",
    allDays: "ทุกวัน",
    map: "แผนที่",
    satellite: "ดาวเทียม 🛰️",
    legend: "สัญลักษณ์สี:",
    hotelStay: "🏨 ที่พัก / โรงแรม",
    directionsGoogleMaps: "🚗 นำทาง (Google Maps)",
    searchGoogleMaps: "📍 ค้นหา",
    searchOnGoogleMaps: "ค้นหาบน Google Maps",
    dayStop: "จุดที่",

    // Itinerary Overview
    itineraryOverview: "ภาพรวมแผนการเดินทาง",
    totalSpots: "สถานที่ท่องเที่ยวทั้งหมด",
    spotsCount: "แห่ง",
    activitiesCount: "กิจกรรม",

    // Discovery, Accommodations & Suggestions
    newSuggestions: "แนะนำสถานที่ใหม่",
    generating: "กำลังสร้าง...",
    findingAccommodations: "กำลังค้นหาที่พัก...",
    findAccommodations: "ค้นหาที่พักรอบเมืองปลายทาง",
    moreOptions: "ตัวเลือกเพิ่มเติม",
    searchHotelManually: "ค้นหาที่พักเอง",
    hideSearchPanel: "ซ่อนกล่องค้นหา",
    hideSearch: "ซ่อนค้นหา",
    searchChangeHotel: "ค้นหา / เปลี่ยนที่พัก",
    hideRecommendations: "ซ่อนคำแนะนำ",
    moreRecommendations: "ดูคำแนะนำที่พักอื่น",
    confirmAdd: "ยืนยันเพิ่ม",
    confirmAddHotel: "ยืนยันเพิ่มที่พัก",
    selectDay: "เลือกวัน",
    selectTime: "เลือกเวลา",
    checkInDayTime: "วันและเวลา Check-in",
    checkOutDayTime: "วันและเวลา Check-out",
    clear: "ล้างข้อมูล",
    addHotelToItinerary: "เพิ่มที่พักลงตารางเดินทาง",
    addToItinerary: "เพิ่มลงในตารางท่องเที่ยว",
  },
  en: {
    myTrips: "My Trips",
    saveTrip: "Save Trip",
    newTrip: "New Trip",
    step1: "Photos",
    step2: "Locations",
    step3: "Preferences",
    step4: "Itinerary",
    continue: "Continue",
    back: "Back",
    uploadNewPhotos: "Upload new photos",
    exportPdf: "Export PDF",
    share: "Share Trip",
    reorder: "AI Route Optimizer",
    preferences: "Trip Preferences",
    suggestedPlaces: "Suggested Places",
    stays: "Stays & Hotels",
    flights: "Flights & Logistics",
    weather: "Weather",
    airQuality: "Air Quality",
    itineraryTitle: "Your Travel Itinerary",
    daysCount: "days",
    dayPrefix: "Day",
    identifiedLocations: "Identified Locations",
    reloadMap: "Reload Map",
    aiReview: "AI Review & Auto-Optimize",
    cancel: "Cancel",
    confirm: "Confirm",
    generatePlan: "Generate Travel Itinerary ✨",
    dropToAdd: "Drop into a day to add",

    // Interactive Map
    interactiveMap: "Interactive Map",
    mapVisualRoute: "Visual route & location mapping powered by Mapbox & OpenStreetMap",
    allDays: "All Days",
    map: "Map",
    satellite: "Satellite 🛰️",
    legend: "Legend:",
    hotelStay: "🏨 Hotel Stay",
    directionsGoogleMaps: "🚗 Directions (Google Maps)",
    searchGoogleMaps: "📍 Search",
    searchOnGoogleMaps: "Search on Google Maps",
    dayStop: "Stop",

    // Itinerary Overview
    itineraryOverview: "Itinerary Overview",
    totalSpots: "total spots",
    spotsCount: "spots",
    activitiesCount: "activities",

    // Discovery, Accommodations & Suggestions
    newSuggestions: "New Suggestions",
    generating: "Generating…",
    findingAccommodations: "Finding accommodations...",
    findAccommodations: "Find accommodations",
    moreOptions: "More Options",
    searchHotelManually: "Search hotel manually",
    hideSearchPanel: "Hide Search Panel",
    hideSearch: "Hide Search",
    searchChangeHotel: "Search / Change Hotel",
    hideRecommendations: "Hide Recommendations",
    moreRecommendations: "More recommendations",
    confirmAdd: "Confirm Add",
    confirmAddHotel: "Confirm Add Hotel",
    selectDay: "Select Day",
    selectTime: "Select Time",
    checkInDayTime: "Check-in Day & Time",
    checkOutDayTime: "Check-out Day & Time",
    clear: "Clear",
    addHotelToItinerary: "Add Hotel to Itinerary",
    addToItinerary: "Add to Itinerary",
  },
};

export function getLocalizedPlace(
  item: LocalizablePlace | null | undefined,
  language: Language,
  onAsyncResolve?: () => void
): string {
  if (!item) return "";

  if (language === "th") {
    // 1. Explicit Thai fields (must have Thai script or bilingual th)
    const explicitTh = (item.title_th || item.name_th || item.place_th || "").trim();
    if (explicitTh) {
      const bilingual = extractBilingualText(explicitTh);
      if (bilingual?.th) return bilingual.th;
      if (hasThaiScript(explicitTh)) return explicitTh;
    }

    // 2. Check general title/name/place
    const rawCandidate = (item.title || item.name || item.place || "").trim();
    if (rawCandidate) {
      const bilingual = extractBilingualText(rawCandidate);
      if (bilingual?.th) return bilingual.th;

      // Hotel Check-in / Check-out patterns
      if (/^check\s*in:?\s*(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^check\s*in:?\s*(.*)$/i);
        const place = match?.[1]?.trim() || "";
        const placeTh = place ? (DICTIONARY_EN_TO_TH[place.toLowerCase()] || extractBilingualText(place)?.th || getLocalizedPlace({ title: place }, "th", onAsyncResolve) || place) : "";
        return placeTh ? `เช็คอิน: ${placeTh}` : "เช็คอินเข้าที่พัก";
      }
      if (/^check\s*out:?\s*(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^check\s*out:?\s*(.*)$/i);
        const place = match?.[1]?.trim() || "";
        const placeTh = place ? (DICTIONARY_EN_TO_TH[place.toLowerCase()] || extractBilingualText(place)?.th || getLocalizedPlace({ title: place }, "th", onAsyncResolve) || place) : "";
        return placeTh ? `เช็คเอาต์: ${placeTh}` : "เช็คเอาต์จากที่พัก";
      }

      // Check if already purely Thai
      if (hasThaiScript(rawCandidate) && !/[a-zA-Z]/.test(rawCandidate)) {
        return rawCandidate;
      }
      if (hasThaiScript(rawCandidate)) {
        return rawCandidate;
      }

      // Direct full dictionary match
      const lowerKey = rawCandidate.toLowerCase();
      if (DICTIONARY_EN_TO_TH[lowerKey]) {
        return DICTIONARY_EN_TO_TH[lowerKey];
      }

      // Synchronous translateTextSync
      const syncResult = translateTextSync(rawCandidate, "th");
      if (syncResult !== rawCandidate && hasThaiScript(syncResult)) {
        return syncResult;
      }

      // Check cache
      const cached = typeof window !== "undefined" ? localStorage.getItem(`trans_th:${rawCandidate}`) : null;
      if (cached && hasThaiScript(cached)) return cached;

      // Trigger async AI translation
      if (onAsyncResolve && !hasThaiScript(rawCandidate)) {
        translateTextAsync(rawCandidate, "th").then((res) => {
          if (res && res !== rawCandidate) onAsyncResolve();
        }).catch(() => {});
      }
    }

    // 3. Fallback
    const sourceText = (hasThaiScript(explicitTh) ? explicitTh : "") || rawCandidate || item.english_name || item.title_en || item.name_en || item.place_en || "";
    const cachedSource = typeof window !== "undefined" && sourceText ? localStorage.getItem(`trans_th:${sourceText}`) : null;
    if (cachedSource && hasThaiScript(cachedSource)) return cachedSource;

    return (hasThaiScript(explicitTh) ? explicitTh : "") || (hasThaiScript(rawCandidate) ? rawCandidate : "") || sourceText;
  }

  // English
  // 1. Explicit English fields (must have Latin/English letters)
  const explicitEn = (item.title_en || item.name_en || item.place_en || item.english_name || "").trim();
  if (explicitEn) {
    const bilingual = extractBilingualText(explicitEn);
    if (bilingual?.en) return bilingual.en;
    if (/[a-zA-Z]/.test(explicitEn) && !hasThaiScript(explicitEn)) return explicitEn;
    if (/[a-zA-Z]/.test(explicitEn)) return explicitEn;
  }

  // 2. Check general title/name/place
  const rawCandidate = (item.title || item.name || item.place || "").trim();
  if (rawCandidate) {
    const bilingual = extractBilingualText(rawCandidate);
    if (bilingual?.en) return bilingual.en;

    // Thai Check-in / Check-out patterns
    if (/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i);
      const place = match?.[2]?.trim() || "";
      const placeEn = place ? (DICTIONARY_TH_TO_EN[place.toLowerCase()] || extractBilingualText(place)?.en || getLocalizedPlace({ title: place }, "en", onAsyncResolve) || place) : "";
      return placeEn ? `Check in: ${placeEn}` : "Check in to hotel";
    }
    if (/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i);
      const place = match?.[2]?.trim() || "";
      const placeEn = place ? (DICTIONARY_TH_TO_EN[place.toLowerCase()] || extractBilingualText(place)?.en || getLocalizedPlace({ title: place }, "en", onAsyncResolve) || place) : "";
      return placeEn ? `Check out: ${placeEn}` : "Check out from hotel";
    }
    if (/^check\s*in:?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^check\s*in:?\s*(.*)$/i);
      const place = match?.[1]?.trim() || "";
      return place ? `Check in: ${place}` : "Check in to hotel";
    }
    if (/^check\s*out:?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^check\s*out:?\s*(.*)$/i);
      const place = match?.[1]?.trim() || "";
      return place ? `Check out: ${place}` : "Check out from hotel";
    }

    // Check if already purely Latin/English
    if (!hasThaiScript(rawCandidate) && /[a-zA-Z]/.test(rawCandidate)) {
      return rawCandidate;
    }

    // Direct full dictionary match
    const lowerKey = rawCandidate.toLowerCase();
    if (DICTIONARY_TH_TO_EN[lowerKey]) {
      return DICTIONARY_TH_TO_EN[lowerKey];
    }

    // Synchronous translateTextSync
    const syncResult = translateTextSync(rawCandidate, "en");
    if (syncResult !== rawCandidate && !hasThaiScript(syncResult)) {
      return syncResult;
    }

    // Check cache
    const cached = typeof window !== "undefined" ? localStorage.getItem(`trans_en:${rawCandidate}`) : null;
    if (cached && !hasThaiScript(cached)) return cached;

    // Trigger async AI translation
    if (onAsyncResolve && hasThaiScript(rawCandidate)) {
      translateTextAsync(rawCandidate, "en").then((res) => {
        if (res && res !== rawCandidate) onAsyncResolve();
      }).catch(() => {});
    }
  }

  // 3. Fallback
  const sourceText = (/[a-zA-Z]/.test(explicitEn) ? explicitEn : "") || rawCandidate || item.title_th || item.name_th || item.place_th || "";
  const cachedSource = typeof window !== "undefined" && sourceText ? localStorage.getItem(`trans_en:${sourceText}`) : null;
  if (cachedSource && !hasThaiScript(cachedSource)) return cachedSource;

  return (/[a-zA-Z]/.test(explicitEn) ? explicitEn : "") || (!hasThaiScript(rawCandidate) && rawCandidate ? rawCandidate : "") || sourceText;
}

export function getLocalizedDescription(
  item: LocalizableDescription | null | undefined,
  language: Language,
  onAsyncResolve?: () => void
): string {
  if (!item) return "";

  if (language === "th") {
    // 1. Explicit Thai description (must contain Thai script)
    const explicitTh = (item.description_th || "").trim();
    if (explicitTh) {
      const bilingual = extractBilingualText(explicitTh);
      if (bilingual?.th) return bilingual.th;
      if (hasThaiScript(explicitTh)) return explicitTh;
    }

    // 2. Check general description if it is already Thai
    const raw = (item.description || "").trim();
    if (raw) {
      const bilingual = extractBilingualText(raw);
      if (bilingual?.th) return bilingual.th;

      if (hasThaiScript(raw) && !/[a-zA-Z]/.test(raw)) {
        return raw;
      }
      if (hasThaiScript(raw)) {
        return raw;
      }
    }

    // 3. Needs translation from English -> Thai
    const textToTranslate = raw || explicitTh || (item.description_en || "").trim();
    if (textToTranslate) {
      // Check cache
      const cached = typeof window !== "undefined" ? localStorage.getItem(`trans_th:${textToTranslate}`) : null;
      if (cached && hasThaiScript(cached)) return cached;

      // Exact dictionary / sync
      const syncResult = translateTextSync(textToTranslate, "th");
      if (syncResult !== textToTranslate && hasThaiScript(syncResult)) {
        return syncResult;
      }

      // Trigger AI translation asynchronously
      if (onAsyncResolve && !hasThaiScript(textToTranslate)) {
        translateTextAsync(textToTranslate, "th").then((res) => {
          if (res && res !== textToTranslate) onAsyncResolve();
        }).catch(() => {});
      }
    }

    return (hasThaiScript(explicitTh) ? explicitTh : "") || (hasThaiScript(raw) ? raw : "") || textToTranslate;
  }

  // English
  // 1. Explicit English description (must contain English letters)
  const explicitEn = (item.description_en || "").trim();
  if (explicitEn) {
    const bilingual = extractBilingualText(explicitEn);
    if (bilingual?.en) return bilingual.en;
    if (/[a-zA-Z]/.test(explicitEn) && !hasThaiScript(explicitEn)) return explicitEn;
    if (/[a-zA-Z]/.test(explicitEn)) return explicitEn;
  }

  // 2. Check general description if already English
  const raw = (item.description || "").trim();
  if (raw) {
    const bilingual = extractBilingualText(raw);
    if (bilingual?.en) return bilingual.en;

    if (!hasThaiScript(raw) && /[a-zA-Z]/.test(raw)) {
      return raw;
    }
  }

  // 3. Needs translation from Thai -> English
  const textToTranslate = raw || (item.description_th || "").trim() || explicitEn;
  if (textToTranslate) {
    // Check cache
    const cached = typeof window !== "undefined" ? localStorage.getItem(`trans_en:${textToTranslate}`) : null;
    if (cached && !hasThaiScript(cached)) return cached;

    // Exact dictionary / sync
    const syncResult = translateTextSync(textToTranslate, "en");
    if (syncResult !== textToTranslate && !hasThaiScript(syncResult)) {
      return syncResult;
    }

    // Trigger AI translation asynchronously
    if (onAsyncResolve && hasThaiScript(textToTranslate)) {
      translateTextAsync(textToTranslate, "en").then((res) => {
        if (res && res !== textToTranslate) onAsyncResolve();
      }).catch(() => {});
    }
  }

  return (!hasThaiScript(explicitEn) && explicitEn ? explicitEn : "") || (!hasThaiScript(raw) && raw ? raw : "") || textToTranslate;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isThai: boolean;
  t: (keyOrTh: string, enText?: string) => string;
  locPlace: (item: LocalizablePlace | null | undefined) => string;
  locDesc: (item: LocalizableDescription | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("pixinerary_language") : null;
    return saved === "en" || saved === "th" ? saved : "th";
  });
  const [, setAsyncVersion] = useState(0);

  const triggerAsyncUpdate = useCallback(() => {
    setAsyncVersion((v) => v + 1);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("pixinerary_language", lang);
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === "th" ? "en" : "th";
    setLanguageState(nextLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("pixinerary_language", nextLang);
    }
  };

  const isThai = language === "th";

  const t = (keyOrTh: string, enText?: string): string => {
    if (enText !== undefined) {
      return isThai ? keyOrTh : enText;
    }
    const strMap = UI_STRINGS[language] as Record<string, string>;
    if (strMap && strMap[keyOrTh]) {
      return strMap[keyOrTh];
    }
    return keyOrTh;
  };

  const locPlace = useCallback(
    (item: LocalizablePlace | null | undefined): string => {
      return getLocalizedPlace(item, language, triggerAsyncUpdate);
    },
    [language, triggerAsyncUpdate]
  );

  const locDesc = useCallback(
    (item: LocalizableDescription | null | undefined): string => {
      return getLocalizedDescription(item, language, triggerAsyncUpdate);
    },
    [language, triggerAsyncUpdate]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        isThai,
        t,
        locPlace,
        locDesc,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
