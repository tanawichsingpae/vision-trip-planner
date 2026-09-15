import { describe, it, expect } from "vitest";
import {
  getLocalizedPlace,
  getLocalizedDescription,
  UI_STRINGS,
  type LocalizablePlace,
  type LocalizableDescription,
} from "@/context/LanguageContext";

describe("LanguageContext & Localization Helpers", () => {
  describe("getLocalizedPlace()", () => {
    it("returns Thai place name when language is 'th'", () => {
      const item: LocalizablePlace = {
        title_th: "กำแพงเมืองจีน ด่านมู่เถียนยวี่",
        title_en: "Mutianyu Great Wall",
        title: "慕田峪长城",
        english_name: "Mutianyu Great Wall",
      };
      expect(getLocalizedPlace(item, "th")).toBe("กำแพงเมืองจีน ด่านมู่เถียนยวี่");
    });

    it("returns English place name when language is 'en'", () => {
      const item: LocalizablePlace = {
        title_th: "กำแพงเมืองจีน ด่านมู่เถียนยวี่",
        title_en: "Mutianyu Great Wall",
        title: "慕田峪长城",
        english_name: "Mutianyu Great Wall",
      };
      expect(getLocalizedPlace(item, "en")).toBe("Mutianyu Great Wall");
    });

    it("falls back gracefully to place_th / place_en if title_th / title_en are omitted", () => {
      const item: LocalizablePlace = {
        place_th: "วัดพระแก้ว",
        place_en: "Temple of the Emerald Buddha",
      };
      expect(getLocalizedPlace(item, "th")).toBe("วัดพระแก้ว");
      expect(getLocalizedPlace(item, "en")).toBe("Temple of the Emerald Buddha");
    });

    it("supports name_th and name_en for SuggestedPlace and Accommodations", () => {
      const hotelPlace: LocalizablePlace = {
        name: "The Berkeley Hotel Pratunam",
        name_th: "โรงแรมเดอะ เบอร์เคลีย์ ประตูน้ำ",
        name_en: "The Berkeley Hotel Pratunam",
      };
      expect(getLocalizedPlace(hotelPlace, "th")).toBe("โรงแรมเดอะ เบอร์เคลีย์ ประตูน้ำ");
      expect(getLocalizedPlace(hotelPlace, "en")).toBe("The Berkeley Hotel Pratunam");
    });

    it("localizes Check in and Check out activities cleanly", () => {
      const checkInItem: LocalizablePlace = {
        title: "Check in: Grand Hyatt",
      };
      expect(getLocalizedPlace(checkInItem, "th")).toBe("เช็คอิน: Grand Hyatt");

      const checkOutItem: LocalizablePlace = {
        title: "Check out: Grand Hyatt",
      };
      expect(getLocalizedPlace(checkOutItem, "th")).toBe("เช็คเอาต์: Grand Hyatt");

      const thaiCheckIn: LocalizablePlace = {
        title: "เช็คอิน: โรงแรมหรู",
      };
      expect(getLocalizedPlace(thaiCheckIn, "en")).toBe("Check in: โรงแรมหรู");
    });

    it("translates direct travel dictionary terms", () => {
      expect(getLocalizedPlace({ title: "hotel" }, "th")).toBe("โรงแรม");
      expect(getLocalizedPlace({ title: "วัด" }, "en")).toBe("Wat (Temple)");
      expect(getLocalizedPlace({ title: "night market" }, "th")).toBe("ตลาดนัดกลางคืน");
    });

    it("falls back to english_name or title when localized field is absent", () => {
      const legacyItem: LocalizablePlace = {
        title: "Senso-ji Temple",
        english_name: "Senso-ji Temple",
      };
      expect(getLocalizedPlace(legacyItem, "th")).toBe("Senso-ji Temple");
      expect(getLocalizedPlace(legacyItem, "en")).toBe("Senso-ji Temple");
    });

    it("handles null and undefined gracefully", () => {
      expect(getLocalizedPlace(null, "th")).toBe("");
      expect(getLocalizedPlace(undefined, "en")).toBe("");
    });
  });

  describe("getLocalizedDescription()", () => {
    it("returns Thai description when language is 'th'", () => {
      const item: LocalizableDescription = {
        description_th: "ชมกำแพงเมืองจีนอันยิ่งใหญ่ ท่ามกลางธรรมชาติขุนเขาเขียวขจี",
        description_en: "Experience the magnificent Great Wall surrounded by lush green mountains",
        description: "Great Wall visit",
      };
      expect(getLocalizedDescription(item, "th")).toBe(
        "ชมกำแพงเมืองจีนอันยิ่งใหญ่ ท่ามกลางธรรมชาติขุนเขาเขียวขจี"
      );
    });

    it("returns English description when language is 'en'", () => {
      const item: LocalizableDescription = {
        description_th: "ชมกำแพงเมืองจีนอันยิ่งใหญ่ ท่ามกลางธรรมชาติขุนเขาเขียวขจี",
        description_en: "Experience the magnificent Great Wall surrounded by lush green mountains",
        description: "Great Wall visit",
      };
      expect(getLocalizedDescription(item, "en")).toBe(
        "Experience the magnificent Great Wall surrounded by lush green mountains"
      );
    });

    it("falls back to default description when localized version is missing", () => {
      const item: LocalizableDescription = {
        description: "Explore the bustling street food night market",
      };
      expect(getLocalizedDescription(item, "th")).toBe(
        "Explore the bustling street food night market"
      );
      expect(getLocalizedDescription(item, "en")).toBe(
        "Explore the bustling street food night market"
      );
    });

    it("handles empty description gracefully", () => {
      expect(getLocalizedDescription(null, "th")).toBe("");
      expect(getLocalizedDescription(undefined, "en")).toBe("");
    });
  });

  describe("UI_STRINGS consistency", () => {
    it("has matching keys in both Thai and English dictionaries", () => {
      const thKeys = Object.keys(UI_STRINGS.th).sort();
      const enKeys = Object.keys(UI_STRINGS.en).sort();
      expect(thKeys).toEqual(enKeys);
    });

    it("contains essential UI labels including Map and Itinerary Overview", () => {
      const requiredKeys = [
        "myTrips",
        "saveTrip",
        "itineraryTitle",
        "daysCount",
        "dayPrefix",
        "identifiedLocations",
        "reloadMap",
        "aiReview",
        "cancel",
        "interactiveMap",
        "allDays",
        "map",
        "satellite",
        "itineraryOverview",
        "totalSpots",
        "newSuggestions",
        "findAccommodations",
      ];
      requiredKeys.forEach((key) => {
        expect(UI_STRINGS.th).toHaveProperty(key);
        expect(UI_STRINGS.en).toHaveProperty(key);
      });
    });
  });
});
