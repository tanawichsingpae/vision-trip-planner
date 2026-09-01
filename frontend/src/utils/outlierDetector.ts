import { type VisionResult } from "@/services/aiService";
import { type OutlierItem } from "@/components/VisionOutlierModal";

/**
 * Detects and classifies outlier images from Vision AI results.
 * Returns separated kept locations and outlier items.
 */
export function detectVisionOutliers(
  results: VisionResult[],
  useClip: boolean = true
): { kept: VisionResult[]; outliers: OutlierItem[] } {
  if (!results || results.length === 0) {
    return { kept: [], outliers: [] };
  }

  const kept: VisionResult[] = [];
  const outliers: OutlierItem[] = [];

  // Track seen places for duplicate detection
  const seenPlaceNames = new Map<string, number>();

  // 1. Calculate Country Frequency (to find Majority Country)
  const countryCounts: Record<string, number> = {};
  results.forEach((r) => {
    const country = (r.country || "").trim();
    if (country) {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }
  });

  let majorityCountry = "";
  let maxCountryCount = 0;
  for (const [country, count] of Object.entries(countryCounts)) {
    if (count > maxCountryCount) {
      maxCountryCount = count;
      majorityCountry = country;
    }
  }

  // A country is considered dominant if it has >= 2 occurrences or > 50% of results
  const hasMajorityCountry =
    majorityCountry !== "" &&
    (maxCountryCount >= 2 || (results.length >= 3 && maxCountryCount / results.length >= 0.5));

  results.forEach((res, index) => {
    const placeName = (res.place || "").trim();
    const country = (res.country || "").trim();
    const lowerPlace = placeName.toLowerCase();
    const id = `outlier-${index}-${Date.now()}`;

    // Get candidate photo if available
    const photoUrl =
      res.top_candidates?.[0]?.photo_url ||
      res.initial_candidates?.[0]?.photo_url ||
      null;

    // Check 1: Duplicate Place
    if (seenPlaceNames.has(lowerPlace)) {
      outliers.push({
        id,
        place: res.place,
        country: res.country,
        category: "DUPLICATE",
        reasonTitle: "สถานที่ซ้ำซ้อนในทริปเดียวกัน",
        reasonDescription: `ระบบพบภาพของ "${res.place}" ซ้ำกับภาพที่วิเคราะห์ไปแล้ว จึงคัดกรองออกเพื่อไม่ให้ตารางเดินทางซ้ำซ้อน`,
        confidence: res.confidence,
        photoUrl,
        originalResult: res,
        canRestore: true,
      });
      return;
    }

    // Check 2: Non-Travel Image Detection (e.g. unknown or generic text)
    const isGenericOrNonTravel =
      lowerPlace.includes("unknown") ||
      lowerPlace.includes("unidentified") ||
      lowerPlace === "n/a" ||
      lowerPlace === "none" ||
      (res.type && ["document", "receipt", "screenshot", "meme", "object"].includes(res.type.toLowerCase()));

    if (isGenericOrNonTravel) {
      outliers.push({
        id,
        place: res.place || "ภาพที่ไม่ระบุสถานที่",
        country: res.country || "-",
        category: "NON_TRAVEL",
        reasonTitle: "ภาพไม่ตรงกับสถานที่ท่องเที่ยว",
        reasonDescription: "ระบบประเมินว่าภาพนี้อาจเป็นเอกสาร วัตถุสิ่งของ หรือภาพที่ไม่ใช่แลนด์มาร์กสำหรับการท่องเที่ยว",
        confidence: res.confidence,
        photoUrl,
        originalResult: res,
        canRestore: true,
      });
      return;
    }

    // Check 3: Low Confidence (when CLIP is enabled)
    // Threshold is 0.20 when CLIP is active
    if (useClip && res.confidence !== undefined && res.confidence > 0 && res.confidence < 0.20) {
      outliers.push({
        id,
        place: res.place,
        country: res.country,
        category: "LOW_CONFIDENCE",
        reasonTitle: "ความเชื่อมั่นของภาพต่ำ (Low Visual Confidence)",
        reasonDescription: `ค่าความเหมือนของภาพกับฐานข้อมูลอยู่ที่ ${(res.confidence * 100).toFixed(0)}% ซึ่งต่ำกว่าเกณฑ์ 20% อาจระบุสถานที่คลาดเคลื่อน`,
        confidence: res.confidence,
        photoUrl,
        originalResult: res,
        canRestore: true,
      });
      return;
    }

    // Check 4: Country Mismatch
    if (
      hasMajorityCountry &&
      country &&
      country.toLowerCase() !== majorityCountry.toLowerCase()
    ) {
      outliers.push({
        id,
        place: res.place,
        country: res.country,
        category: "COUNTRY_MISMATCH",
        reasonTitle: `อยู่นอกประเทศปลายทางหลัก (${country} vs ${majorityCountry})`,
        reasonDescription: `ภาพส่วนใหญ่ของคุณอยู่ใน "${majorityCountry}" แต่สถานที่นี้ตั้งอยู่ใน "${country}" ระบบจึงแยกออกเพื่อรักษาความต่อเนื่องของการเดินทาง`,
        confidence: res.confidence,
        majorityCountry,
        photoUrl,
        originalResult: res,
        canRestore: true,
      });
      return;
    }

    // If passed all checks, keep the location
    seenPlaceNames.set(lowerPlace, index);
    kept.push(res);
  });

  // Safety fallback: If all locations were marked as outliers, restore the highest confidence one
  if (kept.length === 0 && outliers.length > 0) {
    const highestConfidenceIdx = outliers.reduce((bestIdx, item, idx) => {
      const bestConf = outliers[bestIdx].confidence ?? 0;
      const curConf = item.confidence ?? 0;
      return curConf > bestConf ? idx : bestIdx;
    }, 0);

    const [salvaged] = outliers.splice(highestConfidenceIdx, 1);
    kept.push(salvaged.originalResult);
  }

  return { kept, outliers };
}
