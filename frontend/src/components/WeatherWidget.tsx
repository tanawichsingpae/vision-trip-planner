import { useEffect, useState } from "react";
import { type EnvironmentData, getEnvironmentData } from "@/services/environmentService";
import { type TypicalWeather } from "@/services/aiService";
import { getDestinationTimeZone, type TimeZoneInfo } from "@/services/timezoneService";
import { Wind, Droplets, CloudSun, CalendarDays, Clock, Leaf, Flower2, ShieldAlert } from "lucide-react";

// ─────────────────────────────────────────
// Weather icon mapper (Google Weather API type → emoji)
// ─────────────────────────────────────────
function weatherEmoji(raw?: string): string {
  if (!raw) return "🌡️";
  const r = raw.toLowerCase();
  if (r.includes("thunder") || r.includes("storm")) return "⛈️";
  if (r.includes("rain") || r.includes("shower") || r.includes("drizzle")) return "🌧️";
  if (r.includes("snow") || r.includes("sleet") || r.includes("hail")) return "❄️";
  if (r.includes("fog") || r.includes("mist") || r.includes("haze")) return "🌫️";
  if (r.includes("partly") || r.includes("mostly_cloudy") || r.includes("cloudy")) return "⛅";
  if (r.includes("overcast")) return "☁️";
  if (r.includes("clear") || r.includes("sunny")) return "☀️";
  if (r.includes("wind")) return "💨";
  return "🌤️";
}

// ─────────────────────────────────────────
// AQI colour helper
// ─────────────────────────────────────────
function aqiBar(aqi: number): number {
  return Math.min(100, Math.round((aqi / 300) * 100));
}

// ─────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-muted/60 rounded-xl ${className ?? ""}`} />
);

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  locationName: string;
  tripStartDate?: Date;
  typicalWeather?: TypicalWeather;
}

