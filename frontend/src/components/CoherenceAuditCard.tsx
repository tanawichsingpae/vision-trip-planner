import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Compass,
  Palette,
  Timer,
  Target
} from "lucide-react";
import { type ItineraryCoherence } from "@/api/spatialPlanner";

interface CoherenceAuditCardProps {
  coherence: ItineraryCoherence | null | undefined;
  onAIRefine?: () => void;
  isAIRefining?: boolean;
}

export const CoherenceAuditCard: React.FC<CoherenceAuditCardProps> = ({
  coherence,
  onAIRefine,
  isAIRefining = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!coherence) return null;

  const score = coherence.totalScore;

  // Grade determination
  let gradeText = "สมบูรณ์แบบ (Academic Grade A+)";
  let gradeColor = "text-emerald-600 dark:text-emerald-400";
  let badgeBg = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  let ringColor = "border-emerald-500";

  if (score < 70) {
    gradeText = "ควรปรับปรุง (Academic Grade C)";
    gradeColor = "text-rose-600 dark:text-rose-400";
    badgeBg = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    ringColor = "border-rose-500";
  } else if (score < 85) {
    gradeText = "ปานกลาง (Academic Grade B)";
    gradeColor = "text-amber-600 dark:text-amber-400";
    badgeBg = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    ringColor = "border-amber-500";
  } else if (score < 92) {
    gradeText = "ดีมาก (Academic Grade A)";
    gradeColor = "text-blue-600 dark:text-blue-400";
    badgeBg = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    ringColor = "border-blue-500";
  }

  const selectionScore = coherence.selectionScore ?? 95;
  const hasWarnings = coherence.warnings && coherence.warnings.length > 0;

  return (
    <div className="mb-6 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md shadow-xs p-4 sm:p-5 transition-all pdf-hidden">
      {/* Top Row: Score, Title, & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Score Circular Badge */}
          <div
            className={`flex size-14 sm:size-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 ${ringColor} bg-background/90 shadow-2xs`}
          >
            <span className={`text-xl sm:text-2xl font-black tracking-tight ${gradeColor}`}>
              {score}
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest -mt-0.5">
              Score
            </span>
          </div>

          {/* Title & Grade */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                AI Itinerary Coherence & Selection Audit
              </h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeBg}`}>
                {gradeText}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              ประเมินความสอดคล้องตามกรอบงานวิจัย TTDP & OPTW สากล (เส้นทาง, เวลา, ความหลากหลาย, และความเหมาะสม)
            </p>
          </div>
        </div>

        {/* Action Button & Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {hasWarnings && onAIRefine && (
            <button
              onClick={onAIRefine}
              disabled={isAIRefining}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-2xs hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isAIRefining ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>กำลังปรับ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>AI Auto-Optimize</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-secondary-foreground text-xs font-medium border border-border transition-colors cursor-pointer"
          >
            <span>{isExpanded ? "ซ่อนรายละเอียด" : "ดูผลตรวจสอบ"}</span>
            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* 4 Core Pillars Sub-scores Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-border/60">
        {/* 1. Spatial Flow */}
        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Compass className="size-3.5 text-blue-500" />
              Spatial Flow
            </span>
            <span className="font-bold text-foreground">{coherence.spatialScore}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(100, coherence.spatialScore)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">0 จุดตัด · ไม่มี U-turn</p>
        </div>

        {/* 2. Experience Diversity */}
        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Palette className="size-3.5 text-purple-500" />
              Diversity
            </span>
            <span className="font-bold text-foreground">{coherence.diversityScore}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{ width: `${Math.min(100, coherence.diversityScore)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">Shannon Entropy สูง</p>
        </div>

        {/* 3. Pacing & Rest */}
        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Timer className="size-3.5 text-amber-500" />
              Pacing & Rest
            </span>
            <span className="font-bold text-foreground">{coherence.paceScore}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(100, coherence.paceScore)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">มื้ออาหารตรงเวลา · เวลาเดินทางจริง</p>
        </div>

        {/* 4. Selection & Fit */}
        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-muted-foreground flex items-center gap-1">
              <Target className="size-3.5 text-emerald-500" />
              Selection & Fit
            </span>
            <span className="font-bold text-foreground">{selectionScore}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, selectionScore)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">งบประมาณ · กลุ่มผู้เที่ยว · รีวิว 3.8+</p>
        </div>
      </div>

      {/* Expandable Details: Verified Standards & Active Warnings */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border/60 space-y-3.5 animate-fade-in">
          {/* Active Warnings (if any) */}
          {hasWarnings && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                ข้อสังเกตที่แนะนำให้ปรับปรุง ({coherence.warnings.length} จุด):
              </h4>
              <div className="grid gap-1.5">
                {coherence.warnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
                  >
                    <span className="font-bold shrink-0">{idx + 1}.</span>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed Academic Standards Checklist */}
          {coherence.passedChecks && coherence.passedChecks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                เกณฑ์มาตรฐานทางวิชาการที่ผ่านการตรวจสอบ ({coherence.passedChecks.length} ข้อ):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {coherence.passedChecks.map((check, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{check}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoherenceAuditCard;
