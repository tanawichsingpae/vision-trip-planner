import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExperimentLayout } from "./ExperimentLayout";
import {
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileSpreadsheet,
  Loader2,
  Save,
  Download,
  Info,
  Layers,
  ChevronRight,
  TrendingUp,
  Clock,
  Check,
  AlertCircle,
  Scale,
  FileCode2,
  FolderArchive,
  Image as ImageIcon,
  Sparkles,
  BarChart3,
  Search,
  Target,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAI, AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImage, analyzeImageDirect, type VisionResult } from "@/services/aiService";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  evaluatePredictionWithAliases,
  calculateRecallAtK,
  calculateMRR,
  calculateECE,
  ModelBenchmarkRow,
  classifyErrorCategory,
  FailureMode,
  FAILURE_MODE_CONFIGS,
  FAILURE_MODE_OPTIONS,
} from "@/utils/evaluationMetrics";
import { StatisticalComparisonModal } from "@/components/experiment/StatisticalComparisonModal";
import { LatexExportModal } from "@/components/experiment/LatexExportModal";
import { ECEReliabilityModal } from "@/components/experiment/ECEReliabilityModal";
import { BatchEvaluationCard, BatchItemResult } from "@/components/experiment/BatchEvaluationCard";
import { KeyTakeawaysCard } from "@/components/experiment/KeyTakeawaysCard";
import {
  VPRTier,
  TIER_CONFIGS,
  TIER_OPTIONS,
  TIER_ORDER,
  detectTierFromFilename,
  normalizeTier,
} from "@/types/experimentTiers";

interface TrialResult {
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
  recall_rank: number;
  match_score: number;
  matched_alias: string | null;
  failure_mode?: FailureMode;
  temperature?: number;
  tier?: VPRTier;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  tokens_per_sec?: number;
}

interface HistoricalRecord {
  timestamp: string;
  image_name: string;
  ground_truth: string;
  tier: VPRTier;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
  recall_rank?: number;
  matched_alias?: string | null;
  failure_mode?: FailureMode;
  temperature?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  tokens_per_sec?: number;
}

