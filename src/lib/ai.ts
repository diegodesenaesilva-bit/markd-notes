import { useAiStore } from "@/stores/ai";
import { ipc, isTauriAvailable } from "@/lib/ipc";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

export interface AskMarkOptions {
  prompt: string;
  selectedText?: string;
  actionType?: string;
}

export interface ChatWithOnlineAiOptions {
  messages: ChatMessage[];
  noteTitle?: string;
  noteContent?: string;
  useSearchGrounding?: boolean;
  images?: Array<{ data: string; mimeType: string }>;
}

export interface AiResponse {
  text: string;
  groundingMetadata?: any;
}

export function cleanAiMarkdown(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  const match = cleaned.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  if (cleaned.startsWith("```markdown") && cleaned.endsWith("```")) {
    cleaned = cleaned.substring(11, cleaned.length - 3).trim();
  } else if (cleaned.startsWith("```") && cleaned.endsWith("```")) {
    cleaned = cleaned.substring(3, cleaned.length - 3).trim();
  }
  return cleaned;
}

/**
 * Helper to test current active AI provider connection
 */
export async function testOnlineAiConnection(): Promise<string> {
  const res = await chatWithOnlineAi({
    messages: [{ role: "user", text: "Diga apenas a palavra 'OK' em maiúsculo para testar a conexão." }],
  });
  return res.text;
}

/**
 * Quick Single Prompt Helper for AskMarkModal
 */
export async function askMark(options: AskMarkOptions): Promise<string> {
  const promptText = options.actionType === "correct"
    ? "Corrija os erros de ortografia e gramática do texto fornecido."
    : options.actionType === "summarize"
      ? "Faça um resumo bem estruturado dos pontos principais do texto fornecido."
      : options.actionType === "improve"
        ? "Melhore o estilo, a clareza e o tom do texto fornecido."
        : options.prompt;

  const res = await chatWithOnlineAi({
    messages: [{ role: "user", text: promptText }],
    noteContent: options.selectedText,
  });
  return res.text;
}

/**
 * Universal Online AI Assistant Dispatcher
 */
export async function chatWithOnlineAi(options: ChatWithOnlineAiOptions): Promise<AiResponse> {
  const store = useAiStore.getState();
  const provider = store.activeProvider;

  const contextHeader = options.noteTitle || options.noteContent
    ? `[CONTEXTO DA NOTA ATUAL DO USUÁRIO]:
Título: ${options.noteTitle || "Sem Título"}
Conteúdo da Nota:
---
${options.noteContent || "(Nota Vazia)"}
---
Por favor, responda à solicitação do usuário levando em conta este contexto da nota. Seja prestativo, claro e responda em Português do Brasil.\n\n`
    : "";

  let resText = "";
  let meta: any = null;

  switch (provider) {
    case "ollama_cloud":
      resText = await chatWithOllamaCloud(options.messages, contextHeader, store.ollamaCloudApiKey, store.ollamaCloudUrl, store.ollamaCloudModel);
      break;
    case "gemini": {
      const geminiRes = await chatWithGemini(
        options.messages,
        contextHeader,
        store.geminiApiKey,
        store.geminiModel,
        options.useSearchGrounding,
        options.images
      );
      if (typeof geminiRes === "string") {
        resText = geminiRes;
      } else {
        resText = geminiRes.text;
        meta = geminiRes.groundingMetadata;
      }
      break;
    }
    case "groq":
      resText = await chatWithGroq(options.messages, contextHeader, store.groqApiKey, store.groqModel);
      break;
    case "openai":
      resText = await chatWithOpenAi(options.messages, contextHeader, store.openaiApiKey, store.openaiModel);
      break;
    case "claude":
      resText = await chatWithClaude(options.messages, contextHeader, store.claudeApiKey, store.claudeModel);
      break;
    case "qwen":
      resText = await chatWithQwenCloud(options.messages, contextHeader, store.qwenApiKey, store.qwenModel);
      break;
    default:
      throw new Error("Provedor de IA Online inválido.");
  }

  return { text: resText, groundingMetadata: meta };
}

/**
 * 0. Ollama Cloud / Remote API
 */
