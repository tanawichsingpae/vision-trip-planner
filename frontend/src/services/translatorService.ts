/**
 * Translator Service — Robust bilingual (Thai <-> English) dictionary,
 * script detection, and resilient translation cache.
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";

// Common Thai <-> English travel, place, and accommodation vocabulary
export const DICTIONARY_EN_TO_TH: Record<string, string> = {
  // Accommodations
  "hotel": "โรงแรม",
  "resort": "รีสอร์ท",
  "hostel": "โฮสเทล",
  "inn": "อินน์",
  "guesthouse": "เกสต์เฮาส์",
  "boutique hotel": "โรงแรมบูทีค",
  "luxury hotel": "โรงแรมหรู",
  "check in": "เช็คอิน",
  "check out": "เช็คเอาท์",
  "accommodation": "ที่พัก",
  "stay": "ที่พัก",

  // Attractions & Places
  "temple": "วัด",
  "wat": "วัด",
  "shrine": "ศาลเจ้า",
  "palace": "พระราชวัง",
  "grand palace": "พระบรมมหาราชวัง",
  "museum": "พิพิธภัณฑ์",
  "national park": "อุทยานแห่งชาติ",
  "park": "สวนสาธารณะ",
  "central park": "สวนสาธารณะใจกลางเมือง",
  "beach": "ชายหาด",
  "island": "เกาะ",
  "waterfall": "น้ำตก",
  "mountain": "ภูเขา",
  "peak": "ยอดเขา",
  "viewpoint": "จุดชมวิว",
  "skywalk": "สกายวอล์ก",
  "observation deck": "จุดชมวิวบนตึกสูง",
  "night market": "ตลาดนัดกลางคืน",
  "floating market": "ตลาดน้ำ",
  "market": "ตลาด",
  "walking street": "ถนนคนเดิน",
  "shopping mall": "ศูนย์การค้า",
  "arcade": "ศูนย์รวมร้านค้า",
  "street food": "สตรีทฟู้ด",
  "restaurant": "ร้านอาหาร",
  "eatery": "ร้านอาหารท้องถิ่น",
  "cafe": "คาเฟ่",
  "coffee shop": "ร้านกาแฟ",
  "bar": "บาร์",
  "rooftop bar": "รูฟท็อปบาร์",
  "pub": "ผับ",
  "spa": "สปา",
  "massage": "นวดแผนไทย",
  "hot spring": "บ่อน้ำพุร้อน",
  "onsen": "ออนเซ็น",
  "theme park": "สวนสนุก",
  "water park": "สวนน้ำ",
  "aquarium": "พิพิธภัณฑ์สัตว์น้ำ",
  "zoo": "สวนสัตว์",
  "safari": "ซาฟารี",

  // Common activities & actions
  "sightseeing": "ท่องเที่ยวชมเมือง",
  "dinner": "อาหารค่ำ",
  "lunch": "อาหารกลางวัน",
  "breakfast": "อาหารเช้า",
  "sunset": "ชมพระอาทิตย์ตก",
  "sunrise": "ชมพระอาทิตย์ขึ้น",
  "boat tour": "ล่องเรือเที่ยวชม",
  "cruise": "ล่องเรือสำราญ",
  "walking tour": "เดินเที่ยวชมเมือง",
  "street food tour": "ตระเวนชิมสตรีทฟู้ด",
  "cooking class": "คลาสเรียนทำอาหาร",
  "night tour": "ทัวร์ชมเมืองยามค่ำคืน",
  "souvenir shopping": "ช้อปปิ้งของฝาก",

  // Top Thailand & International Landmarks
  "the grand palace": "พระบรมมหาราชวัง",
  "wat phra kaew": "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
  "temple of the emerald buddha": "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
  "wat arun": "วัดอรุณราชวราราม",
  "temple of dawn": "วัดอรุณราชวราราม",
  "wat pho": "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)",
  "temple of the reclining buddha": "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)",
  "chatuchak weekend market": "ตลาดนัดจตุจักร",
  "chatuchak": "จตุจักร",
  "iconsiam": "ไอคอนสยาม",
  "siam paragon": "สยามพารากอน",
  "centralworld": "เซ็นทรัลเวิลด์",
  "mbk center": "เอ็มบีเค เซ็นเตอร์ (มาบุญครอง)",
  "terminal 21": "เทอร์มินอล 21",
  "asiatique": "เอเชียทีค",
  "asiatique the riverfront": "เอเชียทีค เดอะ ริเวอร์ฟรอนต์",
  "khao san road": "ถนนข้าวสาร",
  "khaosan road": "ถนนข้าวสาร",
  "jim thompson house": "บ้านจิม ทอมป์สัน",
  "lumphini park": "สวนลุมพินี",
  "bangkok art and culture centre": "หอศิลปวัฒนธรรมแห่งกรุงเทพฯ",
  "bangkok art & culture centre": "หอศิลปวัฒนธรรมแห่งกรุงเทพฯ",
  "bangkok cultural center": "หอศิลปวัฒนธรรมแห่งกรุงเทพฯ",
  "bacc": "หอศิลปวัฒนธรรมแห่งกรุงเทพฯ",
  "benjakitti park": "สวนเบญจกิติ",
  "benjakitti forest park": "สวนเบญจกิติ",
  "yaowarat": "เยาวราช (ไชน่าทาวน์)",
  "yaowarat road": "ถนนเยาวราช",
  "chinatown": "เยาวราช (ไชน่าทาวน์)",
  "wat traimit": "วัดไตรมิตรวิทยาราม",
  "wat saket": "วัดสระเกศ (ภูเขาทอง)",
  "golden mount": "ภูเขาทอง (วัดสระเกศ)",
  "mahanakhon skywalk": "มหานคร สกายวอล์ก",
  "king power mahanakhon": "คิง เพาเวอร์ มหานคร",
  "safari world": "ซาฟารีเวิลด์",
  "dream world": "ดรีมเวิลด์",
  "siam amazing park": "สยามอะเมซิ่งพาร์ค",
  "wat rong khun": "วัดร่องขุ่น",
  "white temple": "วัดร่องขุ่น",
  "wat rong suea ten": "วัดร่องเสือเต้น",
  "blue temple": "วัดร่องเสือเต้น",
  "doi suthep": "ดอยสุเทพ",
  "wat phra that doi suthep": "วัดพระธาตุดอยสุเทพ",
  "chiang mai night bazaar": "เชียงใหม่ไนท์บาซาร์",
  "tha phae gate": "ประตูท่าแพ",
  "thapae gate": "ประตูท่าแพ",
  "big buddha phuket": "พระใหญ่ภูเก็ต",
  "promthep cape": "แหลมพรหมเทพ",
  "patong beach": "หาดป่าตอง",
  "kata beach": "หาดกะตะ",
  "karon beach": "หาดกะรน",
  "phi phi islands": "หมู่เกาะพีพี",
  "phi phi island": "เกาะพีพี",
  "maya bay": "อ่าวมาหยา",
  "james bond island": "เกาะเจมส์บอนด์ (เกาะเขาตะปู)",
  "railay beach": "หาดไร่เลย์",
  "erawan waterfall": "น้ำตกเอราวัณ",
  "bridge over the river kwai": "สะพานข้ามแม่น้ำแคว",
  "ayutthaya historical park": "อุทยานประวัติศาสตร์พระนครศรีอยุธยา",
  "wat mahathat": "วัดมหาธาตุ",
  "wat chaiwatthanaram": "วัดไชยวัฒนาราม",
  "wat yai chai mongkhon": "วัดใหญ่ชัยมงคล",
  "nong nooch tropical garden": "สวนนงนุช",
  "sanctuary of truth": "ปราสาทสัจธรรม",
  "pattaya floating market": "ตลาดน้ำ 4 ภาค พัทยา",
  "damnoen saduak floating market": "ตลาดน้ำดำเนินสะดวก",
  "amphawa floating market": "ตลาดน้ำอัมพวา",
  "jodd fairs": "จ๊อดแฟร์",

  // Top Asian & International Landmarks
  "senso-ji": "วัดเซ็นโซจิ (อาซากุสะ)",
  "sensoji": "วัดเซ็นโซจิ (อาซากุสะ)",
  "senso-ji temple": "วัดเซ็นโซจิ (อาซากุสะ)",
  "sensoji temple": "วัดเซ็นโซจิ (อาซากุสะ)",
  "fushimi inari": "ศาลเจ้าฟูชิมิอินาริ",
  "fushimi inari taisha": "ศาลเจ้าฟูชิมิอินาริ",
  "fushimi inari shrine": "ศาลเจ้าฟูชิมิอินาริ",
  "kiyomizu-dera": "วัดคิโยมิซุ (วัดน้ำใส)",
  "kiyomizudera": "วัดคิโยมิซุ (วัดน้ำใส)",
  "kiyomizu-dera temple": "วัดคิโยมิซุ (วัดน้ำใส)",
  "kinkaku-ji": "วัดคินคะคุจิ (วัดทอง)",
  "kinkakuji": "วัดคินคะคุจิ (วัดทอง)",
  "kinkaku-ji temple": "วัดคินคะคุจิ (วัดทอง)",
  "tokyo tower": "โตเกียวทาวเวอร์",
  "tokyo skytree": "โตเกียวสกายทรี",
  "shibuya crossing": "ห้าแยกชิบูย่า",
  "shibuya sky": "ชิบูย่า สกาย",
  "dotonbori": "ย่านโดทงโบริ (โอซาก้า)",
  "osaka castle": "ปราสาทโอซาก้า",
  "meiji shrine": "ศาลเจ้าเมจิ",
  "arashiyama": "ป่าไผ่อาราชิยามะ",
  "arashiyama bamboo grove": "ป่าไผ่อาราชิยามะ",
  "nara park": "สวนกวางนารา",
  "universal studios japan": "ยูนิเวอร์แซล สตูดิโอส์ เจแปน",
  "tokyo disneyland": "โตเกียวดิสนีย์แลนด์",
  "tokyo disneysea": "โตเกียวดิสนีย์ซี",
  "mount fuji": "ภูเขาไฟฟูจิ",
  "mt fuji": "ภูเขาไฟฟูจิ",
  "lake kawaguchiko": "ทะเลสาบคาวากุจิโกะ",
  "forbidden city": "พระราชวังต้องห้าม (กู้กง)",
  "great wall of china": "กำแพงเมืองจีน",
  "mutianyu great wall": "กำแพงเมืองจีน ด่านมู่เถียนยวี่",
  "summer palace": "พระราชวังฤดูร้อนอี๋เหอหยวน",
  "terracotta army": "กองทัพทหารดินเผาซีอาน",
  "taipei 101": "ตึกไทเป 101",
  "victoria peak": "เดอะพีค (วิคตอเรียพีค)",
  "n seoul tower": "หอคอยเอ็นโซล (หอคอยนัมซาน)",
  "namsan tower": "หอคอยนัมซาน (เอ็นโซลทาวเวอร์)",
  "gyeongbokgung": "พระราชวังเคียงบก",
  "gyeongbokgung palace": "พระราชวังเคียงบก",
  "bukchon hanok village": "หมู่บ้านบุกชอนฮันอก",
  "myeongdong": "ย่านเมียงดง",
  "eiffel tower": "หอไอเฟล",
  "louvre museum": "พิพิธภัณฑ์ลูฟวร์",
  "colosseum": "โคลอสเซียม",
  "sagrada familia": "ซากราดา ฟามิเลีย",
  "statue of liberty": "เทพีเสรีภาพ",
  "times square": "ไทม์สแควร์",
  "big ben": "หอนาฬิกาบิ๊กเบน",
};

export const DICTIONARY_TH_TO_EN: Record<string, string> = {
  "โรงแรม": "Hotel",
  "รีสอร์ท": "Resort",
  "โฮสเทล": "Hostel",
  "เกสต์เฮาส์": "Guesthouse",
  "ที่พัก": "Accommodation",
  "เช็คอิน": "Check in",
  "เช็คเอาท์": "Check out",
  "วัด": "Wat (Temple)",
  "ศาลเจ้า": "Shrine",
  "พระราชวัง": "Palace",
  "พิพิธภัณฑ์": "Museum",
  "อุทยานแห่งชาติ": "National Park",
  "สวนสาธารณะ": "Public Park",
  "หาด": "Beach",
  "ชายหาด": "Beach",
  "เกาะ": "Island",
  "น้ำตก": "Waterfall",
  "ภูเขา": "Mountain",
  "จุดชมวิว": "Viewpoint",
  "สกายวอล์ก": "Skywalk",
  "ตลาดนัดกลางคืน": "Night Market",
  "ตลาดโต้รุ่ง": "Night Market",
  "ตลาดน้ำ": "Floating Market",
  "ตลาด": "Market",
  "ถนนคนเดิน": "Walking Street",
  "ห้างสรรพสินค้า": "Shopping Mall",
  "ศูนย์การค้า": "Shopping Mall",
  "ร้านอาหาร": "Restaurant",
  "ร้านกาแฟ": "Cafe",
  "คาเฟ่": "Cafe",
  "สปา": "Spa",
  "สวนสนุก": "Theme Park",
  "สวนน้ำ": "Water Park",
  "พิพิธภัณฑ์สัตว์น้ำ": "Aquarium",
  "สวนสัตว์": "Zoo",

  // Top Thailand Attractions in English
  "พระบรมมหาราชวัง": "The Grand Palace",
  "วัดพระแก้ว": "Wat Phra Kaew (Temple of the Emerald Buddha)",
  "วัดพระศรีรัตนศาสดาราม": "Wat Phra Si Rattana Satsadaram (Wat Phra Kaew)",
  "วัดอรุณ": "Wat Arun (Temple of Dawn)",
  "วัดอรุณราชวราราม": "Wat Arun (Temple of Dawn)",
  "วัดโพธิ์": "Wat Pho (Temple of the Reclining Buddha)",
  "วัดพระเชตุพนวิมลมังคลาราม": "Wat Phra Chetuphon (Wat Pho)",
  "ตลาดนัดจตุจักร": "Chatuchak Weekend Market",
  "จตุจักร": "Chatuchak",
  "ไอคอนสยาม": "ICONSIAM",
  "สยามพารากอน": "Siam Paragon",
  "เซ็นทรัลเวิลด์": "CentralWorld",
  "มาบุญครอง": "MBK Center",
  "เอ็มบีเค เซ็นเตอร์": "MBK Center",
  "เทอร์มินอล 21": "Terminal 21",
  "เอเชียทีค": "Asiatique The Riverfront",
  "เอเชียทีค เดอะ ริเวอร์ฟรอนต์": "Asiatique The Riverfront",
  "ถนนข้าวสาร": "Khao San Road",
  "บ้านจิม ทอมป์สัน": "Jim Thompson House",
  "สวนลุมพินี": "Lumphini Park",
  "สวนเบญจกิติ": "Benjakitti Forest Park",
  "เยาวราช": "Yaowarat (Chinatown)",
  "ถนนเยาวราช": "Yaowarat Road",
  "วัดไตรมิตร": "Wat Traimit",
  "วัดไตรมิตรวิทยาราม": "Wat Traimit",
  "วัดสระเกศ": "Wat Saket (Golden Mount)",
  "ภูเขาทอง": "Golden Mount (Wat Saket)",
  "มหานคร สกายวอล์ก": "Mahanakhon SkyWalk",
  "ซาฟารีเวิลด์": "Safari World",
  "ดรีมเวิลด์": "Dream World",
  "สยามอะเมซิ่งพาร์ค": "Siam Amazing Park",
  "วัดร่องขุ่น": "Wat Rong Khun (White Temple)",
  "วัดร่องเสือเต้น": "Wat Rong Suea Ten (Blue Temple)",
  "ดอยสุเทพ": "Doi Suthep",
  "วัดพระธาตุดอยสุเทพ": "Wat Phra That Doi Suthep",
  "เชียงใหม่ไนท์บาซาร์": "Chiang Mai Night Bazaar",
  "ประตูท่าแพ": "Tha Phae Gate",
  "พระใหญ่ภูเก็ต": "Big Buddha Phuket",
  "แหลมพรหมเทพ": "Promthep Cape",
  "หาดป่าตอง": "Patong Beach",
  "หาดกะตะ": "Kata Beach",
  "หาดกะรน": "Karon Beach",
  "เกาะพีพี": "Phi Phi Islands",
  "หมู่เกาะพีพี": "Phi Phi Islands",
  "อ่าวมาหยา": "Maya Bay",
  "เกาะเจมส์บอนด์": "James Bond Island",
  "หาดไร่เลย์": "Railay Beach",
  "น้ำตกเอราวัณ": "Erawan Waterfall",
  "สะพานข้ามแม่น้ำแคว": "Bridge over the River Kwai",
  "อุทยานประวัติศาสตร์พระนครศรีอยุธยา": "Ayutthaya Historical Park",
  "วัดมหาธาตุ": "Wat Mahathat",
  "วัดไชยวัฒนาราม": "Wat Chaiwatthanaram",
  "วัดใหญ่ชัยมงคล": "Wat Yai Chai Mongkhon",
  "สวนนงนุช": "Nong Nooch Tropical Garden",
  "ปราสาทสัจธรรม": "Sanctuary of Truth",
  "ตลาดน้ำ 4 ภาค พัทยา": "Pattaya Floating Market",
  "ตลาดน้ำดำเนินสะดวก": "Damnoen Saduak Floating Market",
  "ตลาดน้ำอัมพวา": "Amphawa Floating Market",
  "จ๊อดแฟร์": "Jodd Fairs",
  "หอศิลปวัฒนธรรมแห่งกรุงเทพมหานคร": "Bangkok Art and Culture Centre",
  "หอศิลปวัฒนธรรมแห่งกรุงเทพฯ": "Bangkok Art and Culture Centre",
  "หอศิลปวัฒนธรรมแห่งกรุงเทพ": "Bangkok Art and Culture Centre",
  "หอศิลป์กรุงเทพ": "Bangkok Art and Culture Centre",
  "หอศิลป์กทม": "Bangkok Art and Culture Centre",

  // Top International Landmarks to English
  "วัดเซ็นโซจิ": "Senso-ji Temple",
  "วัดเซ็นโซจิ (อาซากุสะ)": "Senso-ji Temple (Asakusa)",
  "ศาลเจ้าฟูชิมิอินาริ": "Fushimi Inari Taisha",
  "วัดคิโยมิซุ": "Kiyomizu-dera Temple",
  "วัดคิโยมิซุ (วัดน้ำใส)": "Kiyomizu-dera Temple",
  "วัดคินคะคุจิ": "Kinkaku-ji (Golden Pavilion)",
  "วัดคินคะคุจิ (วัดทอง)": "Kinkaku-ji (Golden Pavilion)",
  "โตเกียวทาวเวอร์": "Tokyo Tower",
  "โตเกียวสกายทรี": "Tokyo Skytree",
  "ห้าแยกชิบูย่า": "Shibuya Crossing",
  "ชิบูย่า สกาย": "Shibuya Sky",
  "โดทงโบริ": "Dotonbori",
  "ปราสาทโอซาก้า": "Osaka Castle",
  "ศาลเจ้าเมจิ": "Meiji Shrine",
  "ป่าไผ่อาราชิยามะ": "Arashiyama Bamboo Grove",
  "สวนกวางนารา": "Nara Park",
  "ภูเขาไฟฟูจิ": "Mount Fuji",
  "ทะเลสาบคาวากุจิโกะ": "Lake Kawaguchiko",
  "พระราชวังต้องห้าม": "The Forbidden City",
  "กำแพงเมืองจีน": "Great Wall of China",
  "หอคอยนัมซาน": "N Seoul Tower (Namsan Tower)",
  "พระราชวังเคียงบก": "Gyeongbokgung Palace",
  "หอไอเฟล": "Eiffel Tower",
  "พิพิธภัณฑ์ลูฟวร์": "Louvre Museum",
  "โคลอสเซียม": "Colosseum",
};

// CJK & East Asian (Chinese / Japanese / Korean) direct mappings for instant local resolution
export const DICTIONARY_CJK_TO_TH: Record<string, string> = {
  // Japanese
  "浅草寺": "วัดเซ็นโซจิ (อาซากุสะ)",
  "伏見稲荷大社": "ศาลเจ้าฟูชิมิอินาริ",
  "清水寺": "วัดคิโยมิซุ (วัดน้ำใส)",
  "金閣寺": "วัดคินคะคุจิ (วัดทอง)",
  "東京タワー": "โตเกียวทาวเวอร์",
  "大阪城": "ปราสาทโอซาก้า",
  "富士山": "ภูเขาไฟฟูจิ",
  "道頓堀": "โดทงโบริ",
  "嵐山": "อาราชิยามะ",

  // Chinese & Taiwanese
  "故宫": "พระราชวังต้องห้าม",
  "故宮": "พระราชวังต้องห้าม",
  "万里长城": "กำแพงเมืองจีน",
  "萬里長城": "กำแพงเมืองจีน",
  "慕田峪长城": "กำแพงเมืองจีน ด่านมู่เถียนยวี่",
  "颐和园": "พระราชวังฤดูร้อนอี๋เหอหยวน",
  "九份": "จิ่วเฟิ่น (ไต้หวัน)",
  "台北101": "ไทเป 101",
  "士林夜市": "ตลาดกลางคืนซื่อหลิน",

  // Korean
  "경복궁": "พระราชวังเคียงบก",
  "N서울타워": "เอ็นโซลทาวเวอร์",
  "남산타워": "หอคอยนัมซาน",
  "남이섬": "เกาะนามิ",
  "명동": "เมียงดง",
  "홍대": "ฮงแด",
  "해운대": "หาดแฮอุนแด",
  "북촌한옥마을": "หมู่บ้านบุกชอนฮันอก",
  "감천문화마ล": "หมู่บ้านวัฒนธรรมคัมชอน",
  "감천문화마을": "หมู่บ้านวัฒนธรรมคัมชอน",
};

export const DICTIONARY_CJK_TO_EN: Record<string, string> = {
  // Japanese
  "浅草寺": "Senso-ji Temple",
  "伏見稲荷大社": "Fushimi Inari Taisha",
  "清水寺": "Kiyomizu-dera Temple",
  "金閣寺": "Kinkaku-ji (Golden Pavilion)",
  "東京タワー": "Tokyo Tower",
  "大阪城": "Osaka Castle",
  "富士山": "Mount Fuji",
  "道頓堀": "Dotonbori",
  "嵐山": "Arashiyama",

  // Chinese & Taiwanese
  "故宫": "The Forbidden City",
  "故宮": "The Forbidden City",
  "万里长城": "Great Wall of China",
  "萬里長城": "Great Wall of China",
  "慕田峪长城": "Mutianyu Great Wall",
  "颐和园": "Summer Palace",
  "九份": "Jiufen",
  "台北101": "Taipei 101",
  "士林夜市": "Shilin Night Market",

  // Korean
  "경복궁": "Gyeongbokgung Palace",
  "N서울타워": "N Seoul Tower",
  "남산타워": "Namsan Tower",
  "남이섬": "Nami Island",
  "명동": "Myeongdong",
  "홍대": "Hongdae",
  "해운대": "Haeundae Beach",
  "북촌한옥마을": "Bukchon Hanok Village",
  "감천문화마ล": "Gamcheon Culture Village",
  "감천문화마을": "Gamcheon Culture Village",
};

// In-memory translation cache to avoid repeated translations
const memoryTranslationCache = new Map<string, string>();

/**
 * Checks if a string contains Thai characters
 */
