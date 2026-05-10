import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Wallet, 
  Map, 
  Zap, 
  Calendar,
  Check
} from "lucide-react";

export interface TripPreferences {
  days: number;
  travelerType: string;
  budget: string;
  activities: string[];
  pace: string;
}

interface TripPreferencesFormProps {
  onSubmit: (preferences: TripPreferences) => void;
}

const TripPreferencesForm = ({ onSubmit }: TripPreferencesFormProps) => {
  const [days, setDays] = useState(3);
  const [travelerType, setTravelerType] = useState("solo");
  const [budget, setBudget] = useState("medium");
  const [activities, setActivities] = useState<string[]>(["culture", "food"]);
  const [pace, setPace] = useState("balanced");

  const travelerTypes = [
    { id: "solo", label: "Solo", icon: Users },
    { id: "couple", label: "Couple", icon: Users },
    { id: "friends", label: "Friends", icon: Users },
    { id: "family", label: "Family", icon: Users },
  ];

  const budgetLevels = [
    { id: "low", label: "Low", icon: Wallet },
    { id: "medium", label: "Medium", icon: Wallet },
    { id: "high", label: "High", icon: Wallet },
  ];

  const activityOptions = [
    { id: "culture", label: "Culture" },
    { id: "food", label: "Food" },
    { id: "nature", label: "Nature" },
    { id: "adventure", label: "Adventure" },
    { id: "shopping", label: "Shopping" },
  ];

  const paceOptions = [
    { id: "relaxed", label: "Relaxed", icon: Zap },
    { id: "balanced", label: "Balanced", icon: Zap },
    { id: "packed", label: "Packed", icon: Zap },
  ];

  const toggleActivity = (id: string) => {
    setActivities(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ days, travelerType, budget, activities, pace });
  };

  return (
    <form onSubmit={handleSubmit} className="animate-slide-up max-w-2xl mx-auto space-y-8 py-4">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-foreground">Trip Preferences</h3>
        <p className="text-muted-foreground mt-2">Tell us more about how you like to travel</p>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">How many days is your trip?</Label>
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-primary" />
          <Input 
            type="number" 
            min={1} 
            max={30} 
            value={days} 
            onChange={(e) => setDays(parseInt(e.target.value) || 1)}
            className="w-24 text-center text-lg font-bold"
          />
          <span className="text-lg font-medium">Days</span>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">Who are you traveling with?</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {travelerTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setTravelerType(type.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                travelerType === type.id 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border hover:border-primary/20 bg-card"
              }`}
            >
              <type.icon className="w-6 h-6" />
              <span className="text-sm font-medium">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">What is your budget level?</Label>
        <div className="grid grid-cols-3 gap-3">
          {budgetLevels.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => setBudget(level.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                budget === level.id 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border hover:border-primary/20 bg-card"
              }`}
            >
              <level.icon className="w-6 h-6" />
              <span className="text-sm font-medium">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">What activities do you prefer?</Label>
        <div className="flex flex-wrap gap-2">
          {activityOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleActivity(opt.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                activities.includes(opt.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/20 bg-card text-foreground"
              }`}
            >
              {activities.includes(opt.id) && <Check className="w-4 h-4" />}
              <span className="text-sm font-medium">{opt.label}</span>
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
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                pace === option.id 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border hover:border-primary/20 bg-card"
              }`}
            >
              <option.icon className={`w-6 h-6 ${option.id === "packed" ? "animate-pulse" : ""}`} />
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6">
        <Button type="submit" className="w-full text-lg h-12 travel-gradient text-white font-bold shadow-lg">
          Generate Personalized Itinerary
        </Button>
      </div>
    </form>
  );
};

export default TripPreferencesForm;
