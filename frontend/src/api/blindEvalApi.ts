import { supabase } from "@/lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";

export interface DatabaseStatus {
  connected: boolean;
  provider: "supabase" | "backend_local" | "disconnected";
  tripsCount: number;
  evalsCount: number;
  message?: string;
}

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
  name?: string;
  role: string; // อาจารย์/นักวิชาการด้านการท่องเที่ยว, ผู้ประกอบการธุรกิจท่องเที่ยว, มัคคุเทศก์/ผู้นำเที่ยวมืออาชีพ, ผู้ชื่นชอบการท่องเที่ยวเชิงลึก, อื่นๆ
  role_other?: string;
  experience: string; // ต่ำกว่า 3 ปี, 3–5 ปี, 6–10 ปี, มากกว่า 10 ปี
  ai_familiarity: string; // ไม่เคยใช้เลย, เคยใช้บ้าง, ใช้เป็นประจำ
  saved_at?: string;
}

const EXPERT_EMAIL_REGISTRY_KEY = "pixinerary_expert_email_registry";

/**
 * Maps an email to a unique, consistent default identifier: "Expert 1", "Expert 2", ...
 * Avoids duplicate evaluator names across different accounts when exporting data.
 */
export function getExpertDefaultName(
  email?: string | null,
  existingList?: Array<string | { email?: string; expert_id?: string }>
): string {
  if (!email || !email.trim()) {
    return "Expert 1";
  }

  const cleanEmail = email.trim().toLowerCase();

  let mapping: Record<string, number> = {};
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(EXPERT_EMAIL_REGISTRY_KEY) : null;
    if (raw) {
      mapping = JSON.parse(raw);
    }
  } catch {}

  // If existingList is provided, ensure known emails are registered in consistent sequence
  if (existingList && Array.isArray(existingList)) {
    // First pass: register any items that already have an explicit "Expert N" name
    existingList.forEach((item: any) => {
      if (typeof item === "object" && item) {
        const em = (item.email || item.expert_id || "").trim().toLowerCase();
        const match = typeof item.expert_name === "string" ? item.expert_name.match(/^Expert\s+(\d+)$/i) : null;
        if (em && match && !mapping[em]) {
          mapping[em] = parseInt(match[1], 10);
        }
      }
    });

    // Second pass: register remaining emails sequentially
    existingList.forEach((item: any) => {
      const em = (typeof item === "string" ? item : item?.email || item?.expert_id || "").trim().toLowerCase();
      if (em && !mapping[em]) {
        const nextIdx = Object.keys(mapping).length > 0 ? Math.max(...Object.values(mapping)) + 1 : 1;
        mapping[em] = nextIdx;
      }
    });
  }

  // If this email not yet in mapping, assign next sequential index
  if (!mapping[cleanEmail]) {
    const currentMax = Object.keys(mapping).length > 0 ? Math.max(...Object.values(mapping)) : 0;
    mapping[cleanEmail] = currentMax + 1;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(EXPERT_EMAIL_REGISTRY_KEY, JSON.stringify(mapping));
      }
    } catch {}
  }

  return `Expert ${mapping[cleanEmail]}`;
}

/**
 * Resolves the evaluator's display name:
 * If a custom name was set and is not the old mock default ("ดร. สมชาย"), return the custom name.
 * Otherwise, return the unique default "Expert 1", "Expert 2", ... derived from email.
 */
