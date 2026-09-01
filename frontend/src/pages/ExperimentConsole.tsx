import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExperimentLayout } from "./ExperimentLayout";
import {
  ArrowLeft,
  Beaker,
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
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAI, AI_MODEL_OPTIONS, AIModelType } from "@/context/AIProviderContext";
import { analyzeImage, type VisionResult } from "@/services/aiService";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell
} from "recharts";

interface TrialResult {
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
}

interface HistoricalRecord {
  timestamp: string;
  image_name: string;
  ground_truth: string;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
}

export default function ExperimentConsole() {
  const navigate = useNavigate();
  
  // File upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Ground truth & pipeline config
  const [groundTruth, setGroundTruth] = useState<string>("");
  const [useClip, setUseClip] = useState<boolean>(true);
  
  // Models selected for batch testing
  const [selectedModels, setSelectedModels] = useState<AIModelType[]>(
    AI_MODEL_OPTIONS.map(opt => opt.value)
  );
  
  // Evaluation progress
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runningModel, setRunningModel] = useState<AIModelType | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("");
  
  // Results for the currently uploaded image
  const [currentResults, setCurrentResults] = useState<TrialResult[]>([]);
  
  // Saved database logs
  const [dbLogs, setDbLogs] = useState<HistoricalRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Fetch all historical results on load
  const fetchHistoricalResults = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/results`);
      if (response.ok) {
        const data = await response.json();
        
        // Map model IDs to human-readable names
        const mapped: HistoricalRecord[] = (data.results || []).map((row: any) => {
          const opt = AI_MODEL_OPTIONS.find(o => o.value === row.model);
          return {
            ...row,
            modelLabel: opt ? opt.label : row.model
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

  // Model option helper info
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
        // Guess Ground Truth based on filename without extension
        const guessedName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[-_]/g, " ");
        setGroundTruth(guessedName);
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
      setCurrentResults([]);
    }
  };

  // Toggle model selections
  const toggleModel = (modelId: AIModelType) => {
    setSelectedModels(prev => 
      prev.includes(modelId)
        ? prev.filter(m => m !== modelId)
        : [...prev, modelId]
    );
  };

  const selectAllModels = () => {
    setSelectedModels(allModelOptions.map(m => m.value));
  };

  const selectNoneModels = () => {
    setSelectedModels([]);
  };

  // Fuzzy check prediction against ground truth
  const checkFuzzyMatch = (predicted: string, gt: string): boolean => {
    const clean = (s: string) => 
      s.toLowerCase()
       .replace(/[^a-z0-9\s]/g, " ")
       .replace(/\s+/g, " ")
       .trim();
    
    const pClean = clean(predicted);
    const gtClean = clean(gt);
    
    if (!pClean || !gtClean) return false;
    return pClean.includes(gtClean) || gtClean.includes(pClean);
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
      const modelOpt = allModelOptions.find(o => o.value === modelId);
      const modelLabel = modelOpt ? modelOpt.label : modelId;
      setProgressLabel(`Running model: ${modelLabel}...`);

      const startTime = performance.now();
      try {
        const res: VisionResult = await analyzeImage(
          imageFile, 
          modelId, 
          useClip, 
          (step) => setProgressLabel(`[${modelLabel}] ${step}`)
        );
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const prediction = res.place || "Unknown";
        const confidence = res.confidence || 0.0;
        
        // Default is_correct to false (pending manual user grading)
        tempResults.push({
          model: modelId,
          modelLabel,
          predicted: prediction,
          confidence,
          time_ms: duration,
          is_correct: false
        });
        
        // Update state progressively so the user sees results coming in
        setCurrentResults([...tempResults]);
      } catch (err) {
        console.error(`Error running VPR for ${modelLabel}:`, err);
        toast.error(`Failed to get VPR prediction from ${modelLabel}`);
      }
    }

    setIsRunning(false);
    setRunningModel(null);
    setProgressLabel("");
    toast.success("Batch Place Recognition Complete! Please grade predictions below.");
  };

  // Toggle correctness manually in the current results table
  const updateCorrectness = (index: number, value: boolean) => {
    setCurrentResults(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], is_correct: value };
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
      results: currentResults.map(r => ({
        model: r.model,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct
      }))
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success("Results logged to CSV successfully!");
        // Refresh history log
        fetchHistoricalResults();
        
        // Clear state for next image
        setImageFile(null);
        setImagePreview(null);
        setGroundTruth("");
        setCurrentResults([]);
      } else {
        toast.error("Failed to save results to backend CSV server.");
      }
    } catch (e) {
      // Offline fallback: save locally in session state only
      console.warn("Could not save to backend. Logging in frontend session.", e);
      
      const sessionRecords: HistoricalRecord[] = currentResults.map(r => ({
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        image_name: imageFile?.name || "uploaded_image.jpg",
        ground_truth: groundTruth,
        model: r.model,
        modelLabel: r.modelLabel,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct
      }));
      
      setDbLogs(prev => [...sessionRecords, ...prev]);
      toast.success("Saved to session database! (Local only - Server offline)");
      
      // Clear current
      setImageFile(null);
      setImagePreview(null);
      setGroundTruth("");
      setCurrentResults([]);
    }
  };

  // Reset/Clear currently run results without committing
  const clearCurrent = () => {
    setImageFile(null);
    setImagePreview(null);
    setGroundTruth("");
    setCurrentResults([]);
  };

  // Calculate model-wise statistics based on all historical logs (session + loaded DB logs)
  const modelStats = useMemo(() => {
    const stats: Record<
      string, 
      { 
        modelLabel: string; 
        total: number; 
        correct: number; 
        times: number[]; 
        correctConfidences: number[] 
      }
    > = {};
    
    dbLogs.forEach(log => {
      if (!stats[log.model]) {
        stats[log.model] = {
          modelLabel: log.modelLabel || log.model,
          total: 0,
          correct: 0,
          times: [],
          correctConfidences: []
        };
      }
      stats[log.model].total += 1;
      if (log.is_correct) {
        stats[log.model].correct += 1;
        if (log.confidence > 0) {
          stats[log.model].correctConfidences.push(log.confidence);
        }
      }
      stats[log.model].times.push(log.time_ms);
    });

    return Object.entries(stats).map(([modelId, data]) => {
      const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
      
      // Mean Latency
      const totalTime = data.times.reduce((sum, t) => sum + t, 0);
      const meanLatency = data.total > 0 ? Math.round(totalTime / data.total) : 0;
      
      // Median Latency
      const sortedTimes = [...data.times].sort((a, b) => a - b);
      let medianLatency = 0;
      if (sortedTimes.length > 0) {
        const mid = Math.floor(sortedTimes.length / 2);
        medianLatency = sortedTimes.length % 2 !== 0 
          ? sortedTimes[mid] 
          : Math.round((sortedTimes[mid - 1] + sortedTimes[mid]) / 2);
      }
      
      // Throughput (FPS)
      const throughput = meanLatency > 0 ? parseFloat((1000 / meanLatency).toFixed(2)) : 0;
      
      // Average Correct Confidence
      const avgCorrectConfidence = data.correctConfidences.length > 0
        ? parseFloat((data.correctConfidences.reduce((sum, c) => sum + c, 0) / data.correctConfidences.length).toFixed(3))
        : 0;

      return {
        model: modelId,
        modelLabel: data.modelLabel,
        accuracy: parseFloat(accuracy.toFixed(1)),
        avgTime: meanLatency,
        medianTime: medianLatency,
        throughput,
        avgConfidence: avgCorrectConfidence,
        totalTests: data.total
      };
    }).sort((a, b) => b.accuracy - a.accuracy);
  }, [dbLogs]);

  // Export logs to client-side CSV file download
  const exportCSV = () => {
    if (dbLogs.length === 0) {
      toast.error("No historical log entries to export.");
      return;
    }

    const headers = ["Timestamp", "Image Name", "Ground Truth", "Model", "Predicted Place", "Confidence", "Time MS", "Is Correct"];
    const rows = dbLogs.map(log => [
      log.timestamp,
      `"${log.image_name.replace(/"/g, '""')}"`,
      `"${log.ground_truth.replace(/"/g, '""')}"`,
      log.model,
      `"${log.predicted.replace(/"/g, '""')}"`,
      log.confidence.toFixed(4),
      log.time_ms,
      log.is_correct ? "True" : "False"
    ]);

    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VPR_Experiment1_Results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded successfully!");
  };

  // Color generator for graph bars based on accuracy
  const getBarColor = (accuracy: number) => {
    if (accuracy >= 80) return "#10b981"; // Emerald
    if (accuracy >= 50) return "#3b82f6"; // Blue
    if (accuracy >= 30) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  return (
    <ExperimentLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Experiment 1: Visual Place Recognition Accuracy</h2>
            <p className="text-xs text-slate-500">Benchmark place recognition performance across multiple vision models sequentially.</p>
          </div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 font-medium">
            Standard VPR Baseline
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: SETUP PANEL (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Box 1: Image & Ground Truth Setup */}
            <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                  <Upload className="w-4 h-4 text-blue-500" />
                  1. Image & Ground Truth Setup
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Select the query photo and label the actual location.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-6 space-y-6">
                
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 relative ${
                    imagePreview 
                      ? "border-blue-400 bg-blue-50/20" 
                      : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
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
                          <p className="text-xs text-slate-400 mt-1">
                            Supports PNG, JPG, JPEG
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>

                {/* Ground Truth Label */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ground-truth" className="text-sm font-medium text-slate-700">
                      Ground Truth Location Name
                    </Label>
                    <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                      Required for Accuracy
                    </span>
                  </div>
                  <Input
                    id="ground-truth"
                    value={groundTruth}
                    onChange={(e) => setGroundTruth(e.target.value)}
                    placeholder="e.g. Wat Arun, Tokyo Tower, Eiffel Tower"
                    className="bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-slate-400">
                    Type the exact or clean landmark name to compute automatic match validation.
                  </p>
                </div>

                {/* Pipeline Config */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                  <div className="space-y-0.5 pr-2 text-left">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      Visual similarity (CLIP)
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Toggle CLIP ranking relative to photo templates.
                    </p>
                  </div>
                  <Switch
                    checked={useClip}
                    onCheckedChange={setUseClip}
                    disabled={isRunning}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

              </CardContent>
            </Card>

            {/* Box 2: Model Configuration */}
            <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                    <Beaker className="w-4 h-4 text-purple-500" />
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
                <CardDescription className="text-slate-500">
                  Select which models to run Place Recognition on.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1">
                  {allModelOptions.map((opt) => {
                    const isChecked = selectedModels.includes(opt.value);
                    return (
                      <div 
                        key={opt.value} 
                        onClick={() => !isRunning && toggleModel(opt.value)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
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
                        <div className="flex items-center gap-2 -mt-0.5">
                          <img 
                            src={opt.icon} 
                            className="w-5 h-5 rounded-full object-cover shrink-0 bg-slate-100 border border-slate-200" 
                            alt="" 
                          />
                          <div>
                            <span className="text-xs font-semibold text-slate-700 block text-left">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block text-left">
                              {opt.description}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submit Action Button */}
                <div className="mt-6">
                  {isRunning ? (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-not-allowed"
                      disabled
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{progressLabel}</span>
                    </Button>
                  ) : (
                    <Button 
                      onClick={runEvaluation}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all hover:shadow-blue-500/10 hover:scale-[1.01]"
                      disabled={!imageFile || !groundTruth.trim() || selectedModels.length === 0}
                    >
                      <Play className="w-4 h-4" />
                      <span>Run VPR Evaluation ({selectedModels.length} Models)</span>
                    </Button>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>

          {/* Right Column: RESULTS BOARD & METRICS (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Box 3: Current Trial Predictions */}
            <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
                <div className="text-left">
                  <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                    3. Live Predictions Table
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Outputs for the uploaded query. Manually toggle matching accuracy if needed.
                  </CardDescription>
                </div>
                {currentResults.length > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={clearCurrent}
                      className="text-xs h-8 bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                      disabled={isRunning}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                    <Button 
                      onClick={commitResults}
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm hover:shadow"
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
                    <Beaker className="w-8 h-8 mx-auto mb-3 text-slate-350" />
                    <p className="text-sm font-medium text-slate-500">No predictions generated yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Configure models and click Run to display benchmarks.</p>
                  </div>
                ) : (
                  <>
                    {/* Live grading summary bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-3 bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
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

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-b border-slate-200 hover:bg-transparent">
                            <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Model</TableHead>
                            <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Prediction</TableHead>
                            <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">CLIP Sim</TableHead>
                            <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Time (ms)</TableHead>
                            <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Evaluation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentResults.map((row, idx) => (
                            <TableRow key={row.model} className={row.is_correct ? "bg-emerald-50/30 border-b border-slate-100 transition-colors" : "border-b border-slate-100 transition-colors"}>
                              <TableCell className="font-medium text-slate-700 py-3 text-xs text-left">
                                {row.modelLabel}
                              </TableCell>
                              <TableCell className="py-3 text-xs text-left">
                                <span className="font-semibold text-slate-900 block">
                                  {row.predicted}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 text-center text-xs">
                                {useClip && row.confidence > 0 ? (
                                  <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-mono text-[10px] font-semibold">
                                    {row.confidence.toFixed(3)}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-center font-mono text-slate-600 text-xs">
                                {row.time_ms.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-3 text-center">
                                {/* Segmented Pill Toggle Buttons */}
                                <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/80 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => updateCorrectness(idx, true)}
                                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                                      row.is_correct
                                        ? "bg-emerald-600 text-white shadow-xs font-bold scale-105"
                                        : "text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60"
                                    }`}
                                  >
                                    <CheckCircle2 className={`w-3.5 h-3.5 ${row.is_correct ? "text-white" : "text-slate-400"}`} />
                                    <span>Correct</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateCorrectness(idx, false)}
                                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                                      !row.is_correct
                                        ? "bg-rose-600 text-white shadow-xs font-bold scale-105"
                                        : "text-slate-500 hover:text-rose-700 hover:bg-slate-200/60"
                                    }`}
                                  >
                                    <XCircle className={`w-3.5 h-3.5 ${!row.is_correct ? "text-white" : "text-slate-400"}`} />
                                    <span>Wrong</span>
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                
                {currentResults.length > 0 && (
                  <div className="mt-4 flex items-start gap-2 bg-slate-50 border border-slate-150 p-3 rounded-xl text-left">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      <strong>Thesis Evaluation Note</strong>: You can toggle the <strong>Correct?</strong> switch manually. Ground Truth matches may differ slightly in spelling (e.g. <i>"Temple of Dawn"</i> vs <i>"Wat Arun"</i>). Checking these ensures your statistics remain clean before saving.
                    </p>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Box 4: Model Statistics Charts */}
            <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900 text-left">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  4. Accuracy (Recall@1) Benchmark
                </CardTitle>
                <CardDescription className="text-slate-500 flex text-left">
                  Consolidated metrics calculated over all logged trials.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-6">
                {modelStats.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-350" />
                    <p className="text-xs font-medium text-slate-500">No metrics data available yet.</p>
                    <p className="text-[10px] text-slate-450 mt-1">Commit results above to construct comparison metrics.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Recharts Bar Graph */}
                    <div className="h-60 w-full bg-slate-50/50 p-2 rounded-xl border border-slate-200/60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modelStats}
                          margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                        >
                          <XAxis 
                            dataKey="modelLabel" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            domain={[0, 100]}
                            unit="%"
                          />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}
                            labelStyle={{ color: "#1e293b", fontWeight: "bold", fontSize: "11px" }}
                            itemStyle={{ color: "#2563eb", fontSize: "11px" }}
                            formatter={(value: any) => [`${value}%`, "Accuracy"]}
                          />
                          <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                            {modelStats.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={getBarColor(entry.accuracy)} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Stats List Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {modelStats.slice(0, 6).map((entry) => (
                        <div key={entry.model} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-3 text-left shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]" title={entry.modelLabel}>
                              {entry.modelLabel}
                            </span>
                            <Badge className="bg-blue-50 text-blue-600 border-slate-100 text-[10px] py-0.5 px-2 font-mono font-semibold">
                              {entry.totalTests} test{entry.totalTests !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            {/* Recall@1 */}
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Recall@1 (Acc)</span>
                              <span className="text-sm font-extrabold block" style={{ color: getBarColor(entry.accuracy) }}>
                                {entry.accuracy}%
                              </span>
                            </div>
                            
                            {/* Avg Confidence */}
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Avg. Correct Conf.</span>
                              <span className="text-sm font-extrabold text-slate-700 block">
                                {entry.avgConfidence > 0 ? entry.avgConfidence.toFixed(3) : "-"}
                              </span>
                            </div>

                            {/* Mean Latency */}
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Mean Latency</span>
                              <span className="text-xs font-mono font-bold text-slate-650 block">
                                {entry.avgTime} ms
                              </span>
                            </div>

                            {/* Median Latency */}
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">Median Latency</span>
                              <span className="text-xs font-mono font-bold text-slate-650 block">
                                {entry.medianTime} ms
                              </span>
                            </div>

                            {/* Throughput */}
                            <div className="space-y-0.5 col-span-2 border-t border-slate-200/60 pt-2 flex items-center justify-between">
                              <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider">Throughput (Speed)</span>
                              <span className="text-xs font-extrabold text-indigo-600 font-mono">
                                {entry.throughput} FPS
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

          </div>

        </div>

        {/* Bottom Section: HISTORICAL TRIAL DATABASE LOG */}
        <div className="mt-8">
          <Card className="bg-white border-slate-200 text-slate-800 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
                  <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                  Historical Trial Logs
                </CardTitle>
                <CardDescription className="text-slate-500">
                  List of all place recognition results committed in the database file.
                </CardDescription>
              </div>
              {dbLogs.length > 0 && (
                <Button 
                  onClick={exportCSV}
                  variant="outline" 
                  className="text-xs bg-white border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export All CSV
                </Button>
              )}
            </CardHeader>
            
            <CardContent className="pt-6">
              {isLoadingLogs ? (
                <div className="text-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  <p className="text-xs">Loading experiment results history...</p>
                </div>
              ) : dbLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-slate-350" />
                  <p className="text-xs font-medium text-slate-500">No logged trial data found in database.</p>
                  <p className="text-[10px] text-slate-450 mt-1">Run and commit benchmarks above to log results to the CSV.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-96">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow className="border-b border-slate-200 hover:bg-transparent">
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Timestamp</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Image Name</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Ground Truth</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Model</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-left">Prediction</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Confidence</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-center">Latency</TableHead>
                        <TableHead className="text-slate-500 text-xs py-3 font-semibold text-right">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLogs.map((log, idx) => (
                        <TableRow key={`${log.timestamp}-${log.model}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-3 font-mono text-[10px] text-slate-500 text-left">
                            {log.timestamp}
                          </TableCell>
                          <TableCell className="py-3 font-medium text-slate-700 text-xs max-w-[150px] truncate text-left" title={log.image_name}>
                            {log.image_name}
                          </TableCell>
                          <TableCell className="py-3 text-slate-700 text-xs text-left">
                            {log.ground_truth}
                          </TableCell>
                          <TableCell className="py-3 text-slate-700 text-xs text-left">
                            {log.modelLabel}
                          </TableCell>
                          <TableCell className="py-3 font-semibold text-slate-900 text-xs text-left">
                            {log.predicted}
                          </TableCell>
                          <TableCell className="py-3 text-center text-xs">
                            {log.confidence > 0 ? (
                              <span className="font-mono text-[10px] text-blue-600 font-semibold">{log.confidence.toFixed(3)}</span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-center font-mono text-[11px] text-slate-600">
                            {log.time_ms.toLocaleString()} ms
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
      </div>
    </ExperimentLayout>
  );
}
