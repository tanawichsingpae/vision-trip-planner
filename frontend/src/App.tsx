import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AIProvider } from "@/context/AIProviderContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import ExperimentConsole from "./pages/ExperimentConsole.tsx";
import Exp2PipelineComparison from "./pages/Exp2PipelineComparison.tsx";
import Exp3RobustnessTest from "./pages/Exp3RobustnessTest.tsx";
import Exp4PromptSensitivity from "./pages/Exp4PromptSensitivity.tsx";
import Exp5ConsistencyTest from "./pages/Exp5ConsistencyTest.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import { testGeminiConnection, testOpenAIConnection } from "@/services/aiService";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    testGeminiConnection();
    testOpenAIConnection();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AIProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/experiment" element={<ProtectedRoute><ExperimentConsole /></ProtectedRoute>} />
                <Route path="/experiment/exp2" element={<ProtectedRoute><Exp2PipelineComparison /></ProtectedRoute>} />
                <Route path="/experiment/exp3" element={<ProtectedRoute><Exp3RobustnessTest /></ProtectedRoute>} />
                <Route path="/experiment/exp4" element={<ProtectedRoute><Exp4PromptSensitivity /></ProtectedRoute>} />
                <Route path="/experiment/exp5" element={<ProtectedRoute><Exp5ConsistencyTest /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
