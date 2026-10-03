import React from "react";
import { CheckCircle2, XCircle, UserCheck, Sparkles } from "lucide-react";

export interface HumanDoubleCheckButtonProps {
  isCorrect: boolean;
  onChange: (value: boolean) => void;
  matchScore?: number;
  matchedAlias?: string | null;
  isVerified?: boolean;
  compact?: boolean;
  correctLabel?: string;
  wrongLabel?: string;
  className?: string;
}

export const HumanDoubleCheckButton: React.FC<HumanDoubleCheckButtonProps> = ({
  isCorrect,
  onChange,
  matchScore,
  matchedAlias,
  isVerified,
  compact = false,
  correctLabel = "Correct",
  wrongLabel = "Wrong",
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 ${className}`}>
      <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/90 shadow-2xs">
        <button
          type="button"
          onClick={() => onChange(true)}
          title={
            isCorrect
              ? "Marked as Correct (Verified/Threshold)"
              : "Click to double-check and mark as Correct"
          }
          className={`flex items-center gap-1 ${
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
          } rounded-md font-semibold transition-all ${
            isCorrect
              ? "bg-emerald-600 text-white shadow-xs scale-[1.02]"
              : "text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60"
          }`}
        >
          <CheckCircle2 className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
          <span>{correctLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          title={
            !isCorrect
              ? "Marked as Wrong (Verified/Threshold)"
              : "Click to double-check and mark as Wrong"
          }
          className={`flex items-center gap-1 ${
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
          } rounded-md font-semibold transition-all ${
            !isCorrect
              ? "bg-rose-600 text-white shadow-xs scale-[1.02]"
              : "text-slate-500 hover:text-rose-700 hover:bg-slate-200/60"
          }`}
        >
          <XCircle className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
          <span>{wrongLabel}</span>
        </button>
      </div>

      {/* Sub-label: Default from Threshold vs Human Double-Checked */}
      <div className="flex items-center gap-1 text-[9px] leading-tight select-none">
        {isVerified ? (
          <span
            className="text-indigo-600 font-bold flex items-center gap-0.5 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150"
            title="Verified by researcher"
          >
            <UserCheck className="w-2.5 h-2.5" />
            <span>Double-Checked</span>
          </span>
        ) : (
          <span
            className="text-slate-400 flex items-center gap-0.5"
            title={
              matchedAlias
                ? `Default from Threshold 70% (Matched alias: "${matchedAlias}")`
                : "Default derived automatically from 70% similarity threshold"
            }
          >
            <Sparkles className="w-2.5 h-2.5 text-amber-500/70 shrink-0" />
            <span>
              Auto (
              {matchScore !== undefined
                ? `${Math.round(matchScore * 100)}%`
                : "≥70%"}
              )
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
