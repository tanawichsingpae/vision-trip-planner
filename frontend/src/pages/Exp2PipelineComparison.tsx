import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ExperimentLayout } from "./ExperimentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImage, type VisionResult } from "@/services/aiService";
import {
  evaluatePredictionWithAliases,
  calculateStringSimilarity,
  normalizeString,
  parseAliases,
  FailureMode,
  FAILURE_MODE_CONFIGS,
  FAILURE_MODE_OPTIONS,
} from "@/utils/evaluationMetrics";
import { KeyTakeawaysCard } from "@/components/experiment/KeyTakeawaysCard";
import {
  VPRTier,
  TIER_CONFIGS,
  TIER_ORDER,
  detectTierFromFilename,
  normalizeTier,
} from "@/types/experimentTiers";
import {
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  Save,
  Layers,
  TrendingUp,
  Target,
  BarChart3,
  Scale,
  FileCode2,
  Check,
  CheckCheck,
  Copy,
  Info,
  Sparkles,
  Download,
  ShieldCheck,
  Activity,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Smartphone,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { downloadCsv } from "@/utils/csvExport";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

// ── Graded Relevance Types (0 - 3 scale) ──
export type CandidateScore = 0 | 1 | 2 | 3;

export interface GradedCandidate {
  name: string;
  similarity: number;
  score: CandidateScore;
  failure_mode: FailureMode;
}

export interface Exp2CandidateResult {
  model: AIModelType;
  modelLabel: string;
  tier: VPRTier;
  top1_place: string;
  confidence: number;
  candidates: [GradedCandidate, GradedCandidate, GradedCandidate];
  top1_strict: boolean; // candidate 1 score === 3
  top3_recall: boolean; // any candidate has score >= 2
  avg_candidate_score: number; // (c1 + c2 + c3) / 3
  failure_mode: FailureMode;
  reasoning: string;
  time_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  tokens_per_sec?: number;
  openrouter_id?: string;
  user_verified?: boolean;
}

export interface Exp2HistoryRow {
  timestamp: string;
  image_name: string;
  ground_truth: string;
  tier: VPRTier;
  model: string;
  prompt_variant?: string;
  top1_place: string;
  confidence: number;
  candidate_1_name: string;
  candidate_1_score: number;
  candidate_1_failure_mode: FailureMode;
  candidate_2_name: string;
  candidate_2_score: number;
  candidate_2_failure_mode: FailureMode;
  candidate_3_name: string;
  candidate_3_score: number;
  candidate_3_failure_mode: FailureMode;
  top1_strict: boolean;
  top3_recall: boolean;
  avg_candidate_score: number;
  failure_mode: FailureMode;
  time_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  openrouter_id?: string;
}

const SCORE_LABELS: Record<CandidateScore, { label: string; short: string; color: string; bg: string; border: string }> = {
  3: { label: "Exact POI Match", short: "Exact (3)", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300" },
  2: { label: "Parent / Regional Area", short: "Parent (2)", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-300" },
  1: { label: "Co-located Neighbor", short: "Neighbor (1)", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300" },
  0: { label: "Irrelevant / Generic", short: "Wrong (0)", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-300" },
};

function autoGradeCandidate(candidateName: string, groundTruth: string, similarity: number = 0): CandidateScore {
  if (!candidateName || !candidateName.trim()) return 0;
  const cNorm = normalizeString(candidateName);
  const gtNorm = normalizeString(groundTruth);

  // 1. Generic Biome / Scenery Check
  const genericWords = [
    "ป่าเมฆ", "cloud forest", "เส้นทางธรรมชาติ", "ทิวทัศน์ธรรมชาติ", "nature trail",
    "scenery", "landscape", "วิวธรรมชาติ", "ป่า", "forest", "mountain view", "วิวป่า",
    "thailand", "ประเทศไทย", "ภาคเหนือ", "ภาคใต้", "asia", "เอเชีย"
  ];
  const isGeneric = genericWords.some((w) => cNorm === w || cNorm === `a ${w}` || cNorm === `the ${w}`);
  if (isGeneric && !cNorm.includes("ดอย") && !cNorm.includes("เขา") && !cNorm.includes("อุทยาน") && !cNorm.includes("เกาะ")) {
    return 0;
  }

  // 2. Exact Match Check (Score 3)
  const aliases = parseAliases(groundTruth);
  for (const alias of aliases) {
    const sim = calculateStringSimilarity(candidateName, alias);
    if (sim >= 0.70 || cNorm === alias || (cNorm.length > 5 && alias.includes(cNorm)) || (alias.length > 5 && cNorm.includes(alias))) {
      return 3;
    }
  }

  // 3. Parent / Regional Area Check (Score 2)
  const regionalKeywords = [
    "อุทยานแห่งชาติ", "national park", "ดอย", "เกาะ", "koh", "ko", "หาด", "beach",
    "จังหวัด", "province", "อำเภอ", "district", "เมือง", "city", "ภูเขา", "mountain"
  ];
  const matchesParentKeyword = regionalKeywords.some((k) => cNorm.includes(k) && gtNorm.includes(k));
  const tokensC = new Set(cNorm.split(" ").filter((t) => t.length > 2));
  const tokensGT = new Set(gtNorm.split(" ").filter((t) => t.length > 2));
  const intersection = [...tokensC].filter((t) => tokensGT.has(t));

  if (matchesParentKeyword || intersection.length >= 1 || (cNorm.length > 4 && gtNorm.includes(cNorm))) {
    return 2;
  }

  // 4. Neighbor / Near-Miss (Score 1)
  if (similarity >= 0.65 || intersection.length > 0) {
    return 1;
  }

  return 0;
}

function autoClassifyCandidateFailure(
  candidateName: string,
  groundTruth: string,
  score: CandidateScore
): FailureMode {
  if (score === 3) return "none";
  if (!candidateName || !candidateName.trim()) return "degradation_rejection";
  const cNorm = normalizeString(candidateName);

  if (
    cNorm.includes("unknown") ||
    cNorm.includes("unidentifiable") ||
    cNorm.includes("ไม่ระบุสถานที่") ||
    cNorm === "n/a"
  ) {
    return "degradation_rejection";
  }

  const genericWords = [
    "ป่าเมฆ", "cloud forest", "เส้นทางธรรมชาติ", "ทิวทัศน์ธรรมชาติ", "nature trail",
    "scenery", "landscape", "วิวธรรมชาติ", "ป่า", "forest", "mountain view", "วิวป่า",
    "thailand", "ประเทศไทย", "ภาคเหนือ", "ภาคใต้", "asia", "เอเชีย"
  ];
  const isGeneric = genericWords.some((w) => cNorm === w || cNorm === `a ${w}` || cNorm === `the ${w}`);
  if (
    (isGeneric && !cNorm.includes("ดอย") && !cNorm.includes("เขา") && !cNorm.includes("อุทยาน") && !cNorm.includes("เกาะ")) ||
    (score === 0 && (cNorm.length < 4 || cNorm.includes("เส้นทางเดินป่า") || cNorm.includes("ธรรมชาติ") || cNorm.includes("forest")))
  ) {
    return "hallucination";
  }

  if (score === 2) {
    return "none";
  }

  return "visual_confusion";
}

function isTruthy(v: any): boolean {
  return v === true || v === "true" || v === "True" || v === 1 || v === "1";
}

export default function Exp2PipelineComparison() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [singleTier, setSingleTier] = useState<VPRTier>("tier1_iconic");
  const [selectedTierFilter, setSelectedTierFilter] = useState<"all" | VPRTier>("all");
  const [selectedModels, setSelectedModels] = useState<AIModelType[]>(
    AI_MODEL_OPTIONS.map((o) => o.value)
  );

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp2CandidateResult[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp2HistoryRow[]>([]);
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  // Fetch persisted history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results_exp2`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((row: any) => {
          const c1Score = Number(row["Candidate 1 Score"] ?? (isTruthy(row["Top 1 Strict"] || row["Correct (CLIP)"]) ? 3 : 0));
          const c2Score = Number(row["Candidate 2 Score"] ?? 0);
          const c3Score = Number(row["Candidate 3 Score"] ?? 0);
          const top1Strict = row["Top 1 Strict"] !== undefined ? isTruthy(row["Top 1 Strict"]) : (c1Score === 3);
          const top3Recall = row["Top 3 Recall"] !== undefined ? isTruthy(row["Top 3 Recall"]) : (c1Score >= 2 || c2Score >= 2 || c3Score >= 2);
          const avgScore = row["Avg Candidate Score"] !== undefined ? Number(row["Avg Candidate Score"]) : Number(((c1Score + c2Score + c3Score) / 3).toFixed(2));

          const c1Fail = (row["Candidate 1 Failure Mode"] || (c1Score === 3 ? "none" : (row["Failure Mode"] || "visual_confusion"))) as FailureMode;
          const c2Fail = (row["Candidate 2 Failure Mode"] || (c2Score === 3 ? "none" : "visual_confusion")) as FailureMode;
          const c3Fail = (row["Candidate 3 Failure Mode"] || (c3Score === 3 ? "none" : "visual_confusion")) as FailureMode;

          return {
            timestamp: row["Timestamp"] || row.timestamp || "",
            image_name: row["Image Name"] || row.image_name || "",
            ground_truth: row["Ground Truth"] || row.ground_truth || "",
            tier: normalizeTier(row["Tier"] || row.tier || "tier1_iconic"),
            model: row["Model"] || row.model || "",
            prompt_variant: row["Prompt Variant"] || "P1: Zero-Shot Direct (EN)",
            top1_place: row["Top 1 Place"] || row["Predicted (CLIP)"] || row.top1_place || "",
            confidence: Number(row["Confidence"] || row["Confidence (CLIP)"] || 0),
            candidate_1_name: row["Candidate 1 Name"] || row["Top 1 Place"] || row["Predicted (CLIP)"] || "",
            candidate_1_score: c1Score,
            candidate_1_failure_mode: c1Fail,
            candidate_2_name: row["Candidate 2 Name"] || "",
            candidate_2_score: c2Score,
            candidate_2_failure_mode: c2Fail,
            candidate_3_name: row["Candidate 3 Name"] || "",
            candidate_3_score: c3Score,
            candidate_3_failure_mode: c3Fail,
            top1_strict: top1Strict,
            top3_recall: top3Recall,
            avg_candidate_score: avgScore,
            failure_mode: (row["Failure Mode"] || row["Failure Mode (CLIP)"] || "none") as FailureMode,
            time_ms: Number(row["Time MS"] || row["Latency CLIP (ms)"] || 0),
            prompt_tokens: Number(row["Prompt Tokens"] || 0),
            completion_tokens: Number(row["Completion Tokens"] || 0),
            total_tokens: Number(row["Total Tokens"] || row["Tokens CLIP"] || 0),
            cost_usd: Number(row["Cost USD"] || row["Cost CLIP (USD)"] || 0),
            openrouter_id: row["OpenRouter ID"] || row["OpenRouter ID CLIP"] || "",
          };
        });
        setDbLogs(mapped);
      }
    } catch (e) {
      console.error("Failed to load Exp2 history:", e);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      const guessed = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[-_]/g, " ");
      setGroundTruth(guessed);
      setSingleTier(detectTierFromFilename(file.name));
      setCurrentResults([]);
    }
  };

  // Run benchmark across models
  const runComparison = async () => {
    if (!imageFile || !groundTruth.trim()) {
      toast.error("Please upload an image and specify Ground Truth.");
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("Select at least one model.");
      return;
    }

    setIsRunning(true);
    setCurrentResults([]);
    const temp: Exp2CandidateResult[] = [];

    for (const modelId of selectedModels) {
      const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === modelId);
      const label = modelOpt ? modelOpt.label : modelId;

      setProgressLabel(`[${label}] Executing Multi-Candidate Retrieval...`);
      const start = performance.now();
      let res: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
      try {
        res = await analyzeImage(
          imageFile,
          modelId,
          true,
          (step) => setProgressLabel(`[${label}] ${step}`),
          { allowFallback: false, temperature: 0.1, tier: singleTier }
        );
      } catch (err) {
        console.error("Exp2 Vision Error:", err);
      }
      const duration = Math.round(performance.now() - start);

      const top1Name = res.place || "Unknown";
      const conf = res.confidence || res.top_candidates?.[0]?.similarity || 0.0;

      // Extract Candidates 1, 2, 3
      const c1Name = res.top_candidates?.[0]?.name || top1Name;
      const c1Sim = res.top_candidates?.[0]?.similarity || conf;

      const c2Name = res.top_candidates?.[1]?.name || res.similar_locations?.[0]?.name || "";
      const c2Sim = res.top_candidates?.[1]?.similarity || res.similar_locations?.[0]?.similarity || 0;

      const c3Name = res.top_candidates?.[2]?.name || res.similar_locations?.[1]?.name || "";
      const c3Sim = res.top_candidates?.[2]?.similarity || res.similar_locations?.[1]?.similarity || 0;

      // Auto-Grade
      const s1 = autoGradeCandidate(c1Name, groundTruth, c1Sim);
      const s2 = autoGradeCandidate(c2Name, groundTruth, c2Sim);
      const s3 = autoGradeCandidate(c3Name, groundTruth, c3Sim);

      const top1Strict = s1 === 3;
      const top3Recall = s1 >= 2 || s2 >= 2 || s3 >= 2;
      const avgScore = Number(((s1 + s2 + s3) / 3).toFixed(2));

      // Candidate-level failure modes
      const f1 = autoClassifyCandidateFailure(c1Name, groundTruth, s1);
      const f2 = autoClassifyCandidateFailure(c2Name, groundTruth, s2);
      const f3 = autoClassifyCandidateFailure(c3Name, groundTruth, s3);

      // Model-level overall failure mode
      const overallFailureMode: FailureMode = top1Strict ? "none" : f1;

      temp.push({
        model: modelId,
        modelLabel: label,
        tier: singleTier,
        top1_place: top1Name,
        confidence: conf,
        candidates: [
          { name: c1Name, similarity: c1Sim, score: s1, failure_mode: f1 },
          { name: c2Name, similarity: c2Sim, score: s2, failure_mode: f2 },
          { name: c3Name, similarity: c3Sim, score: s3, failure_mode: f3 },
        ],
        top1_strict: top1Strict,
        top3_recall: top3Recall,
        avg_candidate_score: avgScore,
        failure_mode: overallFailureMode,
        reasoning: Array.isArray(res.ai_reasoning) ? res.ai_reasoning.join("; ") : (res.ai_reasoning || ""),
        time_ms: res.metrics?.latency_ms ? Math.round(res.metrics.latency_ms) : duration,
        prompt_tokens: res.metrics?.prompt_tokens ?? 0,
        completion_tokens: res.metrics?.completion_tokens ?? 0,
        total_tokens: res.metrics?.total_tokens ?? 0,
        cost_usd: res.metrics?.cost_usd ?? 0.0,
        tokens_per_sec: res.metrics?.tokens_per_sec ?? 0.0,
        openrouter_id: res.metrics?.openrouter_id || "",
        user_verified: false,
      });

      setCurrentResults([...temp]);
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success(`Candidate benchmark completed for ${selectedModels.length} models!`);
  };

  // Update candidate score interactively
  const updateCandidateScore = (rowIdx: number, candIdx: 0 | 1 | 2, score: CandidateScore) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      const target = { ...updated[rowIdx] };
      const newCands = [...target.candidates] as [GradedCandidate, GradedCandidate, GradedCandidate];

      // Auto-update candidate failure mode when score changes
      let candFail = newCands[candIdx].failure_mode;
      if (score === 3) {
        candFail = "none";
      } else if (candFail === "none") {
        candFail = autoClassifyCandidateFailure(newCands[candIdx].name, groundTruth, score);
      }

      newCands[candIdx] = { ...newCands[candIdx], score, failure_mode: candFail };

      const top1Strict = newCands[0].score === 3;
      const top3Recall = newCands[0].score >= 2 || newCands[1].score >= 2 || newCands[2].score >= 2;
      const avgScore = Number(((newCands[0].score + newCands[1].score + newCands[2].score) / 3).toFixed(2));

      target.candidates = newCands;
      target.top1_strict = top1Strict;
      target.top3_recall = top3Recall;
      target.avg_candidate_score = avgScore;
      target.user_verified = true;
      if (top1Strict) {
        target.failure_mode = "none";
      } else if (candIdx === 0) {
        target.failure_mode = candFail;
      }

      updated[rowIdx] = target;
      return updated;
    });
  };

  // Update candidate failure mode interactively
  const updateCandidateFailureMode = (rowIdx: number, candIdx: 0 | 1 | 2, mode: FailureMode) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      const target = { ...updated[rowIdx] };
      const newCands = [...target.candidates] as [GradedCandidate, GradedCandidate, GradedCandidate];
      newCands[candIdx] = { ...newCands[candIdx], failure_mode: mode };
      target.candidates = newCands;
      target.user_verified = true;

      // Sync overall failure mode if candidate 1 was changed
      if (candIdx === 0 && !target.top1_strict) {
        target.failure_mode = mode;
      }

      updated[rowIdx] = target;
      return updated;
    });
  };

  const updateFailureMode = (rowIdx: number, mode: FailureMode) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], failure_mode: mode };
      return updated;
    });
  };

  // Commit results to CSV
  const commitResults = async () => {
    if (currentResults.length === 0) return;

    const payload = {
      image_name: imageFile?.name || "image.jpg",
      ground_truth: groundTruth,
      tier: singleTier,
      prompt_variant: "2-Turn Retrieval (UGC & Screenshot-Aware)",
      temperature: 0.1,
      results: currentResults.map((r) => ({
        model: r.model,
        tier: r.tier,
        prompt_variant: "2-Turn Retrieval (UGC & Screenshot-Aware)",
        top1_place: r.top1_place,
        confidence: r.confidence,
        candidate_1_name: r.candidates[0].name,
        candidate_1_score: r.candidates[0].score,
        candidate_1_failure_mode: r.candidates[0].failure_mode,
        candidate_2_name: r.candidates[1].name,
        candidate_2_score: r.candidates[1].score,
        candidate_2_failure_mode: r.candidates[1].failure_mode,
        candidate_3_name: r.candidates[2].name,
        candidate_3_score: r.candidates[2].score,
        candidate_3_failure_mode: r.candidates[2].failure_mode,
        top1_strict: r.top1_strict,
        top3_recall: r.top3_recall,
        avg_candidate_score: r.avg_candidate_score,
        failure_mode: r.failure_mode,
        reasoning: r.reasoning,
        time_ms: r.time_ms,
        prompt_tokens: r.prompt_tokens,
        completion_tokens: r.completion_tokens,
        total_tokens: r.total_tokens,
        cost_usd: r.cost_usd,
        tokens_per_sec: r.tokens_per_sec,
        openrouter_id: r.openrouter_id,
      })),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save_exp2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Exp 2 results with candidate failure modes saved to CSV!");
        fetchHistory();
        setCurrentResults([]);
      } else {
        toast.error("Failed to save Exp 2 results.");
      }
    } catch (e) {
      toast.error("Network error while saving Exp 2.");
    }
  };

  // Combine DB logs with live current results
  const combinedLogs: Exp2HistoryRow[] = useMemo(() => {
    const live = currentResults.map((r) => ({
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      image_name: imageFile?.name || "live_image.jpg",
      ground_truth: groundTruth,
      tier: r.tier,
      model: r.model,
      top1_place: r.top1_place,
      confidence: r.confidence,
      candidate_1_name: r.candidates[0].name,
      candidate_1_score: r.candidates[0].score,
      candidate_1_failure_mode: r.candidates[0].failure_mode,
      candidate_2_name: r.candidates[1].name,
      candidate_2_score: r.candidates[1].score,
      candidate_2_failure_mode: r.candidates[1].failure_mode,
      candidate_3_name: r.candidates[2].name,
      candidate_3_score: r.candidates[2].score,
      candidate_3_failure_mode: r.candidates[2].failure_mode,
      top1_strict: r.top1_strict,
      top3_recall: r.top3_recall,
      avg_candidate_score: r.avg_candidate_score,
      failure_mode: r.failure_mode,
      time_ms: r.time_ms,
      total_tokens: r.total_tokens,
      cost_usd: r.cost_usd,
      openrouter_id: r.openrouter_id,
    }));
    return [...dbLogs, ...live];
  }, [dbLogs, currentResults, imageFile, groundTruth]);

  // Sliced logs by selectedTierFilter
  const effectiveLogs = useMemo(() => {
    if (selectedTierFilter === "all") return combinedLogs;
    return combinedLogs.filter((r) => normalizeTier(r.tier) === selectedTierFilter);
  }, [combinedLogs, selectedTierFilter]);

  // Overall & Model Analytics with Candidate Failure Mode Breakdown
  const analytics = useMemo(() => {
    if (effectiveLogs.length === 0) return null;
    const N = effectiveLogs.length;

    const top1StrictCount = effectiveLogs.filter((r) => r.top1_strict).length;
    const top3RecallCount = effectiveLogs.filter((r) => r.top3_recall).length;

    const top1StrictAcc = Number(((top1StrictCount / N) * 100).toFixed(1));
    const top3RecallAcc = Number(((top3RecallCount / N) * 100).toFixed(1));
    const recoveryGain = Number((top3RecallAcc - top1StrictAcc).toFixed(1));

    const avgQuality = Number((effectiveLogs.reduce((s, r) => s + r.avg_candidate_score, 0) / N).toFixed(2));

    // Confidence Calibration: High quality (>=2) vs Low quality (0-1)
    const highQualityRows = effectiveLogs.filter((r) => r.top3_recall);
    const lowQualityRows = effectiveLogs.filter((r) => !r.top3_recall);

    const meanConfHigh = highQualityRows.length > 0
      ? Number(((highQualityRows.reduce((s, r) => s + r.confidence, 0) / highQualityRows.length) * 100).toFixed(1))
      : 0;

    const meanConfLow = lowQualityRows.length > 0
      ? Number(((lowQualityRows.reduce((s, r) => s + r.confidence, 0) / lowQualityRows.length) * 100).toFixed(1))
      : 0;

    // Candidate-Level Failure Mode Distribution
    let totalCands = N * 3;
    let visualConfusionCount = 0;
    let hallucinationCount = 0;
    let degradationCount = 0;
    let noneCount = 0;

    const candPosStats = {
      c1: { none: 0, visual_confusion: 0, hallucination: 0, degradation_rejection: 0 },
      c2: { none: 0, visual_confusion: 0, hallucination: 0, degradation_rejection: 0 },
      c3: { none: 0, visual_confusion: 0, hallucination: 0, degradation_rejection: 0 },
    };

    effectiveLogs.forEach((r) => {
      const f1 = r.candidate_1_failure_mode || "visual_confusion";
      const f2 = r.candidate_2_failure_mode || "visual_confusion";
      const f3 = r.candidate_3_failure_mode || "visual_confusion";

      candPosStats.c1[f1] = (candPosStats.c1[f1] || 0) + 1;
      candPosStats.c2[f2] = (candPosStats.c2[f2] || 0) + 1;
      candPosStats.c3[f3] = (candPosStats.c3[f3] || 0) + 1;

      [f1, f2, f3].forEach((f) => {
        if (f === "none") noneCount++;
        else if (f === "visual_confusion") visualConfusionCount++;
        else if (f === "hallucination") hallucinationCount++;
        else if (f === "degradation_rejection") degradationCount++;
      });
    });

    const candErrorTotal = visualConfusionCount + hallucinationCount + degradationCount;
    const visualConfusionPct = candErrorTotal > 0 ? Number(((visualConfusionCount / candErrorTotal) * 100).toFixed(1)) : 0;
    const hallucinationPct = candErrorTotal > 0 ? Number(((hallucinationCount / candErrorTotal) * 100).toFixed(1)) : 0;
    const degradationPct = candErrorTotal > 0 ? Number(((degradationCount / candErrorTotal) * 100).toFixed(1)) : 0;

    // Per-model breakdown
    const modelStats: Record<string, { total: number; top1: number; top3: number; scores: number[]; confidences: number[]; times: number[]; errors: Record<FailureMode, number> }> = {};
    effectiveLogs.forEach((r) => {
      if (!modelStats[r.model]) {
        modelStats[r.model] = { total: 0, top1: 0, top3: 0, scores: [], confidences: [], times: [], errors: { none: 0, visual_confusion: 0, hallucination: 0, degradation_rejection: 0 } };
      }
      modelStats[r.model].total += 1;
      if (r.top1_strict) modelStats[r.model].top1 += 1;
      if (r.top3_recall) modelStats[r.model].top3 += 1;
      modelStats[r.model].scores.push(r.avg_candidate_score);
      modelStats[r.model].confidences.push(r.confidence);
      modelStats[r.model].times.push(r.time_ms);

      [r.candidate_1_failure_mode, r.candidate_2_failure_mode, r.candidate_3_failure_mode].forEach((fm) => {
        if (fm) modelStats[r.model].errors[fm] = (modelStats[r.model].errors[fm] || 0) + 1;
      });
    });

    const modelBreakdown = Object.entries(modelStats).map(([model, d]) => {
      const opt = AI_MODEL_OPTIONS.find((o) => o.value === model);
      const top1Acc = Number(((d.top1 / d.total) * 100).toFixed(1));
      const top3Acc = Number(((d.top3 / d.total) * 100).toFixed(1));
      const gain = Number((top3Acc - top1Acc).toFixed(1));
      const meanScore = Number((d.scores.reduce((a, b) => a + b, 0) / d.total).toFixed(2));
      const meanConf = Number(((d.confidences.reduce((a, b) => a + b, 0) / d.total) * 100).toFixed(1));
      const meanLatency = Math.round(d.times.reduce((a, b) => a + b, 0) / d.total);

      return {
        model,
        modelLabel: opt ? opt.label : model,
        shortModel: opt ? opt.label.split(" ")[0] : model.split("-").slice(-2).join("-"),
        total: d.total,
        top1Acc,
        top3Acc,
        gain,
        meanScore,
        meanConf,
        meanLatency,
        errors: d.errors,
      };
    }).sort((a, b) => b.top3Acc - a.top3Acc);

    return {
      total: N,
      top1StrictAcc,
      top3RecallAcc,
      recoveryGain,
      avgQuality,
      meanConfHigh,
      meanConfLow,
      modelBreakdown,
      candFailureDist: {
        totalEvaluated: totalCands,
        totalErrors: candErrorTotal,
        visualConfusionCount,
        visualConfusionPct,
        hallucinationCount,
        hallucinationPct,
        degradationCount,
        degradationPct,
        noneCount,
        candPosStats,
      },
    };
  }, [effectiveLogs]);

  // Copy LaTeX Table for Thesis Chapter 4.2
  const copyLatexTable = () => {
    if (!analytics) return;
    const rows = analytics.modelBreakdown.map((m) => {
      return `    ${m.modelLabel} & ${m.total} & ${m.top1Acc}\% & ${m.top3Acc}\% & +${m.gain}\% & ${m.meanScore} / 3.0 & ${m.meanConf}\% \\`;
    }).join("\n");

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Visual Grounding Confidence Calibration and Top-K Multi-Candidate Retrieval Evaluation}
  \\label{tab:candidate_retrieval_benchmark}
  \\begin{tabular}{l c c c c c c}
    \\toprule
    \\textbf{Model} & \\textbf{N} & \\textbf{Top-1 Strict (\\%)} & \\textbf{Top-3 Recall (\\%)} & \\textbf{Recovery Gain} & \\textbf{Avg Quality (0-3)} & \\textbf{Mean Conf (\\%)} \\
    \\midrule
