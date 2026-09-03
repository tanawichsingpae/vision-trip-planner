import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ExperimentLayout } from "./ExperimentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImage, type VisionResult } from "@/services/aiService";
import { evaluatePredictionWithAliases } from "@/utils/evaluationMetrics";
import {
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  Save,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  Zap,
  BarChart3,
  Scale,
  FileCode2,
  Check,
  Copy,
  Info,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
} from "recharts";

interface Exp2Result {
  model: AIModelType;
  modelLabel: string;
  predicted_clip: string;
  predicted_noclip: string;
  correct_clip: boolean;
  correct_noclip: boolean;
  latency_clip: number;
  latency_noclip: number;
  delta_latency: number;
}

interface Exp2History {
  timestamp: string;
  image_name: string;
  ground_truth: string;
  model: string;
  predicted_clip: string;
  predicted_noclip: string;
  correct_clip: string | boolean;
  correct_noclip: string | boolean;
  latency_clip: number;
  latency_noclip: number;
  delta_latency: number;
}

type Verdict = "clip_only" | "direct_only" | "both_correct" | "both_wrong";

function getVerdict(correctClip: boolean, correctNoClip: boolean): Verdict {
  if (correctClip && correctNoClip) return "both_correct";
  if (correctClip && !correctNoClip) return "clip_only";
  if (!correctClip && correctNoClip) return "direct_only";
  return "both_wrong";
}

function verdictBadge(verdict: Verdict) {
  switch (verdict) {
    case "both_correct":
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-[11px] shadow-2xs">
          Both ✓✓
        </Badge>
      );
    case "clip_only":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-[11px] shadow-2xs">
          CLIP Won 🏆
        </Badge>
      );
    case "direct_only":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-[11px] shadow-2xs">
          Direct Won ⚡
        </Badge>
      );
    case "both_wrong":
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-semibold text-[11px] shadow-2xs">
          Both Miss ✗✗
        </Badge>
      );
  }
}

function isTruthy(v: string | boolean | undefined): boolean {
  return v === true || v === "true" || v === "True" || v === "1";
}

