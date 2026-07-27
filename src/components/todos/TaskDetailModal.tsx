import { useState, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  CornerDownRight,
  Flag,
  Hash,
  Plus,
  Trash2,
  X,
  History,
  Tag,
} from "lucide-react";
import type { Todo } from "@/lib/types";
import { useTodos } from "@/stores/todos";
import { formatFriendlyDate, formatFullTimestamp } from "@/lib/smartTodoParser";
import { Button } from "@/components/ui/Button";

export function TaskDetailModal({
  todo,
  onClose,
}: {
  todo: Todo;
  onClose: () => void;
}) {
  const { todos, toggle, updateText, setDueDate, setPriority, setTags, remove, addSmart } = useTodos();

  const [text, setText] = useState(todo.text);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const subtasks = useMemo(
    () => todos.filter((t) => t.parentId === todo.id),
    [todos, todo.id]
  );

  const completedSubtasksCount = subtasks.filter((s) => s.done).length;
  const subtasksProgress = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  const dateInfo = formatFriendlyDate(todo.dueDate);

  const handleSaveText = () => {
    if (text.trim() && text !== todo.text) {
      updateText(todo.id, text.trim());
    }
  };

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    void addSmart({
      text: subtaskInput.trim(),
      parentId: todo.id,
    });
    setSubtaskInput("");
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const cleanTag = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!todo.tags.includes(cleanTag)) {
      void setTags(todo.id, [...todo.tags, cleanTag]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    void setTags(
      todo.id,
      todo.tags.filter((t) => t !== tagToRemove)
    );
  };

  // Dates Presets
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 86400000;
  const nextWeekStart = todayStart + 7 * 86400000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-line bg-bg p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-ink">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggle(todo.id)}
              className={`grid h-5 w-5 place-items-center rounded-full border-2 transition-all ${
                todo.done
                  ? "border-muted bg-muted text-bg"
                  : todo.priority === "p1"
                  ? "border-red-500 hover:bg-red-500/10"
                  : todo.priority === "p2"
                  ? "border-amber-500 hover:bg-amber-500/10"
                  : todo.priority === "p3"
                  ? "border-blue-500 hover:bg-blue-500/10"
                  : "border-faint hover:border-sky-500"
              }`}
            >
              {todo.done && <CheckCircle2 size={13} />}
            </button>
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">
              {todo.done ? "Tarefa Concluída" : "Detalhes da Tarefa"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-faint hover:text-ink hover:bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col gap-5 pt-4 text-xs">
          {/* Title Editor */}
          <div>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleSaveText}
              className="w-full resize-none rounded-lg border border-transparent bg-panel p-2.5 text-sm font-medium text-ink outline-none transition-colors focus:border-sky-500/60 focus:bg-bg"
              placeholder="Nome da tarefa..."
            />
          </div>

          {/* History Timeline Info Card */}
          <div className="rounded-lg border border-line bg-panel/60 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-ink text-[11.5px]">
              <History size={13} className="text-sky-500" />
              <span>Histórico de Atividade:</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted pt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-faint font-medium">Data de Criação:</span>
                <span className="text-ink font-semibold">{formatFullTimestamp(todo.createdAt)}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-faint font-medium">Status / Conclusão:</span>
                <span className={todo.done ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
                  {todo.done ? `Concluída (${formatFullTimestamp(todo.completedAt || Date.now())})` : "Pendente / Em andamento"}
                </span>
              </div>
            </div>

            {/* Subtasks Progress Bar if subtasks exist */}
            {subtasks.length > 0 && (
              <div className="mt-2 pt-2 border-t border-line/60">
                <div className="flex justify-between text-[10.5px] text-muted mb-1 font-medium">
                  <span>Progresso das subtarefas:</span>
                  <span>{completedSubtasksCount} de {subtasks.length} ({subtasksProgress}%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-line/60 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${subtasksProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Controls Grid: Priority & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] font-semibold text-faint uppercase flex items-center gap-1">
                <Flag size={11} /> Prioridade
              </label>
              <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1">
                {(["p1", "p2", "p3", "p4"] as const).map((p) => {
                  const colors = {
                    p1: "text-red-500 hover:bg-red-500/10",
                    p2: "text-amber-500 hover:bg-amber-500/10",
                    p3: "text-blue-500 hover:bg-blue-500/10",
                    p4: "text-muted hover:bg-hover",
                  };
                  const activeColors = {
                    p1: "bg-red-500/20 font-bold border border-red-500/40",
                    p2: "bg-amber-500/20 font-bold border border-amber-500/40",
                    p3: "bg-blue-500/20 font-bold border border-blue-500/40",
                    p4: "bg-hover font-bold border border-line",
                  };
                  const isSelected = (todo.priority || "p4") === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(todo.id, p)}
                      className={`flex-1 rounded py-1 text-center text-[10.5px] transition-all ${
                        isSelected ? activeColors[p] : colors[p]
                      }`}
                    >
                      {p === "p1" ? "P1" : p === "p2" ? "P2" : p === "p3" ? "P3" : "P4"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date Presets */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] font-semibold text-faint uppercase flex items-center gap-1">
                <Calendar size={11} /> Data de Vencimento
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setDueDate(todo.id, todayStart)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    dateInfo.isToday
                      ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                      : "bg-panel text-muted hover:bg-hover hover:text-ink border border-line"
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(todo.id, tomorrowStart)}
                  className="rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-ink font-medium"
                >
                  Amanhã
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(todo.id, nextWeekStart)}
                  className="rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-ink font-medium"
                >
                  Próxima Semana
                </button>
                {todo.dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate(todo.id, null)}
                    className="rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] text-faint hover:text-red-500"
                    title="Remover data"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tags / Projects Section */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10.5px] font-semibold text-faint uppercase flex items-center gap-1">
              <Tag size={11} /> Etiquetas e Projetos
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {todo.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-panel border border-line px-2 py-0.5 text-[11px] text-muted font-medium"
                >
                  <Hash size={10} className="text-faint" />
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-faint hover:text-red-500 ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag();
                  }}
                  placeholder="+ Nova tag..."
                  className="h-6 w-24 rounded-md border border-line bg-panel px-2 text-[10.5px] text-ink outline-none placeholder:text-faint"
                />
              </div>
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="flex flex-col gap-2 pt-1 border-t border-line">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-faint uppercase">
                Subtarefas ({completedSubtasksCount}/{subtasks.length})
              </span>
            </div>

            <div className="space-y-1">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-panel/80 px-2.5 py-1.5 border border-line/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggle(sub.id)}
                      className={`grid h-3.5 w-3.5 place-items-center rounded-full border transition-all ${
                        sub.done ? "border-muted bg-muted text-bg" : "border-faint hover:border-sky-500"
                      }`}
                    >
                      {sub.done && <CheckCircle2 size={10} />}
                    </button>
                    <span className={`truncate ${sub.done ? "text-faint line-through" : "text-ink"}`}>
                      {sub.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(sub.id)}
                    className="text-faint hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <CornerDownRight size={13} className="text-faint" />
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubtask();
                }}
                placeholder="Adicionar subtarefa..."
                className="flex-1 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-sky-500/60 placeholder:text-faint"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddSubtask}
                disabled={!subtaskInput.trim()}
                className="bg-sky-500 text-white hover:bg-sky-600 font-medium text-xs h-7 px-2.5"
              >
                <Plus size={12} />
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-5 flex items-center justify-between pt-3 border-t border-line text-xs">
          <button
            type="button"
            onClick={() => {
              remove(todo.id);
              onClose();
            }}
            className="flex items-center gap-1 text-faint hover:text-red-500 font-medium"
          >
            <Trash2 size={13} /> Excluir
          </button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                toggle(todo.id);
              }}
              className={todo.done ? "bg-amber-600 text-white hover:bg-amber-500" : "bg-emerald-600 text-white hover:bg-emerald-500"}
            >
              {todo.done ? "Reabrir Tarefa" : "Concluir Tarefa"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