export function resolveEvaluatorName(
  name?: string | null,
  email?: string | null,
  existingList?: Array<string | { email?: string; expert_id?: string }>
): string {
  const trimmed = name?.trim();
  if (
    trimmed &&
    trimmed !== "ดร. สมชาย" &&
    trimmed !== "ดร. สมชาย (ผู้เชี่ยวชาญการท่องเที่ยว)" &&
    !trimmed.startsWith("ผู้ประเมินผู้เชี่ยวชาญ")
  ) {
    return trimmed;
  }
  return getExpertDefaultName(email, existingList);
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
  ru5?: number;
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

/**
 * Checks connectivity to Supabase and fallback backend.
 */
export async function checkDatabaseConnection(): Promise<DatabaseStatus> {
  try {
    const { data, error } = await supabase.from("blind_trips").select("id", { count: "exact" });
    if (!error && data !== null) {
      const { count: evalsCount } = await supabase.from("blind_evaluations").select("id", { count: "exact", head: true });
      return {
        connected: true,
        provider: "supabase",
        tripsCount: data.length,
        evalsCount: evalsCount || 0,
        message: "เชื่อมต่อ Supabase Database พร้อมใช้งาน",
      };
    }
  } catch (e) {
    console.warn("Supabase check failed, attempting backend check:", e);
  }

  // Fallback check to local Python backend
  try {
    const res = await fetch(`${API_BASE}/blind_eval/trips?role=dev`);
    if (res.ok) {
      const json = await res.json();
      return {
        connected: true,
        provider: "backend_local",
        tripsCount: (json.trips || []).length,
        evalsCount: 0,
        message: "เชื่อมต่อ Local Backend Server (JSON Storage)",
      };
    }
  } catch (e) {
    // Both failed
  }

  return {
    connected: false,
    provider: "disconnected",
    tripsCount: 0,
    evalsCount: 0,
    message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้",
  };
}

/**
 * Saves a new benchmark trip into Supabase blind_trips table (or backend fallback).
 */
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
  const tripId = `trip_${Math.random().toString(36).substring(2, 10)}`;
  
  // Try Supabase first
  try {
    const { error } = await supabase.from("blind_trips").insert([
      {
        id: tripId,
        scenario_id: (payload.scenario_id || "SC-DEFAULT").trim(),
        scenario_title: payload.scenario_title || payload.scenario_id,
        scenario_notes: payload.scenario_notes || "",
        actual_model: payload.actual_model,
        preferences: payload.preferences || {},
        itinerary: payload.itinerary || [],
        typical_weather: payload.typicalWeather || null,
        suggestions: payload.suggestions || [],
        accommodations: payload.accommodations || [],
        uploaded_locations: payload.uploaded_locations || [],
      },
    ]);

    if (!error) {
      return { status: "success", trip_id: tripId, scenario_id: payload.scenario_id };
    }
    console.warn("Supabase saveBlindTrip failed, trying fallback backend:", error);
  } catch (e) {
    console.warn("Supabase saveBlindTrip exception, trying fallback backend:", e);
  }

  // Fallback to Backend
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

/**
 * Fetches all blind trips from Supabase (or backend fallback) and assigns deterministic blind labels.
 */
export async function fetchBlindTrips(role: string = "user"): Promise<BlindTrip[]> {
  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("blind_trips")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const scenarioMap: Record<string, any[]> = {};
      for (const t of data) {
        const scId = t.scenario_id || "SC-DEFAULT";
        if (!scenarioMap[scId]) scenarioMap[scId] = [];
        scenarioMap[scId].push(t);
      }

      const labeled: BlindTrip[] = [];
      for (const scId of Object.keys(scenarioMap)) {
        const group = scenarioMap[scId];
        // Sort group deterministic
        const sorted = group.sort((a, b) => (a.created_at || a.id).localeCompare(b.created_at || b.id));
        sorted.forEach((item, idx) => {
          labeled.push({
            id: item.id,
            scenario_id: item.scenario_id,
            scenario_title: item.scenario_title,
            scenario_notes: item.scenario_notes,
            actual_model: role === "dev" ? item.actual_model : undefined,
            blind_label: `แผน ${String.fromCharCode(65 + idx)}`,
            itinerary: item.itinerary || [],
            preferences: item.preferences || {},
            typicalWeather: item.typical_weather,
            suggestions: item.suggestions || [],
            accommodations: item.accommodations || [],
            uploaded_locations: item.uploaded_locations || [],
            created_at: item.created_at,
          });
        });
      }
      return labeled;
    }
  } catch (e) {
    console.warn("Supabase fetchBlindTrips failed, falling back to backend:", e);
  }

  // Fallback to Backend
  const res = await fetch(`${API_BASE}/blind_eval/trips?role=${encodeURIComponent(role)}`);
  if (!res.ok) throw new Error("Failed to fetch blind trips");
  const data = await res.json();
  return data.trips || [];
}

