import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { calculateECE, ECEBin } from "@/utils/evaluationMetrics";
import { AI_MODEL_OPTIONS } from "@/context/AIProviderContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  Line,
  ComposedChart,
  ReferenceLine,
  Legend,
} from "recharts";
import { Target, Check, FileCode2, Info, Sparkles } from "lucide-react";

interface ECEReliabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dbLogs: any[];
}

function isTruthy(v: string | boolean | undefined): boolean {
  return v === true || v === "true" || v === "True" || v === "1";
}

export const ECEReliabilityModal: React.FC<ECEReliabilityModalProps> = ({
  open,
  onOpenChange,
  dbLogs,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>("ALL");
  const [copied, setCopied] = useState(false);

  // Available models in logs
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    dbLogs.forEach((row) => {
      const m = row.model || row["Model"];
      if (m) set.add(m);
    });
    return Array.from(set);
  }, [dbLogs]);

  // Filtered ECE calculation
  const eceData = useMemo(() => {
    const filtered = dbLogs.filter((r) => {
      if (selectedModel === "ALL") return true;
      return (r.model || r["Model"]) === selectedModel;
    });

    const confidences: number[] = [];
    const outcomes: boolean[] = [];

    filtered.forEach((r) => {
      const rawConf = r.confidence !== undefined ? r.confidence : r["Confidence"];
      const rawCorrect = r.is_correct !== undefined ? r.is_correct : r["Is Correct"];

      let confNum = typeof rawConf === "number" ? rawConf : parseFloat(rawConf);
      if (isNaN(confNum)) confNum = 0.5;
      if (confNum > 1.0) confNum = confNum / 100; // normalize percentage if needed

      confidences.push(confNum);
      outcomes.push(isTruthy(rawCorrect));
    });

    const result = calculateECE(confidences, outcomes, 10);

    const chartBins = result.bins.map((b) => {
      const expected = (b.binIndex - 0.5) / 10;
      const gap = b.count > 0 ? parseFloat((b.accuracy - b.avgConfidence).toFixed(3)) : 0;
      return {
        ...b,
        binLabel: `${(b.binIndex - 1) * 10}-${b.binIndex * 10}%`,
        expectedAccuracy: expected * 100,
        empiricalAccuracy: b.count > 0 ? Math.round(b.accuracy * 100) : null,
        avgConfidencePct: Math.round(b.avgConfidence * 100),
        gap,
        isOverconfident: gap < 0,
      };
    });

    return {
      ece: result.ece,
      ecePct: (result.ece * 100).toFixed(2),
      bins: chartBins,
      sampleCount: filtered.length,
    };
  }, [dbLogs, selectedModel]);

  const copyCalibrationLatex = () => {
    const rows = eceData.bins
      .map((b) => {
        const accStr = b.empiricalAccuracy !== null ? `${b.empiricalAccuracy}\\%` : "N/A";
        return `    ${b.binLabel} & ${b.count} & ${b.avgConfidencePct}\\% & ${accStr} & ${b.gap >= 0 ? "+" : ""}${b.gap} \\\\`;
      })
      .join("\n");

    const modelName =
      selectedModel === "ALL"
        ? "All Evaluated Models"
        : AI_MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label || selectedModel;

    const latex = `\\begin{table}[htbp]
  \\centering
  \\caption{Confidence Calibration & Expected Calibration Error (ECE) for ${modelName}}
  \\label{tab:ece_calibration}
  \\begin{tabular}{l r r r r}
    \\toprule
    \\textbf{Confidence Bin} & \\textbf{Count ($N$)} & \\textbf{Avg Conf (\\%)} & \\textbf{Accuracy (\\%)} & \\textbf{Gap} \\\\
    \\midrule
${rows}
    \\midrule
    \\multicolumn{5}{l}{\\textbf{Expected Calibration Error (ECE):} ${eceData.ecePct}\\% ($N=${eceData.sampleCount}$)} \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}`;

    navigator.clipboard.writeText(latex);
    setCopied(true);
    toast.success("Calibration LaTeX table copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white text-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Reliability Diagram & Expected Calibration Error (ECE)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Measures whether model confidence matches true empirical accuracy (AI Safety Metric).
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={copyCalibrationLatex}
              className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <FileCode2 className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Copied" : "Export LaTeX"}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Controls & Top Score */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Filter Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-56 h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All Evaluated Models (Consolidated)
                  </SelectItem>
                  {availableModels.map((m) => {
                    const opt = AI_MODEL_OPTIONS.find((o) => o.value === m);
                    return (
                      <SelectItem key={m} value={m} className="text-xs">
                        {opt ? opt.label : m}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Expected Calibration Error
                </span>
                <span className="text-2xl font-extrabold text-indigo-600 font-mono">
                  {eceData.ecePct}% <span className="text-xs font-normal text-slate-400">ECE</span>
                </span>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs py-1">
                {parseFloat(eceData.ecePct) < 10 ? "Well Calibrated" : "Miscalibrated"}
              </Badge>
            </div>
          </div>

          {/* Reliability Diagram (Composed Chart) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Reliability Diagram (10 Confidence Bins)
              </span>
              <span className="text-[10px] text-slate-400">
                Red dashed line = Perfect Calibration ($y=x$)
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={eceData.bins} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                  <XAxis dataKey="binLabel" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
                  <RechartsTooltip
                    contentStyle={{ fontSize: "11px", backgroundColor: "#fff", borderRadius: "8px" }}
                    formatter={(val: any, name: string) => [
                      `${val}%`,
                      name === "empiricalAccuracy" ? "Empirical Accuracy" : "Confidence Target",
                    ]}
                  />
                  <ReferenceLine y={50} stroke="#f1f5f9" />
                  <Bar dataKey="empiricalAccuracy" name="Empirical Accuracy" radius={[4, 4, 0, 0]}>
                    {eceData.bins.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={
                          entry.gap > 0
                            ? "#10b981" // Underconfident (safe)
                            : Math.abs(entry.gap) < 0.1
                            ? "#6366f1"
                            : "#ef4444" // Overconfident (hallucination risk)
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    type="linear"
                    dataKey="expectedAccuracy"
                    name="Perfect Calibration"
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bin Breakdown Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-b border-slate-200 text-xs">
                  <TableHead className="py-2">Confidence Bin</TableHead>
                  <TableHead className="py-2 text-right">Samples ($N$)</TableHead>
                  <TableHead className="py-2 text-right">Avg Confidence</TableHead>
                  <TableHead className="py-2 text-right">Accuracy</TableHead>
                  <TableHead className="py-2 text-right">Calibration Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eceData.bins.map((bin, idx) => (
                  <TableRow key={idx} className="border-b border-slate-100 text-xs">
                    <TableCell className="font-mono font-bold text-slate-700 py-1.5">{bin.binLabel}</TableCell>
                    <TableCell className="text-right text-slate-500 py-1.5">{bin.count}</TableCell>
                    <TableCell className="text-right font-mono text-slate-600 py-1.5">{bin.avgConfidencePct}%</TableCell>
                    <TableCell className="text-right font-extrabold text-indigo-700 py-1.5">
                      {bin.empiricalAccuracy !== null ? `${bin.empiricalAccuracy}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs py-1.5">
                      {bin.count === 0 ? (
                        <span className="text-slate-300">-</span>
                      ) : bin.gap < 0 ? (
                        <span className="text-rose-600 font-semibold">{bin.gap} (Overconf.)</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">+{bin.gap} (Underconf.)</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
