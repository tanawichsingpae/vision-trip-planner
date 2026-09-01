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
import { Upload, Sparkles, Save, Trash2, BarChart3, TrendingDown, CheckCircle2, XCircle } from "lucide-react";
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
    labels: ["daytime", "nighttime", "golden_hour", "overcast", "harsh_shadows"],
    color: "#f59e0b",
  },
  {
    id: "Weather",
    name: "Weather & Environment",
    labels: ["sunny", "foggy", "rainy", "snowy", "hazy"],
    color: "#3b82f6",
  },
  {
    id: "ViewAngle",
    name: "Perspective & Angle",
    labels: ["front_view", "side_view", "aerial_view", "close_up", "extreme_angle"],
    color: "#8b5cf6",
  },
  {
    id: "Quality",
    name: "Image Quality & Distortions",
    labels: ["high_res", "low_res", "blurred", "occluded_partially", "noisy"],
    color: "#ef4444",
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
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp3Result[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp3History[]>([]);

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

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

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

    for (const item of imageList) {
      for (const modelId of selectedModels) {
        const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === modelId);
        const label = modelOpt ? modelOpt.label : modelId;

        setProgressLabel(`Testing [${item.file.name}] (${item.label}) with ${label}...`);
        const start = performance.now();
        let res: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
        try {
          res = await analyzeImage(item.file, modelId, true);
        } catch (err) {
          console.error("Exp3 error:", err);
        }
        const duration = Math.round(performance.now() - start);

        const pred = res.place || "Unknown";

        temp.push({
          image_name: item.file.name,
          condition_category: item.category,
          condition_label: item.label,
          model: modelId,
          modelLabel: label,
          predicted: pred,
          confidence: res.confidence || 0.0,
          time_ms: duration,
          is_correct: false, // default pending — user grades manually
        });

        setCurrentResults([...temp]);
      }
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success("Robustness Test Complete! Please grade each prediction below.");
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
        toast.success("Exp3 results saved to CSV!");
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp3 results.");
    }
  };

  // ── Analytics ──
  const analytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    // Per-label stats
    const labelStats: Record<string, { total: number; correct: number; category: string }> = {};
    dbLogs.forEach((row) => {
      const lbl = row.condition_label || "unknown";
      const cat = row.condition_category || "Unknown";
      if (!labelStats[lbl]) labelStats[lbl] = { total: 0, correct: 0, category: cat };
      labelStats[lbl].total += 1;
      if (isTruthy(row.is_correct)) labelStats[lbl].correct += 1;
    });

    const labelBreakdown = Object.entries(labelStats)
      .map(([label, d]) => ({
        label,
        category: d.category,
        accuracy: Math.round((d.correct / d.total) * 100),
        correct: d.correct,
        total: d.total,
        color: CATEGORY_COLOR[d.category] || "#64748b",
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    // Per-category stats
    const catStats: Record<string, { total: number; correct: number }> = {};
    dbLogs.forEach((row) => {
      const cat = row.condition_category || "Unknown";
      if (!catStats[cat]) catStats[cat] = { total: 0, correct: 0 };
      catStats[cat].total += 1;
      if (isTruthy(row.is_correct)) catStats[cat].correct += 1;
    });

    const categoryBreakdown = Object.entries(catStats).map(([cat, d]) => ({
      category: cat,
      accuracy: Math.round((d.correct / d.total) * 100),
      total: d.total,
      color: CATEGORY_COLOR[cat] || "#64748b",
    }));

    // Per-model stats
    const modelStats: Record<string, { total: number; correct: number }> = {};
    dbLogs.forEach((row) => {
      if (!modelStats[row.model]) modelStats[row.model] = { total: 0, correct: 0 };
      modelStats[row.model].total += 1;
      if (isTruthy(row.is_correct)) modelStats[row.model].correct += 1;
    });

    const modelBreakdown = Object.entries(modelStats)
      .map(([model, d]) => ({
        model,
        shortModel: model.split("-").slice(-2).join("-"),
        accuracy: Math.round((d.correct / d.total) * 100),
        total: d.total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const overallAcc = Math.round(
      (dbLogs.filter((r) => isTruthy(r.is_correct)).length / dbLogs.length) * 100
    );

    return { labelBreakdown, categoryBreakdown, modelBreakdown, overallAcc, total: dbLogs.length };
  }, [dbLogs]);

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* ── Title ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Experiment 3: Robustness & Degradation Test</h2>
            <p className="text-xs text-slate-500">
              Evaluate vision models under environmental perturbations (lighting, weather, camera angles, occlusion).
            </p>
          </div>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 px-3 py-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            Environmental Stress Test
          </Badge>
        </div>

        {/* ── Analytics Dashboard ── */}
        {analytics && (
          <>
            {/* Category Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Overall */}
              <Card className="bg-white border-slate-200 shadow-sm col-span-2 sm:col-span-1">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium">Overall Accuracy</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{analytics.overallAcc}%</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{analytics.total} total trials</p>
                </CardContent>
              </Card>
              {analytics.categoryBreakdown.map((cat) => (
                <Card key={cat.category} className="bg-white border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium" style={{ color: cat.color }}>{cat.category}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: cat.color }}>{cat.accuracy}%</p>
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${cat.accuracy}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{cat.total} trials</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Degradation Bar Chart + Model Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Label-level accuracy chart */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-amber-600" />
                    Accuracy by Condition Label
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Ranked from highest to lowest — reveals which conditions cause the most failures.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={analytics.labelBreakdown}
                      layout="vertical"
                      margin={{ top: 4, right: 32, left: 80, bottom: 4 }}
                    >
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={76} />
                      <RechartsTooltip
                        formatter={(v: number) => [`${v}%`, "Accuracy"]}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                        {analytics.labelBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Model breakdown */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Accuracy by Model (All Conditions)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Which model is most robust across all perturbation types?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.modelBreakdown} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
                      <XAxis dataKey="shortModel" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <RechartsTooltip formatter={(v: number) => [`${v}%`, "Accuracy"]} contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="accuracy" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {analytics.modelBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={`hsl(${240 - idx * 20}, 70%, 55%)`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-[11px]">Model</TableHead>
                        <TableHead className="text-[11px]">Accuracy</TableHead>
                        <TableHead className="text-[11px]">Trials</TableHead>
                        <TableHead className="text-[11px]">Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.modelBreakdown.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[11px] font-mono text-slate-700">{row.model}</TableCell>
                          <TableCell className="text-[11px] font-bold text-indigo-700">{row.accuracy}%</TableCell>
                          <TableCell className="text-[11px] text-slate-500">{row.total}</TableCell>
                          <TableCell className="text-[11px]">
                            {i === 0 && <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">🥇 Best</Badge>}
                            {i === analytics.modelBreakdown.length - 1 && analytics.modelBreakdown.length > 1 && (
                              <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">Worst</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ── Main Setup Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Image Dataset (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Multi-Condition Image Dataset</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Upload multiple photos of the same landmark captured in different conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ground Truth */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Landmark Ground Truth</Label>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Eiffel Tower"
                    className="bg-white text-xs border-slate-200"
                  />
                </div>

                {/* Upload Button */}
                <div>
                  <Input type="file" accept="image/*" multiple onChange={handleMultipleFiles} className="hidden" id="exp3-files" />
                  <label
                    htmlFor="exp3-files"
                    className="flex items-center justify-center space-x-2 border-2 border-dashed border-slate-200 hover:border-amber-400 p-3 rounded-lg cursor-pointer bg-slate-50 text-xs text-slate-600 font-medium transition-colors"
                  >
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>Upload Multiple Condition Images</span>
                  </label>
                </div>

                {/* Image List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {imageList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">No images added yet.</p>
                  ) : (
                    imageList.map((item) => {
                      const catObj = CONDITION_CATEGORIES.find((c) => c.id === item.category);
                      return (
                        <div key={item.id} className="flex items-center space-x-3 p-2 border border-slate-200 rounded-lg bg-slate-50">
                          <img src={item.preview} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">{item.file.name}</p>
                            <div className="flex items-center space-x-2">
                              <Select value={item.category} onValueChange={(val) => updateImageCategory(item.id, val)}>
                                <SelectTrigger className="h-7 text-[11px] bg-white border-slate-200 w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONDITION_CATEGORIES.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={item.label} onValueChange={(val) => updateImageLabel(item.id, val)}>
                                <SelectTrigger className="h-7 text-[11px] bg-white border-slate-200 w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(catObj?.labels || []).map((lb) => (
                                    <SelectItem key={lb} value={lb} className="text-xs">{lb}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button onClick={() => removeImage(item.id)} variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 p-1.5 h-auto">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Model Selector */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Models to Test</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModels(AI_MODEL_OPTIONS.map((m) => m.value))}
                        className="text-[10px] h-6 px-1.5 hover:bg-slate-200/60 text-slate-500 hover:text-slate-900"
                        disabled={isRunning}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedModels([])}
                        className="text-[10px] h-6 px-1.5 hover:bg-slate-200/60 text-slate-500 hover:text-slate-900"
                        disabled={isRunning}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
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
                          className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                            isChecked
                              ? "bg-amber-50/50 border-amber-200 shadow-2xs"
                              : "bg-white border-slate-200/80 hover:bg-slate-100/60 hover:border-slate-300"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {}}
                            className="border-slate-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 shrink-0"
                            disabled={isRunning}
                          />
                          <img
                            src={opt.icon}
                            className="w-4 h-4 rounded-full object-cover shrink-0 bg-slate-100 border border-slate-200"
                            alt=""
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-800 block text-left truncate">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block text-left font-mono truncate">
                              {opt.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runRobustnessTest}
                  disabled={isRunning}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm"
                >
                  {isRunning ? progressLabel : `Run Robustness Test (${imageList.length} images × ${selectedModels.length} models)`}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Current results */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Current Evaluation Results</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Model predictions across different image conditions.
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <Button onClick={commitResults} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    <Save className="w-3.5 h-3.5 mr-1" /> Save to CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                {currentResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">Run evaluation to view robustness breakdown.</p>
                ) : (
                  <>
                    {/* Live grading summary bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-3 bg-gradient-to-r from-amber-50 via-slate-50 to-emerald-50 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-800">Manual Verification</span>
                      </div>
                      <div className="flex items-center space-x-2.5 text-xs">
                        <span className="font-semibold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                          ✓ {currentResults.filter(r => r.is_correct).length} Correct
                        </span>
                        <span className="font-semibold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-200 text-[11px]">
                          ✗ {currentResults.filter(r => !r.is_correct).length} Wrong
                        </span>
                        <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs text-[11px]">
                          Score: {currentResults.length > 0
                            ? `${Math.round((currentResults.filter(r => r.is_correct).length / currentResults.length) * 100)}%`
                            : "0%"}
                        </span>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">Image</TableHead>
                          <TableHead className="text-xs">Condition</TableHead>
                          <TableHead className="text-xs">Model</TableHead>
                          <TableHead className="text-xs">Prediction</TableHead>
                          <TableHead className="text-xs text-center">Evaluation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => (
                          <TableRow key={idx} className={r.is_correct ? "bg-emerald-50/30 transition-colors" : "transition-colors"}>
                            <TableCell className="text-xs font-mono text-slate-600 truncate max-w-[80px]">{r.image_name}</TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                style={{
                                  backgroundColor: `${CATEGORY_COLOR[r.condition_category]}15`,
                                  borderColor: `${CATEGORY_COLOR[r.condition_category]}40`,
                                  color: CATEGORY_COLOR[r.condition_category],
                                }}
                              >
                                {r.condition_label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-900">{r.modelLabel}</TableCell>
                            <TableCell className="text-xs text-slate-800 font-medium">{r.predicted}</TableCell>
                            <TableCell className="text-center">
                              {/* Segmented Pill Toggle Buttons */}
                              <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/80 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => updateCorrectness(idx, true)}
                                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                                    r.is_correct
                                      ? "bg-emerald-600 text-white shadow-xs font-bold scale-105"
                                      : "text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60"
                                  }`}
                                >
                                  <CheckCircle2 className={`w-3.5 h-3.5 ${r.is_correct ? "text-white" : "text-slate-400"}`} />
                                  <span>Correct</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateCorrectness(idx, false)}
                                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                                    !r.is_correct
                                      ? "bg-rose-600 text-white shadow-xs font-bold scale-105"
                                      : "text-slate-500 hover:text-rose-700 hover:bg-slate-200/60"
                                  }`}
                                >
                                  <XCircle className={`w-3.5 h-3.5 ${!r.is_correct ? "text-white" : "text-slate-400"}`} />
                                  <span>Wrong</span>
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Historical Log */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Exp3 History (exp3_robustness.csv)</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Timestamp</TableHead>
                        <TableHead className="text-xs">Landmark</TableHead>
                        <TableHead className="text-xs">Condition</TableHead>
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="text-xs">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[11px] text-slate-500">{row.timestamp}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-800">{row.ground_truth}</TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: `${CATEGORY_COLOR[row.condition_category] || "#64748b"}15`,
                                borderColor: `${CATEGORY_COLOR[row.condition_category] || "#64748b"}40`,
                                color: CATEGORY_COLOR[row.condition_category] || "#64748b",
                              }}
                            >
                              {row.condition_label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">{row.model}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className={isTruthy(row.is_correct) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                              {row.predicted}
                            </Badge>
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
