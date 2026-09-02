const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

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
 * Helper to compute time difference and formatted local time
 */
function computeTimeZoneDetails(timeZoneId: string, timeZoneName: string, totalOffsetSeconds: number): TimeZoneInfo {
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
    timeZoneName,
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
 * Fallback to estimate timezone from longitude coordinate if API is unavailable
 */
function estimateTimeZoneFromCoords(lat: number, lng: number): TimeZoneInfo {
  const approxOffsetHours = Math.round(lng / 15);
  const totalOffsetSeconds = approxOffsetHours * 3600;
  return computeTimeZoneDetails(
    `Etc/GMT${approxOffsetHours >= 0 ? "-" : "+"}${Math.abs(approxOffsetHours)}`,
    "Estimated Local Time",
    totalOffsetSeconds
  );
}

/**
 * Fetch destination timezone using Google Time Zone API with reliable fallback
 */
export async function getDestinationTimeZone(lat: number, lng: number): Promise<TimeZoneInfo> {
  const timestamp = Math.floor(Date.now() / 1000);

  if (API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.timeZoneId) {
          const totalOffset = (data.rawOffset || 0) + (data.dstOffset || 0);
          return computeTimeZoneDetails(data.timeZoneId, data.timeZoneName || data.timeZoneId, totalOffset);
        }
      }
    } catch (err) {
      console.warn("Google Time Zone API fetch failed, falling back:", err);
    }
  }

  // Fallback: estimate from coordinates
  return estimateTimeZoneFromCoords(lat, lng);
}
