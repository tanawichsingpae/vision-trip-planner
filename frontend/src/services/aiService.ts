import { type DayPlan } from "@/components/TravelItinerary";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { type AIModelType, type AIProviderType, MODEL_ID_MAP } from "@/context/AIProviderContext";
import { safeFetch } from "@/utils/apiUtils";
import { fetchPlaceDetails } from "@/api/places";
import { type DayCluster } from "@/api/spatialPlanner";

export interface TypicalWeather {
  month: string;
  avgHighC: number;
  avgLowC: number;
  tempRange: string;
  description: string;
  rainChance: string;
  humidity: string;
  tips: string;
}

export interface TravelPlanResponse {
  itinerary: DayPlan[];
  suggestions: SuggestedPlace[];
  accommodations: SuggestedPlace[];
  typicalWeather?: TypicalWeather;
}

export interface VisionResult {
  place: string;
  country: string;
  type: string;
  confidence: number;
  similar_locations: Array<{ name: string; similarity: number }>;
  ai_reasoning?: string[];
  initial_candidates?: ImageCandidate[];
  top_candidates?: ImageCandidate[];
  uploadedImageUrl?: string;
}

export interface ImageCandidate {
  name: string;
  photo_url: string | null;
  similarity: number;
  place_id: string;
}

export interface TripPreferences {
  startDate: Date;
  endDate: Date;
  days: number;
  travelerType: string;
  budget: string;
  activities: string[];
  pace: string;
  hasHotel?: "yes" | "no";
  hotelName?: string;
  hotelLat?: number;
  hotelLng?: number;
  hotelPlaceId?: string;
  hotelPhotoUrl?: string | null;
  hotelCheckInTime?: string;
  hotelCheckOutTime?: string;
  aiModel?: string;
  ai_model?: string;
}

// ==========================================
// PUBLIC API
// ==========================================

export async function generateTravelPlan(
  places: string[],
  preferences: TripPreferences,
  model: AIModelType,
  dayClusters?: DayCluster[]
): Promise<TravelPlanResponse> {
  const modelId = MODEL_ID_MAP[model];
  return callOpenRouterPlan(places, preferences, modelId, dayClusters);
}

export async function generateMoreSuggestions(
  locationName: string,
  existingPlaces: string[],
  model: AIModelType
): Promise<SuggestedPlace[]> {
  const modelId = MODEL_ID_MAP[model];
  const prompt = `Generate 10 new travel suggestions for ${locationName}. 
  
  Requirements:
  - DO NOT include these places: ${existingPlaces.length > 0 ? existingPlaces.join(", ") : "none"}.
  - Ensure the suggestions cover all these categories: attraction, food, nature, culture, activity, shopping, nightlife, relax.
  - COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every suggestion based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  - Use ONLY real, geocodable place names.
  
  Return the response strictly in JSON format matching this schema:
  {
    "suggestions": [{ "name": "...", "category": "food", "description": "...", "lat": 0, "lng": 0 }]
  }`;

  return callOpenRouterMoreSuggestions(prompt, modelId);
}

export async function generateMoreAccommodations(
  locationName: string,
  existingPlaces: string[],
  model: AIModelType
): Promise<SuggestedPlace[]> {
  const modelId = MODEL_ID_MAP[model];
  const prompt = `Generate 6 to 8 recommended accommodations/hotels for visitors in or near ${locationName}. 
  
  Requirements:
  - DO NOT include these places: ${existingPlaces.length > 0 ? existingPlaces.join(", ") : "none"}.
  - Include a diverse variety of accommodations (e.g. luxury hotel, boutique hotel, budget-friendly stay, resort/inn).
  - COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every accommodation based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  - Use ONLY real, geocodable accommodation/hotel names.
  - For priceLevel: Provide an integer from 1 (budget) to 4 (luxury).
  
  Return the response strictly in JSON format matching this schema:
  {
    "accommodations": [{ "name": "...", "category": "hotel", "description": "...", "lat": 0, "lng": 0, "priceLevel": 2 }]
  }`;

  return callOpenRouterMoreAccommodations(prompt, modelId);
}

