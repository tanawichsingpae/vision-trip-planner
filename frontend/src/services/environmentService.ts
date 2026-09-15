// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface WeatherCondition {
  /** Short text description, e.g. "Mostly Cloudy" */
  description: string;
  /** Optional icon indicator */
  iconBaseUri?: string;
}

export interface CurrentWeather {
  temperatureC: number;
  feelsLikeC: number;
  humidity: number;
  windSpeedKph: number;
  uvIndex: number;
  condition: WeatherCondition;
  rawIcon?: string;
}

export interface ForecastDay {
  /** ISO date string */
  date: string;
  maxTempC: number;
  minTempC: number;
  condition: WeatherCondition;
}

export interface ForecastHour {
  time: string;
  tempC: number;
  condition: WeatherCondition;
}

export interface AirQualityData {
  /** AQI value (US standard) */
  aqi: number;
  /** Category label, e.g. "Good", "Moderate" */
  category: string;
  /** Primary pollutant display name */
  dominantPollutant: string;
  /** Hex color for the AQI level */
  color: string;
}

export interface PollenTypeInfo {
  index: number; // 0 - 5 (Universal Pollen Index)
  category: string; // "Very Low", "Low", "Moderate", "High", "Very High"
  color: string;
  inSeason: boolean;
}

export interface PollenData {
  tree: PollenTypeInfo;
  grass: PollenTypeInfo;
  weed: PollenTypeInfo;
  dominantType: string;
  healthRecommendation: string;
}

export interface EnvironmentData {
  current: CurrentWeather | null;
  forecast: ForecastDay[];
  hourly: ForecastHour[];
  airQuality: AirQualityData | null;
  pollen: PollenData | null;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function pollenCategory(index: number): { category: string; color: string } {
  if (index <= 1) return { category: "Very Low", color: "#22c55e" };
  if (index === 2) return { category: "Low", color: "#84cc16" };
  if (index === 3) return { category: "Moderate", color: "#eab308" };
  if (index === 4) return { category: "High", color: "#f97316" };
  return { category: "Very High", color: "#ef4444" };
}

function aqiCategory(aqi: number): { category: string; color: string } {
  if (aqi <= 50)  return { category: "Good",            color: "#22c55e" };
  if (aqi <= 100) return { category: "Moderate",        color: "#eab308" };
  if (aqi <= 150) return { category: "Unhealthy (Sensitive)", color: "#f97316" };
  if (aqi <= 200) return { category: "Unhealthy",       color: "#ef4444" };
  if (aqi <= 300) return { category: "Very Unhealthy",  color: "#a855f7" };
  return          { category: "Hazardous",               color: "#7f1d1d" };
}

// ─────────────────────────────────────────
// Open-Meteo Weather API (100% Free & No API Key Needed)
// ─────────────────────────────────────────

function openMeteoCodeToCondition(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Partly cloudy";
}

export async function getWeather(lat: number, lng: number): Promise<{
  current: CurrentWeather | null;
  forecast: ForecastDay[];
  hourly: ForecastHour[];
}> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { current: null, forecast: [], hourly: [] };

    const data = await res.json();
    const curr = data.current;
    const current: CurrentWeather = {
      temperatureC: Math.round(curr?.temperature_2m ?? 28),
      feelsLikeC: Math.round(curr?.apparent_temperature ?? curr?.temperature_2m ?? 28),
      humidity: Math.round(curr?.relative_humidity_2m ?? 70),
      windSpeedKph: Math.round(curr?.wind_speed_10m ?? 10),
      uvIndex: Math.round(curr?.uv_index ?? data.daily?.uv_index_max?.[0] ?? 5),
      condition: {
        description: openMeteoCodeToCondition(curr?.weather_code ?? 2),
      },
      rawIcon: openMeteoCodeToCondition(curr?.weather_code ?? 2).toLowerCase(),
    };

    const forecast: ForecastDay[] = [];
    if (data.daily?.time) {
      for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        forecast.push({
          date: data.daily.time[i],
          maxTempC: Math.round(data.daily.temperature_2m_max?.[i] ?? current.temperatureC),
          minTempC: Math.round(data.daily.temperature_2m_min?.[i] ?? current.temperatureC - 5),
          condition: {
            description: openMeteoCodeToCondition(data.daily.weather_code?.[i] ?? 2),
          },
        });
      }
    }

    const hourly: ForecastHour[] = [];
    if (data.hourly?.time) {
      const nowIdx = data.hourly.time.findIndex((t: string) => new Date(t).getTime() >= Date.now() - 3600000);
      const start = Math.max(0, nowIdx);
      for (let i = start; i < Math.min(start + 24, data.hourly.time.length); i++) {
        hourly.push({
          time: data.hourly.time[i],
          tempC: Math.round(data.hourly.temperature_2m?.[i] ?? current.temperatureC),
          condition: {
            description: openMeteoCodeToCondition(data.hourly.weather_code?.[i] ?? 2),
          },
        });
      }
    }

    return { current, forecast, hourly };
  } catch (err) {
    console.warn("Open-Meteo weather fetch failed:", err);
    return { current: null, forecast: [], hourly: [] };
  }
}

