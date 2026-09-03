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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AI_MODEL_OPTIONS, AIModelType, MODEL_ID_MAP } from "@/context/AIProviderContext";
import { safeFetch } from "@/utils/apiUtils";
import { evaluatePredictionWithAliases } from "@/utils/evaluationMetrics";
import {
  Upload,
  Sliders,
  Save,
  Eye,
  Trophy,
  BarChart3,
  XCircle,
  CheckCircle2,
  FileCode2,
  Check,
  Play,
  Sparkles,
  MessageSquare,
  BookOpen,
} from "lucide-react";
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
  tag: string;
  description: string;
  promptText: (gt: string) => string;
}

const PROMPT_VARIANTS: PromptVariant[] = [
  {
    id: "P1",
    name: "P1: Direct Concise (EN)",
    tag: "Zero-Shot",
    description: "Short direct query asking strictly for the place name in JSON.",
    promptText: () =>
      `What specific landmark, city, or place is in this image? Return strictly valid JSON format: {"place": "Name", "country": "Country", "ai_reasoning": ["feature"]}.`,
  },
  {
    id: "P2",
    name: "P2: 5-Candidates Ranked",
    tag: "Multi-Candidate",
    description: "Prompts the model to rank 5 potential candidates before deciding.",
    promptText: () =>
      `Analyze this image and provide a list of 5 specific potential landmark or city matches. Include the most likely one first. Return strictly valid JSON format: {"places": ["place1","place2","place3","place4","place5"]}.`,
  },
  {
    id: "P3",
    name: "P3: Chain-of-Thought (CoT)",
    tag: "Reasoning Step",
    description: "Forces visual feature breakdown, comparison, and systematic deduction.",
    promptText: () =>
      `Analyze this image step-by-step: 1. Identify architectural style, landscape, or signage. 2. Compare with known global landmarks. 3. Conclude the place. Return strictly valid JSON format: {"place": "Name", "country": "Country", "ai_reasoning": ["step 1 visual detail", "step 2 comparison", "conclusion"]}.`,
  },
  {
    id: "P4",
    name: "P4: Thai Language Prompt",
    tag: "Multilingual",
    description: "Native Thai prompt to test multilingual visual alignment.",
    promptText: () =>
      `โปรดวิเคราะห์รูปภาพนี้แล้วระบุชื่อสถานที่ท่องเที่ยวหรือเมืองสำคัญ คืนค่าเป็น JSON รูปแบบนี้เท่านั้น: {"place": "ชื่อสถานที่", "country": "ประเทศ", "ai_reasoning": ["เหตุผล"]}`,
  },
  {
    id: "P5",
    name: "P5: Few-Shot In-Context",
    tag: "Few-Shot",
    description: "Provides 2 paired exemplar demonstrations in the prompt context.",
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
  matched_alias?: string | null;
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
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [promptView, setPromptView] = useState<"bar" | "matrix">("bar");

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
      setProgressLabel(`Testing [${vObj.name}]...`);

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
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { place: raw };
        }

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

      // Automated Multi-alias evaluation
      const match = evaluatePredictionWithAliases(pred, groundTruth, [], 0.70);

      temp.push({
        variant_id: vObj.id,
        variant_name: vObj.name,
        model: selectedModel,
        modelLabel,
        predicted: pred,
        confidence: 0,
        time_ms: duration,
        is_correct: match.isCorrect,
        reasoning: reasoningText,
        matched_alias: match.matchedAlias,
      });

      setCurrentResults([...temp]);
    }

    setIsRunning(false);
    setProgressLabel("");
    toast.success("Prompt Sensitivity Test Complete! Predictions graded with aliases.");
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
        variant_id: r.variant_id,
        variant_name: r.variant_name,
        model: r.model,
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
        toast.success("Prompt sensitivity results committed!");
        fetchHistory();
        setCurrentResults([]);
      }
    } catch (e) {
      toast.error("Failed to save Exp4 results.");
    }
  };

  // Analytics Computation
  const analytics = useMemo(() => {
    if (dbLogs.length === 0) return null;

    const variantStats: Record<string, { total: number; correct: number; times: number[] }> = {};
    PROMPT_VARIANTS.forEach((v) => {
      variantStats[v.id] = { total: 0, correct: 0, times: [] };
    });

    dbLogs.forEach((row) => {
      const vId = row.variant_id || "P1";
      if (!variantStats[vId]) variantStats[vId] = { total: 0, correct: 0, times: [] };
      variantStats[vId].total += 1;
      if (isTruthy(row.is_correct)) variantStats[vId].correct += 1;
      if (row.time_ms) variantStats[vId].times.push(Number(row.time_ms));
    });

    const variantBreakdown = PROMPT_VARIANTS.map((v) => {
      const d = variantStats[v.id] || { total: 0, correct: 0, times: [] };
      const accuracy = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      const avgTime = d.times.length > 0 ? Math.round(d.times.reduce((a, b) => a + b, 0) / d.times.length) : 0;
      return {
        id: v.id,
        name: v.name,
        tag: v.tag,
        accuracy,
        avgTime,
        total: d.total,
        color: VARIANT_COLORS[v.id] || "#6366f1",
      };
    });

    const bestVariant = [...variantBreakdown].sort((a, b) => b.accuracy - a.accuracy)[0];

    // Model x Variant Heatmap Matrix
    const modelList = Array.from(new Set(dbLogs.map((r) => r.model)));
    const matrixRows = modelList.map((m) => {
      const opt = AI_MODEL_OPTIONS.find((o) => o.value === m);
      const row: Record<string, any> = {
        model: m,
        modelLabel: opt ? opt.label : m,
      };
      PROMPT_VARIANTS.forEach((v) => {
        const subset = dbLogs.filter((r) => r.model === m && (r.variant_id || "P1") === v.id);
        const correct = subset.filter((r) => isTruthy(r.is_correct)).length;
        row[v.id] = subset.length > 0 ? Math.round((correct / subset.length) * 100) : null;
        row[`${v.id}_count`] = subset.length;
      });
      return row;
    });

    return {
      variantBreakdown,
      bestVariant,
      matrixRows,
      total: dbLogs.length,
    };
  }, [dbLogs]);

  const copyPromptLatex = () => {
    if (!analytics) return;
    const rows = analytics.variantBreakdown.map((v) => {
      return `    ${v.name} & ${v.tag} & ${v.total} & ${v.accuracy}\\% & ${v.avgTime} \\\\`;
    }).join("\n");

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Prompt Sensitivity Analysis: Comparison of Prompt Formulation Strategies}
  \\label{tab:prompt_sensitivity}
  \\begin{tabular}{l l r r r}
    \\toprule
    \\textbf{Prompt Strategy} & \\textbf{Paradigm} & \\textbf{N} & \\textbf{Accuracy (\\%)} & \\textbf{Avg Latency (ms)} \\\\
    \\midrule
