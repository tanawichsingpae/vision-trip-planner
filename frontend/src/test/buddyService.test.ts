import { describe, it, expect } from "vitest";
import {
  getPixMascotUrl,
  evaluateDayBuddyAlerts,
  isTempleOrSacredSite,
  isCashDominantVenue,
  isOutdoorActivity,
  type PixPose,
} from "../services/buddyService";
import { type DayPlan } from "../components/TravelItinerary";
import { type ForecastHour } from "../services/environmentService";

describe("Pix Travel Buddy Service", () => {
  it("should map all 13 Pix mascot poses to their corresponding image paths", () => {
    const poses: PixPose[] = [
      "warning",
      "rainy",
      "sunny",
      "transit",
      "tip",
      "foodie",
      "budget",
      "flight",
      "night",
      "planning",
      "celebrate",
      "camera",
      "search",
    ];

    poses.forEach((pose) => {
      const url = getPixMascotUrl(pose);
      expect(url).toBe(`/logos/pix_${pose}.jpg`);
    });
  });

  it("should detect temples and trigger Dress Code Warning with pix_warning.jpg", () => {
    expect(isTempleOrSacredSite("Wat Phra Kaew (Temple of the Emerald Buddha)")).toBe(true);
    expect(isTempleOrSacredSite("วัดอรุณราชวราราม")).toBe(true);
    expect(isTempleOrSacredSite("Grand Palace & Temple Grounds")).toBe(true);
    expect(isTempleOrSacredSite("Siam Paragon Shopping Mall")).toBe(false);

    const mockDay: DayPlan = {
      day: 1,
      date: "Day 1",
      activities: [
        {
          id: "act-1",
          time: "09:00",
          title: "Wat Phra Kaew (วัดพระแก้ว)",
          description: "Historic Buddhist temple in Bangkok",
          type: "culture",
          lat: 13.7516,
          lng: 100.4927,
        },
      ],
    };

    const briefing = evaluateDayBuddyAlerts(mockDay, 0, 1, [], undefined, "Bangkok", "th");
    expect(briefing.dominantPose).toBe("warning");
    expect(briefing.dressCodeWarning).toBeDefined();
    expect(briefing.dressCodeWarning).toContain("กางเกงขายาว");

    const templeAlert = briefing.allAlerts.find((a) => a.triggerType === "dress_code");
    expect(templeAlert).toBeDefined();
    expect(templeAlert?.pose).toBe("warning");
  });

  it("should detect rain forecast during outdoor activities and trigger pix_rainy.jpg", () => {
    expect(isOutdoorActivity("Lumpini Park", "Public open park", "nature")).toBe(true);
    expect(isOutdoorActivity("Patong Beach", "Relax at the beach", "beach")).toBe(true);

    const tripDate = new Date("2026-10-15T00:00:00Z");

    const mockHourly: ForecastHour[] = [
      {
        time: "2026-10-15T14:00:00Z",
        tempC: 28,
        condition: { description: "Heavy Thunderstorm" },
      },
    ];

    const mockDay: DayPlan = {
      day: 1,
      date: "Day 1",
      activities: [
        {
          id: "act-beach",
          time: "14:00",
          title: "Kata Beach Walk",
          description: "Strolling along the open coastline",
          type: "beach",
          lat: 7.82,
          lng: 98.3,
        },
      ],
    };

    const briefing = evaluateDayBuddyAlerts(mockDay, 0, 1, mockHourly, tripDate, "Phuket", "th");
    expect(briefing.dominantPose).toBe("rainy");
    const rainAlert = briefing.allAlerts.find((a) => a.triggerType === "weather_rain");
    expect(rainAlert).toBeDefined();
    expect(rainAlert?.pose).toBe("rainy");
    expect(rainAlert?.severity).toBe("urgent");
    expect(rainAlert?.message).toContain("ฝนตก");
  });

  it("should detect evening rush hour and trigger pix_transit.jpg", () => {
    const mockDay: DayPlan = {
      day: 2,
      date: "Day 2",
      activities: [
        {
          id: "act-commute",
          time: "18:00",
          title: "Transfer to Asok / Sukhumvit",
          description: "Cross-town transit through heavy traffic",
          type: "transport",
          lat: 13.737,
          lng: 100.56,
        },
      ],
    };

    const briefing = evaluateDayBuddyAlerts(mockDay, 1, 3, [], undefined, "Bangkok", "th");
    const transitAlert = briefing.allAlerts.find((a) => a.triggerType === "traffic_rush");
    expect(transitAlert).toBeDefined();
    expect(transitAlert?.pose).toBe("transit");
    expect(transitAlert?.message).toContain("ชั่วโมงเร่งด่วน");
  });

  it("should detect night markets and trigger cash reminder with pix_budget.jpg", () => {
    expect(isCashDominantVenue("Chatuchak Weekend Market")).toBe(true);
    expect(isCashDominantVenue("Jodd Fairs DanNeramit", "Night market street food")).toBe(true);

    const mockDay: DayPlan = {
      day: 1,
      date: "Day 1",
      activities: [
        {
          id: "act-jodd",
          time: "19:00",
          title: "Jodd Fairs Night Market (จ๊อดแฟร์)",
          description: "Street food and local fashion stalls",
          type: "shopping",
          lat: 13.81,
          lng: 100.56,
        },
      ],
    };

    const briefing = evaluateDayBuddyAlerts(mockDay, 0, 1, [], undefined, "Bangkok", "th");
    const cashAlert = briefing.allAlerts.find((a) => a.triggerType === "cash_budget");
    expect(cashAlert).toBeDefined();
    expect(cashAlert?.pose).toBe("budget");
    expect(cashAlert?.message).toContain("เงินสด");
  });

  it("should detect airport activities and trigger pix_flight.jpg", () => {
    const mockDay: DayPlan = {
      day: 1,
      date: "Day 1",
      activities: [
        {
          id: "act-airport",
          time: "08:00",
          title: "Suvarnabhumi Airport Arrival (สนามบินสุวรรณภูมิ)",
          description: "International flight arrival",
          type: "transport",
          lat: 13.69,
          lng: 100.75,
        },
      ],
    };

    const briefing = evaluateDayBuddyAlerts(mockDay, 0, 3, [], undefined, "Bangkok", "th");
    const flightAlert = briefing.allAlerts.find((a) => a.triggerType === "flight_airport");
    expect(flightAlert).toBeDefined();
    expect(flightAlert?.pose).toBe("flight");
    expect(flightAlert?.message).toContain("สนามบิน");
  });
});
