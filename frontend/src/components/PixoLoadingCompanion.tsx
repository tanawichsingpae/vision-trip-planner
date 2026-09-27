import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getPixoMascotUrl, type PixoPose } from "@/services/buddyService";

interface PixoLoadingCompanionProps {
  type: "vision" | "itinerary";
  activeIdx: number;
  totalSteps: number;
}

interface CompanionStage {
  pose: PixoPose;
  titleTh: string;
  titleEn: string;
  speechTh: string;
  speechEn: string;
  badgeTh: string;
  badgeEn: string;
  badgeColor: string;
}

const VISION_STAGES: CompanionStage[] = [
  {
    pose: "camera",
    titleTh: "พิกโซ่กำลังส่องมุมกล้อง",
    titleEn: "Pixo snapping photo clues",
    speechTh: "กำลังส่องดูภาพถ่ายและมุมมองสถาปัตยกรรมอยู่น้า... 📸",
    speechEn: "Analyzing scenery, angles & landmark features... 📸",
    badgeTh: "นักสืบภาพถ่าย",
    badgeEn: "Photo Detective",
    badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/30",
  },
  {
    pose: "search",
    titleTh: "พิกโซ่ส่องแว่นขยายหาพิกัด",
    titleEn: "Pixo searching coordinates",
    speechTh: "ส่องหาสถาปัตยกรรม เทียบกับฐานข้อมูลแลนด์มาร์กทั่วโลก 🔍",
    speechEn: "Matching visual patterns against world POIs 🔍",
    badgeTh: "กำลังค้นหา",
    badgeEn: "Searching POIs",
    badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-400/30",
  },
  {
    pose: "insight",
    titleTh: "พิกโซ่ดึงข้อมูลสถานที่จริง",
    titleEn: "Pixo resolving real place data",
    speechTh: "อ๊ะ! มุมนี้คุ้นมาก กำลังดึงเรตติ้ง ภาพ HD และเวลาเปิดปิด 💡",
    speechEn: "Aha! Pulling verified ratings, HD photos & open hours 💡",
    badgeTh: "เชื่อมข้อมูล",
    badgeEn: "Syncing Data",
    badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  },
  {
    pose: "confident",
    titleTh: "พิกโซ่คอนเฟิร์มสถานที่แล้ว!",
    titleEn: "Pixo confirms the destination!",
    speechTh: "เจอสถานที่แล้ว! จัดเตรียมข้อมูลให้พร้อมเที่ยวในพริบตา ✨",
    speechEn: "Place verified! Finalizing details for your trip ✨",
    badgeTh: "พร้อมออกเดินทาง",
    badgeEn: "Match Ready",
    badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30",
  },
];

const ITINERARY_STAGES: CompanionStage[] = [
  {
    pose: "planning",
    titleTh: "พิกโซ่กางแผนที่วิเคราะห์สไตล์",
    titleEn: "Pixo reviewing travel style",
    speechTh: "กำลังกางแผนที่ วิเคราะห์ความชอบและจังหวะเที่ยวของคุณ 🧭",
    speechEn: "Synthesizing your travel style, pace & budget 🧭",
    badgeTh: "วางแผนทริป",
    badgeEn: "Trip Planner",
    badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/30",
  },
  {
    pose: "route_planer",
    titleTh: "พิกโซ่จัดโซนไม่ให้ย้อนไปมา",
    titleEn: "Pixo clustering daily zones",
    speechTh: "จัดกลุ่มโซนท่องเที่ยว Macro-TSP ประหยัดเวลาเดินทางสุดๆ 🗺️",
    speechEn: "Optimizing daily sectors with non-backtracking routing 🗺️",
    badgeTh: "จัดเส้นทาง",
    badgeEn: "Route Solver",
    badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-400/30",
  },
  {
    pose: "foodie",
    titleTh: "พิกโซ่ปักหมุดร้านเด็ดท้องถิ่น",
    titleEn: "Pixo handpicking foodie gems",
    speechTh: "แอบเลือกร้านอาหารเด็ดและเช็กพยากรณ์อากาศให้พร้อมลุย 🍜☀️",
    speechEn: "Matching local delicacy spots & weather forecast 🍜☀️",
    badgeTh: "ร้านอร่อย & อากาศ",
    badgeEn: "Food & Weather",
    badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-400/30",
  },
  {
    pose: "celebrate",
    titleTh: "พิกโซ่แพ็กกระเป๋าเสร็จแล้ว!",
    titleEn: "Pixo all packed & ready!",
    speechTh: "แพ็กกระเป๋าเรียบร้อย ตารางท่องเที่ยวพร้อมออกเดินทาง! 🎒🎉",
    speechEn: "Itinerary crafted! Your personalized journey is ready! 🎒🎉",
    badgeTh: "สมบูรณ์แบบ",
    badgeEn: "Ready to Go",
    badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30",
  },
];

