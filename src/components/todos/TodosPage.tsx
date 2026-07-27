import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
  Flag,
  Hash,
  History,
  Inbox,
  Info,
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
import { formatFriendlyDate, formatFullTimestamp, parseSmartTodoInput } from "@/lib/smartTodoParser";
import { TaskDetailModal } from "./TaskDetailModal";

type ActiveTab = "today" | "inbox" | "upcoming" | "completed";

export function TodosPage() {
  const { todos, tagRegistry, loaded, load, addSmart, rescheduleOverdueToToday, clearCompleted } = useTodos();
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [subtaskInputValue, setSubtaskInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Todo | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Keep selectedTaskForDetail synced with store state
  useEffect(() => {
    if (selectedTaskForDetail) {
      const updated = todos.find((t) => t.id === selectedTaskForDetail.id);
      if (updated) setSelectedTaskForDetail(updated);
    }
  }, [todos, selectedTaskForDetail?.id]);

  // Parse smart input live
  const parsedPreview = useMemo(() => parseSmartTodoInput(inputValue), [inputValue]);

  // Dates math
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Mock initial overdue tasks for demonstration if empty
  useEffect(() => {
    if (loaded && todos.length === 0) {
      const yesterday = todayStart - 86400000;
      void addSmart({ text: "Retornar a Karen com nova proposta de trabalho p1", dueDate: yesterday, tags: ["entrada"] });
      void addSmart({ text: "Fazer post da inoar para o insta da circuito p2", dueDate: yesterday, tags: ["entrada"] });
      void addSmart({ text: "Criar proposta comercial pra estela p3", dueDate: yesterday, tags: ["entrada"] });
    }
  }, [loaded, todos.length, todayStart, addSmart]);

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

  // Group completed tasks by completion period for history view
  const completedGroups = useMemo(() => {
    if (activeTab !== "completed") return null;

    const groups: {
      today: Todo[];
      yesterday: Todo[];
      thisWeek: Todo[];
      older: Todo[];
    } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    const oneDay = 86400000;
    const yesterdayStart = todayStart - oneDay;
    const weekStart = todayStart - 6 * oneDay;

    todayTodos.forEach((todo) => {
      const ts = todo.completedAt || todo.createdAt;
      if (ts >= todayStart) {
        groups.today.push(todo);
      } else if (ts >= yesterdayStart) {
        groups.yesterday.push(todo);
      } else if (ts >= weekStart) {
        groups.thisWeek.push(todo);
      } else {
        groups.older.push(todo);
      }
    });

    return groups;
  }, [activeTab, todayTodos, todayStart]);

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
      priority: parsed.priority,
      tags: projectTag.length ? projectTag : ["entrada"],
    });

    setInputValue("");
  };

  const submitSubtask = (parentId: string) => {
    if (!subtaskInputValue.trim()) return;
    const parsed = parseSmartTodoInput(subtaskInputValue);
    void addSmart({
      text: parsed.cleanText,
      priority: parsed.priority,
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

  const todayFormatted = `${now.getDate()} ${now.toLocaleString("pt-BR", { month: "short" })} · Hoje · ${now.toLocaleString("pt-BR", { weekday: "long" })}`;

  return (
    <div className="page-scroll flex h-full w-full justify-center bg-bg px-6 py-8 text-ink">
      <div className="w-full max-w-[840px]">
        {/* Top Header & Navigation Filters Bar */}
        <div className="mb-6 space-y-4 border-b border-line pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink capitalize flex items-center gap-2">
                {selectedProject ? `# ${selectedProject}` : activeTab === "today" ? "Hoje" : activeTab === "inbox" ? "Entrada" : activeTab === "upcoming" ? "Em breve" : "Histórico de Concluídas"}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <CheckCircle2 size={13.5} />
                <span>
                  {activeTab === "completed"
                    ? `${completedTodosCount} tarefas concluídas no total`
                    : `${filteredTodos.length} tarefas pendentes`}
                </span>
              </p>
            </div>

            {/* Quick Search & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar tarefas..."
                  className="h-8 w-48 rounded-lg border border-line bg-panel pl-8 pr-2 text-xs text-ink outline-none transition-colors focus:border-sky-500/60 placeholder:text-faint"
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

              {activeTab === "completed" && completedTodosCount > 0 && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="h-8 px-2.5 rounded-lg border border-line bg-panel text-[11px] font-medium text-faint hover:text-red-500 hover:border-red-500/30 transition-colors"
                  title="Limpar todas as tarefas concluídas"
                >
                  Limpar Concluídas
                </button>
              )}
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
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30"
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
        {overdueCount > 0 && activeTab !== "completed" && (
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
                  onOpenDetail={() => setSelectedTaskForDetail(todo)}
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
        {activeTab !== "completed" && (
          <div className="mb-6 rounded-xl border border-line bg-panel p-3 shadow-sm transition-all focus-within:border-sky-500/60 focus-within:ring-1 focus-within:ring-sky-500/30">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewTask();
              }}
              placeholder="Adicionar tarefa (ex: 'Reunião amanhã 15h p1 #trabalho')..."
              className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
            />

            {/* Smart Parsed Badges Live Preview */}
            {(parsedPreview.dueDateLabel || parsedPreview.tags.length > 0 || parsedPreview.priority !== "p4") && (
              <div className="mt-2.5 flex items-center gap-2 border-t border-line/60 pt-2">
                <span className="text-[11px] text-faint flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-400" /> Detectado:
                </span>

                {parsedPreview.priority !== "p4" && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      parsedPreview.priority === "p1"
                        ? "bg-red-500/20 text-red-500"
                        : parsedPreview.priority === "p2"
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-blue-500/20 text-blue-500"
                    }`}
                  >
                    <Flag size={11} /> {parsedPreview.priority.toUpperCase()}
                  </span>
                )}

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
                Dica inteligente: Digite <kbd className="rounded bg-hover px-1 py-0.5 text-[10px] text-ink border border-line">p1</kbd> para prioridade e <kbd className="rounded bg-hover px-1 py-0.5 text-[10px] text-ink border border-line">#projeto</kbd>
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
        )}

        {/* Main List / Completed History View */}
        {activeTab === "completed" ? (
          /* Completed Tasks History View */
          <div className="space-y-6">
            {completedGroups && (
              <>
                {completedGroups.today.length > 0 && (
                  <CompletedGroupSection
                    title="Concluídas Hoje"
                    todos={completedGroups.today}
                    allTodos={todos}
                    onOpenDetail={setSelectedTaskForDetail}
                  />
                )}
                {completedGroups.yesterday.length > 0 && (
                  <CompletedGroupSection
                    title="Concluídas Ontem"
                    todos={completedGroups.yesterday}
                    allTodos={todos}
                    onOpenDetail={setSelectedTaskForDetail}
                  />
                )}
                {completedGroups.thisWeek.length > 0 && (
                  <CompletedGroupSection
                    title="Concluídas Nesta Semana"
                    todos={completedGroups.thisWeek}
                    allTodos={todos}
                    onOpenDetail={setSelectedTaskForDetail}
                  />
                )}
                {completedGroups.older.length > 0 && (
                  <CompletedGroupSection
                    title="Concluídas Anteriores"
                    todos={completedGroups.older}
                    allTodos={todos}
                    onOpenDetail={setSelectedTaskForDetail}
                  />
                )}

                {completedTodosCount === 0 && (
                  <div className="py-12 text-center text-xs text-faint">
                    <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Nenhuma tarefa concluída no histórico ainda.</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Normal Pending Tasks List */
          <div className="space-y-1">
            {todayTodos.map((todo) => (
              <div key={todo.id} className="space-y-1">
                <TodoItemRow
                  todo={todo}
                  allTodos={todos}
                  expanded={Boolean(expandedParents[todo.id])}
                  onToggleExpand={() => toggleExpandParent(todo.id)}
                  onStartSubtask={() => setAddingSubtaskFor(todo.id)}
                  onOpenDetail={() => setSelectedTaskForDetail(todo)}
                />

                {/* Subtasks rendering */}
                {expandedParents[todo.id] && (
                  <div className="ml-6 space-y-1 border-l-2 border-line pl-3 pt-1">
                    {todos
                      .filter((sub) => sub.parentId === todo.id)
                      .map((sub) => (
                        <TodoItemRow
                          key={sub.id}
                          todo={sub}
                          allTodos={todos}
                          isSubtask
                          onOpenDetail={() => setSelectedTaskForDetail(sub)}
                        />
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
                      placeholder="Nova subtarefa (ex: 'Revisar itens p2')..."
                      className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
                    />
                    <button
                      type="button"
                      onClick={() => submitSubtask(todo.id)}
                      className="rounded bg-sky-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-600"
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
        )}

        {/* Task Detail & History Inspector Modal */}
        {selectedTaskForDetail && (
          <TaskDetailModal
            todo={selectedTaskForDetail}
            onClose={() => setSelectedTaskForDetail(null)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Grouped Section Component for Completed Tasks History
 */
function CompletedGroupSection({
  title,
  todos,
  allTodos,
  onOpenDetail,
}: {
  title: string;
  todos: Todo[];
  allTodos: Todo[];
  onOpenDetail: (todo: Todo) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <History size={13} className="text-emerald-500" />
        <span>{title}</span>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 text-[10px] font-bold text-emerald-500">
          {todos.length}
        </span>
      </div>

      <div className="space-y-1 rounded-xl border border-line bg-panel/30 p-2">
        {todos.map((todo) => (
          <TodoItemRow
            key={todo.id}
            todo={todo}
            allTodos={allTodos}
            onOpenDetail={() => onOpenDetail(todo)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual Todo Row Component (Todoist + Markd Style)
 */
function TodoItemRow({
  todo,
  allTodos,
  expanded,
  onToggleExpand,
  onStartSubtask,
  onOpenDetail,
  isSubtask = false,
}: {
  todo: Todo;
  allTodos: Todo[];
  expanded?: boolean;
  onToggleExpand?: () => void;
  onStartSubtask?: () => void;
  onOpenDetail?: () => void;
  isSubtask?: boolean;
}) {
  const toggle = useTodos((s) => s.toggle);
  const remove = useTodos((s) => s.remove);
  const updateText = useTodos((s) => s.updateText);
  const setPriority = useTodos((s) => s.setPriority);
  const [editing, setEditing] = useState(false);
  const [textVal, setTextVal] = useState(todo.text);

  const subtasks = useMemo(() => allTodos.filter((t) => t.parentId === todo.id), [allTodos, todo.id]);
  const dateInfo = formatFriendlyDate(todo.dueDate);

  // Todoist Priority Color Ringing
  const getPriorityStyle = () => {
    if (todo.done) return "border-muted bg-muted text-bg";
    switch (todo.priority) {
      case "p1":
        return "border-red-500 hover:bg-red-500/10 text-red-500";
      case "p2":
        return "border-amber-500 hover:bg-amber-500/10 text-amber-500";
      case "p3":
        return "border-blue-500 hover:bg-blue-500/10 text-blue-500";
      default:
        return "border-faint hover:border-sky-500";
    }
  };

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

      {/* Round Checkbox with Todoist Priority styling */}
      <button
        type="button"
        onClick={() => toggle(todo.id)}
        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-all ${getPriorityStyle()}`}
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
          <div className="flex items-center gap-2">
            <span
              onClick={onOpenDetail}
              className={`select-none text-xs leading-relaxed transition-colors cursor-pointer hover:underline ${
                todo.done ? "text-faint line-through" : "text-ink"
              }`}
            >
              {todo.text}
            </span>

            {/* Priority Indicator Flag */}
            {todo.priority && todo.priority !== "p4" && !todo.done && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase ${
                  todo.priority === "p1"
                    ? "text-red-500"
                    : todo.priority === "p2"
                    ? "text-amber-500"
                    : "text-blue-500"
                }`}
              >
                <Flag size={10} />
                <span>{todo.priority.toUpperCase()}</span>
              </span>
            )}
          </div>
        )}

        {/* Date, Tags, Completion timestamp, and Subtasks info */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {todo.done && (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-500">
              <CheckCircle2 size={10} />
              <span>Concluída {formatFullTimestamp(todo.completedAt || todo.createdAt)}</span>
            </span>
          )}

          {!todo.done && dateInfo.label && (
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
        {/* Quick Priority Switcher */}
        {!todo.done && (
          <button
            type="button"
            onClick={() => {
              const nextP =
                todo.priority === "p1"
                  ? "p2"
                  : todo.priority === "p2"
                  ? "p3"
                  : todo.priority === "p3"
                  ? "p4"
                  : "p1";
              setPriority(todo.id, nextP);
            }}
            title="Alterar prioridade (P1, P2, P3, P4)"
            className="rounded p-1 text-faint hover:bg-panel hover:text-amber-500"
          >
            <Flag size={13} />
          </button>
        )}

        {!isSubtask && onStartSubtask && !todo.done && (
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
          onClick={onOpenDetail}
          title="Ver detalhes e histórico"
          className="rounded p-1 text-faint hover:bg-panel hover:text-sky-500"
        >
          <Info size={13} />
        </button>

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
