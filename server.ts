import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK on server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.post("/api/gemini/generate", async (req, res) => {
  try {
    const { prompt, noteTitle, noteContent, action, messages } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "GEMINI_API_KEY não configurada no servidor. Verifique suas variáveis no painel Settings > Secrets.",
      });
    }

    const systemInstruction =
      "Você é o assistente de IA nativo do Markd (um aplicativo de notas local-first minimalista para macOS e Linux). Sua função é ajudar o usuário a escrever, analisar, resumir, expandir, organizar e extrair insights das notas. Responda em Português do Brasil com excelente clareza, tom útil e formatação Markdown limpa e bem estruturada.";

    let fullPrompt = "";
    if (noteTitle || noteContent) {
      fullPrompt += `[CONTEXTO DA NOTA ATUAL ("${noteTitle || "Sem título"}")]:\n\`\`\`markdown\n${noteContent || ""}\n\`\`\`\n\n`;
    }

    if (messages && Array.isArray(messages) && messages.length > 0) {
      const historyStr = messages
        .slice(0, -1)
        .map((m: any) => `${m.role === "user" ? "Usuário" : "Mark IA"}: ${m.text}`)
        .join("\n\n");
      if (historyStr) {
        fullPrompt += `HISTÓRICO DA CONVERSA:\n${historyStr}\n\n`;
      }
      const lastMsg = messages[messages.length - 1]?.text;
      if (lastMsg) {
        fullPrompt += `ÚLTIMA MENSAGEM DO USUÁRIO: ${lastMsg}`;
      }
    } else if (action === "summarize") {
      fullPrompt += "Por favor, crie um resumo executivo claro, elegante e direto (com marcadores) dos pontos principais desta nota.";
    } else if (action === "continue") {
      fullPrompt += "Continue o texto a partir de onde ele parou na nota, mantendo estritamente o mesmo estilo, tom de voz e estrutura Markdown.";
    } else if (action === "improve") {
      fullPrompt += "Revise e aprimore esta nota: corrija a gramática, melhore a clareza e organize a estrutura Markdown sem alterar os conceitos originais. Apresente a versão melhorada da nota.";
    } else if (action === "tags") {
      fullPrompt += "Analise esta nota e sugira de 3 a 6 tags curtas e relevantes e propriedades YAML (ex: status, categoria, prioridade, data).";
    } else if (action === "checklist") {
      fullPrompt += "Extraia ou elabore um plano de ação em forma de checklist de tarefas acionáveis no formato Markdown `- [ ] item`.";
    } else if (action === "explain") {
      fullPrompt += "Explique os principais conceitos, termos técnicos ou ideias discutidas nesta nota de forma didática e objetiva.";
    } else {
      fullPrompt += prompt ? `Solicitação: ${prompt}` : "Análise esta nota e forneça insights e sugestões úteis.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || "Não foi possível gerar uma resposta." });
  } catch (error: any) {
    console.error("[Gemini API Error]:", error);
    res.status(500).json({
      error: error?.message || "Ocorreu um erro ao comunicar com o Gemini.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Markd Server] Rodando na porta ${PORT}`);
  });
}

startServer();
