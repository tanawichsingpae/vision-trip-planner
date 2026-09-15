import { describe, it, expect } from "vitest";
import { safeParseJson } from "@/utils/jsonRepair";

describe("safeParseJson", () => {
  it("parses valid JSON without alteration", () => {
    const data = { hello: "world", count: 42, list: [1, 2, 3] };
    const str = JSON.stringify(data);
    expect(safeParseJson(str)).toEqual(data);
  });

  it("extracts JSON wrapped in markdown fences", () => {
    const wrapped = "```json\n{\n  \"city\": \"Bangkok\"\n}\n```";
    expect(safeParseJson(wrapped)).toEqual({ city: "Bangkok" });
  });

  it("extracts JSON with conversational preamble and suffix", () => {
    const text = "Sure! Here is your itinerary:\n{\"day\": 1, \"title\": \"Tour\"}\nEnjoy your trip!";
    expect(safeParseJson(text)).toEqual({ day: 1, title: "Tour" });
  });

  it("repairs truncated JSON ending abruptly inside an array of objects", () => {
    const truncated = '{"itinerary": [{"day": 1, "activities": [{"title": "Wat Arun", "time": "09:00"}';
    const result = safeParseJson(truncated);
    expect(result.itinerary).toBeDefined();
    expect(result.itinerary[0].activities[0].title).toBe("Wat Arun");
  });

  it("repairs truncated JSON ending mid-string", () => {
    const truncated = '{"itinerary": [{"day": 1, "activities": [{"title": "Wat Phra';
    const result = safeParseJson(truncated);
    expect(result.itinerary).toBeDefined();
    expect(result.itinerary[0].activities[0].title).toBe("Wat Phra");
  });
});