export function hasThaiScript(text?: string | null): boolean {
  if (!text) return false;
  return /[\u0E00-\u0E7F]/.test(text);
}

/**
 * Checks if a string contains Latin / English alphabet characters
 */
export function hasLatinScript(text?: string | null): boolean {
  if (!text) return false;
  return /[a-zA-Z]/.test(text);
}

/**
 * Checks if a string contains CJK ideographs or Japanese Kana (Chinese / Japanese scripts)
 */
export function hasCJKScript(text?: string | null): boolean {
  if (!text) return false;
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

/**
 * Checks if a string contains Korean Hangul characters
 */
export function hasHangulScript(text?: string | null): boolean {
  if (!text) return false;
  return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
}

/**
 * Checks if a string is purely written in the target language's natural script.
 * - 'th': contains Thai script, and contains NO Latin, CJK, or Hangul letters.
 * - 'en': contains Latin script, and contains NO Thai, CJK, or Hangul letters.
 */
export function isPureTargetScript(text?: string | null, targetLang?: "th" | "en"): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (targetLang === "th") {
    return hasThaiScript(trimmed) && !hasLatinScript(trimmed) && !hasCJKScript(trimmed) && !hasHangulScript(trimmed);
  }
  if (targetLang === "en") {
    return hasLatinScript(trimmed) && !hasThaiScript(trimmed) && !hasCJKScript(trimmed) && !hasHangulScript(trimmed);
  }
  return false;
}

