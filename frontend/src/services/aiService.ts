import { type DayPlan } from "@/components/TravelItinerary";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { type AIProviderType } from "@/context/AIProviderContext";
import { safeFetch, validateApiKey } from "@/utils/apiUtils";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Validation at module load or initialization
validateApiKey(GOOGLE_MAPS_API_KEY, \"Google Maps\");

export interface TravelPlanResponse {
  itinerary: DayPlan[];
  suggestions: SuggestedPlace[];
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
  days: number;
  travelerType: string;
  budget: string;
  activities: string[];
  pace: string;
}

// ==========================================
// PUBLIC API
// ==========================================

export async function generateTravelPlan(places: string[], preferences: TripPreferences, provider: AIProviderType): Promise<TravelPlanResponse> {
  if (provider === "openai") {
    return callOpenAI(places, preferences);
  } else {
    return callGemini(places, preferences);
  }
}

export async function analyzeImage(file: File, provider: AIProviderType): Promise<VisionResult> {
  console.log("Starting Retrieval-LLM pipeline for image...");
  
  // 1. Get uploaded image embedding
  const userImageEmbedding = await getEmbedding(file);
  
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
  if (provider === "openai") {
    initialGuesses = await getInitialGuessesOpenAI(base64Data, file.type, candidatePrompt);
  } else {
    initialGuesses = await getInitialGuessesGemini(base64Data, file.type, candidatePrompt);
  }

  console.log("Initial guesses from LLM:", initialGuesses);

  // 3. Retrieve real candidates and photos from Google Places
  const candidates: ImageCandidate[] = [];
  for (const guess of initialGuesses.slice(0, 5)) {
    const placeData = await fetchCandidateFromGoogle(guess);
    
    let similarity = 0; // Default zero unless CLIP confirmation works
    let photo_url = "";
    let place_id = "";
    let name = guess;

    if (placeData) {
      name = placeData.name;
      place_id = placeData.place_id;
      photo_url = placeData.photo_url || "";

      if (photo_url) {
        try {
          // Calculate similarity for visual confirmation
          const candidateEmbedding = await getEmbeddingFromUrl(photo_url);
          similarity = cosineSimilarity(userImageEmbedding, candidateEmbedding);
        } catch (e) {
          console.warn(`Failed to compute similarity for ${guess}:`, e);
        }
      }
    }

    candidates.push({
      name,
      place_id,
      photo_url,
      similarity
    });
  }

  // 4. Rank candidates by similarity (Always return Top-3)
  candidates.sort((a, b) => b.similarity - a.similarity);
  const topCandidates = candidates.slice(0, 3);
  console.log("Ranked candidates (Top 3):", topCandidates);

  if (topCandidates.length === 0) {
    // This should only happen if initialGuesses itself was empty
    throw new Error("Vision AI failed to generate any initial locations for analysis.");
  }

  const bestMatch = topCandidates[0];

  // 5. Final LLM reasoning with retrieval context
  const reasoningPrompt = `The user uploaded an image. Our visual retrieval system found a strong match:
  Identified Place: ${bestMatch.name} (Similarity Score: ${bestMatch.similarity.toFixed(2)})
  Other similar places found: ${topCandidates.slice(1, 3).map(c => `${c.name} (${c.similarity.toFixed(2)})`).join(", ")}

  Provide a detailed reasoning for why this match is likely correct based on visual features typical of ${bestMatch.name}.
  Return the result in strictly valid JSON format:
  {
    "place": "${bestMatch.name}",
    "country": "...",
    "type": "...",
    "ai_reasoning": ["...", "..."]
  }`;

  let finalResult: any;
  if (provider === "openai") {
    finalResult = await analyzeImageOpenAI(base64Data, file.type, reasoningPrompt);
  } else {
    finalResult = await analyzeImageGemini(base64Data, file.type, reasoningPrompt);
  }

  return {
    ...finalResult,
    confidence: bestMatch.similarity,
    similar_locations: topCandidates.slice(1, 3).map(c => ({ name: c.name, similarity: c.similarity })),
    initial_candidates: candidates.slice(0, 5),
    top_candidates: topCandidates
  };
}

export async function chatWithAssistant(userMessage: string, locationName: string, provider: AIProviderType): Promise<string> {
  const systemPrompt = `You are a helpful AI travel assistant for ${locationName}. The user is looking for advice, recommendations, or itinerary modifications. Keep your answers concise, friendly, and well-formatted with markdown.`;

  if (provider === "openai") {
    return chatOpenAI(userMessage, systemPrompt);
  } else {
    return chatGemini(userMessage, systemPrompt);
  }
}

// ==========================================
// INTERNAL - OPENAI
// ==========================================

async function callOpenAI(places: string[], preferences: TripPreferences): Promise<TravelPlanResponse> {
  const prompt = `Generate a ${preferences.days}-day travel itinerary and additional suggestions for a trip covering these locations: ${places.join(", ")}.
  
  Traveler Profile:
  - Type: ${preferences.travelerType}
  - Budget: ${preferences.budget}
  - Preferred Activities: ${preferences.activities.join(", ")}
  - Travel Pace: ${preferences.pace}
  
  Requirements:
  - Incorporate all locations mentioned.
  - Distribute days across locations logically.
  - Suggest activities matching the traveler profile and pace.
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
          "type": "attraction",
          "lat": 0,
          "lng": 0
        }]
    }],
    "suggestions": [{ "name": "...", "category": "food", "description": "...", "lat": 0, "lng": 0 }]
  }`;

  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      messages: [{ role: \"user\", content: prompt }]
    }),
  });

  const text = data.text;
  return await formatResponse(JSON.parse(text));
}

