import React, { useState, useMemo } from "react";
import type { ExportTrip, ExportDay, ExportActivity } from "@/lib/export/types";
import ExportOverviewPage from "./ExportOverviewPage";
import DayItineraryPage from "./DayItineraryPage";

interface TripExportDocumentProps {
  trip: ExportTrip;
}

const MAX_ACTIVITIES_PER_PAGE = 6;

interface DayPage {
  day: ExportDay;
  activities: ExportActivity[];
  isFirstPageOfDay: boolean;
}

function buildExportPages(trip: ExportTrip): DayPage[] {
  const dayPages: DayPage[] = [];

  for (const day of trip.days) {
    if (day.activities.length === 0) {
      dayPages.push({
        day,
        activities: [],
        isFirstPageOfDay: true,
      });
      continue;
    }

    const chunks: ExportActivity[][] = [];
    for (let i = 0; i < day.activities.length; i += MAX_ACTIVITIES_PER_PAGE) {
      chunks.push(day.activities.slice(i, i + MAX_ACTIVITIES_PER_PAGE));
    }

    chunks.forEach((chunk, chunkIndex) => {
      dayPages.push({
        day,
        activities: chunk,
        isFirstPageOfDay: chunkIndex === 0,
      });
    });
  }

  return dayPages;
}

const TripExportDocument: React.FC<TripExportDocumentProps> = ({ trip }) => {
  const [layoutMode, setLayoutMode] = useState<"preview" | "print">("preview");

  const dayPages = useMemo(() => buildExportPages(trip), [trip]);
  const totalPages = 1 + dayPages.length;

  return (
    <div className={`export-document ${layoutMode === "print" ? "print-layout" : ""}`}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-3 print:hidden">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between">
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

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLayoutMode("preview")}
                className={`rounded-md px-3 py-1.5 transition cursor-pointer ${
                  layoutMode === "preview"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("print")}
                className={`rounded-md px-3 py-1.5 transition cursor-pointer ${
                  layoutMode === "print"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Print layout
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-[#f2654a] px-3.5 py-2 text-[11px] font-bold text-white shadow-sm shadow-[#f2654a]/20 transition hover:bg-[#df553d] cursor-pointer"
            >
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
                <path d="M12 15V3" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Pages Document Stack */}
      <div className="mx-auto flex max-w-[1320px] justify-center px-5 py-10">
        <div className="document-stack space-y-7">
          {/* Page 1: Overview */}
          <ExportOverviewPage trip={trip} totalPages={totalPages} />

          {/* Pages 2..N: Day Itinerary */}
          {dayPages.map((dayPage, index) => (
            <DayItineraryPage
              key={`day-${dayPage.day.day}-page-${index}`}
              day={dayPage.day}
              activities={dayPage.activities}
              pageNumber={index + 2}
              totalPages={totalPages}
              isFirstPageOfDay={dayPage.isFirstPageOfDay}
            />
          ))}
        </div>
      </div>

      {/* Floating Status Indicator */}
      <div className="fixed bottom-5 left-5 hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-500 shadow-lg lg:flex print:hidden">
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
          className="h-3.5 w-3.5 text-[#f2654a]"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6h4" />
        </svg>
        Auto-saved just now
      </div>
    </div>
  );
};

export default TripExportDocument;
export { buildExportPages };
