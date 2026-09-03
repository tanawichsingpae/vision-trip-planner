import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type TripPreferences } from "@/services/aiService";
import { getFlightTrends, type FlightTrend } from "@/services/flightService";
import { GoogleFlightsCalendarWidget } from "@/components/GoogleFlightsCalendarWidget";
import { AirportSelectCombobox } from "@/components/AirportSelectCombobox";
import { HotelSelectCombobox } from "@/components/HotelSelectCombobox";
import { FlightStatusPanel } from "@/components/FlightInfoDashboard";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Info } from "lucide-react";
import {
  Users,
  UserRound,
  Heart,
  Baby,
  PersonStanding,
  Backpack,
  Gem,
  Wallet,
  Turtle,
  Footprints,
  Zap,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Plane,
  PlaneTakeoff,
  Search,
  BedDouble,
  Clock,
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  Compass,
  Sparkles,
} from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format, differenceInDays } from "date-fns";

function getSuggestedBudgetRange(destination: string, days: number, travelStyle: string): string {
  const destLower = (destination || "").toLowerCase();
  const isHighCost =
    destLower.includes("japan") ||
    destLower.includes("tokyo") ||
    destLower.includes("osaka") ||
    destLower.includes("kyoto") ||
    destLower.includes("singapore") ||
    destLower.includes("europe") ||
    destLower.includes("usa") ||
    destLower.includes("switzerland") ||
    destLower.includes("iceland");

  const isMidCost =
    destLower.includes("taiwan") ||
    destLower.includes("korea") ||
    destLower.includes("seoul") ||
    destLower.includes("hong kong") ||
    destLower.includes("china");

  let baseDailyMin = 1500;
  let baseDailyMax = 3500;

  if (isHighCost) {
    baseDailyMin = 3500;
    baseDailyMax = 7000;
  } else if (isMidCost) {
    baseDailyMin = 2500;
    baseDailyMax = 5000;
  }

  let multiplier = 1.0;
  if (travelStyle === "budget") multiplier = 0.6;
  if (travelStyle === "luxury") multiplier = 2.5;

  const totalMin = Math.round(baseDailyMin * days * multiplier);
  const totalMax = Math.round(baseDailyMax * days * multiplier);

  return `฿${totalMin.toLocaleString()} - ฿${totalMax.toLocaleString()} THB`;
}

export const TIME_OPTIONS_24H = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2).toString().padStart(2, "0");
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

export interface TripPreferencesFormProps {
  onSubmit: (preferences: TripPreferences) => void;
  destinationName?: string;
  onBack?: () => void;
  initialPreferences?: TripPreferences | null;
  hasExistingItinerary?: boolean;
  onViewExistingItinerary?: () => void;
}

function normalizeTravelerType(val?: string): string {
  if (!val) return "";
  const s = val.toLowerCase().trim();
  if (s.includes("solo") || s === "1") return "solo";
  if (s.includes("couple") || s.includes("romantic")) return "couple";
  if (s.includes("friend") || s.includes("group")) return "friends";
  if (s.includes("kid") || s.includes("child") || s === "family_kids" || s === "family / kids" || s === "family") return "family_kids";
  if (s.includes("senior") || s.includes("elder") || s === "family_seniors" || s === "family / seniors") return "family_seniors";
  return s;
}

function normalizeBudget(val?: string): string {
  if (!val) return "";
  const s = val.toLowerCase().trim();
  if (s.includes("budget") || s.includes("backpack")) return "budget";
  if (s.includes("standard") || s.includes("moderate") || s.includes("comfort")) return "standard";
  if (s.includes("luxury") || s.includes("premium")) return "luxury";
  return s;
}

function normalizePace(val?: string): string {
  if (!val) return "";
  const s = val.toLowerCase().trim();
  if (s.includes("relax") || s.includes("slow") || s.includes("chill")) return "relaxed";
  if (s.includes("balance") || s.includes("moderate") || s.includes("medium") || s.includes("steady")) return "balanced";
  if (s.includes("pack") || s.includes("fast") || s.includes("busy") || s.includes("action")) return "packed";
  return s;
}

