// ─── Export Data Model ───────────────────────────────────────────────────────
// Normalized data types for PDF export, independent from the AI/API response shape.

export type ExportTrip = {
  title: string;
  subtitle?: string;
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalActivities: number;

  days: ExportDay[];

  route?: {
    distanceKm?: number;
    coordinates?: Array<{
      lat: number;
      lng: number;
    }>;
    imageUrl?: string;
  };
};

export type ExportDay = {
  day: number;
  date: string;
  title: string;
  description?: string;
  accentColor: string;

  transit?: {
    durationMinutes?: number;
    distanceKm?: number;
  };

  activities: ExportActivity[];
};

export type ExportActivity = {
  index: number;
  time: string;
  name: string;
  localName?: string;
  category: string;
  description?: string;
  imageUrl?: string;

  rating?: number;
  reviewCount?: number;

  status?: "Open" | "Closed" | "Unknown";

  transit?: {
    durationMinutes?: number;
    distanceKm?: number;
  };

  latitude?: number;
  longitude?: number;
  mapUrl?: string;
};

export const DAY_ACCENTS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f43f5e",
  "#14b8a6",
  "#84cc16",
  "#eab308",
  "#f97316",
  "#d946ef",
  "#0ea5e9",
  "#ec4899",
  "#a855f7",
];
