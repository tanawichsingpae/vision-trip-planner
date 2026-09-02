import { useState, useCallback, useEffect, useMemo } from "react";
import { Sparkles, RefreshCw, Plus } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DEFAULT_IMAGE } from "@/components/TravelItinerary";

export interface SuggestedPlace {
  id: string;
  name: string;
  category: "culture" | "food" | "nature" | "adventure" | "activity" | "shopping" | "nightlife" | "relax" | "landmark" | "photo" | "entertainment" | "spiritual" | "hotel" | "attraction";
  description: string;
  image: string;
  image_url?: string | null;
  photo_url?: string | null;
  lat: number;
  lng: number;
  openingHours?: string[] | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  openNow?: boolean | null;
  priceLevel?: number | null;
  website?: string | null;
  phoneNumber?: string | null;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  culture: { label: "Culture", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200" },
  food: { label: "Food", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200" },
  nature: { label: "Nature", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200" },
  adventure: { label: "Adventure", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200" },
  activity: { label: "Adventure", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200" },
  shopping: { label: "Shopping", color: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200" },
  nightlife: { label: "Nightlife", color: "bg-slate-800 text-amber-400 dark:bg-slate-900 dark:text-amber-300 border-amber-400/30" },
  relax: { label: "Relax", color: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200" },
  landmark: { label: "📸 Landmark & Photo", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 font-medium" },
  photo: { label: "📸 Landmark & Photo", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 font-medium" },
  entertainment: { label: "🎪 Entertainment", color: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 font-medium" },
  spiritual: { label: "🔮 Spiritual & Mutelu", color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 font-medium" },
  hotel: { label: "🏨 Accommodation", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 font-semibold" },
  attraction: { label: "Attraction", color: "bg-primary/15 text-primary border-primary/20" },
};

function getFallbackSuggestions(locationName: string): SuggestedPlace[] {
  const defaults = [
    { name: `Scenic SkyWalk & Photo Landmark in ${locationName}`, category: "landmark" as const, description: `Iconic viewpoint and popular photo spot with stunning panorama.` },
    { name: `Historic Landmark & Temple in ${locationName}`, category: "culture" as const, description: `Popular historical landmark and architectural heritage spot.` },
    { name: `Famous Local Restaurant in ${locationName}`, category: "food" as const, description: `Authentic local cuisine and top-rated regional specialties.` },
    { name: `Sacred Shrine & Spiritual Blessing Spot`, category: "spiritual" as const, description: `Revered spiritual destination for blessings, fortune, and peaceful reflection.` },
    { name: `Exciting Theme Park & Entertainment Complex`, category: "entertainment" as const, description: `Thrilling rides, shows, and family entertainment attractions.` },
    { name: `Scenic Viewpoint & Central Park`, category: "nature" as const, description: `Beautiful green landscape with panoramic views.` },
    { name: `Popular Night Market & Evening District`, category: "nightlife" as const, description: `Lively night market featuring street food and shopping.` },
    { name: `Central Shopping Arcade`, category: "shopping" as const, description: `Vibrant retail center with souvenirs and local handicrafts.` },
    { name: `Relaxing Spa & Wellness Center`, category: "relax" as const, description: `Calming sanctuary for traditional massage and relaxation.` },
  ];

  return defaults.map((item, i) => ({

    id: `fallback-sug-${i}-${Date.now()}`,
    name: item.name,
    category: item.category,
    description: item.description,
    image: `https://picsum.photos/seed/${encodeURIComponent(item.name)}/800/600`,
    lat: 0,
    lng: 0,
    rating: 4.5 + (i % 3) * 0.2,
    userRatingsTotal: 250 + i * 80,
  }));
}

interface DraggableSuggestionProps {
  place: SuggestedPlace;
  onAdd?: (place: SuggestedPlace, dayIndex: number, time: string) => void;
  daysCount: number;
}

const DraggableSuggestion = ({ place, onAdd, daysCount }: DraggableSuggestionProps) => {
  const [selectedDay, setSelectedDay] = useState<string>("0");
  const [selectedTime, setSelectedTime] = useState<string>("12:00");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const times = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, "0");
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
  });

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `suggestion-${place.id}`,
    data: { type: "suggestion", place },
  });

  const config = categoryConfig[place.category] || categoryConfig.activity;

  return (
    <div
      ref={setNodeRef}
      className={`group relative min-w-[240px] max-w-[260px] rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 snap-start cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30 scale-95" : "hover:-translate-y-1"
        }`}
      {...attributes}
      {...listeners}
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={place.image_url || `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/600`}
          alt={place.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/travel/800/600";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
        <Badge variant="outline" className={`absolute top-2.5 left-2.5 text-[10px] backdrop-blur-sm ${config.color}`}>
          {config.label}
        </Badge>
      </div>
      <div className="p-3.5">
        <h4 className="font-semibold text-foreground text-sm leading-tight mb-1">{place.name}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{place.description}</p>

        <div onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full h-7 text-xs text-primary hover:bg-primary/10 relative z-10"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add to Your Travel Itinerary
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-3 z-[100]"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Select Day</Label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      {Array.from({ length: daysCount }).map((_, i) => (
                        <SelectItem key={i} value={i.toString()} className="text-xs">
                          Day {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Select Time</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd?.(place, parseInt(selectedDay, 10), selectedTime);
                    setIsPopoverOpen(false);
                  }}
                >
                  Confirm Add
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

// Overlay for drag preview
export const SuggestionDragOverlay = ({ place }: { place: SuggestedPlace }) => {
  const config = categoryConfig[place.category] || categoryConfig.activity;
  return (
    <div className="w-64 rounded-2xl overflow-hidden bg-card border border-primary shadow-2xl scale-105 rotate-1">
      <div className="relative h-36 overflow-hidden">
        <img
          src={place.image_url || `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/600`}
          alt={place.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/travel/800/600";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
      </div>
      <div className="p-3.5">
        <Badge variant="outline" className={`text-[10px] mb-1.5 ${config.color}`}>
          {config.label}
        </Badge>
        <h4 className="font-semibold text-foreground text-sm">{place.name}</h4>
        <p className="text-xs text-muted-foreground mt-1">Drop into a day to add</p>
      </div>
    </div>
  );
};

interface AISuggestedPlacesProps {
  onAddToItinerary: (place: SuggestedPlace, dayIndex: number, time?: string) => void;
  locationName: string;
  suggestions?: SuggestedPlace[];
  onRefreshSuggestions?: () => Promise<void>;
  daysCount: number;
}

const CATEGORIES = ["all", "hotel", "attraction", "food", "nature", "culture", "activity"] as const;

const AISuggestedPlaces = ({ onAddToItinerary, locationName, suggestions: propSuggestions, onRefreshSuggestions, daysCount }: AISuggestedPlacesProps) => {
  const [internalSuggestions, setInternalSuggestions] = useState<SuggestedPlace[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const suggestions = propSuggestions || internalSuggestions;

  const fetchSuggestions = useCallback(async () => {
    if (!locationName || propSuggestions) return;
    setIsRefreshing(true);
    try {
      // Internal suggestions are now deprecated or handled differently
      // setInternalSuggestions(data); 
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [locationName, propSuggestions]);

  useEffect(() => {
    if (!propSuggestions) {
      fetchSuggestions();
    }
  }, [fetchSuggestions, propSuggestions]);

  const filtered = activeFilter === "all"
    ? suggestions
    : suggestions.filter((s) => s.category === activeFilter);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshSuggestions) {
        await onRefreshSuggestions();
      } else {
        await fetchSuggestions();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSuggestions, onRefreshSuggestions]);

  const handleAdd = useCallback(
    (place: SuggestedPlace, dayIndex: number, time: string) => {
      onAddToItinerary(place, dayIndex, time);
    },
    [onAddToItinerary],
  );

  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Suggested Places near {locationName}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Generating…" : "New Suggestions"}
        </Button>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${activeFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
          >
            {cat === "all" ? "All" : (categoryConfig[cat]?.label || cat)}
          </button>
        ))}
      </div>

      {/* Cards horizontal scroll */}
      <div className="relative">
        {isRefreshing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm rounded-2xl">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-medium">AI is finding new places…</span>
            </div>
          </div>
        )}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          {filtered.map((place) => (
            <DraggableSuggestion key={place.id} place={place} onAdd={handleAdd} daysCount={daysCount} />
          ))}
          {!isRefreshing && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 w-full text-center">
              No suggestions in this category. Try another filter or refresh.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        click "Add to Your Travel Itinerary" to include them.
      </p>
    </div>
  );
};

export default AISuggestedPlaces;
