import React, { createContext, useContext, useState, useEffect } from "react";

export type AIProviderType = "gemini" | "openai";

interface AIContextType {
  provider: AIProviderType;
  setProvider: (provider: AIProviderType) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children: React.ReactNode }) => {
  const [provider, setProviderState] = useState<AIProviderType>("gemini");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ai_provider") as AIProviderType;
    if (saved === "gemini" || saved === "openai") {
      setProviderState(saved);
    }
    setIsInitialized(true);
  }, []);

  const setProvider = (newProvider: AIProviderType) => {
    setProviderState(newProvider);
    localStorage.setItem("ai_provider", newProvider);
  };

  if (!isInitialized) return null; // Avoid hydration flash

  return (
    <AIContext.Provider value={{ provider, setProvider }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
};