export async function analyzeImage(
  file: File,
  model: AIModelType,
  useClip: boolean = true,
  onProgress?: (step: string) => void
): Promise<VisionResult> {
  const modelId = MODEL_ID_MAP[model];
  console.log(`Starting Retrieval-LLM pipeline (OpenRouter model: ${modelId}, CLIP: ${useClip})...`);

  // 2. Get initial candidates from LLM (to narrow down search)
  const base64Image = await fileToBase64(file);
  const base64Data = base64Image.split(",")[1];

  const candidatePrompt = `Analyze this image and provide a list of 5 specific potential landmark or city matches. 
  Include the most likely one first.
  Return STRICT JSON in this format:
  {
    "places": ["place1","place2","place3","place4","place5"]
  }
  Do not return markdown or explanations.`;

  const initialGuesses = await getInitialGuessesOpenRouter(base64Data, file.type, candidatePrompt, modelId);

  console.log("Initial guesses from LLM:", initialGuesses);
  onProgress?.("Fetching Google Places candidates...");

  // 1. Get uploaded image embedding — only when CLIP is enabled
  const userImageEmbedding = useClip ? await getEmbedding(file) : null;

  // 3. Retrieve real candidates and photos from Google Places
  const candidates: ImageCandidate[] = [];
  for (const guess of initialGuesses.slice(0, 5)) {
    const placeData = await fetchCandidateFromGoogle(guess);

    let similarity = 0; // Default zero; computed only when CLIP is enabled
    let photo_url = "";
    let place_id = "";
    let name = guess;

    if (placeData) {
      name = placeData.name;
      place_id = placeData.place_id;
      photo_url = placeData.photo_url || "";

      if (useClip && photo_url && userImageEmbedding) {
        try {
          // Calculate visual similarity via CLIP embeddings
          const candidateEmbedding = await getEmbeddingFromUrl(photo_url);
          similarity = cosineSimilarity(userImageEmbedding, candidateEmbedding);
        } catch (e) {
          console.warn(`Failed to compute similarity for ${guess}:`, e);
        }
      }
    }

    candidates.push({ name, place_id, photo_url, similarity });
  }

  if (useClip) {
    onProgress?.("Computing CLIP visual similarity...");
  }

  // 4. Rank candidates — by CLIP similarity when enabled, otherwise keep LLM order (similarity=0)
  if (useClip) {
    candidates.sort((a, b) => b.similarity - a.similarity);
  }
  const topCandidates = candidates.slice(0, 3);
  console.log(`Candidates (Top 3, CLIP=${useClip}):`, topCandidates);

  if (topCandidates.length === 0) {
    throw new Error("Vision AI failed to generate any initial locations for analysis.");
  }

  const bestMatch = topCandidates[0];

  onProgress?.("Finalizing best match...");

  // 5. Final LLM reasoning — prompt differs based on whether CLIP scores are available
  const reasoningPrompt = useClip
    ? `The user uploaded an image. Our visual retrieval system found a strong match:
  Identified Place: ${bestMatch.name} (Similarity Score: ${bestMatch.similarity.toFixed(2)})
  Other similar places found: ${topCandidates.slice(1, 3).map(c => `${c.name} (${c.similarity.toFixed(2)})`).join(", ")}

  Provide a detailed reasoning for why this match is likely correct based on visual features typical of ${bestMatch.name}.
  Return the result in strictly valid JSON format:
  {
    "place": "${bestMatch.name}",
    "country": "...",
    "type": "...",
    "ai_reasoning": ["...", "..."]
  }`
    : `The user uploaded an image. Our retrieval system found these candidate locations based on your initial analysis:
  Best candidate: ${bestMatch.name}
  Other candidates found: ${topCandidates.slice(1, 3).map(c => c.name).join(", ")}

  Based on the visual content of the image, reason about which of these locations is the best match and why.
  Return the result in strictly valid JSON format:
  {
    "place": "${bestMatch.name}",
    "country": "...",
    "type": "...",
    "ai_reasoning": ["...", "..."]
  }`;

  const finalResult = await analyzeImageOpenRouter(base64Data, file.type, reasoningPrompt, modelId);

  return {
    ...finalResult,
    confidence: bestMatch.similarity,
    similar_locations: topCandidates.slice(1, 3).map(c => ({ name: c.name, similarity: c.similarity })),
    initial_candidates: candidates.slice(0, 5),
    top_candidates: topCandidates,
  };
}

