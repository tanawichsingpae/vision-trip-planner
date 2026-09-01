import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ExperimentLayout } from "./ExperimentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImage, type VisionResult } from "@/services/aiService";
import { Upload, RefreshCw, CheckCircle2, XCircle, Save, TrendingUp, BarChart3, ShieldCheck } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface Exp5RunResult {
  run_number: number;
  total_runs: number;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
}

interface Exp5History {
  timestamp: string;
  session_id: string;
  image_name: string;
  ground_truth: string;
  model: string;
  run_number: number | string;
  total_runs: number | string;
  predicted: string;
  confidence: number | string;
  time_ms: number | string;
  is_correct: string | boolean;
}

function isTruthy(v: string | boolean | undefined): boolean {
  return v === true || v === "true" || v === "True" || v === "1";
}

export default function Exp5ConsistencyTest() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<AIModelType>("google-gemini-25-flash");
  const [numRuns, setNumRuns] = useState<number>(5);

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp5RunResult[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp5History[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results_exp5`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((row: any) => ({
          timestamp: row["Timestamp"] || row.timestamp || "",
          session_id: row["Session ID"] || row.session_id || "",
          image_name: row["Image Name"] || row.image_name || "",
          ground_truth: row["Ground Truth"] || row.ground_truth || "",
          model: row["Model"] || row.model || "",
          run_number: row["Run Number"] !== undefined ? row["Run Number"] : row.run_number,
          total_runs: row["Total Runs"] !== undefined ? row["Total Runs"] : row.total_runs,
          predicted: row["Predicted Place"] || row.predicted || "",
          confidence: row["Confidence"] !== undefined ? row["Confidence"] : row.confidence,
          time_ms: row["Time MS"] !== undefined ? row["Time MS"] : row.time_ms,
          is_correct: row["Is Correct"] !== undefined ? row["Is Correct"] : row.is_correct,
        }));
        setDbLogs(mapped);
      }
    } catch (e) {
      console.error("Failed to load Exp5 history:", e);
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

  const runConsistencyTest = async () => {
    if (!imageFile || !groundTruth.trim()) {
      toast.error("Please upload an image and specify Ground Truth.");
      return;
    }

    setIsRunning(true);
    setCurrentResults([]);
    const temp: Exp5RunResult[] = [];

    const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === selectedModel);
    const modelLabel = modelOpt ? modelOpt.label : selectedModel;

    for (let i = 1; i <= numRuns; i++) {
      setProgressLabel(`Run ${i} / ${numRuns} (${modelLabel})...`);

      const start = performance.now();
      let res: VisionResult = { place: "Unknown", confidence: 0, country: "", type: "", similar_locations: [] };
      try {
        res = await analyzeImage(imageFile, selectedModel, true);
      } catch (err) {
        console.error(`Exp5 Run ${i} error:`, err);
      }
      const duration = Math.round(performance.now() - start);

      const pred = res.place || "Unknown";

      temp.push({
        run_number: i,
        total_runs: numRuns,
        model: selectedModel,
        modelLabel,
        predicted: pred,
        confidence: res.confidence || 0.0,
        time_ms: duration,
        is_correct: false, // default pending — user grades manually
      });

      setCurrentResults([...temp]);
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success(`Completed ${numRuns} repetition runs! Please grade each run below.`);
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

    const sessionId = `SES-${Date.now().toString().slice(-6)}`;
    const payload = {
      session_id: sessionId,
      image_name: imageFile?.name || "image.jpg",
      ground_truth: groundTruth,
      results: currentResults.map((r) => ({
        model: r.model,
        run_number: r.run_number,
        total_runs: r.total_runs,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
      })),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save_exp5`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Exp5 session (${sessionId}) saved to CSV!`);
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp5 results.");
    }
  };

  // ── Current session metrics ──
  const sessionMetrics = useMemo(() => {
    if (currentResults.length === 0) return null;
    const N = currentResults.length;

    const counts: Record<string, number> = {};
    currentResults.forEach((r) => { counts[r.predicted] = (counts[r.predicted] || 0) + 1; });
    let modePred = "";
    let maxCount = 0;
    Object.entries(counts).forEach(([pred, cnt]) => {
      if (cnt > maxCount) { maxCount = cnt; modePred = pred; }
    });

    const agreementRate = ((maxCount / N) * 100).toFixed(1);
    const accuracyRate = ((currentResults.filter(r => r.is_correct).length / N) * 100).toFixed(1);

    const latencies = currentResults.map((r) => r.time_ms);
    const meanLat = latencies.reduce((a, b) => a + b, 0) / N;
    const varLat = latencies.reduce((a, b) => a + Math.pow(b - meanLat, 2), 0) / N;
    const sdLat = Math.round(Math.sqrt(varLat));

    const confs = currentResults.map((r) => r.confidence);
    const meanConf = confs.reduce((a, b) => a + b, 0) / N;
    const varConf = confs.reduce((a, b) => a + Math.pow(b - meanConf, 2), 0) / N;
    const sdConf = Math.sqrt(varConf).toFixed(3);

    // Latency chart data
    const latencyChartData = currentResults.map((r) => ({
      run: `R${r.run_number}`,
      latency: r.time_ms,
      mean: Math.round(meanLat),
    }));

    return {
      totalRuns: N,
      modePred,
      agreementRate,
      accuracyRate,
      meanLat: Math.round(meanLat),
      sdLat,
      sdConf,
      latencyChartData,
    };
  }, [currentResults]);

  // ── Historical analytics ──
  const historicalAnalytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    // Per-model aggregate consistency
    const modelStats: Record<string, { sessions: Set<string>; total: number; correct: number; predictions: string[] }> = {};
    dbLogs.forEach((row) => {
      const model = row.model;
      if (!modelStats[model]) modelStats[model] = { sessions: new Set(), total: 0, correct: 0, predictions: [] };
      if (row.session_id) modelStats[model].sessions.add(row.session_id);
      modelStats[model].total += 1;
      if (isTruthy(row.is_correct)) modelStats[model].correct += 1;
      if (row.predicted) modelStats[model].predictions.push(row.predicted);
    });

    const modelBreakdown = Object.entries(modelStats).map(([model, d]) => {
      const acc = Math.round((d.correct / d.total) * 100);
      // Agreement rate: most common prediction / total
      const predCounts: Record<string, number> = {};
      d.predictions.forEach((p) => { predCounts[p] = (predCounts[p] || 0) + 1; });
      const maxCount = Math.max(...Object.values(predCounts));
      const agreementRate = Math.round((maxCount / d.total) * 100);
      return {
        model,
        shortModel: model.split("-").slice(-2).join("-"),
        acc,
        agreementRate,
        sessions: d.sessions.size,
        total: d.total,
      };
    }).sort((a, b) => b.agreementRate - a.agreementRate);

    // Per-session summary
    const sessionStats: Record<string, { model: string; groundTruth: string; total: number; correct: number; predictions: string[] }> = {};
    dbLogs.forEach((row) => {
      const sid = row.session_id || "?";
      if (!sessionStats[sid]) sessionStats[sid] = { model: row.model, groundTruth: row.ground_truth, total: 0, correct: 0, predictions: [] };
      sessionStats[sid].total += 1;
      if (isTruthy(row.is_correct)) sessionStats[sid].correct += 1;
      if (row.predicted) sessionStats[sid].predictions.push(row.predicted);
    });

    const sessionBreakdown = Object.entries(sessionStats).map(([sid, d]) => {
      const predCounts: Record<string, number> = {};
      d.predictions.forEach((p) => { predCounts[p] = (predCounts[p] || 0) + 1; });
      const maxCount = Math.max(...Object.values(predCounts));
      const agreementRate = Math.round((maxCount / d.total) * 100);
      const acc = Math.round((d.correct / d.total) * 100);
      return {
        session: sid,
        model: d.model,
        groundTruth: d.groundTruth,
        total: d.total,
        acc,
        agreementRate,
      };
    }).slice(-10); // last 10 sessions

    return { modelBreakdown, sessionBreakdown, totalLogs: dbLogs.length };
  }, [dbLogs]);

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* ── Title ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Experiment 5: Consistency & Operational Stability</h2>
            <p className="text-xs text-slate-500">
              Measure output agreement, response variance, and latency stability across N repeated trials.
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1 font-medium">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            N-Run Stability Test
          </Badge>
        </div>

        {/* ── Historical Analytics ── */}
        {historicalAnalytics && (
          <>
            {/* Per-model consistency overview */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Model Consistency & Accuracy Summary (All Historical Sessions)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Agreement Rate = how often the model gives the same answer across repeated runs (higher = more stable).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Agreement rate bar chart */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Agreement Rate per Model</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={historicalAnalytics.modelBreakdown} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
                        <XAxis dataKey="shortModel" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <RechartsTooltip formatter={(v: number) => [`${v}%`, "Agreement Rate"]} contentStyle={{ fontSize: 11 }} />
                        <Bar dataKey="agreementRate" radius={[4, 4, 0, 0]}>
                          {historicalAnalytics.modelBreakdown.map((entry, idx) => (
                            <Cell key={idx} fill={`hsl(${150 - idx * 20}, 65%, 45%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Model breakdown table */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Per-Model Detail</p>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-[11px]">Model</TableHead>
                          <TableHead className="text-[11px]">Agreement</TableHead>
                          <TableHead className="text-[11px]">Accuracy</TableHead>
                          <TableHead className="text-[11px]">Sessions</TableHead>
                          <TableHead className="text-[11px]">Stability</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicalAnalytics.modelBreakdown.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[11px] font-mono text-slate-700">{row.model}</TableCell>
                            <TableCell className="text-[11px] font-bold text-emerald-700">{row.agreementRate}%</TableCell>
                            <TableCell className="text-[11px] font-bold text-blue-700">{row.acc}%</TableCell>
                            <TableCell className="text-[11px] text-slate-500">{row.sessions}</TableCell>
                            <TableCell>
                              {row.agreementRate >= 80 ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">High</Badge>
                              ) : row.agreementRate >= 60 ? (
                                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Medium</Badge>
                              ) : (
                                <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">Low</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Live Session Metrics ── */}
        {sessionMetrics && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-emerald-700 font-medium">Agreement Rate</p>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">{sessionMetrics.agreementRate}%</p>
                  <p className="text-[11px] text-emerald-500 mt-0.5">Mode: "{sessionMetrics.modePred}"</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-blue-700 font-medium">Accuracy Rate</p>
                  <p className="text-2xl font-bold text-blue-800 mt-1">{sessionMetrics.accuracyRate}%</p>
                  <p className="text-[11px] text-blue-400 mt-0.5">Correct / Total</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium">Mean Latency</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{sessionMetrics.meanLat}ms</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">SD: ±{sessionMetrics.sdLat}ms</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-purple-700 font-medium">Completed Runs</p>
                  <p className="text-2xl font-bold text-purple-800 mt-1">{sessionMetrics.totalRuns}</p>
                  <p className="text-[11px] text-purple-400 mt-0.5">Conf. SD: ±{sessionMetrics.sdConf}</p>
                </CardContent>
              </Card>
            </div>

            {/* Latency line chart */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Latency Trend Across Runs
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Dashed line = mean latency. Stable models have low variance around the mean.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={sessionMetrics.latencyChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="run" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}ms`} />
                    <RechartsTooltip formatter={(v: number) => [`${v}ms`]} contentStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={sessionMetrics.meanLat} stroke="#10b981" strokeDasharray="4 4" label={{ value: `μ=${sessionMetrics.meanLat}ms`, fill: "#10b981", fontSize: 10 }} />
                    <Line type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: "#6366f1" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Setup (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Setup Stability Trial</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Executes N identical requests sequentially to measure variance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Query Image</Label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-3 text-center cursor-pointer bg-slate-50">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="exp5-file" />
                    <label htmlFor="exp5-file" className="cursor-pointer block">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-36 mx-auto rounded-lg object-cover" />
                      ) : (
                        <div className="py-4 space-y-1">
                          <Upload className="w-6 h-6 mx-auto text-emerald-500" />
                          <p className="text-xs text-slate-600 font-medium">Click to upload image</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Ground Truth */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Ground Truth Location</Label>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Marina Bay Sands"
                    className="bg-white text-xs border-slate-200"
                  />
                </div>

                {/* Target Model Selector with Logos */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Target Model to Test</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {AI_MODEL_OPTIONS.map((opt) => {
                      const isSelected = selectedModel === opt.value;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => !isRunning && setSelectedModel(opt.value)}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-emerald-50/50 border-emerald-300 shadow-2xs"
                              : "bg-white border-slate-200/80 hover:bg-slate-100/60 hover:border-slate-300"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
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

                {/* Repetitions Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold text-slate-700">Number of Repetitions (N)</Label>
                    <span className="text-xs font-bold text-emerald-600">{numRuns} Runs</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={numRuns}
                    onChange={(e) => setNumRuns(Number(e.target.value))}
                    className="w-full cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>3 (min)</span>
                    <span>10 (max)</span>
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runConsistencyTest}
                  disabled={isRunning}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRunning ? "animate-spin" : ""}`} />
                  {isRunning ? progressLabel : `Run Consistency Trial (${numRuns} Repetitions)`}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Current trial breakdown */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Trial Runs Breakdown</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Predictions and latencies recorded for each run.
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <Button onClick={commitResults} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    <Save className="w-3.5 h-3.5 mr-1" /> Save Session to CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {currentResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">Run trial to measure N-run consistency.</p>
                ) : (
                  <>
                    {/* Live grading summary bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-3 bg-gradient-to-r from-emerald-50 via-slate-50 to-blue-50 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
                          <TableHead className="text-xs">Run #</TableHead>
                          <TableHead className="text-xs">Prediction</TableHead>
                          <TableHead className="text-xs">Confidence</TableHead>
                          <TableHead className="text-xs">Latency</TableHead>
                          <TableHead className="text-xs text-center">Evaluation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => (
                          <TableRow key={r.run_number} className={r.is_correct ? "bg-emerald-50/30 transition-colors" : "transition-colors"}>
                            <TableCell className="text-xs font-bold text-slate-800">Run #{r.run_number}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">{r.predicted}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-600">{r.confidence.toFixed(3)}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-600">{r.time_ms}ms</TableCell>
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

            {/* Historical session log */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Session History (exp5_consistency.csv)</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Showing last 10 sessions with agreement rate per session
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!historicalAnalytics || historicalAnalytics.sessionBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved.</p>
                ) : (
                  <>
                    {/* Session summary table */}
                    <Table className="mb-4">
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-[11px]">Session</TableHead>
                          <TableHead className="text-[11px]">Model</TableHead>
                          <TableHead className="text-[11px]">Ground Truth</TableHead>
                          <TableHead className="text-[11px]">Runs</TableHead>
                          <TableHead className="text-[11px]">Accuracy</TableHead>
                          <TableHead className="text-[11px]">Agreement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicalAnalytics.sessionBreakdown.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[11px] font-mono text-slate-500">{row.session}</TableCell>
                            <TableCell className="text-[11px] text-slate-800">{row.model}</TableCell>
                            <TableCell className="text-[11px] font-medium text-slate-700 max-w-[100px] truncate">{row.groundTruth}</TableCell>
                            <TableCell className="text-[11px] text-slate-500">{row.total}</TableCell>
                            <TableCell className="text-[11px] font-bold text-blue-700">{row.acc}%</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  row.agreementRate >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                    : row.agreementRate >= 60
                                    ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                                    : "bg-red-50 text-red-600 border-red-200 text-[10px]"
                                }
                              >
                                {row.agreementRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Raw log */}
                    <details className="text-xs">
                      <summary className="text-slate-500 cursor-pointer font-medium py-1">Show raw run logs ({dbLogs.length} rows)</summary>
                      <div className="max-h-48 overflow-y-auto mt-2">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-[11px]">Session</TableHead>
                              <TableHead className="text-[11px]">Model</TableHead>
                              <TableHead className="text-[11px]">GT</TableHead>
                              <TableHead className="text-[11px]">Run #</TableHead>
                              <TableHead className="text-[11px]">Result</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dbLogs.slice(-30).map((row, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-[11px] font-mono text-slate-500">{row.session_id}</TableCell>
                                <TableCell className="text-[11px] text-slate-800">{row.model}</TableCell>
                                <TableCell className="text-[11px] font-medium text-slate-700">{row.ground_truth}</TableCell>
                                <TableCell className="text-[11px] text-slate-500">#{row.run_number}</TableCell>
                                <TableCell className="text-[11px]">
                                  <Badge variant="outline" className={isTruthy(row.is_correct) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                                    {row.predicted}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ExperimentLayout>
  );
}
