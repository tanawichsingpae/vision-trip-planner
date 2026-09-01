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
  ChevronDown,
  Plane,
  PlaneTakeoff,
  Search,
  BedDouble,
  Clock,
  ChevronLeft,
  ArrowLeft,
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
    destLower.includes("france") ||
    destLower.includes("paris") ||
    destLower.includes("london") ||
    destLower.includes("uk") ||
    destLower.includes("usa") ||
    destLower.includes("switzerland") ||
    destLower.includes("korea") ||
    destLower.includes("seoul") ||
    destLower.includes("europe") ||
    destLower.includes("australia");

  let baseMin = 1500;
  let baseMax = 2500;

  if (travelStyle === "standard") {
    baseMin = 3000;
    baseMax = 5000;
  } else if (travelStyle === "luxury") {
    baseMin = 8000;
    baseMax = 15000;
  }

  if (isHighCost) {
    baseMin *= 2;
    baseMax *= 2;
  }

  const totalMin = baseMin * days;
  const totalMax = baseMax * days;
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
}

const TripPreferencesForm = ({ onSubmit, destinationName = "", onBack }: TripPreferencesFormProps) => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() + 1);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultStart.getDate() + 2);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultStart,
    to: defaultEnd,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelerType, setTravelerType] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetRange, setBudgetRange] = useState<number[]>([10000, 50000]);
  const [activities, setActivities] = useState<string[]>([]);
  const [pace, setPace] = useState("");

  // Flight fields
  const [hasFlight, setHasFlight] = useState<"yes" | "no" | null>(null);
  const [flightCode, setFlightCode] = useState("");   // e.g. TG682 (AviationStack)
  const [originIata, setOriginIata] = useState("");   // e.g. BKK (Google Flights)

  // Hotel fields
  const [hasHotel, setHasHotel] = useState<"yes" | "no" | null>(null);
  const [hotelName, setHotelName] = useState("");
  const [hotelCheckInTime, setHotelCheckInTime] = useState("15:00");
  const [hotelCheckOutTime, setHotelCheckOutTime] = useState("11:00");
  const [hotelLat, setHotelLat] = useState<number | undefined>(undefined);
  const [hotelLng, setHotelLng] = useState<number | undefined>(undefined);
  const [hotelPhotoUrl, setHotelPhotoUrl] = useState<string | undefined>(undefined);
  const [hotelPlaceId, setHotelPlaceId] = useState<string | undefined>(undefined);

  // Price trends state
  const [trendsData, setTrendsData] = useState<FlightTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Fetch price trends whenever origin airport + dateRange are ready
  useEffect(() => {
    if (hasFlight !== "no" || !dateRange?.from) return;

    const fetchTrends = async () => {
      setTrendsLoading(true);
      setTrendsData([]);
      try {
        const date = dateRange.from!;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const queryOrigin = originIata.trim().length >= 3 ? originIata.trim().toUpperCase() : "BKK";
        const result = await getFlightTrends(queryOrigin, "NRT", dateStr);
        setTrendsData(result.trends ?? []);
      } catch {
        setTrendsData([]);
      } finally {
        setTrendsLoading(false);
      }
    };

    const debounce = setTimeout(fetchTrends, 400);
    return () => clearTimeout(debounce);
  }, [originIata, dateRange?.from, hasFlight]);

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
    { id: "adventure", label: "Adventure", emoji: "🎢" },
    { id: "shopping", label: "Shopping", emoji: "🛍️" },
    { id: "nightlife", label: "Nightlife", emoji: "🍸" },
    { id: "relax", label: "Relax", emoji: "💆" },
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
    <form onSubmit={handleSubmit} className="animate-slide-up max-w-2xl mx-auto space-y-8 py-4">
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
                    getFlightTrends(originIata.trim().toUpperCase() || "BKK", "NRT", dateStr)
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
          {travelerTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setTravelerType(type.id)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${travelerType === type.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
                }`}
            >
              <type.icon className="w-6 h-6" />
              <span className="text-sm font-medium leading-tight">{type.label}</span>
              <span className={`text-[10px] leading-tight ${travelerType === type.id ? "text-primary/70" : "text-muted-foreground"
                }`}>{type.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">What is your travel style?</Label>
        <div className="grid grid-cols-3 gap-3">
          {budgetLevels.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => setBudget(level.id)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${budget === level.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
                }`}
            >
              <level.icon className="w-6 h-6" />
              <span className="text-sm font-medium">{level.label}</span>
              <span className={`text-[10px] ${budget === level.id ? "text-primary/70" : "text-muted-foreground"
                }`}>{level.desc}</span>
            </button>
          ))}
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
          {activityOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleActivity(opt.id)}
              className={`flex flex-col items-center justify-center gap-2 p-3 w-[100px] sm:w-[110px] h-[95px] rounded-2xl border-2 transition-all relative overflow-hidden ${activities.includes(opt.id)
                ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-md"
                : "border-border hover:border-primary/30 bg-card text-foreground hover:-translate-y-1 hover:shadow-sm"
                }`}
            >
              {activities.includes(opt.id) && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
              <span className="text-3xl drop-shadow-sm">{opt.emoji}</span>
              <span className="text-xs font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">What is your preferred travel pace?</Label>
        <div className="grid grid-cols-3 gap-3">
          {paceOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPace(option.id)}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${pace === option.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/20 bg-card"
                }`}
            >
              <option.icon className={`w-6 h-6 ${option.id === "packed" ? "animate-pulse" : ""}`} />
              <span className="text-sm font-medium">{option.label}</span>
              <span className={`text-[10px] leading-tight ${pace === option.id ? "text-primary/70" : "text-muted-foreground"
                }`}>{option.desc}</span>
            </button>
          ))}
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
            <span>Back to Vision Results</span>
          </Button>
        )}
        <Button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 w-full h-11 px-6 rounded-xl travel-gradient text-white font-semibold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate Itinerary</span>
        </Button>
      </div>
    </form>
  );
};

export default TripPreferencesForm;
