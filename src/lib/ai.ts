import { useAiStore } from "@/stores/ai";

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
  return chatWithOnlineAi({
    messages: [{ role: "user", text: "Diga apenas a palavra 'OK' em maiúsculo para testar a conexão." }],
  });
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

  return chatWithOnlineAi({
    messages: [{ role: "user", text: promptText }],
    noteContent: options.selectedText,
  });
}

/**
 * Universal Online AI Assistant Dispatcher
 */
export async function chatWithOnlineAi(options: ChatWithOnlineAiOptions): Promise<string> {
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

  switch (provider) {
    case "ollama_cloud":
      return chatWithOllamaCloud(options.messages, contextHeader, store.ollamaCloudApiKey, store.ollamaCloudUrl, store.ollamaCloudModel);
    case "gemini":
      return chatWithGemini(options.messages, contextHeader, store.geminiApiKey, store.geminiModel);
    case "groq":
      return chatWithGroq(options.messages, contextHeader, store.groqApiKey, store.groqModel);
    case "openai":
      return chatWithOpenAi(options.messages, contextHeader, store.openaiApiKey, store.openaiModel);
    case "claude":
      return chatWithClaude(options.messages, contextHeader, store.claudeApiKey, store.claudeModel);
    case "qwen":
      return chatWithQwenCloud(options.messages, contextHeader, store.qwenApiKey, store.qwenModel);
    default:
      throw new Error("Provedor de IA Online inválido.");
  }
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
  model: string
): Promise<string> {
  const lastUserMsg = messages[messages.length - 1]?.text || "";

  // Try server-side Gemini API route first
  try {
    const res = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        prompt: lastUserMsg,
        noteTitle: contextHeader,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text) return data.text;
    }
  } catch (err) {
    // If server route fails, continue to client fallback
  }

  if (!apiKey.trim()) {
    throw new Error("Chave da API do Google Gemini não configurada. Configure em Settings -> General.");
  }

  const systemPrompt = "Você é o Mark, assistente de IA no Markd. Responda em Português.";
  const fullPrompt = `${systemPrompt}\n\n${contextHeader}Solicitação: ${lastUserMsg}`;

  const contents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m === messages[messages.length - 1] ? fullPrompt : m.text }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-3.6-flash"}:generateContent?key=${apiKey.trim()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  ).catch((err) => {
    throw new Error(`Falha de rede ao conectar à API do Google Gemini: ${err.message}`);
  });

  const textPayload = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(textPayload);
  } catch {
    data = { rawText: textPayload };
  }

  if (!res.ok) {
    throw new Error(`Erro no Google Gemini (HTTP ${res.status}): ${data.error?.message || data.rawText}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do Gemini.";
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
