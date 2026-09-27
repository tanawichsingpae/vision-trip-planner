import React from "react";
import {
  Sparkles,
  RefreshCw,
  Check,
  Calendar,
  Users,
  Wallet,
  Zap,
  X,
  MapPin,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type SuggestedTripPlan } from "@/services/aiService";
import { useLanguage } from "@/context/LanguageContext";

interface AISuggestionCardProps {
  suggestion: SuggestedTripPlan | null;
  isLoading: boolean;
  onApply: (plan: SuggestedTripPlan) => void;
  onRegenerate: () => void;
  onDismiss: () => void;
  isApplied?: boolean;
}

const ACTIVITY_LABEL_MAP: Record<string, { th: string; en: string; emoji: string }> = {
  culture: { th: "วัฒนธรรม", en: "Culture", emoji: "🏛️" },
  food: { th: "อาหาร & คาเฟ่", en: "Food & Cafe", emoji: "🍜" },
  nature: { th: "ธรรมชาติ", en: "Nature", emoji: "🌳" },
  adventure: { th: "ผจญภัย", en: "Adventure", emoji: "🧗" },
  shopping: { th: "ช้อปปิ้ง", en: "Shopping", emoji: "🛍️" },
  nightlife: { th: "แสงสีราตรี", en: "Nightlife", emoji: "🍸" },
  relax: { th: "สปา & พักผ่อน", en: "Relax & Spa", emoji: "💆" },
  landmark: { th: "จุดเช็คอิน", en: "Landmark", emoji: "📸" },
  entertainment: { th: "ความบันเทิง", en: "Entertainment", emoji: "🎪" },
  spiritual: { th: "สายมู ขอพร", en: "Spiritual", emoji: "🔮" },
};

const TRAVELER_LABEL_MAP: Record<string, { th: string; en: string }> = {
  solo: { th: "คนเดียว (Solo)", en: "Solo" },
  couple: { th: "คู่รัก (Couple)", en: "Couple" },
  friends: { th: "กลุ่มเพื่อน (Friends)", en: "Friends" },
  family_kids: { th: "ครอบครัวมีเด็ก", en: "Family with Kids" },
  family_seniors: { th: "ครอบครัวมีผู้สูงอายุ", en: "Family with Seniors" },
};

const BUDGET_LABEL_MAP: Record<string, { th: string; en: string }> = {
  budget: { th: "ประหยัด", en: "Budget" },
  standard: { th: "มาตรฐาน", en: "Standard" },
  luxury: { th: "พรีเมียม", en: "Luxury" },
};

const PACE_LABEL_MAP: Record<string, { th: string; en: string }> = {
  relaxed: { th: "ชิลๆ สบายๆ", en: "Relaxed" },
  balanced: { th: "สมดุลกำลังดี", en: "Balanced" },
  packed: { th: "จัดเต็ม ทุกไฮไลท์", en: "Packed" },
};