export const PixoLoadingCompanion: React.FC<PixoLoadingCompanionProps> = ({
  type,
  activeIdx,
  totalSteps,
}) => {
  const { language } = useLanguage();
  const [clickCount, setClickCount] = useState(0);
  const [showHearts, setShowHearts] = useState<{ id: number; x: number }[]>([]);

  // Select appropriate stage list based on transition type
  const stages = type === "itinerary" ? ITINERARY_STAGES : VISION_STAGES;
  const currentStageIndex = Math.min(
    Math.floor((activeIdx / Math.max(totalSteps, 1)) * stages.length),
    stages.length - 1
  );
  const currentStage = stages[currentStageIndex] || stages[0];

  const mascotUrl = getPixoMascotUrl(currentStage.pose);

  const handlePixoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setClickCount((prev) => prev + 1);
    const id = Date.now();
    setShowHearts((prev) => [...prev.slice(-4), { id, x: (Math.random() - 0.5) * 40 }]);
    setTimeout(() => {
      setShowHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1200);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-r from-primary/5 via-secondary/40 to-primary/5 p-3.5 sm:p-4 shadow-xs">
      {/* Background Ambience: Subtle Trail Line & Waypoint Landmarks */}
      <div className="absolute inset-x-6 bottom-5 h-0.5 border-b-2 border-dashed border-primary/20 pointer-events-none" />

      {/* Decorative Waypoint Icons on the Ground */}
      <div className="absolute inset-x-8 bottom-3 flex justify-between text-xs opacity-30 select-none pointer-events-none">
        <span>📸</span>
        <span>🏛️</span>
        <span>🌴</span>
        <span>🍜</span>
        <span>✨</span>
      </div>

      {/* Top Companion Header Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">
            {language === "th" ? "Pixo Buddy Companion" : "Pixo Travel Buddy"}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentStage.badgeColor}`}
          >
            {language === "th" ? currentStage.badgeTh : currentStage.badgeEn}
          </span>
        </div>

        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {language === "th" ? "แตะตัวพิกโซ่เพื่อทักทาย 👋" : "Tap Pixo to say hi 👋"}
        </span>
      </div>

      {/* Walking Stage Area with generous headroom so speech bubble is never clipped */}
      <div className="relative h-32 sm:h-36 w-full select-none pt-2">
        {/* Walking Pixo Container */}
        <motion.div
          className="absolute bottom-3 z-20 flex flex-col items-center"
          animate={{
            left: ["10%", "76%", "10%"],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Animated Direction: faces right when moving right, flips left when moving left */}
          <motion.div
            className="flex flex-col items-center"
            animate={{
              scaleX: [1, 1, -1, -1, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              times: [0, 0.48, 0.52, 0.98, 1],
              ease: "linear",
            }}
          >
            {/* Speech Bubble floating above Pixo (counter-scaleX so text is never mirrored!) */}
            <motion.div
              className="relative -mb-1 max-w-[200px] sm:max-w-[260px] rounded-2xl bg-popover/95 backdrop-blur-md px-3.5 py-2 shadow-md border border-border/80 text-center"
              animate={{
                scaleX: [1, 1, -1, -1, 1], // Counter-flip text so it always reads correctly!
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                times: [0, 0.48, 0.52, 0.98, 1],
                ease: "linear",
              }}
            >
              <p className="text-[11px] sm:text-xs font-semibold text-foreground leading-snug">
                {language === "th" ? currentStage.speechTh : currentStage.speechEn}
              </p>
              {/* Little speech tail pointing down to Pixo */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-2 rotate-45 bg-popover border-r border-b border-border/80" />
            </motion.div>

            {/* Pixo Mascot Avatar with Walking Bob Motion */}
            <motion.div
              onClick={handlePixoClick}
              animate={{
                y: [0, -5, 0],
                rotate: [-3, 3, -3],
              }}
              transition={{
                y: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              className="group relative cursor-pointer pt-2"
              title={language === "th" ? "แตะทักทาย Pixo!" : "Tap Pixo!"}
            >
              {/* Soft Ground Shadow */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1.5 w-9 rounded-full bg-slate-900/20 blur-[1px] dark:bg-white/10" />

              {/* Avatar Frame with Glowing Ring */}
              <div className="relative size-12 sm:size-14 overflow-hidden rounded-2xl border-2 border-white bg-card shadow-lg ring-2 ring-primary/30 transition-transform dark:border-slate-800">
                <img
                  src={mascotUrl}
                  alt="Pixo Mascot"
                  className="size-full object-cover select-none"
                  draggable={false}
                  onError={(e) => {
                    // Fallback to tip pose if specific pose image fails
                    e.currentTarget.src = "/pixo_carton/pixo_tip.jpg";
                  }}
                />
              </div>

              {/* Tiny Sparkle on Top Corner */}
              <span className="absolute top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] text-white shadow-xs">
                ✨
              </span>
            </motion.div>
          </motion.div>

          {/* Floating Tap Hearts/Stars */}
          <AnimatePresence>
            {showHearts.map((heart) => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -45, scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1 }}
                style={{ left: `calc(50% + ${heart.x}px)` }}
                className="absolute top-0 pointer-events-none z-30"
              >
                <Heart className="size-4 fill-rose-500 text-rose-500 drop-shadow-md" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default PixoLoadingCompanion;
