import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plane,
  Sparkles,
  LogOut,
  LogIn,
  FileDown,
  Beaker,
  Info,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Eye,
  SlidersHorizontal,
  Bookmark,
  Compass,
  FolderHeart,
  Plus,
  Loader2,
  Check,
  Languages,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { saveBlindTrip } from "@/api/blindEvalApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { hasThaiScript, translateTextSync } from "@/services/translatorService";
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
import AISuggestedPlaces, { type SuggestedPlace, SuggestionDragOverlay, getFallbackSuggestions } from "@/components/AISuggestedPlaces";
import AIAccommodations, { HotelDragOverlay } from "@/components/AIAccommodations";
import FlightInfoDashboard from "@/components/FlightInfoDashboard";
import ChatBot, { type Message as ChatMessage } from "@/components/ChatBot";
import AnalyzingOverlay from "@/components/AnalyzingOverlay";
import StepIndicator from "@/components/StepIndicator";
import WeatherWidget from "@/components/WeatherWidget";
import GlobeFlightBackground from "@/components/GlobeFlightBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCoordinates, distanceMetres } from "@/api/geocode";
import { getNearbyAttractions, fetchPlaceDetails, fetchPlaceDetailsByPlaceId, getFallbackOpeningHours } from "@/api/places";
import { gatherCandidatePOIs, kMeansCluster, partitionPoisIntoNonOverlappingSectors, calculateMasterHub, sequenceDayClusters, solveGreedyTSP, scorePOIs, selectDiversePOIs, calculateCoherenceScore, optimizeDayActivities, rebalanceCrossDayPOIs, scrubAndRelocateDayOutliers, enforceMaxHopDistance, auditItineraryIssues, type DayCluster, type ItineraryCoherence } from "@/api/spatialPlanner";
import { generateTravelPlan, refineItineraryWithAI, generateMoreSuggestions, generateMoreAccommodations, analyzeImage, inferFallbackNonTravelContent, type VisionResult, type TypicalWeather, type TripPreferences } from "@/services/aiService";
import { fetchRecommendedAccommodations } from "@/services/hotelService";

import { getEnvironmentData, type EnvironmentData } from "@/services/environmentService";
import { getCuratedFallbackPhoto, findMatchingUserPhoto } from "@/services/photoService";
import { toast } from "sonner";
import { useAI, AI_MODEL_OPTIONS, getAIModelInfo, MODEL_ID_MAP } from "@/context/AIProviderContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp } from "lucide-react";
import { VisionOutlierModal, type OutlierItem } from "@/components/VisionOutlierModal";
import { detectVisionOutliers } from "@/utils/outlierDetector";
import { SavedTripsModal } from "@/components/SavedTripsModal";
import { saveTrip, type TripRecord } from "@/services/tripService";




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
          src={photo_url || getCuratedFallbackPhoto("sightseeing", name)}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = getCuratedFallbackPhoto("sightseeing", name);
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
  const { locPlace, locDesc } = useLanguage();
  const config = typeConfig[activity.type] || typeConfig.attraction;
  const displayTitle = locPlace(activity) || activity.title;
  const displayDesc = locDesc(activity) || activity.description;

  return (
    <div className="w-64 md:w-72 rounded-2xl overflow-hidden bg-card border shadow-2xl scale-105 rotate-1">
      <div className="relative h-40 overflow-hidden">
        <img
          src={getActivityImage(activity)}
          alt={displayTitle}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = getCuratedFallbackPhoto(activity.type, activity.title);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
      </div>
      <div className="p-4">
        <Badge variant="outline" className={`text-[10px] mb-2 ${config.color}`}>
          {config.label}
        </Badge>
        <h4 className="font-semibold text-foreground text-sm">{displayTitle}</h4>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{displayDesc}</p>
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

  if (!user) {
    return (
      <Button
        type="button"
        id="login-button"
        size="sm"
        onClick={() => navigate("/login")}
        className="h-8 rounded-full px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1 shadow-2xs"
      >
        <LogIn className="size-3.5" />
        <span>Sign In</span>
      </Button>
    );
  }

  const avatarUrl: string | undefined = user.user_metadata?.avatar_url;
  const displayName: string =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Traveler";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-1.5 bg-secondary/80 border border-border/70 pl-1 pr-2 py-0.5 rounded-full shadow-2xs">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="size-6 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="size-6 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
          {initials}
        </div>
      )}
      <span className="text-xs font-semibold text-foreground max-w-[85px] truncate hidden md:inline">
        {displayName}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="p-1 rounded-full text-muted-foreground hover:text-red-500 transition-colors ml-0.5"
        title="Sign Out"
      >
        <LogOut className="size-3" />
      </button>
    </div>
  );
};

// ─── Convert uploaded File to durable base64 thumbnail for permanent DB storage ──
function fileToBase64Thumbnail(file: File, maxWidth = 480): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      try {
        resolve(URL.createObjectURL(file));
      } catch {
        resolve("");
      }
    };
    reader.readAsDataURL(file);
  });
}
// ──────────────────────────────────────────────────────────────────────────────

