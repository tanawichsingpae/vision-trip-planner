/**
 * HotelSelectCombobox — Hotel search powered by Mapbox Search Box, Geoapify & Foursquare
 */
import { useState, useEffect, useRef } from "react";
import {
  Loader2, BedDouble, Search, MapPin, Star,
  Globe, Phone, ExternalLink, Sparkles,
} from "lucide-react";
import { searchHotels, type HotelDetails } from "@/services/hotelService";

export type { HotelDetails };

interface HotelSelectComboboxProps {
  value: string;
  onChange: (name: string, lat?: number, lng?: number, details?: HotelDetails) => void;
  destinationName?: string;
  destinationCoords?: { lat: number; lng: number };
  placeholder?: string;
  id?: string;
}

// ── Helper components ──────────────────────────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3 h-3 ${n <= rounded
            ? "fill-amber-400 text-amber-400"
            : "fill-transparent text-amber-300"}`}
        />
      ))}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="p-2.5 border border-border/40 rounded-xl bg-card flex gap-3 animate-pulse">
      <div className="w-20 h-20 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 bg-muted rounded-md w-3/4" />
        <div className="h-2.5 bg-muted rounded-md w-2/5" />
        <div className="h-2 bg-muted rounded-md w-full mt-2" />
        <div className="h-2 bg-muted rounded-md w-4/5" />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export const HotelSelectCombobox = ({
  value,
  onChange,
  destinationName = "",
  destinationCoords,
  placeholder = "พิมพ์ชื่อโรงแรมเพื่อค้นหา...",
  id,
}: HotelSelectComboboxProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [topCandidates, setTopCandidates] = useState<HotelDetails[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<HotelDetails | null>(null);
  const [searched, setSearched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Close on outside click ───────────────────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // ── Debounced search using Multi-Tier Hotel Service (Mapbox + Geoapify + FSQ) ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setTopCandidates([]);
      setIsLoading(false);
      setSearched(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const candidates = await searchHotels(query, {
          proximity: destinationCoords,
          destinationName,
          limit: 6,
        });

        setTopCandidates(candidates);
        setSearched(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error("[HotelSearch] Search error:", err?.message ?? err);
        setTopCandidates([]);
        setIsLoading(false);
        setSearched(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, destinationName, destinationCoords]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSelect = (candidate: HotelDetails) => {
    setSelectedDetails(candidate);
    onChange(candidate.name, candidate.lat, candidate.lng, candidate);
    setIsOpen(false);
    setQuery("");
    setTopCandidates([]);
    setSearched(false);
  };

  const handleClear = () => {
    setSelectedDetails(null);
    onChange("", undefined, undefined, undefined);
    setQuery("");
    setTopCandidates([]);
    setSearched(false);
    setIsOpen(true);
  };

  const showDropdown =
    isOpen && query.trim().length > 0 && (isLoading || topCandidates.length > 0 || searched);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          placeholder={value ? `🔄 เปลี่ยนที่พัก (${value})...` : placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          className="w-full pl-9 pr-8 py-2.5 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-sm"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-popover/95 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="p-3 space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {!isLoading && topCandidates.length === 0 && searched && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <BedDouble className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium">ไม่พบโรงแรมชื่อนี้</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                ลองพิมพ์ชื่อโรงแรมภาษาอังกฤษ หรือระบุเมืองเพิ่มเติม
              </p>
            </div>
          )}

          {!isLoading && topCandidates.length > 0 && (
            <div className="p-2 space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                ผลการค้นหาแนะนำ ({topCandidates.length})
              </div>
              {topCandidates.map((hotel, idx) => (
                <button
                  key={hotel.placeId || idx}
                  type="button"
                  onClick={() => handleSelect(hotel)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-accent/60 transition-colors flex gap-3 items-center group cursor-pointer"
                >
                  {hotel.photoUrl ? (
                    <img
                      src={hotel.photoUrl}
                      alt={hotel.name}
                      className="w-14 h-14 rounded-lg object-cover bg-muted shrink-0 border border-border/50 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <BedDouble className="w-6 h-6 text-primary" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {hotel.name}
                      </p>
                    </div>

                    {hotel.rating && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StarRow rating={hotel.rating} />
                        <span className="text-xs font-semibold text-amber-500">
                          {hotel.rating.toFixed(1)}
                        </span>
                        {hotel.userRatingsTotal && (
                          <span className="text-[11px] text-muted-foreground">
                            ({hotel.userRatingsTotal.toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}

                    {hotel.address && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/60" />
                        {hotel.address}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Hotel Card */}
      {selectedDetails && (
        <div className="p-3.5 border border-primary/30 rounded-2xl bg-primary/5 flex gap-3.5 items-center justify-between shadow-sm relative overflow-hidden">
          <div className="flex gap-3 items-center min-w-0">
            {selectedDetails.photoUrl ? (
              <img
                src={selectedDetails.photoUrl}
                alt={selectedDetails.name}
                className="w-14 h-14 rounded-xl object-cover bg-muted shrink-0 border border-border"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <BedDouble className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                  <BedDouble className="w-3 h-3" /> ที่พักที่เลือก
                </span>
                {selectedDetails.rating && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {selectedDetails.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="font-bold text-sm text-foreground truncate mt-0.5">
                {selectedDetails.name}
              </p>
              {selectedDetails.address && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {selectedDetails.address}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-medium text-muted-foreground hover:text-destructive shrink-0 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            เปลี่ยน
          </button>
        </div>
      )}
    </div>
  );
};