export const AISuggestionCard: React.FC<AISuggestionCardProps> = ({
  suggestion,
  isLoading,
  onApply,
  onRegenerate,
  onDismiss,
  isApplied = false,
}) => {
  const { language } = useLanguage();
  const isTh = language === "th";

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-linear-to-br from-primary/8 via-background to-secondary/30 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-4 animate-spin text-primary" />
            </span>
            <div className="space-y-1">
              <div className="h-4 w-40 rounded-md bg-primary/15 animate-pulse" />
              <div className="h-3 w-24 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-5 w-3/4 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-full rounded-md bg-muted/60 animate-pulse" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-28 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  const travelerText =
    TRAVELER_LABEL_MAP[suggestion.travelerType]?.[isTh ? "th" : "en"] ||
    suggestion.travelerType;

  const budgetText =
    BUDGET_LABEL_MAP[suggestion.budget]?.[isTh ? "th" : "en"] ||
    suggestion.budget;

  const paceText =
    PACE_LABEL_MAP[suggestion.pace]?.[isTh ? "th" : "en"] || suggestion.pace;

  const formattedBudgetRange = suggestion.budgetRange
    ? `฿${suggestion.budgetRange[0].toLocaleString()} - ฿${suggestion.budgetRange[1].toLocaleString()}`
    : "";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-md ${
        isApplied
          ? "border-emerald-500/40 bg-linear-to-br from-emerald-500/10 via-background to-emerald-500/5 shadow-emerald-500/5"
          : "border-primary/30 bg-linear-to-br from-primary/10 via-background to-sky-500/5 shadow-primary/5 hover:border-primary/45"
      } p-4 sm:p-5`}
    >
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 size-36 rounded-full bg-sky-500/10 blur-2xl" />

      {/* Top Bar: Badge, Model & Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 rounded-full border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary shadow-2xs"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>
              {isTh
                ? `แนะนำโดย ${suggestion.modelLabel || "AI"}`
                : `Suggested by ${suggestion.modelLabel || "AI"}`}
            </span>
          </Badge>

          {isApplied && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 rounded-full border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <Check className="size-3" />
              <span>{isTh ? "นำแผนมาใช้แล้ว" : "Applied"}</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isLoading}
            className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title={isTh ? "วิเคราะห์ใหม่อีกครั้ง" : "Re-analyze"}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            title={isTh ? "ซ่อนคำแนะนำนี้" : "Dismiss suggestion"}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Theme Title */}
      <div className="mt-3">
        <div className="flex items-start gap-2">
          <Compass className="size-5 shrink-0 text-primary mt-0.5" />
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
            {suggestion.themeTitle}
          </h3>
        </div>

        {/* AI Reasoning Quote Box */}
        {suggestion.reasoning && (
          <div className="mt-2 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground mr-1.5">
              💡 {isTh ? "มุมมอง AI:" : "AI Insight:"}
            </span>
            {suggestion.reasoning}
          </div>
        )}
      </div>

      {/* Recommendation Summary Badges */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-medium text-foreground shadow-2xs">
          <Calendar className="size-3.5 text-sky-500" />
          <span>
            {suggestion.recommendedDays} {isTh ? "วัน" : "Days"}
          </span>
        </span>

        <span className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-medium text-foreground shadow-2xs">
          <Users className="size-3.5 text-indigo-500" />
          <span>{travelerText}</span>
        </span>

        <span className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-medium text-foreground shadow-2xs">
          <Wallet className="size-3.5 text-amber-500" />
          <span>
            {budgetText}
            {formattedBudgetRange ? ` (${formattedBudgetRange})` : ""}
          </span>
        </span>

        <span className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-medium text-foreground shadow-2xs">
          <Zap className="size-3.5 text-emerald-500" />
          <span>{paceText}</span>
        </span>
      </div>

      {/* Activity Pills */}
      {suggestion.activities && suggestion.activities.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">
            {isTh ? "กิจกรรมเด่น:" : "Key Activities:"}
          </span>
          {suggestion.activities.map((actId) => {
            const meta = ACTIVITY_LABEL_MAP[actId] || {
              th: actId,
              en: actId,
              emoji: "✨",
            };
            return (
              <span
                key={actId}
                className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                <span>{meta.emoji}</span>
                <span>{isTh ? meta.th : meta.en}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground hidden sm:inline">
          {isTh
            ? "คลิกเพื่อกรอกค่าทั้งหมดลงในฟอร์มทันที โดยยังสามารถแก้ไขเพิ่มเติมได้"
            : "Click to auto-populate the form. You can still adjust anything freely."}
        </p>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8 px-3"
          >
            {isTh ? "ปรับแต่งเอง" : "Customize manually"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onApply(suggestion)}
            className={`font-semibold text-xs h-8 px-3.5 gap-1.5 shadow-sm transition-all cursor-pointer ${
              isApplied
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {isApplied ? (
              <>
                <Check className="size-3.5" />
                <span>{isTh ? "ใช้แผนนี้แล้ว (คลิกอีกครั้งเพื่อรีเซ็ต)" : "Plan Applied (Click to re-apply)"}</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>{isTh ? "ใช้แผนที่ AI แนะนำ" : "Apply AI Plan"}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AISuggestionCard;
