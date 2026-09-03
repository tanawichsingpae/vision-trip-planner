import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CameraOff,
  AlertTriangle,
  Globe,
  Navigation,
  Copy,
  CheckCircle2,
  Sparkles,
  Info,
  ChevronRight,
  Filter,
  Check,
  Trash2,
  ArrowRightLeft,
  MapPin,
  Edit3,
  ShieldAlert,
} from "lucide-react";
import { type VisionResult, type ImageCandidate } from "@/services/aiService";

export type OutlierCategory =
  | "NON_TRAVEL"
  | "LOW_CONFIDENCE"
  | "COUNTRY_MISMATCH"
  | "DISTANCE_EXCEEDED"
  | "DUPLICATE";

export interface OutlierItem {
  id: string;
  place: string;
  country: string;
  category: OutlierCategory;
  reasonTitle: string;
  reasonDescription: string;
  confidence?: number;
  distanceKm?: number;
  majorityCountry?: string;
  photoUrl?: string | null;
  originalResult: VisionResult;
  top_candidates?: ImageCandidate[];
  initial_candidates?: ImageCandidate[];
  canRestore: boolean;
  isExcursion?: boolean;
}

interface VisionOutlierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outliers: OutlierItem[];
  keptLocations: VisionResult[];
  onRestoreLocation: (outlierId: string) => void;
  onDiscardOutlier?: (outlierId: string) => void;
  onDiscardAllNonTravel?: () => void;
  onSwitchCandidate?: (outlierId: string, candidate: ImageCandidate) => void;
  onManualOverridePlace?: (outlierId: string, placeName: string) => void;
  onConfirmProceed?: () => void;
}

const CATEGORY_CONFIG: Record<
  OutlierCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeStyle: string;
    iconBg: string;
    cardBorder: string;
  }
> = {
  NON_TRAVEL: {
    label: "ภาพที่ไม่ใช่สถานที่เที่ยว",
    icon: CameraOff,
    badgeStyle: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    iconBg: "bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400",
    cardBorder: "border-red-500/30 hover:border-red-500/50 bg-red-500/[0.02]",
  },
  LOW_CONFIDENCE: {
    label: "ความเชื่อมั่นต่ำ",
    icon: AlertTriangle,
    badgeStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400",
    cardBorder: "border-amber-500/30 hover:border-amber-500/50 bg-amber-500/[0.02]",
  },
  COUNTRY_MISMATCH: {
    label: "ประเทศไม่สอดคล้อง",
    icon: Globe,
    badgeStyle: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400",
    cardBorder: "border-purple-500/30 hover:border-purple-500/50 bg-purple-500/[0.02]",
  },
  DISTANCE_EXCEEDED: {
    label: "ระยะทางห่างเกิน 70 กม.",
    icon: Navigation,
    badgeStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400",
    cardBorder: "border-blue-500/30 hover:border-blue-500/50 bg-blue-500/[0.02]",
  },
  DUPLICATE: {
    label: "สถานที่ซ้ำซ้อน",
    icon: Copy,
    badgeStyle: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
    iconBg: "bg-slate-100 text-slate-600 dark:bg-slate-900/70 dark:text-slate-400",
    cardBorder: "border-border/70 hover:border-border",
  },
};

