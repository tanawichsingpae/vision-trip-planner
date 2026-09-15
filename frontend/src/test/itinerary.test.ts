import { describe, it, expect } from "vitest";
import {
  sequenceDayClusters,
  kMeansCluster,
  twoOptRouteOptimization,
  doSegmentsIntersect,
  untangleIntersectingEdges,
  assignDeterministicTimeSlots,
  preventConsecutiveMeals,
  preventConsecutiveCategoryMonotony,
  rebalanceCrossDayPOIs,
  calculateCoherenceScore,
  calculateRealisticTransitMinutes,
  countIntersectingEdges,
  parseOpeningHours,
  optimizeDayActivities,
  isEveningActivity,
  isZoneOrArea,
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

  it("should preserve nearby pairs and never split them into a zig-zag route", () => {
    // 2 spots in West (Old Town: Grand Palace & Wat Pho, 400m apart)
    // 2 spots in East (Siam: Siam Paragon & CentralWorld, 500m apart)
    const scrambledPairs: Activity[] = [
      { id: "west1", title: "Grand Palace (West)", type: "culture", lat: 13.7500, lng: 100.4913, description: "" },
      { id: "east1", title: "Siam Paragon (East)", type: "shopping", lat: 13.7462, lng: 100.5347, description: "" },
      { id: "west2", title: "Wat Pho (West - 400m from Grand Palace)", type: "culture", lat: 13.7465, lng: 100.4930, description: "" },
      { id: "east2", title: "CentralWorld (East - 500m from Paragon)", type: "shopping", lat: 13.7466, lng: 100.5393, description: "" },
    ];

    const optimized = twoOptRouteOptimization(scrambledPairs, { lat: 13.7500, lng: 100.4850 });
    const ids = optimized.map(a => a.id);

    // Verify West spots are grouped together consecutively, and East spots are grouped together
    const west1Idx = ids.indexOf("west1");
    const west2Idx = ids.indexOf("west2");
    const east1Idx = ids.indexOf("east1");
    const east2Idx = ids.indexOf("east2");

    expect(Math.abs(west1Idx - west2Idx)).toBe(1); // West pair is consecutive!
    expect(Math.abs(east1Idx - east2Idx)).toBe(1); // East pair is consecutive!

    // Starting from West, West pair must come before East pair
    expect(Math.min(west1Idx, west2Idx)).toBeLessThan(Math.min(east1Idx, east2Idx));
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

  it("should detect and warn when route loops back to the morning start point", () => {
    const loopingItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Morning Temple", type: "culture" as const, lat: 13.7500, lng: 100.4900, time: "09:00" },
          { id: "2", title: "Lunch Restaurant", type: "food" as const, lat: 13.7520, lng: 100.4930, time: "12:00" },
          { id: "3", title: "Far Eastern Landmark", type: "attraction" as const, lat: 13.7500, lng: 100.5400, time: "15:00" },
          { id: "4", title: "Evening Bar (Right next to Temple)", type: "nightlife" as const, lat: 13.7505, lng: 100.4905, time: "19:00" }
        ]
      }
    ];

    const result = calculateCoherenceScore(loopingItinerary, "Moderate");
    expect(result.warnings.some(w => w.includes("loops back to meet near the morning start point"))).toBe(true);
  });

  it("should detect and warn when lunch spot is located too far from morning activity", () => {
    const farLunchItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Morning Temple", type: "culture" as const, lat: 13.7500, lng: 100.4900, time: "09:30" },
          { id: "2", title: "Distant Lunch (8 km away)", type: "food" as const, lat: 13.8000, lng: 100.5500, time: "12:00" },
          { id: "3", title: "Afternoon Sight", type: "attraction" as const, lat: 13.8020, lng: 100.5520, time: "14:30" },
        ]
      }
    ];

    const result = calculateCoherenceScore(farLunchItinerary, "Moderate");
    expect(result.warnings.some(w => w.includes("located too far"))).toBe(true);
  });

  it("should auto-inject dedicated midday lunch near morning spot when missing in daytime schedule", () => {
    const activitiesWithoutLunch: Activity[] = [
      { id: "1", title: "Grand Palace", type: "culture", lat: 13.7500, lng: 100.4914, description: "" },
      { id: "2", title: "National Museum", type: "culture", lat: 13.7580, lng: 100.4920, description: "" },
      { id: "3", title: "Siam Paragon", type: "shopping", lat: 13.7462, lng: 100.5347, description: "" },
      { id: "4", title: "Rooftop Bar", type: "nightlife", lat: 13.7400, lng: 100.5300, description: "" },
    ];

    const optimized = optimizeDayActivities(activitiesWithoutLunch, "Moderate");

    // Check that a lunch food activity was auto-injected
    const lunchItem = optimized.find(a => a.type === "food" && !isEveningActivity(a));
    expect(lunchItem).toBeDefined();
    expect(lunchItem!.title).toContain("Lunch near");
    expect(lunchItem!.time >= "11:30" && lunchItem!.time <= "13:00").toBe(true);
  });

  it("should isolate distant excursions (>25 km) into dedicated day-trip cluster", () => {
    const mixedPois: POICandidate[] = [
      // Bangkok urban POIs
      { name: "Grand Palace", lat: 13.7500, lng: 100.4914 },
      { name: "Wat Pho", lat: 13.7466, lng: 100.4930 },
      { name: "Chatuchak Market", lat: 13.8000, lng: 100.5500 },
      { name: "Siam Paragon", lat: 13.7462, lng: 100.5347 },
      // Ayutthaya Excursion POIs (~70 km away)
      { name: "Ayutthaya Historical Park", lat: 14.3532, lng: 100.5684 },
      { name: "Wat Mahathat Ayutthaya", lat: 14.3570, lng: 100.5670 },
    ];

    const clusters = kMeansCluster(mixedPois, 2);
    expect(clusters.length).toBe(2);

    // The excursion cluster should contain the Ayutthaya spots
    const ayutthayaCluster = clusters.find(c => c.pois.some(p => p.name.includes("Ayutthaya")));
    expect(ayutthayaCluster).toBeDefined();

    // The Ayutthaya cluster must NOT contain Grand Palace
    const hasGrandPalaceInAyutthaya = ayutthayaCluster!.pois.some(p => p.name === "Grand Palace");
    expect(hasGrandPalaceInAyutthaya).toBe(false);
  });

  it("should respect dwell-time closing buffer and schedule activity well before closing (<= 16:30 for 18:00 close)", () => {
    // A museum that closes at 18:00 on Monday
    const lateActs: Activity[] = [
      { id: "1", title: "Morning Temple", type: "culture", description: "", time: "09:00" },
      { id: "2", title: "Midday Lunch", type: "food", description: "", time: "12:00" },
      {
        id: "3",
        title: "National Heritage Museum",
        type: "culture",
        description: "",
        openingHours: ["Monday: 09:00 – 18:00"]
      }
    ];

    const scheduled = assignDeterministicTimeSlots(lateActs, "Moderate", 1); // Monday
    const museum = scheduled.find(a => a.id === "3");
    expect(museum).toBeDefined();
    // Closes at 18:00; with dwell time (90m) + buffer (15m), latest start must be <= 16:30
    expect(museum!.time <= "16:30").toBe(true);
  });

  it("should treat public zones and districts as open 24 hours without closing penalties", () => {
    expect(isZoneOrArea({ title: "Khao San Walking Street", type: "culture" })).toBe(true);
    expect(isZoneOrArea({ title: "Chiang Mai Old Town", type: "culture" })).toBe(true);
    expect(isZoneOrArea({ title: "Chaweng Beach Road", type: "nature" })).toBe(true);
    expect(isZoneOrArea({ title: "Pattaya Walking Street", type: "nightlife" })).toBe(true);
    expect(isZoneOrArea({ title: "Bangkok Art Museum", type: "culture" })).toBe(false);
  });

  it("should detect and warn when consecutive activities exceed 10-15 km hop limit", () => {
    const farHopItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Bangkok Central", type: "culture" as const, lat: 13.75, lng: 100.50, time: "09:00" },
          // 18.2 km north: exceeds 10-15 km recommended limit
          { id: "2", title: "Far North Suburb", type: "culture" as const, lat: 13.91, lng: 100.52, time: "11:30" }
        ]
      }
    ];

    const result = calculateCoherenceScore(farHopItinerary, "Moderate");
    expect(result.warnings.some(w => w.includes("10-15 km maximum hop limit"))).toBe(true);
  });

  it("should warn when activity start time leaves insufficient dwell time before venue closes", () => {
    const tightDwellItinerary = [
      {
        day: 1,
        activities: [
          {
            id: "1",
            title: "Early Closing Gallery",
            type: "culture" as const,
            lat: 13.75,
            lng: 100.50,
            time: "17:35", // starts at 17:35 but closes at 18:00 (only 25 min dwell)
            openingHours: ["Monday: 09:00 – 18:00"]
          }
        ]
      }
    ];

    const result = calculateCoherenceScore(tightDwellItinerary, "Moderate", new Date("2026-09-14")); // Monday
    expect(result.warnings.some(w => w.includes("leaving insufficient dwell time"))).toBe(true);
  });
});

