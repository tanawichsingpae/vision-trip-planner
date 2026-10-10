/**
 * HotelSelectCombobox — Dual-Mode Hotel search:
 * 1. Search by Name (powered by Mapbox Search Box, Geoapify & Foursquare)
 * 2. Search by Google Maps Link (short links maps.app.goo.gl and full URLs)
 */
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  BedDouble,
  Search,
  MapPin,
  Star,
  Sparkles,
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { searchHotels, type HotelDetails } from "@/services/hotelService";
import {
  isGoogleMapsUrl,
  extractGoogleMapsUrl,
  resolveGoogleMapsUrl,
} from "@/services/googleMapsService";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type { HotelDetails };

interface HotelSelectComboboxProps {
  value?: string;
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
          className={`w-3 h-3 ${
            n <= rounded
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-amber-300"
          }`}
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
  placeholder,
  id,
}: HotelSelectComboboxProps) => {
  const { language } = useLanguage();
  const isTh = language === "th";

  // Search mode: "name" | "link"
  const [searchMode, setSearchMode] = useState<"name" | "link">("name");

  // Name search states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [topCandidates, setTopCandidates] = useState<HotelDetails[]>([]);
  const [searched, setSearched] = useState(false);

  // Link search states
  const [linkInput, setLinkInput] = useState("");
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Selected hotel details
  const [selectedDetails, setSelectedDetails] = useState<HotelDetails | null>(() => {
    if (value) {
      return { name: value };
    }
    return null;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if value prop changes from outside and differs
  useEffect(() => {
    if (value && (!selectedDetails || selectedDetails.name !== value)) {
      setSelectedDetails((prev) => (prev ? { ...prev, name: value } : { name: value }));
    } else if (!value && selectedDetails) {
      setSelectedDetails(null);
    }
  }, [value]);

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

  // ── Debounced search using Multi-Tier Hotel Service ───────────────────────────
  useEffect(() => {
    if (searchMode !== "name") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setTopCandidates([]);
      setIsLoading(false);
      setSearched(false);
      return;
    }

    // Auto-detect if user pasted a Google Maps link in the name input!
    if (isGoogleMapsUrl(trimmed)) {
      setSearchMode("link");
      setLinkInput(trimmed);
      setQuery("");
      handleResolveLink(trimmed);
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
  }, [query, destinationName, destinationCoords, searchMode]);

  // ── Google Maps Link Resolution Handler ──────────────────────────────────────
  const handleResolveLink = async (overrideUrl?: string) => {
    const rawUrl = (overrideUrl || linkInput).trim();
    if (!rawUrl) {
      setLinkError(
        isTh
          ? "กรุณาวางลิงก์ Google Maps ของที่พัก"
          : "Please paste a Google Maps hotel link"
      );
      return;
    }

    const cleanUrl = extractGoogleMapsUrl(rawUrl) || rawUrl;
    if (!isGoogleMapsUrl(cleanUrl)) {
      setLinkError(
        isTh
          ? "ลิงก์นี้ไม่ใช่ลิงก์ Google Maps ที่ถูกต้อง (เช่น maps.app.goo.gl หรือ google.com/maps)"
          : "Invalid Google Maps URL (must be maps.app.goo.gl or google.com/maps)"
      );
      return;
    }

    setIsResolvingLink(true);
    setLinkError(null);

    try {
      const resolved = await resolveGoogleMapsUrl(cleanUrl, {
        destinationCoords,
        destinationName,
      });

      setSelectedDetails(resolved);
      onChange(resolved.name, resolved.lat, resolved.lng, resolved);
      setLinkInput("");
      toast.success(
        isTh
          ? `ระบุที่พักจาก Google Maps: ${resolved.name}`
          : `Selected from Google Maps: ${resolved.name}`
      );
    } catch (err: any) {
      console.error("[HotelSearch] Link resolution error:", err);
      const msg = err?.message || (isTh ? "ไม่สามารถดึงข้อมูลที่พักจากลิงก์นี้ได้" : "Failed to resolve link");
      setLinkError(msg);
      toast.error(msg);
    } finally {
      setIsResolvingLink(false);
    }
  };

  // ── Selection Handlers ────────────────────────────────────────────────────────
  const handleSelectCandidate = (candidate: HotelDetails) => {
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
    setLinkInput("");
    setLinkError(null);
    setTopCandidates([]);
    setSearched(false);
    setIsOpen(true);
  };

  const showDropdown =
    isOpen && query.trim().length > 0 && (isLoading || topCandidates.length > 0 || searched);

  const defaultNamePlaceholder = isTh
    ? "พิมพ์ชื่อโรงแรมเพื่อค้นหา..."
    : "Type hotel name to search...";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full space-y-3">
      {/* Search Mode Switcher Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center p-1 rounded-xl bg-muted/60 border border-border/50 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setSearchMode("name");
              setLinkError(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              searchMode === "name"
                ? "bg-card text-foreground font-semibold shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="w-3.5 h-3.5 text-primary" />
            <span>{isTh ? "ค้นหาจากชื่อโรงแรม" : "Search by Name"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchMode("link");
              setIsOpen(false);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              searchMode === "link"
                ? "bg-card text-foreground font-semibold shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>{isTh ? "ลิงก์ Google Maps" : "Google Maps Link"}</span>
          </button>
        </div>

        {selectedDetails && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isTh ? "เลือกที่พักแล้ว" : "Hotel Selected"}
          </span>
        )}
      </div>

      {/* Mode 1: Search by Name */}
      {searchMode === "name" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            id={id}
            type="text"
            autoComplete="off"
            value={query}
            placeholder={
              selectedDetails?.name
                ? `🔄 ${isTh ? "เปลี่ยนที่พัก" : "Change hotel"} (${selectedDetails.name})...`
                : placeholder || defaultNamePlaceholder
            }
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && topCandidates.length > 0) {
                e.preventDefault();
                handleSelectCandidate(topCandidates[0]);
              }
            }}
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-xs"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
      )}

      {/* Mode 2: Search by Google Maps Link */}
      {searchMode === "link" && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
              <input
                type="url"
                autoComplete="off"
                value={linkInput}
                placeholder={
                  isTh
                    ? "วางลิงก์ เช่น https://maps.app.goo.gl/... หรือ google.com/maps/place/..."
                    : "Paste Google Maps link e.g. https://maps.app.goo.gl/... or google.com/maps/place/..."
                }
                onChange={(e) => {
                  setLinkInput(e.target.value);
                  setLinkError(null);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted && isGoogleMapsUrl(pasted)) {
                    setTimeout(() => handleResolveLink(pasted), 100);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleResolveLink();
                  }
                }}
                disabled={isResolvingLink}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-indigo-300 dark:border-indigo-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all placeholder:text-muted-foreground/60 shadow-xs"
              />
            </div>
            <Button
              type="button"
              onClick={() => handleResolveLink()}
              disabled={isResolvingLink || !linkInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl px-4 h-10 gap-1.5 shrink-0 shadow-xs"
            >
              {isResolvingLink ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isTh ? "กำลังดึงข้อมูล..." : "Fetching..."}</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>{isTh ? "ดึงข้อมูลที่พัก" : "Fetch Hotel"}</span>
                </>
              )}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span>💡</span>
            <span>
              {isTh
                ? "รองรับทั้งลิงก์ย่อจากการแชร์ (maps.app.goo.gl) และลิงก์เต็มบนเบราว์เซอร์"
                : "Supports mobile share links (maps.app.goo.gl) and browser URLs"}
            </span>
          </p>

          {linkError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p className="font-semibold">{linkError}</p>
                <p className="text-[11px] text-destructive/80 mt-0.5">
                  {isTh
                    ? "คำแนะนำ: ลองเปิดลิงก์ในเบราว์เซอร์ รอให้หน้าเว็บโหลดเต็มที่ แล้วคัดลอก URL ด้านบนมาวางแทนครับ"
                    : "Tip: Open the link in browser, let it fully load, and copy the full address bar URL here."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropdown Results for Name Mode */}
      {showDropdown && searchMode === "name" && (
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
              <p className="font-medium">{isTh ? "ไม่พบโรงแรมชื่อนี้" : "No hotel found"}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {isTh
                  ? "ลองพิมพ์ชื่อโรงแรมภาษาอังกฤษ หรือสลับไปใช้แท็บ \"ลิงก์ Google Maps\""
                  : "Try typing in English or switch to the Google Maps Link tab"}
              </p>
            </div>
          )}

          {!isLoading && topCandidates.length > 0 && (
            <div className="p-2 space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                {isTh
                  ? `ผลการค้นหาแนะนำ (${topCandidates.length})`
                  : `Suggested hotels (${topCandidates.length})`}
              </div>
              {topCandidates.map((hotel, idx) => (
                <button
                  key={hotel.placeId || idx}
                  type="button"
                  onClick={() => handleSelectCandidate(hotel)}
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
                    <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {hotel.name}
                    </p>

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
        <div className="p-3.5 border border-primary/30 rounded-2xl bg-primary/5 flex gap-3.5 items-center justify-between shadow-xs relative overflow-hidden animate-in fade-in duration-200">
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                  <BedDouble className="w-3 h-3" />
                  {isTh ? "ที่พักที่เลือก" : "Selected Accommodation"}
                </span>
                {selectedDetails.lat !== undefined && selectedDetails.lng !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground">
                    <MapPin className="w-2.5 h-2.5 text-primary" />
                    {selectedDetails.lat.toFixed(4)}, {selectedDetails.lng.toFixed(4)}
                  </span>
                )}
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
            className="text-xs font-medium text-muted-foreground hover:text-destructive shrink-0 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            {isTh ? "เปลี่ยน" : "Change"}
          </button>
        </div>
      )}
    </div>
  );
};
