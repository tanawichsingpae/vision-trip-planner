import { useState, useEffect, useRef } from "react";
import { Calendar, Clock, Trash2, Plus, Edit2, Check, MapPin, GripVertical, RefreshCw, Phone, Globe, Car } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { useDistanceMatrix } from "@/hooks/useDistanceMatrix";
import { type ForecastHour } from "@/services/environmentService";
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
  type: "attraction" | "food" | "transport" | "rest" | "nature" | "culture" | "activity" | "shopping" | "nightlife" | "relax" | "hotel";
  image?: string;
  image_url?: string | null;
  photo_url?: string | null;
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
  onHoverActivity?: (id: string | null) => void;
  activeDragId?: string | null;
  onReloadMap?: () => void;
  suggestions?: SuggestedPlace[];
  tripStartDate?: Date;
  hourlyWeather?: ForecastHour[]; // Hourly forecast for per-activity weather
}

export const typeConfig: Record<string, { label: string; color: string }> = {
  attraction: { label: "Attraction", color: "bg-primary/15 text-primary border-primary/20" },
  food: { label: "Food & Drink", color: "bg-travel-sunset/20 text-travel-sunset border-travel-sunset/20" },
  transport: { label: "Transport", color: "bg-travel-forest/15 text-travel-forest border-travel-forest/20" },
  rest: { label: "Wellness", color: "bg-travel-sand text-foreground border-travel-sand" },
  nature: { label: "Nature", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  culture: { label: "Culture", color: "bg-purple-100 text-purple-700 border-purple-200" },
  activity: { label: "Activity", color: "bg-orange-100 text-orange-700 border-orange-200" },
  shopping: { label: "Shopping", color: "bg-pink-100 text-pink-700 border-pink-200" },
  nightlife: { label: "Nightlife", color: "bg-slate-800 text-amber-400 border-amber-400/30" },
  relax: { label: "Relax", color: "bg-teal-100 text-teal-700 border-teal-200" },
  hotel: { label: "🏨 Accommodation", color: "bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold" },
};

export const DAY_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];

export const PLACEHOLDER_IMAGES: Record<string, string> = {
  "Arrive at Ngurah Rai Airport": "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&h=400&fit=crop",
  "Seminyak Beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop",
  "Lunch at Coral Kitchen": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop",
  "Tanah Lot Temple Sunset": "https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?w=600&h=400&fit=crop",
  "Mount Batur Sunrise Trek": "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=600&h=400&fit=crop",
  "Tegallalang Rice Terrace": "https://images.unsplash.com/photo-1558005137-d9619a5c539f?w=600&h=400&fit=crop",
  "Lunch in Ubud": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop",
  "Ubud Monkey Forest": "https://images.unsplash.com/photo-1540202404-a2f29016b523?w=600&h=400&fit=crop",
  "Spa & Relaxation": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop",
  "Uluwatu Temple": "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=600&h=400&fit=crop",
  "Local Art Market": "https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=600&h=400&fit=crop",
  "Farewell Lunch": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop",
  "Departure": "https://images.unsplash.com/photo-1436491865332-7a61a109db56?w=600&h=400&fit=crop",
  "Tanah Lot Temple": "https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?w=600&h=400&fit=crop",
  "Mount Batur": "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=600&h=400&fit=crop",
};

export const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&h=400&fit=crop";

