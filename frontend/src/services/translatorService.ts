/**
 * Translator Service — Robust bilingual (Thai <-> English) dictionary,
 * script detection, pattern-based phrase translation, and resilient translation cache.
 */

// In-memory translation cache to avoid repeated translations
const memoryTranslationCache = new Map<string, string>();
const translationListeners = new Set<() => void>();

export function subscribeTranslationUpdates(listener: () => void): () => void {
  translationListeners.add(listener);
  return () => {
    translationListeners.delete(listener);
  };
}

function notifyTranslationUpdates(): void {
  translationListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("Translation listener error:", e);
    }
  });
}

// Common Thai <-> English travel, place, and accommodation vocabulary
export const DICTIONARY_EN_TO_TH: Record<string, string> = {
  // Accommodations & Logistics
  "hotel": "โรงแรม",
  "resort": "รีสอร์ท",
  "hostel": "โฮสเทล",
  "inn": "อินน์",
  "guesthouse": "เกสต์เฮาส์",
  "boutique hotel": "โรงแรมบูทีค",
  "luxury hotel": "โรงแรมหรู",
  "villa": "วิลล่า",
  "homestay": "โฮมสเตย์",
  "capsule hotel": "โรงแรมแคปซูล",
  "ryokan": "เรียวกัง",
  "check in": "เช็คอิน",
  "check out": "เช็คเอาต์",
  "check-in": "เช็คอิน",
  "check-out": "เช็คเอาต์",
  "accommodation": "ที่พัก",
  "stay": "ที่พัก",
  "airport": "สนามบิน",
  "international airport": "ท่าอากาศยานนานาชาติ",
  "train station": "สถานีรถไฟ",
  "subway station": "สถานีรถไฟฟ้าใต้ดิน",
  "metro station": "สถานีรถไฟฟ้า",
  "bts station": "สถานีรถไฟฟ้า BTS",
  "mrt station": "สถานีรถไฟฟ้า MRT",
  "bus terminal": "สถานีขนส่งผู้โดยสาร",
  "pier": "ท่าเรือ",
  "ferry pier": "ท่าเรือข้ามฟาก",

  // Attractions & Place Types
  "temple": "วัด",
  "wat": "วัด",
  "shrine": "ศาลเจ้า",
  "palace": "พระราชวัง",
  "grand palace": "พระบรมมหาราชวัง",
  "royal palace": "พระราชวังหลวง",
  "castle": "ปราสาท",
  "fortress": "ป้อมปราการ",
  "monument": "อนุสาวรีย์",
  "ruins": "โบราณสถาน",
  "ancient city": "เมืองโบราณ",
  "museum": "พิพิธภัณฑ์",
  "art museum": "พิพิธภัณฑ์ศิลปะ",
  "art gallery": "หอศิลป์",
  "national park": "อุทยานแห่งชาติ",
  "park": "สวนสาธารณะ",
  "public park": "สวนสาธารณะ",
  "central park": "สวนสาธารณะใจกลางเมือง",
  "botanical garden": "สวนพฤกษศาสตร์",
  "garden": "สวนหย่อม",
  "beach": "ชายหาด",
  "bay": "อ่าว",
  "cove": "อ่าวเล็ก",
  "island": "เกาะ",
  "islands": "หมู่เกาะ",
  "waterfall": "น้ำตก",
  "mountain": "ภูเขา",
  "peak": "ยอดเขา",
  "viewpoint": "จุดชมวิว",
  "skywalk": "สกายวอล์ก",
  "observation deck": "จุดชมวิวบนตึกสูง",
  "night market": "ตลาดนัดกลางคืน",
  "floating market": "ตลาดน้ำ",
  "market": "ตลาด",
  "fresh market": "ตลาดสด",
  "walking street": "ถนนคนเดิน",
  "shopping mall": "ศูนย์การค้า",
  "department store": "ห้างสรรพสินค้า",
  "arcade": "ศูนย์รวมร้านค้า",
  "street food": "สตรีทฟู้ด",
  "restaurant": "ร้านอาหาร",
  "local restaurant": "ร้านอาหารท้องถิ่น",
  "eatery": "ร้านอาหารท้องถิ่น",
  "cafe": "คาเฟ่",
  "coffee shop": "ร้านกาแฟ",
  "bakery": "ร้านเบเกอรี่",
  "bar": "บาร์",
  "rooftop bar": "รูฟท็อปบาร์",
  "pub": "ผับ",
  "nightclub": "ไนท์คลับ",
  "spa": "สปา",
  "massage": "นวดแผนไทย",
  "hot spring": "บ่อน้ำพุร้อน",
  "onsen": "ออนเซ็น",
  "theme park": "สวนสนุก",
  "amusement park": "สวนสนุก",
  "water park": "สวนน้ำ",
  "aquarium": "พิพิธภัณฑ์สัตว์น้ำ",
  "zoo": "สวนสัตว์",
  "safari": "ซาฟารี",
  "safari park": "สวนสัตว์เปิดซาฟารี",

  // Top Thailand Attractions & Landmarks
  "wat phra kaew": "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
  "temple of the emerald buddha": "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
  "wat arun": "วัดอรุณราชวราราม",
  "temple of dawn": "วัดอรุณราชวราราม (วัดแจ้ง)",
  "wat pho": "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)",
  "temple of the reclining buddha": "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)",
  "the grand palace": "พระบรมมหาราชวัง",
  "chatuchak weekend market": "ตลาดนัดจตุจักร",
  "chatuchak market": "ตลาดนัดจตุจักร",
  "jj market": "ตลาดนัดจตุจักร",
  "iconsiam": "ไอคอนสยาม",
  "siam paragon": "สยามพารากอน",
  "centralworld": "เซ็นทรัลเวิลด์",
  "central embassy": "เซ็นทรัล เอ็มบาสซี",
  "emquartier": "เอ็มควอเทียร์",
  "emporium": "เอ็มโพเรียม",
  "emsphere": "เอ็มสเฟียร์",
  "asiatique": "เอเชียทีค เดอะ ริเวอร์ฟรอนท์",
  "asiatique the riverfront": "เอเชียทีค เดอะ ริเวอร์ฟรอนท์",
  "jim thompson house": "บ้านจิม ทอมป์สัน",
  "yaowarat": "เยาวราช",
  "yaowarat road": "ถนนเยาวราช",
  "chinatown": "เยาวราช (ไชน่าทาวน์)",
  "chinatown bangkok": "เยาวราช (ไชน่าทาวน์ แบงค็อก)",
  "khao san road": "ถนนข้าวสาร",
  "khaosan road": "ถนนข้าวสาร",
  "lumphini park": "สวนลุมพินี",
  "lumpini park": "สวนลุมพินี",
  "benjakitti park": "สวนเบญจกิติ",
  "benchakitti park": "สวนเบญจกิติ",
  "mahanakhon skywalk": "มหานคร สกายวอล์ค",
  "king power mahanakhon": "คิง เพาเวอร์ มหานคร",
  "erawan shrine": "ศาลท้าวมหาพรหมเอราวัณ",
  "wat saket": "วัดสระเกศ (ภูเขาทอง)",
  "golden mount": "ภูเขาทอง (วัดสระเกศ)",
  "wat traimit": "วัดไตรมิตรวิทยาราม",
  "golden buddha": "พระพุทธมหาสุวรรณปฏิมากร (วัดไตรมิตร)",
  "wat benchamabophit": "วัดเบญจมบพิตรดุสิตวนาราม",
  "marble temple": "วัดเบญจมบพิตร (วัดหินอ่อน)",
  "wat suthat": "วัดสุทัศนเทพวราราม",
  "giant swing": "เสาชิงช้า",
  "safari world": "ซาฟารีเวิลด์",
  "safari world bangkok": "ซาฟารีเวิลด์ กรุงเทพฯ",
  "dream world": "ดรีมเวิลด์",
  "siam amazing park": "สยามอะเมซิ่งพาร์ค",
  "sea life bangkok": "ซีไลฟ์ แบงคอก โอเชียนเวิลด์",
  "sea life bangkok ocean world": "ซีไลฟ์ แบงคอก โอเชียนเวิลด์",
  "damnoen saduak floating market": "ตลาดน้ำดำเนินสะดวก",
  "amphawa floating market": "ตลาดน้ำอัมพวา",
  "maeklong railway market": "ตลาดร่มหุบแม่กลอง",
  "talad rom hub": "ตลาดร่มหุบ",
  "jodd fairs": "จ๊อดแฟร์",
  "jodd fairs rama 9": "จ๊อดแฟร์ พระราม 9",
  "jodd fairs danneramit": "จ๊อดแฟร์ แดนเนรมิต",
  "river city bangkok": "ริเวอร์ซิตี้ แบงค็อก",
  "bangkok art and culture centre": "หอศิลปวัฒนธรรมแห่งกรุงเทพมหานคร (BACC)",
  "bacc": "หอศิลปวัฒนธรรมแห่งกรุงเทพมหานคร",
  "wat chaiwatthanaram": "วัดไชยวัฒนาราม",
  "wat mahathat ayutthaya": "วัดมหาธาตุ อยุธยา",
  "wat phra si sanphet": "วัดพระศรีสรรเพชญ์",
  "wat yai chai mongkhon": "วัดใหญ่ชัยมงคล",
  "ayutthaya historical park": "อุทยานประวัติศาสตร์พระนครศรีอยุธยา",
  "wat phra that doi suthep": "วัดพระธาตุดอยสุเทพ",
  "doi suthep": "ดอยสุเทพ",
  "wat umong": "วัดอุโมงค์",
  "wat chedi luang": "วัดเจดีย์หลวง",
  "wat phra singh": "วัดพระสิงห์",
  "tha phae gate": "ประตูท่าแพ",
  "sunday walking street": "ถนนคนเดินท่าแพ (วันอาทิตย์)",
  "wua lai walking street": "ถนนคนเดินวัวลาย (วันเสาร์)",
  "nimman road": "ถนนนิมมานเหมินท์",
  "nimmanhaemin": "ถนนนิมมานเหมินท์",
  "chiang mai night bazaar": "ไนท์บาซาร์เชียงใหม่",
  "mon cham": "ม่อนแจ่ม",
  "doi inthanon": "ดอยอินทนนท์",
  "doi inthanon national park": "อุทยานแห่งชาติดอยอินทนนท์",
  "wat rong khun": "วัดร่องขุ่น (วัดขาว)",
  "white temple": "วัดร่องขุ่น (วัดขาว)",
  "wat rong suea ten": "วัดร่องเสือเต้น (วัดน้ำเงิน)",
  "blue temple": "วัดร่องเสือเต้น (วัดน้ำเงิน)",
  "baan dam museum": "พิพิธภัณฑ์บ้านดำ",
  "big buddha phuket": "พระใหญ่ภูเก็ต (วัดพระใหญ่)",
  "wat chalong": "วัดฉลอง (วัดไชยธาราราม)",
  "promthep cape": "แหลมพรหมเทพ",
  "patong beach": "หาดป่าตอง",
  "kata beach": "หาดกะตะ",
  "karon beach": "หาดกะรน",
  "phuket old town": "ย่านเมืองเก่าภูเก็ต",
  "phang nga bay": "อ่าวพังงา",
  "james bond island": "เกาะเจมส์บอนด์ (เขาตะปู)",
  "phi phi islands": "หมู่เกาะพีพี",
  "phi phi don": "เกาะพีพีดอน",
  "phi phi leh": "เกาะพีพีเล",
  "maya bay": "อ่าวมาหยา",
  "railay beach": "หาดไร่เลย์",
  "poda island": "เกาะปอดะ",
  "emerald pool": "สระมรกต กระบี่",
  "sanctuary of truth": "ปราสาทสัจธรรม พัทยา",
  "nong nooch tropical garden": "สวนนงนุช พัทยา",
  "pattaya floating market": "ตลาดน้ำ 4 ภาค พัทยา",
  "jomtien beach": "หาดจอมเทียน",
  "koh larn": "เกาะล้าน",
  "coral island": "เกาะเฮ / เกาะล้าน",
  "walking street pattaya": "ถนนคนเดินพัทยา",

  // Top International Attractions
  "senso-ji": "วัดเซ็นโซจิ (อาซากุสะ)",
  "sensoji temple": "วัดเซ็นโซจิ (อาซากุสะ)",
  "tokyo tower": "โตเกียวทาวเวอร์",
  "tokyo skytree": "โตเกียวสกายทรี",
  "shibuya crossing": "ห้าแยกชิบูย่า",
  "meiji shrine": "ศาลเจ้าเมจิ",
  "shinjuku gyoen": "สวนชินจูกุเกียวเอน",
  "tokyo disneyland": "โตเกียวดิสนีย์แลนด์",
  "tokyo disneysea": "โตเกียวดิสนีย์ซี",
  "tsukiji market": "ตลาดปลาซึกิจิ",
  "fushimi inari taisha": "ศาลเจ้าฟูชิมิอินาริ",
  "kinkaku-ji": "วัดคินคะคุจิ (ปราสาททอง)",
  "kiyomizu-dera": "วัดคิโยมิซุเดระ (วัดน้ำใส)",
  "arashiyama bamboo grove": "ป่าไผ่อาราชิยามะ",
  "osaka castle": "ปราสาทโอซาก้า",
  "dotonbori": "โดทงโบริ (โอซาก้า)",
  "universal studios japan": "ยูนิเวอร์แซล สตูดิโอส์ เจแปน",
  "gyeongbokgung palace": "พระราชวังเคียงบกกุง",
  "n seoul tower": "เอ็นโซลทาวเวอร์ (นัมซาน)",
  "myeongdong": "ย่านเมียงดง",
  "marina bay sands": "มารีน่า เบย์ แซนด์ส",
  "gardens by the bay": "การ์เด้นส์ บาย เดอะ เบย์",
  "sentosa island": "เกาะเซ็นโตซ่า",
  "universal studios singapore": "ยูนิเวอร์แซล สตูดิโอส์ สิงคโปร์",
  "eiffel tower": "หอไอเฟล",
  "louvre museum": "พิพิธภัณฑ์ลูฟวร์",
  "notre-dame cathedral": "มหาวิหารน็อทร์-ดาม",
  "palace of versailles": "พระราชวังแวร์ซาย",
  "arc de triomphe": "ประตูชัยฝรั่งเศส",
  "big ben": "หอนาฬิกาบิ๊กเบน",
  "london eye": "ชิงช้าสวรรค์ลอนดอนอาย",
  "tower bridge": "สะพานทาวเวอร์บริดจ์",
  "british museum": "พิพิธภัณฑ์บริติช",
  "buckingham palace": "พระราชวังบักกิงแฮม",
  "times square": "ไทม์สแควร์",
  "central park new york": "เซ็นทรัลพาร์ก นิวยอร์ก",
  "statue of liberty": "เทพีเสรีภาพ",
  "empire state building": "ตึกเอ็มไพร์สเตต",

  // Common activities & timing slots
  "sightseeing": "ท่องเที่ยวชมเมือง",
  "dinner": "อาหารค่ำ",
  "lunch": "อาหารกลางวัน",
  "breakfast": "อาหารเช้า",
  "sunset": "ชมพระอาทิตย์ตก",
  "sunrise": "ชมพระอาทิตย์ขึ้น",
  "boat tour": "ล่องเรือเที่ยวชม",
  "cruise": "ล่องเรือสำราญ",
  "shopping": "ช้อปปิ้ง",
  "coffee break": "พักจิบกาแฟ",
  "afternoon tea": "จิบน้ำชายามบ่าย",
};

