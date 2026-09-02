import { Check } from "lucide-react";

const steps = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Locations" },
  { id: 3, label: "Preferences" },
  { id: 4, label: "Itinerary" },
];

interface StepIndicatorProps {
  currentStep: number;
  maxUnlockedStep?: number;
  onStepClick?: (stepIndex: number) => void;
}

const StepIndicator = ({ currentStep, maxUnlockedStep = currentStep, onStepClick }: StepIndicatorProps) => {
  return (
    <div className="mb-8 flex items-center justify-center">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((step, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          const isUnlocked = i <= maxUnlockedStep || i <= currentStep;

          return (
            <li key={step.id} className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={() => isUnlocked && onStepClick?.(i)}
                className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3.5 sm:text-sm ${
                  isCurrent
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : isComplete
                    ? "text-foreground hover:bg-secondary cursor-pointer"
                    : "cursor-not-allowed text-muted-foreground/50"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    isCurrent
                      ? "bg-white/20 text-white dark:bg-black/20 dark:text-slate-900"
                      : isComplete
                      ? "bg-sky-500 text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isComplete ? <Check className="size-3 stroke-[3]" /> : step.id}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>

              {i < steps.length - 1 && (
                <div
                  className={`h-px w-4 sm:w-8 transition-colors ${
                    i < currentStep ? "bg-sky-500/70" : "bg-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default StepIndicator;

