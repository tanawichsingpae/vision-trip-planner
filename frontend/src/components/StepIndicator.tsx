import { Check, Upload, Eye, MapPin, SlidersHorizontal, MessageSquare } from "lucide-react";

const steps = [
  { icon: Upload, label: "Upload" },
  { icon: Eye, label: "Vision AI" },
  { icon: SlidersHorizontal, label: "Preferences" },
  { icon: MapPin, label: "Itinerary" },
  { icon: MessageSquare, label: "Customize" },
];

interface StepIndicatorProps {
  currentStep: number;
  maxUnlockedStep?: number;
  onStepClick?: (stepIndex: number) => void;
}

const StepIndicator = ({ currentStep, maxUnlockedStep = currentStep, onStepClick }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto mb-10">
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const isClickable = onStepClick && (i <= maxUnlockedStep || i <= currentStep);

        return (
          <div key={step.label} className="flex items-center gap-2">
            <div
              className={`flex flex-col items-center group ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => isClickable && onStepClick?.(i)}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isComplete
                    ? "travel-gradient text-primary-foreground shadow-md group-hover:scale-110"
                    : isCurrent
                    ? "border-2 border-primary text-primary bg-primary/10 group-hover:scale-105 shadow-sm"
                    : "border-2 border-border text-muted-foreground group-hover:border-border/80"
                }`}
              >
                {isComplete ? <Check className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] mt-1 transition-colors ${isCurrent ? "text-primary font-bold" : "text-muted-foreground group-hover:text-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 rounded-full ${i < currentStep ? "travel-gradient" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
