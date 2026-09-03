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
import { analyzeImage, type VisionResult } from "@/services/aiService";
import { evaluatePredictionWithAliases } from "@/utils/evaluationMetrics";
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
  CloudRain,
  Camera,
  Layers,
  FileCode2,
  Check,
  Play,
  RotateCcw,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface RobustnessImageItem {
  id: string;
  file: File;
  preview: string;
  category: string;
  label: string;
}

interface Exp3Result {
  image_name: string;
  condition_category: string;
  condition_label: string;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
  matched_alias?: string | null;
}

interface Exp3History {
  timestamp: string;
  ground_truth: string;
  image_name: string;
  condition_category: string;
  condition_label: string;
  model: string;
  predicted: string;
  confidence: number | string;
  time_ms: number | string;
  is_correct: string | boolean;
}

const CONDITION_CATEGORIES = [
  {
    id: "Lighting",
    name: "Lighting / Time of Day",
    icon: Sun,
    labels: ["daytime", "nighttime", "golden_hour", "overcast", "harsh_shadows"],
    color: "#f59e0b",
    bgColor: "bg-amber-50 border-amber-200 text-amber-900",
  },
  {
    id: "Weather",
    name: "Weather & Environment",
    icon: CloudRain,
    labels: ["sunny", "foggy", "rainy", "snowy", "hazy"],
    color: "#3b82f6",
    bgColor: "bg-blue-50 border-blue-200 text-blue-900",
  },
  {
    id: "ViewAngle",
    name: "Perspective & Angle",
    icon: Camera,
    labels: ["front_view", "side_view", "aerial_view", "close_up", "extreme_angle"],
    color: "#8b5cf6",
    bgColor: "bg-purple-50 border-purple-200 text-purple-900",
  },
  {
    id: "Quality",
    name: "Image Quality & Degradations",
    icon: Layers,
    labels: ["high_res", "low_res", "blurred", "occluded_partially", "noisy"],
    color: "#ef4444",
    bgColor: "bg-rose-50 border-rose-200 text-rose-900",
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  Lighting: "#f59e0b",
  Weather: "#3b82f6",
  ViewAngle: "#8b5cf6",
  Quality: "#ef4444",
};

function isTruthy(v: string | boolean | undefined): boolean {
  return v === true || v === "true" || v === "True" || v === "1";
}

export default function Exp3RobustnessTest() {
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [imageList, setImageList] = useState<RobustnessImageItem[]>([]);
  const [selectedModels, setSelectedModels] = useState<AIModelType[]>([
    "google-gemini-25-flash",
    "openai-gpt4o-mini",
    "google-gemini-25-pro",
    "openai-gpt4o",
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp3Result[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp3History[]>([]);
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [chartView, setChartView] = useState<"radar" | "degradation">("radar");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results_exp3`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((row: any) => ({
          timestamp: row["Timestamp"] || row.timestamp || "",
          ground_truth: row["Landmark Ground Truth"] || row.ground_truth || "",
          image_name: row["Image Name"] || row.image_name || "",
          condition_category: row["Condition Category"] || row.condition_category || "",
          condition_label: row["Condition Label"] || row.condition_label || "",
          model: row["Model"] || row.model || "",
          predicted: row["Predicted Place"] || row.predicted || "",
          confidence: row["Confidence"] !== undefined ? row["Confidence"] : row.confidence,
          time_ms: row["Time MS"] !== undefined ? row["Time MS"] : row.time_ms,
          is_correct: row["Is Correct"] !== undefined ? row["Is Correct"] : row.is_correct,
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
      const newItems: RobustnessImageItem[] = files.map((file, idx) => ({
        id: `${file.name}-${Date.now()}-${idx}`,
        file,
        preview: URL.createObjectURL(file),
        category: "Lighting",
        label: "daytime",
      }));
      setImageList((prev) => [...prev, ...newItems]);
      if (!groundTruth) {
        const guessed = files[0].name.substring(0, files[0].name.lastIndexOf(".")).replace(/[-_]/g, " ");
        setGroundTruth(guessed);
      }
    }
  };

  const removeImage = (id: string) => setImageList((prev) => prev.filter((item) => item.id !== id));

  const updateImageCategory = (id: string, cat: string) => {
    const defaultLabel = CONDITION_CATEGORIES.find((c) => c.id === cat)?.labels[0] || "daytime";
    setImageList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category: cat, label: defaultLabel } : item))
    );
  };

  const updateImageLabel = (id: string, label: string) => {
    setImageList((prev) => prev.map((item) => (item.id === id ? { ...item, label } : item)));
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
      for (const modelId of selectedModels) {
        const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === modelId);
        const label = modelOpt ? modelOpt.label : modelId;

        setProgressLabel(`Testing [${item.file.name}] (${item.label}) on ${label}...`);
        const start = performance.now();
        let res: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
        try {
          res = await analyzeImage(item.file, modelId, true);
        } catch (err) {
          console.error("Exp3 error:", err);
        }
        const duration = Math.round(performance.now() - start);

        const pred = res.place || "Unknown";

        // Automated multi-alias evaluation
        const match = evaluatePredictionWithAliases(pred, groundTruth, res.similar_locations || [], 0.70);

        temp.push({
          image_name: item.file.name,
          condition_category: item.category,
          condition_label: item.label,
          model: modelId,
          modelLabel: label,
          predicted: pred,
          confidence: res.confidence || 0.0,
          time_ms: duration,
          is_correct: match.isCorrect,
          matched_alias: match.matchedAlias,
        });

        setCurrentResults([...temp]);
      }
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success("Robustness Test Complete! Results evaluated with aliases.");
  };

  const updateCorrectness = (index: number, value: boolean) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], is_correct: value };
      return updated;
    });
  };

  const commitResults = async () => {
    if (currentResults.length === 0) return;

    const payload = {
      ground_truth: groundTruth,
      results: currentResults.map((r) => ({
        image_name: r.image_name,
        condition_category: r.condition_category,
        condition_label: r.condition_label,
        model: r.model,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
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

  // Analytics Computation
  const analytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    // Category breakdown
    const catMap: Record<string, { total: number; correct: number }> = {};
    CONDITION_CATEGORIES.forEach((c) => {
      catMap[c.id] = { total: 0, correct: 0 };
    });

    dbLogs.forEach((row) => {
      const cat = row.condition_category || "Lighting";
      if (!catMap[cat]) catMap[cat] = { total: 0, correct: 0 };
      catMap[cat].total += 1;
      if (isTruthy(row.is_correct)) catMap[cat].correct += 1;
    });

    const categoryBreakdown = CONDITION_CATEGORIES.map((cat) => {
      const d = catMap[cat.id] || { total: 0, correct: 0 };
      return {
        category: cat.name,
        categoryId: cat.id,
        icon: cat.icon,
        total: d.total,
        correct: d.correct,
        accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
        color: cat.color,
        bgColor: cat.bgColor,
      };
    });

    // Label level breakdown
    const labelMap: Record<string, { total: number; correct: number; category: string }> = {};
    dbLogs.forEach((row) => {
      const lbl = row.condition_label || "unknown";
      if (!labelMap[lbl]) {
        labelMap[lbl] = { total: 0, correct: 0, category: row.condition_category || "Lighting" };
      }
      labelMap[lbl].total += 1;
      if (isTruthy(row.is_correct)) labelMap[lbl].correct += 1;
    });

    const labelBreakdown = Object.entries(labelMap)
      .map(([label, d]) => ({
        label,
        category: d.category,
        total: d.total,
        correct: d.correct,
        accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
        color: CATEGORY_COLOR[d.category] || "#94a3b8",
      }))
      .sort((a, b) => a.accuracy - b.accuracy); // lowest first to show degradation

    // Per-model stats
    const modelStats: Record<string, { total: number; correct: number }> = {};
    dbLogs.forEach((row) => {
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
      (dbLogs.filter((r) => isTruthy(r.is_correct)).length / dbLogs.length) * 100
    );

    // 4-Axis Robustness Radar Data
    const radarData = CONDITION_CATEGORIES.map((cat) => ({
      subject: cat.name.split(" / ")[0],
      accuracy: catMap[cat.id]?.total > 0 ? Math.round((catMap[cat.id].correct / catMap[cat.id].total) * 100) : 0,
      fullMark: 100,
    }));

    return { labelBreakdown, categoryBreakdown, modelBreakdown, radarData, overallAcc, total: dbLogs.length };
  }, [dbLogs]);

  const copyRobustnessLatex = () => {
    if (!analytics) return;
    const catRows = analytics.categoryBreakdown.map((c) => {
      return `    ${c.category} & ${c.total} & ${c.accuracy}\\% \\\\`;
    }).join("\n");

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Environmental Robustness & Perturbation Analysis (VPR Accuracy)}
  \\label{tab:robustness_eval}
  \\begin{tabular}{l r r}
    \\toprule
    \\textbf{Perturbation Category} & \\textbf{Trials (N)} & \\textbf{Accuracy (\\%)} \\\\
    \\midrule
${catRows}
    \\midrule
    \\textbf{Overall Robustness} & \\textbf{${analytics.total}} & \\textbf{${analytics.overallAcc}\\%} \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    toast.success("Robustness LaTeX Table copied to clipboard!");
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* Header Title & Academic Badges */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Experiment 3: Environmental Robustness & Degradation
              </h2>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
                Thesis Chap. 4.3
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Stress-test VPR performance under variable lighting, extreme weather, camera viewpoints, and occlusion noise.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Top Hero KPI Dashboard */}
        {analytics && (
          <div className="space-y-4">
            {/* 4 Environmental Category Gauges */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {/* Card 1: Overall */}
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs text-left col-span-2 md:col-span-1">
                <CardContent className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Overall Robustness
                  </span>
                  <p className="text-3xl font-extrabold text-white mt-2">
                    {analytics.overallAcc}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    {analytics.total} total trials evaluated
                  </p>
                </CardContent>
              </Card>

              {/* Category Cards */}
              {analytics.categoryBreakdown.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Card key={cat.categoryId} className="bg-white border-slate-200/90 shadow-xs text-left">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[110px]" title={cat.category}>
                          {cat.category.split(" / ")[0]}
                        </span>
                        <Icon className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                      <p className="text-2xl font-extrabold mt-2" style={{ color: cat.color }}>
                        {cat.accuracy}%
                      </p>
                      <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${cat.accuracy}%`, backgroundColor: cat.color }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        {cat.correct}/{cat.total} correct
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Degradation Chart & Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Degradation Ranking / Radar Chart (7 cols) */}
              <Card className="lg:col-span-7 bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-amber-600" />
                        {chartView === "radar" ? "Multi-Axis Environmental Robustness Radar" : "Degradation Ranking by Label"}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        {chartView === "radar"
                          ? "4-dimensional resilience profile (Lighting, Weather, Perspective, Quality)."
                          : "Ordered from lowest accuracy to highest — highlights failure modes and vulnerabilities."}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <Button
                        variant={chartView === "radar" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setChartView("radar")}
                        className={`text-[10px] h-6 px-2 rounded-lg font-semibold ${
                          chartView === "radar" ? "bg-white text-amber-700 shadow-xs hover:bg-white" : "text-slate-600"
                        }`}
                      >
                        Radar Profile
                      </Button>
                      <Button
                        variant={chartView === "degradation" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setChartView("degradation")}
                        className={`text-[10px] h-6 px-2 rounded-lg font-semibold ${
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
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={analytics.radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <RechartsTooltip
                            formatter={(v: any) => [`${v}%`, "Accuracy"]}
                            contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px" }}
                          />
                          <Radar
                            name="Overall Robustness"
                            dataKey="accuracy"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.4}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.labelBreakdown}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
                        >
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={75} />
                          <RechartsTooltip
                            formatter={(v: number) => [`${v}%`, "Accuracy"]}
                            contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px", borderColor: "#e2e8f0" }}
                          />
                          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                            {analytics.labelBreakdown.map((entry, idx) => (
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
                    Average accuracy across all degraded condition types.
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
          {/* Left: MULTI-IMAGE DATASET SETUP (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  1. Multi-Condition Photo Dataset
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Upload multiple photos of the target landmark under varying conditions (Day, Night, Blur, Angles).
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-5">
                {/* Ground Truth */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Landmark Ground Truth (Multi-Alias)</Label>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Wat Pho | วัดโพธิ์ | Temple of the Reclining Buddha"
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
                    <span className="text-xs font-bold text-slate-800">Add Degraded / Perturbation Images</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Select 2-20 photos with different light, weather, or angles</span>
                  </label>
                </div>

                {/* Image List Preview & Tagging */}
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

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {imageList.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                          <img src={item.preview} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0 border border-slate-200" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-xs font-mono text-slate-700 truncate">{item.file.name}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={item.category}
                                onValueChange={(v) => updateImageCategory(item.id, v)}
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-6 text-[10px] bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONDITION_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                      {cat.name.split(" / ")[0]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={item.label}
                                onValueChange={(v) => updateImageLabel(item.id, v)}
                                disabled={isRunning}
                              >
                                <SelectTrigger className="h-6 text-[10px] bg-white font-mono">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(CONDITION_CATEGORIES.find((c) => c.id === item.category)?.labels || []).map((lbl) => (
                                    <SelectItem key={lbl} value={lbl} className="text-xs font-mono">
                                      {lbl}
                                    </SelectItem>
                                  ))}
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

          {/* Right: LIVE EVALUATION & PREDICTIONS FEED (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    Live Robustness Results Feed
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Multi-alias evaluated predictions under specific perturbation conditions.
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
                    <p className="text-[10px] text-slate-400 mt-1">Upload degraded photos and click Start Evaluation.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-80">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2.5">Condition</TableHead>
                          <TableHead className="py-2.5">Model</TableHead>
                          <TableHead className="py-2.5">Prediction</TableHead>
                          <TableHead className="py-2.5 text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => (
                          <TableRow key={idx} className="border-b border-slate-100 text-xs">
                            <TableCell className="py-2">
                              <Badge variant="outline" className="text-[10px] font-mono border-slate-200 bg-slate-50 text-slate-700">
                                {r.condition_label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800 py-2">{r.modelLabel}</TableCell>
                            <TableCell className="py-2">
                              <span className="block font-medium text-slate-900 truncate max-w-[130px]">{r.predicted}</span>
                              {r.matched_alias && (
                                <span className="text-[10px] text-emerald-600 block">Matched: "{r.matched_alias}"</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => updateCorrectness(idx, true)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    r.is_correct ? "bg-emerald-600 text-white" : "text-slate-500"
                                  }`}
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateCorrectness(idx, false)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    !r.is_correct ? "bg-rose-600 text-white" : "text-slate-500"
                                  }`}
                                >
                                  ✗
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historical Log */}
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Historical Robustness Logs ({dbLogs.length} records)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-60 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved yet.</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-200 text-xs">
                        <TableHead className="py-2">Condition</TableHead>
                        <TableHead className="py-2">Model</TableHead>
                        <TableHead className="py-2">Prediction</TableHead>
                        <TableHead className="py-2 text-right">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => (
                        <TableRow key={i} className="border-b border-slate-100 text-xs">
                          <TableCell className="py-2 font-mono text-[10px] text-slate-600">
                            {row.condition_label}
                          </TableCell>
                          <TableCell className="py-2 font-medium text-slate-800">{row.model}</TableCell>
                          <TableCell className="py-2 text-slate-700 truncate max-w-[120px]">{row.predicted}</TableCell>
                          <TableCell className="py-2 text-right">
                            {isTruthy(row.is_correct) ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-none text-[9px]">✓ Correct</Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-none text-[9px]">✗ Miss</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
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
