import { describe, it, expect } from "vitest";
import {
  sequenceDayClusters,
  kMeansCluster,
  twoOptRouteOptimization,
  doSegmentsIntersect,
  untangleIntersectingEdges,
  assignDeterministicTimeSlots,
  preventConsecutiveMeals,
  rebalanceCrossDayPOIs,
  calculateCoherenceScore,
  parseOpeningHours,
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

    const startCoord = { lat: 13.75, lng: 100.40 };
    const sequenced = sequenceDayClusters(rawClusters, startCoord);

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
    const crossedActivities: Activity[] = [
      { id: "A", title: "A", type: "attraction", lat: 13.75, lng: 100.50, time: "09:00", description: "" },
      { id: "D", title: "D", type: "food", lat: 13.76, lng: 100.52, time: "12:00", description: "" },
      { id: "B", title: "B", type: "culture", lat: 13.76, lng: 100.50, time: "15:00", description: "" },
      { id: "C", title: "C", type: "nightlife", lat: 13.75, lng: 100.52, time: "18:00", description: "" },
    ];

    const untangled = untangleIntersectingEdges(crossedActivities);

    const p0 = { lat: untangled[0].lat!, lng: untangled[0].lng! };
    const p1 = { lat: untangled[1].lat!, lng: untangled[1].lng! };
    const p2 = { lat: untangled[2].lat!, lng: untangled[2].lng! };
    const p3 = { lat: untangled[3].lat!, lng: untangled[3].lng! };

    expect(doSegmentsIntersect(p0, p1, p2, p3)).toBe(false);
  });

  it("should sequence activities monotonically in a smooth linear flow from start to finish", () => {
    const scrambledActivities: Activity[] = [
      { id: "4", title: "Spot 4 (East-most)", type: "nightlife", lat: 13.75, lng: 100.80, time: "18:30", description: "" },
      { id: "2", title: "Spot 2 (Mid-West)", type: "food", lat: 13.75, lng: 100.40, time: "12:00", description: "" },
      { id: "1", title: "Spot 1 (West-most)", type: "culture", lat: 13.75, lng: 100.20, time: "09:00", description: "" },
      { id: "3", title: "Spot 3 (Mid-East)", type: "culture", lat: 13.75, lng: 100.60, time: "15:00", description: "" },
    ];

    const optimized = twoOptRouteOptimization(scrambledActivities, { lat: 13.75, lng: 100.15 });

    expect(optimized.map(a => a.id)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("Anti-Looping & Open Progression Route Optimization", () => {
  it("should avoid creating circular loops that return back to the starting area", () => {
    const loopingActivities: Activity[] = [
      { id: "start", title: "Morning Temple", type: "culture", lat: 13.75, lng: 100.50, time: "09:00", description: "" },
      { id: "mid1", title: "Midday Mall", type: "shopping", lat: 13.75, lng: 100.60, time: "12:00", description: "" },
      { id: "far", title: "East Observation Tower", type: "attraction", lat: 13.75, lng: 100.75, time: "15:00", description: "" },
      { id: "loop_back", title: "Evening Market (Next to start)", type: "nightlife", lat: 13.75, lng: 100.51, time: "18:00", description: "" },
    ];

    const optimized = twoOptRouteOptimization(loopingActivities, { lat: 13.75, lng: 100.48 });

    const first = optimized[0];
    const last = optimized[optimized.length - 1];
    expect(first.id).toBe("start");
    expect(last.id).not.toBe("loop_back");
  });
});

describe("Cross-Day Spatial Rebalancing", () => {
  it("should rebalance POIs so nearby locations in the same district belong to the same day", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "1a", title: "Asakusa Temple", type: "culture" as const, lat: 35.7147, lng: 139.7967, time: "09:00", description: "" },
          { id: "1b", title: "Asakusa Nakamise", type: "shopping" as const, lat: 35.7125, lng: 139.7960, time: "11:00", description: "" },
          { id: "1c", title: "Asakusa Lunch", type: "food" as const, lat: 35.7130, lng: 139.7970, time: "12:30", description: "" },
          { id: "1d", title: "Sumida Park", type: "nature" as const, lat: 35.7160, lng: 139.8000, time: "14:30", description: "" },
        ]
      },
      {
        day: 2,
        activities: [
          { id: "2a", title: "Shibuya Crossing", type: "attraction" as const, lat: 35.6595, lng: 139.7005, time: "09:00", description: "" },
          { id: "2b", title: "Shibuya Sky", type: "attraction" as const, lat: 35.6585, lng: 139.7020, time: "11:00", description: "" },
          { id: "2c", title: "Shibuya Lunch", type: "food" as const, lat: 35.6600, lng: 139.7010, time: "12:30", description: "" },
          { id: "2d", title: "Tokyo Skytree (Near Asakusa!)", type: "attraction" as const, lat: 35.7100, lng: 139.8107, time: "15:00", description: "" },
          { id: "2e", title: "Meiji Shrine", type: "culture" as const, lat: 35.6764, lng: 139.6993, time: "17:00", description: "" },
        ]
      }
    ];

    const rebalanced = rebalanceCrossDayPOIs(days);

    const day1Ids = rebalanced[0].activities.map(a => a.id);
    const day2Ids = rebalanced[1].activities.map(a => a.id);

    expect(day1Ids).toContain("2d");
    expect(day2Ids).not.toContain("2d");
  });
});

