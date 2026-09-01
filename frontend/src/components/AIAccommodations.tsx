import { useState, useCallback } from "react";
import { BedDouble, Plus, Globe, Star, Phone, MapPin, RefreshCw, ExternalLink, Building2, Clock, Search, ChevronUp } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { buildBookingUrl, buildAgodaUrl } from "@/lib/hotelUrl";
import { HotelSelectCombobox } from "@/components/HotelSelectCombobox";

// ─────────────────────────────────────────
// Draggable Hotel Card
// ─────────────────────────────────────────
interface DraggableHotelCardProps {
  hotel: SuggestedPlace & { rating?: number | null; website?: string | null; phoneNumber?: string | null; priceLevel?: number | null };
  onAdd?: (hotel: SuggestedPlace, checkInDay: number, checkInTime: string, checkOutDay: number, checkOutTime: string) => void;
  daysCount: number;
  cityName?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

const DraggableHotelCard = ({ hotel, onAdd, daysCount, cityName = "", checkInDate, checkOutDate }: DraggableHotelCardProps) => {
  const [checkInDay, setCheckInDay] = useState<string>("0");
  const [checkInTime, setCheckInTime] = useState<string>("15:00");
  const [checkOutDay, setCheckOutDay] = useState<string>((daysCount > 0 ? daysCount - 1 : 0).toString());
  const [checkOutTime, setCheckOutTime] = useState<string>("11:00");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const checkInTimes = ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
  const checkOutTimes = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"];

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
          href={
            hotel.lat && hotel.lng
              ? `https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name)}`
          }
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

        {/* Booking & Info Links */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <a
            href={buildBookingUrl(hotel.name, cityName, checkInDate, checkOutDate)}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
            title="Book on Booking.com"
          >
            <span>Booking.com</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={buildAgodaUrl(hotel.name, cityName, checkInDate, checkOutDate)}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
            title="Book on Agoda"
          >
            <span>Agoda</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {hotel.website && (
            <a
              href={hotel.website}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <Globe className="w-3 h-3" />
              <span>Web</span>
            </a>
          )}
        </div>

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
              className="w-56 p-3 z-[100]"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <h4 className="font-semibold text-xs text-foreground pb-1 border-b">Add Accommodation</h4>
                
                {/* Check-in Group */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 block">Check-in</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Day</Label>
                      <Select value={checkInDay} onValueChange={setCheckInDay}>
                        <SelectTrigger className="h-7 text-xs px-2">
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
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Time</Label>
                      <Select value={checkInTime} onValueChange={setCheckInTime}>
                        <SelectTrigger className="h-7 text-xs px-2">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent className="z-[110] max-h-[160px]">
                          {checkInTimes.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Check-out Group */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">Check-out</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Day</Label>
                      <Select value={checkOutDay} onValueChange={setCheckOutDay}>
                        <SelectTrigger className="h-7 text-xs px-2">
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
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-muted-foreground">Time</Label>
                      <Select value={checkOutTime} onValueChange={setCheckOutTime}>
                        <SelectTrigger className="h-7 text-xs px-2">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent className="z-[110] max-h-[160px]">
                          {checkOutTimes.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full h-8 text-xs mt-2 bg-indigo-600 hover:bg-indigo-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd?.(
                      hotel,
                      parseInt(checkInDay, 10),
                      checkInTime,
                      parseInt(checkOutDay, 10),
                      checkOutTime
                    );
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
  onAddToItinerary: (
    hotel: SuggestedPlace,
    checkInDay: number,
    checkInTime: string,
    checkOutDay: number,
    checkOutTime: string
  ) => void;
  locationName: string;
  daysCount: number;
  onRefreshAccommodations?: () => Promise<void>;
  isRefreshing?: boolean;
  tripStartDate?: Date;
  selectedHotelName?: string;
}

const AIAccommodations = ({
  accommodations,
  onAddToItinerary,
  locationName,
  daysCount,
  onRefreshAccommodations,
  isRefreshing,
  tripStartDate,
  selectedHotelName,
}: AIAccommodationsProps) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchHotelName, setSearchHotelName] = useState("");
  const [searchHotelLat, setSearchHotelLat] = useState<number | null>(null);
  const [searchHotelLng, setSearchHotelLng] = useState<number | null>(null);
  const [searchHotelPhotoUrl, setSearchHotelPhotoUrl] = useState<string | undefined>(undefined);
  const [searchHotelPlaceId, setSearchHotelPlaceId] = useState<string | undefined>(undefined);

  const [searchCheckInDay, setSearchCheckInDay] = useState<string>("0");
  const [searchCheckInTime, setSearchCheckInTime] = useState<string>("15:00");
  const [searchCheckOutDay, setSearchCheckOutDay] = useState<string>((daysCount > 0 ? daysCount - 1 : 0).toString());
  const [searchCheckOutTime, setSearchCheckOutTime] = useState<string>("11:00");

  const handleAdd = useCallback(
    (
      hotel: SuggestedPlace,
      checkInDay: number,
      checkInTime: string,
      checkOutDay: number,
      checkOutTime: string
    ) => {
      onAddToItinerary(hotel, checkInDay, checkInTime, checkOutDay, checkOutTime);
      // Auto-hide search panel and reset search inputs after adding
      setShowSearch(false);
      setSearchHotelName("");
      setSearchHotelLat(null);
      setSearchHotelLng(null);
      setSearchHotelPhotoUrl(undefined);
      setSearchHotelPlaceId(undefined);
    },
    [onAddToItinerary],
  );

  // Compute YYYY-MM-DD string for check-in and check-out
  let checkInStr: string | undefined;
  let checkOutStr: string | undefined;
  if (tripStartDate) {
    const inDate = new Date(tripStartDate);
    const outDate = new Date(tripStartDate);
    outDate.setDate(outDate.getDate() + (daysCount > 0 ? daysCount : 1));
    checkInStr = inDate.toISOString().slice(0, 10);
    checkOutStr = outDate.toISOString().slice(0, 10);
  }

  // custom selected hotel object
  const customHotel: SuggestedPlace | null = searchHotelName ? {
    id: `custom-hotel-${searchHotelPlaceId || "manual"}`,
    name: searchHotelName,
    category: "hotel",
    description: "Your custom selected accommodation",
    lat: searchHotelLat ?? 0,
    lng: searchHotelLng ?? 0,
    photo_url: searchHotelPhotoUrl,
    image_url: searchHotelPhotoUrl,
    image: searchHotelPhotoUrl,
  } : null;

  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      {/* Section Header — mirrors AISuggestedPlaces layout */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BedDouble className="w-6 h-6 text-primary" />
          Accommodation Recommendations near {locationName}
        </h2>
        {onRefreshAccommodations && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAccommodations}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Finding…" : "More Options"}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Accommodations are not included in your itinerary by default — pick one to book directly or add to your preferred day.
      </p>

      {/* Fake Search Bar Trigger — Airbnb style */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 group text-left"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-none mb-0.5">ค้นหาที่พักเอง</p>
            <p className="text-xs text-muted-foreground truncate">Hilton, Marriott, หรือโรงแรมที่คุณจอง...</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {accommodations.length > 0 && (
              <span className="text-xs bg-primary/5 border border-primary/20 text-primary px-2.5 py-1 rounded-full font-medium hidden sm:inline-flex">
                {accommodations.length} available
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setShowSearch(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            ซ่อนกล่องค้นหา
          </button>
          {accommodations.length > 0 && (
            <span className="text-xs bg-primary/5 border border-primary/20 text-primary px-3 py-1 rounded-full font-medium">
              {accommodations.length} options available
            </span>
          )}
        </div>
      )}

      {/* Manual Search Collapsible Panel (Preferences Theme) */}
      {showSearch && (
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-slide-up space-y-4 shadow-sm">
          {/* Hotel Name */}

          <div className="space-y-1.5">
            <Label htmlFor="custom-hotel-search" className="text-sm font-medium flex items-center gap-1.5">
              <BedDouble className="w-3.5 h-3.5 text-primary" />
              Hotel name
            </Label>
            <HotelSelectCombobox
              id="custom-hotel-search"
              value={searchHotelName}
              onChange={(name, lat, lng, details) => {
                setSearchHotelName(name);
                setSearchHotelLat(lat);
                setSearchHotelLng(lng);
                setSearchHotelPhotoUrl(details?.photoUrl || undefined);
                setSearchHotelPlaceId(details?.placeId || undefined);
              }}
              destinationName={locationName}
              placeholder="Search for your hotel..."
            />
          </div>

          {customHotel && (
            <div className="space-y-4 pt-3 border-t border-primary/15 animate-slide-up">
              {/* Check-in / Check-out times (Preferences Theme) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="search-checkin-day" className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-green-500" />
                    Check-in Date & Time
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      id="search-checkin-day"
                      value={searchCheckInDay}
                      onChange={(e) => setSearchCheckInDay(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {Array.from({ length: Math.max(1, daysCount) }, (_, i) => (
                        <option key={i} value={i}>Day {i + 1}</option>
                      ))}
                    </select>
                    <select
                      value={searchCheckInTime}
                      onChange={(e) => setSearchCheckInTime(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="search-checkout-day" className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Check-out Date & Time
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      id="search-checkout-day"
                      value={searchCheckOutDay}
                      onChange={(e) => setSearchCheckOutDay(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {Array.from({ length: Math.max(1, daysCount) }, (_, i) => (
                        <option key={i} value={i}>Day {i + 1}</option>
                      ))}
                    </select>
                    <select
                      value={searchCheckOutTime}
                      onChange={(e) => setSearchCheckOutTime(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchHotelName("");
                    setSearchHotelLat(null);
                    setSearchHotelLng(null);
                    setSearchHotelPhotoUrl(undefined);
                    setSearchHotelPlaceId(undefined);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs px-3 h-8"
                >
                  Clear Selection
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleAdd(
                      customHotel,
                      parseInt(searchCheckInDay, 10),
                      searchCheckInTime,
                      parseInt(searchCheckOutDay, 10),
                      searchCheckOutTime
                    );
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 h-8 gap-1.5 rounded-lg shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Hotel to Itinerary
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {accommodations.length === 0 && !showSearch ? (
        /* Compact, warm Korean oppa Pix banner when accommodation is already set */
        <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-2.5 flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 text-sm font-bold shadow-2xs">
              🏨
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">
                {selectedHotelName
                  ? `คุณมีที่พัก "${selectedHotelName}" เรียบร้อยแล้ว`
                  : "คุณมีที่พักสำหรับการเดินทางเรียบร้อยแล้ว"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                พักผ่อนให้สบายนะครับ 😊 หากต้องการค้นหาหรือเปลี่ยนที่พักใหม่ กดค้นหาได้ทันที
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100/60 font-semibold shrink-0 h-7 px-3 rounded-lg border border-indigo-200/60 dark:border-indigo-800"
          >
            ค้นหา / เปลี่ยนที่พัก
          </Button>
        </div>
      ) : (
        /* Hotel Cards — horizontal scroll */
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
            {accommodations.map((hotel) => (
              <DraggableHotelCard
                key={hotel.id}
                hotel={hotel as any}
                onAdd={handleAdd}
                daysCount={daysCount}
                cityName={locationName}
                checkInDate={checkInStr}
                checkOutDate={checkOutStr}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Drag a hotel card into a day column, or click "Add to Itinerary" to select a specific check-in/out date and time.
          </p>
        </div>
      )}
    </div>
  );
};

export default AIAccommodations;
