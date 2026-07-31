import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import {
  Sparkles,
  Check,
  Copy,
  X,
  ArrowRight,
  User,
  FileText,
  CalendarDays,
  CheckCircle2,
  Palette,
  Settings,
  Globe,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  ExternalLink,
  RotateCcw,
  Wand2,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { chatWithOnlineAi, cleanAiMarkdown, type ChatMessage } from "@/lib/ai";
import { useAiStore } from "@/stores/ai";
import { useUi } from "@/stores/ui";
import { useCopilot } from "@/stores/copilot";
import { useVault } from "@/stores/vault";
import { useCalendar } from "@/stores/calendar";
import { useTodos } from "@/stores/todos";
import { useCanvas } from "@/stores/canvas";
import { Spinner } from "@/components/ui/Spinner";
import { GeminiIcon } from "@/components/ui/GeminiIcon";
import { cx } from "@/lib/utils";
import { toast } from "sonner";

interface ExtendedChatMessage extends ChatMessage {
  groundingMetadata?: any;
  images?: string[];
  proposedNoteUpdate?: {
    explanation?: string;
    content: string;
    applied: boolean;
    previousContent?: string;
  };
}

interface AttachedImage {
  data: string;
  mimeType: string;
  preview: string;
}

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
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareContext, setShareContext] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gemini Features State
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  // Copilot Mode State from Zustand Store
  const copilotMode = useCopilot((s) => s.copilotMode);
  const setCopilotMode = useCopilot((s) => s.setCopilotMode);
  const autoApplyCopilot = useCopilot((s) => s.autoApplyCopilot);
  const setAutoApplyCopilot = useCopilot((s) => s.setAutoApplyCopilot);
  const inlineComments = useCopilot((s) => s.inlineComments);
  const removeInlineComment = useCopilot((s) => s.removeInlineComment);
  const clearInlineComments = useCopilot((s) => s.clearInlineComments);

  const [expandedPreviewIndex, setExpandedPreviewIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uiStore = useUi();
  const currentView = useVault((s) => s.view);
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
    geminiApiKey,
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
    activeProvider === "gemini" ||
    activeProvider === "ollama_cloud" ||
    (activeProvider === "groq" && !!groqApiKey) ||
    (activeProvider === "openai" && !!openaiApiKey) ||
    (activeProvider === "claude" && !!claudeApiKey) ||
    (activeProvider === "qwen" && !!qwenApiKey);

  const stripActionJson = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/```json[\s\S]*?```/gi, (match) => {
        if (
          match.includes('"action"') ||
          match.includes('action') ||
          match.includes('add_') ||
          match.includes('update_active_note')
        ) {
          return "";
        }
        return match;
      })
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const executeAiAction = (
    responseText: string
  ): { logs: string[]; proposedUpdate?: any } => {
    const executedLogs: string[] = [];
    let proposedUpdate: any = null;
    try {
      const jsonMatches = responseText.match(/```json[\s\S]*?```/gi);
      if (!jsonMatches) return { logs: executedLogs, proposedUpdate };

      const processSingleAction = (data: any) => {
        if (!data || typeof data !== "object") return;

        // 1. Copilot Note Update Action
        if (
          (data.action === "update_active_note" || data.action === "update_note") &&
          (data.updatedContent || data.content)
        ) {
          const contentToApply = data.updatedContent || data.content;
          const explanation =
            data.explanation || "Nota atualizada com base nas suas instruções.";

          if (autoApplyCopilot) {
            window.dispatchEvent(
              new CustomEvent("markd:note-action", {
                detail: { action: "replace-entire-note", text: contentToApply },
              })
            );
            executedLogs.push("⚡ Nota central atualizada automaticamente pelo Copiloto");
            toast.success("Nota central atualizada pelo Copiloto!");
            proposedUpdate = {
              explanation,
              content: contentToApply,
              applied: true,
              previousContent: noteContent,
            };
          } else {
            executedLogs.push(
              "Proposta de alteração gerada. Clique em 'Aplicar na Nota Central' para confirmar."
            );
            proposedUpdate = {
              explanation,
              content: contentToApply,
              applied: false,
              previousContent: noteContent,
            };
          }
        }
        // 2. Calendar Event
        else if (data.action === "add_calendar_event" && data.title) {
          useCalendar.getState().addEvent({
            title: data.title,
            date: data.date || new Date().toISOString().split("T")[0],
            startTime: data.startTime || "10:00",
            endTime: data.endTime || "11:00",
            category: data.category || "event",
            description: data.description || "",
          });
          executedLogs.push(`Compromisso agendado: "${data.title}"`);
        }
        // 3. Todo
        else if (data.action === "add_todo" && data.text) {
          void useTodos.getState().addSmart({
            text: data.text,
            tags: Array.isArray(data.tags) ? data.tags : [],
          });
          executedLogs.push(`Tarefa criada: "${data.text}"`);
        }
        // 4. Canvas Node (Moodboard)
        else if (data.action === "add_canvas_node" && (data.content || data.title)) {
          useCanvas.getState().addNode({
            type: data.type || "sticky",
            title: data.title,
            content: data.content || "",
            color: data.color || "yellow",
            x: 120 + Math.floor(Math.random() * 220),
            y: 120 + Math.floor(Math.random() * 220),
          });
          executedLogs.push(
            `Item adicionado ao Moodboard: "${
              data.title || (data.content ? data.content.slice(0, 25) + "..." : "Card")
            }"`
          );
        }
      };

      for (const match of jsonMatches) {
        const rawJson = match.replace(/^```json/i, "").replace(/```$/, "").trim();
        try {
          const data = JSON.parse(rawJson);
          if (Array.isArray(data)) {
            data.forEach(processSingleAction);
          } else {
            processSingleAction(data);
          }
        } catch {
          // ignore non-matching blocks
        }
      }
    } catch {
      // ignore
    }
    return { logs: executedLogs, proposedUpdate };
  };

  const handleApplyProposedUpdate = (content: string, index: number) => {
    const previousContent = noteContent;
    window.dispatchEvent(
      new CustomEvent("markd:note-action", {
        detail: { action: "replace-entire-note", text: content },
      })
    );
    setMessages((prev) =>
      prev.map((msg, idx) => {
        if (idx === index && msg.proposedNoteUpdate) {
          return {
            ...msg,
            proposedNoteUpdate: {
              ...msg.proposedNoteUpdate,
              applied: true,
              previousContent,
            },
          };
        }
        return msg;
      })
    );
    toast.success("Nota central atualizada com sucesso!");
  };

  const handleUndoProposedUpdate = (index: number) => {
    const targetMsg = messages[index];
    if (targetMsg?.proposedNoteUpdate?.previousContent !== undefined) {
      window.dispatchEvent(
        new CustomEvent("markd:note-action", {
          detail: {
            action: "replace-entire-note",
            text: targetMsg.proposedNoteUpdate.previousContent,
          },
        })
      );
      setMessages((prev) =>
        prev.map((msg, idx) => {
          if (idx === index && msg.proposedNoteUpdate) {
            return {
              ...msg,
              proposedNoteUpdate: {
                ...msg.proposedNoteUpdate,
                applied: false,
              },
            };
          }
          return msg;
        })
      );
      toast.info("Conteúdo anterior da nota restaurado.");
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor selecione um arquivo de imagem.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setAttachedImages((prev) => [
            ...prev,
            { data: base64, mimeType: file.type, preview: base64 },
          ]);
          toast.success("Imagem anexada para análise!");
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Reconhecimento de voz não é suportado neste navegador.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast("Escutando... Fale seu comando ou dúvida.");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          toast.success("Voz convertida em texto!");
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error("Não foi possível reconhecer a voz. Tente novamente.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      toast.error("Erro ao iniciar microfone.");
    }
  };

  const playSpeechSynthesis = async (text: string, index: number) => {
    if (playingAudioIndex === index) {
      window.speechSynthesis?.cancel();
      setPlayingAudioIndex(null);
      return;
    }

    setPlayingAudioIndex(index);

    const cleanText = cleanAiMarkdown(text).replace(/[#*`_~]/g, "");

    // 1. Try Gemini TTS endpoint
    try {
      const res = await fetch("/api/gemini/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText.slice(0, 400), apiKey: geminiApiKey }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          const audio = new Audio(`data:${data.mimeType || "audio/mp3"};base64,${data.audio}`);
          audio.onended = () => setPlayingAudioIndex(null);
          audio.onerror = () => fallbackWebSpeech(cleanText);
          await audio.play();
          return;
        }
      }
    } catch {
      // Fallback
    }

    fallbackWebSpeech(cleanText);
  };

  const fallbackWebSpeech = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Síntese de voz não suportada no navegador.");
      setPlayingAudioIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
    utterance.lang = "pt-BR";
    utterance.onend = () => setPlayingAudioIndex(null);
    utterance.onerror = () => setPlayingAudioIndex(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (userPrompt?: string) => {
    const textToSend = userPrompt || inputText;
    if (!textToSend.trim() && attachedImages.length === 0) return;

    if (!hasApiKey) {
      setError(`A chave da API para ${providerNames[activeProvider]} não foi configurada.`);
      return;
    }

    const currentImages = [...attachedImages];
    const imagePreviews = currentImages.map((img) => img.preview);

    const newMessages: ExtendedChatMessage[] = [
      ...messages,
      {
        role: "user",
        text: textToSend.trim() || "Analise a imagem em anexo e extraia as informações.",
        images: imagePreviews.length > 0 ? imagePreviews : undefined,
      },
    ];

    setMessages(newMessages);
    if (!userPrompt) setInputText("");
    setAttachedImages([]);
    setLoading(true);
    setError(null);

    let contextHeader = `[INSTRUÇÕES DE FORMATAÇÃO DA RESPOSTA]:
1. Mantenha suas respostas diretas, bem estruturadas e amigáveis em Português do Brasil.
2. Evite repetir blocos de texto excessivamente longos ou desnecessários.
3. Se for executar ações (agendar compromissos, criar tarefas ou adicionar cards no moodboard), COLOQUE OS BLOCOS DE CÓDIGO JSON ESTRITAMENTE NO FINAL DA SUA RESPOSTA. O app executará as ações automaticamente e removerá o código JSON da visualização do usuário.

`;
    const viewType = currentView?.type || "note";

    if (viewType === "calendar" && shareContext) {
      const events = useCalendar.getState().events;
      const eventsSummary = events
        .slice(0, 15)
        .map((e) => `- [${e.date} ${e.startTime}-${e.endTime}] ${e.title} (${e.category})`)
        .join("\n");
      contextHeader += `[CONTEXTO DA TELA ATUAL: AGENDA / CALENDÁRIO]:
Data de Hoje: ${new Date().toISOString().split("T")[0]}
Eventos Agendados Atuais:
${eventsSummary || "(Nenhum evento agendado)"}

INSTRUÇÕES DE AÇÃO NA AGENDA:
Para agendar compromissos, inclua ao final da sua resposta blocos JSON com a ação "add_calendar_event" como no exemplo:
\`\`\`json
{
  "action": "add_calendar_event",
  "title": "Título do compromisso",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "category": "event"
}
\`\`\`
\n\n`;
    } else if (viewType === "todos" && shareContext) {
      const todos = useTodos.getState().todos;
      const todosSummary = todos
        .slice(0, 20)
        .map(
          (t) =>
            `- [${t.done ? "Concluída" : "Pendente"}] ${t.text} ${
              t.tags.length ? `(#${t.tags.join(" #")})` : ""
            }`
        )
        .join("\n");
      contextHeader += `[CONTEXTO DA TELA ATUAL: TAREFAS / TODOS]:
Lista de Tarefas Atuais:
${todosSummary || "(Nenhuma tarefa cadastrada)"}

INSTRUÇÕES DE AÇÃO EM TAREFAS:
Para criar tarefas, inclua ao final da sua resposta blocos JSON com a ação "add_todo" como no exemplo:
\`\`\`json
{
  "action": "add_todo",
  "text": "Descrição da tarefa",
  "tags": ["tag1", "tag2"]
}
\`\`\`
\n\n`;
    } else if (viewType === "canvas" && shareContext) {
      const nodes = useCanvas.getState().nodes;
      const canvasName =
        useCanvas
          .getState()
          .canvasList.find((c) => c.id === useCanvas.getState().currentCanvasId)?.name ||
        "Moodboard";
      const nodesSummary = nodes
        .slice(0, 20)
        .map((n) => `- [${n.type.toUpperCase()}] ${n.title ? n.title + ": " : ""}${n.content}`)
        .join("\n");
      contextHeader += `[CONTEXTO DA TELA ATUAL: MOODBOARD / QUADRO "${canvasName}"]:
Itens e Ideias no Moodboard Atualmente:
${nodesSummary || "(Moodboard vazio)"}

INSTRUÇÕES DE AÇÃO NO MOODBOARD:
Para ADICIONAR sticky notes no Moodboard, inclua blocos JSON com a ação "add_canvas_node":
\`\`\`json
{
  "action": "add_canvas_node",
  "type": "sticky",
  "title": "Título do Card",
  "content": "Conteúdo",
  "color": "yellow"
}
\`\`\`
\n\n`;
    } else if (shareContext) {
      contextHeader += `[CONTEXTO DA NOTA ATUAL DO USUÁRIO]:
Título da Nota: ${noteTitle}
${selectedText ? `TRECHO GRIFADO/SELEÇÃO ATUAL DO USUÁRIO NA NOTA:\n"""\n${selectedText}\n"""\n` : ""}
Conteúdo Atual da Nota:
---
${noteContent || "(Nota Vazia)"}
---

${
  copilotMode
    ? `[MODO COPILOTO DE EDIÇÃO DA NOTA ATIVO]:
Você está operando como um Copiloto Direto de Edição de Texto no Markd (estilo Google Antigravity).
Sua missão:
1. Responda amigavelmente no chat com um resumo explicativo do que foi alterado ou corrigido.
2. Junte todos os comentários específicos deixados em trechos da nota + a instrução geral do chat e execute as modificações.
3. COLOQUE OBRIGATORIAMENTE ao final da sua resposta um bloco de código JSON com a ação "update_active_note":
\`\`\`json
{
  "action": "update_active_note",
  "explanation": "Resumo em 1 frase do que foi modificado",
  "updatedContent": "CONTEÚDO COMPLETO E ATUALIZADO DA NOTA EM MARKDOWN"
}
\`\`\`
Preserve o formato Markdown da nota e mantenha os títulos e estrutura não afetados pela alteração.
${
  inlineComments.length > 0
    ? `\n[COMENTÁRIOS E INSTRUÇÕES ESPECÍFICAS DEIXADAS PELO USUÁRIO EM TRECHOS DA NOTA]:\n` +
      inlineComments
        .map(
          (c, idx) =>
            `${idx + 1}. Trecho da Nota: "${c.selectedText}"\n   Instrução/Comentário: "${c.comment}"`
        )
        .join("\n\n") +
      `\n\nPor favor, execute rigorosamente cada uma das alterações solicitadas nos trechos acima.`
    : ""
}
`
    : ""
}
\n\n`;
    }

    try {
      const responseObj = await chatWithOnlineAi({
        messages: newMessages.map((m) => ({ role: m.role, text: m.text })),
        noteTitle: viewType === "note" ? noteTitle : undefined,
        noteContent: contextHeader + (shareContext ? selectedText || noteContent : ""),
        useSearchGrounding,
        images: currentImages.map((img) => ({ data: img.data, mimeType: img.mimeType })),
      });

      const responseText = responseObj.text;
      const { logs: actionLogs, proposedUpdate } = executeAiAction(responseText);
      if (actionLogs.length > 0) {
        toast.success(actionLogs.join("\n"));
      }

      const cleanedText = stripActionJson(responseText);

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          text: cleanedText,
          groundingMetadata: responseObj.groundingMetadata,
          proposedNoteUpdate: proposedUpdate,
        },
      ]);

      if (inlineComments.length > 0) {
        clearInlineComments();
      }
    } catch (err: any) {
      setError(err.message || `Erro na comunicação com a IA.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Texto copiado para a área de transferência!");
  };

  const currentViewType = currentView?.type || "note";

  return (
    <div
      className={cx(
        "relative flex h-full w-full flex-col bg-bg transition-all duration-200",
        !hideHeader && "border-l border-line shadow-2xl z-30"
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageFileChange}
      />

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
                <span>Mark IA & Gemini</span>
              </h3>
              <span className="text-[10px] text-faint flex items-center gap-1 font-medium">
                {providerNames[activeProvider]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {activeProvider === "gemini" && (
              <button
                type="button"
                onClick={() => {
                  setUseSearchGrounding(!useSearchGrounding);
                  toast(
                    useSearchGrounding
                      ? "Google Search Grounding desativado."
                      : "Google Search Grounding ativado! As respostas incluirão dados atualizados da web."
                  );
                }}
                className={cx(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                  useSearchGrounding
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/40"
                    : "text-faint hover:bg-hover hover:text-ink"
                )}
                title="Ativar/Desativar busca online do Google"
              >
                <Globe size={13} />
                <span className="hidden sm:inline">Google Search</span>
              </button>
            )}

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
        {!hasApiKey && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 shadow-xs">
            <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Configure a Chave da API ({providerNames[activeProvider]})
            </h4>
            <p className="text-[11px] text-faint leading-relaxed">
              Você selecionou a IA <b>{providerNames[activeProvider]}</b>. Cole sua chave de API nas
              configurações do Markd para começar a usar.
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

        {messages.length === 0 && (
          <div className="my-auto space-y-5 pt-2">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                Olá
              </h2>
              <p className="text-xl font-medium text-ink">
                Como posso ajudar com{" "}
                {currentViewType === "calendar"
                  ? "sua agenda"
                  : currentViewType === "todos"
                  ? "suas tarefas"
                  : currentViewType === "canvas"
                  ? "seu moodboard"
                  : "suas notas"}{" "}
                hoje?
              </p>
            </div>

            {shareContext && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-panel/70 p-2.5 text-xs text-ink shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {currentViewType === "calendar" ? (
                    <CalendarDays size={15} className="text-blue-500 shrink-0" />
                  ) : currentViewType === "todos" ? (
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  ) : currentViewType === "canvas" ? (
                    <Palette size={15} className="text-amber-500 shrink-0" />
                  ) : (
                    <FileText size={15} className="text-purple-500 shrink-0" />
                  )}
                  <span className="truncate text-faint">
                    Contexto:{" "}
                    <strong className="text-ink">
                      {currentViewType === "calendar"
                        ? "Agenda / Calendário"
                        : currentViewType === "todos"
                        ? "Lista de Tarefas"
                        : currentViewType === "canvas"
                        ? "Moodboard Ativo"
                        : `Nota: "${noteTitle}"`}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShareContext(false)}
                  className="text-faint hover:text-ink shrink-0 ml-1"
                  title="Remover contexto"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {currentViewType === "note" && (
              <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/5 px-3 py-2 text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
                    <Wand2 size={13} />
                  </div>
                  <div>
                    <div className="font-semibold text-ink flex items-center gap-1.5">
                      Copiloto da Nota
                      {copilotMode && (
                        <span className="inline-flex items-center rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[9px] font-bold text-purple-600 dark:text-purple-400">
                          ATIVO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-faint">Edita a nota conforme o chat</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoApplyCopilot(!autoApplyCopilot);
                      toast(
                        !autoApplyCopilot
                          ? "Auto-aplicar ativado! As edições serão salvas na nota em tempo real."
                          : "Modo confirmação ativado! Você verá um card com o botão 'Aplicar' antes de salvar na nota."
                      );
                    }}
                    className={cx(
                      "px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors border",
                      autoApplyCopilot
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-hover text-faint border-line hover:text-ink"
                    )}
                    title={
                      autoApplyCopilot
                        ? "Alterações aplicadas na nota automaticamente"
                        : "Exibe um botão 'Aplicar na Nota' antes de alterar a nota"
                    }
                  >
                    {autoApplyCopilot ? "⚡ Auto-Aplicar" : "✋ Confirmação"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCopilotMode(!copilotMode)}
                    className={cx(
                      "px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors border",
                      copilotMode
                        ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/40"
                        : "bg-hover text-faint border-line hover:text-ink"
                    )}
                  >
                    {copilotMode ? "Ligado" : "Desligado"}
                  </button>
                </div>
              </div>
            )}

            {/* AI Capabilities Cards */}
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUseSearchGrounding(true);
                  handleSendMessage("Pesquise na web com Google e me traga as últimas novidades sobre IA e produtividade");
                }}
                className="flex items-center gap-3 rounded-2xl border border-line/80 bg-panel/40 p-3 text-left text-xs text-ink hover:bg-hover transition-colors shadow-xs"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                  <Globe size={16} />
                </div>
                <div>
                  <div className="font-semibold text-ink">Google Search Data</div>
                  <div className="text-[11px] text-faint">Pesquise dados atualizados da internet em tempo real</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 rounded-2xl border border-line/80 bg-panel/40 p-3 text-left text-xs text-ink hover:bg-hover transition-colors shadow-xs"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                  <ImageIcon size={16} />
                </div>
                <div>
                  <div className="font-semibold text-ink">Escanear Documento / Imagem</div>
                  <div className="text-[11px] text-faint">Envie fotos, documentos ou telas para o Gemini analisar</div>
                </div>
              </button>

              <button
                type="button"
                onClick={startSpeechRecognition}
                className="flex items-center gap-3 rounded-2xl border border-line/80 bg-panel/40 p-3 text-left text-xs text-ink hover:bg-hover transition-colors shadow-xs"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Mic size={16} />
                </div>
                <div>
                  <div className="font-semibold text-ink">Conversa por Voz</div>
                  <div className="text-[11px] text-faint">Fale com o Mark IA por microfone e ouça as respostas</div>
                </div>
              </button>

              {currentViewType === "note" && (
                <button
                  type="button"
                  onClick={() => handleSendMessage("Resuma os pontos mais importantes desta nota em um checklist de ações")}
                  className="flex items-center gap-3 rounded-2xl border border-line/80 bg-panel/40 p-3 text-left text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-ink">Inteligência Gemini</div>
                    <div className="text-[11px] text-faint">Resuma a nota, extraia tarefas ou melhore o texto</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chat Thread */}
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
                  <Sparkles size={12} className="text-purple-500" /> <span>Mark IA</span>
                </>
              )}
            </div>

            <div
              className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-br-none"
                  : "bg-panel border border-line text-ink rounded-bl-none overflow-hidden"
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.images.map((img, imgIdx) => (
                    <img
                      key={imgIdx}
                      src={img}
                      alt="Anexo"
                      className="h-20 w-20 object-cover rounded-lg border border-white/20"
                    />
                  ))}
                </div>
              )}

              {msg.role === "assistant" ? (
                <div className="space-y-2 select-text [&_p]:leading-relaxed [&_p]:my-1.5 [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_li]:my-0.5 [&_hr]:my-2.5 [&_hr]:border-line [&_code]:bg-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_pre]:bg-hover [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-purple-500/50 [&_blockquote]:pl-2 [&_blockquote]:italic [&_strong]:font-semibold [&_strong]:text-ink">
                  <Markdown>{cleanAiMarkdown(msg.text)}</Markdown>

                  {/* Render Google Search Grounding Sources */}
                  {msg.groundingMetadata?.groundingChunks &&
                    msg.groundingMetadata.groundingChunks.length > 0 && (
                      <div className="mt-3 border-t border-line/60 pt-2 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-500">
                          <Globe size={11} />
                          <span>Fontes do Google Search:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.groundingMetadata.groundingChunks.map(
                            (chunk: any, chunkIdx: number) => {
                              const web = chunk.web;
                              if (!web?.uri) return null;
                              return (
                                <a
                                  key={chunkIdx}
                                  href={web.uri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-line bg-hover px-2 py-1 text-[10px] text-muted hover:text-ink hover:border-blue-500/40 transition-colors"
                                >
                                  <span className="truncate max-w-[140px]">
                                    {web.title || web.uri}
                                  </span>
                                  <ExternalLink size={10} className="shrink-0" />
                                </a>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                msg.text
              )}
            </div>

            {msg.role === "assistant" && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-faint">
                <button
                  type="button"
                  onClick={() => handleCopy(cleanAiMarkdown(msg.text))}
                  className="flex items-center gap-1 hover:text-ink"
                >
                  <Copy size={12} /> Copiar
                </button>

                <button
                  type="button"
                  onClick={() => playSpeechSynthesis(msg.text, index)}
                  className={cx(
                    "flex items-center gap-1 hover:text-ink",
                    playingAudioIndex === index && "text-purple-500 font-semibold"
                  )}
                  title="Ouvir resposta por voz"
                >
                  {playingAudioIndex === index ? (
                    <>
                      <VolumeX size={12} className="animate-pulse text-purple-500" /> Ouvindo...
                    </>
                  ) : (
                    <>
                      <Volume2 size={12} /> Ouvir Voz
                    </>
                  )}
                </button>

                {currentViewType === "note" && selectedText && (
                  <button
                    type="button"
                    onClick={() => handleInsertResult(cleanAiMarkdown(msg.text), true)}
                    className="flex items-center gap-1 hover:text-ink font-medium text-purple-500"
                  >
                    <Check size={12} /> Substituir Seleção
                  </button>
                )}
                {currentViewType === "note" && (
                  <button
                    type="button"
                    onClick={() => handleInsertResult(cleanAiMarkdown(msg.text), false)}
                    className="flex items-center gap-1 hover:text-ink font-medium text-indigo-500"
                  >
                    <ArrowRight size={12} /> Inserir na Nota
                  </button>
                )}
              </div>
            )}

            {/* Proposed Note Update Card */}
            {msg.proposedNoteUpdate && (
              <div className="mt-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2 select-none shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                    <Sparkles size={14} />
                    <span>Proposta de Edição da Nota Central</span>
                  </div>
                  {msg.proposedNoteUpdate.applied ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check size={12} /> Aplicado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                      Aguardando Revisão
                    </span>
                  )}
                </div>

                {msg.proposedNoteUpdate.explanation && (
                  <p className="text-[11.5px] text-faint leading-relaxed">
                    {msg.proposedNoteUpdate.explanation}
                  </p>
                )}

                <div className="rounded-lg border border-line-soft bg-bg/80 p-2">
                  <div className="flex items-center justify-between text-[10.5px] font-medium text-faint">
                    <span>Novo Conteúdo ({msg.proposedNoteUpdate.content.length} caracteres)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPreviewIndex(expandedPreviewIndex === index ? null : index)
                      }
                      className="hover:text-ink flex items-center gap-1 text-purple-500"
                    >
                      {expandedPreviewIndex === index ? (
                        <>Ocultar <ChevronUp size={12} /></>
                      ) : (
                        <>Ver Código <ChevronDown size={12} /></>
                      )}
                    </button>
                  </div>
                  <div
                    className={cx(
                      "mt-1 text-[11px] font-mono text-faint overflow-hidden transition-all whitespace-pre-wrap",
                      expandedPreviewIndex === index
                        ? "max-h-60 overflow-y-auto"
                        : "line-clamp-3"
                    )}
                  >
                    {msg.proposedNoteUpdate.content}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!msg.proposedNoteUpdate.applied ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyProposedUpdate(msg.proposedNoteUpdate!.content, index)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-purple-700 transition-colors"
                    >
                      <Check size={13} />
                      Aplicar Alterações na Nota
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUndoProposedUpdate(index)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-hover px-2.5 py-1 text-[11px] font-medium text-faint hover:text-ink transition-colors"
                    >
                      <RotateCcw size={12} />
                      Desfazer e Restaurar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.proposedNoteUpdate!.content);
                      toast.success("Markdown copiado!");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-hover px-2.5 py-1 text-[11px] font-medium text-faint hover:text-ink transition-colors"
                  >
                    <Copy size={12} />
                    Copiar Markdown
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-faint py-2">
            <Spinner size={16} />
            <span>Mark IA está processando...</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-ink space-y-1">
            <p className="text-red-500 font-semibold">Erro de Conexão com a IA</p>
            <p className="text-faint leading-relaxed">{error}</p>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Attached Images Preview Row */}
      {attachedImages.length > 0 && (
        <div className="border-t border-line bg-panel/50 px-3 py-2 flex items-center gap-2 overflow-x-auto">
          {attachedImages.map((img, idx) => (
            <div key={idx} className="relative group shrink-0">
              <img
                src={img.preview}
                alt="Preview"
                className="h-12 w-12 object-cover rounded-lg border border-line"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white text-[10px]"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <span className="text-[11px] text-faint">Imagem pronta para análise do Gemini</span>
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-line bg-panel/30 p-3 space-y-2">
        {copilotMode && inlineComments.length > 0 && currentViewType === "note" && (
          <div className="flex flex-col gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 p-3 text-xs text-ink shadow-2xs">
            <div className="flex items-center justify-between font-semibold text-purple-600 dark:text-purple-400">
              <span className="flex items-center gap-1.5">
                <MessageSquarePlus size={14} />
                <span>
                  {inlineComments.length}{" "}
                  {inlineComments.length === 1
                    ? "Comentário no Trecho"
                    : "Comentários em Trechos da Nota"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => clearInlineComments()}
                className="text-[10.5px] text-faint hover:text-danger transition-colors font-normal"
              >
                Limpar comentários
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {inlineComments.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-start justify-between gap-2 rounded-lg bg-bg/90 p-2 border border-line-soft text-xs shadow-2xs"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-[10.5px] font-mono text-faint truncate italic">
                      "{c.selectedText}"
                    </div>
                    <div className="font-medium text-ink leading-snug">
                      {c.comment}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInlineComment(c.id)}
                    className="text-faint hover:text-danger opacity-60 group-hover:opacity-100 p-0.5 transition-opacity"
                    title="Remover este comentário"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  inputText.trim() ||
                    "Aplique todos os comentários e edições em trechos especificadas na nota."
                )
              }
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-colors"
            >
              <Wand2 size={13} />
              <span>Prosseguir & Processar Nota ({inlineComments.length})</span>
            </button>
          </div>
        )}

        {selectedText && currentViewType === "note" && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs text-ink shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles size={13} />
                Trecho Grifado na Nota ({selectedText.length} caracteres)
              </span>
              <span className="text-[10px] text-purple-500/80 font-normal">Contexto Ativo</span>
            </div>
            <p className="line-clamp-2 text-[11px] text-faint italic font-mono bg-bg/60 p-1.5 rounded border border-line-soft">
              "{selectedText}"
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  handleSendMessage("Reescreva o trecho grifado/selecionado tornando-o mais claro, fluido e bem articulado.")
                }
                className="rounded-lg bg-purple-500/20 px-2 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-500/30 transition-colors"
              >
                ✨ Reescrever Trecho
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage("Expanda e desenvolva com mais detalhes as ideias contidas no trecho grifado.")
                }
                className="rounded-lg bg-indigo-500/20 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/30 transition-colors"
              >
                📝 Expandir
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage("Corrija gramática, pontuação e ortografia do trecho grifado.")
                }
                className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                🧹 Polir / Corrigir
              </button>
            </div>
          </div>
        )}

        <div className="relative rounded-2xl border border-line bg-panel p-2 shadow-sm focus-within:border-purple-500">
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isListening
                ? "Escutando sua voz..."
                : currentViewType === "calendar"
                ? "Peça para agendar um compromisso ou consultar a agenda..."
                : currentViewType === "todos"
                ? "Peça para criar, formatar ou organizar tarefas..."
                : currentViewType === "canvas"
                ? "Peça para analisar ideias ou adicionar cards..."
                : "Pergunte algo, anexe imagem ou fale por voz..."
            }
            className="w-full bg-transparent px-2 text-xs text-ink outline-none placeholder:text-faint resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && (inputText.trim() || attachedImages.length > 0) && !loading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <div className="flex items-center justify-between border-t border-line/40 pt-2 px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-hover text-faint hover:text-ink transition-colors"
                title="Anexar Imagem / Escanear Documento"
              >
                <ImageIcon size={15} />
              </button>

              <button
                type="button"
                onClick={startSpeechRecognition}
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                  isListening
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-hover text-faint hover:text-ink"
                )}
                title="Falar por voz (Speech to text)"
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              {activeProvider === "gemini" && (
                <button
                  type="button"
                  onClick={() => setUseSearchGrounding(!useSearchGrounding)}
                  className={cx(
                    "flex h-7 px-2 items-center justify-center rounded-full text-[11px] font-medium transition-colors",
                    useSearchGrounding
                      ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/40"
                      : "bg-hover text-faint hover:text-ink"
                  )}
                  title="Google Search Grounding"
                >
                  <Globe size={13} className="mr-1" />
                  Search
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={loading || (!inputText.trim() && attachedImages.length === 0)}
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