describe("Meal Scheduling & Anti-Consecutive Meals Rule", () => {
  it("should prevent consecutive dining places and interleave non-food activities", () => {
    const activitiesWithConsecutiveFood: Activity[] = [
      { id: "1", title: "Museum", type: "culture", time: "09:00", description: "" },
      { id: "2", title: "Lunch Restaurant", type: "food", time: "12:00", description: "" },
      { id: "3", title: "Dessert Cafe", type: "food", time: "13:30", description: "" },
      { id: "4", title: "City Park", type: "nature", time: "15:00", description: "" },
      { id: "5", title: "Dinner Bistro", type: "food", time: "18:30", description: "" }
    ];

    const interleaved = preventConsecutiveMeals(activitiesWithConsecutiveFood);

    for (let i = 0; i < interleaved.length - 1; i++) {
      const bothFood = interleaved[i].type === "food" && interleaved[i + 1].type === "food";
      expect(bothFood).toBe(false);
    }
  });

  it("should assign midday lunch into the 11:30 - 13:30 window", () => {
    const dailyActs: Activity[] = [
      { id: "1", title: "Morning Palace", type: "culture", description: "" },
      { id: "2", title: "Art Museum", type: "culture", description: "" },
      { id: "3", title: "Local Noodle House", type: "food", description: "" },
      { id: "4", title: "Shopping Mall", type: "shopping", description: "" },
      { id: "5", title: "Evening Riverside Dinner", type: "food", description: "" },
    ];

    const scheduled = assignDeterministicTimeSlots(dailyActs, "Moderate");

    const lunchAct = scheduled.find(a => a.id === "3");
    expect(lunchAct).toBeDefined();
    expect(lunchAct!.time >= "11:30" && lunchAct!.time <= "13:30").toBe(true);
  });
});

describe("Google Maps Opening Hours Integration", () => {
  it("should correctly parse opening hours strings", () => {
    const weekdayText = [
      "Sunday: 10:00 AM – 6:00 PM",
      "Monday: Closed",
      "Tuesday: 10:00 AM – 6:00 PM",
      "Wednesday: 10:00 AM – 8:00 PM",
      "Thursday: 10:00 AM – 6:00 PM",
      "Friday: 10:00 AM – 9:00 PM",
      "Saturday: Open 24 hours"
    ];

    const sundayHours = parseOpeningHours(weekdayText, 0); // Sunday
    expect(sundayHours).toEqual({ openMinutes: 10 * 60, closeMinutes: 18 * 60 });

    const mondayHours = parseOpeningHours(weekdayText, 1); // Monday
    expect(mondayHours).toEqual({ openMinutes: -1, closeMinutes: -1 });

    const saturdayHours = parseOpeningHours(weekdayText, 6); // Saturday
    expect(saturdayHours).toEqual({ openMinutes: 0, closeMinutes: 24 * 60 });
  });

  it("should adjust activity time slot to stay within operating hours", () => {
    const activitiesWithHours: Activity[] = [
      {
        id: "1",
        title: "Late Opening Museum",
        type: "culture",
        openingHours: ["Monday: 11:00 AM – 5:00 PM"],
        description: ""
      }
    ];

    const scheduled = assignDeterministicTimeSlots(activitiesWithHours, "Moderate", 1); // Monday

    expect(scheduled[0].time).toBe("11:00");
  });
});

describe("Plan Coherence Score & Rule Violations Evaluator", () => {
  it("should penalize multiple long commutes (>25 km) in a single day", () => {
    const highCommuteItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Bangkok Central", type: "culture" as const, lat: 13.75, lng: 100.50, time: "09:00" },
          { id: "2", title: "Ayutthaya Temple (70 km away)", type: "culture" as const, lat: 14.35, lng: 100.56, time: "11:30" },
          { id: "3", title: "Bangkok South (80 km back)", type: "food" as const, lat: 13.60, lng: 100.50, time: "15:00" },
          { id: "4", title: "Pattaya Beach (120 km away again!)", type: "nature" as const, lat: 12.92, lng: 100.88, time: "18:30" }
        ]
      }
    ];

    const result = calculateCoherenceScore(highCommuteItinerary, "Moderate");

    expect(result.warnings.some(w => w.includes("long-distance transit legs"))).toBe(true);
  });

  it("should detect and warn when consecutive meals are scheduled", () => {
    const badMealItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Temple", type: "culture" as const, time: "09:00" },
          { id: "2", title: "Lunch Noodle", type: "food" as const, time: "12:00" },
          { id: "3", title: "Steakhouse", type: "food" as const, time: "13:30" }
        ]
      }
    ];

    const result = calculateCoherenceScore(badMealItinerary, "Moderate");

    expect(result.warnings.some(w => w.includes("Consecutive dining spots"))).toBe(true);
  });
});