export async function chatWithAssistant(
  userMessage: string,
  locationName: string,
  model: AIModelType,
  itinerary: DayPlan[],
  preferences: TripPreferences | null,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<string> {
  const modelId = MODEL_ID_MAP[model];
  const systemPrompt = `[Character Concept — Pixinerary]
ชื่อ: พิกซ์ (Pix)
ชื่อเต็ม: Pix (มาจาก Picture + Pixinerary เพราะจุดเด่นคือการนำภาพถ่ายมาระบุสถานที่และจัดทริป)
ฉายา: Your AI Travel Companion
บทบาท: AI Travel Guide / ผู้ช่วยวางแผนการเดินทางส่วนตัว
เพศ: ชาย (พูดลงท้ายด้วย "ครับ" เสมอ, แทนตัวเองว่า "ผม" หรือ "พิกซ์", สรรพนามเรียกผู้ใช้ว่า "คุณ" เท่านั้น)
อายุภาพลักษณ์: ประมาณ 24–27 ปี
บุคลิกโดยรวม: หนุ่มเกาหลีอบอุ่น สุภาพ เป็นมิตร ฉลาด เป็นนักเดินทางตัวจริงที่คอยดูแลและคิดเผื่อ
จุดหมายปลายทางของทริป: ${locationName}

🚨 [กฎเหล็กสูงสุดเรื่องสรรพนามเรียกผู้ใช้ - MANDATORY RULE]:
- ให้เรียกแทนตัวผู้ใช้ว่า "คุณ" เท่านั้นในทุกกรณี!
- ห้ามเรียกแทนตัวผู้ใช้ด้วยคำอื่นเด็ดขาด เช่น ห้ามใช้คำว่า "คุณลูกค้า", "นาย", "เธอ", "ท่าน", "เพื่อน", "พี่", "น้อง", "ยู" หรือสรรพนามอื่นใดทั้งสิ้น ให้ใช้คำว่า "คุณ" คำเดียวเท่านั้นอย่างสม่ำเสมอในทุกข้อความ!

🌏 บุคลิกหลัก 5 ด้าน (Core Personality Pillars):
1. 🤝 Friendly: คุยง่ายเหมือนเพื่อนสนิทที่เชี่ยวชาญเรื่องเที่ยว เป็นกันเองแต่สุภาพ
2. 🎩 Polite: สุภาพ ให้เกียรติผู้ใช้ ไม่พูดห้วน ลงท้าย "ครับ" อย่างเป็นธรรมชาติ
3. 🧭 Helpful: พยายามช่วยให้ผู้ใช้ตัดสินใจได้จริง ไม่ตอบกว้างเกินไปและไม่ยัดเยียด
4. 🧠 Smart: วิเคราะห์ข้อมูล ให้เหตุผลประกอบ (เช่น การจัดโซนเดินทาง เวลาที่เหมาะสม สภาพอากาศ)
5. ☀️ Warm: อบอุ่น คิดบวก มีพลังที่ดี ทำให้รู้สึกสบายใจเหมือนมีเพื่อนร่วมทริป

❌ ข้อห้ามและลักษณะที่ต้องหลีกเลี่ยงเด็ดขาด:
- ห้ามพูดเหมือนหุ่นยนต์ หรือเจ้าหน้าที่ทางการ
- ห้ามสอนหรือทำตัวเป็นผู้เชี่ยวชาญที่ชอบสั่งสอนผู้ใช้
- ห้ามพูดเวิ่นเว้อยาวเกินไปในทุกคำตอบ — ตอบกระชับ น่าอ่าน เข้าประเด็น
- ห้ามใช้ศัพท์เทคนิคที่เข้าใจยาก
- ห้ามยัดสถานที่ท่องเที่ยวจำนวนมากโดยไม่สนใจความต้องการของผู้ใช้
- ห้ามมั่นใจเกินไปเมื่อข้อมูลไม่แน่นอน หากไม่ชัวร์ให้บอกอย่างจริงใจ เช่น "ผมยังไม่มั่นใจ 100% แต่จากข้อมูลน่าจะเป็น..."
- ห้ามเรียกผู้ใช้ด้วยคำอื่นนอกจาก "คุณ" เด็ดขาด (ห้ามใช้ "คุณลูกค้า", "ท่าน", "เธอ", "นาย", "เพื่อน", "พี่", "น้อง", "ยู") ให้เรียก "คุณ" เท่านั้น
- ห้ามตอบเป็น JSON ดิบๆ ให้ผู้ใช้ (ตอบเป็นภาษาพูดที่อบอุ่นและเป็นธรรมชาติเสมอ)
- ห้ามใช้เครื่องหมายดอกจัน '*' หรือ '**' ในข้อความตอบรับเด็ดขาด ให้ใช้การขึ้นบรรทัดใหม่และอีโมจิแทน

📸 ความเชี่ยวชาญด้าน Vision & การมองเห็น (Visual Companion):
พิกซ์มีความเชี่ยวชาญในการมองภาพถ่ายและวิเคราะห์สถานที่ท่องเที่ยว
เมื่อผู้ใช้ส่งภาพหรือถามถึงสถานที่จากภาพ ให้พูดอย่างอบอุ่นและมีหลักการวิเคราะห์

บริบททริปปัจจุบันของผู้ใช้:
Preferences: ${preferences ? JSON.stringify(preferences) : "ยังไม่ได้ระบุ"}
Current Itinerary: ${JSON.stringify(itinerary)}

🎯 [CRITICAL: Decision-Making & Action Execution Protocol] (กฎเหล็กในการตัดสินใจและแก้ไขข้อมูล):

พิกซ์ต้องเป็นที่ปรึกษาการเดินทางที่รอบคอบ "ไม่ด่วนแก้ไขแผนโดยพลการ" หากคำขอยังมีความคลุมเครือ ไม่ระบุวัน/เวลา หรือเป็นการขอคำแนะนำ ให้ปฏิบัติตามเกณฑ์ดังนี้อย่างเคร่งครัด:

1️⃣ [คำสั่งที่แก้ไขได้ทันที - DIRECT EXECUTION]:
เกิดขึ้นเมื่อผู้ใช้ระบุคำสั่งที่ "ชัดเจน เจาะจง และมีข้อมูลครบถ้วน" หรือ "ผู้ใ��้ตอบยืนยันข้อเสนอที่พิกซ์เพิ่งถามไป" เช่น:
- สั่งระบุวันและเวลา/ลำดับชัดเจน เช่น "ลบกิจกรรมที่ 2 ในวันที่ 1 ออก", "ย้ายวัดพระแก้วไปใส่วันที่ 2 เวลา 10:00 น."
- สั่งเปลี่ยนงบประมาณ เช่น "ปรับงบเป็น 50,000 บาท"
- สั่งเปลี่ยนโรงแรมชัดเจน เช่น "เปลี่ยนโรงแรมเป็น Marriott Hotel"
- สั่งเที่ยวบินชัดเจน เช่น "ใส่เที่ยวบิน TG682"
- ผู้ใช้ตอบรับยืนยันข้อเสนอเดิมของพิกซ์ เช่น "ตกลงครับ", "เอาตามนั้นเลย", "โอเคใส่ในวันที่ 1 ได้เลย", "ลบออกเลยครับ"

👉 สิ่งที่ต้องทำในข้อ 1️⃣:
ตอบรับอย่างสุภาพและเป็นมิตร แจ้งสรุปสิ่งที่ได้ปรับปรุงเรียบร้อยแล้ว และแนบ JSON code block ที่บรรทัดสุดท้ายเสมอ เพื่อให้ระบบอัปเดตหน้าจอทันที โดยใช้รูปแบบ:
\`\`\`json
{
  "action": "UPDATE_ITINERARY",
  "updated_itinerary": [
    {
      "day": 1,
      "date": "Day 1 - ...",
      "activities": [
        { "id": "...", "time": "09:00", "title": "...", "description": "...", "type": "attraction", "lat": 1.23, "lng": 4.56 }
      ]
    }
  ],
  "updated_preferences": { "budget": "...", "pace": "..." },
  "updated_hotel": { "hotelName": "..." },
  "updated_flight": { "flightCode": "...", "originIata": "..." },
  "suggested_quick_actions": ["ตารางลงตัวมากครับ", "ช่วยแนะนำร้านอาหารใกล้ๆ วันแรก", "อยากปรับเวลาให้ชิลขึ้นอีก"]
}
\`\`\`
- ใส่เฉพาะ field ที่มีการเปลี่ยนแปลง
- "updated_itinerary" ต้องเป็น array เต็มของทุกวันรวมส่วนที่แก้ไขแล้ว
- คงค่า "id", "lat", "lng" เดิมไว้สำหรับสถานที่เดิม หากเป็นสถานที่ใหม่ให้สร้าง id เช่น "act-new-123"

2️⃣ [คำขอที่ต้อง "ถามเพื่อความแน่ใจ / เสนอแนะก่อนแก้ไข" - CLARIFY & CONFIRM FIRST]:
⚠️ ในกรณีต่อไปนี้ ให้ตอบเป็นข้อความพูดคุย แนะนำ และถามความเห็นชอบของผู้ใช้ก่อน โดยแนบ JSON code block ที่มีเฉพาะ "suggested_quick_actions" ไว้ที่บรรทัดสุดท้ายเสมอ (ห้ามใส่ "updated_itinerary" จนกว่าผู้ใช้จะยืนยัน):

ก. การขอเพิ่มสถานที่โดยไม่ระบุวัน/เวลา/ตำแหน่ง (Incomplete Place Addition):
- เช่น "อยากไปวัดพระแก้ว", "เพิ่ม Tokyo Tower ให้หน่อย", "อยากแวะกินราเมงข้อสอบ"
👉 วิธีการตอบ: วิเคราะห์ตาราง Current Itinerary แล้ว "เสนอแนะวันและช่วงเวลาที่เหมาะสมที่สุด" (โดยพิจารณาจากสถานที่ใกล้เคียงในวันนั้นเพื่อให้เดินทางสะดวก ไม่ย้อนไปมา) จากนั้นถามยืนยันกับผู้ใช้ และแนบ suggested_quick_actions ที่เป็นตัวเลือกตอบรับ เช่น:
\`\`\`json
{
  "suggested_quick_actions": ["ตกลงครับ บันทึกลงแผนเลย", "ขอเป็นช่วงบ่ายแทนครับ", "แนะนำร้านอาหารใกล้ๆ เพิ่ม", "ขอยกเลิกก่อนครับ"]
}
\`\`\`

ข. การขอคำแนะนำสถานที่ / ร้านอาหาร / คาเฟ่ (Recommendations):
- เช่น "แนะนำคาเฟ่บรรยากาศดีหน่อย", "มีร้านอาหารเด็ดๆ ไหม", "มีที่เที่ยวแนวธรรมชาติแถวนี้ไหม"
👉 วิธีการตอบ: เสนอตัวเลือกสถานที่จริง 2-3 แห่ง พร้อมจุดเด่นสั้นๆ และช่วงเวลาที่น่าไป และแนบ suggested_quick_actions เช่น:
\`\`\`json
{
  "suggested_quick_actions": ["เพิ่มร้านแรกลงในแผนเลยครับ", "ขอตัวเลือกคาเฟ่ใกล้ๆ เพิ่ม", "มีร้านอาหารมื้อค่ำแนะนำไหม"]
}
\`\`\`

ค. การขอปรับแผนแบบกว้างๆ หรือเปลี่ยนความเร็ว/สไตล์ (Vague Modifications):
- เช่น "อยากปรับแผนให้ชิลขึ้น", "ช่วยลดกิจกรรมลงหน่อย", "ช่วยปรับแผนวันที่ 2 ให้หน่อย", "เปลี่ยนแผนเป็น 2 วัน"
👉 วิธีการตอบ: เสนอแนวทางแก้ไขที่เป็นรูปธรรมก่อน แล้วถามผู้ใช้ พร้อมแนบ suggested_quick_actions เช่น:
\`\`\`json
{
  "suggested_quick_actions": ["ปรับตามแนวทางนี้เลยครับ", "ขอลดกิจกรรมในวันที่ 2 เพิ่ม", "อยากเพิ่มเวลาพักผ่อน"]
}
\`\`\`

ง. การขอลบสถานที่แบบกว้างๆ (Vague Deletions):
- เช่น "ลบสถานที่แพงๆ ออก", "เอาที่เที่ยวที่ต้องเดินทางไกลออก"
👉 วิธีการตอบ: ระบุสถานที่ในแผนปัจจุบันที่เข้าเกณฑ์ แล้วถามยืนยันว่าต้องการให้ลบสถานที่เหล่านั้นออกใช่หรือไม่

⚡ [กฎสำคัญสำหรับ Quick Actions (คำสั่งด่วนที่แนะนำ)]:
ในทุกการตอบกลับ พิกซ์ต้อง "นำข้อความและประเด็นที่ตนเองเพิ่งตอบไปเป็นตัวตั้งต้น" แล้ว "คาดเดา 3-4 ประโยคที่ผู้ใช้น่าจะต้องการตอบกลับมามากที่สุด" เพื่อใส่ลงในฟิลด์ "suggested_quick_actions" ใน JSON code block แนบท้ายเสมอ:
- [กรณีพิกซ์ถามยืนยันหรือเสนอแนะสถานที่]: ให้สร้างตัวเลือกตอบรับที่ระบุชื่อสถานที่นั้นโดยตรง เช่น ถ้าเสนอ Tokyo Tower -> ["ตกลง เพิ่ม Tokyo Tower ลงแผนเลยครับ", "ขอเปลี่ยนเป็นช่วงบ่ายแทนครับ", "อยากได้ที่เที่ยวอื่นใกล้ๆ มีไหมครับ", "ขอยกเลิกก่อนครับ"]
- [กรณีพิกซ์แนะนำตัวเลือกสถานที่/ร้านอาหาร 1, 2, 3]: ให้ตัวเลือกเป็นการเจาะจงเลือกช้อยส์เหล่านั้น เช่น ["เลือกตัวเลือกที่ 1 เลยครับ", "เลือกตัวเลือกที่ 2 เลยครับ", "ขอตัวเลือกอื่นเพิ่มเติม", "ช่วยจัดเวลาลงแผนให้ด้วยครับ"]
- [กรณีพิกซ์ถามคำถามเกี่ยวกับความต้องการ/งบประมาณ/สไตล์/วันเดินทาง]: ให้ตัวเลือกเป็นคำตอบที่เป็นไปได้ของผู้ใช้ เช่น ["งบประมาณประมาณ 30,000 บาทครับ", "ขอแบบชิลๆ เน้นพักผ่อนครับ", "จัดลงในวันที่ 1 เลยครับ"]
- [กรณีพิกซ์อัปเดตแผนเสร็จเรียบร้อยแล้ว]: ให้ตัวเลือกเป็นคำสั่งหรือคำถามต่อเนื่อง เช่น ["แผนลงตัวแล้ว ขอบคุณครับ", "ช่วยแนะนำร้านอาหารใกล้แผนวันนี้", "อยากปรับเวลาให้ยืด��ยุ่นขึ้นอีก"]
(ความยาวกระชับ 10-30 ตัวอักษรต่อตัวเลือก จำนวน 3-4 ตัวเลือก)`;

  // Build message sequence for multi-turn conversation
  const messagesPayload: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Include recent conversation turns (up to last 10 messages)
  if (history && history.length > 0) {
    const recentHistory = history.slice(-10);
    for (const h of recentHistory) {
      messagesPayload.push({
        role: h.role,
        content: h.content,
      });
    }
  }

  messagesPayload.push({ role: "user", content: userMessage });

  return chatOpenRouter(messagesPayload, modelId);
}

// ==========================================
// INTERNAL - OPENROUTER
// ==========================================

async function callOpenRouterPlan(
  places: string[],
  preferences: TripPreferences,
  modelId: string,
  dayClusters?: DayCluster[]
): Promise<TravelPlanResponse> {
  const startFmt = preferences.startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const endFmt = preferences.endDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const monthName = preferences.startDate.toLocaleDateString("en-GB", { month: "long" });
  const month = preferences.startDate.getMonth() + 1;
  const season = month >= 3 && month <= 5 ? "Spring" : month >= 6 && month <= 8 ? "Summer" : month >= 9 && month <= 11 ? "Autumn" : "Winter";

  const hotelInfoText = preferences.hasHotel === "yes" && preferences.hotelName
    ? `\nHotel / Accommodation Anchor: ${preferences.hotelName}${preferences.hotelLat && preferences.hotelLng ? ` (Lat: ${preferences.hotelLat}, Lng: ${preferences.hotelLng})` : ""}. Daily exploration should originate from and conclude near this accommodation without unnecessary backtracking.\n`
    : "";

  const spatialConstraintsText = dayClusters && dayClusters.length > 0
    ? `\nSPATIAL CLUSTER & DIRECTIONAL CONSTRAINTS (MANDATORY TO FOLLOW):
The locations have been partitioned into ${dayClusters.length} spatial daily clusters with Macro-TSP progression.
${dayClusters.map((c) => `Day ${c.day} Cluster Zone:
- Centroid: Lat ${c.centroid?.lat.toFixed(4) || "N/A"}, Lng ${c.centroid?.lng.toFixed(4) || "N/A"}${c.radiusKm ? ` (Max Radius: ${c.radiusKm.toFixed(1)} km)` : ""}
- Suggested Anchors: ${c.pois.map(p => p.name).slice(0, 4).join(", ")}
- Rule for Day ${c.day}: Keep ALL activities for Day ${c.day} strictly clustered in this specific geographic zone. DO NOT jump to another district far away. Progress logically from morning to evening without criss-crossing paths.`).join("\n")}\n`
    : "";

  const prompt = `Generate a ${preferences.days}-day travel itinerary and additional suggestions for a trip covering these locations: ${places.join(", ")}.
  
  Trip Dates: ${startFmt} to ${endFmt} (${preferences.days} days in ${monthName} – ${season})
  ${hotelInfoText}
  ${spatialConstraintsText}
  Traveler Profile:
  - Type: ${preferences.travelerType}
  - Budget: ${preferences.budget}
  - Preferred Activities: ${preferences.activities.join(", ")}
  - Travel Pace: ${preferences.pace}
  
  CRITICAL ITINERARY PLANNING RULES (MANDATORY):
  1. UNTANGLED DAILY ROUTE (NO CRISS-CROSSING / BACKTRACKING):
     - Each day's travel route MUST progress smoothly without criss-crossing or zigzagging across town.
     - Sequence places by geographic proximity from morning to evening.
  2. STRICT GEOGRAPHIC DISTRICT GROUPING (NO REVISITING SAME DISTRICT ACROSS DAYS):
     - Group all places within the same neighborhood/district (within ~2.5-3.5 km) into the SAME day.
     - NEVER scatter places from the same district across different days (e.g., avoid visiting Grand Palace on Day 1 and returning to Wat Pho on Day 3).
  3. MANDATORY MIDDAY LUNCH (11:30 - 13:30):
     - EVERY single day MUST include a dedicated lunch restaurant/food activity in the midday slot (11:30 - 13:30) located close to the morning attraction.
  4. STRICTLY NO CONSECUTIVE RESTAURANTS:
     - DO NOT schedule back-to-back restaurants or cafes in the same day without a sightseeing or cultural activity in between.
     - Structure per day: Morning Sightseeing -> Lunch (11:30-13:30) -> Afternoon Attraction -> Sunset/Dinner (18:00-20:00) -> Evening Stroll/Nightlife.
  5. LONG COMMUTE LIMITATION:
     - Limit travel segments taking >40-60 minutes (>25-30 km) to at most ONE pair per day (e.g., one day-trip excursion out and return). Intermediate activities must remain tightly clustered.
  6. REAL-WORLD TIMING & OPERATING HOURS:
     - Respect real operating hours for all landmarks, museums, and temples.
     - Place observation decks/viewpoints/sunset spots at 17:00 - 18:30 (Golden Hour).
     - Place night markets, evening cruises, and nightlife after 18:30.
  7. COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every activity, suggestion, and accommodation based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  8. ACCOMMODATIONS RULE (MANDATORY): You MUST provide at least 5 to 8 diverse, real accommodations/hotels (luxury, boutique, mid-range, budget) located in or near the trip destinations. Include real hotel names with priceLevel from 1 (budget) to 4 (luxury).
  9. Use ONLY real, geocodable place names for activity "title". DO NOT include verbs (e.g., "Explore", "Visit", "Eat at", "Stroll") in the "title". Place descriptions in the "description" field.
  
  Return the response strictly in JSON format matching this schema:
  {
    "itinerary": [{
        "day": 1,
        "date": "Day 1 - ...",
        "activities": [{ 
          "time": "09:00", 
          "title": "...", 
          "description": "...", 
          "type": "attraction",
          "lat": 0,
          "lng": 0
        }]
    }],
    "suggestions": [{ "name": "...", "category": "food", "description": "...", "lat": 0, "lng": 0 }],
    "accommodations": [
      { "name": "...", "category": "hotel", "description": "...", "lat": 0, "lng": 0, "priceLevel": 2 }
    ],
    "typicalWeather": {
      "month": "${monthName}",
      "avgHighC": 0,
      "avgLowC": 0,
      "tempRange": "e.g. 15°C – 25°C",
      "description": "e.g. Warm and dry with occasional afternoon showers",
      "rainChance": "e.g. Low (10%)",
      "humidity": "e.g. Moderate (60%)",
      "tips": "e.g. Pack light layers; evenings can be cool"
    }
  }`;

  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      expect_json: true,
    }),
  });

  const text = data.text;
  return await formatResponse(JSON.parse(text));
}