/**
 * Checks if a text requires localization for the given target language.
 */
export function needsTranslation(text?: string | null, targetLang?: "th" | "en"): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return !isPureTargetScript(trimmed, targetLang);
}

/**
 * Detects and extracts dual-language (Thai/English or CJK/English) components from compound strings.
 * Examples:
 * - "วัดพระแก้ว (Wat Phra Kaew)" -> { th: "วัดพระแก้ว", en: "Wat Phra Kaew" }
 * - "Wat Arun (วัดอรุณราชวราราม)" -> { th: "วัดอรุณราชวราราม", en: "Wat Arun" }
 * - "浅草寺 (Senso-ji Temple)" -> { th: "วัดเซ็นโซจิ (อาซากุสะ)", en: "Senso-ji Temple" }
 * - "ตลาดน้ำดำเนินสะดวก / Damnoen Saduak Floating Market" -> { th: "ตลาดน้ำดำเนินสะดวก", en: "Damnoen Saduak Floating Market" }
 * - "Grand Palace - พระบรมมหาราชวัง" -> { th: "พระบรมมหาราชวัง", en: "Grand Palace" }
 */
export function extractBilingualText(text?: string | null): { th?: string; en?: string } | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const hasThai = hasThaiScript(trimmed);
  const hasLatin = hasLatinScript(trimmed);
  const hasCJK = hasCJKScript(trimmed);

  // If text does not contain multiple distinct scripts, compound splitting is not applicable
  if (!((hasThai && hasLatin) || (hasCJK && hasLatin) || (hasThai && hasCJK))) return null;

  // 1. Parentheses format: "PartA (PartB)"
  const parenMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const partA = parenMatch[1].trim();
    const partB = parenMatch[2].trim();
    const aThai = hasThaiScript(partA);
    const bThai = hasThaiScript(partB);
    const aLatin = hasLatinScript(partA);
    const bLatin = hasLatinScript(partB);
    const aCJK = hasCJKScript(partA);
    const bCJK = hasCJKScript(partB);

    if (aThai && !aLatin && bLatin) {
      return { th: partA, en: partB };
    }
    if (aLatin && !aThai && bThai) {
      return { th: partB, en: partA };
    }
    if (aCJK && bLatin) {
      const thMatch = DICTIONARY_CJK_TO_TH[partA] || DICTIONARY_EN_TO_TH[partB.toLowerCase()];
      return { th: thMatch || undefined, en: partB };
    }
    if (aLatin && bCJK) {
      const thMatch = DICTIONARY_CJK_TO_TH[partB] || DICTIONARY_EN_TO_TH[partA.toLowerCase()];
      return { th: thMatch || undefined, en: partA };
    }
  }

  // 2. Delimiter formats: " / ", " - ", " | ", " • ", ", "
  const delimiters = [" / ", " - ", " | ", " • ", ", "];
  for (const delim of delimiters) {
    if (trimmed.includes(delim)) {
      const parts = trimmed.split(delim);
      if (parts.length === 2) {
        const partA = parts[0].trim();
        const partB = parts[1].trim();
        const aThai = hasThaiScript(partA);
        const bThai = hasThaiScript(partB);
        const aLatin = hasLatinScript(partA);
        const bLatin = hasLatinScript(partB);
        const aCJK = hasCJKScript(partA);
        const bCJK = hasCJKScript(partB);

        if (aThai && !aLatin && bLatin) {
          return { th: partA, en: partB };
        }
        if (aLatin && !aThai && bThai) {
          return { th: partB, en: partA };
        }
        if (aCJK && bLatin) {
          const thMatch = DICTIONARY_CJK_TO_TH[partA] || DICTIONARY_EN_TO_TH[partB.toLowerCase()];
          return { th: thMatch || undefined, en: partB };
        }
        if (aLatin && bCJK) {
          const thMatch = DICTIONARY_CJK_TO_TH[partB] || DICTIONARY_EN_TO_TH[partA.toLowerCase()];
          return { th: thMatch || undefined, en: partA };
        }
      }
    }
  }

  return null;
}

