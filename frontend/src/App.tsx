import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AIProvider } from "@/context/AIProviderContext";
import Index from "./pages/Index.tsx";
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
    <AIProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AIProvider>
  </QueryClientProvider>
  );
};

export default App;
