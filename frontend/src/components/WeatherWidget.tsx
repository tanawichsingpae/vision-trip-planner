import { useEffect, useState } from "react";
import { type EnvironmentData, getEnvironmentData } from "@/services/environmentService";
import { type TypicalWeather } from "@/services/aiService";

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
  <div className={`animate-pulse bg-white/10 rounded-lg ${className ?? ""}`} />
);

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface WeatherWidgetProps {
  lat: number;
  lng: number;
  locationName: string;
  tripStartDate?: Date;
  typicalWeather?: TypicalWeather;
}

// ─────────────────────────────────────────
// Helper: days until trip
// ─────────────────────────────────────────
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
  <div className="flex flex-col gap-4">
    {/* Header */}
    <div className="flex flex-col bg-white/8 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">Typical Weather in {data.month}</p>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-4xl font-bold text-foreground">{data.avgHighC}°</span>
        <span className="text-muted-foreground text-lg mb-1">/ {data.avgLowC}°C</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{data.description}</p>
    </div>

    {/* Detail chips */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-3 border border-white/10 shadow-sm">
        <p className="text-[10px] text-muted-foreground mb-1">🌡️ Temp Range</p>
        <p className="text-sm font-semibold text-foreground">{data.tempRange}</p>
      </div>
      <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-3 border border-white/10 shadow-sm">
        <p className="text-[10px] text-muted-foreground mb-1">🌧️ Rain Chance</p>
        <p className="text-sm font-semibold text-foreground">{data.rainChance}</p>
      </div>
      <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-3 border border-white/10 shadow-sm">
        <p className="text-[10px] text-muted-foreground mb-1">💧 Humidity</p>
        <p className="text-sm font-semibold text-foreground">{data.humidity}</p>
      </div>
      <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-3 border border-white/10 shadow-sm">
        <p className="text-[10px] text-muted-foreground mb-1">🎒 Travel Tips</p>
        <p className="text-sm font-semibold text-foreground line-clamp-2">{data.tips}</p>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
const WeatherWidget = ({ lat, lng, locationName, tripStartDate, typicalWeather }: WeatherWidgetProps) => {
  const [data, setData] = useState<EnvironmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEnvironmentData(lat, lng)
      .then(setData)
      .catch(() => setError("Could not load environment data."))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  const hasWeather = data?.current != null;
  const hasAQI = data?.airQuality != null;
  const hasAny = hasWeather || hasAQI || (data?.forecast?.length ?? 0) > 0;

  if (!loading && !hasAny && error) {
    return null; // Silent fail — API may not be enabled yet
  }

  const daysLeft = daysUntilTrip(tripStartDate);
  // Trip is far in the future if > 7 days away
  const isFarFuture = daysLeft !== null && daysLeft > 7;

  const currentTempLabel = data?.current ? `${data.current.temperatureC}°C` : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 mb-10 animate-slide-up">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10"
        style={{
          background: "linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(99,102,241,0.15) 50%, rgba(16,185,129,0.12) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-indigo-400/10 blur-2xl pointer-events-none" />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                🌍 Environment — {locationName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFarFuture ? `Typical conditions for ${typicalWeather?.month ?? "this month"} · Live current weather` : "Live conditions & air quality"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48 md:col-span-2" />
            </div>
          ) : (
            <>
              {/* ── Far-future trip: show alert + typical weather + collapsible live data ── */}
              {isFarFuture && (
                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl bg-sky-400/10 border border-sky-400/20">
                  <span className="text-xl mt-0.5">✈️</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Your trip is in {daysLeft} days — outside the forecast window.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {currentTempLabel
                        ? `Currently at ${locationName}: ${currentTempLabel} ${hasWeather && data!.current ? `— ${data!.current.condition.description}` : ""}. Below you can see typical weather for ${typicalWeather?.month ?? "your travel month"}.`
                        : `Showing typical weather for ${typicalWeather?.month ?? "your travel month"} instead.`}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Typical Weather section (shown when trip is far or no live forecast) ── */}
              {isFarFuture && typicalWeather && (
                <div className="mb-5">
                  <TypicalWeatherCard data={typicalWeather} locationName={locationName} />
                </div>
              )}

              {/* ── Collapsible live data (always available, but collapsed for far-future trips) ── */}
              {isFarFuture ? (
                <details
                  open={forecastOpen}
                  onToggle={(e) => setForecastOpen((e.target as HTMLDetailsElement).open)}
                  className="rounded-2xl overflow-hidden border border-white/10"
                >
                  <summary className="flex items-center justify-between px-4 py-3 bg-white/5 cursor-pointer select-none list-none hover:bg-white/10 transition-colors rounded-2xl">
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      <span>🌐</span> Live Conditions at {locationName} (Current)
                    </span>
                    <span className={`text-muted-foreground text-xs transition-transform ${forecastOpen ? "rotate-180" : ""}`}>▼</span>
                  </summary>
                  <div className="p-4">
                    <LiveWeatherContent data={data} />
                  </div>
                </details>
              ) : (
                <LiveWeatherContent data={data} />
              )}
            </>
          )}

          {/* Source note */}
          {!loading && (
            <p className="text-[10px] text-muted-foreground/60 mt-3 text-right">
              Powered by Google Maps Platform Weather & Air Quality APIs
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Live Weather content (extracted for reuse)
// ─────────────────────────────────────────
const LiveWeatherContent = ({ data }: { data: EnvironmentData | null }) => {
  if (!data) return null;
  const hasWeather = data.current != null;
  const hasAQI = data.airQuality != null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="flex flex-col gap-4">
        {/* ── Current Weather card ── */}
        {hasWeather && data!.current && (
          <div className="flex flex-col justify-between bg-white/8 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-sm flex-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Weather</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-foreground">
                    {data!.current.temperatureC}°
                  </span>
                  <span className="text-lg mb-1">C</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[120px]">
                  {data!.current.condition.description}
                </p>
              </div>
              <span className="text-4xl" role="img" aria-label="weather icon">
                {weatherEmoji(data!.current.rawIcon || data!.current.condition.description)}
              </span>
            </div>
          </div>
        )}

        {/* ── Air Quality card ── */}
        {hasAQI && data!.airQuality && (
          <div className="flex flex-col justify-between bg-white/8 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-sm flex-1">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Air Quality Index</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-foreground">
                  {data!.airQuality.aqi}
                </span>
                <span
                  className="text-sm font-semibold mb-1"
                  style={{ color: data!.airQuality.color }}
                >
                  {data!.airQuality.category}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Main pollutant: <span className="font-medium">{data!.airQuality.dominantPollutant}</span>
              </p>
            </div>

            {/* AQI bar */}
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Good</span>
                <span>Unhealthy</span>
              </div>
              <div className="relative h-2.5 rounded-full overflow-hidden"
                style={{
                  background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444, #a855f7)"
                }}
              >
                <div
                  className="absolute top-0 h-full w-2.5 rounded-full shadow-lg border-2 border-white"
                  style={{
                    left: `calc(${aqiBar(data!.airQuality.aqi)}% - 6px)`,
                    background: data!.airQuality.color,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 7-Day Forecast card ── */}
      {data!.forecast.length > 0 && (
        <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-sm h-full overflow-y-auto max-h-[300px] md:max-h-none">
          <p className="text-xs text-muted-foreground mb-3 sticky top-0 bg-transparent backdrop-blur-md">5 Day Forecast</p>
          <div className="flex flex-col gap-2">
            {data!.forecast.slice(0, 7).map((day, i) => {
              const d = day.date ? new Date(day.date) : null;
              const label = i === 0
                ? "Today"
                : d
                  ? d.toLocaleDateString("en", { weekday: "short" })
                  : `Day ${i + 1}`;
              return (
                <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-xs text-muted-foreground w-10">{label}</span>
                  <span className="text-base mx-1" role="img">
                    {weatherEmoji(day.condition.description)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1 mx-1 truncate">
                    {day.condition.description}
                  </span>
                  <div className="flex gap-1 text-xs font-semibold">
                    <span className="text-foreground">{day.maxTempC}°</span>
                    <span className="text-muted-foreground">{day.minTempC}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 24-Hour Forecast card (Span 2 cols) ── */}
      {data!.hourly && data!.hourly.length > 0 && (
        <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-sm md:col-span-2 flex flex-col">
          <p className="text-xs text-muted-foreground mb-3">24 Hour Forecast</p>
          <div className="flex gap-3 overflow-x-auto pb-2 flex-1 items-center scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {data!.hourly.slice(0, 24).map((hour, i) => {
              const d = hour.time ? new Date(hour.time) : null;
              const timeLabel = d
                ? d.toLocaleTimeString("en", { hour: "numeric", hour12: true })
                : `+${i}h`;

              return (
                <div key={i} className="flex flex-col items-center justify-center min-w-[60px] gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{i === 0 ? "Now" : timeLabel}</span>
                  <span className="text-2xl" role="img" title={hour.condition.description}>
                    {weatherEmoji(hour.condition.description)}
                  </span>
                  <span className="text-sm font-semibold">{hour.tempC}°</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
