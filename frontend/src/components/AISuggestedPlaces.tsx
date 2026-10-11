import { useState, useCallback, useEffect, useMemo } from "react";
import { Sparkles, RefreshCw, Plus, Camera } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DEFAULT_IMAGE, CATEGORY_FALLBACK_IMAGES } from "@/components/TravelItinerary";
import { getCuratedFallbackPhoto, fetchSmartPhoto } from "@/services/photoService";
import { getPlaceImageFromCache, setPlaceImageInCache, isSerperConfigured } from "@/services/serperClient";
import { ChangePhotoModal } from "@/components/ChangePhotoModal";
import { useLanguage } from "@/context/LanguageContext";
import { cleanSuggestedPlaceName } from "@/api/geocode";

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

export const getSuggestedPlaceImage = (place: SuggestedPlace, cityName?: string): string => {
  // 1. Check Multi-Tier Cache first (L1 Memory Map -> L2 localStorage)
  const cached =
    getPlaceImageFromCache(place.name) ||
    (place.name_en ? getPlaceImageFromCache(place.name_en) : null) ||
    (place.english_name ? getPlaceImageFromCache(place.english_name) : null) ||
    (place.name_th ? getPlaceImageFromCache(place.name_th) : null) ||
    (place.image_keyword ? getPlaceImageFromCache(place.image_keyword) : null);
  if (cached) {
    return cached;
  }

  // 2. Real photo if provided
  if (place.photo_url && typeof place.photo_url === "string" && place.photo_url.trim().length > 0 && !place.photo_url.includes("undefined") && !place.photo_url.includes("picsum")) {
    return place.photo_url;
  }
  if (place.image_url && typeof place.image_url === "string" && place.image_url.trim().length > 0 && !place.image_url.includes("undefined") && !place.image_url.includes("picsum")) {
    return place.image_url;
  }
  if (place.image && typeof place.image === "string" && place.image.trim().length > 0 && !place.image.includes("undefined") && !place.image.includes("picsum")) {
    return place.image;
  }
  return getCuratedFallbackPhoto(place.category, place.image_keyword || place.english_name || place.name, { cityName });
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
  const normCity = (locationName || "").toLowerCase().trim();
  const isBkk = /(bangkok|bkk|กรุงเทพ|บางกอก)/i.test(normCity);
  const isCnx = /(chiang\s*mai|cnx|เชียงใหม่)/i.test(normCity);
  const isTyo = /(tokyo|tyo|โตเกียว)/i.test(normCity);
  const isKyo = /(kyoto|เกียวโต)/i.test(normCity);
  const isOsa = /(osaka|osa|โอซาก้า|โอซากา)/i.test(normCity);
  const isHkt = /(phuket|hkt|ภูเก็ต)/i.test(normCity);

  let defaults: Array<{
    name: string;
    name_en: string;
    name_th: string;
    category: SuggestedPlace["category"];
    description: string;
    description_en: string;
    description_th: string;
    lat: number;
    lng: number;
  }>;

  if (isBkk) {
    defaults = [
      {
        name: "Mahanakhon SkyWalk",
        name_en: "Mahanakhon SkyWalk",
        name_th: "มหานคร สกายวอล์ค",
        category: "landmark",
        description: "Iconic glass-tray observation deck on the 78th floor offering 360-degree panoramic views of Bangkok.",
        description_en: "Iconic glass-tray observation deck on the 78th floor offering 360-degree panoramic views of Bangkok.",
        description_th: "จุดชมวิวพื้นกระจกลอยฟ้าชั้น 78 สัมผัสทัศนียภาพกรุงเทพฯ แบบพาโนรามา 360 องศา",
        lat: 13.7225,
        lng: 100.5283,
      },
      {
        name: "Wat Arun (Temple of Dawn)",
        name_en: "Wat Arun (Temple of Dawn)",
        name_th: "วัดอรุณราชวรารามราชวรมหาวิหาร",
        category: "culture",
        description: "Stunning riverside Buddhist temple featuring an iconic porcelain-encrusted central prang.",
        description_en: "Stunning riverside Buddhist temple featuring an iconic porcelain-encrusted central prang.",
        description_th: "พระปรางค์ริมแม่น้ำเจ้าพระยาอันวิจิตรงดงามด้วยกระเบื้องเคลือบโบราณ สัญลักษณ์สำคัญแห่งกรุงเทพฯ",
        lat: 13.7437,
        lng: 100.4888,
      },
      {
        name: "Raan Jay Fai",
        name_en: "Raan Jay Fai",
        name_th: "ร้านเจ๊ไฝ (ประตูผี)",
        category: "food",
        description: "Legendary Michelin-starred street food eatery famous for crispy golden crab omelets.",
        description_en: "Legendary Michelin-starred street food eatery famous for crispy golden crab omelets.",
        description_th: "ร้านสตรีทฟู้ดระดับมิชลิน 1 ดาวชื่อดังระดับโลก เจ้าของเมนูไข่เจียวปูเนื้อแน่นในตำนาน",
        lat: 13.7526,
        lng: 100.5048,
      },
      {
        name: "Erawan Shrine",
        name_en: "Erawan Shrine",
        name_th: "ศาลท้าวมหาพรหมเอราวัณ ราชประสงค์",
        category: "spiritual",
        description: "World-renowned Hindu shrine frequented by worshippers seeking good fortune, blessings, and prosperity.",
        description_en: "World-renowned Hindu shrine frequented by worshippers seeking good fortune, blessings, and prosperity.",
        description_th: "ศาลท้าวมหาพรหมอันศักดิ์สิทธิ์ใจกลางราชประสงค์ จุดสักการะขอพรยอดนิยมระดับโลกเพื่อความเป็นสิริมงคล",
        lat: 13.7443,
        lng: 100.5404,
      },
      {
        name: "Siam Amazing Park",
        name_en: "Siam Amazing Park",
        name_th: "สยามอะเมซิ่งพาร์ค",
        category: "entertainment",
        description: "Exciting amusement and water park complex featuring giant wave pools, roller coasters, and family rides.",
        description_en: "Exciting amusement and water park complex featuring giant wave pools, roller coasters, and family rides.",
        description_th: "สวนสนุกและสวนน้ำระดับตำนาน ทะเลเทียมที่ใหญ่ที่สุดในโลกและเครื่องเล่นสุดระทึกใจสำหรับทุกคน",
        lat: 13.8058,
        lng: 100.6928,
      },
      {
        name: "Lumphini Park",
        name_en: "Lumphini Park",
        name_th: "สวนลุมพินี",
        category: "nature",
        description: "Sprawling green oasis in central Bangkok featuring peaceful lakes, shaded jogging paths, and resident monitor lizards.",
        description_en: "Sprawling green oasis in central Bangkok featuring peaceful lakes, shaded jogging paths, and resident monitor lizards.",
        description_th: "ปอดสีเขียวใจกลางกรุง สวนสาธารณะร่มรื่นริมทะเลสาบ เหมาะสำหรับการเดินเล่น พักผ่อน และปั่นเรือเป็ด",
        lat: 13.7314,
        lng: 100.5414,
      },
      {
        name: "Jodd Fairs Rama 9",
        name_en: "Jodd Fairs Rama 9",
        name_th: "จ๊อดแฟร์ พระราม 9",
        category: "nightlife",
        description: "Bustling evening night market packed with trending street foods, leng saap, sweet treats, and lifestyle booths.",
        description_en: "Bustling evening night market packed with trending street foods, leng saap, sweet treats, and lifestyle booths.",
        description_th: "ตลาดนัดกลางคืนสุดชิค รวมสตรีทฟู้ดยอดฮิตอย่างเล้งแซ่บ อาหารนานาชาติ และของแฟชั่นน่าช้อป",
        lat: 13.7570,
        lng: 100.5661,
      },
      {
        name: "ICONSIAM",
        name_en: "ICONSIAM",
        name_th: "ไอคอนสยาม",
        category: "shopping",
        description: "Premier riverside shopping complex housing the SookSiam indoor floating market, luxury boutiques, and waterfront promenade.",
        description_en: "Premier riverside shopping complex housing the SookSiam indoor floating market, luxury boutiques, and waterfront promenade.",
        description_th: "อภิมหาโครงการเมืองริมแม่น้ำเจ้าพระยา รวมแลนด์มาร์กสุขสยาม แบรนด์เนมชั้นนำ และจุดชมวิวริมสายน้ำสุดอลังการ",
        lat: 13.7267,
        lng: 100.5106,
      },
      {
        name: "Let's Relax Spa (Mandarin Hotel)",
        name_en: "Let's Relax Spa (Mandarin Hotel)",
        name_th: "เล็ทส์ รีแลกซ์ สปา",
        category: "relax",
        description: "Tranquil boutique spa renowned for authentic Thai herbal ball massage, aromatherapy, and mango sticky rice.",
        description_en: "Tranquil boutique spa renowned for authentic Thai herbal ball massage, aromatherapy, and mango sticky rice.",
        description_th: "สปาเพื่อการผ่อนคลายระดับพรีเมียม โดดเด่นด้วยการนวดแผนไทย ประคบสมุนไพร และบริการอบอุ่นประทับใจ",
        lat: 13.7329,
        lng: 100.5303,
      },
      {
        name: "Bang Krachao Green Oasis",
        name_en: "Bang Krachao Green Oasis",
        name_th: "คุ้งบางกระเจ้า (ปอดสีเขียวกรุงเทพฯ)",
        category: "adventure",
        description: "Looping bicycle nature sanctuary known as Bangkok's Green Lung, featuring elevated canopy paths and organic orchards.",
        description_en: "Looping bicycle nature sanctuary known as Bangkok's Green Lung, featuring elevated canopy paths and organic orchards.",
        description_th: "โอเอซิสสีเขียวใกล้กรุง ปั่นจักรยานสูดอากาศบริสุทธิ์ สำรวจสวนป่า เส้นทางยกระดับ และสวนศรีนครเขื่อนขันธ์",
        lat: 13.6961,
        lng: 100.5664,
      },
      {
        name: "Factory Coffee - Bangkok",
        name_en: "Factory Coffee - Bangkok",
        name_th: "แฟคทอรี่ คอฟฟี่",
        category: "food",
        description: "Award-winning specialty cafe celebrated for champion baristas, signature espresso creations, and flaky pastries.",
        description_en: "Award-winning specialty cafe celebrated for champion baristas, signature espresso creations, and flaky pastries.",
        description_th: "คาเฟ่กาแฟสเปเชียลตี้ระดับแชมป์บาริสต้า เมนูกาแฟซิกเนเจอร์รสสัมผัสแปลกใหม่และเบเกอรี่เลิศรส",
        lat: 13.7582,
        lng: 100.5348,
      },
      {
        name: "Museum Siam",
        name_en: "Museum Siam",
        name_th: "มิวเซียมสยาม (พิพิธภัณฑ์การเรียนรู้)",
        category: "culture",
        description: "Engaging interactive discovery museum housed in a neoclassical building exploring Thai identity and rich cultural history.",
        description_en: "Engaging interactive discovery museum housed in a neoclassical building exploring Thai identity and rich cultural history.",
        description_th: "พิพิธภัณฑ์การเรียนรู้แบบมีปฏิสัมพันธ์ ถ่ายทอดรากเหง้าวัฒนธรรมและอัตลักษณ์ความเป็นไทยอย่างสนุกสนาน",
        lat: 13.7441,
        lng: 100.4941,
      },
      {
        name: "Asiatique The Riverfront Pier",
        name_en: "Asiatique The Riverfront Pier",
        name_th: "เอเชียทีค เดอะ ริเวอร์ฟรอนต์",
        category: "activity",
        description: "Open-air riverside lifestyle mall and cruise pier with a giant ferris wheel and picturesque Chao Phraya views.",
        description_en: "Open-air riverside lifestyle mall and cruise pier with a giant ferris wheel and picturesque Chao Phraya views.",
        description_th: "ศูนย์การค้าริมแม่น้ำเจ้าพระยา ท่าเรือล่องเรือสำราญ ชิงช้าสวรรค์ยักษ์ และบรรยากาศลมเย็นยามค่ำคืน",
        lat: 13.7045,
        lng: 100.5032,
      },
      {
        name: "Chatuchak Weekend Market",
        name_en: "Chatuchak Weekend Market",
        name_th: "ตลาดนัดจตุจักร",
        category: "shopping",
        description: "World's largest weekend market with over 15,000 stalls offering clothing, antiques, local handicrafts, and street snacks.",
        description_en: "World's largest weekend market with over 15,000 stalls offering clothing, antiques, local handicrafts, and street snacks.",
        description_th: "ตลาดนัดสุดสัปดาห์ที่ใหญ่ที่สุดในโลก แหล่งรวมงานฝีมือ เสื้อผ้าแฟชั่น ของตกแต่งบ้าน และของกินละลานตา",
        lat: 13.7999,
        lng: 100.5507,
      },
    ];
  } else if (isCnx) {
    defaults = [
      {
        name: "Tha Phae Gate",
        name_en: "Tha Phae Gate",
        name_th: "ประตูท่าแพ",
        category: "landmark",
        description: "Historical red-brick gateway to the walled Old City and iconic photo gathering square.",
        description_en: "Historical red-brick gateway to the walled Old City and iconic photo gathering square.",
        description_th: "ประตูเมืองโบราณก่ออิฐแดงเอกลักษณ์แห่งเมืองเก่าเชียงใหม่ จุดถ่ายรูปยอดนิยม",
        lat: 18.7877,
        lng: 98.9934,
      },
      {
        name: "Wat Phra That Doi Suthep",
        name_en: "Wat Phra That Doi Suthep",
        name_th: "วัดพระธาตุดอยสุเทพราชวรวิหาร",
        category: "culture",
        description: "Revered sacred temple perched high atop Doi Suthep mountain featuring a gleaming golden pagoda.",
        description_en: "Revered sacred temple perched high atop Doi Suthep mountain featuring a gleaming golden pagoda.",
        description_th: "วัดคู่บ้านคู่เมืองเชียงใหม่บนยอดดอยสุเทพ พระธาตุสีทองอร่ามและจุดชมวิวเมืองเชียงใหม่มุมกว้าง",
        lat: 18.8049,
        lng: 98.9216,
      },
      {
        name: "Khao Soi Mae Sai",
        name_en: "Khao Soi Mae Sai",
        name_th: "ข้าวซอยแม่สาย",
        category: "food",
        description: "Renowned Michelin Bib Gourmand eatery serving rich northern coconut curry noodles and beef khao soi.",
        description_en: "Renowned Michelin Bib Gourmand eatery serving rich northern coconut curry noodles and beef khao soi.",
        description_th: "ร้านข้าวซอยรสเข้มข้นขวัญใจคนท้องถิ่น การันตีมิชลิน บิบ กูร์มองด์ หอมเครื่องแกงน้ำกะทิกลมกล่อม",
        lat: 18.7995,
        lng: 98.9754,
      },
      {
        name: "Wat Pha Lat (Hidden Jungle Temple)",
        name_en: "Wat Pha Lat (Hidden Jungle Temple)",
        name_th: "วัดผาลาด (สกทาคามี)",
        category: "spiritual",
        description: "Secluded forest sanctuary nestled beside waterfalls along the ancient monk's trail up Doi Suthep.",
        description_en: "Secluded forest sanctuary nestled beside waterfalls along the ancient monk's trail up Doi Suthep.",
        description_th: "วัดป่าโบราณอันเงียบสงบริมน้ำตกตามเส้นทางเดินธุดงค์ บรรยากาศร่มรื่นเปี่ยมมนต์ขลัง",
        lat: 18.8000,
        lng: 98.9333,
      },
      {
        name: "Grand Canyon Water Park",
        name_en: "Grand Canyon Water Park",
        name_th: "แกรนด์แคนยอน วอเตอร์พาร์ค เชียงใหม่",
        category: "entertainment",
        description: "Exhilarating outdoor water adventure park set in natural red clay canyon waters with floating obstacle courses.",
        description_en: "Exhilarating outdoor water adventure park set in natural red clay canyon waters with floating obstacle courses.",
        description_th: "สวนน้ำกลางแจ้งแคนยอนธรรมชาติ สนุกกับเครื่องเล่นเป่าลมลอยน้ำ สไลเดอร์ และกิจกรรมพายเรือสุดมันส์",
        lat: 18.6968,
        lng: 98.8924,
      },
      {
        name: "Doi Inthanon National Park",
        name_en: "Doi Inthanon National Park",
        name_th: "อุทยานแห่งชาติดอยอินทนนท์",
        category: "nature",
        description: "Thailand's highest mountain peak featuring mist-shrouded cloud forests, twin royal pagodas, and scenic trails.",
        description_en: "Thailand's highest mountain peak featuring mist-shrouded cloud forests, twin royal pagodas, and scenic trails.",
        description_th: "ยอดเขาที่สูงที่สุดในประเทศไทย สัมผัสอากาศหนาวเย็น ทะเลหมอก ป่าดึกดำบรรพ์ และพระมหาธาตุนภเมทนีดล",
        lat: 18.5888,
        lng: 98.4871,
      },
      {
        name: "Chiang Mai Night Bazaar",
        name_en: "Chiang Mai Night Bazaar",
        name_th: "เชียงใหม่ ไนท์บาซาร์",
        category: "nightlife",
        description: "Famed evening shopping strip brimming with local handicrafts, artwork, northern street snacks, and live music.",
        description_en: "Famed evening shopping strip brimming with local handicrafts, artwork, northern street snacks, and live music.",
        description_th: "ตลาดกลางคืนยอดนิยมบนถนนช้างคลาน รวมงานหัตถกรรมพื้นเมือง ของฝาก และอาหารเหนือแสนอร่อย",
        lat: 18.7865,
        lng: 99.0003,
      },
      {
        name: "Jing Jai Market (JJ Market)",
        name_en: "Jing Jai Market (JJ Market)",
        name_th: "ตลาดจริงใจ (JJ Market เชียงใหม่)",
        category: "shopping",
        description: "Charming morning weekend farmers and craft market showcasing organic coffee, artisan clothes, and eco-friendly wares.",
        description_en: "Charming morning weekend farmers and craft market showcasing organic coffee, artisan clothes, and eco-friendly wares.",
        description_th: "ตลาดเช้าสุดน่ารัก รวมผลผลิตเกษตรอินทรีย์ งานดีไซน์ทำมือ เสื้อผ้าผ้าฝ้ายย้อมคราม และกาแฟดริป",
        lat: 18.8066,
        lng: 99.0002,
      },
      {
        name: "Fah Lanna Spa (Old City)",
        name_en: "Fah Lanna Spa (Old City)",
        name_th: "ฟ้าลานนา สปา เชียงใหม่",
        category: "relax",
        description: "Award-winning luxury day spa offering traditional Lanna herbal therapies in an enchanting courtyard oasis.",
        description_en: "Award-winning luxury day spa offering traditional Lanna herbal therapies in an enchanting courtyard oasis.",
        description_th: "สปาล้านนาระดับรางวัล ผ่อนคลายกับการนวดตอกเส้น ประคบสมุนไพร และการดูแลสุขภาพในสวนร่มรื่น",
        lat: 18.7915,
        lng: 98.9858,
      },
      {
        name: "Mae Sa Waterfall Trail",
        name_en: "Mae Sa Waterfall Trail",
        name_th: "เส้นทางศึกษาธรรมชาติน้ำตกแม่สา",
        category: "adventure",
        description: "Cascading 10-tier waterfall trail shaded by dense rainforest in the Mae Rim valley.",
        description_en: "Cascading 10-tier waterfall trail shaded by dense rainforest in the Mae Rim valley.",
        description_th: "น้ำตก 10 ชั้นในหุบเขาแม่ริม เดินป่าศึกษาธรรมชาติ ร่มรื่นด้วยต้นไม้ใหญ่และสายน้ำใสเย็น",
        lat: 18.9056,
        lng: 98.8992,
      },
      {
        name: "Graph Cafe Nimman",
        name_en: "Graph Cafe Nimman",
        name_th: "กราฟ คาเฟ่ นิมมาน",
        category: "food",
        description: "Trendy minimalist specialty cafe known for creative nitro cold brew and artisanal single-origin beans.",
        description_en: "Trendy minimalist specialty cafe known for creative nitro cold brew and artisanal single-origin beans.",
        description_th: "คาเฟ่สายกาแฟสเปเชียลตี้ ดีไซน์มินิมอล โดดเด่นด้วยกาแฟไนโตรโคลด์บรูว์และเมล็ดกาแฟคั่วพิเศษ",
        lat: 18.7963,
        lng: 98.9686,
      },
      {
        name: "MAIIAM Contemporary Art Museum",
        name_en: "MAIIAM Contemporary Art Museum",
        name_th: "พิพิธภัณฑ์ศิลปะร่วมสมัยใหม่เอี่ยม",
        category: "culture",
        description: "Striking mirrored-facade museum housing groundbreaking contemporary exhibitions and Southeast Asian artworks.",
        description_en: "Striking mirrored-facade museum housing groundbreaking contemporary exhibitions and Southeast Asian artworks.",
        description_th: "พิพิธภัณฑ์ศิลปะร่วมสมัยดีไซน์กระจกสะท้อนเงา จัดแสดงผลงานศิลปะร่วมสมัยไทยและเอเชียตะวันออกเฉียงใต้",
        lat: 18.7735,
        lng: 99.1174,
      },
      {
        name: "Mae Ping River Cruise Pier",
        name_en: "Mae Ping River Cruise Pier",
        name_th: "ท่าเรือล่องแม่น้ำปิง วัดชัยมงคล",
        category: "activity",
        description: "Scenic long-tail boat cruise departing from Wat Chaimongkol through rural riverbanks and organic fruit farms.",
        description_en: "Scenic long-tail boat cruise departing from Wat Chaimongkol through rural riverbanks and organic fruit farms.",
        description_th: "ล่องเรือหางยาวสัมผัสวิถีชีวิตริมสองฝั่งแม่น้ำปิง แวะชมสวนเกษตรพื้นบ้านและชิมชาผลไม้",
        lat: 18.7891,
        lng: 99.0050,
      },
      {
        name: "One Nimman Lifestyle Mall",
        name_en: "One Nimman Lifestyle Mall",
        name_th: "วัน นิมมาน",
        category: "shopping",
        description: "Chic European-brick lifestyle complex featuring boutique shops, art spaces, food court, and weekend events.",
        description_en: "Chic European-brick lifestyle complex featuring boutique shops, art spaces, food court, and weekend events.",
        description_th: "คอมมูนิตี้มอลล์สถาปัตยกรรมอิฐสไตล์ยุโรป แหล่งรวมงานดีไซน์ คาเฟ่ ร้านอาหาร และกิจกรรมศิลปะ",
        lat: 18.7999,
        lng: 98.9682,
      },
    ];
  } else if (isTyo) {
    defaults = [
      {
        name: "Shibuya Sky Observation Deck",
        name_en: "Shibuya Sky Observation Deck",
        name_th: "จุดชมวิวชิบูย่า สกาย",
        category: "landmark",
        description: "Panoramic 360-degree open-air rooftop observation deck overlooking Shibuya Crossing and Tokyo skyline.",
        description_en: "Panoramic 360-degree open-air rooftop observation deck overlooking Shibuya Crossing and Tokyo skyline.",
        description_th: "จุดชมวิวดาดฟ้าเปิดโล่งแบบพาโนรามา 360 องศาเหนือห้าแยกชิบูย่า มองเห็นโตเกียวทาวเวอร์และภูเขาไฟฟูจิ",
        lat: 35.6586,
        lng: 139.7022,
      },
      {
        name: "Senso-ji Temple (Asakusa)",
        name_en: "Senso-ji Temple (Asakusa)",
        name_th: "วัดเซ็นโซจิ (วัดอาซากุสะ)",
        category: "culture",
        description: "Tokyo's oldest and most iconic Buddhist temple featuring the legendary Kaminarimon Gate with giant red lantern.",
        description_en: "Tokyo's oldest and most iconic Buddhist temple featuring the legendary Kaminarimon Gate with giant red lantern.",
        description_th: "วัดพุทธที่เก่าแก่ที่สุดในโตเกียว โดดเด่นด้วยประตูคามินาริมงและโคมแดงขนาดยักษ์ในตำนาน",
        lat: 35.7148,
        lng: 139.7967,
      },
      {
        name: "Tsukiji Outer Market",
        name_en: "Tsukiji Outer Market",
        name_th: "ตลาดปลาซึกิจิ (ตลาดนอก)",
        category: "food",
        description: "Historic vibrant culinary hub packed with sushi stalls, fresh wagyu skewers, tamagoyaki, and sea urchin.",
        description_en: "Historic vibrant culinary hub packed with sushi stalls, fresh wagyu skewers, tamagoyaki, and sea urchin.",
        description_th: "สวรรค์ของคนรักอาหารทะเลสด ซูชิ ข้าวหน้าปลาดิบ เนื้อวากิวย่าง และไข่หวานกระทะร้อน",
        lat: 35.6655,
        lng: 139.7708,
      },
      {
        name: "Meiji Jingu Shrine",
        name_en: "Meiji Jingu Shrine",
        name_th: "ศาลเจ้าเมจิ ฮาราจูกุ",
        category: "spiritual",
        description: "Serene Shinto shrine enveloped in a dense sacred forest dedicated to Emperor Meiji and Empress Shoken.",
        description_en: "Serene Shinto shrine enveloped in a dense sacred forest dedicated to Emperor Meiji and Empress Shoken.",
        description_th: "ศาลเจ้าชินโตอันศักดิ์สิทธิ์และร่มรื่นท่ามกลางผืนป่าใจกลางเมือง จุดขอพรเสริมสิริมงคลและความรัก",
        lat: 35.6764,
        lng: 139.6993,
      },
      {
        name: "Tokyo Disneyland",
        name_en: "Tokyo Disneyland",
        name_th: "โตเกียว ดิสนีย์แลนด์",
        category: "entertainment",
        description: "World-famous magical kingdom theme park with seven themed lands, beloved parades, and thrilling rides.",
        description_en: "World-famous magical kingdom theme park with seven themed lands, beloved parades, and thrilling rides.",
        description_th: "ดินแดนแห่งเวทมนตร์และจินตนาการระดับโลก เครื่องเล่นยอดฮิตและขบวนพาเหรดตระการตา",
        lat: 35.6329,
        lng: 139.8804,
      },
      {
        name: "Shinjuku Gyoen National Garden",
        name_en: "Shinjuku Gyoen National Garden",
        name_th: "สวนชินจูกุเกียวเอ็น",
        category: "nature",
        description: "Peaceful imperial park blending traditional Japanese landscape gardens, English lawns, and French formal gardens.",
        description_en: "Peaceful imperial park blending traditional Japanese landscape gardens, English lawns, and French formal gardens.",
        description_th: "สวนอุทยานหลวงอันเงียบสงบ ผสมผสานสวนญี่ปุ่นโบราณ สวนอังกฤษ และเรือนกระจกพืชพรรณเมืองร้อน",
        lat: 35.6852,
        lng: 139.7101,
      },
      {
        name: "Omoide Yokocho (Memory Lane)",
        name_en: "Omoide Yokocho (Memory Lane)",
        name_th: "ตรอกโอโมอิเดะ โยโคโจ (ชินจูกุ)",
        category: "nightlife",
        description: "Atmospheric Showa-era alley packed with cozy yakitori stalls, ramen counters, and craft sake bars.",
        description_en: "Atmospheric Showa-era alley packed with cozy yakitori stalls, ramen counters, and craft sake bars.",
        description_th: "ตรอกร้านอาหารสไตล์เรโทรยุคโชวะ เต็มไปด้วยร้านยากิโทริย่างถ่าน ราเมน และบรรยากาศกินดื่มยามค่ำคืน",
        lat: 35.6931,
        lng: 139.6997,
      },
      {
        name: "Ginza Six Shopping Complex",
        name_en: "Ginza Six Shopping Complex",
        name_th: "กินซ่า ซิกส์",
        category: "shopping",
        description: "Ultra-luxury retail landmark featuring avant-garde art installations, premium fashion boutiques, and rooftop garden.",
        description_en: "Ultra-luxury retail landmark featuring avant-garde art installations, premium fashion boutiques, and rooftop garden.",
        description_th: "ศูนย์การค้าระดับไฮเอนด์ใจกลางย่านกินซ่า โดดเด่นด้วยงานศิลปะร่วมสมัยและสวนลอยฟ้าชมวิวเมือง",
        lat: 35.6696,
        lng: 139.7640,
      },
      {
        name: "Thermae-Yu Onsen & Spa",
        name_en: "Thermae-Yu Onsen & Spa",
        name_th: "แตร์เม-ยู ออนเซ็น (ชินจูกุ)",
        category: "relax",
        description: "Rejuvenating multi-story thermal onsen in Shinjuku filled with authentic mineral spring waters from Izu.",
        description_en: "Rejuvenating multi-story thermal onsen in Shinjuku filled with authentic mineral spring waters from Izu.",
        description_th: "ออนเซ็นธรรมชาติขนาดใหญ่ใจกลางชินจูกุ นำน้ำแร่บริสุทธิ์จากอิซุมาให้แช่ผ่อนคลายตลอด 24 ชั่วโมง",
        lat: 35.6946,
        lng: 139.7058,
      },
      {
        name: "Mount Takao Trail",
        name_en: "Mount Takao Trail",
        name_th: "เส้นทางเดินเขาภูเขาทาคาโอะ",
        category: "adventure",
        description: "Popular scenic hiking mountain with cable cars, ancient cedar paths, and breathtaking summit views of Mt. Fuji.",
        description_en: "Popular scenic hiking mountain with cable cars, ancient cedar paths, and breathtaking summit views of Mt. Fuji.",
        description_th: "เส้นทางเดินป่าปีนเขายอดนิยม นั่งกระเช้าชมวิว เดินลัดเลาะป่าสนพันปี และชมวิวภูเขาไฟฟูจิจากยอดเขา",
        lat: 35.6253,
        lng: 139.2437,
      },
      {
        name: "Blue Bottle Coffee Kiyosumi",
        name_en: "Blue Bottle Coffee Kiyosumi",
        name_th: "บลูบอตเทิล คอฟฟี่ คิโยสุมิ",
        category: "food",
        description: "Flagship glass-and-timber roastery cafe in Kiyosumi-Shirakawa renowned for pour-over single-origin coffees.",
        description_en: "Flagship glass-and-timber roastery cafe in Kiyosumi-Shirakawa renowned for pour-over single-origin coffees.",
        description_th: "คาเฟ่เรือนกระจกสาขาแฟลกชิปย่านคิโยสุมิ โดดเด่นด้วยกาแฟดริปสเปเชียลตี้และขนมอบสดใหม่",
        lat: 35.6816,
        lng: 139.8000,
      },
      {
        name: "teamLab Planets TOKYO",
        name_en: "teamLab Planets TOKYO",
        name_th: "ทีมแล็บ แพลเน็ตส์ โตเกียว",
        category: "culture",
        description: "Immersive digital art museum where visitors walk barefoot through water and infinite crystalline digital projections.",
        description_en: "Immersive digital art museum where visitors walk barefoot through water and infinite crystalline digital projections.",
        description_th: "พิพิธภัณฑ์ศิลปะดิจิทัลอินเตอร์แอคทีฟระดับโลก สัมผัสงานศิลปะด้วยประสาทสัมผัสผ่านสายน้ำและแสงสีคริสตัล",
        lat: 35.6491,
        lng: 139.7898,
      },
      {
        name: "Odaiba Seaside Pier & Promenade",
        name_en: "Odaiba Seaside Pier & Promenade",
        name_th: "ท่าเรือและทางเดินเลียบอ่าวโอไดบะ",
        category: "activity",
        description: "Scenic waterfront park featuring panoramic views of Rainbow Bridge, Tokyo Bay cruises, and replica Statue of Liberty.",
        description_en: "Scenic waterfront park featuring panoramic views of Rainbow Bridge, Tokyo Bay cruises, and replica Statue of Liberty.",
        description_th: "ทางเดินเลียบชายหาดและท่าเรือโอไดบะ ชมวิวสะพานสายรุ้ง ล่องเรือชมอ่าว และเทพีเสรีภาพจำลอง",
        lat: 35.6298,
        lng: 139.7753,
      },
      {
        name: "Akihabara Radio Kaikan",
        name_en: "Akihabara Radio Kaikan",
        name_th: "อากิฮาบาระ เรดิโอ ไคคัง",
        category: "shopping",
        description: "Iconic 10-story pop-culture department store loaded with collectible figures, anime goods, and retro electronics.",
        description_en: "Iconic 10-story pop-culture department store loaded with collectible figures, anime goods, and retro electronics.",
        description_th: "ตึกแลนด์มาร์ก 10 ชั้นแห่งย่านอากิฮาบาระ แหล่งรวมฟิกเกอร์ อนิเมะ โมเดล และสินค้าอิเล็กทรอนิกส์",
        lat: 35.6980,
        lng: 139.7719,
      },
    ];
  } else if (isKyo) {
    defaults = [
      {
        name: "Fushimi Inari Taisha",
        name_en: "Fushimi Inari Taisha",
        name_th: "ศาลเจ้าฟูชิมิอินาริ",
        category: "landmark",
        description: "Legendary hillside Shinto shrine famous for its mystical pathway of over 10,000 vibrant vermilion torii gates.",
        description_en: "Legendary hillside Shinto shrine famous for its mystical pathway of over 10,000 vibrant vermilion torii gates.",
        description_th: "ศาลเจ้าเสาโทริอิสีส้มแดงหมื่นต้นอันศักดิ์สิทธิ์และงดงามทอดยาวขึ้นสู่ยอดเขาอินาริ",
        lat: 34.9671,
        lng: 135.7727,
      },
      {
        name: "Kinkaku-ji (Golden Pavilion)",
        name_en: "Kinkaku-ji (Golden Pavilion)",
        name_th: "วัดคินคะคุจิ (วัดทอง)",
        category: "culture",
        description: "Breathtaking Zen Buddhist temple whose top two floors are completely covered in gleaming pure gold leaf.",
        description_en: "Breathtaking Zen Buddhist temple whose top two floors are completely covered in gleaming pure gold leaf.",
        description_th: "ศาลาทองคำประกายระยิบระยับริมสระน้ำสะท้อนเงา มรดกโลกทางวัฒนธรรมอันทรงคุณค่า",
        lat: 35.0394,
        lng: 135.7292,
      },
      {
        name: "Nishiki Market",
        name_en: "Nishiki Market",
        name_th: "ตลาดนิชิกิ (ครัวแห่งเกียวโต)",
        category: "food",
        description: "Narrow five-block culinary shopping street known as Kyoto's Kitchen, packed with seasonal seafood and pickles.",
        description_en: "Narrow five-block culinary shopping street known as Kyoto's Kitchen, packed with seasonal seafood and pickles.",
        description_th: "ตลาดสดเก่าแก่กว่า 400 ปี รวมของกินพื้นเมือง ขนมดั้งเดิม อาหารเสียบไม้ และผักดองเกียวโต",
        lat: 35.0050,
        lng: 135.7649,
      },
      {
        name: "Yasaka Shrine (Gion)",
        name_en: "Yasaka Shrine (Gion)",
        name_th: "ศาลเจ้ายาซากะ (กิอง)",
        category: "spiritual",
        description: "Historic Shinto sanctuary at the edge of Gion illuminated with hundreds of glowing paper lanterns at dusk.",
        description_en: "Historic Shinto sanctuary at the edge of Gion illuminated with hundreds of glowing paper lanterns at dusk.",
        description_th: "ศาลเจ้าหัวใจแห่งย่านกิอง สวยงามด้วยโคมไฟกระดาษนับร้อยดวง จุดขอพรด้านความงามและโชคลาภ",
        lat: 35.0037,
        lng: 135.7785,
      },
      {
        name: "Toei Kyoto Studio Park",
        name_en: "Toei Kyoto Studio Park",
        name_th: "โทเอ เกียวโต สตูดิโอ พาร์ค",
        category: "entertainment",
        description: "Active film studio and samurai theme park recreating authentic Edo period streets, ninja shows, and exhibits.",
        description_en: "Active film studio and samurai theme park recreating authentic Edo period streets, ninja shows, and exhibits.",
        description_th: "สตูดิโอถ่ายทำภาพยนตร์และสวนสนุกย้อนยุค สัมผัสหมู่บ้านเอโดะจำลอง การแสดงนินจา และชุดซามูไร",
        lat: 35.0163,
        lng: 135.7083,
      },
      {
        name: "Arashiyama Bamboo Grove",
        name_en: "Arashiyama Bamboo Grove",
        name_th: "ป่าไผ่อาราชิยามะ",
        category: "nature",
        description: "Enchanting walking path winding through towering green bamboo stalks whispering in the gentle breeze.",
        description_en: "Enchanting walking path winding through towering green bamboo stalks whispering in the gentle breeze.",
        description_th: "ทางเดินชมป่าไผ่สีเขียวชอุ่มสูงเสียดฟ้า บรรยากาศเงียบสงบผ่อนคลายและโรแมนติก",
        lat: 35.0169,
        lng: 135.6713,
      },
      {
        name: "Pontocho Alley",
        name_en: "Pontocho Alley",
        name_th: "ตรอกปอนโตะโจ",
        category: "nightlife",
        description: "Atmospheric narrow cobblestone alley along the Kamogawa River lined with traditional izakayas and teahouses.",
        description_en: "Atmospheric narrow cobblestone alley along the Kamogawa River lined with traditional izakayas and teahouses.",
        description_th: "ตรอกทางเดินแคบริมแม่น้ำคาโมะ เต็มไปด้วยร้านอิซากายะดั้งเดิม บาร์คราฟต์ และแสงโคมไฟยามค่ำ",
        lat: 35.0058,
        lng: 135.7710,
      },
      {
        name: "Kawaramachi Shopping Arcade",
        name_en: "Kawaramachi Shopping Arcade",
        name_th: "ย่านช้อปปิ้งคาวาระมาจิ",
        category: "shopping",
        description: "Vibrant downtown retail district featuring major department stores, specialty souvenir shops, and boutiques.",
        description_en: "Vibrant downtown retail district featuring major department stores, specialty souvenir shops, and boutiques.",
        description_th: "ย่านใจกลางเมืองเกียวโต รวมห้างสรรพสินค้าชั้นนำ ร้านเสื้อผ้าแฟชั่น และของฝากน่าซื้อ",
        lat: 35.0037,
        lng: 135.7698,
      },
      {
        name: "Kurama Onsen",
        name_en: "Kurama Onsen",
        name_th: "คุรามะ ออนเซ็น",
        category: "relax",
        description: "Tranquil outdoor hot spring bath surrounded by majestic northern Kyoto mountain forests.",
        description_en: "Tranquil outdoor hot spring bath surrounded by majestic northern Kyoto mountain forests.",
        description_th: "ออนเซ็นกลางแจ้งท่ามกลางขุนเขาและป่าสนทางตอนเหนือของเกียวโต แช่น้ำแร่ธรรมชาติคลายเมื่อยล้า",
        lat: 35.1186,
        lng: 135.7797,
      },
      {
        name: "Daimonji Trail Hiking Route",
        name_en: "Daimonji Trail Hiking Route",
        name_th: "เส้นทางเดินเขาไดมอนจิ",
        category: "adventure",
        description: "Rewarding nature trail ascending Mount Daimonji offering panoramic bird's-eye views across the entire Kyoto basin.",
        description_en: "Rewarding nature trail ascending Mount Daimonji offering panoramic bird's-eye views across the entire Kyoto basin.",
        description_th: "เส้นทางเดินป่าขึ้นสู่ยอดเขาไดมอนจิ ชมทัศนียภาพเมืองเกียวโตแบบพาโนรามาสุดสายตา",
        lat: 35.0242,
        lng: 135.8044,
      },
      {
        name: "Arabica Kyoto Higashiyama",
        name_en: "Arabica Kyoto Higashiyama",
        name_th: "อาราบิก้า เกียวโต ฮิกาชิยามะ",
        category: "food",
        description: "Internationally acclaimed coffee shop framed against the iconic Yasaka Pagoda serving exquisite latte art.",
        description_en: "Internationally acclaimed coffee shop framed against the iconic Yasaka Pagoda serving exquisite latte art.",
        description_th: "คาเฟ่กาแฟชื่อดังมุมถ่ายรูปยอดฮิตมองเห็นเจดีย์ยาซากะ กาแฟลาเต้รสชาตินุ่มละมุนระดับโลก",
        lat: 34.9984,
        lng: 135.7797,
      },
      {
        name: "Kyoto International Manga Museum",
        name_en: "Kyoto International Manga Museum",
        name_th: "พิพิธภัณฑ์มังงะนานาชาติเกียวโต",
        category: "culture",
        description: "Fascinating museum housed in an old elementary school featuring over 300,000 manga books from around the world.",
        description_en: "Fascinating museum housed in an old elementary school featuring over 300,000 manga books from around the world.",
        description_th: "พิพิธภัณฑ์การ์ตูนมังงะในอาคารโรงเรียนประถมเก่า รวบรวมผลงานมังงะมากกว่า 300,000 เล่ม",
        lat: 35.0119,
        lng: 135.7597,
      },
      {
        name: "Hozugawa River Cruise Pier",
        name_en: "Hozugawa River Cruise Pier",
        name_th: "ท่าเรือล่องเรือแม่น้ำโฮซุกาวะ",
        category: "activity",
        description: "Traditional wooden boat river ride through scenic canyons and thrilling rapids from Kameoka down to Arashiyama.",
        description_en: "Traditional wooden boat river ride through scenic canyons and thrilling rapids from Kameoka down to Arashiyama.",
        description_th: "ล่องเรือไม้โบราณลัดเลาะแก่งหินและหุบเขาธรรมชาติแม่น้ำโฮซุกาวะ สัมผัสความตื่นเต้นและวิวทิวทัศน์สวยงาม",
        lat: 35.0152,
        lng: 135.5843,
      },
      {
        name: "Sannenzaka & Ninenzaka Traditional Streets",
        name_en: "Sannenzaka & Ninenzaka Traditional Streets",
        name_th: "ถนนคนเดินซันเนนซากะและนิเนนซากะ",
        category: "shopping",
        description: "Preserved historic stone-paved pedestrian alleys lined with wooden machiya shops, tea houses, and crafts.",
        description_en: "Preserved historic stone-paved pedestrian alleys lined with wooden machiya shops, tea houses, and crafts.",
        description_th: "ถนนหินโบราณสายประวัติศาสตร์ รายล้อมด้วยบ้านไม้โบราณ ร้านน้ำชา ขนมหวาน และงานฝีมือดั้งเดิม",
        lat: 34.9981,
        lng: 135.7806,
      },
    ];
  } else if (isOsa) {
    defaults = [
      {
        name: "Umeda Sky Building Floating Garden",
        name_en: "Umeda Sky Building Floating Garden",
        name_th: "จุดชมวิวตึกอุเมดะ สกาย บิลดิ้ง",
        category: "landmark",
        description: "Dramatic twin-tower landmark with an open-air circular sky bridge offering panoramic vistas of Osaka.",
        description_en: "Dramatic twin-tower landmark with an open-air circular sky bridge offering panoramic vistas of Osaka.",
        description_th: "จุดชมวิวดาดฟ้าทรงกลมเชื่อมระหว่างตึกแฝด ชมวิวเมืองโอซาก้าและพระอาทิตย์ตกดินสุดโรแมนติก",
        lat: 34.7052,
        lng: 135.4904,
      },
      {
        name: "Osaka Castle",
        name_en: "Osaka Castle",
        name_th: "ปราสาทโอซาก้า",
        category: "culture",
        description: "Grand historic fortress surrounded by massive stone walls, moats, and cherry-blossom parklands.",
        description_en: "Grand historic fortress surrounded by massive stone walls, moats, and cherry-blossom parklands.",
        description_th: "ปราสาทโบราณอันยิ่งใหญ่สัญลักษณ์แห่งโอซาก้า ล้อมรอบด้วยคูน้ำ กำแพงหินยักษ์ และสวนร่มรื่น",
        lat: 34.6873,
        lng: 135.5262,
      },
      {
        name: "Dotonbori Glico Sign & Food Street",
        name_en: "Dotonbori Glico Sign & Food Street",
        name_th: "ถนนคนเดินและสตรีทฟู้ดโดทงโบริ",
        category: "food",
        description: "Vibrant neon-lit entertainment canal strip famed for takoyaki, okonomiyaki, and the Glico running man sign.",
        description_en: "Vibrant neon-lit entertainment canal strip famed for takoyaki, okonomiyaki, and the Glico running man sign.",
        description_th: "ย่านของกินริมคลองสุดคึกคัก ป้ายกูลิโกะในตำนาน ทาโกะยากิร้อนๆ และโอโคโนมิยากิรสเด็ด",
        lat: 34.6687,
        lng: 135.5013,
      },
      {
        name: "Namba Yasaka Shrine",
        name_en: "Namba Yasaka Shrine",
        name_th: "ศาลเจ้านัมบะยาซากะ (หัวสิงโตยักษ์)",
        category: "spiritual",
        description: "Famous Shinto shrine featuring a striking 12-meter-high lion-head stage believed to swallow evil spirits.",
        description_en: "Famous Shinto shrine featuring a striking 12-meter-high lion-head stage believed to swallow evil spirits.",
        description_th: "ศาลเจ้าเวทีหัวสิงโตยักษ์อ้าปากกว้าง เชื่อว่าช่วยกลืนกินสิ่งชั่วร้ายและนำพาโชคลาภความสำเร็จ",
        lat: 34.6614,
        lng: 135.4967,
      },
      {
        name: "Universal Studios Japan",
        name_en: "Universal Studios Japan",
        name_th: "ยูนิเวอร์แซล สตูดิโอส์ เจแปน",
        category: "entertainment",
        description: "World-class theme park featuring Super Nintendo World, The Wizarding World of Harry Potter, and exhilarating rides.",
        description_en: "World-class theme park featuring Super Nintendo World, The Wizarding World of Harry Potter, and exhilarating rides.",
        description_th: "สวนสนุกระดับโลก สนุกไปกับดินแดน Super Nintendo World ปราสาทฮอกวอตส์ และเครื่องเล่นสุดมันส์",
        lat: 34.6654,
        lng: 135.4323,
      },
      {
        name: "Minoo Falls & Forest Park",
        name_en: "Minoo Falls & Forest Park",
        name_th: "น้ำตกและวนอุทยานมิโนโอะ",
        category: "nature",
        description: "Picturesque forest valley trail leading to a 33-meter cascading waterfall famous for fried maple leaf treats.",
        description_en: "Picturesque forest valley trail leading to a 33-meter cascading waterfall famous for fried maple leaf treats.",
        description_th: "เส้นทางเดินป่าสู่น้ำตกธรรมชาติสูง 33 เมตร ท่ามกลางหุบเขาเขียวขจีและใบเมเปิ้ลชุบแป้งทอด",
        lat: 34.8492,
        lng: 135.4746,
      },
      {
        name: "Shinsekai & Tsutenkaku District",
        name_en: "Shinsekai & Tsutenkaku District",
        name_th: "ย่านชินเซไกและหอคอยซึเทนคาคุ",
        category: "nightlife",
        description: "Nostalgic retro entertainment neighborhood famous for Tsutenkaku Tower and crispy kushikatsu skewers.",
        description_en: "Nostalgic retro entertainment neighborhood famous for Tsutenkaku Tower and crispy kushikatsu skewers.",
        description_th: "ย่านเรโทรย้อนยุค หอคอยซึเทนคาคุ แสงไฟนีออน และร้านคุชิคัตสึของทอดเสียบไม้ยอดนิยม",
        lat: 34.6525,
        lng: 135.5063,
      },
      {
        name: "Shinsaibashi-suji Shopping Street",
        name_en: "Shinsaibashi-suji Shopping Street",
        name_th: "ถนนช้อปปิ้งชินไซบาชิ",
        category: "shopping",
        description: "Covered 600-meter shopping arcade packed with trendy boutiques, cosmetic stores, and Japanese souvenir shops.",
        description_en: "Covered 600-meter shopping arcade packed with trendy boutiques, cosmetic stores, and Japanese souvenir shops.",
        description_th: "ถนนช้อปปิ้งในร่มความยาวกว่า 600 เมตร รวมแบรนด์แฟชั่น เครื่องสำอางยอดฮิต และขนมของฝาก",
        lat: 34.6723,
        lng: 135.5009,
      },
      {
        name: "Spa World Onsen",
        name_en: "Spa World Onsen",
        name_th: "สปาเวิลด์ ออนเซ็น",
        category: "relax",
        description: "Massive thermal bath complex themed after historic European and Asian bath cultures with herbal saunas.",
        description_en: "Massive thermal bath complex themed after historic European and Asian bath cultures with herbal saunas.",
        description_th: "อาณาจักรออนเซ็นระดับโลก จำลองบ่อน้ำแร่สไตล์ยุโรปและเอเชีย พร้อมซาวน่าสมุนไพรผ่อนคลายร่างกาย",
        lat: 34.6506,
        lng: 135.5065,
      },
      {
        name: "Mount Kongo Hiking Trail",
        name_en: "Mount Kongo Hiking Trail",
        name_th: "เส้นทางเดินเขาภูเขาคงโก",
        category: "adventure",
        description: "Popular mountain climbing trail south of Osaka featuring historic ridge temples and cool forest canopies.",
        description_en: "Popular mountain climbing trail south of Osaka featuring historic ridge temples and cool forest canopies.",
        description_th: "เส้นทางปีนเขาและเดินป่าท้าทาย สัมผัสธรรมชาติอุดมสมบูรณ์และวัดโบราณบนสันเขา",
        lat: 34.4192,
        lng: 135.6744,
      },
      {
        name: "Moto Coffee Kitahama",
        name_en: "Moto Coffee Kitahama",
        name_th: "โมโตะ คอฟฟี่ คิตาฮามะ",
        category: "food",
        description: "Charming riverside cafe with outdoor terrace overlooking the Tosabori River serving artisanal drip coffee.",
        description_en: "Charming riverside cafe with outdoor terrace overlooking the Tosabori River serving artisanal drip coffee.",
        description_th: "คาเฟ่ริมแม่น้ำบรรยากาศสุดชิล จิบกาแฟดริปและขนมปังอบสดใหม่พร้อมวิวแม่น้ำโทซาโบริ",
        lat: 34.6920,
        lng: 135.5074,
      },
      {
        name: "Osaka Science Museum",
        name_en: "Osaka Science Museum",
        name_th: "พิพิธภัณฑ์วิทยาศาสตร์โอซาก้า",
        category: "culture",
        description: "Interactive science exhibits and state-of-the-art planetarium exploring physics, chemistry, and the universe.",
        description_en: "Interactive science exhibits and state-of-the-art planetarium exploring physics, chemistry, and the universe.",
        description_th: "พิพิธภัณฑ์วิทยาศาสตร์อินเตอร์แอคทีฟ ท้องฟ้าจำลองระดับพรีเมียม และการทดลองแสนสนุก",
        lat: 34.6917,
        lng: 135.4917,
      },
      {
        name: "Tombori River Cruise Boarding Point",
        name_en: "Tombori River Cruise Boarding Point",
        name_th: "จุดขึ้นเรือล่องแม่น้ำทมโบริ",
        category: "activity",
        description: "Scenic 20-minute guided open-top boat cruise gliding past Dotonbori's famous bridges and neon signs.",
        description_en: "Scenic 20-minute guided open-top boat cruise gliding past Dotonbori's famous bridges and neon signs.",
        description_th: "ล่องเรือเปิดประทุนชมคลองโดทงโบริ ลอดใต้สะพานประวัติศาสตร์และถ่ายรูปคู่กับป้ายกูลิโกะมุมมองใหม่",
        lat: 34.6689,
        lng: 135.5022,
      },
      {
        name: "Grand Front Osaka Mall",
        name_en: "Grand Front Osaka Mall",
        name_th: "แกรนด์ ฟรอนต์ โอซาก้า",
        category: "shopping",
        description: "Sophisticated shopping and dining complex connected to Osaka Station featuring garden terraces and flagship stores.",
        description_en: "Sophisticated shopping and dining complex connected to Osaka Station featuring garden terraces and flagship stores.",
        description_th: "ศูนย์การค้าทันสมัยเชื่อมต่อสถานีโอซาก้า รวมร้านอาหารชั้นเลิศ สวนดาดฟ้า และแบรนด์ดีไซน์ระดับโลก",
        lat: 34.7042,
        lng: 135.4947,
      },
    ];
  } else if (isHkt) {
    defaults = [
      {
        name: "Promthep Cape Viewpoint",
        name_en: "Promthep Cape Viewpoint",
        name_th: "แหลมพรหมเทพ",
        category: "landmark",
        description: "Iconic southern headland viewpoint renowned for postcard-perfect sunsets over the Andaman Sea.",
        description_en: "Iconic southern headland viewpoint renowned for postcard-perfect sunsets over the Andaman Sea.",
        description_th: "จุดชมพระอาทิตย์ตกดินที่สวยงามและมีชื่อเสียงที่สุดในประเทศไทย ปลายแหลมยื่นสู่ทะเลอันดามัน",
        lat: 7.7639,
        lng: 98.3053,
      },
      {
        name: "Big Buddha Phuket (Wat Phra Yai)",
        name_en: "Big Buddha Phuket (Wat Phra Yai)",
        name_th: "พระใหญ่ภูเก็ต (วัดพระพุทธมิ่งมงคลเอกนาคคีรี)",
        category: "culture",
        description: "Magnificent 45-meter white Burmese marble Buddha statue sitting atop Nakkerd Hill overlooking Chalong Bay.",
        description_en: "Magnificent 45-meter white Burmese marble Buddha statue sitting atop Nakkerd Hill overlooking Chalong Bay.",
        description_th: "พระพุทธรูปหินอ่อนหยกขาวขนาดใหญ่บนยอดเขานาคเกิด จุดชมวิวเกาะภูเก็ตแบบ 360 องศา",
        lat: 7.8277,
        lng: 98.3129,
      },
      {
        name: "Raya Restaurant Phuket Town",
        name_en: "Raya Restaurant Phuket Town",
        name_th: "ร้านอาหารระย้า เมืองภูเก็ต",
        category: "food",
        description: "Legendary Michelin Bib Gourmand institution set in a heritage Sino-Portuguese mansion serving authentic crab curry.",
        description_en: "Legendary Michelin Bib Gourmand institution set in a heritage Sino-Portuguese mansion serving authentic crab curry.",
        description_th: "ร้านอาหารพื้นเมืองภูเก็ตในบ้านโบราณชิโนโปรตุกีส การันตีมิชลิน บิบ กูร์มองด์ โดดเด่นด้วยแกงปูใบชะพลู",
        lat: 7.8863,
        lng: 98.3897,
      },
      {
        name: "Wat Chalong (Chaithararam Temple)",
        name_en: "Wat Chalong (Chaithararam Temple)",
        name_th: "วัดฉลอง (วัดไชยธาราราม)",
        category: "spiritual",
        description: "Phuket's largest and most revered Buddhist temple housing holy relics in a towering grand pagoda.",
        description_en: "Phuket's largest and most revered Buddhist temple housing holy relics in a towering grand pagoda.",
        description_th: "วัดเก่าแก่คู่บ้านคู่เมืองภูเก็ต นมัสการหลวงพ่อแช่มและพระบรมสารีริกธาตุในพระมหาธาตุเจดีย์",
        lat: 7.8467,
        lng: 98.3364,
      },
      {
        name: "Andamanda Phuket Water Park",
        name_en: "Andamanda Phuket Water Park",
        name_th: "สวนน้ำอันดามันดา ภูเก็ต",
        category: "entertainment",
        description: "Immersive Thai mythology-themed water kingdom featuring giant wave pools, extreme slides, and lazy river.",
        description_en: "Immersive Thai mythology-themed water kingdom featuring giant wave pools, extreme slides, and lazy river.",
        description_th: "สวนน้ำระดับเวิลด์คลาสธีมวรรณคดีไทย สไลเดอร์สุดเร้าใจ ทะเลเทียมคลื่นยักษ์ และโซนเครื่องเล่นสำหรับครอบครัว",
        lat: 7.9048,
        lng: 98.3619,
      },
      {
        name: "Sirinat National Park & Nai Yang Beach",
        name_en: "Sirinat National Park & Nai Yang Beach",
        name_th: "อุทยานแห่งชาติสิรินาถและหาดในยาง",
        category: "nature",
        description: "Pristine coastal national park featuring shaded pine forests, coral reefs, and tranquil white sands.",
        description_en: "Pristine coastal national park featuring shaded pine forests, coral reefs, and tranquil white sands.",
        description_th: "อุทยานแห่งชาติทางทะเล หาดทรายขาวละเอียด ร่มรื่นด้วยทิวสนทะเล และแนวปะการังสมบูรณ์",
        lat: 8.0933,
        lng: 98.3014,
      },
      {
        name: "Phuket Sunday Walking Street (Lard Yai)",
        name_en: "Phuket Sunday Walking Street (Lard Yai)",
        name_th: "หลาดใหญ่ ถนนคนเดินภูเก็ต",
        category: "nightlife",
        description: "Lively Sunday street fair on Thalang Road with local Southern street food, buskers, and colorful heritage lights.",
        description_en: "Lively Sunday street fair on Thalang Road with local Southern street food, buskers, and colorful heritage lights.",
        description_th: "ถนนคนเดินวันอาทิตย์บนถนนถลาง ชิมอาหารปักษ์ใต้ ขนมโบราณ ช้อปสินค้าแฮนด์เมด และชมการแสดงเปิดหมวก",
        lat: 7.8847,
        lng: 98.3890,
      },
      {
        name: "Jungceylon Shopping Center Patong",
        name_en: "Jungceylon Shopping Center Patong",
        name_th: "ศูนย์การค้าจังซีลอน ป่าตอง",
        category: "shopping",
        description: "Major entertainment and retail complex in Patong featuring musical water fountains, boutiques, and souvenirs.",
        description_en: "Major entertainment and retail complex in Patong featuring musical water fountains, boutiques, and souvenirs.",
        description_th: "ศูนย์การค้าครบวงจรใจกลางหาดป่าตอง ช้อปปิ้งแบรนด์ดัง ลานน้ำพุดนตรี และร้านอาหารนานาชาติ",
        lat: 7.8920,
        lng: 98.2996,
      },
      {
        name: "Oasis Spa Phuket (Kamala)",
        name_en: "Oasis Spa Phuket (Kamala)",
        name_th: "โอเอซิส สปา ภูเก็ต",
        category: "relax",
        description: "Luxury tropical wellness haven overlooking Kamala beach offering signature four-hand massages and herbal steam.",
        description_en: "Luxury tropical wellness haven overlooking Kamala beach offering signature four-hand massages and herbal steam.",
        description_th: "สปาระดับพรีเมียมท่ามกลางธรรมชาติร่มรื่น ผ่อนคลายกับการนวดซิกเนเจอร์สี่มือและทรีตเมนต์สมุนไพรสด",
        lat: 7.9547,
        lng: 98.2831,
      },
      {
        name: "Black Rock Viewpoint Hiking Trail",
        name_en: "Black Rock Viewpoint Hiking Trail",
        name_th: "จุดชมวิวผาหินดำ",
        category: "adventure",
        description: "Thrilling jungle ridge hike leading to a panoramic overlook of Nai Harn Beach, Promthep Cape, and surrounding islands.",
        description_en: "Thrilling jungle ridge hike leading to a panoramic overlook of Nai Harn Beach, Promthep Cape, and surrounding islands.",
        description_th: "เส้นทางเดินป่าปีนเขาสู่ผาหินดำ ชมวิวอ่าวในหาน แหลมพรหมเทพ และหมู่เกาะอันดามันแบบพาโนรามา",
        lat: 7.7819,
        lng: 98.2997,
      },
      {
        name: "Roti Taew Nam Phuket",
        name_en: "Roti Taew Nam Phuket",
        name_th: "โรตีแถวน้ำ ภูเก็ต",
        category: "food",
        description: "Historic morning breakfast eatery serving charcoal-grilled crispy roti with rich beef and chicken curry.",
        description_en: "Historic morning breakfast eatery serving charcoal-grilled crispy roti with rich beef and chicken curry.",
        description_th: "ร้านอาหารเช้าในตำนาน การันตีมิชลิน บิบ กูร์มองด์ โรตีกรอบเตาถ่านเสิร์ฟคู่แกงมัสมั่นและชาเย็น",
        lat: 7.8867,
        lng: 98.3894,
      },
      {
        name: "Phuket Thai Hua Museum",
        name_en: "Phuket Thai Hua Museum",
        name_th: "พิพิธภัณฑ์ภูเก็ตไทยหัว",
        category: "culture",
        description: "Elegant British-colonial school building tracing the compelling history and heritage of Chinese Hokkien immigrants in Phuket.",
        description_en: "Elegant British-colonial school building tracing the compelling history and heritage of Chinese Hokkien immigrants in Phuket.",
        description_th: "พิพิธภัณฑ์ประวัติศาสตร์ชาวจีนฮกเกี้ยนในภูเก็ต จัดแสดงในอาคารเรียนเก่าสไตล์บริติชโคโลเนียลอันทรงคุณค่า",
        lat: 7.8850,
        lng: 98.3869,
      },
      {
        name: "Chalong Pier Marina",
        name_en: "Chalong Pier Marina",
        name_th: "ท่าเรืออ่าวฉลอง",
        category: "activity",
        description: "Bustling yacht harbor and departure point for scenic catamaran cruises, snorkeling trips, and island excursions.",
        description_en: "Bustling yacht harbor and departure point for scenic catamaran cruises, snorkeling trips, and island excursions.",
        description_th: "ท่าเรือท่องเที่ยวหลักของภูเก็ต จุดเริ่มต้นของการล่องเรือคาตามารัน เที่ยวเกาะเฮ เกาะราชา และดำน้ำตื้น",
        lat: 7.8219,
        lng: 98.3547,
      },
      {
        name: "Old Phuket Town Sino-Portuguese Quarters",
        name_en: "Old Phuket Town Sino-Portuguese Quarters",
        name_th: "ย่านเมืองเก่าภูเก็ต ถนนถลาง",
        category: "shopping",
        description: "Photogenic heritage streetscapes of pastel Sino-Portuguese shophouses, boutique souvenir stalls, and artisanal cafes.",
        description_en: "Photogenic heritage streetscapes of pastel Sino-Portuguese shophouses, boutique souvenir stalls, and artisanal cafes.",
        description_th: "ย่านตึกเก่าสถาปัตยกรรมชิโนโปรตุกีสหลากสีสัน แหล่งช้อปปิ้งของที่ระลึก คาเฟ่เก๋ และมุมถ่ายรูปยอดฮิต",
        lat: 7.8849,
        lng: 98.3888,
      },
    ];
  } else {
    // Generic / other destinations: Use clean real venue titles
    const cleanCity = locationName ? locationName.trim() : "City";
    defaults = [
      {
        name: `${cleanCity} Sky Observation Deck`,
        name_en: `${cleanCity} Sky Observation Deck`,
        name_th: `จุดชมวิวสกายทาวเวอร์ ${cleanCity}`,
        category: "landmark",
        description: `Panoramic observation deck offering sweeping bird's-eye views of ${cleanCity}.`,
        description_en: `Panoramic observation deck offering sweeping bird's-eye views of ${cleanCity}.`,
        description_th: `จุดชมวิวพาโนรามาสัมผัสทัศนียภาพอันงดงามแบบ 360 องศาของ ${cleanCity}`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Old Town Heritage Sanctuary`,
        name_en: `${cleanCity} Old Town Heritage Sanctuary`,
        name_th: `วัดและศูนย์มรดกเมืองเก่า ${cleanCity}`,
        category: "culture",
        description: `Historic architecture and revered cultural heritage center in ${cleanCity}.`,
        description_en: `Historic architecture and revered cultural heritage center in ${cleanCity}.`,
        description_th: `สถานที่สำคัญทางประวัติศาสตร์และมรดกทางสถาปัตยกรรมอันทรงคุณค่าแห่ง ${cleanCity}`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Grand Heritage Eatery`,
        name_en: `${cleanCity} Grand Heritage Eatery`,
        name_th: `ร้านอาหารต้นตำรับ ${cleanCity}`,
        category: "food",
        description: `Celebrated culinary venue serving authentic regional specialties of ${cleanCity}.`,
        description_en: `Celebrated culinary venue serving authentic regional specialties of ${cleanCity}.`,
        description_th: `ร้านอาหารยอดนิยมเสิร์ฟเมนูต้นตำรับรสเลิศประจำภูมิภาคแห่ง ${cleanCity}`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Historic Peace Shrine`,
        name_en: `${cleanCity} Historic Peace Shrine`,
        name_th: `ศาลเจ้าแห่งความสงบ ${cleanCity}`,
        category: "spiritual",
        description: `Revered spiritual sanctuary for blessings, good fortune, and tranquil reflection.`,
        description_en: `Revered spiritual sanctuary for blessings, good fortune, and tranquil reflection.`,
        description_th: `สถานที่ศักดิ์สิทธิ์สำหรับสักการะขอพรเสริมสิริมงคลและความสงบในจิตใจ`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Adventure Park`,
        name_en: `${cleanCity} Adventure Park`,
        name_th: `สวนสนุกผจญภัย ${cleanCity}`,
        category: "entertainment",
        description: `Thrilling amusement rides, entertainment spectacles, and family fun attractions.`,
        description_en: `Thrilling amusement rides, entertainment spectacles, and family fun attractions.`,
        description_th: `สวนสนุกและศูนย์รวมความบันเทิงพร้อมเครื่องเล่นและการแสดงสุดตื่นเต้น`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Central Botanical Garden`,
        name_en: `${cleanCity} Central Botanical Garden`,
        name_th: `สวนพฤกษศาสตร์ใจกลาง ${cleanCity}`,
        category: "nature",
        description: `Serene urban green haven featuring botanical gardens and scenic walking trails.`,
        description_en: `Serene urban green haven featuring botanical gardens and scenic walking trails.`,
        description_th: `สวนพฤกษศาสตร์ธรรมชาติใจกลางเมือง ร่มรื่นด้วยพืชพรรณและทัศนียภาพงดงาม`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Night Bazaar`,
        name_en: `${cleanCity} Night Bazaar`,
        name_th: `ไนท์บาซาร์ ${cleanCity}`,
        category: "nightlife",
        description: `Lively open-air evening night market featuring street food stalls and local goods.`,
        description_en: `Lively open-air evening night market featuring street food stalls and local goods.`,
        description_th: `ตลาดนัดกลางคืนยอดนิยม เต็มไปด้วยอาหารสตรีทฟู้ดและของที่ระลึกน่าช้อป`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Galleria & Artisan Mall`,
        name_en: `${cleanCity} Galleria & Artisan Mall`,
        name_th: `แกลเลอเรีย ช้อปปิ้งมอลล์ ${cleanCity}`,
        category: "shopping",
        description: `Modern retail destination showcasing premier boutiques, souvenirs, and local crafts.`,
        description_en: `Modern retail destination showcasing premier boutiques, souvenirs, and local crafts.`,
        description_th: `ศูนย์การค้าและแหล่งช้อปปิ้งของฝาก รวมสินค้าไลฟ์สไตล์และงานฝีมือท้องถิ่น`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Wellness Sanctuary & Spa`,
        name_en: `${cleanCity} Wellness Sanctuary & Spa`,
        name_th: `เวลเนสแซงชัวรี แอนด์ สปา ${cleanCity}`,
        category: "relax",
        description: `Peaceful relaxation haven offering traditional massage and therapeutic wellness care.`,
        description_en: `Peaceful relaxation haven offering traditional massage and therapeutic wellness care.`,
        description_th: `สปาและศูนย์ดูแลสุขภาพเพื่อการผ่อนคลายด้วยการนวดและการบำบัดอย่างแท้จริง`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Nature Discovery Trail`,
        name_en: `${cleanCity} Nature Discovery Trail`,
        name_th: `เส้นทางศึกษาธรรมชาติ ${cleanCity}`,
        category: "adventure",
        description: `Invigorating hiking trail immersed in lush natural scenery and panoramic views.`,
        description_en: `Invigorating hiking trail immersed in lush natural scenery and panoramic views.`,
        description_th: `เส้นทางผจญภัยเดินป่าสัมผัสความอุดมสมบูรณ์ของธรรมชาติและจุดชมวิวยอดนิยม`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Roastery & Specialty Cafe`,
        name_en: `${cleanCity} Roastery & Specialty Cafe`,
        name_th: `โรสเตอรี่ แอนด์ คาเฟ่ ${cleanCity}`,
        category: "food",
        description: `Artisanal coffee house offering signature brews, baked treats, and cozy atmosphere.`,
        description_en: `Artisanal coffee house offering signature brews, baked treats, and cozy atmosphere.`,
        description_th: `คาเฟ่กาแฟคั่วบดพิเศษเสิร์ฟเครื่องดื่มซิกเนเจอร์และขนมหวานสูตรเฉพาะ`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} National Museum & Art Hall`,
        name_en: `${cleanCity} National Museum & Art Hall`,
        name_th: `พิพิธภัณฑ์ศิลปวัฒนธรรม ${cleanCity}`,
        category: "culture",
        description: `Rich cultural exhibits, regional historic treasures, and fine art collections.`,
        description_en: `Rich cultural exhibits, regional historic treasures, and fine art collections.`,
        description_th: `พิพิธภัณฑ์จัดแสดงโบราณวัตถุและงานศิลปวัฒนธรรมอันทรงคุณค่าแห่ง ${cleanCity}`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Marina Waterfront Pier`,
        name_en: `${cleanCity} Marina Waterfront Pier`,
        name_th: `ท่าเรือมารีน่า ${cleanCity}`,
        category: "activity",
        description: `Picturesque waterfront pier terminal offering boat excursions and sunset cruises.`,
        description_en: `Picturesque waterfront pier terminal offering boat excursions and sunset cruises.`,
        description_th: `ท่าเรือท่องเที่ยวริมน้ำสำหรับกิจกรรมล่องเรือสัมผัสบรรยากาศสายน้ำแสนประทับใจ`,
        lat: 0,
        lng: 0,
      },
      {
        name: `${cleanCity} Crafts Village & Bazaar`,
        name_en: `${cleanCity} Crafts Village & Bazaar`,
        name_th: `หมู่บ้านหัตถกรรม ${cleanCity}`,
        category: "shopping",
        description: `Charming cultural marketplace featuring handmade artisan treasures and textiles.`,
        description_en: `Charming cultural marketplace featuring handmade artisan treasures and textiles.`,
        description_th: `ศูนย์รวมสินค้างานฝีมือ ของทำมือ และสินค้าหัตถกรรมพื้นเมืองที่มีเอกลักษณ์`,
        lat: 0,
        lng: 0,
      },
    ];
  }

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
    lat: item.lat || 0,
    lng: item.lng || 0,
    rating: 4.5 + (i % 3) * 0.2,
    userRatingsTotal: 250 + i * 80,
  }));
}

