import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  BarChart3,
  Eye,
  EyeOff,
  Download,
  FileSpreadsheet,
  FileJson,
  Filter,
  Layers,
  Trophy,
  CheckCircle2,
  MessageSquareQuote,
  Sparkles,
  Star,
  Check,
  TrendingUp,
  BarChart2,
  PieChart,
  HelpCircle,
  Activity as ActivityIcon,
  Info,
  RefreshCw,
  Award,
  Zap,
  ChevronRight,
  Database,
  ArrowUpDown,
  SlidersHorizontal,
  Clock,
  MapPin,
  AlertCircle,
} from "lucide-react";
import type {
  BlindTrip,
  EvaluationRecord,
  ModelSummaryStat,
  ScenarioComparisonRecord,
} from "@/api/blindEvalApi";

// Predefined model colors for visual distinction
const MODEL_COLORS: Record<string, string> = {
  "gemini-1.5-pro": "#8b5cf6", // Purple
  "gpt-4o": "#10b981", // Emerald
  "claude-3-5-sonnet": "#f59e0b", // Amber
  "gemini-1.5-flash": "#0ea5e9", // Sky blue
  "google-gemini-38-flash": "#0ea5e9", // Sky blue
  "openai-gpt-54": "#10b981", // Emerald
  "meta-llama4": "#ec4899", // Pink
  "gpt-4o-mini": "#ec4899", // Pink
  "claude-3-haiku": "#14b8a6", // Teal
};

