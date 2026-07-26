import { create } from "zustand";
import { toast } from "sonner";
import { ipc } from "@/lib/ipc";
import type { Todo } from "@/lib/types";
import { useTrash } from "@/stores/trash";

interface AddSmartTodoOptions {
  text: string;
  tags?: string[];
  dueDate?: number | null;
  projectId?: string | null;
  parentId?: string | null;
}

interface TodosState {
  todos: Todo[];
  tagRegistry: string[];
  loaded: boolean;
  /** active tag filter for the todos view (null = All) */
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  load: () => Promise<void>;
  add: (text: string, tags?: string[]) => Promise<void>;
  addSmart: (options: AddSmartTodoOptions) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  updateText: (id: string, text: string) => Promise<void>;
  setDueDate: (id: string, dueDate: number | null) => void;
  rescheduleOverdueToToday: () => void;
  setTags: (id: string, tags: string[]) => Promise<void>;
  createTag: (name: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

const oops = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : String(err));

export const useTodos = create<TodosState>((set, get) => ({
  todos: [],
  tagRegistry: [],
  loaded: false,
  tagFilter: null,

  setTagFilter: (tag) => set({ tagFilter: tag }),

  load: async () => {
    try {
      const [todos, tagRegistry] = await Promise.all([
        ipc.todosList(),
        ipc.todoTagsList(),
      ]);
      set({ todos, tagRegistry, loaded: true });
    } catch (err) {
      oops(err);
    }
  },

  add: async (text, tags) => {
    try {
      let todo = await ipc.todoAdd(text);
      if (tags && tags.length) {
        todo = await ipc.todoSetTags(todo.id, tags);
      }
      set({ todos: [todo, ...get().todos] });
    } catch (err) {
      oops(err);
    }
  },

  addSmart: async ({ text, tags, dueDate, projectId, parentId }) => {
    try {
      let todo = await ipc.todoAdd(text);
      const combinedTags = Array.from(new Set([...(tags || [])]));
      if (combinedTags.length) {
        todo = await ipc.todoSetTags(todo.id, combinedTags);
      }
      todo.dueDate = dueDate;
      todo.projectId = projectId;
      todo.parentId = parentId;

      const registry = new Set(get().tagRegistry);
      combinedTags.forEach((t) => registry.add(t));

      set({
        todos: [todo, ...get().todos],
        tagRegistry: [...registry],
      });
    } catch (err) {
      oops(err);
    }
  },

  toggle: async (id) => {
    set({
      todos: get().todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    });
    try {
      const updated = await ipc.todoToggle(id);
      set({
        todos: get().todos.map((t) =>
          t.id === id ? { ...t, ...updated, dueDate: t.dueDate, parentId: t.parentId } : t
        ),
      });
    } catch (err) {
      oops(err);
      get().load();
    }
  },

  updateText: async (id, text) => {
    try {
      const updated = await ipc.todoUpdate(id, text);
      set({
        todos: get().todos.map((t) =>
          t.id === id ? { ...t, ...updated, dueDate: t.dueDate, parentId: t.parentId } : t
        ),
      });
    } catch (err) {
      oops(err);
    }
  },

  setDueDate: (id, dueDate) => {
    set({
      todos: get().todos.map((t) => (t.id === id ? { ...t, dueDate } : t)),
    });
  },

  rescheduleOverdueToToday: () => {
    const today = new Date();
    const todayTs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    set({
      todos: get().todos.map((t) => {
        if (!t.done && t.dueDate && t.dueDate < todayTs) {
          return { ...t, dueDate: todayTs };
        }
        return t;
      }),
    });
    toast.success("Tarefas atrasadas reagendadas para hoje!");
  },

  setTags: async (id, tags) => {
    try {
      const updated = await ipc.todoSetTags(id, tags);
      const registry = new Set(get().tagRegistry);
      updated.tags.forEach((t) => registry.add(t));
      set({
        todos: get().todos.map((t) => (t.id === id ? { ...t, ...updated } : t)),
        tagRegistry: [...registry],
      });
    } catch (err) {
      oops(err);
    }
  },

  createTag: async (name) => {
    try {
      set({ tagRegistry: await ipc.todoTagCreate(name) });
    } catch (err) {
      oops(err);
    }
  },

  deleteTag: async (name) => {
    try {
      const tagRegistry = await ipc.todoTagDelete(name);
      set({
        tagRegistry,
        tagFilter: get().tagFilter === name ? null : get().tagFilter,
        todos: get().todos.map((t) => ({
          ...t,
          tags: t.tags.filter((tag) => tag !== name),
        })),
      });
    } catch (err) {
      oops(err);
    }
  },

  remove: async (id) => {
    const target = get().todos.find((t) => t.id === id);
    if (target) {
      useTrash.getState().addItem({
        name: target.text,
        type: "todo",
        payload: target,
      });
    }
    set({ todos: get().todos.filter((t) => t.id !== id && t.parentId !== id) });
    try {
      await ipc.todoDelete(id);
    } catch (err) {
      oops(err);
      get().load();
    }
  },

  clearCompleted: async () => {
    try {
      set({ todos: await ipc.todosClearCompleted() });
    } catch (err) {
      oops(err);
    }
  },
}));
