import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Map as MapIcon, Navigation, Calendar, Layers, Globe } from "lucide-react";
import type { LocationData } from "@/components/LocationDisplay";
import { type DayPlan, type Activity } from "./TravelItinerary";
import { fetchPlaceDetails } from "@/api/places";
import { haversineDistance } from "@/api/spatialPlanner";
import { useLanguage } from "@/context/LanguageContext";

interface MapSectionProps {
  location: LocationData;
  itinerary: DayPlan[];
  dayColors: string[];
  selectedActivity?: Activity | null;
  selectedPlace?: { lat: number; lng: number; title?: string } | null;
  hoveredActivityId?: string | null;
  onSelectActivity?: (activity: Activity) => void;
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

const MapSection = ({
  location,
  itinerary,
  dayColors,
  selectedActivity,
  selectedPlace,
  hoveredActivityId,
  onSelectActivity,
}: MapSectionProps) => {
  const { language, toggleLanguage, locPlace, locDesc, t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, { marker: L.Marker; dayIndex: number; lat: number; lng: number }>>(new Map());
  const focusMarkerRef = useRef<L.Marker | null>(null);

  // Base Tile Layer References for Map Style Switching
  const standardLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLabelsLayerRef = useRef<L.TileLayer | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "all">("all");
  const [mapStyle, setMapStyle] = useState<"standard" | "satellite">("standard");

  // -----------------------------
  // 1. INITIALIZE LEAFLET MAP (ONCE ON MOUNT)
  // -----------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    // Clean up any residual leaflet id from container (React remount protection)
    if ((mapRef.current as any)._leaflet_id) {
      delete (mapRef.current as any)._leaflet_id;
    }

    const initialCenter: [number, number] = [
      location.coordinates?.lat || 13.7563,
      location.coordinates?.lng || 100.5018,
    ];

    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    // 1A. High-Definition Tile Layer (Mapbox Streets v12 / Geoapify / OpenStreetMap)
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY;

    let standardTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    let standardAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    let standardOptions: L.TileLayerOptions = {
      maxZoom: 19,
      attribution: standardAttribution,
    };

    if (mapboxToken) {
      standardTileUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
      standardAttribution = 'Tiles &copy; <a href="https://www.mapbox.com/" target="_blank">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
      standardOptions = {
        maxZoom: 19,
        tileSize: 512,
        zoomOffset: -1,
        attribution: standardAttribution,
      };
    } else if (geoapifyKey) {
      standardTileUrl = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${geoapifyKey}`;
      standardAttribution = 'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
      standardOptions = {
        maxZoom: 19,
        attribution: standardAttribution,
      };
    }

    const standardLayer = L.tileLayer(standardTileUrl, standardOptions);

    // 1B. Satellite Tile Layer (Mapbox Satellite Streets v12 / Esri World Imagery)
    let satelliteLayer: L.TileLayer;
    let satelliteLabelsLayer: L.TileLayer;

    if (mapboxToken) {
      satelliteLayer = L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
        {
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          attribution: 'Tiles &copy; <a href="https://www.mapbox.com/" target="_blank">Mapbox</a>',
        }
      );
      // Mapbox satellite-streets-v12 already embeds vector street and place labels
      satelliteLabelsLayer = L.tileLayer("", { maxZoom: 19 });
    } else {
      satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
        }
      );
      satelliteLabelsLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          pane: "overlayPane",
        }
      );
    }

    standardLayerRef.current = standardLayer;
    satelliteLayerRef.current = satelliteLayer;
    satelliteLabelsLayerRef.current = satelliteLabelsLayer;

    // Add standard layer by default
    standardLayer.addTo(map);

    // Create Layer Groups for markers and lines
    const linesGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    markersLayerRef.current = markersGroup;
    linesLayerRef.current = linesGroup;
    mapInstance.current = map;
    setIsLoaded(true);

    let resizeObserver: ResizeObserver | null = null;
    if (mapRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstance.current) {
          try {
            mapInstance.current.invalidateSize();
          } catch (e) {
            // Container might be detached
          }
        }
      });
      resizeObserver.observe(mapRef.current);
    }

    const initTimer = setTimeout(() => {
      if (mapInstance.current) {
        try {
          map.invalidateSize();
        } catch (e) {
          // Container might be detached
        }
      }
    }, 200);

    return () => {
      clearTimeout(initTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (e) {
          // Container might be detached
        }
        mapInstance.current = null;
      }
      markersLayerRef.current = null;
      linesLayerRef.current = null;
      standardLayerRef.current = null;
      satelliteLayerRef.current = null;
      satelliteLabelsLayerRef.current = null;
      setIsLoaded(false);
    };
  }, []);

  // -----------------------------
  // MAP STYLE SWITCHER EFFECT (Standard ↔ Satellite)
  // -----------------------------
  useEffect(() => {
    if (!mapInstance.current || !standardLayerRef.current || !satelliteLayerRef.current || !satelliteLabelsLayerRef.current) {
      return;
    }
    const map = mapInstance.current;

    if (mapStyle === "satellite") {
      if (map.hasLayer(standardLayerRef.current)) {
        map.removeLayer(standardLayerRef.current);
      }
      if (!map.hasLayer(satelliteLayerRef.current)) {
        satelliteLayerRef.current.addTo(map);
      }
      if (!map.hasLayer(satelliteLabelsLayerRef.current)) {
        satelliteLabelsLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(satelliteLayerRef.current)) {
        map.removeLayer(satelliteLayerRef.current);
      }
      if (map.hasLayer(satelliteLabelsLayerRef.current)) {
        map.removeLayer(satelliteLabelsLayerRef.current);
      }
      if (!map.hasLayer(standardLayerRef.current)) {
        standardLayerRef.current.addTo(map);
      }
    }
  }, [mapStyle, isLoaded]);

  // Update map center when city coordinates change (only if no card is selected)
  useEffect(() => {
    if (!mapInstance.current || !isLoaded) return;
    const lat = location.coordinates?.lat;
    const lng = location.coordinates?.lng;
    if (lat && lng && !selectedActivity && !selectedPlace) {
      mapInstance.current.setView([lat, lng], 13);
    }
  }, [location.coordinates?.lat, location.coordinates?.lng, isLoaded]);

  // -----------------------------
  // 2. DRAW MARKERS & POLYLINES
  // -----------------------------
  useEffect(() => {
    if (!mapInstance.current || !markersLayerRef.current || !linesLayerRef.current) return;

    const map = mapInstance.current;
    markersLayerRef.current.clearLayers();
    linesLayerRef.current.clearLayers();
    markersMapRef.current.clear();

    // ── STEP A: Process All Activities & Assign Exact 1-Based Itinerary Index ──
    const allProcessedActivities: {
      activity: Activity;
      dayIndex: number;
      activityIndex: number;
      isHotel: boolean;
    }[] = [];

    itinerary.forEach((day, dayIndex) => {
      if (selectedDayFilter !== "all" && selectedDayFilter !== dayIndex) {
        return;
      }

      day.activities.forEach((act, actIdx) => {
        if (!act.lat || !act.lng || act.lat === 0 || act.lng === 0) return;

        const isHotel =
          act.type === "hotel" ||
          act.title.toLowerCase().includes("check in") ||
          act.title.toLowerCase().includes("check out");
        allProcessedActivities.push({
          activity: act,
          dayIndex,
          activityIndex: actIdx,
          isHotel,
        });
      });
    });

    // ── STEP B: Spiderfy Micro-Offset Algorithm for Overlapping Pins ──
    const coordClusters: Array<typeof allProcessedActivities> = [];
    allProcessedActivities.forEach((item) => {
      const match = coordClusters.find((cluster) => {
        const first = cluster[0];
        return (
          haversineDistance(
            { lat: first.activity.lat!, lng: first.activity.lng! },
            { lat: item.activity.lat!, lng: item.activity.lng! }
          ) <= 0.05 // Group pins within 50 meters
        );
      });
      if (match) {
        match.push(item);
      } else {
        coordClusters.push([item]);
      }
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
          const angle = (2 * Math.PI * i) / clusterSize;
          // 80 to 120 meters visible spiderfy dispersal radius (prevents pin clumping)
          const radiusKm = Math.min(0.12, 0.08 + (clusterSize - 2) * 0.015);
          const latOffset = (radiusKm / 111) * Math.sin(angle);
          const lngOffset =
            (radiusKm / (111 * Math.cos((origLat * Math.PI) / 180))) * Math.cos(angle);
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

    const latLngBounds: [number, number][] = [];

    // ── STEP C: Render All Markers & Popups ──
    processedMarkers.forEach((m) => {
      latLngBounds.push([m.renderLat, m.renderLng]);

      // Connector line if spiderfied
      if (m.isOverlapping) {
        L.polyline(
          [
            [m.originalLat, m.originalLng],
            [m.renderLat, m.renderLng],
          ],
          {
            color: "#94a3b8",
            weight: 1.5,
            dashArray: "3, 3",
            opacity: 0.8,
          }
        ).addTo(linesLayerRef.current!);
      }

      const isHotel =
        m.activity.type === "hotel" ||
        m.activity.title.toLowerCase().includes("check in") ||
        m.activity.title.toLowerCase().includes("check out");

      let iconHtml = "";
      let iconSize: [number, number] = [28, 28];
      let iconAnchor: [number, number] = [14, 14];

      if (isHotel) {
        iconSize = [36, 44];
        iconAnchor = [18, 44];
        iconHtml = `
          <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
            <svg width="36" height="44" viewBox="0 0 40 50">
              <path d="M20 0C9 0 0 9 0 20C0 34 20 48 20 48S40 34 40 20C40 9 31 0 20 0Z" fill="#4f46e5" stroke="#ffffff" stroke-width="2.5"/>
              <g fill="#ffffff" transform="translate(8, 9) scale(0.85)">
                <path d="M19 7h-8v8H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4zm-7 6h7c1.1 0 2 .9 2 2v2H12v-4zM7 11c1.66 0 3-1.34 3-3S8.66 5 7 5 4 6.34 4 8s1.34 3 3 3z"/>
              </g>
            </svg>
            <span style="position: absolute; top: -3px; right: -3px; background: #ef4444; color: #fff; border-radius: 9999px; width: 18px; height: 18px; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
              ${m.activityIndex + 1}
            </span>
          </div>
        `;
      } else {
        iconSize = [28, 28];
        iconAnchor = [14, 14];
        iconHtml = `
          <div style="width: 28px; height: 28px; border-radius: 9999px; background-color: ${m.color}; border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 11px; font-weight: 900; cursor: pointer; transition: transform 0.15s ease;">
            ${m.activityIndex + 1}
          </div>
        `;
      }

      const customIcon = L.divIcon({
        className: "custom-pixinerary-marker",
        html: iconHtml,
        iconSize,
        iconAnchor,
        popupAnchor: [0, -iconAnchor[1]],
      });

      const spotTitle = locPlace(m.activity) || m.activity.title;
      const spotDesc = locDesc(m.activity) || m.activity.description;
      const badgeText = language === "th"
        ? `วันที่ ${m.dayIndex + 1} · จุดที่ ${m.activityIndex + 1}`
        : `Day ${m.dayIndex + 1} · Stop ${m.activityIndex + 1}`;
      const navBtnText = language === "th" ? "🚗 นำทาง (Google Maps)" : "🚗 Directions (Google Maps)";
      const searchBtnText = language === "th" ? "📍 ค้นหา" : "📍 Search";
      const searchTooltip = language === "th" ? "ค้นหาบน Google Maps" : "Search on Google Maps";

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; max-width: 240px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="background-color: ${m.color}; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px;">
              ${badgeText}
            </span>
            ${
              m.activity.time
                ? `<span style="font-size: 11px; font-weight: 600; color: #64748b;">${m.activity.time}</span>`
                : ""
            }
          </div>
          <div style="font-weight: 700; font-size: 13px; color: ${
            isHotel ? "#4f46e5" : "#0f172a"
          }; line-height: 1.3;">
            ${isHotel ? "🏨 " : ""}${spotTitle}
          </div>
          ${
            spotDesc
              ? `<div style="font-size: 11px; color: #475569; margin-top: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                  ${spotDesc}
                </div>`
              : ""
          }
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${m.originalLat},${m.originalLng}" target="_blank" rel="noopener noreferrer" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; border-radius: 6px; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 600; text-decoration: none; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
              <span>${navBtnText}</span>
            </a>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              spotTitle
            )}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; padding: 6px 8px; border-radius: 6px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 500; text-decoration: none; border: 1px solid #cbd5e1;" title="${searchTooltip}">
              <span>${searchBtnText}</span>
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([m.renderLat, m.renderLng], {
        icon: customIcon,
        zIndexOffset: isHotel ? 1000 : m.activityIndex * 10,
      }).bindPopup(popupHtml);

      marker.on("click", () => {
        onSelectActivity?.(m.activity);
      });

      marker.addTo(markersLayerRef.current!);

      // Register marker by ID and normalized title for instant focus on card click
      markersMapRef.current.set(m.activity.id, {
        marker,
        dayIndex: m.dayIndex,
        lat: m.renderLat,
        lng: m.renderLng,
      });
      if (m.activity.title) {
        markersMapRef.current.set(m.activity.title.toLowerCase().trim(), {
          marker,
          dayIndex: m.dayIndex,
          lat: m.renderLat,
          lng: m.renderLng,
        });
      }
    });

    // ── STEP D: Draw Day Polylines in Exact Itinerary Order ──
    itinerary.forEach((day, dayIndex) => {
      if (selectedDayFilter !== "all" && selectedDayFilter !== dayIndex) return;

      const color = dayColors[dayIndex % dayColors.length];
      const dayPath: [number, number][] = [];

      day.activities.forEach((act) => {
        if (!act.lat || !act.lng || act.lat === 0 || act.lng === 0) return;

        const pm = processedMarkers.find(
          (m) => m.dayIndex === dayIndex && m.activity.id === act.id
        );
        if (pm) {
          dayPath.push([pm.renderLat, pm.renderLng]);
        } else {
          dayPath.push([act.lat, act.lng]);
        }
      });

      if (dayPath.length >= 2) {
        L.polyline(dayPath, {
          color,
          weight: 4,
          opacity: 0.85,
          lineJoin: "round",
        }).addTo(linesLayerRef.current!);
      }
    });

    // ── STEP E: Auto-fit Bounds with Regional Distance Safeguard ──
    if (!selectedActivity && !selectedPlace && latLngBounds.length > 0) {
      const centerLat = location.coordinates?.lat || 13.7563;
      const centerLng = location.coordinates?.lng || 100.5018;
      // Filter out any anomalous points that are > 120km from the trip center
      const validBounds = latLngBounds.filter(([lat, lng]) => {
        const dLat = (lat - centerLat) * 111;
        const dLng = (lng - centerLng) * 111 * Math.cos((centerLat * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLng * dLng) < 120;
      });

      if (validBounds.length > 0) {
        map.fitBounds(validBounds, { padding: [40, 40], maxZoom: 15 });
      } else {
        map.setView([centerLat, centerLng], 13);
      }
    }
  }, [itinerary, dayColors, selectedDayFilter, isLoaded, language]);

  // -----------------------------
  // 3. AUTO-FOCUS SELECTED PIN ON MAP WHEN CARD IS CLICKED
  // -----------------------------
  useEffect(() => {
    if (!mapInstance.current || !isLoaded) return;
    const map = mapInstance.current;

    if (!selectedActivity && !selectedPlace) {
      if (focusMarkerRef.current) {
        focusMarkerRef.current.remove();
        focusMarkerRef.current = null;
      }
      return;
    }

    const targetTitle =
      selectedActivity?.title ||
      (selectedPlace as any)?.title ||
      location.name ||
      "Selected Location";

    const focusTarget = (
      lat: number,
      lng: number,
      title: string,
      dayIndex?: number
    ) => {
      // Auto-switch day filter if pin is on another day
      if (
        dayIndex !== undefined &&
        selectedDayFilter !== "all" &&
        selectedDayFilter !== dayIndex
      ) {
        setSelectedDayFilter("all");
      }

      // Smooth camera pan to target location
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.8,
      });

      const existing =
        (selectedActivity?.id && markersMapRef.current.get(selectedActivity.id)) ||
        markersMapRef.current.get(title.toLowerCase().trim());

      if (existing) {
        existing.marker.openPopup();
        if (focusMarkerRef.current) {
          focusMarkerRef.current.remove();
          focusMarkerRef.current = null;
        }
      } else {
        // Fallback: render dynamic highlight marker with pulsating aura
        if (focusMarkerRef.current) {
          focusMarkerRef.current.remove();
        }

        const focusIcon = L.divIcon({
          className: "pixinerary-focus-pin",
          html: `
            <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <div style="position: absolute; width: 48px; height: 48px; border-radius: 9999px; background: rgba(37, 99, 235, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 32px; height: 32px; border-radius: 9999px; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px;">
                📍
              </div>
            </div>
          `,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
          popupAnchor: [0, -21],
        });

        const newMarker = L.marker([lat, lng], {
          icon: focusIcon,
          zIndexOffset: 3000,
        }).bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
            <div style="font-weight: 700; font-size: 13px; color: #1e40af;">📍 ${title}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Selected from Itinerary</div>
            <div style="margin-top: 8px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; border-radius: 6px; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 600; text-decoration: none; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
                <span>🚗 นำทาง (Google Maps)</span>
              </a>
            </div>
          </div>
        `);

        newMarker.addTo(markersLayerRef.current || map);
        newMarker.openPopup();
        focusMarkerRef.current = newMarker;
      }
    };

