import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, Loader2, Check, Sparkles, Image as ImageIcon, ExternalLink, Link2, AlertCircle } from "lucide-react";
import { searchPhotosOnline, type PhotoSearchResult } from "@/services/photoService";
import { toast } from "sonner";

interface ChangePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityTitle: string;
  englishName?: string;
  imageKeyword?: string;
  currentPhotoUrl?: string | null;
  cityName?: string;
  onSelectPhoto: (newPhotoUrl: string, isUserPhoto: boolean) => void;
}

export function ChangePhotoModal({
  isOpen,
  onClose,
  activityTitle,
  englishName,
  imageKeyword,
  currentPhotoUrl,
  cityName,
  onSelectPhoto,
}: ChangePhotoModalProps) {
  const initialQuery = imageKeyword || englishName || activityTitle || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<PhotoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentPhotoUrl || null);

  // Direct Image URL paste state
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "url">("search");

  useEffect(() => {
    if (isOpen) {
      const q = imageKeyword || englishName || activityTitle || "";
      setSearchQuery(q);
      setSelectedUrl(currentPhotoUrl || null);
      setCustomUrlInput("");
      setPreviewError(false);
      setActiveTab("search");
      if (q.trim()) {
        performSearch(q);
      }
    }
  }, [isOpen, activityTitle, englishName, imageKeyword, currentPhotoUrl]);

  const performSearch = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) return;
    setIsLoading(true);
    try {
      const photos = await searchPhotosOnline(queryToSearch, cityName);
      setResults(photos);
    } catch (err) {
      console.error("Failed to search photos:", err);
      toast.error("ไม่สามารถค้นหารูปภาพได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleSelect = (url: string, isUser: boolean = false) => {
    setSelectedUrl(url);
    onSelectPhoto(url, isUser);
    toast.success("อัปเดตรูปภาพของสถานที่เรียบร้อยแล้ว");
    onClose();
  };

  const handleOpenGoogleImages = () => {
    const q = searchQuery.trim() || activityTitle;
    const searchTarget = cityName && !q.toLowerCase().includes(cityName.toLowerCase()) ? `${q} ${cityName}` : q;
    const googleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTarget)}`;
    window.open(googleUrl, "_blank", "noopener,noreferrer");
    toast.info("เปิด Google Images ในแท็บใหม่แล้ว คัดลอกที่อยู่รูปภาพ (Image Address) มาวางในช่องด้านล่างได้เลย!");
    setActiveTab("url");
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      toast.error("กรุณาวางลิงก์รูปภาพก่อน");
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:image/")) {
      toast.error("ลิงก์รูปภาพต้องขึ้นต้นด้วย https:// หรือ http://");
      return;
    }
    handleSelect(trimmed, true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        handleSelect(base64Url, true);
      }
    };
    reader.onerror = () => {
      toast.error("เกิดข้อผิดพลาดในการโหลดรูปภาพ");
    };
    reader.readAsDataURL(file);
  };

  const getSourceBadgeColor = (source: PhotoSearchResult["source"]) => {
    switch (source) {
      case "foursquare":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-200";
      case "openverse":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200";
      case "google":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
      case "wikipedia":
        return "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200";
      case "wikidata":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200";
      case "wikimedia":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
      default:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            เปลี่ยนรูปภาพสถานที่
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground truncate">
            เลือกรูปภาพที่ตรงกับ <span className="font-semibold text-foreground">{activityTitle}</span> จาก Google, Foursquare, Wikimedia หรือวางลิงก์รูปของคุณ
          </DialogDescription>
        </DialogHeader>

        {/* Action Modes & Tabs */}
        <div className="flex items-center justify-between gap-2 border-b pb-2 pt-1">
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === "search"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ค้นหาจากคลังรูปภาพ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                activeTab === "url"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="w-3 h-3" />
              วางลิงก์รูป (Google / URL)
            </button>
          </div>

          {/* Quick Google Images Shortcut Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenGoogleImages}
            className="h-8 text-xs font-semibold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 gap-1.5 shrink-0"
            title="เปิดหน้าค้นหาภาพใน Google Images ของสถานที่นี้ในแท็บใหม่"
          >
            <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>ค้นหาใน Google Images ↗</span>
          </Button>
        </div>

        {/* Tab 1: Search Online */}
        {activeTab === "search" && (
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3 pb-2">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="พิมพ์ชื่อสถานที่เพื่อค้นหารูปภาพ..."
                  className="pl-9 pr-4 h-9 text-sm w-full"
                />
              </div>
              <Button type="submit" disabled={isLoading} size="sm" className="shrink-0 h-9 px-3.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                ค้นหา
              </Button>
            </form>

            <label className="shrink-0 w-full sm:w-auto">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto h-9 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 cursor-pointer flex items-center gap-1.5 text-xs"
                asChild
              >
                <span>
                  <Upload className="w-3.5 h-3.5 text-primary" />
                  อัปโหลดรูปเอง
                </span>
              </Button>
            </label>
          </div>
        )}

        {/* Tab 2: Paste Direct Image URL */}
        {activeTab === "url" && (
          <div className="p-3 bg-muted/40 rounded-xl border space-y-2.5 my-2">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={customUrlInput}
                  onChange={(e) => {
                    setCustomUrlInput(e.target.value);
                    setPreviewError(false);
                  }}
                  placeholder="วางลิงก์รูปภาพที่คัดลอกจาก Google Images หรือเว็บไซต์ (https://...)"
                  className="pl-9 pr-4 h-9 text-xs w-full bg-background"
                />
              </div>
              <Button
                type="button"
                onClick={handleApplyCustomUrl}
                disabled={!customUrlInput.trim() || previewError}
                size="sm"
                className="h-9 px-4 shrink-0 text-xs font-semibold w-full sm:w-auto"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                ใช้รูปนี้กับการ์ด
              </Button>
            </div>

            {/* Live Preview of Pasted URL */}
            {customUrlInput.trim() && (
              <div className="flex items-center gap-3 pt-1">
                <div className="relative w-20 h-14 rounded-lg overflow-hidden border bg-background shrink-0">
                  <img
                    src={customUrlInput.trim()}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => setPreviewError(true)}
                    onLoad={() => setPreviewError(false)}
                  />
                  {previewError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 text-destructive text-[10px] text-center p-1 font-medium">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="text-xs">
                  {previewError ? (
                    <span className="text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> ลิงก์รูปภาพไม่ถูกต้อง หรือเว็บไซต์ต้นทางไม่อนุญาตให้แสดงภาพโดยตรง
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> ตรวจสอบภาพสำเร็จ พร้อมนำไปใช้แล้ว!
                    </span>
                  )}
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    เคล็ดลับ: ใน Google Images ให้คลิกขวาที่รูปภาพ แล้วเลือก <strong>"Copy image address (คัดลอกที่อยู่รูปภาพ)"</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto min-h-[280px] max-h-[420px] pr-1 mt-1">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">กำลังค้นหารูปภาพจาก Foursquare, Wikimedia และคลังภาพ...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {results.map((item, idx) => {
                const isSelected = selectedUrl === item.url;
                return (
                  <div
                    key={`${item.url}-${idx}`}
                    onClick={() => handleSelect(item.url, item.source === "custom" || item.source === "google")}
                    className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 aspect-[4/3] bg-muted/30 hover:shadow-lg ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 shadow-md scale-[1.02]"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

                    {/* Source Badge */}
                    <div className="absolute top-2 left-2">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-none font-medium capitalize shadow-sm ${getSourceBadgeColor(item.source)}`}>
                        {item.source}
                      </Badge>
                    </div>

                    {/* Selected Check Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}

                    {/* Caption / Title */}
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <p className="text-white text-[11px] font-medium truncate drop-shadow-sm">
                        {item.title}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground text-center px-4">
              <Sparkles className="w-8 h-8 text-muted-foreground/60 mb-1" />
              <p className="text-sm font-medium text-foreground">ไม่พบรูปภาพสำหรับคำค้นหานี้</p>
              <p className="text-xs max-w-md">
                กดปุ่ม <strong>"ค้นหาใน Google Images ↗"</strong> ด้านบนเพื่อเปิดดูภาพจริงใน Google แล้วคัดลอกลิงก์มาวางได้เลยครับ!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
