import React, { createContext, useContext, useState, useCallback } from "react";
import {
  hasThaiScript,
  hasLatinScript,
  hasCJKScript,
  hasHangulScript,
  isPureTargetScript,
  needsTranslation,
  DICTIONARY_EN_TO_TH,
  DICTIONARY_TH_TO_EN,
  DICTIONARY_CJK_TO_TH,
  DICTIONARY_CJK_TO_EN,
  extractBilingualText,
  translateTextSync,
  translateTextAsync,
  batchResolveBilingualPlacesAI,
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

export function stripMealLabels(text?: string | null): string {
  if (!text) return "";
  const mealParentheses = /\s*\((?:อาหารเย็น|อาหารกลางวัน|อาหารค่ำ|อาหารเช้า|อาหารบ่าย|อาหารว่าง|ของว่าง|อาหาร|มื้อเย็น|มื้อค่ำ|มื้อเที่ยง|มื้อกลางวัน|มื้อเช้า|มื้อดึก|กินข้าว|ทานอาหาร|lunch|dinner|breakfast|brunch|supper|snack|dinner\s*\/\s*night|lunch\s*\/\s*midday|sunset|night\s*market|street\s*food|nightlife|drinks?|cafe|food|[^\)]*(?:อาหาร|มื้อ|dinner|lunch|breakfast)[^\)]*)\)\s*/gi;
  const mealBrackets = /\s*\[(?:อาหารเย็น|อาหารกลางวัน|อาหารค่ำ|อาหารเช้า|อาหารบ่าย|อาหารว่าง|ของว่าง|อาหาร|มื้อเย็น|มื้อค่ำ|มื้อเที่ยง|มื้อกลางวัน|มื้อเช้า|มื้อดึก|lunch|dinner|breakfast|brunch|supper|snack)\]\s*/gi;
  const mealDashes = /\s*[-–—]\s*(?:อาหารเย็น|อาหารกลางวัน|อาหารค่ำ|อาหารเช้า|มื้อเย็น|มื้อค่ำ|มื้อเที่ยง|มื้อกลางวัน|มื้อเช้า|lunch|dinner|breakfast|brunch|supper)\s*$/gi;
  let res = text.replace(mealParentheses, " ").replace(mealBrackets, " ").replace(mealDashes, "").replace(/\s{2,}/g, " ").trim();

  // Strip leading & or stray symbols
  res = res.replace(/^(&\s*)+/, "").trim();
  res = res.replace(/(?:Dinner)\s*&\s*Street Food/gi, "Street Food, Dinner");
  res = res.replace(/(?:Lunch)\s*&\s*Street Food/gi, "Street Food, Lunch");
  res = res.replace(/(?:Breakfast)\s*&\s*Street Food/gi, "Street Food, Breakfast");
  res = res.replace(/(?:^|\b)(?:&|\+)\s*Street Food\b/gi, "Street Food");
  res = res.replace(/,\s*&/g, ",");
  res = res.replace(/(\w+)\s*&\s*Street Food\b/gi, "$1, Street Food");

  return res.replace(/\s{2,}/g, " ").trim();
}

