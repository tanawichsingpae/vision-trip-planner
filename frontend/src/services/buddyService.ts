/**
 * Pix Travel Buddy Service
 * Intelligent Context-Aware Engine mapping Pix Mascot Poses to Real-Time Travel Alerts.
 */

import { type ForecastHour, type EnvironmentData } from "@/services/environmentService";
import { type DayPlan, type Activity } from "@/components/TravelItinerary";

export type PixPose =
  | "warning"
  | "rainy"
  | "sunny"
  | "transit"
  | "tip"
  | "foodie"
  | "budget"
  | "flight"
  | "night"
  | "planning"
  | "celebrate"
  | "camera"
  | "search";

export type BuddyAlertSeverity = "info" | "warning" | "urgent";

export interface BuddyAlert {
  id: string;
  pose: PixPose;
  title: string;
  message: string;
  severity: BuddyAlertSeverity;
  triggerType:
    | "weather_rain"
    | "weather_heat"
    | "traffic_rush"
    | "dress_code"
    | "foodie"
    | "cash_budget"
    | "flight_airport"
    | "night_rest"
    | "proactive_tip"
    | "live_search";
  activityId?: string;
  activityTitle?: string;
  actionLabel?: string;
  actionType?: "swap_indoor" | "transit_tip" | "view_tip" | "open_map";
}

export interface BuddyDayBriefing {
  dayIndex: number;
  dayNumber: number;
  dominantPose: PixPose;
  greeting: string;
  weatherSummary: string;
  trafficSummary: string;
  dressCodeWarning?: string;
  keyAlerts: BuddyAlert[];
  allAlerts: BuddyAlert[];
}

/**
 * Returns the public asset URL for a given Pix pose.
 */
export function getPixMascotUrl(pose: PixPose): string {
  return `/logos/pix_${pose}.jpg`;
}

/**
 * Checks whether an activity title or description mentions temples, royal palaces, or sacred sites.
 */
export function isTempleOrSacredSite(title: string, description: string = ""): boolean {
  const text = `${title} ${description}`.toLowerCase();
  const keywords = [
    "wat ", "wat-", "temple", "palace", "shrine", "pagoda", "mosque", "cathedral",
    "วัด", "วัง", "พระบรมมหาราชวัง", "พระราชวัง", "ศาลเจ้า", "เจดีย์", "โบสถ์",
    "grand palace", "emerald buddha", "wat phra", "wat arun", "wat pho"
  ];
  return keywords.some((kw) => text.includes(kw));
}

/**
 * Checks whether an activity is a cash-dominated venue (e.g. night market, street food, floating market).
 */
export function isCashDominantVenue(title: string, description: string = "", type: string = ""): boolean {
  const text = `${title} ${description} ${type}`.toLowerCase();
  const keywords = [
    "market", "night market", "street food", "bazaar", "flea market", "floating market",
    "ตลาด", "ตลาดนัด", "ตลาดน้ำ", "เยาวราช", "จตุจักร", "jodd", "สตรีทฟู้ด", "ถนนคนเดิน"
  ];
  return keywords.some((kw) => text.includes(kw));
}

/**
 * Checks whether an activity is outdoor nature, beach, open walking street or park.
 */
export function isOutdoorActivity(title: string, description: string = "", type: string = ""): boolean {
  const text = `${title} ${description} ${type}`.toLowerCase();
  const outdoorTypes = ["nature", "beach", "park", "attraction"];
  if (outdoorTypes.includes(type.toLowerCase())) return true;
  const keywords = [
    "beach", "park", "garden", "island", "mountain", "waterfall", "outdoor", "boat", "ferry",
    "หาด", "เกาะ", "สวน", "ภูเขา", "น้ำตก", "เรือ", "ตลาดกลางแจ้ง", "เดินเล่น", "สะพาน"
  ];
  return keywords.some((kw) => text.includes(kw));
}

/**
 * Converts a time string "HH:MM" into minutes from midnight.
 */
function timeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":").map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

/**
 * Finds the weather forecast for a specific activity based on date & time.
 */
