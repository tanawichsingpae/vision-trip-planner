import { useState, useEffect } from "react";
import {
  Calendar,
  MapPin,
  Clock,
  Trash2,
  Plus,
  ArrowRight,
  Sparkles,
  Plane,
  X,
  MessageSquare,
  Compass,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUserTrips, deleteTrip, type TripRecord } from "@/services/tripService";
import { getAIModelInfo } from "@/context/AIProviderContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface TripCardCoverCollageProps {
  trip: TripRecord;
}

/**
 * Renders a smart photo collage using uploaded photos from the trip.
 * Supports: Single image, 2-split, 3-asymmetric split, and 4+ grid layout.
 */
export const TripCardCoverCollage = ({ trip }: TripCardCoverCollageProps) => {
  // 1. Gather all unique uploaded / detected location images
  const uploadedImages = (trip.detected_locations || [])
    .map((l) => l.uploadedImageUrl)
    .filter((url): url is string => Boolean(url && url.trim().length > 0));

  // 2. Fallback to activity photos from itinerary if no uploaded images
  const activityImages = (trip.itinerary || [])
    .flatMap((day) => day.activities || [])
    .map((act) => act.image_url || act.photo_url)
    .filter((url): url is string => Boolean(url && url.trim().length > 0 && !url.includes("placeholder")));

  // 3. Fallback to suggestions photos
  const suggestionImages = (trip.suggestions || [])
    .map((s) => s.photo_url)
    .filter((url): url is string => Boolean(url && url.trim().length > 0 && !url.includes("placeholder")));

  // 4. Combine in priority order, removing duplicates
  const rawList = [
    ...uploadedImages,
    ...(uploadedImages.length === 0 && trip.cover_image ? [trip.cover_image] : []),
    ...(uploadedImages.length === 0 ? activityImages : []),
    ...(uploadedImages.length === 0 ? suggestionImages : []),
  ];

  const uniqueImages = Array.from(new Set(rawList));
  const hasUploaded = uploadedImages.length > 0;

  // Final fallback if no images at all
  const defaultPlaceholder = `https://picsum.photos/seed/${encodeURIComponent(trip.destination || "travel")}/600/400`;
  const displayImages = uniqueImages.length > 0 ? uniqueImages : [defaultPlaceholder];

  const renderImg = (src: string, alt: string, extraClass = "") => (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-muted/60 ${extraClass}`}
      onError={(e) => {
        e.currentTarget.src = defaultPlaceholder;
      }}
    />
  );

  return (
    <div className="relative h-44 w-full overflow-hidden bg-muted">
      {/* ── 1 Photo: Full Single Cover ── */}
      {displayImages.length === 1 && (
        <div className="w-full h-full">
          {renderImg(displayImages[0], trip.title)}
        </div>
      )}

      {/* ── 2 Photos: 50% / 50% 2-Column Split ── */}
      {displayImages.length === 2 && (
        <div className="grid grid-cols-2 w-full h-full gap-0.5">
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[0], `${trip.title} 1`)}
          </div>
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[1], `${trip.title} 2`)}
          </div>
        </div>
      )}

      {/* ── 3 Photos: 1 Left Big (50%) + 2 Right Stacked (50%) ── */}
      {displayImages.length === 3 && (
        <div className="grid grid-cols-2 w-full h-full gap-0.5">
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[0], `${trip.title} 1`)}
          </div>
          <div className="grid grid-rows-2 w-full h-full gap-0.5">
            <div className="relative w-full h-full overflow-hidden">
              {renderImg(displayImages[1], `${trip.title} 2`)}
            </div>
            <div className="relative w-full h-full overflow-hidden">
              {renderImg(displayImages[2], `${trip.title} 3`)}
            </div>
          </div>
        </div>
      )}

      {/* ── 4+ Photos: 2x2 Grid with +N Badge ── */}
      {displayImages.length >= 4 && (
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[0], `${trip.title} 1`)}
          </div>
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[1], `${trip.title} 2`)}
          </div>
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[2], `${trip.title} 3`)}
          </div>
          <div className="relative w-full h-full overflow-hidden">
            {renderImg(displayImages[3], `${trip.title} 4`)}
            {displayImages.length > 4 && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center text-white font-bold text-xs shadow-inner">
                +{displayImages.length - 3} รูป
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dark gradient overlay for title legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 pointer-events-none" />

      {/* Uploaded Photos Count Badge */}
      {hasUploaded && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-white border border-white/20 text-[10px] font-semibold flex items-center gap-1 shadow-md">
          <Sparkles className="w-3 h-3 text-travel-sand" />
          <span>{uploadedImages.length} ภาพที่อัปโหลด</span>
        </div>
      )}
    </div>
  );
};

interface SavedTripsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip: (trip: TripRecord) => void;
  onNewTrip: () => void;
  currentTripId: string | null;
}

export const SavedTripsModal = ({
  isOpen,
  onClose,
  onSelectTrip,
  onNewTrip,
  currentTripId,
}: SavedTripsModalProps) => {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const data = await getUserTrips();
      setTrips(data);
    } catch (err) {
      console.error("Failed to load saved trips:", err);
      toast.error("ไม่สามารถดึงข้อมูลทริปได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrips();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, tripId: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`คุณต้องการลบ "${title}" หรือไม่?`)) return;

    setDeletingId(tripId);
    try {
      await deleteTrip(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      toast.success(`ลบ "${title}" เรียบร้อยแล้ว`);
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการลบทริป");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/25 text-white shadow-inner">
              <Compass className="size-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                ประวัติทริปของฉัน (Saved Trips)
              </h3>
              <p className="text-xs text-white/80">
                เลือกทริปที่เคยบันทึกไว้เพื่อเปิดแก้ไข ตรวจสอบ หรือคุยต่อกับพิกซ์ (Pix)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onNewTrip();
              }}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Plus className="size-3.5" />
              <span>สร้างทริปใหม่</span>
            </Button>

            <button
              onClick={onClose}
              className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground font-medium">กำลังโหลดรายการทริปของคุณ...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="py-16 text-center max-w-sm mx-auto space-y-4">
              <div className="size-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                <Plane className="size-8" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base">ยังไม่มีทริปที่บันทึกไว้</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  เมื่อคุณสร้างแผนการท่องเที่ยวหรือคุยกับบอทพิกซ์ คุณสามารถกด "Save trip" เพื่อเก็บไว้ดูย้อนหลังได้ตลอดเวลา
                </p>
              </div>
              <Button
                onClick={() => {
                  onClose();
                  onNewTrip();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-xs shadow-2xs"
              >
                <Plus className="size-3.5 mr-1" /> เริ่มวางแผนทริปแรก
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trips.map((trip) => {
                const isCurrent = trip.id === currentTripId;
                const totalActivities = (trip.itinerary || []).reduce(
                  (acc, d) => acc + (d.activities || []).length,
                  0
                );
                const totalMessages = (trip.chat_messages || []).length;
                const updatedDateStr = trip.updated_at
                  ? format(new Date(trip.updated_at), "dd MMM yyyy HH:mm")
                  : "-";

                return (
                  <div
                    key={trip.id}
                    onClick={() => {
                      onSelectTrip(trip);
                      onClose();
                    }}
                    className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 bg-card ${
                      isCurrent
                        ? "border-primary ring-2 ring-primary/20 shadow-xs bg-primary/5"
                        : "border-border/70 hover:border-primary/50"
                    }`}
                  >
                    {/* Dynamic Photo Collage Cover */}
                    <div className="relative">
                      <TripCardCoverCollage trip={trip} />

                      {/* Top Badges (Active Status & AI Model) */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 flex-wrap">
                        {isCurrent && (
                          <div className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-2xs flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-white animate-ping" />
                            กำลังเปิดใช้งาน
                          </div>
                        )}
                        {(() => {
                          const modelKey = trip.preferences?.aiModel || trip.preferences?.ai_model || trip.ai_model;
                          const modelInfo = getAIModelInfo(modelKey);
                          if (!modelInfo) return null;
                          return (
                            <div className="px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-white border border-white/20 text-[10px] font-semibold flex items-center gap-1 shadow-2xs">
                              <Sparkles className="size-3 text-[#ffe0a9]" />
                              <span>{modelInfo.label}</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Title & destination on cover */}
                      <div className="absolute bottom-2.5 left-3.5 right-3.5 text-white z-10 pointer-events-none">
                        <h4 className="font-bold text-base line-clamp-1 drop-shadow-md text-white">
                          {trip.title}
                        </h4>
                        <p className="text-[11px] text-white/90 flex items-center gap-1 drop-shadow-sm font-medium">
                          <MapPin className="size-3 text-travel-sand" />
                          <span>{trip.destination || "ไม่ระบุจุดหมาย"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Meta details */}
                    <div className="p-3.5 flex flex-col justify-between flex-1 gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-md font-medium text-foreground text-[11px]">
                          <Calendar className="size-3 text-primary" />
                          {trip.itinerary?.length || 1} วัน ({totalActivities} กิจกรรม)
                        </span>

                        {totalMessages > 0 && (
                          <span className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-md font-medium text-foreground text-[11px]">
                            <MessageSquare className="size-3 text-emerald-500" />
                            {totalMessages} ข้อความแชท
                          </span>
                        )}

                        {(() => {
                          const modelKey = trip.preferences?.aiModel || trip.preferences?.ai_model || trip.ai_model;
                          const modelInfo = getAIModelInfo(modelKey);
                          if (!modelInfo) return null;
                          return (
                            <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-md font-semibold text-[11px]">
                              <Sparkles className="size-3 text-primary" />
                              {modelInfo.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          แก้ไขเมื่อ {updatedDateStr}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleDelete(e, trip.id, trip.title)}
                            disabled={deletingId === trip.id}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="ลบทริปนี้"
                          >
                            <Trash2 className="size-3.5" />
                          </button>

                          <span className="text-primary font-semibold flex items-center gap-0.5 text-xs group-hover:translate-x-0.5 transition-transform">
                            เปิดดู <ArrowRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

};

