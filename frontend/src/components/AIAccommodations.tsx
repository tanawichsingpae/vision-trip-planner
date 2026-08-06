import { useState, useCallback } from "react";
import { BedDouble, Plus, Globe, Star, Phone, MapPin, RefreshCw } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";

// ─────────────────────────────────────────
// Draggable Hotel Card
// ─────────────────────────────────────────
interface DraggableHotelCardProps {
  hotel: SuggestedPlace & { rating?: number | null; website?: string | null; phoneNumber?: string | null; priceLevel?: number | null };
  onAdd?: (hotel: SuggestedPlace, dayIndex: number, time: string) => void;
  daysCount: number;
}

const DraggableHotelCard = ({ hotel, onAdd, daysCount }: DraggableHotelCardProps) => {
  const [selectedDay, setSelectedDay] = useState<string>("0");
  const [selectedTime, setSelectedTime] = useState<string>("14:00");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const times = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
  ];

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `hotel-suggestion-${hotel.id}`,
    data: { type: "hotel-suggestion", place: hotel },
  });

  const priceLabel = hotel.priceLevel != null
    ? (["Free", "$", "$$", "$$$", "$$$$"][hotel.priceLevel] ?? "$")
    : null;

  return (
    <div
      ref={setNodeRef}
      className={`group relative min-w-[260px] max-w-[280px] rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 snap-start cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-30 scale-95" : "hover:-translate-y-1"
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Hotel Image */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={hotel.image_url || `https://picsum.photos/seed/${encodeURIComponent(hotel.name)}/800/600`}
          alt={hotel.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/hotel/800/600";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />

        {/* Hotel Badge */}
        <Badge
          variant="outline"
          className="absolute top-2.5 left-2.5 text-[10px] backdrop-blur-sm bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold"
        >
          🏨 Accommodation
        </Badge>

        {/* Price Badge */}
        {priceLabel && (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 backdrop-blur-sm">
            {priceLabel}
          </span>
        )}

        {/* Rating on image overlay */}
        {hotel.rating != null && hotel.rating > 0 && (
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-[11px] font-semibold text-foreground">{hotel.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Google Maps Link */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2.5 p-1.5 rounded-full bg-white/90 text-indigo-600 hover:bg-white hover:text-indigo-800 transition-colors z-20 shadow-sm flex items-center justify-center group/map"
          title="View on Google Maps"
        >
          <MapPin className="w-3.5 h-3.5 transition-transform group-hover/map:scale-110" />
        </a>
      </div>

      {/* Content */}
      <div className="p-3.5">
        <h4 className="font-semibold text-foreground text-sm leading-tight mb-1 line-clamp-1">{hotel.name}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{hotel.description}</p>

        {/* Links */}
        {(hotel.website || hotel.phoneNumber) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {hotel.website && (
              <a
                href={hotel.website}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Globe className="w-3 h-3" />
                <span>Website</span>
              </a>
            )}
            {hotel.phoneNumber && (
              <a
                href={`tel:${hotel.phoneNumber}`}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{hotel.phoneNumber}</span>
              </a>
            )}
          </div>
        )}

        {/* Add to itinerary button */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full h-7 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add to Itinerary
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
                  <Label className="text-xs">Check-in Time</Label>
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
                  className="w-full h-8 text-xs mt-2 bg-indigo-600 hover:bg-indigo-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd?.(hotel, parseInt(selectedDay, 10), selectedTime);
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

// ─────────────────────────────────────────
// Drag Overlay Preview
// ─────────────────────────────────────────
export const HotelDragOverlay = ({ hotel }: { hotel: SuggestedPlace }) => (
  <div className="w-64 rounded-2xl overflow-hidden bg-card border border-indigo-400 shadow-2xl scale-105 rotate-1">
    <div className="relative h-36 overflow-hidden">
      <img
        src={hotel.image_url || `https://picsum.photos/seed/${encodeURIComponent(hotel.name)}/800/600`}
        alt={hotel.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = "https://picsum.photos/seed/hotel/800/600";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
    </div>
    <div className="p-3.5">
      <Badge variant="outline" className="text-[10px] mb-1.5 bg-indigo-100 text-indigo-700 border-indigo-300">
        🏨 Accommodation
      </Badge>
      <h4 className="font-semibold text-foreground text-sm">{hotel.name}</h4>
      <p className="text-xs text-muted-foreground mt-1">Drop into a day to add</p>
    </div>
  </div>
);

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
interface AIAccommodationsProps {
  accommodations: SuggestedPlace[];
  onAddToItinerary: (hotel: SuggestedPlace, dayIndex: number, time?: string) => void;
  locationName: string;
  daysCount: number;
  onRefreshAccommodations?: () => Promise<void>;
  isRefreshing?: boolean;
}

const AIAccommodations = ({
  accommodations,
  onAddToItinerary,
  locationName,
  daysCount,
  onRefreshAccommodations,
  isRefreshing,
}: AIAccommodationsProps) => {
  const handleAdd = useCallback(
    (hotel: SuggestedPlace, dayIndex: number, time: string) => {
      onAddToItinerary(hotel, dayIndex, time);
    },
    [onAddToItinerary],
  );

  if (accommodations.length === 0) return null;

  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BedDouble className="w-6 h-6 text-indigo-600" />
          Accommodation Recommendations near {locationName}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1 rounded-full font-medium">
            {accommodations.length} options available
          </span>
          {onRefreshAccommodations && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshAccommodations}
              disabled={isRefreshing}
              className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-7 text-xs rounded-full px-3"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Finding…" : "More Options"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Accommodations are not included in your itinerary by default — pick one and add it to your preferred day and check-in time.
      </p>

      {/* Hotel Cards — horizontal scroll */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          {accommodations.map((hotel) => (
            <DraggableHotelCard
              key={hotel.id}
              hotel={hotel as any}
              onAdd={handleAdd}
              daysCount={daysCount}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        Drag a hotel card into a day column, or click "Add to Itinerary" to select a specific time.
      </p>
    </div>
  );
};

export default AIAccommodations;