async function chatWithOllamaCloud(
  messages: ChatMessage[],
  contextHeader: string,
  apiKey: string,
  url: string,
  model: string
): Promise<string> {
  const cleanUrl = (url || "https://ollama.com").replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const formattedMessages = [
    {
      role: "system",
      content: "Você é o Mark, assistente de IA especialista em produtividade no Markd. Responda em Português.",
    },
    ...messages.map((m, idx) => ({
      role: m.role,
      content: idx === messages.length - 1 ? `${contextHeader}${m.text}` : m.text,
    })),
  ];

  // Try OpenAI compatible endpoint first (/v1/chat/completions) then native (/api/chat)
  let endpoint = `${cleanUrl}/v1/chat/completions`;
  let body: any = {
    model: model || "qwen2.5",
    messages: formattedMessages,
  };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    // Retry native Ollama endpoint if OpenAI compatibility endpoint failed
    try {
      endpoint = `${cleanUrl}/api/chat`;
      body = {
        model: model || "qwen2.5",
        messages: formattedMessages,
        stream: false,
      };
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (retryErr: any) {
      throw new Error(`Falha de Conexão com Ollama Cloud (${cleanUrl}): ${retryErr.message || err.message}`);
    }
  }

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    const detail = data.error?.message || data.message || data.error || data.rawText || `Status HTTP ${res.status}`;
    throw new Error(`Erro na API do Ollama Cloud (HTTP ${res.status}): ${detail}`);
  }

  return (
    data.choices?.[0]?.message?.content ||
    data.message?.content ||
    data.rawText ||
    "Sem resposta do Ollama Cloud."
  );
}

/**
 * 1. Google Gemini Online API
 */