async function analyzeImageOpenAI(base64: string, mimeType: string, prompt: string): Promise<VisionResult> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      messages: [
        {
          role: \"user\",
          content: [
            { type: \"text\", text: prompt },
            { type: \"image_url\", image_url: { url: `data:${mimeType};base64,${base64}` } }
          ],
        }
      ]
    }),
  });

  return JSON.parse(data.text);
}

async function chatOpenAI(userMessage: string, systemPrompt: string): Promise<string> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      messages: [
        { role: \"system\", content: systemPrompt },
        { role: \"user\", content: userMessage }
      ]
    }),
  });

  return data.text;
}

// ==========================================
// INTERNAL - GEMINI
// ==========================================

async function callGemini(places: string[], preferences: TripPreferences): Promise<TravelPlanResponse> {
  const prompt = `Generate a ${preferences.days}-day travel itinerary and additional suggestions for a trip covering these locations: ${places.join(", ")}.
  
  Traveler Profile:
  - Type: ${preferences.travelerType}
  - Budget: ${preferences.budget}
  - Preferred Activities: ${preferences.activities.join(", ")}
  - Travel Pace: ${preferences.pace}
  
  Requirements:
  - Incorporate all locations mentioned.
  - Distribute days across locations logically.
  - Suggest activities matching the traveler profile and pace.
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
          "type": "attraction",
          "lat": 0,
          "lng": 0
        }]
    }],
    "suggestions": [{ "name": "...", "category": "food", "description": "...", "lat": 0, "lng": 0 }]
  }`;

  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      prompt: prompt
    }),
  });

  const text = data.text;
  return await formatResponse(JSON.parse(text));
}

async function analyzeImageGemini(base64: string, mimeType: string, prompt: string): Promise<VisionResult> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      prompt: prompt,
      image_base64: base64,
      mime_type: mimeType
    }),
  });

  const text = data.text;
  return JSON.parse(text);
}

async function chatGemini(userMessage: string, systemPrompt: string): Promise<string> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      prompt: systemPrompt + \"\n\nUser: \" + userMessage
    }),
  });

  return data.text;
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

async function getInitialGuessesOpenAI(base64: string, mimeType: string, prompt: string): Promise<string[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/openai`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
      messages: [
        {
          role: \"user\",
          content: [
            { type: \"text\", text: prompt },
            { type: \"image_url\", image_url: { url: `data:${mimeType};base64,${base64}` } }
          ],
        }
      ]
    }),
  });
  const result = JSON.parse(data.text);
  return result.places;
}

async function getInitialGuessesGemini(base64: string, mimeType: string, prompt: string): Promise<string[]> {
  const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL}/gemini`, {
    method: \"POST\",
    headers: { \"Content-Type\": \"application/json\" },
    body: JSON.stringify({
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

async function fetchPlacePhoto(placeName: string): Promise<string | null> {
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
      const photo = await fetchPlacePhoto(act.title);
      return {
        ...act,
        id: `gen-${Math.random().toString(36).substr(2, 9)}`,
        image_url: photo,
      };
    })),
  })));

  const suggestions: SuggestedPlace[] = await Promise.all((result.suggestions || []).map(async (sug: any) => {
    const photo = await fetchPlacePhoto(sug.name);
    return {
      ...sug,
      id: `sug-${Math.random().toString(36).substr(2, 9)}`,
      image: photo || `https://source.unsplash.com/800x600/?travel,landmark`,
      image_url: photo,
      photo_url: photo,
    };
  }));

  return { itinerary, suggestions };
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
      method: \"POST\",
      headers: { \"Content-Type\": \"application/json\" },
      body: JSON.stringify({
        prompt: \"Hello\"
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
      method: \"POST\",
      headers: { \"Content-Type\": \"application/json\" },
      body: JSON.stringify({
        messages: [{ role: \"user\", content: \"Hello\" }]
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
