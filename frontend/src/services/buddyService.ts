/**
 * Pixo Travel Buddy Service
 * Intelligent Context-Aware Engine mapping Pixo Mascot Poses to Real-Time Travel Alerts.
 */

import { type ForecastHour, type EnvironmentData } from "@/services/environmentService";
import { type DayPlan, type Activity } from "@/components/TravelItinerary";

export type PixoPose =
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
  | "search"
  | "chat"
  | "route_planer"
  | "confident"
  | "confused"
  | "insight"
  | "goodbye"
  | "surprised";

// Backward compatibility alias
export type PixPose = PixoPose;

export type BuddyAlertSeverity = "info" | "warning" | "urgent";

export interface BuddyAlert {
  id: string;
  pose: PixoPose;
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
  dominantPose: PixoPose;
  greeting: string;
  weatherSummary: string;
  trafficSummary: string;
  dressCodeWarning?: string;
  keyAlerts: BuddyAlert[];
  allAlerts: BuddyAlert[];
}

/**
 * Returns the public asset URL for a given Pixo pose.
 */
export function getPixoMascotUrl(pose: PixoPose | string): string {
  const validPoses = new Set<string>([
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
    "chat",
    "route_planer",
    "confident",
    "confused",
    "insight",
    "goodbye",
    "surprised",
    "chatbot_profile",
  ]);

  if (pose === "happy") return "/pixo_carton/pixo_celebrate.jpg";
  if (pose === "warning") return "/pixo_carton/pixo_warning_temple.jpg";
  if (pose === "chatbot_profile") return "/pixo_carton/pixo_chatbot_profile.jpg";
  if (!validPoses.has(pose)) return "/pixo_carton/pixo_tip.jpg";
  return `/pixo_carton/pixo_${pose}.jpg`;
}

/**
 * Backward compatibility alias for getPixoMascotUrl.
 */
export const getPixMascotUrl = getPixoMascotUrl;

export interface PixoPoseMetaInfo {
  title: string;
  tag: string;
  emoji: string;
  description: string;
}

const PIXO_POSE_METADATA_TABLE: Record<
  string,
  {
    titleTh: string;
    titleEn: string;
    tagTh: string;
    tagEn: string;
    emoji: string;
    descriptionTh: string;
    descriptionEn: string;
  }