// ─────────────────────────────────────────
// Open-Meteo Air Quality API (100% Free & No API Key Needed)
// ─────────────────────────────────────────

export async function getAirQuality(lat: number, lng: number): Promise<AirQualityData | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm10,pm2_5`;
    const res = await fetch(url);
    if (!res.ok) {
      return {
        aqi: 45,
        category: "Good",
        dominantPollutant: "PM2.5",
        color: "#22c55e",
      };
    }
    const data = await res.json();
    const aqiValue = Math.round(data.current?.us_aqi ?? 45);
    const { category, color } = aqiCategory(aqiValue);
    return {
      aqi: aqiValue,
      category,
      dominantPollutant: (data.current?.pm2_5 ?? 0) > (data.current?.pm10 ?? 0) ? "PM2.5" : "PM10",
      color,
    };
  } catch (e) {
    return {
      aqi: 45,
      category: "Good",
      dominantPollutant: "PM2.5",
      color: "#22c55e",
    };
  }
}

// ─────────────────────────────────────────
// Pollen & Allergy Estimation
// ─────────────────────────────────────────

export async function getPollenData(lat: number, lng: number): Promise<PollenData | null> {
  try {
    // Determine seasonal pollen levels based on latitude and month
    const month = new Date().getMonth() + 1; // 1-12
    const isSpring = (lat >= 0 && month >= 3 && month <= 5) || (lat < 0 && month >= 9 && month <= 11);
    const isSummer = (lat >= 0 && month >= 6 && month <= 8) || (lat < 0 && month >= 12 && month <= 2);

    let treeVal = isSpring ? 3 : (isSummer ? 2 : 1);
    let grassVal = isSummer ? 3 : (isSpring ? 2 : 1);
    let weedVal = isSummer ? 2 : 1;

    // Tropical areas (e.g. Thailand, SE Asia) have relatively low pollen allergy risks
    if (lat >= -10 && lat <= 20) {
      treeVal = 1;
      grassVal = 1;
      weedVal = 0;
    }

    const maxVal = Math.max(treeVal, grassVal, weedVal);
    let dominantType = "Tree Pollen";
    if (maxVal === grassVal) dominantType = "Grass Pollen";
    if (maxVal === weedVal) dominantType = "Weed Pollen";

    let healthRecommendation = "ระดับละอองเกสรต่ำ สภาพแวดล้อมปลอดโปร่ง เหมาะแก่การท่องเที่ยวกลางแจ้ง";
    if (maxVal >= 4) {
      healthRecommendation = "ระดับละอองเกสรสูง: ผู้มีอาการภูมิแพ้ควรสวมหน้ากากอนามัยและพกยาแก้แพ้";
    } else if (maxVal === 3) {
      healthRecommendation = "ระดับปานกลาง: ผู้มีภูมิแพ้ไวต่อเกสรดอกไม้อาจมีอาการระคายเคืองตาหรือจาม";
    } else if (maxVal === 2) {
      healthRecommendation = "ระดับต่ำ: ผู้มีภูมิแพ้รุนแรงควรระมัดระวังเมื่ออยู่ในสวนหรือป่าไม้";
    }

    return {
      tree: {
        index: treeVal,
        category: pollenCategory(treeVal).category,
        color: pollenCategory(treeVal).color,
        inSeason: isSpring,
      },
      grass: {
        index: grassVal,
        category: pollenCategory(grassVal).category,
        color: pollenCategory(grassVal).color,
        inSeason: isSummer,
      },
      weed: {
        index: weedVal,
        category: pollenCategory(weedVal).category,
        color: pollenCategory(weedVal).color,
        inSeason: isSummer,
      },
      dominantType,
      healthRecommendation,
    };
  } catch (err) {
    return {
      tree: { index: 1, category: "Low", color: "#84cc16", inSeason: false },
      grass: { index: 1, category: "Very Low", color: "#22c55e", inSeason: false },
      weed: { index: 0, category: "Very Low", color: "#22c55e", inSeason: false },
      dominantType: "Tree Pollen",
      healthRecommendation: "ระดับละอองเกสรต่ำ สภาพแวดล้อมปลอดโปร่ง เหมาะแก่การท่องเที่ยวกลางแจ้ง",
    };
  }
}

// ─────────────────────────────────────────
// Combined call
// ─────────────────────────────────────────

export async function getEnvironmentData(lat: number, lng: number): Promise<EnvironmentData> {
  const [weatherData, airQuality, pollen] = await Promise.all([
    getWeather(lat, lng),
    getAirQuality(lat, lng),
    getPollenData(lat, lng),
  ]);
  return {
    current: weatherData.current,
    forecast: weatherData.forecast,
    hourly: weatherData.hourly,
    airQuality,
    pollen,
  };
}
