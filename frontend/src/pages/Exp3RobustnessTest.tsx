import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ExperimentLayout } from "./ExperimentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImageDirect, type VisionResult } from "@/services/aiService";
import {
  evaluatePredictionWithAliases,
  classifyErrorCategory,
  FailureMode,
  FAILURE_MODE_CONFIGS,
} from "@/utils/evaluationMetrics";
import { KeyTakeawaysCard } from "@/components/experiment/KeyTakeawaysCard";
import { HumanDoubleCheckButton } from "@/components/experiment/HumanDoubleCheckButton";
import {
  VPRTier,
  TIER_CONFIGS,
  normalizeTier,
  detectTierFromFilename,
} from "@/types/experimentTiers";
import {
  Upload,
  Sparkles,
  Save,
  Trash2,
  BarChart3,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  CloudRain,
  Camera,
  EyeOff,
  Layers,
  FileCode2,
  Check,
  Play,
  RotateCcw,
  Download,
  Filter,
  ShieldCheck,
  Info,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

/**
 * 5 Standard Controlled Robustness Conditions (Pure 5-Category Architecture)
 */
export interface RobustnessConditionConfig {
  id: string; // "Baseline" | "Illumination" | "Atmospheric" | "Geometric" | "Occlusion"
  code: string; // "C1", "C2", "C3", "C4", "C5"
  name: string;
  nameTh: string;
  shortName: string;
  descriptionTh: string;
  descriptionEn: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeClass: string;
  isBaseline?: boolean;
}

export const ROBUSTNESS_CONDITIONS: RobustnessConditionConfig[] = [
  {
    id: "Baseline",
    code: "C1",
    name: "Baseline (Standard Reference)",
    nameTh: "Baseline (สภาวะอ้างอิงปกติ)",
    shortName: "Baseline",
    icon: Sun,
    color: "#10b981",
    bgColor: "bg-emerald-50 text-emerald-900",
    borderColor: "border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    descriptionTh: "แดดกลางวันปกติ, ฟ้าเปิด, มุมระดับสายตา, ไม่มีอะไรบดบัง",
    descriptionEn: "Daylight, clear sky, pedestrian eye-level, completely unobstructed",
    isBaseline: true,
  },
  {
    id: "Illumination",
    code: "C2",
    name: "Illumination Stress",
    nameTh: "Illumination Stress (แสง)",
    shortName: "Illumination",
    icon: Moon,
    color: "#f59e0b",
    bgColor: "bg-amber-50 text-amber-900",
    borderColor: "border-amber-200",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    descriptionTh: "กลางคืน, เปิดไฟสปอตไลท์, หรือแสงเย็นย้อนแสง",
    descriptionEn: "Nighttime, spotlights, twilight, harsh shadows, backlit scenes",
  },
  {
    id: "Atmospheric",
    code: "C3",
    name: "Atmospheric Stress",
    nameTh: "Atmospheric Stress (อากาศ)",
    shortName: "Atmospheric",
    icon: CloudRain,
    color: "#3b82f6",
    bgColor: "bg-blue-50 text-blue-900",
    borderColor: "border-blue-200",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    descriptionTh: "ฝนตก, หมอกหนา, ฟ้าหลัวควัน, พื้นเปียกสะท้อนน้ำ",
    descriptionEn: "Rain, dense fog/mist, haze/smog, wet surface reflections",
  },
  {
    id: "Geometric",
    code: "C4",
    name: "Geometric Stress",
    nameTh: "Geometric Stress (มุมมอง)",
    shortName: "Geometric",
    icon: Camera,
    color: "#8b5cf6",
    bgColor: "bg-purple-50 text-purple-900",
    borderColor: "border-purple-200",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    descriptionTh: "มุมสูง, ภาพจากโดรน, จุดชมวิวมุมกด (Bird's-eye view)",
    descriptionEn: "High-altitude aerial, drone photography, bird's-eye view, steep vantage tilt",
  },
  {
    id: "Occlusion",
    code: "C5",
    name: "Occlusion Stress",
    nameTh: "Occlusion Stress (สิ่งบดบัง/เบลอ)",
    shortName: "Occlusion",
    icon: EyeOff,
    color: "#ef4444",
    bgColor: "bg-rose-50 text-rose-900",
    borderColor: "border-rose-200",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    descriptionTh: "มีนักท่องเที่ยวบัง, ร่ม/รถบัง, หรือภาพสั่นเบลอ (Blur)",
    descriptionEn: "Tourist crowds, umbrellas/vehicles in foreground, camera motion blur",
  },
];

/**
 * Tiers strictly allowed in Experiment 3 (Tier 4 UGC is excluded)
 */
export const EXP3_TIERS: VPRTier[] = ["tier1_iconic", "tier2_longtail", "tier3_nature"];

/**
 * Backward-compatible normalizer for condition categories
 */
export function normalizeConditionCategory(cat: string): string {
  if (!cat) return "Baseline";
  const c = cat.toLowerCase();
  if (c.includes("base") || c.includes("normal") || c.includes("ref") || c.includes("c1")) return "Baseline";
  if (c.includes("light") || c.includes("illum") || c.includes("night") || c.includes("c2")) return "Illumination";
  if (c.includes("weath") || c.includes("atmosph") || c.includes("rain") || c.includes("fog") || c.includes("c3")) return "Atmospheric";
  if (c.includes("angle") || c.includes("geom") || c.includes("view") || c.includes("aerial") || c.includes("c4")) return "Geometric";
  if (c.includes("qual") || c.includes("occlu") || c.includes("blur") || c.includes("crowd") || c.includes("c5")) return "Occlusion";
  return "Baseline";
}

/**
 * Auto-detect 1 of the 5 conditions from filename
 */
function detectConditionFromFilename(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes("base") || f.includes("normal") || f.includes("c1") || f.includes("day") || f.includes("clear") || f.includes("sunny")) {
    return "Baseline";
  }
  if (f.includes("night") || f.includes("light") || f.includes("c2") || f.includes("dark") || f.includes("sunset") || f.includes("dusk") || f.includes("shadow")) {
    return "Illumination";
  }
  if (f.includes("rain") || f.includes("fog") || f.includes("c3") || f.includes("wet") || f.includes("mist") || f.includes("haze") || f.includes("smog") || f.includes("cloud")) {
    return "Atmospheric";
  }
  if (f.includes("drone") || f.includes("aerial") || f.includes("c4") || f.includes("bird") || f.includes("high") || f.includes("tilt") || f.includes("top")) {
    return "Geometric";
  }
  if (f.includes("crowd") || f.includes("blur") || f.includes("c5") || f.includes("occlu") || f.includes("people") || f.includes("umbrella") || f.includes("block") || f.includes("car")) {
    return "Occlusion";
  }
  return "Baseline";
}

