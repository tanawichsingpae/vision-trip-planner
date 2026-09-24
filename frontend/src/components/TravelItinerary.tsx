import { useState, useEffect, useRef, useMemo } from "react";
import { Calendar, Clock, Trash2, Plus, Edit2, Check, MapPin, GripVertical, RefreshCw, Phone, Globe, Car, Sparkles, Search, Loader2, Camera, ChevronDown, Navigation, AlertTriangle, AlertCircle } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { fetchWikimediaPhoto } from "@/api/geocode";
import { getCuratedFallbackPhoto } from "@/services/photoService";
import { getFallbackOpeningHours } from "@/api/places";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChangePhotoModal } from "@/components/ChangePhotoModal";

import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { useDistanceMatrix } from "@/hooks/useDistanceMatrix";
import { type ForecastHour } from "@/services/environmentService";
import { type ItineraryCoherence } from "@/api/spatialPlanner";
import { useLanguage } from "@/context/LanguageContext";
import { translateTextSync, translateTextAsync, batchTranslateWithAI, hasThaiScript, extractBilingualText } from "@/services/translatorService";
import { BuddyDayBriefingCard } from "@/components/BuddyDayBriefingCard";
import { BuddyDynamicRerouteBanner } from "@/components/BuddyDynamicRerouteBanner";
import { BuddyActivityBadge } from "@/components/BuddyActivityBadge";
import {
  evaluateDayBuddyAlerts,
  type BuddyAlert,
  evaluateSmartReroute,
  type SmartRerouteProposal,
  type SmartRerouteAlternative,
  type LiveTransitStatus,
} from "@/services/buddyService";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface Activity {
  id: string;
  time: string;
  title: string;
  description: string;
  type: "culture" | "food" | "nature" | "adventure" | "activity" | "shopping" | "nightlife" | "relax" | "rest" | "landmark" | "photo" | "entertainment" | "spiritual" | "hotel" | "transport" | "attraction";
  image?: string;
  image_url?: string | null;
  photo_url?: string | null;
  isUserPhoto?: boolean;
  english_name?: string;
  title_th?: string;
  title_en?: string;
  description_th?: string;
  description_en?: string;
  wiki_title?: string;
  image_keyword?: string;
  lat?: number;
  lng?: number;
  rating?: number | null;
  userRatingsTotal?: number | null;
  openNow?: boolean | null;
  openingHours?: string[] | null;
  priceLevel?: number | null;
  website?: string | null;
  phoneNumber?: string | null;
}

export interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
}

interface TravelItineraryProps {
  itinerary: DayPlan[];
  onUpdate: (itinerary: DayPlan[]) => void;
  onSelectActivity?: (activity: Activity) => void;
  selectedActivityId?: string | null;
  onHoverActivity?: (id: string | null) => void;
  activeDragId?: string | null;
  onReloadMap?: () => void;
  suggestions?: SuggestedPlace[];
  tripStartDate?: Date;
  hourlyWeather?: ForecastHour[]; // Hourly forecast for per-activity weather
  coherenceResult?: ItineraryCoherence | null;
  onAIRefine?: () => void;
  isAIRefining?: boolean;
  onOptimizeDay?: (dayIndex: number) => void;
  isOptimizingDay?: number | null;
  cityName?: string;
  onSwapActivities?: (dayIndex: number, idxA: number, idxB: number) => void;
  onSubstituteActivity?: (dayIndex: number, actIndex: number, alternative: SmartRerouteAlternative) => void;
}


