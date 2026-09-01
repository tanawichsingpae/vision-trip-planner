import { type DayPlan } from "@/components/TravelItinerary";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { type AIModelType, type AIProviderType, MODEL_ID_MAP } from "@/context/AIProviderContext";
import { safeFetch, validateApiKey } from "@/utils/apiUtils";
import { fetchPlaceDetails } from "@/api/places";
import { type DayCluster } from "@/api/spatialPlanner";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Validation at module load or initialization
validateApiKey(GOOGLE_MAPS_API_KEY, "Google Maps");

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
  if (model.startsWith("openai")) {
    return callOpenAI(places, preferences, modelId, dayClusters);
  } else {
    return callGemini(places, preferences, modelId, dayClusters);
  }
}

export async function generateMoreSuggestions(locationName: string, existingPlaces: string[], model: AIModelType): Promise<SuggestedPlace[]> {
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

  if (model.startsWith("openai")) {
    return callOpenAIMoreSuggestions(prompt, modelId);
  } else {
    return callGeminiMoreSuggestions(prompt, modelId);
  }
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

  if (model.startsWith("openai")) {
    return callOpenAIMoreAccommodations(prompt, modelId);
  } else {
    return callGeminiMoreAccommodations(prompt, modelId);
  }
}

export async function analyzeImage(
  file: File,
  model: AIModelType,
  useClip: boolean = true,
  onProgress?: (step: string) => void
): Promise<VisionResult> {
  const modelId = MODEL_ID_MAP[model];
  const isOpenAI = model.startsWith("openai");
  console.log(`Starting Retrieval-LLM pipeline (model: ${modelId}, CLIP: ${useClip})...`);

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

  let initialGuesses: string[];
  if (isOpenAI) {
    initialGuesses = await getInitialGuessesOpenAI(base64Data, file.type, candidatePrompt, modelId);
  } else {
    initialGuesses = await getInitialGuessesGemini(base64Data, file.type, candidatePrompt, modelId);
  }

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

  let finalResult: any;
  if (isOpenAI) {
    finalResult = await analyzeImageOpenAI(base64Data, file.type, reasoningPrompt, modelId);
  } else {
    finalResult = await analyzeImageGemini(base64Data, file.type, reasoningPrompt, modelId);
  }

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
  preferences: TripPreferences | null
): Promise<string> {
  const modelId = MODEL_ID_MAP[model];
  const systemPrompt = `You are a highly friendly, enthusiastic, and helpful AI travel guide for ${locationName}. 
You MUST use a conversational, natural, and engaging tone, frequently using cute emojis (like 😊, 🌟, 🗺️, ✈️, 🎒) to make the user feel welcome and excited about their trip.
DO NOT output raw JSON data as your direct response to the user. Always answer naturally.

You have access to the user's current travel plan context:
Preferences: ${preferences ? JSON.stringify(preferences) : "Not provided"}
Current Itinerary: ${JSON.stringify(itinerary)}

When answering, refer to their current plan if relevant and give specific advice.

[Action Protocol - CRITICAL]
If the user asks you to add, remove, or modify an activity in their itinerary (e.g., "Add a cafe", "Remove the museum", "Change this to day 2"), you MUST edit the itinerary and return the FULLY updated itinerary array.
To do this, append a JSON code block at the VERY END of your message using exactly this format:

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
  ]
}
\`\`\`

- Only include this JSON block if you are making a modification to the itinerary.
- "updated_itinerary" MUST be the complete array of all days with all activities, including your modifications.
- Preserve existing "id", "lat", and "lng" values for activities you do not modify. For new activities, make up a unique "id" (e.g., "act-new-123").`;

  if (model.startsWith("openai")) {
    return chatOpenAI(userMessage, systemPrompt, modelId);
  } else {
    return chatGemini(userMessage, systemPrompt, modelId);
  }
}

// ==========================================
// INTERNAL - OPENAI
// ==========================================

