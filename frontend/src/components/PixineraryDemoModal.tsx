import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudSun,
  Compass,
  Download,
  GripVertical,
  ImagePlus,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  Pause,
  Plane,
  Play,
  ScanLine,
  Sparkles,
  Utensils,
  WalletCards,
  WandSparkles,
  Waves,
  X,
} from "lucide-react";

interface StepItem {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  shortLabel: string;
  icon: typeof ImagePlus;
}

const DEMO_STEPS: StepItem[] = [
  {
    number: "01",
    eyebrow: "SEE THE WORLD DIFFERENTLY",
    title: "Upload Photos & Let AI Recognize Destinations",
    shortLabel: "Image Recognition",
    description: "Vision AI and the CLIP encoder scan and extract landmark features in seconds.",
    icon: ImagePlus,
  },
  {
    number: "02",
    eyebrow: "UNDERSTAND YOUR PLACE",
    title: "Discover Precise Landmarks & Spatial Data",
    shortLabel: "Landmark Detection",
    description: "Retrieve GPS coordinates, AI confidence scores, and real-time destination weather.",
    icon: LocateFixed,
  },
  {
    number: "03",
    eyebrow: "MAKE IT YOURS",
    title: "Tailor Trip Preferences & Travel Style",
    shortLabel: "Trip Preferences",
    description: "Select duration, budget level, and travel pace (Chill, Foodie, Culture, or Adventure).",
    icon: WandSparkles,
  },
  {
    number: "04",
    eyebrow: "YOUR TRIP, ILLUMINATED",
    title: "Ready-to-Travel AI Itinerary & Route Map",
    shortLabel: "AI Itinerary & Map",
    description: "Drag-and-drop schedule sequence, visual route planning, and instant PDF/HTML export.",
    icon: Map,
  },
];