> = {
  warning: {
    titleTh: "พิกโซ่เตือนระเบียบ & ความปลอดภัย",
    titleEn: "Pixo Safety & Rules Guide",
    tagTh: "ตรวจระเบียบ",
    tagEn: "Rules & Safety",
    emoji: "🛕",
    descriptionTh: "พิกโซ่คอยเตือนเรื่องข้อห้าม การแต่งกาย และความปลอดภัยในสถานที่สำคัญ",
    descriptionEn: "Pixo alerts you on etiquette, dress codes, and local safety rules.",
  },
  rainy: {
    titleTh: "พิกโซ่เรดาร์ฟ้าฝน",
    titleEn: "Pixo Rain Scout",
    tagTh: "ลุยฝน",
    tagEn: "Weather Alert",
    emoji: "☔",
    descriptionTh: "พิกโซ่เช็คพยากรณ์อากาศและแนะที่เที่ยวในร่มสำรองให้เที่ยวได้อย่างราบรื่น",
    descriptionEn: "Pixo checks live weather and suggests smart indoor alternatives.",
  },
  sunny: {
    titleTh: "พิกโซ่รับแดดสดใส",
    titleEn: "Pixo Sunny Explorer",
    tagTh: "แดดแจ่มใส",
    tagEn: "Sunny Skies",
    emoji: "☀️",
    descriptionTh: "สภาพอากาศแจ่มใส เหมาะกับการเที่ยวกลางแจ้ง ถ่ายรูปสวย และชมวิว",
    descriptionEn: "Clear weather, perfect for outdoor exploration and sightseeing.",
  },
  transit: {
    titleTh: "พิกโซ่นำทางหลบรถติด",
    titleEn: "Pixo Transit Navigator",
    tagTh: "สัญจรคล่องตัว",
    tagEn: "Transit Tip",
    emoji: "🚗",
    descriptionTh: "พิกโซ่สแกนการจราจรสดและแนะนำเส้นทางที่ประหยัดเวลาที่สุด",
    descriptionEn: "Pixo scans real-time transit to keep your journey smooth and on schedule.",
  },
  tip: {
    titleTh: "พิกโซ่เกร็ดลับนักเดินทาง",
    titleEn: "Pixo Travel Tips",
    tagTh: "ทิปส์น่ารู้",
    tagEn: "Travel Tip",
    emoji: "💡",
    descriptionTh: "เกร็ดความรู้และข้อแนะนำที่เป็นประโยชน์สำหรับทริปนี้",
    descriptionEn: "Helpful travel insights curated for your destination.",
  },
  foodie: {
    titleTh: "พิกโซ่สายกินพาชิม",
    titleEn: "Pixo Foodie Guide",
    tagTh: "สายกิน",
    tagEn: "Foodie Spot",
    emoji: "🍜",
    descriptionTh: "พิกโซ่รวมเมนูเด็ดและร้านดังท้องถิ่นที่ไม่ควรพลาด",
    descriptionEn: "Local food recommendations and must-try delicacies.",
  },
  budget: {
    titleTh: "พิกโซ่ผู้ช่วยคุมงบ",
    titleEn: "Pixo Budget Buddy",
    tagTh: "คุมงบเที่ยว",
    tagEn: "Budget Advice",
    emoji: "💰",
    descriptionTh: "แนะนำการใช้จ่ายและวิธีเที่ยวแบบประหยัดคุ้มค่าที่สุด",
    descriptionEn: "Smart budget tracking and cost-saving tips.",
  },
  flight: {
    titleTh: "พิกโซ่เช็คอินไฟลท์บิน",
    titleEn: "Pixo Flight Scout",
    tagTh: "ไฟลท์ & สนามบิน",
    tagEn: "Flight & Transit",
    emoji: "✈️",
    descriptionTh: "เตือนเวลาเดินทางล่วงหน้า เผื่อเวลาเช็คอินและโหลดกระเป๋า",
    descriptionEn: "Flight reminders and early airport transit advice.",
  },
  night: {
    titleTh: "พิกโซ่ไนท์ไลฟ์ & พักผ่อน",
    titleEn: "Pixo Night Scout",
    tagTh: "ค่ำคืนผ่อนคลาย",
    tagEn: "Evening Vibe",
    emoji: "🌙",
    descriptionTh: "แนะนำกิจกรรมยามค่ำคืนและเตือนให้พักผ่อนเต็มอิ่มพร้อมลุยวันถัดไป",
    descriptionEn: "Evening highlights and rest reminders for tomorrow's adventures.",
  },
  planning: {
    titleTh: "พิกโซ่จัดแผนทริป",
    titleEn: "Pixo Trip Planner",
    tagTh: "วางแผนแม่นยำ",
    tagEn: "Smart Planning",
    emoji: "🗺️",
    descriptionTh: "จัดลำดับจุดเที่ยวตามระยะทางจริง ไม่ต้องเดินทางย้อนไปมา",
    descriptionEn: "Optimizing your route to eliminate detours and backtracks.",
  },
  celebrate: {
    titleTh: "พิกโซ่พร้อมฉลองทริปฟิน",
    titleEn: "Pixo Celebration",
    tagTh: "ทริปสมบูรณ์",
    tagEn: "Ready to Explore",
    emoji: "🎉",
    descriptionTh: "แผนการเดินทางพร้อมแล้ว ลุยทริปให้สนุกเต็มที่เลย!",
    descriptionEn: "Your itinerary is all set! Have an incredible journey!",
  },
  camera: {
    titleTh: "พิกโซ่ช่างภาพพาส่องมุมสวย",
    titleEn: "Pixo Photo Spotter",
    tagTh: "มุมถ่ายรูปสวย",
    tagEn: "Photo Sights",
    emoji: "📸",
    descriptionTh: "ชี้เป้ามุมถ่ายรูปยอดนิยมและจังหวะแสงสวยสำหรับบันทึกความทรงจำ",
    descriptionEn: "Highlighting scenic photo spots and prime angles for great memories.",
  },
  search: {
    titleTh: "พิกโซ่ส่องค้นหาพิกัด",
    titleEn: "Pixo Sights Finder",
    tagTh: "ค้นหาจุดเที่ยว",
    tagEn: "Place Finder",
    emoji: "🔎",
    descriptionTh: "ค้นหาจุดแลนด์มาร์กและข้อมูลเชิงลึกจากภาพถ่ายและสถานที่รอบตัว",
    descriptionEn: "Discovering landmarks and hidden gems from photos and nearby sights.",
  },
  chat: {
    titleTh: "พิกโซ่พร้อมคุยทุกเรื่องเที่ยว",
    titleEn: "Pixo Chat Assistant",
    tagTh: "ถามได้ตลอด",
    tagEn: "Chat Ready",
    emoji: "💬",
    descriptionTh: "พร้อมตอบข้อสงสัย ปรับเปลี่ยนเวลา และสลับโรงแรมให้แบบเรียลไทม์",
    descriptionEn: "Ready to answer questions and adjust your itinerary live.",
  },
  route_planer: {
    titleTh: "พิกโซ่จัดรูทอัจฉริยะ",
    titleEn: "Pixo Route Optimizer",
    tagTh: "รูทอัจฉริยะ",
    tagEn: "Route Maestro",
    emoji: "🧭",
    descriptionTh: "คำนวณเส้นทางและเวลาสัญจรระหว่างสถานที่อย่างลงตัว",
    descriptionEn: "Calculating optimal paths and transit intervals between spots.",
  },
  confident: {
    titleTh: "พิกโซ่มั่นใจในรูทนี้",
    titleEn: "Pixo Confident Guide",
    tagTh: "รูทลงตัวสุดๆ",
    tagEn: "Top Pick",
    emoji: "✨",
    descriptionTh: "รูทที่คัดสรรแล้วว่าคุ้มค่าและสะดวกสบายที่สุด",
    descriptionEn: "A thoroughly vetted route designed for the best experience.",
  },
  confused: {
    titleTh: "พิกโซ่ช่วยไขข้อสงสัย",
    titleEn: "Pixo Helpful Clarifier",
    tagTh: "ช่วยไขข้อข้องใจ",
    tagEn: "Clarification",
    emoji: "🤔",
    descriptionTh: "หากมีข้อสงสัยหรืออยากเปลี่ยนแผน บอกพิกโซ่ได้เสมอ",
    descriptionEn: "Got doubts or need adjustments? Pixo is right here to help.",
  },
  insight: {
    titleTh: "พิกโซ่วิเคราะห์เชิงลึก",
    titleEn: "Pixo Deep Insight",
    tagTh: "อินไซต์เด็ด",
    tagEn: "Deep Insight",
    emoji: "🧠",
    descriptionTh: "ข้อมูลเจาะลึกเฉพาะท้องถิ่นที่จะทำให้เที่ยวได้สนุกและคุ้มค่ายิ่งขึ้น",
    descriptionEn: "Local insider knowledge to elevate your trip experience.",
  },
  goodbye: {
    titleTh: "พิกโซ่บ๊ายบายทริปนี้",
    titleEn: "Pixo Trip Farewell",
    tagTh: "สุขสันต์วันกลับ",
    tagEn: "Safe Travels",
    emoji: "👋",
    descriptionTh: "หวังว่าคุณจะประทับใจกับทริปนี้ เดินทางปลอดภัยนะครับ!",
    descriptionEn: "Hope you had an amazing adventure! Safe travels home!",
  },
  surprised: {
    titleTh: "พิกโซ่เจอของดีน่าประหลาดใจ",
    titleEn: "Pixo Discovery Spark",
    tagTh: "เซอร์ไพรส์น่าเที่ยว",
    tagEn: "Surprise Find",
    emoji: "⭐",
    descriptionTh: "ค้นพบสถานที่น่าสนใจใกล้เคียงที่คุ้มค่าแก่การแวะชม",
    descriptionEn: "Found an exciting spot nearby worth a spontaneous visit.",
  },
  chatbot_profile: {
    titleTh: "พิกโซ่เพื่อนคู่หูนักเดินทาง",
    titleEn: "Pixo Travel Buddy",
    tagTh: "เพื่อนร่วมทริป",
    tagEn: "Your AI Buddy",
    emoji: "🎒",
    descriptionTh: "พิกโซ่ (Pixo) นกอินทรีตัวน้อย AI Travel Companion ประจำ Pixinerary",
    descriptionEn: "Pixo is your sharp, cheerful AI travel companion scout for every journey.",
  },
};

