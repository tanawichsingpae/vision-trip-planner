import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileArchive,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Code2,
  ChevronDown,
} from "lucide-react";
import {
  GeneratedPosterImage,
  downloadPosterImage,
  downloadAllPosterImagesAsZip,
} from "@/services/aiPosterService";

interface AIPosterPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: GeneratedPosterImage[];
  destinationName: string;
  language?: "th" | "en";
}

export const AIPosterPreviewModal: React.FC<AIPosterPreviewModalProps> = ({
  isOpen,
  onClose,
  images,
  destinationName,
  language = "th",
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const isThai = language === "th";

  if (!images.length) return null;

  const currentImage = images[selectedIndex] || images[0];
  const safeFilename =
    destinationName.toLowerCase().replace(/[^a-z0-9_\u0E00-\u0E7F]/gi, "_") ||
    "trip";

  const handleDownloadCurrent = () => {
    downloadPosterImage(
      currentImage.imageUrl,
      `${safeFilename}_poster_part${currentImage.partIndex}.png`
    );
  };

  const handleDownloadAllZip = () => {
    downloadAllPosterImagesAsZip(images, safeFilename);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden bg-card/98 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1 text-left pb-2 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 text-white shadow-xs">
                <Sparkles className="size-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {isThai
                  ? "ภาพสรุปการเดินทาง AI (Gemini 3 Pro Poster)"
                  : "AI Travel Infographic Poster"}
              </DialogTitle>
            </div>

            {images.length > 1 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {isThai
                  ? `ส่วนที่ ${selectedIndex + 1} จาก ${images.length} (${currentImage.dayRangeLabel})`
                  : `Part ${selectedIndex + 1} of ${images.length} (${currentImage.dayRangeLabel})`}
              </span>
            )}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            {isThai
              ? "สร้างภาพสรุปการเดินทางโดย Gemini 3 Pro พร้อมข้อมูลตารางและไฮไลต์ของแต่ละวัน"
              : "Visual travel infographic synthesized by Gemini 3 Pro with daily schedules & landmarks"}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector if multiple parts */}
        {images.length > 1 && (
          <div className="flex items-center gap-2 pt-2 overflow-x-auto">
            {images.map((img, idx) => (
              <Button
                key={idx}
                variant={selectedIndex === idx ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedIndex(idx)}
                className="text-xs h-8 px-3 rounded-lg"
              >
                {isThai
                  ? `รูปที่ ${idx + 1}: ${img.dayRangeLabel}`
                  : `Part ${idx + 1}: ${img.dayRangeLabel}`}
              </Button>
            ))}
          </div>
        )}

        {/* Main Image Viewer */}
        <div className="relative flex-1 min-h-[300px] max-h-[58vh] my-2 bg-slate-950/5 dark:bg-black/30 rounded-xl overflow-hidden border border-border/50 flex items-center justify-center p-2 group">
          <img
            src={currentImage.imageUrl}
            alt={`Poster Part ${currentImage.partIndex}`}
            className="w-auto h-auto max-w-full max-h-[54vh] object-contain rounded-lg shadow-md transition-transform duration-300 group-hover:scale-[1.01]"
          />

          {/* Previous / Next buttons */}
          {images.length > 1 && (
            <>
              {selectedIndex > 0 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full shadow-lg bg-background/80 backdrop-blur-sm opacity-80 hover:opacity-100"
                  onClick={() => setSelectedIndex((prev) => prev - 1)}
                >
                  <ChevronLeft className="size-5" />
                </Button>
              )}
              {selectedIndex < images.length - 1 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full shadow-lg bg-background/80 backdrop-blur-sm opacity-80 hover:opacity-100"
                  onClick={() => setSelectedIndex((prev) => prev + 1)}
                >
                  <ChevronRight className="size-5" />
                </Button>
              )}
            </>
          )}

          {/* Quick Open in Tab */}
          <a
            href={currentImage.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
            title="Open Full Resolution"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>

        {/* Collapsible Prompt Info */}
        <div className="border border-border/60 rounded-lg p-2 bg-muted/30">
          <button
            type="button"
            onClick={() => setShowPrompt((p) => !p)}
            className="flex items-center justify-between w-full text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Code2 className="size-3.5 text-indigo-500" />
              {isThai ? "ดูคำสั่ง Prompt ที่ส่งให้ AI" : "View AI Prompt Details"}
            </span>
            <ChevronDown
              className={`size-3.5 transition-transform ${showPrompt ? "rotate-180" : ""}`}
            />
          </button>
          {showPrompt && (
            <div className="mt-2 text-[10px] font-mono max-h-24 overflow-y-auto p-2 bg-background/80 rounded border border-border/40 text-muted-foreground whitespace-pre-wrap leading-relaxed select-all">
              {currentImage.prompt}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            {isThai ? "ปิด" : "Close"}
          </Button>

          <div className="flex items-center gap-2">
            {images.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAllZip}
                className="gap-1.5 text-xs h-9"
              >
                <FileArchive className="size-3.5 text-amber-500" />
                {isThai ? "ดาวน์โหลดทั้งหมด (.zip)" : "Download All (.zip)"}
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadCurrent}
              className="gap-1.5 text-xs h-9 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-medium"
            >
              <Download className="size-3.5" />
              {isThai
                ? `ดาวน์โหลดรูปนี้ (${currentImage.dayRangeLabel})`
                : `Download (.png)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
