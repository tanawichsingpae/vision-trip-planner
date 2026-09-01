import { Check, Upload, Eye, MapPin, SlidersHorizontal } from "lucide-react";

const steps = [
  { icon: Upload, label: "Upload" },
  { icon: Eye, label: "Vision AI" },
  { icon: SlidersHorizontal, label: "Preferences" },
  { icon: MapPin, label: "Itinerary" },
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
          <div key={step.label} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`flex flex-col items-center group transition-transform ${isClickable ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
              onClick={() => isClickable && onStepClick?.(i)}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isComplete
                    ? "bg-[#188c91] text-white shadow-[0_4px_14px_rgba(24,140,145,0.35)]"
                    : isCurrent
                    ? "bg-white border-2 border-[#126c78] text-[#126c78] shadow-[0_4px_14px_rgba(18,108,120,0.2)] ring-4 ring-[#126c78]/15"
                    : "border-2 border-border/80 text-muted-foreground/80 bg-white/60 group-hover:border-primary/40"
                }`}
              >
                {isComplete ? (
                  <Check className="w-5 h-5 text-white stroke-[2.5]" />
                ) : (
                  <step.icon className={`w-5 h-5 ${isCurrent ? "text-[#126c78] stroke-[2.2]" : ""}`} />
                )}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium transition-colors ${
                  isCurrent
                    ? "text-[#126c78] font-bold"
                    : isComplete
                    ? "text-[#188c91] font-semibold"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-1 mb-5 rounded-full transition-all duration-500 ${
                  i < currentStep ? "bg-gradient-to-r from-[#188c91] to-[#67c4bd]" : "bg-border/60"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