export function getActivityImage(activity: Activity): string {
  return activity.image_url || activity.image || PLACEHOLDER_IMAGES[activity.title] || DEFAULT_IMAGE;
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
  distanceText: string;
  status: "loading" | "ok" | "error";
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

const TravelConnector = ({ distanceText, status, originLat, originLng, destLat, destLng }: TravelConnectorProps) => {
  if (status === "error") return null;

  const mapsUrl = originLat && originLng && destLat && destLng
    ? `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`
    : "#";

  return (
    <div className="flex items-center gap-2 py-1 px-2 my-1">
      <div className="h-px flex-1 border-t-2 border-dashed border-border/60" />
      {mapsUrl !== "#" ? (
        <a 
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 px-2.5 py-1 rounded-full border border-border/50 shrink-0 transition-colors"
          title="View route on Google Maps"
        >
          {status === "loading" ? (
            <span className="animate-pulse">📍 ...</span>
          ) : (
            <>
              <MapPin className="w-3 h-3" />
              <span>{distanceText}</span>
            </>
          )}
        </a>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50 shrink-0">
          {status === "loading" ? (
            <span className="animate-pulse">📍 ...</span>
          ) : (
            <>
              <MapPin className="w-3 h-3" />
              <span>{distanceText}</span>
            </>
          )}
        </div>
      )}
      <div className="h-px flex-1 border-t-2 border-dashed border-border/60" />
    </div>
  );
};

// ─────────────────────────────────────────
// Interactive Street View Component
// ─────────────────────────────────────────
function InteractiveStreetView({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (typeof google === "undefined" || !google.maps || !containerRef.current) return;

    const svService = new google.maps.StreetViewService();
    svService.getPanorama({ location: { lat, lng }, radius: 50 }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && containerRef.current) {
        new google.maps.StreetViewPanorama(containerRef.current, {
          position: { lat, lng },
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          disableDefaultUI: true,
          showRoadLabels: false,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          fullscreenControl: true, // Added fullscreen button
          enableCloseButton: false,
        });
      } else {
        setError(true);
      }
    });
  }, [lat, lng]);

  if (error) {
    return null; // hide if not available
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[180px] bg-muted/50 rounded-lg border border-border overflow-hidden mt-1.5"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}


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
}: SortableCardProps) => {
  const [
    showStreetView,
    setShowStreetView,
  ] = useState(false);

  const GOOGLE_MAPS_API_KEY = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
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
      className={`group relative w-full rounded-2xl overflow-hidden bg-card border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer ${isDragging ? "opacity-30" : ""
        } ${isDragOverlay ? "shadow-2xl scale-[1.01] rotate-0.5" : ""} ${isSelected ? "shadow-lg scale-[1.01]" : "border-border hover:border-primary/30"
        }`}
    >
      <div className="relative h-40 overflow-hidden">
        <img
          src={activity.image_url || `https://picsum.photos/seed/${encodeURIComponent(activity.title)}/800/600`}
          alt={activity.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/travel/800/600";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-foreground shadow-sm">
          <div
            {...attributes}
            {...listeners}
            onPointerDown={(e) => { e.stopPropagation(); listeners?.onPointerDown?.(e as any); }}
            onMouseDown={(e) => { e.stopPropagation(); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing hover:bg-black/5 p-0.5 rounded-full"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <Select
              value={activity.time}
              onValueChange={(val) => onUpdateTime(dayIndex, activity.id, val)}
            >
              <SelectTrigger className="h-6 px-2 py-0 border-none bg-transparent hover:bg-black/5 rounded shadow-none text-xs font-medium w-auto min-w-[65px] flex items-center justify-between focus:ring-0 focus:ring-offset-0 gap-1 text-foreground group-hover:text-primary transition-colors">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent className="z-[110] max-h-[200px]">
                {Array.from({ length: 24 }).flatMap((_, i) => [
                  `${i.toString().padStart(2, '0')}:00`,
                  `${i.toString().padStart(2, '0')}:30`
                ]).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="absolute top-3 left-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
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

      <div className="p-4 relative pb-10">
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
            <h4 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{activity.title}</h4>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEdit(activity.id, activity.title); }}
              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              title="Edit Title"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{activity.description}</p>

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

        {/* Opening Hours */}
        {activity.openingHours && activity.openingHours.length > 0 && (() => {
          // Google Places API weekday_text starts on Monday at index 0
          // JS getDay() starts on Sunday at 0. So (getDay() + 6) % 7 maps JS day to Google index.
          const dateToUse = dayDate || new Date();
          const currentDayIndex = (dateToUse.getDay() + 6) % 7;
          // Fallback if the array length doesn't match 7 days for some reason
          const currentDayText = activity.openingHours[currentDayIndex] || activity.openingHours[0];

          return (
            <details
              className="text-[10px] text-muted-foreground mt-1 group cursor-pointer relative z-20"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <summary className="flex items-center gap-1 hover:text-foreground transition-colors list-none outline-none">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium line-clamp-1 group-open:line-clamp-none">
                  {currentDayText}
                </span>
                <svg className="w-3 h-3 opacity-50 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="pl-4 mt-1.5 mb-1 flex flex-col gap-1 border-l-2 border-border/50 ml-1.5">
                {activity.openingHours.map((hours, idx) => (
                  <span key={idx} className={idx === currentDayIndex ? "text-foreground font-semibold" : ""}>
                    {hours}
                  </span>
                ))}
              </div>
            </details>
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
                <span className="truncate max-w-[100px]">{activity.phoneNumber}</span>
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

        {/* Per-activity weather */}
        {activityWeather && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-700 w-fit">
            <span>{weatherEmoji(activityWeather.condition?.description)}</span>
            <span className="font-medium">{activityWeather.tempC}°C</span>
            <span className="text-muted-foreground">{activityWeather.condition?.description}</span>
          </div>
        )}

        {/* Street View thumbnail / toggle */}
        {activity.lat && activity.lng && (
          <div className="mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowStreetView(v => !v); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Car className="w-3 h-3" />
              {showStreetView ? "Hide Street View" : "Street View"}
            </button>
            {showStreetView && (
              <InteractiveStreetView lat={activity.lat} lng={activity.lng} />
            )}
          </div>
        )}

        {/* Google Maps Link */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors z-20 shadow-sm flex items-center justify-center group/map"
          title="View on Google Maps"
        >
          <MapPin className="w-3.5 h-3.5 transition-transform group-hover/map:scale-110" />
        </a>
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

const AddActivityPopover = ({ dayIndex, suggestions = [], onAdd, dayDate }: { dayIndex: number, suggestions: SuggestedPlace[], onAdd: (dayIndex: number, place: SuggestedPlace, time: string) => void, dayDate?: Date }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SuggestedPlace | null>(null);
  const [time, setTime] = useState("12:00");

  const times = [
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

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

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSelectedPlace(null); }}>
      <PopoverTrigger asChild>
        <button
          className="w-full py-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">Add Activity</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 z-[100]" align="center">
        {topSuggestions.length > 0 ? (
          !selectedPlace ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-foreground">Suggested Places</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {topSuggestions.map(place => (
                  <div
                    key={place.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => setSelectedPlace(place)}
                  >
                    <img src={place.image_url || `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/600`} alt={place.name} className="w-12 h-12 rounded-md object-cover" onError={(e) => { e.currentTarget.src = "https://picsum.photos/seed/travel/800/600"; }} />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate capitalize">{place.category}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 mt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => {
                  onAdd(dayIndex, {
                    id: `act-${Date.now()}`,
                    name: "New Activity",
                    description: "Add details here",
                    category: "attraction",
                    image: "",
                    lat: 0,
                    lng: 0
                  }, "12:00");
                  setIsOpen(false);
                }}>
                  <Plus className="w-3 h-3 mr-1" />
                  Blank Activity
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setSelectedPlace(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
                <h4 className="font-semibold text-sm text-foreground truncate flex-1">{selectedPlace.name}</h4>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Select Time</Label>
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
                  setSelectedPlace(null);
                }}
              >
                Confirm Add
              </Button>
            </div>
          )
        ) : (
          <div className="text-center p-4 space-y-3">
            <p className="text-sm text-muted-foreground">No suggestions available.</p>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => {
              onAdd(dayIndex, {
                id: `act-${Date.now()}`,
                name: "New Activity",
                description: "Add details here",
                category: "attraction",
                image: "",
                lat: 0,
                lng: 0
              }, "12:00");
              setIsOpen(false);
            }}>
              <Plus className="w-3 h-3 mr-1" />
              Add Blank Activity
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
}: DayColumnProps) => {
  let currentDayDate: Date | undefined;
  if (tripStartDate) {
    currentDayDate = new Date(tripStartDate);
    currentDayDate.setDate(currentDayDate.getDate() + dayIndex);
  }

  const coords = day.activities.map(a =>
    a.lat && a.lng ? { lat: a.lat, lng: a.lng } : undefined
  );
  const segments = useDistanceMatrix(coords);

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
    <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl p-6 border border-border/50 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-base shadow-lg"
          style={{ backgroundColor: DAY_COLORS[dayIndex % DAY_COLORS.length] }}
        >
          {day.day}
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">
            {currentDayDate
              ? `Day ${day.day} – ${currentDayDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
              : `Day ${day.day}`}
          </h3>
          {!tripStartDate && <p className="text-sm text-muted-foreground">{day.date}</p>}
          {isDraggingAttraction && (
            <p className="text-xs text-primary font-medium mt-0.5 animate-pulse">↓ Drop here to add</p>
          )}
        </div>
      </div>

      <SortableContext items={day.activities.map(a => a.id)} strategy={verticalListSortingStrategy}>
        <DroppableDay dayIndex={dayIndex} isOver={false}>
          {day.activities.map((activity, index) => (
            <div key={activity.id}>
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
                onHover={onHoverActivity || (() => {})}
                dayColor={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                index={index}
                dayDate={currentDayDate}
                activityWeather={getActivityWeather(activity)}
              />
              {index < day.activities.length - 1 && segments[index] && (
                <TravelConnector
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
          <AddActivityPopover
            dayIndex={dayIndex}
            suggestions={suggestions}
            onAdd={addActivity}
            dayDate={currentDayDate}
          />
        </DroppableDay>
      </SortableContext>
    </div>
  );
};

const TravelItinerary = ({ itinerary, onUpdate, onSelectActivity, onHoverActivity, activeDragId, onReloadMap, suggestions = [], tripStartDate, hourlyWeather = [] }: TravelItineraryProps) => {

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      time: time,
      title: place.name,
      description: place.description,
      type: place.category === "food" ? "food" : "attraction",
      image: place.image,
      image_url: place.image_url,
      photo_url: place.photo_url,
      lat: place.lat,
      lng: place.lng,
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
    const updated = itinerary.map((day, i) =>
      i === dayIndex
        ? { ...day, activities: day.activities.map((a) => (a.id === activityId ? { ...a, title: editValue } : a)) }
        : day
    );
    onUpdate(updated);
    setEditingId(null);
  };

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

  const handleCardClick = (activity: Activity) => {
    setSelectedId(activity.id === selectedId ? null : activity.id);
    onSelectActivity?.(activity);
  };

  // Check if an attraction is being dragged (for highlighting drop zones)
  const isDraggingAttraction = activeDragId?.startsWith("attraction-") ?? false;

  return (
    <div className="animate-slide-up w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          Your Travel Itinerary
        </h2>
        <div className="flex items-center gap-4">
          {tripStartDate ? (() => {
            const endDate = new Date(tripStartDate);
            endDate.setDate(endDate.getDate() + itinerary.length - 1);
            return (
              <span className="text-sm text-muted-foreground">
                {tripStartDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {itinerary.length} days
              </span>
            );
          })() : (
            <span className="text-sm text-muted-foreground">{itinerary.length} days</span>
          )}
          {onReloadMap && (
            <button
              onClick={onReloadMap}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-full shadow hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Map
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
        {itinerary.map((day, dayIndex) => (
          <DayColumn
            key={day.day}
            day={day}
            dayIndex={dayIndex}
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
          />
        ))}
      </div>
    </div>
  );
};

export default TravelItinerary;
