import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  calculateMcNemarTest,
  calculatePairedTTest,
  McNemarResult,
  PairedTResult,
} from "@/utils/evaluationMetrics";
import { CheckCircle2, XCircle, Calculator, Scale, Copy, Check, Info } from "lucide-react";

export interface LogItem {
  timestamp: string;
  image_name: string;
  ground_truth: string;
  model: string;
  modelLabel?: string;
  predicted: string;
  confidence: number;
  time_ms: number;
  is_correct: boolean;
}

interface StatisticalComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogItem[];
  availableModels: Array<{ value: string; label: string }>;
}

export const StatisticalComparisonModal: React.FC<StatisticalComparisonModalProps> = ({
  isOpen,
  onClose,
  logs,
  availableModels,
}) => {
  const [modelA, setModelA] = useState<string>(availableModels[0]?.value || "");
  const [modelB, setModelB] = useState<string>(availableModels[1]?.value || availableModels[0]?.value || "");
  const [copied, setCopied] = useState(false);

  // Group logs by image_name to find paired comparisons
  const pairedData = useMemo(() => {
    if (!modelA || !modelB || modelA === modelB) return null;

    const imageMap: Record<string, { [modelId: string]: LogItem }> = {};

    logs.forEach((log) => {
      const key = `${log.image_name}_${log.ground_truth}`;
      if (!imageMap[key]) imageMap[key] = {};
      imageMap[key][log.model] = log;
    });

    const pairs: Array<{ image: string; groundTruth: string; resA: LogItem; resB: LogItem }> = [];

    Object.entries(imageMap).forEach(([_, m]) => {
      if (m[modelA] && m[modelB]) {
        pairs.push({
          image: m[modelA].image_name,
          groundTruth: m[modelA].ground_truth,
          resA: m[modelA],
          resB: m[modelB],
        });
      }
    });

    if (pairs.length === 0) return null;

    const outcomesA = pairs.map((p) => p.resA.is_correct);
    const outcomesB = pairs.map((p) => p.resB.is_correct);
    const latenciesA = pairs.map((p) => p.resA.time_ms);
    const latenciesB = pairs.map((p) => p.resB.time_ms);

    const labelA = availableModels.find((m) => m.value === modelA)?.label || modelA;
    const labelB = availableModels.find((m) => m.value === modelB)?.label || modelB;

    const mcNemar: McNemarResult = calculateMcNemarTest(outcomesA, outcomesB, labelA, labelB);
    const pairedT: PairedTResult = calculatePairedTTest(latenciesA, latenciesB, labelA, labelB);

    const accA = ((outcomesA.filter(Boolean).length / outcomesA.length) * 100).toFixed(1);
    const accB = ((outcomesB.filter(Boolean).length / outcomesB.length) * 100).toFixed(1);
    const meanLatA = Math.round(latenciesA.reduce((a, b) => a + b, 0) / latenciesA.length);
    const meanLatB = Math.round(latenciesB.reduce((a, b) => a + b, 0) / latenciesB.length);

    return {
      n: pairs.length,
      pairs,
      labelA,
      labelB,
      accA,
      accB,
      meanLatA,
      meanLatB,
      mcNemar,
      pairedT,
    };
  }, [logs, modelA, modelB, availableModels]);

  const copyThesisReport = () => {
    if (!pairedData) return;

    const text = `### Statistical Significance Report (Thesis Chapter 4)
- **Comparison**: ${pairedData.labelA} vs. ${pairedData.labelB}
- **Sample Size ($N$)**: ${pairedData.n} paired images

#### 1. Classification Accuracy (McNemar's Test)
- **${pairedData.labelA} Accuracy**: ${pairedData.accA}%
- **${pairedData.labelB} Accuracy**: ${pairedData.accB}%
- **Contingency Table**: Both Correct: ${pairedData.mcNemar.contingency.bothCorrect}, ${pairedData.labelA} Only: ${pairedData.mcNemar.contingency.modelACorrectOnly}, ${pairedData.labelB} Only: ${pairedData.mcNemar.contingency.modelBCorrectOnly}, Both Wrong: ${pairedData.mcNemar.contingency.bothIncorrect}
- **$\\chi^2$ (with Edwards correction)**: ${pairedData.mcNemar.chi2}
- **$p$-value**: ${pairedData.mcNemar.pValue} (${pairedData.mcNemar.isSignificant ? "Statistically Significant, p < 0.05" : "Not Significant, p >= 0.05"})
- **Conclusion**: ${pairedData.mcNemar.interpretation}

#### 2. Inference Latency (Paired t-Test)
- **${pairedData.labelA} Mean Latency**: ${pairedData.meanLatA} ms
- **${pairedData.labelB} Mean Latency**: ${pairedData.meanLatB} ms
- **$t$-statistic**: ${pairedData.pairedT.tStat}
- **$p$-value**: ${pairedData.pairedT.pValue} (${pairedData.pairedT.isSignificant ? "Statistically Significant, p < 0.05" : "Not Significant, p >= 0.05"})
- **Conclusion**: ${pairedData.pairedT.interpretation}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Thesis statistical report copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Scale className="w-5 h-5 text-indigo-600" />
            Statistical Significance Testing (Thesis Rigor)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Evaluate pairwise statistical hypothesis testing between models using McNemar's Test (Accuracy) and Paired t-Test (Latency).
          </DialogDescription>
        </DialogHeader>

        {/* Model Selection Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 mt-2">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-slate-700">Model A (Baseline)</label>
            <Select value={modelA} onValueChange={setModelA}>
              <SelectTrigger className="bg-white border-slate-300 text-xs">
                <SelectValue placeholder="Select Model A" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-slate-700">Model B (Comparison)</label>
            <Select value={modelB} onValueChange={setModelB}>
              <SelectTrigger className="bg-white border-slate-300 text-xs">
                <SelectValue placeholder="Select Model B" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {modelA === modelB ? (
          <div className="text-center py-8 text-slate-400">
            <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Please select two distinct models to perform pairwise statistical comparison.</p>
          </div>
        ) : !pairedData ? (
          <div className="text-center py-8 text-slate-400">
            <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No matching paired test cases found for these two models.</p>
            <p className="text-xs mt-1">Run benchmarks where both models evaluate the same image queries.</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Sample Size Banner */}
            <div className="flex items-center justify-between p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
              <span className="font-semibold text-indigo-900">
                Paired Dataset Size: <strong>{pairedData.n} images</strong>
              </span>
              <div className="flex gap-3">
                <span className="text-slate-600">
                  {pairedData.labelA}: <strong>{pairedData.accA}%</strong> ({pairedData.meanLatA} ms)
                </span>
                <span className="text-slate-600">
                  {pairedData.labelB}: <strong>{pairedData.accB}%</strong> ({pairedData.meanLatB} ms)
                </span>
              </div>
            </div>

            {/* Test 1: McNemar's Test for Classification Accuracy */}
            <div className="space-y-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  1. Accuracy Comparison: McNemar's Test
                </h4>
                <Badge
                  className={
                    pairedData.mcNemar.isSignificant
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }
                >
                  {pairedData.mcNemar.isSignificant ? "p < 0.05 (Significant)" : "p ≥ 0.05 (Not Significant)"}
                </Badge>
              </div>

              {/* 2x2 Contingency Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[11px] font-semibold text-slate-500"></TableHead>
                        <TableHead className="text-[11px] font-semibold text-center text-slate-700">
                          {pairedData.labelB} ✓
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold text-center text-slate-700">
                          {pairedData.labelB} ✗
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-semibold text-slate-700 bg-slate-50 text-[11px]">
                          {pairedData.labelA} ✓
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                          {pairedData.mcNemar.contingency.bothCorrect}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                          {pairedData.mcNemar.contingency.modelACorrectOnly}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-slate-700 bg-slate-50 text-[11px]">
                          {pairedData.labelA} ✗
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-purple-700 bg-purple-50/40">
                          {pairedData.mcNemar.contingency.modelBCorrectOnly}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-rose-700 bg-rose-50/30">
                          {pairedData.mcNemar.contingency.bothIncorrect}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* McNemar Metrics */}
                <div className="space-y-2 text-xs text-left bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Chi-Square ($\chi^2$, Edwards corr.):</span>
                    <span className="font-mono font-bold text-slate-800">{pairedData.mcNemar.chi2}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">$p$-value:</span>
                    <span className="font-mono font-bold text-slate-800">{pairedData.mcNemar.pValue}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Degrees of Freedom:</span>
                    <span className="font-mono font-bold text-slate-800">1</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md text-left leading-relaxed">
                <strong>Interpretation:</strong> {pairedData.mcNemar.interpretation}
              </p>
            </div>

            {/* Test 2: Paired t-Test for Latency */}
            <div className="space-y-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-purple-600" />
                  2. Speed Comparison: Paired Sample t-Test
                </h4>
                <Badge
                  className={
                    pairedData.pairedT.isSignificant
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }
                >
                  {pairedData.pairedT.isSignificant ? "p < 0.05 (Significant)" : "p ≥ 0.05 (Not Significant)"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-lg text-left border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Mean Diff ($\Delta$)</span>
                  <span className="text-sm font-mono font-bold text-slate-800">
                    {Math.abs(pairedData.pairedT.meanDiff)} ms
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-left border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">$t$-Statistic</span>
                  <span className="text-sm font-mono font-bold text-slate-800">{pairedData.pairedT.tStat}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-left border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">$p$-Value</span>
                  <span className="text-sm font-mono font-bold text-slate-800">{pairedData.pairedT.pValue}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-left border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Faster Model</span>
                  <span className="text-xs font-bold text-indigo-600 block truncate" title={pairedData.pairedT.meanDiff < 0 ? pairedData.labelA : pairedData.labelB}>
                    {pairedData.pairedT.meanDiff < 0 ? pairedData.labelA : pairedData.labelB}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md text-left leading-relaxed">
                <strong>Interpretation:</strong> {pairedData.pairedT.interpretation}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyThesisReport}
            disabled={!pairedData}
            className="text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-500" />}
            {copied ? "Copied Thesis Summary" : "Copy Thesis Markdown Report"}
          </Button>
          <Button type="button" size="sm" onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