function matchActivityWeather(
  activityTime: string | undefined,
  dayDate: Date | undefined,
  hourlyWeather: ForecastHour[]
): ForecastHour | null {
  if (!activityTime || !hourlyWeather.length) return null;
  const [h, m] = activityTime.split(":").map(Number);
  if (isNaN(h)) return null;

  // 1. Try matching with full Date if dayDate provided
  if (dayDate) {
    const targetDate = new Date(dayDate);
    targetDate.setHours(h, m || 0, 0, 0);

    let best: ForecastHour | null = null;
    let minDiff = Infinity;

    for (const hw of hourlyWeather) {
      const hwDate = new Date(hw.time);
      const diff = Math.abs(hwDate.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        best = hw;
      }
    }

    if (best && minDiff <= 3 * 3600 * 1000) return best;

    // Match by date prefix + hour
    const ymd = targetDate.toISOString().split("T")[0];
    const hourPrefix = `${String(h).padStart(2, "0")}:`;
    const matched = hourlyWeather.find((hw) => hw.time.includes(ymd) && (hw.time.includes(`T${hourPrefix}`) || hw.time.includes(` ${hourPrefix}`)));
    if (matched) return matched;
  }

  // 2. Fallback: match by hour within forecast
  const hourPrefix = `T${String(h).padStart(2, "0")}:`;
  const hourPrefixSimple = `${String(h).padStart(2, "0")}:`;
  const byHour = hourlyWeather.find(
    (hw) => hw.time.includes(hourPrefix) || hw.time.includes(hourPrefixSimple)
  );
  if (byHour) return byHour;

  return hourlyWeather[0] || null;
}

/**
 * Analyzes a day plan and weather data to generate a complete Buddy Day Briefing and per-activity alerts.
 */
