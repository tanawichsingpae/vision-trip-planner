import { useState } from "react";
import { MapPin, X, Filter, ArrowRightLeft, Eye, ChevronDown } from "lucide-react";
import { type ImageCandidate } from "@/services/aiService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface LocationData {
  name: string;
  type: string;
  country: string;
  coordinates: { lat: number; lng: number };
  weather: string;
  temperature: string;
  airQuality: string;
  timezone: string;
  sunlight: string;
}

interface LocationDisplayProps {
  useClip?: boolean;
  locations: Array<{
    place: string;
    type: string;
    country: string;
    confidence?: number;
    similar_locations?: Array<{ name: string; similarity: number }>;
    ai_reasoning?: string[];
    initial_candidates?: ImageCandidate[];
    top_candidates?: ImageCandidate[];
    distanceKm?: number;
    isExcursion?: boolean;
    uploadedImageUrl?: string;
  }>;
  outliersCount?: number;
  onOpenOutliersReport?: () => void;
  onRemoveLocation?: (index: number) => void;
  onSwitchCandidate?: (index: number, candidate: ImageCandidate) => void;
}

const LocationDisplay = ({
  locations,
  useClip = true,
  outliersCount = 0,
  onOpenOutliersReport,
  onRemoveLocation,
  onSwitchCandidate,
}: LocationDisplayProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header section */}
      <div className="space-y-2 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Step 2 of 4
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
          Identified locations
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Vision AI found {locations.length} {locations.length === 1 ? "place" : "places"} from your photos. Remove anything that doesn't belong.
        </p>
      </div>

      {/* Outlier Alert Banner if any */}
      {outliersCount > 0 && onOpenOutliersReport && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <Filter className="size-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                Vision AI ตรวจพบ Outlier หรือสถานที่ที่ต้องตรวจสอบ {outliersCount} แห่ง
              </p>
              <p className="text-xs text-muted-foreground">
                แยกสถานที่นอกพื้นที่หลักเพื่อให้คุณยืนยันก่อนจัดแผนทริป
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenOutliersReport}
            className="rounded-xl border-amber-500/30 bg-card hover:bg-amber-500/20 text-xs font-semibold shrink-0 gap-1.5"
          >
            <Eye className="size-3.5" /> รายงาน Outlier ({outliersCount})
          </Button>
        </div>
      )}

      {/* 3-Column Card Grid (Pixinerary_2) */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {locations.map((loc, i) => {
          const imgSrc = loc.uploadedImageUrl || loc.top_candidates?.[0]?.photo_url || `https://picsum.photos/seed/${encodeURIComponent(loc.place)}/800/600`;
          const altCandidates = (loc.top_candidates || loc.initial_candidates || [])
            .filter(c => c.name.toLowerCase() !== loc.place.toLowerCase())
            .slice(0, 2);

          const isExpanded = expandedIndex === i;

          return (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs transition-all hover:shadow-xs flex flex-col"
            >
              {/* Image with overlay and Delete button */}
              <div className="relative h-32 w-full overflow-hidden bg-muted">
                <img
                  src={imgSrc}
                  alt={loc.place}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "https://picsum.photos/seed/travel/800/600";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                {onRemoveLocation && locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveLocation(i)}
                    className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 shadow-xs"
                    title="Remove location"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Card info */}
              <div className="space-y-1.5 p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MapPin className="size-3.5 text-sky-500 shrink-0" />
                    <span className="truncate">{loc.place}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{loc.country}</p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {loc.confidence !== undefined ? (
                    <Badge variant="outline" className="text-[10px] font-medium border-border px-2 py-0.5 rounded-full">
                      {(loc.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-medium border-border px-2 py-0.5 rounded-full">
                      {loc.type}
                    </Badge>
                  )}

                  {altCandidates.length > 0 && onSwitchCandidate && (
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                      className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>สลับชื่อ</span>
                      <ChevronDown className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>

                {/* Optional Candidate Switcher Dropdown */}
                {isExpanded && altCandidates.length > 0 && onSwitchCandidate && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1.5 animate-in fade-in">
                    <span className="text-[10px] text-muted-foreground font-medium">สลับเป็น:</span>
                    {altCandidates.map((cand, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => {
                          onSwitchCandidate(i, cand);
                          setExpandedIndex(null);
                        }}
                        className="flex items-center justify-between p-1.5 rounded-lg text-xs bg-secondary/70 hover:bg-secondary transition-colors text-left"
                      >
                        <span className="truncate font-medium">{cand.name}</span>
                        <ArrowRightLeft className="size-3 text-sky-500 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LocationDisplay;