async function analyzeImageOpenRouter(base64: string, mimeType: string, prompt: string, modelId: string): Promise<VisionResult> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
          ],
        }
      ],
      expect_json: true,
    }),
  });

  const raw = data.text?.trim() ?? "";

  if (!raw.startsWith("{") && !raw.startsWith("[")) {
    console.warn("OpenRouter model returned non-JSON (possible refusal):", raw.substring(0, 120));
    throw new Error(`AI declined to analyze this image. Try a different image or switch model.`);
  }

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

async function chatOpenRouter(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  modelId: string
): Promise<string> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages,
      expect_json: false
    }),
  });

  return data.text;
}

async function callOpenRouterMoreSuggestions(prompt: string, modelId: string): Promise<SuggestedPlace[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      expect_json: true,
    }),
  });

  const text = data.text;
  const result = JSON.parse(text);
  const response = await formatResponse({ itinerary: [], suggestions: result.suggestions || [] });
  return response.suggestions;
}

async function callOpenRouterMoreAccommodations(prompt: string, modelId: string): Promise<SuggestedPlace[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      expect_json: true,
    }),
  });

  const text = data.text;
  const result = JSON.parse(text);
  const response = await formatResponse({ itinerary: [], suggestions: [], accommodations: result.accommodations || [] });
  return response.accommodations;
}