function normalizeActivityId(act: string): string {
  const s = act.toLowerCase().trim();
  if (s.includes("cultur") || s.includes("temple") || s.includes("museum") || s.includes("วัด")) return "culture";
  if (s.includes("food") || s.includes("cafe") || s.includes("dining") || s.includes("อาหาร") || s.includes("กิน")) return "food";
  if (s.includes("nature") || s.includes("park") || s.includes("beach") || s.includes("เขา") || s.includes("ธรรมชาติ")) return "nature";
  if (s.includes("adventure") || s.includes("activity") || s.includes("sport") || s.includes("ผจญภัย")) return "adventure";
  if (s.includes("shopping") || s.includes("market") || s.includes("mall") || s.includes("ตลาด") || s.includes("ช้อป")) return "shopping";
  if (s.includes("nightlife") || s.includes("bar") || s.includes("club") || s.includes("บาร์") || s.includes("กลางคืน")) return "nightlife";
  if (s.includes("relax") || s.includes("spa") || s.includes("massage") || s.includes("wellness") || s.includes("สปา") || s.includes("นวด")) return "relax";
  if (s.includes("landmark") || s.includes("photo") || s.includes("sightseeing") || s.includes("จุดชมวิว") || s.includes("ถ่ายรูป")) return "landmark";
  if (s.includes("entertain") || s.includes("theme park") || s.includes("zoo") || s.includes("aquarium") || s.includes("สวนสนุก") || s.includes("สวนสัตว์")) return "entertainment";
  if (s.includes("spirit") || s.includes("mutelu") || s.includes("มู") || s.includes("ขอพร") || s.includes("สักการะ")) return "spiritual";
  return s;
}

function normalizeActivities(acts?: string[]): string[] {
  if (!acts || !Array.isArray(acts)) return [];
  const set = new Set<string>();
  for (const a of acts) {
    if (typeof a === "string") {
      set.add(normalizeActivityId(a));
    }
  }
  return Array.from(set);
}

function normalizeBudgetRange(prefs?: TripPreferences | null): number[] {
  if (prefs?.budgetRange && Array.isArray(prefs.budgetRange) && prefs.budgetRange.length === 2) {
    return [Number(prefs.budgetRange[0]) || 10000, Number(prefs.budgetRange[1]) || 50000];
  }
  if (prefs?.budgetMinTHB !== undefined && prefs?.budgetMaxTHB !== undefined) {
    return [Number(prefs.budgetMinTHB) || 10000, Number(prefs.budgetMaxTHB) || 50000];
  }
  return [10000, 50000];
}

