import { type DayPlan } from "@/components/TravelItinerary";
import { type TripPreferences, type TypicalWeather, type VisionResult } from "@/services/aiService";
import { type SuggestedPlace } from "@/components/AISuggestedPlaces";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";

export interface UploadedLocationSnapshot {
  place: string;
  place_th?: string;
  city?: string;
  country: string;
  confidence: number;
  uploadedImageUrl?: string;
}

export interface BlindTrip {
  id: string;
  scenario_id: string;
  scenario_title: string;
  scenario_notes?: string;
  actual_model?: string;
  blind_label: string; // "แผน A", "แผน B", etc.
  itinerary: DayPlan[];
  preferences: TripPreferences;
  typicalWeather?: TypicalWeather;
  suggestions?: SuggestedPlace[];
  accommodations?: SuggestedPlace[];
  uploaded_locations?: UploadedLocationSnapshot[];
  created_at: string;
}

export interface ExpertProfile {
  role: string; // อาจารย์/นักวิชาการด้านการท่องเที่ยว, ผู้ประกอบการธุรกิจท่องเที่ยว, มัคคุเทศก์/ผู้นำเที่ยวมืออาชีพ, ผู้ชื่นชอบการท่องเที่ยวเชิงลึก, อื่นๆ
  role_other?: string;
  experience: string; // ต่ำกว่า 3 ปี, 3–5 ปี, 6–10 ปี, มากกว่า 10 ปี
  ai_familiarity: string; // ไม่เคยใช้เลย, เคยใช้บ้าง, ใช้เป็นประจำ
  saved_at?: string;
}

export interface DetailedDimensionScores {
  // ด้านที่ 1: ความถูกต้องของข้อมูล (Factual Accuracy: FA1-FA5)
  fa1: number;
  fa2: number;
  fa3: number;
  fa4: number;
  fa5: number;
  fa_avg: number;

  // ด้านที่ 2: การปฏิบัติตามข้อจำกัด (Constraint Compliance: CC1-CC5)
  cc1: number;
  cc2: number;
  cc3: number;
  cc4: number;
  cc5: number;
  cc_avg: number;

  // ด้านที่ 3: ความเป็นไปได้ในทางปฏิบัติ (Practical Feasibility: PF1-PF5)
  pf1: number;
  pf2: number;
  pf3: number;
  pf4: number;
  pf5: number;
  pf_avg: number;

  // ด้านที่ 4: ความสมเหตุสมผลเชิงพื้นที่ (Spatial Rationality: SR1-SR4)
  sr1: number;
  sr2: number;
  sr3: number;
  sr4: number;
  sr_avg: number;

  // ด้านที่ 5: ความหลากหลายและคุณภาพประสบการณ์ (Diversity & Experience Quality: DE1-DE5)
  de1: number;
  de2: number;
  de3: number;
  de4: number;
  de5: number;
  de_avg: number;

  // ด้านที่ 6: ความแข็งแกร่งต่อความไม่แน่นอน (Robustness to Uncertainty: RU1-RU4)
  ru1: number;
  ru2: number;
  ru3: number;
  ru4: number;
  ru_avg: number;

  // การประเมินรวมของโมเดลนี้
  overall_percentage: number; // 0-100% Slider
  strengths: string; // จุดเด่น
  weaknesses: string; // จุดอ่อน/ข้อควรปรับปรุง
  priority_improvement: string; // สิ่งที่ควรปรับปรุงเป็นอันดับแรก
  priority_improvement_other?: string;
}

export interface EvaluationScores {
  spatial_feasibility?: number; // 1-5 (backward compat)
  temporal_pacing?: number;     // 1-5 (backward compat)
  persona_alignment?: number;   // 1-5 (backward compat)
  attraction_quality?: number;  // 1-5 (backward compat)
  information_accuracy?: number;// 1-5 (backward compat)
  detailed?: DetailedDimensionScores;
}

export interface BlindEvaluationSubmission {
  scenario_id: string;
  trip_id: string;
  blind_label: string;
  expert_id: string;
  expert_name: string;
  expert_profile?: ExpertProfile;
  scores: EvaluationScores;
  detailed_scores?: DetailedDimensionScores;
  overall_pick?: boolean;
  feedback?: string;
}