export const DICTIONARY_TH_TO_EN: Record<string, string> = {
  // Accommodations & Logistics
  "โรงแรม": "Hotel",
  "รีสอร์ท": "Resort",
  "โฮสเทล": "Hostel",
  "เกสต์เฮาส์": "Guesthouse",
  "วิลล่า": "Villa",
  "โฮมสเตย์": "Homestay",
  "ที่พัก": "Accommodation",
  "เช็คอิน": "Check in",
  "เช็คเอาต์": "Check out",
  "เช็คเอาท์": "Check out",
  "สนามบิน": "Airport",
  "ท่าอากาศยาน": "Airport",
  "สถานีรถไฟ": "Train Station",
  "สถานีขนส่ง": "Bus Terminal",
  "ท่าเรือ": "Pier",

  // Attractions & Place Types
  "วัด": "Wat (Temple)",
  "ศาลเจ้า": "Shrine",
  "พระราชวัง": "Palace",
  "พระบรมมหาราชวัง": "The Grand Palace",
  "ปราสาท": "Castle",
  "โบราณสถาน": "Historical Ruins",
  "เมืองโบราณ": "Ancient City",
  "พิพิธภัณฑ์": "Museum",
  "หอศิลป์": "Art Gallery",
  "อุทยานแห่งชาติ": "National Park",
  "สวนสาธารณะ": "Public Park",
  "สวนพฤกษศาสตร์": "Botanical Garden",
  "สวน": "Garden",
  "หาด": "Beach",
  "ชายหาด": "Beach",
  "อ่าว": "Bay",
  "เกาะ": "Island",
  "หมู่เกาะ": "Islands",
  "น้ำตก": "Waterfall",
  "ภูเขา": "Mountain",
  "ดอย": "Doi (Mountain)",
  "จุดชมวิว": "Viewpoint",
  "สกายวอล์ก": "Skywalk",
  "สกายวอล์ค": "Skywalk",
  "ตลาดนัดกลางคืน": "Night Market",
  "ตลาดโต้รุ่ง": "Night Market",
  "ตลาดน้ำ": "Floating Market",
  "ตลาด": "Market",
  "ตลาดสด": "Fresh Market",
  "ถนนคนเดิน": "Walking Street",
  "ห้างสรรพสินค้า": "Shopping Mall",
  "ศูนย์การค้า": "Shopping Mall",
  "สตรีทฟู้ด": "Street Food",
  "ร้านอาหาร": "Restaurant",
  "ร้านอาหารท้องถิ่น": "Local Restaurant",
  "ร้านกาแฟ": "Cafe",
  "คาเฟ่": "Cafe",
  "บาร์": "Bar",
  "รูฟท็อปบาร์": "Rooftop Bar",
  "ผับ": "Pub",
  "สปา": "Spa",
  "นวดแผนไทย": "Thai Massage",
  "บ่อน้ำพุร้อน": "Hot Spring",
  "ออนเซ็น": "Onsen",
  "สวนสนุก": "Theme Park",
  "สวนน้ำ": "Water Park",
  "พิพิธภัณฑ์สัตว์น้ำ": "Aquarium",
  "สวนสัตว์": "Zoo",
  "ซาฟารี": "Safari",

  // Famous Thai Attractions
  "วัดพระศรีรัตนศาสดาราม": "Wat Phra Kaew (Temple of the Emerald Buddha)",
  "วัดพระแก้ว": "Wat Phra Kaew (Temple of the Emerald Buddha)",
  "วัดอรุณราชวราราม": "Wat Arun (Temple of Dawn)",
  "วัดอรุณ": "Wat Arun (Temple of Dawn)",
  "วัดแจ้ง": "Wat Arun (Temple of Dawn)",
  "วัดพระเชตุพนวิมลมังคลาราม": "Wat Pho (Temple of the Reclining Buddha)",
  "วัดโพธิ์": "Wat Pho (Temple of the Reclining Buddha)",
  "ตลาดนัดจตุจักร": "Chatuchak Weekend Market",
  "จตุจักร": "Chatuchak Weekend Market",
  "ไอคอนสยาม": "ICONSIAM",
  "สยามพารากอน": "Siam Paragon",
  "เซ็นทรัลเวิลด์": "CentralWorld",
  "เซ็นทรัล เอ็มบาสซี": "Central Embassy",
  "เอ็มควอเทียร์": "EmQuartier",
  "เอ็มโพเรียม": "Emporium",
  "เอ็มสเฟียร์": "EMSPHERE",
  "เอเชียทีค เดอะ ริเวอร์ฟรอนท์": "Asiatique The Riverfront",
  "เอเชียทีค": "Asiatique The Riverfront",
  "บ้านจิม ทอมป์สัน": "Jim Thompson House",
  "เยาวราช": "Yaowarat Chinatown",
  "ถนนเยาวราช": "Yaowarat Chinatown Road",
  "ถนนข้าวสาร": "Khao San Road",
  "สวนลุมพินี": "Lumphini Park",
  "สวนเบญจกิติ": "Benjakitti Park",
  "มหานคร สกายวอล์ค": "King Power Mahanakhon SkyWalk",
  "ตึกมหานคร": "King Power Mahanakhon",
  "ศาลท้าวมหาพรหม": "Erawan Shrine",
  "ศาลท้าวมหาพรหมเอราวัณ": "Erawan Shrine",
  "วัดสระเกศ": "Wat Saket (Golden Mount)",
  "ภูเขาทอง": "Golden Mount (Wat Saket)",
  "วัดไตรมิตรวิทยาราม": "Wat Traimit (Golden Buddha)",
  "วัดไตรมิตร": "Wat Traimit (Golden Buddha)",
  "วัดเบญจมบพิตร": "Wat Benchamabophit (Marble Temple)",
  "วัดเบญจมบพิตรดุสิตวนาราม": "Wat Benchamabophit (Marble Temple)",
  "วัดสุทัศนเทพวราราม": "Wat Suthat & Giant Swing",
  "เสาชิงช้า": "Giant Swing",
  "ซาฟารีเวิลด์": "Safari World",
  "ดรีมเวิลด์": "Dream World",
  "สยามอะเมซิ่งพาร์ค": "Siam Amazing Park",
  "ซีไลฟ์ แบงคอก": "SEA LIFE Bangkok Ocean World",
  "ตลาดน้ำดำเนินสะดวก": "Damnoen Saduak Floating Market",
  "ตลาดน้ำอัมพวา": "Amphawa Floating Market",
  "ตลาดร่มหุบ": "Maeklong Railway Market",
  "ตลาดร่มหุบแม่กลอง": "Maeklong Railway Market",
  "จ๊อดแฟร์": "Jodd Fairs Night Market",
  "ริเวอร์ซิตี้": "River City Bangkok",
  "หอศิลปวัฒนธรรมแห่งกรุงเทพมหานคร": "Bangkok Art and Culture Centre (BACC)",
  "วัดไชยวัฒนาราม": "Wat Chaiwatthanaram",
  "วัดมหาธาตุ อยุธยา": "Wat Mahathat Ayutthaya",
  "วัดพระศรีสรรเพชญ์": "Wat Phra Si Sanphet",
  "วัดใหญ่ชัยมงคล": "Wat Yai Chai Mongkhon",
  "วัดพระธาตุดอยสุเทพ": "Wat Phra That Doi Suthep",
  "ดอยสุเทพ": "Doi Suthep",
  "วัดอุโมงค์": "Wat Umong",
  "วัดเจดีย์หลวง": "Wat Chedi Luang",
  "วัดพระสิงห์": "Wat Phra Singh",
  "ประตูท่าแพ": "Tha Phae Gate",
  "ถนนคนเดินท่าแพ": "Sunday Walking Street (Tha Phae)",
  "ถนนคนเดินวัวลาย": "Wua Lai Saturday Walking Street",
  "ถนนนิมมานเหมินท์": "Nimmanhaemin Road",
  "นิมมาน": "Nimman Road",
  "ไนท์บาซาร์เชียงใหม่": "Chiang Mai Night Bazaar",
  "ม่อนแจ่ม": "Mon Cham",
  "ดอยอินทนนท์": "Doi Inthanon National Park",
  "วัดร่องขุ่น": "Wat Rong Khun (White Temple)",
  "วัดร่องเสือเต้น": "Wat Rong Suea Ten (Blue Temple)",
  "พิพิธภัณฑ์บ้านดำ": "Baan Dam Museum",
  "พระใหญ่ภูเก็ต": "Big Buddha Phuket",
  "วัดฉลอง": "Wat Chalong",
  "แหลมพรหมเทพ": "Promthep Cape",
  "หาดป่าตอง": "Patong Beach",
  "หาดกะตะ": "Kata Beach",
  "หาดกะรน": "Karon Beach",
  "เมืองเก่าภูเก็ต": "Phuket Old Town",
  "อ่าวพังงา": "Phang Nga Bay",
  "เกาะเจมส์บอนด์": "James Bond Island",
  "หมู่เกาะพีพี": "Phi Phi Islands",
  "เกาะพีพี": "Phi Phi Island",
  "อ่าวมาหยา": "Maya Bay",
  "หาดไร่เลย์": "Railay Beach",
  "เกาะปอดะ": "Poda Island",
  "สระมรกต": "Emerald Pool Krabi",
  "ปราสาทสัจธรรม": "Sanctuary of Truth Pattaya",
  "สวนนงนุช": "Nong Nooch Tropical Garden",
  "ตลาดน้ำ 4 ภาค": "Pattaya Floating Market",
  "หาดจอมเทียน": "Jomtien Beach",
  "เกาะล้าน": "Koh Larn (Coral Island)",
};