interface DraggableSuggestionProps {
  place: SuggestedPlace;
  onAdd?: (place: SuggestedPlace, dayIndex: number, time: string) => void;
  daysCount: number;
  cityName?: string;
  onPhotoChanged?: (placeId: string, newPhotoUrl: string) => void;
}

const DraggableSuggestion = ({ place, onAdd, daysCount, cityName, onPhotoChanged }: DraggableSuggestionProps) => {
  const { language, locPlace, locDesc } = useLanguage();
  const [photoUrl, setPhotoUrl] = useState<string>(() => getSuggestedPlaceImage(place, cityName));
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isResolvingPhoto, setIsResolvingPhoto] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("0");
  const [selectedTime, setSelectedTime] = useState<string>("12:00");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Synchronize and auto-resolve real photo via Smart Photo Engine (Serper.dev Google Images first)
  useEffect(() => {
    // 1. Sync from cache if already resolved
    const cached =
      getPlaceImageFromCache(place.name) ||
      (place.name_en ? getPlaceImageFromCache(place.name_en) : null) ||
      (place.english_name ? getPlaceImageFromCache(place.english_name) : null);

    if (cached && cached !== photoUrl) {
      setPhotoUrl(cached);
      place.photo_url = cached;
      place.image_url = cached;
      place.image = cached;
      return;
    }

    // 2. If photo is a generic fallback or default image, automatically resolve via Smart Photo Engine
    const isFallback =
      !photoUrl ||
      photoUrl === DEFAULT_IMAGE ||
      Object.values(CATEGORY_FALLBACK_IMAGES).includes(photoUrl) ||
      photoUrl.includes("images.unsplash.com/photo-1488085061387-422e29b40080");

    if (isFallback && (place.name || place.name_en || place.english_name)) {
      let isMounted = true;
      setIsResolvingPhoto(true);

      fetchSmartPhoto(place.name, {
        category: place.category,
        cityName,
        englishName: place.name_en || place.english_name,
        searchKeyword: place.image_keyword,
        wikiTitle: place.wiki_title,
      })
        .then((resolved) => {
          if (isMounted && resolved) {
            setPhotoUrl(resolved);
            place.photo_url = resolved;
            place.image_url = resolved;
            place.image = resolved;
            const aliases = [place.name_en, place.english_name, place.name_th, place.image_keyword].filter(Boolean) as string[];
            setPlaceImageInCache(place.name, resolved, aliases);
            onPhotoChanged?.(place.id, resolved);
          }
        })
        .catch((err) => {
          console.warn("[AISuggestedPlaces] Error resolving photo:", err);
        })
        .finally(() => {
          if (isMounted) setIsResolvingPhoto(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [place.id, place.name, place.name_en, place.english_name, cityName]);

  const times = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, "0");
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
  });

  const cleanName = cleanSuggestedPlaceName(place.name, cityName);
  const cleanNameEn = place.name_en ? cleanSuggestedPlaceName(place.name_en, cityName) : undefined;
  const cleanNameTh = place.name_th ? cleanSuggestedPlaceName(place.name_th, cityName) : undefined;
  const cleanTitleEn = place.title_en ? cleanSuggestedPlaceName(place.title_en, cityName) : cleanNameEn;
  const cleanTitleTh = place.title_th ? cleanSuggestedPlaceName(place.title_th, cityName) : cleanNameTh;
  const cleanDisplayName = cleanSuggestedPlaceName(locPlace(place), cityName);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `suggestion-${place.id}`,
    data: {
      type: "suggestion",
      place: {
        ...place,
        name: cleanName,
        name_en: cleanNameEn,
        name_th: cleanNameTh,
        title_en: cleanTitleEn,
        title_th: cleanTitleTh,
        photo_url: photoUrl,
        image_url: photoUrl,
        image: photoUrl,
      },
    },
  });

  const config = categoryConfig[place.category] || categoryConfig.activity;

  return (
    <>
      <div
        ref={setNodeRef}
        className={`group relative min-w-[270px] sm:min-w-[290px] max-w-[320px] rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 snap-start cursor-grab active:cursor-grabbing select-none ${
          isDragging ? "opacity-30 scale-95" : "hover:-translate-y-1"
        }`}
        {...attributes}
        {...listeners}
      >
        <div className="relative h-40 overflow-hidden">
          <img
            src={photoUrl}
            alt={cleanDisplayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              const cat = (place.category || "attraction").toLowerCase();
              e.currentTarget.src = CATEGORY_FALLBACK_IMAGES[cat] || DEFAULT_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
          
          {/* Category Badge */}
          <Badge variant="outline" className={`absolute top-2.5 left-2.5 text-[10px] backdrop-blur-sm ${config.color}`}>
            {language === "th" ? config.label_th : config.label}
          </Badge>

          {/* Change Photo Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPhotoModalOpen(true);
            }}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-all hover:scale-110 shadow-sm opacity-80 group-hover:opacity-100 z-10"
            title={language === "th" ? "เปลี่ยนรูปภาพสถานที่นี้" : "Change photo"}
            aria-label="Change photo"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Loading shimmer indicator if resolving */}
          {isResolvingPhoto && (
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] text-white/90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span>{language === "th" ? "กำลังดึงภาพจริง..." : "Resolving photo..."}</span>
            </div>
          )}
        </div>
        <div className="p-3.5">
          <h4 className="font-semibold text-foreground text-sm leading-tight mb-1">{cleanDisplayName}</h4>
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
                      onAdd?.(
                        {
                          ...place,
                          name: cleanName,
                          name_en: cleanNameEn,
                          name_th: cleanNameTh,
                          title_en: cleanTitleEn,
                          title_th: cleanTitleTh,
                          photo_url: photoUrl,
                          image_url: photoUrl,
                          image: photoUrl,
                        },
                        parseInt(selectedDay, 10),
                        selectedTime
                      );
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

      {/* Change Photo Modal for this Suggested Place */}
      <ChangePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        activityTitle={cleanDisplayName}
        englishName={place.name_en || place.english_name}
        imageKeyword={place.image_keyword}
        currentPhotoUrl={photoUrl}
        cityName={cityName}
        onSelectPhoto={(newUrl) => {
          setPhotoUrl(newUrl);
          place.photo_url = newUrl;
          place.image_url = newUrl;
          place.image = newUrl;
          place.isUserPhoto = true;
          const aliases = [place.name_en, place.english_name, place.name_th, place.image_keyword].filter(Boolean) as string[];
          setPlaceImageInCache(place.name, newUrl, aliases);
          onPhotoChanged?.(place.id, newUrl);
        }}
      />
    </>
  );
};

