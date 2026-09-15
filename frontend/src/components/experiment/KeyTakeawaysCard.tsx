import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { EXPERIMENT_TAKEAWAYS, METRIC_GLOSSARY } from "@/data/experimentTakeaways";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Zap,
  Shield,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface KeyTakeawaysCardProps {
  expId: "exp1" | "exp2" | "exp3" | "exp4" | "exp5";
  className?: string;
}

export const KeyTakeawaysCard: React.FC<KeyTakeawaysCardProps> = ({ expId, className = "" }) => {
  const { isThai, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);

  const data = EXPERIMENT_TAKEAWAYS[expId];
  if (!data) return null;

  const renderIcon = (iconName: string, type?: string) => {
    const iconClass = `w-4 h-4 ${
      type === "champion"
        ? "text-amber-500"
        : type === "warning"
        ? "text-rose-500"
        : type === "highlight"
        ? "text-indigo-500"
        : "text-blue-500"
    }`;

    switch (iconName) {
      case "trophy":
        return <Trophy className={iconClass} />;
      case "zap":
        return <Zap className={iconClass} />;
      case "shield":
        return <Shield className={iconClass} />;
      case "alert":
        return <AlertTriangle className={iconClass} />;
      case "sparkles":
        return <Sparkles className={iconClass} />;
      case "check":
      default:
        return <CheckCircle2 className={iconClass} />;
    }
  };

  return (
    <Card className={`bg-gradient-to-br from-indigo-950/[0.03] via-white to-blue-950/[0.02] border-indigo-150/80 shadow-xs hover:shadow-sm transition-all overflow-hidden ${className}`}>
      {/* Header */}
      <CardHeader className="p-4 sm:p-5 border-b border-indigo-100/60 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center space-x-3 text-left">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl shadow-xs">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {isThai ? data.titleTh : data.titleEn}
              </CardTitle>
              <Badge variant="outline" className="hidden sm:inline-flex bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold">
                <BookOpen className="w-3 h-3 mr-1" />
                {data.chapter}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              {isThai ? data.subtitleTh : data.subtitleEn}
            </CardDescription>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          {/* Metric Glossary Dialog */}
          <Dialog open={isGlossaryOpen} onOpenChange={setIsGlossaryOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs text-indigo-700 bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100/80 font-medium flex items-center gap-1.5 rounded-lg"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t("คู่มือตัวชี้วัด", "Metrics Guide")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  {t("คำอธิบายตัวชี้วัดทางสถิติ (Evaluation Metrics Glossary)", "Evaluation Metrics Glossary & Statistical Definitions")}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {t(
                    "สรุปความหมายของตัวชี้วัดทั้งหมดที่ใช้ในการทดลองสำหรับนำเสนอและอ้างอิงในเล่มวิทยานิพนธ์",
                    "Formal definitions and descriptions of evaluation metrics used in the thesis benchmarks."
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {Object.entries(METRIC_GLOSSARY).map(([key, item]) => (
                  <div
                    key={key}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {isThai ? item.th : item.en}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isThai ? item.defTh : item.defEn}
                    </p>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Toggle Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            title={isExpanded ? t("ย่อกล่อง", "Collapse") : t("ขยายกล่อง", "Expand")}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Key Points Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.items.map((item, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                  item.type === "champion"
                    ? "bg-amber-50/50 border-amber-200/80 hover:border-amber-300"
                    : item.type === "warning"
                    ? "bg-rose-50/50 border-rose-200/80 hover:border-rose-300"
                    : item.type === "highlight"
                    ? "bg-indigo-50/50 border-indigo-200/80 hover:border-indigo-300"
                    : "bg-slate-50/70 border-slate-200/80 hover:border-blue-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      {renderIcon(item.icon, item.type)}
                      <h4 className="text-xs font-bold text-slate-900">
                        {isThai ? item.titleTh : item.titleEn}
                      </h4>
                    </div>
                    {(item.badgeTh || item.badgeEn) && (
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0.2 font-semibold ${
                          item.type === "champion"
                            ? "bg-amber-100 text-amber-800"
                            : item.type === "warning"
                            ? "bg-rose-100 text-rose-800"
                            : item.type === "highlight"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isThai ? item.badgeTh : item.badgeEn}
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {isThai ? item.descTh : item.descEn}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Thesis Recommendation Footer */}
          <div className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl border border-blue-200/70 text-left flex items-center justify-between">
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              {isThai ? data.recommendationTh : data.recommendationEn}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