async function callOpenAI(
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

  const spatialConstraintsText = dayClusters && dayClusters.length > 0
    ? `\nSPATIAL CLUSTER & DIRECTIONAL CONSTRAINTS (MANDATORY TO FOLLOW):
The locations have been partitioned into ${dayClusters.length} spatial daily clusters with Macro-TSP progression.
${dayClusters.map((c) => `Day ${c.day} Cluster Zone:
- Centroid: Lat ${c.centroid?.lat.toFixed(4) || "N/A"}, Lng ${c.centroid?.lng.toFixed(4) || "N/A"}${c.radiusKm ? ` (Max Radius: ${c.radiusKm.toFixed(1)} km)` : ""}
- Suggested Anchors: ${c.pois.map(p => p.name).slice(0, 4).join(", ")}
- Rule for Day ${c.day}: Keep ALL activities for Day ${c.day} strictly clustered in this specific geographic zone. DO NOT jump to another district. Progress smoothly along an open linear or curved path from morning to evening.`).join("\n")}\n`
    : "";

  const prompt = `Generate a ${preferences.days}-day travel itinerary and additional suggestions for a trip covering these locations: ${places.join(", ")}.
  
  Trip Dates: ${startFmt} to ${endFmt} (${preferences.days} days in ${monthName} – ${season})
  ${spatialConstraintsText}
  Traveler Profile:
  - Type: ${preferences.travelerType}
  - Budget: ${preferences.budget}
  - Preferred Activities: ${preferences.activities.join(", ")}
  - Travel Pace: ${preferences.pace}
  
  Requirements:
  - Incorporate all locations mentioned.
  - Distribute days across locations logically.
  - Suggest activities matching the traveler profile, pace, AND the season/month (e.g., avoid water activities in winter, recommend seasonal festivals, adjust for weather).
  - COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every activity and suggestion based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  - Use ONLY real, geocodable place names for activity "title".
  - DO NOT include verbs (e.g., "Explore", "Visit", "Eat at", "Stroll") or descriptive sentences in the "title".
  - Place any descriptive details or actions in the "description" field instead.
  
  Return the response strictly in JSON format:
  {
    "itinerary": [{
        "day": 1,
        "date": "Day 1 - ...",
        "activities": [{ 
          "time": "09:00", 
          "title": "...", 
          "description": "...", 
          "type": "attraction", (MUST be one of: attraction, food, nature, culture, activity, shopping, nightlife, relax, transport, rest)
          "lat": 0,
          "lng": 0
        }]
    }],
    "suggestions": [{ "name": "...", "category": "food", (MUST be one of: attraction, food, nature, culture, activity, shopping, nightlife, relax) "description": "...", "lat": 0, "lng": 0 }],
    "accommodations": [{ "name": "...", "category": "hotel", "description": "...", "lat": 0, "lng": 0, "priceLevel": 2 }],
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

  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }]
    }),
  });

  const text = data.text;
  return await formatResponse(JSON.parse(text));
}

async function analyzeImageOpenAI(base64: string, mimeType: string, prompt: string, modelId: string): Promise<VisionResult> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
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
      ]
    }),
  });

  const raw = data.text?.trim() ?? "";

  // GPT-4o sometimes returns a refusal ("I'm sorry...") instead of JSON
  // Detect it early and throw a clear error
  if (!raw.startsWith("{") && !raw.startsWith("[")) {
    console.warn("GPT-4o returned non-JSON (possible refusal):", raw.substring(0, 120));
    throw new Error(`AI declined to analyze this image. Try a different image or switch to Gemini.`);
  }

  // Strip markdown JSON fence if present
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

async function chatOpenAI(userMessage: string, systemPrompt: string, modelId: string): Promise<string> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      expect_json: false
    }),
  });

  return data.text;
}

async function callOpenAIMoreSuggestions(prompt: string, modelId: string): Promise<SuggestedPlace[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }]
    }),
  });

  const text = data.text;
  const result = JSON.parse(text);
  const response = await formatResponse({ itinerary: [], suggestions: result.suggestions || [] });
  return response.suggestions;
}

async function callOpenAIMoreAccommodations(prompt: string, modelId: string): Promise<SuggestedPlace[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }]
    }),
  });

  const text = data.text;
  const result = JSON.parse(text);
  const response = await formatResponse({ itinerary: [], suggestions: [], accommodations: result.accommodations || [] });
  return response.accommodations;
}

// ==========================================
// INTERNAL - GEMINI
// ==========================================

async function callGemini(
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

  const spatialConstraintsText = dayClusters && dayClusters.length > 0
    ? `\nSPATIAL CLUSTER & DIRECTIONAL CONSTRAINTS (MANDATORY TO FOLLOW):
The locations have been partitioned into ${dayClusters.length} spatial daily clusters with Macro-TSP progression.
${dayClusters.map((c) => `Day ${c.day} Cluster Zone:
- Centroid: Lat ${c.centroid?.lat.toFixed(4) || "N/A"}, Lng ${c.centroid?.lng.toFixed(4) || "N/A"}${c.radiusKm ? ` (Max Radius: ${c.radiusKm.toFixed(1)} km)` : ""}
- Suggested Anchors: ${c.pois.map(p => p.name).slice(0, 4).join(", ")}
- Rule for Day ${c.day}: Keep ALL activities for Day ${c.day} strictly clustered in this specific geographic zone. DO NOT jump to another district. Progress smoothly along an open linear or curved path from morning to evening.`).join("\n")}\n`
    : "";

  const prompt = `Generate a ${preferences.days}-day travel itinerary and additional suggestions for a trip covering these locations: ${places.join(", ")}.
  
  Trip Dates: ${startFmt} to ${endFmt} (${preferences.days} days in ${monthName} – ${season})
  ${spatialConstraintsText}
  Traveler Profile:
  - Type: ${preferences.travelerType}
  - Budget: ${preferences.budget}
  - Preferred Activities: ${preferences.activities.join(", ")}
  - Travel Pace: ${preferences.pace}
  
  Requirements:
  - Incorporate all locations mentioned.
  - Distribute days across locations logically.
  - Suggest activities matching the traveler profile, pace, AND the season/month (e.g., avoid water activities in winter, recommend seasonal festivals, adjust for weather).
  - COORDINATES RULE: Provide real, accurate latitude and longitude ("lat" and "lng") for every activity and suggestion based on real Google Maps data. DO NOT return 0 or fictional coordinates.
  - Use ONLY real, geocodable place names for activity "title".
  - DO NOT include verbs (e.g., "Explore", "Visit", "Eat at", "Stroll") or descriptive sentences in the "title".
  - Place any descriptive details or actions in the "description" field instead.
  
  Return the response strictly in JSON format matching this schema:
  {
    "itinerary": [{
        "day": 1,
        "date": "Day 1 - ...",
        "activities": [{ 
          "time": "09:00", 
          "title": "...", 
          "description": "...", 
          "type": "attraction", (MUST be one of: attraction, food, nature, culture, activity, shopping, nightlife, relax, transport, rest)
          "lat": 0,
          "lng": 0
        }]
    }],
    "suggestions": [{ "name": "...", "category": "food", (MUST be one of: attraction, food, nature, culture, activity, shopping, nightlife, relax) "description": "...", "lat": 0, "lng": 0 }],
    "accommodations": [{ "name": "...", "category": "hotel", "description": "...", "lat": 0, "lng": 0, "priceLevel": 2 }],
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

  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      prompt: prompt
    }),
  });

  const text = data.text;
  return await formatResponse(JSON.parse(text));
}