/**
 * Deletes a blind trip from database.
 */
export async function deleteBlindTrip(tripId: string): Promise<void> {
  // Try Supabase first
  try {
    const { error } = await supabase.from("blind_trips").delete().eq("id", tripId);
    if (!error) return;
  } catch (e) {
    console.warn("Supabase deleteBlindTrip failed:", e);
  }

  // Fallback to Backend
  const res = await fetch(`${API_BASE}/blind_eval/trip/${encodeURIComponent(tripId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete blind trip");
}

/**
 * Submits expert 6-dimension evaluation score to Supabase blind_evaluations table.
 */
export async function submitBlindScore(
  submission: BlindEvaluationSubmission
): Promise<{ status: string; eval_id: string }> {
  const evalId = `eval_${Math.random().toString(36).substring(2, 10)}`;
  const ds = submission.detailed_scores;

  const fa_avg = ds?.fa_avg ?? (ds?.fa1 ? (ds.fa1 + ds.fa2 + ds.fa3 + ds.fa4 + ds.fa5) / 5.0 : submission.scores.information_accuracy || 3);
  const cc_avg = ds?.cc_avg ?? (ds?.cc1 ? (ds.cc1 + ds.cc2 + ds.cc3 + ds.cc4 + ds.cc5) / 5.0 : submission.scores.persona_alignment || 3);
  const pf_avg = ds?.pf_avg ?? (ds?.pf1 ? (ds.pf1 + ds.pf2 + ds.pf3 + ds.pf4 + ds.pf5) / 5.0 : submission.scores.temporal_pacing || 3);
  const sr_avg = ds?.sr_avg ?? (ds?.sr1 ? (ds.sr1 + ds.sr2 + ds.sr3 + ds.sr4) / 4.0 : submission.scores.spatial_feasibility || 3);
  const de_avg = ds?.de_avg ?? (ds?.de1 ? (ds.de1 + ds.de2 + ds.de3 + ds.de4 + ds.de5) / 5.0 : submission.scores.attraction_quality || 3);
  const ru_avg = ds?.ru_avg ?? (ds?.ru1 ? (ds.ru1 + ds.ru2 + ds.ru3 + ds.ru4) / 4.0 : 3);

  // Try Supabase first
  try {
    // Find actual_model for background auditing
    let actualModel = "unknown";
    const { data: tripRow } = await supabase
      .from("blind_trips")
      .select("actual_model")
      .eq("id", submission.trip_id)
      .maybeSingle();

    if (tripRow?.actual_model) {
      actualModel = tripRow.actual_model;
    }

    const { error } = await supabase.from("blind_evaluations").insert([
      {
        id: evalId,
        scenario_id: submission.scenario_id,
        trip_id: submission.trip_id,
        blind_label: submission.blind_label,
        actual_model: actualModel,
        expert_id: submission.expert_id,
        expert_name: submission.expert_name,
        expert_profile: submission.expert_profile || {},
        scores: {
          spatial_feasibility: Math.round(sr_avg),
          temporal_pacing: Math.round(pf_avg),
          persona_alignment: Math.round(cc_avg),
          attraction_quality: Math.round(de_avg),
          information_accuracy: Math.round(fa_avg),
        },
        detailed_scores: {
          ...(ds || {}),
          fa_avg: Number(fa_avg.toFixed(2)),
          cc_avg: Number(cc_avg.toFixed(2)),
          pf_avg: Number(pf_avg.toFixed(2)),
          sr_avg: Number(sr_avg.toFixed(2)),
          de_avg: Number(de_avg.toFixed(2)),
          ru_avg: Number(ru_avg.toFixed(2)),
          overall_percentage: ds?.overall_percentage ?? 75,
          strengths: ds?.strengths || "",
          weaknesses: ds?.weaknesses || "",
          priority_improvement: ds?.priority_improvement || "",
          priority_improvement_other: ds?.priority_improvement_other || "",
        },
        overall_pick: Boolean(submission.overall_pick),
        feedback: submission.feedback || ds?.strengths || ds?.weaknesses || "",
        submitted_at: new Date().toISOString(),
      },
    ]);

    if (!error) {
      return { status: "success", eval_id: evalId };
    }
    console.warn("Supabase submitBlindScore failed, falling back to backend:", error);
  } catch (e) {
    console.warn("Supabase submitBlindScore exception, falling back:", e);
  }

  // Fallback to Backend
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

/**
 * Submits scenario rankings and qualitative answers to Supabase blind_comparisons table.
 */
export async function submitScenarioComparison(
  submission: ScenarioComparisonSubmission
): Promise<{ status: string; comparison_id: string }> {
  const compId = `comp_${Math.random().toString(36).substring(2, 10)}`;

  // Try Supabase first
  try {
    const { error } = await supabase.from("blind_comparisons").insert([
      {
        id: compId,
        scenario_id: submission.scenario_id,
        expert_id: submission.expert_id,
        expert_name: submission.expert_name,
        expert_profile: submission.expert_profile || {},
        rankings: submission.rankings || [],
        best_for_practical_use: submission.best_for_practical_use || {},
        qualitative_feedback: submission.qualitative_feedback || {},
        submitted_at: new Date().toISOString(),
      },
    ]);

    if (!error) {
      return { status: "success", comparison_id: compId };
    }
    console.warn("Supabase submitScenarioComparison failed, falling back:", error);
  } catch (e) {
    console.warn("Supabase submitScenarioComparison exception, falling back:", e);
  }

  // Fallback to Backend
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

/**
 * Fetches all evaluation results, comparisons, and aggregated stats from Supabase (or backend fallback).
 */
export async function fetchBlindResults(): Promise<{
  evaluations: EvaluationRecord[];
  comparisons?: ScenarioComparisonRecord[];
  summary: ModelSummaryStat[];
  total_trips: number;
}> {
  // Try Supabase first
  try {
    const [evalsRes, tripsRes, compsRes] = await Promise.all([
      supabase.from("blind_evaluations").select("*").order("submitted_at", { ascending: false }),
      supabase.from("blind_trips").select("id, scenario_id, actual_model"),
      supabase.from("blind_comparisons").select("*").order("submitted_at", { ascending: false }),
    ]);

    if (!evalsRes.error && evalsRes.data && !tripsRes.error && tripsRes.data) {
      const evals: EvaluationRecord[] = evalsRes.data;
      const trips = tripsRes.data;
      const comps: ScenarioComparisonRecord[] = compsRes.data || [];

      // Calculate model summary stats
      const modelStats: Record<string, any> = {};
      for (const ev of evals) {
        const m = ev.actual_model || "unknown";
        if (!modelStats[m]) {
          modelStats[m] = {
            model: m,
            evaluations_count: 0,
            total_spatial: 0,
            total_temporal: 0,
            total_persona: 0,
            total_attraction: 0,
            total_accuracy: 0,
            total_fa: 0,
            total_cc: 0,
            total_pf: 0,
            total_sr: 0,
            total_de: 0,
            total_ru: 0,
            total_percentage: 0,
            total_wins: 0,
          };
        }

        const s = modelStats[m];
        s.evaluations_count += 1;
        const sc = ev.scores || {};
        const ds = ev.detailed_scores || {};

        s.total_spatial += Number(sc.spatial_feasibility || 3);
        s.total_temporal += Number(sc.temporal_pacing || 3);
        s.total_persona += Number(sc.persona_alignment || 3);
        s.total_attraction += Number(sc.attraction_quality || 3);
        s.total_accuracy += Number(sc.information_accuracy || 3);

        s.total_fa += Number(ds.fa_avg || sc.information_accuracy || 3);
        s.total_cc += Number(ds.cc_avg || sc.persona_alignment || 3);
        s.total_pf += Number(ds.pf_avg || sc.temporal_pacing || 3);
        s.total_sr += Number(ds.sr_avg || sc.spatial_feasibility || 3);
        s.total_de += Number(ds.de_avg || sc.attraction_quality || 3);
        s.total_ru += Number(ds.ru_avg || 3);
        s.total_percentage += Number(ds.overall_percentage || 75);

        if (ev.overall_pick) s.total_wins += 1;
      }

      const summaryList: ModelSummaryStat[] = Object.values(modelStats).map((s: any) => {
        const count = s.evaluations_count || 1;
        const avg_sp = Number((s.total_spatial / count).toFixed(2));
        const avg_te = Number((s.total_temporal / count).toFixed(2));
        const avg_pe = Number((s.total_persona / count).toFixed(2));
        const avg_at = Number((s.total_attraction / count).toFixed(2));
        const avg_ac = Number((s.total_accuracy / count).toFixed(2));

        const avg_fa = Number((s.total_fa / count).toFixed(2));
        const avg_cc = Number((s.total_cc / count).toFixed(2));
        const avg_pf = Number((s.total_pf / count).toFixed(2));
        const avg_sr = Number((s.total_sr / count).toFixed(2));
        const avg_de = Number((s.total_de / count).toFixed(2));
        const avg_ru = Number((s.total_ru / count).toFixed(2));
        const avg_pct = Number((s.total_percentage / count).toFixed(1));

        const overall_score = Number(((avg_sp + avg_te + avg_pe + avg_at + avg_ac) / 5.0).toFixed(2));
        const win_rate = Number(((s.total_wins / count) * 100).toFixed(1));

        return {
          model: s.model,
          evaluations_count: s.evaluations_count,
          avg_spatial: avg_sp,
          avg_temporal: avg_te,
          avg_persona: avg_pe,
          avg_attraction: avg_at,
          avg_accuracy: avg_ac,
          avg_fa,
          avg_cc,
          avg_pf,
          avg_sr,
          avg_de,
          avg_ru,
          avg_overall_percentage: avg_pct,
          overall_score,
          total_wins: s.total_wins,
          win_rate_percent: win_rate,
        };
      });

      return {
        evaluations: evals,
        comparisons: comps,
        summary: summaryList,
        total_trips: trips.length,
      };
    }
  } catch (e) {
    console.warn("Supabase fetchBlindResults failed, falling back to backend:", e);
  }

  // Fallback to Backend
  const res = await fetch(`${API_BASE}/blind_eval/results`);
  if (!res.ok) throw new Error("Failed to fetch blind results");
  return res.json();
}

/**
 * One-click sync tool: Synchronizes local JSON file data (trips, evaluations, comparisons) into Supabase.
 */
export async function syncLocalToSupabase(): Promise<{
  tripsCount: number;
  evalsCount: number;
  compsCount: number;
}> {
  // 1. Fetch raw data from backend
  const [tripsRes, resultsRes] = await Promise.all([
    fetch(`${API_BASE}/blind_eval/trips?role=dev`).then((r) => (r.ok ? r.json() : { trips: [] })),
    fetch(`${API_BASE}/blind_eval/results`).then((r) => (r.ok ? r.json() : { evaluations: [], comparisons: [] })),
  ]);

  const trips: BlindTrip[] = tripsRes.trips || [];
  const evals: EvaluationRecord[] = resultsRes.evaluations || [];
  const comps: ScenarioComparisonRecord[] = resultsRes.comparisons || [];

  let syncedTrips = 0;
  let syncedEvals = 0;
  let syncedComps = 0;

  // 2. Push trips
  if (trips.length > 0) {
    const tripRows = trips.map((t) => ({
      id: t.id,
      scenario_id: t.scenario_id,
      scenario_title: t.scenario_title,
      scenario_notes: t.scenario_notes || "",
      actual_model: t.actual_model || "unknown",
      preferences: t.preferences || {},
      itinerary: t.itinerary || [],
      typical_weather: t.typicalWeather || null,
      suggestions: t.suggestions || [],
      accommodations: t.accommodations || [],
      uploaded_locations: t.uploaded_locations || [],
      created_at: t.created_at || new Date().toISOString(),
    }));

    const { error: tErr } = await supabase.from("blind_trips").upsert(tripRows, { onConflict: "id" });
    if (!tErr) syncedTrips = tripRows.length;
    else throw new Error(`Sync blind_trips error: ${tErr.message}`);
  }

  // 3. Push evaluations
  if (evals.length > 0) {
    const evalRows = evals.map((e) => ({
      id: e.id,
      scenario_id: e.scenario_id,
      trip_id: e.trip_id,
      blind_label: e.blind_label,
      actual_model: e.actual_model,
      expert_id: e.expert_id,
      expert_name: e.expert_name,
      expert_profile: e.expert_profile || {},
      scores: e.scores || {},
      detailed_scores: e.detailed_scores || {},
      overall_pick: Boolean(e.overall_pick),
      feedback: e.feedback || "",
      submitted_at: e.submitted_at || new Date().toISOString(),
    }));

    const { error: eErr } = await supabase.from("blind_evaluations").upsert(evalRows, { onConflict: "id" });
    if (!eErr) syncedEvals = evalRows.length;
    else throw new Error(`Sync blind_evaluations error: ${eErr.message}`);
  }

  // 4. Push comparisons
  if (comps.length > 0) {
    const compRows = comps.map((c) => ({
      id: c.id,
      scenario_id: c.scenario_id,
      expert_id: c.expert_id,
      expert_name: c.expert_name,
      expert_profile: c.expert_profile || {},
      rankings: c.rankings || [],
      best_for_practical_use: c.best_for_practical_use || {},
      qualitative_feedback: c.qualitative_feedback || {},
      submitted_at: c.submitted_at || new Date().toISOString(),
    }));

    const { error: cErr } = await supabase.from("blind_comparisons").upsert(compRows, { onConflict: "id" });
    if (!cErr) syncedComps = compRows.length;
    else throw new Error(`Sync blind_comparisons error: ${cErr.message}`);
  }

  return { tripsCount: syncedTrips, evalsCount: syncedEvals, compsCount: syncedComps };
}

export async function fetchUserRoles(): Promise<UserRoleRecord[]> {
  const roleMap = new Map<string, UserRoleRecord>();

  // 1. Fetch from backend /users/roles (default dev/expert/user test accounts)
  try {
    const res = await fetch(`${API_BASE}/users/roles`);
    if (res.ok) {
      const data = await res.json();
      const users: UserRoleRecord[] = data.users || [];
      for (const u of users) {
        if (u.email) {
          roleMap.set(u.email.toLowerCase(), {
            email: u.email.toLowerCase(),
            role: (u.role as "dev" | "expert" | "user") || "user",
            name: u.name || "",
            updated_at: u.updated_at,
          });
        }
      }
    }
  } catch (e) {
    // backend offline, continue
  }

  // 2. Fetch from Supabase profiles (real registered Supabase accounts)
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("email, role, name, updated_at, created_at");

    if (!error && profiles && profiles.length > 0) {
      for (const p of profiles) {
        if (p.email) {
          roleMap.set(p.email.toLowerCase(), {
            email: p.email.toLowerCase(),
            role: (p.role as "dev" | "expert" | "user") || "user",
            name: p.name || p.email.split("@")[0],
            updated_at: p.updated_at || p.created_at,
          });
        }
      }
    }
  } catch (e) {
    console.warn("fetchUserRoles from Supabase failed:", e);
  }

  return Array.from(roleMap.values());
}

export async function saveUserRole(record: {
  email: string;
  role: "dev" | "expert" | "user";
  name?: string;
}): Promise<UserRoleRecord> {
  const emailLower = record.email.trim().toLowerCase();

  // 1. Update Supabase profiles table if the account exists in Supabase
  try {
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        role: record.role,
        ...(record.name ? { name: record.name } : {}),
        updated_at: new Date().toISOString(),
      })
      .ilike("email", emailLower);

    if (updateErr) {
      console.warn("Supabase profiles update warning:", updateErr);
    }
  } catch (e) {
    console.warn("saveUserRole to Supabase exception:", e);
  }

  // 2. Also save to backend user_roles.json
  try {
    const res = await fetch(`${API_BASE}/users/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailLower,
        role: record.role,
        name: record.name,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.user;
    }
  } catch (e) {
    console.warn("Backend save user role failed, continuing with local record:", e);
  }

  return {
    email: emailLower,
    role: record.role,
    name: record.name,
    updated_at: new Date().toISOString(),
  };
}


