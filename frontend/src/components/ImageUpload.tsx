import { useState, useCallback } from "react";
import { Upload, Image as ImageIcon, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  onImagesUploaded: (files: File[]) => void;
  isAnalyzing: boolean;
  loadingLabel?: string;
  activePreviews?: string[];
}

const ImageUpload = ({
  onImagesUploaded,
  isAnalyzing,
  loadingLabel = "Analyzing Destinations...",
  activePreviews,
}: ImageUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

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

  const loadSampleImages = async () => {
    try {
      // Create a dummy file for now, or fetch a real image from a placeholder service
      const response = await fetch("https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=600&auto=format&fit=crop");
      const blob = await response.blob();
      const file = new File([blob], "dubai.jpg", { type: "image/jpeg" });
      handleFiles([file]);
    } catch (error) {
      console.error("Failed to load sample image", error);
    }
  };

  if (displayedPreviews.length > 0) {
    return (
      <div className="animate-fade-in max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
          {displayedPreviews.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden shadow-md group">
              <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
              {!isAnalyzing && (
                <button 
                  onClick={() => setPreviews(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-foreground/50 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {isAnalyzing && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center animate-pulse-soft">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium text-lg">{loadingLabel}</p>
            <p className="text-muted-foreground text-sm mt-1">Vision AI is identifying landmarks and comparing visual similarity</p>
          </div>
        )}
        
        {!isAnalyzing && (
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={clearImages} className="rounded-full">
              <X className="w-4 h-4 mr-2" /> Start Over
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center transition-all max-w-2xl mx-auto backdrop-blur-md ${
        dragActive
          ? "border-[#126c78] bg-[#126c78]/5 scale-[1.02] shadow-[0_12px_30px_rgba(18,108,120,0.15)]"
          : "border-[#126c78]/25 bg-white/60 hover:border-[#126c78]/50 hover:bg-white/80 shadow-[0_8px_25px_rgba(18,108,120,0.06)]"
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
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0" 
      />
      <div className="animate-float relative z-10 pointer-events-none mb-6">
        <div className="w-20 h-20 rounded-[22px_22px_22px_8px] bg-gradient-to-br from-[#126c78] to-[#188c91] flex items-center justify-center mx-auto shadow-[0_12px_28px_rgba(18,108,120,0.35)] relative">
          <Camera className="w-10 h-10 text-white" />
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#ff9276] flex items-center justify-center shadow-md">
            <Upload className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
      <h3 className="text-xl font-bold text-[#173b43] mb-2 relative z-10 pointer-events-none">
        Upload Travel Photos
      </h3>
      <p className="text-sm text-[#5d7e84] mb-6 max-w-md mx-auto relative z-10 pointer-events-none">
        Drag & drop photos of landmarks, landscapes, or destinations, or browse from your device
      </p>
      <div className="flex items-center justify-center gap-3 relative z-10 flex-wrap">
        <Button
          variant="outline"
          className="gap-2 pointer-events-none rounded-xl border-[#126c78]/25 bg-white/90 text-[#173b43] font-semibold text-xs shadow-xs"
        >
          <Upload className="w-4 h-4 text-[#188c91]" /> Browse Files
        </Button>
        <Button 
          variant="outline" 
          className="gap-2 rounded-xl border-[#126c78]/25 bg-white/90 hover:bg-white text-[#173b43] font-semibold text-xs shadow-xs hover:border-[#126c78]/50" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            loadSampleImages();
          }}
        >
          <ImageIcon className="w-4 h-4 text-[#ff9276]" /> Try Sample Image
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-4 relative z-10 pointer-events-none">
        Supports JPG, PNG, WebP • Up to 10 photos
      </p>
    </div>
  );
};

export default ImageUpload;