export function evaluateDayBuddyAlerts(
  day: DayPlan,
  dayIndex: number,
  totalDays: number,
  hourlyWeather: ForecastHour[] = [],
  tripStartDate?: Date,
  destinationName?: string,
  language: "th" | "en" = "th"
): BuddyDayBriefing {
  const alerts: BuddyAlert[] = [];
  const activities = day.activities || [];

  let currentDayDate: Date | undefined;
  if (tripStartDate) {
    currentDayDate = new Date(tripStartDate);
    currentDayDate.setDate(currentDayDate.getDate() + dayIndex);
  }

  const isTh = language === "th";
  let hasRainWarning = false;
  let hasHeatWarning = false;
  let hasTransitWarning = false;
  let hasTempleWarning = false;
  let hasFlightAlert = false;
  let dressCodeWarningText: string | undefined;

  // 1. Day-level checks: Flight / Airport check for Day 1 or Last Day
  const isFirstDay = dayIndex === 0;
  const isLastDay = dayIndex === totalDays - 1;

  activities.forEach((act, actIdx) => {
    const actTimeMin = timeToMinutes(act.time);
    const title = act.title || "";
    const desc = act.description || "";
    const type = act.type || "";

    // ── Check A: Flight & Airport ──
    const flightKeywords = ["airport", "flight", "terminal", "สนามบิน", "สุวรรณภูมิ", "ดอนเมือง", "ภูเก็ตแอร์พอร์ต", "บิน"];
    const isAirportAct = flightKeywords.some((kw) => `${title} ${desc}`.toLowerCase().includes(kw));

    if (isAirportAct || ((isFirstDay || isLastDay) && act.type === "transport" && actIdx === (isLastDay ? activities.length - 1 : 0))) {
      hasFlightAlert = true;
      alerts.push({
        id: `buddy-flight-${dayIndex}-${act.id}`,
        pose: "flight",
        title: isTh ? "เที่ยวบิน & สนามบิน" : "Flight & Airport Transfer",
        message: isTh
          ? "อย่าลืมเผื่อเวลาเดินทางไปสนามบินล่วงหน้าอย่างน้อย 3 ชั่วโมงสำหรับเที่ยวบินระหว่างประเทศ และ 2 ชั่วโมงสำหรับเที่ยวบินในประเทศนะครับ"
          : "Remember to arrive at the airport at least 3 hours prior for international flights and 2 hours for domestic flights.",
        severity: "warning",
        triggerType: "flight_airport",
        activityId: act.id,
        activityTitle: title,
        actionLabel: isTh ? "ตรวจสอบเส้นทาง" : "Check Route",
        actionType: "open_map",
      });
    }

    // ── Check B: Temple & Sacred Site Dress Code ──
    if (isTempleOrSacredSite(title, desc)) {
      hasTempleWarning = true;
      const templeMsg = isTh
        ? `เราจะไป "${title}" อย่าลืมสวมกางเกงขายาวหรือกระโปรงยาวคลุมเข่า และเสื้อมีแขนนะครับ จะได้เข้าชมได้สะดวกและไม่ต้องเสียเวลาเช่าผ้าคลุมด้านหน้าครับ`
        : `Visiting "${title}" requires modest attire: please wear pants/skirts covering knees and shirts with sleeves.`;
      dressCodeWarningText = templeMsg;

      alerts.push({
        id: `buddy-temple-${dayIndex}-${act.id}`,
        pose: "warning",
        title: isTh ? "เตือนการแต่งกาย (Dress Code)" : "Dress Code Reminder",
        message: templeMsg,
        severity: "warning",
        triggerType: "dress_code",
        activityId: act.id,
        activityTitle: title,
      });
    }

    // ── Check C: Weather (Rain / Storm / High Heat & UV) ──
    const actWeather = matchActivityWeather(act.time, currentDayDate, hourlyWeather);
    if (actWeather) {
      const cond = (actWeather.condition?.description || "").toLowerCase();
      const isRain = cond.includes("rain") || cond.includes("shower") || cond.includes("storm") || cond.includes("thunder") || cond.includes("drizzle");
      const isHot = actWeather.tempC >= 34;

      if (isRain && isOutdoorActivity(title, desc, type)) {
        hasRainWarning = true;
        alerts.push({
          id: `buddy-rain-${dayIndex}-${act.id}`,
          pose: "rainy",
          title: isTh ? "พิกซ์เตือนฝนตก" : "Rain & Weather Alert",
          message: isTh
            ? `ช่วง ${act.time || "นี้"} ที่ "${title}" มีแนวโน้มฝนตก (${actWeather.tempC}°C, ${actWeather.condition?.description}) พิกซ์แนะนำพกร่มพับหรือเตรียมแผนสลับสถานที่ในร่มครับ`
            : `Rain forecasted around ${act.time || "this time"} at "${title}" (${actWeather.tempC}°C, ${actWeather.condition?.description}). Carry an umbrella or consider indoor alternatives.`,
          severity: "urgent",
          triggerType: "weather_rain",
          activityId: act.id,
          activityTitle: title,
          actionLabel: isTh ? "สลับสถานที่ในร่ม" : "Swap Indoor Spot",
          actionType: "swap_indoor",
        });
      } else if (isHot && actTimeMin !== null && actTimeMin >= 11 * 60 + 30 && actTimeMin <= 15 * 60 + 30 && isOutdoorActivity(title, desc, type)) {
        hasHeatWarning = true;
        alerts.push({
          id: `buddy-heat-${dayIndex}-${act.id}`,
          pose: "sunny",
          title: isTh ? "แดดจัด & อากาศร้อน" : "High Heat & Sun Warning",
          message: isTh
            ? `ช่วงบ่ายที่ "${title}" อุณหภูมิสูงแตะ ${actWeather.tempC}°C อย่าลืมทากันแดด พกหมวก/แว่นกันแดด และจิบน้ำสม่ำเสมอครับ`
            : `Afternoon temperature at "${title}" reaches ${actWeather.tempC}°C. Stay hydrated and wear sun protection.`,
          severity: "info",
          triggerType: "weather_heat",
          activityId: act.id,
          activityTitle: title,
        });
      }
    }

    // ── Check D: Transit & Rush Hour ──
    if (actTimeMin !== null) {
      const isEveningRush = actTimeMin >= 17 * 60 && actTimeMin <= 19 * 60 + 30;
      const isMorningRush = actTimeMin >= 7 * 60 + 30 && actTimeMin <= 9 * 60;
      const isTransport = type.toLowerCase() === "transport" || title.toLowerCase().includes("transfer") || title.toLowerCase().includes("travel") || title.toLowerCase().includes("เดินทาง");

      // Check distance or commute to next stop if available, or if activity is explicitly a commute/transfer
      const distance = (act as any).distanceToNextKm ?? (act.lng && actIdx < activities.length - 1 ? 4.0 : 1.0);
      if ((isEveningRush || isMorningRush) && (distance >= 2.5 || isTransport)) {
        hasTransitWarning = true;
        alerts.push({
          id: `buddy-transit-${dayIndex}-${act.id}`,
          pose: "transit",
          title: isTh ? "เลี่ยงรถติดชั่วโมงเร่งด่วน" : "Rush Hour Commute Warning",
          message: isTh
            ? `ช่วงเวลาเดินทาง (${act.time}) ตรงกับชั่วโมงเร่งด่วน การจราจรบนถนนอาจติดขัดมาก พิกซ์แนะนำให้เดินทางด้วย MRT/BTS หรือเรือโดยสารเพื่อประหยัดเวลาครับ`
            : `Traveling around ${act.time} coincides with peak traffic. Consider using rapid transit (MRT/BTS/Metro) to save commute time.`,
          severity: "warning",
          triggerType: "traffic_rush",
          activityId: act.id,
          activityTitle: title,
          actionLabel: isTh ? "ทิปการเดินทาง" : "Transit Tips",
          actionType: "transit_tip",
        });
      }
    }

    // ── Check E: Cash & Night Market ──
    if (isCashDominantVenue(title, desc, type)) {
      alerts.push({
        id: `buddy-cash-${dayIndex}-${act.id}`,
        pose: "budget",
        title: isTh ? "เตรียมเงินสด & คุมงบ" : "Cash Only Reminder",
        message: isTh
          ? `ที่ "${title}" ร้านค้าสตรีทฟู้ดและแผงลอยส่วนใหญ่รับเฉพาะเงินสดหรือพร้อมเพย์ แนะนำกดเงินสดสำรองไว้ล่วงหน้านะครับ`
          : `At "${title}", street stalls and local vendors typically accept cash only. Keep small bills ready!`,
        severity: "info",
        triggerType: "cash_budget",
        activityId: act.id,
        activityTitle: title,
      });
    }

    // ── Check F: Foodie Highlights ──
    if (act.type === "food" || title.toLowerCase().includes("lunch") || title.toLowerCase().includes("dinner") || title.toLowerCase().includes("ร้านอาหาร") || title.toLowerCase().includes("เยาวราช")) {
      alerts.push({
        id: `buddy-food-${dayIndex}-${act.id}`,
        pose: "foodie",
        title: isTh ? "มื้ออร่อยประจำวัน" : "Foodie Highlight",
        message: isTh
          ? `แวะเติมพลังที่ "${title}" อย่าลืมลองเมนูซิกเนเจอร์ประจำร้าน หรือเช็กคิวก่อนไปถึงนะครับ!`
          : `Delicious food stop at "${title}". Be sure to try local specialties and check queue times!`,
        severity: "info",
        triggerType: "foodie",
        activityId: act.id,
        activityTitle: title,
      });
    }
  });

  // ── Determine Dominant Pose for the Day Header ──
  let dominantPose: PixPose = "tip";
  if (hasRainWarning) {
    dominantPose = "rainy";
  } else if (hasTempleWarning) {
    dominantPose = "warning";
  } else if (hasFlightAlert) {
    dominantPose = "flight";
  } else if (hasTransitWarning) {
    dominantPose = "transit";
  } else if (hasHeatWarning) {
    dominantPose = "sunny";
  } else if (activities.length > 0 && activities[activities.length - 1]?.type === "nightlife") {
    dominantPose = "night";
  } else {
    dominantPose = "tip";
  }

  // ── Day Summary Greetings ──
  const greeting = isTh
    ? `พิกซ์พร้อมดูแลทริปวันที่ ${day.day} ของคุณครับ! 🎒✨`
    : `Pix is ready to accompany your Day ${day.day} journey! 🎒✨`;

  const weatherSummary = hasRainWarning
    ? (isTh ? "มีช่วงเวลาฝนตก แนะนำพกร่มพับ" : "Rain showers expected, keep an umbrella handy")
    : hasHeatWarning
    ? (isTh ? "แดดจัดช่วงบ่าย แนะนำทากันแดดและดื่มน้ำ" : "Sunny & warm afternoon, stay cool & hydrated")
    : (isTh ? "สภาพอากาศปลอดโปร่ง เหมาะแก่การท่องเที่ยว" : "Pleasant weather, great for sightseeing");

  const trafficSummary = hasTransitWarning
    ? (isTh ? "ชั่วโมงเร่งด่วนช่วงเย็น แนะนำเดินทางด้วยรถไฟฟ้า" : "Peak evening traffic, rapid transit recommended")
    : (isTh ? "การเดินทางคล่องตัวตามแผน" : "Smooth commute expected along the corridor");

  return {
    dayIndex,
    dayNumber: day.day,
    dominantPose,
    greeting,
    weatherSummary,
    trafficSummary,
    dressCodeWarning: dressCodeWarningText,
    keyAlerts: alerts.filter(a => a.severity === "urgent" || a.severity === "warning").slice(0, 3),
    allAlerts: alerts,
  };
}

