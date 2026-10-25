import { describe, it, expect } from "vitest";
import {
  deduplicateItineraryActivities,
  isGenericZonePlace,
  normalizePlaceKey,
  getFallbackSuggestions
} from "@/data/fallbackPlaces";
import { DayPlan, Activity } from "@/components/TravelItinerary";

describe("Itinerary Deduplication & Zone Place Minimization", () => {
  describe("normalizePlaceKey", () => {
    it("should normalize strings consistently regardless of casing, accents, or punctuation", () => {
      expect(normalizePlaceKey("Wat Pho (Temple of Reclining Buddha)")).toBe("watpho");
      expect(normalizePlaceKey("Bangkok City Landmark & Park")).toBe("bangkokcitylandmarkpark");
      expect(normalizePlaceKey("Chatuchak Weekend Market!")).toBe("chatuchakweekendmarket");
    });
  });

  describe("isGenericZonePlace", () => {
    it("should identify generic zone placeholder names", () => {
      expect(isGenericZonePlace("Bangkok City Landmark & Park")).toBe(true);
      expect(isGenericZonePlace("Bangkok Cultural Center & Heritage")).toBe(true);
      expect(isGenericZonePlace("Tokyo City Center & Landmark")).toBe(true);
      expect(isGenericZonePlace("Chiang Mai Old City Area")).toBe(true);
    });

    it("should NOT identify authentic specific POIs as generic zones", () => {
      expect(isGenericZonePlace("Wat Arun")).toBe(false);
      expect(isGenericZonePlace("Mahanakhon SkyWalk")).toBe(false);
      expect(isGenericZonePlace("Grand Palace")).toBe(false);
      expect(isGenericZonePlace("Jim Thompson House")).toBe(false);
      expect(isGenericZonePlace("Senso-ji Temple")).toBe(false);
    });
  });

  describe("deduplicateItineraryActivities", () => {
    it("should eliminate intra-day duplicates by replacing them with curated authentic POIs", () => {
      const mockDays: DayPlan[] = [
        {
          day: 1,
          date: "Day 1",
          activities: [
            {
              id: "act-1",
              time: "09:00",
              title: "Wat Arun",
              description: "Temple of Dawn",
              type: "landmark",
              lat: 13.7437,
              lng: 100.4888,
            },
            {
              id: "act-2",
              time: "11:00",
              title: "Wat Arun", // Duplicate on same day!
              description: "Temple of Dawn repeated",
              type: "landmark",
              lat: 13.7437,
              lng: 100.4888,
            },
          ],
        },
      ];

      const result = deduplicateItineraryActivities(mockDays, "Bangkok");
      expect(result[0].activities.length).toBe(2);
      expect(result[0].activities[0].title).toBe("Wat Arun");
      // The second activity must be replaced with a non-duplicate authentic spot
      expect(result[0].activities[1].title).not.toBe("Wat Arun");
      expect(result[0].activities[1].title.length).toBeGreaterThan(0);
    });

    it("should eliminate cross-day duplicates across multi-day itineraries", () => {
      const mockDays: DayPlan[] = [
        {
          day: 1,
          date: "Day 1",
          activities: [
            {
              id: "act-1-1",
              time: "10:00",
              title: "Mahanakhon SkyWalk",
              description: "Skywalk view",
              type: "landmark",
              lat: 13.7225,
              lng: 100.5283,
            },
          ],
        },
        {
          day: 2,
          date: "Day 2",
          activities: [
            {
              id: "act-2-1",
              time: "10:00",
              title: "Mahanakhon SkyWalk", // Duplicate on Day 2!
              description: "Skywalk view repeated",
              type: "landmark",
              lat: 13.7225,
              lng: 100.5283,
            },
          ],
        },
      ];

      const result = deduplicateItineraryActivities(mockDays, "Bangkok");
      expect(result[0].activities[0].title).toBe("Mahanakhon SkyWalk");
      expect(result[1].activities[0].title).not.toBe("Mahanakhon SkyWalk");
      // Ensure all activities across all days are completely unique
      const allTitles = result.flatMap(d => d.activities.map(a => normalizePlaceKey(a.title)));
      const uniqueTitles = new Set(allTitles);
      expect(uniqueTitles.size).toBe(allTitles.length);
    });

    it("should replace generic non-restaurant zone places like 'Bangkok City Landmark & Park'", () => {
      const mockDays: DayPlan[] = [
        {
          day: 1,
          date: "Day 1",
          activities: [
            {
              id: "act-zone-1",
              time: "09:00",
              title: "Bangkok City Landmark & Park", // Generic zone!
              description: "Explore city landmarks",
              type: "landmark",
              lat: 13.75,
              lng: 100.5,
            },
            {
              id: "act-zone-2",
              time: "14:00",
              title: "Bangkok Cultural Center & Heritage", // Generic zone!
              description: "Cultural hub",
              type: "culture",
              lat: 13.75,
              lng: 100.5,
            },
          ],
        },
      ];

      const result = deduplicateItineraryActivities(mockDays, "Bangkok");
      expect(result[0].activities[0].title).not.toContain("Bangkok City Landmark & Park");
      expect(result[0].activities[1].title).not.toContain("Bangkok Cultural Center & Heritage");
      // Should have authentic POI titles
      expect(isGenericZonePlace(result[0].activities[0].title)).toBe(false);
      expect(isGenericZonePlace(result[0].activities[1].title)).toBe(false);
    });

    it("should cap zone dining to at most 1 per day to prevent aimless itineraries", () => {
      const mockDays: DayPlan[] = [
        {
          day: 1,
          date: "Day 1",
          activities: [
            {
              id: "act-food-1",
              time: "12:00",
              title: "Lunch near Bangkok Center", // 1st zone dining
              description: "Local delicacies",
              type: "food",
              lat: 13.75,
              lng: 100.5,
            },
            {
              id: "act-food-2",
              time: "18:00",
              title: "Street Food Dinner near Bangkok Center", // 2nd zone dining on same day
              description: "Evening food",
              type: "food",
              lat: 13.75,
              lng: 100.5,
            },
          ],
        },
      ];

      const result = deduplicateItineraryActivities(mockDays, "Bangkok");
      // First one is allowed as the 1 zone dining
      expect(result[0].activities[0].title).toBe("Lunch near Bangkok Center");
      // Second one must be replaced because zone dining is capped at 1 per day
      expect(result[0].activities[1].title).not.toBe("Street Food Dinner near Bangkok Center");
    });

    it("must strictly preserve user-uploaded photo activities and hotel activities", () => {
      const userPhotoAct: Activity = {
        id: "user-photo-1",
        time: "10:00",
        title: "Wat Phra Kaew",
        description: "Uploaded by user",
        type: "landmark",
        lat: 13.7514,
        lng: 100.4926,
        isUserPhoto: true,
      };

      const hotelCheckIn: Activity = {
        id: "hotel-1",
        time: "15:00",
        title: "Check in: The Standard Bangkok",
        description: "Hotel check-in",
        type: "hotel",
        lat: 13.7225,
        lng: 100.5283,
      };

      const mockDays: DayPlan[] = [
        {
          day: 1,
          date: "Day 1",
          activities: [
            userPhotoAct,
            hotelCheckIn,
            {
              id: "act-dup",
              time: "16:00",
              title: "Wat Phra Kaew", // AI generated duplicate of user's photo spot!
              description: "AI duplicate",
              type: "landmark",
              lat: 13.7514,
              lng: 100.4926,
            },
          ],
        },
      ];

      const result = deduplicateItineraryActivities(mockDays, "Bangkok");
      // User photo is intact
      expect(result[0].activities[0].title).toBe("Wat Phra Kaew");
      expect(result[0].activities[0].isUserPhoto).toBe(true);

      // Hotel is intact
      expect(result[0].activities[1].title).toBe("Check in: The Standard Bangkok");
      expect(result[0].activities[1].type).toBe("hotel");

      // Duplicate of user photo is replaced so user photo remains unique
      expect(result[0].activities[2].title).not.toBe("Wat Phra Kaew");
    });
  });
});
