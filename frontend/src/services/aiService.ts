import { type DayPlan } from "@/components/TravelItinerary";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { type AIModelType, type AIProviderType, MODEL_ID_MAP } from "@/context/AIProviderContext";
import { safeFetch, validateApiKey } from "@/utils/apiUtils";
import { safeParseJson } from "@/utils/jsonRepair";
import { fetchPlaceDetails } from "@/api/places";
import { fetchWikimediaPhoto } from "@/api/geocode";
import { fetchSmartPhoto, getCuratedFallbackPhoto } from "@/services/photoService";
import { type DayCluster } from "@/api/spatialPlanner";
import { hasThaiScript, translateTextSync } from "@/services/translatorService";

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;
validateApiKey(GEOAPIFY_API_KEY, "Geoapify");

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
  place_th?: string;
  place_en?: string;
  city?: string;
  city_th?: string;
  city_en?: string;
  country: string;
  country_th?: string;
  country_en?: string;
  type: string;
  confidence: number;
  similar_locations: Array<{ name: string; similarity: number }>;
  ai_reasoning?: string[];
  initial_candidates?: ImageCandidate[];
  top_candidates?: ImageCandidate[];
  uploadedImageUrl?: string;
  is_identifiable_place?: boolean;
  rejection_reason?: string;
  detected_content?: string;
  detailed_description?: string;
  suggested_action?: string;
  non_travel_category?: string;
}

export interface ImageCandidate {
  name: string;
  photo_url: string | null;
  similarity: number;
  place_id: string;
}