describe("Academic-Grade Anti-Zigzag & Realistic Transit Scheduling (Plan Verification)", () => {
  describe("Physics-Based Realistic Transit Modeling", () => {
    it("should calculate realistic travel times between distant POIs (>30 min for 10+ km)", () => {
      const pointA = { lat: 13.7500, lng: 100.5000 };
      const pointB = { lat: 13.8500, lng: 100.5500 }; // ~12.3 km apart
      const transitMin = calculateRealisticTransitMinutes(pointA, pointB, "Moderate");
      expect(transitMin).toBeGreaterThan(30);
    });

    it("should use pedestrian walking speed (~5-12 min) for short distances (<0.8 km)", () => {
      const pointA = { lat: 13.7500, lng: 100.5000 };
      const pointB = { lat: 13.7520, lng: 100.5030 }; // ~400 meters apart
      const transitMin = calculateRealisticTransitMinutes(pointA, pointB, "Moderate");
      expect(transitMin).toBeGreaterThanOrEqual(5);
      expect(transitMin).toBeLessThanOrEqual(12);
    });
  });

  describe("Route-Determines-Time Paradigm (Strictly Monotonic Time Progression)", () => {
    it("should enforce strictly increasing chronological times along the 2-Opt spatial corridor", () => {
      const activities: Activity[] = [
        { id: "1", title: "Morning Temple", type: "culture", lat: 13.7500, lng: 100.4900, description: "" },
        { id: "2", title: "Midday Museum", type: "culture", lat: 13.7550, lng: 100.4950, description: "" },
        { id: "3", title: "Local Lunch", type: "food", lat: 13.7560, lng: 100.4970, description: "" },
        { id: "4", title: "Afternoon Market", type: "shopping", lat: 13.7600, lng: 100.5050, description: "" },
        { id: "5", title: "Evening Dinner", type: "food", lat: 13.7700, lng: 100.5200, description: "" },
      ];

      const scheduled = assignDeterministicTimeSlots(activities, "Moderate");

      expect(scheduled.length).toBe(5);
      for (let i = 0; i < scheduled.length - 1; i++) {
        const timeCurrent = scheduled[i].time || "00:00";
        const timeNext = scheduled[i + 1].time || "00:00";
        expect(timeCurrent.localeCompare(timeNext)).toBeLessThan(0); // Strictly T_i < T_{i+1}
      }
    });
  });

  describe("Spatial-Preserving Meal Separation", () => {
    it("should separate consecutive meals without scrambling non-food category order", () => {
      // Spatial sequence: A(culture) -> B(food) -> C(food) -> D(shopping) -> E(attraction)
      const spatialRoute: Activity[] = [
        { id: "A", title: "Old Town Temple", type: "culture", lat: 13.750, lng: 100.490, description: "" },
        { id: "B", title: "Riverside Cafe", type: "food", lat: 13.752, lng: 100.492, description: "" },
        { id: "C", title: "Street Food Bistro", type: "food", lat: 13.753, lng: 100.494, description: "" },
        { id: "D", title: "Flower Market", type: "shopping", lat: 13.755, lng: 100.496, description: "" },
        { id: "E", title: "Scenic Bridge", type: "attraction", lat: 13.757, lng: 100.498, description: "" },
      ];

      const interleaved = preventConsecutiveMeals(spatialRoute);

      // Verify no two foods are consecutive
      for (let i = 0; i < interleaved.length - 1; i++) {
        const bothFood = interleaved[i].type === "food" && interleaved[i + 1].type === "food";
        expect(bothFood).toBe(false);
      }

      // Verify relative non-food order is maintained: A, then D, then E
      const nonFoodIds = interleaved.filter(a => a.type !== "food").map(a => a.id);
      expect(nonFoodIds).toEqual(["A", "D", "E"]);
    });
  });

  describe("Adaptive Cross-Day Outlier Rebalancing (Sathon Relocation)", () => {
    it("should rebalance an outlier POI located far from Day 2 cluster to the closer Day 1 cluster", () => {
      // Day 1: Rattanakosin / Old Town centroid (~13.75, 100.49)
      // Day 2: Din Daeng / Huai Khwang centroid (~13.77, 100.57)
      // Sathon spot: (13.72, 100.52) - ~4.5 km from Day 1 centroid, ~14 km from Day 2 centroid
      const days = [
        {
          day: 1,
          activities: [
            { id: "1a", title: "Grand Palace", type: "culture" as const, lat: 13.7500, lng: 100.4913, description: "" },
            { id: "1b", title: "Wat Pho", type: "culture" as const, lat: 13.7465, lng: 100.4930, description: "" },
            { id: "1c", title: "Wat Arun", type: "culture" as const, lat: 13.7437, lng: 100.4889, description: "" },
            { id: "1d", title: "Khaosan Road", type: "attraction" as const, lat: 13.7589, lng: 100.4974, description: "" },
          ]
        },
        {
          day: 2,
          activities: [
            { id: "2a", title: "The One Ratchada", type: "shopping" as const, lat: 13.7665, lng: 100.5695, description: "" },
            { id: "2b", title: "Huai Khwang Night Market", type: "shopping" as const, lat: 13.7785, lng: 100.5740, description: "" },
            { id: "2c", title: "Thailand Cultural Centre", type: "culture" as const, lat: 13.7710, lng: 100.5715, description: "" },
            { id: "2d", title: "Din Daeng Local Food", type: "food" as const, lat: 13.7640, lng: 100.5550, description: "" },
            { id: "sathon", title: "Sathon Riverside Pier", type: "attraction" as const, lat: 13.7200, lng: 100.5150, description: "" },
          ]
        }
      ];

      const rebalanced = rebalanceCrossDayPOIs(days);

      const day1Ids = rebalanced[0].activities.map(a => a.id);
      const day2Ids = rebalanced[1].activities.map(a => a.id);

      expect(day1Ids).toContain("sathon");
      expect(day2Ids).not.toContain("sathon");
    });
  });

  describe("Turn-Back Angle Penalty & Unidirectional Corridor Optimization", () => {
    it("should eliminate sharp zigzags and order POIs in a smooth unidirectional corridor with 0 edge crossings", () => {
      const corridorPOIs: Activity[] = [
        { id: "siam", title: "Siam Discovery", type: "shopping", lat: 13.7460, lng: 100.5340, description: "" },
        { id: "dindaeng", title: "Din Daeng North Market", type: "shopping", lat: 13.7660, lng: 100.5550, description: "" },
        { id: "chidlom", title: "Central Chidlom", type: "shopping", lat: 13.7440, lng: 100.5430, description: "" },
        { id: "asok", title: "Terminal 21 Asok", type: "shopping", lat: 13.7370, lng: 100.5600, description: "" },
      ];

      const startCoord = { lat: 13.7460, lng: 100.5300 }; // Start from west of Siam
      const optimized = twoOptRouteOptimization(corridorPOIs, startCoord);

      // Crossings must be 0
      expect(countIntersectingEdges(optimized)).toBe(0);

      // Verify monotonic flow from West/Center to East: Siam -> Chidlom -> Asok/Din Daeng
      const siamIdx = optimized.findIndex(a => a.id === "siam");
      const chidlomIdx = optimized.findIndex(a => a.id === "chidlom");
      expect(siamIdx).toBeLessThan(chidlomIdx);
    });
  });
});

