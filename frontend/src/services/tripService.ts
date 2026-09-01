import { supabase } from "@/lib/supabaseClient";
import { type DayPlan } from "@/components/TravelItinerary";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";
import { type TripPreferences, type VisionResult } from "@/services/aiService";
import { type ItineraryCoherence } from "@/api/spatialPlanner";
import { type EnvironmentData } from "@/services/environmentService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionSummary?: string;
  timestamp?: number;
  aiModel?: string;
  ai_model?: string;
}

export interface TripRecord {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  cover_image: string | null;
  status: "draft" | "planning" | "completed";
  preferences: TripPreferences | null;
  itinerary: DayPlan[];
  chat_messages: ChatMessage[];
  detected_locations: VisionResult[];
  suggestions: SuggestedPlace[];
  accommodations: SuggestedPlace[];
  coherence_score: ItineraryCoherence | null;
  environment_data: EnvironmentData | null;
  ai_model?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveTripPayload {
  id?: string;
  title?: string;
  destination?: string | null;
  cover_image?: string | null;
  status?: "draft" | "planning" | "completed";
  preferences?: TripPreferences | null;
  itinerary: DayPlan[];
  chat_messages?: ChatMessage[];
  detected_locations?: VisionResult[];
  suggestions?: SuggestedPlace[];
  accommodations?: SuggestedPlace[];
  coherence_score?: ItineraryCoherence | null;
  environment_data?: EnvironmentData | null;
  ai_model?: string | null;
}

/**
 * Saves a new trip or updates an existing trip in Supabase.
 */
export async function saveTrip(payload: SaveTripPayload): Promise<TripRecord> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนทำการบันทึกทริป");
  }

  const userId = userData.user.id;

  // Auto-generate title if missing
  const destinationName = payload.destination || (payload.detected_locations?.[0]?.place ?? "ทริปท่องเที่ยว");
  const daysCount = payload.preferences?.days || payload.itinerary.length || 1;
  const tripTitle = payload.title || `ทริป ${destinationName} ${daysCount} วัน`;

  // Determine cover image (prefer uploaded image or first attraction image)
  const coverImage =
    payload.cover_image ||
    payload.detected_locations?.[0]?.uploadedImageUrl ||
    payload.itinerary?.[0]?.activities?.[0]?.image_url ||
    payload.itinerary?.[0]?.activities?.[0]?.photo_url ||
    null;

  const effectiveModel =
    payload.ai_model ||
    payload.preferences?.aiModel ||
    payload.preferences?.ai_model ||
    null;

  const serializedPreferences = payload.preferences
    ? {
        ...payload.preferences,
        startDate: payload.preferences.startDate ? new Date(payload.preferences.startDate).toISOString() : undefined,
        endDate: payload.preferences.endDate ? new Date(payload.preferences.endDate).toISOString() : undefined,
        aiModel: effectiveModel || payload.preferences.aiModel,
        ai_model: effectiveModel || payload.preferences.ai_model,
      }
    : null;

  const serializedChatMessages = (payload.chat_messages || []).map((msg) => ({
    ...msg,
    aiModel: msg.aiModel || msg.ai_model || (msg.role === "assistant" ? effectiveModel || undefined : undefined),
    ai_model: msg.ai_model || msg.aiModel || (msg.role === "assistant" ? effectiveModel || undefined : undefined),
  }));

  const tripData: Record<string, any> = {
    user_id: userId,
    title: tripTitle,
    destination: destinationName,
    cover_image: coverImage,
    status: payload.status || "planning",
    preferences: serializedPreferences,
    itinerary: payload.itinerary,
    chat_messages: serializedChatMessages,
    detected_locations: payload.detected_locations || [],
    suggestions: payload.suggestions || [],
    accommodations: payload.accommodations || [],
    coherence_score: payload.coherence_score || null,
    environment_data: payload.environment_data || null,
    ai_model: effectiveModel,
    updated_at: new Date().toISOString(),
  };

  const executeSave = async (dataToSave: Record<string, any>) => {
    if (payload.id) {
      return supabase
        .from("trips")
        .update(dataToSave)
        .eq("id", payload.id)
        .select()
        .single();
    } else {
      return supabase
        .from("trips")
        .insert([dataToSave])
        .select()
        .single();
    }
  };

  let { data, error } = await executeSave(tripData);

  // Fallback: If column "ai_model" doesn't exist on Supabase table yet, retry without top-level ai_model column
  if (error && error.message && error.message.includes("ai_model")) {
    console.warn("[tripService] 'ai_model' column not found on trips table, falling back to JSONB preferences storage...");
    const { ai_model: _, ...dataWithoutAiModel } = tripData;
    const retryRes = await executeSave(dataWithoutAiModel);
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error("[tripService] Error saving trip:", error);
    throw error;
  }

  return {
    ...data,
    ai_model: data.ai_model || data.preferences?.aiModel || data.preferences?.ai_model || effectiveModel,
  } as TripRecord;
}

/**
 * Fetches all saved trips for the authenticated user.
 */
export async function getUserTrips(): Promise<TripRecord[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[tripService] Error fetching user trips:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    ...row,
    ai_model: row.ai_model || row.preferences?.aiModel || row.preferences?.ai_model || null,
    preferences: row.preferences
      ? {
          ...row.preferences,
          startDate: row.preferences.startDate ? new Date(row.preferences.startDate) : undefined,
          endDate: row.preferences.endDate ? new Date(row.preferences.endDate) : undefined,
        }
      : null,
  })) as TripRecord[];
}

/**
 * Fetches a single trip by ID.
 */
export async function getTripById(tripId: string): Promise<TripRecord | null> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (error) {
    console.error(`[tripService] Error fetching trip ${tripId}:`, error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    ai_model: data.ai_model || data.preferences?.aiModel || data.preferences?.ai_model || null,
    preferences: data.preferences
      ? {
          ...data.preferences,
          startDate: data.preferences.startDate ? new Date(data.preferences.startDate) : undefined,
          endDate: data.preferences.endDate ? new Date(data.preferences.endDate) : undefined,
        }
      : null,
  } as TripRecord;
}

/**
 * Deletes a trip by ID.
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId);

  if (error) {
    console.error(`[tripService] Error deleting trip ${tripId}:`, error);
    throw error;
  }
}