// ==========================================
// RETRIEVAL UTILS (CLIP)
// ==========================================

export async function getEmbedding(image: File | Blob): Promise<number[]> {
  console.log("Calling CLIP embedding server...");

  const formData = new FormData();
  // Ensure the server sees a filename for the image field
  if (image instanceof File) {
    formData.append("image", image);
  } else {
    formData.append("image", image, "image.jpg");
  }

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/embedding`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      throw new Error("Embedding API failed: " + res.status);
    }

    const data = await res.json();

    console.log("CLIP embedding received");
    return data;
  } catch (err) {
    console.error("CLIP server connection failed:", err);
    throw err; // Do NOT use random embeddings for ranking
  }
}

export async function getEmbeddingFromUrl(url: string): Promise<number[]> {
  console.log("Getting CLIP embedding from URL (Server-side fetch):", url);
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/embedding_url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      throw new Error("Embedding URL API failed");
    }

    return await res.json();
  } catch (e) {
    console.error("Error getting CLIP embedding from URL via server:", e);
    throw e;
  }
}

function cosineSimilarity(query: number[], candidate: number[]): number {
  let dotProduct = 0;
  let queryMag = 0;
  let candidateMag = 0;
  for (let i = 0; i < query.length; i++) {
    dotProduct += query[i] * candidate[i];
    queryMag += query[i] * query[i];
    candidateMag += candidate[i] * candidate[i];
  }
  return dotProduct / (Math.sqrt(queryMag) * Math.sqrt(candidateMag));
}

async function getInitialGuessesOpenRouter(base64: string, mimeType: string, prompt: string, modelId: string): Promise<string[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
          ],
        }
      ],
      expect_json: true,
    }),
  });
  const raw = data.text?.trim() ?? "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const result = JSON.parse(cleaned);
  if (!result || !Array.isArray(result.places)) {
    console.error("OpenRouter Vision returned invalid format for places:", result);
    throw new Error("Vision API returned invalid format for places.");
  }
  return result.places;
}

async function fetchCandidateFromGoogle(name: string): Promise<Omit<ImageCandidate, 'similarity'> | null> {
  // Use the Google Maps JS SDK (PlacesService) to avoid CORS issues
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
    console.error("Google Maps Places SDK not loaded.");
    return null;
  }

  const service = new google.maps.places.PlacesService(document.createElement('div'));

  return new Promise((resolve) => {
    service.textSearch(
      { query: name },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const result = results[0];
          resolve({
            name: result.name || name,
            place_id: result.place_id || '',
            photo_url: result.photos?.[0]?.getUrl({ maxWidth: 400 }) || null
          });
        } else {
          console.warn(`Google Places Search for ${name} returned status: ${status}`);
          resolve(null);
        }
      }
    );
  });
}

// ==========================================
// UTILS
// ==========================================

function generateHeuristicReasoning(place: string, type: string): string[] {
  const t = type.toLowerCase();

  if (t.includes("temple") || t.includes("religious") || t.includes("shrine")) {
    return [
      "Tall central temple tower",
      "Traditional religious architecture",
      "Ornamental decorations typical of historic temples"
    ];
  }

  if (t.includes("nightlife") || t.includes("market") || t.includes("street")) {
    return [
      "Neon signage and nightlife lighting",
      "Dense street activity and crowds",
      "Street food stalls and night market visuals"
    ];
  }

  if (t.includes("beach") || t.includes("island") || t.includes("coastal")) {
    return [
      "White sandy coastline and turquoise water",
      "Tropical palm trees and shoreline vegetation",
      "Coastal landmarks typical of the region"
    ];
  }

  if (t.includes("mountain") || t.includes("nature") || t.includes("hiking")) {
    return [
      "Distinctive mountain peak silhouettes",
      "Alpine or sub-tropical forest cover",
      "Rugged terrain and natural elevation markers"
    ];
  }

  return [
    `Iconic architecture associated with ${place}`,
    "Distinctive local landscape features",
    "Visual markers typical of this region"
  ];
}

export async function fetchPlacePhoto(placeName: string): Promise<string | null> {
  if (typeof google === "undefined" || !google.maps || !google.maps.places) {
    return null;
  }

  const service = new google.maps.places.PlacesService(document.createElement("div"));

  return new Promise((resolve) => {
    service.textSearch(
      { query: placeName },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
          const photo = results[0].photos?.[0];
          if (photo) {
            resolve(photo.getUrl({ maxWidth: 800 }));
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function formatResponse(result: any): Promise<TravelPlanResponse> {
  const itinerary: DayPlan[] = await Promise.all((result.itinerary || []).map(async (day: any) => ({
    ...day,
    activities: await Promise.all((day.activities || []).map(async (act: any) => {
      const details = await fetchPlaceDetails(act.title);
      return {
        ...act,
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        image_url: details.photo_url,
        rating: details.rating,
        userRatingsTotal: details.userRatingsTotal,
        openNow: details.openNow,
        openingHours: details.openingHours,
        priceLevel: details.priceLevel,
        website: details.website,
        phoneNumber: details.phoneNumber,
      };
    })),
  })));

  const suggestions: SuggestedPlace[] = await Promise.all((result.suggestions || []).map(async (sug: any) => {
    const details = await fetchPlaceDetails(sug.name);
    return {
      ...sug,
      id: `sug-${Math.random().toString(36).substr(2, 9)}`,
      image: details.photo_url || `https://picsum.photos/seed/${encodeURIComponent(sug.name)}/800/600`,
      image_url: details.photo_url,
      photo_url: details.photo_url,
      lat: (sug.lat && sug.lat !== 0) ? sug.lat : (details.lat ?? 0),
      lng: (sug.lng && sug.lng !== 0) ? sug.lng : (details.lng ?? 0),
      openingHours: details.openingHours,
      rating: details.rating ?? sug.rating,
      userRatingsTotal: details.userRatingsTotal ?? sug.userRatingsTotal,
      openNow: details.openNow ?? sug.openNow,
      priceLevel: details.priceLevel ?? sug.priceLevel,
      website: details.website ?? sug.website,
      phoneNumber: details.phoneNumber ?? sug.phoneNumber,
    };
  }));

  const accommodations: SuggestedPlace[] = await Promise.all((result.accommodations || []).map(async (acc: any) => {
    const details = await fetchPlaceDetails(acc.name);
    return {
      ...acc,
      category: "hotel" as const,
      id: `acc-${Math.random().toString(36).substr(2, 9)}`,
      image: details.photo_url || `https://picsum.photos/seed/${encodeURIComponent(acc.name)}/800/600`,
      image_url: details.photo_url,
      photo_url: details.photo_url,
      lat: (acc.lat && acc.lat !== 0) ? acc.lat : (details.lat ?? 0),
      lng: (acc.lng && acc.lng !== 0) ? acc.lng : (details.lng ?? 0),
      openingHours: details.openingHours,
      rating: details.rating ?? acc.rating,
      userRatingsTotal: details.userRatingsTotal ?? acc.userRatingsTotal,
      openNow: details.openNow ?? acc.openNow,
      priceLevel: details.priceLevel ?? acc.priceLevel,
      website: details.website ?? acc.website,
      phoneNumber: details.phoneNumber ?? acc.phoneNumber,
    };
  }));

  const typicalWeather: TypicalWeather | undefined = result.typicalWeather ?? undefined;

  return { itinerary, suggestions, accommodations, typicalWeather };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

// ==========================================
// TEST CONNECTIONS
// ==========================================

export async function testOpenRouterConnection() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: "Hello" }],
        expect_json: false
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter AI Test Error:", errorText);
      return false;
    }
    console.log("OpenRouter AI connection successful");
    return true;
  } catch (e) {
    console.error("OpenRouter AI connection failed", e);
    return false;
  }
}

export const testGeminiConnection = testOpenRouterConnection;
export const testOpenAIConnection = testOpenRouterConnection;