async function chatWithGemini(
  messages: ChatMessage[],
  contextHeader: string,
  apiKey: string,
  model: string,
  useSearchGrounding?: boolean,
  images?: Array<{ data: string; mimeType: string }>
): Promise<AiResponse | string> {
  const lastUserMsg = messages[messages.length - 1]?.text || "";

  // 1. Try server-side Gemini API route first (for web mode)
  try {
    const res = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        prompt: lastUserMsg,
        noteTitle: contextHeader,
        useSearchGrounding,
        images,
        apiKey: apiKey?.trim() || "",
        model: model || "gemini-2.5-flash",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        return {
          text: data.text,
          groundingMetadata: data.groundingMetadata,
        };
      }
    } else if (res.status !== 404) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
    }
  } catch (err: any) {
    if (err instanceof Error && err.message && !err.message.includes("Failed to fetch") && !err.message.includes("NetworkError") && !err.message.includes("fetch")) {
      throw err;
    }
    // Expected on standalone desktop Tauri app with no server
  }

  // 2. Resolve API Key: user personal key -> environment variable
  const effectiveKey =
    apiKey.trim() ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    "";

  if (!effectiveKey) {
    throw new Error(
      "Chave da API do Google Gemini não encontrada. No aplicativo local para Windows, por favor insira sua chave do Google AI Studio em Configurações -> Geral -> Chave de API Pessoal."
    );
  }

  // 3. Map model name to valid Google Generative Language REST API model
  let targetModel = (model || "gemini-2.5-flash").trim();
  if (targetModel.includes("3.6") || targetModel === "gemini-3.6-flash") {
    targetModel = "gemini-2.5-flash";
  }

  const systemPrompt = "Você é o Mark, assistente de IA no Markd. Responda em Português do Brasil.";
  const fullPrompt = `${systemPrompt}\n\n${contextHeader}Solicitação: ${lastUserMsg}`;

  const parts: any[] = [];
  if (images && Array.isArray(images) && images.length > 0) {
    for (const img of images) {
      if (img.data && img.mimeType) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data.replace(/^data:[^;]+;base64,/, ""),
          },
        });
      }
    }
  }
  parts.push({ text: fullPrompt });

  const contents = messages.map((m, idx) => ({
    role: m.role === "user" ? "user" : "model",
    parts: idx === messages.length - 1 ? parts : [{ text: m.text }],
  }));

  const reqBody: any = { contents };
  if (useSearchGrounding) {
    reqBody.tools = [{ googleSearch: {} }];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${effectiveKey}`;

  // If running inside desktop Tauri app, use Rust native reqwest to bypass WebView CORS
  if (isTauriAvailable()) {
    try {
      const responseText = await ipc.geminiGenerate(url, JSON.stringify(reqBody));
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { rawText: responseText };
      }

      const candidate = data.candidates?.[0];
      const resultText = candidate?.content?.parts?.[0]?.text;
      if (!resultText) {
        if (data.error?.message) {
          throw new Error(`Erro na API do Google Gemini: ${data.error.message}`);
        }
        throw new Error("O Google Gemini não retornou nenhum texto de resposta.");
      }

      return {
        text: resultText,
        groundingMetadata: candidate?.groundingMetadata,
      };
    } catch (err: any) {
      throw new Error(err.message || "Falha ao conectar com o Google Gemini via app desktop.");
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    });
  } catch (err: any) {
    throw new Error(`Falha de rede ao conectar à API do Google Gemini: ${err.message || "Erro de conexão"}`);
  }

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    const errorDetail = data.error?.message || data.rawText || `Status HTTP ${res.status}`;
    throw new Error(`Erro no Google Gemini (HTTP ${res.status}): ${errorDetail}`);
  }

  const candidate = data.candidates?.[0];
  const resultText = candidate?.content?.parts?.[0]?.text;
  if (!resultText) {
    throw new Error("O Google Gemini não retornou nenhum texto de resposta.");
  }

  return {
    text: resultText,
    groundingMetadata: candidate?.groundingMetadata,
  };
}

/**
 * 2. Groq Online API (Llama 3.3 70B - Fast & Free Tier)
 */
async function chatWithGroq(
  messages: ChatMessage[],
  contextHeader: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error("Chave da API do Groq não configurada. Obtenha grátis em console.groq.com e salve em Settings -> General.");
  }

  const formattedMessages = [
    {
      role: "system",
      content: "Você é o Mark, assistente de IA inteligente do editor de notas Markd. Responda em Português.",
    },
    ...messages.map((m, idx) => ({
      role: m.role,
      content: idx === messages.length - 1 ? `${contextHeader}${m.text}` : m.text,
    })),
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model || "llama-3.3-70b-versatile",
      messages: formattedMessages,
      temperature: 0.7,
    }),
  }).catch((err) => {
    throw new Error(`Falha de rede ao conectar à API da Groq: ${err.message}`);
  });

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    throw new Error(`Erro na API da Groq (HTTP ${res.status}): ${data.error?.message || data.rawText}`);
  }

  return data.choices?.[0]?.message?.content || "Sem resposta do Groq.";
}

/**
 * 3. OpenAI ChatGPT Online API
 */
async function chatWithOpenAi(
  messages: ChatMessage[],
  contextHeader: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error("Chave da API da OpenAI não configurada. Configure em Settings -> General.");
  }

  const formattedMessages = [
    {
      role: "system",
      content: "Você é o Mark, assistente de IA do editor de notas Markd. Responda em Português.",
    },
    ...messages.map((m, idx) => ({
      role: m.role,
      content: idx === messages.length - 1 ? `${contextHeader}${m.text}` : m.text,
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: formattedMessages,
    }),
  }).catch((err) => {
    throw new Error(`Falha de rede ao conectar à API da OpenAI: ${err.message}`);
  });

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    throw new Error(`Erro na OpenAI (HTTP ${res.status}): ${data.error?.message || data.rawText}`);
  }

  return data.choices?.[0]?.message?.content || "Sem resposta da OpenAI.";
}

/**
 * 4. Anthropic Claude Online API
 */
async function chatWithClaude(
  messages: ChatMessage[],
  contextHeader: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error("Chave da API da Anthropic Claude não configurada. Configure em Settings -> General.");
  }

  const formattedMessages = messages.map((m, idx) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: idx === messages.length - 1 ? `${contextHeader}${m.text}` : m.text,
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "dangerously-allow-browser": "true",
    },
    body: JSON.stringify({
      model: model || "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      system: "Você é o Mark, assistente de IA especialista em redação no Markd. Responda em Português.",
      messages: formattedMessages,
    }),
  }).catch((err) => {
    throw new Error(`Falha de rede ao conectar à API da Anthropic Claude: ${err.message}`);
  });

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    throw new Error(`Erro no Anthropic Claude (HTTP ${res.status}): ${data.error?.message || data.rawText}`);
  }

  return data.content?.[0]?.text || "Sem resposta do Claude.";
}

/**
 * 5. Qwen Cloud Online API (DashScope / Alibaba)
 */
async function chatWithQwenCloud(
  messages: ChatMessage[],
  contextHeader: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error("Chave da API do Qwen Cloud (sk-...) não configurada. Configure em Settings -> General.");
  }

  const baseUrl = apiKey.trim().startsWith("sk-or-")
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

  const formattedMessages = [
    {
      role: "system",
      content: "Você é o Mark, assistente de IA do editor de notas Markd. Responda em Português.",
    },
    ...messages.map((m, idx) => ({
      role: m.role,
      content: idx === messages.length - 1 ? `${contextHeader}${m.text}` : m.text,
    })),
  ];

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model || "qwen-max",
      messages: formattedMessages,
    }),
  }).catch((err) => {
    throw new Error(`Falha de rede ao conectar à API do Qwen Cloud: ${err.message}`);
  });

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    throw new Error(`Erro no Qwen Cloud (HTTP ${res.status}): ${data.error?.message || data.rawText}`);
  }

  return data.choices?.[0]?.message?.content || "Sem resposta do Qwen Cloud.";
}
