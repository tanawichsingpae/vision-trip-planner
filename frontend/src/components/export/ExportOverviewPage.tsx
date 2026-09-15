import React from "react";
import type { ExportTrip } from "@/lib/export/types";
import RoutePreview from "./RoutePreview";

interface ExportOverviewPageProps {
  trip: ExportTrip;
  totalPages: number;
}

const ExportOverviewPage: React.FC<ExportOverviewPageProps> = ({
  trip,
  totalPages,
}) => {
  const titleMain = trip.destination || "Trip";
  const titleSub = trip.subtitle || "Heritage & soul";
  const overviewGridCols = Math.min(trip.days.length, 3);

  return (
    <section className="a4-page flex flex-col">
      {/* Top Header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#fff1ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e05b43]">
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
              <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
              <path d="M20 2v4" />
              <path d="M22 4h-4" />
              <circle cx="4" cy="20" r="2" />
            </svg>
            Curated for you
          </div>

          <h1 className="max-w-[480px] text-[34px] font-bold leading-[1.02] tracking-[-0.055em] text-slate-900">
            {titleMain}
            <br />
            <span className="text-[#f2654a]">{titleSub}</span>
          </h1>

          <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-slate-500">
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
            >
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 14h.01" />
              <path d="M12 14h.01" />
              <path d="M16 14h.01" />
              <path d="M8 18h.01" />
              <path d="M12 18h.01" />
              <path d="M16 18h.01" />
            </svg>
            {trip.startDate}
            {trip.endDate ? ` – ${trip.endDate}` : ""}
            <span className="text-slate-300">·</span> {trip.totalDays} Days
            <span className="text-slate-300">·</span> {trip.totalActivities} Activities
          </p>
        </div>

        {/* Pixinerary Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2654a] text-white shadow-sm">
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
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
            </svg>
          </div>
          <div>
            <div className="font-bold tracking-[-0.04em] text-slate-900">
              Pixinerary
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              AI travel planning
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Route Preview Map */}
      <RoutePreview trip={trip} />

      {/* Your Route Bar */}
      <div className="my-5 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Your route
        </span>
        {trip.days.map((day, idx) => (
          <div key={day.day} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: day.accentColor }}
            />
            <span className="text-[11px] font-semibold text-slate-700">
              Day {day.day}
            </span>
            <span className="text-[10px] text-slate-400">{day.date}</span>
            {idx < trip.days.length - 1 && (
              <span className="ml-1 h-px w-5 bg-slate-200" />
            )}
          </div>
        ))}
      </div>

      {/* Trip Overview Section */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-slate-900">Trip overview</h2>
        <span className="text-[10px] font-medium text-slate-400">
          A thoughtful pace, from temple bells to rooftop nights
        </span>
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${overviewGridCols}, minmax(0, 1fr))`,
        }}
      >
        {trip.days.map((day) => (
          <div
            key={day.day}
            className="break-inside-avoid rounded-xl border border-slate-200 p-3.5"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div
                  className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: day.accentColor }}
                >
                  Day {day.day}
                </div>
                <div className="text-[13px] font-bold leading-tight text-slate-900">
                  {day.title}
                </div>
                <div className="mt-1 text-[10px] text-slate-400">{day.date}</div>
              </div>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                style={{ backgroundColor: day.accentColor }}
              >
                {day.day}
              </span>
            </div>

            <div className="space-y-2">
              {day.activities.slice(0, 5).map((act) => (
                <div key={act.index} className="flex items-start gap-2">
                  <span className="mt-0.5 w-[42px] shrink-0 text-[9px] font-bold text-slate-400">
                    {act.time || "09:00"}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight text-slate-600 truncate">
                    {act.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[9px] font-medium text-slate-400">
        <span>Generated by Pixinerary AI</span>
        <span>
          Page 1 of {totalPages}
        </span>
      </div>
    </section>
  );
};

export default ExportOverviewPage;
