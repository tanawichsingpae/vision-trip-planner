import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Brain, Map, Cpu, Sparkles, CheckCircle2, CalendarDays, CloudSun, Settings, MapPin } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
}

interface AnalyzingOverlayProps {
  isAnalyzing: boolean;
  loadingStep: string;
  useClip: boolean;
  type?: "vision" | "itinerary";
}

// ─── Step definitions ──────────────────────────────────────────────────────────

const STEPS_WITH_CLIP: PipelineStep[] = [
  { id: "vision",      icon: Camera,     label: "Analyzing image with Vision AI",      color: "text-blue-500",    bgColor: "bg-blue-50"    },
  { id: "candidates", icon: Brain,      label: "Generating location candidates",       color: "text-violet-500",  bgColor: "bg-violet-50"  },
  { id: "places",     icon: Map,        label: "Fetching Google Places data",          color: "text-emerald-500", bgColor: "bg-emerald-50" },
  { id: "clip",       icon: Cpu,        label: "Computing CLIP visual similarity",     color: "text-orange-500",  bgColor: "bg-orange-50"  },
  { id: "finalize",   icon: Sparkles,   label: "Finalizing best match",                color: "text-pink-500",    bgColor: "bg-pink-50"    },
];

const STEPS_WITHOUT_CLIP: PipelineStep[] = [
  { id: "vision",      icon: Camera,     label: "Analyzing image with Vision AI",      color: "text-blue-500",    bgColor: "bg-blue-50"    },
  { id: "candidates", icon: Brain,      label: "Generating location candidates",       color: "text-violet-500",  bgColor: "bg-violet-50"  },
  { id: "places",     icon: Map,        label: "Fetching Google Places data",          color: "text-emerald-500", bgColor: "bg-emerald-50" },
  { id: "finalize",   icon: Sparkles,   label: "Finalizing best match",                color: "text-pink-500",    bgColor: "bg-pink-50"    },
];

const STEPS_ITINERARY: PipelineStep[] = [
  { id: "prefs",      icon: Settings,     label: "Analyzing Preferences",          color: "text-blue-500",    bgColor: "bg-blue-50"    },
  { id: "gen_plan",   icon: CalendarDays, label: "Generating Travel Itinerary",              color: "text-violet-500",  bgColor: "bg-violet-50"  },
  { id: "map_sum",    icon: Map,          label: "Plotting Itinerary Map",           color: "text-orange-500",  bgColor: "bg-orange-50"  },
  { id: "weather",    icon: CloudSun,     label: "Fetching Weather Data",               color: "text-emerald-500", bgColor: "bg-emerald-50" },
];

// Milliseconds each step stays highlighted before advancing (purely cosmetic)
const STEP_DURATION_MS = 5000;

// ─── Animated Map Pin ────────────────────────────────────────────────────────

