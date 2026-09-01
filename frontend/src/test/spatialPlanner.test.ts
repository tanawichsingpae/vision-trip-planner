import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  doSegmentsIntersect,
  countIntersectingEdges,
  solve2OptTSP,
  solveDepot2OptTSP,
  kMeansCluster,
  sequenceDayClusters,
  calculateCoherenceScore,
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
});
