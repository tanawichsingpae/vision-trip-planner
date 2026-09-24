import React, { useState, useEffect, useMemo } from "react";
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
  Zap,
  Maximize2,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  type BuddyDayBriefing,
  type BuddyAlert,
  type LiveTransitStatus,
  fetchLiveBuddyInsights,
  getPixoMascotUrl,
  getPixMascotUrl,
} from "@/services/buddyService";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Clean raw markdown link syntax, citations like [lemon8-app.com], [th.trip.com], [a.com, b.com], URLs
const cleanTextNoise = (text?: string): string => {
  if (!text) return "";
  return text
    .replace(/\[([^\]]+)\]\((?:https?:\/\/[^\)]+|[^\)]+)\)/g, "$1")
    .replace(/\[[^\]]*\.[a-zA-Z]{2,}[^\]]*\]/g, "")
    .replace(/https?:\/\/[^\s\)\]]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
};

interface FormattedTip {
  title?: string;
  body: string;
}

const parseFormattedTips = (rawText?: string): FormattedTip[] => {
  if (!rawText) return [];
  const cleaned = cleanTextNoise(rawText);
  if (!cleaned) return [];

  const rawParts = cleaned
    .split(/(?=(?:^\s*(?:\d+\.|\*|\-)\s+|\s+(?:\d+\.|\*)\s+\*\*))/m)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParts.length <= 1) {
    const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      return lines.map((l) => {
        const item = l.replace(/^(\d+\.|\*|\-)\s*/, "").trim();
        const boldMatch = item.match(/^\*\*([^*]+)\*\*[:\s]*(.*)$/);
        if (boldMatch) {
          return { title: boldMatch[1].replace(/:$/, "").trim(), body: boldMatch[2].trim() };
        }
        return { body: item.replace(/\*\*/g, "").trim() };
      });
    }
    const single = cleaned.replace(/^(\d+\.|\*|\-)\s*/, "").trim();
    const boldMatch = single.match(/^\*\*([^*]+)\*\*[:\s]*(.*)$/);
    if (boldMatch) {
      return [{ title: boldMatch[1].replace(/:$/, "").trim(), body: boldMatch[2].trim() }];
    }
    return [{ body: single.replace(/\*\*/g, "").trim() }];
  }

  return rawParts.map((p) => {
    const item = p.replace(/^(\d+\.|\*|\-)\s*/, "").trim();
    const boldMatch = item.match(/^\*\*([^*]+)\*\*[:\s]*(.*)$/);
    if (boldMatch) {
      return { title: boldMatch[1].replace(/:$/, "").trim(), body: boldMatch[2].trim() };
    }
    return { body: item.replace(/\*\*/g, "").trim() };
  });
};

interface BuddyDayBriefingCardProps {
  briefing: BuddyDayBriefing;
  cityName?: string;
  places?: string[];
  dayDate?: Date;
  dayIndex?: number;
  onActionClick?: (alert: BuddyAlert) => void;
  onLiveTransitLoaded?: (status: LiveTransitStatus | null) => void;
}

