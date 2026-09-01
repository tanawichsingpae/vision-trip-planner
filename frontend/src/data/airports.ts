export interface Airport {
  iata: string;
  nameTH: string;
  nameEN: string;
  city: string;
  cityEN: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
}

export const AIRPORTS: Airport[] = [
  // ─── Thailand ───────────────────────────────────────────────────────────────
  { iata: "BKK", nameTH: "สุวรรณภูมิ", nameEN: "Suvarnabhumi", city: "กรุงเทพฯ", cityEN: "Bangkok", country: "Thailand", flag: "🇹🇭", lat: 13.6811, lng: 100.7474 },
  { iata: "DMK", nameTH: "ดอนเมือง", nameEN: "Don Mueang", city: "กรุงเทพฯ", cityEN: "Bangkok", country: "Thailand", flag: "🇹🇭", lat: 13.9126, lng: 100.6067 },
  { iata: "CNX", nameTH: "เชียงใหม่", nameEN: "Chiang Mai", city: "เชียงใหม่", cityEN: "Chiang Mai", country: "Thailand", flag: "🇹🇭", lat: 18.7668, lng: 98.9628 },
  { iata: "HKT", nameTH: "ภูเก็ต", nameEN: "Phuket", city: "ภูเก็ต", cityEN: "Phuket", country: "Thailand", flag: "🇹🇭", lat: 8.1132, lng: 98.3167 },
  { iata: "HDY", nameTH: "หาดใหญ่", nameEN: "Hat Yai", city: "สงขลา", cityEN: "Songkhla", country: "Thailand", flag: "🇹🇭", lat: 6.9332, lng: 100.3930 },
  { iata: "UTH", nameTH: "อุดรธานี", nameEN: "Udon Thani", city: "อุดรธานี", cityEN: "Udon Thani", country: "Thailand", flag: "🇹🇭", lat: 17.3864, lng: 102.7883 },
  { iata: "KKC", nameTH: "ขอนแก่น", nameEN: "Khon Kaen", city: "ขอนแก่น", cityEN: "Khon Kaen", country: "Thailand", flag: "🇹🇭", lat: 16.4666, lng: 102.7836 },
  { iata: "UBP", nameTH: "อุบลราชธานี", nameEN: "Ubon Ratchathani", city: "อุบลราชธานี", cityEN: "Ubon Ratchathani", country: "Thailand", flag: "🇹🇭", lat: 15.2513, lng: 104.8701 },
  { iata: "CEI", nameTH: "เชียงราย", nameEN: "Mae Fah Luang", city: "เชียงราย", cityEN: "Chiang Rai", country: "Thailand", flag: "🇹🇭", lat: 19.9527, lng: 99.8828 },
  { iata: "USM", nameTH: "สมุย", nameEN: "Samui", city: "สุราษฎร์ธานี", cityEN: "Surat Thani", country: "Thailand", flag: "🇹🇭", lat: 9.5479, lng: 100.0630 },
  { iata: "NST", nameTH: "นครศรีธรรมราช", nameEN: "Nakhon Si Thammarat", city: "นครศรีธรรมราช", cityEN: "Nakhon Si Thammarat", country: "Thailand", flag: "🇹🇭", lat: 8.5396, lng: 99.9447 },
  { iata: "NAW", nameTH: "นราธิวาส", nameEN: "Narathiwat", city: "นราธิวาส", cityEN: "Narathiwat", country: "Thailand", flag: "🇹🇭", lat: 6.5199, lng: 101.7433 },
  { iata: "KBV", nameTH: "กระบี่", nameEN: "Krabi", city: "กระบี่", cityEN: "Krabi", country: "Thailand", flag: "🇹🇭", lat: 8.0992, lng: 98.9861 },
  { iata: "TDX", nameTH: "ตราด", nameEN: "Trat", city: "ตราด", cityEN: "Trat", country: "Thailand", flag: "🇹🇭", lat: 12.2746, lng: 102.3189 },
  { iata: "MAQ", nameTH: "แม่สอด", nameEN: "Mae Sot", city: "ตาก", cityEN: "Tak", country: "Thailand", flag: "🇹🇭", lat: 16.6999, lng: 98.5451 },
  { iata: "PHS", nameTH: "พิษณุโลก", nameEN: "Phitsanulok", city: "พิษณุโลก", cityEN: "Phitsanulok", country: "Thailand", flag: "🇹🇭", lat: 16.7829, lng: 100.2789 },

  // ─── Southeast Asia ──────────────────────────────────────────────────────────
  { iata: "SIN", nameTH: "ชางงี", nameEN: "Changi", city: "สิงคโปร์", cityEN: "Singapore", country: "Singapore", flag: "🇸🇬", lat: 1.3644, lng: 103.9915 },
  { iata: "KUL", nameTH: "กัวลาลัมเปอร์", nameEN: "Kuala Lumpur", city: "กัวลาลัมเปอร์", cityEN: "Kuala Lumpur", country: "Malaysia", flag: "🇲🇾", lat: 2.7456, lng: 101.7099 },
  { iata: "CGK", nameTH: "ซูการ์โน-ฮัตตา", nameEN: "Soekarno-Hatta", city: "จาการ์ตา", cityEN: "Jakarta", country: "Indonesia", flag: "🇮🇩", lat: -6.1256, lng: 106.6559 },
  { iata: "MNL", nameTH: "อากีโน่", nameEN: "Ninoy Aquino", city: "มะนิลา", cityEN: "Manila", country: "Philippines", flag: "🇵🇭", lat: 14.5086, lng: 121.0197 },
  { iata: "SGN", nameTH: "ตันเซินเญิ้ต", nameEN: "Tan Son Nhat", city: "โฮจิมินห์", cityEN: "Ho Chi Minh City", country: "Vietnam", flag: "🇻🇳", lat: 10.8188, lng: 106.6520 },
  { iata: "HAN", nameTH: "โหน่ยบ่าย", nameEN: "Noi Bai", city: "ฮานอย", cityEN: "Hanoi", country: "Vietnam", flag: "🇻🇳", lat: 21.2212, lng: 105.8072 },
  { iata: "PNH", nameTH: "โปเชนตอง", nameEN: "Phnom Penh", city: "พนมเปญ", cityEN: "Phnom Penh", country: "Cambodia", flag: "🇰🇭", lat: 11.5466, lng: 104.8440 },
  { iata: "RGN", nameTH: "ย่างกุ้ง", nameEN: "Yangon", city: "ย่างกุ้ง", cityEN: "Yangon", country: "Myanmar", flag: "🇲🇲", lat: 16.9073, lng: 96.1332 },
  { iata: "VTE", nameTH: "วัตไต", nameEN: "Wattay", city: "เวียงจันทน์", cityEN: "Vientiane", country: "Laos", flag: "🇱🇦", lat: 17.9883, lng: 102.5633 },

  // ─── East Asia ───────────────────────────────────────────────────────────────
  { iata: "NRT", nameTH: "นาริตะ", nameEN: "Narita", city: "โตเกียว", cityEN: "Tokyo", country: "Japan", flag: "🇯🇵", lat: 35.7720, lng: 140.3929 },
  { iata: "HND", nameTH: "ฮาเนดะ", nameEN: "Haneda", city: "โตเกียว", cityEN: "Tokyo", country: "Japan", flag: "🇯🇵", lat: 35.5494, lng: 139.7798 },
  { iata: "KIX", nameTH: "คันไซ", nameEN: "Kansai", city: "โอซากา", cityEN: "Osaka", country: "Japan", flag: "🇯🇵", lat: 34.4272, lng: 135.2440 },
  { iata: "CTS", nameTH: "ชิโตเซะ", nameEN: "New Chitose", city: "ซัปโปโร", cityEN: "Sapporo", country: "Japan", flag: "🇯🇵", lat: 42.7752, lng: 141.6922 },
  { iata: "FUK", nameTH: "ฟุกุโอกะ", nameEN: "Fukuoka", city: "ฟุกุโอกะ", cityEN: "Fukuoka", country: "Japan", flag: "🇯🇵", lat: 33.5857, lng: 130.4511 },
  { iata: "ICN", nameTH: "อินชอน", nameEN: "Incheon", city: "โซล", cityEN: "Seoul", country: "South Korea", flag: "🇰🇷", lat: 37.4691, lng: 126.4505 },
  { iata: "GMP", nameTH: "กิมโป", nameEN: "Gimpo", city: "โซล", cityEN: "Seoul", country: "South Korea", flag: "🇰🇷", lat: 37.5587, lng: 126.7910 },
  { iata: "PVG", nameTH: "ผู่ตง", nameEN: "Pudong", city: "เซี่ยงไฮ้", cityEN: "Shanghai", country: "China", flag: "🇨🇳", lat: 31.1434, lng: 121.8052 },
  { iata: "PEK", nameTH: "แคปิตอล", nameEN: "Capital", city: "ปักกิ่ง", cityEN: "Beijing", country: "China", flag: "🇨🇳", lat: 40.0799, lng: 116.6031 },
  { iata: "CAN", nameTH: "ไป่หยุน", nameEN: "Baiyun", city: "กวางโจว", cityEN: "Guangzhou", country: "China", flag: "🇨🇳", lat: 23.3924, lng: 113.2988 },
  { iata: "HKG", nameTH: "ฮ่องกง", nameEN: "Hong Kong", city: "ฮ่องกง", cityEN: "Hong Kong", country: "HK", flag: "🇭🇰", lat: 22.3080, lng: 113.9185 },
  { iata: "TPE", nameTH: "เถาหยวน", nameEN: "Taoyuan", city: "ไทเป", cityEN: "Taipei", country: "Taiwan", flag: "🇹🇼", lat: 25.0777, lng: 121.2322 },

  // ─── South Asia / Middle East ─────────────────────────────────────────────────
  { iata: "DEL", nameTH: "อินทิรา คานธี", nameEN: "Indira Gandhi", city: "นิวเดลี", cityEN: "New Delhi", country: "India", flag: "🇮🇳", lat: 28.5665, lng: 77.1031 },
  { iata: "BOM", nameTH: "ชาตราปาตี", nameEN: "Chhatrapati Shivaji", city: "มุมไบ", cityEN: "Mumbai", country: "India", flag: "🇮🇳", lat: 19.0896, lng: 72.8656 },
  { iata: "DXB", nameTH: "ดูไบ", nameEN: "Dubai", city: "ดูไบ", cityEN: "Dubai", country: "UAE", flag: "🇦🇪", lat: 25.2532, lng: 55.3657 },
  { iata: "AUH", nameTH: "อาบูดาบี", nameEN: "Abu Dhabi", city: "อาบูดาบี", cityEN: "Abu Dhabi", country: "UAE", flag: "🇦🇪", lat: 24.4430, lng: 54.6511 },
  { iata: "DOH", nameTH: "ฮามัด", nameEN: "Hamad", city: "โดฮา", cityEN: "Doha", country: "Qatar", flag: "🇶🇦", lat: 25.2731, lng: 51.6080 },

  // ─── Europe ───────────────────────────────────────────────────────────────────
  { iata: "LHR", nameTH: "ฮีทโธรว์", nameEN: "Heathrow", city: "ลอนดอน", cityEN: "London", country: "UK", flag: "🇬🇧", lat: 51.4775, lng: -0.4614 },
  { iata: "CDG", nameTH: "ชาร์ล เดอ โกล", nameEN: "Charles de Gaulle", city: "ปารีส", cityEN: "Paris", country: "France", flag: "🇫🇷", lat: 49.0097, lng: 2.5479 },
  { iata: "FRA", nameTH: "แฟรงก์เฟิร์ต", nameEN: "Frankfurt", city: "แฟรงก์เฟิร์ต", cityEN: "Frankfurt", country: "Germany", flag: "🇩🇪", lat: 50.0379, lng: 8.5622 },
  { iata: "AMS", nameTH: "อัมสเตอร์ดัม", nameEN: "Amsterdam Schiphol", city: "อัมสเตอร์ดัม", cityEN: "Amsterdam", country: "Netherlands", flag: "🇳🇱", lat: 52.3086, lng: 4.7639 },
  { iata: "ZRH", nameTH: "ซูริค", nameEN: "Zurich", city: "ซูริค", cityEN: "Zurich", country: "Switzerland", flag: "🇨🇭", lat: 47.4647, lng: 8.5492 },

  // ─── Americas / Oceania ───────────────────────────────────────────────────────
  { iata: "LAX", nameTH: "ลอสแองเจลิส", nameEN: "Los Angeles", city: "ลอสแองเจลิส", cityEN: "Los Angeles", country: "USA", flag: "🇺🇸", lat: 33.9425, lng: -118.4081 },
  { iata: "JFK", nameTH: "จอห์น เอฟ เคนเนดี", nameEN: "JFK", city: "นิวยอร์ก", cityEN: "New York", country: "USA", flag: "🇺🇸", lat: 40.6413, lng: -73.7781 },
  { iata: "SYD", nameTH: "ซิดนีย์", nameEN: "Sydney Kingsford Smith", city: "ซิดนีย์", cityEN: "Sydney", country: "Australia", flag: "🇦🇺", lat: -33.9399, lng: 151.1753 },
  { iata: "MEL", nameTH: "เมลเบิร์น", nameEN: "Melbourne Tullamarine", city: "เมลเบิร์น", cityEN: "Melbourne", country: "Australia", flag: "🇦🇺", lat: -37.6690, lng: 144.8410 },
];

/**
 * Haversine distance between two lat/lng points in km.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the nearest airport from a given lat/lng.
 */
export function findNearestAirport(lat: number, lng: number): Airport {
  return AIRPORTS.reduce((nearest, airport) => {
    const dist = haversineKm(lat, lng, airport.lat, airport.lng);
    const nearestDist = haversineKm(lat, lng, nearest.lat, nearest.lng);
    return dist < nearestDist ? airport : nearest;
  });
}

/**
 * Search airports by query string (IATA code, Thai name, English name, city).
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  if (!query.trim()) return AIRPORTS.slice(0, limit);
  const q = query.trim().toLowerCase();
  return AIRPORTS.filter(
    (a) =>
      a.iata.toLowerCase().includes(q) ||
      a.nameTH.includes(query.trim()) ||
      a.nameEN.toLowerCase().includes(q) ||
      a.city.includes(query.trim()) ||
      a.cityEN.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
  ).slice(0, limit);
}
