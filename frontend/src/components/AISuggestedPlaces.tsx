import { useState, useCallback, useEffect, useMemo } from "react";
import { Sparkles, RefreshCw, Plus } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DEFAULT_IMAGE, CATEGORY_FALLBACK_IMAGES } from "@/components/TravelItinerary";
import { getCuratedFallbackPhoto } from "@/services/photoService";
import { useLanguage } from "@/context/LanguageContext";

export interface SuggestedPlace {
  id: string;
  name: string;
  category: "culture" | "food" | "nature" | "adventure" | "activity" | "shopping" | "nightlife" | "relax" | "landmark" | "photo" | "entertainment" | "spiritual" | "hotel" | "attraction";
  description: string;
  image: string;
  image_url?: string | null;
  photo_url?: string | null;
  isUserPhoto?: boolean;
  english_name?: string;
  name_th?: string;
  name_en?: string;
  title_th?: string;
  title_en?: string;
  description_th?: string;
  description_en?: string;
  wiki_title?: string;
  image_keyword?: string;
  lat: number;
  lng: number;
  openingHours?: string[] | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  openNow?: boolean | null;
  priceLevel?: number | null;
  website?: string | null;
  phoneNumber?: string | null;
}

const getSuggestedPlaceImage = (place: SuggestedPlace): string => {
  if (place.photo_url && typeof place.photo_url === "string" && place.photo_url.trim().length > 0 && !place.photo_url.includes("undefined")) {
    return place.photo_url;
  }
  if (place.image_url && typeof place.image_url === "string" && place.image_url.trim().length > 0 && !place.image_url.includes("undefined")) {
    return place.image_url;
  }
  if (place.image && typeof place.image === "string" && place.image.trim().length > 0 && !place.image.includes("undefined") && !place.image.includes("picsum")) {
    return place.image;
  }
  return getCuratedFallbackPhoto(place.category, place.image_keyword || place.english_name || place.name);
};


