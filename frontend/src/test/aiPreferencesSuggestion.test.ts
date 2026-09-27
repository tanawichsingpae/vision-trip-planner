import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateLocalHeuristicSuggestion,
  suggestTripPreferencesFromVision,
} from "@/services/aiService";

describe("AI Smart Preferences Suggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateLocalHeuristicSuggestion", () => {
    it("should suggest culture & spiritual activities for temple locations", () => {
      const locations = [
        { place: "Wat Phra Kaew", type: "temple", detected_content: "ancient pagoda, golden statue" },
        { place: "Wat Arun", type: "temple", detected_content: "riverside pagoda, porcelain temple" },
        { place: "Grand Palace", type: "palace", detected_content: "royal palace architecture" },
      ];

      const suggestion = generateLocalHeuristicSuggestion(locations, "Bangkok", "th", "Gemini 2.5 Flash");

      expect(suggestion.activities).toContain("culture");
      expect(suggestion.recommendedDays).toBe(3);
      expect(suggestion.themeTitle).toContain("มรดกวัฒนธรรม");
      expect(suggestion.modelLabel).toBe("Gemini 2.5 Flash");
    });

    it("should suggest nature & relax activities for beach & island locations", () => {
      const locations = [
        { place: "Railay Beach", type: "beach", detected_content: "limestone cliff, turquoise sea, resort" },
        { place: "Ao Nang Beach", type: "beach", detected_content: "sunset, longtail boat, relaxing beach" },
      ];

      const suggestion = generateLocalHeuristicSuggestion(locations, "Krabi", "th", "Gemini 2.5 Flash");

      expect(suggestion.activities).toContain("nature");
      expect(suggestion.travelerType).toBe("couple");
      expect(suggestion.pace).toBe("relaxed");
      expect(suggestion.recommendedDays).toBe(2);
    });

    it("should suggest adventure & friends for hiking & outdoor locations", () => {
      const locations = [
        { place: "Doi Inthanon Trail", type: "mountain", detected_content: "hiking trail, misty forest, trekking" },
        { place: "Kew Mae Pan", type: "viewpoint", detected_content: "cliff walk, adventure trekking" },
        { place: "Wachirathan Waterfall", type: "waterfall", detected_content: "roaring waterfall in lush nature" },
        { place: "Ang Ka Nature Trail", type: "park", detected_content: "wooden boardwalk in rain forest" },
      ];

      const suggestion = generateLocalHeuristicSuggestion(locations, "Chiang Mai", "th", "GPT-4o Mini");

      expect(suggestion.activities).toContain("adventure");
      expect(suggestion.activities).toContain("nature");
      expect(suggestion.recommendedDays).toBe(3);
      expect(suggestion.modelLabel).toBe("GPT-4o Mini");
    });
  });

  describe("suggestTripPreferencesFromVision", () => {
    it("should return valid suggestion even if API fails or is offline", async () => {
      // Mock fetch to simulate offline or API failure
      global.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));

      const locations = [
        { place: "Chinatown Yaowarat", type: "market", detected_content: "street food stalls, noodles, neon signs" },
        { place: "Talat Phlu", type: "eatery", detected_content: "crispy chive cakes, local dining, cafe" },
      ];

      const suggestion = await suggestTripPreferencesFromVision(
        locations,
        "Bangkok",
        "google-gemini-38-flash",
        "th"
      );

      expect(suggestion).toBeDefined();
      expect(suggestion.themeTitle).toBeDefined();
      expect(suggestion.activities).toContain("food");
      expect(suggestion.recommendedDays).toBeGreaterThanOrEqual(1);
      expect(suggestion.budgetRange.length).toBe(2);
    });

    it("should handle empty locations gracefully", async () => {
      const suggestion = await suggestTripPreferencesFromVision(
        [],
        "Bangkok",
        "google-gemini-38-flash",
        "th"
      );

      expect(suggestion).toBeDefined();
      expect(suggestion.recommendedDays).toBe(2);
      expect(suggestion.activities.length).toBeGreaterThan(0);
    });
  });
});
