import React, { createContext, useContext, useState, useEffect } from "react";

export type AIModelType =
  | "gemini-flash"
  | "gemini-pro"
  | "openai-mini"
  | "openai-pro";

// Backwards-compat helper: which "provider family" does this model belong to?
export type AIProviderType = "gemini" | "openai";

export function getProviderFamily(model: AIModelType): AIProviderType {
  return model.startsWith("gemini") ? "gemini" : "openai";
}

/** Lookup table: frontend key → backend model string */
export const MODEL_ID_MAP: Record<AIModelType, string> = {
  "gemini-flash": "gemini-2.5-flash",
  "gemini-pro": "gemini-1.5-pro",
  "openai-mini": "gpt-4o-mini",
  "openai-pro": "gpt-4o",
};

export const AI_MODEL_OPTIONS: { value: AIModelType; label: string; description: string; icon: string }[] = [
  { value: "gemini-flash", label: "Gemini 2.5 Flash", description: "เร็ว", icon: "🚀" },
  { value: "gemini-pro", label: "Gemini 1.5 Pro", description: "ฉลาด/ภาพยากๆ", icon: "🧠" },
  { value: "openai-mini", label: "GPT-4o Mini", description: "เร็ว", icon: "🚀" },
  { value: "openai-pro", label: "GPT-4o", description: "ฉลาด", icon: "🧠" },
];

interface AIContextType {
  model: AIModelType;
  setModel: (model: AIModelType) => void;
  // Keep old "provider" for backwards compat in the codebase
  provider: AIProviderType;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children: React.ReactNode }) => {
  const [model, setModelState] = useState<AIModelType>("gemini-flash");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ai_model") as AIModelType;
    const validKeys: AIModelType[] = ["gemini-flash", "gemini-pro", "openai-mini", "openai-pro"];
    if (validKeys.includes(saved)) {
      setModelState(saved);
    } else {
      // Migrate old format
      const oldProvider = localStorage.getItem("ai_provider");
      if (oldProvider === "openai") setModelState("openai-mini");
    }
    setIsInitialized(true);
  }, []);

  const setModel = (newModel: AIModelType) => {
    setModelState(newModel);
    localStorage.setItem("ai_model", newModel);
  };

  if (!isInitialized) return null;

  return (
    <AIContext.Provider value={{ model, setModel, provider: getProviderFamily(model) }}>
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
