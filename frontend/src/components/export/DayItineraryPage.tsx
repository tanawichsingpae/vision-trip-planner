import React from "react";
import type { ExportDay, ExportActivity } from "@/lib/export/types";
import ActivityCard from "./ActivityCard";

interface DayItineraryPageProps {
  day: ExportDay;
  activities: ExportActivity[];
  pageNumber: number;
  totalPages: number;
  isFirstPageOfDay: boolean;
}

function formatTransitString(minutes?: number, km?: number): string {
  if (!minutes && !km) return "— · —";
  const parts: string[] = [];
  if (minutes && minutes > 0) {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      parts.push(m > 0 ? `${h} hr ${m} mins` : `${h} hr`);
    } else {
      parts.push(`${minutes} mins`);
    }
  }
  if (km && km > 0) {
    parts.push(`${km.toFixed(1)} km`);
  }
  return parts.length > 0 ? parts.join(" · ") : "— · —";
}

const DayItineraryPage: React.FC<DayItineraryPageProps> = ({
  day,
  activities,
  pageNumber,
  totalPages,
  isFirstPageOfDay,
}) => {
  const transitSummary = formatTransitString(
    day.transit?.durationMinutes,
    day.transit?.distanceKm
  );

  return (
    <section
      className="a4-page flex flex-col"
      style={{ ["--day-accent" as string]: day.accentColor }}
    >
      {/* Day Header */}
      {isFirstPageOfDay ? (
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[17px] font-bold text-white"
              style={{ backgroundColor: day.accentColor }}
            >
              {day.day}
            </span>
            <div>
              <div
                className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: day.accentColor }}
              >
                Day {day.day} itinerary
              </div>
              <h2 className="text-[22px] font-bold tracking-[-0.04em] text-slate-900">
                {day.title}
              </h2>
              <p className="text-[10px] font-medium text-slate-400">{day.date}</p>
            </div>
          </div>

          {/* Transit Summary Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              style={{ color: day.accentColor }}
            >
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <path d="M9 17h6" />
              <circle cx="17" cy="17" r="2" />
            </svg>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Total transit
              </div>
              <div className="text-[11px] font-bold text-slate-700">
                {transitSummary}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-bold text-white"
              style={{ backgroundColor: day.accentColor }}
            >
              {day.day}
            </span>
            <span className="text-[14px] font-bold text-slate-800">
              {day.title} (Continued)
            </span>
          </div>
        </div>
      )}

      {/* Sub-bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            style={{ color: day.accentColor }}
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
          A day shaped around good discoveries
        </div>
        <div className="flex items-center gap-1 text-[9px] text-slate-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
          >
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
          Follow the route
        </div>
      </div>

      {/* Activity cards grid */}
      <div className="grid grid-cols-2 gap-3.5">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.index}
            activity={activity}
            accentColor={day.accentColor}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[9px] font-medium text-slate-400">
        <span>Generated by Pixinerary AI</span>
        <span>
          Page {pageNumber} of {totalPages}
        </span>
      </div>
    </section>
  );
};

export default DayItineraryPage;