describe("Academic-Grade POI Selection & Persona Compatibility Rules", () => {
  it("should warn on budget mismatch when expensive spot is scheduled for a budget traveler", () => {
    const itinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Street Market", type: "shopping" as const, lat: 13.75, lng: 100.50, time: "09:30", priceLevel: 1 },
          { id: "2", title: "Affordable Noodle Shop", type: "food" as const, lat: 13.752, lng: 100.502, time: "12:00", priceLevel: 1 },
          { id: "3", title: "Michelin 3-Star Luxury Dining", type: "food" as const, lat: 13.755, lng: 100.505, time: "18:00", priceLevel: 4 },
        ]
      }
    ];

    const result = calculateCoherenceScore(itinerary, "Moderate", undefined, { budget: "Budget" });

    expect(result.warnings.some(w => w.includes("Budget Mismatch"))).toBe(true);
    expect(result.selectionScore).toBeLessThan(100);
  });

  it("should warn on persona mismatch when nightlife/bar is scheduled for a family trip", () => {
    const itinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Science Museum", type: "culture" as const, lat: 13.75, lng: 100.50, time: "10:00" },
          { id: "2", title: "Family Diner", type: "food" as const, lat: 13.752, lng: 100.502, time: "12:30" },
          { id: "3", title: "Neon Nightclub & Rooftop Bar", type: "nightlife" as const, lat: 13.755, lng: 100.505, time: "21:00" },
        ]
      }
    ];

    const result = calculateCoherenceScore(itinerary, "Moderate", undefined, { travelerType: "Family" });

    expect(result.warnings.some(w => w.includes("Persona Mismatch"))).toBe(true);
    expect(result.selectionScore).toBeLessThan(100);
  });

  it("should warn on persona consideration when strenuous/extreme activity is scheduled for senior travelers", () => {
    const itinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Extreme Mountain Trekking", type: "adventure" as const, lat: 13.75, lng: 100.50, time: "09:00" },
          { id: "2", title: "Park Lunch", type: "food" as const, lat: 13.752, lng: 100.502, time: "12:00" },
        ]
      }
    ];

    const result = calculateCoherenceScore(itinerary, "Moderate", undefined, { travelerType: "Senior" });

    expect(result.warnings.some(w => w.includes("Senior travelers"))).toBe(true);
    expect(result.selectionScore).toBeLessThan(100);
  });

  it("should flag low-rated places (<3.8) with significant reviews as potential tourist traps", () => {
    const itinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Overpriced Tourist Trap Cafe", type: "food" as const, lat: 13.75, lng: 100.50, time: "12:00", rating: 3.1, userRatingsTotal: 120 },
          { id: "2", title: "National Art Gallery", type: "culture" as const, lat: 13.752, lng: 100.502, time: "14:00", rating: 4.6, userRatingsTotal: 3000 },
        ]
      }
    ];

    const result = calculateCoherenceScore(itinerary, "Moderate");

    expect(result.warnings.some(w => w.includes("Quality Warning") && w.includes("3.1★"))).toBe(true);
    expect(result.selectionScore).toBeLessThan(100);
  });

  it("should detect category monotony when 3 or more consecutive spots of the same category are scheduled", () => {
    const monotonousItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Temple of Emerald Buddha", type: "culture" as const, lat: 13.750, lng: 100.490, time: "09:00" },
          { id: "2", title: "Wat Pho Temple", type: "culture" as const, lat: 13.746, lng: 100.492, time: "11:00" },
          { id: "3", title: "Wat Arun Temple", type: "culture" as const, lat: 13.743, lng: 100.488, time: "13:30" },
          { id: "4", title: "Wat Saket Golden Mount", type: "culture" as const, lat: 13.753, lng: 100.506, time: "15:30" },
        ]
      }
    ];

    const result = calculateCoherenceScore(monotonousItinerary, "Moderate");

    expect(result.warnings.some(w => w.includes("Category Monotony: 3+ consecutive \"culture\" spots"))).toBe(true);
  });

  it("should warn when outdoor beach/nature activity coincides with rainy weather forecast", () => {
    const rainyItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Sunny Beach Resort Excursion", type: "beach" as const, lat: 12.92, lng: 100.88, time: "10:00" },
          { id: "2", title: "Seafood Shack", type: "food" as const, lat: 12.925, lng: 100.885, time: "13:00" }
        ]
      }
    ];

    const weatherForecast = [
      { day: 1, condition: "Heavy Thunderstorms", isRainy: true, tempMax: 28, tempMin: 24 }
    ];

    const result = calculateCoherenceScore(rainyItinerary, "Moderate", undefined, undefined, weatherForecast);

    expect(result.warnings.some(w => w.includes("Weather Alert") && w.includes("Heavy Thunderstorms"))).toBe(true);
    expect(result.selectionScore).toBeLessThan(100);
  });

  it("should safely handle weather forecast when condition is an object with description (WeatherCondition)", () => {
    const rainyItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Open Island Hopping", type: "nature" as const, lat: 12.92, lng: 100.88, time: "10:00" },
        ]
      }
    ];

    const objectWeatherForecast = [
      { date: "2026-09-14", maxTempC: 30, minTempC: 25, condition: { description: "Scattered Rain Showers", iconBaseUri: "uri" } }
    ];

    expect(() => calculateCoherenceScore(rainyItinerary, "Moderate", undefined, undefined, objectWeatherForecast as any)).not.toThrow();
    const result = calculateCoherenceScore(rainyItinerary, "Moderate", undefined, undefined, objectWeatherForecast as any);
    expect(result.warnings.some(w => w.includes("Weather Alert") && w.includes("Scattered Rain Showers"))).toBe(true);
  });

  it("should correctly populate passedChecks when an itinerary adheres to academic standards", () => {
    const excellentItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Grand Palace", type: "culture" as const, lat: 13.7500, lng: 100.4914, time: "09:30", rating: 4.6, userRatingsTotal: 5000, priceLevel: 2 },
          { id: "2", title: "Authentic Thai Lunch", type: "food" as const, lat: 13.7515, lng: 100.4925, time: "12:00", rating: 4.5, userRatingsTotal: 800, priceLevel: 2 },
          { id: "3", title: "Amulet Market", type: "shopping" as const, lat: 13.7530, lng: 100.4935, time: "14:00", rating: 4.3, userRatingsTotal: 400, priceLevel: 2 },
          { id: "4", title: "Riverside Sunset View", type: "attraction" as const, lat: 13.7540, lng: 100.4940, time: "17:30", rating: 4.7, userRatingsTotal: 1200, priceLevel: 2 },
        ]
      }
    ];

    const result = calculateCoherenceScore(excellentItinerary, "Moderate", undefined, { budget: "Mid-range", travelerType: "Couple" });

    expect(result.passedChecks.some(c => c.includes("Budget Alignment"))).toBe(true);
    expect(result.passedChecks.some(c => c.includes("Traveler Persona Fit"))).toBe(true);
    expect(result.passedChecks.some(c => c.includes("Quality & Review Standards"))).toBe(true);
    expect(result.passedChecks.some(c => c.includes("Category Variety (No Monotony)"))).toBe(true);
    expect(result.selectionScore).toBe(100);
    expect(result.totalScore).toBeGreaterThanOrEqual(85);
  });

  it("should maintain full backward compatibility when called without preferences or weather", () => {
    const simpleItinerary = [
      {
        day: 1,
        activities: [
          { id: "1", title: "Sight A", type: "culture" as const, lat: 13.75, lng: 100.50, time: "09:00" },
          { id: "2", title: "Lunch B", type: "food" as const, lat: 13.752, lng: 100.502, time: "12:00" }
        ]
      }
    ];

    expect(() => calculateCoherenceScore(simpleItinerary, "Moderate")).not.toThrow();
    const result = calculateCoherenceScore(simpleItinerary, "Moderate");
    expect(result.selectionScore).toBeDefined();
    expect(result.passedChecks).toBeInstanceOf(Array);
  });
});

