import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import {
  Sparkles,
  Check,
  Copy,
  X,
  ArrowRight,
  User,
  Plus,
  FileText,
  CalendarDays,
  CheckCircle2,
  Palette,
  Settings,
} from "lucide-react";
import { chatWithOnlineAi, cleanAiMarkdown, type ChatMessage } from "@/lib/ai";
import { useAiStore } from "@/stores/ai";
import { useUi } from "@/stores/ui";
import { useVault } from "@/stores/vault";
import { useCalendar } from "@/stores/calendar";
import { useTodos } from "@/stores/todos";
import { useCanvas } from "@/stores/canvas";
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

  const stripActionJson = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/```json[\s\S]*?```/gi, (match) => {
        if (match.includes('"action"') || match.includes('action') || match.includes('add_')) {
          return "";
        }
        return match;
      })
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const executeAiAction = (responseText: string): string[] => {
    const executedLogs: string[] = [];
    try {
      const jsonMatches = responseText.match(/```json[\s\S]*?```/gi);
      if (!jsonMatches) return executedLogs;

      const processSingleAction = (data: any) => {
        if (!data || typeof data !== "object") return;
        // 1. Calendar Event
        if (data.action === "add_calendar_event" && data.title) {
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
        // 2. Todo
        else if (data.action === "add_todo" && data.text) {
          void useTodos.getState().addSmart({
            text: data.text,
            tags: Array.isArray(data.tags) ? data.tags : [],
          });
          executedLogs.push(`Tarefa criada: "${data.text}"`);
        }
        // 3. Canvas Node (Moodboard)
        else if (data.action === "add_canvas_node" && (data.content || data.title)) {
          useCanvas.getState().addNode({
            type: data.type || "sticky",
            title: data.title,
            content: data.content || "",
            color: data.color || "yellow",
            x: 120 + Math.floor(Math.random() * 220),
            y: 120 + Math.floor(Math.random() * 220),
          });
          executedLogs.push(`Item adicionado ao Moodboard: "${data.title || (data.content ? data.content.slice(0, 25) + '...' : 'Card')}"`);
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
          // ignore non-matching code blocks
        }
      }
    } catch {
      // ignore
    }
    return executedLogs;
  };

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

    // Build context header based on active page view
    let contextHeader = `[INSTRUÇÕES DE FORMATAÇÃO DA RESPOSTA]:
1. Mantenha suas respostas diretas, bem estruturadas e amigáveis em Português do Brasil.
2. Evite repetir blocos de texto excessivamente longos ou desnecessários.
3. Se for executar ações (agendar compromissos, criar tarefas ou adicionar cards no moodboard), COLOQUE OS BLOCOS DE CÓDIGO JSON ESTRITAMENTE NO FINAL DA SUA RESPOSTA. O app executará as ações automaticamente e removerá o código JSON da visualização do usuário.

`;
    const viewType = currentView?.type || "note";

    if (viewType === "calendar" && shareContext) {
      const events = useCalendar.getState().events;
      const eventsSummary = events.slice(0, 15).map(e => `- [${e.date} ${e.startTime}-${e.endTime}] ${e.title} (${e.category})`).join("\n");
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
Pode incluir múltiplos blocos se o usuário solicitar mais de um compromisso.
\n\n`;
    } else if (viewType === "todos" && shareContext) {
      const todos = useTodos.getState().todos;
      const todosSummary = todos.slice(0, 20).map(t => `- [${t.done ? "Concluída" : "Pendente"}] ${t.text} ${t.tags.length ? `(#${t.tags.join(" #")})` : ""}`).join("\n");
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
Pode incluir múltiplos blocos se o usuário solicitar mais de uma tarefa.
\n\n`;
    } else if (viewType === "canvas" && shareContext) {
      const nodes = useCanvas.getState().nodes;
      const canvasName = useCanvas.getState().canvasList.find(c => c.id === useCanvas.getState().currentCanvasId)?.name || "Moodboard";
      const nodesSummary = nodes.slice(0, 20).map(n => `- [${n.type.toUpperCase()}] ${n.title ? n.title + ": " : ""}${n.content}`).join("\n");
      contextHeader += `[CONTEXTO DA TELA ATUAL: MOODBOARD / QUADRO "${canvasName}"]:
Itens e Ideias no Moodboard Atualmente:
${nodesSummary || "(Moodboard vazio)"}

INSTRUÇÕES DE AÇÃO NO MOODBOARD:
Para ADICIONAR ou INCLUIR sticky notes ou cards diretamente na tela do Moodboard, inclua ao final da sua resposta um ou mais blocos JSON com a ação "add_canvas_node" como no exemplo:
\`\`\`json
{
  "action": "add_canvas_node",
  "type": "sticky",
  "title": "Título do Card",
  "content": "Conteúdo com a ideia ou referência",
  "color": "yellow"
}
\`\`\`
Cores aceitas para "color": "yellow", "blue", "green", "pink", "purple".
Pode incluir múltiplos blocos se o usuário pedir para adicionar mais de uma ideia.
\n\n`;
    } else if (shareContext) {
      contextHeader += `[CONTEXTO DA NOTA ATUAL]:
Título: ${noteTitle}
Conteúdo da Nota:
---
${selectedText || noteContent || "(Nota Vazia)"}
---
\n\n`;
    }

    try {
      const responseText = await chatWithOnlineAi({
        messages: newMessages,
        noteTitle: viewType === "note" ? noteTitle : undefined,
        noteContent: contextHeader + (shareContext ? (selectedText || noteContent) : ""),
      });

      executeAiAction(responseText);

      const cleanedText = stripActionJson(responseText);

      setMessages([...newMessages, { role: "assistant", text: cleanedText }]);
    } catch (err: any) {
      setError(err.message || `Erro na comunicação com a IA.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const currentViewType = currentView?.type || "note";

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
                Como posso ajudar com {currentViewType === "calendar" ? "sua agenda" : currentViewType === "todos" ? "suas tarefas" : currentViewType === "canvas" ? "seu moodboard" : "suas notas"} hoje?
              </p>
            </div>

            {/* Context Badge */}
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
                    Contexto: <strong className="text-ink">
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

            {/* Quick Action Pills based on active page */}
            <div className="space-y-2">
              {currentViewType === "calendar" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Marque uma reunião amanhã às 15:00 chamada 'Alinhamento do Projeto' na minha agenda")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    📅 Marcar compromisso na agenda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Quais são meus compromissos agendados para hoje? Resuma em tópicos.")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    📋 Listar meus compromissos de hoje
                  </button>
                </>
              ) : currentViewType === "todos" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Crie 3 tarefas prioritárias para a entrega do projeto com tags adequadas")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    ✅ Criar e formatar tarefas automaticamente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Organize minhas tarefas pendentes por ordem de prioridade e urgência")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    📌 Analisar e priorizar tarefas pendentes
                  </button>
                </>
              ) : currentViewType === "canvas" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Análise todas as ideias do moodboard atual, conecte os conceitos e sugira 3 novos sticky notes de referências")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    💡 Analisar ideias e adicionar referências no Moodboard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Crie um novo sticky note com inspirações de paleta de cores e tipografia para este moodboard")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    🎨 Incluir nota de design no Moodboard
                  </button>
                </>
              ) : (
                <>
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
                    Corrigir ortografia e melhorar o estilo do texto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Crie uma lista de tarefas detalhada a partir desta nota e adicione às minhas tarefas")}
                    className="w-full text-left rounded-2xl border border-line/80 bg-panel/40 p-3 text-xs text-ink hover:bg-hover transition-colors shadow-xs"
                  >
                    Criar tarefas a partir desta nota
                  </button>
                </>
              )}
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
              className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-br-none"
                  : "bg-panel border border-line text-ink rounded-bl-none overflow-hidden"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="space-y-2 select-text [&_p]:leading-relaxed [&_p]:my-1.5 [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1.5 [&_li]:my-0.5 [&_hr]:my-2.5 [&_hr]:border-line [&_code]:bg-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_pre]:bg-hover [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-purple-500/50 [&_blockquote]:pl-2 [&_blockquote]:italic [&_strong]:font-semibold [&_strong]:text-ink">
                  <Markdown>{cleanAiMarkdown(msg.text)}</Markdown>
                </div>
              ) : (
                msg.text
              )}
            </div>

            {/* Actions under assistant message */}
            {msg.role === "assistant" && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-faint">
                <button
                  type="button"
                  onClick={() => handleCopy(cleanAiMarkdown(msg.text))}
                  className="flex items-center gap-1 hover:text-ink"
                >
                  <Copy size={12} /> Copiar
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
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-faint py-2">
            <Spinner size={16} />
            <span>Mark IA está processando e executando...</span>
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
            placeholder={
              currentViewType === "calendar"
                ? "Peça para agendar um compromisso ou consultar a agenda..."
                : currentViewType === "todos"
                ? "Peça para criar, formatar ou organizar tarefas..."
                : currentViewType === "canvas"
                ? "Peça para analisar ideias, buscar referências ou adicionar cards..."
                : "Pergunte algo ou peça para escrever..."
            }
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