function daysUntilTrip(startDate?: Date): number | null {
  if (!startDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────
// Typical Weather Card
// ─────────────────────────────────────────
const TypicalWeatherCard = ({ data, locationName }: { data: TypicalWeather; locationName: string }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col rounded-2xl bg-secondary/40 p-4 border border-border/70">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Typical Weather in {data.month}</p>
      <div className="flex items-end gap-2 mt-0.5">
        <span className="text-3xl font-bold text-foreground">{data.avgHighC}°</span>
        <span className="text-muted-foreground text-sm mb-1">/ {data.avgLowC}°C avg</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{data.description}</p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/60">
        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">🌡️ Temp Range</p>
        <p className="font-semibold text-foreground">{data.tempRange}</p>
      </div>
      <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/60">
        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">🌧️ Rain Chance</p>
        <p className="font-semibold text-foreground">{data.rainChance}</p>
      </div>
      <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/60">
        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">💧 Humidity</p>
        <p className="font-semibold text-foreground">{data.humidity}</p>
      </div>
      <div className="rounded-xl bg-secondary/30 p-2.5 border border-border/60">
        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">🎒 Travel Tips</p>
        <p className="font-semibold text-foreground line-clamp-1">{data.tips}</p>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// Live Weather Content with Vertical 24-Hour Forecast & Pollen
// ─────────────────────────────────────────
const LiveWeatherContent = ({ data }: { data: EnvironmentData | null }) => {
  if (!data) return null;
  const hasWeather = data.current != null;
  const hasAQI = data.airQuality != null;
  const hasPollen = data.pollen != null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Top Overview: Current Weather & AQI side-by-side ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Current Weather */}
        {hasWeather && data.current && (
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Current Weather</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                    {data.current.temperatureC}°
                  </span>
                  <span className="text-base font-semibold text-muted-foreground">C</span>
                </div>
                <p className="text-xs font-medium text-foreground/80 mt-1 capitalize">
                  {data.current.condition.description}
                </p>
              </div>
              <span className="text-4xl shrink-0 p-1.5 rounded-2xl bg-secondary/60">
                {weatherEmoji(data.current.rawIcon || data.current.condition.description)}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-3 mt-3 border-t border-border/50 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Droplets className="size-3.5 text-sky-500" />
                <span>ความชื้น {data.current.humidity ?? 70}%</span>
              </span>
              <span className="flex items-center gap-1">
                <Wind className="size-3.5 text-slate-500" />
                <span>ลม {data.current.windSpeedKph ?? 12} km/h</span>
              </span>
            </div>
          </div>
        )}

        {/* Air Quality Index */}
        {hasAQI && data.airQuality && (
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Air Quality Index (AQI)</p>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-mono">
                    {data.airQuality.aqi}
                  </span>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold shrink-0 shadow-2xs"
                  style={{
                    backgroundColor: `${data.airQuality.color}20`,
                    color: data.airQuality.color,
                    border: `1px solid ${data.airQuality.color}40`,
                  }}
                >
                  {data.airQuality.category}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Leaf className="size-3 text-emerald-500 shrink-0" />
                <span>มลพิษหลัก: <strong className="text-foreground">{data.airQuality.dominantPollutant || "PM2.5"}</strong></span>
              </p>
            </div>

            {/* AQI Progress Bar */}
            <div className="pt-3 mt-2 border-t border-border/50">
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground mb-1">
                <span>Good (0)</span>
                <span>Unhealthy (300)</span>
              </div>
              <div
                className="relative h-2 rounded-full overflow-hidden w-full"
                style={{
                  background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444, #a855f7)",
                }}
              >
                <div
                  className="absolute top-0 h-full w-2.5 rounded-full shadow-md border border-white"
                  style={{
                    left: `calc(${aqiBar(data.airQuality.aqi)}% - 5px)`,
                    backgroundColor: data.airQuality.color,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pollen & Allergy Index Section (Google Pollen API) ── */}
      {hasPollen && data.pollen && (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Flower2 className="size-3.5 text-pink-500" />
              <span>Pollen & Allergy Forecast (ดัชนีละอองเกสร)</span>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              เด่นสุด: {data.pollen.dominantType}
            </span>
          </div>

          {/* 3 Pollen Types */}
          <div className="grid grid-cols-3 gap-2">
            {/* Tree Pollen */}
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  🌲 ต้นไม้
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{ backgroundColor: `${data.pollen.tree.color}20`, color: data.pollen.tree.color }}
                >
                  {data.pollen.tree.category}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold font-mono text-foreground">{data.pollen.tree.index}</span>
                <span className="text-[9px] text-muted-foreground">/5 UPI</span>
              </div>
            </div>

            {/* Grass Pollen */}
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  🌾 หญ้า
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{ backgroundColor: `${data.pollen.grass.color}20`, color: data.pollen.grass.color }}
                >
                  {data.pollen.grass.category}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold font-mono text-foreground">{data.pollen.grass.index}</span>
                <span className="text-[9px] text-muted-foreground">/5 UPI</span>
              </div>
            </div>

            {/* Weed Pollen */}
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  🌿 วัชพืช
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{ backgroundColor: `${data.pollen.weed.color}20`, color: data.pollen.weed.color }}
                >
                  {data.pollen.weed.category}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold font-mono text-foreground">{data.pollen.weed.index}</span>
                <span className="text-[9px] text-muted-foreground">/5 UPI</span>
              </div>
            </div>
          </div>

          {/* Health Recommendation Tip */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-[11px] text-foreground/90">
            <ShieldAlert className="size-3.5 text-pink-500 shrink-0 mt-0.5" />
            <p className="leading-snug">{data.pollen.healthRecommendation}</p>
          </div>
        </div>
      )}

      {/* ── Forecast Section: 5-Day Forecast & Vertical 24-Hour Forecast ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* 5-Day Daily Forecast */}
        {data.forecast && data.forecast.length > 0 && (
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-3">
              <CalendarDays className="size-3.5 text-sky-500" />
              <span>5-Day Daily Forecast</span>
            </div>
            <div className="space-y-2 flex-1">
              {data.forecast.slice(0, 5).map((day, i) => {
                const d = day.date ? new Date(day.date) : null;
                const label = i === 0
                  ? "Today"
                  : d
                    ? d.toLocaleDateString("en", { weekday: "short" })
                    : `Day ${i + 1}`;

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors text-xs"
                  >
                    <span className="font-semibold text-foreground w-12 shrink-0">{label}</span>
                    <span className="text-base mx-1.5 shrink-0" role="img">
                      {weatherEmoji(day.condition.description)}
                    </span>
                    <span className="text-muted-foreground flex-1 truncate text-[11px]">
                      {day.condition.description}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-xs shrink-0 font-medium ml-2">
                      <span className="font-bold text-foreground">{day.maxTempC}°</span>
                      <span className="text-muted-foreground text-[11px]">{day.minTempC}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 24-Hour Hourly Forecast (Vertical Timeline Layout) */}
        {data.hourly && data.hourly.length > 0 && (
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col">
            <div className="flex items-center justify-between gap-1.5 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Clock className="size-3.5 text-sky-500" />
                <span>24-Hour Forecast</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Hourly</span>
            </div>

            {/* Vertical Scrollable List */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-1">
              {data.hourly.slice(0, 18).map((hour, i) => {
                const d = hour.time ? new Date(hour.time) : null;
                const timeLabel = i === 0
                  ? "Now"
                  : d
                    ? d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", hour12: true })
                    : `+${i}h`;

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-colors text-xs"
                  >
                    <span className="w-16 font-semibold text-foreground text-xs shrink-0">{timeLabel}</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 mx-1">
                      <span className="text-base shrink-0">
                        {weatherEmoji(hour.condition.description)}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px]">
                        {hour.condition.description}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-foreground shrink-0 ml-2">
                      {hour.tempC}°C
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Main Weather Widget Component
// ─────────────────────────────────────────
const WeatherWidget = ({ lat, lng, locationName, tripStartDate, typicalWeather }: WeatherWidgetProps) => {
  const [data, setData] = useState<EnvironmentData | null>(null);
  const [timezoneInfo, setTimezoneInfo] = useState<TimeZoneInfo | null>(null);
  const [liveClockStr, setLiveClockStr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      getEnvironmentData(lat, lng),
      getDestinationTimeZone(lat, lng),
    ])
      .then(([envData, tzData]) => {
        setData(envData);
        setTimezoneInfo(tzData);
        setLiveClockStr(tzData.localTimeString);
      })
      .catch(() => setError("Could not load environment data."))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  // Destination Live Clock Interval
  useEffect(() => {
    if (!timezoneInfo?.timeZoneId) return;

    const timer = setInterval(() => {
      try {
        const timeStr = new Intl.DateTimeFormat("th-TH", {
          timeZone: timezoneInfo.timeZoneId,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date());
        setLiveClockStr(timeStr);
      } catch {
        // keep previous string
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timezoneInfo]);

  const hasWeather = data?.current != null;
  const hasAQI = data?.airQuality != null;
  const hasAny = hasWeather || hasAQI || (data?.forecast?.length ?? 0) > 0;

  if (!loading && !hasAny && error) {
    return null;
  }

  const daysLeft = daysUntilTrip(tripStartDate);
  const isFarFuture = daysLeft !== null && daysLeft > 7;
  const currentTempLabel = data?.current ? `${data.current.temperatureC}°C` : null;

  return (
    <div className="w-full mx-auto p-4 sm:p-5 flex flex-col gap-4">
      {/* Destination Time Zone & Live Clock Banner */}
      {timezoneInfo && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-secondary/60 border border-border/70 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Clock className="size-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <span className="font-mono text-sm tracking-tight">{liveClockStr || timezoneInfo.localTimeString}</span>
                <span className="text-[10px] text-muted-foreground font-medium">({timezoneInfo.gmtOffset}, {timezoneInfo.timeZoneId.split("/")[1] || timezoneInfo.timeZoneName})</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{timezoneInfo.localDateString} · เวลาท้องถิ่น ณ {locationName}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
            {timezoneInfo.timeDiffLabel}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
            <CloudSun className="size-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Weather & Environment — {locationName}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isFarFuture ? `Typical conditions for ${typicalWeather?.month ?? "travel month"} · Live weather & Pollen` : "Live conditions, air quality & pollen index"}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        </div>
      ) : (
        <>
          {/* Far-future trip alert */}
          {isFarFuture && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-sky-400/10 border border-sky-400/20 text-xs">
              <span className="text-base mt-0.5">✈️</span>
              <div>
                <p className="font-semibold text-foreground">
                  Your trip is in {daysLeft} days — outside standard 7-day live window.
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {currentTempLabel
                    ? `Current weather at ${locationName}: ${currentTempLabel} (${data?.current?.condition.description}). Showing historical averages for ${typicalWeather?.month ?? "your month"}.`
                    : `Showing typical climate patterns for ${typicalWeather?.month ?? "your travel month"}.`}
                </p>
              </div>
            </div>
          )}

          {/* Typical Weather card when trip is far */}
          {isFarFuture && typicalWeather && (
            <TypicalWeatherCard data={typicalWeather} locationName={locationName} />
          )}

          {/* Live Data */}
          {isFarFuture ? (
            <details
              open={forecastOpen}
              onToggle={(e) => setForecastOpen((e.target as HTMLDetailsElement).open)}
              className="rounded-2xl overflow-hidden border border-border/70"
            >
              <summary className="flex items-center justify-between px-4 py-2.5 bg-secondary/50 cursor-pointer select-none list-none hover:bg-secondary transition-colors text-xs font-semibold text-foreground">
                <span>🌐 View Current Live Conditions & Pollen</span>
                <span className={`text-muted-foreground text-xs transition-transform ${forecastOpen ? "rotate-180" : ""}`}>▼</span>
              </summary>
              <div className="p-3">
                <LiveWeatherContent data={data} />
              </div>
            </details>
          ) : (
            <LiveWeatherContent data={data} />
          )}
        </>
      )}

      {!loading && (
        <p className="text-[10px] text-muted-foreground/60 text-right font-medium">
          Powered by Google Maps Platform Weather, Air Quality & Pollen APIs
        </p>
      )}
    </div>
  );
};

export default WeatherWidget;