export interface PixineraryDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PixineraryDemoModal({ isOpen, onClose }: PixineraryDemoModalProps) {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Auto-play timer
  useEffect(() => {
    if (!isOpen || !autoPlay) return;
    // 4 steps x 5 seconds = exactly 20 seconds total demo cycle
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % DEMO_STEPS.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isOpen, autoPlay]);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const current = DEMO_STEPS[step];
  const goNext = () => setStep((val) => Math.min(val + 1, DEMO_STEPS.length - 1));
  const goPrevious = () => setStep((val) => Math.max(val - 1, 0));

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6 animate-in fade-in duration-200"
        >
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative my-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-border/80 bg-card/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* Ambient decorative gradient glows */}
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-violet-400/20 blur-3xl" />

            {/* Top Modal Header */}
            <div className="relative flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-md shadow-sky-500/20">
                  <Plane className="size-4 -rotate-12" />
                </div>
                <div>
                  <h2 id="demo-modal-title" className="text-base font-bold tracking-tight text-foreground leading-tight">
                    Pixinerary <span className="font-normal text-muted-foreground text-xs">/ Vision Trip Planner</span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Interactive 4-Step Product Walkthrough
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Auto-play toggle */}
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
                  <span className="hidden sm:inline text-[11px] font-medium">Auto-play</span>
                  <Switch
                    checked={autoPlay}
                    onCheckedChange={setAutoPlay}
                    aria-label="Toggle auto-play"
                    className="scale-75"
                  />
                  {autoPlay ? (
                    <Pause className="size-3 text-sky-600 dark:text-sky-400" />
                  ) : (
                    <Play className="size-3 text-muted-foreground" />
                  )}
                </div>

                {/* Close 'X' Button */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close demo"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="border-b border-border/70 px-5 pt-5 pb-4 sm:px-8">
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                {DEMO_STEPS.map((item, index) => {
                  const isActive = index === step;
                  const isCompleted = index < step;
                  return (
                    <button
                      key={item.number}
                      type="button"
                      onClick={() => {
                        setStep(index);
                        setAutoPlay(false);
                      }}
                      className="group text-left transition-all cursor-pointer focus:outline-none"
                      aria-label={`Go to step ${index + 1}`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-all shadow-xs",
                            isActive
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 ring-2 ring-sky-500/40"
                              : isCompleted
                              ? "bg-sky-500 text-white"
                              : "bg-secondary text-muted-foreground group-hover:bg-muted"
                          )}
                        >
                          {isCompleted ? <Check className="size-3 stroke-[3]" /> : item.number}
                        </span>
                        <span
                          className={cn(
                            "hidden sm:block truncate text-xs font-semibold transition-colors",
                            isActive ? "text-foreground font-bold" : "text-muted-foreground"
                          )}
                        >
                          {item.shortLabel}
                        </span>
                      </div>
                      <Progress
                        value={isActive ? 100 : isCompleted ? 100 : 0}
                        className={cn(
                          "h-1 transition-all",
                          isActive && "bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-sky-400 [&>div]:to-violet-500"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Showcase Stage */}
            <div className="p-5 sm:p-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Step Eyebrow & Title */}
                  <div className="mb-5 max-w-xl">
                    <p className="mb-1 text-[10px] font-bold tracking-[0.2em] text-sky-600 dark:text-sky-400">
                      STEP {current.number} · {current.eyebrow}
                    </p>
                    <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {current.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {current.description}
                    </p>
                  </div>

                  {/* Step Visual Preview */}
                  <StepPreview step={step} />
                </motion.div>
              </AnimatePresence>

              {/* Bottom Navigation & Close Controls */}
              <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center">
                <div className="flex items-center justify-between gap-2.5 sm:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={goPrevious}
                    disabled={step === 0}
                    className="rounded-xl border-border text-xs font-semibold gap-1.5 h-8 px-3"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Previous</span>
                  </Button>

                  <div className="flex items-center gap-1.5 px-2">
                    {DEMO_STEPS.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setStep(index);
                          setAutoPlay(false);
                        }}
                        aria-label={`Jump to step ${index + 1}`}
                        className={cn(
                          "size-2 rounded-full transition-all duration-300",
                          index === step ? "w-5 bg-sky-500" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        )}
                      />
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={goNext}
                    disabled={step === DEMO_STEPS.length - 1}
                    className="rounded-xl border-border text-xs font-semibold gap-1.5 h-8 px-3"
                  >
                    <span>Next</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 px-4 text-xs font-semibold shadow-md transition-all gap-1.5"
                >
                  <X className="size-3.5" />
                  <span>Close Demo</span>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEWS FOR EACH STEP
// ─────────────────────────────────────────────────────────────────────────────

function StepPreview({ step }: { step: number }) {
  if (step === 0) return <PreviewUploadScan />;
  if (step === 1) return <PreviewLandmarkDetection />;
  if (step === 2) return <PreviewTripPreferences />;
  return <PreviewItineraryMap />;
}

/** Step 01: Photo Upload & AI Vision Scan */
function PreviewUploadScan() {
  return (
    <Card className="relative min-h-[260px] overflow-hidden border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-violet-50/80 shadow-inner dark:border-sky-400/20 dark:from-sky-950/20 dark:via-slate-900 dark:to-violet-950/20 rounded-2xl">
      <CardContent className="relative flex min-h-[260px] items-center justify-center p-6">
        <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-sky-300/80 dark:border-sky-700/50" />

        <div className="relative z-10 flex flex-col items-center justify-center rounded-2xl border border-white/80 bg-white/85 px-6 py-5 shadow-xl shadow-sky-900/10 backdrop-blur-md dark:border-white/10 dark:bg-slate-800/80">
          <div className="grid size-14 place-items-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300 shadow-xs mb-2.5">
            <ImagePlus className="size-7" />
          </div>
          <p className="text-center text-sm font-bold text-foreground">
            Drop your travel photos here
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground text-center">
            Upload landmark, street, or destination images
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
            <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px]">JPG</span>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px]">PNG</span>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px]">WEBP</span>
          </div>
        </div>

        <motion.div
          animate={{ y: [-95, 95, -95] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute left-8 right-8 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_18px_4px_rgba(56,189,248,0.55)]"
        />

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-3.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm dark:bg-white/90 dark:text-slate-900">
          <ScanLine className="size-3.5 text-sky-400 dark:text-sky-600 animate-pulse" />
          <span>AI Vision & CLIP scanner active</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Step 02: Smart Landmark Detection & Confidence */
function PreviewLandmarkDetection() {
  return (
    <Card className="border-border/80 bg-card/60 shadow-inner rounded-2xl overflow-hidden">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[1.1fr_1fr] sm:p-5">
        <div className="relative flex min-h-[210px] items-end overflow-hidden rounded-2xl bg-gradient-to-br from-amber-200 via-orange-100 to-sky-200 p-4 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent" />

          <div className="relative z-10 rounded-xl bg-white/90 p-3 shadow-lg backdrop-blur-md dark:bg-slate-900/90 w-full">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Recognized Landmark
            </p>
            <h4 className="mt-0.5 text-base font-bold text-foreground">Wat Arun (Temple of Dawn)</h4>
            <p className="text-xs text-muted-foreground">Bangkok, Thailand</p>
          </div>

          <Badge className="absolute right-3 top-3 bg-white/90 text-slate-800 shadow-sm backdrop-blur-md hover:bg-white dark:bg-slate-900/90 dark:text-white text-[10px]">
            <MapPin className="mr-1 size-3 text-sky-500" /> 13.7437° N
          </Badge>
        </div>

        <div className="flex flex-col justify-center gap-3">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Visual AI Confidence
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-foreground tracking-tight">98.4%</span>
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-300/50"
              >
                <Sparkles className="size-3 mr-1" /> High CLIP Match
              </Badge>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "98.4%" }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-violet-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <CloudSun className="size-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">28°C · Sunny & Clear</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Optimal: Morning</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-foreground">Outlier Detector</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Verified POI
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Step 03: Trip Preferences Customization */
function PreviewTripPreferences() {
  const [days, setDays] = useState(3);
  const [selectedStyle, setSelectedStyle] = useState("culture");

  const styles = [
    { id: "chill", label: "Chill", desc: "Relaxed pace", icon: Waves, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700" },
    { id: "foodie", label: "Foodie", desc: "Local cuisine", icon: Utensils, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700" },
    { id: "culture", label: "Culture", desc: "Heritage & temples", icon: Compass, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700" },
    { id: "adventure", label: "Adventure", desc: "Explore outdoors", icon: Sparkles, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700" },
  ];

  return (
    <Card className="border-border/80 bg-card/60 shadow-inner rounded-2xl overflow-hidden">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[1.2fr_.8fr] sm:p-5">
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Trip Duration
            </span>
            <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300/40 font-bold text-[11px]">
              {days} Days
            </Badge>
          </div>

          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "size-8 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  days === d
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm scale-105"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
              >
                {d}D
              </button>
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Select Travel Style
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {styles.map((s) => {
                const Icon = s.icon;
                const isSelected = selectedStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStyle(s.id)}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-2 text-left transition-all cursor-pointer",
                      isSelected ? `${s.bg} ring-2 ring-sky-500/40 shadow-xs` : "border-border/70 bg-card hover:bg-secondary/40"
                    )}
                  >
                    <Icon className={cn("size-3.5 shrink-0 mt-0.5", s.color)} />
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl bg-slate-950 p-4 text-white dark:bg-slate-900/90 border border-slate-800 shadow-md">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
              Trip Persona
            </p>
            <h4 className="mt-1 text-base font-bold">Curious & Balanced</h4>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Curated for culturally rich mornings and relaxed culinary evenings.
            </p>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-slate-800 pt-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <WalletCards className="size-3.5 text-sky-400" />
              <span className="text-[11px]">Budget: Mid-range Comfort</span>
            </div>
            <div className="flex items-center gap-2">
              <Compass className="size-3.5 text-violet-400" />
              <span className="text-[11px]">Pace: 3-4 Activities / Day</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Step 04: AI Itinerary & Interactive Route Map */
function PreviewItineraryMap() {
  const schedule = [
    { time: "09:00", title: "Wat Arun Sunrise & Riverside Walk", tag: "Attraction" },
    { time: "11:30", title: "Tha Tien Heritage & Local Cuisine", tag: "Food" },
    { time: "14:00", title: "Grand Palace & Wat Phra Kaew", tag: "Attraction" },
  ];

  return (
    <Card className="border-border/80 bg-card/60 shadow-inner rounded-2xl overflow-hidden">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[1.1fr_1fr] sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-0.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                Day 01 · Itinerary Schedule
              </p>
              <h4 className="text-sm font-bold text-foreground">Temples & Riverside Flavours</h4>
            </div>
            <Button variant="ghost" size="icon" className="size-7 rounded-full" title="Export Itinerary">
              <Download className="size-3.5 text-muted-foreground" />
            </Button>
          </div>

          {schedule.map((item) => (
            <div
              key={item.time}
              className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 shadow-xs hover:border-sky-300 transition-colors"
            >
              <GripVertical className="size-3 text-muted-foreground/40 shrink-0" />
              <span className="rounded-md bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 shrink-0">
                {item.time}
              </span>
              <p className="flex-1 text-xs font-semibold text-foreground truncate">{item.title}</p>
              <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
                {item.tag}
              </Badge>
            </div>
          ))}
        </div>

        <div className="relative min-h-[190px] overflow-hidden rounded-2xl bg-[#dff1eb] dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 shadow-inner">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(30deg, transparent 48%, #76b9aa 49%, transparent 51%), linear-gradient(120deg, transparent 48%, #76b9aa 49%, transparent 51%)",
              backgroundSize: "44px 44px",
            }}
          />

          <svg viewBox="0 0 400 240" className="absolute inset-0 size-full p-4" aria-label="Optimized travel route map">
            <path
              d="M48 178 C 95 70, 155 170, 205 70 S 318 74, 350 45"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="7 7"
            />
            <circle cx="48" cy="178" r="9" fill="#0ea5e9" stroke="white" strokeWidth="3" />
            <text x="48" y="182" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">1</text>
            <circle cx="205" cy="70" r="9" fill="#8b5cf6" stroke="white" strokeWidth="3" />
            <text x="205" y="74" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">2</text>
            <circle cx="350" cy="45" r="9" fill="#f97316" stroke="white" strokeWidth="3" />
            <text x="350" y="49" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">3</text>
          </svg>

          <div className="absolute bottom-2.5 left-2.5 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur-md dark:bg-slate-900/90 dark:text-white border border-border/50">
            <Navigation className="mr-1 inline size-3 text-violet-600 dark:text-violet-400" />
            Spatial TSP Route Optimized
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