const categoryConfig: Record<string, { label: string; label_th: string; color: string }> = {
  culture: { label: "Culture", label_th: "วัฒนธรรม & ประวัติศาสตร์", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200" },
  food: { label: "Food", label_th: "อาหาร & สตรีทฟู้ด", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200" },
  nature: { label: "Nature", label_th: "ธรรมชาติ & วิวสวย", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200" },
  adventure: { label: "Adventure", label_th: "ผจญภัย & กิจกรรม", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200" },
  activity: { label: "Activity", label_th: "กิจกรรม & ทัวร์", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200" },
  shopping: { label: "Shopping", label_th: "ช้อปปิ้ง & ตลาด", color: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200" },
  nightlife: { label: "Nightlife", label_th: "สถานบันเทิงยามค่ำคืน", color: "bg-slate-800 text-amber-400 dark:bg-slate-900 dark:text-amber-300 border-amber-400/30" },
  relax: { label: "Relax", label_th: "ผ่อนคลาย & สปา", color: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200" },
  landmark: { label: "📸 Landmark & Photo", label_th: "📸 แลนด์มาร์ก & ถ่ายรูป", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 font-medium" },
  photo: { label: "📸 Landmark & Photo", label_th: "📸 แลนด์มาร์ก & ถ่ายรูป", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 font-medium" },
  entertainment: { label: "🎪 Entertainment", label_th: "🎪 สวนสนุก & บันเทิง", color: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 font-medium" },
  spiritual: { label: "🔮 Spiritual & Mutelu", label_th: "🔮 สายมู & สถานที่ศักดิ์สิทธิ์", color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 font-medium" },
  hotel: { label: "🏨 Accommodation", label_th: "🏨 ที่พัก & โรงแรม", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 font-semibold" },
  attraction: { label: "Attraction", label_th: "สถานที่ท่องเที่ยว", color: "bg-primary/15 text-primary border-primary/20" },
};

export function getFallbackSuggestions(locationName: string): SuggestedPlace[] {
  const defaults = [
    {
      name: `Scenic SkyWalk & Photo Landmark in ${locationName}`,
      name_en: `Scenic SkyWalk & Photo Landmark in ${locationName}`,
      name_th: `จุดชมวิวสกายวอล์ก & แลนด์มาร์กถ่ายรูปใน ${locationName}`,
      category: "landmark" as const,
      description: `Iconic viewpoint and popular photo spot with stunning panorama.`,
      description_en: `Iconic viewpoint and popular photo spot with stunning panorama.`,
      description_th: `จุดชมวิวและจุดถ่ายรูปยอดนิยมพร้อมทัศนียภาพอันงดงามแบบพาโนรามา`
    },
    {
      name: `Historic Landmark & Temple in ${locationName}`,
      name_en: `Historic Landmark & Temple in ${locationName}`,
      name_th: `วัดและโบราณสถานสำคัญทางประวัติศาสตร์ใน ${locationName}`,
      category: "culture" as const,
      description: `Popular historical landmark and architectural heritage spot.`,
      description_en: `Popular historical landmark and architectural heritage spot.`,
      description_th: `สถานที่สำคัญทางประวัติศาสตร์และมรดกทางสถาปัตยกรรมอันทรงคุณค่า`
    },
    {
      name: `Famous Local Restaurant in ${locationName}`,
      name_en: `Famous Local Restaurant in ${locationName}`,
      name_th: `ร้านอาหารท้องถิ่นชื่อดังใน ${locationName}`,
      category: "food" as const,
      description: `Authentic local cuisine and top-rated regional specialties.`,
      description_en: `Authentic local cuisine and top-rated regional specialties.`,
      description_th: `อาหารท้องถิ่นต้นตำรับรสชาติยอดเยี่ยมและเมนูเด็ดประจำภูมิภาค`
    },
    {
      name: `Sacred Shrine & Spiritual Blessing Spot`,
      name_en: `Sacred Shrine & Spiritual Blessing Spot`,
      name_th: `ศาลเจ้าศักดิ์สิทธิ์ & จุดสักการะขอพรเสริมสิริมงคล`,
      category: "spiritual" as const,
      description: `Revered spiritual destination for blessings, fortune, and peaceful reflection.`,
      description_en: `Revered spiritual destination for blessings, fortune, and peaceful reflection.`,
      description_th: `จุดสักการะขอพรยอดนิยมเพื่อความเป็นสิริมงคล โชคลาภ และความสงบในจิตใจ`
    },
    {
      name: `Exciting Theme Park & Entertainment Complex`,
      name_en: `Exciting Theme Park & Entertainment Complex`,
      name_th: `สวนสนุกและศูนย์รวมความบันเทิงสุดตื่นเต้น`,
      category: "entertainment" as const,
      description: `Thrilling rides, shows, and family entertainment attractions.`,
      description_en: `Thrilling rides, shows, and family entertainment attractions.`,
      description_th: `เครื่องเล่นสุดเร้าใจ การแสดงสุดอลังการ และแหล่งบันเทิงสำหรับทุกคน`
    },
    {
      name: `Scenic Viewpoint & Central Park`,
      name_en: `Scenic Viewpoint & Central Park`,
      name_th: `จุดชมวิวธรรมชาติ & สวนสาธารณะใจกลางเมือง`,
      category: "nature" as const,
      description: `Beautiful green landscape with panoramic views.`,
      description_en: `Beautiful green landscape with panoramic views.`,
      description_th: `พื้นที่สีเขียวทัศนียภาพงดงาม เหมาะสำหรับเดินเล่นและชมวิวเมือง`
    },
    {
      name: `Popular Night Market & Evening District`,
      name_en: `Popular Night Market & Evening District`,
      name_th: `ตลาดนัดกลางคืนยอดนิยม & ย่านสตรีทฟู้ดยามเย็น`,
      category: "nightlife" as const,
      description: `Lively night market featuring street food and shopping.`,
      description_en: `Lively night market featuring street food and shopping.`,
      description_th: `ตลาดนัดยามค่ำคืนสุดคึกคัก เต็มไปด้วยอาหารสตรีทฟู้ดและของฝากน่าช้อป`
    },
    {
      name: `Central Shopping Arcade`,
      name_en: `Central Shopping Arcade`,
      name_th: `ศูนย์การค้าและแหล่งช้อปปิ้งของฝาก`,
      category: "shopping" as const,
      description: `Vibrant retail center with souvenirs and local handicrafts.`,
      description_en: `Vibrant retail center with souvenirs and local handicrafts.`,
      description_th: `ศูนย์รวมร้านค้า ของที่ระลึก และสินค้าหัตถกรรมท้องถิ่นยอดนิยม`
    },
    {
      name: `Relaxing Spa & Wellness Center`,
      name_en: `Relaxing Spa & Wellness Center`,
      name_th: `สปาและศูนย์ดูแลสุขภาพเพื่อการผ่อนคลาย`,
      category: "relax" as const,
      description: `Calming sanctuary for traditional massage and relaxation.`,
      description_en: `Calming sanctuary for traditional massage and relaxation.`,
      description_th: `สถานที่ผ่อนคลายด้วยการนวดแผนโบราณและการปรนนิบัติสุขภาพอย่างแท้จริง`
    },
    {
      name: `Outdoor Adventure Trail & Nature Walk in ${locationName}`,
      name_en: `Outdoor Adventure Trail & Nature Walk in ${locationName}`,
      name_th: `เส้นทางผจญภัยศึกษาธรรมชาติ & กิจกรรมกลางแจ้งใน ${locationName}`,
      category: "adventure" as const,
      description: `Scenic hiking and nature exploration trail with lush surroundings.`,
      description_en: `Scenic hiking and nature exploration trail with lush surroundings.`,
      description_th: `เส้นทางเดินป่าและสำรวจธรรมชาติสัมผัสความร่มรื่นและบรรยากาศอันบริสุทธิ์`
    },
    {
      name: `Iconic Local Cafe & Dessert Spot in ${locationName}`,
      name_en: `Iconic Local Cafe & Dessert Spot in ${locationName}`,
      name_th: `คาเฟ่และร้านขนมหวานยอดนิยมใน ${locationName}`,
      category: "food" as const,
      description: `Charming local cafe offering specialty coffee, beverages, and famous artisan desserts.`,
      description_en: `Charming local cafe offering specialty coffee, beverages, and famous artisan desserts.`,
      description_th: `คาเฟ่บรรยากาศอบอุ่นพร้อมกาแฟแก้วโปรด เครื่องดื่ม และขนมหวานสูตรพิเศษแสนอร่อย`
    },
    {
      name: `Interactive Cultural Museum & Art Gallery in ${locationName}`,
      name_en: `Interactive Cultural Museum & Art Gallery in ${locationName}`,
      name_th: `พิพิธภัณฑ์ศิลปวัฒนธรรม & แกลเลอรีสร้างสรรค์ใน ${locationName}`,
      category: "culture" as const,
      description: `Engaging cultural exhibits, local history, and contemporary regional artworks.`,
      description_en: `Engaging cultural exhibits, local history, and contemporary regional artworks.`,
      description_th: `นิทรรศการวัฒนธรรมอันทรงคุณค่า ประวัติศาสตร์ท้องถิ่น และผลงานศิลปะร่วมสมัย`
    },
    {
      name: `Waterfront Marina & Scenic Boat Pier in ${locationName}`,
      name_en: `Waterfront Marina & Scenic Boat Pier in ${locationName}`,
      name_th: `ท่าเรือท่องเที่ยวริมน้ำ & จุดชมทัศนียภาพริมสายน้ำใน ${locationName}`,
      category: "activity" as const,
      description: `Scenic riverside walk and boat tour terminal offering picturesque cruise activities.`,
      description_en: `Scenic riverside walk and boat tour terminal offering picturesque cruise activities.`,
      description_th: `ท่าเรือท่องเที่ยวริมสายน้ำและจุดล่องเรือสัมผัสบรรยากาศวิถีชีวิตริมน้ำสุดประทับใจ`
    },
    {
      name: `Boutique Handicraft & Artisan Mall in ${locationName}`,
      name_en: `Boutique Handicraft & Artisan Mall in ${locationName}`,
      name_th: `คอมมูนิตี้มอลล์งานคราฟต์ & แหล่งช้อปปิ้งของทำมือใน ${locationName}`,
      category: "shopping" as const,
      description: `Open-air lifestyle complex featuring handcrafted goods, fashion, and local artist stalls.`,
      description_en: `Open-air lifestyle complex featuring handcrafted goods, fashion, and local artist stalls.`,
      description_th: `ศูนย์รวมสินค้างานฝีมือ ของทำมือน่ารัก งานดีไซน์ และสินค้าไลฟ์สไตล์จากศิลปินท้องถิ่น`
    }
  ];

  return defaults.map((item, i) => ({
    id: `fallback-sug-${i}-${Date.now()}`,
    name: item.name,
    name_en: item.name_en,
    name_th: item.name_th,
    title_en: item.name_en,
    title_th: item.name_th,
    category: item.category,
    description: item.description,
    description_en: item.description_en,
    description_th: item.description_th,
    image: CATEGORY_FALLBACK_IMAGES[item.category] || DEFAULT_IMAGE,
    photo_url: CATEGORY_FALLBACK_IMAGES[item.category] || DEFAULT_IMAGE,
    image_url: CATEGORY_FALLBACK_IMAGES[item.category] || DEFAULT_IMAGE,
    lat: 0,
    lng: 0,
    rating: 4.5 + (i % 3) * 0.2,
    userRatingsTotal: 250 + i * 80,
  }));
}

interface DraggableSuggestionProps {
  place: SuggestedPlace;
  onAdd?: (place: SuggestedPlace, dayIndex: number, time: string) => void;
  daysCount: number;
}

const DraggableSuggestion = ({ place, onAdd, daysCount }: DraggableSuggestionProps) => {
  const { language, locPlace, locDesc } = useLanguage();
  const [selectedDay, setSelectedDay] = useState<string>("0");
  const [selectedTime, setSelectedTime] = useState<string>("12:00");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const times = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, "0");
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
  });

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `suggestion-${place.id}`,
    data: { type: "suggestion", place },
  });

  const config = categoryConfig[place.category] || categoryConfig.activity;

  return (
    <div
      ref={setNodeRef}
      className={`group relative min-w-[270px] sm:min-w-[290px] max-w-[320px] rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 snap-start cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30 scale-95" : "hover:-translate-y-1"
        }`}
      {...attributes}
      {...listeners}
    >
      <div className="relative h-40 overflow-hidden">
        <img
          src={getSuggestedPlaceImage(place)}
          alt={locPlace(place)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            const cat = (place.category || "attraction").toLowerCase();
            e.currentTarget.src = CATEGORY_FALLBACK_IMAGES[cat] || DEFAULT_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
        <Badge variant="outline" className={`absolute top-2.5 left-2.5 text-[10px] backdrop-blur-sm ${config.color}`}>
          {language === "th" ? config.label_th : config.label}
        </Badge>
      </div>
      <div className="p-3.5">
        <h4 className="font-semibold text-foreground text-sm leading-tight mb-1">{locPlace(place)}</h4>
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{locDesc(place)}</p>

        <div onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full h-7 text-xs text-primary hover:bg-primary/10 relative z-10"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                {language === "th" ? "เพิ่มลงในตารางท่องเที่ยว" : "Add to Itinerary"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-3 z-[100]"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{language === "th" ? "เลือกวัน" : "Select Day"}</Label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      {Array.from({ length: daysCount }).map((_, i) => (
                        <SelectItem key={i} value={i.toString()} className="text-xs">
                          {language === "th" ? `วันที่ ${i + 1}` : `Day ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{language === "th" ? "เลือกเวลา" : "Select Time"}</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent className="z-[110] max-h-[160px]">
                      {times.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd?.(place, parseInt(selectedDay, 10), selectedTime);
                    setIsPopoverOpen(false);
                  }}
                >
                  {language === "th" ? "ยืนยันเพิ่ม" : "Confirm Add"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

// Overlay for drag preview
export const SuggestionDragOverlay = ({ place }: { place: SuggestedPlace }) => {
  const { language, locPlace } = useLanguage();
  const config = categoryConfig[place.category] || categoryConfig.activity;
  return (
    <div className="w-64 rounded-2xl overflow-hidden bg-card border border-primary shadow-2xl scale-105 rotate-1">
      <div className="relative h-36 overflow-hidden">
        <img
          src={getSuggestedPlaceImage(place)}
          alt={locPlace(place)}
          className="w-full h-full object-cover"
          onError={(e) => {
            const cat = (place.category || "attraction").toLowerCase();
            e.currentTarget.src = CATEGORY_FALLBACK_IMAGES[cat] || DEFAULT_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
      </div>
      <div className="p-3.5">
        <Badge variant="outline" className={`text-[10px] mb-1.5 ${config.color}`}>
          {language === "th" ? config.label_th : config.label}
        </Badge>
        <h4 className="font-semibold text-foreground text-sm">{locPlace(place)}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {language === "th" ? "วางลงในวันที่ต้องการเพื่อเพิ่ม" : "Drop into a day to add"}
        </p>
      </div>
    </div>
  );
};

interface AISuggestedPlacesProps {
  onAddToItinerary: (place: SuggestedPlace, dayIndex: number, time?: string) => void;
  locationName: string;
  suggestions?: SuggestedPlace[];
  onRefreshSuggestions?: () => Promise<void>;
  daysCount: number;
}

const CATEGORIES = ["all", "hotel", "attraction", "food", "nature", "culture", "activity"] as const;

const AISuggestedPlaces = ({ onAddToItinerary, locationName, suggestions: propSuggestions, onRefreshSuggestions, daysCount }: AISuggestedPlacesProps) => {
  const { language, t, locPlace, locDesc } = useLanguage();
  const [internalSuggestions, setInternalSuggestions] = useState<SuggestedPlace[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Guarantee at least 10 suggestions are always displayed (backfill if needed)
  const rawSuggestions = propSuggestions && propSuggestions.length > 0 ? propSuggestions : internalSuggestions;
  const suggestions = useMemo(() => {
    if (rawSuggestions.length >= 10) {
      return rawSuggestions;
    }
    const fallbacks = getFallbackSuggestions(locationName || "Destination");
    const existingNames = new Set(
      rawSuggestions.map((s) => (s.name || s.name_en || s.title_en || "").toLowerCase().trim())
    );
    const combined = [...rawSuggestions];
    for (const fb of fallbacks) {
      const fbKey = (fb.name || fb.name_en || "").toLowerCase().trim();
      if (!existingNames.has(fbKey)) {
        combined.push(fb);
        existingNames.add(fbKey);
        if (combined.length >= 10) break;
      }
    }
    return combined;
  }, [rawSuggestions, locationName]);

  const fetchSuggestions = useCallback(async () => {
    if (!locationName || propSuggestions) return;
    setIsRefreshing(true);
    try {
      // Internal suggestions are now deprecated or handled differently
      // setInternalSuggestions(data); 
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [locationName, propSuggestions]);

  useEffect(() => {
    if (!propSuggestions) {
      fetchSuggestions();
    }
  }, [fetchSuggestions, propSuggestions]);

  const filtered = activeFilter === "all"
    ? suggestions
    : suggestions.filter((s) => s.category === activeFilter);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshSuggestions) {
        await onRefreshSuggestions();
      } else {
        await fetchSuggestions();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSuggestions, onRefreshSuggestions]);

  const handleAdd = useCallback(
    (place: SuggestedPlace, dayIndex: number, time: string) => {
      onAddToItinerary(place, dayIndex, time);
    },
    [onAddToItinerary],
  );

  return (
    <div className="animate-slide-up w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            {language === "th" ? `สถานที่แนะนำเพิ่มเติมใกล้เคียง ${locPlace({ name: locationName }) || locationName}` : `AI Suggested Places near ${locPlace({ name: locationName }) || locationName}`}
          </h2>
          <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border-primary/20">
            {suggestions.length} {language === "th" ? "แห่ง" : "places"}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? (language === "th" ? "กำลังสร้าง..." : "Generating…") : (language === "th" ? "แนะนำสถานที่ใหม่" : "New Suggestions")}
        </Button>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${activeFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
          >
            {cat === "all" ? (language === "th" ? "ทั้งหมด" : "All") : (language === "th" ? (categoryConfig[cat]?.label_th || cat) : (categoryConfig[cat]?.label || cat))}
          </button>
        ))}
      </div>

      {/* Cards horizontal scroll */}
      <div className="relative">
        {isRefreshing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm rounded-2xl">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-medium">{language === "th" ? "AI กำลังค้นหาสถานที่น่าสนใจใหม่ๆ..." : "AI is finding new places…"}</span>
            </div>
          </div>
        )}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
          {filtered.map((place) => (
            <DraggableSuggestion key={place.id} place={place} onAdd={handleAdd} daysCount={daysCount} />
          ))}
          {!isRefreshing && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 w-full text-center">
              {language === "th" ? "ไม่พบสถานที่ในหมวดหมู่นี้ ลองเลือกหมวดหมู่อื่นหรือกดแนะนำสถานที่ใหม่" : "No suggestions in this category. Try another filter or refresh."}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        {language === "th" ? "คลิก 'เพิ่มลงในตารางท่องเที่ยว' เพื่อบรรจุสถานที่ลงในวันและเวลาที่ต้องการ" : "Click 'Add to Itinerary' to include them in your plan."}
      </p>
    </div>
  );
};

export default AISuggestedPlaces;