function getEffectivePreferences(propPrefs?: TripPreferences | null): TripPreferences | null {
  if (propPrefs && (propPrefs.travelerType || propPrefs.budget || (propPrefs.activities && propPrefs.activities.length > 0))) {
    return propPrefs;
  }
  try {
    const stored = sessionStorage.getItem("pixinerary_active_preferences");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  return propPrefs || null;
}

const TripPreferencesForm = ({
  onSubmit,
  destinationName = "",
  onBack,
  initialPreferences,
  hasExistingItinerary = false,
  onViewExistingItinerary,
}: TripPreferencesFormProps) => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() + 1);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultStart.getDate() + 2);

  const effectivePrefs = getEffectivePreferences(initialPreferences);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (effectivePrefs?.startDate && effectivePrefs?.endDate) {
      return {
        from: new Date(effectivePrefs.startDate),
        to: new Date(effectivePrefs.endDate),
      };
    }
    return {
      from: defaultStart,
      to: defaultEnd,
    };
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelerType, setTravelerType] = useState(() => normalizeTravelerType(effectivePrefs?.travelerType));
  const [budget, setBudget] = useState(() => normalizeBudget(effectivePrefs?.budget));
  const [budgetRange, setBudgetRange] = useState<number[]>(() => normalizeBudgetRange(effectivePrefs));
  const [activities, setActivities] = useState<string[]>(() => normalizeActivities(effectivePrefs?.activities));
  const [pace, setPace] = useState(() => normalizePace(effectivePrefs?.pace));

  // Flight fields
  const [hasFlight, setHasFlight] = useState<"yes" | "no" | null>(() => effectivePrefs?.hasFlight ?? null);
  const [flightCode, setFlightCode] = useState(() => effectivePrefs?.flightCode || "");
  const [originIata, setOriginIata] = useState(() => effectivePrefs?.originIata || "");

  // Hotel fields
  const [hasHotel, setHasHotel] = useState<"yes" | "no" | null>(() => effectivePrefs?.hasHotel ?? null);
  const [hotelName, setHotelName] = useState(() => effectivePrefs?.hotelName || "");
  const [hotelCheckInTime, setHotelCheckInTime] = useState(() => effectivePrefs?.hotelCheckInTime || "15:00");
  const [hotelCheckOutTime, setHotelCheckOutTime] = useState(() => effectivePrefs?.hotelCheckOutTime || "11:00");
  const [hotelLat, setHotelLat] = useState<number | undefined>(() => effectivePrefs?.hotelLat);
  const [hotelLng, setHotelLng] = useState<number | undefined>(() => effectivePrefs?.hotelLng);
  const [hotelPhotoUrl, setHotelPhotoUrl] = useState<string | undefined>(() => effectivePrefs?.hotelPhotoUrl);
  const [hotelPlaceId, setHotelPlaceId] = useState<string | undefined>(() => effectivePrefs?.hotelPlaceId);

  // Synchronize state if initialPreferences update
  useEffect(() => {
    const p = getEffectivePreferences(initialPreferences);
    if (p) {
      if (p.startDate && p.endDate) {
        setDateRange({
          from: new Date(p.startDate),
          to: new Date(p.endDate),
        });
      }
      if (p.travelerType) {
        setTravelerType(normalizeTravelerType(p.travelerType));
      }
      if (p.budget) {
        setBudget(normalizeBudget(p.budget));
      }
      setBudgetRange(normalizeBudgetRange(p));
      if (p.activities) {
        setActivities(normalizeActivities(p.activities));
      }
      if (p.pace) {
        setPace(normalizePace(p.pace));
      }
      if (p.hasFlight !== undefined) setHasFlight(p.hasFlight);
      if (p.flightCode) setFlightCode(p.flightCode);
      if (p.originIata) setOriginIata(p.originIata);
      if (p.hasHotel !== undefined) setHasHotel(p.hasHotel);
      if (p.hotelName) setHotelName(p.hotelName);
      if (p.hotelCheckInTime) setHotelCheckInTime(p.hotelCheckInTime);
      if (p.hotelCheckOutTime) setHotelCheckOutTime(p.hotelCheckOutTime);
      if (p.hotelLat) setHotelLat(p.hotelLat);
      if (p.hotelLng) setHotelLng(p.hotelLng);
      if (p.hotelPhotoUrl) setHotelPhotoUrl(p.hotelPhotoUrl);
      if (p.hotelPlaceId) setHotelPlaceId(p.hotelPlaceId);
    }
  }, [initialPreferences]);



  // Price trends state
  const [trendsData, setTrendsData] = useState<FlightTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Infer destination IATA airport from destinationName
  const inferDestinationAirport = (destName?: string): string => {
    if (!destName) return "NRT";
    const lower = destName.toLowerCase();
    if (lower.includes("tokyo") || lower.includes("japan") || lower.includes("ญี่ปุ่น")) return "NRT";
    if (lower.includes("osaka") || lower.includes("โอซาก้า") || lower.includes("kyoto")) return "KIX";
    if (lower.includes("phuket") || lower.includes("ภูเก็ต")) return "HKT";
    if (lower.includes("chiang mai") || lower.includes("เชียงใหม่")) return "CNX";
    if (lower.includes("bangkok") || lower.includes("กรุงเทพ")) return "BKK";
    if (lower.includes("singapore") || lower.includes("สิงคโปร์")) return "SIN";
    if (lower.includes("seoul") || lower.includes("korea") || lower.includes("เกาหลี")) return "ICN";
    if (lower.includes("hong kong") || lower.includes("ฮ่องกง")) return "HKG";
    if (lower.includes("taiwan") || lower.includes("taipei") || lower.includes("ไต้หวัน")) return "TPE";
    if (lower.includes("london") || lower.includes("ลอนดอน")) return "LHR";
    if (lower.includes("paris") || lower.includes("ปารีส")) return "CDG";
    return "NRT";
  };

  const targetDestIata = inferDestinationAirport(destinationName);

  // Fetch price trends whenever origin airport + dateRange are ready
  useEffect(() => {
    if (!dateRange?.from) return;

    const fetchTrends = async () => {
      setTrendsLoading(true);
      try {
        const date = dateRange.from!;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const queryOrigin = originIata.trim().length >= 3 ? originIata.trim().toUpperCase() : "BKK";
        const result = await getFlightTrends(queryOrigin, targetDestIata, dateStr);
        setTrendsData(result.trends ?? []);
      } catch {
        setTrendsData([]);
      } finally {
        setTrendsLoading(false);
      }
    };

    const debounce = setTimeout(fetchTrends, 400);
    return () => clearTimeout(debounce);
  }, [originIata, targetDestIata, dateRange?.from]);

  const travelerTypes = [
    { id: "solo", label: "Solo", desc: "Going alone", icon: UserRound },
    { id: "couple", label: "Couple", desc: "Romantic getaway", icon: Heart },
    { id: "friends", label: "Friends", desc: "Group fun & activities", icon: Users },
    { id: "family_kids", label: "Family / Kids", desc: "Child-friendly spots", icon: Baby },
    { id: "family_seniors", label: "Family / Seniors", desc: "Low intensity, easy walks", icon: PersonStanding },
  ];

  const budgetLevels = [
    { id: "budget", label: "Backpacker", desc: "Budget-friendly", icon: Backpack },
    { id: "standard", label: "Standard", desc: "Comfortable value", icon: Wallet },
    { id: "luxury", label: "Luxury", desc: "Premium experience", icon: Gem },
  ];

  const activityOptions = [
    { id: "culture", label: "Culture", emoji: "🏛️" },
    { id: "food", label: "Food", emoji: "🍜" },
    { id: "nature", label: "Nature", emoji: "🌳" },
    { id: "adventure", label: "Adventure", emoji: "🧗" },
    { id: "shopping", label: "Shopping", emoji: "🛍️" },
    { id: "nightlife", label: "Nightlife", emoji: "🍸" },
    { id: "relax", label: "Relax", emoji: "💆" },
    { id: "landmark", label: "Landmark & Photo", emoji: "📸" },
    { id: "entertainment", label: "Entertainment", emoji: "🎪" },
    { id: "spiritual", label: "Spiritual & Mutelu", emoji: "🔮" },
  ];


  const paceOptions = [
    { id: "relaxed", label: "Relaxed", desc: "1–2 spots/day · slow & scenic", icon: Turtle },
    { id: "balanced", label: "Balanced", desc: "3–4 spots/day · steady rhythm", icon: Footprints },
    { id: "packed", label: "Packed", desc: "5+ spots/day · action-packed", icon: Zap },
  ];

  const toggleActivity = (id: string) => {
    setActivities(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const days =
    dateRange?.from && dateRange?.to
      ? differenceInDays(dateRange.to, dateRange.from) + 1
      : 1;

  const dateRangeLabel = () => {
    if (!dateRange?.from) return "Select travel dates";
    if (!dateRange?.to) return format(dateRange.from, "d MMM yyyy");
    return `${format(dateRange.from, "d MMM yyyy")} – ${format(dateRange.to, "d MMM yyyy")}`;
  };

  const canSubmit =
    !!dateRange?.from &&
    !!dateRange?.to &&
    !!travelerType &&
    !!budget &&
    !!pace &&
    activities.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      startDate: dateRange!.from!,
      endDate: dateRange!.to!,
      days,
      travelerType,
      budget,
      budgetMinTHB: budgetRange[0],
      budgetMaxTHB: budgetRange[1],
      activities,
      pace,
      hasFlight: hasFlight ?? undefined,
      flightCode: hasFlight === "yes" && flightCode.trim() ? flightCode.trim().toUpperCase() : undefined,
      originIata: hasFlight === "no" && originIata.trim() ? originIata.trim().toUpperCase() : undefined,
      hasHotel: hasHotel ?? undefined,
      hotelName: hasHotel === "yes" ? hotelName.trim() : undefined,
      hotelCheckInTime: hasHotel === "yes" ? hotelCheckInTime : undefined,
      hotelCheckOutTime: hasHotel === "yes" ? hotelCheckOutTime : undefined,
      hotelLat: hasHotel === "yes" ? hotelLat : undefined,
      hotelLng: hasHotel === "yes" ? hotelLng : undefined,
      hotelPhotoUrl: hasHotel === "yes" ? hotelPhotoUrl : undefined,
      hotelPlaceId: hasHotel === "yes" ? hotelPlaceId : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      {/* ── Applied Preferences Summary Card (Pixinerary_33) ── */}
      {hasExistingItinerary && initialPreferences && (
        <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-secondary/30 to-background p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Preferences ที่ใช้สร้างแผนการท่องเที่ยวปัจจุบัน</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                    Applied in Itinerary
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ตารางเที่ยวปัจจุบันถูกสร้างขึ้นตามความต้องการด้านล่างนี้ (สามารถแก้ไขฟอร์มด้านล่างแล้วกดสร้างใหม่ได้)
                </p>
              </div>
            </div>

            {onViewExistingItinerary && (
              <Button
                type="button"
                size="sm"
                onClick={onViewExistingItinerary}
                className="h-8 px-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs gap-1.5 self-start sm:self-auto shadow-2xs shrink-0"
              >
                <Compass className="size-3.5" />
                <span>ดูตาราง Itinerary ปัจจุบัน</span>
                <ArrowRight className="size-3" />
              </Button>
            )}
          </div>

          {/* Details 4-Column Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {/* 1. Dates & Duration */}
            <div className="p-3 rounded-2xl bg-card border border-border/60 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                📅 วันที่ & ระยะเวลา
              </span>
              <span className="font-bold text-foreground text-sm mt-1">
                {initialPreferences.days ? `${initialPreferences.days} วัน` : "–"}
              </span>
              {initialPreferences.startDate && initialPreferences.endDate ? (
                <span className="text-[11px] text-muted-foreground truncate">
                  {format(new Date(initialPreferences.startDate), "d MMM")} – {format(new Date(initialPreferences.endDate), "d MMM yyyy")}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">–</span>
              )}
            </div>

            {/* 2. Traveler Type */}
            <div className="p-3 rounded-2xl bg-card border border-border/60 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                👥 กลุ่มผู้เดินทาง
              </span>
              <span className="font-bold text-foreground text-sm mt-1 capitalize">
                {initialPreferences.travelerType || "–"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {travelerTypes.find(t => t.id === initialPreferences.travelerType?.toLowerCase())?.desc || "Traveler style"}
              </span>
            </div>

            {/* 3. Budget & Range */}
            <div className="p-3 rounded-2xl bg-card border border-border/60 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                💰 งบประมาณ
              </span>
              <span className="font-bold text-foreground text-sm mt-1 capitalize">
                {initialPreferences.budget || "–"}
              </span>
              {initialPreferences.budgetMinTHB !== undefined && initialPreferences.budgetMaxTHB !== undefined ? (
                <span className="text-[10px] text-primary font-mono font-bold">
                  ฿{initialPreferences.budgetMinTHB.toLocaleString()} - ฿{initialPreferences.budgetMaxTHB.toLocaleString()}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Standard value</span>
              )}
            </div>

            {/* 4. Pace */}
            <div className="p-3 rounded-2xl bg-card border border-border/60 flex flex-col justify-between shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                🏃 จังหวะเดินทาง (Pace)
              </span>
              <span className="font-bold text-foreground text-sm mt-1 capitalize">
                {initialPreferences.pace || "–"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {initialPreferences.pace?.toLowerCase() === "relaxed"
                  ? "1–2 ที่/วัน (ชิลๆ)"
                  : initialPreferences.pace?.toLowerCase() === "packed"
                  ? "5+ ที่/วัน (อัดแน่น)"
                  : "3–4 ที่/วัน (สมดุล)"}
              </span>
            </div>
          </div>

          {/* Activities Badges */}
          {initialPreferences.activities && initialPreferences.activities.length > 0 && (
            <div className="p-3 rounded-2xl bg-card border border-border/60 flex flex-col sm:flex-row sm:items-center gap-2 shadow-2xs">
              <span className="text-xs font-bold text-foreground shrink-0 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>หมวดหมู่กิจกรรมที่เลือก:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {initialPreferences.activities.map((act) => {
                  const opt = activityOptions.find(o => o.id === act);
                  return (
                    <span
                      key={act}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-secondary text-foreground text-xs font-semibold border border-border/70 shadow-2xs"
                    >
                      <span>{opt?.emoji || "✨"}</span>
                      <span>{opt?.label || act}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flight & Hotel Extra Metadata */}
          {(initialPreferences.hotelName || initialPreferences.flightCode || initialPreferences.originIata) && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {initialPreferences.hotelName && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-medium">
                  🏨 ที่พัก: {initialPreferences.hotelName} ({initialPreferences.hotelCheckInTime || "15:00"} – {initialPreferences.hotelCheckOutTime || "11:00"})
                </span>
              )}
              {initialPreferences.flightCode && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-medium">
                  ✈️ เที่ยวบิน: {initialPreferences.flightCode}
                </span>
              )}
              {initialPreferences.originIata && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-medium">
                  🛫 เดินทางจาก: {initialPreferences.originIata}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-foreground">Trip Preferences</h3>
        <p className="text-muted-foreground mt-2">Tell us more about how you like to travel</p>
      </div>

      {/* ── Flight Section ── */}
      <div className="space-y-4">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Plane className="w-4 h-4 text-primary" />
          Do you already have a flight booked? (Optional)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setHasFlight(hasFlight === "yes" ? null : "yes")}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              hasFlight === "yes"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
            }`}
          >
            <Plane className="w-6 h-6" />
            <span className="text-sm font-semibold">Yes, I have a flight</span>
            <span className={`text-[10px] leading-tight ${
              hasFlight === "yes" ? "text-primary/70" : "text-muted-foreground"
            }`}>Track my flight status</span>
          </button>
          <button
            type="button"
            onClick={() => setHasFlight(hasFlight === "no" ? null : "no")}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              hasFlight === "no"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
            }`}
          >
            <Search className="w-6 h-6" />
            <span className="text-sm font-semibold">No, find me a flight</span>
            <span className={`text-[10px] leading-tight ${
              hasFlight === "no" ? "text-primary/70" : "text-muted-foreground"
            }`}>Compare cheapest options</span>
          </button>
        </div>

        {/* Conditional: flight code or origin airport */}
        {hasFlight === "yes" && (
          <div className="space-y-3 animate-slide-up">
            <Label htmlFor="flight-code" className="text-sm font-medium flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-primary" />
              หมายเลขเที่ยวบิน (Flight Number) (Optional)
            </Label>
            <Input
              id="flight-code"
              placeholder="เช่น TG682, XJ600, NH848"
              value={flightCode}
              onChange={(e) => setFlightCode(e.target.value.toUpperCase())}
              className="uppercase font-semibold tracking-wider placeholder:normal-case placeholder:font-normal"
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground">ระบบจะติดตามสถานะสดและเวลาเดินทางมาถึง เพื่อจัดสรรเวลาในวันแรกของทริปให้อัตโนมัติ</p>

            {flightCode.trim().length >= 2 && (
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-primary" />
                    สถานะเที่ยวบินแบบเรียลไทม์ (Live Flight Tracking)
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    Live Status
                  </Badge>
                </div>
                <FlightStatusPanel flightCode={flightCode.trim()} />
              </div>
            )}
          </div>
        )}

        {hasFlight === "no" && (
          <div className="space-y-3 animate-slide-up">
            <Label htmlFor="origin-airport" className="text-sm font-medium flex items-center gap-1.5">
              <PlaneTakeoff className="w-3.5 h-3.5 text-primary" />
              สนามบินต้นทาง (Departure Airport) (Optional)
            </Label>
            <AirportSelectCombobox
              id="origin-airport"
              value={originIata}
              onChange={setOriginIata}
              placeholder="ค้นหาสนามบิน เช่น กรุงเทพ, BKK, Bangkok..."
            />

            {/* ── Google Flights Price Calendar Widget ── */}
            <div className="pt-2">
              <GoogleFlightsCalendarWidget
                trends={trendsData}
                loading={trendsLoading}
                selectedDate={
                  dateRange?.from
                    ? `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, "0")}-${String(dateRange.from.getDate()).padStart(2, "0")}`
                    : undefined
                }
                origin={originIata.trim().toUpperCase() || "BKK"}
                destination={targetDestIata}
                onSelectDate={(dateStr) => {
                  try {
                    const selected = new Date(dateStr + "T00:00:00");
                    const durationDays = days > 0 ? days : 3;
                    const newEnd = new Date(selected);
                    newEnd.setDate(selected.getDate() + (durationDays - 1));
                    setDateRange({ from: selected, to: newEnd });
                  } catch (e) {
                    console.error(e);
                  }
                }}
                onRefresh={() => {
                  if (dateRange?.from) {
                    const date = dateRange.from;
                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                    getFlightTrends(originIata.trim().toUpperCase() || "BKK", targetDestIata, dateStr)
                      .then((res) => setTrendsData(res.trends ?? []))
                      .catch(() => setTrendsData([]));
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Hotel / Accommodation Section ── */}
      <div className="space-y-4">
        <Label className="text-base font-semibold flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-primary" />
          Do you already have accommodation booked? (Optional)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setHasHotel(hasHotel === "yes" ? null : "yes")}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              hasHotel === "yes"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
            }`}
          >
            <BedDouble className="w-6 h-6" />
            <span className="text-sm font-semibold">Yes, I have a hotel</span>
            <span className={`text-[10px] leading-tight ${
              hasHotel === "yes" ? "text-primary/70" : "text-muted-foreground"
            }`}>Auto-schedule check-in &amp; out</span>
          </button>
          <button
            type="button"
            onClick={() => setHasHotel(hasHotel === "no" ? null : "no")}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              hasHotel === "no"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
            }`}
          >
            <Search className="w-6 h-6" />
            <span className="text-sm font-semibold">No, find me options</span>
            <span className={`text-[10px] leading-tight ${
              hasHotel === "no" ? "text-primary/70" : "text-muted-foreground"
            }`}>Browse AI recommendations</span>
          </button>
        </div>

        {hasHotel === "yes" && (
          <div className="space-y-4 animate-slide-up p-4 rounded-xl bg-primary/5 border border-primary/20">
            {/* Hotel Name */}
            <div className="space-y-1.5">
              <Label htmlFor="hotel-name" className="text-sm font-medium flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5 text-primary" />
                Hotel name
              </Label>
              <HotelSelectCombobox
                id="hotel-name"
                value={hotelName}
                onChange={(name, lat, lng, details) => {
                  setHotelName(name);
                  setHotelLat(lat);
                  setHotelLng(lng);
                  setHotelPhotoUrl(details?.photoUrl);
                  setHotelPlaceId(details?.placeId);
                }}
                destinationName={destinationName}
                placeholder="Search for your hotel..."
              />
            </div>

            {/* Check-in / Check-out times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="checkin-time" className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-green-500" />
                  Check-in time
                </Label>
                <select
                  id="checkin-time"
                  value={hotelCheckInTime}
                  onChange={(e) => setHotelCheckInTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {TIME_OPTIONS_24H.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkout-time" className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Check-out time
                </Label>
                <select
                  id="checkout-time"
                  value={hotelCheckOutTime}
                  onChange={(e) => setHotelCheckOutTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {TIME_OPTIONS_24H.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              ✅ Check-in and check-out will be automatically added to Day 1 and the last day.
            </p>
          </div>
        )}
      </div>

      {/* ── Date Range Picker ── */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">When are you traveling?</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>

          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-border hover:border-primary/40 bg-card text-foreground transition-all text-left"
            >
              <CalendarDays className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{dateRangeLabel()}</p>
                {dateRange?.from && dateRange?.to && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {days} {days === 1 ? "day" : "days"}
                  </p>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) setCalendarOpen(false);
              }}
              disabled={{ before: today }}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {dateRange?.from && dateRange?.to && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/8 rounded-xl border border-primary/20">
            <span className="text-sm text-primary font-medium">✈️</span>
            <span className="text-sm text-primary">
              {days}-day trip · {format(dateRange.from, "MMMM yyyy")}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">Who are you traveling with?</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {travelerTypes.map((type) => {
            const isSelected = travelerType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setTravelerType(type.id)}
                className={`relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm ring-1 ring-primary/40"
                    : "border-border hover:border-primary/20 bg-card text-foreground"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <type.icon className="w-6 h-6" />
                <span className="text-sm font-semibold leading-tight">{type.label}</span>
                <span className={`text-[10px] leading-tight ${isSelected ? "text-primary/80 font-medium" : "text-muted-foreground"}`}>
                  {type.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">What is your travel style?</Label>
        <div className="grid grid-cols-3 gap-3">
          {budgetLevels.map((level) => {
            const isSelected = budget === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => setBudget(level.id)}
                className={`relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm ring-1 ring-primary/40"
                    : "border-border hover:border-primary/20 bg-card text-foreground"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <level.icon className="w-6 h-6" />
                <span className="text-sm font-semibold">{level.label}</span>
                <span className={`text-[10px] ${isSelected ? "text-primary/80 font-medium" : "text-muted-foreground"}`}>
                  {level.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Hybrid Min-Max Budget Range Slider (THB) */}
        <div className="space-y-4 p-4 rounded-2xl bg-muted/30 border border-border/60 mt-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Wallet className="w-3.5 h-3.5 text-primary" />
              ช่วงงบประมาณเป้าหมาย (Min – Max)
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
                THB (฿)
              </span>
            </Label>
            <span className="text-[10px] text-muted-foreground">
              ลากเพื่อปรับช่วงงบที่ต้องการ
            </span>
          </div>

          <div className="bg-background/80 p-4 rounded-xl border border-border/50 space-y-3">
            <div className="flex items-center justify-between font-mono">
              <span className="text-xs text-muted-foreground">ขั้นต่ำ (Min):</span>
              <span className="text-sm font-bold text-primary">
                ฿{budgetRange[0].toLocaleString()} THB
              </span>
              <span className="text-xs text-muted-foreground">สูงสุด (Max):</span>
              <span className="text-sm font-bold text-primary">
                ฿{budgetRange[1].toLocaleString()} THB
              </span>
            </div>

            <Slider
              value={budgetRange}
              min={0}
              max={150000}
              step={1000}
              onValueChange={(val) => setBudgetRange(val)}
              className="py-2"
            />

            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>฿0</span>
              <span>฿50,000</span>
              <span>฿100,000</span>
              <span>฿150,000+</span>
            </div>
          </div>

          {/* Smart suggestion badge based on destination + days + style */}
          {days > 0 && budget && (
            <div className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span>ช่วงงบแนะนำสำหรับทริปนี้ ({days} วัน): </span>
                <span className="font-bold">
                  {getSuggestedBudgetRange(destinationName, days, budget)}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  *ประมาณการค่าใช้จ่ายในสไตล์ {budget === "budget" ? "Backpacker" : budget === "standard" ? "Standard" : "Luxury"} (ไม่รวมตั๋วเครื่องบิน)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold text-center block">What activities do you prefer?</Label>
        <div className="flex flex-wrap justify-center gap-3">
          {activityOptions.map((opt) => {
            const isSelected = activities.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleActivity(opt.id)}
                className={`flex flex-col items-center justify-center gap-2 p-3 w-[100px] sm:w-[110px] h-[95px] rounded-2xl border-2 transition-all relative overflow-hidden ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-md ring-1 ring-primary/40"
                    : "border-border hover:border-primary/30 bg-card text-foreground hover:-translate-y-1 hover:shadow-sm"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <span className="text-3xl drop-shadow-sm">{opt.emoji}</span>
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">What is your preferred travel pace?</Label>
        <div className="grid grid-cols-3 gap-3">
          {paceOptions.map((option) => {
            const isSelected = pace === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPace(option.id)}
                className={`relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm ring-1 ring-primary/40"
                    : "border-border hover:border-primary/20 bg-card text-foreground"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <option.icon className={`w-6 h-6 ${option.id === "packed" ? "animate-pulse" : ""}`} />
                <span className="text-sm font-semibold">{option.label}</span>
                <span className={`text-[10px] leading-tight ${isSelected ? "text-primary/80 font-medium" : "text-muted-foreground"}`}>
                  {option.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>


      <div className="pt-6 flex flex-col sm:flex-row items-center gap-3">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border/80 hover:bg-muted/60 text-foreground font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ย้อนกลับ</span>
          </Button>
        )}

        {hasExistingItinerary && onViewExistingItinerary && (
          <Button
            type="button"
            variant="outline"
            onClick={onViewExistingItinerary}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <Compass className="w-4 h-4" />
            <span>ดูแผนการท่องเที่ยวปัจจุบัน</span>
          </Button>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 w-full h-11 px-6 rounded-xl travel-gradient text-white font-semibold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          <span>{hasExistingItinerary ? "สร้างแผนการท่องเที่ยวใหม่ (Regenerate)" : "สร้างแผนการท่องเที่ยว (Generate Itinerary)"}</span>
        </Button>
      </div>
    </form>
  );
};

export default TripPreferencesForm;

