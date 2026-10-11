import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isGoogleMapsUrl,
  extractGoogleMapsUrl,
  parseGoogleMapsUrlClientSide,
  resolveGoogleMapsUrl,
} from "@/services/googleMapsService";

describe("Google Maps Service — URL Detection & Parsing", () => {
  describe("isGoogleMapsUrl", () => {
    it("identifies short Google Maps URLs (mobile share)", () => {
      expect(isGoogleMapsUrl("https://maps.app.goo.gl/r6M3aM5sK8yY9xAb7")).toBe(true);
      expect(isGoogleMapsUrl("http://goo.gl/maps/bKj9v8e")).toBe(true);
    });

    it("identifies full web Google Maps URLs", () => {
      expect(
        isGoogleMapsUrl(
          "https://www.google.com/maps/place/Keio+Plaza+Hotel+Tokyo/@35.689634,139.692101,17z"
        )
      ).toBe(true);
      expect(
        isGoogleMapsUrl(
          "https://www.google.co.th/maps/place/%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B9%81%E0%B8%A3%E0%B8%A1/@13.72,100.52,17z"
        )
      ).toBe(true);
      expect(isGoogleMapsUrl("https://maps.google.com/?q=13.7238,100.5283")).toBe(true);
      expect(isGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=Hilton")).toBe(true);
    });

    it("returns false for non-Google Maps URLs and regular text", () => {
      expect(isGoogleMapsUrl("https://example.com/hotel")).toBe(false);
      expect(isGoogleMapsUrl("Keio Plaza Hotel Tokyo")).toBe(false);
      expect(isGoogleMapsUrl("")).toBe(false);
      expect(isGoogleMapsUrl(null as any)).toBe(false);
    });
  });

  describe("extractGoogleMapsUrl", () => {
    it("extracts URL from text copied from mobile share dialog", () => {
      const sharedText =
        "Check out The Standard Bangkok on Google Maps: https://maps.app.goo.gl/r6M3aM5sK8yY9xAb7";
      expect(extractGoogleMapsUrl(sharedText)).toBe(
        "https://maps.app.goo.gl/r6M3aM5sK8yY9xAb7"
      );
    });

    it("strips trailing punctuation from URL", () => {
      const text = "See: https://www.google.com/maps/place/Hotel/@35.6,139.7,17z.";
      expect(extractGoogleMapsUrl(text)).toBe(
        "https://www.google.com/maps/place/Hotel/@35.6,139.7,17z"
      );
    });

    it("returns null when no Google Maps URL is present", () => {
      expect(extractGoogleMapsUrl("Just a hotel name")).toBeNull();
      expect(extractGoogleMapsUrl("https://other-site.com/map")).toBeNull();
    });
  });

  describe("parseGoogleMapsUrlClientSide", () => {
    it("extracts place name and pin coordinates from full Google Maps URL", () => {
      const url =
        "https://www.google.com/maps/place/Keio+Plaza+Hotel+Tokyo/@35.689634,139.692101,17z/data=!3m1!4b1!4m9!3m8!1s0x60188cd656641ab3:0xdc178223d6a365df!3m2!1d35.689634!2d139.692101!16zL20vMDdja3Zf";
      const parsed = parseGoogleMapsUrlClientSide(url);

      expect(parsed.name).toBe("Keio Plaza Hotel Tokyo");
      expect(parsed.lat).toBeCloseTo(35.689634, 5);
      expect(parsed.lng).toBeCloseTo(139.692101, 5);
      expect(parsed.isShortUrl).toBe(false);
      expect(parsed.placeId).toBe("0x60188cd656641ab3:0xdc178223d6a365df");
    });

    it("decodes URL-encoded Thai hotel names correctly", () => {
      const encodedName = encodeURIComponent("โรงแรมแมนดาริน โอเรียนเต็ล กรุงเทพ");
      const url = `https://www.google.co.th/maps/place/${encodedName}/@13.7226,100.5147,17z`;
      const parsed = parseGoogleMapsUrlClientSide(url);

      expect(parsed.name).toBe("โรงแรมแมนดาริน โอเรียนเต็ล กรุงเทพ");
      expect(parsed.lat).toBeCloseTo(13.7226, 4);
      expect(parsed.lng).toBeCloseTo(100.5147, 4);
    });

    it("extracts coordinates from query parameters (q=lat,lng)", () => {
      const url = "https://maps.google.com/?q=13.7563,100.5018";
      const parsed = parseGoogleMapsUrlClientSide(url);

      expect(parsed.lat).toBeCloseTo(13.7563, 4);
      expect(parsed.lng).toBeCloseTo(100.5018, 4);
    });

    it("identifies short URLs as requiring server-side expansion", () => {
      const shortUrl = "https://maps.app.goo.gl/r6M3aM5sK8yY9xAb7";
      const parsed = parseGoogleMapsUrlClientSide(shortUrl);

      expect(parsed.isShortUrl).toBe(true);
      expect(parsed.name).toBeUndefined();
    });
  });

  describe("resolveGoogleMapsUrl", () => {
    it("rejects non-Google Maps URLs with descriptive error", async () => {
      await expect(resolveGoogleMapsUrl("https://example.com")).rejects.toThrow(
        "ไม่ใช่ลิงก์ Google Maps ที่ถูกต้อง"
      );
    });

    it("resolves full place URLs and preserves exact pin coordinates for Itinerary", async () => {
      const url =
        "https://www.google.com/maps/place/Park+Hyatt+Tokyo/@35.6853,139.6912,17z/data=!3m1!4b1!4m9!3m8!1s0x60188cd6:0x123456!3m2!1d35.6853!2d139.6912!16zL20vMDdja3Zf";

      const result = await resolveGoogleMapsUrl(url);

      expect(result.name).toContain("Park Hyatt");
      expect(result.lat).toBeCloseTo(35.6853, 4);
      expect(result.lng).toBeCloseTo(139.6912, 4);
    }, 15000);
  });
});
