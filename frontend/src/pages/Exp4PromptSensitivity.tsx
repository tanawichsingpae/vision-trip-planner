import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ExperimentLayout } from "./ExperimentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType, MODEL_ID_MAP } from "@/context/AIProviderContext";
import { safeFetch } from "@/utils/apiUtils";
import { Upload, Sliders, Save, Eye, Trophy, BarChart3, XCircle, CheckCircle2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

interface PromptVariant {
  id: string;
  name: string;
  description: string;
  promptText: (gt: string) => string;
}

const PROMPT_VARIANTS: PromptVariant[] = [
  {
    id: "P1",
    name: "P1: Direct Concise (EN)",
    description: "Short direct request asking strictly for the place name.",
    promptText: () =>
      `What specific landmark, city, or place is in this image? Return strictly valid JSON format: {"place": "Name", "country": "Country", "ai_reasoning": ["feature"]}.`,
  },
  {
    id: "P2",
    name: "P2: Structured 5-Candidates",
    description: "Standard pipeline prompt asking LLM to list 5 candidates first.",
    promptText: () =>
      `Analyze this image and provide a list of 5 specific potential landmark or city matches. Include the most likely one first. Return strictly valid JSON format: {"places": ["place1","place2","place3","place4","place5"]}.`,
  },
  {
    id: "P3",
    name: "P3: Chain-of-Thought (CoT)",
    description: "Asks model to reason step-by-step through visual clues.",
    promptText: () =>
      `Analyze this image step-by-step: 1. Identify architectural style, landscape, or signage. 2. Compare with known global landmarks. 3. Conclude the place. Return strictly valid JSON format: {"place": "Name", "country": "Country", "ai_reasoning": ["step 1 visual detail", "step 2 comparison", "conclusion"]}.`,
  },
  {
    id: "P4",
    name: "P4: Thai Language Prompt",
    description: "Prompt written in Thai language.",
    promptText: () =>
      `โปรดวิเคราะห์รูปภาพนี้แล้วระบุชื่อสถานที่ท่องเที่ยวหรือเมืองสำคัญ คืนค่าเป็น JSON รูปแบบนี้เท่านั้น: {"place": "ชื่อสถานที่", "country": "ประเทศ", "ai_reasoning": ["เหตุผล"]}`,
  },
  {
    id: "P5",
    name: "P5: Few-Shot Examples",
    description: "Provides 2 in-context examples of correct identification.",
    promptText: () =>
      `Here are examples:\nInput: [Image of iron lattice tower in Paris] -> Output: {"place": "Eiffel Tower", "country": "France"}\nInput: [Image of white marble mausoleum in Agra] -> Output: {"place": "Taj Mahal", "country": "India"}\n\nNow analyze the provided image and return strictly valid JSON: {"place": "Name", "country": "Country", "ai_reasoning": ["reason"]}.`,
  },
];

const VARIANT_COLORS: Record<string, string> = {
  P1: "#6366f1",
  P2: "#3b82f6",
  P3: "#8b5cf6",
  P4: "#f59e0b",
  P5: "#10b981",
};

interface Exp4Result {
  variant_id: string;
  variant_name: string;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
  reasoning: string;
}

interface Exp4History {
  timestamp: string;
  image_name: string;
  ground_truth: string;
  model: string;
  variant_id: string;
  variant_name: string;
  predicted: string;
  confidence: number | string;
  time_ms: number | string;
  is_correct: string | boolean;
  reasoning: string;
}

function isTruthy(v: string | boolean | undefined): boolean {
  return v === true || v === "true" || v === "True" || v === "1";
}

export default function Exp4PromptSensitivity() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<AIModelType>("google-gemini-25-flash");
  const [selectedVariants, setSelectedVariants] = useState<string[]>(["P1", "P2", "P3", "P4", "P5"]);

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [currentResults, setCurrentResults] = useState<Exp4Result[]>([]);
  const [dbLogs, setDbLogs] = useState<Exp4History[]>([]);
  const [activeReasoning, setActiveReasoning] = useState<{ name: string; text: string } | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results_exp4`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((row: any) => ({
          timestamp: row["Timestamp"] || row.timestamp || "",
          image_name: row["Image Name"] || row.image_name || "",
          ground_truth: row["Ground Truth"] || row.ground_truth || "",
          model: row["Model"] || row.model || "",
          variant_id: row["Prompt Variant ID"] || row.variant_id || "",
          variant_name: row["Prompt Variant Name"] || row.variant_name || "",
          predicted: row["Predicted Place"] || row.predicted || "",
          confidence: row["Confidence"] !== undefined ? row["Confidence"] : row.confidence,
          time_ms: row["Time MS"] !== undefined ? row["Time MS"] : row.time_ms,
          is_correct: row["Is Correct"] !== undefined ? row["Is Correct"] : row.is_correct,
          reasoning: row["AI Reasoning"] || row.reasoning || "",
        }));
        setDbLogs(mapped);
      }
    } catch (e) {
      console.error("Failed to load Exp4 history:", e);
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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const runPromptSensitivityTest = async () => {
    if (!imageFile || !groundTruth.trim()) {
      toast.error("Please upload an image and specify Ground Truth.");
      return;
    }
    if (selectedVariants.length === 0) {
      toast.error("Select at least one Prompt Variant.");
      return;
    }

    setIsRunning(true);
    setCurrentResults([]);
    const temp: Exp4Result[] = [];

    const base64Image = await fileToBase64(imageFile);
    const base64Data = base64Image.split(",")[1];
    const modelId = MODEL_ID_MAP[selectedModel];
    const modelOpt = AI_MODEL_OPTIONS.find((m) => m.value === selectedModel);
    const modelLabel = modelOpt ? modelOpt.label : selectedModel;

    for (const vId of selectedVariants) {
      const vObj = PROMPT_VARIANTS.find((v) => v.id === vId)!;
      setProgressLabel(`Running [${vObj.name}]...`);

      const promptText = vObj.promptText(groundTruth);
      const start = performance.now();

      let pred = "Unknown";
      let reasoningText = "";

      try {
        const data = await safeFetch<any>(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image_url", image_url: { url: `data:${imageFile.type};base64,${base64Data}` } },
                ],
              },
            ],
            expect_json: true,
          }),
        });

        const raw = data.text?.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim() || "";
        const parsed = JSON.parse(raw);

        if (parsed.place) {
          pred = parsed.place;
        } else if (Array.isArray(parsed.places) && parsed.places.length > 0) {
          pred = parsed.places[0];
        }

        if (parsed.ai_reasoning) {
          reasoningText = Array.isArray(parsed.ai_reasoning) ? parsed.ai_reasoning.join("; ") : String(parsed.ai_reasoning);
        } else {
          reasoningText = raw;
        }
      } catch (err) {
        console.error(`Exp4 error for ${vObj.name}:`, err);
      }

      const duration = Math.round(performance.now() - start);

      temp.push({
        variant_id: vObj.id,
        variant_name: vObj.name,
        model: selectedModel,
        modelLabel,
        predicted: pred,
        confidence: 0,
        time_ms: duration,
        is_correct: false, // default pending — user grades manually
        reasoning: reasoningText,
      });

      setCurrentResults([...temp]);
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success("Prompt Sensitivity Test Complete! Please grade each prediction below.");
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
      image_name: imageFile?.name || "image.jpg",
      ground_truth: groundTruth,
      results: currentResults.map((r) => ({
        model: r.model,
        variant_id: r.variant_id,
        variant_name: r.variant_name,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
        reasoning: r.reasoning,
      })),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save_exp4`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Exp4 results saved to CSV!");
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp4 results.");
    }
  };

  // ── Analytics from historical data ──
  const analytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    // Accuracy per variant
    const variantStats: Record<string, { total: number; correct: number; totalMs: number }> = {};
    dbLogs.forEach((row) => {
      const vId = row.variant_id || "Unknown";
      if (!variantStats[vId]) variantStats[vId] = { total: 0, correct: 0, totalMs: 0 };
      variantStats[vId].total += 1;
      if (isTruthy(row.is_correct)) variantStats[vId].correct += 1;
      variantStats[vId].totalMs += Number(row.time_ms || 0);
    });

    const variantBreakdown = Object.entries(variantStats)
      .map(([vId, d]) => {
        const varObj = PROMPT_VARIANTS.find((v) => v.id === vId);
        return {
          id: vId,
          name: varObj?.name || vId,
          shortName: vId,
          accuracy: Math.round((d.correct / d.total) * 100),
          correct: d.correct,
          total: d.total,
          avgMs: Math.round(d.totalMs / d.total),
          color: VARIANT_COLORS[vId] || "#64748b",
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy);

    const bestVariant = variantBreakdown[0];
    const worstVariant = variantBreakdown[variantBreakdown.length - 1];

    // Radar data (all 5 variants, fill missing with 0)
    const radarData = PROMPT_VARIANTS.map((v) => {
      const found = variantBreakdown.find((x) => x.id === v.id);
      return {
        variant: v.id,
        accuracy: found?.accuracy || 0,
      };
    });

    // Per-model accuracy breakdown
    const modelStats: Record<string, { total: number; correct: number }> = {};
    dbLogs.forEach((row) => {
      if (!modelStats[row.model]) modelStats[row.model] = { total: 0, correct: 0 };
      modelStats[row.model].total += 1;
      if (isTruthy(row.is_correct)) modelStats[row.model].correct += 1;
    });

    return { variantBreakdown, bestVariant, worstVariant, radarData, modelStats, total: dbLogs.length };
  }, [dbLogs]);

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        {/* ── Title ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Experiment 4: Prompt Engineering Sensitivity</h2>
            <p className="text-xs text-slate-500">
              Analyze how prompt formulation (Direct vs Structured vs Chain-of-Thought vs Thai vs Few-Shot) impacts accuracy.
            </p>
          </div>
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 px-3 py-1 font-medium">
            <Sliders className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Prompt Variant Analysis
          </Badge>
        </div>

        {/* ── Analytics Dashboard ── */}
        {analytics && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium">Total Trials</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{analytics.total}</p>
                </CardContent>
              </Card>
              {analytics.bestVariant && (
                <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                      <p className="text-xs text-emerald-700 font-semibold">Best Variant</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-800">{analytics.bestVariant.shortName}</p>
                    <p className="text-xs text-emerald-600">{analytics.bestVariant.accuracy}% accuracy</p>
                    <p className="text-[11px] text-emerald-400 truncate">{analytics.bestVariant.name.split(":")[1]?.trim()}</p>
                  </CardContent>
                </Card>
              )}
              {analytics.worstVariant && analytics.variantBreakdown.length > 1 && (
                <Card className="bg-rose-50 border-rose-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <p className="text-xs text-rose-700 font-semibold">Worst Variant</p>
                    </div>
                    <p className="text-lg font-bold text-rose-800">{analytics.worstVariant.shortName}</p>
                    <p className="text-xs text-rose-600">{analytics.worstVariant.accuracy}% accuracy</p>
                    <p className="text-[11px] text-rose-400 truncate">{analytics.worstVariant.name.split(":")[1]?.trim()}</p>
                  </CardContent>
                </Card>
              )}
              <Card className="bg-purple-50 border-purple-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-purple-700 font-medium">Acc Range</p>
                  <p className="text-xl font-bold text-purple-800 mt-1">
                    {analytics.bestVariant?.accuracy ?? 0}% – {analytics.worstVariant?.accuracy ?? 0}%
                  </p>
                  <p className="text-[11px] text-purple-400 mt-0.5">
                    Spread: {(analytics.bestVariant?.accuracy ?? 0) - (analytics.worstVariant?.accuracy ?? 0)}pp
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart: variant accuracy ranking */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                    Accuracy Ranking per Prompt Variant
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Ranked from highest to lowest from historical trials.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.variantBreakdown} layout="vertical" margin={{ top: 4, right: 32, left: 40, bottom: 4 }}>
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="shortName" tick={{ fontSize: 11, fontWeight: 600 }} width={36} />
                      <RechartsTooltip
                        formatter={(v: number, _name: string, props: any) => [`${v}% (${props.payload.correct}/${props.payload.total})`, "Accuracy"]}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                        {analytics.variantBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Ranking table */}
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-[11px]">Rank</TableHead>
                        <TableHead className="text-[11px]">Variant</TableHead>
                        <TableHead className="text-[11px]">Accuracy</TableHead>
                        <TableHead className="text-[11px]">Avg Latency</TableHead>
                        <TableHead className="text-[11px]">Trials</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.variantBreakdown.map((row, i) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-[11px] font-bold text-slate-600">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                              <span className="text-[11px] font-semibold text-slate-800">{row.id}</span>
                              {i === 0 && <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-0 px-1">Best</Badge>}
                            </div>
                            <p className="text-[10px] text-slate-400 pl-3.5">{row.name.split(":")[1]?.trim()}</p>
                          </TableCell>
                          <TableCell className="text-[11px] font-bold" style={{ color: row.color }}>{row.accuracy}%</TableCell>
                          <TableCell className="text-[11px] font-mono text-slate-500">{row.avgMs}ms</TableCell>
                          <TableCell className="text-[11px] text-slate-500">{row.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Radar chart */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">Prompt Variant Radar View</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Radial accuracy profile across all 5 prompt formulations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={analytics.radarData} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="variant" tick={{ fontSize: 11, fontWeight: 600 }} />
                      <Radar
                        name="Accuracy"
                        dataKey="accuracy"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                      <RechartsTooltip formatter={(v: number) => [`${v}%`, "Accuracy"]} contentStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <p className="text-center text-[11px] text-slate-400 mt-1">
                    A symmetric shape indicates consistent performance across all prompt styles.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ── Main Setup Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Setup (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">Setup Prompt Sensitivity</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Directly injects different prompt formulations to compare output quality.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Query Image</Label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl p-3 text-center cursor-pointer bg-slate-50">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="exp4-file" />
                    <label htmlFor="exp4-file" className="cursor-pointer block">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-36 mx-auto rounded-lg object-cover" />
                      ) : (
                        <div className="py-4 space-y-1">
                          <Upload className="w-6 h-6 mx-auto text-purple-500" />
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
                    placeholder="e.g. Kyoto Fushimi Inari"
                    className="bg-white text-xs border-slate-200"
                  />
                </div>

                {/* Single Model Selector with Logos */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Target Model to Test</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {AI_MODEL_OPTIONS.map((opt) => {
                      const isSelected = selectedModel === opt.value;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => !isRunning && setSelectedModel(opt.value)}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-purple-50/50 border-purple-300 shadow-2xs"
                              : "bg-white border-slate-200/80 hover:bg-slate-100/60 hover:border-slate-300"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-purple-600 bg-purple-600" : "border-slate-300 bg-white"
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

                {/* Prompt Variants Checkbox List */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Prompt Variants to Benchmark</Label>
                  <div className="space-y-2 border border-slate-200 rounded-lg p-2.5 bg-slate-50 max-h-64 overflow-y-auto">
                    {PROMPT_VARIANTS.map((v) => (
                      <label key={v.id} className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer p-1.5 hover:bg-slate-100 rounded transition-colors">
                        <Checkbox
                          checked={selectedVariants.includes(v.id)}
                          onCheckedChange={() =>
                            setSelectedVariants((prev) =>
                              prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                            )
                          }
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="w-full space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: VARIANT_COLORS[v.id] }} />
                            <p className="font-semibold text-slate-900">{v.name}</p>
                          </div>
                          <p className="text-[11px] text-slate-500">{v.description}</p>
                          {/* Prompt text snippet display */}
                          <div className="mt-1 p-2 bg-white border border-slate-200 rounded text-[10px] font-mono text-purple-950 whitespace-pre-wrap leading-relaxed">
                            {v.promptText(groundTruth || "[Location]")}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runPromptSensitivityTest}
                  disabled={isRunning}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm"
                >
                  {isRunning ? progressLabel : `Run Prompt Sensitivity Test (${selectedVariants.length} Variants)`}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Current run */}
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Prompt Sensitivity Comparison</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Output predictions and reasoning generated per prompt variant.
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
                  <p className="text-xs text-slate-400 text-center py-12">Run test to compare prompt formulations.</p>
                ) : (
                  <>
                    {/* Live grading summary bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-3 bg-gradient-to-r from-purple-50 via-slate-50 to-emerald-50 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
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
                          <TableHead className="text-xs">Variant</TableHead>
                          <TableHead className="text-xs">Prediction</TableHead>
                          <TableHead className="text-xs">Latency</TableHead>
                          <TableHead className="text-xs text-center">Evaluation</TableHead>
                          <TableHead className="text-xs text-right">Reasoning</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => (
                          <TableRow key={idx} className={r.is_correct ? "bg-emerald-50/30 transition-colors" : "transition-colors"}>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: VARIANT_COLORS[r.variant_id] }} />
                                <span className="font-semibold" style={{ color: VARIANT_COLORS[r.variant_id] }}>{r.variant_id}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">{r.predicted}</TableCell>
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
                            <TableCell className="text-xs text-right">
                              <Button
                                onClick={() => setActiveReasoning({ name: r.variant_name, text: r.reasoning })}
                                variant="ghost"
                                size="sm"
                                className="text-xs text-blue-600 hover:bg-blue-50 h-7"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
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
                <CardTitle className="text-base font-semibold text-slate-900">Exp4 History (exp4_prompt_sensitivity.csv)</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Timestamp</TableHead>
                        <TableHead className="text-xs">Variant</TableHead>
                        <TableHead className="text-xs">Ground Truth</TableHead>
                        <TableHead className="text-xs">Prediction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[11px] text-slate-500">{row.timestamp}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: VARIANT_COLORS[row.variant_id] || "#64748b" }}
                              />
                              <span className="font-semibold" style={{ color: VARIANT_COLORS[row.variant_id] || "#64748b" }}>
                                {row.variant_name || row.variant_id}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">{row.ground_truth}</TableCell>
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

        {/* Reasoning Dialog */}
        <Dialog open={!!activeReasoning} onOpenChange={() => setActiveReasoning(null)}>
          <DialogContent className="bg-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">{activeReasoning?.name}</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">AI Reasoning output text</DialogDescription>
            </DialogHeader>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 max-h-60 overflow-y-auto whitespace-pre-wrap">
              {activeReasoning?.text || "No reasoning text available."}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ExperimentLayout>
  );
}
