import { ExternalLink, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function TravelWishHelperCard() {
  const { language } = useLanguage();

  return (
    <aside aria-label="TravelWish Research Alternative" className="relative overflow-hidden rounded-2xl border border-pink-300/80 bg-gradient-to-r from-pink-50/90 via-rose-50/60 to-purple-50/75 p-4 sm:p-5 shadow-xs backdrop-blur-md dark:border-pink-500/30 dark:from-pink-950/30 dark:via-rose-950/20 dark:to-purple-950/30 transition-all duration-300 hover:border-pink-400 hover:shadow-md hover:shadow-pink-500/15">
      {/* Decorative ambient glowing gradient orbs */}
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-pink-400/20 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 size-32 rounded-full bg-rose-400/15 blur-2xl" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Brand & Context */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-100/90 dark:bg-pink-900/50 px-2.5 py-0.5 text-[10px] font-bold text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-700/60 shadow-2xs">
              <Sparkles className="size-3 text-pink-500" />
              {language === "th" ? "งานวิจัยคู่ขนาน (Sister Project)" : "Sister Research Project"}
            </span>
            <span className="text-[11px] font-semibold text-pink-600/90 dark:text-pink-400">
              Personalized Travel Planning
            </span>
          </div>

          <h4 className="text-sm font-bold text-foreground leading-snug">
            {language === "th" ? (
              <>
                ไม่มีรูปภาพในมือ? วางแผนด้วยความชอบส่วนตัวกับ{" "}
                <span className="bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 bg-clip-text text-transparent font-extrabold">
                  TravelWish
                </span>
              </>
            ) : (
              <>
                No photos to upload? Plan by your preferences with{" "}
                <span className="bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 bg-clip-text text-transparent font-extrabold">
                  TravelWish
                </span>
              </>
            )}
          </h4>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {language === "th"
              ? "ค้นหาจุดหมายปลายทางที่ใช่จากความสนใจ ไลฟ์สไตล์ และงบประมาณของคุณผ่านคำถามความชอบ โดยไม่ต้องใช้ภาพถ่าย"
              : "Discover ideal travel destinations based on your interests, travel style, and personal preferences without needing photos."}
          </p>
        </div>

        {/* Right Side: CTA Button */}
        <div className="shrink-0 sm:self-center">
          <a
            href="https://travelwish2.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d977a6] via-[#c66597] to-[#a85587] hover:from-[#c66597] hover:to-[#964777] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-pink-500/25 hover:shadow-md hover:shadow-pink-500/35 hover:-translate-y-0.5 transition-all duration-200"
          >
            <span>{language === "th" ? "เปิด TravelWish" : "Try TravelWish"}</span>
            <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
