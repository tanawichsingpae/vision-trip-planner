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
} from "lucide-react";

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
import { getNearbyAttractions, fetchPlaceDetails, fetchPlaceDetailsByPlaceId } from "@/api/places";
import { gatherCandidatePOIs, kMeansCluster, sequenceDayClusters, solveGreedyTSP, scorePOIs, selectDiversePOIs, calculateCoherenceScore, optimizeDayActivities, rebalanceCrossDayPOIs, auditItineraryIssues, type DayCluster, type ItineraryCoherence } from "@/api/spatialPlanner";
import { generateTravelPlan, refineItineraryWithAI, generateMoreSuggestions, generateMoreAccommodations, analyzeImage, type VisionResult, type TypicalWeather, type TripPreferences } from "@/services/aiService";

import { getEnvironmentData, type EnvironmentData } from "@/services/environmentService";
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
      const score = calculateCoherenceScore(itinerary, pace, tripStartDate ?? undefined);
      setCoherenceResult(score);
    }
  }, [itinerary, preferences?.pace, tripStartDate]);

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
      toast.info(`ตัดสถานที่ "${outlier.place}" ออกจากรายการแล้ว`);
    }
  }, [outliers]);

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
      const auditReport = auditItineraryIssues(itinerary, currentPace, tripStartDate ?? undefined);

      const prefsWithModel: TripPreferences = preferences || {
        days: itinerary.length,
        pace: currentPace,
        travelerType: "Solo",
        budget: "Medium",
        activities: ["Sightseeing", "Food"],
        startDate: tripStartDate || new Date(),
        endDate: tripStartDate || new Date(),
      };

      const refined = await refineItineraryWithAI(
        itinerary,
        auditReport.warnings,
        prefsWithModel,
        model
      );

      // Re-apply 2-Opt TSP & hours fitting
      const hotelLoc = prefsWithModel.hasHotel === "yes" && prefsWithModel.hotelLat && prefsWithModel.hotelLng
        ? { lat: prefsWithModel.hotelLat, lng: prefsWithModel.hotelLng }
        : (selectedPlace || { lat: 13.7563, lng: 100.5018 });

      const rebalanced = rebalanceCrossDayPOIs(refined);
      const optimized = rebalanced.map((day, dIdx) => {
        const prevDayLastAct = dIdx > 0 ? rebalanced[dIdx - 1]?.activities.slice(-1)[0] : undefined;
        const dayStart = (prefsWithModel.hasHotel === "yes" && prefsWithModel.hotelLat && prefsWithModel.hotelLng)
          ? hotelLoc
          : (dIdx === 0
            ? hotelLoc
            : (prevDayLastAct?.lat && prevDayLastAct?.lng ? { lat: prevDayLastAct.lat, lng: prevDayLastAct.lng } : hotelLoc));

        const dayDate = new Date(tripStartDate || new Date());
        dayDate.setDate(dayDate.getDate() + dIdx);
        const dayOfWeek = dayDate.getDay();

        const optActivities = optimizeDayActivities(day.activities, currentPace, dayStart, dayOfWeek);
        return {
          ...day,
          activities: [...optActivities].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00")),
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
  }, [itinerary, preferences, tripStartDate, model, selectedPlace]);


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
            const coords = await getCoordinates(r.place, undefined, r.country);
            return { ...r, lat: coords.lat, lng: coords.lng };
          } catch {
            return r;
          }
        })
      );

      setLoadingStep("Filtering & Checking Outliers...");
      // Filter outliers (country mismatch, distance > 70 km, low confidence, non-travel, duplicates)
      const { kept, outliers: detectedOutliers } = detectVisionOutliers(geoResults, useClip, 70, 35);

      setDetectedLocations(kept);
      setOutliers(detectedOutliers);
      setIsAnalyzing(false);
      setStep(1);
      setMaxUnlockedStep(prev => Math.max(prev, 1));

      if (detectedOutliers.length > 0) {
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
      const mainLocationStr = `${mainLocation.place}, ${mainLocation.country}`;
      const coords = await getCoordinates(mainLocationStr);
      setSelectedPlace(coords);

      // Step 1b: Spatial Candidate Gathering, K-Means Clustering, Macro-TSP Sequencing & Greedy TSP
      setLoadingStep("Gathering Places & Spatial Clustering...");
      const locationNames = detectedLocations.map(l => l.place);
      let dayClusters: DayCluster[] = [];

      try {
        const candidatePois = await gatherCandidatePOIs(mainLocation.place, coords, locationNames, prefsWithModel.activities);
        if (candidatePois.length > 0) {
          const scoredPois = scorePOIs(candidatePois, coords, prefsWithModel.activities);
          const diversePois = selectDiversePOIs(scoredPois, Math.max(20, prefsWithModel.days * 5));
          const rawClusters = kMeansCluster(diversePois, prefsWithModel.days);

          // Macro-Cluster Sequencing: Sequence clusters 1..K in a contiguous progression from start location
          const startLocation = prefsWithModel.hasHotel === "yes" && prefsWithModel.hotelLat && prefsWithModel.hotelLng
            ? { lat: prefsWithModel.hotelLat, lng: prefsWithModel.hotelLng }
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
        await generateTravelPlan(locationNames, prefsWithModel, model, dayClusters);

      // Step 2a: AI Self-Review & Refinement Loop (Critic-Actor Quality Gate)
      let workingItinerary = generatedItinerary;
      try {
        const auditReport = auditItineraryIssues(generatedItinerary, prefsWithModel.pace, prefsWithModel.startDate);
        if (auditReport.warnings.length > 0 || auditReport.score < 88) {
          setLoadingStep("AI Self-Reviewing & Refining Itinerary Flow...");
          console.log("[AISelfReview] Detected draft issues, auto-refining with AI:", auditReport.warnings);
          const refined = await refineItineraryWithAI(
            generatedItinerary,
            auditReport.warnings,
            prefsWithModel,
            model
          );
          if (refined && refined.length > 0) {
            workingItinerary = refined;
            console.log("[AISelfReview] Refined itinerary successfully applied");
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

      for (let dayIndex = 0; dayIndex < workingItinerary.length; dayIndex++) {
        const day = workingItinerary[dayIndex];
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
            const activityDetails = await geocodeWithValidation(activity.title);
            enrichedActivities.push({
              ...activity,
              lat: activityDetails.lat,
              lng: activityDetails.lng,
              photo_url: activity.photo_url || activityDetails.photoUrl || null,
              image_url: activity.image_url || activityDetails.photoUrl || null,
              rating: activity.rating || activityDetails.rating || undefined,
              userRatingsTotal: activity.userRatingsTotal || activityDetails.userRatingsTotal || undefined,
            });
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

      // Apply Cross-Day Spatial Rebalancing (prevent visiting same neighborhood on multiple days)
      const rebalancedItinerary = rebalanceCrossDayPOIs(enrichedItinerary);

      // Apply Neuro-Symbolic 2-Opt TSP, Opening Hours constraint, and Anti-Looping Route Optimization
      const hotelLoc = prefs.hasHotel === "yes" && prefs.hotelLat && prefs.hotelLng
        ? { lat: prefs.hotelLat, lng: prefs.hotelLng }
        : coords;

      const sortedEnrichedItinerary = rebalancedItinerary.map((day, dIdx) => {
        const prevDayLastAct = dIdx > 0 ? rebalancedItinerary[dIdx - 1]?.activities.slice(-1)[0] : undefined;
        const dayStart = (prefs.hasHotel === "yes" && prefs.hotelLat && prefs.hotelLng)
          ? hotelLoc
          : (dIdx === 0
            ? hotelLoc
            : (prevDayLastAct?.lat && prevDayLastAct?.lng ? { lat: prevDayLastAct.lat, lng: prevDayLastAct.lng } : hotelLoc));

        // Calculate day of week for opening hours fitting
        const dayDate = new Date(prefs.startDate);
        dayDate.setDate(dayDate.getDate() + dIdx);
        const dayOfWeek = dayDate.getDay();

        const optimizedDay = optimizeDayActivities(day.activities, prefs.pace, dayStart, dayOfWeek);
        return {
          ...day,
          activities: [...optimizedDay].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"))
        };
      });

      setItinerary(sortedEnrichedItinerary);
      setMapItinerary(sortedEnrichedItinerary);
      setSuggestions(generatedSuggestions);

      // Ensure at least 5 accommodations are provided
      let finalAccommodations = [...generatedAccommodations];
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
    <div className="dot-grid-bg min-h-screen pb-24 text-foreground selection:bg-sky-500/20">
      {/* Subtle ambient light */}
      <div className="fixed -top-40 -left-40 size-96 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 size-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Floating Frosted Top Navigation Bar */}
      <div className="sticky top-4 z-40 mx-auto w-[96%] lg:w-[80%] max-w-[1920px] px-2 sm:px-4">
        <nav className="glass-strong flex items-center justify-between gap-2 rounded-full px-3 py-2 shadow-xs sm:px-5">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 group-hover:scale-105 transition-transform shadow-2xs">
                <Plane className="size-4" />
              </div>
              <span className="hidden text-base font-bold tracking-tight sm:inline text-foreground">pixinerary</span>
            </Link>

            <Link
              to="/experiment"
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Beaker className="size-3 text-sky-500" />
              <span>Console</span>
            </Link>
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

            {/* My Trips Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSavedTripsModalOpen(true)}
              className="h-8 rounded-full px-3 text-xs font-semibold gap-1 text-foreground hover:bg-secondary"
              title="ดูประวัติทริปที่บันทึกไว้"
            >
              <Compass className="size-3.5" />
              <span className="hidden sm:inline">My Trips</span>
            </Button>

            {/* User Session / Sign in */}
            <UserMenu />
          </div>
        </nav>
      </div>

      {/* Main Content Area (80% width with 10% margins left & right) */}
      <main className="mx-auto w-[96%] lg:w-[80%] max-w-[1920px] px-2 sm:px-4 pt-6 pb-20">
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
                  Advanced AI settings (Visual CLIP scoring)
                </span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
              </button>

              {showAdvancedSettings && (
                <div className="px-4 pb-4 pt-1 border-t border-border/40 flex items-center justify-between gap-2 animate-in fade-in">
                  <div>
                    <p className="text-xs font-medium text-foreground">Visual confidence scoring (CLIP)</p>
                    <p className="text-[11px] text-muted-foreground">Uses the CLIP vision model to rank landmarks by visual similarity.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      id="clip-toggle"
                      checked={useClip}
                      onCheckedChange={setUseClip}
                    />
                    <span className="text-xs font-medium text-muted-foreground">{useClip ? "On (slower)" : "Off (faster)"}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── STEP 1: Identified Locations (Pixinerary_2) ── */}
        {detectedLocations.length > 0 && step === 1 && !isAnalyzing && (
          <section className="animate-in fade-in mx-auto flex max-w-3xl flex-col gap-6 duration-500 mb-12">
            <LocationDisplay
              locations={detectedLocations}
              useClip={useClip}
              outliersCount={outliers.length}
              onOpenOutliersReport={() => setIsOutlierModalOpen(true)}
              onRemoveLocation={handleRemoveLocation}
              onSwitchCandidate={handleSwitchCandidateFromLocation}
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
                <span>Upload new photos</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setStep(2);
                  setMaxUnlockedStep(prev => Math.max(prev, 2));
                  window.scrollTo({ top: 100, behavior: "smooth" });
                }}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs h-8 px-3 gap-1.5 shadow-xs"
              >
                <span>Continue to preferences</span>
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
                    Planning for {detectedLocations[0]?.place || "Destination"}, {detectedLocations[0]?.country}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tell us how you like to travel ({detectedLocations.length} places identified)
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
                    <span>ดูแผนปัจจุบัน</span>
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
                  <span>Back</span>
                </Button>
              </div>
            </div>

            {/* Preferences Form */}
            <TripPreferencesForm
              key={`pref-form-${preferences ? `${preferences.days}-${preferences.travelerType}-${preferences.budget}-${(preferences.activities || []).join("-")}` : "new"}`}
              onSubmit={handlePreferencesSubmit}
              destinationName={detectedLocations[0]?.place}
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
                    <span>Edit preferences</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="rounded-xl text-muted-foreground hover:text-foreground font-medium text-xs h-7 px-2.5 gap-1"
                  >
                    <Eye className="size-3.5" />
                    <span>View photos ({detectedLocations.length})</span>
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
                    onClick={exportToPDF}
                    disabled={isExportingPDF}
                    className="rounded-xl border-border bg-background hover:bg-muted font-medium text-xs h-7 px-2.5 gap-1 shadow-2xs"
                  >
                    {isExportingPDF ? (
                      <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileDown className="size-3.5" />
                    )}
                    <span>Export PDF</span>
                  </Button>

                  {/* Auto-Save Live Status Badge */}
                  {lastAutoSavedAt && (
                    <span
                      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/80 border border-border/70 text-[11px] text-muted-foreground font-medium"
                      title="ระบบบันทึกความคืบหน้าของทริปลงฐานข้อมูลอัตโนมัติทุก 1 นาที"
                    >
                      {isAutoSaving ? (
                        <>
                          <Loader2 className="size-3 animate-spin text-primary" />
                          <span>กำลังบันทึกอัตโนมัติ...</span>
                        </>
                      ) : (
                        <>
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>บันทึกอัตโนมัติแล้ว ({lastAutoSavedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })})</span>
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
                    <span>{currentTripId ? "อัปเดตการบันทึก" : "Save trip"}</span>
                  </Button>
                </div>
              </div>


              {/* 2-Column Responsive Dashboard */}
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Left Column (7/12 on lg, 8/12 on xl): Itinerary Timeline */}
                <div className="lg:col-span-7 xl:col-span-8" id="pdf-export-wrapper">
                  <div id="pdf-cover-section" aria-hidden="true" />
                  <TravelItinerary
                    itinerary={itinerary}
                    onUpdate={(newItinerary) => {
                      setItinerary(newItinerary);
                      setMapItinerary(newItinerary);
                    }}
                    activeDragId={activeDragId}
                    onSelectActivity={handleSelectActivity}
                    onHoverActivity={setHoveredActivityId}
                    onReloadMap={() => setMapItinerary(itinerary)}
                    suggestions={suggestions}
                    tripStartDate={tripStartDate ?? undefined}
                    hourlyWeather={environmentData?.hourly ?? []}
                    coherenceResult={coherenceResult}
                    onAIRefine={handleAIRefineItinerary}
                    isAIRefining={isAIRefining}
                  />

                </div>

                {/* Right Column (5/12 on lg, 4/12 on xl, Sticky): Interactive Map & Live Weather */}
                <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 lg:self-start">
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
                      📍 Suggested Places
                    </TabsTrigger>
                    <TabsTrigger value="hotels" className="rounded-full flex-1 text-xs sm:text-sm font-medium">
                      🏨 Stays & Hotels
                    </TabsTrigger>
                    <TabsTrigger value="flights" className="rounded-full flex-1 text-xs sm:text-sm font-medium">
                      ✈️ Flight Logistics
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
          locationName={detectedLocations[0]?.place || "Destination"}
          itinerary={itinerary}
          onUpdateItinerary={(newItinerary) => {
            setItinerary(newItinerary);
            setMapItinerary(newItinerary);
          }}
          preferences={preferences}
          onUpdatePreferences={(updatedPrefs) => {
            setPreferences((prev) => (prev ? { ...prev, ...updatedPrefs } : null));
            toast.success("อัปเดตความต้องการเดินทางสำเร็จ");
          }}
          onUpdateHotel={(hotelName) => {
            setPreferences((prev) => (prev ? { ...prev, hasHotel: "yes", hotelName } : null));
            toast.success(`สลับโรงแรมเป็น: ${hotelName}`);
          }}
          onUpdateFlight={(flightCode) => {
            setPreferences((prev) => (prev ? { ...prev, hasFlight: "yes", flightCode } : null));
            toast.success(`อัปเดตเที่ยวบิน ${flightCode} เรียบร้อยแล้ว ขอให้ถึงที่หมายโดยสวัสดิภาพ ✨✈️`);
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

      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground mt-12">
        <p>Pixinerary — AI-Powered Image-Based Travel Planner • Research Project</p>
      </footer>
    </div>
  );
};


export default Index;
