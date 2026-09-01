import { describe, it, expect } from "vitest";
import {
  sequenceDayClusters,
  kMeansCluster,
  twoOptRouteOptimization,
  doSegmentsIntersect,
  untangleIntersectingEdges,
  type POICandidate,
  type DayCluster,
} from "@/api/spatialPlanner";
import { type Activity } from "@/components/TravelItinerary";

const sortActivities = (activities: { id: string; time: string; title: string }[]) => {
  return [...activities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
};

describe("Itinerary Sorting Logic", () => {
  it("should sort activities chronologically by time", () => {
    const activities = [
      { id: "1", time: "15:00", title: "Check-in Hotel" },
      { id: "2", time: "09:00", title: "Arrival at Airport" },
      { id: "3", time: "12:00", title: "Lunch" },
      { id: "4", time: "18:00", title: "Dinner" }
    ];

    const sorted = sortActivities(activities);

    expect(sorted[0].id).toBe("2"); // 09:00
    expect(sorted[1].id).toBe("3"); // 12:00
    expect(sorted[2].id).toBe("1"); // 15:00
    expect(sorted[3].id).toBe("4"); // 18:00
  });

  it("should handle missing or empty times by defaulting to 00:00", () => {
    const activities = [
      { id: "1", time: "12:00", title: "Lunch" },
      { id: "2", time: "", title: "Start of day" },
      { id: "3", time: "09:00", title: "Morning activity" }
    ];

    const sorted = sortActivities(activities);

    expect(sorted[0].id).toBe("2"); // "" -> "00:00"
    expect(sorted[1].id).toBe("3"); // 09:00
    expect(sorted[2].id).toBe("1"); // 12:00
  });
});

describe("Macro-Cluster Sequencing (Inter-Day Progression)", () => {
  it("should sequence day clusters in geographically contiguous order without criss-crossing", () => {
    // 3 clusters: Cluster A (West, lng: 100.4), Cluster B (Center, lng: 100.5), Cluster C (East, lng: 100.6)
    const rawClusters: DayCluster[] = [
      {
        day: 1,
        pois: [{ name: "East Spot", lat: 13.75, lng: 100.65 }],
        centroid: { lat: 13.75, lng: 100.65 },
        radiusKm: 2,
      },
      {
        day: 2,
        pois: [{ name: "West Spot", lat: 13.75, lng: 100.45 }],
        centroid: { lat: 13.75, lng: 100.45 },
        radiusKm: 2,
      },
      {
        day: 3,
        pois: [{ name: "Center Spot", lat: 13.75, lng: 100.55 }],
        centroid: { lat: 13.75, lng: 100.55 },
        radiusKm: 2,
      },
    ];

    // Starting from West hotel
    const startCoord = { lat: 13.75, lng: 100.40 };
    const sequenced = sequenceDayClusters(rawClusters, startCoord);

    // Expect Day 1 to be West Spot, Day 2 to be Center Spot, Day 3 to be East Spot
    expect(sequenced.length).toBe(3);
    expect(sequenced[0].day).toBe(1);
    expect(sequenced[0].pois[0].name).toBe("West Spot");
    expect(sequenced[1].day).toBe(2);
    expect(sequenced[1].pois[0].name).toBe("Center Spot");
    expect(sequenced[2].day).toBe(3);
    expect(sequenced[2].pois[0].name).toBe("East Spot");
  });
});

describe("Geometric Edge Intersection & Untangling (No Zig-Zagging)", () => {
  it("should correctly detect intersecting 2D line segments", () => {
    const p1 = { lat: 10, lng: 10 };
    const p2 = { lat: 20, lng: 20 };
    const p3 = { lat: 10, lng: 20 };
    const p4 = { lat: 20, lng: 10 };

    expect(doSegmentsIntersect(p1, p2, p3, p4)).toBe(true);

    const parallel1 = { lat: 10, lng: 10 };
    const parallel2 = { lat: 20, lng: 10 };
    const parallel3 = { lat: 10, lng: 20 };
    const parallel4 = { lat: 20, lng: 20 };

    expect(doSegmentsIntersect(parallel1, parallel2, parallel3, parallel4)).toBe(false);
  });

  it("should untangle an X-crossed route into an uncrossed smooth path", () => {
    // 4 points forming an 'X' crossing: (0,0) -> (1,1) -> (0,1) -> (1,0)
    // Segment (0,0)-(1,1) intersects with (0,1)-(1,0)
    const crossedActivities: Activity[] = [
      { id: "A", title: "A", type: "attraction", lat: 13.75, lng: 100.50, time: "09:00", description: "" },
      { id: "D", title: "D", type: "food", lat: 13.76, lng: 100.52, time: "12:00", description: "" },
      { id: "B", title: "B", type: "culture", lat: 13.76, lng: 100.50, time: "15:00", description: "" },
      { id: "C", title: "C", type: "nightlife", lat: 13.75, lng: 100.52, time: "18:00", description: "" },
    ];

    const untangled = untangleIntersectingEdges(crossedActivities);

    // Verify that consecutive segments no longer cross
    const p0 = { lat: untangled[0].lat!, lng: untangled[0].lng! };
    const p1 = { lat: untangled[1].lat!, lng: untangled[1].lng! };
    const p2 = { lat: untangled[2].lat!, lng: untangled[2].lng! };
    const p3 = { lat: untangled[3].lat!, lng: untangled[3].lng! };

    expect(doSegmentsIntersect(p0, p1, p2, p3)).toBe(false);
  });

  it("should sequence activities monotonically in a smooth linear flow from start to finish", () => {
    // Scrambled sequence along an East-West trajectory
    const scrambledActivities: Activity[] = [
      { id: "4", title: "Spot 4 (East-most)", type: "nightlife", lat: 13.75, lng: 100.80, time: "18:30", description: "" },
      { id: "2", title: "Spot 2 (Mid-West)", type: "food", lat: 13.75, lng: 100.40, time: "12:00", description: "" },
      { id: "1", title: "Spot 1 (West-most)", type: "culture", lat: 13.75, lng: 100.20, time: "09:00", description: "" },
      { id: "3", title: "Spot 3 (Mid-East)", type: "culture", lat: 13.75, lng: 100.60, time: "15:00", description: "" },
    ];

    const optimized = twoOptRouteOptimization(scrambledActivities, { lat: 13.75, lng: 100.15 });

    // Must be strictly ordered 1 -> 2 -> 3 -> 4
    expect(optimized.map(a => a.id)).toEqual(["1", "2", "3", "4"]);
  });
});

