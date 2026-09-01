import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Beaker, Layers, Sparkles, Sliders, RefreshCw, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExperimentLayoutProps {
  children: React.ReactNode;
}

const EXPERIMENT_TABS = [
  {
    id: "exp1",
    path: "/experiment",
    label: "Exp 1: VPR Accuracy",
    description: "Benchmark multi-model recognition accuracy",
    icon: Beaker,
  },
  {
    id: "exp2",
    path: "/experiment/exp2",
    label: "Exp 2: Pipeline Comparison",
    description: "CLIP vs Direct 1-Turn LLM Vision",
    icon: Layers,
  },
  {
    id: "exp3",
    path: "/experiment/exp3",
    label: "Exp 3: Robustness Test",
    description: "Lighting, weather, angles & degradation",
    icon: Sparkles,
  },
  {
    id: "exp4",
    path: "/experiment/exp4",
    label: "Exp 4: Prompt Sensitivity",
    description: "Prompt formulation & language impact",
    icon: Sliders,
  },
  {
    id: "exp5",
    path: "/experiment/exp5",
    label: "Exp 5: Consistency Test",
    description: "N-run stability & agreement metrics",
    icon: RefreshCw,
  },
];

export const ExperimentLayout: React.FC<ExperimentLayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Navigation Back */}
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to App</span>
              </Link>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Beaker className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-900 leading-tight">
                    Pixinerary Evaluation Suite
                  </h1>
                  <p className="text-xs text-slate-500">Thesis Experimentation Console (Chapters 3-4)</p>
                </div>
              </div>
            </div>

            {/* Header Badge */}
            <div className="hidden md:flex items-center space-x-3">
              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 px-3 py-1">
                <BarChart2 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Active Evaluation Mode
              </Badge>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 border-t border-slate-100 overflow-x-auto py-2 no-scrollbar">
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
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
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