export interface TripPreferences {
  startDate: Date | string;
  endDate: Date | string;
  days: number;
  travelerType: string;
  budget: string;
  budgetMinTHB?: number;
  budgetMaxTHB?: number;
  budgetRange?: number[];
  activities: string[];
  pace: string;
  hasFlight?: "yes" | "no";
  flightCode?: string;
  originIata?: string;
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

/**
 * AI Self-Review & Refinement: Analyzes rule audit issues and repairs the itinerary
 */
export async function refineItineraryWithAI(
  currentItinerary: DayPlan[],
  auditIssues: string[],
  preferences: TripPreferences,
  model: AIModelType,
  weatherForecast?: Array<{ date?: string; condition?: any; rainChance?: number }>
): Promise<DayPlan[]> {
  const modelId = MODEL_ID_MAP[model];

  const simplifiedItinerary = currentItinerary.map(d => ({
    day: d.day,
    date: d.date,
    activities: d.activities.map(a => ({
      id: a.id,
      time: a.time,
      title: a.title,
      description: a.description,
      type: a.type,
      lat: a.lat,
      lng: a.lng,
      openingHours: a.openingHours,
      priceLevel: a.priceLevel,
      rating: a.rating,
      userRatingsTotal: a.userRatingsTotal,
    }))
  }));

  const weatherText = weatherForecast && weatherForecast.length > 0
    ? weatherForecast.map((f, i) => {
        const cond = typeof f.condition === "string" ? f.condition : (f.condition?.description || f.condition?.text || "Normal");
        const rain = f.rainChance !== undefined ? ` (Rain Chance: ${f.rainChance}%)` : "";
        return `- Day ${i + 1}: ${cond}${rain}`;
      }).join("\n")
    : "No severe weather alerts detected.";

  const prompt = `You are an Expert AI Travel Route Auditor & Master Itinerary Optimizer.
We analyzed the following draft travel itinerary and detected several planning flaws & rule violations:

DETECTED AUDIT ISSUES TO REPAIR (CRITICAL):
${auditIssues.length > 0 ? auditIssues.map((issue, idx) => `${idx + 1}. ${issue}`).join("\n") : "1. Review overall daily geographic flow and ensure perfectly timed meal slots (lunch 11:30-13:30, dinner 18:00-20:00)."}

CURRENT ITINERARY:
${JSON.stringify(simplifiedItinerary, null, 2)}

TRAVELER PREFERENCES:
- Pace: ${preferences.pace}
- Traveler Type: ${preferences.travelerType}
- Budget: ${preferences.budget}
- Preferred Activities: ${preferences.activities?.join(", ") || "Sightseeing"}

DAILY WEATHER FORECAST:
${weatherText}

ACADEMIC OPTIMIZATION & SELECTION MISSION (TTDP & OPTW STANDARDS):
1. UNTANGLE GEOGRAPHIC PATHS & NO CIRCULAR LOOPS (2-Opt TSP):
   - Sequence activities in each day so the route flows in an open forward direction across the neighborhood.
   - Strictly ELIMINATE zigzagging back-and-forth across town (>10 km U-turns) and loopbacks where the evening spot meets the morning starting spot.
2. DISTRICT GROUPING:
   - If attractions are in the same neighborhood (within ~2.5-3.5 km), schedule them on the SAME day rather than split across days.
   - For distant attractions (>25 km), dedicate an isolated excursion day cluster.
3. PHYSIOLOGICAL DINING RHYTHM & MEAL SEPARATION:
   - Every day MUST have a dedicated midday lunch window (11:30 - 13:00) located near morning attractions (within ~1.5 km).
   - Evening dinner MUST be scheduled at 18:00 - 20:30.
   - Golden Hour & Sunset observation decks MUST be at 17:00 - 18:30.
   - NEVER place consecutive food/restaurant stops back-to-back without a cultural/sightseeing/leisure stop in between.
4. OPERATING HOURS & DWELL TIME BUFFER:
   - For venues closing around 17:00-18:00, schedule them with at least 1.5 - 2 hours buffer before closing (start by 15:30 - 16:30).
   - Public walking streets, night markets, and open areas are assumed open 24 hours.
   - Keep distance between consecutive stops within 10 - 15 km max.
5. BUDGET COMPATIBILITY (TTDP MULTI-OBJECTIVE CONSTRAINT):
   - If Budget is "Budget", replace expensive luxury venues (Price Level 3-4, fine dining) with top-rated local authentic street food and affordable attractions.
   - If Budget is "Luxury", prioritize premium dining and iconic upscale experiences.
6. TRAVELER PERSONA SUITABILITY (TOURIST TYPOLOGY):
   - If Traveler Type is "Family", strictly replace any nightlife, bars, adult spots, or extreme hiking with family-friendly attractions (museums, aquariums, theme parks, calm parks).
   - If "Senior", strictly eliminate strenuous physical exertion and steep treks.
7. QUALITY GATE & ANTI-TOURIST-TRAP:
   - If an activity has a low rating (<3.8★) or is flagged as an overpriced tourist trap, replace it with a higher-rated (>=4.0★) local favorite in the same district.
8. CATEGORY BURNOUT PREVENTION (SATIATION THEORY):
   - Never schedule 3 or more consecutive spots of the same category (e.g. 3 temples or 3 shopping malls in a row). Interleave dining, shopping, scenic parks, or relaxation.
9. WEATHER SUITABILITY:
   - For any day forecasted with heavy rain or thunderstorms, move outdoor beach, island, or open-air activities to indoor cultural, museum, or covered market venues.
10. PRESERVE USER-CHOSEN PLACES: Keep valid user-selected attractions unless specifically flagged as incompatible, closed, or unsafe.
11. CATEGORY TYPE ACCURACY: Each activity "type" MUST accurately reflect its true category: "culture", "food", "nature", "adventure", "shopping", "nightlife", "relax", "landmark", "entertainment", "spiritual", or "hotel". DO NOT label everything as "attraction".
12. PRESERVE EXACT TRIP DURATION (MANDATORY): The input itinerary has EXACTLY ${currentItinerary.length} days. You MUST output EXACTLY ${currentItinerary.length} days (Day 1 through Day ${currentItinerary.length}) in the "itinerary" array. NEVER drop, merge, or collapse days!

Return ONLY the refined itinerary strictly in this JSON format:
{
  "itinerary": [
${currentItinerary.map((d, idx) => `    {
      "day": ${d.day || idx + 1},
      "date": "${d.date || `Day ${idx + 1}`}",
      "activities": [
        {
          "time": "09:00",
          "title": "...",
          "description": "...",
          "type": "culture",
          "lat": 0,
          "lng": 0
        }
      ]
    }`).join(",\n")}
  ]
}`;

  try {
    const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        expect_json: true,
      }),
    });

    const text = data.text?.trim() ?? "";
    const parsed = safeParseJson<any>(text);

    if (parsed && Array.isArray(parsed.itinerary) && parsed.itinerary.length >= currentItinerary.length) {
      // Map original details (photos, ratings, etc.) onto the refined itinerary
      const originalActivityMap = new Map<string, Activity>();
      currentItinerary.forEach(d => {
        d.activities.forEach(a => {
          originalActivityMap.set(a.title.toLowerCase().trim(), a);
          if (a.id) originalActivityMap.set(a.id, a);
        });
      });

      const refinedDays: DayPlan[] = parsed.itinerary.map((day: any, dIdx: number) => {
        const originalDay = currentItinerary[dIdx];
        const activities: Activity[] = (day.activities || []).map((act: any, aIdx: number) => {
          const matched = originalActivityMap.get(act.title?.toLowerCase().trim()) || (act.id ? originalActivityMap.get(act.id) : null);
          const accurateType = inferActivityType(act.title, act.description, act.type || matched?.type, []);
          return {
            ...act,
            type: accurateType,
            id: matched?.id || act.id || `refine-${dIdx}-${aIdx}-${Date.now()}`,
            image_url: matched?.image_url || null,
            photo_url: matched?.photo_url || null,
            isUserPhoto: matched?.isUserPhoto,
            english_name: matched?.english_name || act.english_name,
            wiki_title: matched?.wiki_title || act.wiki_title,
            image_keyword: matched?.image_keyword || act.image_keyword,
            rating: matched?.rating ?? null,
            userRatingsTotal: matched?.userRatingsTotal ?? null,
            openNow: matched?.openNow ?? null,
            openingHours: matched?.openingHours ?? null,
            priceLevel: matched?.priceLevel ?? null,
            website: matched?.website ?? null,
            phoneNumber: matched?.phoneNumber ?? null,
            lat: (act.lat && act.lat !== 0) ? act.lat : (matched?.lat ?? 0),
            lng: (act.lng && act.lng !== 0) ? act.lng : (matched?.lng ?? 0),
          };
        });

        return {
          day: day.day || dIdx + 1,
          date: day.date || originalDay?.date || `Day ${dIdx + 1}`,
          activities,
        };
      });

      return refinedDays;
    } else if (parsed && Array.isArray(parsed.itinerary)) {
      console.warn(`[refineItineraryWithAI] AI dropped days (got ${parsed.itinerary.length}, expected ${currentItinerary.length}). Preserving original multi-day itinerary.`);
    }
  } catch (err) {
    console.warn("[refineItineraryWithAI] AI refinement fallback to original itinerary:", err);
  }

  return currentItinerary;
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
  - BILINGUAL RULE (MANDATORY): For every place, provide BOTH Thai ("name_th", "description_th") AND English ("name_en", "description_en") fields with natural, high quality translations.
  - COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every suggestion based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  - Use ONLY real, geocodable place names.
  
  Return the response strictly in JSON format matching this schema:
  {
    "suggestions": [
      {
        "name": "Primary Name",
        "name_th": "ชื่อสถานที่ภาษาไทย",
        "name_en": "English Place Name",
        "category": "food",
        "description": "Overview description",
        "description_th": "คำอธิบายภาษาไทยสั้นๆ กระชับและน่าสนใจ",
        "description_en": "Short engaging English description",
        "lat": 0,
        "lng": 0
      }
    ]
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
  - BILINGUAL RULE (MANDATORY): For every accommodation, provide BOTH Thai ("name_th", "description_th") AND English ("name_en", "description_en") fields with natural translations.
  - COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every accommodation based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  - Use ONLY real, geocodable accommodation/hotel names.
  - For priceLevel: Provide an integer from 1 (budget) to 4 (luxury).
  
  Return the response strictly in JSON format matching this schema:
  {
    "accommodations": [
      {
        "name": "Hotel Name",
        "name_th": "ชื่อโรงแรมภาษาไทย",
        "name_en": "English Hotel Name",
        "category": "hotel",
        "description": "Hotel overview",
        "description_th": "คำอธิบายที่พักภาษาไทย บรรยากาศและสิ่งอำนวยความสะดวก",
        "description_en": "English accommodation description, ambiance, and amenities",
        "lat": 0,
        "lng": 0,
        "priceLevel": 2
      }
    ]
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

  // 2. Get initial candidates from LLM (to narrow down search & guard against non-travel images)
  const base64Image = await fileToBase64(file);
  const base64Data = base64Image.split(",")[1];

  const candidatePrompt = `Analyze this image carefully.
First, determine if this image depicts a real physical travel destination, outdoor scenery, landmark, temple, museum, cityscape, tourist attraction, or nature view that can be geolocated.

Reject images that are: close-up selfies/portraits of people, receipts/documents/bank slips, screenshots, food close-ups without recognizable venue architecture, household objects/products, memes/cartoons, pets/animals, or blurry/dark non-view photos.

Return STRICT JSON in this format if it IS a recognizable travel destination/scenery:
{
  "is_identifiable_place": true,
  "image_category": "landmark",
  "places": ["Specific Landmark Name 1", "Place 2", "Place 3", "Place 4", "Place 5"],
  "rejection_reason": "",
  "detected_content": "สถานที่ท่องเที่ยว/แลนด์มาร์ก",
  "detailed_description": "ตรวจพบสถานที่ท่องเที่ยวหรือวิวทัศน์ที่สามารถระบุพิกัดได้",
  "suggested_action": ""
}

If the image is NOT a recognizable travel landmark, scenery, or place, DETECT SPECIFICALLY WHAT IT IS:
{
  "is_identifiable_place": false,
  "image_category": "portrait_selfie",
  "non_travel_category": "selfie_portrait",
  "places": [],
  "detected_content": "รูปถ่ายบุคคล / เซลฟี่ (Selfie)",
  "rejection_reason": "ภาพนี้เป็นภาพถ่ายบุคคลระยะใกล้ ไม่เห็นองค์ประกอบของสถานที่ท่องเที่ยวหรือแลนด์มาร์ก",
  "detailed_description": "ภาพนี้แสดงใบหน้าหรือตัวบุคคลเป็นหลัก ไม่มีจุดสังเกตทางสถาปัตยกรรมหรือทิวทัศน์ที่สามารถนำไปวางแผนการเดินทางได้",
  "suggested_action": "กรุณาอัปโหลดภาพถ่ายวิวทิวทัศน์ ภูเขา ทะเล สถาปัตยกรรม ป้ายสถานที่ หรือหน้าร้านคาเฟ่/สถานที่ท่องเที่ยวแทน"
}

Allowed non_travel_category values when is_identifiable_place is false:
- "food_dish": Food, drinks, beverages, meals close-up (detected_content: e.g. "รูปถ่ายอาหารจานเดียว / เครื่องดื่ม")
- "selfie_portrait": Portrait, selfie, people faces, group selfie (detected_content: e.g. "รูปเซลฟี่บุคคล / พอร์ตเทรต")
- "document_receipt": Receipts, bills, bank slips, tickets, text documents (detected_content: e.g. "สลิปโอนเงิน / ใบเสร็จ / เอกสาร")
- "screenshot": Phone screens, chat screenshots, app UI (detected_content: e.g. "ภาพสกรีนช็อตหน้าจอโทรศัพท์ / แชท")
- "pet_animal": Pets, cats, dogs, domestic animals (detected_content: e.g. "สัตว์เลี้ยง / แมว / สุนัข")
- "vehicle": Cars, motorcycles, bikes without travel scenery (detected_content: e.g. "ยานพาหนะ / รถยนต์")
- "item_product": Clothing, accessories, consumer products, household goods (detected_content: e.g. "สิ่งของเครื่องใช้ / สินค้า")
- "graphic_meme": Memes, illustrations, drawings, logos, anime (detected_content: e.g. "ภาพกราฟิก / มีม / การ์ตูน")
- "blurry_dark": Blurry, dark, overexposed, or unintelligible photos (detected_content: e.g. "ภาพเบลอ / มืดสนิทจนมองไม่เห็นสถานที่")
- "other_non_travel": Other non-travel photos

Ensure "detected_content", "detailed_description", and "suggested_action" are written in clear, polite, natural Thai.
Do not return markdown or explanations outside JSON.`;

  const initialGuessResult = await getInitialGuessesOpenRouter(base64Data, file.type, candidatePrompt, modelId);
  console.log("Initial evaluation from LLM:", initialGuessResult);

  // Short-circuit: If the image is not a recognizable travel place, skip Google Places API and CLIP
  if (!initialGuessResult.isIdentifiablePlace || initialGuessResult.places.length === 0) {
    onProgress?.("Non-travel or unidentifiable image detected...");
    const detectedName = initialGuessResult.detectedContent || "ภาพที่ไม่ใช่สถานที่ท่องเที่ยว";
    return {
      place: `ภาพไม่ระบุสถานที่ (${detectedName})`,
      country: "-",
      type: initialGuessResult.imageCategory || "non_travel",
      confidence: 0,
      similar_locations: [],
      ai_reasoning: [
        initialGuessResult.detailedDescription ||
        initialGuessResult.rejectionReason ||
        "ระบบประเมินว่าภาพนี้เป็นภาพบุคคล อาหาร เอกสาร วัตถุ หรือไม่ใช่สถานที่ท่องเที่ยวสำหรับการเดินทาง"
      ],
      initial_candidates: [],
      top_candidates: [],
      is_identifiable_place: false,
      rejection_reason: initialGuessResult.rejectionReason,
      detected_content: initialGuessResult.detectedContent,
      detailed_description: initialGuessResult.detailedDescription,
      suggested_action: initialGuessResult.suggestedAction,
      non_travel_category: initialGuessResult.nonTravelCategory,
    };
  }

  const initialGuesses = initialGuessResult.places;
  onProgress?.("Fetching place candidates and reference photos...");

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
  {
    "place": "${bestMatch.name}",
    "city": "...",
    "country": "...",
    "type": "...",
    "ai_reasoning": ["...", "..."]
  }
  (Note: "city" must be the city, province, or metropolitan area where this landmark is situated, e.g. "Bangkok", "Chiang Rai", "Chiang Mai", "Tokyo", "Paris")`
    : `The user uploaded an image. Our retrieval system found these candidate locations based on your initial analysis:
  Best candidate: ${bestMatch.name}
  Other candidates found: ${topCandidates.slice(1, 3).map(c => c.name).join(", ")}

  Based on the visual content of the image, reason about which of these locations is the best match and why.
  Return the result in strictly valid JSON format:
  {
    "place": "${bestMatch.name}",
    "city": "...",
    "country": "...",
    "type": "...",
    "ai_reasoning": ["...", "..."]
  }
  (Note: "city" must be the city, province, or metropolitan area where this landmark is situated, e.g. "Bangkok", "Chiang Rai", "Chiang Mai", "Tokyo", "Paris")`;

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
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  language: "th" | "en" = "th"
): Promise<string> {
  const modelId = MODEL_ID_MAP[model];

  const systemPromptTh = `[Character Concept — Pixinerary]
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
เกิดขึ้นเมื่อผู้ใช้ระบุคำสั่งที่ "ชัดเจน เจาะจง และมีข้อมูลครบถ้วน" หรือ "ผู้ใช้ตอบยืนยันข้อเสนอที่พิกซ์เพิ่งถามไป" เช่น:
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
        { "id": "...", "time": "09:00", "title": "...", "title_th": "...", "title_en": "...", "description": "...", "description_th": "...", "description_en": "...", "type": "attraction", "lat": 1.23, "lng": 4.56 }
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
- "updated_itinerary" ต้องเป็น array เต็มของทุกวันรวมส่วนที่แก้ไขแล้ว โดยระบุทั้ง title_th, title_en, description_th, description_en เสมอ
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
- [กรณีพิกซ์อัปเดตแผนเสร็จเรียบร้อยแล้ว]: ให้ตัวเลือกเป็นคำสั่งหรือคำถามต่อเนื่อง เช่น ["แผนลงตัวแล้ว ขอบคุณครับ", "ช่วยแนะนำร้านอาหารใกล้แผนวันนี้", "อยากปรับเวลาให้ยืดหยุ่นขึ้นอีก"]
(ความยาวกระชับ 10-30 ตัวอักษรต่อตัวเลือก จำนวน 3-4 ตัวเลือก)`;

  const systemPromptEn = `[Character Concept — Pixinerary]
Name: Pix
Full Name: Pix (derived from Picture + Pixinerary, because our standout feature is turning travel photos into real personalized itineraries)
Title: Your AI Travel Companion
Role: AI Travel Guide & Personal Itinerary Concierge
Personality: Warm, polite, friendly, smart, enthusiastic, an authentic globetrotter who cares and plans ahead for you.
Trip Destination: ${locationName}

🚨 [MANDATORY LANGUAGE & ADDRESSING RULES]:
- YOU MUST RESPOND IN NATURAL, FLUENT, POLITE ENGLISH.
- Address the user warmly as "you" (never say "customer", "client", "sir/madam", "boss", etc.).
- Never speak like a cold robot or corporate helpdesk.
- Keep responses engaging, concise, and easy to read.
- DO NOT use markdown asterisks '*' or '**' in conversational messages. Use line breaks, clean bullet points, and cheerful emojis instead.
- Do NOT output raw JSON to the user directly. Always speak in warm, conversational English, and append the JSON action block at the very end when applicable.

📸 Vision & Visual Expertise (Visual Companion):
Pix specializes in recognizing destinations from photos and analyzing travel sights.

Current Trip Context:
Preferences: ${preferences ? JSON.stringify(preferences) : "Not specified"}
Current Itinerary: ${JSON.stringify(itinerary)}

🎯 [CRITICAL: Decision-Making & Action Execution Protocol]:
Pix is a thoughtful travel companion and NEVER modifies the itinerary rashly when requests are vague or lack key details.

1️⃣ [DIRECT EXECUTION - Clear or Confirmed Actions]:
Applies when the user gives a specific instruction (e.g., "Delete activity 2 on Day 1", "Move Grand Palace to Day 2 at 10:00 AM", "Set budget to $2,000", "Switch hotel to Marriott", "Flight TG682") or confirms Pix's previous proposal ("Sounds good, add it", "Yes, schedule it for Day 1", "Confirm delete"):
Respond politely and pleasantly, summarize the updates, and append a JSON code block at the very end:
\`\`\`json
{
  "action": "UPDATE_ITINERARY",
  "updated_itinerary": [
    {
      "day": 1,
      "date": "Day 1 - ...",
      "activities": [
        { "id": "...", "time": "09:00", "title": "...", "title_th": "...", "title_en": "...", "description": "...", "description_th": "...", "description_en": "...", "type": "attraction", "lat": 1.23, "lng": 4.56 }
      ]
    }
  ],
  "updated_preferences": { "budget": "...", "pace": "..." },
  "updated_hotel": { "hotelName": "..." },
  "updated_flight": { "flightCode": "...", "originIata": "..." },
  "suggested_quick_actions": ["The plan looks great, thanks!", "Recommend nearby lunch spots", "Make the pace more relaxed"]
}
\`\`\`
- Include only fields that changed.
- "updated_itinerary" must be the complete array of all days with both English and Thai activity titles/descriptions (title_en, title_th, description_en, description_th).
- Keep original id, lat, lng for existing places; for new places use "act-new-...".

2️⃣ [CLARIFY & CONFIRM FIRST - Vague Requests or Recommendations]:
When user asks vague additions ("Want to visit Tokyo Tower", "Craving ramen"), requests recommendations ("Any nice cafes?", "Scenic viewpoints nearby?"), or requests broad adjustments ("Make it more relaxed", "Cut down some activities"):
Provide friendly advice and recommendations first, suggest the optimal day and time slot based on geographical proximity, and append ONLY suggested_quick_actions in English:
\`\`\`json
{
  "suggested_quick_actions": ["Yes, add this to the plan", "Can we schedule for afternoon?", "Show other nearby options", "Cancel for now"]
}
\`\`\`

⚡ [RULES FOR QUICK ACTIONS]:
In every response, anticipate 3-4 natural next user replies in English and include them in "suggested_quick_actions" (10-35 characters each).`;

  const systemPrompt = language === "en" ? systemPromptEn : systemPromptTh;

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

  const totalDays = Math.max(1, preferences.days || 1);
  const daySchemaExamples = Array.from({ length: Math.min(totalDays, 4) }, (_, i) => {
    const d = i + 1;
    return `      {
        "day": ${d},
        "date": "Day ${d} - [District / Area Theme]",
        "activities": [
          { "time": "09:30", "title": "...", "title_th": "...", "title_en": "...", "english_name": "...", "wiki_title": "...", "image_keyword": "...", "description": "...", "description_th": "...", "description_en": "...", "type": "culture", "lat": 0, "lng": 0, "openingHours": ["Monday: 08:30 – 17:30", "Tuesday: 08:30 – 17:30", "Wednesday: 08:30 – 17:30", "Thursday: 08:30 – 17:30", "Friday: 08:30 – 17:30", "Saturday: 08:30 – 17:30", "Sunday: 08:30 – 17:30"] },
          { "time": "12:00", "title": "... (Lunch)", "title_th": "...", "title_en": "...", "english_name": "...", "wiki_title": "...", "image_keyword": "...", "description": "...", "description_th": "...", "description_en": "...", "type": "food", "lat": 0, "lng": 0, "openingHours": ["Monday: 11:00 – 21:30", "Tuesday: 11:00 – 21:30", "Wednesday: 11:00 – 21:30", "Thursday: 11:00 – 21:30", "Friday: 11:00 – 22:00", "Saturday: 11:00 – 22:00", "Sunday: 11:00 – 21:30"] },
          { "time": "14:30", "title": "...", "title_th": "...", "title_en": "...", "english_name": "...", "wiki_title": "...", "image_keyword": "...", "description": "...", "description_th": "...", "description_en": "...", "type": "landmark", "lat": 0, "lng": 0, "openingHours": ["Monday: 10:00 – 20:00", "Tuesday: 10:00 – 20:00", "Wednesday: 10:00 – 20:00", "Thursday: 10:00 – 20:00", "Friday: 10:00 – 20:00", "Saturday: 10:00 – 20:00", "Sunday: 10:00 – 20:00"] },
          { "time": "18:00", "title": "... (Dinner / Night)", "title_th": "...", "title_en": "...", "english_name": "...", "wiki_title": "...", "image_keyword": "...", "description": "...", "description_th": "...", "description_en": "...", "type": "nightlife", "lat": 0, "lng": 0, "openingHours": ["Monday: 17:00 – 00:00", "Tuesday: 17:00 – 00:00", "Wednesday: 17:00 – 00:00", "Thursday: 17:00 – 00:00", "Friday: 17:00 – 01:00", "Saturday: 17:00 – 01:00", "Sunday: 17:00 – 00:00"] }
        ]
      }`;
  }).join(",\n");

  const prompt = `Generate a ${totalDays}-day travel itinerary and additional suggestions for a trip covering these locations: ${places.join(", ")}.
  
  Trip Dates: ${startFmt} to ${endFmt} (${totalDays} days in ${monthName} – ${season})
  ${hotelInfoText}
  ${spatialConstraintsText}
  Traveler Profile:
  - Type: ${preferences.travelerType}
  - Budget: ${preferences.budget}
  - Preferred Activities: ${preferences.activities.join(", ")}
  - Travel Pace: ${preferences.pace}
  
  CRITICAL ITINERARY PLANNING RULES (MANDATORY):
  0. MANDATORY TRIP DURATION & MULTI-DAY EXPANSION (CRITICAL):
     - The user explicitly requested a ${totalDays}-DAY itinerary.
     - You MUST generate an "itinerary" array containing EXACTLY ${totalDays} separate day objects (from Day 1 up to Day ${totalDays}).
     - NEVER return fewer than ${totalDays} days! (e.g. if the trip is 3 days, you MUST return an array with Day 1, Day 2, and Day 3).
     - MULTI-DAY EXPANSION: Even if the user provided only 1 or 2 initial locations (${places.join(", ")}), do NOT bunch everything onto Day 1!
       * Schedule the user's uploaded location(s) in Day 1 (and/or Day 2).
       * For all other days (Day 2, Day 3, up to Day ${totalDays}), YOU MUST ACTIVELY EXPAND and introduce the best complementary attractions, iconic sights, local food markets, and cultural landmarks in different geographic districts of the destination city.
       * Each day must be a full, engaging schedule with 3 to 5 realistic activities (Morning Sightseeing, Midday Lunch, Afternoon Attraction, Dinner/Nightlife).
       * RETURNING FEWER THAN ${totalDays} DAYS IS STRICTLY UNACCEPTABLE AND WILL BE REJECTED.
  1. UNTANGLED DAILY ROUTE & NO CIRCULAR LOOPING (OPEN PROGRESSION):
     - DO NOT force the 1st point and the last point of the day to meet or loop back to each other! Real travelers follow an OPEN forward path across the district:
       Morning Sightseeing -> Lunch nearby -> Afternoon Attraction -> Sunset Viewpoint -> Dinner / Night Market at the other end of the corridor.
     - NEVER organize a circular loop where the evening spot is right next to the morning start point while midday was far away.
     - Each day's travel route MUST progress smoothly in one direction without criss-crossing or zigzagging across town.
  2. STRICT GEOGRAPHIC DISTRICT GROUPING (NO REVISITING SAME DISTRICT ACROSS DAYS):
     - Group all places within the same neighborhood/district (within ~2.5-3.5 km) into the SAME day.
     - NEVER scatter places from the same district across different days (e.g., avoid visiting Grand Palace on Day 1 and returning to Wat Pho on Day 3).
  3. MANDATORY MIDDAY LUNCH (11:00 - 13:00 / 11:30 - 13:00):
     - EVERY single day MUST include a dedicated lunch restaurant/food activity in the midday slot (11:30 - 13:00) located within walking distance (<= 800m - 1km) of the morning attraction.
  4. STRICTLY NO CONSECUTIVE RESTAURANTS:
     - DO NOT schedule back-to-back restaurants or cafes in the same day without a sightseeing or cultural activity in between.
     - Structure per day: Morning Sightseeing -> Lunch (11:30-13:00) -> Afternoon Attraction -> Sunset/Golden Hour (17:00-18:30) -> Dinner/Nightlife (18:30-21:00).
  5. DEDICATED DAY-TRIP EXCURSION DAYS (>25 KM):
     - If visiting attractions outside the central urban area (>25-50 km, e.g. Ayutthaya, Safari World, Damnoen Saduak, Mt. Fuji), dedicate ONE ENTIRE DAY exclusively as a "Day-Trip Excursion". DO NOT mix a distant excursion with city-center walking spots on the same day.
  6. REAL-WORLD TIMING, CLOSING BUFFER & DWELL TIME (MANDATORY):
     - DWELL TIME CLOSING BUFFER: Do NOT schedule a venue right before it closes! The activity start time plus visit duration (dwell time, typically 1.5 - 2 hours) MUST be less than or equal to closing time (e.g., if a temple/museum closes at 18:00, schedule it to begin at 16:00 - 16:30 at the latest so visitors have ample time).
     - 24-HOUR ZONE EXCEPTION: Public districts, old towns, street food areas, walking streets, riverfronts, and beaches are open public zones assumed to be 24 hours.
     - Place observation decks/viewpoints/sunset spots at 16:30 - 18:30 (Golden Hour).
     - Place night markets, evening cruises, and nightlife after 18:30.
  7. COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every activity, suggestion, and accommodation based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  8. ACCOMMODATIONS RULE (MANDATORY): You MUST provide at least 5 to 8 diverse, real accommodations/hotels (luxury, boutique, mid-range, budget) located in or near the trip destinations. Include real hotel names with priceLevel from 1 (budget) to 4 (luxury).
  9. Use ONLY real, geocodable place names for activity "title". DO NOT include verbs (e.g., "Explore", "Visit", "Eat at", "Stroll") in the "title". Place descriptions in the "description" field.
  10. CATEGORY TYPE ACCURACY (MANDATORY):
      - Each activity "type" MUST accurately match its true function from one of these categories:
        * "culture" (historic temples, museums, ancient ruins, palaces, heritage monuments, art galleries)
        * "food" (restaurants, local street food, cafes, coffee shops, noodle bars, bakeries, dining spots)
        * "nature" (mountains, peaks, beaches, waterfalls, national parks, islands, lakes, gardens, viewpoints)
        * "adventure" (outdoor sports, boat tours, zipline, diving, rafting, kayaking, hiking trails, workshops)
        * "shopping" (night markets, walking streets, shopping malls, floating markets, bazaars, shopping plazas)
        * "nightlife" (rooftop bars, pubs, clubs, evening entertainment, night cruises, night illuminations)
        * "relax" (spas, onsen, hot springs, traditional massage, wellness retreats, relaxation)
        * "landmark" (iconic towers, glass skywalks, city observation decks, famous photo spots, instagrammable sights)
        * "entertainment" (theme parks, water parks, aquariums, zoos, safari parks, live shows, amusement parks)
        * "spiritual" (sacred shrines, mutelu blessing spots, holy relics, revered places of worship for fortune/luck)
        * "hotel" (hotels, resorts, check-in, check-out)
      - DO NOT default to "attraction". Choose the exact true category for every place.
  11. OPENING HOURS (MANDATORY):
      - For EVERY activity and suggestion, provide an authentic 7-day operating schedule in the "openingHours" array (Monday to Sunday) reflecting actual real-world venue hours (e.g. ["Monday: 08:30 – 17:30", "Tuesday: 08:30 – 17:30", "Wednesday: 08:30 – 17:30", "Thursday: 08:30 – 17:30", "Friday: 08:30 – 17:30", "Saturday: 08:30 – 17:30", "Sunday: 08:30 – 17:30"]). If closed on certain days, specify e.g. "Monday: Closed".
  12. ADJACENT HOP DISTANCE & COMMUTE LIMIT (10-15 KM HARD CEILING):
      - Consecutive activities (Activity 1 -> 2, 2 -> 3) within a day MUST be in close proximity (ideally <= 3 to 5 km, or 10-15 min travel).
      - HARD CEILING: The distance between any two consecutive activities MUST NOT exceed 10 to 15 km (or <= 20 to 30 min transit). Never jump across distant ends of the metropolis back and forth.
  13. BILINGUAL TRANSLATION (MANDATORY):
      - Every activity, every suggestion, and every accommodation MUST include both Thai ("title_th"/"name_th", "description_th") AND English ("title_en"/"name_en", "description_en") fields.
      - Provide natural, accurate translations in both Thai and English.

  Return the response strictly in JSON format matching this schema:
  {
    "destination_city": "Real city name e.g. Bangkok",
    "destination_country": "Real country name e.g. Thailand",
    "itinerary": [
${daySchemaExamples}
      /* MANDATORY: The "itinerary" array MUST contain EXACTLY ${totalDays} day items (Day 1 through Day ${totalDays}) */
    ],
    "suggestions": [
      {
        "name": "Primary Name",
        "name_th": "ชื่อภาษาไทย",
        "name_en": "English Name",
        "english_name": "English Name",
        "wiki_title": "...",
        "image_keyword": "...",
        "category": "food",
        "description": "Short description",
        "description_th": "คำอธิบายภาษาไทย",
        "description_en": "English description",
        "lat": 0,
        "lng": 0
      }
    ],
    "accommodations": [
      {
        "name": "Hotel Name",
        "name_th": "ชื่อโรงแรมภาษาไทย",
        "name_en": "English Hotel Name",
        "english_name": "English Hotel Name",
        "wiki_title": "...",
        "image_keyword": "...",
        "category": "hotel",
        "description": "Hotel overview",
        "description_th": "คำอธิบายที่พักภาษาไทย",
        "description_en": "English accommodation description",
        "lat": 0,
        "lng": 0,
        "priceLevel": 2
      }
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
  const parsed = safeParseJson<any>(text, { itinerary: [], suggestions: [], accommodations: [] });
  const rawCity = parsed.destination_city || (places[0] || "");
  const isPlaceLandmark = /(wat|temple|palace|shrine|museum|park|sanctuary|eatery|food|eateries)/i.test(rawCity);
  const destinationCity = isPlaceLandmark ? (parsed.destination_city || "Bangkok") : rawCity;
  const destinationCountry = parsed.destination_country || "Thailand";

  // FAIL-SAFE DAY EXPANSION GUARD:
  // If the AI returned fewer days than totalDays, expand to exactly totalDays!
  if (Array.isArray(parsed.itinerary)) {
    // If Day 1 has too many activities (e.g. >= 6) and subsequent days are missing, distribute them!
    if (parsed.itinerary.length === 1 && totalDays > 1 && parsed.itinerary[0]?.activities?.length >= 6) {
      const allActs = [...parsed.itinerary[0].activities];
      const perDay = Math.ceil(allActs.length / totalDays);
      const repartitionedDays: any[] = [];
      for (let d = 0; d < totalDays; d++) {
        const chunk = allActs.slice(d * perDay, (d + 1) * perDay);
        repartitionedDays.push({
          day: d + 1,
          date: `Day ${d + 1} - Exploring ${destinationCity}`,
          activities: chunk.length > 0 ? chunk : [],
        });
      }
      parsed.itinerary = repartitionedDays;
    }

    // If still fewer days than totalDays, populate missing days from suggestions or destination highlights
    while (parsed.itinerary.length < totalDays) {
      const nextDayNum = parsed.itinerary.length + 1;
      const suggestionsPool = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
      
      const dayActivities: any[] = [];
      const times = ["09:30", "12:30", "15:00", "18:30"];
      for (let tIdx = 0; tIdx < 4; tIdx++) {
        const sug = suggestionsPool.shift();
        if (sug) {
          dayActivities.push({
            time: times[tIdx],
            title: sug.name,
            english_name: sug.english_name || sug.name,
            wiki_title: sug.wiki_title,
            image_keyword: sug.image_keyword || sug.name,
            description: sug.description || `Explore ${sug.name} in ${destinationCity}`,
            type: sug.category || (tIdx === 1 ? "food" : tIdx === 3 ? "nightlife" : "landmark"),
            lat: sug.lat || 0,
            lng: sug.lng || 0,
            openingHours: sug.openingHours || null,
          });
        }
      }

      if (dayActivities.length === 0) {
        dayActivities.push(
          { time: "09:30", title: `${destinationCity} Cultural Center`, description: `Visit iconic cultural sights in ${destinationCity}`, type: "culture", lat: 0, lng: 0 },
          { time: "12:00", title: `Local Eatery & Street Food (${destinationCity})`, description: `Enjoy traditional lunch specialties`, type: "food", lat: 0, lng: 0 },
          { time: "14:30", title: `${destinationCity} City Landmark & Park`, description: `Relax and take photos at famous local landmark`, type: "landmark", lat: 0, lng: 0 },
          { time: "18:30", title: `${destinationCity} Night Market & Dining`, description: `Explore vibrant night market and evening street food`, type: "nightlife", lat: 0, lng: 0 }
        );
      }

      parsed.itinerary.push({
        day: nextDayNum,
        date: `Day ${nextDayNum} - Discovering ${destinationCity}`,
        activities: dayActivities,
      });
    }
  }

  return await formatResponse(parsed, destinationCity, destinationCountry);
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

  return safeParseJson<VisionResult>(raw);
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
  const result = safeParseJson<any>(text, { suggestions: [] });
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
  const result = safeParseJson<any>(text, { accommodations: [] });
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

export interface InitialGuessResult {
  isIdentifiablePlace: boolean;
  imageCategory: string;
  places: string[];
  rejectionReason?: string;
  detectedContent?: string;
  detailedDescription?: string;
  suggestedAction?: string;
  nonTravelCategory?: string;
}

export function inferFallbackNonTravelContent(category?: string, reason?: string): {
  detectedContent: string;
  detailedDescription: string;
  suggestedAction: string;
  nonTravelCategory: string;
} {
  const c = (category || "").toLowerCase();
  const r = (reason || "").toLowerCase();

  if (c.includes("food") || r.includes("อาหาร") || r.includes("กิน") || r.includes("dish") || r.includes("drink")) {
    return {
      detectedContent: "รูปถ่ายอาหาร / เครื่องดื่ม",
      detailedDescription: "ภาพนี้แสดงอาหารหรือเครื่องดื่มระยะใกล้ โดยไม่มีสถาปัตยกรรมหรือทิวทัศน์ที่สามารถระบุพิกัดสถานที่ได้",
      suggestedAction: "แนะนำให้อัปโหลดภาพหน้าร้าน บรรยากาศร้าน ป้ายชื่อร้าน หรือวิวสถานที่ท่องเที่ยวแทน",
      nonTravelCategory: "food_dish",
    };
  }
  if (c.includes("portrait") || c.includes("selfie") || r.includes("เซลฟี่") || r.includes("บุคคล") || r.includes("คน") || r.includes("selfie")) {
    return {
      detectedContent: "รูปเซลฟี่บุคคล / พอร์ตเทรต",
      detailedDescription: "ภาพนี้เน้นใบหน้าหรือตัวบุคคลเป็นหลัก โดยไม่มีจุดสังเกตทางธรรมชาติหรือแลนด์มาร์กท่องเที่ยว",
      suggestedAction: "แนะนำให้อัปโหลดภาพที่มีฉากหลังเป็นสถานที่ท่องเที่ยว หรือวิวทิวทัศน์แบบมุมกว้าง",
      nonTravelCategory: "selfie_portrait",
    };
  }
  if (c.includes("document") || c.includes("receipt") || r.includes("สลิป") || r.includes("ใบเสร็จ") || r.includes("เอกสาร") || r.includes("slip")) {
    return {
      detectedContent: "สลิปโอนเงิน / ใบเสร็จ / เอกสาร",
      detailedDescription: "ภาพนี้เป็นเอกสาร สลิปธุรกรรม หรือใบเสร็จรับเงิน ซึ่งไม่ใช่สถานที่ท่องเที่ยว",
      suggestedAction: "กรุณาอัปโหลดภาพสถานที่จริง เช่น วัด แหล่งท่องเที่ยว ภูเขา ทะเล หรือแลนด์มาร์ก",
      nonTravelCategory: "document_receipt",
    };
  }
  if (c.includes("screenshot") || r.includes("สกรีนช็อต") || r.includes("แคปหน้าจอ") || r.includes("screenshot")) {
    return {
      detectedContent: "ภาพแคปหน้าจอสมาร์ตโฟน / แชท",
      detailedDescription: "ภาพนี้เป็นภาพบันทึกหน้าจอโทรศัพท์หรือแอปพลิเคชัน ไม่ใช่ภาพถ่ายสถานที่ท่องเที่ยว",
      suggestedAction: "กรุณาอัปโหลดภาพถ่ายสถานที่ท่องเที่ยวจริงๆ เพื่อให้ AI สามารถนำไปจัดทริปได้",
      nonTravelCategory: "screenshot",
    };
  }
  if (c.includes("pet") || c.includes("animal") || r.includes("สัตว์") || r.includes("แมว") || r.includes("สุนัข") || r.includes("dog") || r.includes("cat")) {
    return {
      detectedContent: "สัตว์เลี้ยง / สัตว์",
      detailedDescription: "ภาพนี้แสดงสัตว์เลี้ยงหรือสัตว์ในระยะใกล้ ไม่สามารถระบุพิกัดสถานที่ท่องเที่ยวได้",
      suggestedAction: "แนะนำให้อัปโหลดภาพสถานที่ท่องเที่ยว ปาร์ค หรือสวนสัตว์ที่มีป้ายชื่อชัดเจน",
      nonTravelCategory: "pet_animal",
    };
  }
  if (c.includes("vehicle") || c.includes("car") || r.includes("รถ") || r.includes("ยานพาหนะ")) {
    return {
      detectedContent: "ยานพาหนะ / รถยนต์",
      detailedDescription: "ภาพนี้เป็นภาพยานพาหนะหรือชิ้นส่วนรถยนต์ ไม่ปรากฏทิวทัศน์สถานที่ท่องเที่ยว",
      suggestedAction: "แนะนำให้อัปโหลดภาพวิวการเดินทางหรือจุดหมายปลายทางแทน",
      nonTravelCategory: "vehicle",
    };
  }
  if (c.includes("meme") || c.includes("graphic") || r.includes("มีม") || r.includes("การ์ตูน") || r.includes("drawing")) {
    return {
      detectedContent: "ภาพกราฟิก / มีม / การ์ตูน",
      detailedDescription: "ภาพนี้เป็นภาพวาด ภาพกราฟิก หรือมีม ซึ่งไม่ใช่ภาพถ่ายสถานที่จริงในโลกกายภาพ",
      suggestedAction: "กรุณาอัปโหลดภาพถ่ายสถานที่จริงสำหรับการท่องเที่ยว",
      nonTravelCategory: "graphic_meme",
    };
  }
  if (c.includes("blur") || c.includes("dark") || r.includes("เบลอ") || r.includes("มืด")) {
    return {
      detectedContent: "ภาพเบลอ / มืดสนิทจนมองไม่ชัด",
      detailedDescription: "ภาพนี้มีความคมชัดต่ำ มืด หรือเบลอมากเกินกว่าจะมองเห็นรายละเอียดสถานที่ได้",
      suggestedAction: "กรุณาอัปโหลดภาพถ่ายที่มีแสงสว่างเพียงพอและเห็นทิวทัศน์ชัดเจน",
      nonTravelCategory: "blurry_dark",
    };
  }
  if (c.includes("object") || r.includes("สิ่งของ") || r.includes("สินค้า") || r.includes("วัตถุ")) {
    return {
      detectedContent: "สิ่งของเครื่องใช้ / สินค้า",
      detailedDescription: "ภาพนี้แสดงสิ่งของเครื่องใช้หรือผลิตภัณฑ์ ไม่ใช่ทิวทัศน์สถานที่ท่องเที่ยว",
      suggestedAction: "กรุณาอัปโหลดภาพสถานที่ท่องเที่ยว หรือวิวทัศน์ของการเดินทาง",
      nonTravelCategory: "item_product",
    };
  }

  return {
    detectedContent: "ภาพที่ไม่ใช่สถานที่ท่องเที่ยว",
    detailedDescription: "ระบบประเมินว่าภาพนี้ไม่ใช่ทิวทัศน์หรือแลนด์มาร์กสำหรับการท่องเที่ยว",
    suggestedAction: "กรุณาอัปโหลดภาพถ่ายสถานที่ท่องเที่ยว วิวธรรมชาติ หรือสถาปัตยกรรมใหม่อีกครั้ง",
    nonTravelCategory: "other_non_travel",
  };
}

async function getInitialGuessesOpenRouter(
  base64: string,
  mimeType: string,
  prompt: string,
  modelId: string
): Promise<InitialGuessResult> {
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
  let result: any;
  try {
    result = safeParseJson<any>(raw);
  } catch (e) {
    console.error("Failed to parse JSON from Vision API:", raw, e);
    throw new Error("Vision API returned non-JSON response.");
  }

  // Backward compatibility: if result is directly an array
  if (Array.isArray(result)) {
    return {
      isIdentifiablePlace: result.length > 0,
      imageCategory: "landmark",
      places: result,
    };
  }

  // Extract places array safely
  const places: string[] = Array.isArray(result.places) ? result.places : [];

  // Determine if this is an identifiable travel place
  const isIdentifiable =
    result.is_identifiable_place !== false &&
    places.length > 0 &&
    !["portrait_selfie", "selfie", "document_screenshot", "document", "receipt", "meme", "object", "food_drink", "food"].includes(
      (result.image_category || "").toLowerCase()
    );

  const imageCategory = result.image_category || (isIdentifiable ? "landmark" : "non_travel");
  const fallbackInfo = !isIdentifiable
    ? inferFallbackNonTravelContent(result.image_category || result.non_travel_category, result.rejection_reason)
    : undefined;

  const rejectionReason =
    result.rejection_reason ||
    (fallbackInfo ? fallbackInfo.detailedDescription : undefined);

  const detectedContent = result.detected_content || fallbackInfo?.detectedContent;
  const detailedDescription = result.detailed_description || fallbackInfo?.detailedDescription;
  const suggestedAction = result.suggested_action || fallbackInfo?.suggestedAction;
  const nonTravelCategory = result.non_travel_category || fallbackInfo?.nonTravelCategory;

  return {
    isIdentifiablePlace: isIdentifiable,
    imageCategory,
    places,
    rejectionReason,
    detectedContent,
    detailedDescription,
    suggestedAction,
    nonTravelCategory,
  };
}

async function fetchCandidateFromGoogle(name: string): Promise<Omit<ImageCandidate, 'similarity'> | null> {
  const photoUrl = await fetchSmartPhoto(name, { category: "sightseeing" });
  return {
    name,
    place_id: `geo-${encodeURIComponent(name)}`,
    photo_url: photoUrl
  };
}

// ==========================================
// UTILS
// ==========================================

/**
 * Accurately determines the true categorical type of an activity
 * based on LLM output, Google Places API types, and Thai/English keyword heuristics.
 * Covers: culture, food, nature, adventure, shopping, nightlife, relax, landmark, entertainment, spiritual (+ hotel, transport).
 */
export function inferActivityType(
  title: string = "",
  description: string = "",
  rawType?: string,
  googleTypes: string[] = []
): "culture" | "food" | "nature" | "adventure" | "shopping" | "nightlife" | "relax" | "landmark" | "entertainment" | "spiritual" | "hotel" | "transport" | "attraction" {
  const t = `${title} ${description}`.toLowerCase();
  const gt = (googleTypes || []).map((x) => x.toLowerCase());
  const r = (rawType || "").toLowerCase().trim();

  // 1. Hotel / Accommodation
  if (
    r === "hotel" ||
    gt.some((g) => ["lodging", "hotel", "resort_hotel", "motel", "hostel", "bed_and_breakfast"].includes(g)) ||
    t.includes("check in") || t.includes("check-in") || t.includes("check out") || t.includes("check-out") ||
    t.includes("โรงแรม") || t.includes("ที่พัก") || t.includes("รีสอร์ท") || t.includes("โฮสเทล")
  ) {
    return "hotel";
  }

  // 2. Food & Dining
  if (
    r === "food" || r === "restaurant" || r === "cafe" || r === "dining" ||
    gt.some((g) => ["restaurant", "cafe", "food", "bakery", "meal_takeaway", "meal_delivery", "coffee_shop", "ice_cream_shop", "diner"].includes(g)) ||
    t.includes("restaurant") || t.includes("cafe") || t.includes("coffee") || t.includes("dining") ||
    t.includes("bistro") || t.includes("eatery") || t.includes("kitchen") || t.includes("ramen") ||
    t.includes("noodle") || t.includes("bakery") || t.includes("breakfast") || t.includes("lunch") ||
    t.includes("dinner") || t.includes("seafood") || t.includes("grill") || t.includes("bbq") ||
    t.includes("buffet") || t.includes("dessert") || t.includes("tea room") ||
    t.includes("ร้านอาหาร") || t.includes("คาเฟ่") || t.includes("ก๋วยเตี๋ยว") || t.includes("ข้าวมันไก่") ||
    t.includes("ส้มตำ") || t.includes("อาหาร") || t.includes("ชาบู") || t.includes("หมูกระทะ") ||
    t.includes("ของกิน") || t.includes("กาแฟ") || t.includes("เบเกอรี่") || t.includes("ครัว") ||
    t.includes("โภชนา") || t.includes("ภัตตาคาร") || t.includes("ซีฟู้ด")
  ) {
    return "food";
  }

  // 3. Spiritual / สายมู (Mutelu, Fortune, Blessing, Sacred Shrines)
  if (
    r === "spiritual" || r === "mutelu" ||
    t.includes("มูเตลู") || t.includes("สายมู") || t.includes("ขอพร") || t.includes("สักการะ") ||
    t.includes("ศาลหลักเมือง") || t.includes("ท้าวมหาพรหม") || t.includes("พระพรหม") ||
    t.includes("พระพิฆเนศ") || t.includes("พระราหู") || t.includes("ไอ้ไข่") || t.includes("พญานาค") ||
    t.includes("คำชะโนด") || t.includes("แชกงมิว") || t.includes("หวังต้าเซียน") ||
    t.includes("เจ้าแม่กวนอิม") || t.includes("เซียนแปะ") || t.includes("สิ่งศักดิ์สิทธิ์") ||
    t.includes("mutelu") || t.includes("spiritual") || t.includes("blessing") || t.includes("fortune") ||
    t.includes("sacred shrine") || t.includes("worship")
  ) {
    return "spiritual";
  }

  // 4. Landmark & Photo Spots (Observation decks, Skywalks, Famous Photo Viewpoints)
  if (
    r === "landmark" || r === "photo" ||
    t.includes("skywalk") || t.includes("observation deck") || t.includes("skydeck") ||
    t.includes("view deck") || t.includes("photo spot") || t.includes("instagram") ||
    t.includes("street art") || t.includes("photogenic") || t.includes("shibuya sky") ||
    t.includes("mahanakhon") || t.includes("จุดเช็คอิน") || t.includes("สกายวอล์ค") ||
    t.includes("จุดชมวิวเมือง") || t.includes("แลนด์มาร์ก") || t.includes("ถ่ายรูป") ||
    t.includes("หอคอย") || t.includes("ตึกมหานคร") || t.includes("tokyo tower") || t.includes("eiffel")
  ) {
    return "landmark";
  }

  // 5. Entertainment & Theme Parks (Amusement parks, Water parks, Zoos, Aquariums, Shows)
  if (
    r === "entertainment" ||
    gt.some((g) => ["amusement_park", "water_park", "aquarium", "zoo", "bowling_alley", "movie_theater"].includes(g)) ||
    t.includes("theme park") || t.includes("amusement park") || t.includes("water park") ||
    t.includes("aquarium") || t.includes("zoo") || t.includes("safari") || t.includes("disneyland") ||
    t.includes("universal studios") || t.includes("legoland") || t.includes("illusion") ||
    t.includes("magic show") || t.includes("cinema") || t.includes("theater") || t.includes("planetarium") ||
    t.includes("สวนสนุก") || t.includes("สวนน้ำ") || t.includes("สวนสัตว์") || t.includes("อควาเรียม") ||
    t.includes("ซาฟารี") || t.includes("โรงละคร") || t.includes("การแสดงโชว์") || t.includes("พิพิธภัณฑ์สัตว์น้ำ")
  ) {
    return "entertainment";
  }

  // 6. Culture & Heritage (Historic Temples, Palaces, Museums, Ancient Ruins)
  if (
    r === "culture" || r === "historic" || r === "museum" || r === "temple" ||
    gt.some((g) => ["museum", "place_of_worship", "church", "mosque", "synagogue", "art_gallery", "city_hall", "monument", "historical_landmark", "cultural_center"].includes(g)) ||
    t.includes("temple") || t.includes("wat ") || t.includes("wat_") || t.includes("shrine") ||
    t.includes("palace") || t.includes("museum") || t.includes("sanctuary") || t.includes("pagoda") ||
    t.includes("cathedral") || t.includes("church") || t.includes("monastery") || t.includes("castle") ||
    t.includes("historic") || t.includes("monument") || t.includes("heritage") || t.includes("ruins") ||
    t.includes("art gallery") || t.includes("archaeological") || t.includes("cultural center") ||
    t.includes("วัด") || t.includes("ศาลเจ้า") || t.includes("พระราชวัง") || t.includes("พิพิธภัณฑ์") ||
    t.includes("โบราณสถาน") || t.includes("ปราสาท") || t.includes("หอศิลป์") || t.includes("อนุสาวรีย์") ||
    t.includes("สถูป") || t.includes("เจดีย์") || t.includes("วิหาร") || t.includes("อุโบสถ") ||
    t.includes("มัสยิด") || t.includes("โบสถ์") || t.includes("กำแพงเมือง")
  ) {
    return "culture";
  }

  // 7. Nature & Scenic (National parks, mountains, beaches, waterfalls, islands, viewpoints)
  if (
    r === "nature" ||
    gt.some((g) => ["natural_feature", "park", "national_park", "state_park", "forest", "beach", "hiking_area"].includes(g)) ||
    t.includes("national park") || t.includes("mountain") || t.includes("peak") || t.includes("doi ") ||
    t.includes("khao ") || t.includes("beach") || t.includes("waterfall") || t.includes("island") ||
    t.includes("koh ") || t.includes("ko ") || t.includes("lake") || t.includes("bay") ||
    t.includes("forest") || t.includes("canyon") || t.includes("garden") || t.includes("viewpoint") ||
    t.includes("valley") || t.includes("trail") || t.includes("cliff") || t.includes("botanical") ||
    t.includes("scenic") || t.includes("panorama") ||
    t.includes("อุทยาน") || t.includes("ดอย") || t.includes("เขา") || t.includes("หาด") ||
    t.includes("น้ำตก") || t.includes("เกาะ") || t.includes("อ่าว") || t.includes("สวนดอกไม้") ||
    t.includes("จุดชมวิว") || t.includes("ทะเล") || t.includes("ภู") || t.includes("ผา") ||
    t.includes("ถ้ำ") || t.includes("แก่ง") || t.includes("หุบเขา") || t.includes("สวนพฤกษศาสตร์")
  ) {
    return "nature";
  }

  // 8. Shopping & Markets (Walking streets, night markets, malls, bazaars)
  if (
    r === "shopping" || r === "market" ||
    gt.some((g) => ["shopping_mall", "department_store", "clothing_store", "supermarket", "market", "grocery_store"].includes(g)) ||
    t.includes("shopping") || t.includes("night market") || t.includes("market") || t.includes("floating market") ||
    t.includes("walking street") || t.includes("mall") || t.includes("plaza") || t.includes("bazaar") ||
    t.includes("outlet") || t.includes("supermarket") || t.includes("department store") ||
    t.includes("ตลาด") || t.includes("ถนนคนเดิน") || t.includes("ห้าง") || t.includes("ช้อปปิ้ง") ||
    t.includes("ตลาดนัด") || t.includes("ตลาดน้ำ") || t.includes("มอลล์") || t.includes("พลาซ่า")
  ) {
    return "shopping";
  }

  // 9. Nightlife & Entertainment (Rooftops, Bars, Pubs, Clubs, Night cruises)
  if (
    r === "nightlife" || r === "bar" || r === "pub" || r === "club" ||
    gt.some((g) => ["night_club", "bar", "pub", "cocktail_bar", "wine_bar", "karaoke"].includes(g)) ||
    t.includes("nightlife") || t.includes("rooftop") || t.includes("bar") || t.includes("pub") ||
    t.includes("club") || t.includes("nightclub") || t.includes("lounge") || t.includes("beer") ||
    t.includes("cocktail") || t.includes("night cruise") || t.includes("speakeasy") ||
    t.includes("บาร์") || t.includes("ผับ") || t.includes("รูฟท็อป") || t.includes("ค็อกเทล") ||
    t.includes("เลานจ์") || t.includes("ราตรี") || t.includes("ไนต์คลับ")
  ) {
    return "nightlife";
  }

  // 10. Relax & Wellness (Spas, Onsen, Hot springs, Traditional Massage)
  if (
    r === "relax" || r === "rest" || r === "wellness" || r === "spa" ||
    gt.some((g) => ["spa", "beauty_salon", "sauna", "massage"].includes(g)) ||
    t.includes("spa") || t.includes("onsen") || t.includes("hot spring") || t.includes("massage") ||
    t.includes("wellness") || t.includes("relaxation") || t.includes("thai massage") || t.includes("retreat") ||
    t.includes("สปา") || t.includes("ออนเซ็น") || t.includes("น้ำพุร้อน") || t.includes("นวด") ||
    t.includes("นวดแผนไทย") || t.includes("ผ่อนคลาย") || t.includes("เวลเนส")
  ) {
    return "relax";
  }

  // 11. Adventure & Sports (Outdoor sports, Diving, Zipline, Rafting, Workshops)
  if (
    r === "adventure" || r === "activity" ||
    t.includes("adventure") || t.includes("diving") || t.includes("snorkeling") ||
    t.includes("zipline") || t.includes("cooking class") || t.includes("workshop") ||
    t.includes("rafting") || t.includes("kayak") || t.includes("boat tour") || t.includes("cable car") ||
    t.includes("ล่องแพ") || t.includes("ดำน้ำ") || t.includes("กิจกรรม") || t.includes("ผจญภัย") ||
    t.includes("ซิปไลน์") || t.includes("เวิร์กช็อป") || t.includes("ล่องแก่ง") || t.includes("ปีนเขา")
  ) {
    return "adventure";
  }

  // 12. Transport
  if (
    r === "transport" ||
    gt.some((g) => ["airport", "train_station", "transit_station", "bus_station", "subway_station", "ferry_terminal"].includes(g)) ||
    t.includes("airport") || t.includes("station") || t.includes("terminal") || t.includes("pier") ||
    t.includes("ferry") || t.includes("สนามบิน") || t.includes("สถานีรถไฟ") || t.includes("ท่าเรือ")
  ) {
    return "transport";
  }

  // Direct valid match fallback
  if (["culture", "food", "nature", "adventure", "activity", "shopping", "nightlife", "relax", "landmark", "photo", "entertainment", "spiritual", "hotel", "transport"].includes(r)) {
    if (r === "activity") return "adventure";
    if (r === "photo") return "landmark";
    return r as any;
  }

  return "attraction";
}

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

export async function fetchPlacePhoto(placeName: string, category?: string): Promise<string | null> {
  return await fetchSmartPhoto(placeName, { category });
}

async function formatResponse(result: any, cityName?: string, countryName?: string): Promise<TravelPlanResponse> {
  const itinerary: DayPlan[] = await Promise.all((result.itinerary || []).map(async (day: any, dayIdx: number) => ({
    ...day,
    activities: await Promise.all((day.activities || []).map(async (act: any, actIdx: number) => {
      const searchKeyword = act.image_keyword || act.english_name || act.title;
      const indexOffset = dayIdx * 10 + actIdx;
      const details = await fetchPlaceDetails(
        act.title,
        (act.lat && act.lng) ? { lat: act.lat, lng: act.lng } : undefined,
        act.type,
        cityName,
        searchKeyword,
        { countryName, wikiTitle: act.wiki_title, indexOffset }
      );
      const accurateType = inferActivityType(act.title, act.description, act.type, details?.types);
      const resolvedLat = (act.lat && act.lat !== 0) ? act.lat : (details.lat ?? 0);
      const resolvedLng = (act.lng && act.lng !== 0) ? act.lng : (details.lng ?? 0);
      const photo = details.photo_url || getCuratedFallbackPhoto(accurateType, searchKeyword || act.title, { cityName, countryName, indexOffset });
      return {
        ...act,
        type: accurateType,
        id: act.id || `gen-${Math.random().toString(36).substr(2, 9)}`,
        lat: resolvedLat,
        lng: resolvedLng,
        image_url: photo,
        image: photo,
        photo_url: photo,
        rating: details.rating,
        userRatingsTotal: details.userRatingsTotal,
        openNow: details.openNow,
        openingHours: details.openingHours,
        priceLevel: details.priceLevel,
        website: details.website,
        phoneNumber: details.phoneNumber,
        title_th: act.title_th || (hasThaiScript(act.title) ? act.title : translateTextSync(act.title, "th")),
        title_en: act.title_en || act.english_name || (!hasThaiScript(act.title) ? act.title : translateTextSync(act.title, "en")),
        description_th: act.description_th || (hasThaiScript(act.description) ? act.description : translateTextSync(act.description, "th")),
        description_en: act.description_en || (!hasThaiScript(act.description) ? act.description : translateTextSync(act.description, "en")),
        english_name: act.english_name || act.title_en || (!hasThaiScript(act.title) ? act.title : translateTextSync(act.title, "en")),
        wiki_title: act.wiki_title,
        image_keyword: act.image_keyword,
      };
    })),
  })));

  const suggestions: SuggestedPlace[] = await Promise.all((result.suggestions || []).map(async (sug: any, sugIdx: number) => {
    const searchKeyword = sug.image_keyword || sug.english_name || sug.name;
    const indexOffset = 100 + sugIdx;
    const details = await fetchPlaceDetails(
      sug.name,
      (sug.lat && sug.lng) ? { lat: sug.lat, lng: sug.lng } : undefined,
      sug.category,
      cityName,
      searchKeyword,
      { countryName, wikiTitle: sug.wiki_title, indexOffset }
    );
    const accurateCategory = inferActivityType(sug.name, sug.description, sug.category, details?.types);
    const resolvedPhoto = details.photo_url || getCuratedFallbackPhoto(accurateCategory, searchKeyword || sug.name, { cityName, countryName, indexOffset });
    const name_th = sug.name_th || (hasThaiScript(sug.name) ? sug.name : translateTextSync(sug.name, "th"));
    const name_en = sug.name_en || sug.english_name || (!hasThaiScript(sug.name) ? sug.name : translateTextSync(sug.name, "en"));
    const desc_th = sug.description_th || (hasThaiScript(sug.description) ? sug.description : translateTextSync(sug.description, "th"));
    const desc_en = sug.description_en || (!hasThaiScript(sug.description) ? sug.description : translateTextSync(sug.description, "en"));
    return {
      ...sug,
      category: (accurateCategory === "transport" ? "attraction" : accurateCategory) as any,
      id: `sug-${Math.random().toString(36).substr(2, 9)}`,
      image: resolvedPhoto,
      image_url: resolvedPhoto,
      photo_url: resolvedPhoto,
      lat: (sug.lat && sug.lat !== 0) ? sug.lat : (details.lat ?? 0),
      lng: (sug.lng && sug.lng !== 0) ? sug.lng : (details.lng ?? 0),
      openingHours: details.openingHours,
      rating: details.rating ?? sug.rating,
      userRatingsTotal: details.userRatingsTotal ?? sug.userRatingsTotal,
      openNow: details.openNow ?? sug.openNow,
      priceLevel: details.priceLevel ?? sug.priceLevel,
      website: details.website ?? sug.website,
      phoneNumber: details.phoneNumber ?? sug.phoneNumber,
      name_th,
      name_en,
      title_th: name_th,
      title_en: name_en,
      description_th: desc_th,
      description_en: desc_en,
      english_name: name_en,
      wiki_title: sug.wiki_title,
      image_keyword: sug.image_keyword,
    };
  }));

  const accommodations: SuggestedPlace[] = await Promise.all((result.accommodations || []).map(async (acc: any, accIdx: number) => {
    const searchKeyword = acc.image_keyword || acc.english_name || acc.name;
    const indexOffset = 200 + accIdx;
    const details = await fetchPlaceDetails(
      acc.name,
      (acc.lat && acc.lng) ? { lat: acc.lat, lng: acc.lng } : undefined,
      "hotel",
      cityName,
      searchKeyword,
      { countryName, wikiTitle: acc.wiki_title, indexOffset }
    );
    const resolvedPhoto = details.photo_url || getCuratedFallbackPhoto("hotel", searchKeyword || acc.name, { cityName, countryName, indexOffset });
    const name_th = acc.name_th || (hasThaiScript(acc.name) ? acc.name : translateTextSync(acc.name, "th"));
    const name_en = acc.name_en || acc.english_name || (!hasThaiScript(acc.name) ? acc.name : translateTextSync(acc.name, "en"));
    const desc_th = acc.description_th || (hasThaiScript(acc.description) ? acc.description : translateTextSync(acc.description, "th"));
    const desc_en = acc.description_en || (!hasThaiScript(acc.description) ? acc.description : translateTextSync(acc.description, "en"));
    return {
      ...acc,
      category: "hotel" as const,
      id: `acc-${Math.random().toString(36).substr(2, 9)}`,
      image: resolvedPhoto,
      image_url: resolvedPhoto,
      photo_url: resolvedPhoto,
      lat: (acc.lat && acc.lat !== 0) ? acc.lat : (details.lat ?? 0),
      lng: (acc.lng && acc.lng !== 0) ? acc.lng : (details.lng ?? 0),
      openingHours: details.openingHours,
      rating: details.rating ?? acc.rating,
      userRatingsTotal: details.userRatingsTotal ?? acc.userRatingsTotal,
      openNow: details.openNow ?? acc.openNow,
      priceLevel: details.priceLevel ?? acc.priceLevel,
      website: details.website ?? acc.website,
      phoneNumber: details.phoneNumber ?? acc.phoneNumber,
      name_th,
      name_en,
      title_th: name_th,
      title_en: name_en,
      description_th: desc_th,
      description_en: desc_en,
      english_name: name_en,
      wiki_title: acc.wiki_title,
      image_keyword: acc.image_keyword,
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
