import React, { createContext, useContext, useState } from "react";
import { hasThaiScript, DICTIONARY_EN_TO_TH, DICTIONARY_TH_TO_EN } from "@/services/translatorService";

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
  language: Language
): string {
  if (!item) return "";

  if (language === "th") {
    // 1. Explicit Thai fields
    const explicitTh = item.title_th || item.name_th || item.place_th;
    if (explicitTh && explicitTh.trim()) return explicitTh.trim();

    // 2. Check if general title/name/place is already Thai
    const rawCandidate = item.title || item.name || item.place || "";
    if (rawCandidate && hasThaiScript(rawCandidate)) {
      return rawCandidate.trim();
    }

    // 3. Direct full dictionary match
    const lowerKey = rawCandidate.trim().toLowerCase();
    if (DICTIONARY_EN_TO_TH[lowerKey]) {
      return DICTIONARY_EN_TO_TH[lowerKey];
    }

    // 4. Hotel Check-in / Check-out patterns
    if (/^check\s*in:?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^check\s*in:?\s*(.*)$/i);
      const place = match?.[1]?.trim() || "";
      return place ? `เช็คอิน: ${place}` : "เช็คอินเข้าที่พัก";
    }
    if (/^check\s*out:?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^check\s*out:?\s*(.*)$/i);
      const place = match?.[1]?.trim() || "";
      return place ? `เช็คเอาต์: ${place}` : "เช็คเอาต์จากที่พัก";
    }

    // 5. Fallback cleanly to raw or English fields
    return rawCandidate.trim() || item.english_name || item.title_en || item.name_en || item.place_en || "";
  }

  // English
  // 1. Explicit English fields
  const explicitEn = item.title_en || item.name_en || item.place_en || item.english_name;
  if (explicitEn && explicitEn.trim()) return explicitEn.trim();

  // 2. Check if general title/name/place is already Latin/English
  const rawCandidate = item.title || item.name || item.place || "";
  if (rawCandidate && !hasThaiScript(rawCandidate)) {
    return rawCandidate.trim();
  }

  // 3. Direct full dictionary match
  const lowerKey = rawCandidate.trim().toLowerCase();
  if (DICTIONARY_TH_TO_EN[lowerKey]) {
    return DICTIONARY_TH_TO_EN[lowerKey];
  }

  // 4. Thai Check-in / Check-out patterns
  if (/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i.test(rawCandidate)) {
    const match = rawCandidate.match(/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i);
    const place = match?.[2]?.trim() || "";
    return place ? `Check in: ${place}` : "Check in to hotel";
  }
  if (/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i.test(rawCandidate)) {
    const match = rawCandidate.match(/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i);
    const place = match?.[2]?.trim() || "";
    return place ? `Check out: ${place}` : "Check out from hotel";
  }

  // 5. Fallback cleanly
  return rawCandidate.trim() || item.title_th || item.name_th || item.place_th || "";
}

export function getLocalizedDescription(
  item: LocalizableDescription | null | undefined,
  language: Language
): string {
  if (!item) return "";

  if (language === "th") {
    if (item.description_th && item.description_th.trim()) {
      return item.description_th.trim();
    }
    const raw = item.description || "";
    if (raw && hasThaiScript(raw)) {
      return raw.trim();
    }
    const lowerKey = raw.trim().toLowerCase();
    if (DICTIONARY_EN_TO_TH[lowerKey]) {
      return DICTIONARY_EN_TO_TH[lowerKey];
    }
    return raw.trim() || item.description_en || "";
  }

  // English
  if (item.description_en && item.description_en.trim()) {
    return item.description_en.trim();
  }
  const raw = item.description || "";
  if (raw && !hasThaiScript(raw)) {
    return raw.trim();
  }
  const lowerKey = raw.trim().toLowerCase();
  if (DICTIONARY_TH_TO_EN[lowerKey]) {
    return DICTIONARY_TH_TO_EN[lowerKey];
  }
  return raw.trim() || item.description_th || "";
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
    const saved = localStorage.getItem("pixinerary_language");
    return saved === "en" || saved === "th" ? saved : "th";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("pixinerary_language", lang);
  };

  const toggleLanguage = () => {
    const nextLang = language === "th" ? "en" : "th";
    setLanguageState(nextLang);
    localStorage.setItem("pixinerary_language", nextLang);
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

  const locPlace = (item: LocalizablePlace | null | undefined): string => {
    return getLocalizedPlace(item, language);
  };

  const locDesc = (item: LocalizableDescription | null | undefined): string => {
    return getLocalizedDescription(item, language);
  };

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