describe("Single-Day Optimization & Monotony Prevention", () => {
  it("should interleave a different category activity when 3 consecutive spots share the same category", () => {
    const monotonousDay: Activity[] = [
      { id: "1", title: "Temple 1", type: "culture", description: "", lat: 13.750, lng: 100.490 },
      { id: "2", title: "Temple 2", type: "culture", description: "", lat: 13.751, lng: 100.491 },
      { id: "3", title: "Temple 3", type: "culture", description: "", lat: 13.752, lng: 100.492 },
      { id: "4", title: "Riverside Market", type: "shopping", description: "", lat: 13.753, lng: 100.493 },
      { id: "5", title: "Evening Bistro", type: "food", description: "", lat: 13.754, lng: 100.494 },
    ];

    const result = preventConsecutiveCategoryMonotony(monotonousDay);

    // Ensure no 3 consecutive spots are culture
    for (let i = 0; i < result.length - 2; i++) {
      const allCulture = result[i].type === "culture" && result[i + 1].type === "culture" && result[i + 2].type === "culture";
      expect(allCulture).toBe(false);
    }
  });

  it("should perform complete single-day optimization maintaining valid lunch, 2-Opt corridor, and monotonic time slots", () => {
    const scrambledDay: Activity[] = [
      { id: "temple1", title: "Wat Phra Kaew", type: "culture", lat: 13.7500, lng: 100.4914, description: "" },
      { id: "dinner", title: "Riverside Dinner", type: "food", lat: 13.7440, lng: 100.4900, description: "" },
      { id: "museum", title: "National Museum", type: "culture", lat: 13.7580, lng: 100.4920, description: "" },
      { id: "market", title: "Flower Market", type: "shopping", lat: 13.7430, lng: 100.4950, description: "" },
    ];

    const optimized = optimizeDayActivities(scrambledDay, "Moderate", { lat: 13.7500, lng: 100.4914 }, 1);

    // 1. Should have lunch scheduled
    const lunch = optimized.find(a => a.type === "food" && a.time && a.time >= "11:30" && a.time <= "13:30");
    expect(lunch).toBeDefined();

    // 2. Times must be strictly chronological
    for (let i = 0; i < optimized.length - 1; i++) {
      const t1 = optimized[i].time || "00:00";
      const t2 = optimized[i + 1].time || "00:00";
      expect(t1.localeCompare(t2)).toBeLessThan(0);
    }

    // 3. No intersecting edges
    expect(countIntersectingEdges(optimized)).toBe(0);
  });
});



