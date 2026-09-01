import { type VisionResult, type ImageCandidate } from "@/services/aiService";
import { type OutlierItem, type OutlierCategory } from "@/components/VisionOutlierModal";
import { haversineDistance } from "@/api/spatialPlanner";

export interface GeoVisionResult extends VisionResult {
  lat?: number;
  lng?: number;
  distanceKm?: number;
  isExcursion?: boolean;
}

/**
 * Computes a robust density-based hub centroid resistant to distant outliers
 */
function computeRobustHubCentroid(places: GeoVisionResult[]): { lat: number; lng: number } | null {
  if (places.length === 0) return null;
  if (places.length === 1) return { lat: places[0].lat!, lng: places[0].lng! };

  // For each place, count neighbors within 60 km and calculate closeness
  let bestIdx = 0;
  let maxScore = -1;

  for (let i = 0; i < places.length; i++) {
    let clusterCount = 0;
    let closenessSum = 0;

    for (let j = 0; j < places.length; j++) {
      const d = haversineDistance(
        { lat: places[i].lat!, lng: places[i].lng! },
        { lat: places[j].lat!, lng: places[j].lng! }
      );
      if (d <= 60) {
        clusterCount++;
      }
      closenessSum += 1 / (1 + d);
    }

    const score = clusterCount * 100 + closenessSum;
    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }

  const anchor = places[bestIdx];

  // Average points within 60 km of the densest anchor to form the true hub centroid
  const coreCluster = places.filter(p =>
    haversineDistance({ lat: anchor.lat!, lng: anchor.lng! }, { lat: p.lat!, lng: p.lng! }) <= 60
  );

  const avgLat = coreCluster.reduce((sum, p) => sum + p.lat!, 0) / coreCluster.length;
  const avgLng = coreCluster.reduce((sum, p) => sum + p.lng!, 0) / coreCluster.length;

  return { lat: avgLat, lng: avgLng };
}

/**
 * Detects and classifies outlier images from Vision AI results.
 * Supports geo-distance filtering with 50-70 km tolerance for neighboring province excursions.
 */
