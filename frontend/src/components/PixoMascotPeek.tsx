import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  type PixoPose,
  getPixoMascotUrl,
  getPixoPoseMetadata,
} from "@/services/buddyService";
import { Sparkles, X, ZoomIn } from "lucide-react";

export interface PixoMascotPeekProps {
  pose: PixoPose | string;
  src?: string;
  alt?: string;
  speechBubble?: string;
  headline?: string;
  language?: "th" | "en";
  className?: string;
  avatarClassName?: string;
  showHoverHint?: boolean;
  clickable?: boolean;
  children?: React.ReactNode;
}

export const PixoMascotPeek: React.FC<PixoMascotPeekProps> = ({
  pose,
  src,
  alt = "Pixo Travel Buddy",
  speechBubble,
  headline,
  language = "th",
  className = "",
  avatarClassName = "w-7 h-7 rounded-lg object-cover ring-1 ring-border/80 shadow-2xs",
  showHoverHint = true,
  clickable = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);

  const mascotUrl = src || getPixoMascotUrl(pose);
  const meta = getPixoPoseMetadata(pose, language);
  const displayTitle = headline || meta.title;
  const displaySpeech = speechBubble || meta.description;

  useEffect(() => {
    setMounted(true);
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const triggerHaptic = () => {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(25);
      }
    } catch {
      // Ignore vibration errors
    }
  };

  // Pointer Down (Press & Hold for Mobile + Desktop)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only respond to primary click
    if (e.button !== 0 && e.pointerType === "mouse") return;

    isHoldingRef.current = true;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        triggerHaptic();
        setIsOpen(true);
      }
    }, 220); // 220ms hold trigger
  };

  const handlePointerUp = () => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  // Hover support for desktop
  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 380);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleManualClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickable) {
      setIsOpen((prev) => !prev);
    }
  };

  const closePeek = useCallback(() => {
    setIsOpen(false);
  }, []);

  const portalContent = mounted && (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none pdf-hidden"
          onClick={closePeek}
          onPointerUp={closePeek}
        >
          {/* Backdrop exit motion */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
          />

          {/* Floating High-Res Mascot Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 10 }}
            transition={{ type: "spring", damping: 24, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[320px] sm:max-w-[340px] rounded-3xl bg-card border border-border/80 shadow-2xl p-4 sm:p-5 overflow-hidden text-foreground flex flex-col items-center gap-3.5"
          >
            {/* Background subtle radial glow */}
            <div className="absolute -top-12 -right-12 size-36 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-32 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={closePeek}
              className="absolute top-3 right-3 size-7 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors z-10"
              title={language === "th" ? "ปิด" : "Close"}
            >
              <X className="size-4" />
            </button>

            {/* Pose Badge Header */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold">
              <span className="text-sm">{meta.emoji}</span>
              <span>{meta.tag}</span>
              <Sparkles className="size-3 text-primary" />
            </div>

            {/* High-Resolution Mascot Artwork (200x200px) */}
            <div className="relative size-48 sm:size-52 rounded-2xl overflow-hidden ring-2 ring-primary/30 shadow-lg bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center">
              <img
                src={mascotUrl}
                alt={alt}
                className="size-full object-cover select-none pointer-events-none transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/pixo_carton/pixo_tip.jpg";
                }}
              />
            </div>

            {/* Pose Title */}
            <h4 className="font-bold text-sm sm:text-base text-foreground text-center leading-snug">
              {displayTitle}
            </h4>

            {/* Comic Speech Bubble */}
            <div className="relative w-full p-3 rounded-2xl bg-secondary/70 dark:bg-secondary/40 border border-border/70 text-xs sm:text-[13px] text-foreground leading-relaxed text-center font-medium shadow-xs">
              {/* Pointer triangle */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-3 bg-secondary/70 dark:bg-secondary/40 border-t border-l border-border/70 rotate-45" />
              <span>💬 &ldquo;{displaySpeech}&rdquo;</span>
            </div>

            {/* Interaction Footer Hint */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80 pt-0.5">
              <span>{language === "th" ? "แตะที่ว่างเพื่อปิด" : "Tap anywhere to close"}</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      className={`relative inline-flex items-center justify-center cursor-pointer select-none group/pixo-peek ${className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleManualClick}
      title={
        language === "th"
          ? "กดค้างเพื่อซูมดูรูป Pixo แบบ HD ✨"
          : "Press & hold or hover to inspect Pixo in HD ✨"
      }
    >
      {children ? (
        children
      ) : (
        <div className="relative shrink-0">
          <img
            src={mascotUrl}
            alt={alt}
            className={avatarClassName}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/pixo_carton/pixo_tip.jpg";
            }}
          />
          {showHoverHint && (
            <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 group-hover/pixo-peek:opacity-100 transition-opacity shadow-xs pointer-events-none">
              <ZoomIn className="size-2" />
            </span>
          )}
        </div>
      )}

      {mounted && typeof document !== "undefined" && createPortal(portalContent, document.body)}
    </div>
  );
};

export default PixoMascotPeek;
