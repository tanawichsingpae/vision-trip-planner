import { useState, useCallback } from "react";
import { CloudUpload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  onImagesUploaded: (files: File[]) => void;
  isAnalyzing: boolean;
  loadingLabel?: string;
  activePreviews?: string[];
}

const SAMPLE_DESTINATIONS = [
  {
    name: "Paris",
    emoji: "🗼",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80",
    filename: "paris-eiffel.jpg",
  },
  {
    name: "Kyoto",
    emoji: "⛩️",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
    filename: "kyoto-temple.jpg",
  },
  {
    name: "Phuket",
    emoji: "🏖️",
    image: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=800&auto=format&fit=crop&q=80",
    filename: "phuket-beach.jpg",
  },
  {
    name: "Swiss Alps",
    emoji: "🏔️",
    image: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&auto=format&fit=crop&q=80",
    filename: "swiss-alps.jpg",
  },
];

const ImageUpload = ({
  onImagesUploaded,
  isAnalyzing,
  loadingLabel = "Analyzing Destinations...",
  activePreviews,
}: ImageUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const displayedPreviews = activePreviews && activePreviews.length > 0 ? activePreviews : previews;

  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter(f => f.type.startsWith("image/")).slice(0, 10);
      if (validFiles.length === 0) return;
      
      const newPreviews = validFiles.map(f => URL.createObjectURL(f));
      setPreviews(newPreviews);
      onImagesUploaded(validFiles);
    },
    [onImagesUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  };

  const clearImages = () => {
    setPreviews([]);
  };

  const handleSampleClick = async (sample: typeof SAMPLE_DESTINATIONS[0]) => {
    if (isAnalyzing || isLoadingSample) return;
    setIsLoadingSample(true);
    try {
      const response = await fetch(sample.image);
      const blob = await response.blob();
      const file = new File([blob], sample.filename, { type: "image/jpeg" });
      handleFiles([file]);
    } catch (error) {
      console.error("Failed to load sample image", error);
    } finally {
      setIsLoadingSample(false);
    }
  };

  if (displayedPreviews.length > 0) {
    return (
      <div className="animate-in fade-in max-w-2xl mx-auto duration-500">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {displayedPreviews.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden shadow-xs border border-border/70 group">
              <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
              {!isAnalyzing && (
                <button 
                  type="button"
                  onClick={() => setPreviews(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {isAnalyzing && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center animate-pulse">
            <div className="size-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-foreground font-semibold text-sm">{loadingLabel}</p>
            <p className="text-muted-foreground text-xs mt-1">Vision AI is identifying landmarks & places</p>
          </div>
        )}
        
        {!isAnalyzing && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={clearImages} className="rounded-xl gap-1.5 text-xs">
              <X className="size-3.5" /> Upload Different Photos
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header text */}
      <div className="space-y-2 text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Step 1 of 4
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
          Upload a photo, get a trip
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Drop in a destination photo and Pixinerary's vision AI identifies it, then drafts a full itinerary around it.
        </p>
      </div>

      {/* Upload Dropzone */}
      <div
        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all ${
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-secondary/40"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={handleChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
        />
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <CloudUpload className="size-6 text-sky-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Drag & drop your travel photos</p>
          <p className="text-xs text-muted-foreground mt-0.5">or click to browse — JPG, PNG up to 10MB</p>
        </div>
      </div>

      {/* Sample Destinations */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-medium text-muted-foreground">Or try a sample destination</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SAMPLE_DESTINATIONS.map((sample) => (
            <button
              key={sample.name}
              type="button"
              disabled={isAnalyzing || isLoadingSample}
              onClick={() => handleSampleClick(sample)}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1.5 pl-1.5 pr-3.5 text-xs sm:text-sm font-medium shadow-2xs transition-all hover:border-sky-500/40 hover:shadow-xs disabled:opacity-50"
            >
              <span className="relative size-6 shrink-0 overflow-hidden rounded-full">
                <img
                  src={sample.image}
                  alt={sample.name}
                  className="w-full h-full object-cover"
                />
              </span>
              <span>{sample.emoji} {sample.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;