/**
 * Checks if a string contains Thai characters
 */
export function hasThaiScript(text?: string | null): boolean {
  if (!text) return false;
  return /[\u0E00-\u0E7F]/.test(text);
}

/**
 * Normalizes string for dictionary lookup
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().trim().replace(/[\(\)\[\],.]/g, " ").replace(/\s+/g, " ");
}

/**
 * Translates common travel sentences & description patterns
 */
function translatePhrasePatternSync(text: string, targetLang: "th" | "en"): string | null {
  const t = text.trim();
  if (!t) return null;

  if (targetLang === "th") {
    // Hotel Check-in / Check-out patterns
    if (/^check\s*-?\s*in\b:?\s*(.*)$/i.test(t)) {
      const match = t.match(/^check\s*-?\s*in\b:?\s*(.*)$/i);
      const place = match?.[1] ? translateTextSync(match[1], "th") : "";
      return place ? `เช็คอิน: ${place}` : "เช็คอินเข้าที่พัก";
    }
    if (/^check\s*-?\s*out\b:?\s*(.*)$/i.test(t)) {
      const match = t.match(/^check\s*-?\s*out\b:?\s*(.*)$/i);
      const place = match?.[1] ? translateTextSync(match[1], "th") : "";
      return place ? `เช็คเอาต์: ${place}` : "เช็คเอาต์จากที่พัก";
    }

    // Common description phrase templates (English -> Thai)
    if (/^enjoy\s+lunch\s+(at|in)\s+(.*)$/i.test(t)) {
      const m = t.match(/^enjoy\s+lunch\s+(at|in)\s+(.*)$/i);
      return `รับประทานอาหารกลางวันแสนอร่อยที่ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^lunch\s+(at|in)\s+(.*)$/i.test(t)) {
      const m = t.match(/^lunch\s+(at|in)\s+(.*)$/i);
      return `มื้อกลางวันที่ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^enjoy\s+dinner\s+(at|in)\s+(.*)$/i.test(t)) {
      const m = t.match(/^enjoy\s+dinner\s+(at|in)\s+(.*)$/i);
      return `รับประทานอาหารค่ำพร้อมบรรยากาศสุดพิเศษที่ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^dinner\s+(at|in)\s+(.*)$/i.test(t)) {
      const m = t.match(/^dinner\s+(at|in)\s+(.*)$/i);
      return `มื้อค่ำที่ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^visit\s+(and\s+explore\s+)?(.*)$/i.test(t)) {
      const m = t.match(/^visit\s+(and\s+explore\s+)?(.*)$/i);
      return `เยี่ยมชมและสัมผัสความงดงามของ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^explore\s+(the\s+)?(.*)$/i.test(t)) {
      const m = t.match(/^explore\s+(the\s+)?(.*)$/i);
      return `สำรวจและเดินชมบรรยากาศ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^discover\s+(the\s+)?(.*)$/i.test(t)) {
      const m = t.match(/^discover\s+(the\s+)?(.*)$/i);
      return `ค้นพบเสน่ห์และเอกลักษณ์ของ ${translateTextSync(m?.[2] || "", "th")}`;
    }
    if (/^watch\s+(the\s+)?sunset\s+(at|from)\s+(.*)$/i.test(t)) {
      const m = t.match(/^watch\s+(the\s+)?sunset\s+(at|from)\s+(.*)$/i);
      return `ชมพระอาทิตย์ตกดินอันสวยงามที่ ${translateTextSync(m?.[3] || "", "th")}`;
    }
    if (/^relax\s+(and\s+unwind\s+)?(at|in)\s+(.*)$/i.test(t)) {
      const m = t.match(/^relax\s+(and\s+unwind\s+)?(at|in)\s+(.*)$/i);
      return `พักผ่อนหย่อนใจและผ่อนคลายที่ ${translateTextSync(m?.[3] || "", "th")}`;
    }
    if (/^shop\s+(for\s+souvenirs\s+)?(at|in)\s+(.*)$/i.test(t)) {
      const m = t.match(/^shop\s+(for\s+souvenirs\s+)?(at|in)\s+(.*)$/i);
      return `ช้อปปิ้งของฝากและสินค้าท้องถิ่นที่ ${translateTextSync(m?.[3] || "", "th")}`;
    }
    if (/^stroll\s+(through|around)\s+(.*)$/i.test(t)) {
      const m = t.match(/^stroll\s+(through|around)\s+(.*)$/i);
      return `เดินเล่นชมทัศนียภาพรอบๆ ${translateTextSync(m?.[2] || "", "th")}`;
    }
  } else {
    // Target is English
    // Thai Check-in / Check-out patterns
    if (/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i.test(t)) {
      const match = t.match(/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      return place ? `Check in: ${place}` : "Check in to accommodation";
    }
    if (/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i.test(t)) {
      const match = t.match(/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      return place ? `Check out: ${place}` : "Check out from accommodation";
    }

    // Common description phrase templates (Thai -> English)
    if (/^(รับประทานอาหารกลางวัน|ทานอาหารกลางวัน|มื้อกลางวัน)(ที่|ณ)?\s*(.*)$/i.test(t)) {
      const m = t.match(/^(รับประทานอาหารกลางวัน|ทานอาหารกลางวัน|มื้อกลางวัน)(ที่|ณ)?\s*(.*)$/i);
      return `Enjoy lunch at ${translateTextSync(m?.[3] || "", "en")}`;
    }
    if (/^(รับประทานอาหารค่ำ|ทานอาหารเย็น|มื้อค่ำ|มื้อเย็น)(ที่|ณ)?\s*(.*)$/i.test(t)) {
      const m = t.match(/^(รับประทานอาหารค่ำ|ทานอาหารเย็น|มื้อค่ำ|มื้อเย็น)(ที่|ณ)?\s*(.*)$/i);
      return `Dinner and evening dining at ${translateTextSync(m?.[3] || "", "en")}`;
    }
    if (/^(เยี่ยมชม|กราบไหว้|สักการะ|ชมความงามของ)\s*(.*)$/i.test(t)) {
      const m = t.match(/^(เยี่ยมชม|กราบไหว้|สักการะ|ชมความงามของ)\s*(.*)$/i);
      return `Visit and explore ${translateTextSync(m?.[2] || "", "en")}`;
    }
    if (/^(สำรวจ|เดินชม|เดินเล่น)(รอบๆ|บริเวณ)?\s*(.*)$/i.test(t)) {
      const m = t.match(/^(สำรวจ|เดินชม|เดินเล่น)(รอบๆ|บริเวณ)?\s*(.*)$/i);
      return `Explore and stroll around ${translateTextSync(m?.[3] || "", "en")}`;
    }
    if (/^(ชมพระอาทิตย์ตก|ชมวิวพระอาทิตย์ตกดิน)(ที่|ณ)?\s*(.*)$/i.test(t)) {
      const m = t.match(/^(ชมพระอาทิตย์ตก|ชมวิวพระอาทิตย์ตกดิน)(ที่|ณ)?\s*(.*)$/i);
      return `Watch sunset at ${translateTextSync(m?.[3] || "", "en")}`;
    }
    if (/^(พักผ่อน|ผ่อนคลาย)(ที่|ณ)?\s*(.*)$/i.test(t)) {
      const m = t.match(/^(พักผ่อน|ผ่อนคลาย)(ที่|ณ)?\s*(.*)$/i);
      return `Relax and unwind at ${translateTextSync(m?.[3] || "", "en")}`;
    }
    if (/^(ช้อปปิ้ง|เลือกซื้อของฝาก|เดินตลาด)(ที่|ณ)?\s*(.*)$/i.test(t)) {
      const m = t.match(/^(ช้อปปิ้ง|เลือกซื้อของฝาก|เดินตลาด)(ที่|ณ)?\s*(.*)$/i);
      return `Shop for souvenirs and local items at ${translateTextSync(m?.[3] || "", "en")}`;
    }
  }

  return null;
}

/**
 * Synchronous dictionary-based translator for immediate UI rendering.
 * Translates known keywords, phrases, hotel check-in/out patterns, and categories.
 */
export function translateTextSync(text: string, targetLang: "th" | "en"): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) {
    return memoryTranslationCache.get(cacheKey)!;
  }

  // Already in target script check:
  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai) return trimmed;
  if (targetLang === "en" && !isThai) return trimmed;

  let result = trimmed;

  // 1. Check Phrase / Sentence pattern matcher
  const phraseMatch = translatePhrasePatternSync(trimmed, targetLang);
  if (phraseMatch) {
    memoryTranslationCache.set(cacheKey, phraseMatch);
    return phraseMatch;
  }

  const normalized = normalizeKey(trimmed);

  if (targetLang === "th") {
    // 2. Direct dictionary match
    if (DICTIONARY_EN_TO_TH[normalized]) {
      result = DICTIONARY_EN_TO_TH[normalized];
    } else {
      // 3. Prefix / Keyword replacement
      let replaced = trimmed;
      // Replacements for famous prefixes
      replaced = replaced.replace(/\bThe Grand Palace\b/gi, "พระบรมมหาราชวัง");
      replaced = replaced.replace(/\bWat Phra Kaew\b/gi, "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)");
      replaced = replaced.replace(/\bWat Arun\b/gi, "วัดอรุณราชวราราม");
      replaced = replaced.replace(/\bWat Pho\b/gi, "วัดพระเชตุพน (วัดโพธิ์)");
      replaced = replaced.replace(/\bChatuchak Weekend Market\b/gi, "ตลาดนัดจตุจักร");
      replaced = replaced.replace(/\bKhao San Road\b/gi, "ถนนข้าวสาร");
      replaced = replaced.replace(/\bYaowarat\b/gi, "เยาวราช");
      replaced = replaced.replace(/\bChinatown\b/gi, "ไชน่าทาวน์");
      replaced = replaced.replace(/\bLumphini Park\b/gi, "สวนลุมพินี");
      replaced = replaced.replace(/\bBenjakitti Park\b/gi, "สวนเบญจกิติ");
      replaced = replaced.replace(/\bMahanakhon Skywalk\b/gi, "มหานคร สกายวอล์ค");
      replaced = replaced.replace(/\bJim Thompson House\b/gi, "บ้านจิม ทอมป์สัน");
      replaced = replaced.replace(/\bErawan Shrine\b/gi, "ศาลท้าวมหาพรหม");
      replaced = replaced.replace(/\bSafari World\b/gi, "ซาฟารีเวิลด์");
      replaced = replaced.replace(/\bDream World\b/gi, "ดรีมเวิลด์");
      replaced = replaced.replace(/\bFloating Market\b/gi, "ตลาดน้ำ");
      replaced = replaced.replace(/\bNight Market\b/gi, "ตลาดนัดกลางคืน");
      replaced = replaced.replace(/\bWalking Street\b/gi, "ถนนคนเดิน");
      replaced = replaced.replace(/\bNational Park\b/gi, "อุทยานแห่งชาติ");
      replaced = replaced.replace(/\bCentral Park\b/gi, "สวนสาธารณะเซ็นทรัลพาร์ก");
      replaced = replaced.replace(/\bBotanical Garden\b/gi, "สวนพฤกษศาสตร์");
      replaced = replaced.replace(/\bArt Museum\b/gi, "พิพิธภัณฑ์ศิลปะ");
      replaced = replaced.replace(/\bMuseum\b/gi, "พิพิธภัณฑ์");
      replaced = replaced.replace(/\bViewpoint\b/gi, "จุดชมวิว");
      replaced = replaced.replace(/\bSkywalk\b/gi, "สกายวอล์ก");
      replaced = replaced.replace(/\bObservation Deck\b/gi, "จุดชมวิวบนตึกสูง");
      replaced = replaced.replace(/\bHotel\b/gi, "โรงแรม");
      replaced = replaced.replace(/\bResort\b/gi, "รีสอร์ท");
      replaced = replaced.replace(/\bHostel\b/gi, "โฮสเทล");
      replaced = replaced.replace(/\bTemple\b/gi, "วัด");
      replaced = replaced.replace(/\bWat\s+/gi, "วัด");
      replaced = replaced.replace(/\bBeach\b/gi, "หาด");
      replaced = replaced.replace(/\bIsland\b/gi, "เกาะ");
      replaced = replaced.replace(/\bWaterfall\b/gi, "น้ำตก");
      replaced = replaced.replace(/\bMountain\b/gi, "ภูเขา");
      replaced = replaced.replace(/\bStreet Food\b/gi, "สตรีทฟู้ด");
      replaced = replaced.replace(/\bRestaurant\b/gi, "ร้านอาหาร");
      replaced = replaced.replace(/\bCafe\b/gi, "คาเฟ่");

      result = replaced;
    }
  } else {
    // Target is English
    // 2. Direct dictionary match
    if (DICTIONARY_TH_TO_EN[normalized]) {
      result = DICTIONARY_TH_TO_EN[normalized];
    } else {
      // 3. Thai Prefixes / Terms replacement
      let replaced = trimmed;
      replaced = replaced.replace(/^พระบรมมหาราชวัง\s*/, "The Grand Palace ");
      replaced = replaced.replace(/^วัดพระศรีรัตนศาสดาราม\s*/, "Wat Phra Kaew ");
      replaced = replaced.replace(/^วัดพระแก้ว\s*/, "Wat Phra Kaew ");
      replaced = replaced.replace(/^วัดอรุณราชวราราม\s*/, "Wat Arun ");
      replaced = replaced.replace(/^วัดอรุณ\s*/, "Wat Arun ");
      replaced = replaced.replace(/^วัดโพธิ์\s*/, "Wat Pho ");
      replaced = replaced.replace(/^วัดพระเชตุพน\s*/, "Wat Pho ");
      replaced = replaced.replace(/^ตลาดนัดจตุจักร\s*/, "Chatuchak Weekend Market ");
      replaced = replaced.replace(/^ถนนข้าวสาร\s*/, "Khao San Road ");
      replaced = replaced.replace(/^ถนนเยาวราช\s*/, "Yaowarat Road ");
      replaced = replaced.replace(/^เยาวราช\s*/, "Yaowarat Chinatown ");
      replaced = replaced.replace(/^สวนลุมพินี\s*/, "Lumphini Park ");
      replaced = replaced.replace(/^สวนเบญจกิติ\s*/, "Benjakitti Park ");
      replaced = replaced.replace(/^โรงแรม\s*/, "Hotel ");
      replaced = replaced.replace(/^รีสอร์ท\s*/, "Resort ");
      replaced = replaced.replace(/^โฮสเทล\s*/, "Hostel ");
      replaced = replaced.replace(/^วัด\s*/, "Wat ");
      replaced = replaced.replace(/^ศาลเจ้า\s*/, "Shrine ");
      replaced = replaced.replace(/^พระราชวัง\s*/, "Palace ");
      replaced = replaced.replace(/^พิพิธภัณฑ์\s*/, "Museum ");
      replaced = replaced.replace(/^อุทยานแห่งชาติ\s*/, "National Park ");
      replaced = replaced.replace(/^สวนสาธารณะ\s*/, "Public Park ");
      replaced = replaced.replace(/^ตลาดนัดกลางคืน\s*/, "Night Market ");
      replaced = replaced.replace(/^ตลาดโต้รุ่ง\s*/, "Night Market ");
      replaced = replaced.replace(/^ตลาดน้ำ\s*/, "Floating Market ");
      replaced = replaced.replace(/^ตลาด\s*/, "Market ");
      replaced = replaced.replace(/^ถนนคนเดิน\s*/, "Walking Street ");
      replaced = replaced.replace(/^หาด\s*/, "Beach ");
      replaced = replaced.replace(/^ชายหาด\s*/, "Beach ");
      replaced = replaced.replace(/^เกาะ\s*/, "Koh (Island) ");
      replaced = replaced.replace(/^น้ำตก\s*/, "Waterfall ");
      replaced = replaced.replace(/^จุดชมวิว\s*/, "Viewpoint ");
      replaced = replaced.replace(/^สกายวอล์ก\s*/, "Skywalk ");
      replaced = replaced.replace(/^สกายวอล์ค\s*/, "Skywalk ");
      replaced = replaced.replace(/^ร้านอาหาร\s*/, "Restaurant ");
      replaced = replaced.replace(/^ร้านกาแฟ\s*/, "Cafe ");
      replaced = replaced.replace(/^คาเฟ่\s*/, "Cafe ");

      result = replaced;
    }
  }

  memoryTranslationCache.set(cacheKey, result);
  return result;
}

