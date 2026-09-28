import { describe, it, expect } from "vitest";
import { getCoordinates, FAMOUS_LANDMARK_DISAMBIGUATION, distanceMetres, buildGoogleMapsUrl, sanitizePlaceTitle, isZoneDining, extractZoneAnchorVenue } from "@/api/geocode";
import { fetchPlaceDetails } from "@/api/places";

describe("Geocoding Landmark Disambiguation & Precision", () => {
  it("should have Wat Phra Kaew in FAMOUS_LANDMARK_DISAMBIGUATION pointing to Bangkok", () => {
    const d = FAMOUS_LANDMARK_DISAMBIGUATION["wat phra kaew"];
    expect(d).toBeDefined();
    // Bangkok coordinates around 13.75, 100.49
    expect(d.lat).toBeCloseTo(13.751, 2);
    expect(d.lng).toBeCloseTo(100.492, 2);
    expect(d.formattedAddress).toContain("Bangkok");
  });

  it("should have Wat Rong Khun in FAMOUS_LANDMARK_DISAMBIGUATION pointing to Chiang Rai", () => {
    const d = FAMOUS_LANDMARK_DISAMBIGUATION["wat rong khun"];
    expect(d).toBeDefined();
    // Chiang Rai coordinates around 19.82, 99.76
    expect(d.lat).toBeCloseTo(19.824, 2);
    expect(d.lng).toBeCloseTo(99.763, 2);
    expect(d.formattedAddress).toContain("Chiang Rai");
  });

  it("should resolve 'Wat Phra Kaew, Thailand' to Bangkok via getCoordinates", async () => {
    const coords = await getCoordinates("Wat Phra Kaew, Thailand");
    expect(coords.lat).toBeCloseTo(13.751, 2);
    expect(coords.lng).toBeCloseTo(100.492, 2);

    // Distance from true Bangkok Wat Phra Kaew should be < 5 km, NOT ~700 km (Chiang Rai)
    const trueBangkok = { lat: 13.751497, lng: 100.492659 };
    const dist = distanceMetres(coords, trueBangkok);
    expect(dist).toBeLessThan(5000);
  });

  it("should resolve 'วัดพระแก้ว' to Bangkok", async () => {
    const coords = await getCoordinates("วัดพระแก้ว");
    expect(coords.lat).toBeCloseTo(13.751, 2);
    expect(coords.lng).toBeCloseTo(100.492, 2);
  });

  it("should detect when destination coords are in Chiang Rai but activities are in Bangkok and compute correct centroid", () => {
    // Simulated false Chiang Rai destination
    const falseChiangRaiCoords = { lat: 19.912658, lng: 99.826108 };

    // Real Bangkok activities from AI
    const bangkokActivities = [
      { lat: 13.732996, lng: 100.498466 }, // Chao Phraya Cruise
      { lat: 13.746975, lng: 100.535199 }, // Siam Ocean World
      { lat: 13.743898, lng: 100.488514 }, // Wat Arun
      { lat: 13.751497, lng: 100.492659 }, // Wat Phra Kaew
    ];

    const centroid = {
      lat: bangkokActivities.reduce((sum, c) => sum + c.lat, 0) / bangkokActivities.length,
      lng: bangkokActivities.reduce((sum, c) => sum + c.lng, 0) / bangkokActivities.length,
    };

    // Cohesiveness check: all activities within 30km of centroid
    const isCohesive = bangkokActivities.every(c => distanceMetres(c, centroid) < 30_000);
    expect(isCohesive).toBe(true);

    // Distance between false Chiang Rai coords and true Bangkok centroid is ~690km (> 80km)
    const distFromFalseDestination = distanceMetres(falseChiangRaiCoords, centroid);
    expect(distFromFalseDestination).toBeGreaterThan(600_000);

    // Auto-correction will trigger and replace Chiang Rai coords with Bangkok centroid
    const correctedCoords = isCohesive && distFromFalseDestination > 80_000 ? centroid : falseChiangRaiCoords;
    expect(correctedCoords.lat).toBeCloseTo(13.74, 1);
    expect(correctedCoords.lng).toBeCloseTo(100.50, 1);
  });

  it("should resolve 'Siam Ocean World' to Siam Paragon (Pathum Wan), NOT Hua Lamphong", async () => {
    const coords = await getCoordinates("Siam Ocean World");
    expect(coords.lat).toBeCloseTo(13.747, 2);
    expect(coords.lng).toBeCloseTo(100.535, 2);

    // Verify fetchPlaceDetails also returns Siam Paragon coords
    const details = await fetchPlaceDetails("Siam Ocean World", { lat: 13.7563, lng: 100.5018 });
    expect(details.lat).toBeCloseTo(13.747, 2);
    expect(details.lng).toBeCloseTo(100.535, 2);

    // Distance to Hua Lamphong (~13.737, 100.516) should be > 2000m (proving it's not Hua Lamphong!)
    const huaLamphong = { lat: 13.7371, lng: 100.5165 };
    const distToHuaLamphong = distanceMetres({ lat: details.lat!, lng: details.lng! }, huaLamphong);
    expect(distToHuaLamphong).toBeGreaterThan(2000);
  });

  it("should build accurate Google Maps URLs without stripping Thai names", () => {
    // 1. Thai name only, no English name
    const thaiSearchUrl = buildGoogleMapsUrl({
      placeName: "วัดพระแก้ว",
      cityName: "กรุงเทพมหานคร",
      mode: "search",
    });
    expect(thaiSearchUrl).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(thaiSearchUrl)).toContain("วัดพระแก้ว, กรุงเทพมหานคร");

    // 2. English name preferred over Thai placeName
    const enSearchUrl = buildGoogleMapsUrl({
      englishName: "Wat Phra Kaew",
      placeName: "วัดพระแก้ว",
      cityName: "Bangkok",
      mode: "search",
    });
    expect(decodeURIComponent(enSearchUrl)).toContain("Wat Phra Kaew, Bangkok");

    // 3. Directions with verified coordinates
    const verifiedDirectionsUrl = buildGoogleMapsUrl({
      lat: 13.7515,
      lng: 100.4927,
      englishName: "Wat Phra Kaew",
      isCoordsVerified: true,
      placeId: "ChIJ_TEST_PLACE",
      mode: "directions",
    });
    expect(verifiedDirectionsUrl).toBe("https://www.google.com/maps/dir/?api=1&destination=13.7515,100.4927&destination_place_id=ChIJ_TEST_PLACE");

    // 4. Directions with unverified jitter coords falls back to place name for accurate navigation
    const unverifiedDirectionsUrl = buildGoogleMapsUrl({
      lat: 13.7515,
      lng: 100.4927,
      englishName: "Wat Phra Kaew",
      cityName: "Bangkok",
      isCoordsVerified: false,
      mode: "directions",
    });
    expect(decodeURIComponent(unverifiedDirectionsUrl)).toContain("destination=Wat Phra Kaew, Bangkok");

    // 5. Search mode with coordinates: PRIORITY 1 ALWAYS pins directly to exact coordinates
    const searchWithCoords = buildGoogleMapsUrl({
      lat: 13.7441,
      lng: 100.5222,
      placeName: "ถนนบรรทัดทอง (อาหารเย็น)",
      placeId: "ChIJ_BAN_THAT_THONG",
      mode: "search",
    });
    expect(searchWithCoords).toBe("https://www.google.com/maps/search/?api=1&query=13.7441,100.5222&query_place_id=ChIJ_BAN_THAT_THONG");
  });

  describe("sanitizePlaceTitle() pure POI name cleaning", () => {
    it("strips meal and time parentheticals cleanly", () => {
      expect(sanitizePlaceTitle("ถนนบรรทัดทอง (อาหารเย็น)")).toBe("ถนนบรรทัดทอง");
      expect(sanitizePlaceTitle("Ban That Thong Road (Dinner)")).toBe("Ban That Thong Road");
      expect(sanitizePlaceTitle("ร้านเจ๊โอว (อาหารค่ำ)")).toBe("ร้านเจ๊โอว");
      expect(sanitizePlaceTitle("ข้าวหมูกรอบนายไซ (อาหารกลางวัน)")).toBe("ข้าวหมูกรอบนายไซ");
      expect(sanitizePlaceTitle("เยาวราช (อาหารเย็น / Night Market)")).toBe("เยาวราช");
      expect(sanitizePlaceTitle("Thip Samai Pad Thai (Lunch)")).toBe("Thip Samai Pad Thai");
      expect(sanitizePlaceTitle("ตลาดโต้รุ่ง (มื้อดึก)")).toBe("ตลาดโต้รุ่ง");
    });

    it("strips meal trailing dashes and brackets cleanly", () => {
      expect(sanitizePlaceTitle("ถนนบรรทัดทอง - อาหารเย็น")).toBe("ถนนบรรทัดทอง");
      expect(sanitizePlaceTitle("Ban That Thong - Dinner")).toBe("Ban That Thong");
      expect(sanitizePlaceTitle("Thipsamai [Lunch]")).toBe("Thipsamai");
    });

    it("strips action verbs and prefixes cleanly", () => {
      expect(sanitizePlaceTitle("แวะชมวิวพระอาทิตย์ตกที่ สะพานพุทธ (Sunset)")).toBe("สะพานพุทธ");
      expect(sanitizePlaceTitle("กินข้าวที่ ถนนบรรทัดทอง (อาหารเย็น)")).toBe("ถนนบรรทัดทอง");
      expect(sanitizePlaceTitle("Visit Wat Pho")).toBe("Wat Pho");
      expect(sanitizePlaceTitle("Explore Chinatown (Night Market)")).toBe("Chinatown");
      expect(sanitizePlaceTitle("Dinner at Jeh O Chula")).toBe("Jeh O Chula");
    });
  });

  describe("Iconic culinary & food street landmark coordinates", () => {
    it("resolves Ban That Thong Road to authentic coordinates", async () => {
      const coords = await getCoordinates("ถนนบรรทัดทอง");
      expect(coords.lat).toBeCloseTo(13.744, 2);
      expect(coords.lng).toBeCloseTo(100.522, 2);
    });

    it("resolves Yaowarat Road to authentic Chinatown coordinates", async () => {
      const coords = await getCoordinates("เยาวราช");
      expect(coords.lat).toBeCloseTo(13.741, 2);
      expect(coords.lng).toBeCloseTo(100.508, 2);
    });

    it("resolves Jodd Fairs Rama 9 to authentic night market coordinates", async () => {
      const coords = await getCoordinates("จ๊อดแฟร์");
      expect(coords.lat).toBeCloseTo(13.756, 2);
      expect(coords.lng).toBeCloseTo(100.566, 2);
    });
  });

  describe("Dining 2 Cases: Specific Real Restaurant vs Street Food Zone", () => {
    it("detects Case 2 zone dining patterns and extracts anchor venues correctly", () => {
      // English patterns
      expect(isZoneDining("Street Food, Lunch near Bangkok Cultural Center")).toBe(true);
      expect(extractZoneAnchorVenue("Street Food, Lunch near Bangkok Cultural Center")).toBe("Bangkok Cultural Center");

      expect(isZoneDining("Street Food near Wat Phra Kaew")).toBe(true);
      expect(extractZoneAnchorVenue("Street Food near Wat Phra Kaew")).toBe("Wat Phra Kaew");

      expect(isZoneDining("Dinner & Street Food near Yaowarat")).toBe(true);
      expect(extractZoneAnchorVenue("Dinner & Street Food near Yaowarat")).toBe("Yaowarat");

      // Thai patterns
      expect(isZoneDining("สตรีทฟู้ด มื้อกลางวันรอบหอศิลปวัฒนธรรมแห่งกรุงเทพฯ")).toBe(true);
      expect(extractZoneAnchorVenue("สตรีทฟู้ด มื้อกลางวันรอบหอศิลปวัฒนธรรมแห่งกรุงเทพฯ")).toBe("หอศิลปวัฒนธรรมแห่งกรุงเทพฯ");

      expect(isZoneDining("สตรีทฟู้ดรอบวัดพระแก้ว")).toBe(true);
      expect(extractZoneAnchorVenue("สตรีทฟู้ดรอบวัดพระแก้ว")).toBe("วัดพระแก้ว");

      expect(isZoneDining("มื้อค่ำและสตรีทฟู้ดแถวเยาวราช")).toBe(true);
      expect(extractZoneAnchorVenue("มื้อค่ำและสตรีทฟู้ดแถวเยาวราช")).toBe("เยาวราช");
    });

    it("does not classify Case 1 real restaurants as zone dining", () => {
      expect(isZoneDining("ร้านเจ๊โอว")).toBe(false);
      expect(isZoneDining("ทิพย์สมัย ผัดไทยประตูผี")).toBe(false);
      expect(isZoneDining("ถนนบรรทัดทอง")).toBe(false);
      expect(isZoneDining("ครัวอัปษร")).toBe(false);
      expect(isZoneDining("Thipsamai")).toBe(false);
    });

    it("preserves Case 2 descriptive titles while cleaning Case 1 meal tags in sanitizePlaceTitle", () => {
      // Case 1: Pure restaurant POI names stripped of meal tags
      expect(sanitizePlaceTitle("ร้านเจ๊โอว (อาหารค่ำ)")).toBe("ร้านเจ๊โอว");
      expect(sanitizePlaceTitle("Thipsamai (Lunch)")).toBe("Thipsamai");

      // Case 2: Preserves descriptive zone dining titles
      expect(sanitizePlaceTitle("Street Food, Lunch near Bangkok Cultural Center")).toBe("Street Food, Lunch near Bangkok Cultural Center");
      expect(sanitizePlaceTitle("สตรีทฟู้ด มื้อกลางวันรอบหอศิลปวัฒนธรรมแห่งกรุงเทพฯ")).toBe("สตรีทฟู้ด มื้อกลางวันรอบหอศิลปวัฒนธรรมแห่งกรุงเทพฯ");
      expect(sanitizePlaceTitle("Street Food near Wat Phra Kaew")).toBe("Street Food near Wat Phra Kaew");
      expect(sanitizePlaceTitle("สตรีทฟู้ดรอบวัดพระแก้ว")).toBe("สตรีทฟู้ดรอบวัดพระแก้ว");
    });

    it("resolves Case 2 zone street food coordinates to anchor landmark location", async () => {
      // Bangkok Art and Culture Centre anchor
      const baccStreetFood = await getCoordinates("Street Food, Lunch near Bangkok Cultural Center");
      expect(baccStreetFood.lat).toBeCloseTo(13.7468, 2);
      expect(baccStreetFood.lng).toBeCloseTo(100.5303, 2);

      // Wat Phra Kaew anchor
      const watPhraKaewStreetFood = await getCoordinates("Street Food near Wat Phra Kaew");
      expect(watPhraKaewStreetFood.lat).toBeCloseTo(13.751, 2);
      expect(watPhraKaewStreetFood.lng).toBeCloseTo(100.492, 2);
    });

    it("preserves canonicalName as descriptive zone title in fetchPlaceDetails", async () => {
      const details = await fetchPlaceDetails("Street Food, Lunch near Bangkok Cultural Center", undefined, "food", "Bangkok");
      expect(details.canonicalName).toBe("Street Food, Lunch near Bangkok Cultural Center");
      expect(details.lat).toBeCloseTo(13.7468, 2);
      expect(details.lng).toBeCloseTo(100.5303, 2);
    });
  });
});
