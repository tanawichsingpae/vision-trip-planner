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
import {
  CameraOff,
  AlertTriangle,
  Globe,
  Navigation,
  Copy,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  Filter
} from "lucide-react";
import { type VisionResult } from "@/services/aiService";

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
  canRestore: boolean;
}

interface VisionOutlierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outliers: OutlierItem[];
  keptLocations: VisionResult[];
  onRestoreLocation: (outlierId: string) => void;
  onConfirmProceed?: () => void;
}

const CATEGORY_CONFIG: Record<
  OutlierCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeStyle: string;
    iconBg: string;
  }
> = {
  NON_TRAVEL: {
    label: "ภาพที่ไม่ใช่สถานที่เที่ยว",
    icon: CameraOff,
    badgeStyle: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    iconBg: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  },
  LOW_CONFIDENCE: {
    label: "ความเชื่อมั่นต่ำ",
    icon: AlertTriangle,
    badgeStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  },
  COUNTRY_MISMATCH: {
    label: "ประเทศไม่สอดคล้อง",
    icon: Globe,
    badgeStyle: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  },
  DISTANCE_EXCEEDED: {
    label: "ระยะทางห่างเกิน 100 กม.",
    icon: Navigation,
    badgeStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  DUPLICATE: {
    label: "สถานที่ซ้ำซ้อน",
    icon: Copy,
    badgeStyle: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    iconBg: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400",
  },
};

export const VisionOutlierModal: React.FC<VisionOutlierModalProps> = ({
  open,
  onOpenChange,
  outliers,
  keptLocations,
  onRestoreLocation,
  onConfirmProceed,
}) => {
  const [activeTab, setActiveTab] = useState<"outliers" | "kept">("outliers");

  const totalAnalyzed = outliers.length + keptLocations.length;

  const getCandidatePhoto = (item: OutlierItem): string | null => {
    if (item.photoUrl) return item.photoUrl;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-3xl border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                รายงานการคัดกรอง Vision AI Outliers
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  AI Audit
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                ระบบคัดกรองภาพสถานที่ท่องเที่ยวเพื่อป้องกันเส้นทางเดินทางออกนอกพื้นที่หรือข้อมูลที่ไม่ถูกต้อง
              </DialogDescription>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-2xl bg-background/70 border border-border/50">
            <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-muted/40">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                ภาพทั้งหมด
              </span>
              <span className="text-base font-bold text-foreground">{totalAnalyzed}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> คัดเลือกแล้ว
              </span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                {keptLocations.length}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> ตัด Outlier
              </span>
              <span className="text-base font-bold text-amber-700 dark:text-amber-300">
                {outliers.length}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-3 p-1 rounded-xl bg-muted/50">
            <button
              onClick={() => setActiveTab("outliers")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "outliers"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              สถานที่ที่ถูกตัดออก ({outliers.length})
            </button>
            <button
              onClick={() => setActiveTab("kept")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "kept"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              สถานที่ที่ผ่านเกณฑ์ ({keptLocations.length})
            </button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[50vh]">
          {activeTab === "outliers" ? (
            outliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 animate-bounce" />
                <p className="font-semibold text-foreground">ไม่พบสถานที่ที่เป็น Outlier!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ทุกสถานที่ที่คุณอัปโหลดมีความสอดคล้องและผ่านเกณฑ์การคัดกรองทั้งหมด
                </p>
              </div>
            ) : (
              outliers.map((item) => {
                const config = CATEGORY_CONFIG[item.category];
                const CategoryIcon = config.icon;
                const photoUrl = getCandidatePhoto(item);

                return (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60 hover:border-amber-500/30 transition-all hover:bg-muted/50 group relative overflow-hidden"
                  >
                    {/* Visual Photo Thumbnail if available */}
                    {photoUrl ? (
                      <div className="w-full md:w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative border border-border/50">
                        <img
                          src={photoUrl}
                          alt={item.place}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20" />
                      </div>
                    ) : (
                      <div className={`w-full md:w-20 h-20 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <CategoryIcon className="w-8 h-8" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h4 className="font-bold text-foreground text-base leading-tight flex items-center gap-1.5">
                            {item.place}
                            {item.country && (
                              <span className="text-xs font-normal text-muted-foreground">
                                ({item.country})
                              </span>
                            )}
                          </h4>
                        </div>

                        {/* Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeStyle}`}
                        >
                          <CategoryIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>

                      {/* Detail Reason */}
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed bg-background/50 p-2.5 rounded-xl border border-border/40">
                        <Info className="w-3.5 h-3.5 inline-block text-amber-500 mr-1.5 -mt-0.5" />
                        {item.reasonDescription}
                      </p>

                      {/* Metrics tags */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
                        {item.confidence !== undefined && item.confidence > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground font-mono">
                            Confidence: {(item.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        {item.distanceKm !== undefined && (
                          <span className="px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground font-mono">
                            Distance: {Math.round(item.distanceKm)} km away
                          </span>
                        )}
                        {item.majorityCountry && (
                          <span className="px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted-foreground">
                            Majority: {item.majorityCountry}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Restore Button */}
                    {item.canRestore && (
                      <div className="flex items-center justify-end md:justify-center border-t md:border-t-0 md:border-l border-border/40 pt-2 md:pt-0 md:pl-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRestoreLocation(item.id)}
                          className="h-9 px-3 rounded-xl border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-all gap-1.5 whitespace-nowrap"
                          title="กดเพื่อนำสถานที่นี้กลับเข้าสู่แผนเดินทาง"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          กู้คืนสถานที่
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* Kept Places Tab */
            keptLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
                <p className="font-semibold text-foreground">ไม่มีสถานที่ที่ผ่านการคัดกรอง</p>
                <p className="text-xs text-muted-foreground mt-1">
                  กรุณาอัปโหลดภาพสถานที่ท่องเที่ยวใหม่อีกครั้ง
                </p>
              </div>
            ) : (
              keptLocations.map((loc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{loc.place}</h4>
                      <p className="text-xs text-muted-foreground">{loc.country} • {loc.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {loc.confidence !== undefined && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        Match {(loc.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/40 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            คุณสามารถกู้คืนสถานที่ที่ถูกตัดได้ตลอดเวลาก่อนดำเนินการวางแผน
          </p>

          <Button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-2 rounded-2xl travel-gradient text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 transition-opacity"
          >
            ยอมรับและไปต่อ <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
