import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OnlineAiProvider = "gemini" | "groq" | "openai" | "claude" | "qwen" | "ollama_cloud";

interface AiState {
  activeProvider: OnlineAiProvider;
  geminiApiKey: string;
  groqApiKey: string;
  openaiApiKey: string;
  claudeApiKey: string;
  qwenApiKey: string;
  ollamaCloudApiKey: string;

  geminiModel: string;
  groqModel: string;
  openaiModel: string;
  claudeModel: string;
  qwenModel: string;
  ollamaCloudUrl: string;
  ollamaCloudModel: string;

  setActiveProvider: (provider: OnlineAiProvider) => void;
  setGeminiApiKey: (key: string) => void;
  setGroqApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setClaudeApiKey: (key: string) => void;
  setQwenApiKey: (key: string) => void;
  setOllamaCloudApiKey: (key: string) => void;

  setGeminiModel: (model: string) => void;
  setGroqModel: (model: string) => void;
  setOpenaiModel: (model: string) => void;
  setClaudeModel: (model: string) => void;
  setQwenModel: (model: string) => void;
  setOllamaCloudUrl: (url: string) => void;
  setOllamaCloudModel: (model: string) => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      activeProvider: "gemini",
      geminiApiKey: "",
      groqApiKey: "",
      openaiApiKey: "",
      claudeApiKey: "",
      qwenApiKey: "",
      ollamaCloudApiKey: "",

      geminiModel: "gemini-2.5-flash",
      groqModel: "llama-3.3-70b-versatile",
      openaiModel: "gpt-4o-mini",
      claudeModel: "claude-3-5-sonnet-20241022",
      qwenModel: "qwen-max",
      ollamaCloudUrl: "https://ollama.com",
      ollamaCloudModel: "qwen2.5",

      setActiveProvider: (activeProvider) => set({ activeProvider }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setGroqApiKey: (groqApiKey) => set({ groqApiKey }),
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      setClaudeApiKey: (claudeApiKey) => set({ claudeApiKey }),
      setQwenApiKey: (qwenApiKey) => set({ qwenApiKey }),
      setOllamaCloudApiKey: (ollamaCloudApiKey) => set({ ollamaCloudApiKey }),

      setGeminiModel: (geminiModel) => set({ geminiModel }),
      setGroqModel: (groqModel) => set({ groqModel }),
      setOpenaiModel: (openaiModel) => set({ openaiModel }),
      setClaudeModel: (claudeModel) => set({ claudeModel }),
      setQwenModel: (qwenModel) => set({ qwenModel }),
      setOllamaCloudUrl: (ollamaCloudUrl) => set({ ollamaCloudUrl }),
      setOllamaCloudModel: (ollamaCloudModel) => set({ ollamaCloudModel }),
    }),
    {
      name: "markd-online-ai-settings-v3",
    }
  )
);
