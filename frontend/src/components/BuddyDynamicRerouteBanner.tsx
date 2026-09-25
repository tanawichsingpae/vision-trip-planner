import React, { useState } from "react";
import {
  ArrowLeftRight,
  Sparkles,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  Compass,
  ArrowRight,
  TrendingDown,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  SmartRerouteProposal,
  SmartRerouteAlternative,
  getPixMascotUrl,
  type PixPose,
} from "@/services/buddyService";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PixoMascotPeek } from "@/components/PixoMascotPeek";

export interface BuddyDynamicRerouteBannerProps {
  proposal: SmartRerouteProposal | null;
  onSwap?: (fromIdx: number, toIdx: number) => void;
  onSubstitute?: (fromIdx: number, alternative: SmartRerouteAlternative) => void;
  onDismiss?: () => void;
}

export const BuddyDynamicRerouteBanner: React.FC<BuddyDynamicRerouteBannerProps> = ({
  proposal,
  onSwap,
  onSubstitute,
  onDismiss,
}) => {
  const { language } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  if (!proposal || isDismissed) return null;

  const isTh = language === "th";
  const getPoseForProposal = (): PixPose => {
    switch (proposal.type) {
      case "SWAP":
        return "planning";
      case "SUBSTITUTE":
        return "search";
      case "ADVICE":
      default:
        return "tip";
    }
  };
  const mascotUrl = getPixMascotUrl(getPoseForProposal());

  const handleApplySwap = () => {
    if (proposal.toActivityIndex === undefined) return;
    setIsApplied(true);
    if (onSwap) {
      onSwap(proposal.fromActivityIndex, proposal.toActivityIndex);
    }
    toast.success(
      isTh
        ? `สลับลำดับเรียบร้อย! ประหยัดเวลาเดินทางได้ราว ${proposal.timeSavedMinutes ?? 25} นาที ✨`
        : `Route updated! Saved around ${proposal.timeSavedMinutes ?? 25} minutes of travel time ✨`
    );
  };

  const handleApplySubstitute = (alt: SmartRerouteAlternative) => {
    setIsApplied(true);
    if (onSubstitute) {
      onSubstitute(proposal.fromActivityIndex, alt);
    }
    toast.success(
      isTh
        ? `เปลี่ยนไป '${alt.title}' เรียบร้อยแล้วครับ ✨`
        : `Replaced with '${alt.title}' successfully! ✨`
    );
  };

  const handleClose = () => {
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (isApplied) {
    return (
      <div className="mb-3.5 p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {isTh
              ? "พิกโซ่ได้ปรับตารางและเส้นทางให้คุณเรียบร้อยแล้ว เที่ยวให้สนุกนะครับ! 🌟"
              : "Pixo has updated your schedule and route. Have a wonderful trip! 🌟"}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-md hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-orange-500/5 dark:from-amber-950/30 dark:via-background dark:to-orange-950/20 p-3.5 sm:p-4 shadow-sm backdrop-blur-md transition-all hover:border-amber-500/50">
      {/* Decorative gradient glow */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <PixoMascotPeek
              pose="transit"
              src={mascotUrl}
              alt="Pixo Buddy"
              headline="Pixo Smart Reroute 🚗💨"
              speechBubble={proposal.reason}
              language={isTh ? "th" : "en"}
              avatarClassName="size-12 rounded-xl object-cover ring-2 ring-amber-400/70 shadow-xs bg-white dark:bg-slate-800 transition-transform hover:scale-105"
              showHoverHint={true}
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white shadow-xs pointer-events-none">
              ⚡
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                Pixo Smart Reroute
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-medium"
              >
                {proposal.type === "SWAP"
                  ? isTh
                    ? "แนะนำสลับลำดับ"
                    : "Smart Swap"
                  : proposal.type === "SUBSTITUTE"
                  ? isTh
                    ? "แนะนำสถานที่สำรอง"
                    : "Smart Alternative"
                  : isTh
                  ? "คำแนะนำการเดินทาง"
                  : "Travel Advice"}
              </Badge>
              {proposal.timeSavedMinutes && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-0.5"
                >
                  <TrendingDown className="size-2.5" />
                  {isTh ? `ประหยัด ~${proposal.timeSavedMinutes} นาที` : `Save ~${proposal.timeSavedMinutes}m`}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {proposal.reason}
            </p>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleClose}
          title={isTh ? "ปิดคำแนะนำ" : "Dismiss"}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Pix Message Box */}
      <div className="mb-3 rounded-xl bg-background/80 dark:bg-slate-900/60 p-2.5 sm:p-3 border border-border/60 text-xs sm:text-xs text-foreground/90 leading-relaxed flex items-start gap-2 shadow-2xs">
        <Sparkles className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">{proposal.pixMessage}</div>
      </div>

      {/* Proposal Action Area */}
      {proposal.type === "SWAP" && proposal.toActivityTitle && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          {/* Visual Swap Preview */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto py-1">
            <span className="font-medium text-foreground px-2 py-1 rounded-md bg-muted/80 truncate max-w-[130px] border border-border/40">
              {proposal.fromActivityTitle}
            </span>
            <ArrowLeftRight className="size-3 text-amber-500 shrink-0 animate-pulse" />
            <span className="font-medium text-primary px-2 py-1 rounded-md bg-primary/10 border border-primary/20 truncate max-w-[130px]">
              {proposal.toActivityTitle}
            </span>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={handleApplySwap}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs px-3 py-1.5 h-8 rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeftRight className="size-3.5" />
              <span>
                {isTh
                  ? `สลับลำดับ ${proposal.fromActivityTitle.slice(0, 10)}... ⇄ ${proposal.toActivityTitle.slice(0, 10)}...`
                  : `Swap Order Now`}
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Substitute Alternatives Area */}
      {proposal.type === "SUBSTITUTE" && proposal.alternatives && proposal.alternatives.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Compass className="size-3 text-primary" />
            {isTh ? "สถานที่ใกล้เคียงที่น่าสนใจและเปิดให้บริการ:" : "Recommended nearby alternatives:"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {proposal.alternatives.map((alt, idx) => (
              <div
                key={idx}
                className="group p-2.5 rounded-xl border border-border/60 bg-background/90 hover:bg-muted/40 hover:border-amber-400/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {alt.title}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-muted-foreground">
                      ~{alt.distanceKm} km
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">
                    {alt.reason}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplySubstitute(alt)}
                  className="w-full text-xs h-7 rounded-lg border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-medium flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>{isTh ? "แวะที่นี่แทน" : "Choose this spot"}</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuddyDynamicRerouteBanner;
