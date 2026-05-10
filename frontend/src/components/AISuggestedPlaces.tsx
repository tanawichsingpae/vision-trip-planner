import { useState, useCallback, useEffect } from "react";
import { Sparkles, RefreshCw, Plus } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_IMAGE } from "@/components/TravelItinerary";

export interface SuggestedPlace {
  id: string;
  name: string;
  category: "attraction" | "food" | "nature" | "culture" | "activity";
  description: string;
  image: string;
  image_url?: string | null;
  photo_url?: string | null;
  lat: number;
  lng: number;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  attraction: { label: "Attraction", color: "bg-primary/15 text-primary border-primary/20" },
  food: { label: "Food", color: "bg-travel-sunset/20 text-travel-sunset border-travel-sunset/20" },
  nature: { label: "Nature", color: "bg-travel-forest/15 text-travel-forest border-travel-forest/20" },
  culture: { label: "Culture", color: "bg-purple-100 text-purple-700 border-purple-200" },
  activity: { label: "Activity", color: "bg-travel-sand text-foreground border-travel-sand" },
};

interface DraggableSuggestionProps {
  place: SuggestedPlace;
  onAdd?: (place: SuggestedPlace) => void;
}

const DraggableSuggestion = ({ place, onAdd }: DraggableSuggestionProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `suggestion-${place.id}`,
    data: { type: "suggestion", place },
  });

  const config = categoryConfig[place.category] || categoryConfig.activity;

  return (
    <div
      ref={setNodeRef}
      className={`group relative min-w-[240px] max-w-[260px] rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 snap-start cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-30 scale-95" : "hover:-translate-y-1"
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={place.image_url || `https://source.unsplash.com/800x600/?${encodeURIComponent(place.name)}`}
          alt={place.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "https://source.unsplash.com/800x600/?travel,landmark";
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
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full h-7 text-xs text-primary hover:bg-primary/10"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.(place);
          }}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add to Day 1
        </Button>
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
          src={place.image_url || `https://source.unsplash.com/800x600/?${encodeURIComponent(place.name)}`} 
          alt={place.name} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            e.currentTarget.src = "https://source.unsplash.com/800x600/?travel,landmark";
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
  onAddToItinerary: (place: SuggestedPlace, dayIndex: number) => void;
  locationName: string;
  suggestions?: SuggestedPlace[];
}

const CATEGORIES = ["all", "attraction", "food", "nature", "culture", "activity"] as const;

const AISuggestedPlaces = ({ onAddToItinerary, locationName, suggestions: propSuggestions }: AISuggestedPlacesProps) => {
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

  const handleRefresh = useCallback(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleAdd = useCallback(
    (place: SuggestedPlace) => {
      onAddToItinerary(place, 0);
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
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
              activeFilter === cat
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
            <DraggableSuggestion key={place.id} place={place} onAdd={handleAdd} />
          ))}
          {!isRefreshing && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 w-full text-center">
              No suggestions in this category. Try another filter or refresh.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        Drag cards into your itinerary or click "Add to Day 1" to include them.
      </p>
    </div>
  );
};

export default AISuggestedPlaces;