const Index = () => {
  const { model, setModel, provider } = useAI();
  const { language, toggleLanguage, t, locPlace, locDesc } = useLanguage();
  const [step, setStep] = useState(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(0);
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
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
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
  const [outliers, setOutliers] = useState<OutlierItem[]>([]);
  const [isOutlierModalOpen, setIsOutlierModalOpen] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // ── Saved Trips & Chat Persistence ──

  const { role } = useAuth();
  const [blindSaveModalOpen, setBlindSaveModalOpen] = useState(false);
  const [blindScenarioId, setBlindScenarioId] = useState("SC-01");
  const [blindScenarioTitle, setBlindScenarioTitle] = useState("");
  const [blindScenarioNotes, setBlindScenarioNotes] = useState("");
  const [isSavingBlindTrip, setIsSavingBlindTrip] = useState(false);

  const handleSaveToBlindEval = async () => {
    if (!itinerary || itinerary.length === 0) return;
    setIsSavingBlindTrip(true);
    try {
      const defaultTitle = currentTripTitle || (detectedLocations[0]?.place ? `${detectedLocations[0].place} (${itinerary.length} Days)` : "Curated Trip");
      await saveBlindTrip({
        scenario_id: blindScenarioId.trim() || "SC-01",
        scenario_title: blindScenarioTitle.trim() || defaultTitle,
        scenario_notes: blindScenarioNotes.trim(),
        actual_model: model,
        itinerary,
        preferences: preferences || ({} as any),
        typicalWeather: typicalWeather || undefined,
        suggestions,
        accommodations,
        uploaded_locations: detectedLocations.length > 0
          ? detectedLocations.map((loc) => ({
              place: loc.place,
              place_th: loc.place_th,
              city: loc.city,
              country: loc.country,
              confidence: loc.confidence,
              uploadedImageUrl: loc.uploadedImageUrl,
            }))
          : undefined,
      });
      toast.success(
        language === "th"
          ? `บันทึกทริปเข้าสู่ Blind Evaluation (${blindScenarioId}) สำเร็จ!`
          : `Saved trip to Blind Evaluation (${blindScenarioId}) successfully!`
      );
      setBlindSaveModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save to Blind Evaluation");
    } finally {
      setIsSavingBlindTrip(false);
    }
  };

  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [currentTripTitle, setCurrentTripTitle] = useState<string | null>(null);
  const [isSavedTripsModalOpen, setIsSavedTripsModalOpen] = useState<boolean>(false);
  const [isSavingTrip, setIsSavingTrip] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const [isAIRefining, setIsAIRefining] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (itinerary.length > 0) {
      const pace = preferences?.pace || "Moderate";
      const score = calculateCoherenceScore(
        itinerary,
        pace,
        tripStartDate ?? undefined,
        preferences ? {
          budget: preferences.budget,
          travelerType: preferences.travelerType,
          activities: preferences.activities,
          pace: preferences.pace,
        } : undefined,
        environmentData?.forecast
      );
      setCoherenceResult(score);
    }
  }, [itinerary, preferences, tripStartDate, environmentData?.forecast]);

  // Auto-geocode any activities in itinerary with missing or zero coordinates
  useEffect(() => {
    let hasMissingCoords = false;
    for (const day of itinerary) {
      for (const act of day.activities) {
        if (!act.lat || !act.lng || act.lat === 0 || act.lng === 0) {
          hasMissingCoords = true;
          break;
        }
      }
      if (hasMissingCoords) break;
    }

    if (!hasMissingCoords) return;

    let isCancelled = false;
    (async () => {
      let didUpdate = false;
      const updatedItinerary = await Promise.all(
        itinerary.map(async (day) => {
          const updatedActivities = await Promise.all(
            day.activities.map(async (act) => {
              if (!act.lat || !act.lng || act.lat === 0 || act.lng === 0) {
                try {
                  const details = await fetchPlaceDetails(act.title);
                  if (details && details.lat && details.lng) {
                    didUpdate = true;
                    return { ...act, lat: details.lat, lng: details.lng };
                  }
                } catch {
                  // Ignore fallback errors
                }
              }
              return act;
            })
          );
          return { ...day, activities: updatedActivities };
        })
      );

      if (!isCancelled && didUpdate) {
        setItinerary(updatedItinerary);
        setMapItinerary(updatedItinerary);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [itinerary]);

  const handleSaveCurrentTrip = useCallback(async (isSilent: boolean = false) => {
    if (!itinerary || itinerary.length === 0) {
      if (!isSilent) toast.warning("ไม่มีข้อมูลตารางการเดินทางให้บันทึก");
      return;
    }

    // Hash check to prevent redundant writes
    const currentPayloadContent = JSON.stringify({
      itinerary,
      chatMessages,
      detectedLocations,
      preferences,
      suggestions,
      accommodations,
    });

    if (isSilent && lastSavedHashRef.current === currentPayloadContent) {
      return; // No changes since last save
    }

    if (!isSilent) {
      setIsSavingTrip(true);
    } else {
      setIsAutoSaving(true);
    }

    try {
      const destination = detectedLocations[0]?.place || (preferences ? "Travel Destination" : "ทริปท่องเที่ยว");
      const currentModel = preferences?.aiModel || preferences?.ai_model || model;
      const saved = await saveTrip({
        id: currentTripId || undefined,
        title: currentTripTitle || undefined,
        destination,
        preferences: preferences
          ? {
              ...preferences,
              aiModel: currentModel,
              ai_model: currentModel,
            }
          : null,
        ai_model: currentModel,
        itinerary,
        chat_messages: chatMessages,
        detected_locations: detectedLocations,
        suggestions,
        accommodations,
        coherence_score: coherenceResult,
        environment_data: environmentData,
      });

      setCurrentTripId(saved.id);
      setCurrentTripTitle(saved.title);
      lastSavedHashRef.current = currentPayloadContent;
      setLastAutoSavedAt(new Date());

      if (!isSilent) {
        toast.success(`บันทึก "${saved.title}" ลงฐานข้อมูลเรียบร้อยแล้ว ✨`);
      }
    } catch (err: any) {
      if (!isSilent) {
        console.error("Save trip error:", err);
        toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึกทริป");
      } else {
        console.warn("[AutoSave] Silent auto-save skipped:", err?.message || err);
      }
    } finally {
      setIsSavingTrip(false);
      setIsAutoSaving(false);
    }
  }, [
    currentTripId,
    currentTripTitle,
    detectedLocations,
    preferences,
    model,
    itinerary,
    chatMessages,
    suggestions,
    accommodations,
    coherenceResult,
    environmentData,
  ]);

  // ── Auto-save every 1 minute (60,000 ms) whenever itinerary exists ──
  useEffect(() => {
    if (!itinerary || itinerary.length === 0 || maxUnlockedStep < 3) return;

    const intervalId = setInterval(() => {
      handleSaveCurrentTrip(true);
    }, 60000); // 1 minute

    return () => clearInterval(intervalId);
  }, [handleSaveCurrentTrip, itinerary, maxUnlockedStep]);



  const handleSelectTrip = useCallback((trip: TripRecord) => {
    setCurrentTripId(trip.id);
    setCurrentTripTitle(trip.title);
    setItinerary(trip.itinerary || []);
    setMapItinerary(trip.itinerary || []);
    setPreferences(trip.preferences || null);
    if (trip.preferences) {
      try {
        sessionStorage.setItem("pixinerary_active_preferences", JSON.stringify(trip.preferences));
      } catch {}
    }
    setDetectedLocations(trip.detected_locations || []);
    setSuggestions(trip.suggestions || []);
    setAccommodations(trip.accommodations || []);
    setChatMessages(trip.chat_messages || []);
    setCoherenceResult(trip.coherence_score || null);
    if (trip.detected_locations && trip.detected_locations[0]?.lat && trip.detected_locations[0]?.lng) {
      setSelectedPlace({ lat: trip.detected_locations[0].lat, lng: trip.detected_locations[0].lng });
    } else if (trip.itinerary && trip.itinerary[0]?.activities?.find(a => a.lat && a.lng)) {
      const actWithCoords = trip.itinerary[0].activities.find(a => a.lat && a.lng)!;
      setSelectedPlace({ lat: actWithCoords.lat!, lng: actWithCoords.lng! });
    }
    if (trip.preferences?.startDate) {
      setTripStartDate(new Date(trip.preferences.startDate));
    }
    if (trip.environment_data) {
      setEnvironmentData(trip.environment_data);
    }
    const tripModel = trip.preferences?.aiModel || trip.preferences?.ai_model || trip.ai_model;
    if (tripModel && typeof tripModel === "string") {
      try {
        if (tripModel in MODEL_ID_MAP) {
          setModel(tripModel as any);
        }
      } catch {}
    }
    setStep(3);
    setMaxUnlockedStep(3);
    window.scrollTo({ top: 200, behavior: "smooth" });
    toast.success(`โหลดข้อมูลทริป "${trip.title}" สำเร็จ ✨`);
  }, [setModel]);


  const handleNewTrip = useCallback(() => {
    setCurrentTripId(null);
    setCurrentTripTitle(null);
    setItinerary(MOCK_ITINERARY);
    setMapItinerary(MOCK_ITINERARY);
    setPreferences(null);
    setDetectedLocations([]);
    setSuggestions([]);
    setAccommodations([]);
    setChatMessages([]);
    setCoherenceResult(null);
    setStep(0);
    setMaxUnlockedStep(0);
    toast.info("เริ่มต้นสร้างทริปใหม่แล้ว");
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleRestoreLocation = useCallback((outlierId: string) => {
    const outlierIndex = outliers.findIndex(o => o.id === outlierId);
    if (outlierIndex === -1) return;

    const restoredItem = outliers[outlierIndex];
    setOutliers(prev => prev.filter(o => o.id !== outlierId));

    setDetectedLocations(prev => {
      if (!prev.some(l => l.place.toLowerCase() === restoredItem.originalResult.place.toLowerCase())) {
        return [
          ...prev,
          {
            ...restoredItem.originalResult,
            uploadedImageUrl: restoredItem.originalResult.uploadedImageUrl || restoredItem.photoUrl || undefined,
            isExcursion: restoredItem.distanceKm ? restoredItem.distanceKm > 35 : false,
            distanceKm: restoredItem.distanceKm,
          },
        ];
      }
      return prev;
    });

    toast.success(`กู้คืน "${restoredItem.place}" กลับเข้าสู่รายการวางแผนแล้ว ✨`);
  }, [outliers]);

  const handleDiscardOutlier = useCallback((outlierId: string) => {
    const outlier = outliers.find(o => o.id === outlierId);
    setOutliers(prev => prev.filter(o => o.id !== outlierId));
    if (outlier) {
      toast.info(`ตัดภาพ "${outlier.place}" ออกจากรายการแล้ว`);
    }
  }, [outliers]);

  const handleDiscardAllNonTravel = useCallback(() => {
    const nonTravelItems = outliers.filter(o => o.category === "NON_TRAVEL");
    if (nonTravelItems.length === 0) return;
    setOutliers(prev => prev.filter(o => o.category !== "NON_TRAVEL"));
    toast.info(`ตัดภาพที่ไม่ใช่สถานที่ท่องเที่ยวออกทั้งหมด ${nonTravelItems.length} ภาพเรียบร้อยแล้ว`);
  }, [outliers]);

  const handleManualOverridePlace = useCallback(async (outlierId: string, customPlaceName: string) => {
    const trimmed = customPlaceName.trim();
    if (!trimmed) return;
    const outlier = outliers.find(o => o.id === outlierId);
    if (!outlier) return;

    setOutliers(prev => prev.filter(o => o.id !== outlierId));

    try {
      const coords = await getCoordinates(trimmed);
      const updatedResult: VisionResult & { lat?: number; lng?: number } = {
        ...outlier.originalResult,
        place: trimmed,
        country: outlier.majorityCountry || outlier.country || "Thailand",
        type: "custom_place",
        confidence: 1.0,
        lat: coords.lat,
        lng: coords.lng,
        uploadedImageUrl: outlier.originalResult.uploadedImageUrl || outlier.photoUrl || undefined,
      };
      setDetectedLocations(prev => [...prev, updatedResult]);
      toast.success(`เพิ่ม "${trimmed}" เข้าสู่แผนการเดินทางแล้ว ✨`);
    } catch {
      const updatedResult: VisionResult = {
        ...outlier.originalResult,
        place: trimmed,
        country: outlier.majorityCountry || outlier.country || "Thailand",
        type: "custom_place",
        confidence: 1.0,
        uploadedImageUrl: outlier.originalResult.uploadedImageUrl || outlier.photoUrl || undefined,
      };
      setDetectedLocations(prev => [...prev, updatedResult]);
      toast.success(`เพิ่ม "${trimmed}" เข้าสู่แผนการเดินทางแล้ว ✨`);
    }
  }, [outliers]);

  const handleReplaceOutlierPhoto = useCallback(async (outlierId: string, newFile: File) => {
    const targetOutlier = outliers.find(o => o.id === outlierId);
    if (!targetOutlier) return;

    const toastId = toast.loading("กำลังวิเคราะห์รูปภาพใหม่ที่อัปโหลด...");

    try {
      const res = await analyzeImage(newFile, model, useClip);
      let uploadedImageUrl: string | undefined = undefined;
      try {
        uploadedImageUrl = await fileToBase64Thumbnail(newFile);
      } catch {
        uploadedImageUrl = URL.createObjectURL(newFile);
      }

      // If the new image is a valid place
      if (res.is_identifiable_place !== false && res.confidence >= 0.20) {
        let lat: number | undefined = undefined;
        let lng: number | undefined = undefined;
        try {
          const targetLoc = res.city ? `${res.city}, ${res.country}` : res.country;
          const coords = await getCoordinates(res.place, undefined, targetLoc);
          lat = coords.lat;
          lng = coords.lng;
        } catch {
          // Keep undefined coords
        }

        const newVisionResult: VisionResult & { lat?: number; lng?: number } = {
          ...res,
          uploadedImageUrl,
          lat,
          lng,
        };

        // Remove from outliers
        setOutliers(prev => prev.filter(o => o.id !== outlierId));

        // Add to detected locations
        setDetectedLocations(prev => [...prev, newVisionResult]);

        toast.success(`แทนที่สำเร็จ! ตรวจพบสถานที่: "${res.place}" ✨`, { id: toastId });
      } else {
        // Still not a valid place (e.g. uploaded another food or selfie)
        const fallback = inferFallbackNonTravelContent(res.type, res.rejection_reason);
        const detectedLabel = res.detected_content || fallback.detectedContent;

        setOutliers(prev =>
          prev.map(o => {
            if (o.id === outlierId) {
              return {
                ...o,
                place: `ภาพไม่ระบุสถานที่ (${detectedLabel})`,
                photoUrl: uploadedImageUrl,
                reasonTitle: `ตรวจพบ: ${detectedLabel}`,
                reasonDescription: res.detailed_description || res.rejection_reason || fallback.detailedDescription,
                detected_content: detectedLabel,
                detailed_description: res.detailed_description || fallback.detailedDescription,
                suggested_action: res.suggested_action || fallback.suggestedAction,
                non_travel_category: res.non_travel_category || res.type,
                originalResult: { ...res, uploadedImageUrl },
              };
            }
            return o;
          })
        );

        toast.error(
          `ภาพที่อัปโหลดใหม่ยังคงไม่ใช่สถานที่: ตรวจพบว่าเป็น "${detectedLabel}" กรุณาลองใหม่อีกครั้ง`,
          { id: toastId, duration: 6000 }
        );
      }
    } catch (err) {
      console.error("Failed to analyze replacement photo:", err);
      toast.error("เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพใหม่ กรุณาลองอีกครั้ง", { id: toastId });
    }
  }, [outliers, model, useClip]);

  const handleSwitchCandidateFromOutlier = useCallback((outlierId: string, candidate: any) => {
    const outlierIndex = outliers.findIndex(o => o.id === outlierId);
    if (outlierIndex === -1) return;

    const item = outliers[outlierIndex];
    setOutliers(prev => prev.filter(o => o.id !== outlierId));

    const updatedResult: VisionResult = {
      ...item.originalResult,
      place: candidate.name,
      confidence: candidate.similarity || item.confidence || 0.8,
      uploadedImageUrl: item.originalResult.uploadedImageUrl || item.photoUrl || undefined,
    };

    setDetectedLocations(prev => {
      if (!prev.some(l => l.place.toLowerCase() === candidate.name.toLowerCase())) {
        return [...prev, updatedResult];
      }
      return prev;
    });

    toast.success(`สลับเป็น "${candidate.name}" เรียบร้อยแล้ว ✨`);
  }, [outliers]);

  const handleSwitchCandidateFromLocation = useCallback((index: number, candidate: any) => {
    setDetectedLocations(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          place: candidate.name,
          confidence: candidate.similarity || copy[index].confidence || 0.8,
        };
      }
      return copy;
    });
    toast.success(`สลับเป็น "${candidate.name}" เรียบร้อยแล้ว ✨`);
  }, []);

  const handleRemoveLocation = useCallback((index: number) => {
    setDetectedLocations(prev => {
      if (prev.length <= 1) {
        toast.warning("ต้องมีสถานที่อย่างน้อย 1 แห่งสำหรับการวางแผน");
        return prev;
      }
      const removed = prev[index];
      const next = prev.filter((_, idx) => idx !== index);
      toast.info(`ลบ "${removed.place}" ออกจากรายการแล้ว`);
      return next;
    });
  }, []);

  const handleAIRefineItinerary = useCallback(async () => {

    if (!itinerary || itinerary.length === 0) {
      toast.warning("ไม่มีข้อมูลตารางเที่ยวให้จัดระเบียบ");
      return;
    }

    setIsAIRefining(true);
    toast.loading("พิกซ์กำลังตรวจสอบกฎและจัดระเบียบตารางเที่ยว...", { id: "ai-refine" });

    try {
      const currentPace = preferences?.pace || "Moderate";
      const prefsWithModel: TripPreferences = preferences || {
        days: itinerary.length,
        pace: currentPace,
        travelerType: "Solo",
        budget: "Medium",
        activities: ["Sightseeing", "Food"],
        startDate: tripStartDate || new Date(),
        endDate: tripStartDate || new Date(),
      };

      const auditReport = auditItineraryIssues(
        itinerary,
        currentPace,
        tripStartDate ?? undefined,
        {
          budget: prefsWithModel.budget,
          travelerType: prefsWithModel.travelerType,
          activities: prefsWithModel.activities,
          pace: prefsWithModel.pace,
        },
        environmentData?.forecast
      );

      const refined = await refineItineraryWithAI(
        itinerary,
        auditReport.warnings,
        prefsWithModel,
        model,
        environmentData?.forecast
      );

      // Re-apply 2-Opt TSP & hours fitting
      const hotelLoc = prefsWithModel.hasHotel === "yes" && prefsWithModel.hotelLat && prefsWithModel.hotelLng
        ? { lat: prefsWithModel.hotelLat, lng: prefsWithModel.hotelLng }
        : (selectedPlace || { lat: 13.7563, lng: 100.5018 });

      const targetItinerary = (refined && Array.isArray(refined) && refined.length >= itinerary.length)
        ? refined
        : itinerary;

      const rebalanced = rebalanceCrossDayPOIs(targetItinerary);
      const scrubbed = scrubAndRelocateDayOutliers(rebalanced, hotelLoc, 4.5);
      const optimized = scrubbed.map((day, dIdx) => {
        const prevDayLastAct = dIdx > 0 ? scrubbed[dIdx - 1]?.activities.slice(-1)[0] : undefined;
        const dayStart = (prefsWithModel.hasHotel === "yes" && prefsWithModel.hotelLat && prefsWithModel.hotelLng)
          ? hotelLoc
          : (dIdx === 0
            ? hotelLoc
            : (prevDayLastAct?.lat && prevDayLastAct?.lng ? { lat: prevDayLastAct.lat, lng: prevDayLastAct.lng } : hotelLoc));

        const dayDate = new Date(tripStartDate || new Date());
        dayDate.setDate(dayDate.getDate() + dIdx);
        const dayOfWeek = dayDate.getDay();

        const optActivities = enforceMaxHopDistance(optimizeDayActivities(day.activities, currentPace, dayStart, dayOfWeek), 4.0);
        return {
          ...day,
          activities: optActivities,
        };
      });

      setItinerary(optimized);
      setMapItinerary(optimized);
      toast.success("AI ตรวจสอบและจัดระเบียบตารางเที่ยวให้สมบูรณ์แล้ว ✨", {
        id: "ai-refine",
        description: "จัดกลุ่มสถานที่ใกล้เคียง ปรับเวลาอาหาร และเรียงลำดับเส้นทางให้ราบรื่นเรียบร้อย",
      });
    } catch (e: any) {
      console.error("AI Refinement failed:", e);
      toast.error("ไม่สามารถปรับแต่งตารางเที่ยวได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง", { id: "ai-refine" });
    } finally {
      setIsAIRefining(false);
    }
  }, [itinerary, preferences, tripStartDate, model, selectedPlace, environmentData?.forecast]);

  const [optimizingDayIndex, setOptimizingDayIndex] = useState<number | null>(null);

  const handleOptimizeDay = useCallback((dayIndex: number) => {
    if (!itinerary || !itinerary[dayIndex]) return;
    const targetDay = itinerary[dayIndex];
    if (targetDay.activities.length <= 1) {
      toast.info(`Day ${targetDay.day} มีสถานที่น้อยเกินไปสำหรับการจัดลำดับใหม่`);
      return;
    }

    setOptimizingDayIndex(dayIndex);
    try {
      const currentPace = preferences?.pace || "Moderate";
      const hotelLoc = preferences?.hasHotel === "yes" && preferences.hotelLat && preferences.hotelLng
        ? { lat: preferences.hotelLat, lng: preferences.hotelLng }
        : (selectedPlace || { lat: 13.7563, lng: 100.5018 });

      const prevDayLastAct = dayIndex > 0 ? itinerary[dayIndex - 1]?.activities.slice(-1)[0] : undefined;
      const dayStart = (preferences?.hasHotel === "yes" && preferences.hotelLat && preferences.hotelLng)
        ? hotelLoc
        : (dayIndex === 0
          ? hotelLoc
          : (prevDayLastAct?.lat && prevDayLastAct?.lng ? { lat: prevDayLastAct.lat, lng: prevDayLastAct.lng } : hotelLoc));

      const dayDate = new Date(tripStartDate || new Date());
      dayDate.setDate(dayDate.getDate() + dayIndex);
      const dayOfWeek = dayDate.getDay();

      const optActivities = enforceMaxHopDistance(optimizeDayActivities(targetDay.activities, currentPace, dayStart, dayOfWeek), 4.0);

      const updated = itinerary.map((d, idx) =>
        idx === dayIndex ? { ...d, activities: optActivities } : d
      );

      setItinerary(updated);
      setMapItinerary(updated);

      toast.success(`จัดระเบียบเส้นทาง Day ${targetDay.day} ให้ราบรื่นเรียบร้อย ✨`, {
        description: "จัดเรียงเส้นทางระเบียงเดียว (2-Opt) มื้ออาหารไม่ติดกัน พร้อมปรับเวลาตามเวลาเปิด-ปิดจริง",
      });
    } catch (err) {
      console.error("Failed to optimize day:", err);
      toast.error(`ไม่สามารถจัดระเบียบ Day ${targetDay.day} ได้`);
    } finally {
      setOptimizingDayIndex(null);
    }
  }, [itinerary, preferences, tripStartDate, selectedPlace]);


  const handleImagesUploaded = useCallback(async (files: File[]) => {
    setOverlayType("vision");
    setIsAnalyzing(true);
    setStep(0);

    try {
      // Step 1: Vision AI for each image
      setLoadingStep(useClip ? "Loading Vision Model + CLIP..." : "Loading Vision Model...");
      const results = await Promise.all(
        files.map(async (file) => {
          const res = await analyzeImage(file, model, useClip, setLoadingStep);
          let uploadedImageUrl: string | undefined = undefined;
          try {
            uploadedImageUrl = await fileToBase64Thumbnail(file);
          } catch {
            uploadedImageUrl = URL.createObjectURL(file);
          }
          return {
            ...res,
            uploadedImageUrl,
          };
        })
      );

      // Pre-geocode identified locations to compute accurate geo-distances
      setLoadingStep("Geocoding & Calculating Distances...");
      const geoResults = await Promise.all(
        results.map(async (r) => {
          try {
            const targetLoc = r.city ? `${r.city}, ${r.country}` : r.country;
            const coords = await getCoordinates(r.place, undefined, targetLoc);
            return { ...r, lat: coords.lat, lng: coords.lng };
          } catch {
            return r;
          }
        })
      );

      setLoadingStep("Filtering & Checking Outliers...");
      // Filter outliers (country mismatch, distance > 55 km, low confidence, non-travel, duplicates)
      const { kept, outliers: detectedOutliers } = detectVisionOutliers(geoResults, useClip, 55, 28);

      setDetectedLocations(kept);
      setOutliers(detectedOutliers);
      setIsAnalyzing(false);
      setStep(1);
      setMaxUnlockedStep(prev => Math.max(prev, 1));

      const nonTravelOutliers = detectedOutliers.filter(o => o.category === "NON_TRAVEL");
      const nonTravelCount = nonTravelOutliers.length;

      if (kept.length === 0 && nonTravelCount > 0) {
        // ALL images are non-travel images!
        const distinctTypes = Array.from(new Set(nonTravelOutliers.map(o => o.detected_content || o.reasonTitle))).join(", ");
        toast.error(
          `ไม่พบสถานที่ท่องเที่ยว: ตรวจพบว่าเป็น ${distinctTypes}`,
          {
            description: "กรุณาอัปโหลดรูปภาพสถานที่ท่องเที่ยว วิว หรือแลนด์มาร์กใหม่อีกครั้ง",
            duration: 9000,
            action: {
              label: "ตรวจสอบ Outlier",
              onClick: () => setIsOutlierModalOpen(true),
            },
          }
        );
      } else if (nonTravelCount > 0) {
        // Some images are non-travel, but some valid places exist
        const distinctTypes = Array.from(new Set(nonTravelOutliers.map(o => o.detected_content || o.reasonTitle))).slice(0, 2).join(", ");
        toast.warning(
          `AI คัดกรองภาพที่ไม่ใช่สถานที่ออก ${nonTravelCount} ภาพ (${distinctTypes})`,
          {
            description: "คุณสามารถอัปโหลดภาพสถานที่ท่องเที่ยวใหม่มาแทนที่ หรือตัดภาพออกได้",
            action: {
              label: "ตรวจสอบ Outlier",
              onClick: () => setIsOutlierModalOpen(true),
            },
            duration: 7000,
          }
        );
      } else if (detectedOutliers.length > 0) {
        toast.warning(
          `Vision AI ตรวจพบ Outlier หรือสถานที่ที่ต้องยืนยัน ${detectedOutliers.length} รายการ`,
          {
            description: "คุณสามารถเปิดดูรายงาน สลับสถานที่ หรือยืนยันได้",
            action: {
              label: "ตรวจสอบ Outlier",
              onClick: () => setIsOutlierModalOpen(true),
            },
            duration: 7000,
          }
        );
      }
    } catch (error) {
      console.error("Workflow error:", error);
      toast.error(error instanceof Error ? error.message : "Something went wrong during analysis");
      setIsAnalyzing(false);
      setStep(0);
    }
  }, [model, provider, useClip]);

  const handlePreferencesSubmit = useCallback(async (prefs: TripPreferences) => {
    if (!detectedLocations.length) return;
    const prefsWithModel: TripPreferences = {
      ...prefs,
      aiModel: model,
      ai_model: model,
    };
    setPreferences(prefsWithModel);
    try {
      sessionStorage.setItem("pixinerary_active_preferences", JSON.stringify(prefsWithModel));
    } catch {}
    setOverlayType("itinerary");
    setLoadingStep("Analyzing Preferences...");
    setIsAnalyzing(true);
    setStep(3);
    setMaxUnlockedStep(prev => Math.max(prev, 3));

    try {
      // Step 1: Destination Geocoding
      const mainLocation = detectedLocations[0];
      const cityPart = mainLocation.city ? `${mainLocation.city}, ` : "";
      const mainLocationStr = `${mainLocation.place}, ${cityPart}${mainLocation.country}`;
      let coords = await getCoordinates(mainLocationStr, undefined, mainLocation.city || mainLocation.place);
      setSelectedPlace(coords);

      // Step 1b: Spatial Candidate Gathering, K-Means Clustering, Macro-TSP Sequencing & Greedy TSP
      setLoadingStep("Gathering Places & Spatial Clustering...");
      const locationNames = detectedLocations.map(l => l.place);
      let dayClusters: DayCluster[] = [];

      try {
        const userSeeds = detectedLocations
          .filter(l => typeof l.lat === "number" && typeof l.lng === "number" && l.lat !== 0 && l.lng !== 0)
          .map(l => ({ lat: l.lat!, lng: l.lng! }));
        const masterHub = calculateMasterHub(userSeeds, coords);

        const candidatePois = await gatherCandidatePOIs(mainLocation.place, masterHub, locationNames, prefsWithModel.activities);
        if (candidatePois.length > 0) {
          const scoredPois = scorePOIs(candidatePois, masterHub, prefsWithModel.activities);
          const diversePois = selectDiversePOIs(scoredPois, Math.max(20, prefsWithModel.days * 5));

          // Polar Sector Partitioning around masterHub for strict non-overlapping daily zones
          const rawClusters = partitionPoisIntoNonOverlappingSectors(
            diversePois,
            prefsWithModel.days,
            masterHub,
            userSeeds,
            12.0
          );

          // Macro-Cluster Sequencing: Sequence clusters 1..K in a contiguous progression from start location
          const startLocation = prefsWithModel.hasHotel === "yes" && prefsWithModel.hotelLat && prefsWithModel.hotelLng
            ? { lat: prefsWithModel.hotelLat, lng: prefsWithModel.hotelLng }
            : masterHub;
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
        await generateTravelPlan(locationNames, prefsWithModel, model, dayClusters);

      // Step 2a: AI Self-Review & Refinement Loop (Critic-Actor Quality Gate)
      let workingItinerary = generatedItinerary;
      try {
        const auditReport = auditItineraryIssues(
          generatedItinerary,
          prefsWithModel.pace,
          prefsWithModel.startDate,
          {
            budget: prefsWithModel.budget,
            travelerType: prefsWithModel.travelerType,
            activities: prefsWithModel.activities,
            pace: prefsWithModel.pace,
          },
          environmentData?.forecast
        );
        if (auditReport.warnings.length > 0 || auditReport.score < 88) {
          setLoadingStep("AI Self-Reviewing & Refining Itinerary Flow...");
          console.log("[AISelfReview] Detected draft issues, auto-refining with AI:", auditReport.warnings);
          const refined = await refineItineraryWithAI(
            generatedItinerary,
            auditReport.warnings,
            prefsWithModel,
            model,
            environmentData?.forecast
          );
          if (refined && Array.isArray(refined) && refined.length >= (prefsWithModel.days || 1)) {
            workingItinerary = refined;
            console.log("[AISelfReview] Refined itinerary successfully applied with", refined.length, "days");
          } else {
            console.warn(`[AISelfReview] Refined itinerary returned ${refined?.length} days, expected at least ${prefsWithModel.days}. Preserving multi-day draft.`);
          }
        }
      } catch (selfReviewErr) {
        console.warn("[AISelfReview] Self-review error fallback to draft:", selfReviewErr);
      }

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

      // Step 2c: Itinerary Centroid Self-Correction (Fail-Safe Quality Gate)
      // If generated activities cluster tightly in another city than initial coords (e.g. Bangkok vs Chiang Rai),
      // auto-correct destination center to the real activity cluster!
      try {
        const sampleTitles: string[] = [];
        for (const day of workingItinerary) {
          for (const act of day.activities) {
            if (act.title && !sampleTitles.includes(act.title)) {
              sampleTitles.push(act.title);
              if (sampleTitles.length >= 4) break;
            }
          }
          if (sampleTitles.length >= 4) break;
        }

        if (sampleTitles.length >= 2) {
          const sampleCity = mainLocation.city || mainLocation.place;
          const sampleCoords = (
            await Promise.all(
              sampleTitles.map(async (t) => {
                try {
                  return await getCoordinates(t, undefined, sampleCity);
                } catch {
                  return null;
                }
              })
            )
          ).filter((c): c is Coordinates => Boolean(c && c.lat && c.lng));

          if (sampleCoords.length >= 2) {
            const centroid = {
              lat: sampleCoords.reduce((sum, c) => sum + c.lat, 0) / sampleCoords.length,
              lng: sampleCoords.reduce((sum, c) => sum + c.lng, 0) / sampleCoords.length,
            };

            const isCohesive = sampleCoords.every(c => distanceMetres(c, centroid) < 60_000);
            const distFromDestination = distanceMetres(coords, centroid);

            if (isCohesive && distFromDestination > 80_000) {
              console.warn(
                `[ItineraryCentroidCorrection] Cohesive activity cluster detected in another city (${Math.round(distFromDestination / 1000)}km away from initial coords). Auto-correcting destination center from [${coords.lat}, ${coords.lng}] to [${centroid.lat}, ${centroid.lng}]`
              );
              coords = { lat: centroid.lat, lng: centroid.lng };
              setSelectedPlace(coords);
              toast.info("ระบบปรับศูนย์กลางแผนที่ให้ตรงกับสถานที่ท่องเที่ยวในแผนอัตโนมัติ ✨", { duration: 4000 });
            }
          }
        }
      } catch (centroidErr) {
        console.warn("[ItineraryCentroidCorrection] Check error:", centroidErr);
      }

      // Step 3: Landmark Geocoding Enrichment
      // ⚠ We process activities SEQUENTIALLY (not parallel) to avoid hitting
      //   rate limits — the root cause of pin clustering.
      //   Each activity waits 80 ms before the next request starts.
      setLoadingStep("Plotting Itinerary Map...");
      toast.info("Geocoding landmarks for precise mapping...", { duration: 3000 });

      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      const destinationCity = mainLocation.city || mainLocation.place;

      /**
       * Validate that coords are neither out-of-bounds (> 100km) nor suspiciously generic (< 200m).
       * Tests title, english_name, wiki_title, and cleaned action keywords.
       */
      async function geocodeWithValidation(
        title: string,
        englishName?: string,
        wikiTitle?: string
      ): Promise<{ lat: number; lng: number } | null> {
        const cleanedTitle = title
          .replace(/^(Visit|Explore|See|Tour|Dinner at|Lunch at|Breakfast at|Relax at|ชมวิว|กินข้าวที่|เที่ยว|แวะ)\s+/i, "")
          .trim();

        const candidateList = [title, englishName, wikiTitle, cleanedTitle].filter(
          (c): c is string => Boolean(c && c.trim().length > 1)
        );
        const uniqueCandidates = Array.from(new Set(candidateList));

        for (const candidate of uniqueCandidates) {
          try {
            const result = await getCoordinates(candidate, coords, destinationCity);
            const dist = distanceMetres(result, coords);
            // Valid coordinate if within destination boundary (45 km ceiling to prevent distant province outliers)
            if (dist <= 45_000) {
              return result;
            }
          } catch (_) {
            /* best effort */
          }
        }

        return null;
      }

      const enrichedItinerary: typeof generatedItinerary = [];

      for (let dayIndex = 0; dayIndex < workingItinerary.length; dayIndex++) {
        const day = workingItinerary[dayIndex];
        const enrichedActivities: typeof day.activities = [];


        // Calculate actual date for this day to check opening hours
        const dayDate = new Date(prefs.startDate);
        dayDate.setDate(dayDate.getDate() + dayIndex);
        const currentDayIndexGoogle = (dayDate.getDay() + 6) % 7; // Map JS Sunday=0 to Google Monday=0

        for (const activity of day.activities) {
          setLoadingStep(`Plotting Itinerary Map: ${activity.title}...`);
          await delay(80);

          const userUploadedPhoto = findMatchingUserPhoto(
            activity.title,
            activity.english_name,
            activity.image_keyword,
            detectedLocations,
            activity.wiki_title
          );
          const isUserPhoto = Boolean(userUploadedPhoto);

          try {
            // 1. Fetch rich venue details, real photos & exact coordinates (Foursquare + Smart Photo + Mapbox)
            const placeDetails = await fetchPlaceDetails(
              activity.title,
              coords,
              activity.type,
              destinationCity,
              activity.image_keyword,
              {
                countryName: mainLocation.country,
                wikiTitle: activity.wiki_title,
                indexOffset: dayIndex,
              }
            );

            // 2. Determine best coordinates with 4-level fallback:
            // Priority 1: Verified venue coordinates from Foursquare / Mapbox / Geoapify
            // Priority 2: Multi-alias geocoding (title, english_name, wiki_title)
            // Priority 3: Accurate AI / photo coordinates already present on activity
            // Priority 4: City center default with smart spatial jitter (prevent pin stacking)
            let actLat: number | null = null;
            let actLng: number | null = null;

            if (placeDetails.lat != null && placeDetails.lng != null) {
              const dist = distanceMetres({ lat: placeDetails.lat, lng: placeDetails.lng }, coords);
              if (dist <= 45_000) {
                actLat = placeDetails.lat;
                actLng = placeDetails.lng;
              }
            }

            if (actLat == null || actLng == null) {
              const validated = await geocodeWithValidation(
                activity.title,
                activity.english_name,
                activity.wiki_title
              );
              if (validated) {
                actLat = validated.lat;
                actLng = validated.lng;
              } else if (
                typeof activity.lat === "number" &&
                typeof activity.lng === "number" &&
                !isNaN(activity.lat) &&
                !isNaN(activity.lng) &&
                activity.lat !== 0 &&
                activity.lng !== 0
              ) {
                const aiDist = distanceMetres({ lat: activity.lat, lng: activity.lng }, coords);
                if (aiDist <= 45_000) {
                  actLat = activity.lat;
                  actLng = activity.lng;
                }
              }
            }

            // Fallback 4: If all lookups exhausted, jitter deterministically so pins never stack on top of each other
            if (actLat == null || actLng == null) {
              const actIdx = day.activities.indexOf(activity);
              const angle = ((actIdx * 72) * Math.PI) / 180;
              const jitterDistKm = 0.35 + (actIdx % 4) * 0.15; // 350m - 800m
              const latOffset = (jitterDistKm / 111) * Math.sin(angle);
              const lngOffset = (jitterDistKm / (111 * Math.cos((coords.lat * Math.PI) / 180))) * Math.cos(angle);
              actLat = coords.lat + latOffset;
              actLng = coords.lng + lngOffset;
            }

            // 3. Verify opening hours against current day of the trip
            const openingHours = placeDetails.openingHours || activity.openingHours || getFallbackOpeningHours(activity.type, activity.title);
            let isClosed = false;
            if (openingHours && openingHours.length > 0) {
              const todayHoursText = (openingHours[currentDayIndexGoogle] || "").toLowerCase();
              if (todayHoursText.includes("closed") || todayHoursText.includes("ปิด")) {
                isClosed = true;
              }
            }

            if (isClosed) {
              console.warn(`[filter] Removed "${activity.title}" as it is closed on ${dayDate.toDateString()}`);
              continue; // Skip adding this activity
            }

            // 4. Resolve the most accurate photo URL:
            // User Photo > Foursquare / Wikipedia Real Photo > Activity Photo > null
            const finalPhoto = userUploadedPhoto || placeDetails.photo_url || activity.photo_url || activity.image_url || null;

            enrichedActivities.push({
              ...activity,
              lat: actLat,
              lng: actLng,
              photo_url: finalPhoto,
              image_url: finalPhoto,
              isUserPhoto: isUserPhoto,
              rating: placeDetails.rating || activity.rating || undefined,
              userRatingsTotal: placeDetails.userRatingsTotal || activity.userRatingsTotal || undefined,
              openNow: placeDetails.openNow ?? activity.openNow ?? null,
              openingHours: openingHours,
              priceLevel: placeDetails.priceLevel ?? activity.priceLevel ?? null,
              website: placeDetails.website || activity.website || null,
              phoneNumber: placeDetails.phoneNumber || activity.phoneNumber || null,
            });
          } catch (e) {
            console.warn(`[enrichment] Fallback for "${activity.title}":`, e);
            let fallbackLat = coords.lat;
            let fallbackLng = coords.lng;
            try {
              const fallbackValidated = await geocodeWithValidation(activity.title);
              if (fallbackValidated) {
                fallbackLat = fallbackValidated.lat;
                fallbackLng = fallbackValidated.lng;
              } else if (activity.lat && activity.lng && activity.lat !== 0 && activity.lng !== 0) {
                fallbackLat = activity.lat;
                fallbackLng = activity.lng;
              } else {
                const actIdx = day.activities.indexOf(activity);
                const angle = ((actIdx * 72) * Math.PI) / 180;
                const jitterDistKm = 0.35 + (actIdx % 4) * 0.15;
                fallbackLat = coords.lat + (jitterDistKm / 111) * Math.sin(angle);
                fallbackLng = coords.lng + (jitterDistKm / (111 * Math.cos((coords.lat * Math.PI) / 180))) * Math.cos(angle);
              }
            } catch {
              const actIdx = day.activities.indexOf(activity);
              const angle = ((actIdx * 72) * Math.PI) / 180;
              const jitterDistKm = 0.35 + (actIdx % 4) * 0.15;
              fallbackLat = coords.lat + (jitterDistKm / 111) * Math.sin(angle);
              fallbackLng = coords.lng + (jitterDistKm / (111 * Math.cos((coords.lat * Math.PI) / 180))) * Math.cos(angle);
            }
            const finalPhoto = userUploadedPhoto || activity.photo_url || activity.image_url || null;
            enrichedActivities.push({
              ...activity,
              lat: fallbackLat,
              lng: fallbackLng,
              photo_url: finalPhoto,
              image_url: finalPhoto,
              isUserPhoto: isUserPhoto,
              openingHours: activity.openingHours || getFallbackOpeningHours(activity.type, activity.title),
            });
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

      // Apply Cross-Day Spatial Rebalancing (prevent visiting same neighborhood on multiple days)
      const rebalancedItinerary = rebalanceCrossDayPOIs(enrichedItinerary);

      // Scrub and relocate any rogue outliers (> 4.5 km from day cluster) before final map rendering
      const scrubbedItinerary = scrubAndRelocateDayOutliers(rebalancedItinerary, coords, 4.5);

      // Apply Neuro-Symbolic 2-Opt TSP, Opening Hours constraint, and Anti-Looping Route Optimization
      const hotelLoc = prefs.hasHotel === "yes" && prefs.hotelLat && prefs.hotelLng
        ? { lat: prefs.hotelLat, lng: prefs.hotelLng }
        : coords;

      const sortedEnrichedItinerary = scrubbedItinerary.map((day, dIdx) => {
        const prevDayLastAct = dIdx > 0 ? scrubbedItinerary[dIdx - 1]?.activities.slice(-1)[0] : undefined;
        const dayStart = (prefs.hasHotel === "yes" && prefs.hotelLat && prefs.hotelLng)
          ? hotelLoc
          : (dIdx === 0
            ? hotelLoc
            : (prevDayLastAct?.lat && prevDayLastAct?.lng ? { lat: prevDayLastAct.lat, lng: prevDayLastAct.lng } : hotelLoc));

        // Calculate day of week for opening hours fitting
        const dayDate = new Date(prefs.startDate);
        dayDate.setDate(dayDate.getDate() + dIdx);
        const dayOfWeek = dayDate.getDay();

        const optimizedDay = enforceMaxHopDistance(optimizeDayActivities(day.activities, prefs.pace, dayStart, dayOfWeek), 4.0);
        return {
          ...day,
          activities: optimizedDay
        };
      });

      setItinerary(sortedEnrichedItinerary);
      setMapItinerary(sortedEnrichedItinerary);
      // Ensure at least 10 suggestions are provided
      let finalSuggestions = [...generatedSuggestions];
      if (finalSuggestions.length < 10) {
        try {
          const existingNames = [
            ...finalSuggestions.map(s => s.name),
            ...sortedEnrichedItinerary.flatMap(d => d.activities).map(a => a.title)
          ];
          const extraSuggestions = await generateMoreSuggestions(
            mainLocation.place,
            existingNames,
            model
          );
          if (extraSuggestions.length > 0) {
            const existingSet = new Set(finalSuggestions.map(s => s.name.toLowerCase().trim()));
            for (const item of extraSuggestions) {
              const key = item.name.toLowerCase().trim();
              if (!existingSet.has(key)) {
                finalSuggestions.push(item);
                existingSet.add(key);
              }
            }
          }
        } catch (err) {
          console.warn("[Suggestions] Could not fetch additional suggestions:", err);
        }
      }

      // If still fewer than 10, backfill with curated fallback suggestions to unconditionally guarantee >= 10
      if (finalSuggestions.length < 10) {
        const fallbacks = getFallbackSuggestions(mainLocation.place);
        const existingSet = new Set(finalSuggestions.map(s => s.name.toLowerCase().trim()));
        for (const fb of fallbacks) {
          const key = fb.name.toLowerCase().trim();
          if (!existingSet.has(key)) {
            finalSuggestions.push(fb);
            existingSet.add(key);
            if (finalSuggestions.length >= 10) break;
          }
        }
      }
      setSuggestions(finalSuggestions);

      // Ensure at least 5 accommodations are provided
      let finalAccommodations = [...generatedAccommodations];
      if (finalAccommodations.length < 5) {
        try {
          // 1. First fetch real accommodations from Mapbox Search Box / Place API
          const realRecs = await fetchRecommendedAccommodations({
            locationName: mainLocation.place,
            coords: coords,
            limit: 8,
            countryName: mainLocation.country,
            existingNames: finalAccommodations.map(a => a.name),
          });
          if (realRecs.length > 0) {
            finalAccommodations = [...finalAccommodations, ...realRecs];
          }
        } catch (placeErr) {
          console.warn("[Accommodations] Place API recommendation error:", placeErr);
        }

        // 2. Fallback to LLM if still fewer than 5
        if (finalAccommodations.length < 5) {
          try {
            const extraAccommodations = await generateMoreAccommodations(
              mainLocation.place,
              finalAccommodations.map(a => a.name),
              model
            );
            finalAccommodations = [...finalAccommodations, ...extraAccommodations];
          } catch (err) {
            console.warn("[Accommodations] Could not fetch additional accommodations:", err);
          }
        }
      }
      setAccommodations(finalAccommodations);

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
        const existingSet = new Set(suggestions.map(s => s.name.toLowerCase().trim()));
        const uniqueNew = newSuggestions.filter(s => !existingSet.has(s.name.toLowerCase().trim()));
        setSuggestions(prev => [...prev, ...uniqueNew]);
        toast.success(language === "th" ? `เพิ่มสถานที่แนะนำใหม่ ${uniqueNew.length} แห่ง!` : `Added ${uniqueNew.length} new suggestions!`);
      } else {
        toast.info(language === "th" ? "ไม่พบสถานที่แนะนำใหม่เพิ่มเติม" : "No new suggestions found.");
      }
    } catch (error) {
      console.error("Failed to fetch new suggestions:", error);
      toast.error(language === "th" ? "ไม่สามารถโหลดสถานที่แนะนำใหม่ได้" : "Failed to fetch new suggestions");
    }
  }, [detectedLocations, suggestions, itinerary, model, language]);

  const handleRefreshAccommodations = useCallback(async () => {
    if (!detectedLocations.length) return;
    const locationName = detectedLocations[0].place;
    const existingPlaces = accommodations.map(a => a.name);
    const coords = detectedLocations[0].coordinates;

    setIsRefreshingAccommodations(true);
    try {
      // 1. Try Mapbox / Place API for fresh real accommodations first
      let newAccommodations = await fetchRecommendedAccommodations({
        locationName,
        coords,
        limit: 6,
        countryName: detectedLocations[0].country,
        existingNames: existingPlaces,
      });

      // 2. Fallback to LLM if Place API returned none
      if (newAccommodations.length === 0) {
        newAccommodations = await generateMoreAccommodations(locationName, existingPlaces, model);
      }

      if (newAccommodations.length > 0) {
        setAccommodations(prev => [...prev, ...newAccommodations]);
        toast.success("เพิ่มที่พักแนะนำใหม่เรียบร้อยแล้ว!");
      } else {
        toast.info("ไม่พบที่พักแนะนำเพิ่มเติมในขณะนี้");
      }
    } catch (error) {
      console.error("Failed to fetch new accommodations:", error);
      toast.error("เกิดข้อผิดพลาดในการค้นหาที่พักแนะนำ");
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
      const attrNameTh = (attraction as any).name_th || (attraction as any).title_th || (hasThaiScript(attraction.name) ? attraction.name : translateTextSync(attraction.name, "th"));
      const attrNameEn = (attraction as any).name_en || (attraction as any).title_en || attraction.english_name || (!hasThaiScript(attraction.name) ? attraction.name : translateTextSync(attraction.name, "en"));
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        time: "12:00",
        title: attraction.name,
        title_th: attrNameTh,
        title_en: attrNameEn,
        name_th: (attraction as any).name_th || attrNameTh,
        name_en: (attraction as any).name_en || attrNameEn,
        english_name: attraction.english_name || attrNameEn,
        description: `Visit ${attraction.name}`,
        description_th: `เยี่ยมชม ${attrNameTh}`,
        description_en: `Visit ${attrNameEn}`,
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
      setMapItinerary(updated);
      return;
    }

    // Case 1b: Dragging an AI suggestion into a day
    if (activeId.startsWith("suggestion-")) {
      const suggestionData = active.data.current as { type: string; place: SuggestedPlace } | undefined;
      if (!suggestionData) return;
      const targetDayIndex = resolveTargetDay(overId);
      if (targetDayIndex === -1) return;

      const place = suggestionData.place;
      const placeNameTh = place.name_th || (place as any).title_th || (hasThaiScript(place.name) ? place.name : translateTextSync(place.name, "th"));
      const placeNameEn = place.name_en || (place as any).title_en || place.english_name || (!hasThaiScript(place.name) ? place.name : translateTextSync(place.name, "en"));
      const placeDescTh = place.description_th || (hasThaiScript(place.description) ? place.description : translateTextSync(place.description, "th"));
      const placeDescEn = place.description_en || (!hasThaiScript(place.description) ? place.description : translateTextSync(place.description, "en"));

      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        time: "12:00",
        title: place.name,
        title_th: placeNameTh,
        title_en: placeNameEn,
        name_th: place.name_th || placeNameTh,
        name_en: place.name_en || placeNameEn,
        english_name: place.english_name || placeNameEn,
        description: place.description,
        description_th: placeDescTh,
        description_en: placeDescEn,
        type: place.category === "food" ? "food" : "attraction",
        image: place.image,
        image_url: place.image_url,
        photo_url: place.photo_url,
        lat: place.lat,
        lng: place.lng,
        rating: place.rating,
        userRatingsTotal: place.userRatingsTotal,
        openNow: place.openNow,
        openingHours: place.openingHours || getFallbackOpeningHours(place.category, place.name),
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
      setMapItinerary(updated);
      return;
    }

    // Case 1c: Dragging a hotel suggestion into a day
    if (activeId.startsWith("hotel-suggestion-")) {
      const hotelData = active.data.current as { type: string; place: SuggestedPlace } | undefined;
      if (!hotelData) return;
      const targetDayIndex = resolveTargetDay(overId);
      if (targetDayIndex === -1) return;

      const hotel = hotelData.place;
      const hotelNameTh = hotel.name_th || (hotel as any).title_th || (hasThaiScript(hotel.name) ? hotel.name : translateTextSync(hotel.name, "th"));
      const hotelNameEn = hotel.name_en || (hotel as any).title_en || hotel.english_name || (!hasThaiScript(hotel.name) ? hotel.name : translateTextSync(hotel.name, "en"));

      const checkInActivity: Activity = {
        id: `hotel-checkin-${Date.now()}-1`,
        time: "15:00",
        title: `Check in: ${hotel.name}`,
        title_th: `เช็คอิน: ${hotelNameTh}`,
        title_en: `Check in: ${hotelNameEn}`,
        name_th: hotel.name_th || hotelNameTh,
        name_en: hotel.name_en || hotelNameEn,
        english_name: hotel.english_name || hotelNameEn,
        description: `Check in to ${hotel.name}. Settle in and freshen up before starting your trip.`,
        description_th: `เช็คอินที่ ${hotelNameTh} พักผ่อนและเตรียมตัวก่อนเริ่มการเดินทาง`,
        description_en: `Check in to ${hotelNameEn}. Settle in and freshen up before starting your trip.`,
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
        title_th: `เช็คเอาต์: ${hotelNameTh}`,
        title_en: `Check out: ${hotelNameEn}`,
        name_th: hotel.name_th || hotelNameTh,
        name_en: hotel.name_en || hotelNameEn,
        english_name: hotel.english_name || hotelNameEn,
        description: `Check out from ${hotel.name}. Pack your bags and enjoy the rest of the day.`,
        description_th: `เช็คเอาต์จาก ${hotelNameTh} เก็บสัมภาระและเพลิดเพลินกับเวลาที่เหลือ`,
        description_en: `Check out from ${hotelNameEn}. Pack your bags and enjoy the rest of the day.`,
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
      setMapItinerary(updated);
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
      setMapItinerary(updated);
    }
  };

  const handleSelectActivity = useCallback(async (activity: Activity) => {
    setSelectedActivity({ ...activity });
    setHoveredActivityId(activity.id);

    if (activity.lat && activity.lng && activity.lat !== 0 && activity.lng !== 0) {
      setSelectedPlace({ lat: activity.lat, lng: activity.lng });
    } else {
      // 1. Fallback: Try to find matching attraction for coordinates
      const match = attractions.find(a => a.name.toLowerCase() === activity.title.toLowerCase());
      if (match && match.lat && match.lng) {
        activity.lat = match.lat;
        activity.lng = match.lng;
        setSelectedPlace({ lat: match.lat, lng: match.lng });
        setSelectedActivity({ ...activity, lat: match.lat, lng: match.lng });
      } else {
        // 2. Geocode on demand via fetchPlaceDetails if activity has no coords
        try {
          const details = await fetchPlaceDetails(activity.title);
          if (details && details.lat && details.lng) {
            const lat = details.lat;
            const lng = details.lng;
            activity.lat = lat;
            activity.lng = lng;
            setSelectedPlace({ lat, lng });
            setSelectedActivity({ ...activity, lat, lng });

            // Persist coordinates into itinerary and mapItinerary so pins update
            setItinerary(prev => prev.map(d => ({
              ...d,
              activities: d.activities.map(a => a.id === activity.id ? { ...a, lat, lng } : a)
            })));
            setMapItinerary(prev => prev.map(d => ({
              ...d,
              activities: d.activities.map(a => a.id === activity.id ? { ...a, lat, lng } : a)
            })));
          }
        } catch (err) {
          console.warn("[handleSelectActivity] Geocoding fallback error:", err);
        }
      }
    }
  }, [attractions]);

  // Resolve drag overlay content
  const handleAddSuggestion = useCallback((place: SuggestedPlace, dayIndex: number, time: string = "12:00") => {
    const placeNameTh = place.name_th || (place as any).title_th || (hasThaiScript(place.name) ? place.name : translateTextSync(place.name, "th"));
    const placeNameEn = place.name_en || (place as any).title_en || place.english_name || (!hasThaiScript(place.name) ? place.name : translateTextSync(place.name, "en"));
    const placeDescTh = place.description_th || (hasThaiScript(place.description) ? place.description : translateTextSync(place.description, "th"));
    const placeDescEn = place.description_en || (!hasThaiScript(place.description) ? place.description : translateTextSync(place.description, "en"));

    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      time,
      title: place.name,
      title_th: placeNameTh,
      title_en: placeNameEn,
      name_th: place.name_th || placeNameTh,
      name_en: place.name_en || placeNameEn,
      english_name: place.english_name || placeNameEn,
      description: place.description,
      description_th: placeDescTh,
      description_en: placeDescEn,
      type: place.category === "food" ? "food" : "attraction",
      image: place.image,
      image_url: place.image_url,
      photo_url: place.photo_url,
      lat: place.lat,
      lng: place.lng,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      openNow: place.openNow,
      openingHours: place.openingHours || getFallbackOpeningHours(place.category, place.name),
      priceLevel: place.priceLevel,
      website: place.website,
      phoneNumber: place.phoneNumber,
    };
    setItinerary((prev) => {
      const updated = prev.map((day, i) => {
        if (i === dayIndex) {
          const newActivities = [...day.activities, newActivity];
          return {
            ...day,
            activities: [...newActivities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
          };
        }
        return day;
      });
      setMapItinerary(updated);
      return updated;
    });
  }, []);

  const handleAddHotel = useCallback((
    hotel: SuggestedPlace,
    checkInDay: number,
    checkInTime: string = "15:00",
    checkOutDay: number,
    checkOutTime: string = "11:00"
  ) => {
    const hotelNameTh = hotel.name_th || (hotel as any).title_th || (hasThaiScript(hotel.name) ? hotel.name : translateTextSync(hotel.name, "th"));
    const hotelNameEn = hotel.name_en || (hotel as any).title_en || hotel.english_name || (!hasThaiScript(hotel.name) ? hotel.name : translateTextSync(hotel.name, "en"));

    const checkInActivity: Activity = {
      id: `hotel-checkin-${Date.now()}-1`,
      time: checkInTime,
      title: `Check in: ${hotel.name}`,
      title_th: `เช็คอิน: ${hotelNameTh}`,
      title_en: `Check in: ${hotelNameEn}`,
      name_th: hotel.name_th || hotelNameTh,
      name_en: hotel.name_en || hotelNameEn,
      english_name: hotel.english_name || hotelNameEn,
      description: `Check in to ${hotel.name}. Settle in and freshen up before starting your trip.`,
      description_th: `เช็คอินที่ ${hotelNameTh} พักผ่อนและเตรียมตัวก่อนเริ่มการเดินทาง`,
      description_en: `Check in to ${hotelNameEn}. Settle in and freshen up before starting your trip.`,
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
      title_th: `เช็คเอาต์: ${hotelNameTh}`,
      title_en: `Check out: ${hotelNameEn}`,
      name_th: hotel.name_th || hotelNameTh,
      name_en: hotel.name_en || hotelNameEn,
      english_name: hotel.english_name || hotelNameEn,
      description: `Check out from ${hotel.name}. Pack your bags and enjoy the rest of the day.`,
      description_th: `เช็คเอาต์จาก ${hotelNameTh} เก็บสัมภาระและเพลิดเพลินกับเวลาที่เหลือ`,
      description_en: `Check out from ${hotelNameEn}. Pack your bags and enjoy the rest of the day.`,
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
        let activities = day.activities.filter((a) => a.type !== "hotel");

        if (i === checkInDay) {
          activities.push(checkInActivity);
        }
        if (i === checkOutDay) {
          activities.push(checkOutActivity);
        }

        return {
          ...day,
          activities: activities.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
        };
      });
      setMapItinerary(updated);
      return updated;
    });

    setPreferences((prev) =>
      prev
        ? {
          ...prev,
          hasHotel: "yes",
          hotelName: hotel.name,
          hotelLat: hotel.lat,
          hotelLng: hotel.lng,
          hotelPhotoUrl: hotel.photo_url || hotel.image_url || null,
          hotelCheckInTime: checkInTime,
          hotelCheckOutTime: checkOutTime,
        }
        : null
    );

    setAccommodations((prev) => prev.filter((a) => a.id !== hotel.id));
    toast.success(`อัปเดตที่พักเป็น ${hotel.name} เรียบร้อยแล้ว`);
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

  const [isExportingHTML, setIsExportingHTML] = useState(false);

  // ─── HTML / Print Export (Dedicated A4 Document) ───────────────────────────

  /** Build Static Maps URL showing all day routes as coloured pins (Mapbox with Geoapify fallback) */
  const buildStaticMapUrl = (plans: DayPlan[], apiKey?: string): string => {
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
    const geoapifyKey = apiKey || (import.meta.env.VITE_GEOAPIFY_API_KEY as string);
    const hexColors = ["10b981", "3b82f6", "f59e0b", "ef4444", "8b5cf6", "06b6d4", "f43f5e"];
    const geoapifyColors = ["%2310b981", "%233b82f6", "%23f59e0b", "%23ef4444", "%238b5cf6", "%2306b6d4", "%23f43f5e"];

    // Strategy 1: Mapbox Static Images API (High visual fidelity)
    if (mapboxToken) {
      const mbMarkers: string[] = [];
      plans.forEach((day, di) => {
        const color = hexColors[di % hexColors.length];
        day.activities.forEach((act, ai) => {
          if (!act.lat || !act.lng) return;
          const pinLabel = (ai + 1) <= 99 ? `${ai + 1}` : "";
          mbMarkers.push(`pin-s-${pinLabel}+${color}(${act.lng.toFixed(5)},${act.lat.toFixed(5)})`);
        });
      });
      if (mbMarkers.length > 0) {
        const markerParam = mbMarkers.slice(0, 25).join(",");
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markerParam}/auto/800x400?padding=40&access_token=${mapboxToken}`;
      }
    }

    // Strategy 2: Geoapify Static Maps (Fallback)
    if (geoapifyKey) {
      const allCoords: { lat: number; lng: number }[] = [];
      const markers: string[] = [];
      plans.forEach((day, di) => {
        const color = geoapifyColors[di % geoapifyColors.length];
        day.activities.forEach((act, ai) => {
          if (!act.lat || !act.lng) return;
          allCoords.push({ lat: act.lat, lng: act.lng });
          markers.push(`lonlat:${act.lng},${act.lat};color:${color};text:${ai + 1}`);
        });
      });

      if (allCoords.length > 0) {
        const markerParam = markers.slice(0, 20).join("|");
        return `https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&width=800&height=400&marker=${markerParam}&apiKey=${geoapifyKey}`;
      }
    }

    return "";
  };

  const exportToHTML = async () => {
    if (isExportingHTML) return;
    setIsExportingHTML(true);
    toast.info(language === "th" ? "กำลังสร้างไฟล์ HTML..." : "Generating HTML itinerary...");

    try {
      const [{ normalizeExportTrip }, { generateItineraryHtml }] = await Promise.all([
        import("@/lib/export/normalizeExportTrip"),
        import("@/lib/export/generateItineraryHtml"),
      ]);

      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY ?? "";
      const staticMapUrl = buildStaticMapUrl(itinerary, apiKey);

      const cityFromVision =
        (language === "th" ? detectedLocations[0]?.city_th : detectedLocations[0]?.city_en) ||
        detectedLocations[0]?.city;

      const destinationName =
        preferences?.destination ||
        cityFromVision ||
        locPlace(detectedLocations[0]) ||
        "Trip";

      const landmarkName = locPlace(detectedLocations[0]);
      const subtitle =
        landmarkName && landmarkName !== destinationName
          ? landmarkName
          : (language === "th" ? "แผนการท่องเที่ยวอันน่าประทับใจ" : "Heritage & soul");

      const exportTrip = normalizeExportTrip({
        itinerary,
        destination: destinationName,
        subtitle,
        tripStartDate,
        language,
        cityName: destinationName,
        staticMapUrl,
      });

      const htmlContent = generateItineraryHtml(exportTrip, { language });

      // Save data for browser preview route too
      window.__EXPORT_TRIP_DATA__ = {
        itinerary,
        destination: destinationName,
        tripStartDate: tripStartDate ? tripStartDate.toISOString() : undefined,
        language,
        cityName: detectedLocations[0]?.place || preferences?.destination,
        staticMapUrl,
      };

      // Trigger download of standalone HTML file
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeFilename = destinationName
        .toLowerCase()
        .replace(/[^a-z0-9_\u0E00-\u0E7F]/gi, "_");
      a.href = url;
      a.download = `${safeFilename || "travel"}_itinerary.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        language === "th"
          ? "ส่งออก HTML สำเร็จ! เปิดไฟล์เพื่อดูหรือสั่งพิมพ์ PDF ได้ทันที"
          : "HTML exported successfully! Open file to view or print as PDF."
      );
    } catch (err) {
      console.error("HTML export failed:", err);
      toast.error(
        language === "th"
          ? "ส่งออก HTML ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
          : "Failed to export HTML. Please try again."
      );
    } finally {
      setIsExportingHTML(false);
    }
  };


  return (
    <div className="dot-grid-bg min-h-screen pb-24 text-foreground selection:bg-sky-500/20">
      {/* Subtle ambient light */}
      <div className="fixed -top-40 -left-40 size-96 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 size-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Floating Frosted Top Navigation Bar */}
      <div className={`sticky top-4 z-40 mx-auto transition-all duration-300 ${step >= 3 ? "w-[90%] max-w-[2560px]" : "w-[96%] lg:w-[80%] max-w-[1920px]"} px-2 sm:px-4`}>
        <nav className="glass-strong flex items-center justify-between gap-2 rounded-full px-3 py-2 shadow-xs sm:px-5">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 group-hover:scale-105 transition-transform shadow-2xs">
                <Plane className="size-4" />
              </div>
              <span className="hidden text-base font-bold tracking-tight sm:inline text-foreground">pixinerary</span>
            </Link>

            {/* Blind Evaluation Link: dev and expert */}
            {(role === "dev" || role === "expert") && (
              <Link
                to="/blind-eval"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
              >
                <ShieldCheck className="size-3 text-purple-600" />
                <span>Blind Evaluation</span>
              </Link>
            )}

            {/* Console Link: dev only */}
            {role === "dev" && (
              <Link
                to="/experiment"
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Beaker className="size-3 text-sky-500" />
                <span>Console</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* AI Model Selector */}
            <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
              <SelectTrigger className="h-8 rounded-full border-border/70 bg-secondary/60 px-3 text-xs font-medium shadow-none [&>svg]:size-3.5 gap-1.5 min-w-[130px] sm:min-w-[155px]">
                <Sparkles className="size-3.5 text-sky-500 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border/80 shadow-xl bg-popover backdrop-blur-xl">
                {AI_MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <img src={opt.icon} className="size-4 rounded-full object-cover shrink-0 bg-muted" alt="" />
                      <span className="font-semibold text-foreground text-xs">{opt.label}</span>
                      <span className="text-muted-foreground text-[10px]">· {opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Language Switcher Toggle */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="h-8 rounded-full px-2.5 text-xs font-semibold gap-1.5 text-foreground hover:bg-secondary border border-border/50 transition-colors"
              title={language === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
              aria-label="Toggle language"
            >
              <Languages className="size-3.5 text-sky-500 shrink-0" />
              <span className="font-bold tracking-wider">{language === "th" ? "TH" : "EN"}</span>
            </Button>

            {/* My Trips Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSavedTripsModalOpen(true)}
              className="h-8 rounded-full px-3 text-xs font-semibold gap-1 text-foreground hover:bg-secondary"
              title={language === "th" ? "ดูประวัติทริปที่บันทึกไว้" : "View Saved Trips"}
            >
              <Compass className="size-3.5" />
              <span className="hidden sm:inline">{language === "th" ? "ทริปของฉัน" : "My Trips"}</span>
            </Button>

            {/* User Session / Sign in */}
            <UserMenu />
          </div>
        </nav>
      </div>

      {/* Main Content Area (90% width with 5% margins left & right on Itinerary, 80% on earlier steps) */}
      <main className={`mx-auto transition-all duration-300 ${step >= 3 ? "w-[90%] max-w-[2560px]" : "w-[96%] lg:w-[80%] max-w-[1920px]"} px-2 sm:px-4 pt-6 pb-20`}>
        {/* Step Indicator */}
        <StepIndicator
          currentStep={step}
          maxUnlockedStep={maxUnlockedStep}
          onStepClick={(s) => {
            if (s === 0) {
              setStep(0);
            } else if (s === 1 && detectedLocations.length > 0) {
              setStep(1);
            } else if (s === 2 && detectedLocations.length > 0) {
              setStep(2);
            } else if (s === 3) {
              if (maxUnlockedStep >= 3 || (itinerary && itinerary.length > 0 && preferences)) {
                setStep(3);
              } else {
                toast.info("กรุณากรอกข้อมูล Preferences และกดสร้างแผนการท่องเที่ยวก่อนครับ");
              }
            }
          }}
        />



        {/* Animated Loading Overlay */}
        {isAnalyzing && (
          <section className="mb-12 animate-in fade-in duration-300">
            <AnalyzingOverlay
              isAnalyzing={isAnalyzing}
              loadingStep={loadingStep}
              useClip={useClip}
              type={overlayType}
            />
          </section>
        )}

        {/* ── STEP 0: Upload & First Impression (Pixinerary) ── */}
        {step === 0 && !isAnalyzing && (
          <section className="animate-in fade-in mx-auto flex max-w-2xl flex-col gap-6 duration-500 mb-12">
            <ImageUpload
              onImagesUploaded={handleImagesUploaded}
              isAnalyzing={isAnalyzing}
              loadingLabel={loadingStep}
            />

            {/* Advanced Settings Collapsible for CLIP toggle */}
            <div className="rounded-2xl border border-border/70 bg-secondary/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(prev => !prev)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-secondary/70 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                  {language === "th" ? "การตั้งค่า AI ขั้นสูง (การให้คะแนนความแม่นยำด้วย CLIP)" : "Advanced AI settings (Visual CLIP scoring)"}
                </span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
              </button>

              {showAdvancedSettings && (
                <div className="px-4 pb-4 pt-1 border-t border-border/40 flex items-center justify-between gap-2 animate-in fade-in">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {language === "th" ? "การให้คะแนนความมั่นใจทางภาพ (CLIP)" : "Visual confidence scoring (CLIP)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {language === "th" ? "ใช้โมเดล CLIP ช่วยจัดอันดับความเหมือนของรูปภาพสถานที่ท่องเที่ยว" : "Uses the CLIP vision model to rank landmarks by visual similarity."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      id="clip-toggle"
                      checked={useClip}
                      onCheckedChange={setUseClip}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {useClip ? (language === "th" ? "เปิด (ช้ากว่า)" : "On (slower)") : (language === "th" ? "ปิด (เร็วกว่า)" : "Off (faster)")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── STEP 1: Identified Locations (Pixinerary_2) ── */}
        {(detectedLocations.length > 0 || outliers.length > 0) && step === 1 && !isAnalyzing && (
          <section className="animate-in fade-in mx-auto flex max-w-3xl flex-col gap-6 duration-500 mb-12">
            <LocationDisplay
              locations={detectedLocations}
              outliers={outliers}
              useClip={useClip}
              outliersCount={outliers.length}
              onOpenOutliersReport={() => setIsOutlierModalOpen(true)}
              onRemoveLocation={handleRemoveLocation}
              onSwitchCandidate={handleSwitchCandidateFromLocation}
              onUploadNewPhotos={() => setStep(0)}
              onFilesUploaded={handleImagesUploaded}
            />

            {/* Navigation Actions */}
            <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(0)}
                className="rounded-xl border-border bg-background hover:bg-muted font-medium text-xs h-8 px-3 gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                <span>{language === "th" ? "อัปโหลดภาพใหม่" : "Upload new photos"}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={detectedLocations.length === 0}
                onClick={() => {
                  if (detectedLocations.length === 0) {
                    toast.info(language === "th" ? "กรุณากู้คืนหรือระบุสถานที่อย่างน้อย 1 แห่งก่อนดำเนินการต่อครับ" : "Please restore or identify at least 1 location before continuing");
                    return;
                  }
                  setStep(2);
                  setMaxUnlockedStep(prev => Math.max(prev, 2));
                  window.scrollTo({ top: 100, behavior: "smooth" });
                }}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs h-8 px-3 gap-1.5 shadow-xs disabled:opacity-50"
              >
                <span>{language === "th" ? "ไปยังขั้นตอนความต้องการเดินทาง" : "Continue to preferences"}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </section>
        )}

        {/* ── STEP 2: Trip Preferences (Pixinerary_33) ── */}
        {(detectedLocations.length > 0 || preferences !== null || maxUnlockedStep >= 2) && step === 2 && !isAnalyzing && (
          <section className="animate-in fade-in mx-auto flex max-w-2xl flex-col gap-6 duration-500 mb-12">
            {/* Destination Header Banner */}
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-bold">
                  📍
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight text-foreground">
                    {language === "th"
                      ? `วางแผนเที่ยว ${detectedLocations[0]?.place_th || detectedLocations[0]?.place || "จุดหมายปลายทาง"}, ${detectedLocations[0]?.country_th || detectedLocations[0]?.country}`
                      : `Planning for ${detectedLocations[0]?.place_en || detectedLocations[0]?.place || "Destination"}, ${detectedLocations[0]?.country_en || detectedLocations[0]?.country}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "th"
                      ? `บอกเราว่าคุณชอบท่องเที่ยวสไตล์ไหน (ระบุได้แล้ว ${detectedLocations.length} สถานที่)`
                      : `Tell us how you like to travel (${detectedLocations.length} places identified)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {maxUnlockedStep >= 3 && itinerary.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(3)}
                    className="rounded-xl border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs h-7 px-2.5 gap-1 shadow-2xs"
                  >
                    <Compass className="size-3.5" />
                    <span>{language === "th" ? "ดูแผนปัจจุบัน" : "View Itinerary"}</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="rounded-xl border-border bg-background hover:bg-muted font-medium text-xs h-7 px-2.5 gap-1"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>{language === "th" ? "ย้อนกลับ" : "Back"}</span>
                </Button>
              </div>
            </div>

            {/* Preferences Form */}
            <TripPreferencesForm
              key={`pref-form-${preferences ? `${preferences.days}-${preferences.travelerType}-${preferences.budget}-${(preferences.activities || []).join("-")}` : "new"}`}
              onSubmit={handlePreferencesSubmit}
              destinationName={detectedLocations[0]?.place}
              destinationCoords={detectedLocations[0]?.coordinates}
              onBack={() => setStep(1)}
              initialPreferences={preferences}
              hasExistingItinerary={maxUnlockedStep >= 3 && itinerary.length > 0}
              onViewExistingItinerary={() => setStep(3)}
            />

          </section>
        )}


        {/* Vision Outlier Modal */}
        <VisionOutlierModal
          open={isOutlierModalOpen}
          onOpenChange={setIsOutlierModalOpen}
          outliers={outliers}
          keptLocations={detectedLocations}
          onRestoreLocation={handleRestoreLocation}
          onDiscardOutlier={handleDiscardOutlier}
          onDiscardAllNonTravel={handleDiscardAllNonTravel}
          onManualOverridePlace={handleManualOverridePlace}
          onSwitchCandidate={handleSwitchCandidateFromOutlier}
        />

        {/* ── STEP 3: Itinerary Dashboard (Pixinerary_4) ── */}
        {step >= 3 && detectedLocations.length > 0 && !isAnalyzing && (
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="animate-in fade-in flex flex-col gap-6 duration-500 mb-12">
              {/* Top Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/40 p-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMaxUnlockedStep(prev => Math.max(prev, 3));
                      setStep(2);
                    }}
                    className="rounded-xl border-border bg-background hover:bg-muted font-medium text-xs h-7 px-2.5 gap-1"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>{language === "th" ? "แก้ไขความต้องการ" : "Edit preferences"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="rounded-xl text-muted-foreground hover:text-foreground font-medium text-xs h-7 px-2.5 gap-1"
                  >
                    <Eye className="size-3.5" />
                    <span>{language === "th" ? `ดูภาพถ่าย (${detectedLocations.length})` : `View photos (${detectedLocations.length})`}</span>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const currentModelKey = preferences?.aiModel || preferences?.ai_model || model;
                    const modelInfo = getAIModelInfo(currentModelKey);
                    if (!modelInfo) return null;
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <Sparkles className="size-3.5" />
                        <span>AI: {modelInfo.label}</span>
                      </span>
                    );
                  })()}

                  {currentTripTitle && (
                    <h2 className="hidden text-sm font-bold tracking-tight text-foreground md:inline">
                      📍 {currentTripTitle}
                    </h2>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportToHTML}
                    disabled={isExportingHTML}
                    className="rounded-xl border-border bg-background hover:bg-muted font-medium text-xs h-7 px-2.5 gap-1 shadow-2xs cursor-pointer"
                    title={language === "th" ? "ส่งออกแผนการเดินทางเป็นไฟล์ HTML (สามารถสั่งพิมพ์ PDF ได้)" : "Export itinerary as HTML file (Print-ready PDF)"}
                  >
                    {isExportingHTML ? (
                      <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileDown className="size-3.5" />
                    )}
                    <span>{language === "th" ? "ส่งออก HTML" : "Export HTML"}</span>
                  </Button>

                  {/* Save to Blind Eval Button (Visible only to dev when itinerary exists) */}
                  {role === "dev" && itinerary && itinerary.length > 0 && itinerary[0].activities?.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setBlindScenarioTitle(currentTripTitle || "");
                        setBlindSaveModalOpen(true);
                      }}
                      className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-7 px-2.5 gap-1 shadow-2xs cursor-pointer"
                      title="บันทึกแผนนี้เข้าสู่คลัง Blind Evaluation สำหรับผู้เชี่ยวชาญประเมิน"
                    >
                      <ShieldCheck className="size-3.5" />
                      <span>Save to Blind Eval</span>
                    </Button>
                  )}

                  {/* Auto-Save Live Status Badge */}
                  {lastAutoSavedAt && (
                    <span
                      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/80 border border-border/70 text-[11px] text-muted-foreground font-medium"
                      title={language === "th" ? "ระบบบันทึกความคืบหน้าของทริปลงฐานข้อมูลอัตโนมัติทุก 1 นาที" : "Trip progress is automatically saved every minute"}
                    >
                      {isAutoSaving ? (
                        <>
                          <Loader2 className="size-3 animate-spin text-primary" />
                          <span>{language === "th" ? "กำลังบันทึกอัตโนมัติ..." : "Auto-saving..."}</span>
                        </>
                      ) : (
                        <>
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>
                            {language === "th" ? "บันทึกอัตโนมัติแล้ว" : "Auto-saved"} (
                            {lastAutoSavedAt.toLocaleTimeString(language === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" })})
                          </span>
                        </>
                      )}
                    </span>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveCurrentTrip(false)}
                    disabled={isSavingTrip}
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs h-7 px-2.5 gap-1 shadow-2xs"
                  >
                    {isSavingTrip ? (
                      <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Bookmark className="size-3.5" />
                    )}
                    <span>{currentTripId ? (language === "th" ? "อัปเดตการบันทึก" : "Update Trip") : (language === "th" ? "บันทึกทริป" : "Save trip")}</span>
                  </Button>
                </div>
              </div>


              {/* 2-Column Responsive Dashboard (7:5 ratio for expansive map and timeline) */}
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Left Column (7/12 on lg & xl): Itinerary Timeline */}
                <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-7">
                  <TravelItinerary
                    itinerary={itinerary}
                    onUpdate={(newItinerary) => {
                      setItinerary(newItinerary);
                      setMapItinerary(newItinerary);
                    }}
                    activeDragId={activeDragId}
                    onSelectActivity={handleSelectActivity}
                    selectedActivityId={selectedActivity?.id}
                    onHoverActivity={setHoveredActivityId}
                    onReloadMap={() => setMapItinerary(itinerary)}
                    suggestions={suggestions}
                    tripStartDate={tripStartDate ?? undefined}
                    hourlyWeather={environmentData?.hourly ?? []}
                    coherenceResult={coherenceResult}
                    destinationName={detectedLocations[0]?.place || preferences?.destination}
                    cityName={detectedLocations[0]?.place || preferences?.destination}
                    onAIRefine={handleAIRefineItinerary}
                    isAIRefining={isAIRefining}
                    onOptimizeDay={handleOptimizeDay}
                    isOptimizingDay={optimizingDayIndex}
                  />

                </div>

                {/* Right Column (5/12 on lg & xl, Sticky): Interactive Map & Live Weather */}
                <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-5 2xl:col-span-5 lg:sticky lg:top-20 lg:self-start">
                  {(() => {
                    const effectiveCoords = selectedPlace
                      || (detectedLocations[0]?.lat && detectedLocations[0]?.lng ? { lat: detectedLocations[0].lat, lng: detectedLocations[0].lng } : null)
                      || (itinerary[0]?.activities?.find(a => a.lat && a.lng) ? { lat: itinerary[0].activities.find(a => a.lat && a.lng)!.lat!, lng: itinerary[0].activities.find(a => a.lat && a.lng)!.lng! } : null)
                      || { lat: 13.7563, lng: 100.5018 };
                    const effectivePlaceName = detectedLocations[0]?.place || preferences?.destination || "Destination";
                    const effectiveCountry = detectedLocations[0]?.country || "";
                    const effectiveType = detectedLocations[0]?.type || "City";

                    return (
                      <>
                        {/* Map Section */}
                        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xs">
                          <MapSection
                            location={{
                              name: effectivePlaceName,
                              country: effectiveCountry,
                              type: effectiveType,
                              coordinates: effectiveCoords,
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
                            selectedActivity={selectedActivity}
                            selectedPlace={selectedPlace}
                            hoveredActivityId={hoveredActivityId}
                            onSelectActivity={(act) => {
                              setSelectedActivity(act);
                              setHoveredActivityId(act.id);
                            }}
                          />
                        </div>

                        {/* Weather Widget */}
                        <div className="rounded-3xl border border-border/70 bg-card shadow-xs overflow-hidden">
                          <WeatherWidget
                            lat={effectiveCoords.lat}
                            lng={effectiveCoords.lng}
                            locationName={effectivePlaceName}
                            tripStartDate={tripStartDate ?? undefined}
                            typicalWeather={typicalWeather ?? undefined}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Discovery & Logistics Tabs */}
              <div className="mt-4">
                <Tabs defaultValue="places" className="w-full">
                  <TabsList className="w-full justify-start rounded-full bg-secondary/60 p-1 mb-4">
                    <TabsTrigger value="places" className="rounded-full flex-1 text-xs sm:text-sm font-medium">
                      📍 {language === "th" ? "สถานที่แนะนำเพิ่มเติม" : "Suggested Places"}
                    </TabsTrigger>
                    <TabsTrigger value="hotels" className="rounded-full flex-1 text-xs sm:text-sm font-medium">
                      🏨 {language === "th" ? "ที่พัก & โรงแรม" : "Stays & Hotels"}
                    </TabsTrigger>
                    <TabsTrigger value="flights" className="rounded-full flex-1 text-xs sm:text-sm font-medium">
                      ✈️ {language === "th" ? "เที่ยวบิน & การเดินทาง" : "Flight Logistics"}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="places" className="mt-0 animate-in fade-in">
                    <AISuggestedPlaces
                      onAddToItinerary={handleAddSuggestion}
                      locationName={detectedLocations[0].place}
                      suggestions={suggestions}
                      onRefreshSuggestions={handleRefreshSuggestions}
                      daysCount={itinerary.length}
                    />
                  </TabsContent>

                  <TabsContent value="hotels" className="mt-0 animate-in fade-in">
                    <AIAccommodations
                      accommodations={accommodations}
                      onAddToItinerary={handleAddHotel}
                      locationName={detectedLocations[0].place}
                      destinationCoords={detectedLocations[0]?.coordinates}
                      daysCount={itinerary.length}
                      onRefreshAccommodations={handleRefreshAccommodations}
                      isRefreshing={isRefreshingAccommodations}
                      tripStartDate={tripStartDate ?? undefined}
                      hasHotelFromPreferences={preferences?.hasHotel === "yes" && !!preferences?.hotelName}
                      selectedHotelName={preferences?.hotelName}
                    />
                  </TabsContent>

                  <TabsContent value="flights" className="mt-0 animate-in fade-in">
                    {preferences && (
                      <FlightInfoDashboard
                        preferences={preferences}
                        destinationIata={destinationIata}
                        destinationName={`${detectedLocations[0].place}, ${detectedLocations[0].country}`}
                        onUpdatePreferences={(updated) => setPreferences(prev => prev ? { ...prev, ...updated } : null)}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                {getOverlayContent()}
              </DragOverlay>
            </section>
          </DndContext>
        )}
      </main>

      {/* Floating AI ChatBot (Reserved exclusively for bottom right) */}
      {step >= 3 && detectedLocations.length > 0 && !isAnalyzing && (
        <ChatBot
          locationName={locPlace(detectedLocations[0]) || "Destination"}
          itinerary={itinerary}
          onUpdateItinerary={(newItinerary) => {
            setItinerary(newItinerary);
            setMapItinerary(newItinerary);
          }}
          preferences={preferences}
          onUpdatePreferences={(updatedPrefs) => {
            setPreferences((prev) => (prev ? { ...prev, ...updatedPrefs } : null));
            toast.success(language === "en" ? "Travel preferences updated" : "อัปเดตความต้องการเดินทางสำเร็จ");
          }}
          onUpdateHotel={(hotelName) => {
            setPreferences((prev) => (prev ? { ...prev, hasHotel: "yes", hotelName } : null));
            toast.success(language === "en" ? `Switched hotel to: ${hotelName}` : `สลับโรงแรมเป็น: ${hotelName}`);
          }}
          onUpdateFlight={(flightCode) => {
            setPreferences((prev) => (prev ? { ...prev, hasFlight: "yes", flightCode } : null));
            toast.success(language === "en" ? `Flight ${flightCode} updated! Have a safe and pleasant journey ✨✈️` : `อัปเดตเที่ยวบิน ${flightCode} เรียบร้อยแล้ว ขอให้ถึงที่หมายโดยสวัสดิภาพ ✨✈️`);
          }}
          messages={chatMessages}
          onUpdateMessages={setChatMessages}
        />
      )}

      {/* Saved Trips & Chat History Modal */}
      <SavedTripsModal
        isOpen={isSavedTripsModalOpen}
        onClose={() => setIsSavedTripsModalOpen(false)}
        onSelectTrip={handleSelectTrip}
        onNewTrip={handleNewTrip}
        currentTripId={currentTripId}
      />

      {/* Vision Outlier Modal */}
      <VisionOutlierModal
        open={isOutlierModalOpen}
        onOpenChange={setIsOutlierModalOpen}
        outliers={outliers}
        keptLocations={detectedLocations}
        onRestoreLocation={handleRestoreLocation}
        onDiscardOutlier={handleDiscardOutlier}
        onDiscardAllNonTravel={handleDiscardAllNonTravel}
        onSwitchCandidate={handleSwitchCandidateFromOutlier}
        onManualOverridePlace={handleManualOverridePlace}
        onReplaceOutlierPhoto={handleReplaceOutlierPhoto}
        onConfirmProceed={() => {
          setIsOutlierModalOpen(false);
          if (detectedLocations.length > 0 && step === 1) {
            setStep(2);
            setMaxUnlockedStep(prev => Math.max(prev, 2));
            window.scrollTo({ top: 100, behavior: "smooth" });
          }
        }}
      />

      {/* Dialog for Saving Trip to Blind Evaluation */}
      <Dialog open={blindSaveModalOpen} onOpenChange={setBlindSaveModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-background border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <ShieldCheck className="size-5 text-purple-600" />
              บันทึกแผนเข้าสู่ Blind Evaluation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              แผนนี้จะถูกนำไปเก็บไว้ในคลังประเมิน โดยระบบจะทำการซ่อนชื่อโมเดล (
              <strong className="text-foreground">{model}</strong>) และแปลงเป็นรหัสสุ่ม (เช่น แผน A, แผน B) เพื่อให้ผู้เชี่ยวชาญประเมินโดยปราศจากอคติ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="scenarioId" className="text-xs font-semibold">
                รหัสโจทย์ (Scenario ID) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scenarioId"
                value={blindScenarioId}
                onChange={(e) => setBlindScenarioId(e.target.value)}
                placeholder="e.g. SC-01"
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                ระบุ ID เดียวกันสำหรับแผนที่สร้างด้วยโจทย์เดียวกัน เพื่อให้ผู้เชี่ยวชาญเปรียบเทียบใน Scenario เดียวกันได้
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scenarioTitle" className="text-xs font-semibold">
                ชื่อโจทย์การเดินทาง (Scenario Title)
              </Label>
              <Input
                id="scenarioTitle"
                value={blindScenarioTitle}
                onChange={(e) => setBlindScenarioTitle(e.target.value)}
                placeholder="e.g. กรุงเทพมหานคร 3 วัน (Solo / Budget / Culture)"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scenarioNotes" className="text-xs font-semibold">
                เงื่อนไขหรือหมายเหตุโจทย์ (Optional Notes)
              </Label>
              <Input
                id="scenarioNotes"
                value={blindScenarioNotes}
                onChange={(e) => setBlindScenarioNotes(e.target.value)}
                placeholder="e.g. เดินทางช่วงเช้า เน้นของกินเยาวราชและวัดพระแก้ว"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">โมเดลที่ใช้สร้างจริง (Actual Model):</span>
                <span className="font-semibold font-mono text-purple-600">{model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">จำนวนวันในแผน:</span>
                <span className="font-semibold">{itinerary?.length || 0} วัน</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBlindSaveModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingBlindTrip || !blindScenarioId.trim()}
              onClick={handleSaveToBlindEval}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 gap-1.5"
            >
              <Check className="size-3.5" />
              <span>{isSavingBlindTrip ? "กำลังบันทึก..." : "ยืนยันบันทึก"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground mt-12">
        <p>Pixinerary — AI-Powered Image-Based Travel Planner • Research Project</p>
      </footer>
    </div>
  );
};


export default Index;