export const typeConfig: Record<string, { label: string; color: string }> = {
  culture: { label: "Culture", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/50" },
  food: { label: "Food", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50" },
  nature: { label: "Nature", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50" },
  adventure: { label: "Adventure", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/50" },
  activity: { label: "Adventure", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/50" },
  shopping: { label: "Shopping", color: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800/50" },
  nightlife: { label: "Nightlife", color: "bg-slate-800 text-amber-400 dark:bg-slate-900 dark:text-amber-300 border-amber-400/30" },
  relax: { label: "Relax", color: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/50" },
  rest: { label: "Relax", color: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/50" },
  landmark: { label: "📸 Landmark & Photo", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50 font-medium" },
  photo: { label: "📸 Landmark & Photo", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50 font-medium" },
  entertainment: { label: "🎪 Entertainment", color: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-800/50 font-medium" },
  spiritual: { label: "🔮 Spiritual & Mutelu", color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/50 font-medium" },
  hotel: { label: "🏨 Accommodation", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800/50 font-semibold" },
  transport: { label: "Transport", color: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/50" },
  attraction: { label: "Attraction", color: "bg-primary/15 text-primary border-primary/20" },
};



export const DAY_COLORS = [
  '#10b981', // Day 1
  '#3b82f6', // Day 2
  '#f59e0b', // Day 3
  '#ef4444', // Day 4
  '#8b5cf6', // Day 5
  '#06b6d4', // Day 6
  '#f43f5e', // Day 7
  '#14b8a6', // Day 8
  '#84cc16', // Day 9
  '#eab308', // Day 10
  '#f97316', // Day 11
  '#d946ef', // Day 12
  '#0ea5e9', // Day 13
  '#ec4899', // Day 14
  '#a855f7'  // Day 15
];

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop",
  culture: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=600&fit=crop",
  nature: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
  adventure: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&h=600&fit=crop",
  activity: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&h=600&fit=crop",
  shopping: "https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=800&h=600&fit=crop",
  nightlife: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop",
  relax: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&h=600&fit=crop",
  rest: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&h=600&fit=crop",
  landmark: "https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=800&h=600&fit=crop",
  photo: "https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=800&h=600&fit=crop",
  entertainment: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&h=600&fit=crop",
  spiritual: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&h=600&fit=crop",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop",
  transport: "https://images.unsplash.com/photo-1436491865332-7a61a109db56?w=800&h=600&fit=crop",
  attraction: "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&h=600&fit=crop",
};

export const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&h=400&fit=crop";

export function getActivityImage(activity: Activity, cityName?: string): string {
  if (
    activity.photo_url &&
    typeof activity.photo_url === "string" &&
    activity.photo_url.trim().length > 0 &&
    !activity.photo_url.includes("undefined") &&
    !activity.photo_url.includes("picsum")
  ) {
    return activity.photo_url;
  }
  if (
    activity.image_url &&
    typeof activity.image_url === "string" &&
    activity.image_url.trim().length > 0 &&
    !activity.image_url.includes("undefined") &&
    !activity.image_url.includes("picsum")
  ) {
    return activity.image_url;
  }
  if (
    activity.image &&
    typeof activity.image === "string" &&
    activity.image.trim().length > 0 &&
    !activity.image.includes("undefined") &&
    !activity.image.includes("picsum")
  ) {
    return activity.image;
  }
  return getCuratedFallbackPhoto(activity.type, activity.image_keyword || activity.english_name || activity.title, { cityName });
}


// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
export function weatherEmoji(raw?: string): string {
  if (!raw) return "🌤️";
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
// Distance Connector
// ─────────────────────────────────────────
interface TravelConnectorProps {
  durationText: string;
  distanceText: string;
  status: "loading" | "ok" | "error";
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  originName?: string;
  destName?: string;
}

const TravelConnector = ({
  durationText,
  distanceText,
  status,
  originLat,
  originLng,
  destLat,
  destLng,
}: TravelConnectorProps) => {
  const { language } = useLanguage();
  if (status === "error") return null;

  const isTh = language === "th";

  // Parse duration in minutes to identify traffic congestion level
  let durationMins = 0;
  if (durationText) {
    const hourMatch = durationText.match(/(\d+)\s*h/i);
    const minMatch = durationText.match(/(\d+)\s*min/i);
    if (hourMatch) durationMins += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) durationMins += parseInt(minMatch[1], 10);
  }

  // Traffic severity levels
  const isSevereCongestion = durationMins >= 35;
  const isModerateCongestion = durationMins >= 20 && durationMins < 35;

  const mapsUrl = originLat && originLng && destLat && destLng
    ? `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`
    : "#";

  return (
    <div className="flex flex-col items-center gap-1 py-1 px-2 my-1">
      <div className="flex items-center gap-2 w-full min-w-[100px]">
        <div className="h-px flex-1 border-t-2 border-dashed border-border/60" />
        {mapsUrl !== "#" ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border shrink-0 transition-colors ${
              isSevereCongestion
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/20"
                : isModerateCongestion
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
                : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 border-border/50"
            }`}
            title={isTh ? "เปิดดูเส้นทางบน Google Maps" : "View route on Google Maps"}
          >
            {status === "loading" ? (
              <span className="animate-pulse">📍 ...</span>
            ) : (
              <>
                <MapPin className="w-3 h-3" />
                {durationText && <span className={isSevereCongestion || isModerateCongestion ? "font-semibold" : ""}>{durationText}</span>}
                {durationText && distanceText && <span className="text-border">·</span>}
                {distanceText && <span className="opacity-80">{distanceText}</span>}
              </>
            )}
          </a>
        ) : (
          <div
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border shrink-0 ${
              isSevereCongestion
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40"
                : isModerateCongestion
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40"
                : "bg-muted/50 text-muted-foreground border-border/50"
            }`}
          >
            {status === "loading" ? (
              <span className="animate-pulse">📍 ...</span>
            ) : (
              <>
                <MapPin className="w-3 h-3" />
                {durationText && <span className={isSevereCongestion || isModerateCongestion ? "font-semibold" : ""}>{durationText}</span>}
                {durationText && distanceText && <span className="text-border">·</span>}
                {distanceText && <span className="opacity-80">{distanceText}</span>}
              </>
            )}
          </div>
        )}
        <div className="h-px flex-1 border-t-2 border-dashed border-border/60" />
      </div>

      {/* Traffic Congestion Warning Badge (Stay & Buffer alert) */}
      {status === "ok" && (isSevereCongestion || isModerateCongestion) && (
        <div
          className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border shadow-2xs animate-in fade-in duration-300 ${
            isSevereCongestion
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
          }`}
        >
          {isSevereCongestion ? (
            <>
              <AlertCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
              <span>
                {isTh ? "รถติดหนัก เผื่อเวลา +30 นาที" : "Severe Delay: allow +30m buffer"}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {isTh ? "การจราจรหนาแน่น เผื่อเวลา ~15-20 นาที" : "Heavy Traffic: allow ~15-20m buffer"}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────
// Sortable Activity Card Component
// ─────────────────────────────────────────
interface SortableCardProps {
  activity: Activity;
  dayIndex: number;
  isSelected: boolean;
  editingId: string | null;
  editValue: string;
  onCardClick: (activity: Activity) => void;
  onStartEdit: (activityId: string, title: string) => void;
  onSaveEdit: (dayIndex: number, activityId: string) => void;
  onUpdateTime: (dayIndex: number, activityId: string, newTime: string) => void;
  onRemove: (dayIndex: number, activityId: string) => void;
  onEditValueChange: (value: string) => void;
  onHover: (id: string | null) => void;
  dayColor: string;
  index: number;
  isDragOverlay?: boolean;
  dayDate?: Date;
  activityWeather?: ForecastHour | null; // weather for this specific hour
  apiKey?: string;
  onChangePhoto?: (dayIndex: number, activity: Activity) => void;
  cityName?: string;
  buddyAlerts?: BuddyAlert[];
}

const SortableCard = ({
  activity,
  dayIndex,
  isSelected,
  editingId,
  editValue,
  onCardClick,
  onStartEdit,
  onSaveEdit,
  onUpdateTime,
  onRemove,
  onHover,
  dayColor,
  index,
  isDragOverlay,
  dayDate,
  activityWeather,
  apiKey,
  onChangePhoto,
  cityName,
  buddyAlerts,
}: SortableCardProps) => {
  const { language, locPlace, locDesc } = useLanguage();
  const displayTitle = locPlace(activity);
  const displayDescription = locDesc(activity);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id, data: { type: "itinerary-card", dayIndex } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = typeConfig[activity.type as keyof typeof typeConfig] ?? typeConfig.attraction;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderColor: isSelected ? dayColor : undefined,
        boxShadow: isSelected ? `0 0 0 2px ${dayColor}` : undefined
      }}
      onClick={() => onCardClick(activity)}
      onMouseEnter={() => onHover(activity.id)}
      onMouseLeave={() => onHover(null)}
      className={`group relative w-full rounded-2xl overflow-hidden bg-card border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer pdf-card-break ${isDragging ? "opacity-30" : ""
        } ${isDragOverlay ? "shadow-2xl scale-[1.01] rotate-0.5" : ""} ${isSelected ? "shadow-lg scale-[1.01]" : "border-border hover:border-primary/30"
        }`}
    >
      <div className="relative h-44 sm:h-48 overflow-hidden pdf-img-compact">
        <img
          src={getActivityImage(activity, cityName)}
          alt={displayTitle || activity.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            const fallback = getCuratedFallbackPhoto(activity.type, activity.title, { cityName });
            if (e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />

        {/* User Photo Badge */}
        {activity.isUserPhoto && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-emerald-600/90 text-white backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-md">
            <Camera className="w-3 h-3" />
            <span>รูปของคุณ</span>
          </div>
        )}

        {/* Change Photo Button */}
        {onChangePhoto && (
          <div className="absolute bottom-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity pdf-hidden">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChangePhoto(dayIndex, activity);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-[11px] font-medium shadow-md transition-all duration-200 hover:scale-105 cursor-pointer"
              title="เปลี่ยนรูปภาพสถานที่นี้"
            >
              <Camera className="w-3 h-3" />
              <span>เปลี่ยนรูป</span>
            </button>
          </div>
        )}

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-foreground shadow-sm">
          <div
            {...attributes}
            {...listeners}
            onPointerDown={(e) => { e.stopPropagation(); listeners?.onPointerDown?.(e as any); }}
            onMouseDown={(e) => { e.stopPropagation(); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing hover:bg-black/5 p-0.5 rounded-full pdf-hidden"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex items-center pdf-hidden" onClick={(e) => e.stopPropagation()}>
            <Select
              value={activity.time || "10:00"}
              onValueChange={(val) => onUpdateTime(dayIndex, activity.id, val)}
            >
              <SelectTrigger className="h-6 px-2 py-0 border-none bg-transparent hover:bg-black/5 rounded shadow-none text-xs font-medium w-auto min-w-[70px] flex items-center justify-between focus:ring-0 focus:ring-offset-0 gap-1 text-foreground group-hover:text-primary transition-colors">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-bold text-xs text-foreground">
                    {activity.time || "10:00"}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="z-[110] max-h-[200px]">
                {Array.from({ length: 24 }).flatMap((_, i) => [
                  `${i.toString().padStart(2, '0')}:00`,
                  `${i.toString().padStart(2, '0')}:15`,
                  `${i.toString().padStart(2, '0')}:30`,
                  `${i.toString().padStart(2, '0')}:45`
                ]).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
                {activity.time && !Array.from({ length: 24 }).flatMap((_, i) => [
                  `${i.toString().padStart(2, '0')}:00`,
                  `${i.toString().padStart(2, '0')}:15`,
                  `${i.toString().padStart(2, '0')}:30`,
                  `${i.toString().padStart(2, '0')}:45`
                ]).includes(activity.time) && (
                    <SelectItem key={activity.time} value={activity.time} className="text-xs font-bold">
                      {activity.time}
                    </SelectItem>
                  )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="absolute top-3 left-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity pdf-hidden">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(dayIndex, activity.id); }}
            className="p-1.5 rounded-full bg-card/90 backdrop-blur-sm hover:bg-destructive/10 shadow-sm"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </button>
        </div>

        {isSelected && (
          <div
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md animate-pulse-soft"
            style={{ backgroundColor: dayColor }}
          >
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        {/* Activity Order Number */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md shadow-lg w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary border border-primary/20 z-10">
          {index + 1}
        </div>
      </div>

      <div className="p-4 relative pb-4">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
            {config.label}
          </Badge>
          {activity.openNow != null && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activity.openNow
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
              }`}>
              {activity.openNow ? "● Open" : "● Closed"}
            </span>
          )}
        </div>

        {editingId === activity.id ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="h-7 text-sm relative z-20"
              onKeyDown={(e) => e.key === "Enter" && onSaveEdit(dayIndex, activity.id)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              autoFocus
            />
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onSaveEdit(dayIndex, activity.id); }}
              className="text-primary shrink-0 relative z-20"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-foreground text-sm sm:text-base leading-snug break-words line-clamp-2">{displayTitle}</h4>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEdit(activity.id, displayTitle); }}
              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 pdf-hidden"
              title={language === "th" ? "แก้ไขชื่อ" : "Edit Title"}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">{displayDescription}</p>

        {/* Rating */}
        {activity.rating != null && activity.rating > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = activity.rating! >= star;
                const half = !filled && activity.rating! >= star - 0.5;
                return (
                  <svg key={star} className="w-3 h-3" viewBox="0 0 20 20">
                    <defs>
                      <linearGradient id={`half-${activity.id}-${star}`}>
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="50%" stopColor="#d1d5db" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                      fill={filled ? "#f59e0b" : half ? `url(#half-${activity.id}-${star})` : "#d1d5db"}
                    />
                  </svg>
                );
              })}
            </div>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {activity.rating.toFixed(1)}
            </span>
            {activity.userRatingsTotal != null && activity.userRatingsTotal > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({activity.userRatingsTotal.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* Opening Hours Badge & 7-Day Schedule */}
        {activity.type !== "transport" && (() => {
          const hoursList = (activity.openingHours && activity.openingHours.length > 0)
            ? activity.openingHours
            : getFallbackOpeningHours(activity.type, activity.title);

          if (!hoursList || hoursList.length === 0) return null;

          const dateToUse = dayDate || new Date();
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const currentDayName = dayNames[dateToUse.getDay()];
          const dayIndexGoogle = (dateToUse.getDay() + 6) % 7;

          const todayEntry = hoursList.find(line => line.toLowerCase().startsWith(currentDayName.toLowerCase()))
            || hoursList[dayIndexGoogle]
            || hoursList[0];

          const colonIndex = todayEntry.indexOf(":");
          const todayHours = colonIndex > -1 ? todayEntry.slice(colonIndex + 1).trim() : todayEntry;
          const isClosedToday = todayHours.toLowerCase().includes("closed") || todayHours.toLowerCase().includes("ปิด");
          const isOpen24Today = todayHours.toLowerCase().includes("open 24") || todayHours.toLowerCase().includes("24 ชั่วโมง") || todayHours.toLowerCase().includes("24 hours");

          const thaiDayMap: Record<string, { th: string; short: string }> = {
            monday: { th: "วันจันทร์", short: "จ." },
            tuesday: { th: "วันอังคาร", short: "อ." },
            wednesday: { th: "วันพุธ", short: "พ." },
            thursday: { th: "วันพฤหัสบดี", short: "พฤ." },
            friday: { th: "วันศุกร์", short: "ศ." },
            saturday: { th: "วันเสาร์", short: "ส." },
            sunday: { th: "วันอาทิตย์", short: "อา." },
          };

          return (
            <div className="mt-2">
              <div className="pdf-hidden">
                <details
                  className="group cursor-pointer relative z-20 text-[11px]"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <summary className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors list-none outline-none select-none">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${isClosedToday
                          ? "bg-rose-500"
                          : isOpen24Today
                            ? "bg-blue-500"
                            : "bg-emerald-500 animate-pulse"
                          }`}
                      />
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">
                        <span className="text-muted-foreground mr-1">เวลาเปิด-ปิด:</span>
                        {isClosedToday ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">ปิดทำการวันนี้</span>
                        ) : isOpen24Today ? (
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">เปิด 24 ชม.</span>
                        ) : (
                          <span className="font-semibold text-foreground">{todayHours}</span>
                        )}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-open:rotate-180 transition-transform duration-200" />
                  </summary>

                  <div className="mt-1.5 p-2.5 bg-card/95 rounded-lg border border-border/60 shadow-sm text-[11px] space-y-1.5 backdrop-blur-sm">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/40 pb-1">
                      <span>ตารางเวลาเปิด-ปิด (7 วัน)</span>
                      <span className="text-[9px] font-normal text-muted-foreground/80">เวลาท้องถิ่น</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {hoursList.map((hoursLine, idx) => {
                        const cIdx = hoursLine.indexOf(":");
                        const rawDay = cIdx > -1 ? hoursLine.slice(0, cIdx).trim() : "";
                        const rawTime = cIdx > -1 ? hoursLine.slice(cIdx + 1).trim() : hoursLine;
                        const dayKey = rawDay.toLowerCase();
                        const thaiInfo = thaiDayMap[dayKey];
                        const isThisToday = rawDay.toLowerCase() === currentDayName.toLowerCase() || (idx === dayIndexGoogle && !thaiInfo);
                        const isClosedLine = rawTime.toLowerCase().includes("closed") || rawTime.toLowerCase().includes("ปิด");
                        const isOpen24Line = rawTime.toLowerCase().includes("open 24") || rawTime.toLowerCase().includes("24 ชั่วโมง") || rawTime.toLowerCase().includes("24 hours");

                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between px-2 py-0.5 rounded transition-colors ${isThisToday
                              ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                              : "text-muted-foreground hover:bg-muted/30"
                              }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {isThisToday && (
                                <span className="text-[9px] px-1 py-0.2 bg-primary text-primary-foreground rounded-sm font-bold">
                                  วันนี้
                                </span>
                              )}
                              <span>{thaiInfo ? `${thaiInfo.th} (${rawDay.slice(0, 3)})` : rawDay || `Day ${idx + 1}`}</span>
                            </span>
                            <span className={isClosedLine ? "text-rose-500 font-medium" : isOpen24Line ? "text-blue-500 font-medium" : "text-foreground/90 font-medium"}>
                              {isClosedLine ? "ปิดทำการ" : isOpen24Line ? "เปิด 24 ชั่วโมง" : rawTime}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              </div>

              {/* Print / PDF view */}
              <div className="hidden pdf-block text-[10px] text-muted-foreground mt-1">
                <span className="font-medium">เวลาเปิด-ปิด: {todayHours}</span>
              </div>
            </div>
          );
        })()}

        {/* Price Level + Contact Info */}
        {(activity.priceLevel != null || activity.phoneNumber || activity.website) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {activity.priceLevel != null && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
                {["Free", "$", "$$", "$$$", "$$$$"][activity.priceLevel] || "$"}
              </span>
            )}
            {activity.phoneNumber && (
              <a
                href={`tel:${activity.phoneNumber}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                title={activity.phoneNumber}
              >
                <Phone className="w-3 h-3" />
                <span className="truncate max-w-[180px]">{activity.phoneNumber}</span>
              </a>
            )}
            {activity.website && (
              <a
                href={activity.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                title="Visit website"
              >
                <Globe className="w-3 h-3" />
                <span>Website</span>
              </a>
            )}
          </div>
        )}

        {/* Per-activity weather and Pix Buddy Alerts */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {activityWeather && (
            <div className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-700 w-fit">
              <span>{weatherEmoji(activityWeather.condition?.description)}</span>
              <span className="font-medium">{activityWeather.tempC}°C</span>
              <span className="text-muted-foreground">{activityWeather.condition?.description}</span>
            </div>
          )}

          {buddyAlerts && buddyAlerts.length > 0 && (
            <BuddyActivityBadge alerts={buddyAlerts} />
          )}
        </div>

        {/* Navigation & Map Action Buttons */}
        <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-col gap-2 pdf-hidden">
          {/* Row 1: Primary Action - Full-width Turn-by-turn Navigation */}
          {activity.lat != null && activity.lng != null && activity.lat !== 0 && activity.lng !== 0 ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold shadow-xs transition-all duration-150"
              title={language === "th" ? "เปิดแอป Google Maps เพื่อเริ่มนำทางแบบ Turn-by-turn ทันที" : "Open Google Maps for turn-by-turn navigation"}
            >
              <Navigation className="w-3.5 h-3.5 fill-white text-white" />
              <span>{language === "th" ? "นำทาง (Google Maps)" : "Directions"}</span>
            </a>
          ) : (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activity.english_name || activity.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold shadow-xs transition-all duration-150"
              title={language === "th" ? "เปิดแอป Google Maps เพื่อเริ่มนำทาง" : "Open Google Maps for directions"}
            >
              <Navigation className="w-3.5 h-3.5 fill-white text-white" />
              <span>{language === "th" ? "นำทาง (Google Maps)" : "Directions"}</span>
            </a>
          )}

          {/* Row 2: Symmetrical 2-Column Grid (Street View & View on Map) */}
          <div className="grid grid-cols-2 gap-2">
            {activity.lat != null && activity.lng != null && activity.lat !== 0 && activity.lng !== 0 ? (
              <a
                href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${activity.lat},${activity.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-all duration-150 hover:border-primary/40 hover:text-primary"
                title={language === "th" ? "เปิดชมภาพจำลอง 360° Street View บน Google Maps ทันที" : "Open 360° Street View on Google Maps"}
              >
                <Car className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                <span>Street View</span>
              </a>
            ) : (
              <a
                href={`https://www.google.com/maps/@?api=1&map_action=pano&query=${encodeURIComponent(activity.english_name || activity.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-all duration-150 hover:border-primary/40 hover:text-primary"
                title={language === "th" ? "เปิดชมภาพจำลอง 360° Street View บน Google Maps ทันที" : "Open 360° Street View on Google Maps"}
              >
                <Car className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                <span>Street View</span>
              </a>
            )}

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.english_name || activity.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-all duration-150 hover:border-primary/40 hover:text-primary"
              title={language === "th" ? "ดูข้อมูลและรีวิวบน Google Maps" : "View reviews on Google Maps"}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span>{language === "th" ? "ดูบนแผนที่" : "View on Map"}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DroppableDayProps {
  dayIndex: number;
  isOver: boolean;
  children: React.ReactNode;
}

const DroppableDay = ({ dayIndex, isOver, children }: DroppableDayProps) => {
  const { setNodeRef } = useDroppable({
    id: `day-${dayIndex}`,
    data: { type: "day", dayIndex },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-4 pb-4 rounded-2xl transition-all duration-200 ${isOver ? "ring-2 ring-primary/50 ring-dashed bg-primary/5 p-2 -m-2" : ""
        }`}
    >
      {children}
    </div>
  );
};

const AddActivityPopover = ({
  dayIndex,
  suggestions = [],
  onAdd,
  dayDate,
  destinationName = "",
}: {
  dayIndex: number;
  suggestions: SuggestedPlace[];
  onAdd: (dayIndex: number, place: SuggestedPlace, time: string) => void;
  dayDate?: Date;
  destinationName?: string;
}) => {
  const { language, locPlace, locDesc } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SuggestedPlace | null>(null);
  const [time, setTime] = useState("12:00");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SuggestedPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const times = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, "0");
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
  });

  // Live place search with Geoapify & OpenStreetMap
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const searchInput =
          destinationName && !query.toLowerCase().includes(destinationName.toLowerCase())
            ? `${query} ${destinationName}`
            : query;

        let mapped: SuggestedPlace[] = [];
        const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
        const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string;

        // 0. Try Mapbox Geocoding Autocomplete (High precision & instant response)
        if (mapboxToken) {
          try {
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
              searchInput
            )}.json?access_token=${mapboxToken}&limit=5`;
            const mRes = await fetch(mapboxUrl);
            if (mRes.ok) {
              const mData = await mRes.json();
              const feats = mData.features || [];
              if (feats.length > 0) {
                mapped = await Promise.all(
                  feats.map(async (feat: any) => {
                    const name = feat.text || feat.place_name?.split(",")?.[0] || query;
                    const coords = feat.center || [0, 0];
                    const photoUrl = await fetchSmartPhoto(name);
                    const nameTh = hasThaiScript(name) ? name : translateTextSync(name, "th");
                    const nameEn = !hasThaiScript(name) ? name : translateTextSync(name, "en");
                    return {
                      id: feat.id || `mb-${Date.now()}-${Math.random()}`,
                      name,
                      name_th: nameTh,
                      name_en: nameEn,
                      title_th: nameTh,
                      title_en: nameEn,
                      description: feat.place_name || "Location",
                      description_th: feat.place_name || "สถานที่",
                      description_en: feat.place_name || "Location",
                      category: "attraction",
                      image: photoUrl || getCuratedFallbackPhoto("attraction", name),
                      image_url: photoUrl || null,
                      photo_url: photoUrl || null,
                      lat: coords[1],
                      lng: coords[0],
                      rating: 4.6,
                      userRatingsTotal: 80,
                    };
                  })
                );
              }
            }
          } catch (mErr) {
            console.warn("Mapbox autocomplete failed:", mErr);
          }
        }

        // 1. Fallback: Geoapify Places Autocomplete
        if (mapped.length === 0 && geoapifyKey) {
          const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            searchInput
          )}&apiKey=${geoapifyKey}&limit=5`;

          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const features = data.features || [];
            mapped = await Promise.all(
              features.map(async (p: any) => {
                const props = p.properties || {};
                const coords = p.geometry?.coordinates || [0, 0];
                const name = props.name || props.address_line1 || query;
                const photoUrl = await fetchWikimediaPhoto(name);
                const nameTh = hasThaiScript(name) ? name : translateTextSync(name, "th");
                const nameEn = !hasThaiScript(name) ? name : translateTextSync(name, "en");
                const desc = props.formatted || props.address_line2 || "Custom searched location";
                return {
                  id: props.place_id || `place-${Date.now()}-${Math.random()}`,
                  name,
                  name_th: nameTh,
                  name_en: nameEn,
                  title_th: nameTh,
                  title_en: nameEn,
                  description: desc,
                  description_th: desc,
                  description_en: desc,
                  category:
                    props.category === "catering" || props.category === "restaurant"
                      ? "food"
                      : "attraction",
                  image: photoUrl || getCuratedFallbackPhoto(props.category === "catering" || props.category === "restaurant" ? "food" : "attraction", name),
                  image_url: photoUrl || null,
                  photo_url: photoUrl || null,
                  lat: coords[1],
                  lng: coords[0],
                  rating: 4.5,
                  userRatingsTotal: 60,
                };
              })
            );
          }
        }

        if (mapped.length === 0) {
          const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            searchInput
          )}&format=json&limit=5`;
          const osmRes = await fetch(osmUrl, {
            headers: { "User-Agent": "PixineraryApp/1.0" },
          });
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            mapped = await Promise.all(
              osmData.map(async (p: any) => {
                const name = p.display_name?.split(",")?.[0] || query;
                const photoUrl = await fetchWikimediaPhoto(name);
                const nameTh = hasThaiScript(name) ? name : translateTextSync(name, "th");
                const nameEn = !hasThaiScript(name) ? name : translateTextSync(name, "en");
                return {
                  id: String(p.place_id),
                  name,
                  name_th: nameTh,
                  name_en: nameEn,
                  title_th: nameTh,
                  title_en: nameEn,
                  description: p.display_name,
                  description_th: p.display_name,
                  description_en: p.display_name,
                  category: "attraction",
                  image: photoUrl || getCuratedFallbackPhoto("attraction", name),
                  image_url: photoUrl || null,
                  photo_url: photoUrl || null,
                  lat: parseFloat(p.lat),
                  lng: parseFloat(p.lon),
                  rating: 4.5,
                  userRatingsTotal: 30,
                };
              })
            );
          }
        }

        setSearchResults(mapped);
        setIsSearching(false);
        setHasSearched(true);
      } catch (err) {
        console.error("Place search error:", err);
        setIsSearching(false);
        setHasSearched(true);
        setSearchResults([]);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, destinationName]);

  const filteredSuggestions = suggestions.filter(place => {
    if (!dayDate) return true;
    if (!place.openingHours || place.openingHours.length === 0) return true;

    const currentDayIndex = (dayDate.getDay() + 6) % 7;
    const todayHoursText = place.openingHours[currentDayIndex]?.toLowerCase() || "";

    if (todayHoursText.includes("closed") || todayHoursText.includes("ปิด")) {
      return false;
    }
    return true;
  });

  const topSuggestions = filteredSuggestions.slice(0, 5);

  const handleReset = () => {
    setSelectedPlace(null);
    setQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) handleReset(); }}>
      <PopoverTrigger asChild>
        <button
          className="w-full py-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">{language === "th" ? "เพิ่มกิจกรรม" : "Add Activity"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 z-[100]" align="center">
        {!selectedPlace ? (
          <div className="space-y-3">
            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder={language === "th" ? "ค้นหาสถานที่ตามชื่อ..." : "Search place by name..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-9 text-xs pr-8"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-primary" />
              )}
            </div>

            {/* If user typed a query -> show search results */}
            {query.trim() ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{language === "th" ? "ผลการค้นหา" : "Search Results"}</h4>
                {isSearching ? (
                  <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    {language === "th" ? "กำลังค้นหาสถานที่..." : "Searching Google Maps..."}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {searchResults.map((place) => (
                      <div
                        key={place.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => setSelectedPlace(place)}
                      >
                        <img
                          src={place.photo_url || place.image_url || place.image || CATEGORY_FALLBACK_IMAGES[place.category?.toLowerCase() || "attraction"] || DEFAULT_IMAGE}
                          alt={place.name}
                          className="w-10 h-10 rounded-md object-cover shrink-0"
                          onError={(e) => { e.currentTarget.src = CATEGORY_FALLBACK_IMAGES[place.category?.toLowerCase() || "attraction"] || DEFAULT_IMAGE; }}
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-semibold truncate">{locPlace(place)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{locDesc(place)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    {language === "th" ? `ไม่พบสถานที่ตรงกับ "${query}"` : `No places found matching "${query}"`}
                  </div>
                ) : null}
              </div>
            ) : (
              /* If query is empty -> show AI Suggestions & Blank Activity button */
              <div className="space-y-2">
                {topSuggestions.length > 0 && (
                  <>
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{language === "th" ? "สถานที่แนะนำโดย AI" : "AI Suggested Places"}</h4>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {topSuggestions.map((place) => (
                        <div
                          key={place.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => setSelectedPlace(place)}
                        >
                          <img
                            src={place.photo_url || place.image_url || place.image || CATEGORY_FALLBACK_IMAGES[place.category?.toLowerCase() || "attraction"] || DEFAULT_IMAGE}
                            alt={place.name}
                            className="w-10 h-10 rounded-md object-cover shrink-0"
                            onError={(e) => { e.currentTarget.src = CATEGORY_FALLBACK_IMAGES[place.category?.toLowerCase() || "attraction"] || DEFAULT_IMAGE; }}
                          />
                          <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-semibold truncate">{locPlace(place)}</p>
                            <p className="text-[10px] text-muted-foreground truncate capitalize">{place.category === "food" ? (language === "th" ? "ร้านอาหาร/คาเฟ่" : "Food") : (language === "th" ? "สถานที่ท่องเที่ยว" : "Attraction")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onAdd(dayIndex, {
                        id: `act-${Date.now()}`,
                        name: language === "th" ? "กิจกรรมใหม่" : "New Activity",
                        name_th: "กิจกรรมใหม่",
                        name_en: "New Activity",
                        description: language === "th" ? "เพิ่มรายละเอียดที่นี่" : "Add details here",
                        description_th: "เพิ่มรายละเอียดที่นี่",
                        description_en: "Add details here",
                        category: "attraction",
                        image: "",
                        lat: 0,
                        lng: 0,
                      }, "12:00");
                      setIsOpen(false);
                      handleReset();
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {language === "th" ? "เพิ่มกิจกรรมใหม่" : "Add Blank Activity"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Time selection view */
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setSelectedPlace(null)} className="text-xs text-muted-foreground hover:text-foreground">
                {language === "th" ? "← ย้อนกลับ" : "← Back"}
              </button>
              <h4 className="font-semibold text-xs text-foreground truncate flex-1">{locPlace(selectedPlace)}</h4>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{language === "th" ? "เลือกเวลา" : "Select Time"}</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="z-[110] max-h-[160px]">
                  {times.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full h-8 text-xs mt-2"
              onClick={() => {
                onAdd(dayIndex, selectedPlace, time);
                setIsOpen(false);
                handleReset();
              }}
            >
              {language === "th" ? "ยืนยันการเพิ่ม" : "Confirm Add"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};


// ─────────────────────────────────────────
// DayColumn — standalone component (must be outside TravelItinerary to prevent remounting)
// ─────────────────────────────────────────
interface DayColumnProps {
  day: DayPlan;
  dayIndex: number;
  tripStartDate?: Date;
  hourlyWeather?: ForecastHour[];
  isDraggingAttraction: boolean;
  selectedId: string | null;
  editingId: string | null;
  editValue: string;
  handleCardClick: (activity: Activity) => void;
  startEdit: (id: string, title: string) => void;
  saveEdit: (dayIndex: number, id: string) => void;
  updateTime: (dayIndex: number, id: string, newTime: string) => void;
  removeActivity: (dayIndex: number, id: string) => void;
  setEditValue: (val: string) => void;
  onHoverActivity?: (id: string | null) => void;
  suggestions: SuggestedPlace[];
  addActivity: (dayIndex: number, place: SuggestedPlace, time: string) => void;
  destinationName?: string;
  cityName?: string;
  onChangePhoto?: (dayIndex: number, activity: Activity) => void;
  onOptimizeDay?: (dayIndex: number) => void;
  isOptimizingDay?: number | null;
  totalDays?: number;
  onSwapActivities?: (idxA: number, idxB: number) => void;
  onSubstituteActivity?: (actIndex: number, alternative: SmartRerouteAlternative) => void;
}

const DayColumn = ({
  day,
  dayIndex,
  tripStartDate,
  hourlyWeather = [],
  isDraggingAttraction,
  selectedId,
  editingId,
  editValue,
  handleCardClick,
  startEdit,
  saveEdit,
  updateTime,
  removeActivity,
  setEditValue,
  onHoverActivity,
  suggestions,
  addActivity,
  destinationName,
  cityName,
  onChangePhoto,
  onOptimizeDay,
  isOptimizingDay,
  totalDays = 1,
  onSwapActivities,
  onSubstituteActivity,
}: DayColumnProps) => {
  const { language } = useLanguage();
  let currentDayDate: Date | undefined;
  if (tripStartDate) {
    currentDayDate = new Date(tripStartDate);
    currentDayDate.setDate(currentDayDate.getDate() + dayIndex);
  }

  // Pixo Travel Buddy Morning Briefing & Alerts
  const buddyBriefing = evaluateDayBuddyAlerts(
    day,
    dayIndex,
    totalDays,
    hourlyWeather,
    tripStartDate,
    cityName || destinationName,
    language
  );

  const coords = day.activities.map(a =>
    a.lat && a.lng ? { lat: a.lat, lng: a.lng } : undefined
  );
  const segments = useDistanceMatrix(coords);
  const [liveTransit, setLiveTransit] = useState<LiveTransitStatus | null>(null);

  const rerouteProposal = useMemo(() => {
    return evaluateSmartReroute(
      day,
      dayIndex,
      segments,
      liveTransit,
      cityName || destinationName,
      language
    );
  }, [day, dayIndex, segments, liveTransit, cityName, destinationName, language]);

  const getActivityWeather = (activity: Activity): ForecastHour | null => {
    if (!hourlyWeather.length || !currentDayDate) return null;
    const [h, m] = (activity.time || "00:00").split(":").map(Number);
    const targetDate = new Date(currentDayDate);
    targetDate.setHours(h, m ?? 0, 0, 0);
    let best: ForecastHour | null = null;
    let bestDiff = Infinity;
    for (const fw of hourlyWeather) {
      const diff = Math.abs(new Date(fw.time).getTime() - targetDate.getTime());
      if (diff < bestDiff) { bestDiff = diff; best = fw; }
    }
    return best && bestDiff <= 2 * 3600 * 1000 ? best : null;
  };

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl p-4 sm:p-5 border border-border/50 h-full flex flex-col pdf-card-shadow overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-2.5 mb-4 pb-3 border-b border-border/40 pdf-day-header">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm sm:text-base shadow-xs shrink-0"
            style={{ backgroundColor: DAY_COLORS[dayIndex % DAY_COLORS.length] }}
          >
            {day.day}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-foreground text-sm sm:text-base leading-snug truncate">
              {language === "th" ? `วันที่ ${day.day}` : `Day ${day.day}`}
            </h3>
            {currentDayDate ? (
              <p className="text-xs text-muted-foreground font-medium truncate">
                {currentDayDate.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            ) : (
              day.date && <p className="text-xs text-muted-foreground truncate">{day.date}</p>
            )}
            {isDraggingAttraction && (
              <p className="text-xs text-primary font-medium mt-0.5 animate-pulse truncate">
                {language === "th" ? "↓ วางลงที่นี่เพื่อเพิ่มกิจกรรม" : "↓ Drop here to add"}
              </p>
            )}
          </div>
        </div>

        {/* Day-level Optimize Button */}
        {onOptimizeDay && (
          <button
            type="button"
            onClick={() => onOptimizeDay(dayIndex)}
            disabled={isOptimizingDay === dayIndex || day.activities.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-background/90 hover:bg-muted text-foreground border border-border/70 shadow-2xs hover:shadow-xs active:scale-95 text-xs font-medium transition-all disabled:opacity-40 cursor-pointer shrink-0 pdf-hidden group"
            title={language === "th" ? `จัดลำดับเส้นทางและเวลาของ Day ${day.day} ให้ราบรื่น (2-Opt & Meal Flow)` : `Optimize Day ${day.day} route & timing`}
          >
            {isOptimizingDay === dayIndex ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-[11px] text-primary">{language === "th" ? "กำลังจัด..." : "Optimizing..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline text-[11px]">{language === "th" ? "จัดลำดับวัน" : "Optimize"}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Pixo Travel Buddy Day Briefing Card with Live Transit & Safety Monitoring */}
      <BuddyDayBriefingCard
        briefing={buddyBriefing}
        cityName={cityName || destinationName}
        places={day.activities.map(a => a.title).filter(Boolean)}
        dayDate={currentDayDate}
        dayIndex={dayIndex}
        onLiveTransitLoaded={setLiveTransit}
      />

      {/* Pixo Real-time Smart Reroute Banner (Proactive Route Swapping & Smart Alternatives) */}
      <BuddyDynamicRerouteBanner
        proposal={rerouteProposal}
        onSwap={onSwapActivities}
        onSubstitute={onSubstituteActivity}
      />

      <SortableContext items={day.activities.map((a, i) => a.id || `act-${dayIndex}-${i}`)} strategy={verticalListSortingStrategy}>
        <DroppableDay dayIndex={dayIndex} isOver={false}>
          {day.activities.map((activity, index) => (
            <div key={activity.id || `act-${dayIndex}-${index}`}>
              <SortableCard
                activity={activity}
                dayIndex={dayIndex}
                isSelected={selectedId === activity.id}
                editingId={editingId}
                editValue={editValue}
                onCardClick={handleCardClick}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onUpdateTime={updateTime}
                onRemove={removeActivity}
                onEditValueChange={setEditValue}
                onHover={onHoverActivity || (() => { })}
                dayColor={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                index={index}
                dayDate={currentDayDate}
                activityWeather={getActivityWeather(activity)}
                onChangePhoto={onChangePhoto}
                cityName={cityName || destinationName}
                buddyAlerts={buddyBriefing.allAlerts.filter((a) => a.activityId === activity.id)}
              />
              {index < day.activities.length - 1 && segments[index] && (
                <TravelConnector
                  durationText={segments[index].durationText}
                  distanceText={segments[index].distanceText}
                  status={segments[index].status}
                  originLat={activity.lat}
                  originLng={activity.lng}
                  destLat={day.activities[index + 1].lat}
                  destLng={day.activities[index + 1].lng}
                />
              )}
            </div>
          ))}
          <div className="pdf-hidden w-full">
            <AddActivityPopover
              dayIndex={dayIndex}
              suggestions={suggestions}
              onAdd={addActivity}
              dayDate={currentDayDate}
              destinationName={destinationName}
            />
          </div>
        </DroppableDay>
      </SortableContext>
    </div>
  );
};

const TravelItinerary = ({
  itinerary,
  onUpdate,
  onSelectActivity,
  selectedActivityId,
  onHoverActivity,
  activeDragId,
  onReloadMap,
  suggestions = [],
  tripStartDate,
  hourlyWeather = [],
  coherenceResult,
  destinationName,
  cityName,
  onAIRefine,
  isAIRefining = false,
  onOptimizeDay,
  isOptimizingDay = null,
  onSwapActivities,
  onSubstituteActivity,
}: TravelItineraryProps) => {
  const { language, t } = useLanguage();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [photoModalTarget, setPhotoModalTarget] = useState<{ dayIndex: number; activity: Activity } | null>(null);
  const selectedId = selectedActivityId !== undefined ? selectedActivityId : internalSelectedId;

  const handleInternalSwap = (dayIndex: number, idxA: number, idxB: number) => {
    if (onSwapActivities) {
      onSwapActivities(dayIndex, idxA, idxB);
      return;
    }
    if (dayIndex < 0 || dayIndex >= itinerary.length) return;
    const targetDay = itinerary[dayIndex];
    if (!targetDay || !targetDay.activities) return;
    const activities = [...targetDay.activities];
    if (idxA < 0 || idxA >= activities.length || idxB < 0 || idxB >= activities.length) return;

    // Swap time slots and positions
    const timeA = activities[idxA].time;
    const timeB = activities[idxB].time;
    const temp = activities[idxA];
    activities[idxA] = { ...activities[idxB], time: timeA };
    activities[idxB] = { ...temp, time: timeB };

    const updated = itinerary.map((d, i) => (i === dayIndex ? { ...d, activities } : d));
    onUpdate(updated);
  };

  const handleInternalSubstitute = (dayIndex: number, actIndex: number, alternative: SmartRerouteAlternative) => {
    if (onSubstituteActivity) {
      onSubstituteActivity(dayIndex, actIndex, alternative);
      return;
    }
    if (dayIndex < 0 || dayIndex >= itinerary.length) return;
    const targetDay = itinerary[dayIndex];
    if (!targetDay || !targetDay.activities) return;
    const activities = [...targetDay.activities];
    if (actIndex < 0 || actIndex >= activities.length) return;

    const oldAct = activities[actIndex];
    const newAct: Activity = {
      ...oldAct,
      id: `act-${Date.now()}`,
      title: alternative.title,
      title_th: language === "th" ? alternative.title : oldAct.title_th,
      title_en: language === "en" ? alternative.title : oldAct.title_en,
      description: alternative.reason,
      description_th: language === "th" ? alternative.reason : oldAct.description_th,
      description_en: language === "en" ? alternative.reason : oldAct.description_en,
      type: (alternative.category as any) || "landmark",
    };

    activities[actIndex] = newAct;
    const updated = itinerary.map((d, i) => (i === dayIndex ? { ...d, activities } : d));
    onUpdate(updated);
  };

  const removeActivity = (dayIndex: number, activityId: string) => {
    const updated = itinerary.map((day, i) =>
      i === dayIndex ? { ...day, activities: day.activities.filter((a) => a.id !== activityId) } : day
    );
    onUpdate(updated);
  };

  const sortByTime = (activities: Activity[]) => {
    return [...activities].sort((a, b) => {
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return timeA.localeCompare(timeB);
    });
  };

  const addActivity = (dayIndex: number, place: SuggestedPlace, time: string) => {
    const bilingualName = extractBilingualText(place.name);
    const bilingualDesc = extractBilingualText(place.description);

    const placeNameTh = place.name_th || (place as any).title_th || bilingualName?.th || (hasThaiScript(place.name) ? place.name : translateTextSync(place.name, "th"));
    const placeNameEn = place.name_en || (place as any).title_en || place.english_name || bilingualName?.en || (!hasThaiScript(place.name) ? place.name : translateTextSync(place.name, "en"));
    const placeDescTh = place.description_th || bilingualDesc?.th || (hasThaiScript(place.description) ? place.description : translateTextSync(place.description, "th"));
    const placeDescEn = place.description_en || bilingualDesc?.en || (!hasThaiScript(place.description) ? place.description : translateTextSync(place.description, "en"));

    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      time: time,
      title: place.name,
      title_th: placeNameTh,
      title_en: placeNameEn,
      name_th: place.name_th || placeNameTh,
      name_en: place.name_en || placeNameEn,
      description: place.description,
      description_th: placeDescTh,
      description_en: placeDescEn,
      type: place.category === "food" ? "food" : "attraction",
      image: place.image,
      image_url: place.image_url,
      photo_url: place.photo_url,
      lat: place.lat,
      lng: place.lng,
      english_name: place.english_name || placeNameEn,
      image_keyword: place.image_keyword,
    };
    const updated = itinerary.map((day, i) =>
      i === dayIndex ? { ...day, activities: sortByTime([...day.activities, newActivity]) } : day
    );
    onUpdate(updated);
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const saveEdit = (dayIndex: number, activityId: string) => {
    const isThai = language === "th";
    const newTitle = editValue.trim();
    if (!newTitle) {
      setEditingId(null);
      return;
    }

    const updated = itinerary.map((day, i) =>
      i === dayIndex
        ? {
          ...day,
          activities: day.activities.map((a) => {
            if (a.id !== activityId) return a;
            return {
              ...a,
              title: newTitle,
              title_th: isThai ? newTitle : a.title_th,
              title_en: !isThai ? newTitle : a.title_en,
            };
          }),
        }
        : day
    );
    onUpdate(updated);
    setEditingId(null);

    // Asynchronously translate the edited title so language toggling keeps working
    const targetLang = isThai ? "en" : "th";
    translateTextAsync(newTitle, targetLang).then((translated) => {
      if (translated && translated !== newTitle) {
        onUpdate(
          itinerary.map((day, i) =>
            i === dayIndex
              ? {
                ...day,
                activities: day.activities.map((a) => {
                  if (a.id !== activityId) return a;
                  return {
                    ...a,
                    title_th: isThai ? newTitle : translated,
                    title_en: !isThai ? newTitle : translated,
                    english_name: !isThai ? newTitle : translated,
                  };
                }),
              }
              : day
          )
        );
      }
    }).catch(() => { });
  };

  // Background AI translation to ensure both Thai and English fields are populated for all activities
  useEffect(() => {
    if (!itinerary || itinerary.length === 0) return;

    const itemsToTranslateTh: Array<{ id: string; text: string }> = [];
    const itemsToTranslateEn: Array<{ id: string; text: string }> = [];

    for (const day of itinerary) {
      for (const act of day.activities) {
        // Missing Thai title
        if (!act.title_th || !hasThaiScript(act.title_th)) {
          const candidate = act.title || act.title_en || "";
          if (candidate && !hasThaiScript(candidate)) {
            itemsToTranslateTh.push({ id: `t_${act.id}`, text: candidate });
          }
        }
        // Missing English title
        if (!act.title_en || hasThaiScript(act.title_en)) {
          const candidate = act.title || act.title_th || "";
          if (candidate && hasThaiScript(candidate)) {
            itemsToTranslateEn.push({ id: `t_${act.id}`, text: candidate });
          }
        }
        // Missing Thai description
        if (!act.description_th || !hasThaiScript(act.description_th)) {
          const candidate = act.description || act.description_en || "";
          if (candidate && !hasThaiScript(candidate)) {
            itemsToTranslateTh.push({ id: `d_${act.id}`, text: candidate });
          }
        }
        // Missing English description
        if (!act.description_en || hasThaiScript(act.description_en)) {
          const candidate = act.description || act.description_th || "";
          if (candidate && hasThaiScript(candidate)) {
            itemsToTranslateEn.push({ id: `d_${act.id}`, text: candidate });
          }
        }
      }
    }

    if (itemsToTranslateTh.length > 0) {
      batchTranslateWithAI(itemsToTranslateTh, "th").then((transMap) => {
        if (!transMap || Object.keys(transMap).length === 0) return;
        onUpdate(
          itinerary.map((d) => ({
            ...d,
            activities: d.activities.map((a) => {
              const thTitle = transMap[`t_${a.id}`];
              const thDesc = transMap[`d_${a.id}`];
              if (!thTitle && !thDesc) return a;
              return {
                ...a,
                title_th: thTitle || a.title_th,
                description_th: thDesc || a.description_th,
              };
            }),
          }))
        );
      }).catch(() => { });
    }

    if (itemsToTranslateEn.length > 0) {
      batchTranslateWithAI(itemsToTranslateEn, "en").then((transMap) => {
        if (!transMap || Object.keys(transMap).length === 0) return;
        onUpdate(
          itinerary.map((d) => ({
            ...d,
            activities: d.activities.map((a) => {
              const enTitle = transMap[`t_${a.id}`];
              const enDesc = transMap[`d_${a.id}`];
              if (!enTitle && !enDesc) return a;
              return {
                ...a,
                title_en: enTitle || a.title_en,
                english_name: enTitle || a.english_name,
                description_en: enDesc || a.description_en,
              };
            }),
          }))
        );
      }).catch(() => { });
    }
  }, [itinerary.length]);

  const updateTime = (dayIndex: number, activityId: string, newTime: string) => {
    const updated = itinerary.map((day, i) => {
      if (i === dayIndex) {
        const newActivities = day.activities.map((a) => (a.id === activityId ? { ...a, time: newTime } : a));
        return { ...day, activities: sortByTime(newActivities) };
      }
      return day;
    });
    onUpdate(updated);
  };

  const handleUpdatePhoto = (newPhotoUrl: string, isUserPhoto: boolean) => {
    if (!photoModalTarget) return;
    const { dayIndex, activity } = photoModalTarget;
    const updated = itinerary.map((day, i) => {
      if (i === dayIndex) {
        const newActivities = day.activities.map((a) =>
          a.id === activity.id
            ? {
              ...a,
              photo_url: newPhotoUrl,
              image_url: newPhotoUrl,
              image: newPhotoUrl,
              isUserPhoto,
            }
            : a
        );
        return { ...day, activities: newActivities };
      }
      return day;
    });
    onUpdate(updated);
    setPhotoModalTarget(null);
  };

  const handleCardClick = (activity: Activity) => {
    const nextId = activity.id === selectedId ? null : activity.id;
    setInternalSelectedId(nextId);
    onSelectActivity?.(activity);
  };

  // Check if an attraction is being dragged (for highlighting drop zones)
  const isDraggingAttraction = activeDragId?.startsWith("attraction-") ?? false;

  return (
    <div className="animate-slide-up w-full mx-auto" id="itinerary-pdf-content">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            {t("itineraryTitle")}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
            {tripStartDate ? (() => {
              const endDate = new Date(tripStartDate);
              endDate.setDate(endDate.getDate() + itinerary.length - 1);
              return `${tripStartDate.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" })} – ${endDate.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${itinerary.length} ${t("daysCount")}`;
            })() : (
              `${itinerary.length} ${t("daysCount")}`
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* AI Self-Review & Auto-Optimize Button with Confirmation Dialog */}
          {onAIRefine && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={isAIRefining}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-primary text-primary-foreground text-xs sm:text-sm font-semibold rounded-2xl shadow-xs hover:bg-primary/90 active:scale-95 transition-all pdf-hidden disabled:opacity-50 cursor-pointer"
                  title={language === "th" ? "ให้ AI ตรวจสอบกฎการเดินทาง เส้นทาง และจัดระเบียบตารางใหม่อัตโนมัติ" : "Let AI verify travel rules, routes, and auto-optimize schedule"}
                >
                  {isAIRefining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === "th" ? "กำลังตรวจ & จัดระเบียบ..." : "Reviewing & Optimizing..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{language === "th" ? "AI Review & จัดระเบียบ" : "AI Review & Auto-Optimize"}</span>
                    </>
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md rounded-2xl p-6 bg-card border-border shadow-lg">
                <AlertDialogHeader className="text-left space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <Sparkles className="size-5" />
                    </div>
                    <AlertDialogTitle className="text-base sm:text-lg font-bold text-foreground">
                      {language === "th" ? "ยืนยันให้ AI จัดระเบียบตารางเที่ยวทั้งทริป?" : "Optimize entire trip with AI?"}
                    </AlertDialogTitle>
                  </div>
                  <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
                    {language === "th"
                      ? "AI จะตรวจสอบและจัดระเบียบตามเกณฑ์งานวิจัยสากล (TTDP & OPTW): จัดกลุ่มสถานที่ใกล้เคียง, เรียงเส้นทางเป็นระเบียงราบรื่น (2-Opt Anti-Zigzag), ปรับเวลาอาหารเที่ยงและเย็น, ตรวจสอบงบประมาณ, ความเหมาะสมของกลุ่มผู้เดินทาง, และหลีกเลี่ยงความซ้ำซากจำเจของหมวดสถานที่"
                      : "AI will review and optimize your itinerary based on TTDP & OPTW standards: clustering nearby POIs, 2-Opt anti-zigzag smooth routing, meal timings, budget pacing, and variety balance."}
                    <span className="block mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] sm:text-xs font-medium text-amber-700 dark:text-amber-300">
                      💡 <strong>{language === "th" ? "ข้อแนะนำ:" : "Tip:"}</strong> {language === "th" ? "ลำดับเวลาและสถานที่อาจถูกปรับแต่งให้สอดคล้องกับเส้นทางและเวลาเปิด-ปิดจริงอย่างมีประสิทธิภาพสูงสุด" : "Times and POI order may be refined to match actual opening hours and travel distances efficiently."}
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-3">
                  <AlertDialogCancel className="rounded-xl text-xs h-9 px-4 mt-0">
                    {t("cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onAIRefine}
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 px-4 font-semibold"
                  >
                    {language === "th" ? "เริ่มจัดระเบียบแผน ✨" : "Start Optimizing ✨"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 min-[1800px]:grid-cols-3 gap-5 items-start pdf-grid-cols-2">

        {itinerary.map((day, dayIndex) => (
          <DayColumn
            key={day.day}
            day={day}
            dayIndex={dayIndex}
            totalDays={itinerary.length}
            tripStartDate={tripStartDate}
            hourlyWeather={hourlyWeather}
            isDraggingAttraction={isDraggingAttraction}
            selectedId={selectedId}
            editingId={editingId}
            editValue={editValue}
            handleCardClick={handleCardClick}
            startEdit={startEdit}
            saveEdit={saveEdit}
            updateTime={updateTime}
            removeActivity={removeActivity}
            setEditValue={setEditValue}
            onHoverActivity={onHoverActivity}
            suggestions={suggestions}
            addActivity={addActivity}
            destinationName={destinationName}
            cityName={cityName || destinationName}
            onChangePhoto={(dIdx, act) => setPhotoModalTarget({ dayIndex: dIdx, activity: act })}
            onOptimizeDay={onOptimizeDay}
            isOptimizingDay={isOptimizingDay}
            onSwapActivities={(idxA, idxB) => handleInternalSwap(dayIndex, idxA, idxB)}
            onSubstituteActivity={(actIdx, alt) => handleInternalSubstitute(dayIndex, actIdx, alt)}
          />
        ))}
      </div>

      {/* Interactive Photo Editor Modal */}
      {photoModalTarget && (
        <ChangePhotoModal
          isOpen={Boolean(photoModalTarget)}
          onClose={() => setPhotoModalTarget(null)}
          activityTitle={photoModalTarget.activity.title}
          englishName={photoModalTarget.activity.english_name}
          imageKeyword={photoModalTarget.activity.image_keyword}
          currentPhotoUrl={getActivityImage(photoModalTarget.activity)}
          cityName={cityName || destinationName}
          onSelectPhoto={handleUpdatePhoto}
        />
      )}
    </div>
  );
};

export default TravelItinerary;
