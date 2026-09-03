import { useState, useMemo } from "react";
import { type FlightTrend } from "@/services/flightService";
import {
  Sparkles,
  TrendingDown,
  BarChart3,
  Grid,
  Check,
  RefreshCw,
  Calendar as CalendarIcon,
  CalendarDays,
  ExternalLink,
  Plane,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GoogleFlightsCalendarWidgetProps {
  trends?: FlightTrend[];
  loading?: boolean;
  currency?: string;
  selectedDate?: string; // "YYYY-MM-DD"
  onSelectDate?: (dateStr: string) => void;
  onRefresh?: () => void;
  origin?: string;
  destination?: string;
}

export const GoogleFlightsCalendarWidget = ({
  trends = [],
  loading = false,
  currency = "THB",
  selectedDate,
  onSelectDate,
  onRefresh,
  origin = "BKK",
  destination = "NRT",
}: GoogleFlightsCalendarWidgetProps) => {
  const [viewMode, setViewMode] = useState<"graph" | "grid">("graph");

  // If backend returns empty trends (e.g. RapidAPI rate limit or 403), generate smart fallback trends
  const effectiveTrends = useMemo(() => {
    if (trends && trends.length > 0) return trends;

    const baseDate = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
    const fallbackList: FlightTrend[] = [];
    const destUpper = (destination || "").toUpperCase();

    let baseFare = 4500;
    if (["NRT", "HND", "KIX", "ICN", "FUK", "CTS"].some((k) => destUpper.includes(k))) {
      baseFare = 6500;
    } else if (["LHR", "CDG", "JFK", "LAX", "FRA", "ZRH"].some((k) => destUpper.includes(k))) {
      baseFare = 18500;
    } else if (["HKT", "CNX", "KBV", "USM", "HDY", "CEI"].some((k) => destUpper.includes(k))) {
      baseFare = 1450;
    } else if (["SIN", "KUL", "HKG", "TPE", "SGN", "DAD"].some((k) => destUpper.includes(k))) {
      baseFare = 3800;
    }

    for (let i = 0; i < 30; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dayOfWeek = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
      let multiplier = 1.0;
      if (dayOfWeek === 5 || dayOfWeek === 0) multiplier = 1.18;
      else if (dayOfWeek === 2 || dayOfWeek === 3) multiplier = 0.88;
      else if (dayOfWeek === 6) multiplier = 1.08;
      else multiplier = 0.95;

      const randomJitter = (((i * 7 + dayOfWeek * 13) % 10) - 5) / 100;
      const price = Math.round((baseFare * (multiplier + randomJitter)) / 50) * 50;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      fallbackList.push({
        date: `${year}-${month}-${day}`,
        price,
      });
    }
    return fallbackList;
  }, [trends, selectedDate, destination]);

  const isLive = trends && trends.length > 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4 space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
        <div className="h-32 bg-muted/40 rounded-xl flex items-end justify-between p-2 gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted/80 rounded-t w-full"
              style={{ height: `${20 + (i % 5) * 15}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const prices = effectiveTrends.map((t) => t.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const priceRange = maxPrice - minPrice || 1;

  const formatPrice = (p: number) => {
    return `฿${p.toLocaleString("en-US")}`;
  };

  const formatShortPrice = (p: number) => {
    if (p >= 10000) return `฿${(p / 1000).toFixed(1)}k`;
    if (p >= 1000) return `฿${(p / 1000).toFixed(1)}k`;
    return `฿${p}`;
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return {
        fullDateThai: d.toLocaleDateString("th-TH", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        dayName: d.toLocaleDateString("th-TH", { weekday: "short" }),
        dayNumber: d.getDate().toString(),
        monthShort: d.toLocaleDateString("th-TH", { month: "short" }),
        monthDay: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
        isoDate: dateStr,
      };
    } catch {
      return {
        fullDateThai: dateStr,
        dayName: "",
        dayNumber: dateStr,
        monthShort: "",
        monthDay: dateStr,
        isoDate: dateStr,
      };
    }
  };

  // Date span of the calendar trends
  const firstDateLabel = effectiveTrends[0]
    ? formatDateLabel(effectiveTrends[0].date).monthDay
    : "";
  const lastDateLabel = effectiveTrends[effectiveTrends.length - 1]
    ? formatDateLabel(effectiveTrends[effectiveTrends.length - 1].date).monthDay
    : "";
  const selectedDateFormatted = selectedDate
    ? formatDateLabel(selectedDate).fullDateThai
    : null;

  const googleFlightsSearchUrl = `https://www.google.com/travel/flights?q=Flights+from+${origin}+to+${destination}${
    selectedDate ? `+on+${selectedDate}` : ""
  }`;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-card/80 to-card backdrop-blur-md p-4 space-y-3 shadow-md animate-slide-up">
      {/* ── Widget Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0 shadow-2xs">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground">
                ปฏิทินราคาตั๋วเครื่องบิน (Google Flights)
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 font-bold ${
                  isLive
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : "border-sky-500/30 text-sky-500 bg-sky-500/10"
                }`}
              >
                {isLive ? "LIVE FARES" : "ESTIMATED TRENDS"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span>{origin && destination ? `${origin} → ${destination}` : "เลือกดูวันที่ราคาดีที่สุด"}</span>
              {firstDateLabel && lastDateLabel && (
                <span className="text-primary font-medium">
                  ({firstDateLabel} – {lastDateLabel})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* View Toggle & Google Flights Link */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <a
            href={googleFlightsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
          >
            <span>Google Flights</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border text-[11px]">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode("graph");
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === "graph"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-3 h-3" /> กราฟ
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode("grid");
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-card text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid className="w-3 h-3" /> รายการ
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Insights Banner ── */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-card/60 border border-border/50 text-center">
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            ราคาถูกที่สุด
          </p>
          <p className="text-xs font-extrabold text-emerald-500 flex items-center justify-center gap-0.5">
            <TrendingDown className="w-3 h-3" /> {formatPrice(minPrice)}
          </p>
        </div>
        <div className="space-y-0.5 border-x border-border/40">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            ราคาเฉลี่ย
          </p>
          <p className="text-xs font-bold text-foreground">{formatPrice(avgPrice)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            ราคาสูงสุด
          </p>
          <p className="text-xs font-bold text-amber-500">{formatPrice(maxPrice)}</p>
        </div>
      </div>

      {/* ── Selected Date Banner ── */}
      {selectedDateFormatted && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <CalendarIcon className="size-3.5 text-primary" />
            <span>วันที่เลือกเดินทาง: </span>
            <span className="text-primary font-bold">{selectedDateFormatted}</span>
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            (คลิกแท่งกราฟด้านล่างเพื่อเปลี่ยนวันเดินทาง)
          </span>
        </div>
      )}

      {/* ── Graph View (Bar Chart with Clear Dates) ── */}
      {viewMode === "graph" && (
        <div className="space-y-2">
          <div className="overflow-x-auto pb-2 scrollbar-none">
            <div className="flex items-end gap-2 h-44 min-w-max px-2 pt-7">
              {effectiveTrends.map((t) => {
                const heightPct = 25 + ((t.price - minPrice) / priceRange) * 75;
                const isMin = t.price === minPrice;
                const isCheap = t.price <= minPrice * 1.1;
                const isSelected = selectedDate && t.date === selectedDate;
                const { dayName, monthDay, fullDateThai } = formatDateLabel(t.date);

                return (
                  <button
                    key={t.date}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectDate && onSelectDate(t.date);
                    }}
                    className={`flex flex-col items-center gap-1 group relative transition-all ${
                      onSelectDate ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md pointer-events-none whitespace-nowrap z-20">
                      {fullDateThai}: {formatPrice(t.price)}
                    </div>

                    {/* Lowest price badge */}
                    {isMin && (
                      <span className="text-[8px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-sm animate-pulse">
                        ถูกสุด
                      </span>
                    )}

                    {/* Price above bar for selected or cheap */}
                    {(isSelected || isMin) && !isMin && (
                      <span className="text-[8px] text-primary font-bold">
                        {formatShortPrice(t.price)}
                      </span>
                    )}

                    {/* Bar */}
                    <div className="w-6 flex flex-col justify-end items-center h-24 relative">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 relative overflow-hidden ${
                          isSelected
                            ? "bg-primary ring-2 ring-primary ring-offset-1 ring-offset-card shadow-md scale-105"
                            : isMin
                            ? "bg-emerald-500 group-hover:bg-emerald-400 shadow-sm"
                            : isCheap
                            ? "bg-emerald-500/70 group-hover:bg-emerald-500/90"
                            : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Date labels - showing day name and day + month */}
                    <div className="text-center leading-tight pt-1">
                      <p className="text-[9px] text-muted-foreground font-medium">
                        {dayName}
                      </p>
                      <p
                        className={`text-[10px] font-bold whitespace-nowrap ${
                          isSelected
                            ? "text-primary"
                            : isMin
                            ? "text-emerald-500"
                            : "text-foreground"
                        }`}
                      >
                        {monthDay}
                      </p>
                      <p className="text-[8px] text-muted-foreground/80 font-mono">
                        {formatShortPrice(t.price)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> ราคาถูกที่สุด
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-primary inline-block" /> วันที่เลือก
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-muted-foreground/40 inline-block" /> ราคาปกติ
            </span>
          </p>
        </div>
      )}

      {/* ── Grid View (Calendar Cards with Full Dates) ── */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
          {effectiveTrends.map((t) => {
            const isMin = t.price === minPrice;
            const isSelected = selectedDate && t.date === selectedDate;
            const { dayName, monthDay } = formatDateLabel(t.date);

            return (
              <button
                key={t.date}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectDate && onSelectDate(t.date);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                    : isMin
                    ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500"
                    : "border-border/60 hover:border-primary/40 bg-card/60"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 text-primary">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {dayName}
                    </span>
                    {isMin && (
                      <span className="text-[8px] bg-emerald-500 text-white font-bold px-1 rounded">
                        ถูกสุด
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-foreground">{monthDay}</p>
                  <p className="text-[9px] text-muted-foreground font-mono">{t.date}</p>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between border-t border-border/40 pt-1">
                  <span
                    className={`text-xs font-extrabold ${
                      isMin ? "text-emerald-500" : "text-foreground"
                    }`}
                  >
                    {formatPrice(t.price)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