export default function Exp2PipelineComparison() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [selectedModels, setSelectedModels] = useState<AIModelType[]>(
    AI_MODEL_OPTIONS.map((o) => o.value)
  );

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp2Result[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp2History[]>([]);
  const [copiedLatex, setCopiedLatex] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results_exp2`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((row: any) => ({
          timestamp: row["Timestamp"] || row.timestamp || "",
          image_name: row["Image Name"] || row.image_name || "",
          ground_truth: row["Ground Truth"] || row.ground_truth || "",
          model: row["Model"] || row.model || "",
          predicted_clip: row["Predicted (CLIP)"] || row.predicted_clip || "",
          predicted_noclip: row["Predicted (No CLIP)"] || row.predicted_noclip || "",
          correct_clip: row["Correct (CLIP)"] !== undefined ? row["Correct (CLIP)"] : row.correct_clip,
          correct_noclip: row["Correct (No CLIP)"] !== undefined ? row["Correct (No CLIP)"] : row.correct_noclip,
          latency_clip: Number(row["Latency CLIP (ms)"] || row.latency_clip || 0),
          latency_noclip: Number(row["Latency No CLIP (ms)"] || row.latency_noclip || 0),
          delta_latency: Number(row["Delta Latency (ms)"] || row.delta_latency || 0),
        }));
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
      setCurrentResults([]);
    }
  };

  const runComparison = async () => {
    if (!imageFile || !groundTruth.trim()) {
      toast.error("Please upload an image and enter Ground Truth.");
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("Select at least one model.");
      return;
    }

    setIsRunning(true);
    setCurrentResults([]);
    const temp: Exp2Result[] = [];

    for (const modelId of selectedModels) {
      const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === modelId);
      const label = modelOpt ? modelOpt.label : modelId;

      // 1. Run WITH CLIP (2-Turn Visual Retrieval Pipeline)
      setProgressLabel(`[${label}] Running WITH CLIP (2-Turn Pipeline)...`);
      const startClip = performance.now();
      let resClip: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
      try {
        resClip = await analyzeImage(imageFile, modelId, true);
      } catch (err) {
        console.error("Exp2 CLIP error:", err);
      }
      const timeClip = Math.round(performance.now() - startClip);

      // 2. Run WITHOUT CLIP (Direct 1-Turn Multimodal Vision)
      setProgressLabel(`[${label}] Running WITHOUT CLIP (Direct 1-Turn)...`);
      const startNoClip = performance.now();
      let resNoClip: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
      try {
        resNoClip = await analyzeImage(imageFile, modelId, false);
      } catch (err) {
        console.error("Exp2 Direct error:", err);
      }
      const timeNoClip = Math.round(performance.now() - startNoClip);

      const predClip = resClip.place || "Unknown";
      const predNoClip = resNoClip.place || "Unknown";

      // Robust Multi-Alias Evaluation
      const matchClip = evaluatePredictionWithAliases(predClip, groundTruth, resClip.similar_locations || [], 0.70);
      const matchNoClip = evaluatePredictionWithAliases(predNoClip, groundTruth, resNoClip.similar_locations || [], 0.70);

      temp.push({
        model: modelId,
        modelLabel: label,
        predicted_clip: predClip,
        predicted_noclip: predNoClip,
        correct_clip: matchClip.isCorrect,
        correct_noclip: matchNoClip.isCorrect,
        latency_clip: timeClip,
        latency_noclip: timeNoClip,
        delta_latency: timeNoClip - timeClip,
      });

      setCurrentResults([...temp]);
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success("Pipeline Comparison Complete!");
  };

  const updateVerdict = (index: number, value: string) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      if (value === "both_correct") {
        updated[index] = { ...updated[index], correct_clip: true, correct_noclip: true };
      } else if (value === "clip_only") {
        updated[index] = { ...updated[index], correct_clip: true, correct_noclip: false };
      } else if (value === "direct_only") {
        updated[index] = { ...updated[index], correct_clip: false, correct_noclip: true };
      } else {
        updated[index] = { ...updated[index], correct_clip: false, correct_noclip: false };
      }
      return updated;
    });
  };

  const commitResults = async () => {
    if (currentResults.length === 0) return;

    const payload = {
      image_name: imageFile?.name || "image.jpg",
      ground_truth: groundTruth,
      results: currentResults.map((r) => ({
        model: r.model,
        predicted_clip: r.predicted_clip,
        predicted_noclip: r.predicted_noclip,
        correct_clip: r.correct_clip,
        correct_noclip: r.correct_noclip,
        latency_clip: r.latency_clip,
        latency_noclip: r.latency_noclip,
        delta_latency: r.delta_latency,
      })),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save_exp2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Exp2 results saved to CSV!");
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp2 results.");
    }
  };

  // ── Combined logs (Historical CSV + Current Trial) ──
  const combinedLogs = useMemo(() => {
    const currentMapped = currentResults.map((r) => ({
      model: r.model,
      correct_clip: r.correct_clip,
      correct_noclip: r.correct_noclip,
      latency_clip: r.latency_clip,
      latency_noclip: r.latency_noclip,
    }));
    return [...dbLogs, ...currentMapped];
  }, [dbLogs, currentResults]);

  // ── Metrics from combined logs ──
  const metrics = useMemo(() => {
    if (combinedLogs.length === 0) return null;
    const total = combinedLogs.length;
    const clipCorrect = combinedLogs.filter((r) => isTruthy(r.correct_clip)).length;
    const noclipCorrect = combinedLogs.filter((r) => isTruthy(r.correct_noclip)).length;

    const clipOnlyWins = combinedLogs.filter((r) => isTruthy(r.correct_clip) && !isTruthy(r.correct_noclip)).length;
    const directOnlyWins = combinedLogs.filter((r) => !isTruthy(r.correct_clip) && isTruthy(r.correct_noclip)).length;
    const bothCorrect = combinedLogs.filter((r) => isTruthy(r.correct_clip) && isTruthy(r.correct_noclip)).length;
    const bothWrong = combinedLogs.filter((r) => !isTruthy(r.correct_clip) && !isTruthy(r.correct_noclip)).length;

    const clipAcc = (clipCorrect / total) * 100;
    const noclipAcc = (noclipCorrect / total) * 100;
    const clipGain = clipAcc - noclipAcc;

    const avgClipTime = Math.round(combinedLogs.reduce((s, r) => s + Number(r.latency_clip || 0), 0) / total);
    const avgNoClipTime = Math.round(combinedLogs.reduce((s, r) => s + Number(r.latency_noclip || 0), 0) / total);

    // Per-model breakdown
    const modelMap: Record<string, { clip_correct: number; noclip_correct: number; total: number; clipTime: number; directTime: number }> = {};
    combinedLogs.forEach((r) => {
      if (!modelMap[r.model]) modelMap[r.model] = { clip_correct: 0, noclip_correct: 0, total: 0, clipTime: 0, directTime: 0 };
      modelMap[r.model].total += 1;
      if (isTruthy(r.correct_clip)) modelMap[r.model].clip_correct += 1;
      if (isTruthy(r.correct_noclip)) modelMap[r.model].noclip_correct += 1;
      modelMap[r.model].clipTime += Number(r.latency_clip || 0);
      modelMap[r.model].directTime += Number(r.latency_noclip || 0);
    });

    const modelBreakdown = Object.entries(modelMap).map(([model, d]) => {
      const opt = AI_MODEL_OPTIONS.find((o) => o.value === model);
      return {
        model,
        modelLabel: opt ? opt.label : model,
        shortModel: opt ? opt.label.split(" ")[0] : model.split("-").slice(-2).join("-"),
        clipAcc: Math.round((d.clip_correct / d.total) * 100),
        directAcc: Math.round((d.noclip_correct / d.total) * 100),
        gain: Math.round(((d.clip_correct - d.noclip_correct) / d.total) * 100),
        avgClipLatency: Math.round(d.clipTime / d.total),
        avgDirectLatency: Math.round(d.directTime / d.total),
        total: d.total,
      };
    }).sort((a, b) => b.gain - a.gain);

    return {
      total,
      clipAcc: clipAcc.toFixed(1),
      noclipAcc: noclipAcc.toFixed(1),
      clipGain,
      clipOnlyWins,
      directOnlyWins,
      bothCorrect,
      bothWrong,
      avgClipTime,
      avgNoClipTime,
      modelBreakdown,
    };
  }, [combinedLogs]);

  // Export LaTeX table for Ablation Study
  const copyAblationLatex = () => {
    if (!metrics) return;
    const rows = metrics.modelBreakdown.map((m) => {
      return `    ${m.modelLabel} & ${m.total} & ${m.clipAcc}\\% & ${m.directAcc}\\% & ${m.gain > 0 ? "+" : ""}${m.gain}\\% & ${m.avgClipLatency} & ${m.avgDirectLatency} \\\\`;
    }).join("\n");

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Ablation Study: 2-Turn CLIP Retrieval Pipeline vs. Direct 1-Turn Vision}
  \\label{tab:pipeline_ablation}
  \\begin{tabular}{l r r r r r r}
    \\toprule
    \\textbf{Model} & \\textbf{N} & \\textbf{CLIP Acc (\\%)} & \\textbf{Direct Acc (\\%)} & \\textbf{Gain (\\%)} & \\textbf{CLIP Lat. (ms)} & \\textbf{Direct Lat. (ms)} \\\\
    \\midrule
${rows}
    \\midrule
    \\textbf{Overall Average} & \\textbf{${metrics.total}} & \\textbf{${metrics.clipAcc}\\%} & \\textbf{${metrics.noclipAcc}\\%} & \\textbf{${metrics.clipGain > 0 ? "+" : ""}${metrics.clipGain.toFixed(1)}\\%} & \\textbf{${metrics.avgClipTime}} & \\textbf{${metrics.avgNoClipTime}} \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    toast.success("Ablation Study LaTeX Table copied to clipboard!");
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* Header Title & Academic Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Experiment 2: Pipeline Architecture & Ablation Study
              </h2>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold">
                Thesis Chap. 4.2
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quantify the empirical benefit of 2-Turn Visual Retrieval (CLIP) against 1-Turn Direct Multimodal Vision.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyAblationLatex}
              disabled={!metrics}
              className="text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-2xs h-8"
            >
              {copiedLatex ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <FileCode2 className="w-3.5 h-3.5 mr-1 text-indigo-600" />}
              {copiedLatex ? "Copied LaTeX" : "Export Ablation LaTeX"}
            </Button>
          </div>
        </div>

        {/* Top Hero KPI Summary Cards */}
        {metrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Card 1: CLIP Accuracy */}
              <Card className="bg-gradient-to-br from-emerald-50/80 to-white border-emerald-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      2-Turn CLIP Pipeline
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-mono">
                      Proposed
                    </Badge>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mt-2">
                    {metrics.clipAcc}%
                  </p>
                  <p className="text-[11px] text-emerald-600/90 mt-0.5 flex items-center gap-1 font-mono">
                    Avg Latency: <strong>{metrics.avgClipTime} ms</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Direct 1-Turn Accuracy */}
              <Card className="bg-gradient-to-br from-blue-50/80 to-white border-blue-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                      1-Turn Direct Vision
                    </span>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-mono">
                      Baseline
                    </Badge>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-blue-900 mt-2">
                    {metrics.noclipAcc}%
                  </p>
                  <p className="text-[11px] text-blue-600/90 mt-0.5 flex items-center gap-1 font-mono">
                    Avg Latency: <strong>{metrics.avgNoClipTime} ms</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Net Gain Score */}
              <Card
                className={`shadow-xs text-left ${
                  metrics.clipGain >= 0
                    ? "bg-gradient-to-br from-indigo-50/80 to-white border-indigo-200/90"
                    : "bg-gradient-to-br from-rose-50/80 to-white border-rose-200/90"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                      Empirical CLIP Gain ($\Delta$)
                    </span>
                    {metrics.clipGain > 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <p
                    className={`text-2xl sm:text-3xl font-extrabold mt-2 ${
                      metrics.clipGain >= 0 ? "text-indigo-900" : "text-rose-900"
                    }`}
                  >
                    {metrics.clipGain > 0 ? "+" : ""}
                    {metrics.clipGain.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {metrics.clipGain >= 0 ? "Statistically superior accuracy" : "Zero-shot direct faster"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Total Evaluations & Speed Tradeoff */}
              <Card className="bg-white border-slate-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Evaluated Samples
                    </span>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                      {metrics.total} Paired Tests
                    </Badge>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                    {metrics.total}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    $\Delta$ Latency: <strong>{Math.abs(metrics.avgClipTime - metrics.avgNoClipTime)} ms</strong> overhead
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: 2x2 Contingency Matrix Heatmap & Model Breakdown Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 cols: Comparison Chart with Switcher */}
              <Card className="lg:col-span-7 bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-600" />
                        Ablation Benchmark: CLIP Pipeline vs. Direct Vision
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Evaluates accuracy improvement and trade-off per model architecture.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.modelBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <XAxis dataKey="shortModel" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [`${value}%`, name]}
                          contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", fontSize: "11px", borderColor: "#e2e8f0" }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                        <Bar dataKey="clipAcc" name="2-Turn CLIP Pipeline (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="directAcc" name="1-Turn Direct Vision (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Right 5 cols: 2x2 Contingency Heatmap Card */}
              <Card className="lg:col-span-5 bg-white border-slate-200 shadow-sm text-left flex flex-col justify-between">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-indigo-600" />
                      $2 \times 2$ Contingency Heatmap
                    </CardTitle>
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-mono">
                      McNemar Matrix
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Distribution of paired sample outcomes between both pipelines.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Contingency Table Grid */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-3 bg-slate-100/80 font-semibold text-slate-700 text-center py-1.5 border-b border-slate-200 text-[11px]">
                      <div className="text-left pl-3 text-slate-500 font-mono">CLIP \ Direct</div>
                      <div className="text-emerald-700">Direct ✓</div>
                      <div className="text-rose-700">Direct ✗</div>
                    </div>

                    {/* Row 1: CLIP Correct */}
                    <div className="grid grid-cols-3 border-b border-slate-200 items-center">
                      <div className="py-2.5 pl-3 font-semibold text-emerald-800 bg-emerald-50/40 border-r border-slate-200 text-[11px]">
                        CLIP ✓
                      </div>
                      <div className="py-2.5 px-2 text-center bg-blue-50/60 border-r border-slate-200">
                        <span className="font-extrabold text-blue-900 text-sm block">{metrics.bothCorrect}</span>
                        <span className="text-[10px] text-blue-600">
                          {metrics.total > 0 ? ((metrics.bothCorrect / metrics.total) * 100).toFixed(1) : 0}% (Both ✓)
                        </span>
                      </div>
                      <div className="py-2.5 px-2 text-center bg-emerald-100/60">
                        <span className="font-extrabold text-emerald-900 text-sm block">{metrics.clipOnlyWins}</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          {metrics.total > 0 ? ((metrics.clipOnlyWins / metrics.total) * 100).toFixed(1) : 0}% (CLIP Rescued 🏆)
                        </span>
                      </div>
                    </div>

                    {/* Row 2: CLIP Failed */}
                    <div className="grid grid-cols-3 items-center">
                      <div className="py-2.5 pl-3 font-semibold text-rose-800 bg-rose-50/40 border-r border-slate-200 text-[11px]">
                        CLIP ✗
                      </div>
                      <div className="py-2.5 px-2 text-center bg-amber-50/60 border-r border-slate-200">
                        <span className="font-extrabold text-amber-900 text-sm block">{metrics.directOnlyWins}</span>
                        <span className="text-[10px] text-amber-700">
                          {metrics.total > 0 ? ((metrics.directOnlyWins / metrics.total) * 100).toFixed(1) : 0}% (Direct Only ⚡)
                        </span>
                      </div>
                      <div className="py-2.5 px-2 text-center bg-rose-50/70">
                        <span className="font-extrabold text-rose-900 text-sm block">{metrics.bothWrong}</span>
                        <span className="text-[10px] text-rose-600">
                          {metrics.total > 0 ? ((metrics.bothWrong / metrics.total) * 100).toFixed(1) : 0}% (Both Failed)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Discussion text */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
                    💡 <strong>Thesis Takeaway:</strong> CLIP pipeline rescued <strong>{metrics.clipOnlyWins}</strong> queries ({metrics.total > 0 ? ((metrics.clipOnlyWins / metrics.total) * 100).toFixed(1) : 0}%) where direct vision hallucinated, with only <strong>{Math.abs(metrics.avgClipTime - metrics.avgNoClipTime)} ms</strong> average overhead.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Main 2-Column Setup and Side-by-Side Testbed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: SETUP (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  1. Query Image & Ground Truth
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Select a test image to evaluate both pipelines simultaneously.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-5">
                {/* Upload Box */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Query Image</Label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50/50">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="exp2-file" disabled={isRunning} />
                    <label htmlFor="exp2-file" className="cursor-pointer block">
                      {imagePreview ? (
                        <div className="relative group">
                          <img src={imagePreview} alt="Preview" className="max-h-44 mx-auto rounded-lg object-cover shadow-xs" />
                          <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-[11px] bg-white text-slate-700 px-2.5 py-1 rounded-full shadow-md font-medium">
                              Change Image
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 space-y-2">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">Click or Drag & Drop Photo</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WebP</p>
                          </div>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Ground Truth */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Ground Truth (Multi-Alias)</Label>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                      Multi-Alias Supported
                    </span>
                  </div>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Wat Arun | วัดอรุณ | Temple of Dawn"
                    className="bg-white text-xs border-slate-200 text-slate-900"
                    disabled={isRunning}
                  />
                </div>

                {/* Model Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Models to Benchmark</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModels(AI_MODEL_OPTIONS.map((m) => m.value))}
                        className="text-[10px] h-6 px-1.5 text-slate-500 hover:text-slate-900"
                        disabled={isRunning}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModels([])}
                        className="text-[10px] h-6 px-1.5 text-slate-500 hover:text-slate-900"
                        disabled={isRunning}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
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
                          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-indigo-50/40 border-indigo-200"
                              : "bg-slate-50/40 border-slate-200/60 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {}}
                            className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 shrink-0"
                            disabled={isRunning}
                          />
                          <img
                            src={opt.icon}
                            className="w-4 h-4 rounded-full object-cover shrink-0 bg-slate-100 border border-slate-200"
                            alt=""
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-800 block truncate">
                              {opt.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runComparison}
                  disabled={isRunning || !imageFile || !groundTruth.trim() || selectedModels.length === 0}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunning ? progressLabel : `Run Pipeline Comparison (${selectedModels.length} Models × 2 Modes)`}</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: LIVE HEAD-TO-HEAD BATTLE VIEW (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    Live Side-by-Side Comparison Feed
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Direct visual comparison between 2-Turn CLIP and 1-Turn Direct VLM.
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
                    <Layers className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                    <p className="text-xs font-semibold text-slate-600">No comparison results generated yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Upload a photo and click Run to start the ablation study.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-b border-slate-200">
                            <TableHead className="text-xs font-semibold">Model</TableHead>
                            <TableHead className="text-xs font-semibold text-emerald-800 bg-emerald-50/50">2-Turn CLIP</TableHead>
                            <TableHead className="text-xs font-semibold text-blue-800 bg-blue-50/50">1-Turn Direct</TableHead>
                            <TableHead className="text-xs font-semibold text-center">Verdict</TableHead>
                            <TableHead className="text-xs font-semibold text-center">Latency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentResults.map((r, idx) => {
                            const verdict = getVerdict(r.correct_clip, r.correct_noclip);
                            return (
                              <TableRow key={idx} className="border-b border-slate-100">
                                <TableCell className="font-semibold text-xs text-slate-900">{r.modelLabel}</TableCell>
                                <TableCell className="text-xs bg-emerald-50/20">
                                  <div className="flex items-center space-x-1.5">
                                    {r.correct_clip ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                    )}
                                    <span className="font-medium text-slate-800 truncate max-w-[120px]">{r.predicted_clip}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs bg-blue-50/20">
                                  <div className="flex items-center space-x-1.5">
                                    {r.correct_noclip ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                    )}
                                    <span className="font-medium text-slate-800 truncate max-w-[120px]">{r.predicted_noclip}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {verdictBadge(verdict)}
                                </TableCell>
                                <TableCell className="text-center font-mono text-[11px] text-slate-600">
                                  {r.latency_clip}ms / {r.latency_noclip}ms
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historical Table */}
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Historical Ablation Records ({dbLogs.length} trials)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Persistent records of pipeline comparison trials saved in database.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 max-h-72 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved yet.</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="text-[11px] font-semibold">Image</TableHead>
                        <TableHead className="text-[11px] font-semibold">Model</TableHead>
                        <TableHead className="text-[11px] font-semibold">Ground Truth</TableHead>
                        <TableHead className="text-[11px] font-semibold">CLIP Pred</TableHead>
                        <TableHead className="text-[11px] font-semibold">Direct Pred</TableHead>
                        <TableHead className="text-[11px] font-semibold text-center">Verdict</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => {
                        const v = getVerdict(isTruthy(row.correct_clip), isTruthy(row.correct_noclip));
                        return (
                          <TableRow key={i} className="border-b border-slate-100 text-xs">
                            <TableCell className="font-mono text-[10px] text-slate-500 truncate max-w-[100px]">{row.image_name}</TableCell>
                            <TableCell className="font-medium text-slate-800">{row.model}</TableCell>
                            <TableCell className="text-slate-700 truncate max-w-[110px]">{row.ground_truth}</TableCell>
                            <TableCell>
                              <span className={isTruthy(row.correct_clip) ? "text-emerald-700 font-semibold" : "text-rose-600"}>
                                {row.predicted_clip}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={isTruthy(row.correct_noclip) ? "text-emerald-700 font-semibold" : "text-rose-600"}>
                                {row.predicted_noclip}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{verdictBadge(v)}</TableCell>
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