const COLOR_PALETTE = [
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#0ea5e9", // Sky Blue
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export interface ComputedModelStat {
  model: string;
  evaluations_count: number;
  avg_fa: number;
  avg_cc: number;
  avg_pf: number;
  avg_sr: number;
  avg_de: number;
  avg_ru: number;
  avg_overall_percentage: number;
  overall_score: number;
  total_wins: number;
  win_rate_percent: number;
  strengths: string[];
  weaknesses: string[];
  priority_improvements: Record<string, number>;
  general_comments: Array<{ expert: string; comment: string; date: string }>;
}

interface EvaluationAnalyticsProps {
  resultsData: {
    evaluations: EvaluationRecord[];
    comparisons?: ScenarioComparisonRecord[];
    summary: ModelSummaryStat[];
    total_trips: number;
  };
  trips: BlindTrip[];
  revealModels: boolean;
  setRevealModels: (reveal: boolean) => void;
  onRefreshResults: () => Promise<void>;
}

export default function EvaluationAnalytics({
  resultsData,
  trips,
  revealModels,
  setRevealModels,
  onRefreshResults,
}: EvaluationAnalyticsProps) {
  // Filter states
  const [selectedScenarioFilter, setSelectedScenarioFilter] = useState<string>("all");
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>("all");
  const [activeViewMode, setActiveViewMode] = useState<"combined" | "by_scenario" | "by_model" | "matrix">("combined");
  const [activeChartTab, setActiveChartTab] = useState<"radar" | "dim_bar" | "overall_bar" | "scenario_comp">("radar");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Extract unique models across summary, evals, and trips
  const availableModels = useMemo(() => {
    const modelSet = new Set<string>();
    resultsData.summary.forEach((s) => {
      if (s.model) modelSet.add(s.model);
    });
    resultsData.evaluations.forEach((e) => {
      if (e.actual_model) modelSet.add(e.actual_model);
    });
    trips.forEach((t) => {
      if (t.actual_model) modelSet.add(t.actual_model);
    });
    return Array.from(modelSet);
  }, [resultsData, trips]);

  const modelAliasMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableModels.forEach((m, idx) => {
      map[m] = `Candidate Model #${idx + 1}`;
    });
    return map;
  }, [availableModels]);

  const getModelLabel = (model: string) => {
    if (revealModels) return model;
    return modelAliasMap[model] || model;
  };

  const getModelColor = (modelName: string, index: number = 0): string => {
    if (MODEL_COLORS[modelName]) return MODEL_COLORS[modelName];
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  };

  // 2. Extract unique scenarios across trips and evals
  const availableScenarios = useMemo(() => {
    const map = new Map<string, { id: string; title: string; notes?: string; tripsCount: number }>();
    
    trips.forEach((t) => {
      if (t.scenario_id) {
        const existing = map.get(t.scenario_id);
        map.set(t.scenario_id, {
          id: t.scenario_id,
          title: t.scenario_title || `Scenario ${t.scenario_id}`,
          notes: t.scenario_notes || existing?.notes,
          tripsCount: (existing?.tripsCount || 0) + 1,
        });
      }
    });

    resultsData.evaluations.forEach((e) => {
      if (e.scenario_id && !map.has(e.scenario_id)) {
        map.set(e.scenario_id, {
          id: e.scenario_id,
          title: `Scenario ${e.scenario_id}`,
          tripsCount: 0,
        });
      }
    });

    resultsData.comparisons?.forEach((c) => {
      if (c.scenario_id && !map.has(c.scenario_id)) {
        map.set(c.scenario_id, {
          id: c.scenario_id,
          title: `Scenario ${c.scenario_id}`,
          tripsCount: 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [trips, resultsData]);

  const getScenarioTitle = (scenarioId: string) => {
    const found = availableScenarios.find((s) => s.id === scenarioId);
    return found ? found.title : scenarioId;
  };

  // 3. Helper to compute model statistics
  const computeModelStats = (
    evals: EvaluationRecord[],
    comparisonsList?: ScenarioComparisonRecord[],
    targetModels?: string[]
  ): ComputedModelStat[] => {
    const modelStats: Record<string, any> = {};

    // Initialize target models
    const modelList = targetModels || availableModels;
    modelList.forEach((m) => {
      modelStats[m] = {
        model: m,
        count: 0,
        total_fa: 0,
        total_cc: 0,
        total_pf: 0,
        total_sr: 0,
        total_de: 0,
        total_ru: 0,
        total_percentage: 0,
        total_overall: 0,
        wins: 0,
        strengths: [] as string[],
        weaknesses: [] as string[],
        priority_improvements: {} as Record<string, number>,
        general_comments: [] as Array<{ expert: string; comment: string; date: string }>,
      };
    });

    evals.forEach((ev) => {
      const m = ev.actual_model || "unknown";
      if (!modelStats[m]) {
        modelStats[m] = {
          model: m,
          count: 0,
          total_fa: 0,
          total_cc: 0,
          total_pf: 0,
          total_sr: 0,
          total_de: 0,
          total_ru: 0,
          total_percentage: 0,
          total_overall: 0,
          wins: 0,
          strengths: [] as string[],
          weaknesses: [] as string[],
          priority_improvements: {} as Record<string, number>,
          general_comments: [] as Array<{ expert: string; comment: string; date: string }>,
        };
      }
      const det = ev.detailed_scores || ({} as any);
      const sc = ev.scores || ({} as any);
      const st = modelStats[m];
      st.count += 1;

      const fa = parseFloat(det.fa_avg ?? sc.information_accuracy ?? 3) || 3;
      const cc = parseFloat(det.cc_avg ?? sc.persona_alignment ?? 3) || 3;
      const pf = parseFloat(det.pf_avg ?? sc.temporal_pacing ?? 3) || 3;
      const sr = parseFloat(det.sr_avg ?? sc.spatial_feasibility ?? 3) || 3;
      const de = parseFloat(det.de_avg ?? sc.attraction_quality ?? 3) || 3;
      const ru = parseFloat(det.ru_avg ?? 3.5) || 3.5;
      const pct = parseFloat(det.overall_percentage ?? ((fa + cc + pf + sr + de + ru) / 6.0) * 20) || 75;

      st.total_fa += fa;
      st.total_cc += cc;
      st.total_pf += pf;
      st.total_sr += sr;
      st.total_de += de;
      st.total_ru += ru;
      st.total_percentage += pct;
      st.total_overall += (fa + cc + pf + sr + de + ru) / 6.0;

      if (det.strengths && typeof det.strengths === "string" && det.strengths.trim()) {
        st.strengths.push(det.strengths.trim());
      }
      if (det.weaknesses && typeof det.weaknesses === "string" && det.weaknesses.trim()) {
        st.weaknesses.push(det.weaknesses.trim());
      }
      if (ev.feedback && typeof ev.feedback === "string" && ev.feedback.trim()) {
        if (!st.strengths.includes(ev.feedback.trim()) && !st.weaknesses.includes(ev.feedback.trim())) {
          st.general_comments.push({
            expert: ev.expert_name || "ผู้เชี่ยวชาญ",
            comment: ev.feedback.trim(),
            date: ev.submitted_at || "",
          });
        }
      }
      if (det.priority_improvement && typeof det.priority_improvement === "string" && det.priority_improvement.trim()) {
        const p = det.priority_improvement.trim();
        st.priority_improvements[p] = (st.priority_improvements[p] || 0) + 1;
      }
      if (ev.overall_pick) {
        st.wins += 1;
      }
    });

    // Calculate practical wins from comparisons
    if (comparisonsList) {
      comparisonsList.forEach((cmp) => {
        const bestTripId = cmp.best_for_practical_use?.trip_id;
        const matchedTrip = trips.find((t) => t.id === bestTripId);
        if (matchedTrip?.actual_model && modelStats[matchedTrip.actual_model]) {
          modelStats[matchedTrip.actual_model].wins += 1;
        }
      });
    }

    return Object.values(modelStats).map((st: any) => {
      const c = st.count || 0;
      if (c === 0) {
        return {
          model: st.model,
          evaluations_count: 0,
          avg_fa: 0,
          avg_cc: 0,
          avg_pf: 0,
          avg_sr: 0,
          avg_de: 0,
          avg_ru: 0,
          avg_overall_percentage: 0,
          overall_score: 0,
          total_wins: st.wins,
          win_rate_percent: 0,
          strengths: st.strengths,
          weaknesses: st.weaknesses,
          priority_improvements: st.priority_improvements,
          general_comments: st.general_comments,
        };
      }
      return {
        model: st.model,
        evaluations_count: st.count,
        avg_fa: Number((st.total_fa / c).toFixed(2)),
        avg_cc: Number((st.total_cc / c).toFixed(2)),
        avg_pf: Number((st.total_pf / c).toFixed(2)),
        avg_sr: Number((st.total_sr / c).toFixed(2)),
        avg_de: Number((st.total_de / c).toFixed(2)),
        avg_ru: Number((st.total_ru / c).toFixed(2)),
        avg_overall_percentage: Number((st.total_percentage / c).toFixed(1)),
        overall_score: Number((st.total_overall / c).toFixed(2)),
        total_wins: st.wins,
        win_rate_percent: Number(((st.wins / c) * 100).toFixed(1)),
        strengths: st.strengths,
        weaknesses: st.weaknesses,
        priority_improvements: st.priority_improvements,
        general_comments: st.general_comments,
      };
    });
  };

  // 4. Combined Stats across all evaluations
  const overallSummary = useMemo(() => {
    return computeModelStats(resultsData.evaluations, resultsData.comparisons);
  }, [resultsData, trips, availableModels]);

  // 5. Per-Scenario Summaries
  const scenarioSummariesMap = useMemo(() => {
    const map = new Map<string, ComputedModelStat[]>();
    availableScenarios.forEach((sc) => {
      const filteredEvals = resultsData.evaluations.filter((e) => e.scenario_id === sc.id);
      const filteredCmps = resultsData.comparisons?.filter((c) => c.scenario_id === sc.id);
      map.set(sc.id, computeModelStats(filteredEvals, filteredCmps));
    });
    return map;
  }, [availableScenarios, resultsData, trips, availableModels]);

  // 6. Active Filtered Summary for Table & Radar/Bar Charts
  const activeSummary = useMemo(() => {
    let list: ComputedModelStat[] = [];
    if (selectedScenarioFilter === "all") {
      list = overallSummary;
    } else {
      list = scenarioSummariesMap.get(selectedScenarioFilter) || [];
    }

    if (selectedModelFilter !== "all") {
      list = list.filter((m) => m.model === selectedModelFilter);
    }

    return list;
  }, [selectedScenarioFilter, selectedModelFilter, overallSummary, scenarioSummariesMap]);

  // Evaluated models in active view (evaluations_count > 0)
  const evaluatedActiveSummary = useMemo(() => {
    return activeSummary.filter((m) => m.evaluations_count > 0);
  }, [activeSummary]);

  // Candidate trips in selected scenario
  const candidateTripsInScenario = useMemo(() => {
    if (selectedScenarioFilter === "all") return trips;
    return trips.filter((t) => t.scenario_id === selectedScenarioFilter);
  }, [trips, selectedScenarioFilter]);

  // 7. Datasets for Charts
  // A. Radar Chart Data (6 Dimensions) - only for models with evaluations
  const radarChartData = useMemo(() => {
    const dimensions = [
      { key: "avg_fa", dimName: "1. FA ความถูกต้อง", full: "Factual Accuracy (ความถูกต้อง)" },
      { key: "avg_cc", dimName: "2. CC ตามข้อจำกัด", full: "Constraint Compliance (ตามข้อจำกัด)" },
      { key: "avg_pf", dimName: "3. PF เป็นไปได้จริง", full: "Practical Feasibility (เป็นไปได้จริง)" },
      { key: "avg_sr", dimName: "4. SR เชิงพื้นที่", full: "Spatial Rationality (เชิงพื้นที่)" },
      { key: "avg_de", dimName: "5. DE ความหลากหลาย", full: "Diversity & Experience (ความหลากหลาย)" },
      { key: "avg_ru", dimName: "6. RU ความยืดหยุ่น", full: "Robustness to Uncertainty (ยืดหยุ่นสำรอง)" },
    ];

    return dimensions.map((d) => {
      const row: any = {
        dimension: d.dimName,
        fullTitle: d.full,
      };
      evaluatedActiveSummary.forEach((m) => {
        const label = getModelLabel(m.model);
        row[label] = (m as any)[d.key] || 0;
      });
      return row;
    });
  }, [evaluatedActiveSummary, revealModels, modelAliasMap]);

  // B. Grouped Bar Chart Data (6 Dimensions + Overall)
  const dimensionsBarData = useMemo(() => {
    const items = [
      { key: "avg_fa", name: "FA ถูกต้อง", full: "1. ความถูกต้องของข้อมูล" },
      { key: "avg_cc", name: "CC ข้อจำกัด", full: "2. การปฏิบัติตามข้อจำกัด" },
      { key: "avg_pf", name: "PF เป็นไปได้", full: "3. ความเป็นไปได้ในทางปฏิบัติ" },
      { key: "avg_sr", name: "SR เชิงพื้นที่", full: "4. ความสมเหตุสมผลเชิงพื้นที่" },
      { key: "avg_de", name: "DE หลากหลาย", full: "5. ความหลากหลายและคุณภาพ" },
      { key: "avg_ru", name: "RU ยืดหยุ่น", full: "6. ความยืดหยุ่นและสำรอง" },
      { key: "overall_score", name: "เฉลี่ย 6 ด้าน", full: "คะแนนเฉลี่ยรวม 6 ด้าน (เต็ม 5)" },
    ];

    return items.map((it) => {
      const row: any = {
        name: it.name,
        fullName: it.full,
      };
      evaluatedActiveSummary.forEach((m) => {
        const label = getModelLabel(m.model);
        row[label] = (m as any)[it.key] || 0;
      });
      return row;
    });
  }, [evaluatedActiveSummary, revealModels, modelAliasMap]);

  // C. Overall Satisfaction Percentage & Wins Chart
  const overallPercentageBarData = useMemo(() => {
    return evaluatedActiveSummary.map((m, idx) => ({
      model: getModelLabel(m.model),
      rawModel: m.model,
      percentage: m.avg_overall_percentage,
      score: m.overall_score,
      wins: m.total_wins,
      count: m.evaluations_count,
      fill: getModelColor(m.model, idx),
    }));
  }, [evaluatedActiveSummary, revealModels, modelAliasMap]);

  // D. Cross-Scenario Performance Comparison
  const crossScenarioComparisonData = useMemo(() => {
    return availableScenarios.map((sc) => {
      const scStats = scenarioSummariesMap.get(sc.id) || [];
      const row: any = {
        scenarioId: sc.id,
        scenarioName: sc.title.length > 22 ? sc.title.slice(0, 20) + "..." : sc.title,
        fullTitle: sc.title,
      };
      availableModels.forEach((m) => {
        const stat = scStats.find((s) => s.model === m);
        const label = getModelLabel(m);
        row[label] = stat && stat.evaluations_count > 0 ? stat.overall_score : 0;
      });
      return row;
    });
  }, [availableScenarios, scenarioSummariesMap, availableModels, revealModels, modelAliasMap]);

  // 8. Filtered Qualitative Feedback
  const filteredComparisons = useMemo(() => {
    if (selectedScenarioFilter === "all") {
      return resultsData.comparisons || [];
    }
    return (resultsData.comparisons || []).filter((c) => c.scenario_id === selectedScenarioFilter);
  }, [resultsData.comparisons, selectedScenarioFilter]);

  // 9. CSV & JSON Export Handlers
  const downloadFile = (content: string, filename: string, mime = "text/csv;charset=utf-8;") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Raw Evaluations CSV (with UTF-8 BOM for Thai support in Excel)
  const handleExportRawEvaluationsCSV = () => {
    if (resultsData.evaluations.length === 0) {
      toast.error("ยังไม่มีข้อมูลการประเมินเพื่อส่งออก");
      return;
    }

    const headers = [
      "Evaluation ID",
      "Scenario ID",
      "Scenario Title",
      "Trip ID",
      "Blind Label",
      "Model Name",
      "Expert ID",
      "Expert Name",
      "Expert Role",
      "Expert Experience",
      "AI Familiarity",
      "FA1", "FA2", "FA3", "FA4", "FA5", "FA Avg (1. ความถูกต้อง)",
      "CC1", "CC2", "CC3", "CC4", "CC5", "CC Avg (2. ข้อจำกัด)",
      "PF1", "PF2", "PF3", "PF4", "PF5", "PF Avg (3. เป็นไปได้)",
      "SR1", "SR2", "SR3", "SR4", "SR Avg (4. เชิงพื้นที่)",
      "DE1", "DE2", "DE3", "DE4", "DE5", "DE Avg (5. หลากหลาย)",
      "RU1", "RU2", "RU3", "RU4", "RU Avg (6. ยืดหยุ่น)",
      "Overall 6-Dim Score (1-5)",
      "Overall Percentage (0-100%)",
      "Strengths (จุดเด่น)",
      "Weaknesses (จุดอ่อน)",
      "Priority Improvement (สิ่งที่ควรปรับปรุง)",
      "Priority Improvement (Other)",
      "Feedback",
      "Submitted At",
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = resultsData.evaluations.map((ev) => {
      const d = ev.detailed_scores || ({} as any);
      const scTitle = getScenarioTitle(ev.scenario_id);
      return [
        escapeCsv(ev.id),
        escapeCsv(ev.scenario_id),
        escapeCsv(scTitle),
        escapeCsv(ev.trip_id),
        escapeCsv(ev.blind_label),
        escapeCsv(ev.actual_model),
        escapeCsv(ev.expert_id),
        escapeCsv(ev.expert_name),
        escapeCsv(ev.expert_profile?.role || ""),
        escapeCsv(ev.expert_profile?.experience || ""),
        escapeCsv(ev.expert_profile?.ai_familiarity || ""),
        d.fa1 ?? "", d.fa2 ?? "", d.fa3 ?? "", d.fa4 ?? "", d.fa5 ?? "", d.fa_avg ?? "",
        d.cc1 ?? "", d.cc2 ?? "", d.cc3 ?? "", d.cc4 ?? "", d.cc5 ?? "", d.cc_avg ?? "",
        d.pf1 ?? "", d.pf2 ?? "", d.pf3 ?? "", d.pf4 ?? "", d.pf5 ?? "", d.pf_avg ?? "",
        d.sr1 ?? "", d.sr2 ?? "", d.sr3 ?? "", d.sr4 ?? "", d.sr_avg ?? "",
        d.de1 ?? "", d.de2 ?? "", d.de3 ?? "", d.de4 ?? "", d.de5 ?? "", d.de_avg ?? "",
        d.ru1 ?? "", d.ru2 ?? "", d.ru3 ?? "", d.ru4 ?? "", d.ru_avg ?? "",
        ((Number(d.fa_avg || 3) + Number(d.cc_avg || 3) + Number(d.pf_avg || 3) + Number(d.sr_avg || 3) + Number(d.de_avg || 3) + Number(d.ru_avg || 3.5)) / 6).toFixed(2),
        d.overall_percentage ?? "",
        escapeCsv(d.strengths || ""),
        escapeCsv(d.weaknesses || ""),
        escapeCsv(d.priority_improvement || ""),
        escapeCsv(d.priority_improvement_other || ""),
        escapeCsv(ev.feedback || ""),
        escapeCsv(ev.submitted_at || ""),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    downloadFile(csvContent, `pixinerary_raw_evaluations_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("ส่งออกข้อมูลการประเมินดิบ (Raw Evaluations CSV) เรียบร้อยแล้ว");
  };

  // Export Scenario Rankings & Qualitative CSV
  const handleExportComparisonsCSV = () => {
    if (!resultsData.comparisons || resultsData.comparisons.length === 0) {
      toast.error("ยังไม่มีข้อมูลการจัดอันดับ Scenario เพื่อส่งออก");
      return;
    }

    const headers = [
      "Comparison ID",
      "Scenario ID",
      "Scenario Title",
      "Expert ID",
      "Expert Name",
      "Expert Role",
      "Expert Experience",
      "Best Model Trip ID",
      "Best Model Blind Label",
      "Best Model Actual Name",
      "Best Model Rationale",
      "Rank 1 Trip",
      "Rank 1 Rationale",
      "Rank 2 Trip",
      "Rank 2 Rationale",
      "Rank 3 Trip",
      "Rank 3 Rationale",
      "Rank 4 Trip",
      "Rank 4 Rationale",
      "Q1 Real Travel (นำไปใช้จริง)",
      "Q2 Tourism Context (เข้าใจบริบท)",
      "Q3 Value Experience (คุ้มค่า)",
      "Q4 Distinct Differences (ข้อแตกต่างหลัก)",
      "Submitted At",
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = resultsData.comparisons.map((cmp) => {
      const scTitle = getScenarioTitle(cmp.scenario_id);
      const bestTrip = trips.find((t) => t.id === cmp.best_for_practical_use?.trip_id);
      const r1 = cmp.rankings?.find((r) => r.rank === 1);
      const r2 = cmp.rankings?.find((r) => r.rank === 2);
      const r3 = cmp.rankings?.find((r) => r.rank === 3);
      const r4 = cmp.rankings?.find((r) => r.rank === 4);

      return [
        escapeCsv(cmp.id),
        escapeCsv(cmp.scenario_id),
        escapeCsv(scTitle),
        escapeCsv(cmp.expert_id),
        escapeCsv(cmp.expert_name),
        escapeCsv(cmp.expert_profile?.role || ""),
        escapeCsv(cmp.expert_profile?.experience || ""),
        escapeCsv(cmp.best_for_practical_use?.trip_id || ""),
        escapeCsv(cmp.best_for_practical_use?.blind_label || ""),
        escapeCsv(bestTrip?.actual_model || ""),
        escapeCsv(cmp.best_for_practical_use?.rationale || ""),
        escapeCsv(r1 ? `${r1.blind_label}` : ""),
        escapeCsv(r1?.rationale || ""),
        escapeCsv(r2 ? `${r2.blind_label}` : ""),
        escapeCsv(r2?.rationale || ""),
        escapeCsv(r3 ? `${r3.blind_label}` : ""),
        escapeCsv(r3?.rationale || ""),
        escapeCsv(r4 ? `${r4.blind_label}` : ""),
        escapeCsv(r4?.rationale || ""),
        escapeCsv(cmp.qualitative_feedback?.q1_real_travel || ""),
        escapeCsv(cmp.qualitative_feedback?.q2_tourism_context || ""),
        escapeCsv(cmp.qualitative_feedback?.q3_value_experience || ""),
        escapeCsv(cmp.qualitative_feedback?.q4_distinct_differences || ""),
        escapeCsv(cmp.submitted_at || ""),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    downloadFile(csvContent, `pixinerary_qualitative_comparisons_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("ส่งออกข้อมูลการจัดอันดับและคำถามเชิงคุณภาพ (CSV) เรียบร้อยแล้ว");
  };

  // Export Matrix & Summary Table CSV
  const handleExportSummaryCSV = () => {
    const headers = [
      "Scope / Scenario",
      "Model Name",
      "Evaluations Count",
      "FA Avg (1. ถูกต้อง)",
      "CC Avg (2. ข้อจำกัด)",
      "PF Avg (3. เป็นไปได้)",
      "SR Avg (4. เชิงพื้นที่)",
      "DE Avg (5. หลากหลาย)",
      "RU Avg (6. ยืดหยุ่น)",
      "Overall 6-Dim Score (1-5)",
      "Overall Percentage (0-100%)",
      "Practical Wins",
      "Win Rate %",
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows: string[] = [];

    // All Combined
    overallSummary.forEach((st) => {
      rows.push([
        escapeCsv("รวมทุก Scenario (Overall Combined)"),
        escapeCsv(st.model),
        st.evaluations_count,
        st.avg_fa,
        st.avg_cc,
        st.avg_pf,
        st.avg_sr,
        st.avg_de,
        st.avg_ru,
        st.overall_score,
        st.avg_overall_percentage,
        st.total_wins,
        `${st.win_rate_percent}%`,
      ].join(","));
    });

    // Per Scenario
    availableScenarios.forEach((sc) => {
      const stats = scenarioSummariesMap.get(sc.id) || [];
      stats.forEach((st) => {
        rows.push([
          escapeCsv(`${sc.id}: ${sc.title}`),
          escapeCsv(st.model),
          st.evaluations_count,
          st.avg_fa,
          st.avg_cc,
          st.avg_pf,
          st.avg_sr,
          st.avg_de,
          st.avg_ru,
          st.overall_score,
          st.avg_overall_percentage,
          st.total_wins,
          `${st.win_rate_percent}%`,
        ].join(","));
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    downloadFile(csvContent, `pixinerary_model_scenario_matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("ส่งออกตารางสรุปคะแนนโมเดลและ Scenario (CSV) เรียบร้อยแล้ว");
  };

  // Export Complete JSON Dataset
  const handleExportFullJSON = () => {
    const fullDataset = {
      exported_at: new Date().toISOString(),
      metadata: {
        total_evaluations: resultsData.evaluations.length,
        total_comparisons: resultsData.comparisons?.length || 0,
        total_trips: resultsData.total_trips,
        scenarios_count: availableScenarios.length,
        models_count: availableModels.length,
      },
      scenarios: availableScenarios,
      models: availableModels,
      summary_combined: overallSummary,
      summary_by_scenario: Object.fromEntries(scenarioSummariesMap.entries()),
      raw_evaluations: resultsData.evaluations,
      raw_comparisons: resultsData.comparisons || [],
    };

    const jsonContent = JSON.stringify(fullDataset, null, 2);
    downloadFile(jsonContent, `pixinerary_evaluation_full_dataset_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    toast.success("ส่งออกชุดข้อมูลแบบเต็ม (Full JSON Dataset) เรียบร้อยแล้ว");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshResults();
      toast.success("อัปเดตข้อมูลผลการประเมินล่าสุดแล้ว");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle scope view mode change with clean filter defaults
  const handleViewModeChange = (mode: "combined" | "by_scenario" | "by_model" | "matrix") => {
    setActiveViewMode(mode);
    if (mode === "combined") {
      setSelectedScenarioFilter("all");
      setSelectedModelFilter("all");
    } else if (mode === "by_scenario") {
      if (selectedScenarioFilter === "all" && availableScenarios.length > 0) {
        setSelectedScenarioFilter(availableScenarios[0].id);
      }
      setSelectedModelFilter("all");
    } else if (mode === "by_model") {
      if (selectedModelFilter === "all" && availableModels.length > 0) {
        setSelectedModelFilter(availableModels[0]);
      }
      setSelectedScenarioFilter("all");
    } else if (mode === "matrix") {
      setSelectedScenarioFilter("all");
      setSelectedModelFilter("all");
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER & EXPORT TOOLBAR */}
      <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">
                  ระบบประเมินผลและการวิเคราะห์ (Evaluation & Analytics Center)
                </span>
                <Badge variant="outline" className="text-[10px] rounded-full">
                  {resultsData.evaluations.length} การประเมิน
                </Badge>
              </div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 mt-0.5">
                <BarChart3 className="size-5 text-purple-600" />
                สรุปผลการประเมินของผู้เชี่ยวชาญ (Evaluation Analytics)
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                วิเคราะห์ผลคะแนน 6 มิติ, การจัดอันดับ Scenario และเปรียบเทียบประสิทธิภาพระหว่างโมเดล
              </CardDescription>
            </div>

            {/* Actions: Refresh & Unblind Toggle */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 text-xs rounded-full gap-1.5 px-3 border-border/80"
              >
                <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-purple-600" : ""}`} />
                <span>รีเฟรชข้อมูล</span>
              </Button>

              <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-secondary/50 border border-border/70">
                <div className="flex items-center gap-1.5">
                  {revealModels ? (
                    <Eye className="size-3.5 text-emerald-600" />
                  ) : (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  )}
                  <Label htmlFor="analyticsRevealToggle" className="text-xs font-semibold cursor-pointer select-none">
                    เฉลยโมเดลจริง (Unblind)
                  </Label>
                </div>
                <Switch
                  id="analyticsRevealToggle"
                  checked={revealModels}
                  onCheckedChange={setRevealModels}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Top Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-center">
              <span className="text-[11px] text-muted-foreground block">จำนวนการประเมินรายโมเดล</span>
              <p className="text-xl sm:text-2xl font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
                {resultsData.evaluations.length} ครั้ง
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-center">
              <span className="text-[11px] text-muted-foreground block">การจัดอันดับ Scenario</span>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {resultsData.comparisons?.length || 0} ครั้ง
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 text-center">
              <span className="text-[11px] text-muted-foreground block">จำนวน Scenario / ทริป</span>
              <p className="text-xl sm:text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-0.5">
                {availableScenarios.length} โจทย์ ({resultsData.total_trips} แผน)
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-center">
              <span className="text-[11px] text-muted-foreground block">โมเดล AI ที่ร่วมทดสอบ</span>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {availableModels.length} โมเดล
              </p>
            </div>
          </div>

          {/* Export & Data Storage Bar */}
          <div className="p-3 rounded-2xl bg-secondary/30 border border-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Database className="size-4 text-purple-600" />
              <span>การจัดเก็บและส่งออกข้อมูลประเมิน (Data Export for Research / Thesis):</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportRawEvaluationsCSV}
                className="h-8 text-xs rounded-full gap-1.5 px-3 bg-background hover:bg-secondary border-border/80"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                <span>Export Raw Evals (CSV)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportComparisonsCSV}
                className="h-8 text-xs rounded-full gap-1.5 px-3 bg-background hover:bg-secondary border-border/80"
              >
                <FileSpreadsheet className="size-3.5 text-purple-600" />
                <span>Export Rankings (CSV)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSummaryCSV}
                className="h-8 text-xs rounded-full gap-1.5 px-3 bg-background hover:bg-secondary border-border/80"
              >
                <FileSpreadsheet className="size-3.5 text-sky-600" />
                <span>Export Matrix (CSV)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportFullJSON}
                className="h-8 text-xs rounded-full gap-1.5 px-3 bg-background hover:bg-secondary border-border/80"
              >
                <FileJson className="size-3.5 text-amber-600" />
                <span>Full Dataset (JSON)</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FILTER CONTROLS & VIEW SELECTION */}
      <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* View Mode Tabs */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                รูปแบบมุมมองการประเมิน (Evaluation Scope):
              </span>
              <Tabs
                value={activeViewMode}
                onValueChange={(v) => handleViewModeChange(v as any)}
              >
                <TabsList className="bg-secondary/60 p-1 rounded-2xl h-9">
                  <TabsTrigger value="combined" className="rounded-xl text-xs px-3">
                    <Layers className="size-3.5 mr-1.5" />
                    รวมทุก Scenario
                  </TabsTrigger>
                  <TabsTrigger value="by_scenario" className="rounded-xl text-xs px-3">
                    <Filter className="size-3.5 mr-1.5" />
                    แยกราย Scenario
                  </TabsTrigger>
                  <TabsTrigger value="by_model" className="rounded-xl text-xs px-3">
                    <Zap className="size-3.5 mr-1.5" />
                    เจาะลึกราย Model
                  </TabsTrigger>
                  <TabsTrigger value="matrix" className="rounded-xl text-xs px-3">
                    <SlidersHorizontal className="size-3.5 mr-1.5" />
                    ตารางเมทริกซ์สรุป
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Scenario Filter (active in by_scenario or combined) */}
              {(activeViewMode === "by_scenario" || activeViewMode === "combined") && (
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">
                    เลือก Scenario:
                  </Label>
                  <Select
                    value={selectedScenarioFilter}
                    onValueChange={setSelectedScenarioFilter}
                  >
                    <SelectTrigger className="h-8.5 rounded-full text-xs min-w-[240px] bg-secondary/30 border-border/80">
                      <SelectValue placeholder="ทุก Scenario (Combined)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-semibold">
                        ทุก Scenario รวมกัน ({resultsData.evaluations.length} ประเมิน)
                      </SelectItem>
                      {availableScenarios.map((sc) => {
                        const evCount = resultsData.evaluations.filter((e) => e.scenario_id === sc.id).length;
                        return (
                          <SelectItem key={sc.id} value={sc.id} className="text-xs">
                            {sc.id}: {sc.title} ({evCount > 0 ? `${evCount} ประเมิน` : `${sc.tripsCount} แผนรอประเมิน`})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Model Filter (active in by_model or combined) */}
              {(activeViewMode === "by_model" || activeViewMode === "combined") && (
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">
                    เลือก Model AI:
                  </Label>
                  <Select
                    value={selectedModelFilter}
                    onValueChange={setSelectedModelFilter}
                  >
                    <SelectTrigger className="h-8.5 rounded-full text-xs min-w-[210px] bg-secondary/30 border-border/80">
                      <SelectValue placeholder="ทุกโมเดล (All Models)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-semibold">
                        ทุกโมเดล ({availableModels.length} โมเดล)
                      </SelectItem>
                      {availableModels.map((m) => {
                        const mEvCount = resultsData.evaluations.filter((e) => e.actual_model === m).length;
                        const mTripsCount = trips.filter((t) => t.actual_model === m).length;
                        return (
                          <SelectItem key={m} value={m} className="text-xs">
                            {getModelLabel(m)} ({mEvCount > 0 ? `${mEvCount} ประเมิน` : `${mTripsCount} แผนรอประเมิน`})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Active Scope Summary Banner */}
          <div className="p-3 rounded-2xl bg-secondary/20 border border-border/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="size-3.5 text-purple-600 shrink-0" />
              <span>
                มุมมองปัจจุบัน:{" "}
                <strong className="text-foreground">
                  {activeViewMode === "combined" && "รวมทุก Scenario และทุกโมเดล"}
                  {activeViewMode === "by_scenario" && `Scenario: ${getScenarioTitle(selectedScenarioFilter)}`}
                  {activeViewMode === "by_model" && `Model: ${selectedModelFilter === "all" ? "ทุกโมเดล" : getModelLabel(selectedModelFilter)}`}
                  {activeViewMode === "matrix" && "ตารางเปรียบเทียบ Scenario × Model Matrix"}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px]">
                {evaluatedActiveSummary.length} โมเดลมีผลประเมิน
              </Badge>
              {activeSummary.length - evaluatedActiveSummary.length > 0 && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                  {activeSummary.length - evaluatedActiveSummary.length} โมเดลรอประเมิน
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NOTICE WHEN CURRENT SCENARIO HAS 0 EVALUATIONS */}
      {selectedScenarioFilter !== "all" && evaluatedActiveSummary.length === 0 && (
        <Card className="rounded-3xl border border-amber-300/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Scenario {selectedScenarioFilter} ({getScenarioTitle(selectedScenarioFilter)}) ยังไม่มีข้อมูลการประเมินที่ส่งเข้ามา
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  ใน Scenario นี้มีแผนการเดินทางที่ระบบสร้างไว้จำนวน <strong>{candidateTripsInScenario.length} แผน</strong> ซึ่งพร้อมสำหรับการประเมินโดยผู้เชี่ยวชาญ
                </p>
              </div>
            </div>

            {candidateTripsInScenario.length > 0 && (
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 block mb-1.5">
                  แผนการเดินทางใน Scenario นี้ที่รอการประเมิน:
                </span>
                <div className="flex flex-wrap gap-2">
                  {candidateTripsInScenario.map((t) => (
                    <Badge
                      key={t.id}
                      variant="outline"
                      className="bg-background/80 text-xs py-1 px-2.5 rounded-xl border-amber-300 dark:border-amber-800"
                    >
                      {t.blind_label} {revealModels && `(${t.actual_model})`} - {t.preferences.days} วัน
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* VISUAL EVALUATION CHARTS SECTION */}
      <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
        <CardHeader className="py-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 text-[10px] rounded-full">
                  Visual Charts & Radar
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {selectedScenarioFilter === "all"
                    ? "ข้อมูลรวมทุก Scenario"
                    : `Scenario: ${getScenarioTitle(selectedScenarioFilter)}`}
                </span>
              </div>
              <CardTitle className="text-base font-semibold flex items-center gap-2 mt-0.5">
                <TrendingUp className="size-4.5 text-purple-600" />
                กราฟและแผนภาพเปรียบเทียบผลการประเมิน (Visual Analytics)
              </CardTitle>
            </div>

            {/* Chart Type Tabs */}
            <Tabs
              value={activeChartTab}
              onValueChange={(v) => setActiveChartTab(v as any)}
            >
              <TabsList className="bg-secondary/60 p-1 rounded-2xl h-8.5">
                <TabsTrigger value="radar" className="rounded-xl text-xs px-2.5">
                  <PieChart className="size-3.5 mr-1" />
                  กราฟเรดาร์ 6 มิติ
                </TabsTrigger>
                <TabsTrigger value="dim_bar" className="rounded-xl text-xs px-2.5">
                  <BarChart2 className="size-3.5 mr-1" />
                  กราฟแท่ง 6 มิติ
                </TabsTrigger>
                <TabsTrigger value="overall_bar" className="rounded-xl text-xs px-2.5">
                  <Award className="size-3.5 mr-1" />
                  คะแนนภาพรวม & ชนะโหวต
                </TabsTrigger>
                <TabsTrigger value="scenario_comp" className="rounded-xl text-xs px-2.5">
                  <Layers className="size-3.5 mr-1" />
                  เทียบข้าม Scenario
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {evaluatedActiveSummary.length === 0 && activeChartTab !== "scenario_comp" ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">
                ยังไม่มีข้อมูลการประเมินสำหรับขอบเขตที่เลือก
              </p>
              <p className="text-xs text-muted-foreground">
                กรุณาเลือก Scenario หรือ Model อื่นที่มีการประเมินแล้ว หรือสลับไปยังแท็บ "ประเมินผล (Evaluate)" เพื่อส่งคะแนน
              </p>
            </div>
          ) : (
            <div>
              {/* 1. RADAR CHART */}
              {activeChartTab === "radar" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span>
                      แผนภาพเรดาร์ (Spider Chart) แสดงความสมดุลและความโดดเด่นใน 6 ด้านของแต่ละโมเดล (สเกล 0–5)
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {evaluatedActiveSummary.length} โมเดลที่แสดง
                    </Badge>
                  </div>

                  <div className="h-[360px] sm:h-[420px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarChartData} outerRadius="75%">
                        <PolarGrid stroke="rgba(150, 150, 150, 0.25)" />
                        <PolarAngleAxis
                          dataKey="dimension"
                          tick={{ fontSize: 11, fill: "currentColor", fontWeight: 600 }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 5]}
                          tick={{ fontSize: 10 }}
                        />
                        {evaluatedActiveSummary.map((m, idx) => {
                          const label = getModelLabel(m.model);
                          const color = getModelColor(m.model, idx);
                          return (
                            <Radar
                              key={m.model}
                              name={label}
                              dataKey={label}
                              stroke={color}
                              fill={color}
                              fillOpacity={0.22}
                              strokeWidth={2.2}
                            />
                          );
                        })}
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "rgba(23, 23, 23, 0.95)",
                            borderRadius: "12px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fff",
                            fontSize: "12px",
                            padding: "8px 12px",
                          }}
                        />
                        <RechartsLegend
                          wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 2. 6-DIMENSION GROUPED BAR CHART */}
              {activeChartTab === "dim_bar" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span>
                      เปรียบเทียบคะแนนเฉลี่ยแต่ละด้าน (1-5 คะแนน) ระหว่างโมเดล AI
                    </span>
                  </div>

                  <div className="h-[360px] sm:h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dimensionsBarData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fontWeight: 500 }}
                        />
                        <YAxis
                          domain={[0, 5]}
                          ticks={[0, 1, 2, 3, 4, 5]}
                          tick={{ fontSize: 11 }}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "rgba(23, 23, 23, 0.95)",
                            borderRadius: "12px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <RechartsLegend wrapperStyle={{ fontSize: "12px" }} />
                        {evaluatedActiveSummary.map((m, idx) => {
                          const label = getModelLabel(m.model);
                          const color = getModelColor(m.model, idx);
                          return (
                            <Bar
                              key={m.model}
                              dataKey={label}
                              fill={color}
                              radius={[6, 6, 0, 0]}
                              maxBarSize={40}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 3. OVERALL PERCENTAGE & WINS BAR CHART */}
              {activeChartTab === "overall_bar" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span>
                      คะแนนความสมบูรณ์ภาพรวม (Overall Percentage 0–100%) และจำนวนครั้งที่ผู้เชี่ยวชาญโหวตเลือกใช้งานจริง
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Overall Percentage Chart */}
                    <div className="p-4 rounded-2xl bg-secondary/20 border border-border/40 space-y-2">
                      <span className="text-xs font-bold text-foreground block">
                        คะแนนความพึงพอใจภาพรวม (Overall Percentage %)
                      </span>
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overallPercentageBarData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                            <YAxis
                              type="category"
                              dataKey="model"
                              tick={{ fontSize: 11, fontWeight: 600 }}
                              width={140}
                            />
                            <RechartsTooltip
                              formatter={(value: any) => [`${value}%`, "คะแนนภาพรวม"]}
                              contentStyle={{
                                backgroundColor: "rgba(23, 23, 23, 0.95)",
                                borderRadius: "10px",
                                color: "#fff",
                                fontSize: "12px",
                              }}
                            />
                            <Bar dataKey="percentage" radius={[0, 8, 8, 0]} maxBarSize={28}>
                              {overallPercentageBarData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Practical Wins Chart */}
                    <div className="p-4 rounded-2xl bg-secondary/20 border border-border/40 space-y-2">
                      <span className="text-xs font-bold text-foreground block">
                        จำนวนครั้งที่ถูกเลือก "เหมาะสมใช้งานจริงมากที่สุด" (Best for Practical Use)
                      </span>
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overallPercentageBarData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} unit=" ครั้ง" />
                            <YAxis
                              type="category"
                              dataKey="model"
                              tick={{ fontSize: 11, fontWeight: 600 }}
                              width={140}
                            />
                            <RechartsTooltip
                              formatter={(value: any) => [`${value} ครั้ง`, "จำนวนชนะโหวต"]}
                              contentStyle={{
                                backgroundColor: "rgba(23, 23, 23, 0.95)",
                                borderRadius: "10px",
                                color: "#fff",
                                fontSize: "12px",
                              }}
                            />
                            <Bar dataKey="wins" radius={[0, 8, 8, 0]} maxBarSize={28}>
                              {overallPercentageBarData.map((entry, index) => (
                                <Cell key={`win-cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. CROSS-SCENARIO COMPARISON BAR CHART */}
              {activeChartTab === "scenario_comp" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span>
                      เปรียบเทียบคะแนนเฉลี่ย 6 ด้านของแต่ละโมเดล AI ในแต่ละ Scenario (เฉพาะโมเดลที่มีการประเมิน)
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {availableScenarios.length} Scenarios
                    </Badge>
                  </div>

                  <div className="h-[360px] sm:h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crossScenarioComparisonData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                        <XAxis dataKey="scenarioName" tick={{ fontSize: 11, fontWeight: 500 }} />
                        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "rgba(23, 23, 23, 0.95)",
                            borderRadius: "12px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <RechartsLegend wrapperStyle={{ fontSize: "12px" }} />
                        {availableModels.map((m, idx) => {
                          const label = getModelLabel(m);
                          const color = getModelColor(m, idx);
                          return (
                            <Bar
                              key={m}
                              dataKey={label}
                              fill={color}
                              radius={[6, 6, 0, 0]}
                              maxBarSize={32}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6-DIMENSION LEADERBOARD TABLE (Dynamic per Scenario / Model) */}
      <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
        <CardHeader className="py-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="size-4 text-purple-600" />
                ตารางสรุปคะแนนเฉลี่ย 6 มิติ (6-Dimension Score Leaderboard)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {selectedScenarioFilter === "all"
                  ? "สรุปภาพรวมทุก Scenario"
                  : `เฉพาะ Scenario: ${getScenarioTitle(selectedScenarioFilter)}`}
              </CardDescription>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-purple-500 inline-block" /> FA = ความถูกต้อง
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500 inline-block" /> CC = ข้อจำกัด
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500 inline-block" /> PF = เป็นไปได้
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">โมเดล AI</TableHead>
                <TableHead className="text-xs text-center">สถานะ / จำนวนประเมิน</TableHead>
                <TableHead className="text-xs text-center">FA (ถูกต้อง)</TableHead>
                <TableHead className="text-xs text-center">CC (ข้อจำกัด)</TableHead>
                <TableHead className="text-xs text-center">PF (เป็นไปได้)</TableHead>
                <TableHead className="text-xs text-center">SR (เชิงพื้นที่)</TableHead>
                <TableHead className="text-xs text-center">DE (หลากหลาย)</TableHead>
                <TableHead className="text-xs text-center">RU (ยืดหยุ่น)</TableHead>
                <TableHead className="text-xs text-center font-bold text-purple-600">เฉลี่ย 6 ด้าน</TableHead>
                <TableHead className="text-xs text-center font-bold text-emerald-600">ภาพรวม (%)</TableHead>
                <TableHead className="text-xs text-center">ชนะโหวต</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-xs text-muted-foreground">
                    ยังไม่มีข้อมูลโมเดลในขอบเขตนี้
                  </TableCell>
                </TableRow>
              ) : (
                activeSummary.map((st, idx) => {
                  const displayName = getModelLabel(st.model);
                  const isTopOverall = evaluatedActiveSummary.length > 1 && st.overall_score > 0 && st.overall_score === Math.max(...evaluatedActiveSummary.map((s) => s.overall_score));
                  const isEvaluated = st.evaluations_count > 0;

                  return (
                    <TableRow key={st.model} className="text-xs hover:bg-secondary/30">
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: getModelColor(st.model, idx) }}
                          />
                          {revealModels ? (
                            <Badge variant="outline" className="text-[11px] font-mono">
                              {st.model}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">
                              {displayName}
                            </Badge>
                          )}
                          {isTopOverall && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-1.5 py-0">
                              Top 1
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isEvaluated ? (
                          <Badge variant="outline" className="text-[11px]">
                            {st.evaluations_count} ครั้ง
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            รอประเมิน
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isEvaluated ? st.avg_fa : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isEvaluated ? st.avg_cc : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isEvaluated ? st.avg_pf : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isEvaluated ? st.avg_sr : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isEvaluated ? st.avg_de : "-"}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {isEvaluated ? st.avg_ru : "-"}
                      </TableCell>
                      <TableCell className="text-center font-bold text-purple-600">
                        {isEvaluated ? `${st.overall_score} / 5` : "-"}
                      </TableCell>
                      <TableCell className="text-center font-bold text-emerald-600">
                        {isEvaluated ? `${st.avg_overall_percentage}%` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEvaluated ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px]">
                            {st.total_wins}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MATRIX VIEW SECTION: SCENARIO × MODEL MATRIX */}
      {activeViewMode === "matrix" && (
        <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
          <CardHeader className="py-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-purple-600" />
              ตารางเมทริกซ์เปรียบเทียบคะแนนทุกโมเดลในแต่ละ Scenario (Scenario × Model Matrix)
            </CardTitle>
            <CardDescription className="text-xs">
              แสดงคะแนนเฉลี่ยรวม 6 ด้าน (สเกล 1–5) และคะแนนภาพรวม (%) ของทุกโมเดลในแต่ละโจทย์
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs min-w-[220px]">Scenario / โจทย์การทดสอบ</TableHead>
                  {availableModels.map((m) => (
                    <TableHead key={m} className="text-xs text-center min-w-[150px]">
                      {getModelLabel(m)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 1. All Scenarios Combined Row */}
                <TableRow className="bg-purple-50/50 dark:bg-purple-950/20 font-semibold text-xs border-b-2 border-purple-200 dark:border-purple-900">
                  <TableCell className="text-purple-700 dark:text-purple-300">
                    ภาพรวมทั้งหมด (Combined All Scenarios)
                  </TableCell>
                  {availableModels.map((m) => {
                    const st = overallSummary.find((s) => s.model === m);
                    if (!st || st.evaluations_count === 0) {
                      const totalTripsForModel = trips.filter((t) => t.actual_model === m).length;
                      return (
                        <TableCell key={m} className="text-center">
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            รอประเมิน ({totalTripsForModel} แผน)
                          </Badge>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={m} className="text-center">
                        <div className="font-bold text-purple-600">{st.overall_score} / 5</div>
                        <div className="text-[10px] text-emerald-600 font-medium">{st.avg_overall_percentage}%</div>
                        <div className="text-[10px] text-muted-foreground">({st.evaluations_count} ครั้ง)</div>
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* 2. Individual Scenarios Rows */}
                {availableScenarios.map((sc) => {
                  const scStats = scenarioSummariesMap.get(sc.id) || [];
                  const tripsInSc = trips.filter((t) => t.scenario_id === sc.id);

                  return (
                    <TableRow key={sc.id} className="text-xs hover:bg-secondary/30">
                      <TableCell>
                        <span className="font-bold text-foreground block">{sc.id}</span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">{sc.title}</span>
                        <span className="text-[10px] text-purple-600 block mt-0.5">({tripsInSc.length} แผนในระบบ)</span>
                      </TableCell>
                      {availableModels.map((m) => {
                        const st = scStats.find((s) => s.model === m);
                        const hasTripInSc = tripsInSc.some((t) => t.actual_model === m);

                        if (st && st.evaluations_count > 0) {
                          return (
                            <TableCell key={m} className="text-center">
                              <span className="font-semibold text-foreground block">{st.overall_score} / 5</span>
                              <span className="text-[10px] text-emerald-600 font-medium block">{st.avg_overall_percentage}%</span>
                              <span className="text-[10px] text-muted-foreground">({st.evaluations_count} ครั้ง)</span>
                            </TableCell>
                          );
                        }

                        if (hasTripInSc) {
                          return (
                            <TableCell key={m} className="text-center">
                              <Badge variant="secondary" className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">
                                มีแผนรอประเมิน
                              </Badge>
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell key={m} className="text-center text-muted-foreground">
                            -
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* PER-MODEL DRILL-DOWN (BY MODEL SCOPE) */}
      {activeViewMode === "by_model" && (
        <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
          <CardHeader className="py-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-purple-600" />
              การวิเคราะห์เจาะลึกรายโมเดล (Per-Model Detailed Performance & Insights)
            </CardTitle>
            <CardDescription className="text-xs">
              รายงานผลการประเมินในแต่ละ Scenario, จุดเด่น, จุดอ่อน และข้อคิดเห็นเชิงคุณภาพจากผู้เชี่ยวชาญ
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            {activeSummary.map((m) => {
              const modelTrips = trips.filter((t) => t.actual_model === m.model);
              const modelEvals = resultsData.evaluations.filter((e) => e.actual_model === m.model);

              return (
                <div key={m.model} className="p-4 rounded-2xl bg-secondary/20 border border-border/40 space-y-4">
                  {/* Model Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {getModelLabel(m.model)}
                      </span>
                      {revealModels && (
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {m.model}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        คะแนนเฉลี่ย 6 ด้าน: <strong className="text-purple-600">{m.evaluations_count > 0 ? `${m.overall_score} / 5` : "-"}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        ความพึงพอใจ: <strong className="text-emerald-600">{m.evaluations_count > 0 ? `${m.avg_overall_percentage}%` : "-"}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        ประเมินแล้ว: <strong>{m.evaluations_count} ครั้ง</strong> (จาก {modelTrips.length} แผน)
                      </span>
                    </div>
                  </div>

                  {/* Scenario Participation Table for this Model */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Layers className="size-3.5 text-purple-600" />
                      ผลการประเมินของโมเดลนี้แยกตามแต่ละ Scenario:
                    </span>
                    <div className="rounded-xl border border-border/60 overflow-hidden bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent text-[11px]">
                            <TableHead>Scenario</TableHead>
                            <TableHead className="text-center">Blind Label</TableHead>
                            <TableHead className="text-center">สถานะการประเมิน</TableHead>
                            <TableHead className="text-center">FA</TableHead>
                            <TableHead className="text-center">CC</TableHead>
                            <TableHead className="text-center">PF</TableHead>
                            <TableHead className="text-center">SR</TableHead>
                            <TableHead className="text-center">DE</TableHead>
                            <TableHead className="text-center">RU</TableHead>
                            <TableHead className="text-center font-bold">คะแนนเฉลี่ย</TableHead>
                            <TableHead className="text-center font-bold">ภาพรวม (%)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modelTrips.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={11} className="text-center py-4 text-xs text-muted-foreground">
                                ไม่พบแผนการเดินทางของโมเดลนี้ในระบบ
                              </TableCell>
                            </TableRow>
                          ) : (
                            modelTrips.map((t) => {
                              const tEval = modelEvals.find((e) => e.trip_id === t.id);
                              const det = tEval?.detailed_scores;

                              return (
                                <TableRow key={t.id} className="text-xs hover:bg-secondary/20">
                                  <TableCell>
                                    <span className="font-semibold block">{t.scenario_id}</span>
                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{getScenarioTitle(t.scenario_id)}</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="text-[10px]">
                                      {t.blind_label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {tEval ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                                        ประเมินแล้ว
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] text-amber-700 dark:text-amber-300">
                                        รอการประเมิน
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">{det ? det.fa_avg : "-"}</TableCell>
                                  <TableCell className="text-center">{det ? det.cc_avg : "-"}</TableCell>
                                  <TableCell className="text-center">{det ? det.pf_avg : "-"}</TableCell>
                                  <TableCell className="text-center">{det ? det.sr_avg : "-"}</TableCell>
                                  <TableCell className="text-center">{det ? det.de_avg : "-"}</TableCell>
                                  <TableCell className="text-center">{det ? det.ru_avg : "-"}</TableCell>
                                  <TableCell className="text-center font-bold text-purple-600">
                                    {det
                                      ? `${((Number(det.fa_avg || 3) + Number(det.cc_avg || 3) + Number(det.pf_avg || 3) + Number(det.sr_avg || 3) + Number(det.de_avg || 3) + Number(det.ru_avg || 3.5)) / 6).toFixed(2)} / 5`
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-center font-bold text-emerald-600">
                                    {det ? `${det.overall_percentage}%` : "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Priority Improvements Badges */}
                  {Object.keys(m.priority_improvements).length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block">
                        ประเด็นที่ผู้เชี่ยวชาญแนะนำให้ปรับปรุงเป็นอันดับแรก (Priority Improvements):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(m.priority_improvements).map(([item, count]) => (
                          <Badge
                            key={item}
                            className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-[11px] rounded-full gap-1"
                          >
                            {item} ({count} ครั้ง)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Strengths */}
                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 space-y-1.5">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        จุดเด่นของโมเดลนี้ (Strengths):
                      </span>
                      {m.strengths.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">ยังไม่มีข้อความจุดเด่น</p>
                      ) : (
                        <ul className="space-y-1 text-xs text-foreground list-disc pl-4">
                          {m.strengths.map((str, idx) => (
                            <li key={idx}>{str}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Weaknesses */}
                    <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 space-y-1.5">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <Info className="size-3.5" />
                        จุดอ่อน / ข้อควรปรับปรุง (Weaknesses):
                      </span>
                      {m.weaknesses.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">ยังไม่มีข้อความจุดอ่อน</p>
                      ) : (
                        <ul className="space-y-1 text-xs text-foreground list-disc pl-4">
                          {m.weaknesses.map((weak, idx) => (
                            <li key={idx}>{weak}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* General Expert Comments for this Model */}
                  {m.general_comments.length > 0 && (
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MessageSquareQuote className="size-3.5 text-purple-600" />
                        ข้อคิดเห็นเพิ่มเติมจากผู้เชี่ยวชาญ ({m.general_comments.length} รายการ):
                      </span>
                      <div className="space-y-1.5">
                        {m.general_comments.map((cm, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-background text-xs space-y-0.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>โดย: {cm.expert}</span>
                              <span>{cm.date}</span>
                            </div>
                            <p className="text-foreground italic">"{cm.comment}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* QUALITATIVE THESIS ANALYSIS SECTION (COMPARISONS) */}
      {filteredComparisons.length > 0 && (
        <Card className="rounded-3xl border border-border/80 bg-background shadow-xs overflow-hidden">
          <CardHeader className="py-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquareQuote className="size-4 text-purple-600" />
                ผลการจัดอันดับและคำถามเชิงคุณภาพจากผู้เชี่ยวชาญ ({filteredComparisons.length} รายการ)
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {selectedScenarioFilter === "all" ? "ทุก Scenario" : `Scenario: ${selectedScenarioFilter}`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {filteredComparisons.map((cmp) => (
              <div key={cmp.id} className="p-4 rounded-2xl bg-secondary/20 border border-border/40 space-y-2.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-bold text-foreground">
                    ผู้ประเมิน: {cmp.expert_name || "ผู้เชี่ยวชาญ"} ({cmp.expert_profile?.role || "ผู้เชี่ยวชาญ"} • ประสบการณ์ {cmp.expert_profile?.experience || "-"})
                  </span>
                  <span className="text-[11px] text-muted-foreground">{cmp.submitted_at}</span>
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                  <Badge variant="outline">Scenario: {cmp.scenario_id}</Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    เหมาะสมใช้งานจริง: {cmp.best_for_practical_use?.blind_label}
                  </Badge>
                </div>

                {cmp.best_for_practical_use?.rationale && (
                  <p className="text-muted-foreground italic bg-secondary/40 p-2.5 rounded-xl border border-border/30">
                    "เหตุผลความเหมาะสม: {cmp.best_for_practical_use.rationale}"
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-border/30">
                  <div className="p-2.5 rounded-xl bg-background/80">
                    <span className="font-semibold block text-[11px] text-purple-600">1. นำไปใช้จริงมากที่สุด:</span>
                    <p className="text-foreground mt-0.5">{cmp.qualitative_feedback?.q1_real_travel || "-"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background/80">
                    <span className="font-semibold block text-[11px] text-purple-600">2. เข้าใจบริบทท่องเที่ยวดีที่สุด:</span>
                    <p className="text-foreground mt-0.5">{cmp.qualitative_feedback?.q2_tourism_context || "-"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background/80">
                    <span className="font-semibold block text-[11px] text-purple-600">3. ประสบการณ์คุ้มค่าที่สุด:</span>
                    <p className="text-foreground mt-0.5">{cmp.qualitative_feedback?.q3_value_experience || "-"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background/80">
                    <span className="font-semibold block text-[11px] text-purple-600">4. ข้อแตกต่างหลักระหว่างโมเดล:</span>
                    <p className="text-foreground mt-0.5">{cmp.qualitative_feedback?.q4_distinct_differences || "-"}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
