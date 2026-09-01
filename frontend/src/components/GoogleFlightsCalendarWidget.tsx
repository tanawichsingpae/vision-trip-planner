import { useState } from "react";
import { type FlightTrend } from "@/services/flightService";
import { Sparkles, TrendingDown, BarChart3, Grid, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GoogleFlightsCalendarWidgetProps {
  trends: FlightTrend[];
  loading: boolean;
  currency?: string;
  selectedDate?: string; // "YYYY-MM-DD"
  onSelectDate?: (dateStr: string) => void;
  onRefresh?: () => void;
  origin?: string;
  destination?: string;
}

export const GoogleFlightsCalendarWidget = ({
  trends,
  loading,
  currency = "THB",
  selectedDate,
  onSelectDate,
  onRefresh,
  origin,
  destination,
}: GoogleFlightsCalendarWidgetProps) => {
  const [viewMode, setViewMode] = useState<"graph" | "grid">("graph");

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

  if (!trends || trends.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center space-y-2">
        <p className="text-xs text-muted-foreground">Price calendar currently unavailable for this route/date.</p>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} className="text-xs text-primary h-7 px-2">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry loading trends
          </Button>
        )}
      </div>
    );
  }

  const prices = trends.map((t) => t.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const priceRange = maxPrice - minPrice || 1;

  const formatPrice = (p: number) => {
    return `฿${p.toLocaleString("en-US")}`;
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return {
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        monthDay: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      };
    } catch {
      return { dayName: "", monthDay: dateStr };
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-card/80 to-card backdrop-blur-md p-4 space-y-3 shadow-md animate-slide-up">
      {/* ── Widget Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">Google Flights Price Trends</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                LIVE FARES
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {origin && destination ? `${origin} → ${destination}` : "Click any bar below to select a cheap travel date"}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
              viewMode === "graph" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-3 h-3" /> Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
              viewMode === "grid" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid className="w-3 h-3" /> Grid
          </button>
        </div>
      </div>

      {/* ── Quick Insights Banner ── */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-card/60 border border-border/50 text-center">
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Lowest Fare</p>
          <p className="text-xs font-extrabold text-emerald-500 flex items-center justify-center gap-0.5">
            <TrendingDown className="w-3 h-3" /> {formatPrice(minPrice)}
          </p>
        </div>
        <div className="space-y-0.5 border-x border-border/40">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Average Fare</p>
          <p className="text-xs font-bold text-foreground">{formatPrice(avgPrice)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Peak Fare</p>
          <p className="text-xs font-bold text-amber-500">{formatPrice(maxPrice)}</p>
        </div>
      </div>

      {/* ── Graph View (Bar Chart) ── */}
      {viewMode === "graph" && (
        <div className="space-y-2">
          <div className="overflow-x-auto pb-2 scrollbar-none">
            <div className="flex items-end gap-1.5 h-36 min-w-max px-1 pt-6">
              {trends.map((t) => {
                const heightPct = 25 + ((t.price - minPrice) / priceRange) * 75;
                const isMin = t.price === minPrice;
                const isCheap = t.price <= minPrice * 1.1;
                const isSelected = selectedDate && t.date === selectedDate;
                const { dayName, monthDay } = formatDateLabel(t.date);

                return (
                  <button
                    key={t.date}
                    type="button"
                    onClick={() => onSelectDate && onSelectDate(t.date)}
                    className={`flex flex-col items-center gap-1 group relative transition-all ${
                      onSelectDate ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                      {monthDay}: {formatPrice(t.price)}
                    </div>

                    {/* Lowest price badge */}
                    {isMin && (
                      <span className="text-[8px] bg-emerald-500 text-white font-extrabold px-1 py-0.2 rounded-full uppercase tracking-tighter shadow-sm">
                        LOWEST
                      </span>
                    )}

                    {/* Bar */}
                    <div className="w-5 flex flex-col justify-end items-center h-24 relative">
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

                    {/* Date labels */}
                    <div className="text-center leading-none">
                      <p className="text-[9px] text-muted-foreground font-medium">{dayName}</p>
                      <p className={`text-[10px] font-bold ${isSelected ? "text-primary" : isMin ? "text-emerald-500" : "text-foreground"}`}>
                        {monthDay.split(" ")[0]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Cheapest Deals</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary inline-block" /> Selected Date</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-muted-foreground/40 inline-block" /> Standard Fare</span>
          </p>
        </div>
      )}

      {/* ── Grid View (Calendar Cards) ── */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
          {trends.map((t) => {
            const isMin = t.price === minPrice;
            const isSelected = selectedDate && t.date === selectedDate;
            const { dayName, monthDay } = formatDateLabel(t.date);

            return (
              <button
                key={t.date}
                type="button"
                onClick={() => onSelectDate && onSelectDate(t.date)}
                className={`p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : isMin
                    ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500"
                    : "border-border/60 hover:border-primary/40 bg-card/60"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-1 right-1 text-primary">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">{dayName}</p>
                  <p className="text-xs font-bold text-foreground">{monthDay}</p>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className={`text-xs font-extrabold ${isMin ? "text-emerald-500" : "text-foreground"}`}>
                    {formatPrice(t.price)}
                  </span>
                  {isMin && <span className="text-[8px] bg-emerald-500 text-white font-bold px-1 rounded">CHEAP</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