/**
 * Detect tier from filename but restrict to Tiers 1-3 for Exp 3
 */
function detectExp3Tier(filename: string): VPRTier {
  const detected = detectTierFromFilename(filename);
  if (detected === "tier4_ugc") return "tier1_iconic";
  return detected;
}

interface RobustnessImageItem {
  id: string;
  file: File;
  preview: string;
  condition: string; // One of the 5: "Baseline" | "Illumination" | "Atmospheric" | "Geometric" | "Occlusion"
  tier: VPRTier;
}

interface Exp3Result {
  image_name: string;
  condition_category: string;
  condition_label: string;
  tier?: VPRTier;
  variant_id?: string;
  variant_name?: string;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
  recall_rank?: number;
  match_score?: number;
  user_verified?: boolean;
  matched_alias?: string | null;
  reasoning?: string;
  failure_mode?: FailureMode;
  temperature?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  tokens_per_sec?: number;
  openrouter_id?: string;
  generation_time_ms?: number;
  pure_tokens_per_sec?: number;
  provider_name?: string;
}

interface Exp3History {
  timestamp: string;
  ground_truth: string;
  image_name: string;
  condition_category: string;
  condition_label: string;
  tier: VPRTier;
  variant_id?: string;
  variant_name?: string;
  model: string;
  predicted: string;
  confidence: number | string;
  time_ms: number | string;
  is_correct: string | boolean;
  recall_rank?: number;
  matched_alias?: string | null;
  reasoning?: string;
  failure_mode?: FailureMode;
  temperature?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  tokens_per_sec?: number;
  openrouter_id?: string;
  generation_time_ms?: number;
  pure_tokens_per_sec?: number;
  provider_name?: string;
}

function isTruthy(v: string | boolean | undefined): boolean {
  return v === true || v === "true" || v === "True" || v === "1";
}