export interface AttractionLiveAlert {
  placeName: string;
  status: "closed" | "restricted" | "crowded" | "normal";
  note: string;
}

export interface LiveSpecialEvent {
  eventName: string;
  location: string;
  highlight: string;
}

export interface LiveTransitStatus {
  hasDisruption: boolean;
  transitStatus: "normal" | "warning" | "critical";
  title: string;
  summary: string;
  disruptions: Array<{
    line: string;
    status: string;
    detail: string;
  }>;
  attractionAlerts?: AttractionLiveAlert[];
  specialEvents?: LiveSpecialEvent[];
  weatherTrafficAlert: string;
  adviceForTravelers: string;
  localTipsAndRules?: string;
  sources: string[];
  tips: string[];
  liveUpdates: string[];
  sourceCount: number;
}

/**
 * Calls backend Search RAG endpoint to get live city traffic/weather/transit/attraction insights via OpenRouter Gemini online search.
 */
export async function fetchLiveBuddyInsights(
  cityName: string,
  places: string[] = []
): Promise<LiveTransitStatus> {
  const defaultStatus: LiveTransitStatus = {
    hasDisruption: false,
    transitStatus: "normal",
    title: "",
    summary: "",
    disruptions: [],
    attractionAlerts: [],
    specialEvents: [],
    weatherTrafficAlert: "",
    adviceForTravelers: "",
    localTipsAndRules: "",
    sources: [],
    tips: [],
    liveUpdates: [],
    sourceCount: 0,
  };

  try {
    const backendUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";
    const res = await fetch(`${backendUrl}/ai/buddy-live-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: cityName,
        places: places.slice(0, 5),
        date: new Date().toISOString().split("T")[0],
      }),
    });

    if (!res.ok) {
      return defaultStatus;
    }

    const data = await res.json();
    return {
      hasDisruption: Boolean(data.has_disruption),
      transitStatus: data.transit_status || "normal",
      title: data.title || "",
      summary: data.summary || "",
      disruptions: Array.isArray(data.disruptions) ? data.disruptions : [],
      attractionAlerts: Array.isArray(data.attraction_alerts)
        ? data.attraction_alerts.map((a: any) => ({
            placeName: a.place_name || a.placeName || "",
            status: a.status || "normal",
            note: a.note || "",
          }))
        : [],
      specialEvents: Array.isArray(data.special_events)
        ? data.special_events.map((e: any) => ({
            eventName: e.event_name || e.eventName || "",
            location: e.location || "",
            highlight: e.highlight || "",
          }))
        : [],
      weatherTrafficAlert: data.weather_traffic_alert || "",
      adviceForTravelers: data.advice_for_travelers || "",
      localTipsAndRules: data.local_tips_and_rules || "",
      sources: Array.isArray(data.sources) ? data.sources : [],
      tips: Array.isArray(data.tips) ? data.tips : [],
      liveUpdates: Array.isArray(data.live_updates) ? data.live_updates : [],
      sourceCount: data.sources_count || 0,
    };
  } catch (err) {
    console.warn("[BuddyService] Live check fallback:", err);
    return defaultStatus;
  }
}
