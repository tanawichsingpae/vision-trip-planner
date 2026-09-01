import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, Navigation, Calendar, Layers } from "lucide-react";
import { importMapsLibrary } from "@/lib/mapsLoader";
import type { LocationData } from "@/components/LocationDisplay";
import { type DayPlan, type Activity } from "./TravelItinerary";

interface MapSectionProps {
  location: LocationData;
  itinerary: DayPlan[];
  dayColors: string[];
}

interface ProcessedMarkerData {
  activity: Activity;
  dayIndex: number;
  activityIndex: number;
  originalLat: number;
  originalLng: number;
  renderLat: number;
  renderLng: number;
  isOverlapping: boolean;
  color: string;
}

const MapSection = ({ location, itinerary, dayColors }: MapSectionProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");

  // -----------------------------
  // 1. LOAD GOOGLE MAP
  // -----------------------------
  useEffect(() => {
    importMapsLibrary("maps").then(() => {
      if (mapRef.current && !mapInstance.current) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: location.coordinates,
          zoom: 13,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        setIsLoaded(true);
        setTimeout(() => {
          if (mapInstance.current) {
            google.maps.event.trigger(mapInstance.current, "resize");
          }
        }, 300);
      }
    });
  }, [location.coordinates]);

  // -----------------------------
  // 2. DRAW MARKERS & POLYLINES (Synchronized Indexing + Hotel Badge & Spiderfy)
  // -----------------------------
  useEffect(() => {
    if (!mapInstance.current || !isLoaded) return;

    const googleMaps = window.google;

    // Clear previous markers & polylines
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    linesRef.current.forEach((l) => l.setMap(null));
    linesRef.current = [];

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const bounds = new googleMaps.maps.LatLngBounds();

    // ── STEP A: Process All Activities & Assign Exact 1-Based Itinerary Index ──
    const allProcessedActivities: { activity: Activity; dayIndex: number; activityIndex: number; isHotel: boolean }[] = [];

    itinerary.forEach((day, dayIndex) => {
      // Filter by selected day if user chose a specific day tab
      if (selectedDayFilter !== "all" && selectedDayFilter !== dayIndex) {
        return;
      }

      day.activities.forEach((act, actIdx) => {
        if (!act.lat || !act.lng || act.lat === 0 || act.lng === 0) return;

        const isHotel = act.type === "hotel" || act.title.toLowerCase().includes("check in") || act.title.toLowerCase().includes("check out");
        allProcessedActivities.push({
          activity: act,
          dayIndex,
          activityIndex: actIdx, // Exact index matching Itinerary Overview
          isHotel,
        });
      });
    });

    // ── STEP B: Spiderfy Micro-Offset Algorithm for ALL Overlapping Pins ──
    const coordClusters = new Map<string, typeof allProcessedActivities>();
    allProcessedActivities.forEach((item) => {
      const key = `${item.activity.lat!.toFixed(4)}_${item.activity.lng!.toFixed(4)}`;
      if (!coordClusters.has(key)) coordClusters.set(key, []);
      coordClusters.get(key)!.push(item);
    });

    const processedMarkers: ProcessedMarkerData[] = [];

    coordClusters.forEach((cluster) => {
      const clusterSize = cluster.length;
      cluster.forEach((item, i) => {
        const origLat = item.activity.lat!;
        const origLng = item.activity.lng!;
        let renderLat = origLat;
        let renderLng = origLng;

        if (clusterSize > 1) {
          // Spiderfy offset formula (spiral/circle offset ~25 meters radius)
          const angle = (2 * Math.PI * i) / clusterSize;
          const radiusKm = 0.025; // 25 meters
          const latOffset = (radiusKm / 111) * Math.sin(angle);
          const lngOffset = (radiusKm / (111 * Math.cos((origLat * Math.PI) / 180))) * Math.cos(angle);
          renderLat = origLat + latOffset;
          renderLng = origLng + lngOffset;
        }

        processedMarkers.push({
          activity: item.activity,
          dayIndex: item.dayIndex,
          activityIndex: item.activityIndex,
          originalLat: origLat,
          originalLng: origLng,
          renderLat,
          renderLng,
          isOverlapping: clusterSize > 1,
          color: item.isHotel ? "#4f46e5" : dayColors[item.dayIndex % dayColors.length],
        });
      });
    });

    // ── STEP C: Render All Markers with Synchronized Numbering & Custom InfoWindows ──
    processedMarkers.forEach((m) => {
      const pos = { lat: m.renderLat, lng: m.renderLng };
      bounds.extend(pos);

      // Connector line if spiderfied from original center
      if (m.isOverlapping) {
        const connector = new googleMaps.maps.Polyline({
          path: [
            { lat: m.originalLat, lng: m.originalLng },
            { lat: m.renderLat, lng: m.renderLng },
          ],
          strokeColor: "#94a3b8",
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
          map: mapInstance.current!,
        });
        linesRef.current.push(connector);
      }

      const isHotel = m.activity.type === "hotel" || m.activity.title.toLowerCase().includes("check in") || m.activity.title.toLowerCase().includes("check out");

      let markerIcon: google.maps.Icon | google.maps.Symbol;
      let markerLabel: google.maps.MarkerLabel | undefined;

      if (isHotel) {
        const svg = `
          <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
              </filter>
            </defs>
            <path d="M20 0C9 0 0 9 0 20C0 34 20 48 20 48S40 34 40 20C40 9 31 0 20 0Z" fill="#4f46e5" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>
            <g fill="#ffffff" transform="translate(8, 9) scale(0.85)">
              <path d="M19 7h-8v8H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4zm-7 6h7c1.1 0 2 .9 2 2v2H12v-4zM7 11c1.66 0 3-1.34 3-3S8.66 5 7 5 4 6.34 4 8s1.34 3 3 3z"/>
            </g>
            <circle cx="30" cy="10" r="9.5" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
            <text x="30" y="13.5" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">${m.activityIndex + 1}</text>
          </svg>
        `;
        markerIcon = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          anchor: new googleMaps.maps.Point(20, 48),
          scaledSize: new googleMaps.maps.Size(40, 50),
        };
        markerLabel = undefined;
      } else {
        markerIcon = {
          path: googleMaps.maps.SymbolPath.CIRCLE,
          fillColor: m.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 9,
        };
        markerLabel = {
          text: String(m.activityIndex + 1),
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: "bold",
        };
      }

      const marker = new googleMaps.maps.Marker({
        position: pos,
        map: mapInstance.current!,
        icon: markerIcon,
        label: markerLabel,
        title: `${isHotel ? "🏨 " : ""}Spot ${m.activityIndex + 1}: ${m.activity.title}`,
        zIndex: isHotel ? 999 : m.activityIndex,
      });

      const infoContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 240px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background-color: ${m.color}; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px;">
              Day ${m.dayIndex + 1} · Spot ${m.activityIndex + 1}
            </span>
            <span style="font-size: 11px; font-weight: 600; color: #64748b;">${m.activity.time || ""}</span>
          </div>
          <div style="font-weight: 700; font-size: 13px; color: ${isHotel ? "#4f46e5" : "#0f172a"}; line-height: 1.3;">
            ${isHotel ? "🏨 " : ""}${m.activity.title}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${m.activity.description || ""}
          </div>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.activity.title)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; font-size: 11px; color: #2563eb; font-weight: 600; text-decoration: none;">View on Google Maps →</a>
        </div>
      `;

      marker.addListener("click", () => {
        if (infoWindowRef.current && mapInstance.current) {
          infoWindowRef.current.setContent(infoContent);
          infoWindowRef.current.open(mapInstance.current, marker);
        }
      });

      markersRef.current.push(marker);
    });

    // ── STEP D: Draw Day Polylines in Exact Itinerary Order ──
    itinerary.forEach((day, dayIndex) => {
      if (selectedDayFilter !== "all" && selectedDayFilter !== dayIndex) return;

      const color = dayColors[dayIndex % dayColors.length];
      const dayPath: { lat: number; lng: number }[] = [];

      day.activities.forEach((act) => {
        if (!act.lat || !act.lng || act.lat === 0 || act.lng === 0) return;

        const pm = processedMarkers.find((m) => m.dayIndex === dayIndex && m.activity.id === act.id);
        if (pm) {
          dayPath.push({ lat: pm.renderLat, lng: pm.renderLng });
        } else {
          dayPath.push({ lat: act.lat, lng: act.lng });
        }
      });

      if (dayPath.length >= 2) {
        const polyline = new googleMaps.maps.Polyline({
          path: dayPath,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: mapInstance.current!,
        });

        linesRef.current.push(polyline);
      }
    });

    if (!bounds.isEmpty()) {
      mapInstance.current.fitBounds(bounds);
    }
  }, [isLoaded, itinerary, dayColors, selectedDayFilter]);

  // -----------------------------
  // UI RENDER
  // -----------------------------
  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <MapIcon className="w-6 h-6 text-primary" />
          Interactive Map
        </h2>

        {/* Day Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedDayFilter("all")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selectedDayFilter === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background/80 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Days
          </button>
          {itinerary.map((_, idx) => {
            const color = dayColors[idx % dayColors.length];
            const isSelected = selectedDayFilter === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDayFilter(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isSelected
                    ? "bg-card text-foreground border-primary shadow-md ring-2 ring-primary/30"
                    : "bg-background/80 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                Day {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-lg border border-white/20">
        <div className="relative h-[420px]">
          <div ref={mapRef} className="w-full h-full" />

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-[2px]">
              <Navigation className="w-8 h-8 animate-pulse text-primary" />
            </div>
          )}
        </div>
      </div>

      {/* Day Legend */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          Day Legend & Filter
        </h3>

        <div className="flex flex-wrap gap-3 p-4 bg-card/60 backdrop-blur-sm rounded-xl border border-border/60 shadow-sm">
          {itinerary.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedDayFilter(selectedDayFilter === index ? "all" : index)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                selectedDayFilter === index
                  ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                  : "bg-background/50 border-border hover:border-primary/40 text-foreground"
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/80 shrink-0"
                style={{ backgroundColor: dayColors[index % dayColors.length] }}
              />
              <span>Day {index + 1}</span>
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground font-mono">
            <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
            <span>🏨 Hotel Accommodation</span>
          </div>
        </div>
      </div>

      {/* Itinerary Overview */}
      <div className="mt-8">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Itinerary Overview ({selectedDayFilter === "all" ? "All Days" : `Day ${selectedDayFilter + 1}`})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {itinerary.map((day, dayIndex) => {
            if (selectedDayFilter !== "all" && selectedDayFilter !== dayIndex) return null;

            return (
              <div
                key={dayIndex}
                className="bg-card/50 backdrop-blur-sm p-5 rounded-2xl border border-border/60 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs"
                    style={{ backgroundColor: dayColors[dayIndex % dayColors.length] }}
                  >
                    {dayIndex + 1}
                  </div>
                  <h4 className="font-bold text-foreground">
                    Day {dayIndex + 1}
                  </h4>
                </div>

                <ul className="space-y-2">
                  {day.activities.map((activity, i) => (
                    <li key={activity.id || `activity-${dayIndex}-${i}`} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="font-bold text-primary/60 shrink-0 mt-0.5">
                        {i + 1}.
                      </span>
                      <span className="font-medium text-foreground leading-snug">
                        {activity.type === "hotel" && "🏨 "}
                        {activity.title}
                        {activity.time && <span className="text-xs text-muted-foreground ml-1.5">({activity.time})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MapSection;