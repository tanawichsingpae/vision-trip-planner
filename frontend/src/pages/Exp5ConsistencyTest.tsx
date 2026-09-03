import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ExperimentLayout } from "./ExperimentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImage, type VisionResult } from "@/services/aiService";
import { evaluatePredictionWithAliases } from "@/utils/evaluationMetrics";
import {
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Save,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Activity,
  FileCode2,
  Check,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
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
  matched_alias?: string | null;
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
  const [copiedLatex, setCopiedLatex] = useState(false);

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

      // Automated multi-alias evaluation
      const match = evaluatePredictionWithAliases(pred, groundTruth, res.similar_locations || [], 0.70);

      temp.push({
        run_number: i,
        total_runs: numRuns,
        model: selectedModel,
        modelLabel,
        predicted: pred,
        confidence: res.confidence || 0.0,
        time_ms: duration,
        is_correct: match.isCorrect,
        matched_alias: match.matchedAlias,
      });

      setCurrentResults([...temp]);
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success(`Completed ${numRuns} repetition runs! Graded with aliases.`);
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
        toast.success(`Session (${sessionId}) committed!`);
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp5 results.");
    }
  };

  // Current session metrics
  const sessionMetrics = useMemo(() => {
    if (currentResults.length === 0) return null;
    const N = currentResults.length;

    const counts: Record<string, number> = {};
    currentResults.forEach((r) => {
      counts[r.predicted] = (counts[r.predicted] || 0) + 1;
    });
    let modePred = "";
    let maxCount = 0;
    Object.entries(counts).forEach(([pred, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        modePred = pred;
      }
    });

    const agreementRate = ((maxCount / N) * 100).toFixed(1);
    const accuracyRate = ((currentResults.filter((r) => r.is_correct).length / N) * 100).toFixed(1);

    const latencies = currentResults.map((r) => r.time_ms);
    const meanLat = latencies.reduce((a, b) => a + b, 0) / N;
    const varLat = latencies.reduce((a, b) => a + Math.pow(b - meanLat, 2), 0) / N;
    const sdLat = Math.round(Math.sqrt(varLat));

    // Latency timeline data
    const latencyChartData = currentResults.map((r) => ({
      run: `Run #${r.run_number}`,
      latency: r.time_ms,
      mean: Math.round(meanLat),
      predicted: r.predicted,
      is_correct: r.is_correct,
    }));

    const distributionData = [
      { name: "Exact Consensus", value: maxCount, color: "#e11d48" },
      ...(N - maxCount > 0 ? [{ name: "Response Variance", value: N - maxCount, color: "#94a3b8" }] : []),
    ];

    return {
      totalRuns: N,
      modePred,
      consensusCount: maxCount,
      agreementRate,
      accuracyRate,
      meanLat: Math.round(meanLat),
      sdLat,
      latencyChartData,
      distributionData,
    };
  }, [currentResults]);

  // Historical analytics
  const historicalAnalytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    const modelStats: Record<string, { total: number; correct: number; times: number[] }> = {};
    dbLogs.forEach((row) => {
      const model = row.model;
      if (!modelStats[model]) modelStats[model] = { total: 0, correct: 0, times: [] };
      modelStats[model].total += 1;
      if (isTruthy(row.is_correct)) modelStats[model].correct += 1;
      if (row.time_ms) modelStats[model].times.push(Number(row.time_ms));
    });

    const breakdown = Object.entries(modelStats).map(([model, d]) => {
      const opt = AI_MODEL_OPTIONS.find((o) => o.value === model);
      const acc = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      const mean = d.times.length > 0 ? Math.round(d.times.reduce((a, b) => a + b, 0) / d.times.length) : 0;
      const variance = d.times.length > 0 ? d.times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / d.times.length : 0;
      const sd = Math.round(Math.sqrt(variance));

      return {
        model,
        modelLabel: opt ? opt.label : model,
        total: d.total,
        accuracy: acc,
        meanLatency: mean,
        sdLatency: sd,
      };
    });

    return {
      breakdown,
      totalRecords: dbLogs.length,
    };
  }, [dbLogs]);

  const copyConsistencyLatex = () => {
    if (!historicalAnalytics) return;
    const rows = historicalAnalytics.breakdown.map((m) => {
      return `    ${m.modelLabel} & ${m.total} & ${m.accuracy}\\% & ${m.meanLatency} \\pm ${m.sdLatency} \\\\`;
    }).join("\n");

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Model Operational Stability & Latency Jitter Evaluation}
  \\label{tab:model_consistency}
  \\begin{tabular}{l r r r}
    \\toprule
    \\textbf{Model} & \\textbf{N (Runs)} & \\textbf{Accuracy (\\%)} & \\textbf{Latency (Mean $\\pm$ SD ms)} \\\\
    \\midrule
