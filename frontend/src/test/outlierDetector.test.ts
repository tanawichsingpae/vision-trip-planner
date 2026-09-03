import { describe, it, expect } from "vitest";
import { detectVisionOutliers, type GeoVisionResult } from "@/utils/outlierDetector";

describe("Vision AI Outlier Detection & Geo-Distance Rules", () => {
  it("should keep neighboring province excursions (50-70 km) and mark them as excursions", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Grand Palace",
        country: "Thailand",
        type: "culture",
        confidence: 0.85,
        lat: 13.7500,
        lng: 100.4913,
        similar_locations: [],
      },
      {
        place: "Wat Arun",
        country: "Thailand",
        type: "culture",
        confidence: 0.82,
        lat: 13.7437,
        lng: 100.4888,
        similar_locations: [],
      },
      {
        place: "Wat Mahathat Ayutthaya", // ~65 km north of Bangkok
        country: "Thailand",
        type: "culture",
        confidence: 0.78,
        lat: 14.3569,
        lng: 100.5678,
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true, 70, 35);

    expect(outliers.length).toBe(0);
    expect(kept.length).toBe(3);

    const ayutthaya = kept.find((k) => k.place.includes("Ayutthaya"));
    expect(ayutthaya).toBeDefined();
    expect(ayutthaya!.isExcursion).toBe(true);
    expect(ayutthaya!.distanceKm).toBeGreaterThanOrEqual(50);
    expect(ayutthaya!.distanceKm).toBeLessThanOrEqual(70);
  });

  it("should flag distant places (> 70 km) as DISTANCE_EXCEEDED outliers", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Grand Palace",
        country: "Thailand",
        type: "culture",
        confidence: 0.85,
        lat: 13.7500,
        lng: 100.4913,
        similar_locations: [],
      },
      {
        place: "Wat Phra Kaew",
        country: "Thailand",
        type: "culture",
        confidence: 0.88,
        lat: 13.7510,
        lng: 100.4920,
        similar_locations: [],
      },
      {
        place: "Wat Phra Singh (Chiang Mai)", // ~680 km north
        country: "Thailand",
        type: "culture",
        confidence: 0.80,
        lat: 18.7885,
        lng: 98.9817,
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true, 70, 35);

    expect(kept.length).toBe(2);
    expect(outliers.length).toBe(1);

    const chiangMaiOutlier = outliers[0];
    expect(chiangMaiOutlier.category).toBe("DISTANCE_EXCEEDED");
    expect(chiangMaiOutlier.distanceKm).toBeGreaterThan(500);
    expect(chiangMaiOutlier.canRestore).toBe(true);
  });

  it("should detect country mismatch outliers", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Tokyo Tower",
        country: "Japan",
        type: "attraction",
        confidence: 0.90,
        similar_locations: [],
      },
      {
        place: "Senso-ji Temple",
        country: "Japan",
        type: "culture",
        confidence: 0.85,
        similar_locations: [],
      },
      {
        place: "Eiffel Tower",
        country: "France",
        type: "attraction",
        confidence: 0.92,
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true);

    expect(kept.length).toBe(2);
    expect(outliers.length).toBe(1);
    expect(outliers[0].category).toBe("COUNTRY_MISMATCH");
    expect(outliers[0].place).toBe("Eiffel Tower");
  });

  it("should detect non-travel image outliers", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Tokyo Tower",
        country: "Japan",
        type: "attraction",
        confidence: 0.90,
        similar_locations: [],
      },
      {
        place: "Unknown Object",
        country: "Japan",
        type: "receipt",
        confidence: 0.10,
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true);

    expect(kept.length).toBe(1);
    expect(outliers.length).toBe(1);
    expect(outliers[0].category).toBe("NON_TRAVEL");
  });

  it("should detect portrait_selfie and is_identifiable_place=false as NON_TRAVEL with custom rejection reason", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Wat Phra Kaew",
        country: "Thailand",
        type: "culture",
        confidence: 0.92,
        lat: 13.7510,
        lng: 100.4920,
        similar_locations: [],
      },
      {
        place: "ภาพไม่ระบุสถานที่ท่องเที่ยว",
        country: "-",
        type: "portrait_selfie",
        confidence: 0,
        is_identifiable_place: false,
        rejection_reason: "ภาพนี้เป็นภาพถ่ายบุคคล (Selfie) ไม่สามารถระบุแลนด์มาร์กได้",
        similar_locations: [],
      },
      {
        place: "ภาพไม่ระบุสถานที่ท่องเที่ยว",
        country: "-",
        type: "document_screenshot",
        confidence: 0,
        is_identifiable_place: false,
        rejection_reason: "ภาพนี้เป็นเอกสารหรือสลิป ไม่ใช่สถานที่ท่องเที่ยว",
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true);

    expect(kept.length).toBe(1);
    expect(outliers.length).toBe(2);
    expect(outliers[0].category).toBe("NON_TRAVEL");
    expect(outliers[0].reasonDescription).toContain("Selfie");
    expect(outliers[1].category).toBe("NON_TRAVEL");
    expect(outliers[1].reasonDescription).toContain("เอกสาร");
  });

  it("should not salvage non-travel images into kept when all uploads are non-travel", () => {
    const results: GeoVisionResult[] = [
      {
        place: "ภาพไม่ระบุสถานที่ท่องเที่ยว",
        country: "-",
        type: "portrait_selfie",
        confidence: 0,
        is_identifiable_place: false,
        rejection_reason: "ภาพบุคคล",
        similar_locations: [],
      },
      {
        place: "ภาพไม่ระบุสถานที่ท่องเที่ยว",
        country: "-",
        type: "document",
        confidence: 0,
        is_identifiable_place: false,
        rejection_reason: "สลิปโอนเงิน",
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true);

    expect(kept.length).toBe(0);
    expect(outliers.length).toBe(2);
    expect(outliers[0].category).toBe("NON_TRAVEL");
    expect(outliers[1].category).toBe("NON_TRAVEL");
  });

  it("should detect low visual confidence outliers", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Tokyo Tower",
        country: "Japan",
        type: "attraction",
        confidence: 0.90,
        similar_locations: [],
      },
      {
        place: "Blurry Park",
        country: "Japan",
        type: "nature",
        confidence: 0.12, // < 20%
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true);

    expect(kept.length).toBe(1);
    expect(outliers.length).toBe(1);
    expect(outliers[0].category).toBe("LOW_CONFIDENCE");
  });

  it("should detect duplicate places within the same trip", () => {
    const results: GeoVisionResult[] = [
      {
        place: "Tokyo Tower",
        country: "Japan",
        type: "attraction",
        confidence: 0.90,
        similar_locations: [],
      },
      {
        place: "Tokyo Tower",
        country: "Japan",
        type: "attraction",
        confidence: 0.88,
        similar_locations: [],
      },
    ];

    const { kept, outliers } = detectVisionOutliers(results, true);

    expect(kept.length).toBe(1);
    expect(outliers.length).toBe(1);
    expect(outliers[0].category).toBe("DUPLICATE");
  });
});
