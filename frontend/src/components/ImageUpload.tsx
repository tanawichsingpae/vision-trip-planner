import { useState, useCallback } from "react";
import { Upload, Image as ImageIcon, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  onImagesUploaded: (files: File[]) => void;
  isAnalyzing: boolean;
  loadingLabel?: string;
}

const ImageUpload = ({ onImagesUploaded, isAnalyzing, loadingLabel = "Analyzing Destinations..." }: ImageUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

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

  if (previews.length > 0) {
    return (
      <div className="animate-fade-in max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
          {previews.map((src, i) => (
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
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all max-w-2xl mx-auto ${
        dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50 hover:bg-muted/50"
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
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
      />
      <div className="animate-float">
        <div className="w-20 h-20 rounded-2xl travel-gradient flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Camera className="w-10 h-10 text-primary-foreground" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Upload a Travel Destination Image</h3>
      <p className="text-muted-foreground mb-6">Drag & drop an image or click to browse</p>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" /> Browse Files
        </Button>
        <Button variant="outline" className="gap-2">
          <ImageIcon className="w-4 h-4" /> Sample Images
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Supports JPG, PNG, WebP • Max 10MB</p>
    </div>
  );
};

export default ImageUpload;
