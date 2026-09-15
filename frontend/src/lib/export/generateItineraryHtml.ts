import type { ExportTrip, ExportDay, ExportActivity } from "./types";

/**
 * Escapes HTML characters in text to prevent XSS and formatting breakages.
 */
function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface GenerateHtmlOptions {
  language?: "th" | "en";
}

/**
 * SVG Icons as pure inline markup
 */
const ICONS = {
  compass: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><circle cx="12" cy="12" r="10"></circle><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"></path></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>`,
  car: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`,
  navigation: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M20 6 9 17l-5-5"></path></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 fill-amber-400 text-amber-400"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>`,
  route: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>`,
  qrcode: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path><path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-[#f2654a]"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6h4"></path></svg>`,
};

/**
 * Format transit duration & distance string (e.g. "42 mins · 14.5 km")
 */
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

/**
 * Generates an activity card HTML string matching the v0 template
 */
function renderActivityCard(act: ExportActivity, accentColor: string): string {
  const transitText = formatTransitString(
    act.transit?.durationMinutes,
    act.transit?.distanceKm
  );

  const ratingStr = act.rating ? act.rating.toFixed(1) : "";
  let reviewStr = "";
  if (act.reviewCount && act.reviewCount > 0) {
    reviewStr =
      act.reviewCount >= 1000
        ? `(${(act.reviewCount / 1000).toFixed(1)}k)`
        : `(${act.reviewCount})`;
  }

  const statusHtml =
    act.status === "Open"
      ? `<span class="flex items-center gap-1 text-[9px] font-semibold text-emerald-600">${ICONS.check} Open</span>`
      : act.status === "Closed"
        ? `<span class="flex items-center gap-1 text-[9px] font-semibold text-rose-500">Closed</span>`
        : `<span></span>`;

  return `
    <article class="activity-card break-inside-avoid overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="relative h-[92px] overflow-hidden bg-slate-100">
        ${
          act.imageUrl
            ? `<img src="${escapeHtml(act.imageUrl)}" alt="${escapeHtml(act.name)}" class="h-full w-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
               <div class="hidden absolute inset-0 items-center justify-center bg-slate-100 text-slate-400 text-[10px] font-semibold p-2 text-center">${escapeHtml(act.name)}</div>`
            : `<div class="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400 text-[10px] font-semibold p-2 text-center">${escapeHtml(act.name)}</div>`
        }
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
        <span class="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[11px] font-bold shadow-sm" style="color:${accentColor}">${act.index}</span>
        ${act.time ? `<span class="absolute bottom-2.5 left-2.5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold text-white">${escapeHtml(act.time)}</span>` : ""}
      </div>
      <div class="p-3">
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]" style="color:${accentColor};background-color:${accentColor}18">${escapeHtml(act.category)}</span>
          ${statusHtml}
        </div>
        <h3 class="truncate text-[13px] font-bold text-slate-900">${escapeHtml(act.name)}</h3>
        ${act.localName ? `<p class="mt-0.5 text-[10px] text-slate-400 truncate">${escapeHtml(act.localName)}</p>` : `<p class="mt-0.5 text-[10px] text-transparent select-none">&nbsp;</p>`}
        <p class="mt-2 line-clamp-2 min-h-[27px] text-[10px] leading-[1.35] text-slate-500">${escapeHtml(act.description || "")}</p>
        ${
          ratingStr
            ? `<div class="mt-2 flex items-center gap-1 text-[9px] font-semibold text-slate-500">
                ${ICONS.star} ${ratingStr} <span class="font-normal text-slate-400">${reviewStr}</span>
              </div>`
            : `<div class="mt-2 text-[9px] text-transparent select-none">&nbsp;</div>`
        }
      </div>
      <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2">
        <div class="flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">
          ${ICONS.route} ${transitText}
        </div>
        ${
          act.mapUrl
            ? `<a href="${escapeHtml(act.mapUrl)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition" title="Open in Google Maps">
                ${ICONS.qrcode}
                <span class="text-[8px] font-bold uppercase tracking-wider">Map</span>
              </a>`
            : `<div class="flex items-center gap-1 text-slate-300">${ICONS.qrcode}<span class="text-[8px] font-bold uppercase tracking-wider">Map</span></div>`
        }
      </div>
    </article>
  `;
}

