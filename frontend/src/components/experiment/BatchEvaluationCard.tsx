import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AIModelType, AI_MODEL_OPTIONS } from "@/context/AIProviderContext";
import { analyzeImage, VisionResult } from "@/services/aiService";
import { evaluatePredictionWithAliases, calculateHaversineDistance } from "@/utils/evaluationMetrics";
import {
  FolderArchive,
  Upload,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Loader2,
  Trash2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";

export interface BatchDatasetItem {
  id: string;
  file: File;
  preview: string;
  name: string;
  groundTruth: string; // May contain multi-aliases like "Wat Arun | วัดอรุณ"
}

export interface BatchItemResult {
  image_name: string;
  ground_truth: string;
  model: AIModelType;
  modelLabel: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
  recall_rank: number; // 1 for top-1, 2 for top-2, etc. 0 if not matched
  match_score: number;
  matched_alias: string | null;
}

interface BatchEvaluationCardProps {
  selectedModels: AIModelType[];
  useClip: boolean;
  onBatchComplete: (results: BatchItemResult[]) => void;
  onSingleItemLogged?: (record: any) => void;
}

export const BatchEvaluationCard: React.FC<BatchEvaluationCardProps> = ({
  selectedModels,
  useClip,
  onBatchComplete,
  onSingleItemLogged,
}) => {
  const [items, setItems] = useState<BatchDatasetItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [currentRunningModel, setCurrentRunningModel] = useState<string>("");
  const [currentStepText, setCurrentStepText] = useState<string>("");
  const [liveBatchResults, setLiveBatchResults] = useState<BatchItemResult[]>([]);

  // Timing
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const abortRef = useRef<boolean>(false);
  const pauseRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);

  // Handle Multi-file upload
  const handleMultipleFiles = (files: FileList | File[]) => {
    const newItems: BatchDatasetItem[] = [];
    const imageFiles: File[] = [];
    let foundCsv: File | null = null;

    Array.from(files).forEach((f) => {
      if (f.name.endsWith(".csv") || f.name.endsWith(".txt")) {
        foundCsv = f;
      } else if (f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|bmp)$/i.test(f.name)) {
        imageFiles.push(f);
      }
    });

    if (foundCsv) {
      setCsvFile(foundCsv);
      parseAndApplyCsv(foundCsv, imageFiles);
      return;
    }

    imageFiles.forEach((file) => {
      const guessedName = file.name
        .substring(0, file.name.lastIndexOf(".") > 0 ? file.name.lastIndexOf(".") : file.name.length)
        .replace(/[-_]/g, " ");

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        groundTruth: guessedName,
      });
    });

    setItems((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} images to batch dataset.`);
  };

  // Handle ZIP Archive upload
  const handleZipUpload = async (file: File) => {
    setIsProcessingFiles(true);
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const newItems: BatchDatasetItem[] = [];
      const imageMap: Record<string, File> = {};
      let csvContent = "";

      // 1. Scan files in ZIP
      for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;
        const lower = relativePath.toLowerCase();

        if (lower.endsWith(".csv") || lower.endsWith("labels.txt")) {
          csvContent = await zipEntry.async("string");
        } else if (/\.(jpg|jpeg|png|webp|bmp)$/i.test(lower)) {
          const blob = await zipEntry.async("blob");
          const imgName = relativePath.split("/").pop() || relativePath;
          const imgFile = new File([blob], imgName, { type: `image/${imgName.split(".").pop() || "jpeg"}` });
          imageMap[imgName] = imgFile;
        }
      }

      // 2. Parse CSV if present
      const labelLookup: Record<string, string> = {};
      if (csvContent) {
        const lines = csvContent.split(/\r?\n/);
        lines.forEach((line, idx) => {
          if (!line.trim()) return;
          const cols = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
          if (cols.length >= 2) {
            // Check if header row
            if (idx === 0 && (cols[0].toLowerCase().includes("file") || cols[0].toLowerCase().includes("image"))) return;
            const imgKey = cols[0];
            const gt = cols.slice(1).join(" | "); // Combine aliases
            labelLookup[imgKey] = gt;
          }
        });
      }

      // 3. Assemble Items
      Object.entries(imageMap).forEach(([imgName, imgFile]) => {
        const guessedName = imgName
          .substring(0, imgName.lastIndexOf(".") > 0 ? imgName.lastIndexOf(".") : imgName.length)
          .replace(/[-_]/g, " ");

        const gt = labelLookup[imgName] || guessedName;

        newItems.push({
          id: `${imgName}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          file: imgFile,
          preview: URL.createObjectURL(imgFile),
          name: imgName,
          groundTruth: gt,
        });
      });

      if (newItems.length === 0) {
        toast.error("No valid image files found inside the ZIP archive.");
      } else {
        setItems((prev) => [...prev, ...newItems]);
        toast.success(`Successfully extracted ${newItems.length} images from ZIP archive!`);
      }
    } catch (err) {
      console.error("Failed to parse ZIP:", err);
      toast.error("Error reading ZIP archive. Please ensure it is a valid .zip file.");
    } finally {
      setIsProcessingFiles(false);
    }
  };

  // Parse CSV to apply ground truth labels to images
  const parseAndApplyCsv = (file: File, pendingImages?: File[]) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const labelMap: Record<string, string> = {};

      lines.forEach((line, idx) => {
        if (!line.trim()) return;
        const cols = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
        if (cols.length >= 2) {
          if (idx === 0 && (cols[0].toLowerCase().includes("file") || cols[0].toLowerCase().includes("image"))) return;
          labelMap[cols[0]] = cols.slice(1).join(" | ");
        }
      });

      if (pendingImages && pendingImages.length > 0) {
        const newItems: BatchDatasetItem[] = pendingImages.map((img) => {
          const guessed = img.name.substring(0, img.name.lastIndexOf(".")).replace(/[-_]/g, " ");
          return {
            id: `${img.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            file: img,
            preview: URL.createObjectURL(img),
            name: img.name,
            groundTruth: labelMap[img.name] || guessed,
          };
        });
        setItems((prev) => [...prev, ...newItems]);
      } else {
        // Update existing items
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            groundTruth: labelMap[item.name] || item.groundTruth,
          }))
        );
      }
      toast.success("Applied ground truth labels from CSV file.");
    };
    reader.readAsText(file);
  };

  const updateItemGroundTruth = (id: string, newGt: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, groundTruth: newGt } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllItems = () => {
    if (isRunning) return;
    setItems([]);
    setLiveBatchResults([]);
    setCurrentProgressIndex(0);
  };

  // Helper to commit a single image result to backend immediately
  const saveSingleImageToBackend = async (imageName: string, groundTruth: string, results: BatchItemResult[]) => {
    const payload = {
      image_name: imageName,
      ground_truth: groundTruth,
      results: results.map((r) => ({
        model: r.model,
        predicted: r.predicted,
        confidence: r.confidence,
        time_ms: r.time_ms,
        is_correct: r.is_correct,
        recall_rank: r.recall_rank,
        matched_alias: r.matched_alias,
      })),
    };

    try {
      await fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/experiment/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("Backend save failed, saved locally in session.", e);
    }
  };

  // RUN BATCH EVALUATION
  const runBatchEvaluation = async () => {
    if (items.length === 0) {
      toast.error("Please add images to the dataset first.");
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("Please select at least one AI model to benchmark.");
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;
    setLiveBatchResults([]);
    setCurrentProgressIndex(0);

    const startTs = Date.now();
    setStartTime(startTs);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);

    const accumulatedResults: BatchItemResult[] = [];

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;

      // Handle Pause
      while (pauseRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (abortRef.current) break;
      }
      if (abortRef.current) break;

      const item = items[i];
      setCurrentProgressIndex(i);

      const itemResults: BatchItemResult[] = [];

      for (const modelId of selectedModels) {
        if (abortRef.current) break;
        const modelOpt = AI_MODEL_OPTIONS.find((o) => o.value === modelId);
        const modelLabel = modelOpt ? modelOpt.label : modelId;
        setCurrentRunningModel(modelLabel);
        setCurrentStepText(`Processing ${item.name} (${i + 1}/${items.length})`);

        const tStart = performance.now();
        try {
          const res: VisionResult = await analyzeImage(
            item.file,
            modelId,
            useClip,
            (step) => setCurrentStepText(`[${modelLabel}] ${step}`)
          );
          const tEnd = performance.now();
          const duration = Math.round(tEnd - tStart);

          // Automated Multi-alias and Rank Evaluation
          const matchResult = evaluatePredictionWithAliases(
            res.place || "Unknown",
            item.groundTruth,
            res.top_candidates || res.similar_locations || [],
            0.70
          );

          const itemRes: BatchItemResult = {
            image_name: item.name,
            ground_truth: item.groundTruth,
            model: modelId,
            modelLabel,
            predicted: res.place || "Unknown",
            confidence: res.confidence || 0.0,
            time_ms: duration,
            is_correct: matchResult.isCorrect,
            recall_rank: matchResult.rank,
            match_score: matchResult.matchScore,
            matched_alias: matchResult.matchedAlias,
          };

          itemResults.push(itemRes);
          accumulatedResults.push(itemRes);
          setLiveBatchResults([...accumulatedResults]);

          if (onSingleItemLogged) {
            onSingleItemLogged(itemRes);
          }
        } catch (err) {
          console.error(`Error in batch for ${item.name} with ${modelLabel}:`, err);
        }
      }

      // Automatically save to backend after each image completes
      if (itemResults.length > 0) {
        await saveSingleImageToBackend(item.name, item.groundTruth, itemResults);
      }
    }

    clearInterval(timerRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setCurrentProgressIndex(items.length);
    setCurrentRunningModel("");
    setCurrentStepText("");

    if (abortRef.current) {
      toast.info("Batch evaluation cancelled. Completed trials were logged.");
    } else {
      toast.success(`Batch evaluation complete! Tested ${items.length} images across ${selectedModels.length} models.`);
      onBatchComplete(accumulatedResults);
    }
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
    if (pauseRef.current) {
      toast.info("Batch evaluation paused.");
    } else {
      toast.info("Resuming batch evaluation...");
    }
  };

  const cancelBatch = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
  };

  const totalTrials = items.length * selectedModels.length;
  const completedTrials = liveBatchResults.length;
  const progressPercent = totalTrials > 0 ? Math.round((completedTrials / totalTrials) * 100) : 0;

  // ETA Calculation
  const avgTrialTime = completedTrials > 0 ? elapsedSeconds / completedTrials : 0;
  const remainingTrials = totalTrials - completedTrials;
  const etaSeconds = Math.round(remainingTrials * avgTrialTime);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s < 10 ? "0" : ""}${s}s`;
  };

  return (
    <Card className="bg-white border-slate-200 text-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-md font-semibold flex items-center gap-2 text-slate-900">
            <FolderArchive className="w-4 h-4 text-indigo-600" />
            Automated Batch Dataset Evaluation
          </CardTitle>
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-medium">
            Academic Benchmark Mode
          </Badge>
        </div>
        <CardDescription className="text-slate-500 text-left">
          Upload a ZIP archive or multiple image files with Ground Truth labels to run complete automated benchmarks.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Upload Dropzone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box A: Multiple Image / Folder Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleMultipleFiles(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all"
          >
            <input
              type="file"
              id="batch-images-input"
              multiple
              accept="image/*,.csv"
              onChange={(e) => e.target.files && handleMultipleFiles(e.target.files)}
              className="hidden"
              disabled={isRunning}
            />
            <label htmlFor="batch-images-input" className="cursor-pointer block space-y-2">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Select Multiple Images / CSV</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Hold Shift/Ctrl to select 10-500+ photos</p>
              </div>
            </label>
          </div>

          {/* Box B: ZIP Archive Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith(".zip")) handleZipUpload(file);
                else toast.error("Please drop a .zip archive file.");
              }
            }}
            className="border-2 border-dashed border-slate-200 hover:border-purple-400 hover:bg-purple-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all"
          >
            <input
              type="file"
              id="batch-zip-input"
              accept=".zip"
              onChange={(e) => e.target.files && e.target.files[0] && handleZipUpload(e.target.files[0])}
              className="hidden"
              disabled={isRunning || isProcessingFiles}
            />
            <label htmlFor="batch-zip-input" className="cursor-pointer block space-y-2">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                {isProcessingFiles ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FolderArchive className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Upload Dataset ZIP Archive</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Extracts images + labels.csv automatically</p>
              </div>
            </label>
          </div>
        </div>

        {/* Dataset Preview Table */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">
                  Dataset Queue: {items.length} Images ({totalTrials} Model Trials)
                </span>
                <span className="text-[10px] text-slate-400">
                  Tip: Multi-alias separated by | (e.g. <i>Wat Arun | วัดอรุณ</i>)
                </span>
              </div>
              {!isRunning && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllItems}
                  className="text-[11px] h-7 px-2 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear Dataset
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-56">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="text-slate-500 text-[11px] py-2 w-12 text-center">#</TableHead>
                    <TableHead className="text-slate-500 text-[11px] py-2 w-16">Preview</TableHead>
                    <TableHead className="text-slate-500 text-[11px] py-2 text-left">Filename</TableHead>
                    <TableHead className="text-slate-500 text-[11px] py-2 text-left">Ground Truth Label(s)</TableHead>
                    <TableHead className="text-slate-500 text-[11px] py-2 w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <TableCell className="text-center font-mono text-slate-400 text-xs py-1.5">{idx + 1}</TableCell>
                      <TableCell className="py-1.5">
                        <img
                          src={item.preview}
                          alt={item.name}
                          className="w-9 h-9 object-cover rounded-md border border-slate-200"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-600 py-1.5 text-left truncate max-w-[150px]">
                        {item.name}
                      </TableCell>
                      <TableCell className="py-1.5 text-left">
                        <Input
                          value={item.groundTruth}
                          onChange={(e) => updateItemGroundTruth(item.id, e.target.value)}
                          disabled={isRunning}
                          className="h-7 text-xs bg-slate-50 border-slate-200 text-slate-900 focus-visible:bg-white"
                          placeholder="e.g. Wat Arun | วัดอรุณ | Temple of Dawn"
                        />
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        {!isRunning && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-slate-350 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Progress & Control Bar */}
        {isRunning && (
          <div className="space-y-3 p-4 bg-gradient-to-r from-indigo-50 via-slate-50 to-purple-50 rounded-2xl border border-indigo-100 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="font-bold text-slate-800">
                  {isPaused ? "Evaluation Paused" : `Running Model: ${currentRunningModel}`}
                </span>
                <Badge className="bg-indigo-100 text-indigo-800 border-none font-mono text-[10px]">
                  {completedTrials} / {totalTrials} Trials ({progressPercent}%)
                </Badge>
              </div>
              <div className="flex items-center space-x-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Elapsed: <strong>{formatTime(elapsedSeconds)}</strong>
                </span>
                {remainingTrials > 0 && (
                  <span>
                    ETA: <strong>{formatTime(etaSeconds)}</strong>
                  </span>
                )}
              </div>
            </div>

            <Progress value={progressPercent} className="h-2 bg-slate-200" />

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate max-w-md text-left">{currentStepText}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={togglePause}
                  className="h-7 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  {isPaused ? <Play className="w-3 h-3 mr-1 text-emerald-600" /> : <Pause className="w-3 h-3 mr-1 text-amber-600" />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={cancelBatch}
                  className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isRunning && items.length > 0 && (
          <Button
            onClick={runBatchEvaluation}
            disabled={selectedModels.length === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>
              Start Automated Batch Evaluation ({items.length} Images × {selectedModels.length} Models = {totalTrials} Trials)
            </span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
