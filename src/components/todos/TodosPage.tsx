import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
  Hash,
  Inbox,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Todo } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useTodos } from "@/stores/todos";
import { formatFriendlyDate, parseSmartTodoInput } from "@/lib/smartTodoParser";

type ActiveTab = "today" | "inbox" | "upcoming" | "completed";

export function TodosPage() {
  const { todos, tagRegistry, loaded, load, addSmart, rescheduleOverdueToToday } = useTodos();
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [subtaskInputValue, setSubtaskInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Parse smart input live
  const parsedPreview = useMemo(() => parseSmartTodoInput(inputValue), [inputValue]);

  // Dates math
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Mock initial overdue tasks for demonstration if empty
  useEffect(() => {
    if (loaded && todos.length === 0) {
      const yesterday = todayStart - 86400000;
      void addSmart({ text: "Retornar a Karen com nova proposta de trabalho.", dueDate: yesterday, tags: ["entrada"] });
      void addSmart({ text: "Fazer post da inoar para o insta da circuito", dueDate: yesterday, tags: ["entrada"] });
      void addSmart({ text: "Criar proposta comercial pra estela", dueDate: yesterday, tags: ["entrada"] });
    }
  }, [loaded, todos.length]);

  // Filter tasks based on activeTab / selectedProject / searchQuery
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (searchQuery.trim()) {
        return todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (selectedProject) {
        return todo.tags.includes(selectedProject);
      }
      if (activeTab === "completed") {
        return todo.done;
      }
      if (todo.done) return false;

      if (activeTab === "inbox") {
        return true;
      }
      if (activeTab === "today") {
        return true;
      }
      if (activeTab === "upcoming") {
        return !todo.dueDate || todo.dueDate >= todayStart;
      }
      return true;
    });
  }, [todos, activeTab, selectedProject, searchQuery, todayStart]);

  const parentTodos = useMemo(() => filteredTodos.filter((t) => !t.parentId), [filteredTodos]);

  const overdueTodos = useMemo(() => {
    if (activeTab !== "today" && !selectedProject) return [];
    return parentTodos.filter((t) => !t.done && t.dueDate && t.dueDate < todayStart);
  }, [parentTodos, todayStart, activeTab, selectedProject]);

  const todayTodos = useMemo(() => {
    if (activeTab === "completed") {
      return parentTodos;
    }
    if (activeTab === "today" || activeTab === "inbox") {
      return parentTodos.filter((t) => !t.done && (!t.dueDate || t.dueDate >= todayStart));
    }
    return parentTodos.filter((t) => !t.done);
  }, [parentTodos, activeTab, todayStart]);

  const completedTodosCount = useMemo(() => todos.filter((t) => t.done).length, [todos]);
  const overdueCount = overdueTodos.length;
  const todayCount = todayTodos.length;

  const submitNewTask = () => {
    if (!inputValue.trim()) return;
    const parsed = parseSmartTodoInput(inputValue);
    const projectTag = selectedProject ? [selectedProject] : parsed.tags;

    void addSmart({
      text: parsed.cleanText,
      dueDate: parsed.dueDate ?? (activeTab === "today" ? todayStart : null),
      tags: projectTag.length ? projectTag : ["entrada"],
    });

    setInputValue("");
  };

  const submitSubtask = (parentId: string) => {
    if (!subtaskInputValue.trim()) return;
    const parsed = parseSmartTodoInput(subtaskInputValue);
    void addSmart({
      text: parsed.cleanText,
      parentId,
      tags: parsed.tags,
    });
    setSubtaskInputValue("");
    setAddingSubtaskFor(null);
    setExpandedParents((prev) => ({ ...prev, [parentId]: true }));
  };

  const toggleExpandParent = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Date banner formatting
  const todayFormatted = `${now.getDate()} ${now.toLocaleString("pt-BR", { month: "short" })} · Hoje · ${now.toLocaleString("pt-BR", { weekday: "long" })}`;

  return (
    <div className="page-scroll flex h-full w-full justify-center bg-bg px-6 py-8 text-ink">
      <div className="w-full max-w-[840px]">
        {/* Top Header & Navigation Filters Bar */}
        <div className="mb-6 space-y-4 border-b border-line pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink capitalize">
                {selectedProject ? `# ${selectedProject}` : activeTab === "today" ? "Hoje" : activeTab === "inbox" ? "Entrada" : activeTab === "upcoming" ? "Em breve" : "Concluídas"}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <CheckCircle2 size={13.5} />
                <span>{filteredTodos.length} tarefas pendentes</span>
              </p>
            </div>

            {/* Quick Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar..."
                  className="h-8 w-44 rounded-lg border border-line bg-panel pl-8 pr-2 text-xs text-ink outline-none transition-colors focus:border-sky-500/60 placeholder:text-faint"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-faint hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sub-Navigation Pills (Entrada, Hoje, Em Breve, Concluídas, Projetos) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {/* Hoje Pill */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("today");
                setSelectedProject(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "today" && !selectedProject
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/30"
                  : "bg-panel text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              <Calendar size={14} />
              <span>Hoje</span>
              <span className="ml-0.5 rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] font-bold text-sky-500">
                {overdueCount + todayCount}
              </span>
            </button>

            {/* Entrada Pill */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("inbox");
                setSelectedProject(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "inbox" && !selectedProject
                  ? "bg-hover text-ink font-semibold border border-line"
                  : "bg-panel text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              <Inbox size={14} />
              <span>Entrada</span>
            </button>

            {/* Em Breve Pill */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("upcoming");
                setSelectedProject(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "upcoming" && !selectedProject
                  ? "bg-hover text-ink font-semibold border border-line"
                  : "bg-panel text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              <Clock size={14} />
              <span>Em breve</span>
            </button>

            {/* Concluídas Pill */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("completed");
                setSelectedProject(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "completed" && !selectedProject
                  ? "bg-hover text-ink font-semibold border border-line"
                  : "bg-panel text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              <CheckCircle2 size={14} />
              <span>Concluídas ({completedTodosCount})</span>
            </button>

            {/* Project Tags Dropdown / Filter Pills */}
            {tagRegistry.length > 0 && (
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[11px] font-semibold text-faint uppercase tracking-wider mr-1">Projetos:</span>
                {tagRegistry.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedProject(selectedProject === tag ? null : tag)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                      selectedProject === tag
                        ? "bg-sky-500/10 text-sky-500 font-semibold border border-sky-500/30"
                        : "bg-panel text-muted hover:bg-hover hover:text-ink"
                    }`}
                  >
                    <Hash size={12} className="text-faint" />
                    <span className="capitalize">{tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Group 1: Overdue Tasks (Atrasadas) */}
        {overdueCount > 0 && (
          <div className="mb-6 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-sky-500">Atrasada</span>
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-500">
                  {overdueCount}
                </span>
              </div>

              <button
                type="button"
                onClick={rescheduleOverdueToToday}
                className="flex items-center gap-1 text-xs font-medium text-sky-500 hover:underline"
              >
                <RotateCcw size={13} />
                <span>Reagendar para Hoje</span>
              </button>
            </div>

            <div className="space-y-1">
              {overdueTodos.map((todo) => (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  allTodos={todos}
                  expanded={Boolean(expandedParents[todo.id])}
                  onToggleExpand={() => toggleExpandParent(todo.id)}
                  onStartSubtask={() => setAddingSubtaskFor(todo.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Group 2: Today Date Banner */}
        {activeTab === "today" && !selectedProject && (
          <div className="mb-3 text-xs font-semibold text-muted capitalize">
            {todayFormatted}
          </div>
        )}

        {/* Fast Smart Add Task Input Container */}
        <div className="mb-6 rounded-xl border border-line bg-panel p-3 shadow-sm transition-all focus-within:border-sky-500/60 focus-within:ring-1 focus-within:ring-sky-500/30">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewTask();
            }}
            placeholder="Adicionar tarefa (ex: 'Reunião amanhã 15h #trabalho')..."
            className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
          />

          {/* Smart Parsed Badges Live Preview */}
          {(parsedPreview.dueDateLabel || parsedPreview.tags.length > 0) && (
            <div className="mt-2.5 flex items-center gap-2 border-t border-line/60 pt-2">
              <span className="text-[11px] text-faint flex items-center gap-1">
                <Sparkles size={12} className="text-amber-400" /> Detectado:
              </span>
              {parsedPreview.dueDateLabel && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-500">
                  <Calendar size={11} /> {parsedPreview.dueDateLabel}
                </span>
              )}
              {parsedPreview.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-hover px-2 py-0.5 text-[11px] text-muted">
                  <Hash size={11} /> {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between pt-1">
            <span className="text-[11px] text-faint">
              Pressione <kbd className="rounded bg-hover px-1 py-0.5 text-[10px] text-ink border border-line">Enter</kbd> para criar
            </span>
            <Button
              type="button"
              size="sm"
              disabled={!inputValue.trim()}
              onClick={submitNewTask}
              className="bg-sky-500 text-white hover:bg-sky-600 shrink-0 text-xs font-semibold"
            >
              <Plus size={14} className="mr-1" /> Adicionar tarefa
            </Button>
          </div>
        </div>

        {/* Main List of Tasks */}
        <div className="space-y-1">
          {todayTodos.map((todo) => (
            <div key={todo.id} className="space-y-1">
              <TodoItemRow
                todo={todo}
                allTodos={todos}
                expanded={Boolean(expandedParents[todo.id])}
                onToggleExpand={() => toggleExpandParent(todo.id)}
                onStartSubtask={() => setAddingSubtaskFor(todo.id)}
              />

              {/* Subtasks rendering */}
              {expandedParents[todo.id] && (
                <div className="ml-6 space-y-1 border-l-2 border-line pl-3 pt-1">
                  {todos
                    .filter((sub) => sub.parentId === todo.id)
                    .map((sub) => (
                      <TodoItemRow key={sub.id} todo={sub} allTodos={todos} isSubtask />
                    ))}
                </div>
              )}

              {/* Quick Subtask Input Form */}
              {addingSubtaskFor === todo.id && (
                <div className="ml-6 flex items-center gap-2 rounded-lg border border-line bg-panel p-2">
                  <CornerDownRight size={14} className="text-faint" />
                  <input
                    autoFocus
                    type="text"
                    value={subtaskInputValue}
                    onChange={(e) => setSubtaskInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitSubtask(todo.id);
                      if (e.key === "Escape") setAddingSubtaskFor(null);
                    }}
                    placeholder="Nova subtarefa..."
                    className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
                  />
                  <button
                    type="button"
                    onClick={() => submitSubtask(todo.id)}
                    className="rounded bg-sky-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-600"
                  >
                    Salvar
                  </button>
                </div>
              )}
            </div>
          ))}

          {loaded && todayTodos.length === 0 && overdueCount === 0 && (
            <div className="py-12 text-center text-xs text-faint">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
              <p>Tudo em dia! Nenhuma tarefa pendente nesta visão.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Todo Row Component (Markd Native Style)
 */
function TodoItemRow({
  todo,
  allTodos,
  expanded,
  onToggleExpand,
  onStartSubtask,
  isSubtask = false,
}: {
  todo: Todo;
  allTodos: Todo[];
  expanded?: boolean;
  onToggleExpand?: () => void;
  onStartSubtask?: () => void;
  isSubtask?: boolean;
}) {
  const toggle = useTodos((s) => s.toggle);
  const remove = useTodos((s) => s.remove);
  const updateText = useTodos((s) => s.updateText);
  const [editing, setEditing] = useState(false);
  const [textVal, setTextVal] = useState(todo.text);

  const subtasks = useMemo(() => allTodos.filter((t) => t.parentId === todo.id), [allTodos, todo.id]);
  const dateInfo = formatFriendlyDate(todo.dueDate);

  return (
    <div className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-hover border border-transparent hover:border-line/40">
      {/* Expand/Collapse Caret for Subtasks */}
      {!isSubtask && subtasks.length > 0 ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-0.5 text-faint hover:text-ink"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <div className="w-3.5" />
      )}

      {/* Round Checkbox (Markd Theme Colors) */}
      <button
        type="button"
        onClick={() => toggle(todo.id)}
        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-all ${
          todo.done
            ? "border-muted bg-muted text-bg"
            : "border-faint hover:border-sky-500"
        }`}
      >
        {todo.done && <CheckCircle2 size={12} />}
      </button>

      {/* Task Content */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (textVal.trim() && textVal !== todo.text) {
                updateText(todo.id, textVal.trim());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditing(false);
                if (textVal.trim() && textVal !== todo.text) {
                  updateText(todo.id, textVal.trim());
                }
              }
            }}
            className="w-full bg-transparent text-xs text-ink outline-none border-b border-sky-500"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            className={`select-none text-xs leading-relaxed transition-colors ${
              todo.done ? "text-faint line-through" : "text-ink"
            }`}
          >
            {todo.text}
          </span>
        )}

        {/* Date and Tag Badges */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {dateInfo.label && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                dateInfo.isOverdue
                  ? "text-sky-500 font-semibold"
                  : dateInfo.isToday
                  ? "text-amber-500 font-semibold"
                  : "text-muted"
              }`}
            >
              <Calendar size={10} />
              <span>{dateInfo.label}</span>
            </span>
          )}

          {todo.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 text-[10px] text-muted">
              <Inbox size={10} />
              <span className="capitalize">{tag}</span>
            </span>
          ))}

          {subtasks.length > 0 && (
            <span className="text-[10px] text-faint">
              ({subtasks.filter((s) => s.done).length}/{subtasks.length} subtarefas)
            </span>
          )}
        </div>
      </div>

      {/* Row Hover Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!isSubtask && onStartSubtask && (
          <button
            type="button"
            onClick={onStartSubtask}
            title="Adicionar subtarefa"
            className="rounded p-1 text-faint hover:bg-panel hover:text-ink"
          >
            <Plus size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={() => remove(todo.id)}
          title="Excluir tarefa"
          className="rounded p-1 text-faint hover:bg-panel hover:text-red-500"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