${rows}
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    toast.success("Prompt Sensitivity LaTeX Table copied!");
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
                Experiment 4: Prompt Engineering & Sensitivity Analysis
              </h2>
              <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold">
                Thesis Chap. 4.4
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluate how Prompt Formulations (Direct, Chain-of-Thought, Thai, Few-Shot) alter recognition accuracy and latency.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyPromptLatex}
              disabled={!analytics}
              className="text-xs bg-white text-purple-700 border-purple-200 hover:bg-purple-50 shadow-2xs h-8"
            >
              {copiedLatex ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <FileCode2 className="w-3.5 h-3.5 mr-1 text-purple-600" />}
              {copiedLatex ? "Copied LaTeX" : "Export Prompt LaTeX"}
            </Button>
          </div>
        </div>

        {/* Top Hero KPI Dashboard */}
        {analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {analytics.variantBreakdown.map((v) => (
                <Card key={v.id} className="bg-white border-slate-200/90 shadow-xs text-left">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{v.id} Strategy</span>
                      <Badge className="text-[9px] font-mono px-1.5 py-0" style={{ backgroundColor: `${v.color}15`, color: v.color, borderColor: `${v.color}30` }}>
                        {v.tag}
                      </Badge>
                    </div>
                    <p className="text-2xl font-extrabold mt-2" style={{ color: v.color }}>
                      {v.accuracy}%
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Avg: {v.avgTime} ms ({v.total} tests)
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Winner Banner & Bar Chart / Matrix Switcher */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Variant Comparison Bar Chart / Matrix (8 cols) */}
              <Card className="lg:col-span-8 bg-white border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-600" />
                      {promptView === "bar" ? "Accuracy by Prompt Formulation" : "Model × Prompt Strategy Matrix Heatmap"}
                    </CardTitle>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <Button
                        variant={promptView === "bar" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPromptView("bar")}
                        className={`text-[10px] h-6 px-2 rounded-lg font-semibold ${
                          promptView === "bar" ? "bg-white text-purple-700 shadow-xs hover:bg-white" : "text-slate-600"
                        }`}
                      >
                        Bar Chart
                      </Button>
                      <Button
                        variant={promptView === "matrix" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPromptView("matrix")}
                        className={`text-[10px] h-6 px-2 rounded-lg font-semibold ${
                          promptView === "matrix" ? "bg-white text-purple-700 shadow-xs hover:bg-white" : "text-slate-600"
                        }`}
                      >
                        Model Matrix
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {promptView === "bar" ? (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.variantBreakdown} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-10} textAnchor="end" interval={0} />
                          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
                          <RechartsTooltip
                            formatter={(v: any) => [`${v}%`, "Accuracy"]}
                            contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px" }}
                          />
                          <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                            {analytics.variantBreakdown.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-b border-slate-200 text-xs">
                            <TableHead className="py-2">Model</TableHead>
                            {PROMPT_VARIANTS.map((v) => (
                              <TableHead key={v.id} className="py-2 text-center" style={{ color: VARIANT_COLORS[v.id] }}>
                                {v.id} ({v.tag})
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.matrixRows.map((row) => (
                            <TableRow key={row.model} className="border-b border-slate-100 text-xs">
                              <TableCell className="font-semibold text-slate-800 py-2">{row.modelLabel}</TableCell>
                              {PROMPT_VARIANTS.map((v) => {
                                const val = row[v.id];
                                return (
                                  <TableCell key={v.id} className="text-center py-2">
                                    {val !== null ? (
                                      <Badge
                                        className="text-[10px] font-mono px-2 py-0.5 border"
                                        style={{
                                          backgroundColor: val >= 80 ? "#dcfce7" : val >= 50 ? "#eff6ff" : "#fee2e2",
                                          color: val >= 80 ? "#166534" : val >= 50 ? "#1e40af" : "#991b1b",
                                          borderColor: val >= 80 ? "#86efac" : val >= 50 ? "#bfdbfe" : "#fca5a5",
                                        }}
                                      >
                                        {val}%
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Best Strategy Callout */}
              <Card className="lg:col-span-4 bg-gradient-to-br from-purple-900 to-indigo-950 text-white shadow-sm text-left flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <CardTitle className="text-sm font-bold text-white">
                      Recommended Formulation
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-300">Optimal Prompt Paradigm</span>
                    <p className="text-xl font-extrabold text-white mt-0.5">
                      {analytics.bestVariant.name}
                    </p>
                    <p className="text-xs text-purple-200 mt-1 font-mono">
                      Yielded {analytics.bestVariant.accuracy}% Accuracy ({analytics.bestVariant.avgTime} ms avg)
                    </p>
                  </div>
                  <p className="text-[11px] text-purple-200/80 leading-relaxed">
                    💡 <strong>Thesis Discussion:</strong> Step-by-step visual reasoning (CoT) & few-shot grounding significantly reduce hallucination on ambiguous tourism photos.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Main 2-Column Test Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: SETUP (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  1. Test Image & Prompt Variants
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Select a single image to test across 5 prompt engineering variants.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-5">
                {/* Upload Image */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Query Image</Label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50/50">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="exp4-file" disabled={isRunning} />
                    <label htmlFor="exp4-file" className="cursor-pointer block">
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
                          <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
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

                {/* Prompt Variants Checkboxes */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Prompt Variants to Compare ({selectedVariants.length})</Label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {PROMPT_VARIANTS.map((v) => {
                      const isChecked = selectedVariants.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          onClick={() => {
                            if (isRunning) return;
                            setSelectedVariants((prev) =>
                              prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                            );
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isChecked ? "bg-purple-50/40 border-purple-200" : "bg-slate-50/40 border-slate-200/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => {}}
                                className="border-slate-300 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 shrink-0"
                                disabled={isRunning}
                              />
                              <span className="text-xs font-bold text-slate-800">{v.name}</span>
                            </div>
                            <Badge className="text-[9px] font-mono px-1 py-0" style={{ color: VARIANT_COLORS[v.id], backgroundColor: `${VARIANT_COLORS[v.id]}15` }}>
                              {v.tag}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 pl-6">{v.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Run Button */}
                <Button
                  onClick={runPromptSensitivityTest}
                  disabled={isRunning || !imageFile || !groundTruth.trim() || selectedVariants.length === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs py-5 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunning ? progressLabel : `Run Prompt Comparison (${selectedVariants.length} Variants)`}</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: RESULTS & AI REASONING INSPECTION (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    Prompt Variant Predictions & Reasoning
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Compare responses and inspect intermediate AI deduction logic.
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
                    <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                    <p className="text-xs font-semibold text-slate-600">No prompt sensitivity results yet.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Upload a photo and click Run Prompt Comparison.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-200 text-xs">
                          <TableHead className="py-2.5">Variant</TableHead>
                          <TableHead className="py-2.5">Prediction</TableHead>
                          <TableHead className="py-2.5 text-center">Reasoning</TableHead>
                          <TableHead className="py-2.5 text-center">Latency</TableHead>
                          <TableHead className="py-2.5 text-center">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResults.map((r, idx) => (
                          <TableRow key={idx} className="border-b border-slate-100 text-xs">
                            <TableCell className="font-bold text-slate-800 py-2.5">
                              <span style={{ color: VARIANT_COLORS[r.variant_id] }}>{r.variant_id}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">{r.variant_name.split(": ")[1]}</span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="font-semibold text-slate-900 block truncate max-w-[130px]">{r.predicted}</span>
                              {r.matched_alias && (
                                <span className="text-[10px] text-emerald-600 block">Matched: "{r.matched_alias}"</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              {r.reasoning ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setActiveReasoning({ name: r.variant_name, text: r.reasoning })}
                                  className="h-6 text-[10px] px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                >
                                  <Eye className="w-3 h-3 mr-1" /> View
                                </Button>
                              ) : (
                                <span className="text-slate-400 text-[10px]">-</span>
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

            {/* Historical Log */}
            <Card className="bg-white border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Historical Prompt Records ({dbLogs.length} trials)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-60 overflow-y-auto">
                {dbLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No historical records saved yet.</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-200 text-xs">
                        <TableHead className="py-2">Variant</TableHead>
                        <TableHead className="py-2">Model</TableHead>
                        <TableHead className="py-2">Prediction</TableHead>
                        <TableHead className="py-2 text-right">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((row, i) => (
                        <TableRow key={i} className="border-b border-slate-100 text-xs">
                          <TableCell className="py-2 font-bold" style={{ color: VARIANT_COLORS[row.variant_id] || "#6366f1" }}>
                            {row.variant_id}
                          </TableCell>
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

      {/* AI Reasoning Modal Dialog */}
      <Dialog open={!!activeReasoning} onOpenChange={(open) => !open && setActiveReasoning(null)}>
        <DialogContent className="max-w-xl bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-600" />
              {activeReasoning?.name} — AI Reasoning Output
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Intermediate chain-of-thought deduction steps generated by the VLM.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-h-72 overflow-y-auto text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
            {activeReasoning?.text}
          </div>
        </DialogContent>
      </Dialog>
    </ExperimentLayout>
  );
}
