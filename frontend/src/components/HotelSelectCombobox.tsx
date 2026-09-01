/**
 * HotelSelectCombobox — Hotel search with Google Places Service
 *
 * Uses PlacesService.textSearch (and AutocompleteService fallback)
 * which works reliably on all Google Maps API keys without requiring
 * Places API (New) to be explicitly enabled in Google Cloud Console.
 */
import { useState, useEffect, useRef } from "react";
import {
  Loader2, BedDouble, Search, MapPin, Star,
  Globe, Phone, ExternalLink, Sparkles,
} from "lucide-react";
import { importMapsLibrary } from "@/lib/mapsLoader";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface HotelDetails {
  name: string;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  rating?: number;
  userRatingsTotal?: number;
  address?: string;
  website?: string;
  phone?: string;
  placeId?: string;
}

interface HotelSelectComboboxProps {
  value: string;
  onChange: (name: string, lat?: number, lng?: number, details?: HotelDetails) => void;
  destinationName?: string;
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
  placeholder = "พิมพ์ชื่อโรงแรมเพื่อค้นหา...",
  id,
}: HotelSelectComboboxProps) => {
  const [query, setQuery]                 = useState("");
  const [isOpen, setIsOpen]               = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [topCandidates, setTopCandidates]   = useState<HotelDetails[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<HotelDetails | null>(null);
  const [searched, setSearched]           = useState(false);
  const [initError, setInitError]         = useState<string | null>(null);

  const containerRef    = useRef<HTMLDivElement>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placesService   = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteSvc = useRef<google.maps.places.AutocompleteService | null>(null);

  // ── Preload Places library on mount ─────────────────────────────────────────
  useEffect(() => {
    importMapsLibrary("places")
      .then(() => {
        if (typeof google !== "undefined" && google.maps?.places) {
          if (!placesService.current) {
            const dummyDiv = document.createElement("div");
            placesService.current = new google.maps.places.PlacesService(dummyDiv);
          }
          if (!autocompleteSvc.current) {
            autocompleteSvc.current = new google.maps.places.AutocompleteService();
          }
        }
      })
      .catch((err) => {
        setInitError("Failed to load Google Places.");
        console.error("[HotelSearch] importLibrary error:", err);
      });
  }, []);

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

  // ── Debounced search using PlacesService.textSearch ──────────────────────────
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
        // Lazy-ensure places library
        if (!placesService.current) {
          await importMapsLibrary("places");
          if (typeof google !== "undefined" && google.maps?.places && !placesService.current) {
            const dummyDiv = document.createElement("div");
            placesService.current = new google.maps.places.PlacesService(dummyDiv);
          }
        }

        if (!placesService.current) {
          throw new Error("Google Places Service is not available.");
        }

        // Build clean search query
        const qLower = query.toLowerCase();
        const hasHotelWord = qLower.includes("hotel") || qLower.includes("โรงแรม") || qLower.includes("resort") || qLower.includes("รีสอร์ท");
        const term = hasHotelWord ? query : `${query} hotel`;
        const searchInput = destinationName && !qLower.includes(destinationName.toLowerCase())
          ? `${term} ${destinationName}`
          : term;

        // Call textSearch
        placesService.current.textSearch(
          { query: searchInput, type: "lodging" },
          (results, status) => {
            setSearched(true);
            setIsLoading(false);

            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              const candidates: HotelDetails[] = results.slice(0, 3).map((place) => {
                const lat = place.geometry?.location?.lat();
                const lng = place.geometry?.location?.lng();
                const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 300 });

                return {
                  name: place.name || query,
                  lat,
                  lng,
                  photoUrl,
                  rating: place.rating,
                  userRatingsTotal: place.user_ratings_total,
                  address: place.formatted_address,
                  placeId: place.place_id,
                };
              });

              setTopCandidates(candidates);
            } else {
              // Fallback to textSearch without type filter if lodging type filter returned 0
              placesService.current?.textSearch(
                { query: searchInput },
                (fallbackResults, fallbackStatus) => {
                  if (fallbackStatus === google.maps.places.PlacesServiceStatus.OK && fallbackResults && fallbackResults.length > 0) {
                    const fallbackCandidates: HotelDetails[] = fallbackResults.slice(0, 3).map((place) => ({
                      name: place.name || query,
                      lat: place.geometry?.location?.lat(),
                      lng: place.geometry?.location?.lng(),
                      photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 300 }),
                      rating: place.rating,
                      userRatingsTotal: place.user_ratings_total,
                      address: place.formatted_address,
                      placeId: place.place_id,
                    }));
                    setTopCandidates(fallbackCandidates);
                  } else {
                    setTopCandidates([]);
                  }
                }
              );
            }
          }
        );
      } catch (err: any) {
        console.error("[HotelSearch] Search error:", err?.message ?? err);
        setTopCandidates([]);
        setIsLoading(false);
        setSearched(true);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, destinationName]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSelect = (candidate: HotelDetails) => {
    setSelectedDetails(candidate);
    onChange(candidate.name, candidate.lat, candidate.lng, candidate);
    setIsOpen(false);
    setQuery("");
    setTopCandidates([]);
    setSearched(false);

    // Fetch extra details (website, phone) in background for selected hotel card
    if (candidate.placeId && placesService.current) {
      placesService.current.getDetails(
        {
          placeId: candidate.placeId,
          fields: ["website", "formatted_phone_number"],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const enriched: HotelDetails = {
              ...candidate,
              website: place.website || candidate.website,
              phone: place.formatted_phone_number || candidate.phone,
            };
            setSelectedDetails(enriched);
            onChange(enriched.name, enriched.lat, enriched.lng, enriched);
          }
        }
      );
    }
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

      {/* Init error banner */}
      {initError && (
        <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          ⚠️ {initError}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          placeholder={value ? `🔄 เปลี่ยนที่พัก (${value})...` : placeholder}
          className="w-full h-11 pl-9 pr-32 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all font-medium"
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-background pl-1">
            <span className="text-[10px] text-muted-foreground">กำลังค้นหา...</span>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 top-[48px] left-0 right-0 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden p-2.5 space-y-2">

          {/* Header */}
          <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-border/60">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              ผลการค้นหาที่พัก — Top 3
            </span>
          </div>

          {/* Skeletons while loading */}
          {isLoading && topCandidates.length === 0 && (
            <> <SkeletonCard /> <SkeletonCard /> <SkeletonCard /> </>
          )}

          {/* Rich candidate cards */}
          {topCandidates.map((c) => (
            <div
              key={c.placeId ?? c.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(c)}
              className="p-2.5 border border-border/70 hover:border-primary/50 rounded-xl bg-card hover:bg-primary/5 transition-all cursor-pointer hover:shadow-md flex gap-3 group"
            >
              {/* Photo */}
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/50">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-primary/10 text-primary">
                    <BedDouble className="w-6 h-6" />
                    <span className="text-[8px] font-semibold mt-1">ที่พัก</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1 pt-0.5">
                <h5 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight">
                  {c.name}
                </h5>

                {/* Rating */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {c.rating != null && (
                    <>
                      <span className="font-extrabold text-amber-500 text-[12px]">
                        {c.rating.toFixed(1)}
                      </span>
                      <StarRow rating={c.rating} />
                      {c.userRatingsTotal != null && (
                        <span className="text-muted-foreground text-[11px]">
                          ({c.userRatingsTotal.toLocaleString()})
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold">
                    🏨 โรงแรม / ที่พัก
                  </span>
                </div>

                {/* Address */}
                {c.address && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    <span>{c.address}</span>
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* No results */}
          {!isLoading && searched && topCandidates.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>ไม่พบที่พักที่ตรงกับ &quot;{query}&quot;</p>
              <p className="text-[11px] mt-1 opacity-70">ลองค้นหาด้วยชื่อภาษาอังกฤษ หรือชื่อย่อ</p>
            </div>
          )}
        </div>
      )}

      {/* Selected Hotel Card */}
      {value && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10 p-3.5 flex gap-3.5 items-center shadow-sm">
          {/* Photo */}
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/50">
            {selectedDetails?.photoUrl ? (
              <img src={selectedDetails.photoUrl} alt={value} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-primary/10 text-primary">
                <BedDouble className="w-7 h-7" />
                <span className="text-[9px] font-semibold mt-1">ที่พัก</span>
              </div>
            )}
            {selectedDetails?.rating != null && (
              <div className="absolute bottom-1 left-1 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] text-white font-bold">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                {selectedDetails.rating.toFixed(1)}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  ✓ เลือกที่พักแล้ว
                </span>
                <h4 className="text-sm font-bold text-foreground line-clamp-1 leading-tight mt-0.5">
                  {value}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors shrink-0 border border-border/60 whitespace-nowrap"
              >
                เปลี่ยนที่พัก
              </button>
            </div>

            {selectedDetails?.address && (
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed flex items-start gap-1">
                <MapPin className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span>{selectedDetails.address}</span>
              </p>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {selectedDetails?.lat && selectedDetails?.lng && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedDetails.lat},${selectedDetails.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/20 transition-colors"
                >
                  <MapPin className="w-2.5 h-2.5" />
                  <span>Google Maps</span>
                  <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                </a>
              )}
              {selectedDetails?.website && (
                <a
                  href={selectedDetails.website}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted px-2 py-0.5 rounded-md transition-colors"
                >
                  <Globe className="w-2.5 h-2.5" />
                  <span>เว็บไซต์</span>
                </a>
              )}
              {selectedDetails?.phone && (
                <a
                  href={`tel:${selectedDetails.phone}`}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted px-2 py-0.5 rounded-md transition-colors"
                >
                  <Phone className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[90px]">{selectedDetails.phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
