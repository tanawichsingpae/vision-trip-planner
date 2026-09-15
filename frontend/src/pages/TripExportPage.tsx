import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TripExportDocument from "@/components/export/TripExportDocument";
import { normalizeExportTrip } from "@/lib/export/normalizeExportTrip";
import type { ExportTrip } from "@/lib/export/types";
import type { DayPlan } from "@/components/TravelItinerary";
import "@/styles/export.css";

/**
 * TripExportPage
 *
 * Standalone page at /export/trip that renders the printable A4 document.
 * Receives trip data via:
 *   1. window.__EXPORT_TRIP_DATA__ (set by the parent page before navigating here)
 *   2. Or query params for minimal data loading
 *
 * The browser preview and Chromium PDF render the same document.
 */

// Extend the global Window interface for the export data bridge
declare global {
  interface Window {
    __EXPORT_TRIP_DATA__?: {
      itinerary: DayPlan[];
      destination: string;
      subtitle?: string;
      tripStartDate?: string;
      language?: "th" | "en";
      cityName?: string;
      staticMapUrl?: string;
    };
  }
}

const TripExportPage: React.FC = () => {
  const [exportTrip, setExportTrip] = useState<ExportTrip | null>(null);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const data = window.__EXPORT_TRIP_DATA__;
      if (!data || !data.itinerary || data.itinerary.length === 0) {
        setError("No trip data available. Please generate an itinerary first.");
        return;
      }

      const trip = normalizeExportTrip({
        itinerary: data.itinerary,
        destination: data.destination || "Trip",
        subtitle: data.subtitle,
        tripStartDate: data.tripStartDate
          ? new Date(data.tripStartDate)
          : null,
        language: data.language || "en",
        cityName: data.cityName,
        staticMapUrl: data.staticMapUrl,
      });

      setExportTrip(trip);
    } catch (err) {
      console.error("Failed to normalize export trip:", err);
      setError("Failed to prepare export data.");
    }
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Inter, sans-serif",
          color: "#475569",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "48px" }}>📄</div>
        <p style={{ fontSize: "16px", fontWeight: 500 }}>{error}</p>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "8px 20px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            color: "#3b82f6",
          }}
        >
          ← Back to Planner
        </button>
      </div>
    );
  }

  if (!exportTrip) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Inter, sans-serif",
          color: "#94a3b8",
        }}
      >
        Loading export...
      </div>
    );
  }

  return <TripExportDocument trip={exportTrip} />;
};

export default TripExportPage;