// Overlay for drag preview
export const SuggestionDragOverlay = ({ place }: { place: SuggestedPlace }) => {
  const { language, locPlace } = useLanguage();
  const config = categoryConfig[place.category] || categoryConfig.activity;
  const cleanDisplayName = cleanSuggestedPlaceName(locPlace(place));
  return (
    <div className="w-64 rounded-2xl overflow-hidden bg-card border border-primary shadow-2xl scale-105 rotate-1">
      <div className="relative h-36 overflow-hidden">
        <img
          src={getSuggestedPlaceImage(place)}
          alt={cleanDisplayName}
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
        <h4 className="font-semibold text-foreground text-sm">{cleanDisplayName}</h4>
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
  onUpdateSuggestionPhoto?: (placeId: string, newPhotoUrl: string) => void;
}

const CATEGORIES = ["all", "hotel", "attraction", "food", "nature", "culture", "activity"] as const;

const AISuggestedPlaces = ({
  onAddToItinerary,
  locationName,
  suggestions: propSuggestions,
  onRefreshSuggestions,
  daysCount,
  onUpdateSuggestionPhoto,
}: AISuggestedPlacesProps) => {
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
            <DraggableSuggestion
              key={place.id}
              place={place}
              onAdd={handleAdd}
              daysCount={daysCount}
              cityName={locationName}
              onPhotoChanged={onUpdateSuggestionPhoto}
            />
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