export default function ExperimentConsole() {
  const navigate = useNavigate();

  // Mode switcher: "single" or "batch"
  const [activeMode, setActiveMode] = useState<"single" | "batch">("single");

  // Single mode: File upload & Tier state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [singleTier, setSingleTier] = useState<VPRTier>("tier1_iconic");

  // Ground truth, pipeline config & temperature
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [useClip, setUseClip] = useState<boolean>(false);
  const [benchmarkTemperature, setBenchmarkTemperature] = useState<number>(0.0);

  // Models selected for testing
  const [selectedModels, setSelectedModels] = useState<AIModelType[]>(
    AI_MODEL_OPTIONS.map((opt) => opt.value)
  );

  // Evaluation progress
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runningModel, setRunningModel] = useState<AIModelType | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("");

  // Results for current trial
  const [currentResults, setCurrentResults] = useState<TrialResult[]>([]);

  // Saved database logs & Tier slicer filter
  const [dbLogs, setDbLogs] = useState<HistoricalRecord[]>([]);
  const [selectedTierFilter, setSelectedTierFilter] = useState<"all" | VPRTier>("all");
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>("");

  // Modals
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isLatexModalOpen, setIsLatexModalOpen] = useState(false);
  const [isEceModalOpen, setIsEceModalOpen] = useState(false);

  // Selected chart metric view
  const [chartMetric, setChartMetric] = useState<
    "pareto" | "recall_growth" | "recall1" | "recall3" | "mrr" | "latency" | "throughput" | "tier_breakdown" | "error_breakdown"
  >("pareto");

  // Fetch all historical results on load
  const fetchHistoricalResults = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results`);
      if (response.ok) {
        const data = await response.json();

        // Map model IDs to human-readable names and normalize tier
        const mapped: HistoricalRecord[] = (data.results || []).map((row: any) => {
          const opt = AI_MODEL_OPTIONS.find((o) => o.value === row.model);
          const isCorr = row.is_correct === true || row.is_correct === "True" || row.is_correct === "true" || row.is_correct === 1;
          const fm = row["Failure Mode"] || row.failure_mode || (isCorr ? "none" : "visual_confusion");
          return {
            ...row,
            tier: normalizeTier(row.tier),
            modelLabel: opt ? opt.label : row.model,
            is_correct: isCorr,
            recall_rank: row.recall_rank !== undefined ? Number(row.recall_rank) : isCorr ? 1 : 0,
            failure_mode: fm as FailureMode,
            temperature: row.temperature !== undefined ? Number(row.temperature) : (row["Temperature"] !== undefined ? Number(row["Temperature"]) : 0.0),
            prompt_tokens: row.prompt_tokens ? Number(row.prompt_tokens) : 0,
            completion_tokens: row.completion_tokens ? Number(row.completion_tokens) : 0,
            total_tokens: row.total_tokens ? Number(row.total_tokens) : 0,
            cost_usd: row.cost_usd ? Number(row.cost_usd) : 0.0,
            tokens_per_sec: row.tokens_per_sec ? Number(row.tokens_per_sec) : 0.0,
          };
        });
        setDbLogs(mapped);
      } else {
        console.error("Failed to load historical results from backend");
      }
    } catch (e) {
      console.warn("Could not connect to backend server for history. Using client-side metrics.", e);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoricalResults();
  }, [fetchHistoricalResults]);

  const allModelOptions = useMemo(() => AI_MODEL_OPTIONS, []);

  // Handle Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        const guessedName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[-_]/g, " ");
        setGroundTruth(guessedName);
        setSingleTier(detectTierFromFilename(file.name));
        setCurrentResults([]);
      } else {
        toast.error("Please drop an image file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      const guessedName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[-_]/g, " ");
      setGroundTruth(guessedName);
      setSingleTier(detectTierFromFilename(file.name));
      setCurrentResults([]);
    }
  };

  const toggleModel = (modelId: AIModelType) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  const selectAllModels = () => {
    setSelectedModels(allModelOptions.map((m) => m.value));
  };

  const selectNoneModels = () => {
    setSelectedModels([]);
  };

  // Run place recognition sequentially for all selected models
  const runEvaluation = async () => {
    if (!imageFile) {
      toast.error("Please upload an image first.");
      return;
    }
    if (!groundTruth.trim()) {
      toast.error("Please enter a Ground Truth location name.");
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("Please select at least one model to test.");
      return;
    }

    setIsRunning(true);
    setCurrentResults([]);

    const tempResults: TrialResult[] = [];

    for (const modelId of selectedModels) {
      setRunningModel(modelId);
      const modelOpt = allModelOptions.find((o) => o.value === modelId);
      const modelLabel = modelOpt ? modelOpt.label : modelId;
      setProgressLabel(`Running model: ${modelLabel}...`);

      const startTime = performance.now();
      try {
        const res: VisionResult = useClip
          ? await analyzeImage(
              imageFile,
              modelId,
              true,
              (step) => setProgressLabel(`[${modelLabel}] ${step}`),
              { allowFallback: false, temperature: benchmarkTemperature }
            )
          : await analyzeImageDirect(
              imageFile,
              modelId,
              (step) => setProgressLabel(`[${modelLabel}] ${step}`),
              { allowFallback: false, temperature: benchmarkTemperature }
            );
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const prediction = res.place || "Unknown";
        const confidence = res.confidence || 0.0;

        // Automated multi-alias evaluation
        const evalResult = evaluatePredictionWithAliases(
          prediction,
          groundTruth,
          res.top_candidates || res.similar_locations || [],
          0.70
        );

        const failureMode = classifyErrorCategory(prediction, groundTruth, {
          isCorrect: evalResult.isCorrect,
          confidence,
          isIdentifiablePlace: res.is_identifiable_place,
          tier: singleTier,
        });

        tempResults.push({
          model: modelId,
          modelLabel,
          predicted: prediction,
          confidence,
          time_ms: res.metrics?.latency_ms ? Math.round(res.metrics.latency_ms) : duration,
          is_correct: evalResult.isCorrect,
          recall_rank: evalResult.rank,
          match_score: evalResult.matchScore,
          matched_alias: evalResult.matchedAlias,
          failure_mode: failureMode,
          temperature: benchmarkTemperature,
          tier: singleTier,
          prompt_tokens: res.metrics?.prompt_tokens ?? 0,
          completion_tokens: res.metrics?.completion_tokens ?? 0,
          total_tokens: res.metrics?.total_tokens ?? 0,
          cost_usd: res.metrics?.cost_usd ?? 0.0,
          tokens_per_sec: res.metrics?.tokens_per_sec ?? 0.0,
        });

        setCurrentResults([...tempResults]);
      } catch (err) {
        console.error(`Error running VPR for ${modelLabel}:`, err);
        toast.error(`Failed to get VPR prediction from ${modelLabel}`);
      }
    }

    setIsRunning(false);
    setRunningModel(null);
    setProgressLabel("");
    toast.success("Batch Place Recognition Complete! Predictions evaluated with aliases.");
  };

  // Toggle correctness manually in the current results table
  const updateCorrectness = (index: number, value: boolean) => {
    setCurrentResults((prev) => {
      const copy = [...prev];
      const prevMode = copy[index].failure_mode;
      copy[index] = {
        ...copy[index],
        is_correct: value,
        recall_rank: value ? (copy[index].recall_rank > 0 ? copy[index].recall_rank : 1) : 0,
        failure_mode: value ? "none" : (prevMode && prevMode !== "none" ? prevMode : "visual_confusion"),
      };
      return copy;
    });
  };

  // Update failure mode symptom manually
  const updateFailureMode = (index: number, mode: FailureMode) => {
    setCurrentResults((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        failure_mode: mode,
      };
      return copy;
    });
  };

  // Save current results to DB/CSV on local backend
  const commitResults = async () => {
    if (currentResults.length === 0) {
      toast.error("No results to save. Run the evaluation first.");
      return;
    }

    const payload = {
      image_name: imageFile?.name || "uploaded_image.jpg",
      ground_truth: groundTruth,
      tier: singleTier,
      temperature: benchmarkTemperature,
      results: currentResults.map((r) => ({
        model: r.model,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
        recall_rank: r.recall_rank,
        matched_alias: r.matched_alias,
        temperature: r.temperature ?? benchmarkTemperature,
        failure_mode: r.failure_mode ?? "none",
        tier: r.tier || singleTier,
        prompt_tokens: r.prompt_tokens ?? 0,
        completion_tokens: r.completion_tokens ?? 0,
        total_tokens: r.total_tokens ?? 0,
        cost_usd: r.cost_usd ?? 0.0,
        tokens_per_sec: r.tokens_per_sec ?? 0.0,
      })),
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Results logged to CSV successfully!");
        fetchHistoricalResults();
        setImageFile(null);
        setImagePreview(null);
        setGroundTruth("");
        setCurrentResults([]);
      } else {
        toast.error("Failed to save results to backend CSV server.");
      }
    } catch (e) {
      console.warn("Could not save to backend. Logging in frontend session.", e);

      const sessionRecords: HistoricalRecord[] = currentResults.map((r) => ({
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        image_name: imageFile?.name || "uploaded_image.jpg",
        ground_truth: groundTruth,
        tier: r.tier || singleTier,
        model: r.model,
        modelLabel: r.modelLabel,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
        recall_rank: r.recall_rank,
        matched_alias: r.matched_alias,
        temperature: r.temperature ?? benchmarkTemperature,
        failure_mode: r.failure_mode ?? "none",
      }));

      setDbLogs((prev) => [...sessionRecords, ...prev]);
      toast.success("Saved to session database! (Local only - Server offline)");

      setImageFile(null);
      setImagePreview(null);
      setGroundTruth("");
      setCurrentResults([]);
    }
  };

  const clearCurrent = () => {
    setImageFile(null);
    setImagePreview(null);
    setGroundTruth("");
    setCurrentResults([]);
  };

  // Handle batch completion from BatchEvaluationCard
  const handleBatchComplete = (batchResults: BatchItemResult[]) => {
    fetchHistoricalResults();
  };

  // Sliced logs based on selectedTierFilter
  const effectiveDbLogs = useMemo(() => {
    if (selectedTierFilter === "all") return dbLogs;
    return dbLogs.filter((l) => normalizeTier(l.tier) === selectedTierFilter);
  }, [dbLogs, selectedTierFilter]);

  // Stratified 4-tier matrix breakdown across models
  const tierBreakdown = useMemo(() => {
    const tierCounts: Record<VPRTier, { total: number; correct: number }> = {
      tier1_iconic: { total: 0, correct: 0 },
      tier2_long_tail: { total: 0, correct: 0 },
      tier3_nature_landscape: { total: 0, correct: 0 },
      tier4_social_ugc: { total: 0, correct: 0 },
    };
    dbLogs.forEach((l) => {
      const t = normalizeTier(l.tier);
      tierCounts[t].total += 1;
      if (l.is_correct) tierCounts[t].correct += 1;
    });

    const modelMap = new Map<
      string,
      {
        label: string;
        tiers: Record<VPRTier, { total: number; correct: number; times: number[] }>;
      }
    >();

    dbLogs.forEach((l) => {
      const m = l.model;
      const label = l.modelLabel || l.model;
      const t = normalizeTier(l.tier);
      if (!modelMap.has(m)) {
        modelMap.set(m, {
          label,
          tiers: {
            tier1_iconic: { total: 0, correct: 0, times: [] },
            tier2_long_tail: { total: 0, correct: 0, times: [] },
            tier3_nature_landscape: { total: 0, correct: 0, times: [] },
            tier4_social_ugc: { total: 0, correct: 0, times: [] },
          },
        });
      }
      const entry = modelMap.get(m)!;
      entry.tiers[t].total += 1;
      if (l.is_correct) entry.tiers[t].correct += 1;
      entry.tiers[t].times.push(l.time_ms);
    });

    const matrixRows = Array.from(modelMap.entries()).map(([model, data]) => {
      const calcR1 = (t: VPRTier) =>
        data.tiers[t].total > 0
          ? parseFloat(((data.tiers[t].correct / data.tiers[t].total) * 100).toFixed(1))
          : null;
      const totalAll = Object.values(data.tiers).reduce((s, x) => s + x.total, 0);
      const correctAll = Object.values(data.tiers).reduce((s, x) => s + x.correct, 0);
      const r1All = totalAll > 0 ? parseFloat(((correctAll / totalAll) * 100).toFixed(1)) : 0;

      return {
        model,
        modelLabel: data.label,
        tier1_iconic: calcR1("tier1_iconic"),
        tier2_longtail: calcR1("tier2_long_tail"),
        tier3_nature: calcR1("tier3_nature_landscape"),
        tier4_ugc: calcR1("tier4_social_ugc"),
        overall: r1All,
      };
    }).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

    return { tierCounts, matrixRows };
  }, [dbLogs]);

  // Calculate Error Taxonomy breakdown (3 core failure modes + correct) per model
  const errorBreakdown = useMemo(() => {
    const errorMap = new Map<
      string,
      {
        label: string;
        total: number;
        correct: number;
        visual_confusion: number;
        hallucination: number;
        degradation_rejection: number;
      }
    >();

    const totalCounts = {
      correct: 0,
      visual_confusion: 0,
      hallucination: 0,
      degradation_rejection: 0,
      totalErrors: 0,
    };

    effectiveDbLogs.forEach((l) => {
      const m = l.model;
      const label = l.modelLabel || l.model;
      if (!errorMap.has(m)) {
        errorMap.set(m, {
          label,
          total: 0,
          correct: 0,
          visual_confusion: 0,
          hallucination: 0,
          degradation_rejection: 0,
        });
      }
      const entry = errorMap.get(m)!;
      entry.total += 1;
      if (l.is_correct) {
        entry.correct += 1;
        totalCounts.correct += 1;
      } else {
        totalCounts.totalErrors += 1;
        const mode = (l.failure_mode as FailureMode) || "visual_confusion";
        if (mode === "visual_confusion") {
          entry.visual_confusion += 1;
          totalCounts.visual_confusion += 1;
        } else if (mode === "hallucination") {
          entry.hallucination += 1;
          totalCounts.hallucination += 1;
        } else if (mode === "degradation_rejection") {
          entry.degradation_rejection += 1;
          totalCounts.degradation_rejection += 1;
        } else {
          entry.visual_confusion += 1;
          totalCounts.visual_confusion += 1;
        }
      }
    });

    const rows = Array.from(errorMap.entries()).map(([model, data]) => {
      const errCount = data.total - data.correct;
      return {
        model,
        modelLabel: data.label,
        total: data.total,
        correct: data.correct,
        totalErrors: errCount,
        visual_confusion: data.visual_confusion,
        hallucination: data.hallucination,
        degradation_rejection: data.degradation_rejection,
        vc_pct: errCount > 0 ? parseFloat(((data.visual_confusion / errCount) * 100).toFixed(1)) : 0,
        hal_pct: errCount > 0 ? parseFloat(((data.hallucination / errCount) * 100).toFixed(1)) : 0,
        deg_pct: errCount > 0 ? parseFloat(((data.degradation_rejection / errCount) * 100).toFixed(1)) : 0,
      };
    }).sort((a, b) => b.totalErrors - a.totalErrors);

    return { totalCounts, rows };
  }, [effectiveDbLogs]);

  // Calculate comprehensive academic model-wise statistics based on effective sliced logs
  const modelStats: ModelBenchmarkRow[] = useMemo(() => {
    const stats: Record<
      string,
      {
        modelLabel: string;
        total: number;
        correct: number;
        times: number[];
        ranks: number[];
        confidences: number[];
        correctConfidences: number[];
        outcomes: boolean[];
      }
    > = {};

    effectiveDbLogs.forEach((log) => {
      if (!stats[log.model]) {
        stats[log.model] = {
          modelLabel: log.modelLabel || log.model,
          total: 0,
          correct: 0,
          times: [],
          ranks: [],
          confidences: [],
          correctConfidences: [],
          outcomes: [],
        };
      }
      stats[log.model].total += 1;
      const isCorr = log.is_correct;
      const rank = log.recall_rank !== undefined ? log.recall_rank : isCorr ? 1 : 0;

      if (isCorr) {
        stats[log.model].correct += 1;
        if (log.confidence > 0) {
          stats[log.model].correctConfidences.push(log.confidence);
        }
      }
      stats[log.model].times.push(log.time_ms);
      stats[log.model].ranks.push(rank);
      stats[log.model].confidences.push(log.confidence);
      stats[log.model].outcomes.push(isCorr);
    });

    return Object.entries(stats)
      .map(([modelId, data]) => {
        const total = data.total;
        const recall1 = calculateRecallAtK(data.ranks, 1);
        const recall3 = calculateRecallAtK(data.ranks, 3);
        const recall5 = calculateRecallAtK(data.ranks, 5);
        const mrr = calculateMRR(data.ranks);

        const totalTime = data.times.reduce((sum, t) => sum + t, 0);
        const meanLatency = total > 0 ? Math.round(totalTime / total) : 0;

        const sortedTimes = [...data.times].sort((a, b) => a - b);
        let medianLatency = 0;
        if (sortedTimes.length > 0) {
          const mid = Math.floor(sortedTimes.length / 2);
          medianLatency =
            sortedTimes.length % 2 !== 0
              ? sortedTimes[mid]
              : Math.round((sortedTimes[mid - 1] + sortedTimes[mid]) / 2);
        }

        const throughputFPS = meanLatency > 0 ? parseFloat((1000 / meanLatency).toFixed(2)) : 0;
        const avgConfidence =
          data.correctConfidences.length > 0
            ? parseFloat((data.correctConfidences.reduce((a, b) => a + b, 0) / data.correctConfidences.length).toFixed(3))
            : 0;

        return {
          model: modelId,
          modelLabel: data.modelLabel,
          totalTests: total,
          recall1,
          recall3,
          recall5,
          mrr,
          meanLatency,
          medianLatency,
          throughputFPS,
          avgConfidence,
        };
      })
      .sort((a, b) => b.recall1 - a.recall1);
  }, [effectiveDbLogs]);

  // Pareto Frontier Trade-off Data (Latency vs Recall@1)
  const paretoChartData = useMemo(() => {
    if (modelStats.length === 0) return { points: [], frontierLine: [] };
    const sorted = [...modelStats].sort((a, b) => a.meanLatency - b.meanLatency);
    let maxRecallSoFar = -1;
    const frontierLine: Array<{ x: number; y: number }> = [];

    const points = sorted.map((m) => {
      const isPareto = m.recall1 > maxRecallSoFar;
      if (isPareto) {
        maxRecallSoFar = m.recall1;
        frontierLine.push({ x: m.meanLatency, y: m.recall1 });
      }
      return {
        model: m.model,
        modelLabel: m.modelLabel,
        latency: m.meanLatency,
        recall: m.recall1,
        fps: m.throughputFPS,
        isPareto,
      };
    });

    return { points, frontierLine };
  }, [modelStats]);

  // Recall@K Growth Comparison Data
  const recallGrowthData = useMemo(() => {
    return modelStats.map((m) => ({
      modelLabel: m.modelLabel.split(" ")[0],
      fullLabel: m.modelLabel,
      "Recall@1": m.recall1,
      "Recall@3": m.recall3,
      "Recall@5": m.recall5,
    }));
  }, [modelStats]);

  // Export extended CSV
  const exportCSV = () => {
    if (dbLogs.length === 0) {
      toast.error("No historical log entries to export.");
      return;
    }

    const headers = [
      "Timestamp",
      "Image Name",
      "Ground Truth",
      "Tier",
      "Model",
      "Predicted Place",
      "Confidence",
      "Time MS",
      "Is Correct",
      "Recall Rank",
      "Matched Alias",
    ];

    const rows = dbLogs.map((log) => [
      log.timestamp,
      `"${(log.image_name || "").replace(/"/g, '""')}"`,
      `"${(log.ground_truth || "").replace(/"/g, '""')}"`,
      `"${log.tier || "tier1_iconic"}"`,
      log.model,
      `"${(log.predicted || "").replace(/"/g, '""')}"`,
      (log.confidence || 0).toFixed(4),
      log.time_ms,
      log.is_correct ? "True" : "False",
      log.recall_rank !== undefined ? log.recall_rank : log.is_correct ? 1 : 0,
      `"${(log.matched_alias || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VPR_Thesis_Experiment1_Extended_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Extended CSV downloaded successfully!");
  };

  const getBarColor = (val: number, metric: string) => {
    if (metric === "latency") {
      if (val < 1000) return "#10b981";
      if (val < 2500) return "#3b82f6";
      if (val < 4500) return "#f59e0b";
      return "#ef4444";
    }
    if (metric === "mrr") {
      if (val >= 0.8) return "#10b981";
      if (val >= 0.5) return "#3b82f6";
      return "#f59e0b";
    }
    if (val >= 80) return "#10b981";
    if (val >= 50) return "#3b82f6";
    if (val >= 30) return "#f59e0b";
    return "#ef4444";
  };

  // Filtered dbLogs for search
  const filteredDbLogs = useMemo(() => {
    if (!historySearch.trim()) return dbLogs;
    const q = historySearch.toLowerCase();
    return dbLogs.filter(
      (l) =>
        l.image_name?.toLowerCase().includes(q) ||
        l.ground_truth?.toLowerCase().includes(q) ||
        l.predicted?.toLowerCase().includes(q) ||
        l.modelLabel?.toLowerCase().includes(q)
    );
  }, [dbLogs, historySearch]);

  return (
    <ExperimentLayout>
      <div className="space-y-6">
        {/* Header Title & Academic Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-left">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Experiment 1: Visual Place Recognition (VPR) Baseline Benchmarks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-model accuracy evaluation across Recall@1, Recall@3, Recall@5, MRR, Latency, and Statistical Tests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEceModalOpen(true)}
              className="text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-xs flex items-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              ECE Reliability Diagram
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStatsModalOpen(true)}
              className="text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-xs flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              Statistical Hypothesis Test
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLatexModalOpen(true)}
              className="text-xs bg-white text-blue-700 border-blue-200 hover:bg-blue-50 shadow-xs flex items-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
              Export LaTeX Table
            </Button>

            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 px-2.5 py-1 font-medium text-xs">
              Thesis Chap. 4 Suite
            </Badge>
          </div>
        </div>

        {/* Executive Summary Takeaways Card */}
        <KeyTakeawaysCard expId="exp1" />

        {/* Mode Switcher Tabs */}
        <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as any)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-200/80 p-1 rounded-xl">
            <TabsTrigger
              value="single"
              className="text-xs font-semibold flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              Single Query Benchmark
            </TabsTrigger>
            <TabsTrigger
              value="batch"
              className="text-xs font-semibold flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
              Automated Batch Dataset (ZIP/CSV)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SINGLE QUERY BENCHMARK */}
          <TabsContent value="single" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: SETUP PANEL (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Box 1: Image & Ground Truth Setup */}
                <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                      <Upload className="w-4 h-4 text-blue-500" />
                      1. Image & Ground Truth Setup
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-left">
                      Upload query image and define Ground Truth label(s). Multi-alias supported with "|".
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-6">
                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                        imagePreview ? "border-blue-400 bg-blue-50/20" : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
                      }`}
                    >
                      <input
                        type="file"
                        id="experiment-file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isRunning}
                      />
                      <label htmlFor="experiment-file" className="cursor-pointer block w-full h-full">
                        {imagePreview ? (
                          <div className="relative group">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="mx-auto max-h-56 rounded-lg object-cover shadow-sm"
                            />
                            <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <span className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full shadow-md font-medium">
                                Replace Image
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 space-y-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                              <Upload className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">
                                Drag & drop or Click to upload
                              </p>
                              <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG, WebP</p>
                            </div>
                          </div>
                        )}
                      </label>
                    </div>

                    {/* Ground Truth Label */}
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ground-truth" className="text-sm font-medium text-slate-700">
                          Ground Truth Location Name / Aliases
                        </Label>
                        <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                          Multi-Alias Supported
                        </span>
                      </div>
                      <Input
                        id="ground-truth"
                        value={groundTruth}
                        onChange={(e) => setGroundTruth(e.target.value)}
                        placeholder="e.g. Wat Arun | Temple of Dawn | Wat Pho"
                        className="bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                        disabled={isRunning}
                      />
                      <p className="text-[11px] text-slate-400">
                        Separate aliases with <strong>|</strong> to allow automatic matching across Thai/English names.
                      </p>
                    </div>

                    {/* Benchmark Tier Category Selector */}
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-slate-700">
                          Benchmark Tier Stratification
                        </Label>
                        <Badge className={`${TIER_CONFIGS[singleTier].badgeClass} text-[10px]`}>
                          {TIER_CONFIGS[singleTier].icon} {TIER_CONFIGS[singleTier].shortLabel}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {TIER_ORDER.map((tierKey) => {
                          const cfg = TIER_CONFIGS[tierKey];
                          const isSelected = singleTier === tierKey;
                          return (
                            <button
                              key={tierKey}
                              type="button"
                              onClick={() => setSingleTier(tierKey)}
                              disabled={isRunning}
                              className={`flex items-start gap-2 p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? `${cfg.badgeClass} ring-2 ring-indigo-500 font-semibold shadow-xs`
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
                              <div className="truncate">
                                <div className="font-bold text-[11px] leading-tight truncate">{cfg.shortLabel}</div>
                                <div className="text-[9px] text-slate-400 truncate mt-0.5">{cfg.description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pipeline Config & Hyperparameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150">
                        <div className="space-y-0.5 pr-2 text-left">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                            {useClip ? "2-Turn CLIP Pipeline" : "1-Turn Direct (Pure VLM)"}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {useClip ? "Proposed Retrieval-Augmented System" : "Pure Zero-Shot Model Baseline"}
                          </p>
                        </div>
                        <Switch
                          checked={useClip}
                          onCheckedChange={setUseClip}
                          disabled={isRunning}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150">
                        <div className="space-y-0.5 pr-2 text-left">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            Temp ({benchmarkTemperature})
                          </span>
                          <p className="text-[10px] text-slate-400">0.0 = Deterministic</p>
                        </div>
                        <select
                          value={benchmarkTemperature}
                          onChange={(e) => setBenchmarkTemperature(parseFloat(e.target.value))}
                          disabled={isRunning}
                          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="0.0">0.0 (Greedy)</option>
                          <option value="0.2">0.2 (Low)</option>
                          <option value="0.7">0.7 (Standard)</option>
                          <option value="1.0">1.0 (Creative)</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Box 2: Model Configuration */}
                <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        2. Models to Benchmark
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllModels}
                          className="text-[10px] h-7 px-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                          disabled={isRunning}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectNoneModels}
                          className="text-[10px] h-7 px-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                          disabled={isRunning}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-slate-500 text-left">
                      Select which models to run Place Recognition on.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {allModelOptions.map((opt) => {
                        const isChecked = selectedModels.includes(opt.value);
                        return (
                          <div
                            key={opt.value}
                            onClick={() => !isRunning && toggleModel(opt.value)}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-blue-50/20 border-blue-200"
                                : "bg-slate-50/30 border-slate-200/60 hover:bg-slate-50 hover:border-slate-355"
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => {}}
                              className="mt-0.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              disabled={isRunning}
                            />
                            <div className="flex items-center gap-2 -mt-0.5 text-left">
                              <img
                                src={opt.icon}
                                className="w-5 h-5 rounded-full object-cover shrink-0 bg-slate-100 border border-slate-200"
                                alt=""
                              />
                              <div>
                                <span className="text-xs font-semibold text-slate-700 block">
                                  {opt.label}
                                </span>
                                <span className="text-[10px] text-slate-400 block">{opt.description}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6">
                      {isRunning ? (
                        <Button
                          className="w-full bg-blue-600 text-white font-semibold py-5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-not-allowed"
                          disabled
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{progressLabel}</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={runEvaluation}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                          disabled={!imageFile || !groundTruth.trim() || selectedModels.length === 0}
                        >
                          <Play className="w-4 h-4" />
                          <span>Run Single Query Benchmark ({selectedModels.length} Models)</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: RESULTS BOARD & LIVE PREDICTIONS (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Box 3: Live Predictions Table */}
                <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
                    <div className="text-left">
                      <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                        <ChevronRight className="w-4 h-4 text-emerald-600" />
                        3. Live Query Predictions Table
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Automated multi-alias grading. You can toggle manual verification if needed.
                      </CardDescription>
                    </div>
                    {currentResults.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={clearCurrent}
                          className="text-xs h-8 bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                          disabled={isRunning}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reset
                        </Button>
                        <Button
                          onClick={commitResults}
                          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                          disabled={isRunning}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          Log to CSV
                        </Button>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="pt-6">
                    {currentResults.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        <ImageIcon className="w-8 h-8 mx-auto mb-3 text-slate-350" />
                        <p className="text-sm font-medium text-slate-500">No predictions generated yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Upload an image, set ground truth, and click Run.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-3 bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 rounded-xl border border-slate-200 shadow-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-bold text-slate-800">Automated Alias Evaluation</span>
                          </div>
                          <div className="flex items-center space-x-2.5 text-xs">
                            <span className="font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                              ✓ {currentResults.filter((r) => r.is_correct).length} Correct
                            </span>
                            <span className="font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 text-[11px]">
                              ✗ {currentResults.filter((r) => !r.is_correct).length} Wrong
                            </span>
                            <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 text-[11px]">
                              Recall@1:{" "}
                              {currentResults.length > 0
                                ? `${Math.round(
                                    (currentResults.filter((r) => r.is_correct).length / currentResults.length) * 100
                                  )}%`
                                : "0%"}
                            </span>
                            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                              Total Cost: ${currentResults.reduce((acc, r) => acc + (r.cost_usd || 0), 0).toFixed(5)} (~{(currentResults.reduce((acc, r) => acc + (r.cost_usd || 0), 0) * 36.5).toFixed(3)} THB)
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <Table>
                            <TableHeader className="bg-slate-50">
                              <TableRow className="border-b border-slate-200">
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Model</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Prediction</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Recall Rank</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Tokens (In / Out)</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Cost / Req</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Latency & Speed</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Verification</TableHead>
                                <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Failure Mode</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentResults.map((row, idx) => (
                                <TableRow
                                  key={row.model}
                                  className={
                                    row.is_correct
                                      ? "bg-emerald-50/30 border-b border-slate-100"
                                      : "border-b border-slate-100"
                                  }
                                >
                                  <TableCell className="font-medium text-slate-700 py-3 text-xs text-left">
                                    {row.modelLabel}
                                  </TableCell>
                                  <TableCell className="py-3 text-xs text-left">
                                    <span className="font-semibold text-slate-900 block">{row.predicted}</span>
                                    {row.matched_alias && (
                                      <span className="text-[10px] text-emerald-600 block">
                                        Matched: "{row.matched_alias}"
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3 text-center text-xs">
                                    {row.recall_rank > 0 ? (
                                      <Badge
                                        variant="secondary"
                                        className={
                                          row.recall_rank === 1
                                            ? "bg-emerald-100 text-emerald-800 font-mono text-[10px]"
                                            : "bg-blue-100 text-blue-800 font-mono text-[10px]"
                                        }
                                      >
                                        Top-{row.recall_rank}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">
                                        Miss
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3 text-center font-mono text-xs">
                                    <span className="text-slate-700 font-semibold">{row.prompt_tokens ?? 0}</span>
                                    <span className="text-slate-400"> / </span>
                                    <span className="text-blue-600 font-semibold">{row.completion_tokens ?? 0}</span>
                                  </TableCell>
                                  <TableCell className="py-3 text-center font-mono text-xs">
                                    <span className="text-emerald-700 font-bold block text-[11px]">
                                      ${(row.cost_usd ?? 0).toFixed(6)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      ~{((row.cost_usd ?? 0) * 36.5).toFixed(4)} THB
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 text-center font-mono text-slate-600 text-xs">
                                    <div>{row.time_ms.toLocaleString()} ms</div>
                                    {(row.tokens_per_sec ?? 0) > 0 && (
                                      <div className="text-[10px] text-indigo-600 font-semibold">{row.tokens_per_sec} tok/s</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3 text-center">
                                    <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                                      <button
                                        type="button"
                                        onClick={() => updateCorrectness(idx, true)}
                                        className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                                          row.is_correct
                                            ? "bg-emerald-600 text-white font-bold shadow-xs"
                                            : "text-slate-500 hover:text-emerald-700"
                                        }`}
                                      >
                                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                        <span>Correct</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateCorrectness(idx, false)}
                                        className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                                          !row.is_correct
                                            ? "bg-rose-600 text-white font-bold shadow-xs"
                                            : "text-slate-500 hover:text-rose-700"
                                        }`}
                                      >
                                        <XCircle className="w-3 h-3 mr-0.5" />
                                        <span>Wrong</span>
                                      </button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3 text-center">
                                    {row.is_correct ? (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200">
                                        ✓ None
                                      </Badge>
                                    ) : (
                                      <select
                                        value={row.failure_mode || "visual_confusion"}
                                        onChange={(e) => updateFailureMode(idx, e.target.value as FailureMode)}
                                        className="text-[10px] bg-rose-50 border border-rose-200 text-rose-800 rounded px-1.5 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-rose-400"
                                      >
                                        {FAILURE_MODE_OPTIONS.filter((o) => o.value !== "none").map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.icon} {opt.shortLabel}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: AUTOMATED BATCH DATASET BENCHMARK */}
          <TabsContent value="batch" className="space-y-6 mt-4">
            <BatchEvaluationCard
              selectedModels={selectedModels}
              useClip={useClip}
              temperature={benchmarkTemperature}
              onBatchComplete={handleBatchComplete}
            />
          </TabsContent>
        </Tabs>

        {/* Interactive Benchmark Tier Slicer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Stratified Tier Slicer:</span>
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
                All Tiers ({dbLogs.length})
              </Button>
              {TIER_ORDER.map((tierKey) => {
                const cfg = TIER_CONFIGS[tierKey];
                const count = dbLogs.filter((l) => normalizeTier(l.tier) === tierKey).length;
                const isSel = selectedTierFilter === tierKey;
                return (
                  <Button
                    key={tierKey}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTierFilter(tierKey)}
                    className={`text-xs h-7 px-2.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                      isSel
                        ? `${cfg.badgeClass} ring-2 ring-indigo-500 font-bold shadow-xs`
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
          {selectedTierFilter !== "all" && (
            <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md font-medium">
              Filtered by: <strong>{TIER_CONFIGS[selectedTierFilter].label}</strong>
            </div>
          )}
        </div>

        {/* Section: CONSOLIDATED MODEL BENCHMARK METRICS (Cards & Recharts) */}
        <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-left">
                <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Consolidated Retrieval & Latency Metrics (Chapter 4 Benchmark)
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Aggregated over {effectiveDbLogs.length} historical evaluation trials
                  {selectedTierFilter !== "all"
                    ? ` (Filtered: ${TIER_CONFIGS[selectedTierFilter].label})`
                    : ` (${dbLogs.length} total across all tiers)`}.
                </CardDescription>
              </div>

              {/* Metric View Switcher */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <Button
                  variant={chartMetric === "pareto" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("pareto")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "pareto" ? "bg-white text-indigo-700 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  ★ Pareto Trade-off
                </Button>
                <Button
                  variant={chartMetric === "tier_breakdown" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("tier_breakdown")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "tier_breakdown" ? "bg-white text-indigo-700 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  ⚡ 4-Tier Matrix
                </Button>
                <Button
                  variant={chartMetric === "error_breakdown" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("error_breakdown")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "error_breakdown" ? "bg-white text-rose-700 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  ⚠️ Error Taxonomy
                </Button>
                <Button
                  variant={chartMetric === "recall_growth" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("recall_growth")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "recall_growth" ? "bg-white text-indigo-700 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  Recall@K Curve
                </Button>
                <Button
                  variant={chartMetric === "recall1" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("recall1")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "recall1" ? "bg-white text-slate-900 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  Recall@1
                </Button>
                <Button
                  variant={chartMetric === "recall3" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("recall3")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "recall3" ? "bg-white text-slate-900 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  Recall@3
                </Button>
                <Button
                  variant={chartMetric === "mrr" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("mrr")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "mrr" ? "bg-white text-slate-900 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  MRR
                </Button>
                <Button
                  variant={chartMetric === "latency" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("latency")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "latency" ? "bg-white text-slate-900 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  Latency
                </Button>
                <Button
                  variant={chartMetric === "throughput" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("throughput")}
                  className={`text-[11px] h-7 px-2.5 rounded-lg font-semibold ${
                    chartMetric === "throughput" ? "bg-white text-slate-900 shadow-xs hover:bg-white" : "text-slate-600"
                  }`}
                >
                  FPS
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {modelStats.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <AlertCircle className="w-7 h-7 mx-auto mb-2 text-slate-350" />
                <p className="text-xs font-medium text-slate-500">No benchmark metric data available yet.</p>
                <p className="text-[10px] text-slate-450 mt-1">Run single queries or batch dataset evaluation to construct benchmarks.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Top KPI Hero Highlights */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* KPI 1: Top Accuracy Leader */}
                  <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Top Recall@1 Model
                    </span>
                    <p className="text-base font-extrabold text-emerald-900 mt-1 truncate" title={modelStats[0]?.modelLabel}>
                      {modelStats[0]?.modelLabel || "-"}
                    </p>
                    <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                      {modelStats[0]?.recall1}% Recall@1
                    </p>
                  </div>

                  {/* KPI 2: Top MRR Model */}
                  {(() => {
                    const topMrr = [...modelStats].sort((a, b) => (b.mrr || 0) - (a.mrr || 0))[0];
                    return (
                      <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200/80 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
                          Top MRR Ranking
                        </span>
                        <p className="text-base font-extrabold text-indigo-900 mt-1 truncate" title={topMrr?.modelLabel}>
                          {topMrr?.modelLabel || "-"}
                        </p>
                        <p className="text-xs font-mono font-bold text-indigo-700 mt-0.5">
                          MRR: {(topMrr?.mrr || 0).toFixed(3)}
                        </p>
                      </div>
                    );
                  })()}

                  {/* KPI 3: Fastest Inference Model */}
                  {(() => {
                    const fastest = [...modelStats].sort((a, b) => a.meanLatency - b.meanLatency)[0];
                    return (
                      <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                          Lowest Latency Model
                        </span>
                        <p className="text-base font-extrabold text-blue-900 mt-1 truncate" title={fastest?.modelLabel}>
                          {fastest?.modelLabel || "-"}
                        </p>
                        <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">
                          {fastest?.meanLatency} ms ({fastest?.throughputFPS} FPS)
                        </p>
                      </div>
                    );
                  })()}

                  {/* KPI 4: Total Benchmark Dataset Samples */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Total Benchmark Volume
                    </span>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">
                      {dbLogs.length} <span className="text-xs text-slate-500 font-normal">Trials</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Across {modelStats.length} evaluated AI models
                    </p>
                  </div>
                </div>

                {/* Dynamic Academic Recharts Visualization */}
                {chartMetric === "pareto" ? (
                  <div className="h-80 w-full bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <span>Accuracy vs. Latency Pareto Frontier</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Green zone = Optimal Sweet Spot: High Accuracy + Low Latency)
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          ★ Green Dots = Pareto Optimal Frontier
                        </Badge>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <ScatterChart margin={{ top: 15, right: 30, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        {/* Sweet Spot Zone Area (Latency < 1000ms & Recall >= 80%) */}
                        <ReferenceArea
                          x1={0}
                          x2={1000}
                          y1={80}
                          y2={100}
                          fill="#10b981"
                          fillOpacity={0.07}
                        />
                        {/* Baseline Target Reference Lines */}
                        <ReferenceLine
                          y={80}
                          stroke="#059669"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: "Target Recall 80%",
                            position: "insideBottomRight",
                            fill: "#059669",
                            fontSize: 10,
                          }}
                        />
                        <ReferenceLine
                          x={1000}
                          stroke="#d97706"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: "1,000 ms Limit",
                            position: "insideTopRight",
                            fill: "#d97706",
                            fontSize: 10,
                          }}
                        />
                        <XAxis
                          type="number"
                          dataKey="latency"
                          name="Mean Latency"
                          unit=" ms"
                          stroke="#94a3b8"
                          fontSize={10}
                          tickFormatter={(v) => `${v}ms`}
                        />
                        <YAxis
                          type="number"
                          dataKey="recall"
                          name="Recall@1"
                          unit="%"
                          domain={[0, 100]}
                          stroke="#94a3b8"
                          fontSize={10}
                        />
                        <ZAxis type="number" dataKey="fps" range={[80, 260]} name="Throughput (FPS)" />
                        <RechartsTooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg text-xs space-y-1.5 text-left">
                                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                                    <p className="font-bold text-slate-900">{data.modelLabel}</p>
                                    {data.isPareto ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 text-[9px]">
                                        ★ Pareto Optimal
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-slate-500 text-[9px]">
                                        Standard
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-indigo-600 font-semibold flex items-center justify-between">
                                    <span>Recall@1:</span>
                                    <span className="font-bold">{data.recall}%</span>
                                  </p>
                                  <p className="text-slate-600 font-mono flex items-center justify-between gap-4">
                                    <span>Latency:</span>
                                    <span>{data.latency} ms</span>
                                  </p>
                                  <p className="text-slate-500 font-mono flex items-center justify-between gap-4 text-[11px]">
                                    <span>Throughput:</span>
                                    <span>{data.fps} req/s</span>
                                  </p>
                                  {data.latency <= 1000 && data.recall >= 80 && (
                                    <div className="pt-1 text-[10px] text-emerald-700 font-medium">
                                      ✨ In Sweet Spot Zone (Fast & High Recall)
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter data={paretoChartData.points}>
                          {paretoChartData.points.map((entry, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={entry.isPareto ? "#10b981" : "#6366f1"}
                              stroke={entry.isPareto ? "#047857" : "#4338ca"}
                              strokeWidth={entry.isPareto ? 2.5 : 1}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : chartMetric === "recall_growth" ? (
                  <div className="h-72 w-full bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Recall@K Retrieval Growth Curve (Recall@1 vs. Recall@3 vs. Recall@5)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Benefit of multi-candidate recommendation
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={recallGrowthData} margin={{ top: 10, right: 20, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <ReferenceLine
                          y={80}
                          stroke="#059669"
                          strokeDasharray="3 3"
                          label={{ value: "80% Baseline", position: "right", fill: "#059669", fontSize: 9 }}
                        />
                        <XAxis dataKey="modelLabel" stroke="#94a3b8" fontSize={10} />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} unit="%" />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-1 text-left">
                                  <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{label}</p>
                                  {payload.map((entry: any, index: number) => (
                                    <div key={`item-${index}`} className="flex items-center justify-between gap-3" style={{ color: entry.color }}>
                                      <span className="font-medium">{entry.name}:</span>
                                      <span className="font-bold font-mono">{entry.value}%</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                        <Bar dataKey="Recall@1" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Recall@3" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Recall@5" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : chartMetric === "tier_breakdown" ? (
                  <div className="space-y-4">
                    {/* 4-Tier Breakdown Header Badges */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {TIER_ORDER.map((tierKey) => {
                        const cfg = TIER_CONFIGS[tierKey];
                        const countData = tierBreakdown.tierCounts[tierKey];
                        const pct = countData.total > 0 ? ((countData.correct / countData.total) * 100).toFixed(1) : "-";
                        return (
                          <div
                            key={tierKey}
                            className={`p-3 rounded-xl border text-left space-y-1 ${cfg.badgeClass}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base">{cfg.icon}</span>
                              <Badge variant="outline" className="text-[10px] bg-white/70">
                                {countData.total} samples
                              </Badge>
                            </div>
                            <div className="font-bold text-xs truncate">{cfg.shortLabel}</div>
                            <div className="text-[10px] opacity-80 truncate">{cfg.label}</div>
                            <div className="pt-1 flex items-baseline justify-between border-t border-black/5">
                              <span className="text-[10px] opacity-75">Avg Accuracy:</span>
                              <span className="font-mono font-extrabold text-xs">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stratified Matrix Heatmap Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-b border-slate-200">
                            <TableHead className="text-slate-700 text-xs py-2.5 font-bold text-left">Model Architecture</TableHead>
                            <TableHead className="text-emerald-700 text-xs py-2.5 font-bold text-center">🏛️ T1: Iconic (Easy)</TableHead>
                            <TableHead className="text-blue-700 text-xs py-2.5 font-bold text-center">🛕 T2: Long-Tail (Med)</TableHead>
                            <TableHead className="text-amber-700 text-xs py-2.5 font-bold text-center">🏞️ T3: Nature (Hard)</TableHead>
                            <TableHead className="text-purple-700 text-xs py-2.5 font-bold text-center">📱 T4: UGC (In-The-Wild)</TableHead>
                            <TableHead className="text-slate-900 text-xs py-2.5 font-bold text-center bg-slate-100">Overall Accuracy</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tierBreakdown.matrixRows.map((r) => (
                            <TableRow key={r.model} className="border-b border-slate-100 hover:bg-slate-50/60">
                              <TableCell className="py-2.5 font-semibold text-slate-800 text-xs text-left">
                                {r.modelLabel}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                {r.tier1_iconic !== null ? (
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      r.tier1_iconic >= 80
                                        ? "bg-emerald-100 text-emerald-800"
                                        : r.tier1_iconic >= 50
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {r.tier1_iconic}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                {r.tier2_longtail !== null ? (
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      r.tier2_longtail >= 70
                                        ? "bg-blue-100 text-blue-800"
                                        : r.tier2_longtail >= 40
                                        ? "bg-blue-50 text-blue-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {r.tier2_longtail}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                {r.tier3_nature !== null ? (
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      r.tier3_nature >= 60
                                        ? "bg-amber-100 text-amber-800"
                                        : r.tier3_nature >= 30
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {r.tier3_nature}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                {r.tier4_ugc !== null ? (
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      r.tier4_ugc >= 50
                                        ? "bg-purple-100 text-purple-800"
                                        : r.tier4_ugc >= 25
                                        ? "bg-purple-50 text-purple-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {r.tier4_ugc}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs bg-slate-50 font-extrabold text-slate-900">
                                {r.overall !== undefined ? `${r.overall}%` : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : chartMetric === "error_breakdown" ? (
                  <div className="space-y-4">
                    {/* 3 Core Failure Mode Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl border bg-amber-50/60 border-amber-200 text-left space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-base">🏛️</span>
                          <Badge variant="outline" className="text-[10px] bg-white font-mono">
                            {errorBreakdown.totalCounts.visual_confusion} cases
                          </Badge>
                        </div>
                        <div className="font-bold text-xs text-amber-900">Visual Confusion</div>
                        <div className="text-[10px] text-amber-700">Near-misses, similar architecture/terrain</div>
                        <div className="pt-1 text-[11px] font-mono font-bold text-amber-900 border-t border-amber-200/50">
                          {errorBreakdown.totalCounts.totalErrors > 0
                            ? ((errorBreakdown.totalCounts.visual_confusion / errorBreakdown.totalCounts.totalErrors) * 100).toFixed(1)
                            : 0}% of all errors
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border bg-purple-50/60 border-purple-200 text-left space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-base">👻</span>
                          <Badge variant="outline" className="text-[10px] bg-white font-mono">
                            {errorBreakdown.totalCounts.hallucination} cases
                          </Badge>
                        </div>
                        <div className="font-bold text-xs text-purple-900">Hallucination</div>
                        <div className="text-[10px] text-purple-700">Invented places or generic non-specific labels</div>
                        <div className="pt-1 text-[11px] font-mono font-bold text-purple-900 border-t border-purple-200/50">
                          {errorBreakdown.totalCounts.totalErrors > 0
                            ? ((errorBreakdown.totalCounts.hallucination / errorBreakdown.totalCounts.totalErrors) * 100).toFixed(1)
                            : 0}% of all errors
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border bg-rose-50/60 border-rose-200 text-left space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-base">📷</span>
                          <Badge variant="outline" className="text-[10px] bg-white font-mono">
                            {errorBreakdown.totalCounts.degradation_rejection} cases
                          </Badge>
                        </div>
                        <div className="font-bold text-xs text-rose-900">Degradation / Rejection</div>
                        <div className="text-[10px] text-rose-700">Low-quality, blur/dark, or model abstention</div>
                        <div className="pt-1 text-[11px] font-mono font-bold text-rose-900 border-t border-rose-200/50">
                          {errorBreakdown.totalCounts.totalErrors > 0
                            ? ((errorBreakdown.totalCounts.degradation_rejection / errorBreakdown.totalCounts.totalErrors) * 100).toFixed(1)
                            : 0}% of all errors
                        </div>
                      </div>
                    </div>

                    {/* Error Distribution Matrix Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-b border-slate-200">
                            <TableHead className="text-slate-700 text-xs py-2.5 font-bold text-left">Model Architecture</TableHead>
                            <TableHead className="text-slate-500 text-xs py-2.5 font-bold text-center">Total Tests</TableHead>
                            <TableHead className="text-rose-700 text-xs py-2.5 font-bold text-center">Total Errors</TableHead>
                            <TableHead className="text-amber-800 text-xs py-2.5 font-bold text-center">🏛️ Visual Confusion</TableHead>
                            <TableHead className="text-purple-800 text-xs py-2.5 font-bold text-center">👻 Hallucination</TableHead>
                            <TableHead className="text-rose-800 text-xs py-2.5 font-bold text-center">📷 Degradation/Rejection</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errorBreakdown.rows.map((r) => (
                            <TableRow key={r.model} className="border-b border-slate-100 hover:bg-slate-50/60">
                              <TableCell className="py-2.5 font-semibold text-slate-800 text-xs text-left">
                                {r.modelLabel}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs text-slate-600">
                                {r.total}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs font-bold text-rose-600">
                                {r.totalErrors}
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                                  {r.visual_confusion} ({r.vc_pct}%)
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                                  {r.hallucination} ({r.hal_pct}%)
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-center font-mono text-xs">
                                <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                                  {r.degradation_rejection} ({r.deg_pct}%)
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 w-full bg-slate-50/60 p-3 rounded-xl border border-slate-200/80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelStats} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        {chartMetric === "recall1" && (
                          <ReferenceLine
                            y={80}
                            stroke="#059669"
                            strokeDasharray="3 3"
                            label={{ value: "80% Target", position: "right", fill: "#059669", fontSize: 9 }}
                          />
                        )}
                        <XAxis dataKey="modelLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={10}
                          tickLine={false}
                          domain={
                            chartMetric === "latency"
                              ? [0, "auto"]
                              : chartMetric === "mrr"
                              ? [0, 1]
                              : chartMetric === "throughput"
                              ? [0, "auto"]
                              : [0, 100]
                          }
                          unit={
                            chartMetric === "latency"
                              ? "ms"
                              : chartMetric === "throughput"
                              ? " fps"
                              : chartMetric === "mrr"
                              ? ""
                              : "%"
                          }
                        />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const val = payload[0].value;
                              return (
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-1 text-left">
                                  <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{label}</p>
                                  <div className="flex items-center justify-between gap-4 text-indigo-600 font-semibold">
                                    <span>
                                      {chartMetric === "recall1"
                                        ? "Recall@1"
                                        : chartMetric === "recall3"
                                        ? "Recall@3"
                                        : chartMetric === "mrr"
                                        ? "MRR"
                                        : chartMetric === "latency"
                                        ? "Latency"
                                        : "Throughput"}:
                                    </span>
                                    <span className="font-bold font-mono">
                                      {chartMetric === "latency"
                                        ? `${val} ms`
                                        : chartMetric === "throughput"
                                        ? `${val} FPS`
                                        : chartMetric === "mrr"
                                        ? val
                                        : `${val}%`}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey={
                            chartMetric === "recall1"
                              ? "recall1"
                              : chartMetric === "recall3"
                              ? "recall3"
                              : chartMetric === "mrr"
                              ? "mrr"
                              : chartMetric === "latency"
                              ? "meanLatency"
                              : "throughputFPS"
                          }
                          radius={[6, 6, 0, 0]}
                        >
                          {modelStats.map((entry, index) => (
                            <Cell
                              key={`bar-${index}`}
                              fill={
                                index === 0 && (chartMetric === "recall1" || chartMetric === "recall3" || chartMetric === "mrr")
                                  ? "#10b981"
                                  : index === 0 && chartMetric === "latency"
                                  ? "#3b82f6"
                                  : "#6366f1"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Stats List Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modelStats.map((entry) => (
                    <div
                      key={entry.model}
                      className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3 text-left shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="text-xs font-bold text-slate-800 block truncate max-w-[170px]" title={entry.modelLabel}>
                          {entry.modelLabel}
                        </span>
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0.5 px-2 font-mono font-semibold">
                          {entry.totalTests} tests
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Recall@1</span>
                          <span
                            className="text-sm font-extrabold block"
                            style={{ color: getBarColor(entry.recall1, "recall") }}
                          >
                            {entry.recall1}%
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Recall@3</span>
                          <span className="text-sm font-extrabold text-blue-600 block">
                            {entry.recall3 || 0}%
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">MRR</span>
                          <span className="text-sm font-extrabold text-indigo-700 block">
                            {(entry.mrr || 0).toFixed(3)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Mean Latency</span>
                          <span className="text-xs font-mono font-bold text-slate-700 block">{entry.meanLatency} ms</span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Throughput</span>
                          <span className="text-xs font-mono font-extrabold text-indigo-600 block">
                            {entry.throughputFPS} FPS
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section: HISTORICAL TRIAL DATABASE LOG */}
        <Card className="bg-white border-slate-200 text-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-left">
              <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                Historical Trial Logs ({dbLogs.length} records)
              </CardTitle>
              <CardDescription className="text-slate-500">
                Persistent database log of all benchmarks committed across sessions.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search trials..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              {dbLogs.length > 0 && (
                <Button
                  onClick={exportCSV}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs h-8"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export All CSV
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {isLoadingLogs ? (
              <div className="text-center py-12 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-xs">Loading experiment results history...</p>
              </div>
            ) : filteredDbLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-slate-350" />
                <p className="text-xs font-medium text-slate-500">No logged trial records found.</p>
                <p className="text-[10px] text-slate-450 mt-1">Run and commit benchmarks above to populate the history.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-96">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-xs">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Timestamp</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Image Name</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Tier</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Ground Truth</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Model</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Prediction</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Recall Rank</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Temp</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Latency</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Failure Mode</TableHead>
                      <TableHead className="text-slate-500 text-xs py-3 font-semibold text-right">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDbLogs.map((log, idx) => (
                      <TableRow key={`${log.timestamp}-${log.model}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <TableCell className="py-3 font-mono text-[10px] text-slate-500 text-left">
                          {log.timestamp}
                        </TableCell>
                        <TableCell className="py-3 font-medium text-slate-700 text-xs max-w-[140px] truncate text-left" title={log.image_name}>
                          {log.image_name}
                        </TableCell>
                        <TableCell className="py-3 text-left">
                          {(() => {
                            const cfg = TIER_CONFIGS[normalizeTier(log.tier)];
                            return (
                              <Badge className={`${cfg.badgeClass} text-[9px] px-1.5 py-0.5 font-medium`}>
                                {cfg.icon} {cfg.shortLabel}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="py-3 text-slate-700 text-xs text-left max-w-[140px] truncate" title={log.ground_truth}>
                          {log.ground_truth}
                        </TableCell>
                        <TableCell className="py-3 text-slate-700 text-xs text-left">
                          {log.modelLabel || log.model}
                        </TableCell>
                        <TableCell className="py-3 font-semibold text-slate-900 text-xs text-left">
                          {log.predicted}
                        </TableCell>
                        <TableCell className="py-3 text-center text-xs">
                          {log.recall_rank && log.recall_rank > 0 ? (
                            <Badge
                              variant="secondary"
                              className={
                                log.recall_rank === 1
                                  ? "bg-emerald-50 text-emerald-700 font-mono text-[10px]"
                                  : "bg-blue-50 text-blue-700 font-mono text-[10px]"
                              }
                            >
                              Top-{log.recall_rank}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-center font-mono text-[10px] text-slate-500">
                          {log.temperature !== undefined ? log.temperature : 0.0}
                        </TableCell>
                        <TableCell className="py-3 text-center font-mono text-slate-600 text-xs">
                          {log.time_ms.toLocaleString()} ms
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          {log.is_correct ? (
                            <span className="text-slate-400 text-xs font-mono">-</span>
                          ) : (
                            (() => {
                              const fm = (log.failure_mode as FailureMode) || "visual_confusion";
                              const cfg = FAILURE_MODE_CONFIGS[fm] || FAILURE_MODE_CONFIGS["visual_confusion"];
                              return (
                                <Badge className={`${cfg.badgeClass} text-[9px] px-1.5 py-0.5 font-medium`}>
                                  {cfg.icon} {cfg.shortLabel}
                                </Badge>
                              );
                            })()
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          {log.is_correct ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-none px-2 py-0.5 text-[9px] font-semibold">
                              <Check className="w-2.5 h-2.5 mr-0.5 inline" /> Correct
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-700 border-none px-2 py-0.5 text-[9px] font-semibold">
                              <XCircle className="w-2.5 h-2.5 mr-0.5 inline" /> Incorrect
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <StatisticalComparisonModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        logs={dbLogs}
        availableModels={allModelOptions.map((o) => ({ value: o.value, label: o.label }))}
      />

      <LatexExportModal
        isOpen={isLatexModalOpen}
        onClose={() => setIsLatexModalOpen(false)}
        benchmarkData={modelStats}
        tierMatrixRows={tierBreakdown.matrixRows}
      />

      <ECEReliabilityModal
        open={isEceModalOpen}
        onOpenChange={setIsEceModalOpen}
        dbLogs={dbLogs}
      />
    </ExperimentLayout>
  );
}
