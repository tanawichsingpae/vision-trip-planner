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
import { Upload, Play, CheckCircle2, XCircle, Save, Layers, TrendingUp, TrendingDown, Minus, Trophy, Target, Zap, BarChart3 } from "lucide-react";
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
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold text-[11px]">Both ✓</Badge>;
    case "clip_only":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold text-[11px]">CLIP ✓</Badge>;
    case "direct_only":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold text-[11px]">Direct ✓</Badge>;
    case "both_wrong":
      return <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold text-[11px]">Both ✗</Badge>;
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

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

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

  const checkMatch = (pred: string, gt: string) => {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const p = clean(pred);
    const g = clean(gt);
    return p.length > 0 && g.length > 0 && (p.includes(g) || g.includes(p));
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

      // 1. Run WITH CLIP
      setProgressLabel(`[${label}] Running WITH CLIP (2-Turn Visual Retrieval)...`);
      const startClip = performance.now();
      let resClip: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
      try {
        resClip = await analyzeImage(imageFile, modelId, true);
      } catch (err) {
        console.error("Exp2 CLIP error:", err);
      }
      const timeClip = Math.round(performance.now() - startClip);

      // 2. Run WITHOUT CLIP (Direct 1-Turn)
      setProgressLabel(`[${label}] Running WITHOUT CLIP (Direct 1-Turn Vision)...`);
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

      // Basic string match correctness
      const correctClip = checkMatch(predClip, groundTruth);
      const correctNoClip = checkMatch(predNoClip, groundTruth);

      temp.push({
        model: modelId,
        modelLabel: label,
        predicted_clip: predClip,
        predicted_noclip: predNoClip,
        correct_clip: correctClip,
        correct_noclip: correctNoClip,
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

  const getVerdictValue = (correctClip: boolean, correctNoClip: boolean) => {
    if (correctClip && correctNoClip) return "both_correct";
    if (correctClip && !correctNoClip) return "clip_only";
    if (!correctClip && correctNoClip) return "direct_only";
    return "both_wrong";
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
    toast.info("Evaluation updated. Click 'Save to CSV' to commit.");
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
    const modelMap: Record<string, { clip_correct: number; noclip_correct: number; total: number }> = {};
    combinedLogs.forEach((r) => {
      if (!modelMap[r.model]) modelMap[r.model] = { clip_correct: 0, noclip_correct: 0, total: 0 };
      modelMap[r.model].total += 1;
      if (isTruthy(r.correct_clip)) modelMap[r.model].clip_correct += 1;
      if (isTruthy(r.correct_noclip)) modelMap[r.model].noclip_correct += 1;
    });

    const modelBreakdown = Object.entries(modelMap).map(([model, d]) => ({
      model,
      shortModel: model.split("-").slice(-2).join("-"),
      clipAcc: Math.round((d.clip_correct / d.total) * 100),
      directAcc: Math.round((d.noclip_correct / d.total) * 100),
      gain: Math.round(((d.clip_correct - d.noclip_correct) / d.total) * 100),
      total: d.total,
    }));

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

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* ── Title ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Experiment 2: Pipeline Comparison</h2>
            <p className="text-xs text-slate-500">
              Ablation Study: Compare 2-Turn CLIP Visual Retrieval vs Direct 1-Turn Multimodal LLM Vision.
            </p>
          </div>
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-1 font-medium">
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Ablation Study
          </Badge>
        </div>

        {/* ── Summary Dashboard ── */}
        {metrics && (
          <>
            {/* Row 1: accuracy + latency */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium">Total Evaluations</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-emerald-700 font-medium">CLIP Recall@1</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.clipAcc}%</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-blue-700 font-medium">Direct 1-Turn Recall@1</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{metrics.noclipAcc}%</p>
                </CardContent>
              </Card>
              <Card className={`border shadow-sm ${metrics.clipGain >= 0 ? "bg-indigo-50 border-indigo-200" : "bg-rose-50 border-rose-200"}`}>
                <CardContent className="p-4">
                  <p className={`text-xs font-medium ${metrics.clipGain >= 0 ? "text-indigo-700" : "text-rose-700"}`}>
                    CLIP Gain Score
                  </p>
                  <div className="flex items-center mt-1 space-x-1">
                    {metrics.clipGain > 0 ? (
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    ) : metrics.clipGain < 0 ? (
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    ) : (
                      <Minus className="w-4 h-4 text-slate-500" />
                    )}
                    <p className={`text-2xl font-bold ${metrics.clipGain >= 0 ? "text-indigo-700" : "text-rose-700"}`}>
                      {metrics.clipGain > 0 ? "+" : ""}{metrics.clipGain.toFixed(1)}%
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Avg: {metrics.avgClipTime}ms / {metrics.avgNoClipTime}ms</p>
                </CardContent>
              </Card>
            </div>

            {/* Row 2: verdict breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-blue-50 border-blue-200 shadow-sm">
                <CardContent className="p-4 flex items-start space-x-3">
                  <Trophy className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-700 font-semibold">Both Correct</p>
                    <p className="text-xl font-bold text-blue-800">{metrics.bothCorrect}</p>
                    <p className="text-[11px] text-blue-500">{((metrics.bothCorrect / metrics.total) * 100).toFixed(1)}% of trials</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                <CardContent className="p-4 flex items-start space-x-3">
                  <Target className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-700 font-semibold">CLIP-Only Win</p>
                    <p className="text-xl font-bold text-emerald-800">{metrics.clipOnlyWins}</p>
                    <p className="text-[11px] text-emerald-500">CLIP ✓ Direct ✗</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-200 shadow-sm">
                <CardContent className="p-4 flex items-start space-x-3">
                  <Zap className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-amber-700 font-semibold">Direct-Only Win</p>
                    <p className="text-xl font-bold text-amber-800">{metrics.directOnlyWins}</p>
                    <p className="text-[11px] text-amber-500">CLIP ✗ Direct ✓</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200 shadow-sm">
                <CardContent className="p-4 flex items-start space-x-3">
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-red-700 font-semibold">Both Wrong</p>
                    <p className="text-xl font-bold text-red-800">{metrics.bothWrong}</p>
                    <p className="text-[11px] text-red-400">CLIP ✗ Direct ✗</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: per-model bar chart */}
            {metrics.modelBreakdown.length > 0 && (
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    CLIP Gain per Model (CLIP Acc − Direct Acc)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Positive = CLIP helps the model. Negative = CLIP hurts accuracy for that model.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={metrics.modelBreakdown} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
                      <XAxis dataKey="shortModel" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [`${value}%`, name]}
                        labelFormatter={(label) => `Model: ${label}`}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="clipAcc" name="With CLIP Acc (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="directAcc" name="Direct (No CLIP) Acc (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-[11px]">Model</TableHead>
                          <TableHead className="text-[11px]">CLIP Acc</TableHead>
                          <TableHead className="text-[11px]">Direct Acc</TableHead>
                          <TableHead className="text-[11px]">CLIP Gain</TableHead>
                          <TableHead className="text-[11px]">Trials</TableHead>
                          <TableHead className="text-[11px]">Winner</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics.modelBreakdown.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[11px] font-mono text-slate-700">{row.model}</TableCell>
                            <TableCell className="text-[11px] font-semibold text-emerald-700">{row.clipAcc}%</TableCell>
                            <TableCell className="text-[11px] font-semibold text-blue-700">{row.directAcc}%</TableCell>
                            <TableCell className="text-[11px] font-bold">
                              <span className={row.gain >= 0 ? "text-emerald-700" : "text-red-600"}>
                                {row.gain > 0 ? "+" : ""}{row.gain}%
                              </span>
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-500">{row.total}</TableCell>
                            <TableCell>
                              {row.gain > 0 ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">CLIP Wins</Badge>
                              ) : row.gain < 0 ? (
                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Direct Wins</Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Tie</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Setup (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Setup Comparison Test</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Upload an image to benchmark both pipeline modes sequentially.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Query Image</Label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="exp2-file" />
                    <label htmlFor="exp2-file" className="cursor-pointer block">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-cover shadow-sm" />
                      ) : (
                        <div className="py-6 space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-slate-400" />
                          <p className="text-xs text-slate-600 font-medium">Click to upload image</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Ground Truth */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Ground Truth Location</Label>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Grand Palace, Bangkok"
                    className="bg-white text-xs border-slate-200"
                  />
                </div>

                {/* Model Selector */}
                <div className="space-y-2">
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
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
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
                              ? "bg-indigo-50/50 border-indigo-200 shadow-2xs"
                              : "bg-white border-slate-200/80 hover:bg-slate-100/60 hover:border-slate-300"
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
                  onClick={runComparison}
                  disabled={isRunning}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  {isRunning ? progressLabel : "Run Pipeline Comparison (2 Modes)"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Current trial side-by-side */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Side-by-Side Results</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Comparison per model — including Verdict (who won each trial).
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <Button onClick={commitResults} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    <Save className="w-3.5 h-3.5 mr-1" /> Save to CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {currentResults.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Run the evaluation to view side-by-side pipeline results.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">Model</TableHead>
                          <TableHead className="text-xs">With CLIP</TableHead>
                          <TableHead className="text-xs">Without CLIP</TableHead>
                          <TableHead className="text-xs text-center">Verdict</TableHead>
                          <TableHead className="text-xs">Latency (C/D)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => {
                          const verdict = getVerdict(r.correct_clip, r.correct_noclip);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-semibold text-xs text-slate-900">{r.modelLabel}</TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center space-x-1.5">
                                  {r.correct_clip
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                                  <span className="truncate max-w-[110px]">{r.predicted_clip}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center space-x-1.5">
                                  {r.correct_noclip
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                                  <span className="truncate max-w-[110px]">{r.predicted_noclip}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center min-w-[180px]">
                                <select
                                  value={getVerdictValue(r.correct_clip, r.correct_noclip)}
                                  onChange={(e) => updateVerdict(idx, e.target.value)}
                                  className="text-[11px] font-semibold bg-white border border-slate-200 rounded p-1 text-slate-800 focus:outline-none w-full"
                                >
                                  <option value="both_correct">Both Correct (ถูกทั้งคู่) ✓✓</option>
                                  <option value="clip_only">With CLIP Correct (ฝั่ง With CLIP ถูก) ✓✗</option>
                                  <option value="direct_only">Without CLIP Correct (ฝั่ง Without CLIP ถูก) ✗✓</option>
                                  <option value="both_wrong">Both Wrong (ผิดทั้งคู่) ✗✗</option>
                                </select>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-slate-600">
                                {r.latency_clip}ms / {r.latency_noclip}ms
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Mini verdict summary for current run */}
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-600 mb-2">Current Trial Verdict Summary</p>
                      <div className="flex flex-wrap gap-2">
                        {(["both_correct", "clip_only", "direct_only", "both_wrong"] as Verdict[]).map((v) => {
                          const count = currentResults.filter((r) => getVerdict(r.correct_clip, r.correct_noclip) === v).length;
                          return count > 0 ? (
                            <div key={v} className="flex items-center space-x-1">
                              {verdictBadge(v)}
                              <span className="text-[11px] text-slate-600">{count}x</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historical Log */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Historical Comparison Logs</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Committed trials from exp2_pipeline_comparison.csv — colour-coded by Verdict
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Timestamp</TableHead>
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="text-xs">Ground Truth</TableHead>
                        <TableHead className="text-xs">CLIP Pred</TableHead>
                        <TableHead className="text-xs">Direct Pred</TableHead>
                        <TableHead className="text-xs text-center">Verdict</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => {
                        const v = getVerdict(isTruthy(row.correct_clip), isTruthy(row.correct_noclip));
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-[11px] text-slate-500">{row.timestamp}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">{row.model}</TableCell>
                            <TableCell className="text-xs text-slate-700">{row.ground_truth}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={isTruthy(row.correct_clip) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                                {row.predicted_clip}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={isTruthy(row.correct_noclip) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                                {row.predicted_noclip}
                              </Badge>
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