/**
 * Normalizes string for dictionary lookup
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().trim();
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

  // 0. Dual language compound string check (e.g. "วัดพระแก้ว (Wat Phra Kaew)" or "浅草寺 (Senso-ji)")
  const bilingual = extractBilingualText(trimmed);
  if (bilingual) {
    if (targetLang === "th" && bilingual.th) {
      memoryTranslationCache.set(cacheKey, bilingual.th);
      return bilingual.th;
    }
    if (targetLang === "en" && bilingual.en) {
      memoryTranslationCache.set(cacheKey, bilingual.en);
      return bilingual.en;
    }
  }

  // Already in pure target script check
  if (isPureTargetScript(trimmed, targetLang)) return trimmed;

  let result = trimmed;
  const lower = normalizeKey(trimmed);

  if (targetLang === "th") {
    // 1. Direct dictionary match (English -> Thai or CJK -> Thai)
    if (DICTIONARY_EN_TO_TH[lower]) {
      result = DICTIONARY_EN_TO_TH[lower];
    } else if (DICTIONARY_CJK_TO_TH[trimmed]) {
      result = DICTIONARY_CJK_TO_TH[trimmed];
    } else if (DICTIONARY_CJK_TO_TH[lower]) {
      result = DICTIONARY_CJK_TO_TH[lower];
    }
    // 2. Hotel Check-in / Check-out patterns
    else if (/^check\s*in:?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^check\s*in:?\s*(.*)$/i);
      const place = match?.[1] ? translateTextSync(match[1], "th") : "";
      result = place ? `เช็คอิน: ${place}` : "เช็คอินเข้าที่พัก";
    } else if (/^check\s*out:?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^check\s*out:?\s*(.*)$/i);
      const place = match?.[1] ? translateTextSync(match[1], "th") : "";
      result = place ? `เช็คเอาท์: ${place}` : "เช็คเอาท์จากที่พัก";
    }
    // 3. Common English prefixes translation (only when matching at start of string)
    else if (/^(Hotel|Resort|Hostel|Temple|Museum|Night Market|Market|Beach|Viewpoint|Skywalk)\s+/i.test(trimmed)) {
      let replaced = trimmed;
      replaced = replaced.replace(/^Hotel\s+/i, "โรงแรม ");
      replaced = replaced.replace(/^Resort\s+/i, "รีสอร์ท ");
      replaced = replaced.replace(/^Hostel\s+/i, "โฮสเทล ");
      replaced = replaced.replace(/^Temple\s+(?:of\s+)?/i, "วัด ");
      replaced = replaced.replace(/^Museum\s+(?:of\s+)?/i, "พิพิธภัณฑ์ ");
      replaced = replaced.replace(/^Night\s+Market\s+/i, "ตลาดนัดกลางคืน ");
      replaced = replaced.replace(/^Market\s+/i, "ตลาด ");
      replaced = replaced.replace(/^Beach\s+/i, "หาด ");
      replaced = replaced.replace(/^Viewpoint\s+/i, "จุดชมวิว ");
      replaced = replaced.replace(/^Skywalk\s+/i, "สกายวอล์ก ");
      result = replaced;
    }
  } else {
    // Target is English
    // 1. Direct dictionary match (Thai -> English or CJK -> English)
    if (DICTIONARY_TH_TO_EN[lower]) {
      result = DICTIONARY_TH_TO_EN[lower];
    } else if (DICTIONARY_TH_TO_EN[trimmed]) {
      result = DICTIONARY_TH_TO_EN[trimmed];
    } else if (DICTIONARY_CJK_TO_EN[trimmed]) {
      result = DICTIONARY_CJK_TO_EN[trimmed];
    } else if (DICTIONARY_CJK_TO_EN[lower]) {
      result = DICTIONARY_CJK_TO_EN[lower];
    }
    // 2. Thai Check-in / Check-out patterns
    else if (/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^(เช็คอิน|เช็คอินเข้าที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      result = place ? `Check in: ${place}` : "Check in to hotel";
    } else if (/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i.test(trimmed)) {
      const match = trimmed.match(/^(เช็คเอาท์|เช็คเอาต์|เช็คเอาต์จากที่พัก):?\s*(.*)$/i);
      const place = match?.[2] ? translateTextSync(match[2], "en") : "";
      result = place ? `Check out: ${place}` : "Check out from hotel";
    }
    // 3. Common Thai prefixes translation (only at start of string)
    else if (/^(โรงแรม|รีสอร์ท|วัด|ตลาดนัดกลางคืน|ตลาด|หาด|จุดชมวิว)\s*/.test(trimmed)) {
      let replaced = trimmed;
      replaced = replaced.replace(/^โรงแรม\s*/, "Hotel ");
      replaced = replaced.replace(/^รีสอร์ท\s*/, "Resort ");
      replaced = replaced.replace(/^วัด\s*/, "Wat ");
      replaced = replaced.replace(/^ตลาดนัดกลางคืน\s*/, "Night Market ");
      replaced = replaced.replace(/^ตลาด\s*/, "Market ");
      replaced = replaced.replace(/^หาด\s*/, "Beach ");
      replaced = replaced.replace(/^จุดชมวิว\s*/, "Viewpoint ");
      result = replaced;
    }
  }

  memoryTranslationCache.set(cacheKey, result);
  return result;
}

