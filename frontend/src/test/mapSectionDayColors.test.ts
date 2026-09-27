import { describe, it, expect } from "vitest";
import { DAY_COLORS, type DayPlan, type Activity } from "@/components/TravelItinerary";

describe("MapSection Day Color & Index Resolution", () => {
  const sampleItinerary: DayPlan[] = [
    {
      day: 1,
      date: "2026-10-01",
      activities: [
        {
          id: "act-1",
          time: "09:00",
          title: "Grand Palace",
          description: "Historic temple",
          type: "culture",
          lat: 13.7500,
          lng: 100.4913,
        } as Activity,
      ],
    },
    {
      day: 2,
      date: "2026-10-02",
      activities: [
        {
          id: "act-2",
          time: "10:00",
          title: "Wat Arun",
          description: "Temple of Dawn",
          type: "culture",
          lat: 13.7437,
          lng: 100.4888,
        } as Activity,
      ],
    },
    {
      day: 3,
      date: "2026-10-03",
      activities: [
        {
          id: "act-3",
          time: "11:00",
          title: "Chatuchak Market",
          description: "Weekend market",
          type: "shopping",
          lat: 13.7999,
          lng: 100.5504,
        } as Activity,
      ],
    },
  ];

  // Helper matching MapSection's exact day index resolution algorithm
  const resolveDayIndices = (day: DayPlan, dayIndex: number) => {
    const rawDay = day.day;
    let effectiveDayIndex = dayIndex;
    if (typeof rawDay === "number" && !isNaN(rawDay)) {
      effectiveDayIndex = rawDay > 0 ? rawDay - 1 : rawDay;
    } else if (typeof rawDay === "string" && !isNaN(parseInt(rawDay, 10))) {
      const parsed = parseInt(rawDay, 10);
      effectiveDayIndex = parsed > 0 ? parsed - 1 : parsed;
    }
    const effectiveDayNumber = effectiveDayIndex + 1;
    return { effectiveDayIndex, effectiveDayNumber };
  };

  it("should assign correct DAY_COLORS when processing full itinerary", () => {
    sampleItinerary.forEach((day, idx) => {
      const { effectiveDayIndex, effectiveDayNumber } = resolveDayIndices(day, idx);
      expect(effectiveDayNumber).toBe(idx + 1);
      expect(effectiveDayIndex).toBe(idx);

      const color = DAY_COLORS[effectiveDayIndex % DAY_COLORS.length];
      if (day.day === 1) expect(color).toBe("#10b981"); // Green
      if (day.day === 2) expect(color).toBe("#3b82f6"); // Blue
      if (day.day === 3) expect(color).toBe("#f59e0b"); // Amber
    });
  });

  it("should preserve original Day 2 and Day 3 colors even when filtered to a single-element array", () => {
    // When evaluator filters Day 2, displayItinerary only contains Day 2 as index 0 of the sliced array
    const day2Only = [sampleItinerary[1]];
    expect(day2Only.length).toBe(1);

    const { effectiveDayIndex: day2Idx, effectiveDayNumber: day2Num } = resolveDayIndices(day2Only[0], 0);
    // Crucial: Must NOT be 0 (Day 1 Green), must be 1 (Day 2 Blue)!
    expect(day2Num).toBe(2);
    expect(day2Idx).toBe(1);
    expect(DAY_COLORS[day2Idx % DAY_COLORS.length]).toBe("#3b82f6");

    // Same test for Day 3 sliced alone
    const day3Only = [sampleItinerary[2]];
    const { effectiveDayIndex: day3Idx, effectiveDayNumber: day3Num } = resolveDayIndices(day3Only[0], 0);
    expect(day3Num).toBe(3);
    expect(day3Idx).toBe(2);
    expect(DAY_COLORS[day3Idx % DAY_COLORS.length]).toBe("#f59e0b");
  });

  it("should match filters whether specified as 1-based day or 0-based index or 'all'", () => {
    const isFilterActive = (filter: number | "all", effectiveIndex: number, effectiveNumber: number) => {
      if (filter === "all") return true;
      return filter === effectiveIndex || filter === effectiveNumber;
    };

    // Day 2 (effectiveDayIndex = 1, effectiveDayNumber = 2)
    const day2 = sampleItinerary[1];
    const { effectiveDayIndex, effectiveDayNumber } = resolveDayIndices(day2, 1);

    expect(isFilterActive("all", effectiveDayIndex, effectiveDayNumber)).toBe(true);
    expect(isFilterActive(2, effectiveDayIndex, effectiveDayNumber)).toBe(true); // 1-based filter from BlindEvaluation
    expect(isFilterActive(1, effectiveDayIndex, effectiveDayNumber)).toBe(true); // 0-based filter from Index.tsx
    expect(isFilterActive(3, effectiveDayIndex, effectiveDayNumber)).toBe(false);
  });
});