${rows}
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    toast.success("Thesis LaTeX table copied to clipboard!");
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  const exportCSV = () => {
    const filename = `VPR_Thesis_Exp3_MultiCandidate_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(combinedLogs, filename);
    toast.success(`Exported ${combinedLogs.length} Exp3 records!`);
  };

  return (
    <ExperimentLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden">
          <div className="space-y-1.5 z-10">
            <div className="flex items-center gap-2">
              <Badge className="bg-sky-500/20 text-sky-200 border-sky-400/30 text-xs px-2.5 py-0.5">
                Experiment 3 • Chapter 4.3
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs px-2.5 py-0.5">
                Multi-Candidate Retrieval & Calibration
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Visual Grounding Confidence Calibration & Top-K Multi-Candidate Retrieval
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              การประเมินความเที่ยงตรงของค่าความเชื่อมั่นเชิงสายตา (Visual Confidence) และประสิทธิภาพการแนะนำตัวเลือกสถานที่ (Top-3 Candidate Switch Name)
              พร้อมการจำแนกข้อผิดพลาดอย่างละเอียดรายตัวเลือก (Candidate-level Error Classification)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={combinedLogs.length === 0}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shadow-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyLatexTable}
              disabled={!analytics}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shadow-xs"
            >
              <FileCode2 className="w-3.5 h-3.5 mr-1.5" />
              {copiedLatex ? "Copied!" : "LaTeX Table"}
            </Button>
          </div>
        </div>

        {/* Executive Takeaways Card */}
        <KeyTakeawaysCard expId="exp3" />

        {/* Stratified Tier Slicer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Stratified Tier Filter:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={selectedTierFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTierFilter("all")}
                className={`text-xs h-7 px-3 rounded-lg ${
                  selectedTierFilter === "all"
                    ? "bg-slate-900 text-white font-semibold"
                    : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                }`}
              >
                All Tiers ({combinedLogs.length})
              </Button>
              {TIER_ORDER.map((tierKey) => {
                const cfg = TIER_CONFIGS[tierKey];
                const count = combinedLogs.filter((l) => normalizeTier(l.tier) === tierKey).length;
                const isSel = selectedTierFilter === tierKey;
                return (
                  <Button
                    key={tierKey}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTierFilter(tierKey)}
                    className={`text-xs h-7 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                      isSel
                        ? `${cfg.badgeClass} ring-2 ring-sky-500 font-bold shadow-xs`
                        : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.shortLabel}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* KPI Dashboard Cards */}
        {analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Card 1: Top-1 Strict */}
              <Card className="bg-white border-slate-200 shadow-xs text-left">
                <CardContent className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Top-1 Strict Accuracy (Score 3)
                  </span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                    {analytics.top1StrictAcc}%
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Exact landmark match on #1 candidate
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Top-3 Regional Recall & Recovery Gain */}
              <Card className="bg-gradient-to-br from-emerald-50/80 to-white border-emerald-200 shadow-xs text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Top-3 Regional Recall (Score ≥ 2)
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] font-mono">
                      +{analytics.recoveryGain}% Gain
                    </Badge>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mt-2">
                    {analytics.top3RecallAcc}%
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    User recovers correct site via Switch Name
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Candidate Quality Score */}
              <Card className="bg-gradient-to-br from-sky-50/80 to-white border-sky-200 shadow-xs text-left">
                <CardContent className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                    Mean Candidate Quality
                  </span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-sky-900 mt-2">
                    {analytics.avgQuality} <span className="text-sm font-normal text-slate-400">/ 3.0</span>
                  </p>
                  <p className="text-[10px] text-sky-700 font-medium mt-0.5">
                    Graded relevance across all 3 candidates
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Confidence Calibration Contrast */}
              <Card className="bg-white border-slate-200 shadow-xs text-left">
                <CardContent className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Confidence Calibration Contrast
                  </span>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
                    {analytics.meanConfHigh}% <span className="text-xs font-normal text-slate-400">vs</span> {analytics.meanConfLow}%
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Mean Conf on Recovered (≥2) vs Wrong (0)
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Candidate-Level Failure Mode Distribution Card */}
            <Card className="bg-white border-slate-200 shadow-xs text-left">
              <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Candidate Error Taxonomy & Diagnostic Breakdown (การจำแนกข้อผิดพลาด 3 ระดับรายตัวเลือก)
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    วิเคราะห์การกระจายตัวของข้อผิดพลาด (Visual Confusion vs Hallucination vs Degradation) จากตัวเลือกทั้งหมด {analytics.candFailureDist.totalEvaluated} รายการ
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-slate-500">
                  {analytics.candFailureDist.totalErrors} Error Instances
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category 1: Visual Confusion */}
                  <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span>
                        Visual Confusion
                      </span>
                      <span className="text-xs font-mono font-bold text-purple-800">
                        {analytics.candFailureDist.visualConfusionPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-700">
                      สับสนกับสถานที่ข้างเคียง หรือแลนด์มาร์กที่มีสถาปัตยกรรม/ป่าไม้คล้ายคลึงกัน ({analytics.candFailureDist.visualConfusionCount} รายการ)
                    </p>
                  </div>

                  {/* Category 2: Hallucination */}
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
                        Hallucination / Generic
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-800">
                        {analytics.candFailureDist.hallucinationPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      เพ้อเจ้อ/กุชื่อที่ไม่มีจริง หรือคำนามสภาพแวดล้อมกว้างๆ ระบุพิกัดไม่ได้ เช่น ป่าเมฆ, วิวธรรมชาติ ({analytics.candFailureDist.hallucinationCount} รายการ)
                    </p>
                  </div>

                  {/* Category 3: Degradation / Rejection */}
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-600 inline-block"></span>
                        Degradation / Rejection
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-800">
                        {analytics.candFailureDist.degradationPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      ภาพมีปัจจัยรบกวนรุนแรง (มัว/มืด/เบลอ) หรือโมเดลปฏิเสธระบุสถานที่ ({analytics.candFailureDist.degradationCount} รายการ)
                    </p>
                  </div>
                </div>

                {/* Candidate Position Breakdown Sub-table */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                  <span className="font-semibold text-slate-700">Position Distribution:</span>
                  <div className="flex items-center gap-4">
                    <span>
                      <strong>Candidate #1 (Top-1):</strong> Confusion: {analytics.candFailureDist.candPosStats.c1.visual_confusion} | Hallucination: {analytics.candFailureDist.candPosStats.c1.hallucination}
                    </span>
                    <span>
                      <strong>Candidate #2:</strong> Confusion: {analytics.candFailureDist.candPosStats.c2.visual_confusion} | Hallucination: {analytics.candFailureDist.candPosStats.c2.hallucination}
                    </span>
                    <span>
                      <strong>Candidate #3:</strong> Confusion: {analytics.candFailureDist.candPosStats.c3.visual_confusion} | Hallucination: {analytics.candFailureDist.candPosStats.c3.hallucination}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Comparative Chart */}
        {analytics && analytics.modelBreakdown.length > 0 && (
          <Card className="bg-white border-slate-200 shadow-sm text-left">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                Comparative Model Benchmarking: Top-1 vs Top-3 Recovery & Quality
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Visualizing Top-1 Strict Accuracy vs Top-3 Regional Recall recovery gain per model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.modelBreakdown}
                    margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shortModel" tick={{ fontSize: 11 }} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [`${val}%`, name]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Bar dataKey="top1Acc" name="Top-1 Strict (%)" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="top3Acc" name="Top-3 Recall (%)" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Benchmarking Controls (4-5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-sky-600" />
                  Candidate Benchmark Setup
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Select image, ground truth POI, and target VLM models to run 2-Turn CLIP retrieval.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Prompt Paradigm & Tier 4 Screenshot Support Banner */}
                <div className="rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-white p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Smartphone className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>Prompt: 2-Turn Retrieval (UGC & Screenshot-Aware)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPromptDetails(!showPromptDetails)}
                      className="text-[11px] text-sky-700 hover:text-sky-900 flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <span>{showPromptDetails ? "ซ่อนพรอมต์" : "ดูรายละเอียดพรอมต์"}</span>
                      {showPromptDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] py-0.5 px-2 font-medium">
                      ✓ รองรับภาพแคปหน้าจอ (Tier 4 UGC)
                    </Badge>
                    <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px] py-0.5 px-2 font-medium">
                      Multimodal OCR + Vision
                    </Badge>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0.5 px-2 font-medium">
                      TikTok / IG / Reels / Maps
                    </Badge>
                  </div>
                  {showPromptDetails && (
                    <div className="pt-2 border-t border-sky-200/60 text-[11px] text-slate-600 space-y-1.5">
                      <p>
                        <strong>การปรับปรุงพรอมต์สำหรับ Tier 4 UGC:</strong> โมเดลจะไม่ปฏิเสธภาพสกรีนช็อตที่มีสถานที่ท่องเที่ยวจริง โดยจะประมวลผลข้อความบนหน้าจอ (เช่น แคปชันคลิป, แฮชแท็ก, ป้ายชื่อ, คำค้นหา) ร่วมกับลักษณะทางกายภาพ/สถาปัตยกรรม และจะคัดกรองปฏิเสธเฉพาะสกรีนช็อตที่ไม่มีวิวท่องเที่ยวจริงเท่านั้น (เช่น แชทข้อความส่วนบุคคล, สลิปโอนเงิน)
                      </p>
                    </div>
                  )}
                </div>

                {/* Image Upload Area */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Test Image</Label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-sky-400 transition-colors bg-slate-50/50">
                    {imagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-40 mx-auto object-cover rounded-lg shadow-xs"
                        />
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-medium text-slate-600 truncate max-w-[200px]">
                            {imageFile?.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                              setCurrentResults([]);
                            }}
                            className="text-rose-500 h-6 px-1.5 text-[10px]"
                            disabled={isRunning}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block space-y-1 py-2">
                        <Upload className="w-7 h-7 mx-auto text-slate-400" />
                        <span className="text-xs font-semibold text-sky-600 block">Upload VPR Image</span>
                        <span className="text-[10px] text-slate-400 block">JPG, PNG, WebP up to 10MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={isRunning}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Ground Truth Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Ground Truth Landmark / Location
                  </Label>
                  <Input
                    type="text"
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Ang Ka Nature Trail (เส้นทางศึกษาธรรมชาติอ่างกา)"
                    className="text-xs h-9 bg-slate-50/50"
                    disabled={isRunning}
                  />
                  <p className="text-[10px] text-slate-400">
                    Separate aliases with vertical bar (|) e.g. "Emerald Cave | ถ้ำมรกต | Ko Muk"
                  </p>
                </div>

                {/* Tier Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Landmark Tier</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TIER_ORDER.map((tierKey) => {
                      const cfg = TIER_CONFIGS[tierKey];
                      const isSel = singleTier === tierKey;
                      return (
                        <button
                          key={tierKey}
                          type="button"
                          onClick={() => setSingleTier(tierKey)}
                          disabled={isRunning}
                          className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSel
                              ? `${cfg.badgeClass} ring-2 ring-sky-500 font-semibold shadow-xs`
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-base">{cfg.icon}</span>
                          <span className="truncate text-[11px]">{cfg.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Models</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModels(AI_MODEL_OPTIONS.map((m) => m.value))}
                        className="text-[10px] h-5 px-1.5 text-slate-500"
                        disabled={isRunning}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModels([])}
                        className="text-[10px] h-5 px-1.5 text-slate-500"
                        disabled={isRunning}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {AI_MODEL_OPTIONS.map((opt) => {
                      const isChecked = selectedModels.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => {
                            if (isRunning) return;
                            setSelectedModels((prev) =>
                              prev.includes(opt.value) ? prev.filter((m) => m !== opt.value) : [...prev, opt.value]
                            );
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-sky-50/50 border-sky-300"
                              : "bg-slate-50/40 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <Checkbox checked={isChecked} onCheckedChange={() => {}} className="shrink-0" />
                          <span className="text-xs font-medium text-slate-800 truncate">{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runComparison}
                  disabled={isRunning || !imageFile || !groundTruth.trim() || selectedModels.length === 0}
                  className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-semibold text-xs py-4 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunning ? progressLabel : `Execute Candidate Benchmark (${selectedModels.length} Models)`}</span>
                </Button>
              </CardContent>
            </Card>

            {/* Rubric Guide Reference */}
            <Card className="bg-slate-50/80 border-slate-200 text-left text-xs p-3.5 space-y-2.5 rounded-xl">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-600" />
                Graded Relevance Scoring Rubric:
              </span>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300">[3] Exact POI</span>
                  <span>ตรงจุดแลนด์มาร์กเป้าหมายเฉพาะเจาะจง</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-sky-800 bg-sky-100 border border-sky-300">[2] Parent Area</span>
                  <span>ตรงระดับอุทยาน/เกาะ/ภูเขาแม่ข่าย</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300">[1] Neighbor</span>
                  <span>สถานที่ข้างเคียง/คล้ายกันทางสายตา</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-rose-800 bg-rose-100 border border-rose-300">[0] Generic/Wrong</span>
                  <span>ผิดสถานที่ หรือคำนามกว้าง (เช่น ป่าเมฆ)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px] text-slate-600">
                <span className="font-bold text-slate-700 block">Candidate Error Modes:</span>
                <div className="grid grid-cols-1 gap-1 text-[10px]">
                  <span><strong className="text-purple-700">Visual Confusion:</strong> สับสนภาพกับสถานที่จริงอื่น</span>
                  <span><strong className="text-amber-700">Hallucination:</strong> เพ้อเจ้อ/คำนามกว้างไร้พิกัด</span>
                  <span><strong className="text-rose-700">Degradation:</strong> ภาพตกมาตรฐาน/ปฏิเสธ</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: LIVE CANDIDATES BENCHMARK VIEW (7-8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-600" />
                    Top-3 Multi-Candidate Evaluation Table
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Review and grade each candidate's spatial relevance score (0–3) and individual error classification.
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <Button
                    onClick={commitResults}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-xs"
                    disabled={isRunning}
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Commit Session
                  </Button>
                )}
              </CardHeader>

              <CardContent className="pt-4">
                {currentResults.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                    <p className="text-xs font-semibold text-slate-600">No candidate trials generated yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Upload a photo and click Execute Candidate Benchmark.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentResults.map((r, rowIdx) => (
                      <div
                        key={rowIdx}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                      >
                        {/* Row Header: Model, Tier, Top-1, Confidence */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{r.modelLabel}</span>
                            {(() => {
                              const cfg = TIER_CONFIGS[normalizeTier(r.tier || singleTier)];
                              return (
                                <Badge className={`${cfg.badgeClass} text-[9px] px-1.5 py-0.5`}>
                                  {cfg.icon} {cfg.shortLabel}
                                </Badge>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] font-semibold">
                              {Math.round(r.confidence * 100)}% Confidence
                            </Badge>
                            <span className="text-[11px] text-slate-400 font-mono">{r.time_ms} ms</span>
                          </div>
                        </div>

                        {/* Top-3 Candidates Grader Box */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span>Top-3 Recommended Candidates (Switch Name Pool):</span>
                            <span className="text-[10px] font-normal text-slate-400">Score: [3, 2, 1, 0] • Error: Select Mode</span>
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            {r.candidates.map((cand, cIdx) => {
                              const scoreCfg = SCORE_LABELS[cand.score];
                              return (
                                <div
                                  key={cIdx}
                                  className={`p-2.5 rounded-lg border flex flex-col justify-between gap-2.5 ${scoreCfg.bg} ${scoreCfg.border}`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                                        #{cIdx + 1} {cIdx === 0 ? "(Top-1)" : "Option"}
                                      </span>
                                      {cand.similarity > 0 && (
                                        <span className="text-[9px] font-mono font-semibold text-slate-500">
                                          {(cand.similarity * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-semibold text-slate-900 block break-words" title={cand.name}>
                                      {cand.name || "(No candidate)"}
                                    </span>
                                  </div>

                                  <div className="space-y-1.5 pt-1.5 border-t border-slate-200/50">
                                    {/* Interactive Score Selector Pills */}
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[9px] text-slate-400 font-semibold uppercase">Score:</span>
                                      <div className="grid grid-cols-4 gap-1 flex-1">
                                        {([3, 2, 1, 0] as CandidateScore[]).map((sc) => {
                                          const isSel = cand.score === sc;
                                          return (
                                            <button
                                              key={sc}
                                              type="button"
                                              onClick={() => updateCandidateScore(rowIdx, cIdx as 0 | 1 | 2, sc)}
                                              className={`py-0.5 rounded text-[10px] font-bold transition-all ${
                                                isSel
                                                  ? `${SCORE_LABELS[sc].color} bg-white shadow-2xs ring-1 ring-slate-300 scale-105`
                                                  : "text-slate-400 hover:text-slate-700 bg-white/40 hover:bg-white"
                                              }`}
                                              title={SCORE_LABELS[sc].label}
                                            >
                                              {sc}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Candidate-specific Failure Mode Selector */}
                                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/40">
                                      <span className="text-[9px] text-slate-400 font-semibold uppercase">Error:</span>
                                      {cand.score === 3 ? (
                                        <span className="text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-100/60 rounded">
                                          ✓ None
                                        </span>
                                      ) : (
                                        <Select
                                          value={cand.failure_mode || "visual_confusion"}
                                          onValueChange={(val: FailureMode) => updateCandidateFailureMode(rowIdx, cIdx as 0 | 1 | 2, val)}
                                        >
                                          <SelectTrigger className="h-5 text-[9px] px-1.5 py-0 w-[125px] border-slate-200 bg-white font-medium">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none" className="text-xs text-emerald-700 font-semibold">✓ None</SelectItem>
                                            {FAILURE_MODE_OPTIONS.filter((o) => o !== "none").map((opt) => {
                                              const cfg = FAILURE_MODE_CONFIGS[opt];
                                              return (
                                                <SelectItem key={opt} value={opt} className="text-xs">
                                                  {cfg?.shortName || opt}
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Row Footer: Verdicts & Overall Failure Mode */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            {r.top1_strict ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                ✓ Top-1 Exact
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                                Top-1 Miss
                              </Badge>
                            )}

                            {r.top3_recall ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                                ✓ Recovered in Top-3
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px]">
                                ✗ Top-3 Miss
                              </Badge>
                            )}

                            <span className="text-[11px] font-bold text-slate-700">
                              Quality: <strong className="text-sky-700">{r.avg_candidate_score}</strong> / 3.0
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Model Diagnosis:</span>
                            {r.top1_strict ? (
                              <span className="text-[10px] text-emerald-600 font-semibold">None (Correct)</span>
                            ) : (
                              <Select
                                value={r.failure_mode}
                                onValueChange={(val: FailureMode) => updateFailureMode(rowIdx, val)}
                              >
                                <SelectTrigger className="h-6 text-[10px] px-2 py-0 w-[130px] border-slate-200 bg-slate-50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FAILURE_MODE_OPTIONS.filter((o) => o !== "none").map((opt) => (
                                    <SelectItem key={opt} value={opt} className="text-xs">
                                      {FAILURE_MODE_CONFIGS[opt]?.shortName || opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Comparison Table (Combined DB History) */}
            {analytics && analytics.modelBreakdown.length > 0 && (
              <Card className="bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-sky-600" />
                        Model Performance Benchmark (Chapter 4.2 Table)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Aggregated statistics comparing Top-1 Strict Accuracy vs Top-3 Regional Recall recovery.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyLatexTable}
                      className="text-xs h-7 border-slate-200"
                    >
                      <FileCode2 className="w-3.5 h-3.5 mr-1" />
                      Copy LaTeX
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2.5">Model</TableHead>
                          <TableHead className="py-2.5 text-center">N (Trials)</TableHead>
                          <TableHead className="py-2.5 text-center font-bold text-slate-800">Top-1 Strict (%)</TableHead>
                          <TableHead className="py-2.5 text-center font-bold text-emerald-800 bg-emerald-50/50">Top-3 Recall (%)</TableHead>
                          <TableHead className="py-2.5 text-center text-emerald-700">Recovery Gain</TableHead>
                          <TableHead className="py-2.5 text-center font-bold text-sky-800">Avg Quality (0-3)</TableHead>
                          <TableHead className="py-2.5 text-center">Mean Conf (%)</TableHead>
                          <TableHead className="py-2.5 text-center">Mean Latency</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.modelBreakdown.map((m, idx) => (
                          <TableRow key={idx} className="border-b border-slate-100 text-xs">
                            <TableCell className="font-semibold text-slate-900 py-2.5 whitespace-nowrap">
                              {m.modelLabel}
                            </TableCell>
                            <TableCell className="text-center font-mono py-2.5">{m.total}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-slate-800 py-2.5">
                              {m.top1Acc}%
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-emerald-800 bg-emerald-50/30 py-2.5">
                              {m.top3Acc}%
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-emerald-600 py-2.5">
                              +{m.gain}%
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-sky-700 py-2.5">
                              {m.meanScore}
                            </TableCell>
                            <TableCell className="text-center font-mono text-slate-600 py-2.5">
                              {m.meanConf}%
                            </TableCell>
                            <TableCell className="text-center font-mono text-slate-600 py-2.5">
                              {m.meanLatency} ms
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Itemized Candidate Evaluation Records Table */}
            {effectiveLogs.length > 0 && (
              <Card className="bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-600" />
                      Itemized Candidate Records (ประวัติการประเมินแยกตามตัวเลือก)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      แสดงรายการทดลองจริงพร้อมผลการให้คะแนนและข้อผิดพลาดของแต่ละ Candidate อย่างละเอียด
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {effectiveLogs.length} Records
                  </Badge>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2.5 whitespace-nowrap">Model</TableHead>
                          <TableHead className="py-2.5 whitespace-nowrap">Image / GT</TableHead>
                          <TableHead className="py-2.5">Candidate 1 (Score / Error)</TableHead>
                          <TableHead className="py-2.5">Candidate 2 (Score / Error)</TableHead>
                          <TableHead className="py-2.5">Candidate 3 (Score / Error)</TableHead>
                          <TableHead className="py-2.5 text-center">Top-1</TableHead>
                          <TableHead className="py-2.5 text-center">Top-3</TableHead>
                          <TableHead className="py-2.5 text-center">Quality</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {effectiveLogs.map((r, idx) => (
                          <TableRow key={idx} className="border-b border-slate-100 text-xs hover:bg-slate-50/50">
                            <TableCell className="font-semibold text-slate-800 py-2 whitespace-nowrap">
                              {r.model}
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="font-medium text-slate-900 block truncate max-w-[120px]" title={r.ground_truth}>
                                {r.ground_truth}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[120px]" title={r.image_name}>
                                {r.image_name}
                              </span>
                            </TableCell>

                            {/* Candidate 1 */}
                            <TableCell className="py-2 min-w-[150px]">
                              <span className="font-semibold text-slate-900 block truncate max-w-[160px]" title={r.candidate_1_name}>
                                {r.candidate_1_name || "-"}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge className={`${SCORE_LABELS[r.candidate_1_score as CandidateScore]?.bg || "bg-slate-100"} ${SCORE_LABELS[r.candidate_1_score as CandidateScore]?.color || "text-slate-700"} text-[9px] px-1 py-0`}>
                                  Score {r.candidate_1_score}
                                </Badge>
                                <span className={`text-[9px] font-semibold ${
                                  r.candidate_1_failure_mode === "none" ? "text-emerald-600" :
                                  r.candidate_1_failure_mode === "hallucination" ? "text-amber-600" :
                                  r.candidate_1_failure_mode === "visual_confusion" ? "text-purple-600" : "text-rose-600"
                                }`}>
                                  ({FAILURE_MODE_CONFIGS[r.candidate_1_failure_mode]?.shortName || r.candidate_1_failure_mode || "None"})
                                </span>
                              </div>
                            </TableCell>

                            {/* Candidate 2 */}
                            <TableCell className="py-2 min-w-[150px]">
                              <span className="font-semibold text-slate-900 block truncate max-w-[160px]" title={r.candidate_2_name}>
                                {r.candidate_2_name || "-"}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge className={`${SCORE_LABELS[r.candidate_2_score as CandidateScore]?.bg || "bg-slate-100"} ${SCORE_LABELS[r.candidate_2_score as CandidateScore]?.color || "text-slate-700"} text-[9px] px-1 py-0`}>
                                  Score {r.candidate_2_score}
                                </Badge>
                                <span className={`text-[9px] font-semibold ${
                                  r.candidate_2_failure_mode === "none" ? "text-emerald-600" :
                                  r.candidate_2_failure_mode === "hallucination" ? "text-amber-600" :
                                  r.candidate_2_failure_mode === "visual_confusion" ? "text-purple-600" : "text-rose-600"
                                }`}>
                                  ({FAILURE_MODE_CONFIGS[r.candidate_2_failure_mode]?.shortName || r.candidate_2_failure_mode || "None"})
                                </span>
                              </div>
                            </TableCell>

                            {/* Candidate 3 */}
                            <TableCell className="py-2 min-w-[150px]">
                              <span className="font-semibold text-slate-900 block truncate max-w-[160px]" title={r.candidate_3_name}>
                                {r.candidate_3_name || "-"}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge className={`${SCORE_LABELS[r.candidate_3_score as CandidateScore]?.bg || "bg-slate-100"} ${SCORE_LABELS[r.candidate_3_score as CandidateScore]?.color || "text-slate-700"} text-[9px] px-1 py-0`}>
                                  Score {r.candidate_3_score}
                                </Badge>
                                <span className={`text-[9px] font-semibold ${
                                  r.candidate_3_failure_mode === "none" ? "text-emerald-600" :
                                  r.candidate_3_failure_mode === "hallucination" ? "text-amber-600" :
                                  r.candidate_3_failure_mode === "visual_confusion" ? "text-purple-600" : "text-rose-600"
                                }`}>
                                  ({FAILURE_MODE_CONFIGS[r.candidate_3_failure_mode]?.shortName || r.candidate_3_failure_mode || "None"})
                                </span>
                              </div>
                            </TableCell>

                            {/* Top-1 Verdict */}
                            <TableCell className="text-center py-2">
                              {r.top1_strict ? (
                                <span className="text-emerald-600 font-bold text-[11px]">✓</span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">✗</span>
                              )}
                            </TableCell>

                            {/* Top-3 Verdict */}
                            <TableCell className="text-center py-2">
                              {r.top3_recall ? (
                                <span className="text-emerald-600 font-bold text-[11px]">✓</span>
                              ) : (
                                <span className="text-rose-500 font-bold text-[11px]">✗</span>
                              )}
                            </TableCell>

                            {/* Quality Score */}
                            <TableCell className="text-center font-mono font-bold text-sky-700 py-2">
                              {r.avg_candidate_score}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ExperimentLayout>
  );
}