/**
 * AI-powered translation for individual text (place name or description).
 * Uses the existing backend /ai endpoint with resilient fail-safe and caching.
 */
export async function translateWithAI(text: string, targetLang: "th" | "en"): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (isPureTargetScript(trimmed, targetLang)) return trimmed;

  const cacheKey = `${targetLang}:${trimmed}`;
  if (memoryTranslationCache.has(cacheKey)) {
    return memoryTranslationCache.get(cacheKey)!;
  }
  try {
    const saved = localStorage.getItem(`trans_${cacheKey}`);
    if (saved) {
      memoryTranslationCache.set(cacheKey, saved);
      return saved;
    }
  } catch {}

  const targetLangName = targetLang === "th" ? "Thai (ภาษาไทย)" : "English";
  const prompt = `You are a professional travel translator. Translate this travel place name or itinerary activity description into natural, high quality ${targetLangName}.
Do not add explanations or notes. Return only a valid JSON object matching:
{"translation": "translated text here"}

Text:
${trimmed}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BACKEND_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        expect_json: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.text || "";
      let translated = "";
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          translated = parsed.translation || "";
        }
      } catch {
        translated = rawText.replace(/[\{\}\"]/g, "").trim();
      }

      if (translated && translated.trim().length > 0) {
        const clean = translated.trim();
        memoryTranslationCache.set(cacheKey, clean);
        try {
          localStorage.setItem(`trans_${cacheKey}`, clean);
        } catch {}
        return clean;
      }
    }
  } catch (err) {
    console.warn("[translatorService] AI translation fallback:", err);
  }

  // Fallback to sync translation
  return translateTextSync(trimmed, targetLang);
}

/**
 * Batch translate multiple items (titles or descriptions) in a single AI round trip.
 */
export async function batchTranslateWithAI(
  items: Array<{ id: string; text: string }>,
  targetLang: "th" | "en"
): Promise<Record<string, string>> {
  if (!items || items.length === 0) return {};

  const results: Record<string, string> = {};
  const toTranslate: Array<{ id: string; text: string }> = [];

  for (const item of items) {
    const trimmed = (item.text || "").trim();
    if (!trimmed) continue;
    if (isPureTargetScript(trimmed, targetLang)) {
      results[item.id] = trimmed;
      continue;
    }
    const cacheKey = `${targetLang}:${trimmed}`;
    if (memoryTranslationCache.has(cacheKey)) {
      results[item.id] = memoryTranslationCache.get(cacheKey)!;
      continue;
    }
    try {
      const saved = localStorage.getItem(`trans_${cacheKey}`);
      if (saved) {
        memoryTranslationCache.set(cacheKey, saved);
        results[item.id] = saved;
        continue;
      }
    } catch {}

    toTranslate.push({ id: item.id, text: trimmed });
  }

  if (toTranslate.length === 0) {
    return results;
  }

  const targetLangName = targetLang === "th" ? "Thai (ภาษาไทย)" : "English";
  const prompt = `You are a professional travel translator. Translate the following travel place names and activity descriptions into natural, polished ${targetLangName}.
