import { useState, useCallback, useRef, useEffect } from "react";
import {
  CloudUpload,
  X,
  Sparkles,
  Camera,
  Dices,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Compass,
  Trash2,
  Scan,
  ExternalLink,
  Layers,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { LOGIN_ATTRACTIONS, type AttractionItem, type AttractionCategory } from "@/data/attractionsData";
import "./ImageUpload.css";

export interface StagedImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
}

interface ImageUploadProps {
  onImagesUploaded: (files: File[]) => void;
  isAnalyzing: boolean;
  loadingLabel?: string;
  activePreviews?: string[];
}

// Angles for organic polaroid scrapbook feel
const POLAROID_ANGLES = [-2.5, 1.8, -1.2, 2.4, -2.0, 1.5, -1.8, 2.2];

export const MAX_STAGED_PHOTOS = 20;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageUpload({
  onImagesUploaded,
  isAnalyzing,
  loadingLabel = "Analyzing Destinations...",
  activePreviews,
}: ImageUploadProps) {
  const { language } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [activeCategory, setActiveCategory] = useState<AttractionCategory>("all");
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [pixoSpeechIndex, setPixoSpeechIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filmstripScrollRef = useRef<HTMLDivElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      stagedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const displayedPreviews = activePreviews && activePreviews.length > 0
    ? activePreviews
    : stagedImages.map((s) => s.previewUrl);

  // Filter attractions based on category
  const filteredAttractions = activeCategory === "all"
    ? LOGIN_ATTRACTIONS
    : LOGIN_ATTRACTIONS.filter((item) => item.category === activeCategory);

  /**
   * Appends newly dropped/selected files into the staging queue (supports multiple additions from various folders)
   */
  const addFilesToStaging = useCallback(
    (newFiles: File[]) => {
      const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length === 0) {
        toast.error(language === "th" ? "กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)" : "Please select image files only");
        return;
      }

      setStagedImages((prev) => {
        // Prevent duplicate files (same name & size)
        const nonDuplicates = validFiles.filter(
          (nf) => !prev.some((p) => p.file.name === nf.name && p.file.size === nf.size)
        );

        const duplicatesCount = validFiles.length - nonDuplicates.length;
        if (duplicatesCount > 0 && nonDuplicates.length === 0) {
          toast.info(language === "th" ? "รูปภาพเหล่านี้มีอยู่ในสต็อกแล้วครับ" : "These photos are already staged in queue");
          return prev;
        }

        const remainingCapacity = Math.max(0, MAX_STAGED_PHOTOS - prev.length);
        if (remainingCapacity <= 0) {
          toast.warning(language === "th" ? `คุณสต็อกรูปภาพครบโควต้า ${MAX_STAGED_PHOTOS} รูปแล้วครับ` : `Maximum ${MAX_STAGED_PHOTOS} photos reached in queue`);
          return prev;
        }

        const filesToAdd = nonDuplicates.slice(0, remainingCapacity);
        const skippedDueToCapacity = nonDuplicates.length - filesToAdd.length;

        const newStaged: StagedImage[] = filesToAdd.map((file) => ({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
          sizeFormatted: formatFileSize(file.size),
        }));

        const total = prev.length + newStaged.length;

        if (skippedDueToCapacity > 0) {
          toast.warning(
            language === "th"
              ? `เพิ่มได้ ${newStaged.length} รูป (ครบโควต้าสูงสุด ${MAX_STAGED_PHOTOS} รูป)`
              : `Added ${newStaged.length} photos (Reached ${MAX_STAGED_PHOTOS} photo maximum)`
          );
        } else {
          toast.success(
            language === "th"
              ? `เพิ่ม ${newStaged.length} รูปภาพลงในสต็อกแล้ว (รวม ${total} รูป)`
              : `Added ${newStaged.length} photo(s) to queue (Total ${total})`
          );
        }

        return [...prev, ...newStaged];
      });
    },
    [language]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFilesToStaging(Array.from(e.dataTransfer.files));
      }
    },
    [addFilesToStaging]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToStaging(Array.from(e.target.files));
      // Reset input value so same files can be re-selected if removed
      e.target.value = "";
    }
  };

  const removeStagedImage = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStagedImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearStagedImages = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStagedImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    toast.info(language === "th" ? "ล้างสต็อกรูปภาพทั้งหมดแล้ว" : "Cleared all staged photos");
  };

  /**
   * Final confirmation to send staged photos to Vision AI analysis
   */
  const handleProceedUpload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (stagedImages.length === 0) {
      toast.warning(language === "th" ? "กรุณาเลือกรูปภาพอย่างน้อย 1 รูปก่อนครับ" : "Please add at least 1 photo");
      return;
    }
    const files = stagedImages.map((s) => s.file);
    onImagesUploaded(files);
  };

  // 1-Click Load Single Landmark into staging
  const handleAttractionClick = async (attraction: AttractionItem) => {
    if (isAnalyzing || isLoadingSample) return;
    setIsLoadingSample(true);
    try {
      const response = await fetch(attraction.image);
      const blob = await response.blob();
      const filename = attraction.image.split("/").pop() || `${attraction.id}.jpg`;
      const file = new File([blob], filename, { type: "image/jpeg" });
      addFilesToStaging([file]);
    } catch (error) {
      console.error("Failed to load attraction image", error);
      toast.error(language === "th" ? "ไม่สามารถโหลดรูปภาพตัวอย่างได้" : "Failed to load sample image");
    } finally {
      setIsLoadingSample(false);
    }
  };

  // 🎲 Gimmick: Surprise Me! Mystery Trip Generator (Picks 3 random landmarks into staging)
  const handleSurpriseTrip = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isAnalyzing || isLoadingSample) return;
    setIsLoadingSample(true);
    try {
      const shuffled = [...LOGIN_ATTRACTIONS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);

      const files: File[] = [];
      for (const item of selected) {
        const response = await fetch(item.image);
        const blob = await response.blob();
        const filename = item.image.split("/").pop() || `${item.id}.jpg`;
        files.push(new File([blob], filename, { type: "image/jpeg" }));
      }
      addFilesToStaging(files);
    } catch (error) {
      console.error("Failed to generate mystery trip", error);
      toast.error(language === "th" ? "ไม่สามารถโหลดรูปตัวอย่างได้" : "Failed to load mystery landmarks");
    } finally {
      setIsLoadingSample(false);
    }
  };

  const scrollFilmstrip = (direction: "left" | "right") => {
    if (filmstripScrollRef.current) {
      const offset = direction === "left" ? -320 : 320;
      filmstripScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Pixo Mascot Speeches
  const pixoQuotes = language === "th" ? [
    stagedImages.length > 0
      ? `มีรูปในสต็อก ${stagedImages.length} รูปแล้ว! วางรูปเพิ่มอีกได้ หรือกดเริ่มวิเคราะห์ได้เลย 🚀`
      : "โยนรูปภาพวิวสวยๆ มาให้ Pixo ดูสิ 📸 (วางหลายครั้งจากหลายโฟลเดอร์ได้นะ)",
    "มีทริปในใจไหม? แปะรูปมาแล้วเราวางแผนให้!",
    "ลองกดปุ่ม 'สุ่มทริปด่วน' ดูสิ ตื่นเต้นแน่นอน 🎲",
    "Pixo พร้อมสำรวจโลกไปพร้อมคุณแล้ว! ✈️"
  ] : [
    stagedImages.length > 0
      ? `${stagedImages.length} photos staged in queue! Drop more or start trip planning 🚀`
      : "Drop scenic destination photos for Pixo! 📸 (Drop multiple batches anytime)",
    "Got a dream trip? Drop a picture & let's plan!",
    "Try the 'Surprise Trip' button for instant magic 🎲",
    "Pixo is ready to explore the world with you! ✈️"
  ];

  const cyclePixoSpeech = () => {
    setPixoSpeechIndex((prev) => (prev + 1) % pixoQuotes.length);
  };

  // ── Render Case A: Analyzing State (Polaroid Scrapbook View) ──
  if (isAnalyzing && displayedPreviews.length > 0) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        {/* Pixo Feedback when photos are loaded */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="pixo-upload-companion" onClick={cyclePixoSpeech}>
            <div className="pixo-mascot-avatar">
              <img
                src="/pixo_carton/pixo_planning.jpg"
                alt="Pixo Companion"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = "/pixo_carton/pixo_profile.png";
                }}
              />
              <span className="pixo-mini-shutter">
                <Sparkles size={11} />
              </span>
            </div>
            <div className="pixo-upload-bubble">
              <span className="bubble-arrow" />
              <span>
                {language === "th" ? "Vision AI กำลังแกะรอยพิกัดสถานที่ในรูป…" : "Vision AI is inspecting landmarks…"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Polaroid Scrapbook Grid ── */}
        <div className="polaroid-scrapbook-grid">
          {displayedPreviews.map((src, i) => (
            <div
              key={i}
              className="polaroid-card group"
              style={{
                ["--polaroid-angle" as string]: `${POLAROID_ANGLES[i % POLAROID_ANGLES.length]}deg`,
              }}
            >
              {/* Washi Tape on Top */}
              <div className="washi-tape" />

              <div className="polaroid-photo-frame">
                <img src={src} alt={`Landmark ${i + 1}`} />
                <div className="polaroid-laser-scan" />
              </div>

              <span className="polaroid-caption">
                Photo #{i + 1} • Scanning…
              </span>
            </div>
          ))}
        </div>

        {/* Analysis Loading Status */}
        <div className="rounded-2xl border border-sky-500/30 bg-sky-50/70 dark:bg-slate-900/70 p-5 text-center shadow-xs">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Scan className="size-5 text-sky-600 dark:text-sky-400 animate-spin" />
            <p className="text-foreground font-bold text-sm tracking-wide">{loadingLabel}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            {language === "th"
              ? "Vision AI กำลังระบุสถานที่ท่องเที่ยว คำนวณคลัสเตอร์ และจำลองตารางเดินทาง"
              : "Vision AI is identifying landmarks, clustering POIs, and engineering your itinerary"}
          </p>
        </div>
      </div>
    );
  }

  // ── Render Case B: Idle & Staging State (Interactive Dropzone with Preview Hub) ──
  return (
    <div className="flex flex-col gap-2.5 sm:gap-3">
      {/* ── Compact Header Title & Subtitle ── */}
      <div className="space-y-1 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300 shadow-2xs">
          <Sparkles className="size-2.5 text-sky-500" />
          {language === "th" ? "ขั้นตอนที่ 1 จาก 4 • สตูดิโอวางแผนทริป" : "Step 1 of 4 • Visual Trip Planner"}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground m-0 leading-tight">
          {language === "th" ? "อัปโหลดภาพท่องเที่ยว สร้างแผนการเดินทางทันที" : "Upload travel photos, get an instant trip"}
        </h1>
        <p className="mx-auto max-w-xl text-[11.5px] leading-snug text-muted-foreground m-0">
          {language === "th"
            ? "วางรูปภาพจากหลายโฟลเดอร์เพื่อสะสมภาพ จากนั้นให้ Vision AI ตรวจจับแลนด์มาร์กและจัดตารางอัตโนมัติ"
            : "Drop photos from multiple folders into staging, then let Vision AI recognize landmarks & plan your route."}
        </p>
      </div>

      {/* ── Pixo Mascot Live Companion (Compact Chip) ── */}
      <div className="flex justify-center -mt-0.5">
        <div className="pixo-upload-companion compact" onClick={cyclePixoSpeech}>
          <div className="pixo-mascot-avatar">
            <img
              src={
                dragActive
                  ? "/pixo_carton/pixo_surprised.jpg"
                  : stagedImages.length > 0
                  ? "/pixo_carton/pixo_celebrate.jpg"
                  : "/pixo_carton/pixo_camera.jpg"
              }
              alt="Pixo Companion Mascot"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = "/pixo_carton/pixo_profile.png";
              }}
            />
            <span className="pixo-mini-shutter">
              {stagedImages.length > 0 ? <Sparkles size={9} /> : <Camera size={9} />}
            </span>
          </div>
          <div className="pixo-upload-bubble">
            <span className="bubble-arrow" />
            <span>
              {dragActive
                ? (language === "th" ? "ว้าว! ปล่อยรูปเลย Pixo รอรับเข้าสต็อกอยู่! 🚀" : "Woah! Drop it in to queue, Pixo's ready! 🚀")
                : pixoQuotes[pixoSpeechIndex]}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Upload Box: Staged Preview Hub vs Initial Dropzone ── */}
      {stagedImages.length > 0 ? (
        /* ══════════════════════════════════════════════════════════════
           CASE 1: STAGED PHOTOS HUB (User has stocked >= 1 photos)
           ══════════════════════════════════════════════════════════════ */
        <div
          className={`aperture-dropzone compact-aperture staged-dropzone ${dragActive ? "is-drag-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />

          {/* Staging Top Header Bar */}
          <div className="w-full flex items-center justify-between gap-2 pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-sky-500" />
                {language === "th" ? "สต็อกภาพพร้อมวิเคราะห์" : "Staged Photos Ready"}
              </span>
              <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
                {stagedImages.length} / {MAX_STAGED_PHOTOS} {language === "th" ? "รูป" : "photos"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer border border-sky-300/40"
                title="Add more photos from another folder"
              >
                <ImagePlus className="size-3 text-sky-500" />
                <span>{language === "th" ? "+ วาง/เพิ่มรูปอีก" : "+ Add More"}</span>
              </button>
              <button
                type="button"
                onClick={clearStagedImages}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Clear all staged photos"
              >
                <Trash2 className="size-3" />
                <span>{language === "th" ? "ล้างทั้งหมด" : "Clear"}</span>
              </button>
            </div>
          </div>

          {/* Staged Photo Thumbnails Strip */}
          <div className="w-full py-0.5">
            <div className="staged-thumbnails-grid">
              {stagedImages.map((item, idx) => (
                <div
                  key={item.id}
                  className="staged-thumb-card group"
                  title={`${item.name} (${item.sizeFormatted})`}
                >
                  <div className="staged-thumb-img-wrap">
                    <img src={item.previewUrl} alt={item.name} />
                    <span className="staged-thumb-index">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={(e) => removeStagedImage(item.id, e)}
                      className="staged-thumb-remove-btn"
                      title={language === "th" ? "ลบรูปนี้" : "Remove photo"}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  <p className="staged-thumb-name">{item.name}</p>
                </div>
              ))}

              {/* Add More Slot Card if capacity remains */}
              {stagedImages.length < MAX_STAGED_PHOTOS && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="staged-add-slot group"
                  title={language === "th" ? "คลิกเพื่อเพิ่มรูปภาพจากโฟลเดอร์อื่น หรือลากรูปมาวางตรงนี้" : "Click to browse or drop more photos here"}
                >
                  <div className="staged-add-slot-inner">
                    <ImagePlus className="size-4 text-sky-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                      {language === "th" ? "+ เพิ่มรูป" : "+ Add"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Launch CTA Bar */}
          <div className="w-full flex flex-col items-center gap-1.5 pt-1.5 border-t border-border/30">
            <button
              type="button"
              onClick={handleProceedUpload}
              className="staged-launch-btn w-full sm:w-auto"
            >
              <Sparkles className="size-4 animate-spin-slow text-amber-200" />
              <span>
                {language === "th"
                  ? `เริ่มวิเคราะห์ภาพและสร้างแผน (${stagedImages.length} รูป)`
                  : `Analyze & Plan Trip (${stagedImages.length} Photos)`}
              </span>
              <ChevronRight className="size-4" />
            </button>
            <p className="text-[10.5px] text-muted-foreground m-0 text-center">
              {language === "th"
                ? "✨ สามารถนำรูปภาพจากหลายโฟลเดอร์มาวางเพิ่มได้เรื่อยๆ ก่อนกดเริ่มวิเคราะห์"
                : "✨ You can drag & drop photos from different folders before analyzing"}
            </p>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
           CASE 2: INITIAL IDLE DROPZONE (0 photos staged yet)
           ══════════════════════════════════════════════════════════════ */
        <div
          className={`aperture-dropzone compact-aperture ${dragActive ? "is-drag-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          {/* Center Camera Aperture Icon */}
          <div className="lens-aperture-wrap">
            {dragActive ? <Sparkles className="size-5" /> : <CloudUpload className="size-5" />}
          </div>

          <div className="space-y-0.5 pointer-events-none">
            <p className="text-xs sm:text-sm font-bold text-foreground m-0">
              {language === "th" ? "ลาก & วางภาพสถานที่ท่องเที่ยวของคุณที่นี่" : "Drag & drop your travel photos here"}
            </p>
            <p className="text-[10.5px] text-muted-foreground m-0">
              {language === "th"
                ? `นำภาพจากหลายโฟลเดอร์มาวางสะสมได้หลายครั้ง — รองรับ JPG, PNG, WebP สูงสุด ${MAX_STAGED_PHOTOS} รูป`
                : `Drop photos from multiple folders into queue — JPG, PNG up to ${MAX_STAGED_PHOTOS} photos`}
            </p>
          </div>

          {/* Quick Action Buttons inside dropzone */}
          <div className="dropzone-action-row" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="dropzone-btn-primary"
            >
              <ImagePlus className="size-3.5" />
              <span>{language === "th" ? "เลือกไฟล์จากเครื่อง" : "Browse Photos"}</span>
            </button>

            <button
              type="button"
              disabled={isLoadingSample || isAnalyzing}
              onClick={handleSurpriseTrip}
              className="dropzone-btn-surprise"
              title="Randomly pick 3 world landmarks into staging"
            >
              <Dices className="size-3.5" />
              <span>{isLoadingSample ? "Loading…" : (language === "th" ? "🎲 สุ่มทริปด่วน (Surprise Me!)" : "🎲 Surprise Trip!")}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TravelWish Standalone Companion Card (Slim & Prominent Banner) ── */}
      <aside
        aria-label="TravelWish Discovery"
        className="travelwish-standalone-card slim-banner"
      >
        <div className="travelwish-card-glow" aria-hidden="true" />
        <div className="travelwish-card-content">
          <div className="travelwish-card-info">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="travelwish-pill-badge">
                <Sparkles className="size-2.5" />
                <span>{language === "th" ? "ยังไม่มีเรฟ หรือยังไม่รู้จุดหมายใช่ไหม?" : "No photo references yet?"}</span>
              </span>
              <span className="text-xs font-bold text-foreground">
                {language === "th" ? (
                  <>
                    มาค้นหาตัวตนของคุณกับ <span className="travelwish-gradient-text">TravelWish</span>
                  </>
                ) : (
                  <>
                    Find your travel persona with <span className="travelwish-gradient-text">TravelWish</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground m-0 hidden sm:block">
              {language === "th"
                ? "ตอบคำถามสั้น ๆ เกี่ยวกับสไตล์การท่องเที่ยวที่คุณชอบ เพื่อให้ระบบช่วยแนะนำจุดหมายปลายทางที่ตรงใจคุณที่สุด"
                : "Answer quick lifestyle questions to discover personalized destinations tailored to your travel vibe."}
            </p>
          </div>

          <div className="travelwish-card-action">
            <a
              href="https://travelwish2.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="travelwish-cta-btn"
              title="Open TravelWish: Discover your travel persona & ideal destinations"
            >
              <span>{language === "th" ? "มาค้นหาตัวตนของคุณกัน" : "Open TravelWish"}</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </aside>

      {/* ── Inspiration Filmstrip Carousel (25 Real Landmarks) ── */}
      <section className="filmstrip-section">
        <div className="filmstrip-header">
          <div className="filmstrip-title-row">
            <Compass className="size-3.5 text-sky-500" />
            <span className="text-xs font-semibold">
              {language === "th"
                ? "หรือคลิกเลือกภาพแลนด์มาร์กตัวอย่างเข้าสู่สต็อก (25 แห่งทั่วโลก):"
                : "Or click to stage sample landmarks (25 destinations):"}
            </span>
          </div>

          {/* Mood Filter Tabs */}
          <div className="mood-filter-row">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`mood-tab ${activeCategory === "all" ? "is-active" : ""}`}
            >
              {language === "th" ? "🌟 ทั้งหมด" : "🌟 All"}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("wonders")}
              className={`mood-tab ${activeCategory === "wonders" ? "is-active" : ""}`}
            >
              {language === "th" ? "🏛️ สิ่งมหัศจรรย์" : "🏛️ Wonders"}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("asia")}
              className={`mood-tab ${activeCategory === "asia" ? "is-active" : ""}`}
            >
              {language === "th" ? "⛩️ เอเชีย" : "⛩️ Asia"}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("europe")}
              className={`mood-tab ${activeCategory === "europe" ? "is-active" : ""}`}
            >
              {language === "th" ? "🏰 ยุโรป" : "🏰 Europe"}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("modern")}
              className={`mood-tab ${activeCategory === "modern" ? "is-active" : ""}`}
            >
              {language === "th" ? "🏙️ เมืองสมัยใหม่" : "🏙️ Modern"}
            </button>
          </div>
        </div>

        {/* Horizontal Filmstrip Carousel */}
        <div className="filmstrip-scroll-wrap">
          <button
            type="button"
            onClick={() => scrollFilmstrip("left")}
            className="absolute left-0 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 shadow-md hover:scale-110 transition-transform -translate-x-2 cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div ref={filmstripScrollRef} className="filmstrip-track">
            {filteredAttractions.map((item) => (
              <article
                key={item.id}
                onClick={() => handleAttractionClick(item)}
                className="filmstrip-card"
                title={`${item.name} (${item.location}, ${item.country}) — Click to stage photo!`}
              >
                <div className="filmstrip-img-wrap">
                  <img src={item.image} alt={item.name} loading="lazy" />
                  <span className="filmstrip-badge">{item.country}</span>
                </div>
                <div className="filmstrip-info">
                  <h5>{item.name}</h5>
                  <p>📍 {item.location}</p>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollFilmstrip("right")}
            className="absolute right-0 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 shadow-md hover:scale-110 transition-transform translate-x-2 cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
