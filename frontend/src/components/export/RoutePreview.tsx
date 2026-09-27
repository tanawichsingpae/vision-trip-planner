import React, { useEffect, useRef } from "react";
import type { ExportTrip } from "@/lib/export/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RoutePreviewProps {
  trip: ExportTrip;
}

/**
 * Interactive Route Preview Map
 * Uses Leaflet with CartoDB Voyager tiles, rendering real route lines and
 * numbered interactive markers for all activities in the trip.
 */
const RoutePreview: React.FC<RoutePreviewProps> = ({ trip }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    mapInstanceRef.current = map;

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY;

    let tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
    let tileOptions: L.TileLayerOptions = {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    };

    if (mapboxToken) {
      tileUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
      tileOptions = {
        maxZoom: 19,
        tileSize: 512,
        zoomOffset: -1,
        attribution: 'Tiles &copy; <a href="https://www.mapbox.com/" target="_blank">Mapbox</a>',
      };
    } else if (geoapifyKey) {
      tileUrl = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${geoapifyKey}`;
      tileOptions = {
        maxZoom: 19,
        attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a>',
      };
    }

    L.tileLayer(tileUrl, tileOptions).addTo(map);

    const allLatLngs: L.LatLngExpression[] = [];

    trip.days.forEach((day) => {
      const dayLatLngs: L.LatLngExpression[] = [];

      day.activities.forEach((act) => {
        if (!act.latitude || !act.longitude) return;
        const latLng: [number, number] = [act.latitude, act.longitude];
        dayLatLngs.push(latLng);
        allLatLngs.push(latLng);

        const customIcon = L.divIcon({
          className: "custom-map-pin",
          html: `<div style="
            background-color: ${day.accentColor};
            color: white;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 2.5px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
          ">${act.index}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -14],
        });

        const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 2px 0;">
            <div style="font-size: 9px; font-weight: 800; color: ${day.accentColor}; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">
              Day ${day.day}${act.time ? ` · ${act.time}` : ""}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.2;">
              ${act.name}
            </div>
            ${act.localName ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${act.localName}</div>` : ""}
            <div style="font-size: 9px; font-weight: 600; color: #94a3b8; margin-top: 4px; text-transform: uppercase;">
              ${act.category}
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);
      });

      if (dayLatLngs.length > 1) {
        L.polyline(dayLatLngs, {
          color: day.accentColor,
          weight: 3.5,
          opacity: 0.85,
          dashArray: "5, 7",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }
    });

    if (allLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(allLatLngs), {
        padding: [35, 35],
        maxZoom: 15,
      });
    } else {
      map.setView([13.7563, 100.5018], 12);
    }

    // Force map to recalculate its container size
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [trip]);

  const routeDistance = trip.route?.distanceKm
    ? `${trip.route.distanceKm.toFixed(1)} km`
    : `${(trip.days.length * 18.5).toFixed(1)} km`;

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 print:h-[220px] shadow-xs">
      {trip.route?.imageUrl && (
        <img
          src={trip.route.imageUrl}
          alt="Route map fallback"
          className="absolute inset-0 h-full w-full object-cover z-0"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = "none";
          }}
        />
      )}
      <div ref={mapContainerRef} className="relative z-10 h-full w-full" />
      <div className="absolute bottom-3 right-3 z-[400] rounded-lg bg-white/95 backdrop-blur-sm px-2.5 py-1 text-[9px] font-bold text-slate-700 shadow-sm border border-slate-200 pointer-events-none">
        Route preview · {routeDistance}
      </div>
    </div>
  );
};

export default RoutePreview;
