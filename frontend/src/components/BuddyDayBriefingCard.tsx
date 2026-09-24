import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CloudRain,
  Sun,
  Train,
  Sparkles,
  ShoppingBag,
  Plane,
  Moon,
  Compass,
  ArrowRight,
  Radio,
  ExternalLink,
  ShieldAlert,
  Calendar,
  MapPin,
} from "lucide-react";
import {
  type BuddyDayBriefing,
  type BuddyAlert,
  type LiveTransitStatus,
  fetchLiveBuddyInsights,
  getPixMascotUrl,
} from "@/services/buddyService";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BuddyDayBriefingCardProps {
  briefing: BuddyDayBriefing;
  cityName?: string;
  places?: string[];
  onActionClick?: (alert: BuddyAlert) => void;
}

export const BuddyDayBriefingCard: React.FC<BuddyDayBriefingCardProps> = ({
  briefing,
  cityName,
  places,
  onActionClick,
}) => {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveTransit, setLiveTransit] = useState<LiveTransitStatus | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const isTh = language === "th";

  const {
    dominantPose,
    greeting,
    weatherSummary,
    trafficSummary,
    dressCodeWarning,
    keyAlerts,
    allAlerts,
  } = briefing;

  const placesKey = (places || []).slice(0, 5).join("|");

  useEffect(() => {
    let isMounted = true;
    const targetCity = cityName?.trim();
    if (!targetCity && (!places || places.length === 0)) return;

    setIsLoadingLive(true);
    fetchLiveBuddyInsights(targetCity || "", places || [])
      .then((status) => {
        if (isMounted) {
          setLiveTransit(status);
        }
      })
      .catch((err) => {
        console.warn("[BuddyDayBriefingCard] Live transit check failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLive(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cityName, placesKey]);

  const mascotUrl = getPixMascotUrl(dominantPose);

  // Status style theme by dominant pose
  const getTheme = () => {
    switch (dominantPose) {
      case "rainy":
        return {
          border: "border-sky-500/40 dark:border-sky-500/30",
          bg: "bg-sky-500/5 dark:bg-sky-950/20",
          badgeBg: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
          ring: "ring-sky-400/60 shadow-sky-500/20",
          icon: <CloudRain className="size-3.5 text-sky-600 dark:text-sky-400" />,
        };
      case "warning":
        return {
          border: "border-amber-500/40 dark:border-amber-500/30",
          bg: "bg-amber-500/5 dark:bg-amber-950/20",
          badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
          ring: "ring-amber-400/60 shadow-amber-500/20",
          icon: <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />,
        };
      case "sunny":
        return {
          border: "border-orange-500/40 dark:border-orange-500/30",
          bg: "bg-orange-500/5 dark:bg-orange-950/20",
          badgeBg: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
          ring: "ring-orange-400/60 shadow-orange-500/20",
          icon: <Sun className="size-3.5 text-orange-600 dark:text-orange-400" />,
        };
      case "transit":
        return {
          border: "border-blue-500/40 dark:border-blue-500/30",
          bg: "bg-blue-500/5 dark:bg-blue-950/20",
          badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
          ring: "ring-blue-400/60 shadow-blue-500/20",
          icon: <Train className="size-3.5 text-blue-600 dark:text-blue-400" />,
        };
      case "flight":
        return {
          border: "border-indigo-500/40 dark:border-indigo-500/30",
          bg: "bg-indigo-500/5 dark:bg-indigo-950/20",
          badgeBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200",
          ring: "ring-indigo-400/60 shadow-indigo-500/20",
          icon: <Plane className="size-3.5 text-indigo-600 dark:text-indigo-400" />,
        };
      case "night":
        return {
          border: "border-purple-500/40 dark:border-purple-500/30",
          bg: "bg-purple-500/5 dark:bg-purple-950/20",
          badgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
          ring: "ring-purple-400/60 shadow-purple-500/20",
          icon: <Moon className="size-3.5 text-purple-600 dark:text-purple-400" />,
        };
      default:
        return {
          border: "border-primary/30 dark:border-primary/20",
          bg: "bg-primary/5 dark:bg-primary/10",
          badgeBg: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
          ring: "ring-primary/40 shadow-primary/10",
          icon: <Sparkles className="size-3.5 text-primary" />,
        };
    }
  };

  const theme = getTheme();
  const alertCount = allAlerts.length;

  return (
    <div
      className={`rounded-2xl border ${theme.border} ${theme.bg} p-3.5 sm:p-4 mb-3.5 backdrop-blur-xs transition-all duration-200 shadow-xs pdf-hidden overflow-hidden w-full`}
    >
      {/* Top Banner Row */}
      <div className="flex items-start gap-3">
        {/* Mascot Avatar with dynamic theme ring */}
        <div className="relative shrink-0">
          <div
            className={`size-12 sm:size-14 rounded-2xl overflow-hidden ring-2 ${theme.ring} shadow-md bg-muted flex items-center justify-center`}
          >
            <img
              src={mascotUrl}
              alt="Pix Travel Buddy"
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              onError={(e) => {
                // Fallback gracefully if image path needs adjustment
                (e.target as HTMLImageElement).src = "/logos/pix_tip.jpg";
              }}
            />
          </div>
          <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-background border border-border shadow-xs flex items-center justify-center">
            {theme.icon}
          </span>
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-xs font-bold tracking-tight text-foreground flex items-center gap-1 truncate">
                Pix Travel Buddy
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium shrink-0">
                {isTh ? `ดูแลวันที่ ${briefing.dayNumber}` : `Day ${briefing.dayNumber} Companion`}
              </span>
            </div>

            {alertCount > 0 && (
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold h-5 px-2 rounded-full cursor-pointer hover:opacity-80 transition-opacity shrink-0 ${theme.badgeBg}`}
                onClick={() => setIsExpanded((prev) => !prev)}
              >
                {alertCount} {isTh ? "ข้อแนะนำ" : "tips"}
                {isExpanded ? (
                  <ChevronUp className="size-3 ml-1" />
                ) : (
                  <ChevronDown className="size-3 ml-1" />
                )}
              </Badge>
            )}
          </div>

          <p className="text-xs text-foreground font-medium mt-1 leading-snug break-words">
            {greeting}
          </p>
        </div>
      </div>

      {/* Quick Context Pills - Full width of card, wrapped gracefully, never overflowing */}
      {(weatherSummary || trafficSummary || dressCodeWarning) && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-[11px] w-full min-w-0">
          {weatherSummary && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-background/80 border border-border/60 text-muted-foreground max-w-full min-w-0 shadow-2xs"
              title={weatherSummary}
            >
              <span className="shrink-0 text-xs">🌦️</span>
              <span className="truncate">{weatherSummary}</span>
            </span>
          )}

          {trafficSummary && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-background/80 border border-border/60 text-muted-foreground max-w-full min-w-0 shadow-2xs"
              title={trafficSummary}
            >
              <span className="shrink-0 text-xs">🚗</span>
              <span className="truncate">{trafficSummary}</span>
            </span>
          )}

          {dressCodeWarning && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium max-w-full min-w-0 shadow-2xs"
              title={isTh ? "แต่งกายสุภาพ (วัด/วัง)" : "Modest Dress Code"}
            >
              <span className="shrink-0 text-xs">👗</span>
              <span className="truncate">{isTh ? "แต่งกายสุภาพ (วัด/วัง)" : "Modest Dress Code"}</span>
            </span>
          )}

          {/* Attraction closure quick pill */}
          {liveTransit?.attractionAlerts && liveTransit.attractionAlerts.some((a) => a.status === "closed" || a.status === "restricted") && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-medium max-w-full min-w-0 shadow-2xs"
              title={liveTransit.attractionAlerts.filter((a) => a.status === "closed" || a.status === "restricted").map((a) => `${a.placeName}: ${a.note || a.status}`).join(", ")}
            >
              <span className="shrink-0 text-xs">🏛️</span>
              <span className="truncate">
                {liveTransit.attractionAlerts.find((a) => a.status === "closed" || a.status === "restricted")?.placeName} (
                {isTh ? "ปรับเปลี่ยน/ปิด" : "Notice"})
              </span>
            </span>
          )}

          {/* Special Events quick pill */}
          {liveTransit?.specialEvents && liveTransit.specialEvents.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-medium max-w-full min-w-0 shadow-2xs"
              title={`${liveTransit.specialEvents[0].eventName}: ${liveTransit.specialEvents[0].highlight || ""}`}
            >
              <span className="shrink-0 text-xs">🏮</span>
              <span className="truncate">{liveTransit.specialEvents[0].eventName}</span>
            </span>
          )}

          {/* Local rule / advisory quick pill */}
          {liveTransit?.localTipsAndRules && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-medium max-w-full min-w-0 shadow-2xs"
              title={liveTransit.localTipsAndRules}
            >
              <span className="shrink-0 text-xs">🛡️</span>
              <span className="truncate">{isTh ? "ข้อควรรู้เฉพาะวัน" : "Local Notice"}</span>
            </span>
          )}

          {/* Live transit normal status pill */}
          {liveTransit && !liveTransit.hasDisruption && liveTransit.title && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium max-w-full min-w-0 shadow-2xs"
              title={liveTransit.summary || (isTh ? "ระบบขนส่งและจราจรปกติ (ตรวจสดผ่าน AI)" : "Transit status normal (AI Live Check)")}
            >
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">{isTh ? "ขนส่งปกติ (สด)" : "Transit Normal (Live)"}</span>
            </span>
          )}
        </div>
      )}

      {/* Real-Time Transit Disruption Alert from OpenRouter Gemini */}
      {liveTransit && liveTransit.hasDisruption && (
        <div className="mt-2.5 p-2.5 sm:p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs animate-in fade-in duration-200 shadow-2xs w-full">
          <div className="flex items-start gap-2">
            <span className="relative flex h-2 w-2 mt-1 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-foreground tracking-tight">
                  {liveTransit.title || (isTh ? "แจ้งเตือนระบบขนส่งขัดข้อง" : "Transit Disruption Alert")}
                </span>
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 uppercase font-semibold">
                  {isTh ? "สดวันนี้" : "Live Alert"}
                </Badge>
              </div>
              {liveTransit.summary && (
                <p className="mt-1 text-muted-foreground leading-relaxed break-words">
                  {liveTransit.summary}
                </p>
              )}
              {liveTransit.adviceForTravelers && (
                <div className="mt-1.5 p-1.5 rounded-lg bg-background/80 border border-border/60 text-[11px] text-foreground font-medium flex items-center gap-1.5">
                  <span className="shrink-0">💡</span>
                  <span className="break-words">{liveTransit.adviceForTravelers}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Attraction Status Alert from OpenRouter Gemini */}
      {liveTransit?.attractionAlerts && liveTransit.attractionAlerts.some((a) => a.status === "closed" || a.status === "restricted" || a.status === "crowded") && (
        <div className="mt-2.5 p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-200 shadow-2xs w-full">
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-base mt-0.5">🏛️</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-foreground tracking-tight">
                  {isTh ? "แจ้งเตือนสถานะสถานที่ในทริป" : "Attraction Live Status Alert"}
                </span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-800 dark:text-amber-200 uppercase font-semibold">
                  {isTh ? "ตรวจสดวันนี้" : "Live Checked"}
                </Badge>
              </div>
              <div className="mt-1.5 space-y-1">
                {liveTransit.attractionAlerts
                  .filter((a) => a.status === "closed" || a.status === "restricted" || a.status === "crowded")
                  .map((attr, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] leading-snug">
                      <span className="font-bold text-foreground shrink-0">📍 {attr.placeName}:</span>
                      <span className="text-muted-foreground">{attr.note || (attr.status === "closed" ? (isTh ? "ปิดให้บริการชั่วคราว" : "Temporarily Closed") : attr.status)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Local Festivals & Events Alert */}
      {liveTransit?.specialEvents && liveTransit.specialEvents.length > 0 && (
        <div className="mt-2.5 p-2.5 sm:p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 text-xs animate-in fade-in duration-200 shadow-2xs w-full">
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-base mt-0.5">🏮</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-foreground tracking-tight">
                  {isTh ? "เทศกาลและกิจกรรมพิเศษในพื้นที่" : "Local Festivals & Events Today"}
                </span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-purple-500/40 text-purple-800 dark:text-purple-200 uppercase font-semibold">
                  {isTh ? "อีเวนต์วันนี้" : "Happening Today"}
                </Badge>
              </div>
              <div className="mt-1.5 space-y-1">
                {liveTransit.specialEvents.map((evt, idx) => (
                  <div key={idx} className="text-[11px] leading-snug">
                    <span className="font-semibold text-foreground">✨ {evt.eventName}</span>
                    {evt.location && <span className="text-muted-foreground ml-1">({evt.location})</span>}
                    {evt.highlight && <span className="text-muted-foreground ml-1">— {evt.highlight}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Safety & Local Regulations Notice */}
      {liveTransit?.localTipsAndRules && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2 shadow-2xs w-full">
          <span className="shrink-0 text-sm mt-0.5">🛡️</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground text-[11px]">
              {isTh ? "ข้อควรรู้และคำแนะนำความปลอดภัยเฉพาะวัน:" : "Daily Local Advisory & Safety Notice:"}
            </span>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed break-words">
              {liveTransit.localTipsAndRules}
            </p>
          </div>
        </div>
      )}

      {/* Expandable Alerts List */}
      {isExpanded && (alertCount > 0 || (liveTransit?.sources && liveTransit.sources.length > 0)) && (
        <div className="mt-3.5 pt-3 border-t border-border/50 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1">
            <span>{isTh ? "สิ่งที่พิกซ์แนะนำสำหรับวันนี้:" : "Pix's Daily Recommendations:"}</span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isTh ? "ย่อเก็บ" : "Collapse"}
            </button>
          </div>

          {/* Real-time Sources Pill Box */}
          {liveTransit && liveTransit.sources && liveTransit.sources.length > 0 && (
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-[11px] space-y-1">
              <div className="font-semibold text-muted-foreground flex items-center gap-1">
                <Radio className="size-3 text-primary animate-pulse" />
                <span>{isTh ? "แหล่งข่าวสารสดที่ระบบตรวจสอบ (OpenRouter Live Web):" : "Live Sources Verified:"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {liveTransit.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.startsWith("http") ? src : `https://google.com/search?q=${encodeURIComponent(src)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-primary hover:underline max-w-[200px] truncate"
                  >
                    <ExternalLink className="size-2.5 shrink-0" />
                    <span className="truncate">{src.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {allAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background/80 border border-border/60 shadow-2xs text-xs"
            >
              <img
                src={getPixMascotUrl(alert.pose)}
                alt={alert.title}
                className="size-8 rounded-lg object-cover ring-1 ring-border/80 shrink-0 mt-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logos/pix_tip.jpg";
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="font-semibold text-foreground text-xs truncate">
                    {alert.title}
                  </h4>
                  {alert.activityTitle && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      📍 {alert.activityTitle}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {alert.message}
                </p>

                {alert.actionLabel && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onActionClick?.(alert)}
                      className="h-6 px-2 text-[10px] font-medium rounded-lg border-primary/30 hover:bg-primary/10 text-primary gap-1"
                    >
                      <span>{alert.actionLabel}</span>
                      <ArrowRight className="size-2.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuddyDayBriefingCard;
