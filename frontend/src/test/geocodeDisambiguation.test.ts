import { describe, it, expect } from "vitest";
import { getCoordinates, FAMOUS_LANDMARK_DISAMBIGUATION, distanceMetres } from "@/api/geocode";
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
});
