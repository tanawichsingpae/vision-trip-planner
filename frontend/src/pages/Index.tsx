import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plane, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
import ChatBot from "@/components/ChatBot";
import AnalyzingOverlay from "@/components/AnalyzingOverlay";
import StepIndicator from "@/components/StepIndicator";
import WeatherWidget from "@/components/WeatherWidget";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { getCoordinates, distanceMetres } from "@/api/geocode";
import { getNearbyAttractions } from "@/api/places";
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
          src={activity.image_url || `https://picsum.photos/seed/${encodeURIComponent(activity.title)}/800/600`}
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
  }, [provider, useClip]);

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

      // Step 2: Generation
      setLoadingStep("Generating Travel Itinerary...");
      const locationNames = detectedLocations.map(l => l.place);
      const { itinerary: generatedItinerary, suggestions: generatedSuggestions, accommodations: generatedAccommodations, typicalWeather: aiTypicalWeather } =
        await generateTravelPlan(locationNames, prefs, model);

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

      setItinerary(enrichedItinerary);
      setMapItinerary(enrichedItinerary);
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
  }, [detectedLocations, provider]);

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
  }, [detectedLocations, suggestions, itinerary, provider]);

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
    if (data?.type === "suggestion") {
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

      const updated = itinerary.map((day, i) =>
        i === targetDayIndex ? { ...day, activities: [...day.activities, newActivity] } : day
      );
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
      };

      const updated = itinerary.map((day, i) =>
        i === targetDayIndex ? { ...day, activities: [...day.activities, newActivity] } : day
      );
      setItinerary(updated);
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
    };
    setItinerary((prev) =>
      prev.map((day, i) => (i === dayIndex ? { ...day, activities: [...day.activities, newActivity] } : day))
    );
  }, []);

  const handleAddHotel = useCallback((hotel: SuggestedPlace, dayIndex: number, time: string = "14:00") => {
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      time,
      title: hotel.name,
      description: hotel.description,
      type: "hotel",
      image: hotel.image,
      image_url: hotel.image_url,
      photo_url: hotel.photo_url,
      lat: hotel.lat,
      lng: hotel.lng,
    };
    setItinerary((prev) =>
      prev.map((day, i) => (i === dayIndex ? { ...day, activities: [...day.activities, newActivity] } : day))
    );
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
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg travel-gradient flex items-center justify-center shadow-lg">
                <Plane className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-primary-foreground tracking-tight">Pixinerary</span>
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
                        <span className="mr-1.5">{opt.icon}</span>
                        <span className="font-medium">{opt.label}</span>
                        <span className="ml-1.5 text-muted-foreground text-xs">· {opt.description}</span>
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
                <TripPreferencesForm onSubmit={handlePreferencesSubmit} />
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
                />
              </section>

              <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                {getOverlayContent()}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>

      {step >= 3 && detectedLocations.length > 0 && !isAnalyzing && <ChatBot locationName={detectedLocations[0].place} itinerary={itinerary} onUpdateItinerary={setItinerary} preferences={preferences} />}

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>Pixinerary – Image-Based AI Travel Planning System • Research Project Prototype</p>
      </footer>
    </div>
  );
};

export default Index;