/**
 * Generate full standalone HTML string matching the v0 template with an interactive Leaflet map
 */
export function generateItineraryHtml(
  trip: ExportTrip,
  options?: GenerateHtmlOptions
): string {
  const language = options?.language || "en";
  const isThai = language === "th";

  // Compute total pages: 1 overview page + N day pages (each up to 6 activities)
  const dayPages: Array<{ day: ExportDay; activities: ExportActivity[]; pageIndex: number }> = [];
  let pageCounter = 2;

  trip.days.forEach((day) => {
    const chunkSize = 6;
    for (let i = 0; i < Math.max(1, day.activities.length); i += chunkSize) {
      const slice = day.activities.slice(i, i + chunkSize);
      dayPages.push({
        day,
        activities: slice,
        pageIndex: pageCounter++,
      });
    }
  });

  const totalPages = 1 + dayPages.length;

  // Title formatting: ensure subtitle is not a duplicate date string
  const titleMain = trip.destination || "Travel";
  const isDateSubtitle =
    trip.subtitle &&
    trip.startDate &&
    (trip.subtitle.includes(trip.startDate) || trip.subtitle.includes("202"));

  const titleSub =
    !isDateSubtitle && trip.subtitle
      ? trip.subtitle
      : isThai
        ? "แผนการท่องเที่ยวอันน่าประทับใจ"
        : "Heritage & soul";

  // Route distance text
  const routeDistance = trip.route?.distanceKm
    ? `${trip.route.distanceKm.toFixed(1)} km`
    : `${(trip.days.length * 18.5).toFixed(1)} km`;

  // Prepare map data for Leaflet interactive map
  const mapData = {
    days: trip.days.map((day) => ({
      day: day.day,
      title: day.title,
      accentColor: day.accentColor,
      activities: day.activities
        .filter((act) => act.latitude && act.longitude)
        .map((act) => ({
          index: act.index,
          name: act.name,
          localName: act.localName || "",
          time: act.time || "",
          category: act.category,
          lat: act.latitude,
          lng: act.longitude,
        })),
    })),
  };

  // Overview route day pills
  const routeDayPillsHtml = trip.days
    .map((day, idx) => {
      const hasNext = idx < trip.days.length - 1;
      return `
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" style="background-color:${day.accentColor}"></span>
          <span class="text-[11px] font-semibold text-slate-700">${isThai ? `วันที่ ${day.day}` : `Day ${day.day}`}</span>
          <span class="text-[10px] text-slate-400">${escapeHtml(day.date)}</span>
          ${hasNext ? '<span class="ml-1 h-px w-5 bg-slate-200"></span>' : ""}
        </div>
      `;
    })
    .join("");

  // Overview day columns (up to 3 columns grid)
  const overviewGridCols = Math.min(trip.days.length, 3);
  const overviewCardsHtml = trip.days
    .map((day) => {
      const activityRows = day.activities
        .slice(0, 5)
        .map((act) => {
          return `
            <div class="flex items-start gap-2">
              <span class="mt-0.5 w-[42px] shrink-0 text-[9px] font-bold text-slate-400">${escapeHtml(act.time || "09:00")}</span>
              <span class="text-[10px] font-semibold leading-tight text-slate-600 truncate">${escapeHtml(act.name)}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="break-inside-avoid rounded-xl border border-slate-200 p-3.5">
          <div class="mb-3 flex items-start justify-between">
            <div>
              <div class="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]" style="color:${day.accentColor}">${isThai ? `วันที่ ${day.day}` : `Day ${day.day}`}</div>
              <div class="text-[13px] font-bold leading-tight text-slate-900">${escapeHtml(day.title)}</div>
              <div class="mt-1 text-[10px] text-slate-400">${escapeHtml(day.date)}</div>
            </div>
            <span class="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-bold text-white" style="background-color:${day.accentColor}">${day.day}</span>
          </div>
          <div class="space-y-2">
            ${activityRows}
          </div>
        </div>
      `;
    })
    .join("");

  // Day itinerary sections
  const dayPagesHtml = dayPages
    .map(({ day, activities, pageIndex }) => {
      const transitSummary = formatTransitString(
        day.transit?.durationMinutes,
        day.transit?.distanceKm
      );

      const cardsHtml = activities
        .map((act) => renderActivityCard(act, day.accentColor))
        .join("\n");

      return `
        <!-- DAY ${day.day} PAGE -->
        <section class="a4-page flex flex-col" style="--day-accent:${day.accentColor}">
          <div class="mb-5 flex items-center justify-between border-b border-slate-200 pb-5">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl text-[17px] font-bold text-white" style="background-color:${day.accentColor}">${day.day}</span>
              <div>
                <div class="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em]" style="color:${day.accentColor}">${isThai ? `แผนการเดินทาง วันที่ ${day.day}` : `Day ${day.day} itinerary`}</div>
                <h2 class="text-[22px] font-bold tracking-[-0.04em] text-slate-900">${escapeHtml(day.title)}</h2>
                <p class="text-[10px] font-medium text-slate-400">${escapeHtml(day.date)}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span style="color:${day.accentColor}">${ICONS.car}</span>
              <div>
                <div class="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">${isThai ? "เวลาเดินทางรวม" : "Total transit"}</div>
                <div class="text-[11px] font-bold text-slate-700">${transitSummary}</div>
              </div>
            </div>
          </div>

          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <span style="color:${day.accentColor}">${ICONS.sun}</span>
              ${isThai ? "วันที่เต็มไปด้วยประสบการณ์น่าประทับใจ" : "A day shaped around good discoveries"}
            </div>
            <div class="flex items-center gap-1 text-[9px] text-slate-400">
              ${ICONS.navigation}
              ${isThai ? "ตามเส้นทาง" : "Follow the route"}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3.5">
            ${cardsHtml}
          </div>

          <div class="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[9px] font-medium text-slate-400">
            <span>Generated by Pixinerary AI</span>
            <span>Page ${pageIndex} of ${totalPages}</span>
          </div>
        </section>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
  <title>Pixinerary — ${escapeHtml(trip.destination)} Itinerary</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      margin: 0;
      padding: 0;
    }

    .a4-page {
      background: #fff;
      width: 794px;
      min-height: 1123px;
      padding: 42px 46px 34px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.1);
      box-sizing: border-box;
    }

    .document-stack {
      transform-origin: top;
    }

    .break-inside-avoid {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    #interactive-route-map {
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
      padding: 2px;
    }

    .leaflet-popup-content {
      margin: 8px 12px;
      line-height: 1.4;
    }

    .custom-map-pin {
      background: transparent;
      border: none;
    }

    @media (max-width: 860px) {
      .a4-page {
        width: min(794px, 100vw - 32px);
        min-height: auto;
        padding: 28px 24px;
      }
      .document-stack {
        width: 100%;
      }
    }

    @media screen {
      .print-layout .a4-page {
        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
      }
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }

      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      header, .print\\:hidden, .fixed, .leaflet-control-container {
        display: none !important;
      }

      main {
        background: #fff !important;
        padding: 0 !important;
      }

      .document-stack {
        width: 794px;
        margin: 0;
        display: block;
      }

      .document-stack > * + * {
        margin-top: 0 !important;
      }

      .a4-page {
        width: 794px;
        height: 1123px;
        min-height: 1123px;
        max-height: 1123px;
        box-shadow: none !important;
        break-after: page;
        page-break-after: always;
        padding: 42px 46px 34px;
        overflow: hidden;
        margin: 0 !important;
      }

      .a4-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }

      .print\\:h-\\[220px\\] {
        height: 220px !important;
      }
    }
  </style>
</head>
<body class="antialiased">
  <main class="min-h-screen bg-[#f4f5f7] text-slate-900">
    <!-- STICKY TOPBAR -->
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-3 print:hidden">
      <div class="mx-auto flex max-w-[1320px] items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2654a] text-white shadow-sm">
            ${ICONS.compass}
          </div>
          <div>
            <div class="font-bold tracking-[-0.04em] text-slate-900">Pixinerary</div>
            <div class="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI travel planning</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold">
            <button id="btn-preview" onclick="toggleLayout('preview')" class="rounded-md px-3 py-1.5 transition bg-white text-slate-900 shadow-sm">Preview</button>
            <button id="btn-print" onclick="toggleLayout('print')" class="rounded-md px-3 py-1.5 transition text-slate-400">Print layout</button>
          </div>
          <button onclick="window.print()" class="flex items-center gap-2 rounded-lg bg-[#f2654a] px-3.5 py-2 text-[11px] font-bold text-white shadow-sm shadow-[#f2654a]/20 transition hover:bg-[#df553d] cursor-pointer">
            ${ICONS.download} Export PDF
          </button>
        </div>
      </div>
    </header>

    <!-- DOCUMENT STACK -->
    <div class="mx-auto flex max-w-[1320px] justify-center px-5 py-10">
      <div class="document-stack space-y-7">

        <!-- PAGE 1: OVERVIEW -->
        <section class="a4-page flex flex-col">
          <div class="mb-7 flex items-start justify-between">
            <div>
              <div class="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#fff1ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e05b43]">
                ${ICONS.sparkles} ${isThai ? "คัดสรรเพื่อคุณ" : "Curated for you"}
              </div>
              <h1 class="max-w-[480px] text-[34px] font-bold leading-[1.02] tracking-[-0.055em] text-slate-900">
                ${escapeHtml(titleMain)}<br><span class="text-[#f2654a]">${escapeHtml(titleSub)}</span>
              </h1>
              <p class="mt-3 flex items-center gap-2 text-[12px] font-medium text-slate-500">
                ${ICONS.calendar}
                ${escapeHtml(trip.startDate)}${trip.endDate ? ` – ${escapeHtml(trip.endDate)}` : ""}
                <span class="text-slate-300">·</span> ${trip.totalDays} ${isThai ? "วัน" : "Days"}
                <span class="text-slate-300">·</span> ${trip.totalActivities} ${isThai ? "กิจกรรม" : "Activities"}
              </p>
            </div>
            <div class="flex items-center gap-2.5">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2654a] text-white shadow-sm">
                ${ICONS.compass}
              </div>
              <div>
                <div class="font-bold tracking-[-0.04em] text-slate-900">Pixinerary</div>
                <div class="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI travel planning</div>
              </div>
            </div>
          </div>

          <!-- INTERACTIVE ROUTE MAP -->
          <div class="relative h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 print:h-[220px] shadow-xs">
            <div id="interactive-route-map"></div>
            <div class="absolute bottom-3 right-3 z-[400] rounded-lg bg-white/95 backdrop-blur-sm px-2.5 py-1 text-[9px] font-bold text-slate-700 shadow-sm border border-slate-200 pointer-events-none">
              Route preview · ${routeDistance}
            </div>
          </div>

          <!-- YOUR ROUTE BAR -->
          <div class="my-5 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">${isThai ? "เส้นทางของคุณ" : "Your route"}</span>
            ${routeDayPillsHtml}
          </div>

          <!-- TRIP OVERVIEW -->
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-[14px] font-bold text-slate-900">${isThai ? "ภาพรวมการเดินทาง" : "Trip overview"}</h2>
            <span class="text-[10px] font-medium text-slate-400">${isThai ? "วางแผนอย่างลงตัว ตั้งแต่วัดวาอารามไปจนถึงบรรยากาศยามค่ำคืน" : "A thoughtful pace, from temple bells to rooftop nights"}</span>
          </div>
          <div class="grid grid-cols-${overviewGridCols} gap-3">
            ${overviewCardsHtml}
          </div>

          <!-- FOOTER -->
          <div class="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[9px] font-medium text-slate-400">
            <span>Generated by Pixinerary AI</span>
            <span>Page 1 of ${totalPages}</span>
          </div>
        </section>

        <!-- DAY PAGES -->
        ${dayPagesHtml}

      </div>
    </div>

    <!-- FLOATING STATUS -->
    <div class="fixed bottom-5 left-5 hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-500 shadow-lg lg:flex print:hidden">
      ${ICONS.clock} Auto-saved just now
    </div>
  </main>

  <script>
    function toggleLayout(mode) {
      var btnPreview = document.getElementById('btn-preview');
      var btnPrint = document.getElementById('btn-print');
      if (mode === 'print') {
        document.body.classList.add('print-layout');
        btnPrint.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
        btnPrint.classList.remove('text-slate-400');
        btnPreview.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
        btnPreview.classList.add('text-slate-400');
      } else {
        document.body.classList.remove('print-layout');
        btnPreview.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
        btnPreview.classList.remove('text-slate-400');
        btnPrint.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
        btnPrint.classList.add('text-slate-400');
      }
    }

    function initInteractiveRouteMap() {
      var mapContainer = document.getElementById('interactive-route-map');
      if (!mapContainer || typeof L === 'undefined') return;

      var map = L.map('interactive-route-map', {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      var allLatLngs = [];
      var tripMapData = ${JSON.stringify(mapData)};

      tripMapData.days.forEach(function(day) {
        var dayLatLngs = [];

        day.activities.forEach(function(act) {
          if (!act.lat || !act.lng) return;
          var latLng = [act.lat, act.lng];
          dayLatLngs.push(latLng);
          allLatLngs.push(latLng);

          var pinHtml = '<div style="' +
            'background-color:' + day.accentColor + ';' +
            'color:white;' +
            'width:26px;height:26px;' +
            'border-radius:50%;' +
            'border:2.5px solid white;' +
            'box-shadow:0 3px 8px rgba(0,0,0,0.35);' +
            'display:flex;align-items:center;justify-content:center;' +
            'font-size:11px;font-weight:800;' +
            'cursor:pointer;' +
          '">' + act.index + '</div>';

          var customIcon = L.divIcon({
            className: 'custom-map-pin',
            html: pinHtml,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -14]
          });

          var marker = L.marker(latLng, { icon: customIcon }).addTo(map);

          var popupHtml = '<div style="font-family:sans-serif;padding:2px 0;">' +
            '<div style="font-size:9px;font-weight:800;color:' + day.accentColor + ';text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;">' +
              'Day ' + day.day + (act.time ? ' · ' + act.time : '') +
            '</div>' +
            '<div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.2;">' + act.name + '</div>' +
            (act.localName ? '<div style="font-size:10px;color:#64748b;margin-top:2px;">' + act.localName + '</div>' : '') +
            '<div style="font-size:9px;font-weight:600;color:#94a3b8;margin-top:4px;text-transform:uppercase;">' + act.category + '</div>' +
          '</div>';

          marker.bindPopup(popupHtml);
        });

        if (dayLatLngs.length > 1) {
          L.polyline(dayLatLngs, {
            color: day.accentColor,
            weight: 3.5,
            opacity: 0.85,
            dashArray: '5, 7',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
        }
      });

      if (allLatLngs.length > 0) {
        map.fitBounds(allLatLngs, { padding: [35, 35], maxZoom: 15 });
      } else {
        map.setView([13.7563, 100.5018], 12);
      }

      setTimeout(function() {
        map.invalidateSize();
      }, 250);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initInteractiveRouteMap);
    } else {
      setTimeout(initInteractiveRouteMap, 100);
    }
  </script>
</body>
</html>`;
}