Preserve travel clarity and context.
Respond ONLY with a valid JSON object matching this schema:
{
  "translations": {
    "<id>": "translated text"
  }
}

Items to translate:
${JSON.stringify(toTranslate, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${BACKEND_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        expect_json: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const transMap = parsed.translations || {};
        for (const it of toTranslate) {
          if (transMap[it.id] && typeof transMap[it.id] === "string") {
            const clean = transMap[it.id].trim();
            results[it.id] = clean;
            const cacheKey = `${targetLang}:${it.text}`;
            memoryTranslationCache.set(cacheKey, clean);
            try {
              localStorage.setItem(`trans_${cacheKey}`, clean);
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn("[translatorService] Batch AI translation failed, falling back to sync:", err);
  }

  // Fill in any remaining items with sync translation fallback
  for (const it of toTranslate) {
    if (!results[it.id]) {
      const fb = translateTextSync(it.text, targetLang);
      results[it.id] = fb;
    }
  }

  return results;
}

/**
 * Result structure for bilingual place resolution
 */
export interface BilingualPlaceResult {
  th: string;
  en: string;
}

/**
 * Batch resolve travel places into BOTH Thai and English in a single AI round trip.
 * Automatically saves both results to localStorage and in-memory caches so switching
 * languages in the UI happens instantly (0ms) without delay.
 */
export async function batchResolveBilingualPlacesAI(
  places: Array<{ id: string; name: string }>
): Promise<Record<string, BilingualPlaceResult>> {
  if (!places || places.length === 0) return {};

  const results: Record<string, BilingualPlaceResult> = {};
  const toQuery: Array<{ id: string; name: string }> = [];

  for (const item of places) {
    const raw = (item.name || "").trim();
    if (!raw) continue;

    // Fast check: Look in memory or localStorage cache for both languages
    const cachedTh = memoryTranslationCache.get(`th:${raw}`) || (typeof window !== "undefined" ? localStorage.getItem(`trans_th:${raw}`) : null);
    const cachedEn = memoryTranslationCache.get(`en:${raw}`) || (typeof window !== "undefined" ? localStorage.getItem(`trans_en:${raw}`) : null);

    const syncTh = (cachedTh && isPureTargetScript(cachedTh, "th")) ? cachedTh : translateTextSync(raw, "th");
    const syncEn = (cachedEn && isPureTargetScript(cachedEn, "en")) ? cachedEn : translateTextSync(raw, "en");

    const hasValidTh = isPureTargetScript(syncTh, "th") || (hasThaiScript(syncTh) && !hasCJKScript(syncTh));
    const hasValidEn = isPureTargetScript(syncEn, "en") || (hasLatinScript(syncEn) && !hasCJKScript(syncEn) && !hasThaiScript(syncEn));

    if (hasValidTh && hasValidEn) {
      results[item.id] = { th: syncTh, en: syncEn };
      memoryTranslationCache.set(`th:${raw}`, syncTh);
      memoryTranslationCache.set(`en:${raw}`, syncEn);
      continue;
    }

    toQuery.push({ id: item.id, name: raw });
  }

  if (toQuery.length === 0) {
    return results;
  }

  const prompt = `You are an expert multilingual travel translator.
For each travel place name (which may be in Japanese, Chinese, Korean, Thai, English, or other local scripts), provide BOTH an authentic, natural Thai name (th) and a clean, recognizable English name (en).
Keep well-known landmark names authentic and widely used in travel guides.
Do NOT add extra explanation or markdown formatting.
Respond ONLY with a valid JSON object matching this schema:
{
  "places": {
    "<id>": {
      "th": "ชื่อสถานที่ภาษาไทย",
      "en": "Place Name in English"
    }
  }
}

Places:
${JSON.stringify(toQuery, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${BACKEND_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        expect_json: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const placesMap = parsed.places || {};
        for (const it of toQuery) {
          const itemRes = placesMap[it.id];
          if (itemRes && typeof itemRes === "object") {
            const cleanTh = (itemRes.th || "").trim();
            const cleanEn = (itemRes.en || "").trim();
            if (cleanTh && cleanEn) {
              results[it.id] = { th: cleanTh, en: cleanEn };
              memoryTranslationCache.set(`th:${it.name}`, cleanTh);
              memoryTranslationCache.set(`en:${it.name}`, cleanEn);
              try {
                localStorage.setItem(`trans_th:${it.name}`, cleanTh);
                localStorage.setItem(`trans_en:${it.name}`, cleanEn);
              } catch {}
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[translatorService] batchResolveBilingualPlacesAI error:", err);
  }

  // Fallback for any unfulfilled items
  for (const it of toQuery) {
    if (!results[it.id]) {
      const fallbackTh = translateTextSync(it.name, "th");
      const fallbackEn = translateTextSync(it.name, "en");
      results[it.id] = { th: fallbackTh, en: fallbackEn };
    }
  }

  return results;
}

/**
 * Asynchronous translation with AI & offline dictionary fallback.
 */
export async function translateTextAsync(text: string, targetLang: "th" | "en"): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (isPureTargetScript(trimmed, targetLang)) return trimmed;

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
  } catch (e) {}

  // Fast path: Exact dictionary sync first
  const lower = normalizeKey(trimmed);
  if (targetLang === "th") {
    if (DICTIONARY_EN_TO_TH[lower]) {
      const res = DICTIONARY_EN_TO_TH[lower];
      memoryTranslationCache.set(cacheKey, res);
      return res;
    }
    if (DICTIONARY_CJK_TO_TH[trimmed]) {
      const res = DICTIONARY_CJK_TO_TH[trimmed];
      memoryTranslationCache.set(cacheKey, res);
      return res;
    }
  }
  if (targetLang === "en") {
    if (DICTIONARY_TH_TO_EN[lower]) {
      const res = DICTIONARY_TH_TO_EN[lower];
      memoryTranslationCache.set(cacheKey, res);
      return res;
    }
    if (DICTIONARY_CJK_TO_EN[trimmed]) {
      const res = DICTIONARY_CJK_TO_EN[trimmed];
      memoryTranslationCache.set(cacheKey, res);
      return res;
    }
  }

  // Primary: Use AI translation
  return await translateWithAI(trimmed, targetLang);
}
