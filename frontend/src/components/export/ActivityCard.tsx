import React from "react";
import type { ExportActivity } from "@/lib/export/types";

interface ActivityCardProps {
  activity: ExportActivity;
  accentColor: string;
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

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  accentColor,
}) => {
  const transitText = formatTransitString(
    activity.transit?.durationMinutes,
    activity.transit?.distanceKm
  );

  let reviewStr = "";
  if (activity.reviewCount && activity.reviewCount > 0) {
    reviewStr =
      activity.reviewCount >= 1000
        ? `(${(activity.reviewCount / 1000).toFixed(1)}k)`
        : `(${activity.reviewCount})`;
  }

  return (
    <article className="activity-card break-inside-avoid overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Image container */}
      <div className="relative h-[92px] overflow-hidden bg-slate-100">
        {activity.imageUrl ? (
          <img
            src={activity.imageUrl}
            alt={activity.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) placeholder.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 items-center justify-center bg-slate-100 text-slate-400 text-[10px] font-semibold p-2 text-center"
          style={{ display: activity.imageUrl ? "none" : "flex" }}
        >
          {activity.name}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Index badge */}
        <span
          className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[11px] font-bold shadow-sm"
          style={{ color: accentColor }}
        >
          {activity.index}
        </span>

        {/* Time badge */}
        {activity.time && (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold text-white">
            {activity.time}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]"
            style={{
              color: accentColor,
              backgroundColor: `${accentColor}18`,
            }}
          >
            {activity.category}
          </span>

          {activity.status === "Open" ? (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600">
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Open
            </span>
          ) : activity.status === "Closed" ? (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-rose-500">
              Closed
            </span>
          ) : null}
        </div>

        {/* Name */}
        <h3 className="truncate text-[13px] font-bold text-slate-900">
          {activity.name}
        </h3>

        {/* Local Name */}
        {activity.localName ? (
          <p className="mt-0.5 text-[10px] text-slate-400 truncate">
            {activity.localName}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-transparent select-none">&nbsp;</p>
        )}

        {/* Description */}
        <p className="mt-2 line-clamp-2 min-h-[27px] text-[10px] leading-[1.35] text-slate-500">
          {activity.description || ""}
        </p>

        {/* Rating */}
        {activity.rating ? (
          <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-slate-500">
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
              className="h-3 w-3 fill-amber-400 text-amber-400"
            >
              <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
            </svg>
            {activity.rating.toFixed(1)}{" "}
            {reviewStr && <span className="font-normal text-slate-400">{reviewStr}</span>}
          </div>
        ) : (
          <div className="mt-2 text-[9px] text-transparent select-none">&nbsp;</div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">
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
            <circle cx="6" cy="19" r="3" />
            <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
            <circle cx="18" cy="5" r="3" />
          </svg>
          {transitText}
        </div>

        {activity.mapUrl ? (
          <a
            href={activity.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition"
            title="Open in Google Maps"
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
              className="h-4 w-4"
            >
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
              <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
              <path d="M21 21v.01" />
              <path d="M12 7v3a2 2 0 0 1-2 2H7" />
              <path d="M3 12h.01" />
              <path d="M12 3h.01" />
              <path d="M12 16v.01" />
              <path d="M16 12h1" />
              <path d="M21 12v.01" />
              <path d="M12 21v-1" />
            </svg>
            <span className="text-[8px] font-bold uppercase tracking-wider">Map</span>
          </a>
        ) : (
          <div className="flex items-center gap-1 text-slate-300">
            <span className="text-[8px] font-bold uppercase tracking-wider">Map</span>
          </div>
        )}
      </div>
    </article>
  );
};

export default ActivityCard;
