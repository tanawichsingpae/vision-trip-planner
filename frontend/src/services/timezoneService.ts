import tzlookup from "tz-lookup";

export interface TimeZoneInfo {
  timeZoneId: string; // e.g. "Asia/Tokyo"
  timeZoneName: string; // e.g. "Japan Standard Time"
  gmtOffset: string; // e.g. "GMT+9"
  rawOffsetSeconds: number;
  dstOffsetSeconds: number;
  localTimeString: string; // e.g. "16:45"
  localDateString: string; // e.g. "พ. 2 ก.ย."
  timeDifferenceHours: number; // e.g. +2 or -5
  timeDiffLabel: string; // e.g. "เร็วกว่าเวลาของคุณ 2 ชม."
}

/**
 * Get current timezone offset in seconds using native Intl
 */
function getTimeZoneOffsetSeconds(timeZoneId: string, date: Date = new Date()): number {
  try {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = date.toLocaleString("en-US", { timeZone: timeZoneId });
    const utcTime = new Date(utcStr).getTime();
    const tzTime = new Date(tzStr).getTime();
    return Math.round((tzTime - utcTime) / 1000);
  } catch {
    return 0;
  }
}

/**
 * Helper to compute time difference and formatted local time
 */
function computeTimeZoneDetails(timeZoneId: string, totalOffsetSeconds: number): TimeZoneInfo {
  const now = new Date();

  // Format local time at target timezone
  let localTimeString = "";
  let localDateString = "";
  try {
    localTimeString = new Intl.DateTimeFormat("th-TH", {
      timeZone: timeZoneId,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);

    localDateString = new Intl.DateTimeFormat("th-TH", {
      timeZone: timeZoneId,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(now);
  } catch {
    const targetDate = new Date(now.getTime() + totalOffsetSeconds * 1000);
    localTimeString = targetDate.toTimeString().slice(0, 8);
    localDateString = targetDate.toDateString();
  }

  // Calculate difference with user's browser timezone
  const userOffsetMinutes = -now.getTimezoneOffset(); // in minutes
  const targetOffsetMinutes = Math.round(totalOffsetSeconds / 60);
  const diffMinutes = targetOffsetMinutes - userOffsetMinutes;
  const diffHours = Math.round((diffMinutes / 60) * 10) / 10;

  let timeDiffLabel = "เวลาตรงกับคุณ";
  if (diffHours > 0) {
    timeDiffLabel = `เร็วกว่าเวลาของคุณ ${diffHours} ชม.`;
  } else if (diffHours < 0) {
    timeDiffLabel = `ช้ากว่าเวลาของคุณ ${Math.abs(diffHours)} ชม.`;
  }

  const gmtHours = Math.floor(totalOffsetSeconds / 3600);
  const gmtMinutes = Math.abs(Math.floor((totalOffsetSeconds % 3600) / 60));
  const gmtOffset = `GMT${gmtHours >= 0 ? "+" : ""}${gmtHours}${gmtMinutes > 0 ? `:${gmtMinutes}` : ""}`;

  return {
    timeZoneId,
    timeZoneName: timeZoneId.replace(/_/g, " "),
    gmtOffset,
    rawOffsetSeconds: totalOffsetSeconds,
    dstOffsetSeconds: 0,
    localTimeString,
    localDateString,
    timeDifferenceHours: diffHours,
    timeDiffLabel,
  };
}

/**
 * Fallback to estimate timezone from longitude coordinate if tz-lookup fails
 */
function estimateTimeZoneFromCoords(lat: number, lng: number): TimeZoneInfo {
  const approxOffsetHours = Math.round(lng / 15);
  const totalOffsetSeconds = approxOffsetHours * 3600;
  return computeTimeZoneDetails(
    `Etc/GMT${approxOffsetHours >= 0 ? "-" : "+"}${Math.abs(approxOffsetHours)}`,
    totalOffsetSeconds
  );
}

/**
 * Fetch destination timezone using local tz-lookup with zero external API calls
 */
export async function getDestinationTimeZone(lat: number, lng: number): Promise<TimeZoneInfo> {
  try {
    const timeZoneId = tzlookup(lat, lng);
    if (timeZoneId) {
      const offsetSeconds = getTimeZoneOffsetSeconds(timeZoneId);
      return computeTimeZoneDetails(timeZoneId, offsetSeconds);
    }
  } catch (err) {
    console.warn("tz-lookup calculation failed, falling back to longitude estimate:", err);
  }

  return estimateTimeZoneFromCoords(lat, lng);
}
