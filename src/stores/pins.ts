import { create } from "zustand";
import { toast } from "sonner";
import { ipc } from "@/lib/ipc";

interface PinsState {
  pins: string[];
  loading: boolean;
  load: () => Promise<void>;
  pin: (rel: string) => Promise<void>;
  unpin: (rel: string) => Promise<void>;
  reorder: (fromIndex: number, toIndex: number) => Promise<void>;
  toggle: (rel: string) => Promise<void>;
  clear: () => void;
}

const showError = (error: unknown) =>
  toast.error(error instanceof Error ? error.message : String(error));

export const usePins = create<PinsState>((set, get) => ({
  pins: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      set({ pins: await ipc.pinsList() });
    } catch (error) {
      showError(error);
    } finally {
      set({ loading: false });
    }
  },

  pin: async (rel) => {
    try {
      set({ pins: await ipc.pinNote(rel) });
    } catch (error) {
      showError(error);
    }
  },

  unpin: async (rel) => {
    try {
      set({ pins: await ipc.unpinNote(rel) });
    } catch (error) {
      showError(error);
    }
  },

  reorder: async (fromIndex, toIndex) => {
    const pins = [...get().pins];
    if (fromIndex < 0 || fromIndex >= pins.length || toIndex < 0 || toIndex >= pins.length) return;
    const [removed] = pins.splice(fromIndex, 1);
    pins.splice(toIndex, 0, removed);
    set({ pins });
    try {
      set({ pins: await ipc.pinsSave(pins) });
    } catch (error) {
      showError(error);
    }
  },

  toggle: async (rel) => {
    if (get().pins.includes(rel)) {
      await get().unpin(rel);
    } else {
      await get().pin(rel);
    }
  },

  clear: () => set({ pins: [], loading: false }),
}));