export function detectVisionOutliers(
  results: GeoVisionResult[],
  useClip: boolean = true,
  distanceThresholdKm: number = 70,
  excursionThresholdKm: number = 35
): { kept: GeoVisionResult[]; outliers: OutlierItem[] } {
  if (!results || results.length === 0) {
    return { kept: [], outliers: [] };
  }

  const kept: GeoVisionResult[] = [];
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

  const hasMajorityCountry =
    majorityCountry !== "" &&
    (maxCountryCount >= 2 || (results.length >= 3 && maxCountryCount / results.length >= 0.5));

  // 2. Calculate Geographic Centroid of Majority Country Places using robust hub detection
  const geoPlaces = results.filter(
    (r) =>
      r.lat !== undefined &&
      r.lng !== undefined &&
      !isNaN(r.lat) &&
      !isNaN(r.lng) &&
      (!hasMajorityCountry || !r.country || r.country.toLowerCase() === majorityCountry.toLowerCase())
  );

  const centroid = computeRobustHubCentroid(geoPlaces);

  results.forEach((res, index) => {
    const placeName = (res.place || "").trim();
    const country = (res.country || "").trim();
    const lowerPlace = placeName.toLowerCase();
    const id = `outlier-${index}-${Date.now()}`;

    // Get candidate photo or uploaded photo if available
    const photoUrl =
      res.uploadedImageUrl ||
      res.top_candidates?.[0]?.photo_url ||
      res.initial_candidates?.[0]?.photo_url ||
      null;

    // Check distance to centroid if available
    let distanceToCentroid: number | undefined = undefined;
    if (centroid && res.lat !== undefined && res.lng !== undefined && !isNaN(res.lat) && !isNaN(res.lng)) {
      distanceToCentroid = haversineDistance(centroid, { lat: res.lat, lng: res.lng });
    }

    // Check 1: Duplicate Place
    if (seenPlaceNames.has(lowerPlace)) {
      outliers.push({
        id,
        place: res.place,
        country: res.country,
        category: "DUPLICATE",
        reasonTitle: "สถานที่ซ้ำซ้อนในทริปเดียวกัน",
        reasonDescription: `ระบบพบภาพของ "${res.place}" ซ้ำกับภาพที่วิเคราะห์ไปแล้ว จึงแยกออกเพื่อไม่ให้ตารางเดินทางซ้ำซ้อน`,
        confidence: res.confidence,
        distanceKm: distanceToCentroid !== undefined ? Math.round(distanceToCentroid) : undefined,
        photoUrl,
        originalResult: res,
        top_candidates: res.top_candidates,
        initial_candidates: res.initial_candidates,
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
        distanceKm: distanceToCentroid !== undefined ? Math.round(distanceToCentroid) : undefined,
        photoUrl,
        originalResult: res,
        top_candidates: res.top_candidates,
        initial_candidates: res.initial_candidates,
        canRestore: true,
      });
      return;
    }

    // Check 3: Country Mismatch
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
        distanceKm: distanceToCentroid !== undefined ? Math.round(distanceToCentroid) : undefined,
        majorityCountry,
        photoUrl,
        originalResult: res,
        top_candidates: res.top_candidates,
        initial_candidates: res.initial_candidates,
        canRestore: true,
      });
      return;
    }

    // Check 4: Geo-Distance Exceeded (> 50-70 km threshold)
    if (distanceToCentroid !== undefined && distanceToCentroid > distanceThresholdKm) {
      outliers.push({
        id,
        place: res.place,
        country: res.country,
        category: "DISTANCE_EXCEEDED",
        reasonTitle: `อยู่นอกพื้นที่หลัก (ห่าง ${Math.round(distanceToCentroid)} กม.)`,
        reasonDescription: `สถานที่นี้อยู่ห่างจากจุดหมายหลักประมาณ ${Math.round(distanceToCentroid)} กม. ซึ่งเกินเกณฑ์ ${distanceThresholdKm} กม. สำหรับการเที่ยวในจังหวัดใกล้เคียง กรุณายืนยันว่าต้องการเก็บไว้ในทริปหรือไม่`,
        confidence: res.confidence,
        distanceKm: Math.round(distanceToCentroid),
        photoUrl,
        originalResult: res,
        top_candidates: res.top_candidates,
        initial_candidates: res.initial_candidates,
        canRestore: true,
      });
      return;
    }

    // Check 5: Low Confidence (when CLIP is enabled)
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
        distanceKm: distanceToCentroid !== undefined ? Math.round(distanceToCentroid) : undefined,
        photoUrl,
        originalResult: res,
        top_candidates: res.top_candidates,
        initial_candidates: res.initial_candidates,
        canRestore: true,
      });
      return;
    }

    // Mark as neighboring province excursion if distance is between 35-70 km
    const isExcursion = distanceToCentroid !== undefined && distanceToCentroid > excursionThresholdKm;

    seenPlaceNames.set(lowerPlace, index);
    kept.push({
      ...res,
      distanceKm: distanceToCentroid !== undefined ? Math.round(distanceToCentroid) : undefined,
      isExcursion,
    });
  });

  // Safety fallback: If all locations were marked as outliers, restore the highest confidence one
  if (kept.length === 0 && outliers.length > 0) {
    const highestConfidenceIdx = outliers.reduce((bestIdx, item, idx) => {
      const bestConf = outliers[bestIdx].confidence ?? 0;
      const curConf = item.confidence ?? 0;
      return curConf > bestConf ? idx : bestIdx;
    }, 0);

    const [salvaged] = outliers.splice(highestConfidenceIdx, 1);
    kept.push({
      ...salvaged.originalResult,
      distanceKm: salvaged.distanceKm,
    });
  }

  return { kept, outliers };
}
