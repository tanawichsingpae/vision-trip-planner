import React, { createContext, useContext, useState, useEffect } from "react";

export type AIModelType =
  | "anthropic-claude-sonnet5"
  | "openai-gpt-54"
  | "google-gemini-38-flash"
  | "openai-gpt-54-mini"
  | "qwen-38-flash"
  | "meta-llama4";

// Legacy provider type compatibility (if referenced anywhere)
export type AIProviderType = "openrouter";

export function getProviderFamily(_model: AIModelType): AIProviderType {
  return "openrouter";
}

/** Lookup table: frontend key → OpenRouter model string */
export const MODEL_ID_MAP: Record<AIModelType, string> = {
  "anthropic-claude-sonnet5": "anthropic/claude-sonnet-5",
  "openai-gpt-54": "openai/gpt-5.4",
  "google-gemini-38-flash": "google/gemini-3.8-flash",
  "openai-gpt-54-mini": "openai/gpt-5.4-mini",
  "qwen-38-flash": "qwen/qwen3.8-flash",
  "meta-llama4": "meta-llama/llama-4-maverick",
};

export const AI_MODEL_OPTIONS: { value: AIModelType; label: string; description: string; icon: string }[] = [
  // Anthropic
  { value: "anthropic-claude-sonnet5", label: "Claude Sonnet 5", description: "anthropic/claude-sonnet-5", icon: "/logos/claude.png" },

  // OpenAI
  { value: "openai-gpt-54", label: "GPT-5.4", description: "openai/gpt-5.4", icon: "/logos/openai.png" },
  { value: "openai-gpt-54-mini", label: "GPT-5.4 Mini", description: "openai/gpt-5.4-mini", icon: "/logos/openai.png" },

  // Google
  { value: "google-gemini-38-flash", label: "Gemini 3.8 Flash", description: "google/gemini-3.8-flash", icon: "/logos/gemini.png" },

  // Qwen
  { value: "qwen-38-flash", label: "Qwen 3.8 Flash", description: "qwen/qwen3.8-flash", icon: "/logos/qwen.png" },

  // Meta
  { value: "meta-llama4", label: "Llama 4 Maverick", description: "meta-llama/llama-4-maverick", icon: "/logos/llama.png" },
];

const LEGACY_MIGRATION_MAP: Record<string, AIModelType> = {
  "qwen-vl-32b": "qwen-38-flash",
  "qwen-vl": "qwen-38-flash",
  "qwen3-vl-32b": "qwen-38-flash",
  "google-gemini-25-flash": "google-gemini-38-flash",
  "google-gemini-25-pro": "google-gemini-38-flash",
  "gemini-flash": "google-gemini-38-flash",
  "gemini-pro": "google-gemini-38-flash",
  "openai-gpt4o": "openai-gpt-54",
  "openai-pro": "openai-gpt-54",
  "openai-gpt4o-mini": "openai-gpt-54-mini",
  "openai-mini": "openai-gpt-54-mini",
  "google-gemma4-31b": "google-gemini-38-flash",
  "xai-grok4": "openai-gpt-54",
  "amazon-nova-pro": "google-gemini-38-flash",
  "mistral-medium": "anthropic-claude-sonnet5",
};

/**
 * Helper to get user-friendly label, icon, and description for any AI model key or ID.
 */
export function getAIModelInfo(modelKeyOrId?: string | null) {
  if (!modelKeyOrId) return null;
  const found = AI_MODEL_OPTIONS.find(
    (opt) =>
      opt.value === modelKeyOrId ||
      opt.description === modelKeyOrId ||
      opt.label.toLowerCase() === modelKeyOrId.toLowerCase()
  );
  if (found) return found;

  // Check OpenRouter model ID mapping
  for (const [key, id] of Object.entries(MODEL_ID_MAP)) {
    if (id === modelKeyOrId || key === modelKeyOrId) {
      const match = AI_MODEL_OPTIONS.find((opt) => opt.value === key);
      if (match) return match;
    }
  }

  // Fallback formatted label
  return {
    value: modelKeyOrId as AIModelType,
    label: modelKeyOrId
      .replace(/^google-|^openai-|^anthropic-|^xai-|^amazon-|^mistral-|^qwen-|^meta-/, "")
      .replace(/-/g, " ")
      .toUpperCase(),
    description: modelKeyOrId,
    icon: "/logos/gemini.png",
  };
}

interface AIContextType {
  model: AIModelType;
  setModel: (model: AIModelType) => void;
  provider: AIProviderType;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children: React.ReactNode }) => {
  const [model, setModelState] = useState<AIModelType>("google-gemini-38-flash");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ai_model");
    if (saved && saved in MODEL_ID_MAP) {
      setModelState(saved as AIModelType);
    } else if (saved && saved in LEGACY_MIGRATION_MAP) {
      const migrated = LEGACY_MIGRATION_MAP[saved];
      setModelState(migrated);
      localStorage.setItem("ai_model", migrated);
    } else {
      setModelState("google-gemini-38-flash");
    }
    setIsInitialized(true);
  }, []);

  const setModel = (newModel: AIModelType) => {
    setModelState(newModel);
    localStorage.setItem("ai_model", newModel);
  };

  if (!isInitialized) return null;

  return (
    <AIContext.Provider value={{ model, setModel, provider: "openrouter" }}>
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

