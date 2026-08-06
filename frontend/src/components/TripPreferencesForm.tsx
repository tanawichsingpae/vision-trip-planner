import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type TripPreferences } from "@/services/aiService";
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
  ChevronDown
} from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format, differenceInDays } from "date-fns";

interface TripPreferencesFormProps {
  onSubmit: (preferences: TripPreferences) => void;
}

const TripPreferencesForm = ({ onSubmit }: TripPreferencesFormProps) => {
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
  const [activities, setActivities] = useState<string[]>([]);
  const [pace, setPace] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange?.from || !dateRange?.to || !travelerType || !budget || !pace || activities.length === 0) return;
    onSubmit({
      startDate: dateRange.from,
      endDate: dateRange.to,
      days,
      travelerType,
      budget,
      activities,
      pace,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="animate-slide-up max-w-2xl mx-auto space-y-8 py-4">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-foreground">Trip Preferences</h3>
        <p className="text-muted-foreground mt-2">Tell us more about how you like to travel</p>
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

      <div className="pt-6">
        <Button
          type="submit"
          disabled={!dateRange?.from || !dateRange?.to || !travelerType || !budget || !pace || activities.length === 0}
          className="w-full text-lg h-12 travel-gradient text-white font-bold shadow-lg disabled:opacity-50"
        >
          Generate Personalized Itinerary
        </Button>
      </div>
    </form>
  );
};

export default TripPreferencesForm;