// Background queue to avoid overwhelming the translation API
const pendingTranslationQueue = new Set<string>();

/**
 * Asynchronous translation with offline dictionary fallback & fail-safe.
 */
export async function translateTextAsync(text: string, targetLang: "th" | "en"): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const isThai = hasThaiScript(trimmed);
  if (targetLang === "th" && isThai) return trimmed;
  if (targetLang === "en" && !isThai) return trimmed;

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) {
    return memoryTranslationCache.get(cacheKey)!;
  }

  // Check localStorage if available
  try {
    const saved = localStorage.getItem(`trans_${cacheKey}`);
    if (saved) {
      memoryTranslationCache.set(cacheKey, saved);
      return saved;
    }
  } catch (e) {
    // Ignore storage errors
  }

  // Fast path: Try dictionary sync first
  const syncResult = translateTextSync(trimmed, targetLang);
  if (syncResult !== trimmed && (targetLang === "th" ? hasThaiScript(syncResult) : !hasThaiScript(syncResult))) {
    memoryTranslationCache.set(cacheKey, syncResult);
    return syncResult;
  }

  // Avoid duplicate network requests for the same text
  if (pendingTranslationQueue.has(cacheKey)) {
    return syncResult || trimmed;
  }
  pendingTranslationQueue.add(cacheKey);

  // Try Google Translate API (resilient with timeout)
  try {
    const sl = targetLang === "th" ? "en" : "th";
    const tl = targetLang;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const translated = data?.[0]?.[0]?.[0];
      if (typeof translated === "string" && translated.trim().length > 0) {
        const clean = translated.trim();
        memoryTranslationCache.set(cacheKey, clean);
        try {
          localStorage.setItem(`trans_${cacheKey}`, clean);
        } catch (e) {}
        pendingTranslationQueue.delete(cacheKey);
        notifyTranslationUpdates();
        return clean;
      }
    }
  } catch (err) {
    // Fail-safe: fallback to syncResult or original
  } finally {
    pendingTranslationQueue.delete(cacheKey);
  }

  return syncResult || trimmed;
}

/**
 * Enqueue background async translation for smooth updates.
 */
export function queueAsyncTranslation(text: string, targetLang: "th" | "en"): void {
  if (!text || typeof text !== "string") return;
  const trimmed = text.trim();
  if (!trimmed) return;

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) return;

  translateTextAsync(trimmed, targetLang).catch(() => {});
}
