import React, { createContext, useContext, useState, useEffect } from "react";

export type AIModelType =
  | "openai-gpt4o"
  | "google-gemini-25-pro"
  | "anthropic-claude-sonnet5"
  | "xai-grok4"
  | "google-gemini-25-flash"
  | "amazon-nova-pro"
  | "openai-gpt4o-mini"
  | "mistral-medium"
  | "qwen-vl-32b"
  | "meta-llama4"
  | "google-gemma4-31b";

// Legacy provider type compatibility (if referenced anywhere)
export type AIProviderType = "openrouter";

export function getProviderFamily(_model: AIModelType): AIProviderType {
  return "openrouter";
}

/** Lookup table: frontend key → OpenRouter model string */
export const MODEL_ID_MAP: Record<AIModelType, string> = {
  "openai-gpt4o": "openai/gpt-4o",
  "google-gemini-25-pro": "google/gemini-2.5-pro",
  "anthropic-claude-sonnet5": "anthropic/claude-sonnet-5",
  "xai-grok4": "x-ai/grok-4.3",
  "google-gemini-25-flash": "google/gemini-2.5-flash",
  "amazon-nova-pro": "amazon/nova-pro-v1",
  "openai-gpt4o-mini": "openai/gpt-4o-mini",
  "mistral-medium": "mistralai/mistral-medium-3-5",
  "qwen-vl-32b": "qwen/qwen3-vl-32b-instruct",
  "meta-llama4": "meta-llama/llama-4-maverick",
  "google-gemma4-31b": "google/gemma-4-31b-it",
};

export const AI_MODEL_OPTIONS: { value: AIModelType; label: string; description: string; icon: string }[] = [
  // Google
  { value: "google-gemini-25-pro", label: "Gemini 2.5 Pro", description: "google/gemini-2.5-pro", icon: "/logos/gemini.png" },
  { value: "google-gemini-25-flash", label: "Gemini 2.5 Flash", description: "google/gemini-2.5-flash", icon: "/logos/gemini.png" },
  { value: "google-gemma4-31b", label: "Gemma 4 31B", description: "google/gemma-4-31b-it", icon: "/logos/gemma.png" },

  // OpenAI
  { value: "openai-gpt4o", label: "GPT-4o", description: "openai/gpt-4o", icon: "/logos/openai.png" },
  { value: "openai-gpt4o-mini", label: "GPT-4o Mini", description: "openai/gpt-4o-mini", icon: "/logos/openai.png" },

  // Anthropic
  { value: "anthropic-claude-sonnet5", label: "Claude Sonnet 3.5/5", description: "anthropic/claude-sonnet-5", icon: "/logos/claude.png" },

  // xAI
  { value: "xai-grok4", label: "Grok 4.3", description: "x-ai/grok-4.3", icon: "/logos/grok.png" },

  // Amazon
  { value: "amazon-nova-pro", label: "Amazon Nova Pro", description: "amazon/nova-pro-v1", icon: "/logos/amazon.png" },

  // Mistral
  { value: "mistral-medium", label: "Mistral Medium 3.5", description: "mistralai/mistral-medium-3-5", icon: "/logos/mistral.png" },

  // Qwen
  { value: "qwen-vl-32b", label: "Qwen 3 VL 32B", description: "qwen/qwen3-vl-32b-instruct", icon: "/logos/qwen.png" },

  // Meta
  { value: "meta-llama4", label: "Llama 4 Maverick", description: "meta-llama/llama-4-maverick", icon: "/logos/llama.png" },
];

const LEGACY_MIGRATION_MAP: Record<string, AIModelType> = {
  "gemini-flash": "google-gemini-25-flash",
  "gemini-pro": "google-gemini-25-pro",
  "openai-mini": "openai-gpt4o-mini",
  "openai-pro": "openai-gpt4o",
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
  const [model, setModelState] = useState<AIModelType>("google-gemini-25-flash");
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
      setModelState("google-gemini-25-flash");
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

