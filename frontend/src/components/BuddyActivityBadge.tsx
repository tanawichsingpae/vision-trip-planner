import React from "react";
import {
  type BuddyAlert,
  getPixMascotUrl,
} from "@/services/buddyService";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixoMascotPeek } from "@/components/PixoMascotPeek";

interface BuddyActivityBadgeProps {
  alerts: BuddyAlert[];
  onActionClick?: (alert: BuddyAlert) => void;
  language?: "th" | "en";
}

export const BuddyActivityBadge: React.FC<BuddyActivityBadgeProps> = ({
  alerts,
  onActionClick,
  language = "th",
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
          className={`inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl border text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xs group ${getBadgeStyle(
            primaryAlert
          )}`}
          title={primaryAlert.message}
        >
          {/* Pixo Mascot Thumbnail: 26px with Rounded Sticker Treatment */}
          <div className="relative shrink-0">
            <img
              src={mascotUrl}
              alt="Pixo Alert"
              className="w-[26px] h-[26px] rounded-lg object-cover ring-1 ring-white/60 dark:ring-white/20 shadow-2xs transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/pixo_carton/pixo_tip.jpg";
              }}
            />
          </div>

          <span className="truncate max-w-[130px] font-semibold">
            {primaryAlert.title}
          </span>

          {alerts.length > 1 && (
            <span className="size-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center -ml-0.5">
              +{alerts.length - 1}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        className="w-[340px] p-4 rounded-2xl bg-card border border-border/80 shadow-2xl space-y-3 z-50 text-xs pdf-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs">
              {language === "th" ? "Pixo Travel Buddy คำแนะนำ" : "Pixo Travel Buddy Tips"}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
            {alerts.length} {language === "th" ? "รายการ" : "tips"}
          </span>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {alerts.map((al) => (
            <div
              key={al.id}
              className="flex items-start gap-3 p-2.5 rounded-2xl bg-secondary/40 border border-border/60 hover:border-primary/30 transition-colors"
            >
              {/* Mascot Showcase in Popover: 64px with Hold-to-Zoom */}
              <div className="shrink-0">
                <PixoMascotPeek
                  pose={al.pose}
                  alt={al.title}
                  headline={al.title}
                  speechBubble={al.message}
                  language={language}
                  avatarClassName="size-16 rounded-xl object-cover ring-2 ring-border/80 shrink-0 shadow-sm transition-transform hover:scale-105"
                  showHoverHint={true}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-foreground text-xs leading-tight">
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
                    className="mt-2 h-6 px-2.5 text-[10px] font-medium rounded-lg border-primary/30 text-primary hover:bg-primary/10 gap-1"
                  >
                    <span>{al.actionLabel}</span>
                    <ArrowRight className="size-2.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground/75 text-center">
          {language === "th"
            ? "💡 แตะค้างที่รูป Pixo เพื่อซูมดูรูปเต็มแบบ HD ✨"
            : "💡 Press & hold Pixo image to zoom HD ✨"}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default BuddyActivityBadge;
