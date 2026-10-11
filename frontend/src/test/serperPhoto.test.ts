import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeImageQuery,
  getPlaceImageFromCache,
  setPlaceImageInCache,
  isSerperConfigured,
  searchGoogleImagesViaSerper,
  fetchTopGoogleImage,
} from "@/services/serperClient";
import { isWikiTitleRelevant, extractPlaceSearchQueries, fetchSmartPhoto } from "@/services/photoService";
import { getSuggestedPlaceImage } from "@/components/AISuggestedPlaces";

describe("serperClient & Multi-Tier Image Cache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("normalizeImageQuery", () => {
    it("strips English action verbs and meal prefixes", () => {
      expect(normalizeImageQuery("Explore Senso-ji Temple")).toBe("senso-ji temple");
      expect(normalizeImageQuery("Visit Tokyo Skytree")).toBe("tokyo skytree");
      expect(normalizeImageQuery("Breakfast at Tsukiji Outer Market")).toBe("tsukiji outer market");
      expect(normalizeImageQuery("Dinner at Jay Fai")).toBe("jay fai");
    });

    it("strips Thai action prefixes", () => {
      expect(normalizeImageQuery("เที่ยววัดอรุณ")).toBe("วัดอรุณ");
      expect(normalizeImageQuery("ชมพระบรมมหาราชวัง")).toBe("พระบรมมหาราชวัง");
      expect(normalizeImageQuery("ทานอาหารที่เจ๊โอว")).toBe("เจ๊โอว");
      expect(normalizeImageQuery("แวะสยามพารากอน")).toBe("สยามพารากอน");
    });

    it("strips itinerary time tags and bracketed text", () => {
      expect(normalizeImageQuery("Senso-ji Temple - Day 1 Morning")).toBe("senso-ji temple");
      expect(normalizeImageQuery("(Tokyo Tower) [Observation Deck]")).toBe("tokyo tower observation deck");
    });
  });

  describe("Multi-Tier Image Cache & Multilingual Aliasing", () => {
    it("mirrors cached image across all multilingual aliases simultaneously", () => {
      const imageUrl = "https://images.example.com/sensoji.jpg";
      const mainName = "Senso-ji Temple";
      const aliases = ["วัดเซ็นโซจิ", "浅草寺", "Asakusa Kannon Temple"];

      setPlaceImageInCache(mainName, imageUrl, aliases);

      // Verify L1 Memory Cache resolution for all aliases
      expect(getPlaceImageFromCache("Senso-ji Temple")).toBe(imageUrl);
      expect(getPlaceImageFromCache("senso-ji temple")).toBe(imageUrl);
      expect(getPlaceImageFromCache("วัดเซ็นโซจิ")).toBe(imageUrl);
      expect(getPlaceImageFromCache("浅草寺")).toBe(imageUrl);
      expect(getPlaceImageFromCache("Asakusa Kannon Temple")).toBe(imageUrl);

      // Verify L2 localStorage persistence
      expect(localStorage.getItem("img_cache:senso-ji temple")).toBe(imageUrl);
      expect(localStorage.getItem("img_cache:วัดเซ็นโซจิ")).toBe(imageUrl);
      expect(localStorage.getItem("img_cache:浅草寺")).toBe(imageUrl);
    });

    it("returns null for unknown queries", () => {
      expect(getPlaceImageFromCache("Unknown Nonexistent Place 12345")).toBeNull();
    });
  });

  describe("Serper API fail-safe fallback", () => {
    it("returns empty results when Serper is not configured without throwing errors", async () => {
      const results = await searchGoogleImagesViaSerper("Nonexistent Place");
      expect(Array.isArray(results)).toBe(true);
    });

    it("fetchTopGoogleImage returns cached image if already present", async () => {
      const url = "https://images.example.com/eiffel.jpg";
      setPlaceImageInCache("Eiffel Tower", url, ["หอไอเฟล"]);

      const fetched = await fetchTopGoogleImage("หอไอเฟล");
      expect(fetched).toBe(url);
    });
  });

  describe("CJK and Multilingual Token Relevance in photoService", () => {
    it("accepts CJK titles and tokens without wiping them to empty strings", () => {
      expect(isWikiTitleRelevant("浅草寺", "浅草寺", "浅草寺")).toBe(true);
      expect(isWikiTitleRelevant("Sensō-ji", "sensoji", "Senso-ji")).toBe(true);
      expect(isWikiTitleRelevant("วัดอรุณราชวรารามราชวรมหาวิหาร", "วัดอรุณ", "วัดอรุณ")).toBe(true);
    });

    it("rejects generic geographic titles to prevent landmark leak", () => {
      expect(isWikiTitleRelevant("Thailand", "Suan Luang Rama 9", "Suan Luang Rama 9")).toBe(false);
      expect(isWikiTitleRelevant("Japan", "Tokyo Tower", "Tokyo Tower")).toBe(false);
    });

    it("extracts clean search candidate queries", () => {
      const queries = extractPlaceSearchQueries("เที่ยววัดพระแก้ว (Grand Palace)", "Bangkok");
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.some((q) => q.toLowerCase().includes("วัดพระแก้ว") || q.toLowerCase().includes("grand palace"))).toBe(true);
    });
  });

  describe("AI Suggested Places Photo Integration", () => {
    it("getSuggestedPlaceImage resolves from Multi-Tier Cache with high priority", () => {
      const realPhoto = "https://images.example.com/real-jay-fai.jpg";

      setPlaceImageInCache("Jay Fai", realPhoto, ["เจ๊ไฝ", "Raan Jay Fai"]);

      const suggestedItem = {
        id: "sug-1",
        name: "เจ๊ไฝ",
        english_name: "Jay Fai",
        category: "food" as const,
        description: "Michelin star crab omelette",
        image: "https://images.unsplash.com/photo-fallback",
        photo_url: "https://images.unsplash.com/photo-fallback",
        lat: 13.75,
        lng: 100.5,
      };

      // Even though photo_url was a fallback, getSuggestedPlaceImage returns the cached real photo!
      const resolved = getSuggestedPlaceImage(suggestedItem, "Bangkok");
      expect(resolved).toBe(realPhoto);
    });

    it("mirrors manual photo changes on suggested place to cache across all aliases", () => {
      const manualPhoto = "https://images.example.com/user-chosen-cafe.jpg";
      const place = {
        id: "sug-2",
        name: "After You Dessert Cafe",
        name_th: "อาฟเตอร์ ยู",
        english_name: "After You",
        category: "food" as const,
        description: "Shibuya honey toast",
        image: "",
        lat: 13.73,
        lng: 100.58,
      };

      setPlaceImageInCache(place.name, manualPhoto, [place.name_th, place.english_name]);

      expect(getPlaceImageFromCache("อาฟเตอร์ ยู")).toBe(manualPhoto);
      expect(getPlaceImageFromCache("After You")).toBe(manualPhoto);
      expect(getSuggestedPlaceImage(place, "Bangkok")).toBe(manualPhoto);
    });
  });
});
