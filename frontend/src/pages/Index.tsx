import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plane, Sparkles, LogOut, FileDown, Beaker } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import html2pdf from "html2pdf.js";
import { getPlaceImage } from "@/utils/getPlaceImage";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import heroImage from "@/assets/hero-travel.jpg";
import ImageUpload from "@/components/ImageUpload";
import LocationDisplay, { type LocationData } from "@/components/LocationDisplay";
import TripPreferencesForm from "@/components/TripPreferencesForm";
import TravelItinerary, {
  type DayPlan,
  type Activity,
  getActivityImage,
  typeConfig,
  PLACEHOLDER_IMAGES,
  DEFAULT_IMAGE,
  DAY_COLORS,
} from "@/components/TravelItinerary";
import MapSection from "@/components/MapSection";
import AISuggestedPlaces, { type SuggestedPlace, SuggestionDragOverlay } from "@/components/AISuggestedPlaces";
import AIAccommodations, { HotelDragOverlay } from "@/components/AIAccommodations";
import FlightInfoDashboard from "@/components/FlightInfoDashboard";
import ChatBot from "@/components/ChatBot";
import AnalyzingOverlay from "@/components/AnalyzingOverlay";
import StepIndicator from "@/components/StepIndicator";
import WeatherWidget from "@/components/WeatherWidget";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { getCoordinates, distanceMetres } from "@/api/geocode";
import { getNearbyAttractions, fetchPlaceDetails, fetchPlaceDetailsByPlaceId } from "@/api/places";
import { gatherCandidatePOIs, kMeansCluster, sequenceDayClusters, solveGreedyTSP, scorePOIs, selectDiversePOIs, calculateCoherenceScore, optimizeDayActivities, type DayCluster, type ItineraryCoherence } from "@/api/spatialPlanner";
import { generateTravelPlan, generateMoreSuggestions, generateMoreAccommodations, analyzeImage, type VisionResult, type TypicalWeather, type TripPreferences } from "@/services/aiService";
import { getEnvironmentData, type EnvironmentData } from "@/services/environmentService";
import { toast } from "sonner";
import { type Attraction } from "@/api/places";
import { useAI, AI_MODEL_OPTIONS } from "@/context/AIProviderContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// Mock initial data
const MOCK_ITINERARY: DayPlan[] = [
  {
    day: 1,
    date: "Day 1 – Arrival & Beach",
    activities: [
      { id: "1a", time: "09:00", title: "Arrive at Ngurah Rai Airport", description: "Check in to hotel, freshen up", type: "transport", lat: -8.7482, lng: 115.1675 },
      { id: "1b", time: "11:00", title: "Seminyak Beach", description: "Relax at the beach, try water sports", type: "attraction", lat: -8.6913, lng: 115.1569 },
      { id: "1c", time: "13:00", title: "Lunch at Coral Kitchen", description: "Fresh seafood by the ocean", type: "food", lat: -8.6913, lng: 115.1569 },
      { id: "1d", time: "16:00", title: "Tanah Lot Temple Sunset", description: "Visit the iconic sea temple at sunset", type: "attraction", lat: -8.6213, lng: 115.0868 },
    ],
  },
  {
    day: 2,
    date: "Day 2 – Culture & Nature",
    activities: [
      { id: "2a", time: "07:00", title: "Mount Batur Sunrise Trek", description: "Early morning volcano hike", type: "attraction", lat: -8.2419, lng: 115.3753 },
      { id: "2b", time: "11:00", title: "Tegallalang Rice Terrace", description: "Walk through stunning rice paddies", type: "attraction", lat: -8.4312, lng: 115.2793 },
      { id: "2c", time: "13:00", title: "Lunch in Ubud", description: "Traditional Balinese cuisine", type: "food", lat: -8.5189, lng: 115.2588 },
      { id: "2d", time: "15:00", title: "Ubud Monkey Forest", description: "Explore the sacred sanctuary", type: "attraction", lat: -8.5189, lng: 115.2588 },
      { id: "2e", time: "18:00", title: "Spa & Relaxation", description: "Balinese massage and wellness", type: "rest", lat: -8.5189, lng: 115.2588 },
    ],
  },
  {
    day: 3,
    date: "Day 3 – Exploration & Departure",
    activities: [
      { id: "3a", time: "08:00", title: "Uluwatu Temple", description: "Clifftop temple with ocean views", type: "attraction", lat: -8.8291, lng: 115.0849 },
      { id: "3b", time: "11:00", title: "Local Art Market", description: "Shop for souvenirs and handicrafts", type: "attraction", lat: -8.5189, lng: 115.2588 },
      { id: "3c", time: "13:00", title: "Farewell Lunch", description: "Fine dining at a beachfront restaurant", type: "food", lat: -8.7482, lng: 115.1675 },
      { id: "3d", time: "16:00", title: "Departure", description: "Transfer to airport", type: "transport", lat: -8.7482, lng: 115.1675 },
    ],
  },
];

// Custom collision detection: prefer pointerWithin for droppables, closestCenter for sortables
const customCollisionDetection: CollisionDetection = (args) => {
  // First check pointer within for day drop zones
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  // Fallback to rect intersection
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) {
    return rectCollisions;
  }
  return closestCenter(args);
};

// Overlay component for dragged attraction
const AttractionDragOverlay = ({ name, photo_url }: { name: string; photo_url?: string | null }) => {
  return (
    <div className="w-64 md:w-72 rounded-2xl overflow-hidden bg-card border border-primary shadow-2xl scale-105 rotate-1">
      <div className="relative h-40 overflow-hidden">
        <img
          src={photo_url || `https://picsum.photos/seed/${encodeURIComponent(name)}/800/600`}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/travel/800/600";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
      </div>
      <div className="p-4">
        <Badge variant="outline" className="text-[10px] mb-2 bg-primary/15 text-primary border-primary/20">
          Attraction
        </Badge>
        <h4 className="font-semibold text-foreground text-sm">{name}</h4>
        <p className="text-xs text-muted-foreground mt-1">Drop into a day to add</p>
      </div>
    </div>
  );
};