export default function Exp3RobustnessTest() {
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [imageList, setImageList] = useState<RobustnessImageItem[]>([]);
  const [selectedModels, setSelectedModels] = useState<AIModelType[]>([
    "google-gemini-38-flash",
    "openai-gpt-54-mini",
    "anthropic-claude-sonnet5",
    "openai-gpt-54",
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp3Result[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp3History[]>([]);
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [chartView, setChartView] = useState<"radar" | "degradation">("radar");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("all");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results_exp3`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((row: any) => ({
          timestamp: row["Timestamp"] || row.timestamp || "",
          ground_truth: row["Landmark Ground Truth"] || row.ground_truth || "",
          image_name: row["Image Name"] || row.image_name || "",
          condition_category: normalizeConditionCategory(row["Condition Category"] || row.condition_category || ""),
          condition_label: row["Condition Label"] || row.condition_label || "",
          tier: normalizeTier(row["Tier"] || row.tier || "tier1_iconic"),
          variant_id: row["Prompt Variant ID"] || row.variant_id || "P1",
          variant_name: row["Prompt Variant Name"] || row.variant_name || "P1: Zero-Shot Direct (EN)",
          model: row["Model"] || row.model || "",
          predicted: row["Predicted Place"] || row.predicted || "",
          confidence: row["Confidence"] !== undefined ? row["Confidence"] : row.confidence,
          time_ms: row["Time MS"] !== undefined ? row["Time MS"] : row.time_ms,
          is_correct: row["Is Correct"] !== undefined ? row["Is Correct"] : row.is_correct,
          recall_rank: row["Recall Rank"] !== undefined ? Number(row["Recall Rank"]) : (isTruthy(row["Is Correct"] || row.is_correct) ? 1 : 0),
          matched_alias: row["Matched Alias"] || row.matched_alias || null,
          reasoning: row["AI Reasoning"] || row.reasoning || "",
          failure_mode: (row["Failure Mode"] || row.failure_mode || "none") as FailureMode,
          temperature: row["Temperature"] !== undefined ? Number(row["Temperature"]) : 0.0,
          prompt_tokens: row["Prompt Tokens"] !== undefined ? Number(row["Prompt Tokens"]) : row.prompt_tokens,
          completion_tokens: row["Completion Tokens"] !== undefined ? Number(row["Completion Tokens"]) : row.completion_tokens,
          total_tokens: row["Total Tokens"] !== undefined ? Number(row["Total Tokens"]) : row.total_tokens,
          cost_usd: row["Cost USD"] !== undefined ? Number(row["Cost USD"]) : row.cost_usd,
          tokens_per_sec: row["Tokens Per Sec"] !== undefined ? Number(row["Tokens Per Sec"]) : row.tokens_per_sec,
          openrouter_id: row["OpenRouter ID"] || row.openrouter_id || "",
          generation_time_ms: row["Generation Time MS"] ? Number(row["Generation Time MS"]) : undefined,
          pure_tokens_per_sec: row["Pure Tokens Per Sec"] ? Number(row["Pure Tokens Per Sec"]) : undefined,
          provider_name: row["Provider Name"] || row.provider_name || "",
        }));
        setDbLogs(mapped);
      }
    } catch (e) {
      console.error("Failed to load Exp3 history:", e);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleMultipleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newItems: RobustnessImageItem[] = files.map((file, idx) => {
        const detectedCategory = detectConditionFromFilename(file.name);
        return {
          id: `${file.name}-${Date.now()}-${idx}`,
          file,
          preview: URL.createObjectURL(file),
          condition: detectedCategory,
          tier: detectExp3Tier(file.name),
        };
      });
      setImageList((prev) => [...prev, ...newItems]);
      if (!groundTruth) {
        const guessed = files[0].name.substring(0, files[0].name.lastIndexOf(".")).replace(/[-_]/g, " ");
        setGroundTruth(guessed);
      }
    }
  };

  const removeImage = (id: string) => setImageList((prev) => prev.filter((item) => item.id !== id));

  const updateImageCondition = (id: string, condId: string) => {
    setImageList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, condition: condId } : item))
    );
  };

  const updateImageTier = (id: string, tier: VPRTier) => {
    setImageList((prev) => prev.map((item) => (item.id === id ? { ...item, tier } : item)));
  };

  const runRobustnessTest = async () => {
    if (imageList.length === 0 || !groundTruth.trim()) {
      toast.error("Please add images and specify Ground Truth.");
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("Select at least one model.");
      return;
    }

    setIsRunning(true);
    setCurrentResults([]);
    const temp: Exp3Result[] = [];

    for (let i = 0; i < imageList.length; i++) {
      const item = imageList[i];
      const condConfig = ROBUSTNESS_CONDITIONS.find((c) => c.id === item.condition);
      const condLabel = condConfig ? `${condConfig.code}: ${condConfig.shortName}` : item.condition;

      for (const modelId of selectedModels) {
        const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === modelId);
        const label = modelOpt ? modelOpt.label : modelId;

        setProgressLabel(`Testing [${item.file.name}] (${condLabel}) on ${label}...`);
        const start = performance.now();
        let res: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
        try {
          res = await analyzeImageDirect(
            item.file,
            modelId,
            (step) => setProgressLabel(`[${label}] ${step}`),
            { allowFallback: false, temperature: 0.1, promptVariant: "P1" }
          );
        } catch (err) {
          console.error("Exp3 error:", err);
        }
        const duration = Math.round(performance.now() - start);

        const pred = res.place || "Unknown";

        // Automated multi-alias evaluation
        const match = evaluatePredictionWithAliases(pred, groundTruth, res.similar_locations || [], 0.70);

        // Failure Mode Taxonomy (3 Symptoms)
        const failureMode = classifyErrorCategory(pred, groundTruth, {
          isCorrect: match.isCorrect,
          confidence: res.confidence || 0.0,
          tier: item.tier,
          conditionCategory: item.condition,
          conditionLabel: condLabel,
        });

        temp.push({
          image_name: item.file.name,
          condition_category: item.condition,
          condition_label: condLabel,
          tier: item.tier,
          variant_id: "P1",
          variant_name: "P1: Zero-Shot Direct (EN)",
          model: modelId,
          modelLabel: label,
          predicted: pred,
          confidence: res.confidence || 0.0,
          time_ms: res.metrics?.latency_ms ? Math.round(res.metrics.latency_ms) : duration,
          is_correct: match.isCorrect,
          recall_rank: match.rank,
          match_score: match.matchScore,
          user_verified: false,
          matched_alias: match.matchedAlias,
          reasoning: Array.isArray(res.ai_reasoning) ? res.ai_reasoning.join("; ") : (res.ai_reasoning || ""),
          failure_mode: failureMode,
          temperature: 0.1,
          prompt_tokens: res.metrics?.prompt_tokens ?? 0,
          completion_tokens: res.metrics?.completion_tokens ?? 0,
          total_tokens: res.metrics?.total_tokens ?? 0,
          cost_usd: res.metrics?.cost_usd ?? 0.0,
          tokens_per_sec: res.metrics?.tokens_per_sec ?? 0.0,
          openrouter_id: res.metrics?.openrouter_id || "",
        });

        setCurrentResults([...temp]);
      }
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success("Robustness Test Complete! Evaluated with 5 controlled perturbation conditions.");
  };

  const updateCorrectness = (index: number, value: boolean) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      const prevMode = updated[index].failure_mode;
      updated[index] = {
        ...updated[index],
        is_correct: value,
        user_verified: true,
        failure_mode: value ? "none" : (prevMode && prevMode !== "none" ? prevMode : "visual_confusion"),
      };
      return updated;
    });
  };

  const commitResults = async () => {
    if (currentResults.length === 0) return;

    const payload = {
      ground_truth: groundTruth,
      temperature: 0.1,
      results: currentResults.map((r) => ({
        image_name: r.image_name,
        condition_category: r.condition_category,
        condition_label: r.condition_label,
        tier: r.tier || "tier1_iconic",
        variant_id: r.variant_id || "P1",
        variant_name: r.variant_name || "P1: Zero-Shot Direct (EN)",
        model: r.model,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
        recall_rank: r.recall_rank,
        matched_alias: r.matched_alias,
        reasoning: r.reasoning || "",
        temperature: 0.1,
        failure_mode: r.failure_mode || "none",
        prompt_tokens: r.prompt_tokens ?? 0,
        completion_tokens: r.completion_tokens ?? 0,
        total_tokens: r.total_tokens ?? 0,
        cost_usd: r.cost_usd ?? 0.0,
        tokens_per_sec: r.tokens_per_sec ?? 0.0,
        openrouter_id: r.openrouter_id || "",
      })),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save_exp3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Robustness results committed to database!");
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp3 results.");
    }
  };

  // Analytics Computation for the 5 Controlled Conditions
  const analytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    // Filter by selected tier
    const filteredLogs = selectedTierFilter === "all"
      ? dbLogs
      : dbLogs.filter((r) => normalizeTier(r.tier) === selectedTierFilter);

    if (filteredLogs.length === 0) return null;

    // 5 Condition Map
    const catMap: Record<string, { total: number; correct: number }> = {};
    ROBUSTNESS_CONDITIONS.forEach((c) => {
      catMap[c.id] = { total: 0, correct: 0 };
    });

    filteredLogs.forEach((row) => {
      const cat = normalizeConditionCategory(row.condition_category);
      if (!catMap[cat]) catMap[cat] = { total: 0, correct: 0 };
      catMap[cat].total += 1;
      if (isTruthy(row.is_correct)) catMap[cat].correct += 1;
    });

    // Reference Baseline Accuracy (C1)
    const baselineTotal = catMap["Baseline"]?.total || 0;
    const baselineCorrect = catMap["Baseline"]?.correct || 0;
    const baselineAcc = baselineTotal > 0 ? Math.round((baselineCorrect / baselineTotal) * 100) : 100;

    const conditionBreakdown = ROBUSTNESS_CONDITIONS.map((cond) => {
      const d = catMap[cond.id] || { total: 0, correct: 0 };
      const acc = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      const delta = cond.isBaseline ? 0 : acc - baselineAcc;
      return {
        id: cond.id,
        code: cond.code,
        name: cond.name,
        nameTh: cond.nameTh,
        shortName: cond.shortName,
        icon: cond.icon,
        total: d.total,
        correct: d.correct,
        accuracy: acc,
        delta,
        isBaseline: cond.isBaseline,
        color: cond.color,
        bgColor: cond.bgColor,
        borderColor: cond.borderColor,
        badgeClass: cond.badgeClass,
        descriptionTh: cond.descriptionTh,
        descriptionEn: cond.descriptionEn,
      };
    });

    // Per-model stats
    const modelStats: Record<string, { total: number; correct: number }> = {};
    filteredLogs.forEach((row) => {
      if (!modelStats[row.model]) modelStats[row.model] = { total: 0, correct: 0 };
      modelStats[row.model].total += 1;
      if (isTruthy(row.is_correct)) modelStats[row.model].correct += 1;
    });

    const modelBreakdown = Object.entries(modelStats)
      .map(([model, d]) => {
        const opt = AI_MODEL_OPTIONS.find((o) => o.value === model);
        return {
          model,
          modelLabel: opt ? opt.label : model,
          shortModel: opt ? opt.label.split(" ")[0] : model.split("-").slice(-2).join("-"),
          accuracy: Math.round((d.correct / d.total) * 100),
          total: d.total,
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy);

    const overallAcc = Math.round(
      (filteredLogs.filter((r) => isTruthy(r.is_correct)).length / filteredLogs.length) * 100
    );

    // 5-Axis Robustness Radar Data (Pentagon Profile)
    const radarData = ROBUSTNESS_CONDITIONS.map((cond) => {
      const d = catMap[cond.id] || { total: 0, correct: 0 };
      const acc = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      return {
        subject: `${cond.code}: ${cond.shortName}`,
        accuracy: acc,
        baseline: baselineAcc,
        fullMark: 100,
      };
    });

    return {
      conditionBreakdown,
      modelBreakdown,
      radarData,
      overallAcc,
      baselineAcc,
      total: filteredLogs.length,
      unfilteredTotal: dbLogs.length,
    };
  }, [dbLogs, selectedTierFilter]);

  const copyRobustnessLatex = () => {
    if (!analytics) return;
    const rows = analytics.conditionBreakdown.map((c) => {
      const deltaStr = c.isBaseline
        ? "\\textit{Reference}"
        : `${c.delta >= 0 ? "+" : ""}${c.delta}\\%`;
      return `    ${c.code}: ${c.shortName} & ${c.descriptionEn} & ${c.total} & ${c.accuracy}\\% & ${deltaStr} \\\\`;
    }).join("\n");

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Environmental Robustness & Controlled Perturbation Benchmark (Tiers 1--3)}
  \\label{tab:exp3_robustness_eval}
  \\begin{tabular}{l p{5.5cm} r r r}
    \\toprule
    \\textbf{Condition} & \\textbf{Perturbation Scope} & \\textbf{Trials (N)} & \\textbf{Accuracy (\\%)} & \\textbf{$\\Delta$ Degradation} \\\\
    \\midrule
${rows}
    \\midrule
    \\textbf{Overall Robustness} & \\textbf{All Environmental Stress Trials} & \\textbf{${analytics.total}} & \\textbf{${analytics.overallAcc}\\%} & \\textbf{${analytics.overallAcc - analytics.baselineAcc}\\%} \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    toast.success("Robustness LaTeX Table copied to clipboard!");
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  // Export Full CSV
  const exportFullCSV = () => {
    const records = dbLogs.length > 0 ? dbLogs : currentResults.map((r) => ({
      timestamp: new Date().toISOString(),
      image_name: r.image_name || "current_trial",
      ground_truth: groundTruth,
      condition_category: r.condition_category,
      condition_label: r.condition_label,
      tier: r.tier || "tier1_iconic",
      model: r.modelLabel,
      predicted: r.predicted,
      confidence: r.confidence,
      time_ms: r.time_ms,
      is_correct: r.is_correct,
      failure_mode: r.failure_mode,
      temperature: r.temperature ?? 0.0,
      prompt_tokens: r.prompt_tokens,
      completion_tokens: r.completion_tokens,
      total_tokens: r.total_tokens,
      cost_usd: r.cost_usd,
      tokens_per_sec: r.tokens_per_sec,
    }));

    if (records.length === 0) {
      toast.error("No robustness records available to export.");
      return;
    }

    const headers = [
      "Timestamp",
      "Landmark Ground Truth",
      "Image Name",
      "Tier",
      "Condition Category",
      "Condition Label",
      "Prompt Variant ID",
      "Prompt Variant Name",
      "Model",
      "Predicted Place",
      "Confidence",
      "Time MS",
      "Is Correct",
      "Recall Rank",
      "Matched Alias",
      "AI Reasoning",
      "Temperature",
      "Failure Mode",
      "Prompt Tokens",
      "Completion Tokens",
      "Total Tokens",
      "Cost USD",
      "Tokens Per Sec",
      "Generation Time MS",
      "Pure Tokens Per Sec",
      "Provider Name",
      "OpenRouter ID",
    ];

    const rows = records.map((log) => {
      const normCat = normalizeConditionCategory(log.condition_category || "");
      const condConfig = ROBUSTNESS_CONDITIONS.find((c) => c.id === normCat);
      return [
        log.timestamp,
        log.ground_truth || "",
        log.image_name || "",
        normalizeTier(log.tier),
        normCat,
        condConfig?.code || log.condition_label || "C?",
        log.variant_id || "P1",
        log.variant_name || "P1: Zero-Shot Direct (EN)",
        log.model,
        log.predicted || "",
        log.confidence !== undefined ? Number(log.confidence).toFixed(4) : "",
        log.time_ms,
        isTruthy(log.is_correct) ? "True" : "False",
        log.recall_rank !== undefined ? log.recall_rank : (isTruthy(log.is_correct) ? 1 : 0),
        log.matched_alias || "",
        log.reasoning || "",
        log.temperature ?? 0.1,
        log.failure_mode || "none",
        log.prompt_tokens ?? "",
        log.completion_tokens ?? "",
        log.total_tokens ?? "",
        log.cost_usd !== undefined ? Number(log.cost_usd).toFixed(6) : "",
        log.tokens_per_sec !== undefined ? Number(log.tokens_per_sec).toFixed(2) : "",
        log.generation_time_ms ?? "",
        log.pure_tokens_per_sec !== undefined ? Number(log.pure_tokens_per_sec).toFixed(2) : "",
        log.provider_name || "",
        log.openrouter_id || "",
      ];
    });

    const filename = `VPR_Thesis_Exp3_Robustness_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    toast.success(`Exported ${rows.length} Exp3 records to CSV!`);
  };

  return (
    <ExperimentLayout>
      <div className="space-y-6">
        {/* Header Title & Academic Badges */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Experiment 3: Environmental Robustness & Controlled Perturbation
              </h2>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
                Thesis Chap. 4.3
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Prompt: P1 Zero-Shot (Exp 4 Optimal)
              </Badge>
              <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-600 font-mono">
                Tiers 1–3 (Controlled)
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              5 Controlled Perturbation Conditions: Baseline (C1) vs Illumination (C2), Atmospheric (C3), Geometric (C4), and Occlusion (C5).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportFullCSV}
              className="text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-2xs h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Download Full CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyRobustnessLatex}
              disabled={!analytics}
              className="text-xs bg-white text-amber-700 border-amber-200 hover:bg-amber-50 shadow-2xs h-8"
            >
              {copiedLatex ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <FileCode2 className="w-3.5 h-3.5 mr-1 text-amber-600" />}
              {copiedLatex ? "Copied LaTeX" : "Export Robustness LaTeX"}
            </Button>
          </div>
        </div>

        {/* Executive Summary Takeaways Card */}
        <KeyTakeawaysCard expId="exp3" />

        {/* Tier Slicer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">Dataset Tier Slicer:</span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              (Filter robustness analytics across benchmark tiers)
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Button
              variant={selectedTierFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTierFilter("all")}
              className={`text-xs h-7 px-3 rounded-lg font-medium transition-all ${
                selectedTierFilter === "all"
                  ? "bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Tiers (T1–T3)
            </Button>
            {EXP3_TIERS.map((tierKey) => {
              const cfg = TIER_CONFIGS[tierKey];
              const isSelected = selectedTierFilter === tierKey;
              return (
                <Button
                  key={tierKey}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTierFilter(tierKey)}
                  className={`text-xs h-7 px-3 rounded-lg font-medium transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="mr-1">{cfg.icon}</span>
                  {cfg.shortLabel}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Top Hero KPI Dashboard: 6 Cards (Overall + C1-C5 Conditions) */}
        {analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Card 1: Overall Robustness */}
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs text-left">
                <CardContent className="p-3.5 flex flex-col justify-between h-full">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Overall Robustness
                    </span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5">
                      {analytics.overallAcc}%
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60">
                    <p className="text-[10px] text-slate-300 font-mono">
                      {analytics.total} total trials
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Cards 2-6: The 5 Conditions */}
              {analytics.conditionBreakdown.map((cond) => {
                const Icon = cond.icon;
                const isBaseline = cond.isBaseline;
                return (
                  <Card key={cond.id} className="bg-white border-slate-200/90 shadow-xs text-left">
                    <CardContent className="p-3.5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            <span className="font-mono text-slate-500 font-semibold">{cond.code}:</span>{" "}
                            {cond.shortName}
                          </span>
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cond.color }} />
                        </div>

                        <div className="flex items-baseline justify-between mt-1.5">
                          <p className="text-2xl font-extrabold" style={{ color: cond.color }}>
                            {cond.accuracy}%
                          </p>
                          {isBaseline ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] px-1.5 py-0">
                              Reference
                            </Badge>
                          ) : (
                            <Badge
                              className={`text-[9px] px-1.5 py-0 font-mono font-bold ${
                                cond.delta < 0
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              Δ {cond.delta >= 0 ? "+" : ""}{cond.delta}%
                            </Badge>
                          )}
                        </div>

                        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${cond.accuracy}%`, backgroundColor: cond.color }}
                          />
                        </div>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-mono truncate" title={cond.descriptionTh}>
                          {cond.correct}/{cond.total} correct
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 5-Axis Radar Chart & Model Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Degradation Ranking / 5-Axis Pentagon Radar Chart (7 cols) */}
              <Card className="lg:col-span-7 bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-amber-600" />
                        {chartView === "radar"
                          ? "5-Axis Controlled Robustness Radar (Pentagon)"
                          : "Degradation Ranking Across 5 Conditions"}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        {chartView === "radar"
                          ? "Compares empirical stress resilience against Baseline (C1 reference standard)."
                          : "Ranked from lowest resilience to highest — highlights primary failure modes."}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <Button
                        variant={chartView === "radar" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setChartView("radar")}
                        className={`text-[10px] h-6 px-2.5 rounded-lg font-semibold ${
                          chartView === "radar" ? "bg-white text-amber-700 shadow-xs hover:bg-white" : "text-slate-600"
                        }`}
                      >
                        Radar Profile
                      </Button>
                      <Button
                        variant={chartView === "degradation" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setChartView("degradation")}
                        className={`text-[10px] h-6 px-2.5 rounded-lg font-semibold ${
                          chartView === "degradation" ? "bg-white text-amber-700 shadow-xs hover:bg-white" : "text-slate-600"
                        }`}
                      >
                        Degradation Bar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {chartView === "radar" ? (
                    <div className="h-68 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={analytics.radarData} margin={{ top: 12, right: 35, left: 35, bottom: 12 }}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#334155", fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <RechartsTooltip
                            formatter={(v: any, name: string) => [`${v}%`, name]}
                            contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          {/* Ideal Reference Baseline Radar */}
                          <Radar
                            name={`Baseline C1 Reference (${analytics.baselineAcc}%)`}
                            dataKey="baseline"
                            stroke="#10b981"
                            strokeDasharray="4 4"
                            fill="#10b981"
                            fillOpacity={0.08}
                          />
                          {/* Empirical Robustness Radar */}
                          <Radar
                            name="Empirical Robustness"
                            dataKey="accuracy"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.35}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-68 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[...analytics.conditionBreakdown].sort((a, b) => a.accuracy - b.accuracy)}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10 }} width={100} />
                          <RechartsTooltip
                            formatter={(v: number, name: string, item: any) => [
                              `${v}% (Δ ${item.payload.delta >= 0 ? "+" : ""}${item.payload.delta}%)`,
                              "Accuracy"
                            ]}
                            contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px", borderColor: "#e2e8f0" }}
                          />
                          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                            {analytics.conditionBreakdown.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Model Robustness Ranking (5 cols) */}
              <Card className="lg:col-span-5 bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Model Robustness Leaderboard
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Resilience across all 5 controlled perturbation conditions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2">Rank</TableHead>
                          <TableHead className="py-2">Model</TableHead>
                          <TableHead className="py-2 text-right">Accuracy</TableHead>
                          <TableHead className="py-2 text-right">Trials</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.modelBreakdown.map((row, i) => (
                          <TableRow key={row.model} className="border-b border-slate-100 text-xs">
                            <TableCell className="font-bold py-2">
                              {i === 0 ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">#1 Top</Badge>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">#{i + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-slate-800 py-2">{row.modelLabel}</TableCell>
                            <TableCell className="text-right font-extrabold text-indigo-700 py-2">{row.accuracy}%</TableCell>
                            <TableCell className="text-right text-slate-500 py-2">{row.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Main 2-Column Test Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: MULTI-IMAGE DATASET SETUP (5 cols) */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  1. Multi-Condition Photo Dataset
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Select 1 of the 5 controlled conditions per image across Tiers 1-3.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-5">
                {/* Methodological Guidance Note */}
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-left text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    <span>5 Controlled Conditions per Landmark:</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[11px] text-amber-900/90 pl-1 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Sun className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span><strong className="text-emerald-800 font-bold">C1: Baseline</strong> — แดดกลางวันปกติ, ฟ้าเปิด, มุมระดับสายตา</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Moon className="w-3 h-3 text-amber-600 shrink-0" />
                      <span><strong className="text-amber-800 font-bold">C2: Illumination</strong> — กลางคืน, สปอตไลท์, ย้อนแสงเงามืด</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CloudRain className="w-3 h-3 text-blue-600 shrink-0" />
                      <span><strong className="text-blue-800 font-bold">C3: Atmospheric</strong> — ฝนตก, หมอกหนา, ฟ้าหลัวควัน, พื้นเปียก</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3 h-3 text-purple-600 shrink-0" />
                      <span><strong className="text-purple-800 font-bold">C4: Geometric</strong> — มุมสูง, โดรน, จุดชมวิวมุมกด (Bird's-eye)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <EyeOff className="w-3 h-3 text-rose-600 shrink-0" />
                      <span><strong className="text-rose-800 font-bold">C5: Occlusion</strong> — นักท่องเที่ยวบัง, ร่ม/รถบัง, ภาพสั่นเบลอ</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 italic pt-0.5">
                    * จำกัดเฉพาะ Tier 1 (Iconic), Tier 2 (Long-tail), และ Tier 3 (Nature)
                  </p>
                </div>

                {/* Ground Truth */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Landmark Ground Truth (Multi-Alias)</Label>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Wat Arun | วัดอรุณ | Temple of Dawn"
                    className="bg-white text-xs border-slate-200 text-slate-900"
                    disabled={isRunning}
                  />
                </div>

                {/* Upload Zone */}
                <div>
                  <Input type="file" accept="image/*" multiple onChange={handleMultipleFiles} className="hidden" id="exp3-files" disabled={isRunning} />
                  <label
                    htmlFor="exp3-files"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-amber-400 p-5 rounded-2xl cursor-pointer bg-amber-50/20 transition-all text-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Add Landmark Images</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Upload photos for the 5 controlled conditions (C1–C5)</span>
                  </label>
                </div>

                {/* Image List Preview & Clean 2-Field Tagging */}
                {imageList.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Condition Tagging Queue ({imageList.length} images)</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setImageList([])}
                        className="text-[10px] h-6 px-1.5 text-rose-600 hover:bg-rose-50"
                        disabled={isRunning}
                      >
                        Clear All
                      </Button>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                      {imageList.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                          <img src={item.preview} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0 border border-slate-200" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-xs font-mono text-slate-700 truncate">{item.file.name}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {/* Clean Dropdown 1: Exactly 5 Conditions */}
                              <Select
                                value={item.condition}
                                onValueChange={(v) => updateImageCondition(item.id, v)}
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-7 text-xs bg-white font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROBUSTNESS_CONDITIONS.map((cond) => {
                                    const Icon = cond.icon;
                                    return (
                                      <SelectItem key={cond.id} value={cond.id} className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cond.color }} />
                                          <span className="font-bold">{cond.code}:</span>
                                          <span className="truncate">{cond.shortName}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>

                              {/* Clean Dropdown 2: Tier (Tiers 1-3 only) */}
                              <Select
                                value={item.tier}
                                onValueChange={(v) => updateImageTier(item.id, v as VPRTier)}
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-7 text-xs bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EXP3_TIERS.map((tierKey) => {
                                    const cfg = TIER_CONFIGS[tierKey];
                                    return (
                                      <SelectItem key={tierKey} value={tierKey} className="text-xs">
                                        <span className="font-semibold">{cfg.icon} {cfg.shortLabel}</span>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {!isRunning && (
                            <button
                              type="button"
                              onClick={() => removeImage(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Models to Test ({selectedModels.length})</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedModels(AI_MODEL_OPTIONS.map((m) => m.value))}
                      className="text-[10px] h-6 px-1 text-slate-500"
                      disabled={isRunning}
                    >
                      Select All
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
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
                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked ? "bg-amber-50/60 border-amber-200" : "bg-slate-50/60 border-slate-200"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {}}
                            className="border-slate-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            disabled={isRunning}
                          />
                          <span className="truncate text-slate-800 font-medium text-[11px]">{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runRobustnessTest}
                  disabled={isRunning || imageList.length === 0 || !groundTruth.trim() || selectedModels.length === 0}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunning ? progressLabel : `Start Robustness Evaluation (${imageList.length} Images × ${selectedModels.length} Models)`}</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: LIVE EVALUATION & PREDICTIONS FEED (7 cols) */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    Live Robustness Results Feed
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Predictions evaluated across the 5 controlled conditions.
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <Button
                    onClick={commitResults}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Commit to CSV
                  </Button>
                )}
              </CardHeader>

              <CardContent className="pt-6">
                {currentResults.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                    <p className="text-xs font-semibold text-slate-600">No robustness evaluations generated yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Upload perturbation photos and click Start Evaluation.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-80">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2.5">Condition</TableHead>
                          <TableHead className="py-2.5">Model</TableHead>
                          <TableHead className="py-2.5 min-w-[220px]">Prediction</TableHead>
                          <TableHead className="py-2.5 text-center">Tokens (In / Out)</TableHead>
                          <TableHead className="py-2.5 text-center">Cost ($)</TableHead>
                          <TableHead className="py-2.5 text-center">Latency</TableHead>
                          <TableHead className="py-2.5 text-center">Double-Check (Verdict)</TableHead>
                          <TableHead className="py-2.5 text-center">Failure Mode</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => {
                          const condConfig = ROBUSTNESS_CONDITIONS.find((c) => c.id === r.condition_category);
                          return (
                            <TableRow key={idx} className="border-b border-slate-100 text-xs">
                              <TableCell className="py-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold"
                                  style={{
                                    backgroundColor: condConfig ? `${condConfig.color}15` : "#f8fafc",
                                    color: condConfig ? condConfig.color : "#475569",
                                    borderColor: condConfig ? `${condConfig.color}40` : "#cbd5e1",
                                  }}
                                >
                                  {condConfig?.code || "C?"} {condConfig?.shortName || r.condition_category}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-800 py-2">{r.modelLabel}</TableCell>
                              <TableCell className="py-2 min-w-[220px]">
                                <span className="block font-medium text-slate-900 break-words" title={r.predicted}>{r.predicted}</span>
                                {r.matched_alias && (
                                  <span className="text-[10px] text-emerald-600 block">Matched: "{r.matched_alias}"</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-mono text-[11px] text-slate-700 py-2">
                                {r.prompt_tokens ?? 0} / {r.completion_tokens ?? 0}
                              </TableCell>
                              <TableCell className="text-center font-mono text-[11px] text-emerald-700 font-semibold py-2">
                                ${(r.cost_usd ?? 0).toFixed(6)}
                              </TableCell>
                              <TableCell className="text-center font-mono text-[11px] text-slate-600 py-2">
                                {r.time_ms}ms
                              </TableCell>
                              <TableCell className="text-center py-2">
                                <HumanDoubleCheckButton
                                  isCorrect={r.is_correct}
                                  matchScore={r.match_score}
                                  matchedAlias={r.matched_alias}
                                  isVerified={r.user_verified}
                                  onChange={(val) => updateCorrectness(idx, val)}
                                />
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {r.is_correct ? (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200">
                                    ✓ None
                                  </Badge>
                                ) : (
                                  (() => {
                                    const fm = (r.failure_mode as FailureMode) || "visual_confusion";
                                    const cfg = FAILURE_MODE_CONFIGS[fm] || FAILURE_MODE_CONFIGS["visual_confusion"];
                                    return (
                                      <Badge className={`${cfg.badgeClass} text-[9px] px-1.5 py-0.5 font-medium`}>
                                        {cfg.icon} {cfg.shortLabel}
                                      </Badge>
                                    );
                                  })()
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historical Log */}
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Historical Robustness Logs ({dbLogs.length} records)
                  </CardTitle>
                </div>
                {(dbLogs.length > 0 || currentResults.length > 0) && (
                  <Button
                    onClick={exportFullCSV}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-2xs h-8"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Download Full CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-4 max-h-60 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved yet.</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-200 text-xs">
                        <TableHead className="py-2">Condition</TableHead>
                        <TableHead className="py-2">Tier</TableHead>
                        <TableHead className="py-2">Model</TableHead>
                        <TableHead className="py-2 min-w-[200px]">Prediction</TableHead>
                        <TableHead className="py-2 text-center">Failure Mode</TableHead>
                        <TableHead className="py-2 text-right">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => {
                        const normCat = normalizeConditionCategory(row.condition_category);
                        const condConfig = ROBUSTNESS_CONDITIONS.find((c) => c.id === normCat);
                        return (
                          <TableRow key={i} className="border-b border-slate-100 text-xs">
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold"
                                style={{
                                  backgroundColor: condConfig ? `${condConfig.color}15` : "#f8fafc",
                                  color: condConfig ? condConfig.color : "#475569",
                                  borderColor: condConfig ? `${condConfig.color}40` : "#cbd5e1",
                                }}
                              >
                                {condConfig?.code || "C?"} {condConfig?.shortName || normCat}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              {(() => {
                                const cfg = TIER_CONFIGS[normalizeTier(row.tier)];
                                return (
                                  <Badge className={`${cfg.badgeClass} text-[9px] px-1.5 py-0.5 font-medium`}>
                                    {cfg.icon} {cfg.shortLabel}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="py-2 font-medium text-slate-800">{row.model}</TableCell>
                            <TableCell className="py-2 text-slate-700 min-w-[200px] break-words" title={row.predicted}>{row.predicted}</TableCell>
                            <TableCell className="py-2 text-center">
                              {isTruthy(row.is_correct) ? (
                                <span className="text-slate-400 text-xs font-mono">-</span>
                              ) : (
                                (() => {
                                  const fm = (row.failure_mode as FailureMode) || "visual_confusion";
                                  const cfg = FAILURE_MODE_CONFIGS[fm] || FAILURE_MODE_CONFIGS["visual_confusion"];
                                  return (
                                    <Badge className={`${cfg.badgeClass} text-[9px] px-1.5 py-0.5 font-medium`}>
                                      {cfg.icon} {cfg.shortLabel}
                                    </Badge>
                                  );
                                })()
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              {isTruthy(row.is_correct) ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px]">✓ Correct</Badge>
                              ) : (
                                <Badge className="bg-rose-50 text-rose-700 border-none text-[9px]">✗ Miss</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ExperimentLayout>
  );
}
