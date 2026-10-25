import { SuggestedPlace } from "@/components/AISuggestedPlaces";
import { Activity } from "@/components/TravelItinerary";
import { isZoneDining } from "@/api/geocode";

export const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80";

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  culture: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=600&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
  nature: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
  adventure: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=600&q=80",
  activity: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=600&q=80",
  shopping: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80",
  nightlife: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
  relax: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80",
  landmark: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
  photo: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
  entertainment: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=600&q=80",
  spiritual: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
  attraction: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80",
};

/**
 * Returns authentic, high-quality curated suggestions for major cities
 */
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
        name_th: "ตลาดปลาซึกิจิรอบนอก",
        category: "food",
        description: "Legendary seafood marketplace offering fresh sushi, grilled wagyu skewers, tamagoyaki, and ocean delicacies.",
        description_en: "Legendary seafood marketplace offering fresh sushi, grilled wagyu skewers, tamagoyaki, and ocean delicacies.",
        description_th: "ตลาดอาหารทะเลยอดนิยม รวมร้านซูชิสดใหม่ เนื้อวากิวเสียบไม้ย่าง ไข่หวานย่าง และอาหารทะเลเลิศรส",
        lat: 35.6655,
        lng: 139.7708,
      },
      {
        name: "Meiji Jingu Shrine",
        name_en: "Meiji Jingu Shrine",
        name_th: "ศาลเจ้าเมจิ",
        category: "spiritual",
        description: "Tranquil Shinto shrine nestled in a vast sacred forest dedicated to Emperor Meiji and Empress Shoken.",
        description_en: "Tranquil Shinto shrine nestled in a vast sacred forest dedicated to Emperor Meiji and Empress Shoken.",
        description_th: "ศาลเจ้าชินโตอันเงียบสงบท่ามกลางป่าศักดิ์สิทธิ์ใจกลางฮาราจูกุ จุดขอพรความสำเร็จและครอบครัวอบอุ่น",
        lat: 35.6764,
        lng: 139.6993,
      },
      {
        name: "Tokyo DisneySea",
        name_en: "Tokyo DisneySea",
        name_th: "โตเกียวดิสนีย์ซี",
        category: "entertainment",
        description: "One-of-a-kind nautical fantasy theme park featuring Mount Prometheus, Mediterranean Harbor, and Journey to the Center of the Earth.",
        description_en: "One-of-a-kind nautical fantasy theme park featuring Mount Prometheus, Mediterranean Harbor, and Journey to the Center of the Earth.",
        description_th: "สวนสนุกธีมท้องทะเลแห่งเดียวในโลก สัมผัสดินแดนเวทมนตร์ ภูเขาไฟโพรมีธีอุส และเครื่องเล่นสุดประทับใจ",
        lat: 35.6267,
        lng: 139.8851,
      },
      {
        name: "Shinjuku Gyoen National Garden",
        name_en: "Shinjuku Gyoen National Garden",
        name_th: "สวนชินจูกุเกียวเอน",
        category: "nature",
        description: "Expansive tranquil park blending traditional Japanese, English Landscape, and French Formal gardens.",
        description_en: "Expansive tranquil park blending traditional Japanese, English Landscape, and French Formal gardens.",
        description_th: "สวนสาธารณะขนาดใหญ่ใจกลางชินจูกุ ผสมผสานสวนสไตล์ญี่ปุ่นดั้งเดิม สวนอังกฤษ และต้นซากุระร่มรื่น",
        lat: 35.6852,
        lng: 139.7100,
      },
      {
        name: "Omoide Yokocho (Memory Lane)",
        name_en: "Omoide Yokocho (Memory Lane)",
        name_th: "ตรอกโอโมอิเดะ โยโคโจ (ตรอกความทรงจำ ชินจูกุ)",
        category: "nightlife",
        description: "Atmospheric retro post-war alleyway packed with smoky yakitori stalls, izakayas, and cold draft beer.",
        description_en: "Atmospheric retro post-war alleyway packed with smoky yakitori stalls, izakayas, and cold draft beer.",
        description_th: "ตรอกอิซากายะย้อนยุคริมทางรถไฟชินจูกุ กลิ่นหอมไก่ย่างยากิโทริเตาถ่านและเบียร์เย็นชื่นใจ",
        lat: 35.6931,
        lng: 139.6997,
      },
      {
        name: "Ginza Six Luxury Complex",
        name_en: "Ginza Six Luxury Complex",
        name_th: "กินซ่า ซิกส์",
        category: "shopping",
        description: "High-end retail and lifestyle masterpiece featuring premier fashion maisons, Tsutaya Books, and rooftop garden.",
        description_en: "High-end retail and lifestyle masterpiece featuring premier fashion maisons, Tsutaya Books, and rooftop garden.",
        description_th: "ศูนย์การค้าระดับไฮเอนด์ใจกลางย่านกินซ่า รวมแบรนด์ลักชัวรี ร้านหนังสือดีไซน์เก๋ และสวนลอยฟ้า",
        lat: 35.6696,
        lng: 139.7640,
      },
      {
        name: "Thermae-Yu Onsen Shinjuku",
        name_en: "Thermae-Yu Onsen Shinjuku",
        name_th: "แธร์เม-ยู ออนเซ็น ชินจูกุ",
        category: "relax",
        description: "Six-story luxury urban natural hot spring bathhouse featuring thermal mineral waters piped from Izu Peninsula.",
        description_en: "Six-story luxury urban natural hot spring bathhouse featuring thermal mineral waters piped from Izu Peninsula.",
        description_th: "ออนเซ็นธรรมชาติขนาดใหญ่ใจกลางชินจูกุ ผ่อนคลายกับน้ำแร่แท้ส่งตรงจากอิซุ ซาวน่า และหินร้อน",
        lat: 35.6947,
        lng: 139.7058,
      },
      {
        name: "Mount Takao Hiking Trail",
        name_en: "Mount Takao Hiking Trail",
        name_th: "เส้นทางปีนเขาภูเขาทาคาโอะ",
        category: "adventure",
        description: "Popular mountain trail offering lush cedar forests, Yakuo-in Temple, cable car ride, and views of Mount Fuji.",
        description_en: "Popular mountain trail offering lush cedar forests, Yakuo-in Temple, cable car ride, and views of Mount Fuji.",
        description_th: "ภูเขาธรรมชาติยอดนิยมใกล้โตเกียว เดินป่าสูดอากาศบริสุทธิ์ แวะไหว้พระวัดยาคุโออิน และชมวิวฟูจิ",
        lat: 35.6253,
        lng: 139.2437,
      },
      {
        name: "Fuglen Tokyo (Yoyogi)",
        name_en: "Fuglen Tokyo (Yoyogi)",
        name_th: "ฟูกเลน โตเกียว (โยโยงิ)",
        category: "food",
        description: "Famous Oslo-origin boutique cafe serving world-class light roast espresso by day and craft cocktails by night.",
        description_en: "Famous Oslo-origin boutique cafe serving world-class light roast espresso by day and craft cocktails by night.",
        description_th: "คาเฟ่กาแฟชื่อดังสไตล์นอร์เวย์ริมสวนโยโยงิ เสิร์ฟกาแฟคั่วอ่อนรสผลไม้และค็อกเทลคราฟต์ยามค่ำ",
        lat: 35.6661,
        lng: 139.6917,
      },
      {
        name: "teamLab Planets TOKYO",
        name_en: "teamLab Planets TOKYO",
        name_th: "ทีมแล็บ แพลเน็ตส์ โตเกียว",
        category: "culture",
        description: "Immersive body-involving digital art museum where visitors walk barefoot through water and floating crystal gardens.",
        description_en: "Immersive body-involving digital art museum where visitors walk barefoot through water and floating crystal gardens.",
        description_th: "พิพิธภัณฑ์ศิลปะดิจิทัลอินเทอร์แอคทีฟระดับโลก เดินเท้าเปล่าลุยสายน้ำและสวนดอกไม้ลอยฟ้าสุดตระการตา",
        lat: 35.6517,
        lng: 139.7897,
      },
      {
        name: "Sumida River Cruise (Asakusa to Odaiba)",
        name_en: "Sumida River Cruise (Asakusa to Odaiba)",
        name_th: "ล่องเรือแม่น้ำสุมิดะ (อาซากุสะ - โอไดบะ)",
        category: "activity",
        description: "Futuristic Himiko water bus cruise under iconic Tokyo bridges with views of Rainbow Bridge and Tokyo Skytree.",
        description_en: "Futuristic Himiko water bus cruise under iconic Tokyo bridges with views of Rainbow Bridge and Tokyo Skytree.",
        description_th: "ล่องเรือวอเตอร์บัสดีไซน์ยานอวกาศฮิมิโกะ ลอดใต้สะพานประวัติศาสตร์ ชมวิวสะพานสายรุ้งและสกายทรี",
        lat: 35.7119,
        lng: 139.7997,
      },
      {
        name: "Akihabara Electric Town",
        name_en: "Akihabara Electric Town",
        name_th: "ย่านอากิฮาบาระ",
        category: "shopping",
        description: "Vibrant epicentre of Japanese anime, manga, retro video games, electronics, and themed maid cafes.",
        description_en: "Vibrant epicentre of Japanese anime, manga, retro video games, electronics, and themed maid cafes.",
        description_th: "ศูนย์กลางวัฒนธรรมโอตาคุ เกมเรโทร ฟิกเกอร์ อนิเมะ อุปกรณ์ไอที และคาเฟ่ธีมสุดแปลกตา",
        lat: 35.6983,
        lng: 139.7731,
      },
    ];
  } else {
    // Default / other cities
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

/**
 * Checks whether an activity title represents a generic, non-specific zone placeholder
 * (e.g. "Bangkok City Landmark & Park", "City Landmark & Park", "Cultural Center & Heritage")
 * that makes an itinerary feel aimless or lacking specific destinations.
 */
export function isGenericZonePlace(title?: string | null): boolean {
  if (!title) return false;
  const t = title.trim();
  return (
    /^(?:.*?\s+)?(?:city\s+landmark|cultural\s+center|landmark\s*&\s*park|area\s*&\s*park|city\s*center\s*&\s*(?:landmark|park)|center\s*&\s*landmark|old\s*city\s*area|walking\s*street\s*area|unrecognized|error\s*\/\s*unrecognized)/i.test(t) ||
    /^(?:.*?\s+)?(?:sightseeing\s+area|district\s+exploration|exploration\s+zone)\b/i.test(t) ||
    /^(?:.*?\s+)?(?:จุดชมวิวและสวน|ศูนย์วัฒนธรรมและมรดก|แลนด์มาร์กและสวน|โซนท่องเที่ยว|ย่านท่องเที่ยว)/i.test(t)
  );
}

/**
 * Normalizes a place title for robust duplicate detection across days and within days.
 * Strips common prefixes ("Check in: ", "Visit ", "Lunch near ", parentheticals, punctuation).
 */
export function normalizePlaceKey(name?: string | null): string {
  if (!name) return "";
  let clean = name.toLowerCase().trim();
  // Strip parentheticals like "(Temple of Dawn)", "(อาหารกลางวัน)", etc.
  clean = clean.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  // Strip common prefixes
  clean = clean.replace(/^(?:check[\s-]*in:?|check[\s-]*out:?|visit|explore|tour|lunch\s+near|dinner\s+near|street\s+food,?\s*(?:lunch|dinner)?\s*(?:near|around)?|สตรีทฟู้ด\s*(?:มื้อกลางวัน|มื้อค่ำ)?(?:รอบ|แถว)?|มื้อกลางวันแถว|มื้อค่ำแถว|เที่ยวชม)\s*/i, "").trim();
  // Strip punctuation and excess whitespace
  clean = clean.replace(/[^a-z0-9\u0E00-\u0E7F]/g, "").trim();
  return clean;
}

/**
 * Enforces:
 * 1. ZERO DUPLICATE places intra-day (within the same day).
 * 2. ZERO DUPLICATE attractions cross-day (across different days of the entire trip).
 * 3. Caps generic zone places to at most 1 per day (specifically for street food/area meal).
 *    Replaces generic sightseeing placeholders (like "Bangkok City Landmark & Park") with concrete real POIs.
 * 4. Preserves user-uploaded photo places and hotel check-in/out unconditionally.
 */
export function deduplicateItineraryActivities<T extends { day: number; activities: Activity[] }>(
  itinerary: T[],
  destinationCity: string = "Bangkok"
): T[] {
  if (!Array.isArray(itinerary) || itinerary.length === 0) return itinerary;

  const fallbackPool = getFallbackSuggestions(destinationCity);
  let fallbackIdx = 0;

  // Track global visited places across all days
  const visitedKeys = new Set<string>();

  // Pre-seed user-uploaded photo places into visitedKeys so they are NEVER replaced
  for (const day of itinerary) {
    for (const act of day.activities || []) {
      if (act.isUserPhoto && act.title) {
        const key = normalizePlaceKey(act.title);
        if (key) visitedKeys.add(key);
      }
    }
  }

  // Helper to pick next unused fallback venue
  const getNextUnusedFallback = (preferredCategory?: string): SuggestedPlace | null => {
    // 1. Try to match preferred category first
    for (let i = 0; i < fallbackPool.length; i++) {
      const candidate = fallbackPool[(fallbackIdx + i) % fallbackPool.length];
      const key = normalizePlaceKey(candidate.name);
      if (!visitedKeys.has(key)) {
        if (!preferredCategory || candidate.category === preferredCategory) {
          fallbackIdx = (fallbackIdx + i + 1) % fallbackPool.length;
          visitedKeys.add(key);
          return candidate;
        }
      }
    }
    // 2. Any unused category
    for (let i = 0; i < fallbackPool.length; i++) {
      const candidate = fallbackPool[(fallbackIdx + i) % fallbackPool.length];
      const key = normalizePlaceKey(candidate.name);
      if (!visitedKeys.has(key)) {
        fallbackIdx = (fallbackIdx + i + 1) % fallbackPool.length;
        visitedKeys.add(key);
        return candidate;
      }
    }
    return null;
  };

  return itinerary.map((dayPlan) => {
    const newActivities: Activity[] = [];
    let dayZoneDiningCount = 0;

    for (const act of dayPlan.activities || []) {
      const isHotel = act.type === "hotel" || /check[\s-]*in|check[\s-]*out/i.test(act.title);
      if (isHotel) {
        newActivities.push(act);
        continue;
      }

      if (act.isUserPhoto) {
        newActivities.push(act);
        continue;
      }

      const key = normalizePlaceKey(act.title);
      const isZoneDiningAct = isZoneDining(act.title);
      const isGenericZone = isGenericZonePlace(act.title);

      let shouldReplace = false;

      // Condition 1: Duplicate place intra-day or cross-day
      if (key && visitedKeys.has(key)) {
        shouldReplace = true;
      }

      // Condition 2: Generic non-restaurant zone place (e.g. "Bangkok City Landmark & Park")
      if (isGenericZone && !isZoneDiningAct) {
        shouldReplace = true;
      }

      // Condition 3: Limit zone dining to AT MOST 1 per day to prevent aimless trips
      if (isZoneDiningAct) {
        if (dayZoneDiningCount >= 1) {
          shouldReplace = true;
        } else {
          dayZoneDiningCount++;
        }
      }

      if (shouldReplace) {
        const replacement = getNextUnusedFallback(act.type);
        if (replacement) {
          newActivities.push({
            ...act,
            id: `dedup-${dayPlan.day}-${act.time || "00"}-${Math.random().toString(36).slice(2, 7)}`,
            title: replacement.name,
            title_en: replacement.name_en || replacement.name,
            title_th: replacement.name_th || replacement.name,
            english_name: replacement.english_name || replacement.name_en || replacement.name,
            description: replacement.description || act.description,
            description_en: replacement.description_en || act.description_en || act.description,
            description_th: replacement.description_th || act.description_th || act.description,
            type: (replacement.category as any) || act.type,
            lat: replacement.lat || act.lat,
            lng: replacement.lng || act.lng,
            photo_url: replacement.photo_url || replacement.image || act.photo_url,
            image_url: replacement.image_url || replacement.image || act.image_url,
            rating: replacement.rating || 4.5,
            userRatingsTotal: replacement.userRatingsTotal || 350,
          });
          continue;
        }
      }

      // Register key as visited so subsequent days or later stops in the same day do not reuse it
      if (key) {
        visitedKeys.add(key);
      }
      newActivities.push(act);
    }

    return {
      ...dayPlan,
      activities: newActivities,
    };
  });
}