// Overlay for dragged itinerary card
const ItineraryDragOverlay = ({ activity }: { activity: Activity }) => {
  const config = typeConfig[activity.type];
  return (
    <div className="w-64 md:w-72 rounded-2xl overflow-hidden bg-card border shadow-2xl scale-105 rotate-1">
      <div className="relative h-40 overflow-hidden">
        <img
          src={getActivityImage(activity)}
          alt={activity.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://picsum.photos/seed/travel/800/600";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
      </div>
      <div className="p-4">
        <Badge variant="outline" className={`text-[10px] mb-2 ${config.color}`}>
          {config.label}
        </Badge>
        <h4 className="font-semibold text-foreground text-sm">{activity.title}</h4>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{activity.description}</p>
      </div>
    </div>
  );
};

// ─── User Session Menu ────────────────────────────────────────────────────────
const UserMenu = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (!user) return null;

  const avatarUrl: string | undefined = user.user_metadata?.avatar_url;
  const displayName: string =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "User";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2 bg-background/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary-foreground/20">
      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-foreground/30 shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ring-2 ring-primary-foreground/30 shrink-0">
          <span className="text-xs font-bold text-primary-foreground">{initials}</span>
        </div>
      )}

      {/* Display name */}
      <span className="text-sm font-medium text-primary-foreground max-w-[120px] truncate hidden sm:block">
        {displayName}
      </span>

      {/* Logout button */}
      <button
        id="logout-button"
        onClick={handleSignOut}
        title="Sign out"
        className="flex items-center gap-1 px-2 py-1 rounded-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 transition-all duration-200"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-xs font-medium hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
};
// ──────────────────────────────────────────────────────────────────────────────

