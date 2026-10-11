import { describe, it, expect } from "vitest";
import { splitTripIntoPosterChunks, buildPosterPrompt } from "@/lib/export/aiPosterPrompt";
import { ExportTrip, ExportDay } from "@/lib/export/types";

const mockTrip: ExportTrip = {
  title: "Tokyo Family Trip",
  destination: "Tokyo, Japan",
  startDate: "2026-10-15",
  endDate: "2026-10-19",
  totalDays: 5,
  totalActivities: 15,
  days: [
    {
      day: 1,
      date: "Thu 15 Oct",
      title: "Arrival and Ueno",
      accentColor: "#e91e63",
      activities: [
        { index: 1, time: "09:45", name: "Narita Airport", category: "transit" },
        { index: 2, time: "11:30", name: "Keisei Skyliner", category: "train" },
        { index: 3, time: "13:00", name: "Yayoiken Ueno", category: "food" },
      ],
    },
    {
      day: 2,
      date: "Fri 16 Oct",
      title: "Asakusa & Skytree",
      accentColor: "#10b981",
      activities: [
        { index: 1, time: "10:00", name: "Sensoji Temple", category: "temple" },
        { index: 2, time: "14:00", name: "Tokyo Skytree", category: "sightseeing" },
      ],
    },
    {
      day: 3,
      date: "Sat 17 Oct",
      title: "Tokyo Station & Ginza",
      accentColor: "#3b82f6",
      activities: [
        { index: 1, time: "10:00", name: "Tokyo Station", category: "train" },
        { index: 2, time: "13:30", name: "Ginza Shopping", category: "shopping" },
      ],
    },
    {
      day: 4,
      date: "Sun 18 Oct",
      title: "Shibuya & Harajuku",
      accentColor: "#8b5cf6",
      activities: [
        { index: 1, time: "10:30", name: "Shibuya Crossing", category: "sightseeing" },
        { index: 2, time: "14:30", name: "Takeshita Street", category: "shopping" },
      ],
    },
    {
      day: 5,
      date: "Mon 19 Oct",
      title: "Ueno Shopping & Return",
      accentColor: "#f59e0b",
      activities: [
        { index: 1, time: "09:30", name: "Ameyoko Market", category: "shopping" },
        { index: 2, time: "16:30", name: "Keisei Skyliner to Narita", category: "train" },
      ],
    },
  ],
};

describe("AI Poster Export Logic", () => {
  it("splits a 5-day trip into 2 chunks appropriately", () => {
    const chunks = splitTripIntoPosterChunks(mockTrip);
    expect(chunks.length).toBe(2);

    // Chunk 1 has Days 1-3
    expect(chunks[0].partIndex).toBe(1);
    expect(chunks[0].totalParts).toBe(2);
    expect(chunks[0].days.length).toBe(3);
    expect(chunks[0].dayRangeLabel).toBe("Days 1 - 3");

    // Chunk 2 has Days 4-5
    expect(chunks[1].partIndex).toBe(2);
    expect(chunks[1].totalParts).toBe(2);
    expect(chunks[1].days.length).toBe(2);
    expect(chunks[1].dayRangeLabel).toBe("Days 4 - 5");
  });

  it("keeps a 3-day trip in a single chunk", () => {
    const shortTrip: ExportTrip = {
      ...mockTrip,
      totalDays: 3,
      days: mockTrip.days.slice(0, 3),
    };
    const chunks = splitTripIntoPosterChunks(shortTrip);
    expect(chunks.length).toBe(1);
    expect(chunks[0].partIndex).toBe(1);
    expect(chunks[0].days.length).toBe(3);
  });

  it("splits an 8-day trip into 3 chunks", () => {
    const longDays: ExportDay[] = Array.from({ length: 8 }, (_, i) => ({
      day: i + 1,
      date: `Day ${i + 1}`,
      title: `Adventure Day ${i + 1}`,
      accentColor: "#3b82f6",
      activities: [],
    }));
    const longTrip: ExportTrip = {
      ...mockTrip,
      totalDays: 8,
      days: longDays,
    };
    const chunks = splitTripIntoPosterChunks(longTrip);
    expect(chunks.length).toBe(3);
  });

  it("generates a rich English prompt containing destination and columns", () => {
    const prompt = buildPosterPrompt(mockTrip, mockTrip.days.slice(0, 3), 1, 2);
    expect(prompt).toContain("Tokyo, Japan");
    expect(prompt).toContain("16:9");
    expect(prompt).toContain("DAY 1");
    expect(prompt).toContain("Narita Airport");
    expect(prompt).toContain("Sensoji Temple");
    expect(prompt).toContain("Part 1 of 2");
  });
});
