import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Check,
  Copy,
  X,
  ArrowRight,
  User,
  Plus,
  FileText,
  Settings,
} from "lucide-react";
import { chatWithOnlineAi, cleanAiMarkdown, type ChatMessage } from "@/lib/ai";
import { useAiStore } from "@/stores/ai";
import { useUi } from "@/stores/ui";
import { Spinner } from "@/components/ui/Spinner";
import { GeminiIcon } from "@/components/ui/GeminiIcon";
import { cx } from "@/lib/utils";

interface AskMarkSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  noteTitle?: string;
  noteContent?: string;
  onInsertResult?: (text: string, replaceSelection: boolean) => void;
  hideHeader?: boolean;
}

export function AskMarkSidebar({
  isOpen,
  onClose,
  selectedText: propSelectedText,
  noteTitle: propNoteTitle,
  noteContent: propNoteContent,
  onInsertResult: propOnInsertResult,
  hideHeader = false,
}: AskMarkSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareContext, setShareContext] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uiStore = useUi();
  const selectedText = propSelectedText ?? uiStore.activeNoteSelectedText;
  const noteTitle = propNoteTitle ?? uiStore.activeNoteTitle ?? "Nota Sem Título";
  const noteContent = propNoteContent ?? uiStore.activeNoteContent ?? "";

  const handleInsertResult = (text: string, replaceSelection: boolean) => {
    if (propOnInsertResult) {
      propOnInsertResult(text, replaceSelection);
    } else {
      window.dispatchEvent(
        new CustomEvent("markd:note-action", {
          detail: { action: "insert-ai-text", text, replace: replaceSelection },
        })
      );
    }
  };

  const {
    activeProvider,
    groqApiKey,
    openaiApiKey,
    claudeApiKey,
    qwenApiKey,
  } = useAiStore();

  const setSettingsOpen = useUi((state) => state.setSettingsOpen);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const providerNames = {
    ollama_cloud: "Ollama Cloud ☁️",
    gemini: "Google Gemini Online 🌐",
    groq: "Groq Llama 3.3 ⚡",
    openai: "OpenAI ChatGPT 🟢",
    claude: "Anthropic Claude 🎭",
    qwen: "Qwen Cloud ☁️",
  };

  const hasApiKey =
    (activeProvider === "gemini") ||
    (activeProvider === "ollama_cloud") ||
    (activeProvider === "groq" && !!groqApiKey) ||
    (activeProvider === "openai" && !!openaiApiKey) ||
    (activeProvider === "claude" && !!claudeApiKey) ||
    (activeProvider === "qwen" && !!qwenApiKey);

  const handleSendMessage = async (userPrompt?: string) => {
    const textToSend = userPrompt || inputText;
    if (!textToSend.trim()) return;

    if (!hasApiKey) {
      setError(`A chave da API para ${providerNames[activeProvider]} não foi configurada.`);
      return;
    }

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", text: textToSend.trim() },
    ];

    setMessages(newMessages);
    if (!userPrompt) setInputText("");
    setLoading(true);
    setError(null);

    try {
      const responseText = await chatWithOnlineAi({
        messages: newMessages,
        noteTitle: shareContext ? noteTitle : undefined,
        noteContent: shareContext ? (selectedText || noteContent) : undefined,
      });

      setMessages([...newMessages, { role: "assistant", text: responseText }]);
    } catch (err: any) {
      setError(err.message || `Erro na comunicação com a IA.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={cx("relative flex h-full w-full flex-col bg-bg transition-all duration-200", !hideHeader && "border-l border-line shadow-2xl z-30")}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-panel/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <GeminiIcon size={15} />
                <span>Peça ao Gemini</span>
              </h3>
              <span className="text-[10px] text-faint flex items-center gap-1 font-medium">
                {providerNames[activeProvider]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1.5 text-faint hover:bg-hover hover:text-ink"
              title="Configurações de IA"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-faint hover:bg-hover hover:text-ink"
              title="Fechar painel"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
        {/* Missing API Key Warning */}
        {!hasApiKey && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 shadow-xs">
            <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Configure a Chave da API ({providerNames[activeProvider]})
            </h4>
            <p className="text-[11px] text-faint leading-relaxed">
              Você selecionou a IA <b>{providerNames[activeProvider]}</b>. Cole sua chave de API nas configurações do Markd para começar a usar.
            </p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/30"
            >
              <Settings size={14} /> Abrir Configurações de IA
            </button>
          </div>
        )}

        {/* Empty State / Greeting */}
        {messages.length === 0 && (
          <div className="my-auto space-y-5 pt-2">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                Olá, Diego
              </h2>
              <p className="text-xl font-medium text-ink">
                Como posso ajudar com suas notas hoje?
              </p>
            </div>

            {/* Context Badge */}
            {shareContext && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-panel/70 p-2.5 text-xs text-ink shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={15} className="text-purple-500 shrink-0" />
                  <span className="truncate text-faint">
                    Compartilhando <strong className="text-ink">"{noteTitle}"</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShareContext(false)}
                  className="text-faint hover:text-ink shrink-0 ml-1"
                  title="Remover contexto da nota"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Quick Action Pills */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSendMessage("Resuma os pontos principais desta nota em marcadores")}
                className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
              >
                Resumir os pontos principais desta nota
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Corrija os erros de ortografia e melhore o estilo deste texto")}
                className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
              >
                Corrigir a ortografia e melhorar o estilo do texto
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Crie uma lista de tarefas detalhada a partir deste texto")}
                className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
              >
                Criar uma lista de tarefas a partir desta nota
              </button>
            </div>
          </div>
        )}

        {/* Chat Stream */}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col gap-1.5 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-faint">
              {msg.role === "user" ? (
                <>
                  <span>Você</span> <User size={12} />
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-purple-500" />{" "}
                  <span>Mark IA</span>
                </>
              )}
            </div>
            <div
              className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-br-none"
                  : "bg-panel border border-line text-ink rounded-bl-none whitespace-pre-wrap"
              }`}
            >
              {msg.role === "assistant" ? cleanAiMarkdown(msg.text) : msg.text}
            </div>

            {/* Actions under assistant message */}
            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 pt-1 text-[11px] text-faint">
                <button
                  type="button"
                  onClick={() => handleCopy(cleanAiMarkdown(msg.text))}
                  className="flex items-center gap-1 hover:text-ink"
                >
                  <Copy size={12} /> Copiar
                </button>
                {selectedText && (
                  <button
                    type="button"
                    onClick={() => handleInsertResult(cleanAiMarkdown(msg.text), true)}
                    className="flex items-center gap-1 hover:text-ink font-medium text-purple-500"
                  >
                    <Check size={12} /> Substituir Seleção
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleInsertResult(cleanAiMarkdown(msg.text), false)}
                  className="flex items-center gap-1 hover:text-ink font-medium text-indigo-500"
                >
                  <ArrowRight size={12} /> Inserir na Nota
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-faint py-2">
            <Spinner size={16} />
            <span>Mark IA está pensando e escrevendo...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-ink space-y-1">
            <p className="text-red-500 font-semibold">Erro de Conexão com a IA</p>
            <p className="text-faint leading-relaxed">{error}</p>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom Input Card */}
      <div className="border-t border-line bg-panel/30 p-3">
        <div className="relative rounded-2xl border border-line bg-panel p-2 shadow-sm focus-within:border-purple-500">
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte algo ou peça para escrever..."
            className="w-full bg-transparent px-2 text-xs text-ink outline-none placeholder:text-faint resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && inputText.trim() && !loading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <div className="flex items-center justify-between border-t border-line/40 pt-2 px-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-hover text-faint hover:text-ink"
                title="Anexar"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              type="button"
              disabled={loading || !inputText.trim()}
              onClick={() => handleSendMessage()}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-white shadow-xs hover:bg-purple-700 disabled:opacity-40"
            >
              <Sparkles size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
