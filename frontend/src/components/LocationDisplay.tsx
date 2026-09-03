import { useState } from "react";
import {
  MapPin,
  X,
  Filter,
  ArrowRightLeft,
  Eye,
  ChevronDown,
  CameraOff,
  AlertTriangle,
  Upload,
  Info,
  Sparkles,
} from "lucide-react";
import { type ImageCandidate } from "@/services/aiService";
import { type OutlierItem } from "@/components/VisionOutlierModal";
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
  outliers?: OutlierItem[];
  outliersCount?: number;
  onOpenOutliersReport?: () => void;
  onRemoveLocation?: (index: number) => void;
  onSwitchCandidate?: (index: number, candidate: ImageCandidate) => void;
  onUploadNewPhotos?: () => void;
}

const LocationDisplay = ({
  locations,
  useClip = true,
  outliers = [],
  outliersCount = 0,
  onOpenOutliersReport,
  onRemoveLocation,
  onSwitchCandidate,
  onUploadNewPhotos,
}: LocationDisplayProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const effectiveOutlierCount = outliers.length > 0 ? outliers.length : outliersCount;
  const nonTravelCount = outliers.filter((o) => o.category === "NON_TRAVEL").length;
  const otherOutlierCount = effectiveOutlierCount - nonTravelCount;

  // Empty State: When all images were filtered out as outliers
  if (locations.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
            <CameraOff className="size-3.5" /> Place Verification Guard
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            ไม่พบภาพสถานที่ท่องเที่ยวที่ระบุได้
          </h1>
          <p className="mx-auto max-w-md text-xs sm:text-sm leading-relaxed text-muted-foreground">
            ระบบ AI ได้ตรวจสอบภาพถ่ายที่คุณอัปโหลดแล้วพบว่าเป็นภาพที่ไม่ใช่วิว/สถานที่ท่องเที่ยว
            จึงแยกออกเพื่อไม่ให้แผนการเดินทางคลาดเคลื่อน
          </p>
        </div>

        {/* Filtered Out Summary Box */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground">
              <AlertTriangle className="size-4 text-amber-500" />
              <span>ภาพที่ถูกคัดกรองออก ({effectiveOutlierCount} ภาพ)</span>
            </div>
            {onOpenOutliersReport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenOutliersReport}
                className="h-7 text-xs rounded-xl border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
              >
                <Eye className="size-3 mr-1" /> ตรวจสอบใน Outlier Modal
              </Button>
            )}
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {outliers.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-secondary/40 border border-border/60 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 overflow-hidden border border-red-500/20">
                    {item.photoUrl || item.originalResult.uploadedImageUrl ? (
                      <img
                        src={item.photoUrl || item.originalResult.uploadedImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <CameraOff className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{item.place}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.reasonDescription || "ระบบประเมินว่าภาพนี้ไม่ใช่สถานที่ท่องเที่ยว"}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="shrink-0 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px]"
                >
                  {item.category === "NON_TRAVEL" ? "ไม่ใช่สถานที่" : "อยู่นอกเขต"}
                </Badge>
              </div>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center gap-3 justify-center">
            {onUploadNewPhotos && (
              <Button
                onClick={onUploadNewPhotos}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-md gap-2"
              >
                <Upload className="size-4" />
                <span>อัปโหลดภาพสถานที่ท่องเที่ยวใหม่</span>
              </Button>
            )}
            {onOpenOutliersReport && (
              <Button
                variant="outline"
                onClick={onOpenOutliersReport}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-border hover:bg-secondary text-xs font-semibold gap-1.5"
              >
                <Sparkles className="size-3.5 text-primary" />
                <span>ระบุชื่อสถานที่เอง / กู้คืนภาพ</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
          Vision AI ตรวจพบ {locations.length} สถานที่ท่องเที่ยวที่พร้อมสำหรับการวางแผน
        </p>
      </div>

      {/* Outlier Alert Banner if any */}
      {effectiveOutlierCount > 0 && onOpenOutliersReport && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <Filter className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs sm:text-sm font-bold text-foreground">
                  AI ช่วยคัดกรองภาพออก {effectiveOutlierCount} รายการ
                </p>
                {nonTravelCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] px-2 py-0"
                  >
                    🚫 ไม่ใช่สถานที่ {nonTravelCount} ภาพ
                  </Badge>
                )}
                {otherOutlierCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] px-2 py-0"
                  >
                    📍 นอกพื้นที่/รอตรวจ {otherOutlierCount} แห่ง
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                คลิกเพื่อตรวจสอบ กู้คืน หรือระบุชื่อสถานที่เองได้ทุกเมื่อ
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenOutliersReport}
            className="rounded-xl border-amber-500/30 bg-card hover:bg-amber-500/20 text-xs font-semibold shrink-0 gap-1.5 shadow-2xs"
          >
            <Eye className="size-3.5" /> ตรวจสอบ Outlier ({effectiveOutlierCount})
          </Button>
        </div>
      )}

      {/* 3-Column Card Grid (Pixinerary_2) */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {locations.map((loc, i) => {
          const imgSrc =
            loc.uploadedImageUrl ||
            loc.top_candidates?.[0]?.photo_url ||
            `https://picsum.photos/seed/${encodeURIComponent(loc.place)}/800/600`;
          const altCandidates = (
            loc.top_candidates ||
            loc.initial_candidates ||
            []
          )
            .filter((c) => c.name.toLowerCase() !== loc.place.toLowerCase())
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loc.country && loc.country !== "-" ? loc.country : "Tourist Attraction"}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {loc.confidence !== undefined && loc.confidence > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium border-border px-2 py-0.5 rounded-full"
                    >
                      {(loc.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium border-border px-2 py-0.5 rounded-full"
                    >
                      {loc.type || "place"}
                    </Badge>
                  )}

                  {altCandidates.length > 0 && onSwitchCandidate && (
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                      className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>สลับชื่อ</span>
                      <ChevronDown
                        className={`size-3 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Optional Candidate Switcher Dropdown */}
                {isExpanded && altCandidates.length > 0 && onSwitchCandidate && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1.5 animate-in fade-in">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      สลับเป็น:
                    </span>
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