const MapPinScene = ({ progress }: { progress: number }) => (
  <div className="relative w-full h-24 overflow-hidden mb-2 rounded-xl bg-slate-50/50 border border-slate-100">
    {/* Subtle grid background to look like a map */}
    <div 
      className="absolute inset-0 opacity-20" 
      style={{
        backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
        backgroundSize: "16px 16px"
      }}
    />

    {/* Trail and Map Pin Container */}
    <div className="absolute top-1/2 -translate-y-1/2 left-[8%] right-[12%] h-[2px] z-10">
      {/* Dotted trail */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(90deg, #cbd5e1 0, #cbd5e1 6px, transparent 6px, transparent 14px)",
        }}
      />

      {/* Map Pin moving across based on progress */}
      <motion.div
        className="absolute top-1/2 -translate-x-1/2"
        style={{ y: "-50%" }}
        initial={{ left: "0%" }}
        animate={{ left: `${progress * 100}%` }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
      >
        {/* Bounce animation triggered on progress change */}
        <motion.div
          key={progress}
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Spinning animation */}
          <motion.div
            animate={{ rotateY: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="flex items-center justify-center origin-bottom"
          >
            <MapPin className="w-10 h-10 text-red-500 fill-red-500 drop-shadow-md" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  </div>
);



// ─── Main Component ────────────────────────────────────────────────────────────

export const AnalyzingOverlay = ({ isAnalyzing, loadingStep, useClip, type = "vision" }: AnalyzingOverlayProps) => {
  const steps = type === "itinerary" ? STEPS_ITINERARY : (useClip ? STEPS_WITH_CLIP : STEPS_WITHOUT_CLIP);
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset index whenever a fresh analysis starts
  useEffect(() => {
    if (!isAnalyzing) {
      setActiveIdx(0);
    }
  }, [isAnalyzing]);

  // Sync active step with real loadingStep string from the pipeline.
  // Always use Math.max to ensure the step never goes backward.
  useEffect(() => {
    if (!isAnalyzing) return;
    const lower = loadingStep.toLowerCase();

    let nextIdx = -1;

    if (type === "itinerary") {
      if (lower.includes("weather"))     nextIdx = 3;
      else if (lower.includes("map"))    nextIdx = 2;
      else if (lower.includes("itinerary")) nextIdx = 1;
      else if (lower.includes("preferences")) nextIdx = 0;
    } else {
      if (lower.includes("placing") || lower.includes("google") || lower.includes("places")) {
        nextIdx = 2;
      } else if (lower.includes("clip") || lower.includes("similarity")) {
        nextIdx = useClip ? 3 : 2;
      } else if (lower.includes("finaliz") || lower.includes("best match") || lower.includes("reasoning")) {
        nextIdx = steps.length - 1;
      } else if (lower.includes("candidate") || lower.includes("location")) {
        nextIdx = 1;
      } else if (lower.includes("vision") || lower.includes("model") || lower.includes("analyzing")) {
        nextIdx = 0;
      }
    }

    if (nextIdx >= 0) {
      setActiveIdx((prev) => Math.max(prev, nextIdx));
    }
  }, [loadingStep, isAnalyzing, useClip, steps.length, type]);

  return (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div
          key="analyzing-overlay"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full"
        >
          {/* Card */}
          <div className="bg-card border border-border rounded-3xl shadow-lg p-6 md:p-8 overflow-hidden">

            {/* Map Pin scene */}
            <MapPinScene progress={activeIdx / (steps.length - 1)} />

            {/* Status headline */}
            <div className="text-center mb-6">
              <motion.p
                key={loadingStep}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-base font-semibold text-foreground"
              >
                {loadingStep}
              </motion.p>
              <p className="text-xs text-muted-foreground mt-1">
                {type === "itinerary" 
                  ? "Crafting your personalized travel experience..."
                  : (useClip
                      ? "Running full CLIP visual pipeline — this may take 15–30 seconds"
                      : "Running fast LLM pipeline — usually under 10 seconds")}
              </p>
            </div>

            {/* Step list */}
            <div className="space-y-2">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isDone = idx < activeIdx;
                const isActive = idx === activeIdx;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.07 }}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-300 ${
                      isActive
                        ? `${step.bgColor} border border-current/10`
                        : isDone
                        ? "bg-muted/40"
                        : "bg-transparent"
                    }`}
                  >
                    {/* Icon / spinner / check */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                        isActive ? step.bgColor : isDone ? "bg-emerald-50" : "bg-muted"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isActive ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                        >
                          <Icon className={`w-4 h-4 ${step.color}`} />
                        </motion.div>
                      ) : (
                        <Icon className="w-4 h-4 text-muted-foreground/50" />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`text-sm font-medium transition-colors duration-300 ${
                        isActive
                          ? `${step.color} font-bold`
                          : isDone
                          ? "text-muted-foreground/40"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {step.label}
                    </span>

                    {/* Active pulse dot */}
                    {isActive && (
                      <motion.span
                        className={`ml-auto w-2 h-2 rounded-full shrink-0 ${step.color.replace("text-", "bg-")}`}
                        animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalyzingOverlay;
