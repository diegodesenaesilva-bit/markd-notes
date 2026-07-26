import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { Copy, Check, Sparkles, Send, PenTool, MessageSquare, Briefcase, X } from "lucide-react";
import { chatWithOnlineAi } from "@/lib/ai";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";

interface WritingResult {
  formal: string;
  friendly: string;
  input: string;
  timestamp: number;
}

const STORAGE_KEY = "markd_writing_assistant_last";

export function WritingAssistantSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedFormal, setCopiedFormal] = useState(false);
  const [copiedFriendly, setCopiedFriendly] = useState(false);
  const [result, setResult] = useState<WritingResult | null>(null);
  const [refinementText, setRefinementText] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setResult(parsed);
        if (parsed?.input) setInputText(parsed.input);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!isOpen) return null;

  const handleGenerate = async (refinePrompt?: string) => {
    const textToProcess = inputText.trim();
    if (!textToProcess) {
      toast.error("Digite um texto para aprimorar.");
      return;
    }

    setLoading(true);
    try {
      const prompt = `Atue como um Assistente Especialista em Escrita e Comunicação.
Sua tarefa é pegar o texto fornecido pelo usuário (que pode conter gírias, erros de digitação, tom informal ou confuso) e reescrevê-lo em EXATAMENTE DUAS VERSÕES DISTINTAS:

1. VERSÃO FORMAL & PROFISSIONAL: Elegante, clara, correta gramaticalmente, ideal para e-mails corporativos, comunicados formais ou reuniões de trabalho.
2. VERSÃO AMIGÁVEL & HUMANA: Natural, acolhedora, leve e simpática, perfeita para mensagens instantâneas (WhatsApp, Slack, chats) mantendo o tom respeitoso e direto.

${refinePrompt ? `[AJUSTE ADICIONAL SOLICITADO PELO USUÁRIO]: ${refinePrompt}\n` : ""}

TEXTO DO USUÁRIO:
"""
${textToProcess}
"""

Responda APENAS no seguinte formato estrito em Português do Brasil:

[FORMAL]
(Escreva aqui a versão formal)

[AMIGAVEL]
(Escreva aqui a versão amigável)`;

      const response = await chatWithOnlineAi({
        messages: [{ role: "user", text: prompt }],
      });

      let formalText = "";
      let friendlyText = "";

      const formalMatch = response.match(/\[FORMAL\]([\s\S]*?)(?=\[AMIGAVEL\]|$)/i);
      const friendlyMatch = response.match(/\[AMIGAVEL\]([\s\S]*?)$/i);

      if (formalMatch && formalMatch[1]) {
        formalText = formalMatch[1].trim();
      }
      if (friendlyMatch && friendlyMatch[1]) {
        friendlyText = friendlyMatch[1].trim();
      }

      if (!formalText && !friendlyText) {
        formalText = response.trim();
        friendlyText = response.trim();
      }

      const newResult: WritingResult = {
        formal: formalText,
        friendly: friendlyText,
        input: textToProcess,
        timestamp: Date.now(),
      };

      setResult(newResult);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newResult));
    } catch (err: any) {
      toast.error("Erro ao gerar versões com a IA: " + (err?.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "formal" | "friendly") => {
    void navigator.clipboard.writeText(text).then(() => {
      if (type === "formal") {
        setCopiedFormal(true);
        setTimeout(() => setCopiedFormal(false), 2000);
      } else {
        setCopiedFriendly(true);
        setTimeout(() => setCopiedFriendly(false), 2000);
      }
      toast.success("Texto copiado para a área de transferência!");
    });
  };

  return (
    <div className="flex h-full flex-col bg-bg border-l border-line text-ink">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-line px-3 bg-sunken/40">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <PenTool size={14} />
          <span>Assistente de Escrita</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Input Textarea */}
        <div className="space-y-1.5">
          <label className="text-[11.5px] font-medium text-muted block">
            Digite ou cole seu rascunho:
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: manda essa mensagem pro cliente sobre o atraso do projeto sem parecer grosseiro..."
            rows={4}
            className="w-full resize-none rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] text-ink outline-none transition-colors focus:border-amber-500/50 placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleGenerate();
              }
            }}
          />
          <div className="flex items-center justify-between text-[11px] text-faint">
            <span>Atalho: ⌘+Enter ou Ctrl+Enter</span>
            <button
              type="button"
              disabled={loading || !inputText.trim()}
              onClick={() => handleGenerate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
            >
              {loading ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles size={13} />}
              <span>Aprimorar Texto</span>
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3 pt-2 border-t border-line-soft">
            {/* Version 1: Formal */}
            <div className="rounded-lg border border-line bg-panel p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-indigo-600 dark:text-indigo-400">
                  <Briefcase size={13} />
                  <span>Versão Formal & Profissional</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.formal, "formal")}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium bg-hover text-ink hover:bg-active"
                >
                  {copiedFormal ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedFormal ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
              <div className="text-[12.5px] leading-relaxed text-ink select-text [&_p]:leading-relaxed [&_p]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                <Markdown>{result.formal}</Markdown>
              </div>
            </div>

            {/* Version 2: Friendly */}
            <div className="rounded-lg border border-line bg-panel p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <MessageSquare size={13} />
                  <span>Versão Amigável & Humana</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.friendly, "friendly")}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium bg-hover text-ink hover:bg-active"
                >
                  {copiedFriendly ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedFriendly ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
              <div className="text-[12.5px] leading-relaxed text-ink select-text [&_p]:leading-relaxed [&_p]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                <Markdown>{result.friendly}</Markdown>
              </div>
            </div>

            {/* Refinement input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-medium text-faint block">
                Quer ajustar algo específico?
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={refinementText}
                  onChange={(e) => setRefinementText(e.target.value)}
                  placeholder="Ex: deixar mais curto, adicionar um agradecimento..."
                  className="flex-1 rounded-md border border-line bg-panel px-2.5 py-1 text-[12px] outline-none placeholder:text-faint"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && refinementText.trim()) {
                      e.preventDefault();
                      void handleGenerate(refinementText);
                      setRefinementText("");
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={loading || !refinementText.trim()}
                  onClick={() => {
                    void handleGenerate(refinementText);
                    setRefinementText("");
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md bg-hover text-ink disabled:opacity-50"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
