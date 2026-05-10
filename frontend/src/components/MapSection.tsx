import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, Navigation } from "lucide-react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { LocationData } from "@/components/LocationDisplay";
import { type DayPlan } from "./TravelItinerary";

interface MapSectionProps {
  location: LocationData;
  itinerary: DayPlan[];
  dayColors: string[];
}

const MapSection = ({ location, itinerary, dayColors }: MapSectionProps) => {

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  
  // -----------------------------
  // LOAD GOOGLE MAP
  // -----------------------------

  useEffect(() => {

    setOptions({
      key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      v: "weekly"
    });

    importLibrary("maps").then(() => {

      if (mapRef.current && !mapInstance.current) {

        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: location.coordinates,
          zoom: 13
        });

        setIsLoaded(true);

        setTimeout(() => {
          if (mapInstance.current) {
            google.maps.event.trigger(mapInstance.current, "resize");
          }
        }, 300);
      }

    });

  }, []);

  // -----------------------------
  // DRAW MARKERS + LINES
  // -----------------------------

  useEffect(() => {

    if (!mapInstance.current || !isLoaded) return;

    const googleMaps = window.google;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    linesRef.current.forEach(l => l.setMap(null));
    linesRef.current = [];

    const bounds = new googleMaps.maps.LatLngBounds();

    itinerary.forEach((day, dayIndex) => {

      const color = dayColors[dayIndex % dayColors.length];

      const positions = day.activities
        .filter(a => a.lat && a.lng && a.lat !== 0 && a.lng !== 0)
        .map(a => ({ lat: a.lat!, lng: a.lng! }));

      positions.forEach((pos, index) => {

        bounds.extend(pos);

        const marker = new googleMaps.maps.Marker({
          position: pos,
          map: mapInstance.current!,
          icon: {
            path: googleMaps.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 8
          },
          label: {
            text: String(index + 1),
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold"
          }
        });

        markersRef.current.push(marker);

      });

      if (positions.length >= 2) {

        const polyline = new googleMaps.maps.Polyline({
          path: positions,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: mapInstance.current!
        });

        linesRef.current.push(polyline);

      }

    });

    if (!bounds.isEmpty()) {
      mapInstance.current.fitBounds(bounds);
    }

  }, [isLoaded, itinerary, dayColors]);

  // -----------------------------
  // UI
  // -----------------------------

  return (

    <div className="animate-slide-up max-w-4xl mx-auto">

      <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <MapIcon className="w-6 h-6 text-primary" />
        Interactive Map
      </h2>

      <div className="glass-card rounded-2xl overflow-hidden shadow-lg border border-white/20">

        <div className="relative h-[400px]">
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
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Day Legend
        </h3>

        <div className="flex flex-wrap gap-4 p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200/50 shadow-sm">
          {itinerary.map((day, index) => (
            <div key={index} className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: dayColors[index % dayColors.length] }}
              />
              <span className="text-sm font-medium text-slate-700">
                Day {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Itinerary Overview */}
      <div className="mt-8">

        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Itinerary Overview
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {itinerary.map((day, dayIndex) => (

            <div key={dayIndex}
              className="bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/50 shadow-sm">

              <div className="flex items-center gap-3 mb-3">

                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: dayColors[dayIndex % dayColors.length] }}
                >
                  {dayIndex + 1}
                </div>

                <h4 className="font-bold text-slate-800">
                  Day {dayIndex + 1}
                </h4>

              </div>

              <ul className="space-y-2">

                {day.activities.map((activity, i) => (

                  <li key={activity.id}
                    className="flex gap-3 text-sm text-slate-600">

                    <span className="font-bold text-primary/40">
                      {i + 1}.
                    </span>

                    <span className="font-medium">
                      {activity.title}
                    </span>

                  </li>

                ))}

              </ul>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

};

export default MapSection;