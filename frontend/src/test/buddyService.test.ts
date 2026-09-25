import { describe, it, expect, vi } from "vitest";
import {
  getPixMascotUrl,
  getPixoPoseMetadata,
  evaluateDayBuddyAlerts,
  isTempleOrSacredSite,
  isCashDominantVenue,
  isOutdoorActivity,
  type PixPose,
  evaluateSmartReroute,
  calculateHaversineDistance,
  fetchLiveBuddyInsights,
  type LiveTransitStatus,
} from "../services/buddyService";
import { type DayPlan } from "../components/TravelItinerary";
import { type ForecastHour } from "../services/environmentService";

describe("Pixo Travel Buddy Service", () => {
  it("should map all Pixo mascot poses to their corresponding image paths in /pixo_carton/", () => {
    const standardPoses: PixPose[] = [
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
      "chat",
      "route_planer",
      "confident",
      "confused",
      "insight",
      "goodbye",
      "surprised",
    ];

    standardPoses.forEach((pose) => {
      const url = getPixMascotUrl(pose);
      expect(url).toBe(`/pixo_carton/pixo_${pose}.jpg`);
    });

    // Special cases
    expect(getPixMascotUrl("warning")).toBe("/pixo_carton/pixo_warning_temple.jpg");
    expect(getPixMascotUrl("happy")).toBe("/pixo_carton/pixo_celebrate.jpg");
    expect(getPixMascotUrl("chatbot_profile")).toBe("/pixo_carton/pixo_chatbot_profile.jpg");
    expect(getPixMascotUrl("unknown_pose")).toBe("/pixo_carton/pixo_tip.jpg");
  });

  it("should detect temples and trigger Dress Code Warning with pixo_warning_temple.jpg", () => {
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

  describe("evaluateSmartReroute (Smart Reroute & Dynamic Swap)", () => {
    it("should calculate Haversine distance correctly", () => {
      // Same point distance is 0
      const d0 = calculateHaversineDistance({ lat: 13.7563, lng: 100.5018 }, { lat: 13.7563, lng: 100.5018 });
      expect(d0).toBe(0);

      // Bangkok to Pattaya is approximately 95 - 120 km
      const bkk = { lat: 13.7563, lng: 100.5018 };
      const pattaya = { lat: 12.9276, lng: 100.8771 };
      const dKm = calculateHaversineDistance(bkk, pattaya);
      expect(dKm).toBeGreaterThan(90);
      expect(dKm).toBeLessThan(120);
    });

    it("Test Case 1: should propose Smart Swap when traffic delay is >= 20 mins and next place is close", () => {
      const mockDay: DayPlan = {
        day: 1,
        date: "Day 1",
        activities: [
          {
            id: "act-1",
            time: "09:00",
            title: "Grand Palace (พระบรมมหาราชวัง)",
            description: "Historical landmark",
            type: "landmark",
            lat: 13.7500,
            lng: 100.4914,
          },
          {
            id: "act-2",
            time: "11:00",
            title: "Wat Arun (วัดอรุณ)",
            description: "Temple of Dawn",
            type: "culture",
            lat: 13.7437,
            lng: 100.4889,
          },
          {
            id: "act-3",
            time: "13:30",
            title: "Museum Siam (มิวเซียมสยาม)",
            description: "Discovery museum",
            type: "culture",
            lat: 13.7441,
            lng: 100.4941,
            openNow: true,
          },
        ],
      };

      const segments = [
        { durationText: "45 min", distanceText: "3.5 km", status: "ok" },
        { durationText: "10 min", distanceText: "1.2 km", status: "ok" },
      ];

      const proposal = evaluateSmartReroute(mockDay, 0, segments, null, "Bangkok", "th");
      expect(proposal).not.toBeNull();
      expect(proposal?.type).toBe("SWAP");
      expect(proposal?.fromActivityIndex).toBe(1);
      expect(proposal?.toActivityIndex).toBe(2);
      expect(proposal?.fromActivityTitle).toBe("Wat Arun (วัดอรุณ)");
      expect(proposal?.toActivityTitle).toBe("Museum Siam (มิวเซียมสยาม)");
      expect(proposal?.timeSavedMinutes).toBeGreaterThanOrEqual(15);
      expect(proposal?.pixMessage).toContain("ประหยัดเวลา");
    });

    it("Test Case 2: Opening Hours Guard - should NOT propose swap if destination activity is closed", () => {
      const mockDay: DayPlan = {
        day: 1,
        date: "Day 1",
        activities: [
          {
            id: "act-1",
            time: "09:00",
            title: "Grand Palace",
            description: "Palace",
            type: "landmark",
            lat: 13.7500,
            lng: 100.4914,
          },
          {
            id: "act-2",
            time: "11:00",
            title: "Wat Arun",
            description: "Temple",
            type: "culture",
            lat: 13.7437,
            lng: 100.4889,
          },
          {
            id: "act-3",
            time: "13:30",
            title: "Museum Siam",
            description: "Museum",
            type: "culture",
            lat: 13.7441,
            lng: 100.4941,
            openNow: false, // Closed!
          },
        ],
      };

      const segments = [
        { durationText: "45 min", distanceText: "3.5 km", status: "ok" },
        { durationText: "10 min", distanceText: "1.2 km", status: "ok" },
      ];

      const proposal = evaluateSmartReroute(mockDay, 0, segments, null, "Bangkok", "th");
      // Must not propose swapping with a closed museum
      if (proposal) {
        expect(proposal.type).not.toBe("SWAP");
      } else {
        expect(proposal).toBeNull();
      }
    });

    it("Test Case 3: Haversine Detour Guard - should NOT swap if next place causes excessive backtracking (>1.5x)", () => {
      const mockDay: DayPlan = {
        day: 1,
        date: "Day 1",
        activities: [
          {
            id: "act-1",
            time: "09:00",
            title: "Siam Paragon",
            description: "Shopping",
            type: "shopping",
            lat: 13.7460,
            lng: 100.5349,
          },
          {
            id: "act-2",
            time: "11:00",
            title: "CentralWorld",
            description: "Shopping",
            type: "shopping",
            lat: 13.7469,
            lng: 100.5398, // Close to Siam Paragon (~0.5 km)
          },
          {
            id: "act-3",
            time: "14:00",
            title: "Pattaya Floating Market",
            description: "Far excursion",
            type: "attraction",
            lat: 12.8714,
            lng: 100.9069, // 100+ km away in Pattaya
            openNow: true,
          },
        ],
      };

      const segments = [
        { durationText: "40 min", distanceText: "0.5 km", status: "ok" }, // Traffic jam between Siam and CentralWorld
        { durationText: "2h", distanceText: "110 km", status: "ok" },
      ];

      const proposal = evaluateSmartReroute(mockDay, 0, segments, null, "Bangkok", "th");
      expect(proposal).not.toBeNull();
      // Should NOT propose SWAP (going to Pattaya and back to CentralWorld is a massive detour)
      expect(proposal?.type).toBe("ADVICE");
      expect(proposal?.pixMessage).toContain("ย้อนศร");
    });

    it("Test Case 4: Smart Substitute - should propose nearby alternatives when place is closed due to disruption", () => {
      const mockDay: DayPlan = {
        day: 1,
        date: "Day 1",
        activities: [
          {
            id: "act-1",
            time: "09:00",
            title: "Wat Phra Kaew",
            description: "Grand Palace complex",
            type: "culture",
            lat: 13.7516,
            lng: 100.4927,
          },
          {
            id: "act-2",
            time: "13:00",
            title: "Iconsiam",
            description: "Riverside mall",
            type: "shopping",
            lat: 13.7267,
            lng: 100.5108,
          },
        ],
      };

      const liveStatus: LiveTransitStatus = {
        hasDisruption: true,
        attractionAlerts: [
          {
            placeName: "Wat Phra Kaew",
            status: "closed",
            note: "มีพิธีการทางราชการ ปิดทำการชั่วคราว",
          },
        ],
      };

      const proposal = evaluateSmartReroute(mockDay, 0, [], liveStatus, "กรุงเทพมหานคร", "th");
      expect(proposal).not.toBeNull();
      expect(proposal?.type).toBe("SUBSTITUTE");
      expect(proposal?.fromActivityIndex).toBe(0);
      expect(proposal?.fromActivityTitle).toBe("Wat Phra Kaew");
      expect(proposal?.alternatives).toBeDefined();
      expect(proposal?.alternatives?.length).toBeGreaterThanOrEqual(2);
      expect(proposal?.pixMessage).toContain("ปิดให้บริการชั่วคราว");
    });
  });

  describe("Day-Specific Temporal Scoping & Multi-Modal Transit Advice", () => {
    it("should include multi-modal transit (BTS, MRT, ARL, Red Line) and ride-hailing (Grab/Bolt) in rush hour warnings (TH)", () => {
      const mockDay: DayPlan = {
        day: 2,
        date: "Day 2",
        activities: [
          {
            id: "act-evening-commute",
            time: "18:00",
            title: "Commute to Chinatown (เยาวราช)",
            description: "Transit during peak hours",
            type: "transport",
            lat: 13.74,
            lng: 100.51,
          },
        ],
      };

      const briefing = evaluateDayBuddyAlerts(mockDay, 1, 3, [], undefined, "Bangkok", "th");
      const transitAlert = briefing.allAlerts.find((a) => a.triggerType === "traffic_rush");
      expect(transitAlert).toBeDefined();
      expect(transitAlert?.message).toContain("BTS");
      expect(transitAlert?.message).toContain("MRT");
      expect(transitAlert?.message).toContain("Grab");
      expect(transitAlert?.message).toContain("Bolt");
      expect(briefing.trafficSummary).toContain("Grab/Bolt");
    });

    it("should include rapid transit and ride-hailing (Grab/Bolt) in rush hour warnings (EN)", () => {
      const mockDay: DayPlan = {
        day: 2,
        date: "Day 2",
        activities: [
          {
            id: "act-evening-commute-en",
            time: "18:00",
            title: "Commute to Chinatown",
            description: "Transit during peak hours",
            type: "transport",
            lat: 13.74,
            lng: 100.51,
          },
        ],
      };

      const briefing = evaluateDayBuddyAlerts(mockDay, 1, 3, [], undefined, "Bangkok", "en");
      const transitAlert = briefing.allAlerts.find((a) => a.triggerType === "traffic_rush");
      expect(transitAlert).toBeDefined();
      expect(transitAlert?.message).toContain("rapid transit");
      expect(transitAlert?.message).toContain("Grab or Bolt");
      expect(briefing.trafficSummary).toContain("Grab/Bolt");
    });

    it("should forward accurate targetDate to /ai/buddy-live-check in fetchLiveBuddyInsights", async () => {
      const originalFetch = global.fetch;
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        capturedBody = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              has_disruption: false,
              transit_status: "normal",
              title: "ข้อมูลการเดินทาง",
              summary: "การเดินทางปกติ",
            }),
        });
      }) as any;

      try {
        const testDate = new Date("2026-09-25T10:00:00Z");
        await fetchLiveBuddyInsights("Bangkok", ["เยาวราช", "วัดมังกร"], testDate);

        expect(capturedBody).not.toBeNull();
        expect(capturedBody.city).toBe("Bangkok");
        expect(capturedBody.places).toEqual(["เยาวราช", "วัดมังกร"]);
        expect(capturedBody.date).toBe("2026-09-25");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should correctly receive and parse noticeType for scheduled maintenance and live incidents", async () => {
      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              has_disruption: true,
              transit_status: "warning",
              notice_type: "scheduled_maintenance",
              title: "แจ้งเตือนการบูรณะซ่อมแซม",
              summary: "ปิดปรับปรุงสะพานข้ามแยกตามกำหนดการ",
            }),
        });
      }) as any;

      try {
        const res = await fetchLiveBuddyInsights("Bangkok", ["สะพานพระราม 8"], "2026-09-26");
        expect(res.hasDisruption).toBe(true);
        expect(res.noticeType).toBe("scheduled_maintenance");
        expect(res.title).toContain("แจ้งเตือนการบูรณะซ่อมแซม");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Pixo Pose Metadata & Localization", () => {
    it("should return localized metadata for standard and special poses", () => {
      const warningTh = getPixoPoseMetadata("warning", "th");
      expect(warningTh.title).toContain("ความปลอดภัย");
      expect(warningTh.tag).toBe("ตรวจระเบียบ");
      expect(warningTh.emoji).toBe("🛕");

      const warningEn = getPixoPoseMetadata("warning", "en");
      expect(warningEn.title).toBe("Pixo Safety & Rules Guide");
      expect(warningEn.tag).toBe("Rules & Safety");

      const rainyTh = getPixoPoseMetadata("rainy", "th");
      expect(rainyTh.emoji).toBe("☔");
      expect(rainyTh.tag).toBe("ลุยฝน");

      const happyTh = getPixoPoseMetadata("happy", "th");
      expect(happyTh.emoji).toBe("🎉");
      expect(happyTh.title).toContain("ฉลองทริป");

      const fallbackMeta = getPixoPoseMetadata("unknown_random_pose", "en");
      expect(fallbackMeta.title).toBe("Pixo Travel Tips");
      expect(fallbackMeta.emoji).toBe("💡");
    });
  });
});

