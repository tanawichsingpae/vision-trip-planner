import { useState, useCallback } from "react";
import { Plane, Sparkles } from "lucide-react";
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
import TripPreferencesForm, { type TripPreferences } from "@/components/TripPreferencesForm";
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
import ChatBot from "@/components/ChatBot";
import StepIndicator from "@/components/StepIndicator";
import { Badge } from "@/components/ui/badge";
import { getCoordinates } from "@/api/geocode";
import { getNearbyAttractions } from "@/api/places";
import { generateTravelPlan, analyzeImage, type VisionResult } from "@/services/aiService";
import { toast } from "sonner";
import { type Attraction } from "@/api/places";
import { useAI } from "@/context/AIProviderContext";
import { extractPlaceName } from "@/utils/placeUtils";

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
          src={`https://source.unsplash.com/800x600/?${encodeURIComponent(name)}`} 
          alt={name} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            e.currentTarget.src = "https://source.unsplash.com/800x600/?travel,landmark";
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
          src={activity.image_url || `https://source.unsplash.com/800x600/?${encodeURIComponent(activity.title)}`} 
          alt={activity.title} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            e.currentTarget.src = "https://source.unsplash.com/800x600/?travel,landmark";
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

const Index = () => {
  const [step, setStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("Analyzing image...");
  const [detectedLocations, setDetectedLocations] = useState<VisionResult[]>([]);
  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [itinerary, setItinerary] = useState<DayPlan[]>(MOCK_ITINERARY);
  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<{lat: number, lng: number} | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestedPlace | null>(null);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);

  const { provider, setProvider } = useAI();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleImagesUploaded = useCallback(async (files: File[]) => {
    setIsAnalyzing(true);
    setStep(1);
    
    try {
      // Step 1: Vision AI for each image
      setLoadingStep("Loading Vision Model...");
      const results = await Promise.all(files.map(file => analyzeImage(file, provider)));
      
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
  }, [provider]);

  const handlePreferencesSubmit = useCallback(async (prefs: TripPreferences) => {
    setPreferences(prefs);
    setIsAnalyzing(true);
    setStep(3);

    try {
      // Step 1: Destination Geocoding
      const mainLocation = detectedLocations[0];
      const mainLocationStr = `${mainLocation.place}, ${mainLocation.country}`;
      const coords = await getCoordinates(mainLocationStr);
      setSelectedPlace(coords);

      // Step 2: Generation
      const locationNames = detectedLocations.map(l => l.place);
      const { itinerary: generatedItinerary, suggestions: generatedSuggestions } = 
        await generateTravelPlan(locationNames, prefs, provider);

      // Step 3: Landmark Geocoding Enrichment
      toast.info("Geocoding landmarks for precise mapping...", { duration: 3000 });
      
      const enrichedItinerary = await Promise.all(generatedItinerary.map(async (day) => {
        const enrichedActivities = await Promise.all(day.activities.map(async (activity) => {
          try {
            // Use LLM-provided coordinates if they are accurate landmarks (non-zero)
            if (activity.lat && activity.lng && activity.lat !== 0 && activity.lng !== 0) {
              return activity;
            }

            // Geocode using "Activity Name, Destination Name" for accuracy
            const cleanedTitle = extractPlaceName(activity.title);
            const activityCoords = await getCoordinates(`${cleanedTitle}, ${mainLocation.place}`);
            return { ...activity, lat: activityCoords.lat, lng: activityCoords.lng };
          } catch (e) {
            console.warn(`Failed to geocode: ${activity.title}`, e);
            // Fallback to day center or main location with randomized slight offset
            return { 
              ...activity, 
              lat: coords.lat + (Math.random() - 0.5) * 0.01, 
              lng: coords.lng + (Math.random() - 0.5) * 0.01 
            };
          }
        }));
        return { ...day, activities: enrichedActivities };
      }));
        
      setItinerary(enrichedItinerary);
      setSuggestions(generatedSuggestions);
      
      // Step 4: Nearby Attractions (from principal coords)
      const nearbyAttractions = await getNearbyAttractions(coords.lat, coords.lng);
      setAttractions(nearbyAttractions);
      
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate your personalized itinerary");
      setIsAnalyzing(false);
    }
  }, [detectedLocations, provider]);

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

    // Case 2: Reordering within a day
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

    // Find which day the over card belongs to (for within-day reorder)
    let overDayIndex = -1;
    for (let i = 0; i < itinerary.length; i++) {
      if (itinerary[i].activities.some((a) => a.id === overId)) {
        overDayIndex = i;
        break;
      }
    }

    // Only reorder within the same day
    if (overDayIndex !== activeDayIndex) return;

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
  const handleAddSuggestion = useCallback((place: SuggestedPlace, dayIndex: number) => {
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
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg travel-gradient flex items-center justify-center shadow-lg">
                <Plane className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-primary-foreground tracking-tight">TravelVision AI</span>
            </div>
            
            <div className="flex items-center gap-4 bg-background/10 backdrop-blur-md p-1.5 rounded-full border border-primary-foreground/20">
              <div className="flex items-center px-4">
                <Sparkles className="w-4 h-4 text-primary-foreground/80 mr-2" />
                <span className="text-sm font-medium text-primary-foreground">
                  Powered by: {provider === "gemini" ? "Google Gemini" : "OpenAI ChatGPT"}
                </span>
              </div>
              <div className="flex bg-background/20 rounded-full p-0.5">
                <button
                  onClick={() => setProvider("gemini")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                    provider === "gemini" 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                  }`}
                >
                  Gemini
                </button>
                <button
                  onClick={() => setProvider("openai")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                    provider === "openai" 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                  }`}
                >
                  ChatGPT
                </button>
              </div>
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
            <ImageUpload onImagesUploaded={handleImagesUploaded} isAnalyzing={isAnalyzing} loadingLabel={loadingStep} />
          </section>

          {detectedLocations.length > 0 && step === 2 && (
            <section className="mb-12">
              <LocationDisplay locations={detectedLocations} />
              <div className="mt-8">
                <TripPreferencesForm onSubmit={handlePreferencesSubmit} />
              </div>
            </section>
          )}

          {step >= 3 && detectedLocations.length > 0 && (
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
                    weather: "Sunny",
                    temperature: "28°C",
                    airQuality: "Good",
                    timezone: "Local",
                    sunlight: "12h"
                  }} 
                  itinerary={itinerary}
                  dayColors={DAY_COLORS}
                />
              </section>
              <section className="mb-12">
                <AISuggestedPlaces onAddToItinerary={handleAddSuggestion} locationName={detectedLocations[0].place} suggestions={suggestions} />
              </section>
              <section className="mb-12">
                <TravelItinerary 
                  itinerary={itinerary} 
                  onUpdate={setItinerary} 
                  activeDragId={activeDragId} 
                  onSelectActivity={handleSelectActivity}
                  onHoverActivity={setHoveredActivityId}
                />
              </section>

              <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                {getOverlayContent()}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>

      {step >= 3 && detectedLocations.length > 0 && <ChatBot locationName={detectedLocations[0].place} />}

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>TravelVision AI – Image-Based AI Travel Planning System • Research Project Prototype</p>
      </footer>
    </div>
  );
};

export default Index;