${rows}
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    toast.success("Consistency LaTeX Table copied!");
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Experiment 5: Model Consistency & Operational Stability
              </h2>
              <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold">
                Thesis Chap. 4.5
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quantify multi-run determinism, response stability index (agreement rate), and latency jitter variance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyConsistencyLatex}
              disabled={!historicalAnalytics}
              className="text-xs bg-white text-rose-700 border-rose-200 hover:bg-rose-50 shadow-2xs h-8"
            >
              {copiedLatex ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <FileCode2 className="w-3.5 h-3.5 mr-1 text-rose-600" />}
              {copiedLatex ? "Copied LaTeX" : "Export Stability LaTeX"}
            </Button>
          </div>
        </div>

        {/* Live Trial Session Summary Cards */}
        {sessionMetrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Card 1: Stability Index */}
              <Card className="bg-gradient-to-br from-rose-50/80 to-white border-rose-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                      Stability Index (Agreement)
                    </span>
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-rose-900 mt-2">
                    {sessionMetrics.agreementRate}%
                  </p>
                  <p className="text-[10px] text-rose-600 mt-0.5">
                    {sessionMetrics.consensusCount} of {sessionMetrics.totalRuns} runs gave identical output
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Consensus Prediction */}
              <Card className="bg-white border-slate-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Consensus Output
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-2 truncate" title={sessionMetrics.modePred}>
                    {sessionMetrics.modePred}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Accuracy: <strong>{sessionMetrics.accuracyRate}%</strong> across runs
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Latency & Jitter */}
              <Card className="bg-white border-slate-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Mean Latency & Jitter
                    </span>
                    <Activity className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
                    {sessionMetrics.meanLat} <span className="text-xs text-slate-400 font-normal">± {sessionMetrics.sdLat} ms</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Jitter SD ($\sigma$): {sessionMetrics.sdLat} ms
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Evaluation Runs */}
              <Card className="bg-white border-slate-200/90 shadow-xs text-left">
                <CardContent className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Repetition Sample
                  </span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                    {sessionMetrics.totalRuns} Runs
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Deterministic testing
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Jitter & Response Consensus Distribution (2-Column Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Latency Jitter Timeline (7 cols) */}
              <Card className="lg:col-span-7 bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-600" />
                      Latency Jitter Timeline ($\mu \pm \sigma$)
                    </CardTitle>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-mono">
                      Mean: {sessionMetrics.meanLat}ms (±{sessionMetrics.sdLat}ms)
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Execution time variance across sequence. Shaded reference indicates standard deviation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sessionMetrics.latencyChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="run" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="ms" />
                        <RechartsTooltip
                          formatter={(v: any) => [`${v} ms`, "Latency"]}
                          contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px" }}
                        />
                        <ReferenceLine y={sessionMetrics.meanLat} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Mean: ${sessionMetrics.meanLat}ms`, fill: "#64748b", fontSize: 10 }} />
                        <ReferenceLine y={sessionMetrics.meanLat + sessionMetrics.sdLat} stroke="#fca5a5" strokeDasharray="2 2" />
                        <ReferenceLine y={Math.max(0, sessionMetrics.meanLat - sessionMetrics.sdLat)} stroke="#fca5a5" strokeDasharray="2 2" />
                        <Line type="monotone" dataKey="latency" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 4, fill: "#e11d48" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Response Consistency Donut Chart (5 cols) */}
              <Card className="lg:col-span-5 bg-white border-slate-200 shadow-sm text-left flex flex-col justify-between">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    Response Agreement Distribution
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Degree of output determinism across all repetition trials.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2 pb-4 flex flex-col items-center">
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sessionMetrics.distributionData}
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {sessionMetrics.distributionData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "0px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center mt-1">
                    <span className="text-xs font-bold text-slate-800">
                      {sessionMetrics.agreementRate}% Modal Agreement
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {sessionMetrics.consensusCount} matching predictions out of {sessionMetrics.totalRuns} runs
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Main 2-Column Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: SETUP (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-rose-600" />
                  1. Setup Repetition Experiment
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Run place recognition repeatedly on the same photo to verify response determinism.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-5">
                {/* Upload Image */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Query Image</Label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50/50">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="exp5-file" disabled={isRunning} />
                    <label htmlFor="exp5-file" className="cursor-pointer block">
                      {imagePreview ? (
                        <div className="relative group">
                          <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-cover shadow-xs" />
                          <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-[11px] bg-white text-slate-700 px-2.5 py-1 rounded-full shadow-md font-medium">
                              Change Image
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-5 space-y-1.5">
                          <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                            <Upload className="w-4 h-4" />
                          </div>
                          <p className="text-xs font-bold text-slate-800">Upload Query Photo</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Ground Truth */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Ground Truth (Multi-Alias)</Label>
                  <Input
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Wat Arun | วัดอรุณ"
                    className="bg-white text-xs border-slate-200 text-slate-900"
                    disabled={isRunning}
                  />
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Evaluation Model</Label>
                  <Select
                    value={selectedModel}
                    onValueChange={(v) => setSelectedModel(v as AIModelType)}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="bg-white text-xs border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODEL_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Number of Runs */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Number of Repetitions (N)</Label>
                    <span className="text-xs font-mono font-bold text-rose-600">{numRuns} Runs</span>
                  </div>
                  <div className="flex gap-2">
                    {[3, 5, 10, 20].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant={numRuns === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNumRuns(n)}
                        className={`flex-1 text-xs h-8 ${numRuns === n ? "bg-rose-600 text-white" : "bg-white text-slate-700"}`}
                        disabled={isRunning}
                      >
                        {n}x
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runConsistencyTest}
                  disabled={isRunning || !imageFile || !groundTruth.trim()}
                  className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-semibold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunning ? progressLabel : `Execute ${numRuns} Repetitions Stability Test`}</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: LIVE RUNS TABLE (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-rose-600" />
                    Repetition Sequence Outputs
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Predictions across N identical requests to detect variance and hallucination.
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <Button
                    onClick={commitResults}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Commit Session
                  </Button>
                )}
              </CardHeader>

              <CardContent className="pt-6">
                {currentResults.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                    <p className="text-xs font-semibold text-slate-600">No repetition trials yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Upload a photo and click Execute Stability Test.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2.5">Run #</TableHead>
                          <TableHead className="py-2.5">Prediction</TableHead>
                          <TableHead className="py-2.5 text-center">Latency</TableHead>
                          <TableHead className="py-2.5 text-center">Verification</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => (
                          <TableRow key={idx} className="border-b border-slate-100 text-xs">
                            <TableCell className="font-mono font-bold text-slate-600 py-2.5">
                              #{r.run_number}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="font-semibold text-slate-900 block truncate max-w-[150px]">{r.predicted}</span>
                              {r.matched_alias && (
                                <span className="text-[10px] text-emerald-600 block">Matched: "{r.matched_alias}"</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-[11px] text-slate-600 py-2.5">
                              {r.time_ms} ms
                            </TableCell>
                            <TableCell className="text-center py-2.5">
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

            {/* Historical Table */}
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Historical Consistency Sessions ({dbLogs.length} entries)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-60 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved yet.</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-200 text-xs">
                        <TableHead className="py-2">Session</TableHead>
                        <TableHead className="py-2">Model</TableHead>
                        <TableHead className="py-2">Prediction</TableHead>
                        <TableHead className="py-2 text-right">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => (
                        <TableRow key={i} className="border-b border-slate-100 text-xs">
                          <TableCell className="py-2 font-mono text-[10px] text-slate-500">{row.session_id}</TableCell>
                          <TableCell className="py-2 font-medium text-slate-800">{row.model}</TableCell>
                          <TableCell className="py-2 text-slate-700 truncate max-w-[130px]">{row.predicted}</TableCell>
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
