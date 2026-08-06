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