/**
 * Returns localized metadata for a given Pixo pose.
 */
export function getPixoPoseMetadata(
  pose: PixoPose | string,
  lang: "th" | "en" = "th"
): PixoPoseMetaInfo {
  const normPose = pose === "happy" ? "celebrate" : pose;
  const item = PIXO_POSE_METADATA_TABLE[normPose] || PIXO_POSE_METADATA_TABLE.tip;
  const isTh = lang === "th";

  return {
    title: isTh ? item.titleTh : item.titleEn,
    tag: isTh ? item.tagTh : item.tagEn,
    emoji: item.emoji,
    description: isTh ? item.descriptionTh : item.descriptionEn,
  };
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
          title: isTh ? "พิกโซ่เตือนฝนตก" : "Rain & Weather Alert",
          message: isTh
            ? `ช่วง ${act.time || "นี้"} ที่ "${title}" มีแนวโน้มฝนตก (${actWeather.tempC}°C, ${actWeather.condition?.description}) พิกโซ่แนะนำพกร่มพับหรือเตรียมแผนสลับสถานที่ในร่มครับ`
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
          title: isTh ? "เลี่ยงรถติดชั่วโมงเร่งด่วน & แนะนำการเดินทาง" : "Rush Hour Commute & Transit Options",
          message: isTh
            ? `ช่วงเวลาเดินทาง (${act.time}) ตรงกับชั่วโมงเร่งด่วน การจราจรบนถนนอาจติดขัดมาก พิกโซ่แนะนำให้เดินทางด้วยระบบราง (BTS, MRT, ARL, สายสีแดง) หรือเรือโดยสาร หากเส้นทางไม่มีรถไฟฟ้าผ่านโดยตรง แนะนำเรียกแอป Grab หรือ Bolt เพื่อความสะดวกและประหยัดเวลาครับ`
            : `Traveling around ${act.time} coincides with peak traffic. Consider rapid transit (BTS, MRT, ARL, SRT Red Line) or express boats. If your route lacks direct train access, ride-hailing apps like Grab or Bolt are recommended to save commute time.`,
          severity: "warning",
          triggerType: "traffic_rush",
          activityId: act.id,
          activityTitle: title,
          actionLabel: isTh ? "ทิปการเดินทาง & เรียกรถ" : "Transit & Ride-Hailing Tips",
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
  let dominantPose: PixoPose = "tip";
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
    ? `พิกโซ่พร้อมดูแลทริปวันที่ ${day.day} ของคุณครับ! 🎒✨`
    : `Pixo is ready to accompany your Day ${day.day} journey! 🎒✨`;

  const weatherSummary = hasRainWarning
    ? (isTh ? "มีช่วงเวลาฝนตก แนะนำพกร่มพับ" : "Rain showers expected, keep an umbrella handy")
    : hasHeatWarning
      ? (isTh ? "แดดจัดช่วงบ่าย แนะนำทากันแดดและดื่มน้ำ" : "Sunny & warm afternoon, stay cool & hydrated")
      : (isTh ? "สภาพอากาศปลอดโปร่ง เหมาะแก่การท่องเที่ยว" : "Pleasant weather, great for sightseeing");

  const trafficSummary = hasTransitWarning
    ? (isTh ? "ชั่วโมงเร่งด่วนช่วงเย็น แนะนำเดินทางด้วยรถไฟฟ้า/เรือ หรือเรียกรถผ่านแอป Grab/Bolt" : "Peak evening traffic, rapid transit or Grab/Bolt recommended")
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
  noticeType?: "live_incident" | "scheduled_maintenance" | "regular_advisory";
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
  places: string[] = [],
  targetDate?: Date | string
): Promise<LiveTransitStatus> {
  const defaultStatus: LiveTransitStatus = {
    hasDisruption: false,
    transitStatus: "normal",
    noticeType: "regular_advisory",
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
    let dateStr = "";
    if (targetDate instanceof Date) {
      const y = targetDate.getFullYear();
      const m = String(targetDate.getMonth() + 1).padStart(2, "0");
      const d = String(targetDate.getDate()).padStart(2, "0");
      dateStr = `${y}-${m}-${d}`;
    } else if (typeof targetDate === "string" && targetDate.trim()) {
      dateStr = targetDate.trim().split("T")[0];
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      dateStr = `${y}-${m}-${d}`;
    }

    const res = await fetch(`${backendUrl}/ai/buddy-live-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: cityName,
        places: places.slice(0, 5),
        date: dateStr,
      }),
    });

    if (!res.ok) {
      return defaultStatus;
    }

    const data = await res.json();
    return {
      hasDisruption: Boolean(data.has_disruption),
      transitStatus: data.transit_status || "normal",
      noticeType: data.notice_type || (Boolean(data.has_disruption) ? "live_incident" : "regular_advisory"),
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

export interface SmartRerouteAlternative {
  title: string;
  category: string;
  distanceKm: number;
  reason: string;
}

export interface SmartRerouteProposal {
  type: "SWAP" | "SUBSTITUTE" | "ADVICE";
  dayIndex: number;
  fromActivityIndex: number;
  toActivityIndex?: number;
  fromActivityTitle: string;
  toActivityTitle?: string;
  timeSavedMinutes?: number;
  reason: string;
  pixMessage: string;
  alternatives?: SmartRerouteAlternative[];
}

/**
 * Haversine formula to compute great-circle distance between two geographic coordinates in kilometers.
 */
export function calculateHaversineDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Proactively evaluates real-time traffic segments, weather disruptions, and attraction closures
 * to propose an interactive Smart Swap (e.g. swapping place 2 & 3) or Smart Substitute (nearby alternative).
 * Includes Opening Hours & Feasibility Guards as per the specification.
 */
export function evaluateSmartReroute(
  day: DayPlan,
  dayIndex: number,
  segments: Array<{ durationText: string; distanceText: string; status: string }>,
  liveStatus?: LiveTransitStatus | null,
  cityName: string = "กรุงเทพมหานคร",
  language: "th" | "en" = "th"
): SmartRerouteProposal | null {
  if (!day || !day.activities || day.activities.length < 2) return null;
  const isTh = language === "th";
  const acts = day.activities;

  // 1. Check for Attraction Closures or Restrictions in today's places
  if (liveStatus?.attractionAlerts && liveStatus.attractionAlerts.length > 0) {
    for (let i = 0; i < acts.length; i++) {
      const act = acts[i];
      const match = liveStatus.attractionAlerts.find(
        (a) =>
          (a.status === "closed" || a.status === "restricted") &&
          (act.title.toLowerCase().includes(a.placeName.toLowerCase()) ||
            a.placeName.toLowerCase().includes(act.title.toLowerCase()))
      );

      if (match) {
        // Can we swap with the next activity if it's restricted and next activity is open?
        if (i < acts.length - 1 && match.status === "restricted") {
          const nextAct = acts[i + 1];
          const isNextOpen = nextAct.openNow !== false;
          if (isNextOpen) {
            return {
              type: "SWAP",
              dayIndex,
              fromActivityIndex: i,
              toActivityIndex: i + 1,
              fromActivityTitle: act.title,
              toActivityTitle: nextAct.title,
              timeSavedMinutes: 30,
              reason: match.note || (isTh ? "สถานที่จำกัดเวลาเข้าชม" : "Restricted entry hours today"),
              pixMessage: isTh
                ? `คุณครับ '${act.title}' มีการแจ้งเตือน (${match.note || "จำกัดเวลา"}) พิกโซ่แนะนำให้สลับไป '${nextAct.title}' ก่อน เพื่อไม่ให้เสียเวลาเที่ยวครับ ✨`
                : `Heads up! '${act.title}' has restricted hours today. Pixo recommends visiting '${nextAct.title}' first so you can enjoy both smoothly! ✨`,
            };
          }
        }

        // If closed completely, propose smart alternatives nearby
        const alternatives: SmartRerouteAlternative[] = [
          {
            title: isTh ? `พิพิธภัณฑ์ศิลปวัฒนธรรม ${cityName}` : `${cityName} Cultural Arts Center`,
            category: "culture",
            distanceKm: 1.2,
            reason: isTh ? "อยู่ในร่ม เดินทางสะดวก เลี่ยงสภาพอากาศ" : "Indoor cultural space with easy access",
          },
          {
            title: isTh ? `จุดชมวิวริมน้ำและสวนสาธารณะ ${cityName}` : `${cityName} Scenic Waterfront Promenade`,
            category: "landmark",
            distanceKm: 1.8,
            reason: isTh ? "บรรยากาศดี ถ่ายรูปสวย อยู่ในย่านใกล้เคียง" : "Scenic photo hotspot within the same neighborhood",
          },
        ];

        return {
          type: "SUBSTITUTE",
          dayIndex,
          fromActivityIndex: i,
          fromActivityTitle: act.title,
          reason: match.note || (isTh ? "สถานที่ปิดทำการชั่วคราววันนี้" : "Temporarily closed today"),
          pixMessage: isTh
            ? `คุณครับ วันนี้ '${act.title}' ปิดให้บริการชั่วคราว (${match.note || "มีงานพิธีการ/ปรับปรุง"}) พิกโซ่เตรียมสถานที่น่าสนใจในย่านนี้ 2 แห่งมาให้คุณเลือกแวะแทนครับ 🏛️✨`
            : `Notice: '${act.title}' is closed today (${match.note || "ceremony/renovation"}). Pixo found 2 great nearby alternatives for you to enjoy instead! 🏛️✨`,
          alternatives,
        };
      }
    }
  }

  // 2. Check for Heavy Traffic Congestion / High Duration Segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg || seg.status !== "ok") continue;

    // Parse duration minutes (e.g. "35 min", "1h 10min")
    let durationMins = 0;
    const hourMatch = seg.durationText.match(/(\d+)\s*h/);
    const minMatch = seg.durationText.match(/(\d+)\s*min/);
    if (hourMatch) durationMins += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) durationMins += parseInt(minMatch[1], 10);

    // Trigger condition: delay >= 20 mins or city transit has disruption
    const hasTransitDisruption = Boolean(liveStatus?.hasDisruption);
    if (durationMins >= 20 || (hasTransitDisruption && durationMins >= 15)) {
      const fromAct = acts[i];
      const targetAct = acts[i + 1];

      // Feasibility check: If there's an activity after targetAct (i + 2), evaluate swapping i + 1 and i + 2!
      if (i + 2 < acts.length) {
        const nextNextAct = acts[i + 2];

        // 1. Opening Hours Guard: Don't swap if nextNextAct is explicitly marked closed
        if (nextNextAct.openNow === false) {
          continue;
        }

        // 2. Haversine Detour Guard: Check if Dist(1->3) + Dist(3->2) causes excessive backtracking (> 1.5x original)
        if (
          typeof fromAct.lat === "number" &&
          typeof fromAct.lng === "number" &&
          typeof targetAct.lat === "number" &&
          typeof targetAct.lng === "number" &&
          typeof nextNextAct.lat === "number" &&
          typeof nextNextAct.lng === "number"
        ) {
          const p1 = { lat: fromAct.lat, lng: fromAct.lng };
          const p2 = { lat: targetAct.lat, lng: targetAct.lng };
          const p3 = { lat: nextNextAct.lat, lng: nextNextAct.lng };

          const origDist = calculateHaversineDistance(p1, p2) + calculateHaversineDistance(p2, p3);
          const swappedDist = calculateHaversineDistance(p1, p3) + calculateHaversineDistance(p3, p2);

          // If swapped route causes excessive detour (> 1.5x original distance), do not swap!
          // Instead propose Stay & Buffer advice
          if (origDist > 0.5 && swappedDist > 1.5 * origDist) {
            const alternatives: SmartRerouteAlternative[] = [
              {
                title: isTh ? `จุดแวะพัก/คาเฟ่ยอดนิยมใกล้ ${fromAct.title}` : `Popular Rest Stop & Cafe near ${fromAct.title}`,
                category: "food",
                distanceKm: 0.8,
                reason: isTh ? "เลี่ยงช่วงเวลารถติดพีคและเลี่ยงการเดินทางย้อนศร" : "Avoid peak traffic window and excessive detour",
              },
            ];

            return {
              type: "ADVICE",
              dayIndex,
              fromActivityIndex: i + 1,
              fromActivityTitle: targetAct.title,
              timeSavedMinutes: Math.round(durationMins * 0.5),
              reason: isTh
                ? `เส้นทางไป '${targetAct.title}' รถติด (${seg.durationText}) แต่การสลับไป '${nextNextAct.title}' อ้อมไกลเกินไป`
                : `Traffic to '${targetAct.title}' is congested (${seg.durationText}) but swapping causes too much detour`,
              pixMessage: isTh
                ? `คุณครับ เส้นทางไป '${targetAct.title}' ตอนนี้รถติดมาก (${seg.durationText}) และการสลับไป '${nextNextAct.title}' ก่อนจะทำให้เดินทางย้อนศรไกลเกินไป พิกโซ่แนะนำให้แวะจุดพักผ่อนใกล้ๆ เพื่อรอให้การจราจรคลี่คลายก่อนเดินทางต่อครับ ☕✨`
                : `Heavy traffic ahead to '${targetAct.title}' (${seg.durationText}), but swapping with '${nextNextAct.title}' would cause a long detour. Pixo recommends taking a short break nearby until traffic eases! ☕✨`,
              alternatives,
            };
          }
        }

        const timeSaved = Math.min(45, Math.max(15, Math.round(durationMins * 0.6)));

        return {
          type: "SWAP",
          dayIndex,
          fromActivityIndex: i + 1,
          toActivityIndex: i + 2,
          fromActivityTitle: targetAct.title,
          toActivityTitle: nextNextAct.title,
          timeSavedMinutes: timeSaved,
          reason: isTh
            ? `ช่วงเส้นทางไป '${targetAct.title}' ใช้เวลา ${seg.durationText} เนื่องจากสภาพการจราจรหนาแน่น`
            : `Traffic to '${targetAct.title}' is congested (${seg.durationText})`,
          pixMessage: isTh
            ? `คุณครับ เส้นทางจาก '${fromAct.title}' ไป '${targetAct.title}' ตอนนี้รถติดมาก (${seg.durationText}) แต่ '${nextNextAct.title}' อยู่ในทิศทางที่คล่องตัวกว่า พิกโซ่แนะนำให้สลับไป '${nextNextAct.title}' ก่อน จะช่วยประหยัดเวลาได้ถึง ${timeSaved} นาทีครับ 🚗💨`
            : `Heads up! Heavy traffic ahead to '${targetAct.title}' (${seg.durationText}). Pixo recommends visiting '${nextNextAct.title}' first to save around ${timeSaved} mins! 🚗💨`,
        };
      } else {
        // No 3rd activity to swap with -> Recommend Smart Alternative to avoid getting stuck
        const alternatives: SmartRerouteAlternative[] = [
          {
            title: isTh ? `จุดแวะพัก/คาเฟ่ยอดนิยมใกล้ ${fromAct.title}` : `Popular Rest Stop & Cafe near ${fromAct.title}`,
            category: "food",
            distanceKm: 0.8,
            reason: isTh ? "เลี่ยงช่วงเวลารถติดพีค แวะพักผ่อนหรือทานของว่างก่อน" : "Avoid peak traffic window, relax or have a snack nearby first",
          },
        ];

        return {
          type: "ADVICE",
          dayIndex,
          fromActivityIndex: i + 1,
          fromActivityTitle: targetAct.title,
          timeSavedMinutes: Math.round(durationMins * 0.5),
          reason: isTh
            ? `เส้นทางไป '${targetAct.title}' รถติดหนักมาก (${seg.durationText})`
            : `Traffic to '${targetAct.title}' is heavily congested (${seg.durationText})`,
          pixMessage: isTh
            ? `คุณครับ เส้นทางไป '${targetAct.title}' ตอนนี้รถติดมาก (${seg.durationText}) พิกโซ่แนะนำให้แวะจุดพักผ่อนใกล้ๆ เพื่อรอให้การจราจรคลี่คลายก่อนเดินทางต่อครับ ☕✨`
            : `Heavy traffic ahead to '${targetAct.title}' (${seg.durationText}). Pixo recommends taking a short coffee break nearby until traffic eases! ☕✨`,
          alternatives,
        };
      }
    }
  }

  return null;
}
