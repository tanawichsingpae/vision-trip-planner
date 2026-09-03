import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Brain,
  Map,
  Cpu,
  Sparkles,
  CheckCircle2,
  CalendarDays,
  CloudSun,
  Settings,
  Plane,
  Compass,
  Lightbulb,
  Utensils,
  SunMedium,
  Camera as CameraIcon,
  Heart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PipelineStep {
  id: string;
  icon: React.ElementType;
  label: string;
  detail: string;
  color: string;
  bgColor: string;
}

interface AnalyzingOverlayProps {
  isAnalyzing: boolean;
  loadingStep: string;
  useClip: boolean;
  type?: "vision" | "itinerary";
}

interface TriviaTip {
  id: number;
  category: "tip" | "food" | "photo" | "route" | "weather";
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
}

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  size: number;
  rotation: number;
}

// ─── Step Definitions ──────────────────────────────────────────────────────────

const STEPS_WITH_CLIP: PipelineStep[] = [
  { id: "vision", icon: Camera, label: "Analyzing Image with Vision AI", detail: "Scanning architecture, scenery & landmarks...", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "candidates", icon: Brain, label: "Generating Location Candidates", detail: "Matching visual features against world POIs...", color: "text-violet-500", bgColor: "bg-violet-500/10" },
  { id: "places", icon: Map, label: "Fetching Google Places Data", detail: "Resolving verified coordinates, ratings & photos...", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { id: "clip", icon: Cpu, label: "Computing CLIP Visual Similarity", detail: "Measuring 512-dim embedding cosine similarity...", color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { id: "finalize", icon: Sparkles, label: "Finalizing Best Landmark Match", detail: "Ranking candidates & preparing recommendations...", color: "text-pink-500", bgColor: "bg-pink-500/10" },
];

const STEPS_WITHOUT_CLIP: PipelineStep[] = [
  { id: "vision", icon: Camera, label: "Analyzing Image with Vision AI", detail: "Scanning architecture, scenery & landmarks...", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "candidates", icon: Brain, label: "Generating Location Candidates", detail: "Matching visual features against world POIs...", color: "text-violet-500", bgColor: "bg-violet-500/10" },
  { id: "places", icon: Map, label: "Fetching Google Places Data", detail: "Resolving verified coordinates, ratings & photos...", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { id: "finalize", icon: Sparkles, label: "Finalizing Best Landmark Match", detail: "Ranking candidates & preparing recommendations...", color: "text-pink-500", bgColor: "bg-pink-500/10" },
];

const STEPS_ITINERARY: PipelineStep[] = [
  { id: "prefs", icon: Settings, label: "Analyzing Travel Preferences", detail: "Synthesizing traveler style, dates & budget...", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "gen_plan", icon: CalendarDays, label: "Spatial Clustering & AI Routing", detail: "Partitioning days via K-Means without backtracking...", color: "text-violet-500", bgColor: "bg-violet-500/10" },
  { id: "map_sum", icon: Map, label: "Plotting Itinerary Map & HD Photos", detail: "Enriching Google Places coordinates & photos...", color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { id: "weather", icon: CloudSun, label: "Syncing Live Weather & Environment", detail: "Fetching hourly forecast, rain chance & air quality...", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
];

// ─── Curated Travel Trivia & Tips Carousel ────────────────────────────────────

const TRAVEL_TRIVIA: TriviaTip[] = [
  {
    id: 1,
    category: "photo",
    icon: CameraIcon,
    badge: "Golden Hour Photo Tip",
    badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    title: "ช่วงเวลาแสงทอง 17:00 – 18:30 น.",
    description: "AI จะจัดจุดชมวิวและแลนด์มาร์กสวยๆ ไว้ช่วงเวลานี้ เพื่อให้ได้แสงพระอาทิตย์ตกนุ่มนวลและภาพถ่ายที่น่าประทับใจที่สุด",
  },
  {
    id: 2,
    category: "food",
    icon: Utensils,
    badge: "Foodie Smart Route",
    badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    title: "จับคู่ร้านอาหารท้องถิ่นช่วงเที่ยง",
    description: "ระบบจับคู่ร้านอาหารเด็ดประจำย่านที่อยู่ใกล้สถานที่เที่ยวช่วงเช้าเสมอ เพื่อให้คุณอิ่มอร่อยโดยไม่ต้องนั่งรถไกล",
  },
  {
    id: 3,
    category: "route",
    icon: Compass,
    badge: "Non-Backtracking AI",
    badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    title: "เดินทางเรียงตามโซน ไม่ย้อนไปมา",
    description: "ด้วยอัลกอริทึม Macro-TSP สถานที่ในวันเดียวกันจะถูกจัดให้อยู่ในโซนติดกัน ช่วยประหยัดเวลาเดินทางได้ถึง 40%",
  },
  {
    id: 4,
    category: "weather",
    icon: SunMedium,
    badge: "Weather Adaptive",
    badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    title: "พยากรณ์อากาศและคำแนะนำกิจกรรม",
    description: "ดึงข้อมูลสภาพอากาศ อุณหภูมิ และค่า UV รายชั่วโมงล่วงหน้า เพื่อให้คุณเตรียมอุปกรณ์และเสื้อผ้าได้อย่างมั่นใจ",
  },
  {
    id: 5,
    category: "tip",
    icon: Lightbulb,
    badge: "Travel Pace Balance",
    badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    title: "สมดุลเวลาและการพักผ่อน",
    description: "มีการเว้นช่วงเวลาสบายๆ สำหรับเดินทางและเดินเล่นชมบรรยากาศ เพื่อไม่ให้ทริปของคุณแน่นและเหนื่อยเกินไป",
  },
];

// ─── Flight Map 3D Scene Component ──────────────────────────────────────────

const FlightMapScene = ({ progress, type }: { progress: number; type: "vision" | "itinerary" }) => {
  const safeProgress = Math.min(Math.max(progress, 0.05), 1);

  // Landmark Waypoints along the flight path
  const waypoints = useMemo(() => {
    if (type === "itinerary") {
      return [
        { label: "Preferences", pos: 0.1, icon: "⚙️" },
        { label: "Day 1: Arrival", pos: 0.38, icon: "📍" },
        { label: "Day 2: Scenery", pos: 0.68, icon: "🌴" },
        { label: "Final Plan", pos: 0.95, icon: "✨" },
      ];
    }
    return [
      { label: "Photo Upload", pos: 0.1, icon: "📸" },
      { label: "Vision AI", pos: 0.4, icon: "🧠" },
      { label: "Places Match", pos: 0.7, icon: "🏛️" },
      { label: "Identified", pos: 0.95, icon: "📍" },
    ];
  }, [type]);

  return (
    <div className="relative w-full h-32 sm:h-36 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-500/10 via-primary/5 to-card border border-primary/20 shadow-inner">
      {/* Background Map Grid Pattern */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Floating Clouds Background */}
      <motion.div
        className="absolute top-2 left-0 text-white/50 dark:text-white/20 text-3xl select-none pointer-events-none"
        animate={{ x: [-50, 450] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      >
        ☁️
      </motion.div>
      <motion.div
        className="absolute top-8 left-0 text-white/40 dark:text-white/10 text-2xl select-none pointer-events-none"
        animate={{ x: [-80, 500] }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear", delay: 4 }}
      >
        ☁️
      </motion.div>

      {/* Main Curved Flight Path (SVG Canvas) */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 120">
        <defs>
          <linearGradient id="flightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Inactive Base Trajectory (Dotted Arc) */}
        <path
          d="M 30 85 Q 200 20 370 85"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          className="text-border/80"
        />

        {/* Active Animated Glowing Arc Path */}
        <motion.path
          d="M 30 85 Q 200 20 370 85"
          fill="none"
          stroke="url(#flightGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0.05 }}
          animate={{ pathLength: safeProgress }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>

      {/* Waypoint Markers */}
      {waypoints.map((wp, i) => {
        const isReached = safeProgress >= wp.pos - 0.05;
        // Position along the curved arc
        const leftPercent = wp.pos * 100;
        // Quadratic bezier approximation for Y height
        const normalizedX = (wp.pos - 0.5) * 2; // -1 to 1
        const topPercent = 35 + (normalizedX * normalizedX) * 35;

        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
            style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{
                scale: isReached ? [1, 1.25, 1] : 0.85,
                opacity: isReached ? 1 : 0.4,
              }}
              transition={{ duration: 0.4 }}
              className={`size-7 sm:size-8 rounded-full flex items-center justify-center text-xs shadow-md border-2 transition-all ${
                isReached
                  ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20 scale-105"
                  : "bg-card text-muted-foreground border-border"
              }`}
            >
              <span>{wp.icon}</span>
            </motion.div>

            <span
              className={`text-[9px] sm:text-[10px] font-semibold mt-1 whitespace-nowrap drop-shadow-xs transition-colors ${
                isReached ? "text-foreground font-bold" : "text-muted-foreground/60"
              }`}
            >
              {wp.label}
            </span>
          </div>
        );
      })}

      {/* 3D Airplane Flying Along the Arc */}
      <motion.div
        className="absolute z-20 pointer-events-none"
        style={{
          left: `${Math.min(safeProgress * 100, 92)}%`,
          top: `${30 + (Math.pow((safeProgress - 0.5) * 2, 2) * 38)}%`,
        }}
        animate={{
          y: [-2, 2, -2],
          rotate: (safeProgress - 0.5) * 45, // Dynamic pitch angle following the curve
        }}
        transition={{
          y: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.4, ease: "easeOut" },
        }}
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
          {/* Engine Vapor Jet Trail */}
          <motion.div
            className="absolute -left-6 w-8 h-2 bg-gradient-to-l from-primary/80 via-sky-400/40 to-transparent rounded-full blur-[1px]"
            animate={{ scaleX: [0.8, 1.4, 0.8], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Airplane Badge */}
          <div className="size-9 rounded-2xl bg-gradient-to-tr from-primary to-sky-400 text-white flex items-center justify-center shadow-lg ring-2 ring-white/50 dark:ring-white/20">
            <Plane className="size-5 fill-white stroke-none drop-shadow-sm rotate-45" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main AnalyzingOverlay Component ──────────────────────────────────────────

export const AnalyzingOverlay = ({ isAnalyzing, loadingStep, useClip, type = "vision" }: AnalyzingOverlayProps) => {
  const steps = useMemo(() => {
    return type === "itinerary"
      ? STEPS_ITINERARY
      : useClip
      ? STEPS_WITH_CLIP
      : STEPS_WITHOUT_CLIP;
  }, [type, useClip]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [currentTipIdx, setCurrentTipIdx] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Reset index whenever a fresh analysis starts
  useEffect(() => {
    if (!isAnalyzing) {
      setActiveIdx(0);
    }
  }, [isAnalyzing]);

  // Sync active step with real loadingStep string from the pipeline
  useEffect(() => {
    if (!isAnalyzing) return;
    const lower = loadingStep.toLowerCase();
    let nextIdx = -1;

    if (type === "itinerary") {
      if (lower.includes("weather") || lower.includes("environment")) nextIdx = 3;
      else if (lower.includes("map") || lower.includes("photo") || lower.includes("geocode") || lower.includes("plotting")) nextIdx = 2;
      else if (lower.includes("itinerary") || lower.includes("plan") || lower.includes("spatial") || lower.includes("cluster")) nextIdx = 1;
      else if (lower.includes("preferences") || lower.includes("analyzing")) nextIdx = 0;
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

  // Auto-rotate Trivia Tips Carousel every 3.8 seconds
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setCurrentTipIdx((prev) => (prev + 1) % TRAVEL_TRIVIA.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Floating Emoji Clicker Handler
  const handleTriggerVibes = () => {
    const emojis = ["✈️", "🌴", "🍜", "✨", "📸", "💖", "🏖️", "🗺️", "⛩️", "🚀"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const newEmoji: FloatingEmoji = {
      id: Date.now() + Math.random(),
      emoji: randomEmoji,
      x: 35 + Math.random() * 30, // Centered range 35% - 65%
      size: 22 + Math.random() * 12,
      rotation: (Math.random() - 0.5) * 60,
    };

    setFloatingEmojis((prev) => [...prev.slice(-15), newEmoji]);

    // Clean up after animation
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== newEmoji.id));
    }, 1800);
  };

  const progressPercentage = Math.round(((activeIdx + 0.5) / steps.length) * 100);
  const activeTip = TRAVEL_TRIVIA[currentTipIdx];

  return (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div
          key="analyzing-overlay"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-3xl p-1"
        >
          {/* ── 1. Aurora Liquid Glow Mesh Background ── */}
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
            <motion.div
              className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-cyan-500/25 blur-3xl"
              animate={{ x: [0, 50, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-purple-500/25 blur-3xl"
              animate={{ x: [0, -40, 0], y: [0, 60, 0], scale: [1.1, 0.9, 1.1] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl"
              animate={{ x: [0, 60, 0], y: [0, -30, 0], scale: [0.9, 1.15, 0.9] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* ── 2. Glassmorphism Card Container ── */}
          <div className="relative rounded-3xl backdrop-blur-2xl bg-card/85 dark:bg-card/75 border border-primary/20 shadow-2xl p-5 sm:p-7 space-y-6">
            
            {/* Top Header & Live Progress Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-gradient-to-tr from-primary to-sky-400 flex items-center justify-center text-primary-foreground shadow-md">
                  <Sparkles className="size-5 animate-spin" style={{ animationDuration: "6s" }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>{type === "itinerary" ? "AI กำลังสร้างแผนท่องเที่ยวส่วนตัว..." : "Vision AI กำลังวิเคราะห์สถานที่..."}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      Live Processing
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loadingStep || "กำลังจัดเตรียมข้อมูลให้ลงตัวที่สุด..."}
                  </p>
                </div>
              </div>

              {/* Progress Percentage Badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-muted/40 border border-border/60 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-muted-foreground font-medium">ความคืบหน้า</span>
                <span className="text-sm font-bold text-primary font-mono">{progressPercentage}%</span>
              </div>
            </div>

            {/* ── 3. 3D Curved Flight Route Scene ── */}
            <FlightMapScene progress={activeIdx / (steps.length - 1)} type={type} />

            {/* Linear Shimmer Progress Bar */}
            <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-sky-500 via-purple-500 to-emerald-500 rounded-full"
                initial={{ width: "5%" }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />
            </div>

            {/* ── 4. Live AI "Thought Stream" Steps ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
                <span className="flex items-center gap-1.5">
                  <Brain className="size-3.5 text-primary" />
                  <span>AI Thought Stream & Pipeline Steps</span>
                </span>
                <span>{activeIdx + 1} of {steps.length} completed</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx < activeIdx;
                  const isActive = idx === activeIdx;

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                        isActive
                          ? `${step.bgColor} border-primary/40 shadow-sm ring-1 ring-primary/30 scale-[1.01]`
                          : isDone
                          ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                          : "bg-muted/20 border-border/40 opacity-55"
                      }`}
                    >
                      {/* Step Icon / Spinner / Checkmark */}
                      <div
                        className={`size-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          isDone
                            ? "bg-emerald-500 text-white shadow-xs"
                            : isActive
                            ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="size-4 stroke-[2.5]" />
                        ) : isActive ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                          >
                            <Icon className="size-4" />
                          </motion.div>
                        ) : (
                          <Icon className="size-4 opacity-50" />
                        )}
                      </div>

                      {/* Step Text & Subtitle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold truncate ${isActive ? "text-foreground font-bold" : isDone ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {step.label}
                          </p>
                          {isActive && (
                            <span className="flex size-2 rounded-full bg-primary animate-ping" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {isActive ? step.detail : isDone ? "Completed successfully ✓" : "Queued..."}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ── 5. AI Travel Trivia & Smart Tips Carousel ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-muted/40 to-background border border-border/70 p-4 sm:p-4.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${activeTip.badgeColor} flex items-center gap-1`}>
                    <activeTip.icon className="size-3" />
                    <span>{activeTip.badge}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">เกร็ดความรู้ระหว่างรอ</span>
                </div>

                {/* Carousel Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentTipIdx((prev) => (prev - 1 + TRAVEL_TRIVIA.length) % TRAVEL_TRIVIA.length)}
                    className="size-6 rounded-lg bg-background hover:bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentTipIdx((prev) => (prev + 1) % TRAVEL_TRIVIA.length)}
                    className="size-6 rounded-lg bg-background hover:bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Animated Carousel Slide */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTip.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-1"
                >
                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span>{activeTip.title}</span>
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {activeTip.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Dots indicator */}
              <div className="flex items-center gap-1.5 mt-3">
                {TRAVEL_TRIVIA.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentTipIdx(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentTipIdx ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* ── 6. Bottom Interactive Vibes Button ── */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={handleTriggerVibes}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition-all hover:scale-105 active:scale-95 border border-primary/20 shadow-2xs cursor-pointer"
              >
                <Heart className="size-3.5 fill-rose-500 text-rose-500 group-hover:scale-125 transition-transform" />
                <span>แตะปล่อยอิโมจิเพลินๆ ✨</span>
              </button>

              <span className="text-[11px] text-muted-foreground font-mono">
                {type === "itinerary" ? "AI Spatial Optimizer v2.5" : "Vision-CLIP Multi-Modal v3"}
              </span>
            </div>
          </div>

          {/* Floating Emojis Canvas */}
          {floatingEmojis.map((item) => (
            <motion.div
              key={item.id}
              className="absolute pointer-events-none select-none z-50 drop-shadow-md"
              style={{ left: `${item.x}%`, bottom: "20px", fontSize: `${item.size}px` }}
              initial={{ opacity: 1, y: 0, rotate: item.rotation, scale: 0.5 }}
              animate={{ opacity: 0, y: -220, rotate: item.rotation + 45, scale: 1.3 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            >
              {item.emoji}
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalyzingOverlay;