export interface EvaluationRecord {
  id: string;
  scenario_id: string;
  trip_id: string;
  blind_label: string;
  actual_model: string;
  expert_id: string;
  expert_name: string;
  expert_profile?: ExpertProfile;
  scores: EvaluationScores;
  detailed_scores?: DetailedDimensionScores;
  overall_pick?: boolean;
  feedback?: string;
  submitted_at: string;
}

export interface ScenarioRankingItem {
  rank: number;
  trip_id: string;
  blind_label: string;
  rationale: string;
}

export interface ScenarioComparisonSubmission {
  scenario_id: string;
  expert_id: string;
  expert_name: string;
  expert_profile?: ExpertProfile;
  rankings: ScenarioRankingItem[];
  best_for_practical_use: {
    trip_id: string;
    blind_label: string;
    rationale: string;
  };
  qualitative_feedback: {
    q1_real_travel: string;
    q2_tourism_context: string;
    q3_value_experience: string;
    q4_distinct_differences: string;
  };
}

export interface ScenarioComparisonRecord extends ScenarioComparisonSubmission {
  id: string;
  submitted_at: string;
}

export interface ModelSummaryStat {
  model: string;
  evaluations_count: number;
  avg_spatial: number;
  avg_temporal: number;
  avg_persona: number;
  avg_attraction: number;
  avg_accuracy: number;
  // New 6 dimensions:
  avg_fa?: number;
  avg_cc?: number;
  avg_pf?: number;
  avg_sr?: number;
  avg_de?: number;
  avg_ru?: number;
  avg_overall_percentage?: number;
  overall_score: number;
  total_wins: number;
  win_rate_percent: number;
}

export interface UserRoleRecord {
  email: string;
  role: "dev" | "expert" | "user";
  name?: string;
  updated_at?: string;
}

export async function saveBlindTrip(payload: {
  scenario_id: string;
  scenario_title: string;
  scenario_notes?: string;
  actual_model: string;
  itinerary: DayPlan[];
  preferences: TripPreferences;
  typicalWeather?: TypicalWeather;
  suggestions?: SuggestedPlace[];
  accommodations?: SuggestedPlace[];
  uploaded_locations?: UploadedLocationSnapshot[];
}): Promise<{ status: string; trip_id: string; scenario_id: string }> {
  const res = await fetch(`${API_BASE}/blind_eval/save_trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save trip to Blind Evaluation");
  }
  return res.json();
}

export async function fetchBlindTrips(role: string = "user"): Promise<BlindTrip[]> {
  const res = await fetch(`${API_BASE}/blind_eval/trips?role=${encodeURIComponent(role)}`);
  if (!res.ok) throw new Error("Failed to fetch blind trips");
  const data = await res.json();
  return data.trips || [];
}

export async function deleteBlindTrip(tripId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/blind_eval/trip/${encodeURIComponent(tripId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete blind trip");
}

export async function submitBlindScore(submission: BlindEvaluationSubmission): Promise<{ status: string; eval_id: string }> {
  const res = await fetch(`${API_BASE}/blind_eval/submit_score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit blind evaluation score");
  }
  return res.json();
}

export async function submitScenarioComparison(
  submission: ScenarioComparisonSubmission
): Promise<{ status: string; comparison_id: string }> {
  const res = await fetch(`${API_BASE}/blind_eval/submit_comparison`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit scenario comparison");
  }
  return res.json();
}

export async function fetchBlindResults(): Promise<{
  evaluations: EvaluationRecord[];
  comparisons?: ScenarioComparisonRecord[];
  summary: ModelSummaryStat[];
  total_trips: number;
}> {
  const res = await fetch(`${API_BASE}/blind_eval/results`);
  if (!res.ok) throw new Error("Failed to fetch blind results");
  return res.json();
}

export async function fetchUserRoles(): Promise<UserRoleRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/users/roles`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.users || [];
  } catch (e) {
    console.warn("fetchUserRoles failed, using fallback:", e);
    return [];
  }
}

export async function saveUserRole(record: {
  email: string;
  role: "dev" | "expert" | "user";
  name?: string;
}): Promise<UserRoleRecord> {
  const res = await fetch(`${API_BASE}/users/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save user role");
  }
  const data = await res.json();
  return data.user;
}
