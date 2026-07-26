import { create } from "zustand";
import { toast } from "sonner";
import { ipc } from "@/lib/ipc";
import { useVault } from "@/stores/vault";
import { useCanvas } from "@/stores/canvas";
import { useTodos } from "@/stores/todos";
import { useBookmarks } from "@/stores/bookmarks";

export interface TrashedItem {
  id: string;
  name: string;
  type: "note" | "folder" | "canvas" | "todo" | "bookmark";
  rel?: string;
  content?: string;
  payload?: any;
  deletedAt: number;
}

interface TrashState {
  items: TrashedItem[];
  addItem: (item: Omit<TrashedItem, "id" | "deletedAt">) => void;
  restoreItem: (id: string) => Promise<void>;
  restoreAll: () => Promise<void>;
  deletePermanently: (id: string) => void;
  emptyTrash: () => void;
}

function getStoredTrash(): TrashedItem[] {
  try {
    const raw = localStorage.getItem("markd_trash_items");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredTrash(items: TrashedItem[]) {
  try {
    localStorage.setItem("markd_trash_items", JSON.stringify(items));
  } catch {
    // ignore
  }
}

export const useTrash = create<TrashState>((set, get) => ({
  items: getStoredTrash(),

  addItem: (itemData) => {
    const newItem: TrashedItem = {
      ...itemData,
      id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deletedAt: Date.now(),
    };
    const items = [newItem, ...get().items];
    set({ items });
    saveStoredTrash(items);
  },

  restoreItem: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;

    try {
      if (item.type === "note" && item.rel) {
        const parts = item.rel.split("/");
        const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
        const name = parts[parts.length - 1].replace(/\.md$/, "");
        const restoredRel = await ipc.createNote(dir, name);
        if (item.content) {
          await ipc.writeNote(restoredRel, item.content);
        }
        await useVault.getState().refreshTree();
      } else if (item.type === "folder" && item.rel) {
        const parts = item.rel.split("/");
        const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
        const name = parts[parts.length - 1];
        await ipc.createFolder(dir, name);
        await useVault.getState().refreshTree();
      } else if (item.type === "canvas" && item.payload) {
        const { meta, data } = item.payload;
        const canvasList = await useCanvas.getState().loadList();
        const newList = [...canvasList, meta];
        await ipc.canvasListSave(newList);
        if (data) {
          await ipc.canvasSave(data, meta.id);
        }
        await useCanvas.getState().loadList();
      } else if (item.type === "todo" && item.payload) {
        await useTodos.getState().add(item.payload.text || item.name, item.payload.tags);
      } else if (item.type === "bookmark" && item.payload) {
        await useBookmarks.getState().add(item.payload.url);
      }

      const nextItems = get().items.filter((i) => i.id !== id);
      set({ items: nextItems });
      saveStoredTrash(nextItems);
      toast.success(`"${item.name}" restaurado!`);
    } catch (err) {
      toast.error(`Erro ao restaurar "${item.name}"`);
    }
  },

  restoreAll: async () => {
    const items = [...get().items];
    for (const item of items) {
      await get().restoreItem(item.id);
    }
  },

  deletePermanently: (id) => {
    const nextItems = get().items.filter((i) => i.id !== id);
    set({ items: nextItems });
    saveStoredTrash(nextItems);
    toast("Item apagado permanentemente");
  },

  emptyTrash: () => {
    set({ items: [] });
    saveStoredTrash([]);
    toast("Lixeira esvaziada");
  },
}));