    let targetLat = selectedActivity?.lat || selectedPlace?.lat || 0;
    let targetLng = selectedActivity?.lng || selectedPlace?.lng || 0;

    const existing = selectedActivity?.id
      ? markersMapRef.current.get(selectedActivity.id)
      : markersMapRef.current.get(targetTitle.toLowerCase().trim());

    if (existing) {
      focusTarget(existing.lat, existing.lng, targetTitle, existing.dayIndex);
    } else if (targetLat !== 0 && targetLng !== 0) {
      focusTarget(targetLat, targetLng, targetTitle);
    } else if (selectedActivity?.title) {
      // Immediate on-demand geocoding directly inside MapSection
      fetchPlaceDetails(selectedActivity.title).then((details) => {
        if (details && details.lat && details.lng) {
          focusTarget(details.lat, details.lng, selectedActivity.title);
        }
      });
    }
  }, [selectedActivity, selectedPlace, isLoaded]);

  // -----------------------------
  // 4. HIGHLIGHT HOVERED PIN
  // -----------------------------
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersMapRef.current.forEach((entry, id) => {
      const el = entry.marker.getElement();
      if (el) {
        if (hoveredActivityId && id === hoveredActivityId) {
          el.style.transform += " scale(1.2)";
          el.style.zIndex = "10000";
        } else {
          el.style.zIndex = "";
        }
      }
    });
  }, [hoveredActivityId]);

  // -----------------------------
  // UI RENDER
  // -----------------------------
  return (
    <div className="animate-slide-up w-full p-4 sm:p-5 flex flex-col gap-4">
      {/* Header with Title and Day Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapIcon className="size-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              {t("interactiveMap", "Interactive Map")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("mapVisualRoute", "Visual route & location mapping powered by Mapbox & OpenStreetMap")}
            </p>
          </div>
        </div>

        {/* Day Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedDayFilter("all")}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedDayFilter === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                : "bg-secondary/60 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Layers className="size-3" />
            <span>{t("allDays", "All Days")}</span>
          </button>
          {itinerary.map((_, idx) => {
            const color = dayColors[idx % dayColors.length];
            const isSelected = selectedDayFilter === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDayFilter(idx)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  isSelected
                    ? "bg-card text-foreground border-primary shadow-2xs ring-2 ring-primary/20"
                    : "bg-secondary/60 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{language === "th" ? `วันที่ ${idx + 1}` : `Day ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaflet Map Viewport */}
      <div className="rounded-2xl overflow-hidden shadow-2xs border border-border/70 relative">
        <div className="relative h-[440px] sm:h-[480px] lg:h-[520px] xl:h-[580px]">
          <div ref={mapRef} className="w-full h-full z-0" />

          {/* Floating Map Style Switcher (Standard ↔ Satellite) */}
          <div className="absolute top-3 right-3 z-[400] flex items-center bg-card/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-1 border border-border/70 shadow-md">
            <button
              type="button"
              onClick={() => setMapStyle("standard")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                mapStyle === "standard"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              }`}
              title={language === "th" ? "สลับเป็นแผนที่ถนนปกติ" : "Switch to street map"}
            >
              <MapIcon className="size-3.5" />
              <span>{t("map", "Map")}</span>
            </button>
            <button
              type="button"
              onClick={() => setMapStyle("satellite")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                mapStyle === "satellite"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              }`}
              title={language === "th" ? "สลับเป็นภาพถ่ายดาวเทียม (Satellite Imagery)" : "Switch to satellite imagery"}
            >
              <Globe className="size-3.5" />
              <span>{t("satellite", "Satellite 🛰️")}</span>
            </button>
          </div>

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-[2px]">
              <Navigation className="size-8 animate-pulse text-primary" />
            </div>
          )}
        </div>
      </div>

      {/* Day Legend & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-secondary/30 border border-border/60">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Calendar className="size-3.5 text-primary shrink-0" />
          <span>{t("legend", "Legend:")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {itinerary.map((_, index) => {
            const color = dayColors[index % dayColors.length];
            const isSelected = selectedDayFilter === index;
            return (
              <button
                key={index}
                onClick={() =>
                  setSelectedDayFilter(selectedDayFilter === index ? "all" : index)
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                    : "bg-background/80 border-border/70 hover:border-primary/40 text-foreground"
                }`}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{language === "th" ? `วันที่ ${index + 1}` : `Day ${index + 1}`}</span>
              </button>
            );
          })}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            <span className="size-2.5 rounded-full bg-indigo-600 inline-block shrink-0" />
            <span>{t("hotelStay", "🏨 Hotel Stay")}</span>
          </div>
        </div>
      </div>

      {/* Itinerary Overview (Compact & Responsive) */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t("itineraryOverview", "Itinerary Overview")} (
              {selectedDayFilter === "all" ? t("allDays", "All Days") : (language === "th" ? `วันที่ ${selectedDayFilter + 1}` : `Day ${selectedDayFilter + 1}`)})
            </h3>
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-secondary/80 hover:bg-secondary text-primary border border-border/60 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs"
              title={language === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            >
              <Globe className="size-2.5" />
              <span>{language === "th" ? "TH / EN" : "EN / TH"}</span>
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {language === "th"
              ? `${t("totalSpots", "สถานที่ท่องเที่ยวทั้งหมด")} ${itinerary.reduce((acc, d) => acc + d.activities.length, 0)} ${t("spotsCount", "แห่ง")}`
              : `${itinerary.reduce((acc, d) => acc + d.activities.length, 0)} ${t("totalSpots", "total spots")}`}
          </span>
        </div>

        <div className="space-y-3">
          {itinerary.map((day, dayIndex) => {
            if (selectedDayFilter !== "all" && selectedDayFilter !== dayIndex) return null;

            return (
              <div
                key={dayIndex}
                className="bg-secondary/30 p-4 rounded-2xl border border-border/70 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="size-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-2xs shrink-0"
                    style={{ backgroundColor: dayColors[dayIndex % dayColors.length] }}
                  >
                    {dayIndex + 1}
                  </div>
                  <h4 className="font-bold text-foreground text-xs sm:text-sm">
                    {language === "th"
                      ? `วันที่ ${dayIndex + 1} (${day.activities.length} ${t("activitiesCount", "กิจกรรม")})`
                      : `Day ${dayIndex + 1} (${day.activities.length} ${t("activitiesCount", "activities")})`}
                  </h4>
                </div>

                <ul className="space-y-2">
                  {day.activities.map((activity, i) => (
                    <li
                      key={activity.id || `activity-${dayIndex}-${i}`}
                      onClick={() => onSelectActivity?.(activity)}
                      className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 -mx-1 rounded-lg hover:bg-background/60"
                      title={language === "th" ? "คลิกเพื่อดูหมุดบนแผนที่" : "Click to focus pin on map"}
                    >
                      <span className="font-bold text-primary/70 shrink-0 mt-0.5 w-4">
                        {i + 1}.
                      </span>
                      <div className="flex-1 leading-snug min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-foreground">
                            {activity.type === "hotel" && "🏨 "}
                            {locPlace(activity) || activity.title}
                          </span>
                          {activity.time && (
                            <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded-md bg-secondary/80 shrink-0">
                              {activity.time}
                            </span>
                          )}
                        </div>
                      </div>
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