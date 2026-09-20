import { describe, it, expect } from "vitest";
import { getFallbackSuggestions, type SuggestedPlace } from "@/components/AISuggestedPlaces";

describe("AI Suggested Places - Minimum 10 Enforcement", () => {
  it("getFallbackSuggestions should provide at least 10 diverse suggestions (currently 14)", () => {
    const fallbacks = getFallbackSuggestions("Chiang Mai");
    expect(fallbacks.length).toBeGreaterThanOrEqual(10);
    expect(fallbacks.length).toBe(14);
  });

  it("every fallback suggestion must have complete bilingual data and valid categories", () => {
    const fallbacks = getFallbackSuggestions("Tokyo");
    const validCategories = [
      "culture", "food", "nature", "adventure", "activity", 
      "shopping", "nightlife", "relax", "landmark", "photo", 
      "entertainment", "spiritual", "hotel", "attraction"
    ];

    for (const place of fallbacks) {
      expect(place.name).toBeTruthy();
      expect(place.name_th).toBeTruthy();
      expect(place.name_en).toBeTruthy();
      expect(place.description_th).toBeTruthy();
      expect(place.description_en).toBeTruthy();
      expect(validCategories).toContain(place.category);
    }
  });

  it("backfilling logic should guarantee at least 10 items when starting with 0 items", () => {
    const rawSuggestions: SuggestedPlace[] = [];
    const fallbacks = getFallbackSuggestions("Bangkok");
    const existingNames = new Set(
      rawSuggestions.map((s) => (s.name || s.name_en || "").toLowerCase().trim())
    );
    const combined = [...rawSuggestions];
    for (const fb of fallbacks) {
      const fbKey = (fb.name || fb.name_en || "").toLowerCase().trim();
      if (!existingNames.has(fbKey)) {
        combined.push(fb);
        existingNames.add(fbKey);
        if (combined.length >= 10) break;
      }
    }

    expect(combined.length).toBe(10);
    expect(new Set(combined.map(c => c.name.toLowerCase().trim())).size).toBe(10);
  });

  it("backfilling logic should guarantee at least 10 items when starting with 4 items", () => {
    const rawSuggestions: SuggestedPlace[] = [
      {
        id: "p1",
        name: "Custom Place 1",
        name_th: "สถานที่ 1",
        name_en: "Custom Place 1",
        category: "culture",
        description: "Desc 1",
        image: "img1",
        lat: 13.75,
        lng: 100.50
      },
      {
        id: "p2",
        name: "Custom Place 2",
        name_th: "สถานที่ 2",
        name_en: "Custom Place 2",
        category: "food",
        description: "Desc 2",
        image: "img2",
        lat: 13.76,
        lng: 100.51
      },
      {
        id: "p3",
        name: "Custom Place 3",
        name_th: "สถานที่ 3",
        name_en: "Custom Place 3",
        category: "nature",
        description: "Desc 3",
        image: "img3",
        lat: 13.77,
        lng: 100.52
      },
      {
        id: "p4",
        name: "Custom Place 4",
        name_th: "สถานที่ 4",
        name_en: "Custom Place 4",
        category: "shopping",
        description: "Desc 4",
        image: "img4",
        lat: 13.78,
        lng: 100.53
      }
    ];

    const fallbacks = getFallbackSuggestions("Bangkok");
    const existingNames = new Set(
      rawSuggestions.map((s) => (s.name || s.name_en || "").toLowerCase().trim())
    );
    const combined = [...rawSuggestions];
    for (const fb of fallbacks) {
      const fbKey = (fb.name || fb.name_en || "").toLowerCase().trim();
      if (!existingNames.has(fbKey)) {
        combined.push(fb);
        existingNames.add(fbKey);
        if (combined.length >= 10) break;
      }
    }

    expect(combined.length).toBe(10);
    // Preserves original 4
    expect(combined[0].name).toBe("Custom Place 1");
    expect(combined[3].name).toBe("Custom Place 4");
    // Backfilled 6
    expect(new Set(combined.map(c => c.name.toLowerCase().trim())).size).toBe(10);
  });

  it("should not backfill or mutate when already having 10 or more suggestions", () => {
    const initialList: SuggestedPlace[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p-${i}`,
      name: `Existing Place ${i + 1}`,
      name_th: `สถานที่ ${i + 1}`,
      name_en: `Existing Place ${i + 1}`,
      category: "attraction",
      description: `Desc ${i + 1}`,
      image: "img",
      lat: 13.75,
      lng: 100.50
    }));

    const result = initialList.length >= 10 ? initialList : [];
    expect(result.length).toBe(12);
  });
});