export function getLocalizedPlace(
  item: LocalizablePlace | null | undefined,
  language: Language,
  onAsyncResolve?: () => void
): string {
  if (!item) return "";

  // Strip meal/time labels (e.g. "(อาหารเย็น)", "(อาหารกลางวัน)", "(Lunch)", "(Dinner)")
  // to guarantee authentic place names
  const cleanItem: LocalizablePlace = {
    ...item,
    title_th: item.title_th ? stripMealLabels(item.title_th) : undefined,
    title_en: item.title_en ? stripMealLabels(item.title_en) : undefined,
    name_th: item.name_th ? stripMealLabels(item.name_th) : undefined,
    name_en: item.name_en ? stripMealLabels(item.name_en) : undefined,
    english_name: item.english_name ? stripMealLabels(item.english_name) : undefined,
    title: item.title ? stripMealLabels(item.title) : undefined,
    name: item.name ? stripMealLabels(item.name) : undefined,
    place_th: item.place_th ? stripMealLabels(item.place_th) : undefined,
    place_en: item.place_en ? stripMealLabels(item.place_en) : undefined,
    place: item.place ? stripMealLabels(item.place) : undefined,
  };

  if (language === "th") {
    // 1. Explicit Thai fields (must have Thai script or bilingual th)
    const explicitTh = (cleanItem.title_th || cleanItem.name_th || cleanItem.place_th || "").trim();
    if (explicitTh) {
      const bilingual = extractBilingualText(explicitTh);
      if (bilingual?.th) return stripMealLabels(bilingual.th);
      if (hasThaiScript(explicitTh)) return stripMealLabels(explicitTh);
    }

    // 2. Check general title/name/place
    const rawCandidate = (cleanItem.title || cleanItem.name || cleanItem.place || "").trim();
    if (rawCandidate) {
      const bilingual = extractBilingualText(rawCandidate);
      if (bilingual?.th) return bilingual.th;

      // Hotel Check-in / Check-out patterns
      if (/^check\s*in:?\s*(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^check\s*in:?\s*(.*)$/i);
        const place = match?.[1]?.trim() || "";
        const placeTh = place ? (DICTIONARY_EN_TO_TH[place.toLowerCase()] || DICTIONARY_CJK_TO_TH[place] || DICTIONARY_CJK_TO_TH[place.toLowerCase()] || extractBilingualText(place)?.th || getLocalizedPlace({ title: place }, "th", onAsyncResolve) || place) : "";
        return placeTh ? `เช็คอิน: ${placeTh}` : "เช็คอินเข้าที่พัก";
      }
      if (/^check\s*out:?\s*(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^check\s*out:?\s*(.*)$/i);
        const place = match?.[1]?.trim() || "";
        const placeTh = place ? (DICTIONARY_EN_TO_TH[place.toLowerCase()] || DICTIONARY_CJK_TO_TH[place] || DICTIONARY_CJK_TO_TH[place.toLowerCase()] || extractBilingualText(place)?.th || getLocalizedPlace({ title: place }, "th", onAsyncResolve) || place) : "";
        return placeTh ? `เช็คเอาต์: ${placeTh}` : "เช็คเอาต์จากที่พัก";
      }

      // Zone Street Food patterns (English -> Thai)
      if (/^(?:Street Food,?\s*Lunch\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^(?:Street Food,?\s*Lunch\s*(?:near|around|at)\s*)(.*)$/i);
        const anchor = match?.[1]?.trim() || "";
        const anchorTh = anchor ? (DICTIONARY_EN_TO_TH[anchor.toLowerCase()] || DICTIONARY_CJK_TO_TH[anchor] || DICTIONARY_CJK_TO_TH[anchor.toLowerCase()] || extractBilingualText(anchor)?.th || getLocalizedPlace({ title: anchor }, "th", onAsyncResolve) || anchor) : "";
        return anchorTh ? `สตรีทฟู้ด มื้อกลางวันรอบ${anchorTh}` : "สตรีทฟู้ด มื้อกลางวัน";
      }
      if (/^(?:Street Food,?\s*Dinner\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^(?:Street Food,?\s*Dinner\s*(?:near|around|at)\s*)(.*)$/i);
        const anchor = match?.[1]?.trim() || "";
        const anchorTh = anchor ? (DICTIONARY_EN_TO_TH[anchor.toLowerCase()] || DICTIONARY_CJK_TO_TH[anchor] || DICTIONARY_CJK_TO_TH[anchor.toLowerCase()] || extractBilingualText(anchor)?.th || getLocalizedPlace({ title: anchor }, "th", onAsyncResolve) || anchor) : "";
        return anchorTh ? `สตรีทฟู้ด มื้อค่ำรอบ${anchorTh}` : "สตรีทฟู้ด มื้อค่ำ";
      }
      if (/^(?:(?:Dinner|Lunch)\s*(?:&|,)?\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^(?:(Dinner|Lunch)\s*(?:&|,)?\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i);
        const mealType = match?.[1]?.toLowerCase() === "lunch" ? "มื้อกลางวัน" : "มื้อค่ำ";
        const anchor = match?.[2]?.trim() || "";
        const anchorTh = anchor ? (DICTIONARY_EN_TO_TH[anchor.toLowerCase()] || DICTIONARY_CJK_TO_TH[anchor] || DICTIONARY_CJK_TO_TH[anchor.toLowerCase()] || extractBilingualText(anchor)?.th || getLocalizedPlace({ title: anchor }, "th", onAsyncResolve) || anchor) : "";
        return anchorTh ? `สตรีทฟู้ด ${mealType}รอบ${anchorTh}` : `สตรีทฟู้ด ${mealType}`;
      }
      if (/^(?:(?:&|\+)?\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
        const match = rawCandidate.match(/^(?:(?:&|\+)?\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i);
        const anchor = match?.[1]?.trim() || "";
        const anchorTh = anchor ? (DICTIONARY_EN_TO_TH[anchor.toLowerCase()] || DICTIONARY_CJK_TO_TH[anchor] || DICTIONARY_CJK_TO_TH[anchor.toLowerCase()] || extractBilingualText(anchor)?.th || getLocalizedPlace({ title: anchor }, "th", onAsyncResolve) || anchor) : "";
        return anchorTh ? `สตรีทฟู้ดรอบ${anchorTh}` : "สตรีทฟู้ด";
      }
      if (/^(?:&?\s*Street Food)$/i.test(rawCandidate)) {
        return "สตรีทฟู้ด";
      }
      if (/^(?:Dinner\s*(?:&|,)\s*Street Food)$/i.test(rawCandidate)) {
        return "สตรีทฟู้ด มื้อค่ำ";
      }
      if (/^(?:Lunch\s*(?:&|,)\s*Street Food)$/i.test(rawCandidate)) {
        return "สตรีทฟู้ด มื้อกลางวัน";
      }

      // Check if already purely Thai (no CJK, no Hangul, no English)
      if (hasThaiScript(rawCandidate) && !hasCJKScript(rawCandidate) && !hasHangulScript(rawCandidate) && !/[a-zA-Z]/.test(rawCandidate)) {
        return rawCandidate;
      }
      if (hasThaiScript(rawCandidate) && !hasCJKScript(rawCandidate) && !hasHangulScript(rawCandidate)) {
        return rawCandidate;
      }

      // Direct full dictionary match
      const lowerKey = rawCandidate.toLowerCase();
      if (DICTIONARY_EN_TO_TH[lowerKey]) {
        return DICTIONARY_EN_TO_TH[lowerKey];
      }
      if (DICTIONARY_CJK_TO_TH[rawCandidate]) {
        return DICTIONARY_CJK_TO_TH[rawCandidate];
      }
      if (DICTIONARY_CJK_TO_TH[lowerKey]) {
        return DICTIONARY_CJK_TO_TH[lowerKey];
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
      if (onAsyncResolve && needsTranslation(rawCandidate, "th")) {
        translateTextAsync(rawCandidate, "th").then((res) => {
          if (res && res !== rawCandidate) onAsyncResolve();
        }).catch(() => {});
      }
    }

    // 3. Fallback
    const sourceText = (hasThaiScript(explicitTh) ? explicitTh : "") || rawCandidate || cleanItem.english_name || cleanItem.title_en || cleanItem.name_en || cleanItem.place_en || "";
    const cachedSource = typeof window !== "undefined" && sourceText ? localStorage.getItem(`trans_th:${sourceText}`) : null;
    if (cachedSource && hasThaiScript(cachedSource)) return stripMealLabels(cachedSource);

    const sourceSync = translateTextSync(sourceText, "th");
    if (sourceSync !== sourceText && hasThaiScript(sourceSync)) return stripMealLabels(sourceSync);

    return stripMealLabels((hasThaiScript(explicitTh) ? explicitTh : "") || (hasThaiScript(rawCandidate) ? rawCandidate : "") || sourceText);
  }

  // English
  // 1. Explicit English fields (must have Latin/English letters AND not CJK)
  const explicitEn = (cleanItem.title_en || cleanItem.name_en || cleanItem.place_en || cleanItem.english_name || "").trim();
  if (explicitEn) {
    const bilingual = extractBilingualText(explicitEn);
    if (bilingual?.en) return stripMealLabels(bilingual.en);
    if (hasLatinScript(explicitEn) && !hasThaiScript(explicitEn) && !hasCJKScript(explicitEn) && !hasHangulScript(explicitEn)) {
      return stripMealLabels(explicitEn);
    }
    if (hasLatinScript(explicitEn) && !hasThaiScript(explicitEn)) {
      const stripped = explicitEn.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]+/g, "").replace(/\s{2,}/g, " ").trim();
      if (stripped && hasLatinScript(stripped)) return stripMealLabels(stripped);
      return stripMealLabels(explicitEn);
    }
  }

  // 2. Check general title/name/place
  const rawCandidate = (cleanItem.title || cleanItem.name || cleanItem.place || "").trim();
  if (rawCandidate) {
    const bilingual = extractBilingualText(rawCandidate);
    if (bilingual?.en) return stripMealLabels(bilingual.en);

    // Thai Check-in / Check-out patterns
    if (/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i);
      const place = match?.[2]?.trim() || "";
      const placeEn = place ? (DICTIONARY_TH_TO_EN[place.toLowerCase()] || DICTIONARY_CJK_TO_EN[place] || DICTIONARY_CJK_TO_EN[place.toLowerCase()] || extractBilingualText(place)?.en || getLocalizedPlace({ title: place }, "en", onAsyncResolve) || place) : "";
      return placeEn ? `Check in: ${placeEn}` : "Check in to hotel";
    }
    if (/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i);
      const place = match?.[2]?.trim() || "";
      const placeEn = place ? (DICTIONARY_TH_TO_EN[place.toLowerCase()] || DICTIONARY_CJK_TO_EN[place] || DICTIONARY_CJK_TO_EN[place.toLowerCase()] || extractBilingualText(place)?.en || getLocalizedPlace({ title: place }, "en", onAsyncResolve) || place) : "";
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

    // Zone Street Food patterns (Thai -> English)
    if (/^(?:สตรีทฟู้ด\s*มื้อกลางวัน(?:รอบ|แถว|บริเวณ)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:สตรีทฟู้ด\s*มื้อกลางวัน(?:รอบ|แถว|บริเวณ)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      const anchorEn = anchor ? (DICTIONARY_TH_TO_EN[anchor.toLowerCase()] || DICTIONARY_CJK_TO_EN[anchor] || DICTIONARY_CJK_TO_EN[anchor.toLowerCase()] || extractBilingualText(anchor)?.en || getLocalizedPlace({ title: anchor }, "en", onAsyncResolve) || anchor) : "";
      return anchorEn ? `Street Food, Lunch near ${anchorEn}` : "Street Food, Lunch";
    }
    if (/^(?:สตรีทฟู้ด\s*มื้อค่ำ(?:รอบ|แถว|บริเวณ)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:สตรีทฟู้ด\s*มื้อค่ำ(?:รอบ|แถว|บริเวณ)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      const anchorEn = anchor ? (DICTIONARY_TH_TO_EN[anchor.toLowerCase()] || DICTIONARY_CJK_TO_EN[anchor] || DICTIONARY_CJK_TO_EN[anchor.toLowerCase()] || extractBilingualText(anchor)?.en || getLocalizedPlace({ title: anchor }, "en", onAsyncResolve) || anchor) : "";
      return anchorEn ? `Street Food, Dinner near ${anchorEn}` : "Street Food, Dinner";
    }
    if (/^(?:(?:มื้อค่ำและสตรีทฟู้ด|สตรีทฟู้ด\s*มื้อค่ำ)(?:แถว|รอบ|บริเวณ)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:(?:มื้อค่ำและสตรีทฟู้ด|สตรีทฟู้ด\s*มื้อค่ำ)(?:แถว|รอบ|บริเวณ)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      const anchorEn = anchor ? (DICTIONARY_TH_TO_EN[anchor.toLowerCase()] || DICTIONARY_CJK_TO_EN[anchor] || DICTIONARY_CJK_TO_EN[anchor.toLowerCase()] || extractBilingualText(anchor)?.en || getLocalizedPlace({ title: anchor }, "en", onAsyncResolve) || anchor) : "";
      return anchorEn ? `Street Food, Dinner near ${anchorEn}` : "Street Food, Dinner";
    }
    if (/^(?:(?:มื้อกลางวันและสตรีทฟู้ด|สตรีทฟู้ด\s*มื้อกลางวัน)(?:แถว|รอบ|บริเวณ)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:(?:มื้อกลางวันและสตรีทฟู้ด|สตรีทฟู้ด\s*มื้อกลางวัน)(?:แถว|รอบ|บริเวณ)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      const anchorEn = anchor ? (DICTIONARY_TH_TO_EN[anchor.toLowerCase()] || DICTIONARY_CJK_TO_EN[anchor] || DICTIONARY_CJK_TO_EN[anchor.toLowerCase()] || extractBilingualText(anchor)?.en || getLocalizedPlace({ title: anchor }, "en", onAsyncResolve) || anchor) : "";
      return anchorEn ? `Street Food, Lunch near ${anchorEn}` : "Street Food, Lunch";
    }
    if (/^(?:(?:สตรีทฟู้ด|และสตรีทฟู้ด)(?:รอบ|แถว|บริเวณ|ย่าน)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:(?:สตรีทฟู้ด|และสตรีทฟู้ด)(?:รอบ|แถว|บริเวณ|ย่าน)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      const anchorEn = anchor ? (DICTIONARY_TH_TO_EN[anchor.toLowerCase()] || DICTIONARY_CJK_TO_EN[anchor] || DICTIONARY_CJK_TO_EN[anchor.toLowerCase()] || extractBilingualText(anchor)?.en || getLocalizedPlace({ title: anchor }, "en", onAsyncResolve) || anchor) : "";
      return anchorEn ? `Street Food near ${anchorEn}` : "Street Food";
    }

    // English patterns cleanup (& Street Food -> Street Food)
    if (/^(?:Dinner\s*(?:&|,)\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:Dinner\s*(?:&|,)\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      return anchor ? `Street Food, Dinner near ${anchor}` : "Street Food, Dinner";
    }
    if (/^(?:Lunch\s*(?:&|,)\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:Lunch\s*(?:&|,)\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      return anchor ? `Street Food, Lunch near ${anchor}` : "Street Food, Lunch";
    }
    if (/^(?:&?\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i.test(rawCandidate)) {
      const match = rawCandidate.match(/^(?:&?\s*Street Food\s*(?:near|around|at)\s*)(.*)$/i);
      const anchor = match?.[1]?.trim() || "";
      return anchor ? `Street Food near ${anchor}` : "Street Food";
    }
    if (/^&?\s*Street Food$/i.test(rawCandidate)) {
      return "Street Food";
    }

    // Check if already purely Latin/English (and no Thai, no CJK, no Hangul)
    if (!hasThaiScript(rawCandidate) && !hasCJKScript(rawCandidate) && !hasHangulScript(rawCandidate) && hasLatinScript(rawCandidate)) {
      return stripMealLabels(rawCandidate);
    }

    // Direct full dictionary match
    const lowerKey = rawCandidate.toLowerCase();
    if (DICTIONARY_TH_TO_EN[lowerKey]) {
      return stripMealLabels(DICTIONARY_TH_TO_EN[lowerKey]);
    }
    if (DICTIONARY_CJK_TO_EN[rawCandidate]) {
      return stripMealLabels(DICTIONARY_CJK_TO_EN[rawCandidate]);
    }
    if (DICTIONARY_CJK_TO_EN[lowerKey]) {
      return stripMealLabels(DICTIONARY_CJK_TO_EN[lowerKey]);
    }

    // Synchronous translateTextSync
    const syncResult = translateTextSync(rawCandidate, "en");
    if (syncResult !== rawCandidate && !hasThaiScript(syncResult) && !hasCJKScript(syncResult) && !hasHangulScript(syncResult)) {
      return stripMealLabels(syncResult);
    }

    // Check cache
    const cached = typeof window !== "undefined" ? localStorage.getItem(`trans_en:${rawCandidate}`) : null;
    if (cached && !hasThaiScript(cached) && !hasCJKScript(cached) && !hasHangulScript(cached)) {
      return stripMealLabels(cached);
    }

    // Trigger async AI translation
    if (onAsyncResolve && needsTranslation(rawCandidate, "en")) {
      translateTextAsync(rawCandidate, "en").then((res) => {
        if (res && res !== rawCandidate) onAsyncResolve();
      }).catch(() => {});
    }
  }

  // 3. Fallback
  const sourceText = (hasLatinScript(explicitEn) && !hasCJKScript(explicitEn) && !hasHangulScript(explicitEn) ? explicitEn : "") || rawCandidate || cleanItem.title_th || cleanItem.name_th || cleanItem.place_th || "";
  const cachedSource = typeof window !== "undefined" && sourceText ? localStorage.getItem(`trans_en:${sourceText}`) : null;
  if (cachedSource && !hasThaiScript(cachedSource) && !hasCJKScript(cachedSource) && !hasHangulScript(cachedSource)) {
    return stripMealLabels(cachedSource);
  }

  const syncFallback = translateTextSync(sourceText, "en");
  if (syncFallback !== sourceText && !hasThaiScript(syncFallback) && !hasCJKScript(syncFallback) && !hasHangulScript(syncFallback)) {
    return stripMealLabels(syncFallback);
  }

  return stripMealLabels(
    (hasLatinScript(explicitEn) && !hasCJKScript(explicitEn) && !hasHangulScript(explicitEn) ? explicitEn : "") ||
    (!hasThaiScript(rawCandidate) && !hasCJKScript(rawCandidate) && !hasHangulScript(rawCandidate) && rawCandidate ? rawCandidate : "") ||
    sourceText
  );
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

      if (hasThaiScript(raw) && !hasCJKScript(raw) && !hasHangulScript(raw) && !/[a-zA-Z]/.test(raw)) {
        return raw;
      }
      if (hasThaiScript(raw) && !hasCJKScript(raw) && !hasHangulScript(raw)) {
        return raw;
      }
    }

    // 3. Needs translation from English / Foreign -> Thai
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
      if (onAsyncResolve && needsTranslation(textToTranslate, "th")) {
        translateTextAsync(textToTranslate, "th").then((res) => {
          if (res && res !== textToTranslate) onAsyncResolve();
        }).catch(() => {});
      }
    }

    return (hasThaiScript(explicitTh) ? explicitTh : "") || (hasThaiScript(raw) ? raw : "") || textToTranslate;
  }

  // English
  // 1. Explicit English description (must contain English letters, no CJK/Thai)
  const explicitEn = (item.description_en || "").trim();
  if (explicitEn) {
    const bilingual = extractBilingualText(explicitEn);
    if (bilingual?.en) return bilingual.en;
    if (hasLatinScript(explicitEn) && !hasThaiScript(explicitEn) && !hasCJKScript(explicitEn) && !hasHangulScript(explicitEn)) {
      return explicitEn;
    }
  }

  // 2. Check general description if already English
  const raw = (item.description || "").trim();
  if (raw) {
    const bilingual = extractBilingualText(raw);
    if (bilingual?.en) return bilingual.en;

    if (!hasThaiScript(raw) && !hasCJKScript(raw) && !hasHangulScript(raw) && hasLatinScript(raw)) {
      return raw;
    }
  }

  // 3. Needs translation to English
  const textToTranslate = raw || (item.description_th || "").trim() || explicitEn;
  if (textToTranslate) {
    // Check cache
    const cached = typeof window !== "undefined" ? localStorage.getItem(`trans_en:${textToTranslate}`) : null;
    if (cached && !hasThaiScript(cached) && !hasCJKScript(cached) && !hasHangulScript(cached)) return cached;

    // Exact dictionary / sync
    const syncResult = translateTextSync(textToTranslate, "en");
    if (syncResult !== textToTranslate && !hasThaiScript(syncResult) && !hasCJKScript(syncResult) && !hasHangulScript(syncResult)) {
      return syncResult;
    }

    // Trigger AI translation asynchronously
    if (onAsyncResolve && needsTranslation(textToTranslate, "en")) {
      translateTextAsync(textToTranslate, "en").then((res) => {
        if (res && res !== textToTranslate) onAsyncResolve();
      }).catch(() => {});
    }
  }

  return (hasLatinScript(explicitEn) && !hasThaiScript(explicitEn) && !hasCJKScript(explicitEn) && !hasHangulScript(explicitEn) ? explicitEn : "") ||
    (!hasThaiScript(raw) && !hasCJKScript(raw) && !hasHangulScript(raw) && raw ? raw : "") ||
    textToTranslate;
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isThai: boolean;
  t: (keyOrTh: string, enText?: string) => string;
  locPlace: (item: LocalizablePlace | null | undefined) => string;
  locDesc: (item: LocalizableDescription | null | undefined) => string;
  batchResolvePlaces: (places: Array<LocalizablePlace | string | null | undefined>) => Promise<void>;
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

  const batchResolvePlaces = useCallback(
    async (places: Array<LocalizablePlace | string | null | undefined>) => {
      if (!places || places.length === 0) return;

      const candidates: Array<{ id: string; name: string }> = [];
      const seen = new Set<string>();

      for (const item of places) {
        if (!item) continue;
        let raw = "";
        if (typeof item === "string") {
          raw = item;
        } else {
          raw = (item.title || item.name || item.place || item.title_en || item.title_th || "").trim();
        }
        const clean = stripMealLabels(raw).trim();
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);

        // Fast check: is this already cached for both Thai and English?
        const hasCachedTh = typeof window !== "undefined" && localStorage.getItem(`trans_th:${clean}`);
        const hasCachedEn = typeof window !== "undefined" && localStorage.getItem(`trans_en:${clean}`);

        if (!hasCachedTh || !hasCachedEn) {
          if (needsTranslation(clean, "th") || needsTranslation(clean, "en")) {
            candidates.push({ id: clean, name: clean });
          }
        }
      }

      if (candidates.length === 0) return;

      try {
        await batchResolveBilingualPlacesAI(candidates);
        triggerAsyncUpdate();
      } catch (err) {
        console.warn("[LanguageProvider] batchResolvePlaces failed:", err);
      }
    },
    [triggerAsyncUpdate]
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
        batchResolvePlaces,
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