export const VisionOutlierModal: React.FC<VisionOutlierModalProps> = ({
  open,
  onOpenChange,
  outliers,
  keptLocations,
  onRestoreLocation,
  onDiscardOutlier,
  onDiscardAllNonTravel,
  onSwitchCandidate,
  onManualOverridePlace,
  onConfirmProceed,
}) => {
  const [activeTab, setActiveTab] = useState<"outliers" | "kept">("outliers");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | OutlierCategory>("ALL");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [customPlaceText, setCustomPlaceText] = useState<string>("");

  const totalAnalyzed = outliers.length + keptLocations.length;
  const nonTravelCount = outliers.filter((o) => o.category === "NON_TRAVEL").length;
  const distanceCount = outliers.filter((o) => o.category === "DISTANCE_EXCEEDED").length;
  const countryMismatchCount = outliers.filter((o) => o.category === "COUNTRY_MISMATCH").length;
  const lowConfidenceCount = outliers.filter((o) => o.category === "LOW_CONFIDENCE").length;

  const filteredOutliers =
    categoryFilter === "ALL"
      ? outliers
      : outliers.filter((o) => o.category === categoryFilter);

  const getCandidatePhoto = (item: OutlierItem): string | null => {
    if (item.photoUrl) return item.photoUrl;
    if (item.originalResult.uploadedImageUrl) return item.originalResult.uploadedImageUrl;
    if (item.originalResult.top_candidates?.[0]?.photo_url) {
      return item.originalResult.top_candidates[0].photo_url;
    }
    if (item.originalResult.initial_candidates?.[0]?.photo_url) {
      return item.originalResult.initial_candidates[0].photo_url;
    }
    return null;
  };

  const handleClose = () => {
    onOpenChange(false);
    if (onConfirmProceed) {
      onConfirmProceed();
    }
  };

  const handleStartEditing = (item: OutlierItem) => {
    setEditingItemId(item.id);
    setCustomPlaceText(item.place.includes("ภาพไม่ระบุ") ? "" : item.place);
  };

  const handleSaveCustomPlace = (itemId: string) => {
    if (customPlaceText.trim() && onManualOverridePlace) {
      onManualOverridePlace(itemId, customPlaceText.trim());
      setEditingItemId(null);
      setCustomPlaceText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border-border/70 bg-card shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-2xs">
              <Filter className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  ตรวจสอบและคัดกรองสถานที่ (Vision AI Guard)
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold"
                >
                  Place Verification
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                ระบบคัดกรองภาพที่ไม่ใช่วิว/แลนด์มาร์กท่องเที่ยว หรืออยู่นอกพื้นที่หลัก เพื่อรักษาความถูกต้องของแผนเดินทาง
              </DialogDescription>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2.5 mt-4 p-2.5 rounded-2xl bg-background/80 border border-border/60">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-secondary/50 border border-border/40">
              <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5 text-foreground/70 shrink-0">
                <Globe className="size-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  ภาพทั้งหมด
                </span>
                <span className="text-sm sm:text-base font-bold text-foreground">{totalAnalyzed}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                  ผ่านเกณฑ์แล้ว
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300">
                  {keptLocations.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">
                  แยกออก/รอตรวจ
                </span>
                <span className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-300">
                  {outliers.length}
                </span>
              </div>
            </div>
          </div>

          {/* Main Tab Navigation */}
          <div className="flex gap-2 mt-3 p-1 rounded-xl bg-secondary/70 border border-border/50">
            <button
              onClick={() => setActiveTab("outliers")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "outliers"
                  ? "bg-background text-foreground shadow-2xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>ภาพที่ถูกแยกออก ({outliers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("kept")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "kept"
                  ? "bg-background text-foreground shadow-2xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>สถานที่ที่พร้อมจัดทริป ({keptLocations.length})</span>
            </button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[55vh]">
          {activeTab === "outliers" ? (
            outliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 mb-3 shadow-2xs">
                  <CheckCircle2 className="size-7" />
                </div>
                <p className="font-bold text-foreground text-sm sm:text-base">
                  ไม่มีภาพที่ต้องตรวจสอบเพิ่มเติม!
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  ทุกภาพของคุณผ่านการคัดกรองเรียบร้อยแล้ว และพร้อมสำหรับการวางแผนการเดินทาง
                </p>
              </div>
            ) : (
              <>
                {/* Category Sub-filter Pills */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        categoryFilter === "ALL"
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ทั้งหมด ({outliers.length})
                    </button>

                    {nonTravelCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryFilter("NON_TRAVEL")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                          categoryFilter === "NON_TRAVEL"
                            ? "bg-red-500 text-white border-red-500 shadow-2xs"
                            : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        <CameraOff className="size-3" />
                        <span>ไม่ใช่สถานที่ ({nonTravelCount})</span>
                      </button>
                    )}

                    {distanceCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryFilter("DISTANCE_EXCEEDED")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                          categoryFilter === "DISTANCE_EXCEEDED"
                            ? "bg-blue-500 text-white border-blue-500 shadow-2xs"
                            : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                        }`}
                      >
                        <Navigation className="size-3" />
                        <span>นอกพื้นที่ ({distanceCount})</span>
                      </button>
                    )}

                    {countryMismatchCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryFilter("COUNTRY_MISMATCH")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                          categoryFilter === "COUNTRY_MISMATCH"
                            ? "bg-purple-500 text-white border-purple-500 shadow-2xs"
                            : "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                        }`}
                      >
                        <Globe className="size-3" />
                        <span>คนละประเทศ ({countryMismatchCount})</span>
                      </button>
                    )}

                    {lowConfidenceCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCategoryFilter("LOW_CONFIDENCE")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                          categoryFilter === "LOW_CONFIDENCE"
                            ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                        }`}
                      >
                        <AlertTriangle className="size-3" />
                        <span>ความเชื่อมั่นต่ำ ({lowConfidenceCount})</span>
                      </button>
                    )}
                  </div>

                  {/* Bulk action button for non-travel */}
                  {nonTravelCount > 0 && onDiscardAllNonTravel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDiscardAllNonTravel}
                      className="h-7 px-2.5 rounded-lg border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-semibold gap-1 shrink-0 shadow-2xs"
                      title="ตัดภาพที่ไม่ใช่สถานที่ท่องเที่ยวทั้งหมดออกในคลิกเดียว"
                    >
                      <Trash2 className="size-3" />
                      <span>ตัดภาพที่ไม่ใช่สถานที่ทั้งหมดออก ({nonTravelCount})</span>
                    </Button>
                  )}
                </div>

                {/* Outlier Cards List */}
                <div className="space-y-3.5">
                  {filteredOutliers.map((item) => {
                    const config = CATEGORY_CONFIG[item.category];
                    const CategoryIcon = config.icon;
                    const photoUrl = getCandidatePhoto(item);
                    const isNonTravel = item.category === "NON_TRAVEL";
                    const isEditing = editingItemId === item.id;
                    const altCandidates = (
                      item.top_candidates ||
                      item.originalResult.top_candidates ||
                      []
                    )
                      .filter(
                        (c) => c.name.toLowerCase() !== item.place.toLowerCase()
                      )
                      .slice(0, 2);

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col gap-3.5 p-4 rounded-2xl border transition-all shadow-2xs group ${config.cardBorder}`}
                      >
                        {/* Top Row: Thumbnail + Info */}
                        <div className="flex flex-col sm:flex-row gap-3.5 items-start">
                          {/* Photo Thumbnail */}
                          <div className="w-full sm:w-28 h-28 rounded-xl overflow-hidden bg-muted shrink-0 relative border border-border/60 shadow-2xs">
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={item.place}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    "https://picsum.photos/seed/travel/800/600";
                                }}
                              />
                            ) : (
                              <div
                                className={`w-full h-full ${config.iconBg} flex items-center justify-center`}
                              >
                                <CategoryIcon className="size-8" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                            {isNonTravel && (
                              <div className="absolute top-1.5 left-1.5 bg-red-600 text-white rounded-md p-1 shadow-xs">
                                <CameraOff className="size-3.5" />
                              </div>
                            )}
                          </div>

                          {/* Info & Badges */}
                          <div className="flex-1 min-w-0 w-full space-y-2">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <h4 className="font-bold text-foreground text-sm sm:text-base leading-snug">
                                  {item.place}
                                  {item.country && item.country !== "-" && (
                                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                                      ({item.country})
                                    </span>
                                  )}
                                </h4>
                              </div>

                              {/* Category Badge */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${config.badgeStyle}`}
                              >
                                <CategoryIcon className="size-3" />
                                {config.label}
                              </span>
                            </div>

                            {/* Reason Callout Box */}
                            <div
                              className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs leading-relaxed ${
                                isNonTravel
                                  ? "bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-300"
                                  : "bg-background/80 border-border/60 text-muted-foreground"
                              }`}
                            >
                              <Info
                                className={`size-3.5 shrink-0 mt-0.5 ${
                                  isNonTravel ? "text-red-500" : "text-amber-500"
                                }`}
                              />
                              <span className="font-medium">{item.reasonDescription}</span>
                            </div>

                            {/* Metric Tags */}
                            <div className="flex items-center gap-2 flex-wrap text-[10px]">
                              {item.confidence !== undefined &&
                                item.confidence > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground font-mono">
                                    Match: {(item.confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              {item.distanceKm !== undefined && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                                  📍 ห่างจากกลุ่มหลัก {item.distanceKm} กม.
                                </span>
                              )}
                              {item.originalResult.type && (
                                <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/60">
                                  หมวดหมู่: {item.originalResult.type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inline Manual Override Edit Form */}
                        {isEditing && (
                          <div className="p-3 rounded-xl bg-background border border-primary/30 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in">
                            <div className="flex-1 w-full relative">
                              <MapPin className="size-3.5 text-primary absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <Input
                                value={customPlaceText}
                                onChange={(e) => setCustomPlaceText(e.target.value)}
                                placeholder="พิมพ์ชื่อสถานที่ท่องเที่ยวจริง เช่น วัดพระแก้ว, คาเฟ่ริมหาด..."
                                className="h-8 pl-8 text-xs rounded-lg"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveCustomPlace(item.id);
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                              <Button
                                size="sm"
                                onClick={() => handleSaveCustomPlace(item.id)}
                                disabled={!customPlaceText.trim()}
                                className="h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground"
                              >
                                <Check className="size-3 mr-1" /> ยืนยันชื่อนี้
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingItemId(null)}
                                className="h-8 px-2.5 text-xs text-muted-foreground"
                              >
                                ยกเลิก
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Action Panel */}
                        <div className="pt-3 border-t border-border/60 flex flex-col gap-2.5 bg-background/50 p-3 rounded-xl border">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              {isNonTravel ? (
                                <>
                                  <ShieldAlert className="size-3.5 text-red-500" />
                                  <span>แนะนำให้ตัดภาพนี้ออก หรือพิมพ์ระบุสถานที่เอง</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="size-3.5 text-amber-500" />
                                  <span>สถานที่นี้ถูกต้องตามภาพของคุณหรือไม่?</span>
                                </>
                              )}
                            </p>

                            {/* Decision Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Primary Discard Action */}
                              {onDiscardOutlier && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onDiscardOutlier(item.id)}
                                  className={`h-8 px-3 rounded-xl text-xs font-semibold gap-1.5 transition-all shadow-2xs ${
                                    isNonTravel
                                      ? "bg-red-500/10 border-red-500/40 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold"
                                      : "border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  <Trash2 className="size-3.5" />
                                  {isNonTravel ? "ตัดภาพนี้ออก" : "ไม่ใช่ ตัดออก"}
                                </Button>
                              )}

                              {/* Manual Override Button */}
                              {onManualOverridePlace && !isEditing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartEditing(item)}
                                  className="h-8 px-2.5 rounded-xl border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground font-medium gap-1 shadow-2xs"
                                  title="พิมพ์ระบุชื่อสถานที่จริงด้วยตนเอง"
                                >
                                  <Edit3 className="size-3" />
                                  <span>ระบุชื่อเอง</span>
                                </Button>
                              )}

                              {/* Restore Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRestoreLocation(item.id)}
                                className={`h-8 px-3 rounded-xl text-xs font-bold gap-1.5 transition-all shadow-2xs ${
                                  isNonTravel
                                    ? "border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                <Check className="size-3.5" />
                                {isNonTravel ? "ใช้ภาพนี้ต่อไป" : "ถูกต้องแล้ว ยืนยันใช้ต่อ"}
                              </Button>
                            </div>
                          </div>

                          {/* Candidate Alternatives */}
                          {altCandidates.length > 0 && onSwitchCandidate && (
                            <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                หรือสลับเป็นตัวเลือกอื่นที่ AI ตรวจพบ:
                              </span>
                              <div className="flex flex-wrap gap-2 flex-1">
                                {altCandidates.map((cand, cIdx) => (
                                  <button
                                    key={cIdx}
                                    type="button"
                                    onClick={() => onSwitchCandidate(item.id, cand)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-primary/10 hover:border-primary/40 text-foreground text-xs font-medium transition-all shadow-2xs text-left"
                                  >
                                    <ArrowRightLeft className="size-3 text-primary shrink-0" />
                                    <span className="truncate max-w-[140px] sm:max-w-[180px]">
                                      {cand.name}
                                    </span>
                                    {cand.similarity > 0 && (
                                      <span className="text-[10px] text-primary font-bold ml-1 bg-primary/10 px-1 rounded">
                                        {(cand.similarity * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : /* Kept Places Tab */
          keptLocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <CameraOff className="size-12 text-amber-500 mb-3" />
              <p className="font-bold text-foreground text-base">
                ยังไม่มีสถานที่ที่ผ่านเกณฑ์
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                ภาพทั้งหมดถูกแยกออกในแถบ Outlier คุณสามารถกดยืนยันหรือระบุชื่อสถานที่เองได้จากแถบด้านซ้าย
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {keptLocations.map((loc, idx) => {
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-foreground text-xs truncate">
                            {loc.place}
                          </h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {loc.country} • {loc.type}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {loc.confidence !== undefined && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          {(loc.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>
              พร้อมสำหรับทริป:{" "}
              <strong className="text-foreground">{keptLocations.length} สถานที่</strong>
            </span>
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-2xs gap-1.5"
            >
              <span>ยอมรับและดำเนินการต่อ</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
