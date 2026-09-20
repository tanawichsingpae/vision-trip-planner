import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  doSegmentsIntersect,
  countIntersectingEdges,
  solve2OptTSP,
  solveDepot2OptTSP,
  kMeansCluster,
  partitionPoisIntoNonOverlappingSectors,
  calculateMasterHub,
  sequenceDayClusters,
  calculateCoherenceScore,
  auditItineraryRules,
  scrubAndRelocateDayOutliers,
  enforceMaxHopDistance,
  type POICandidate,
} from "../api/spatialPlanner";

describe("Spatial Optimization & 2-Opt Algorithm (Academic Verification)", () => {
  // ── 1. Geometric Intersection Test ───────────────────────────────────────────
  describe("Segment Intersection & Crossing Counter", () => {
    it("should correctly identify intersecting segments (X-cross)", () => {
      const a = { lat: 13.75, lng: 100.50 };
      const b = { lat: 13.80, lng: 100.55 };
      const c = { lat: 13.75, lng: 100.55 };
      const d = { lat: 13.80, lng: 100.50 };

      expect(doSegmentsIntersect(a, b, c, d)).toBe(true);
    });

    it("should return false for non-intersecting parallel segments", () => {
      const a = { lat: 13.75, lng: 100.50 };
      const b = { lat: 13.80, lng: 100.50 };
      const c = { lat: 13.75, lng: 100.55 };
      const d = { lat: 13.80, lng: 100.55 };

      expect(doSegmentsIntersect(a, b, c, d)).toBe(false);
    });

    it("should count exactly 1 crossing for an hourglass/bow-tie route", () => {
      // 4 points visited in bow-tie order
      const route = [
        { lat: 13.75, lng: 100.50 },
        { lat: 13.80, lng: 100.55 },
        { lat: 13.75, lng: 100.55 },
        { lat: 13.80, lng: 100.50 },
      ];
      expect(countIntersectingEdges(route)).toBe(1);
    });
  });

  // ── 2. 2-Opt Uncrossing & Distance Minimization ──────────────────────────────
  describe("2-Opt TSP Uncrossing Test", () => {
    it("should uncross a criss-crossing tour and achieve 0 edge crossings", () => {
      // Intentionally criss-crossed points (Phra Nakhon, Chatuchak, Siam, Silom)
      const crissCrossedPOIs: POICandidate[] = [
        { name: "Grand Palace", lat: 13.7500, lng: 100.4914 }, // South-West
        { name: "Chatuchak Market", lat: 13.8000, lng: 100.5500 }, // North-East
        { name: "Wat Pho", lat: 13.7466, lng: 100.4930 }, // South-West (next to Grand Palace)
        { name: "Ari Cafe", lat: 13.7800, lng: 100.5440 }, // North-East (near Chatuchak)
      ];

      const optimized = solve2OptTSP(crissCrossedPOIs);
      const crossings = countIntersectingEdges(optimized);

      expect(crossings).toBe(0);

      // Verify that nearby places are grouped together (Wat Pho next to Grand Palace)
      const grandPalaceIdx = optimized.findIndex(p => p.name === "Grand Palace");
      const watPhoIdx = optimized.findIndex(p => p.name === "Wat Pho");
      expect(Math.abs(grandPalaceIdx - watPhoIdx)).toBe(1);
    });

    it("should optimize closed circuit returning to Hotel Depot with 0 crossings", () => {
      const hotel = { lat: 13.7600, lng: 100.4950 }; // Banglamphu Hotel
      const pois: POICandidate[] = [
        { name: "Wat Arun", lat: 13.7437, lng: 100.4889 },
        { name: "Khaosan Road", lat: 13.7589, lng: 100.4974 },
        { name: "Grand Palace", lat: 13.7500, lng: 100.4914 },
        { name: "Chinatown", lat: 13.7380, lng: 100.5100 },
      ];

      const depotTour = solveDepot2OptTSP(pois, hotel);
      expect(depotTour.length).toBe(pois.length);
      expect(countIntersectingEdges(depotTour)).toBe(0);
    });
  });

  // ── 3. Spatial Clustering & Outlier Separation ──────────────────────────────
  describe("Spatial Clustering & Outlier Separation", () => {
    it("should cluster Old Town spots together and Chatuchak in separate cluster", () => {
      const pois: POICandidate[] = [
        // Old Town cluster
        { name: "Grand Palace", lat: 13.7500, lng: 100.4914 },
        { name: "Wat Pho", lat: 13.7466, lng: 100.4930 },
        { name: "Wat Arun", lat: 13.7437, lng: 100.4889 },
        { name: "National Museum", lat: 13.7580, lng: 100.4920 },
        // North / Chatuchak cluster
        { name: "Chatuchak Market", lat: 13.8000, lng: 100.5500 },
        { name: "Or Tor Kor Market", lat: 13.7970, lng: 100.5480 },
        { name: "Chatuchak Park", lat: 13.8030, lng: 100.5540 },
        { name: "Ari Neighborhood", lat: 13.7800, lng: 100.5440 },
      ];

      const clusters = kMeansCluster(pois, 2);
      expect(clusters.length).toBe(2);

      // Check that Chatuchak and Grand Palace end up in DIFFERENT clusters
      const clusterGrandPalace = clusters.find(c => c.pois.some(p => p.name === "Grand Palace"));
      const hasChatuchak = clusterGrandPalace?.pois.some(p => p.name === "Chatuchak Market");
      expect(hasChatuchak).toBe(false);
    });
  });

  // ── 4. Coherence Metric Evaluation (Thesis Benchmark) ────────────────────────
  describe("Coherence Metric & Academic Evaluation", () => {
    it("should calculate totalDistanceKm and 0 crossingCount for optimized itinerary", () => {
      const itinerary = [
        {
          day: 1,
          activities: [
            { id: "1", title: "Banglamphu Hotel", lat: 13.7600, lng: 100.4950, type: "hotel", time: "09:00" },
            { id: "2", title: "National Museum", lat: 13.7580, lng: 100.4920, type: "culture", time: "10:00" },
            { id: "3", title: "Grand Palace", lat: 13.7500, lng: 100.4914, type: "attraction", time: "11:30" },
            { id: "4", title: "Riverside Lunch", lat: 13.7480, lng: 100.4920, type: "food", time: "13:00" },
            { id: "5", title: "Wat Pho", lat: 13.7466, lng: 100.4930, type: "culture", time: "14:30" },
          ],
        },
      ];

      const score = calculateCoherenceScore(itinerary);
      expect(score.totalScore).toBeGreaterThanOrEqual(80);
      expect(score.crossingCount).toBe(0);
      expect(score.totalDistanceKm).toBeGreaterThan(0);
      expect(score.totalDistanceKm).toBeLessThan(10); // Compact Old Town day should be < 10 km
    });
  });

  // ── 5. 20% Tighter Distance Thresholds & Excursion Isolation ────────────────
  describe("20% Reduced Commute Boundaries & Excursion Isolation", () => {
    it("should trigger hop warning when consecutive stops exceed 10 km", () => {
      const testItinerary = [
        {
          day: 1,
          activities: [
            { id: "1", title: "Spot A", lat: 13.7500, lng: 100.4900, type: "culture" as const, time: "09:00" },
            // Spot B is ~13.5 km away from Spot A (exceeds 10 km limit)
            { id: "2", title: "Spot B", lat: 13.8400, lng: 100.5600, type: "attraction" as const, time: "11:30" },
          ],
        },
      ];

      const audit = auditItineraryRules(testItinerary);
      const hopWarning = audit.warnings.find(w => w.includes("maximum hop limit") || w.includes("Long Hop Alert"));
      expect(hopWarning).toBeDefined();
      expect(hopWarning).toContain("exceeding recommended 10 km maximum hop limit");
    });

    it("should separate destinations >= 20 km away into an excursion day cluster", () => {
      const pois: POICandidate[] = [
        // Urban Bangkok cluster (~within 3 km)
        { name: "Grand Palace", lat: 13.7500, lng: 100.4914 },
        { name: "Wat Pho", lat: 13.7466, lng: 100.4930 },
        { name: "Wat Arun", lat: 13.7437, lng: 100.4889 },
        { name: "National Museum", lat: 13.7580, lng: 100.4920 },
        // Distant Safari World (~28 km north-east from hub center, > 20 km)
        { name: "Safari World", lat: 13.8655, lng: 100.7042 },
      ];

      const clusters = kMeansCluster(pois, 2);
      expect(clusters.length).toBe(2);
      const excursionCluster = clusters.find(c => c.pois.some(p => p.name === "Safari World"));
      expect(excursionCluster).toBeDefined();
      // Grand Palace and Safari World must NOT be in the same cluster
      const hasGrandPalace = excursionCluster?.pois.some(p => p.name === "Grand Palace");
      expect(hasGrandPalace).toBe(false);
    });

    it("should detect and flag intra-day spatial outlier (> 20 km from cluster medoid) with [Spatial Outlier Alert]", () => {
      const outlierItinerary = [
        {
          day: 2,
          activities: [
            { id: "1", title: "Chatuchak Market", lat: 13.7999, lng: 100.5501, type: "shopping" as const, time: "09:30" },
            { id: "2", title: "Or Tor Kor Market", lat: 13.7980, lng: 100.5480, type: "food" as const, time: "12:00" },
            { id: "3", title: "Ari Neighborhood Cafe", lat: 13.7790, lng: 100.5440, type: "food" as const, time: "14:30" },
            { id: "4", title: "Bang Sue Grand Station", lat: 13.8039, lng: 100.5401, type: "landmark" as const, time: "16:30" },
            // Rogue outlier: Bang Saen Beach in Chon Buri (~75 km south-east of Bangkok cluster)
            { id: "5", title: "Bang Saen Beach (Chon Buri)", lat: 13.2830, lng: 100.9150, type: "nature" as const, time: "18:30" },
          ],
        },
      ];

      const audit = auditItineraryRules(outlierItinerary);
      const outlierWarning = audit.warnings.find(w => w.includes("[Spatial Outlier Alert]"));
      expect(outlierWarning).toBeDefined();
      expect(outlierWarning).toContain("Bang Saen Beach (Chon Buri)");
      expect(outlierWarning).toContain("away from the day's primary cluster");
    });

    it("should scrub and relocate rogue outlier POI to the day's spatial corridor", () => {
      const outlierItinerary = [
        {
          day: 2,
          activities: [
            { id: "1", title: "Chatuchak Market", lat: 13.7999, lng: 100.5501, type: "shopping" as const, time: "09:30" },
            { id: "2", title: "Or Tor Kor Market", lat: 13.7980, lng: 100.5480, type: "food" as const, time: "12:00" },
            { id: "3", title: "Ari Neighborhood Cafe", lat: 13.7790, lng: 100.5440, type: "food" as const, time: "14:30" },
            // Rogue outlier in Chon Buri
            { id: "4", title: "Bang Saen Beach", lat: 13.2830, lng: 100.9150, type: "nature" as const, time: "18:30" },
          ],
        },
      ];

      const bangkokCenter = { lat: 13.7563, lng: 100.5018 };
      const scrubbed = scrubAndRelocateDayOutliers(outlierItinerary, bangkokCenter, 20);

      const relocatedAct = scrubbed[0].activities.find(a => a.title === "Bang Saen Beach") as any;
      expect(relocatedAct).toBeDefined();
      expect(relocatedAct.isOutlierRelocated).toBe(true);

      // Verify the relocated activity is now within 5 km of the Bangkok cluster
      const distToBangkok = haversineDistance({ lat: relocatedAct.lat, lng: relocatedAct.lng }, { lat: 13.7999, lng: 100.5501 });
      expect(distToBangkok).toBeLessThan(5);
    });

    it("should enforce that every consecutive pair within a day has distance <= 10.0 km", () => {
      // Intentionally create an itinerary with cross-city hops like in the user's issue:
      // Phra Nakhon Center -> Bang Bon (~14 km south) -> Phra Nakhon Center -> Bang Kruai (~11 km north)
      const dayActivities = [
        { id: "1", title: "Grand Palace", lat: 13.7500, lng: 100.4914, type: "culture" as const, time: "09:00" },
        { id: "2", title: "Wat Saket", lat: 13.7538, lng: 100.5066, type: "culture" as const, time: "10:30" },
        // Rogue southern spot (Bang Bon / Rama II area, ~14 km away)
        { id: "3", title: "Bang Bon Park", lat: 13.6700, lng: 100.4100, type: "nature" as const, time: "12:00" },
        { id: "4", title: "Wat Pho", lat: 13.7466, lng: 100.4930, type: "culture" as const, time: "14:30" },
        // Rogue northern spot (Bang Kruai, Nonthaburi, ~11 km away)
        { id: "5", title: "Bang Kruai Temple", lat: 13.8150, lng: 100.4800, type: "culture" as const, time: "16:30" },
        { id: "6", title: "Chao Phraya Sunset", lat: 13.8180, lng: 100.4850, type: "nature" as const, time: "18:00" },
      ];

      // Verify that initially there ARE hops exceeding 10 km
      const initialHops = [];
      for (let i = 0; i < dayActivities.length - 1; i++) {
        const d = haversineDistance(
          { lat: dayActivities[i].lat, lng: dayActivities[i].lng },
          { lat: dayActivities[i + 1].lat, lng: dayActivities[i + 1].lng }
        );
        initialHops.push(d);
      }
      expect(initialHops.some(d => d > 10.0)).toBe(true);

      // Apply enforceMaxHopDistance
      const safeActivities = enforceMaxHopDistance(dayActivities, 10.0);

      // Verify that after enforcement, EVERY consecutive pair is <= 10.0 km
      for (let i = 0; i < safeActivities.length - 1; i++) {
        const d = haversineDistance(
          { lat: safeActivities[i].lat!, lng: safeActivities[i].lng! },
          { lat: safeActivities[i + 1].lat!, lng: safeActivities[i + 1].lng! }
        );
        expect(d).toBeLessThanOrEqual(10.0);
      }

      // Verify that the outlier activities were relocated
      const bangBonAct = safeActivities.find(a => a.id === "3") as any;
      expect(bangBonAct).toBeDefined();
      expect(bangBonAct.isOutlierRelocated).toBe(true);
    });
  });

  // ── 5. Radial Zone Architecture & Macro Trip Overview ───────────────────────
  describe("Radial Zone Architecture & Macro Trip Overview", () => {
    it("should partition days around user-uploaded landmark seeds in kMeansCluster", () => {
      // User uploads 2 landmark seeds in different areas:
      // Seed 1: Rattanakosin / Old Town (13.75, 100.49)
      // Seed 2: Sukhumvit / Thong Lo (13.725, 100.58)
      const userSeeds = [
        { lat: 13.7500, lng: 100.4914 }, // Rattanakosin
        { lat: 13.7250, lng: 100.5800 }, // Thong Lo
      ];

      const candidatePOIs: POICandidate[] = [
        { name: "Grand Palace", lat: 13.7500, lng: 100.4914, type: "recognized_image_landmark" },
        { name: "Wat Pho", lat: 13.7466, lng: 100.4930 },
        { name: "Sanam Luang Cafe", lat: 13.7550, lng: 100.4950 },
        { name: "The Commons Thong Lo", lat: 13.7340, lng: 100.5830, type: "recognized_image_landmark" },
        { name: "Ekkamai Art Gallery", lat: 13.7220, lng: 100.5850 },
        { name: "Sukhumvit 55 Dining", lat: 13.7280, lng: 100.5790 },
      ];

      const clusters = kMeansCluster(candidatePOIs, 2, userSeeds);

      expect(clusters).toHaveLength(2);
      expect(clusters[0].pois.length).toBeGreaterThanOrEqual(2);
      expect(clusters[1].pois.length).toBeGreaterThanOrEqual(2);

      // Verify that Grand Palace and Wat Pho are in one cluster, Commons and Ekkamai in the other
      const clusterWithGrandPalace = clusters.find(c => c.pois.some(p => p.name === "Grand Palace"));
      const clusterWithCommons = clusters.find(c => c.pois.some(p => p.name === "The Commons Thong Lo"));

      expect(clusterWithGrandPalace).toBeDefined();
      expect(clusterWithCommons).toBeDefined();
      expect(clusterWithGrandPalace?.day).not.toBe(clusterWithCommons?.day);

      // Verify centroids are radially separated (> 8 km apart)
      const distBetweenZones = haversineDistance(clusterWithGrandPalace!.centroid!, clusterWithCommons!.centroid!);
      expect(distBetweenZones).toBeGreaterThan(8.0);
    });

    it("should enforce tight intra-day hops <= 4.0 km using enforceMaxHopDistance", () => {
      // 3 activities: A and B are near, C is 7.5 km away in Sathon
      const scatteredDay = [
        { id: "1", title: "Phra Sumen Fort", lat: 13.7630, lng: 100.4960, type: "culture" as const, time: "09:30" },
        { id: "2", title: "Khao San Road Cafe", lat: 13.7589, lng: 100.4974, type: "food" as const, time: "11:30" },
        { id: "3", title: "Sathon Financial Tower", lat: 13.7198, lng: 100.5302, type: "leisure" as const, time: "14:00" }, // ~5.8 km away
      ];

      const tightened = enforceMaxHopDistance(scatteredDay, 4.0);

      // Verify all consecutive hops are <= 4.0 km
      for (let i = 0; i < tightened.length - 1; i++) {
        const d = haversineDistance(
          { lat: tightened[i].lat!, lng: tightened[i].lng! },
          { lat: tightened[i + 1].lat!, lng: tightened[i + 1].lng! }
        );
        expect(d).toBeLessThanOrEqual(4.0);
      }
    });

    it("should audit and detect multi-day macro zone overlaps in calculateCoherenceScore", () => {
      // Day 1 & Day 2 both visiting the same Rattanakosin / Sanam Luang area (< 2.8 km apart)
      const overlappingTrip = [
        {
          day: 1,
          activities: [
            { id: "101", title: "Grand Palace", lat: 13.7500, lng: 100.4914, type: "culture" as const, time: "09:00" },
            { id: "102", title: "Rattanakosin Lunch", lat: 13.7510, lng: 100.4930, type: "food" as const, time: "12:00" },
            { id: "103", title: "Wat Pho", lat: 13.7466, lng: 100.4930, type: "culture" as const, time: "14:00" },
          ],
        },
        {
          day: 2,
          activities: [
            { id: "201", title: "National Museum Bangkok", lat: 13.7580, lng: 100.4920, type: "culture" as const, time: "09:30" },
            { id: "202", title: "Tha Tien Bistro", lat: 13.7455, lng: 100.4920, type: "food" as const, time: "12:30" },
            { id: "203", title: "Wat Arun", lat: 13.7437, lng: 100.4888, type: "culture" as const, time: "15:00" },
          ],
        },
      ];

      const audit = calculateCoherenceScore(overlappingTrip);

      expect(audit.tripOverview).toBeDefined();
      expect(audit.tripOverview!.isZoneSeparated).toBe(false);
      expect(audit.tripOverview!.zoneIndependenceScore).toBeLessThan(100);
      expect(audit.warnings.some(w => w.includes("[Trip Overview: Overlapping Zones]"))).toBe(true);
    });

    it("should reward well-partitioned distinct radial zones with 100% independence score", () => {
      // Day 1: Rattanakosin (Old Town), Day 2: Sukhumvit / Thong Lo (> 9 km apart)
      const wellSeparatedTrip = [
        {
          day: 1,
          date: "Day 1 - เกาะรัตนโกสินทร์และเมืองเก่า",
          activities: [
            { id: "101", title: "Grand Palace", lat: 13.7500, lng: 100.4914, type: "culture" as const, time: "09:00" },
            { id: "102", title: "Old Town Eatery", lat: 13.7515, lng: 100.4935, type: "food" as const, time: "12:00" },
            { id: "103", title: "Wat Pho", lat: 13.7466, lng: 100.4930, type: "culture" as const, time: "14:00" },
          ],
        },
        {
          day: 2,
          date: "Day 2 - สุขุมวิทและทองหล่อ",
          activities: [
            { id: "201", title: "The Commons Thong Lo", lat: 13.7340, lng: 100.5830, type: "leisure" as const, time: "10:00" },
            { id: "202", title: "Thong Lo Dining", lat: 13.7310, lng: 100.5810, type: "food" as const, time: "12:30" },
            { id: "203", title: "Ekkamai Art Gallery", lat: 13.7220, lng: 100.5850, type: "culture" as const, time: "15:00" },
          ],
        },
      ];

      const audit = calculateCoherenceScore(wellSeparatedTrip);

      expect(audit.tripOverview).toBeDefined();
      expect(audit.tripOverview!.isZoneSeparated).toBe(true);
      expect(audit.tripOverview!.zoneIndependenceScore).toBe(100);
      expect(audit.tripOverview!.dailyZones).toHaveLength(2);
      expect(audit.passedChecks.some(c => c.includes("Radial Zone Partitioning"))).toBe(true);
    });

    it("should detect and flag intra-day scattered day (> 4.5 km radius) with [Trip Overview: Scattered Day]", () => {
      // Day with spots scattered from Phra Nakhon to Sathon to Bang Na (> 10 km radius)
      const scatteredTrip = [
        {
          day: 1,
          activities: [
            { id: "101", title: "Grand Palace", lat: 13.7500, lng: 100.4914, type: "culture" as const, time: "09:00" },
            { id: "102", title: "Local Lunch", lat: 13.7510, lng: 100.4925, type: "food" as const, time: "12:00" },
            { id: "103", title: "Mega Bangna", lat: 13.6465, lng: 100.6802, type: "shopping" as const, time: "16:00" }, // > 20 km away
          ],
        },
      ];

      const audit = calculateCoherenceScore(scatteredTrip);
      expect(audit.warnings.some(w => w.includes("[Trip Overview: Scattered Day]"))).toBe(true);
      expect(audit.tripOverview!.macroFindings.some(f => f.includes("กระจายตัวกว้างเกินไป"))).toBe(true);
    });
  });

  // ── 6. Polar Sector Partitioning & Master Anchor Engine ─────────────────────
  describe("Polar Sector Partitioning & Master Anchor Engine", () => {
    it("should calculate Master Hub correctly from single seed, multiple seeds, and fallback", () => {
      // Single seed
      const singleSeed = [{ lat: 13.7500, lng: 100.4914 }];
      const hub1 = calculateMasterHub(singleSeed);
      expect(hub1.lat).toBeCloseTo(13.7500, 4);
      expect(hub1.lng).toBeCloseTo(100.4914, 4);

      // Multiple seeds: returns spatial medoid
      const multipleSeeds = [
        { lat: 13.7500, lng: 100.4914 }, // Phra Nakhon
        { lat: 13.7510, lng: 100.4920 }, // nearby Phra Nakhon
        { lat: 13.7250, lng: 100.5800 }, // distant Thong Lo
      ];
      const hub2 = calculateMasterHub(multipleSeeds);
      // Medoid among these should be one of the central Phra Nakhon points, not the distant outlier
      expect(hub2.lat).toBeGreaterThan(13.74);
      expect(hub2.lng).toBeLessThan(100.52);

      // Fallback to centerCoords
      const hub3 = calculateMasterHub([], { lat: 18.7883, lng: 98.9853 });
      expect(hub3.lat).toBeCloseTo(18.7883, 4);
      expect(hub3.lng).toBeCloseTo(98.9853, 4);
    });

    it("should partition POIs into non-overlapping daily sectors around Master Hub", () => {
      const masterHub = { lat: 13.7500, lng: 100.5100 }; // Central Bangkok

      const pois: POICandidate[] = [
        // West Sector (Old Town / Riverside)
        { name: "Grand Palace", lat: 13.7500, lng: 100.4914 },
        { name: "Wat Pho", lat: 13.7466, lng: 100.4930 },
        { name: "Tha Tien Market", lat: 13.7450, lng: 100.4910 },
        // East Sector (Sukhumvit / Siam)
        { name: "Siam Paragon", lat: 13.7460, lng: 100.5350 },
        { name: "CentralWorld", lat: 13.7465, lng: 100.5390 },
        { name: "Erawan Shrine", lat: 13.7443, lng: 100.5404 },
        // North Sector (Ari / Chatuchak)
        { name: "Ari Cafe 1", lat: 13.7800, lng: 100.5440 },
        { name: "Ari Restaurant", lat: 13.7810, lng: 100.5450 },
        { name: "Chatuchak Market", lat: 13.8000, lng: 100.5500 },
      ];

      const clusters = partitionPoisIntoNonOverlappingSectors(pois, 3, masterHub);

      expect(clusters).toHaveLength(3);
      // Every cluster must have POIs
      clusters.forEach(c => {
        expect(c.pois.length).toBeGreaterThan(0);
        expect(c.centroid).toBeDefined();
        // Tight neighborhood radius <= 3.8 km
        expect(c.radiusKm).toBeLessThanOrEqual(3.8);
      });

      // Wat Pho and Grand Palace are atomic neighbors (within 1.8 km) and MUST be in the same day cluster
      const clusterWithGrandPalace = clusters.find(c => c.pois.some(p => p.name === "Grand Palace"));
      const clusterWithWatPho = clusters.find(c => c.pois.some(p => p.name === "Wat Pho"));
      expect(clusterWithGrandPalace?.day).toBe(clusterWithWatPho?.day);

      // Siam Paragon and CentralWorld are atomic neighbors and MUST be in the same day cluster
      const clusterWithSiam = clusters.find(c => c.pois.some(p => p.name === "Siam Paragon"));
      const clusterWithCW = clusters.find(c => c.pois.some(p => p.name === "CentralWorld"));
      expect(clusterWithSiam?.day).toBe(clusterWithCW?.day);

      // The Old Town cluster and Siam cluster must be in separate days
      expect(clusterWithGrandPalace?.day).not.toBe(clusterWithSiam?.day);
    });

    it("should sequence day clusters along a contiguous corridor from start location", () => {
      const hotel = { lat: 13.7550, lng: 100.4930 }; // Old Town Hotel

      const clusters: DayCluster[] = [
        { day: 1, pois: [{ name: "Chatuchak", lat: 13.8000, lng: 100.5500 }], centroid: { lat: 13.8000, lng: 100.5500 } }, // North
        { day: 2, pois: [{ name: "Grand Palace", lat: 13.7500, lng: 100.4914 }], centroid: { lat: 13.7500, lng: 100.4914 } }, // West (closest to hotel)
        { day: 3, pois: [{ name: "Siam", lat: 13.7460, lng: 100.5350 }], centroid: { lat: 13.7460, lng: 100.5350 } }, // Central-East
      ];

      const sequenced = sequenceDayClusters(clusters, hotel);

      expect(sequenced).toHaveLength(3);
      // Day 1 must be the cluster closest to hotel (Grand Palace / Old Town)
      expect(sequenced[0].pois[0].name).toBe("Grand Palace");
      // Day 2 must be the intermediate cluster (Siam), Day 3 must be the furthest (Chatuchak)
      // to avoid jumping Old Town -> Chatuchak -> Siam (a sharp U-turn across town)
      expect(sequenced[1].pois[0].name).toBe("Siam");
      expect(sequenced[2].pois[0].name).toBe("Chatuchak");
    });
  });
});

