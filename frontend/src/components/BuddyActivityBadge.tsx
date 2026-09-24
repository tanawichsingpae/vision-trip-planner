import React, { useState } from "react";
import {
  type BuddyAlert,
  getPixMascotUrl,
} from "@/services/buddyService";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BuddyActivityBadgeProps {
  alerts: BuddyAlert[];
  onActionClick?: (alert: BuddyAlert) => void;
}

export const BuddyActivityBadge: React.FC<BuddyActivityBadgeProps> = ({
  alerts,
  onActionClick,
}) => {
  if (!alerts || alerts.length === 0) return null;

  // Primary alert to display on the badge pill
  const primaryAlert = alerts[0];
  const mascotUrl = getPixMascotUrl(primaryAlert.pose);

  // Badge theme based on alert type & severity
  const getBadgeStyle = (alert: BuddyAlert) => {
    switch (alert.triggerType) {
      case "weather_rain":
        return "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800";
      case "dress_code":
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "traffic_rush":
        return "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      case "cash_budget":
        return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "flight_airport":
        return "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
      case "foodie":
        return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xs ${getBadgeStyle(
            primaryAlert
          )}`}
          title={primaryAlert.message}
        >
          <img
            src={mascotUrl}
            alt="Pix Alert"
            className="size-4 rounded-full object-cover ring-1 ring-white/50 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logos/pix_tip.jpg";
            }}
          />
          <span className="truncate max-w-[130px] font-semibold">
            {primaryAlert.title}
          </span>
          {alerts.length > 1 && (
            <span className="size-3.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center -ml-0.5">
              +{alerts.length - 1}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        className="w-80 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xl space-y-3 z-50 text-xs pdf-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>Pix Travel Buddy คำแนะนำ</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {alerts.length} รายการ
          </span>
        </div>

        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {alerts.map((al) => (
            <div
              key={al.id}
              className="flex items-start gap-2.5 p-2 rounded-xl bg-secondary/40 border border-border/60"
            >
              <img
                src={getPixMascotUrl(al.pose)}
                alt={al.title}
                className="size-8 rounded-lg object-cover ring-1 ring-border/80 shrink-0 mt-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logos/pix_tip.jpg";
                }}
              />
              <div className="flex-1 min-w-0">
                <h5 className="font-semibold text-foreground text-xs leading-tight">
                  {al.title}
                </h5>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {al.message}
                </p>

                {al.actionLabel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onActionClick?.(al)}
                    className="mt-2 h-6 px-2 text-[10px] font-medium rounded-lg border-primary/30 text-primary hover:bg-primary/10 gap-1"
                  >
                    <span>{al.actionLabel}</span>
                    <ArrowRight className="size-2.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default BuddyActivityBadge;