export const BuddyDayBriefingCard: React.FC<BuddyDayBriefingCardProps> = ({
  briefing,
  cityName,
  places,
  dayDate,
  dayIndex,
  onActionClick,
  onLiveTransitLoaded,
}) => {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [liveTransit, setLiveTransit] = useState<LiveTransitStatus | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  const isTh = language === "th";

  const isDateToday = useMemo(() => {
    if (!dayDate) return true;
    const now = new Date();
    return (
      dayDate.getFullYear() === now.getFullYear() &&
      dayDate.getMonth() === now.getMonth() &&
      dayDate.getDate() === now.getDate()
    );
  }, [dayDate]);

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
  const dateStr = dayDate ? dayDate.toISOString().split("T")[0] : "";

  useEffect(() => {
    let isMounted = true;
    const targetCity = cityName?.trim();
    if (!targetCity && (!places || places.length === 0)) return;

    setIsLoadingLive(true);
    fetchLiveBuddyInsights(targetCity || "", places || [], dayDate)
      .then((status) => {
        if (isMounted) {
          setLiveTransit(status);
          onLiveTransitLoaded?.(status);
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
  }, [cityName, placesKey, dateStr]);

  const mascotUrl = getPixoMascotUrl(dominantPose);

  // Section existence flags
  const hasTransitAlert = Boolean(liveTransit && liveTransit.hasDisruption);
  const hasAttractionAlert = Boolean(
    liveTransit?.attractionAlerts &&
    liveTransit.attractionAlerts.some((a) => a.status === "closed" || a.status === "restricted" || a.status === "crowded")
  );
  const hasEventsAlert = Boolean(liveTransit?.specialEvents && liveTransit.specialEvents.length > 0);
  const hasRulesAlert = Boolean(liveTransit?.localTipsAndRules && cleanTextNoise(liveTransit.localTipsAndRules).length > 0);
  const hasAnyAlertSection = hasTransitAlert || hasAttractionAlert || hasEventsAlert || hasRulesAlert;

  // Status Indicator Level: 'critical' (red) | 'warning' (amber) | 'info' (sky/indigo) | 'normal' (emerald)
  const statusLevel = useMemo(() => {
    if (hasTransitAlert && liveTransit?.noticeType !== "scheduled_maintenance") return "critical";
    if (hasTransitAlert || hasAttractionAlert || dressCodeWarning) return "warning";
    if (hasEventsAlert || weatherSummary?.toLowerCase().includes("ฝน") || weatherSummary?.toLowerCase().includes("rain")) return "info";
    return "normal";
  }, [hasTransitAlert, hasAttractionAlert, dressCodeWarning, hasEventsAlert, weatherSummary, liveTransit]);

  const statusDotClass = {
    critical: "bg-rose-500 animate-pulse",
    warning: "bg-amber-500",
    info: "bg-sky-500",
    normal: "bg-emerald-500",
  }[statusLevel];

  // Synthesized Smart One-Liner (Deduplicated single summary line)
  const smartHeadline = useMemo(() => {
    // 1. If transit disruption, prioritize transit notice
    if (hasTransitAlert && liveTransit?.summary) {
      const isSched = liveTransit.noticeType === "scheduled_maintenance";
      return isSched
        ? `${isTh ? "แจ้งเตือนล่วงหน้า" : "Notice"}: ${cleanTextNoise(liveTransit.summary)}`
        : `${isTh ? "เหตุขัดข้องสด" : "Alert"}: ${cleanTextNoise(liveTransit.summary)}`;
    }
    // 2. If special event + weather
    if (hasEventsAlert && liveTransit?.specialEvents && liveTransit.specialEvents[0]) {
      const evtName = liveTransit.specialEvents[0].eventName;
      if (weatherSummary && (weatherSummary.includes("ฝน") || weatherSummary.toLowerCase().includes("rain"))) {
        return `${weatherSummary} • ${evtName}`;
      }
      return `${evtName} • ${isTh ? "การเดินทางคล่องตัว" : "Smooth Transit"}`;
    }
    // 3. If rain / weather notice
    if (weatherSummary && (weatherSummary.includes("ฝน") || weatherSummary.toLowerCase().includes("rain"))) {
      if (dressCodeWarning) return `${weatherSummary} • ${isTh ? "แต่งกายสุภาพ (วัด/วัง)" : "Modest Dress"}`;
      return `${weatherSummary} • ${trafficSummary || (isTh ? "สัญจรตามแผน" : "Normal traffic")}`;
    }
    // 4. If dress code warning
    if (dressCodeWarning) {
      return `${isTh ? "เข้าชมวัด/สถานที่สำคัญ: แต่งกายสุภาพ" : "Modest Dress Code for Temple/Palace"} • ${isTh ? "สภาพอากาศราบรื่น" : "Fair Weather"}`;
    }
    // 5. Default healthy day
    if (trafficSummary) {
      return `${trafficSummary} • ${weatherSummary || (isTh ? "พร้อมเที่ยวตามแผน" : "Ready to explore")}`;
    }
    return isTh ? "การเดินทางราบรื่น • พิกโซ่พร้อมดูแลทริปของคุณ!" : "Smooth travels • Pixo is ready for your trip!";
  }, [hasTransitAlert, liveTransit, hasEventsAlert, weatherSummary, dressCodeWarning, trafficSummary, isTh]);

  // Deduplicated Compact Pills (Max 3 items, strictly preventing duplicate meanings)
  const compactPills = useMemo(() => {
    const list: Array<{ id: string; icon: string; label: string; isAlert?: boolean }> = [];

    // 1. Transit Status Pill (Choose ONE: Disruption OR Rush Hour OR Normal)
    if (hasTransitAlert && liveTransit) {
      const isSched = liveTransit.noticeType === "scheduled_maintenance";
      list.push({
        id: "transit",
        icon: isSched ? "🛠️" : "🚨",
        label: isSched ? (isTh ? "ซ่อมบำรุงล่วงหน้า" : "Maintenance") : (isTh ? "ขนส่งมีเหตุขัดข้อง" : "Transit Alert"),
        isAlert: true,
      });
    } else if (trafficSummary && (trafficSummary.includes("ชั่วโมงเร่งด่วน") || trafficSummary.toLowerCase().includes("peak") || trafficSummary.toLowerCase().includes("rush"))) {
      list.push({
        id: "transit",
        icon: "🚗",
        label: isTh ? "ชั่วโมงเร่งด่วน" : "Rush Hour",
      });
    } else {
      list.push({
        id: "transit",
        icon: "🟢",
        label: isTh ? "เดินทางสะดวก" : "Smooth Transit",
      });
    }

    // 2. Weather Pill (Only if noteworthy rain or high sun)
    if (weatherSummary) {
      const isRain = weatherSummary.includes("ฝน") || weatherSummary.toLowerCase().includes("rain");
      if (isRain) {
        list.push({
          id: "weather",
          icon: "🌧️",
          label: isTh ? "พกร่มพับ" : "Carry Umbrella",
        });
      }
    }

    // 3. Highlight Pill: Dress Code OR Attraction Notice OR Special Event (Pick highest priority)
    if (dressCodeWarning) {
      list.push({
        id: "dress",
        icon: "👗",
        label: isTh ? "แต่งกายสุภาพ" : "Modest Dress",
      });
    } else if (hasAttractionAlert && liveTransit?.attractionAlerts) {
      const closed = liveTransit.attractionAlerts.find((a) => a.status === "closed" || a.status === "restricted");
      if (closed) {
        list.push({
          id: "attraction",
          icon: "🏛️",
          label: `${closed.placeName.split(" ")[0]} (${isTh ? "ปิดชั่วคราว" : "Notice"})`,
          isAlert: true,
        });
      }
    } else if (hasEventsAlert && liveTransit?.specialEvents && liveTransit.specialEvents[0]) {
      const evt = liveTransit.specialEvents[0];
      list.push({
        id: "event",
        icon: "🏮",
        label: evt.eventName.length > 18 ? `${evt.eventName.slice(0, 16)}...` : evt.eventName,
      });
    }

    // Return max 3 pills to keep the strip strictly single-row
    return list.slice(0, 3);
  }, [hasTransitAlert, liveTransit, trafficSummary, weatherSummary, dressCodeWarning, hasAttractionAlert, hasEventsAlert, isTh]);

  const alertCount = allAlerts.length;

  return (
    <>
      {/* ============================================================ */}
      {/* 🌟 Compact Smart Strip (Default Minimalist Card View: ~70px) */}
      {/* ============================================================ */}
      <div className="group rounded-2xl border border-border/70 bg-card/85 dark:bg-card/70 backdrop-blur-md p-2.5 sm:p-3 mb-3 shadow-2xs hover:border-border transition-all duration-200 overflow-hidden w-full pdf-hidden">
        <div className="flex items-center gap-2.5">
          {/* Left: Mascot Avatar with Live Status Dot */}
          <div className="relative shrink-0">
            <div className="size-10 rounded-xl overflow-hidden ring-1 ring-border/80 bg-muted flex items-center justify-center shadow-2xs">
              <img
                src={mascotUrl}
                alt="Pixo"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/pixo_carton/pixo_tip.jpg";
                }}
              />
            </div>
            {/* Status dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background ${statusDotClass}`}
              title={statusLevel}
            />
          </div>

          {/* Middle: Title & Synthesized One-Liner + 2-3 Clean Pills */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-bold text-foreground shrink-0">
                Pixo Buddy
              </span>
              <span className="text-muted-foreground/40 text-[10px]">•</span>
              <p
                className="text-[11px] text-muted-foreground font-medium truncate flex-1 min-w-0"
                title={smartHeadline}
              >
                {smartHeadline}
              </p>
            </div>

            {/* Clean, Muted Pill Tags (Single row, deduplicated) */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {compactPills.map((pill) => (
                <span
                  key={pill.id}
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer select-none ${
                    pill.isAlert
                      ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30 hover:bg-amber-500/20"
                      : "bg-muted/60 text-muted-foreground border-border/40 hover:bg-muted"
                  }`}
                >
                  <span className="shrink-0 text-[10px]">{pill.icon}</span>
                  <span className="truncate max-w-[130px]">{pill.label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Right: Expand/Collapse & Modal Trigger */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-7 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded-lg flex items-center gap-1 hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <span>{isExpanded ? (isTh ? "ย่อ" : "Hide") : (isTh ? "ดูสรุป" : "Tips")}</span>
              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsDialogOpen(true)}
              className="size-7 text-muted-foreground/70 hover:text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              title={isTh ? "ดูสรุปแบบเต็มตา" : "Full briefing"}
            >
              <Maximize2 className="size-3" />
            </Button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 📋 Inline Unified Minimalist View (Smooth, Single Neutral Box) */}
        {/* ============================================================ */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-border/50 text-xs space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Friendly Greeting Message */}
            <p className="text-[11px] text-foreground font-medium leading-relaxed">
              {greeting}
            </p>

            {/* Unified Information List - No nested colored boxes */}
            <div className="rounded-xl bg-muted/30 border border-border/40 divide-y divide-border/30 overflow-hidden text-[11px]">
              {/* 1. Transit & Commute */}
              {(hasTransitAlert || trafficSummary) && (
                <div className="p-2 sm:p-2.5 flex items-start gap-2.5">
                  <span className="shrink-0 text-sm mt-0.5">
                    {hasTransitAlert ? (liveTransit?.noticeType === "scheduled_maintenance" ? "🛠️" : "🚨") : "🚗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {isTh ? "การเดินทางและระบบขนส่ง" : "Transit & Traffic"}
                      </span>
                      {hasTransitAlert && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-3.5 border-amber-500/40 text-amber-800 dark:text-amber-200 font-semibold"
                        >
                          {liveTransit?.noticeType === "scheduled_maintenance"
                            ? (isTh ? "แจ้งเตือนล่วงหน้า" : "Notice")
                            : (isTh ? "เหตุสดวันนี้" : "Live Alert")}
                        </Badge>
                      )}
                    </div>
                    {liveTransit?.summary && (
                      <p className="text-muted-foreground mt-0.5 leading-relaxed">
                        {cleanTextNoise(liveTransit.summary)}
                      </p>
                    )}
                    {!hasTransitAlert && trafficSummary && (
                      <p className="text-muted-foreground mt-0.5 leading-relaxed">
                        {trafficSummary}
                      </p>
                    )}
                    {liveTransit?.disruptions && liveTransit.disruptions.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {liveTransit.disruptions.map((d, i) => (
                          <div key={i} className="text-[10px] text-foreground/80">
                            <span className="font-medium text-foreground mr-1">🚆 {d.line}:</span>
                            <span>{cleanTextNoise(d.detail)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Weather & Preparedness */}
              {weatherSummary && (
                <div className="p-2 sm:p-2.5 flex items-start gap-2.5">
                  <span className="shrink-0 text-sm mt-0.5">🌦️</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">
                      {isTh ? "สภาพอากาศ" : "Weather Advisory"}
                    </span>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      {weatherSummary}
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Special Events & Festivals */}
              {hasEventsAlert && liveTransit?.specialEvents && (
                <div className="p-2 sm:p-2.5 flex items-start gap-2.5">
                  <span className="shrink-0 text-sm mt-0.5">🏮</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {isTh ? "เทศกาลและกิจกรรมในพื้นที่" : "Local Events & Festivals"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-3.5 border-purple-500/40 text-purple-700 dark:text-purple-300 font-semibold"
                      >
                        {isDateToday ? (isTh ? "วันนี้" : "Today") : (isTh ? "กิจกรรม" : "Event")}
                      </Badge>
                    </div>
                    {liveTransit.specialEvents.map((evt, idx) => (
                      <div key={idx} className="mt-0.5">
                        <span className="font-medium text-foreground">{evt.eventName}</span>
                        {evt.highlight && (
                          <span className="text-muted-foreground ml-1">— {cleanTextNoise(evt.highlight)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Attractions Status Notice */}
              {hasAttractionAlert && liveTransit?.attractionAlerts && (
                <div className="p-2 sm:p-2.5 flex items-start gap-2.5">
                  <span className="shrink-0 text-sm mt-0.5">🏛️</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">
                      {isTh ? "สถานะสถานที่ในทริป" : "Attractions Status"}
                    </span>
                    <div className="mt-0.5 space-y-1">
                      {liveTransit.attractionAlerts
                        .filter((a) => a.status === "closed" || a.status === "restricted" || a.status === "crowded")
                        .map((attr, idx) => (
                          <div key={idx} className="text-muted-foreground">
                            <span className="font-medium text-foreground mr-1">📍 {attr.placeName}:</span>
                            <span>{cleanTextNoise(attr.note) || attr.status}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Rules & Dress Code */}
              {(dressCodeWarning || (hasRulesAlert && liveTransit?.localTipsAndRules)) && (
                <div className="p-2 sm:p-2.5 flex items-start gap-2.5">
                  <span className="shrink-0 text-sm mt-0.5">🛡️</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">
                      {isTh ? "ข้อควรรู้และคำแนะนำ" : "Local Rules & Tips"}
                    </span>
                    {dressCodeWarning && (
                      <p className="text-muted-foreground mt-0.5 leading-relaxed">
                        👗 {dressCodeWarning}
                      </p>
                    )}
                    {hasRulesAlert && liveTransit?.localTipsAndRules && (
                      <div className="mt-1 space-y-1">
                        {parseFormattedTips(liveTransit.localTipsAndRules).map((tip, idx) => (
                          <div key={idx} className="text-muted-foreground">
                            <span className="font-medium text-foreground mr-1">• {tip.title ? `${tip.title}:` : ""}</span>
                            <span>{tip.body}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Live Sources */}
              {liveTransit?.sources && liveTransit.sources.length > 0 && (
                <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2 flex-wrap bg-muted/20">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Radio className="size-3 text-primary animate-pulse" />
                    <span>{isTh ? "ข้อมูลสด:" : "Live Web:"}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {liveTransit.sources.slice(0, 3).map((src, idx) => (
                      <a
                        key={idx}
                        href={src.startsWith("http") ? src : `https://google.com/search?q=${encodeURIComponent(src)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-background border border-border/50 text-muted-foreground hover:text-primary transition-colors max-w-[120px] truncate"
                      >
                        <ExternalLink className="size-2 shrink-0" />
                        <span className="truncate">{src.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Recommendations from Local Briefing */}
            {allAlerts.length > 0 && (
              <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {isTh ? `มีข้อแนะนำทั้งหมด ${allAlerts.length} รายการ` : `${allAlerts.length} tips available`}
                </span>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(true)}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{isTh ? "เปิดดูแบบเต็มตา" : "Open Full View"}</span>
                  <ArrowRight className="size-2.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 📖 Full Detail Dialog / Modal (Spacious, Clean Typography)    */}
      {/* ============================================================ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl overflow-hidden ring-1 ring-border bg-muted shrink-0">
                <img
                  src={mascotUrl}
                  alt="Pixo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/pixo_carton/pixo_tip.jpg";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Pixo Daily Briefing</span>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {isTh ? `วันที่ ${briefing.dayNumber}` : `Day ${briefing.dayNumber}`}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {dayDate ? dayDate.toLocaleDateString(isTh ? "th-TH" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : cityName || "Travel Itinerary"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Dialog Body Content */}
          <div className="space-y-3 pt-2 text-xs">
            {/* Friendly Greeting Quote */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-foreground font-medium leading-relaxed">
              💬 {greeting}
            </div>

            {/* 1. Transit Section */}
            {(hasTransitAlert || trafficSummary) && (
              <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <span>{hasTransitAlert ? "🚨" : "🚗"}</span>
                    <span>{isTh ? "ระบบขนส่งและการสัญจร" : "Transit & Commute"}</span>
                  </span>
                  {hasTransitAlert && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300">
                      {liveTransit?.noticeType === "scheduled_maintenance"
                        ? (isTh ? "แจ้งเตือนกำหนดการล่วงหน้า" : "Scheduled Notice")
                        : (isTh ? "รายงานสดวันนี้" : "Live Alert")}
                    </Badge>
                  )}
                </div>
                {liveTransit?.summary && (
                  <p className="text-muted-foreground leading-relaxed">
                    {cleanTextNoise(liveTransit.summary)}
                  </p>
                )}
                {!hasTransitAlert && trafficSummary && (
                  <p className="text-muted-foreground leading-relaxed">{trafficSummary}</p>
                )}
                {liveTransit?.disruptions && liveTransit.disruptions.length > 0 && (
                  <div className="pt-1 space-y-1">
                    {liveTransit.disruptions.map((d, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/50 text-[11px]">
                        <span className="font-semibold text-foreground mr-1">🚆 {d.line}:</span>
                        <span className="text-muted-foreground">{cleanTextNoise(d.detail)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {liveTransit?.adviceForTravelers && (
                  <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-foreground">
                    <span className="font-medium mr-1">💡 คำแนะนำ:</span>
                    <span>{cleanTextNoise(liveTransit.adviceForTravelers)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. Weather Section */}
            {weatherSummary && (
              <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span>🌦️</span>
                  <span>{isTh ? "สภาพอากาศประจำวัน" : "Weather Conditions"}</span>
                </span>
                <p className="text-muted-foreground leading-relaxed">{weatherSummary}</p>
              </div>
            )}

            {/* 3. Special Events Section */}
            {hasEventsAlert && liveTransit?.specialEvents && (
              <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <span>🏮</span>
                    <span>{isTh ? "เทศกาลและกิจกรรมพิเศษ" : "Festivals & Events"}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-700 dark:text-purple-300">
                    {isDateToday ? (isTh ? "จัดขึ้นวันนี้" : "Today") : (isTh ? "ตามกำหนดการ" : "Scheduled")}
                  </Badge>
                </div>
                {liveTransit.specialEvents.map((evt, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-muted/40 text-[11px]">
                    <div className="font-semibold text-foreground">✨ {evt.eventName}</div>
                    {evt.location && <div className="text-muted-foreground text-[10px] mt-0.5">📍 {cleanTextNoise(evt.location)}</div>}
                    {evt.highlight && <div className="text-muted-foreground mt-0.5 leading-relaxed">{cleanTextNoise(evt.highlight)}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 4. Local Rules & Dress Code */}
            {(dressCodeWarning || (hasRulesAlert && liveTransit?.localTipsAndRules)) && (
              <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1.5">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span>🛡️</span>
                  <span>{isTh ? "คำแนะนำการปฏิบัติตัว & ความปลอดภัย" : "Local Rules & Etiquette"}</span>
                </span>
                {dressCodeWarning && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                    👗 {dressCodeWarning}
                  </div>
                )}
                {hasRulesAlert && liveTransit?.localTipsAndRules && (
                  <div className="space-y-1">
                    {parseFormattedTips(liveTransit.localTipsAndRules).map((tip, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-muted/40 text-[11px]">
                        {tip.title && <div className="font-semibold text-foreground mb-0.5">{tip.title}</div>}
                        <div className="text-muted-foreground leading-relaxed">{tip.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. Live Sources Verified */}
            {liveTransit?.sources && liveTransit.sources.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5">
                <div className="font-semibold text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Radio className="size-3 text-primary animate-pulse" />
                  <span>{isTh ? "แหล่งข่าวสารสดที่ระบบตรวจสอบ (Verified Live Sources):" : "Verified Sources:"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {liveTransit.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.startsWith("http") ? src : `https://google.com/search?q=${encodeURIComponent(src)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-primary hover:underline max-w-[220px] truncate"
                    >
                      <ExternalLink className="size-2.5 shrink-0" />
                      <span className="truncate">{src.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BuddyDayBriefingCard;

