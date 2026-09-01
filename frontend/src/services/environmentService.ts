const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface WeatherCondition {
  /** Short text description, e.g. "Mostly Cloudy" */
  description: string;
  /** Icon code from the Weather API */
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

export interface EnvironmentData {
  current: CurrentWeather | null;
  forecast: ForecastDay[];
  hourly: ForecastHour[];
  airQuality: AirQualityData | null;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function aqiCategory(aqi: number): { category: string; color: string } {
  if (aqi <= 50)  return { category: "Good",            color: "#22c55e" };
  if (aqi <= 100) return { category: "Moderate",        color: "#eab308" };
  if (aqi <= 150) return { category: "Unhealthy (Sensitive)", color: "#f97316" };
  if (aqi <= 200) return { category: "Unhealthy",       color: "#ef4444" };
  if (aqi <= 300) return { category: "Very Unhealthy",  color: "#a855f7" };
  return          { category: "Hazardous",               color: "#7f1d1d" };
}

// ─────────────────────────────────────────
// Weather API
// ─────────────────────────────────────────

export async function getWeather(lat: number, lng: number): Promise<{
  current: CurrentWeather | null;
  forecast: ForecastDay[];
  hourly: ForecastHour[];
}> {
  try {
    // Google Maps Weather API – current conditions
    const currentRes = await fetch(
      `https://weather.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=METRIC`,
      { method: "GET" }
    );

    // Forecast (next 7 days, daily)
    const forecastRes = await fetch(
      `https://weather.googleapis.com/v1/forecast/days:lookup?key=${API_KEY}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=METRIC&days=7`,
      { method: "GET" }
    );

    // Hourly Forecast (next 24 hours)
    const hourlyRes = await fetch(
      `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${API_KEY}&location.latitude=${lat}&location.longitude=${lng}&unitsSystem=METRIC&hours=24`,
      { method: "GET" }
    );

    let current: CurrentWeather | null = null;
    if (currentRes.ok) {
      const data = await currentRes.json();
      const cond = data.weatherCondition ?? {};
      current = {
        temperatureC: Math.round(data.temperature?.degrees ?? 0),
        feelsLikeC: Math.round(data.feelsLikeTemperature?.degrees ?? 0),
        humidity: Math.round((data.relativeHumidity ?? 0) * 100),
        windSpeedKph: Math.round((data.wind?.speed?.value ?? 0) * 3.6),
        uvIndex: data.uvIndex ?? 0,
        condition: {
          description: cond.description?.text ?? cond.type ?? "–",
          iconBaseUri: cond.iconBaseUri,
        },
        rawIcon: cond.type,
      };
    }

    const forecast: ForecastDay[] = [];
    if (forecastRes.ok) {
      const data = await forecastRes.json();
      for (const day of data.forecastDays ?? []) {
        const cond = day.daytimeForecast?.weatherCondition ?? day.weatherCondition ?? {};
        forecast.push({
          date: day.interval?.startTime ?? "",
          maxTempC: Math.round(day.maxTemperature?.degrees ?? 0),
          minTempC: Math.round(day.minTemperature?.degrees ?? 0),
          condition: {
            description: cond.description?.text ?? cond.type ?? "–",
            iconBaseUri: cond.iconBaseUri,
          },
        });
      }
    }

    const hourly: ForecastHour[] = [];
    if (hourlyRes.ok) {
      const data = await hourlyRes.json();
      for (const h of data.forecastHours ?? []) {
        const cond = h.weatherCondition ?? {};
        hourly.push({
          time: h.interval?.startTime ?? "",
          tempC: Math.round(h.temperature?.degrees ?? 0),
          condition: {
            description: cond.description?.text ?? cond.type ?? "–",
            iconBaseUri: cond.iconBaseUri,
          },
        });
      }
    }

    return { current, forecast, hourly };
  } catch (err) {
    console.warn("Weather API error:", err);
    return { current: null, forecast: [], hourly: [] };
  }
}

// ─────────────────────────────────────────
// Air Quality API
// ─────────────────────────────────────────

export async function getAirQuality(lat: number, lng: number): Promise<AirQualityData | null> {
  try {
    const res = await fetch(
      `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universalAqi: true,
          location: { latitude: lat, longitude: lng },
          extraComputations: ["DOMINANT_POLLUTANT_CONCENTRATION", "POLLUTANT_ADDITIONAL_INFO"],
          languageCode: "en",
        }),
      }
    );

    if (!res.ok) {
      console.warn("Air Quality API returned", res.status);
      return null;
    }

    const data = await res.json();

    // Prefer Universal AQI index
    const uaqi = (data.indexes ?? []).find((i: any) => i.code === "uaqi") ?? data.indexes?.[0];
    if (!uaqi) return null;

    const aqiValue: number = uaqi.aqi ?? uaqi.aqiDisplay ?? 0;
    const { category, color } = aqiCategory(aqiValue);

    return {
      aqi: aqiValue,
      category: uaqi.category ?? category,
      dominantPollutant: data.pollutants?.[0]?.displayName ?? "–",
      color,
    };
  } catch (err) {
    console.warn("Air Quality API error:", err);
    return null;
  }
}

// ─────────────────────────────────────────
// Combined call
// ─────────────────────────────────────────

export async function getEnvironmentData(lat: number, lng: number): Promise<EnvironmentData> {
  const [weatherData, airQuality] = await Promise.all([
    getWeather(lat, lng),
    getAirQuality(lat, lng),
  ]);
  return {
    current: weatherData.current,
    forecast: weatherData.forecast,
    hourly: weatherData.hourly,
    airQuality,
  };
}
