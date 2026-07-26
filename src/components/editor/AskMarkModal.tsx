import { useState } from "react";
import Markdown from "react-markdown";
import { Sparkles, Check, Copy, X, ArrowRight, Key } from "lucide-react";
import { askMark } from "@/lib/ai";
import { useAiStore } from "@/stores/ai";
import { useUi } from "@/stores/ui";
import { Spinner } from "@/components/ui/Spinner";
import { GeminiIcon } from "@/components/ui/GeminiIcon";

interface AskMarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  onInsertResult: (text: string, replaceSelection: boolean) => void;
}

export function AskMarkModal({
  isOpen,
  onClose,
  selectedText,
  onInsertResult,
}: AskMarkModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { qwenApiKey } = useAiStore();
  const { openSettings } = useUi();

  if (!isOpen) return null;

  const handleRun = async (actionType: "custom" | "correct" | "improve" | "summarize" | "expand" | "translate", customPrompt?: string) => {
    setError(null);
    setLoading(true);
    setResult("");

    try {
      const output = await askMark({
        prompt: customPrompt || prompt,
        selectedText,
        actionType,
      });
      setResult(output);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao consultar o Mark.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-xl border border-line bg-bg p-5 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white shadow-md">
              <GeminiIcon size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Peça ao Gemini ✨</h3>
              <p className="text-xs text-faint">Assistente de IA com Gemini, Qwen & OpenRouter</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-faint hover:bg-hover hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 space-y-4">
          {!qwenApiKey ? (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4 text-center">
              <Key className="mx-auto mb-2 text-purple-500" size={24} />
              <p className="text-sm font-medium text-ink">Chave de API do Qwen não configurada</p>
              <p className="mt-1 text-xs text-faint">
                Para usar o <b>Peça ao Mark ✨</b>, adicione sua chave de API do Qwen nas configurações (Settings).
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSettings("general");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700"
              >
                Configurar Chave de API
              </button>
            </div>
          ) : (
            <>
              {/* Quick Preset Buttons if text is selected */}
              {selectedText && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-faint">Ações rápidas para o texto selecionado:</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRun("correct")}
                      className="rounded-md border border-line bg-muted px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50"
                    >
                      🪄 Corrigir Ortografia
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRun("improve")}
                      className="rounded-md border border-line bg-muted px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50"
                    >
                      📝 Melhorar Texto
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRun("summarize")}
                      className="rounded-md border border-line bg-muted px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50"
                    >
                      📋 Resumir
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRun("translate")}
                      className="rounded-md border border-line bg-muted px-2.5 py-1 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50"
                    >
                      🌐 Traduzir
                    </button>
                  </div>
                </div>
              )}

              {/* Prompt Input */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-faint">
                  {selectedText ? "Ou digite um comando específico:" : "O que você quer que o Mark escreva ou faça?"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Crie um roteiro de apresentação em 5 tópicos..."
                    className="flex-1 rounded-lg border border-line bg-muted px-3 py-2 text-sm text-ink outline-none focus:border-amber-500 placeholder:text-faint"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && prompt.trim() && !loading) {
                        handleRun("custom");
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={loading || !prompt.trim()}
                    onClick={() => handleRun("custom")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? <Spinner size={16} /> : <Sparkles size={16} />}
                    Gerar
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-faint">
                  <Spinner size={20} />
                  <span>Mark está pensando e escrevendo...</span>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                  {error}
                </div>
              )}

              {/* Result Preview Box */}
              {result && !loading && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-faint">Resultado:</label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-line bg-muted p-3 text-sm text-ink select-text [&_p]:leading-relaxed [&_p]:my-1.5 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_hr]:my-2 [&_hr]:border-line [&_strong]:font-semibold">
                    <Markdown>{result}</Markdown>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink"
                    >
                      <Copy size={14} /> Copiar
                    </button>
                    <div className="flex gap-2">
                      {selectedText && (
                        <button
                          type="button"
                          onClick={() => {
                            onInsertResult(result, true);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-hover px-3 py-1.5 text-xs font-medium text-ink hover:bg-line"
                        >
                          <Check size={14} /> Substituir Seleção
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onInsertResult(result, false);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90"
                      >
                        <ArrowRight size={14} /> Inserir na Nota
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
