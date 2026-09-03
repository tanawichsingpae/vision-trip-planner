import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Beaker, Layers, Sparkles, Sliders, RefreshCw, BarChart2, BookOpen, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExperimentLayoutProps {
  children: React.ReactNode;
}

const EXPERIMENT_TABS = [
  {
    id: "exp1",
    path: "/experiment",
    label: "Exp 1: VPR Accuracy",
    chapter: "Chap. 4.1",
    description: "Multi-Model Recognition Benchmark",
    icon: Beaker,
    activeColor: "bg-blue-600 text-white shadow-blue-200",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "exp2",
    path: "/experiment/exp2",
    label: "Exp 2: Pipeline Comparison",
    chapter: "Chap. 4.2",
    description: "2-Turn CLIP vs 1-Turn Direct VLM",
    icon: Layers,
    activeColor: "bg-indigo-600 text-white shadow-indigo-200",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "exp3",
    path: "/experiment/exp3",
    label: "Exp 3: Robustness Test",
    chapter: "Chap. 4.3",
    description: "Lighting, Weather, Angles & Noise",
    icon: Sparkles,
    activeColor: "bg-amber-600 text-white shadow-amber-200",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "exp4",
    path: "/experiment/exp4",
    label: "Exp 4: Prompt Sensitivity",
    chapter: "Chap. 4.4",
    description: "CoT, Thai, Few-Shot & Variants",
    icon: Sliders,
    activeColor: "bg-purple-600 text-white shadow-purple-200",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "exp5",
    path: "/experiment/exp5",
    label: "Exp 5: Consistency Test",
    chapter: "Chap. 4.5",
    description: "N-Run Stability & Jitter Variance",
    icon: RefreshCw,
    activeColor: "bg-rose-600 text-white shadow-rose-200",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
];

export const ExperimentLayout: React.FC<ExperimentLayoutProps> = ({ children }) => {
  const location = useLocation();

  const currentTab = EXPERIMENT_TABS.find((t) =>
    t.path === "/experiment"
      ? location.pathname === "/experiment" || location.pathname === "/experiment/"
      : location.pathname.startsWith(t.path)
  ) || EXPERIMENT_TABS[0];

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans pb-16 antialiased">
      {/* Top Glassmorphic Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Navigation Back */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link
                to="/"
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to App</span>
              </Link>
              
              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center space-x-2.5 text-left">
                <div className="p-2 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl shadow-xs">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight tracking-tight">
                      Pixinerary Evaluation Suite
                    </h1>
                    <span className="hidden md:inline-block px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded">
                      Thesis Rigor
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Standard Academic Benchmarking for Master's Thesis (Chapters 3 & 4)
                  </p>
                </div>
              </div>
            </div>

            {/* Right Meta Badges */}
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-white text-slate-700 border-slate-200/90 px-2.5 py-1 text-xs shadow-2xs font-medium">
                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                <span className="font-semibold text-slate-900">{currentTab.chapter}</span>
              </Badge>
            </div>
          </div>

          {/* Experiment Tabs Navigation */}
          <div className="flex space-x-1.5 border-t border-slate-100/90 overflow-x-auto py-2.5 no-scrollbar">
            {EXPERIMENT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                tab.path === "/experiment"
                  ? location.pathname === "/experiment" || location.pathname === "/experiment/"
                  : location.pathname.startsWith(tab.path);

              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`group flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? `${tab.activeColor} shadow-sm`
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-white/40 border border-slate-200/40"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                    }`}
                  >
                    {tab.chapter}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {children}
      </main>
    </div>
  );
};