const Index = () => {
  const [step, setStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overlayType, setOverlayType] = useState<"vision" | "itinerary">("vision");
  const [loadingStep, setLoadingStep] = useState<string>("Analyzing image...");
  const [detectedLocations, setDetectedLocations] = useState<VisionResult[]>([]);
  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [itinerary, setItinerary] = useState<DayPlan[]>(MOCK_ITINERARY);
  const [mapItinerary, setMapItinerary] = useState<DayPlan[]>(MOCK_ITINERARY);
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [accommodations, setAccommodations] = useState<SuggestedPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<{ lat: number, lng: number } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestedPlace | null>(null);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const [useClip, setUseClip] = useState(true);
  const [isRefreshingAccommodations, setIsRefreshingAccommodations] = useState(false);
  const [environmentData, setEnvironmentData] = useState<EnvironmentData | null>(null);
  const [typicalWeather, setTypicalWeather] = useState<TypicalWeather | null>(null);
  const [tripStartDate, setTripStartDate] = useState<Date | null>(null);
  const [destinationIata, setDestinationIata] = useState<string>("");
  const [coherenceResult, setCoherenceResult] = useState<ItineraryCoherence | null>(null);

  useEffect(() => {
    if (itinerary.length > 0) {
      const pace = preferences?.pace || "Moderate";
      const score = calculateCoherenceScore(itinerary, pace, tripStartDate ?? undefined);
      setCoherenceResult(score);
    }
  }, [itinerary, preferences?.pace, tripStartDate]);

  const { model, setModel, provider } = useAI();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleImagesUploaded = useCallback(async (files: File[]) => {
    setOverlayType("vision");
    setIsAnalyzing(true);
    setStep(1);

    try {
      // Step 1: Vision AI for each image
      setLoadingStep(useClip ? "Loading Vision Model + CLIP..." : "Loading Vision Model...");
      const results = await Promise.all(
        files.map(file => analyzeImage(file, model, useClip, setLoadingStep))
      );

      setLoadingStep("Processing results...");
      // Deduplicate locations by name
      const uniqueResults = results.filter((loc, index, self) =>
        index === self.findIndex((t) => t.place === loc.place)
      );

      setDetectedLocations(uniqueResults);
      setIsAnalyzing(false);
      setStep(2);
    } catch (error) {
      console.error("Workflow error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong during analysis");
      setIsAnalyzing(false);
      setStep(0);
    }
  }, [model, provider, useClip]);

  const handlePreferencesSubmit = useCallback(async (prefs: TripPreferences) => {
    if (!detectedLocations.length) return;
    setPreferences(prefs);
    setOverlayType("itinerary");
    setLoadingStep("Analyzing Preferences...");
    setIsAnalyzing(true);
    setStep(3);

    try {
      // Step 1: Destination Geocoding
      const mainLocation = detectedLocations[0];
      const mainLocationStr = `${mainLocation.place}, ${mainLocation.country}`;
      const coords = await getCoordinates(mainLocationStr);
      setSelectedPlace(coords);

      // Step 1b: Spatial Candidate Gathering, K-Means Clustering, Macro-TSP Sequencing & Greedy TSP
      setLoadingStep("Gathering Places & Spatial Clustering...");
      const locationNames = detectedLocations.map(l => l.place);
      let dayClusters: DayCluster[] = [];

      try {
        const candidatePois = await gatherCandidatePOIs(mainLocation.place, coords, locationNames, prefs.activities);
        if (candidatePois.length > 0) {
          const scoredPois = scorePOIs(candidatePois, coords, prefs.activities);
          const diversePois = selectDiversePOIs(scoredPois, Math.max(20, prefs.days * 5));
          const rawClusters = kMeansCluster(diversePois, prefs.days);

          // Macro-Cluster Sequencing: Sequence clusters 1..K in a contiguous progression from start location
          const startLocation = prefs.hasHotel === "yes" && prefs.hotelLat && prefs.hotelLng
            ? { lat: prefs.hotelLat, lng: prefs.hotelLng }
            : coords;
          const sequencedClusters = sequenceDayClusters(rawClusters, startLocation);

          // Micro-TSP Routing per day
          dayClusters = sequencedClusters.map((cluster, cIdx) => {
            const dayStart = cIdx === 0
              ? startLocation
              : (sequencedClusters[cIdx - 1]?.pois.slice(-1)[0] || cluster.centroid || startLocation);
            return {
              ...cluster,
              pois: solveGreedyTSP(cluster.pois, dayStart)
            };
          });
          console.log("[SpatialEngine] Pre-clustered, sequenced & routed day clusters:", dayClusters);
        }
      } catch (spatialErr) {
        console.warn("[SpatialEngine] Spatial clustering fallback to standard generation:", spatialErr);
      }

      // Step 2: Generation
      setLoadingStep("Generating Travel Itinerary with AI...");
      const { itinerary: generatedItinerary, suggestions: generatedSuggestions, accommodations: generatedAccommodations, typicalWeather: aiTypicalWeather } =
        await generateTravelPlan(locationNames, prefs, model, dayClusters);

      // Step 2b: Get the nearest IATA airport code for flight search / offers
      try {
        const iataPrompt = `What is the IATA 3-letter airport code for the main international airport closest to "${mainLocation.place}, ${mainLocation.country}"? Reply with ONLY the 3-letter code in uppercase, nothing else. Example: NRT`;
        const iataResp = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL_ID_MAP[model], messages: [{ role: "user", content: iataPrompt }], expect_json: false }),
        });
        if (iataResp.ok) {
          const iataJson = await iataResp.json();
          const code = (iataJson.text ?? "").trim().replace(/[^A-Z]/g, "").slice(0, 3);
          if (code.length === 3) setDestinationIata(code);
        }
      } catch {
        // non-critical – flight search will still work if user typed IATA manually
      }

      // Store trip start date and typical weather for use in UI
      setTripStartDate(prefs.startDate);
      if (aiTypicalWeather) setTypicalWeather(aiTypicalWeather);

      // Step 3: Landmark Geocoding Enrichment
      // ⚠ We process activities SEQUENTIALLY (not parallel) to avoid hitting
      //   Google Places API rate limits — the root cause of pin clustering.
      //   Each activity waits 100 ms before the next request starts.
      setLoadingStep("Plotting Itinerary Map...");
      toast.info("Geocoding landmarks for precise mapping...", { duration: 3000 });

      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

      /**
       * Validate that coords are not suspiciously close to the city centre.
       * If they are within 200 m, geocoding likely fell back to a generic city result.
       * We retry once with a shorter / more specific query.
       */
      async function geocodeWithValidation(title: string): Promise<{ lat: number; lng: number }> {
        const result = await getCoordinates(title, coords, mainLocation.place);

        // If the result is within 200 m of the city centre, it likely fell back to a generic
        // city-level result. Retry once with a shorter / stripped title.
        if (distanceMetres(result, coords) < 200) {
          console.warn(`[geocode] "${title}" resolved within 200m of city centre — retrying…`);
          const cleaned = title
            .replace(/^(Visit|Explore|See|Tour|Dinner at|Lunch at|Breakfast at)\s+/i, "")
            .trim();
          try {
            const retry = await getCoordinates(
              `${cleaned}, ${mainLocation.country ?? mainLocation.place}`,
              coords,
              mainLocation.place
            );
            if (distanceMetres(retry, coords) > 200) return retry;
          } catch (_) { /* best effort */ }
        }

        return result;
      }

      const enrichedItinerary: typeof generatedItinerary = [];

      for (let dayIndex = 0; dayIndex < generatedItinerary.length; dayIndex++) {
        const day = generatedItinerary[dayIndex];
        const enrichedActivities: typeof day.activities = [];

        // Calculate actual date for this day to check opening hours
        const dayDate = new Date(prefs.startDate);
        dayDate.setDate(dayDate.getDate() + dayIndex);
        const currentDayIndexGoogle = (dayDate.getDay() + 6) % 7; // Map JS Sunday=0 to Google Monday=0

        for (const activity of day.activities) {
          // Filter out closed locations
          let isClosed = false;
          if (activity.openingHours && activity.openingHours.length > 0) {
            const todayHoursText = (activity.openingHours[currentDayIndexGoogle] || "").toLowerCase();
            if (todayHoursText.includes("closed") || todayHoursText.includes("ปิด")) {
              isClosed = true;
            }
          }

          if (isClosed) {
            console.warn(`[filter] Removed "${activity.title}" as it is closed on ${dayDate.toDateString()}`);
            continue; // Skip adding this activity
          }

          setLoadingStep(`Plotting Itinerary Map: ${activity.title}...`);
          await delay(100); // ← 100 ms gap prevents Google Places API rate-limit failures
          try {
            const activityCoords = await geocodeWithValidation(activity.title);
            enrichedActivities.push({ ...activity, lat: activityCoords.lat, lng: activityCoords.lng });
          } catch (e) {
            console.warn(`[geocode] All strategies failed for: "${activity.title}"`, e);
            // Fallback: city centre (marked with _geocodeFailed so MapSection can handle)
            enrichedActivities.push({ ...activity, lat: coords.lat, lng: coords.lng });
          }
        }

        enrichedItinerary.push({ ...day, activities: enrichedActivities });
      }

      // ── Hotel Check-in / Check-out Auto-Injection ──────────────────────────────
      if (prefs.hasHotel === "yes" && prefs.hotelName && enrichedItinerary.length > 0) {
        const hotelLat = prefs.hotelLat ?? coords.lat;
        const hotelLng = prefs.hotelLng ?? coords.lng;

        // Fetch hotel details from Google Places API using placeId if available, fallback to name search
        let hotelDetails = null;
        try {
          if (prefs.hotelPlaceId) {
            hotelDetails = await fetchPlaceDetailsByPlaceId(prefs.hotelPlaceId);
          } else {
            hotelDetails = await fetchPlaceDetails(prefs.hotelName);
          }
        } catch (e) {
          console.error("Failed to fetch hotel details:", e);
        }

        const hotelPhoto = hotelDetails?.photo_url ?? prefs.hotelPhotoUrl ?? null;
        const checkInActivity = {
          id: `hotel-checkin-${Date.now()}-1`,
          time: prefs.hotelCheckInTime ?? "15:00",
          title: `Check in: ${prefs.hotelName}`,
          description: `Check in to ${prefs.hotelName}. Settle in and freshen up before starting your trip.`,
          type: "hotel" as const,
          lat: hotelLat,
          lng: hotelLng,
          image_url: hotelPhoto,
          photo_url: hotelPhoto,
          rating: hotelDetails?.rating ?? null,
          userRatingsTotal: hotelDetails?.userRatingsTotal ?? null,
          openNow: hotelDetails?.openNow ?? null,
          openingHours: hotelDetails?.openingHours ?? null,
          priceLevel: hotelDetails?.priceLevel ?? null,
          website: hotelDetails?.website ?? null,
          phoneNumber: hotelDetails?.phoneNumber ?? null,
        };
        const checkOutActivity = {
          id: `hotel-checkout-${Date.now()}-2`,
          time: prefs.hotelCheckOutTime ?? "11:00",
          title: `Check out: ${prefs.hotelName}`,
          description: `Check out from ${prefs.hotelName}. Pack your bags and enjoy the rest of the day.`,
          type: "hotel" as const,
          lat: hotelLat,
          lng: hotelLng,
          image_url: hotelPhoto,
          photo_url: hotelPhoto,
          rating: hotelDetails?.rating ?? null,
          userRatingsTotal: hotelDetails?.userRatingsTotal ?? null,
          openNow: hotelDetails?.openNow ?? null,
          openingHours: hotelDetails?.openingHours ?? null,
          priceLevel: hotelDetails?.priceLevel ?? null,
          website: hotelDetails?.website ?? null,
          phoneNumber: hotelDetails?.phoneNumber ?? null,
        };
        // Prepend to Day 1 (appears first)
        enrichedItinerary[0] = {
          ...enrichedItinerary[0],
          activities: [checkInActivity, ...enrichedItinerary[0].activities],
        };
        // Append to last day
        const lastIdx = enrichedItinerary.length - 1;
        enrichedItinerary[lastIdx] = {
          ...enrichedItinerary[lastIdx],
          activities: [...enrichedItinerary[lastIdx].activities, checkOutActivity],
        };
      }

      // Apply Neuro-Symbolic 2-Opt TSP & Semantic Anti-Backtracking Route Optimization with Start Anchor
      const hotelLoc = prefs.hasHotel === "yes" && prefs.hotelLat && prefs.hotelLng
        ? { lat: prefs.hotelLat, lng: prefs.hotelLng }
        : coords;

      const sortedEnrichedItinerary = enrichedItinerary.map((day, dIdx) => {
        const prevDayLastAct = dIdx > 0 ? enrichedItinerary[dIdx - 1]?.activities.slice(-1)[0] : undefined;
        const dayStart = dIdx === 0
          ? hotelLoc
          : (prevDayLastAct?.lat && prevDayLastAct?.lng ? { lat: prevDayLastAct.lat, lng: prevDayLastAct.lng } : hotelLoc);

        return {
          ...day,
          activities: optimizeDayActivities(day.activities, prefs.pace, dayStart)
        };
      });

      setItinerary(sortedEnrichedItinerary);
      setMapItinerary(sortedEnrichedItinerary);
      setSuggestions(generatedSuggestions);
      setAccommodations(generatedAccommodations);


      // Step 4: Nearby Attractions + Environment Data (parallel)
      setLoadingStep("Fetching Weather Data...");
      const [nearbyAttractions, envData] = await Promise.all([
        getNearbyAttractions(coords.lat, coords.lng),
        getEnvironmentData(coords.lat, coords.lng),
      ]);
      setAttractions(nearbyAttractions);
      setEnvironmentData(envData);

      setIsAnalyzing(false);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate your personalized itinerary");
      setIsAnalyzing(false);
    }
  }, [detectedLocations, model]);

  const handleRefreshSuggestions = useCallback(async () => {
    if (!detectedLocations.length) return;
    const locationName = detectedLocations[0].place;
    const existingPlaces = [
      ...suggestions.map(s => s.name),
      ...itinerary.flatMap(d => d.activities).map(a => a.title)
    ];

    try {
      const newSuggestions = await generateMoreSuggestions(locationName, existingPlaces, model);
      if (newSuggestions.length > 0) {
        setSuggestions(prev => [...prev, ...newSuggestions]);
        toast.success("Added new suggestions!");
      } else {
        toast.info("No new suggestions found.");
      }
    } catch (error) {
      console.error("Failed to fetch new suggestions:", error);
      toast.error("Failed to fetch new suggestions");
    }
  }, [detectedLocations, suggestions, itinerary, model]);

  const handleRefreshAccommodations = useCallback(async () => {
    if (!detectedLocations.length) return;
    const locationName = detectedLocations[0].place;
    const existingPlaces = accommodations.map(a => a.name);

    setIsRefreshingAccommodations(true);
    try {
      const newAccommodations = await generateMoreAccommodations(locationName, existingPlaces, model);
      if (newAccommodations.length > 0) {
        setAccommodations(prev => [...prev, ...newAccommodations]);
        toast.success("Added new accommodations!");
      } else {
        toast.info("No new accommodations found.");
      }
    } catch (error) {
      console.error("Failed to fetch new accommodations:", error);
      toast.error("Failed to fetch new accommodations");
    } finally {
      setIsRefreshingAccommodations(false);
    }
  }, [detectedLocations, accommodations, model]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    const data = event.active.data.current;
    if (data?.type === "suggestion" || data?.type === "hotel-suggestion") {
      setActiveSuggestion(data.place as SuggestedPlace);
    } else {
      setActiveSuggestion(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Helper to resolve target day from overId
    const resolveTargetDay = (overId: string): number => {
      if (overId.startsWith("day-")) return parseInt(overId.replace("day-", ""), 10);
      for (let i = 0; i < itinerary.length; i++) {
        if (itinerary[i].activities.some((a) => a.id === overId)) return i;
      }
      return -1;
    };

    // Case 1: Dragging an attraction from MapSection into a day
    if (activeId.startsWith("attraction-")) {
      const attractionData = active.data.current as { type: string; attraction: Attraction } | undefined;
      if (!attractionData) return;
      const targetDayIndex = resolveTargetDay(overId);
      if (targetDayIndex === -1) return;

      const attraction = attractionData.attraction;
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        time: "12:00",
        title: attraction.name,
        description: `Visit ${attraction.name}`,
        type: "attraction",
        image: attraction.image,
        image_url: attraction.image_url,
        photo_url: attraction.photo_url,
        lat: attraction.lat,
        lng: attraction.lng,
      };

      const updated = itinerary.map((day, i) => {
        if (i === targetDayIndex) {
          const newActivities = [...day.activities, newActivity];
          return {
            ...day,
            activities: [...newActivities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
          };
        }
        return day;
      });
      setItinerary(updated);
      return;
    }

    // Case 1b: Dragging an AI suggestion into a day
    if (activeId.startsWith("suggestion-")) {
      const suggestionData = active.data.current as { type: string; place: SuggestedPlace } | undefined;
      if (!suggestionData) return;
      const targetDayIndex = resolveTargetDay(overId);
      if (targetDayIndex === -1) return;

      const place = suggestionData.place;
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        time: "12:00",
        title: place.name,
        description: place.description,
        type: place.category === "food" ? "food" : "attraction",
        image: place.image,
        image_url: place.image_url,
        photo_url: place.photo_url,
        lat: place.lat,
        lng: place.lng,
        rating: place.rating,
        userRatingsTotal: place.userRatingsTotal,
        openNow: place.openNow,
        openingHours: place.openingHours,
        priceLevel: place.priceLevel,
        website: place.website,
        phoneNumber: place.phoneNumber,
      };

      const updated = itinerary.map((day, i) => {
        if (i === targetDayIndex) {
          const newActivities = [...day.activities, newActivity];
          return {
            ...day,
            activities: [...newActivities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
          };
        }
        return day;
      });
      setItinerary(updated);
      return;
    }

    // Case 1c: Dragging a hotel suggestion into a day
    if (activeId.startsWith("hotel-suggestion-")) {
      const hotelData = active.data.current as { type: string; place: SuggestedPlace } | undefined;
      if (!hotelData) return;
      const targetDayIndex = resolveTargetDay(overId);
      if (targetDayIndex === -1) return;

      const hotel = hotelData.place;
      const checkInActivity: Activity = {
        id: `hotel-checkin-${Date.now()}-1`,
        time: "15:00",
        title: `Check in: ${hotel.name}`,
        description: `Check in to ${hotel.name}. Settle in and freshen up before starting your trip.`,
        type: "hotel",
        image: hotel.image,
        image_url: hotel.image_url,
        photo_url: hotel.photo_url,
        lat: hotel.lat,
        lng: hotel.lng,
        rating: hotel.rating,
        userRatingsTotal: hotel.userRatingsTotal,
        openNow: hotel.openNow,
        openingHours: hotel.openingHours,
        priceLevel: hotel.priceLevel,
        website: hotel.website,
        phoneNumber: hotel.phoneNumber,
      };

      const checkOutActivity: Activity = {
        id: `hotel-checkout-${Date.now()}-2`,
        time: "11:00",
        title: `Check out: ${hotel.name}`,
        description: `Check out from ${hotel.name}. Pack your bags and enjoy the rest of the day.`,
        type: "hotel",
        image: hotel.image,
        image_url: hotel.image_url,
        photo_url: hotel.photo_url,
        lat: hotel.lat,
        lng: hotel.lng,
        rating: hotel.rating,
        userRatingsTotal: hotel.userRatingsTotal,
        openNow: hotel.openNow,
        openingHours: hotel.openingHours,
        priceLevel: hotel.priceLevel,
        website: hotel.website,
        phoneNumber: hotel.phoneNumber,
      };

      const lastDayIndex = itinerary.length - 1;
      const updated = itinerary.map((day, i) => {
        let activities = [...day.activities];
        let changed = false;
        if (i === targetDayIndex) {
          activities.push(checkInActivity);
          changed = true;
        }
        if (i === lastDayIndex) {
          activities.push(checkOutActivity);
          changed = true;
        }
        if (changed) {
          return {
            ...day,
            activities: activities.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
          };
        }
        return day;
      });
      setItinerary(updated);
      setMapItinerary(updated);
      setAccommodations((prev) => prev.filter((a) => a.id !== hotel.id));
      return;
    }

    // Case 2: Reordering within a day or moving across days
    if (activeId === overId) return;

    // Find which day the active card belongs to
    let activeDayIndex = -1;
    for (let i = 0; i < itinerary.length; i++) {
      if (itinerary[i].activities.some((a) => a.id === activeId)) {
        activeDayIndex = i;
        break;
      }
    }
    if (activeDayIndex === -1) return;

    // Find which day the over card belongs to
    const overDayIndex = resolveTargetDay(overId);
    if (overDayIndex === -1) return;

    if (activeDayIndex === overDayIndex) {
      // Reordering within the same day
      const day = itinerary[activeDayIndex];
      const oldIndex = day.activities.findIndex((a) => a.id === activeId);
      const newIndex = day.activities.findIndex((a) => a.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(day.activities, oldIndex, newIndex);
      const originalTimes = day.activities.map((a) => a.time);
      const withUpdatedTimes = reordered.map((a, i) => ({ ...a, time: originalTimes[i] }));

      const updated = itinerary.map((d, i) =>
        i === activeDayIndex ? { ...d, activities: withUpdatedTimes } : d
      );
      setItinerary(updated);
    } else {
      // Moving across days
      const activeDay = itinerary[activeDayIndex];
      const overDay = itinerary[overDayIndex];

      const oldIndex = activeDay.activities.findIndex((a) => a.id === activeId);
      if (oldIndex === -1) return;

      const activityToMove = activeDay.activities[oldIndex];

      // Remove from active day
      const newActiveActivities = [...activeDay.activities];
      newActiveActivities.splice(oldIndex, 1);

      // Determine where to insert in the new day
      let newIndex = overDay.activities.findIndex((a) => a.id === overId);
      if (newIndex === -1) {
        newIndex = overDay.activities.length;
      }

      // Figure out the time for the new slot
      let newTime = activityToMove.time;
      if (overDay.activities.length > 0) {
        if (newIndex === overDay.activities.length) {
          // Append to end: 1 hour after the last activity
          const lastTime = overDay.activities[overDay.activities.length - 1].time || "12:00";
          const [h, m] = lastTime.split(':').map(Number);
          newTime = `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        } else {
          // Inserted at specific index: steal its time
          newTime = overDay.activities[newIndex].time || "12:00";
        }
      } else {
        newTime = "09:00";
      }

      const movedActivity = { ...activityToMove, time: newTime };
      const newOverActivities = [...overDay.activities];
      newOverActivities.splice(newIndex, 0, movedActivity);

      // Re-sort times to maintain chronological order after insertion
      const allTimes = newOverActivities.map((a) => a.time || "00:00").sort((a, b) => a.localeCompare(b));
      const sortedNewOverActivities = newOverActivities.map((a, i) => ({ ...a, time: allTimes[i] }));

      const updated = itinerary.map((d, i) => {
        if (i === activeDayIndex) return { ...d, activities: newActiveActivities };
        if (i === overDayIndex) return { ...d, activities: sortedNewOverActivities };
        return d;
      });
      setItinerary(updated);
    }
  };

  const handleSelectActivity = useCallback((activity: Activity) => {
    if (activity.lat && activity.lng) {
      setSelectedPlace({ lat: activity.lat, lng: activity.lng });
      setHoveredActivityId(activity.id);
    } else {
      // Fallback: Try to find matching attraction for coordinates
      const match = attractions.find(a => a.name === activity.title);
      if (match) {
        setSelectedPlace({ lat: match.lat, lng: match.lng });
        setHoveredActivityId(activity.id);
      }
    }
  }, [attractions]);

  // Resolve drag overlay content
  const handleAddSuggestion = useCallback((place: SuggestedPlace, dayIndex: number, time: string = "12:00") => {
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      time,
      title: place.name,
      description: place.description,
      type: place.category === "food" ? "food" : "attraction",
      image: place.image,
      image_url: place.image_url,
      photo_url: place.photo_url,
      lat: place.lat,
      lng: place.lng,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      openNow: place.openNow,
      openingHours: place.openingHours,
      priceLevel: place.priceLevel,
      website: place.website,
      phoneNumber: place.phoneNumber,
    };
    setItinerary((prev) =>
      prev.map((day, i) => {
        if (i === dayIndex) {
          const newActivities = [...day.activities, newActivity];
          return {
            ...day,
            activities: [...newActivities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
          };
        }
        return day;
      })
    );
  }, []);

  const handleAddHotel = useCallback((
    hotel: SuggestedPlace,
    checkInDay: number,
    checkInTime: string = "15:00",
    checkOutDay: number,
    checkOutTime: string = "11:00"
  ) => {
    const checkInActivity: Activity = {
      id: `hotel-checkin-${Date.now()}-1`,
      time: checkInTime,
      title: `Check in: ${hotel.name}`,
      description: `Check in to ${hotel.name}. Settle in and freshen up before starting your trip.`,
      type: "hotel",
      image: hotel.image,
      image_url: hotel.image_url,
      photo_url: hotel.photo_url,
      lat: hotel.lat,
      lng: hotel.lng,
      rating: hotel.rating,
      userRatingsTotal: hotel.userRatingsTotal,
      openNow: hotel.openNow,
      openingHours: hotel.openingHours,
      priceLevel: hotel.priceLevel,
      website: hotel.website,
      phoneNumber: hotel.phoneNumber,
    };

    const checkOutActivity: Activity = {
      id: `hotel-checkout-${Date.now()}-2`,
      time: checkOutTime,
      title: `Check out: ${hotel.name}`,
      description: `Check out from ${hotel.name}. Pack your bags and enjoy the rest of the day.`,
      type: "hotel",
      image: hotel.image,
      image_url: hotel.image_url,
      photo_url: hotel.photo_url,
      lat: hotel.lat,
      lng: hotel.lng,
      rating: hotel.rating,
      userRatingsTotal: hotel.userRatingsTotal,
      openNow: hotel.openNow,
      openingHours: hotel.openingHours,
      priceLevel: hotel.priceLevel,
      website: hotel.website,
      phoneNumber: hotel.phoneNumber,
    };

    setItinerary((prev) => {
      const updated = prev.map((day, i) => {
        let activities = [...day.activities];
        let changed = false;

        if (i === checkInDay) {
          activities.push(checkInActivity);
          changed = true;
        }
        if (i === checkOutDay) {
          activities.push(checkOutActivity);
          changed = true;
        }

        if (changed) {
          return {
            ...day,
            activities: activities.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
          };
        }
        return day;
      });
      setMapItinerary(updated);
      return updated;
    });

    setAccommodations((prev) => prev.filter((a) => a.id !== hotel.id));
  }, []);

  const getOverlayContent = () => {
    if (!activeDragId) return null;

    if (activeDragId.startsWith("attraction-")) {
      const name = activeDragId.replace("attraction-", "");
      const attraction = attractions.find(a => a.name === name);
      return <AttractionDragOverlay name={name} photo_url={attraction?.photo_url} />;
    }

    if (activeDragId.startsWith("suggestion-") && activeSuggestion) {
      return <SuggestionDragOverlay place={activeSuggestion} />;
    }

    if (activeDragId.startsWith("hotel-suggestion-") && activeSuggestion) {
      return <HotelDragOverlay hotel={activeSuggestion} />;
    }

    const activity = itinerary.flatMap((d) => d.activities).find((a) => a.id === activeDragId);
    if (activity) {
      return <ItineraryDragOverlay activity={activity} />;
    }
    return null;
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ─── PDF Export ────────────────────────────────────────────────────────────

  /** Convert every <img> inside a container to blob ObjectURLs so html2canvas
   *  can draw cross-origin images. Returns a cleanup fn that restores originals. */
  const blobifyImages = async (root: HTMLElement): Promise<() => void> => {
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    const restores: Array<() => void> = [];

    await Promise.all(
      imgs.map(async (img) => {
        const original = img.src;
        if (!original || original.startsWith("data:") || original.startsWith("blob:")) return;
        try {
          const resp = await fetch(original, { mode: "cors", cache: "force-cache" });
          if (!resp.ok) return;
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          img.src = blobUrl;
          restores.push(() => {
            URL.revokeObjectURL(blobUrl);
            img.src = original;
          });
        } catch {
          // Non-critical – image may stay broken in PDF but we won't crash
        }
      })
    );

    return () => restores.forEach((r) => r());
  };

  /** Build Google Maps Static API URL showing all day routes as coloured pins */
  const buildStaticMapUrl = (plans: DayPlan[], apiKey: string): string => {
    const colors = ["0x10b981", "0x3b82f6", "0xf59e0b", "0xef4444", "0x8b5cf6", "0x06b6d4", "0xf43f5e"];
    const base = "https://maps.googleapis.com/maps/api/staticmap";
    const params = new URLSearchParams({
      size: "800x400",
      scale: "2",
      maptype: "roadmap",
      key: apiKey,
    });

    plans.forEach((day, di) => {
      const color = colors[di % colors.length];
      day.activities.forEach((act, ai) => {
        if (!act.lat || !act.lng) return;
        params.append("markers", `color:${color}|label:${ai + 1}|${act.lat},${act.lng}`);
      });
      // Draw path for this day
      const validCoords = day.activities
        .filter((a) => a.lat && a.lng)
        .map((a) => `${a.lat},${a.lng}`)
        .join("|");
      if (validCoords) {
        params.append("path", `color:${color}|weight:3|${validCoords}`);
      }
    });

    return `${base}?${params.toString()}`;
  };

  /** Populate the hidden #pdf-cover-section with fresh content before export */
  const buildCoverSection = (plans: DayPlan[], locationName: string, apiKey: string, startDate: Date | null) => {
    const cover = document.getElementById("pdf-cover-section");
    if (!cover) return;

    const dayColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f43f5e"];

    // Date range text
    let dateRange = "";
    if (startDate) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + plans.length - 1);
      const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      dateRange = `${fmt(startDate)} – ${fmt(end)}`;
    }

    // Static map img
    const staticMapUrl = buildStaticMapUrl(plans, apiKey);

    // Legend HTML
    const legendHtml = plans.map((day, i) =>
      `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
        <span style="width:14px;height:14px;border-radius:50%;background:${dayColors[i % dayColors.length]};display:inline-block;border:2px solid white;box-shadow:0 0 0 1px #ccc"></span>
        <span style="font-size:13px;font-weight:600;color:#374151">Day ${day.day}${dateRange && startDate ? ` – ${new Date(startDate.getTime() + i * 86400000).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : ""}</span>
      </div>`
    ).join("");

    // Overview HTML (day cards)
    const overviewHtml = plans.map((day, di) => {
      const color = dayColors[di % dayColors.length];
      const actHtml = day.activities.map((act, ai) =>
        `<li style="display:flex;gap:8px;font-size:12px;color:#374151;padding:3px 0">
          <span style="color:${color};font-weight:700;min-width:18px">${ai + 1}.</span>
          <span><strong>${act.time || ""}</strong> ${act.title}</span>
        </li>`
      ).join("");
      const dayDate = startDate ? new Date(startDate.getTime() + di * 86400000) : null;
      const dayLabel = dayDate
        ? dayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
        : day.date;
      return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;break-inside:avoid">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:32px;height:32px;border-radius:8px;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">${day.day}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:#111827">Day ${day.day}</div>
            <div style="font-size:11px;color:#6b7280">${dayLabel}</div>
          </div>
        </div>
        <ul style="list-style:none;margin:0;padding:0">${actHtml}</ul>
      </div>`;
    }).join("");

    cover.innerHTML = `
      <div style="font-family:'Inter',sans-serif;padding:32px 40px;background:#f8fafc;border-bottom:3px solid #e2e8f0;margin-bottom:24px;page-break-after:always">
        <!-- Title block -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
          <div>
            <h1 style="font-size:32px;font-weight:800;color:#0f172a;margin:0 0 4px 0">🌍 ${locationName}</h1>
            <p style="font-size:15px;color:#64748b;margin:0">${dateRange ? dateRange + " · " : ""}${plans.length} day${plans.length !== 1 ? "s" : ""} · ${plans.reduce((s, d) => s + d.activities.length, 0)} activities</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:800;color:#3b82f6">Pixinerary</div>
            <div style="font-size:11px;color:#94a3b8">AI Travel Planning</div>
          </div>
        </div>

        <!-- Static Map -->
        <div style="border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:24px">
          <img src="${staticMapUrl}" alt="Trip Map" style="width:100%;display:block;height:320px;object-fit:cover" crossOrigin="anonymous" />
        </div>

        <!-- Day Legend -->
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e5e7eb;margin-bottom:24px">
          <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 12px 0">Day Legend</h3>
          <div style="display:flex;flex-wrap:wrap;gap:12px 24px">${legendHtml}</div>
        </div>

        <!-- Itinerary Overview -->
        <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 16px 0">Itinerary Overview</h3>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">${overviewHtml}</div>
      </div>
    `;
  };

  const exportToPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    toast.info("Generating PDF, please wait...");

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
    let restoreImages: (() => void) | null = null;

    try {
      const contentEl = document.getElementById("pdf-export-wrapper");
      if (!contentEl) {
        toast.error("Itinerary content not found.");
        setIsExportingPDF(false);
        return;
      }

      // Build the cover section content
      buildCoverSection(
        itinerary,
        detectedLocations[0]?.place || "Trip",
        apiKey,
        tripStartDate
      );

      // Enable export mode (reveals cover section + applies pdf-* classes)
      contentEl.classList.add("is-exporting");

      // Blobify all cross-origin images so html2canvas can draw them
      restoreImages = await blobifyImages(contentEl);

      // Let layout settle
      await new Promise((resolve) => setTimeout(resolve, 250));

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${detectedLocations[0]?.place || "travel"}_itinerary.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          imageTimeout: 15000,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["avoid-all", "css"] },
      };

      await html2pdf().from(contentEl).set(opt).save();

      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      // Restore images first, then remove export class
      if (restoreImages) restoreImages();
      const contentEl = document.getElementById("pdf-export-wrapper");
      if (contentEl) contentEl.classList.remove("is-exporting");
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Travel destination" className="w-full h-full object-cover" width={1920} height={800} />
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 via-foreground/40 to-background" />
        </div>
        <div className="relative container mx-auto px-4 pt-8 pb-20">
          <nav className="flex flex-col sm:flex-row items-center justify-between mb-16 gap-6">
            {/* Logo and Experiment Link */}
            <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg travel-gradient flex items-center justify-center shadow-lg">
                  <Plane className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-primary-foreground tracking-tight">Pixinerary</span>
              </div>
              <Link
                to="/experiment"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-primary-foreground/90 hover:bg-white/20 hover:text-white transition-all duration-200 border border-white/10 shadow-sm"
              >
                <Beaker className="w-3.5 h-3.5 text-blue-400" />
                <span>Experiment Console</span>
              </Link>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              {/* AI Model Selector */}
              <div className="flex items-center gap-2 bg-background/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary-foreground/20">
                <Sparkles className="w-4 h-4 text-primary-foreground/80 shrink-0" />
                <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
                  <SelectTrigger
                    className="border-0 bg-transparent shadow-none text-sm font-medium text-primary-foreground h-auto p-0 focus:ring-0 focus:ring-offset-0 [&>svg]:text-primary-foreground/70 min-w-[170px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/60 shadow-xl">
                    {AI_MODEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <img src={opt.icon} className="w-5 h-5 rounded-full object-cover shrink-0 bg-muted" alt="" />
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-muted-foreground text-xs">· {opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User session: avatar + display name + logout */}
              <UserMenu />
            </div>
          </nav>
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-extrabold text-primary-foreground mb-4 leading-tight">
              Plan Your Perfect Trip with <span className="text-travel-sand">AI</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Upload a photo of any destination and let AI create a personalized travel itinerary
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 -mt-8 pb-20">
        <div className="bg-card rounded-3xl shadow-xl p-8 md:p-12">
          <StepIndicator currentStep={step} />

          <section className="mb-12">
            {/* CLIP toggle — shown only before analysis starts */}
            {!isAnalyzing && (
              <div className="flex items-center justify-end gap-2 mb-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-default">
                      <span className="text-sm font-medium text-foreground">Visual confidence scoring</span>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Uses the CLIP vision model to compare your image against Google Places photos and rank candidates by visual similarity. More accurate, but slower.
                  </TooltipContent>
                </Tooltip>
                <Switch
                  id="clip-toggle"
                  checked={useClip}
                  onCheckedChange={setUseClip}
                />
                <span className="text-xs text-muted-foreground">{useClip ? "On (slower)" : "Off (faster)"}</span>
              </div>
            )}

            {/* Animated analysis overlay — shown while pipeline is running */}
            <AnalyzingOverlay
              isAnalyzing={isAnalyzing}
              loadingStep={loadingStep}
              useClip={useClip}
              type={overlayType}
            />

            {/* Upload dropzone — hidden (not unmounted) during analysis so file state is kept */}
            <div className={isAnalyzing ? "hidden" : ""}>
              <ImageUpload onImagesUploaded={handleImagesUploaded} isAnalyzing={isAnalyzing} loadingLabel={loadingStep} />
            </div>
          </section>

          {detectedLocations.length > 0 && step === 2 && (
            <section className="mb-12">
              <LocationDisplay locations={detectedLocations} useClip={useClip} />
              <div className="mt-8">
                <TripPreferencesForm
                  onSubmit={handlePreferencesSubmit}
                  destinationName={detectedLocations[0]?.place}
                />
              </div>
            </section>
          )}

          {step >= 3 && detectedLocations.length > 0 && !isAnalyzing && (
            <DndContext
              sensors={sensors}
              collisionDetection={customCollisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <section className="mb-12">
                <MapSection
                  location={{
                    name: detectedLocations[0].place,
                    country: detectedLocations[0].country,
                    type: detectedLocations[0].type,
                    coordinates: selectedPlace || { lat: 0, lng: 0 },
                    weather: environmentData?.current
                      ? `${environmentData.current.temperatureC}°C`
                      : "Sunny",
                    temperature: environmentData?.current
                      ? `${environmentData.current.temperatureC}°C`
                      : "28°C",
                    airQuality: environmentData?.airQuality?.category ?? "Good",
                    timezone: "Local",
                    sunlight: "12h"
                  }}
                  itinerary={mapItinerary}
                  dayColors={DAY_COLORS}
                />
              </section>
              <section className="mb-12">
                <AISuggestedPlaces
                  onAddToItinerary={handleAddSuggestion}
                  locationName={detectedLocations[0].place}
                  suggestions={suggestions}
                  onRefreshSuggestions={handleRefreshSuggestions}
                  daysCount={itinerary.length}
                />
              </section>
              {accommodations.length > 0 && (
                <section className="mb-12">
                  <AIAccommodations
                    accommodations={accommodations}
                    onAddToItinerary={handleAddHotel}
                    locationName={detectedLocations[0].place}
                    daysCount={itinerary.length}
                    onRefreshAccommodations={handleRefreshAccommodations}
                    isRefreshing={isRefreshingAccommodations}
                    tripStartDate={tripStartDate ?? undefined}
                  />
                </section>
              )}
              {/* Weather & Air Quality Widget */}
              {selectedPlace && (
                <WeatherWidget
                  lat={selectedPlace.lat}
                  lng={selectedPlace.lng}
                  locationName={detectedLocations[0].place}
                  tripStartDate={tripStartDate ?? undefined}
                  typicalWeather={typicalWeather ?? undefined}
                />
              )}
              <section className="mb-12">
                {/* ── Flight Info Dashboard ── */}
                {preferences && (
                  <FlightInfoDashboard
                    preferences={preferences}
                    destinationIata={destinationIata}
                    destinationName={`${detectedLocations[0].place}, ${detectedLocations[0].country}`}
                    onUpdatePreferences={(updated) => setPreferences(prev => prev ? { ...prev, ...updated } : null)}
                  />
                )}
              </section>
              <section className="mb-12" id="pdf-export-wrapper">
                {/* PDF cover section — hidden on web, shown during export */}
                <div id="pdf-cover-section" aria-hidden="true" />
                <TravelItinerary
                  itinerary={itinerary}
                  onUpdate={setItinerary}
                  activeDragId={activeDragId}
                  onSelectActivity={handleSelectActivity}
                  onHoverActivity={setHoveredActivityId}
                  onReloadMap={() => setMapItinerary(itinerary)}
                  suggestions={suggestions}
                  tripStartDate={tripStartDate ?? undefined}
                  hourlyWeather={environmentData?.hourly ?? []}
                  coherenceResult={coherenceResult}
                />
              </section>

              <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                {getOverlayContent()}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>

      {step >= 3 && detectedLocations.length > 0 && !isAnalyzing && (
        <>
          <ChatBot locationName={detectedLocations[0].place} itinerary={itinerary} onUpdateItinerary={setItinerary} preferences={preferences} />

          {/* Floating Export PDF Button */}
          <button
            onClick={exportToPDF}
            disabled={isExportingPDF}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl flex items-center justify-center hover:scale-110 transition-all duration-200 z-50 disabled:opacity-50 border border-border/20"
            title="Export Itinerary as PDF"
          >
            {isExportingPDF ? (
              <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-6 h-6" />
            )}
          </button>
        </>
      )}

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>Pixinerary – Image-Based AI Travel Planning System • Research Project Prototype</p>
      </footer>
    </div>
  );
};

export default Index;
