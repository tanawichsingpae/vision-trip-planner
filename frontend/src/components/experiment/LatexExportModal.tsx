import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateLatexTable, generateMarkdownTable, ModelBenchmarkRow } from "@/utils/evaluationMetrics";
import { FileCode2, Copy, Check, FileText } from "lucide-react";

interface LatexExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  benchmarkData: ModelBenchmarkRow[];
  tierMatrixRows?: Array<{
    model: string;
    modelLabel: string;
    tier1_iconic?: number | null;
    tier2_longtail?: number | null;
    tier3_nature?: number | null;
    tier4_ugc?: number | null;
    overall?: number;
  }>;
}

export const LatexExportModal: React.FC<LatexExportModalProps> = ({
  isOpen,
  onClose,
  benchmarkData,
  tierMatrixRows = [],
}) => {
  const [caption, setCaption] = useState("Visual Place Recognition (VPR) Model Benchmark Performance");
  const [label, setLabel] = useState("tab:vpr_benchmark");
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedTierLatex, setCopiedTierLatex] = useState(false);

  const latexCode = generateLatexTable(benchmarkData, caption, label);
  const markdownCode = generateMarkdownTable(benchmarkData);

  const tierLatexCode = `\\begin{table}[htbp]
  \\centering
  \\caption{Stratified Multi-Tier Visual Place Recognition Evaluation (Head vs. Tail vs. Nature vs. UGC)}
  \\label{tab:vpr_stratified_tiers}
  \\begin{tabular}{l r r r r r}
    \\toprule
    \\textbf{Model} & \\textbf{T1: Iconic (\\%)} & \\textbf{T2: Long-Tail (\\%)} & \\textbf{T3: Nature (\\%)} & \\textbf{T4: UGC (\\%)} & \\textbf{Overall (\\%)} \\\\
    \\midrule
${tierMatrixRows
  .map(
    (r) =>
      `    ${r.modelLabel} & ${r.tier1_iconic !== null && r.tier1_iconic !== undefined ? `${r.tier1_iconic}\\%` : "-"} & ${r.tier2_longtail !== null && r.tier2_longtail !== undefined ? `${r.tier2_longtail}\\%` : "-"} & ${r.tier3_nature !== null && r.tier3_nature !== undefined ? `${r.tier3_nature}\\%` : "-"} & ${r.tier4_ugc !== null && r.tier4_ugc !== undefined ? `${r.tier4_ugc}\\%` : "-"} & ${r.overall ?? 0}\\% \\\\`
  )
  .join("\n")}
    \\bottomrule
  \\end{tabular}
\\end{table}`;

  const copyLatex = () => {
    navigator.clipboard.writeText(latexCode);
    setCopiedLatex(true);
    toast.success("LaTeX table code copied to clipboard!");
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdownCode);
    setCopiedMarkdown(true);
    toast.success("Markdown table copied to clipboard!");
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const copyTierLatex = () => {
    navigator.clipboard.writeText(tierLatexCode);
    setCopiedTierLatex(true);
    toast.success("Stratified 4-Tier LaTeX table copied to clipboard!");
    setTimeout(() => setCopiedTierLatex(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileCode2 className="w-5 h-5 text-blue-600" />
            Export Academic Tables (Thesis Chapter 4)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Generate formatted LaTeX (Booktabs) and Markdown tables from your current benchmark evaluation results.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div className="space-y-1 text-left">
            <Label htmlFor="latex-caption" className="text-xs font-semibold text-slate-700">
              Table Caption (LaTeX)
            </Label>
            <Input
              id="latex-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="text-xs bg-white border-slate-300"
            />
          </div>
          <div className="space-y-1 text-left">
            <Label htmlFor="latex-label" className="text-xs font-semibold text-slate-700">
              Table Label (\\label{})
            </Label>
            <Input
              id="latex-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="text-xs bg-white border-slate-300"
            />
          </div>
        </div>

        <Tabs defaultValue="tier_latex" className="mt-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1">
            <TabsTrigger value="tier_latex" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <FileCode2 className="w-3.5 h-3.5 text-purple-600" />
              Stratified 4-Tier LaTeX
            </TabsTrigger>
            <TabsTrigger value="latex" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
              LaTeX Code (Booktabs)
            </TabsTrigger>
            <TabsTrigger value="markdown" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-900">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Markdown Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tier_latex" className="space-y-3 mt-3">
            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed text-left">
                {tierLatexCode}
              </pre>
              <Button
                size="sm"
                onClick={copyTierLatex}
                className="absolute top-2 right-2 text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-1 h-7 px-2.5"
              >
                {copiedTierLatex ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedTierLatex ? "Copied" : "Copy 4-Tier LaTeX"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 text-left">
              💡 <strong>Thesis Chap. 4.1 Recommendation:</strong> Reports model breakdown across Head (Iconic), Tail (Long-tail), Nature, and UGC domain shifts.
            </p>
          </TabsContent>

          <TabsContent value="latex" className="space-y-3 mt-3">
            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed text-left">
                {latexCode}
              </pre>
              <Button
                size="sm"
                onClick={copyLatex}
                className="absolute top-2 right-2 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 h-7 px-2.5"
              >
                {copiedLatex ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedLatex ? "Copied" : "Copy LaTeX"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 text-left">
              💡 <strong>Tip for Overleaf / LaTeX:</strong> Ensure you include <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">\usepackage&#123;booktabs&#125;</code> in your preamble.
            </p>
          </TabsContent>

          <TabsContent value="markdown" className="space-y-3 mt-3">
            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed text-left">
                {markdownCode}
              </pre>
              <Button
                size="sm"
                onClick={copyMarkdown}
                className="absolute top-2 right-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1 h-7 px-2.5"
              >
                {copiedMarkdown ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedMarkdown ? "Copied" : "Copy Markdown"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-3 border-t border-slate-100">
          <Button type="button" size="sm" onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800 text-xs">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