async function analyzeImageGemini(base64: string, mimeType: string, prompt: string, modelId: string): Promise<VisionResult> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      prompt: prompt,
      image_base64: base64,
      mime_type: mimeType
    }),
  });

  const text = data.text;
  return JSON.parse(text);
}

async function chatGemini(userMessage: string, systemPrompt: string, modelId: string): Promise<string> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      prompt: systemPrompt + "\n\nUser: " + userMessage,
      expect_json: false
    }),
  });

  return data.text;
}

async function callGeminiMoreSuggestions(prompt: string, modelId: string): Promise<SuggestedPlace[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, prompt }),
  });

  const text = data.text;
  const result = JSON.parse(text);
  const response = await formatResponse({ itinerary: [], suggestions: result.suggestions || [] });
  return response.suggestions;
}

async function callGeminiMoreAccommodations(prompt: string, modelId: string): Promise<SuggestedPlace[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, prompt }),
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

async function getInitialGuessesOpenAI(base64: string, mimeType: string, prompt: string, modelId: string): Promise<string[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
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
      ]
    }),
  });
  const result = JSON.parse(data.text);
  if (!result || !Array.isArray(result.places)) {
    console.error("OpenAI returned invalid format:", result);
    throw new Error("Vision API returned invalid format for places.");
  }
  return result.places;
}

async function getInitialGuessesGemini(base64: string, mimeType: string, prompt: string, modelId: string): Promise<string[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      prompt: prompt,
      image_base64: base64,
      mime_type: mimeType
    }),
  });
  const text = data.text;
  const result = JSON.parse(text);
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

export async function testGeminiConnection() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Hello"
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Test Error:", errorText);
      return false;
    }
    console.log("Gemini connection successful");
    return true;
  } catch (e) {
    console.error("Gemini connection failed", e);
    return false;
  }
}

export async function testOpenAIConnection() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/openai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }]
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Test Error:", errorText);
      return false;
    }
    console.log("OpenAI connection successful");
    return true;
  } catch (e) {
    console.error("OpenAI connection failed", e);
    return false;
  }
}
