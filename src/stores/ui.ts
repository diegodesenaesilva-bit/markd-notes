import { create } from "zustand";

type SaveState = "idle" | "saving" | "error";
export type SettingsPage = "general" | "appearance" | "shortcuts";
export type NoteWidth = "focused" | "normal" | "expanded";

export type RightPanelTab = "mark" | "backlinks" | "writing-assistant";

interface UiState {
  paletteOpen: boolean;
  settingsOpen: boolean;
  settingsPage: SettingsPage;
  sidebarHidden: boolean;
  backlinksHidden: boolean;
  aiSidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  activeNoteRel: string | null;
  activeNoteTitle: string;
  activeNoteContent: string;
  activeNoteSelectedText: string;
  markdownSource: boolean;
  saveState: SaveState;
  noteWidth: NoteWidth;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openSettings: (page?: SettingsPage) => void;
  setSettingsPage: (page: SettingsPage) => void;
  toggleSidebar: () => void;
  toggleBacklinks: () => void;
  toggleAiSidebar: () => void;
  setAiSidebarOpen: (open: boolean) => void;
  openRightPanel: (tab?: RightPanelTab) => void;
  closeRightPanel: () => void;
  toggleRightPanel: (tab?: RightPanelTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setActiveNoteContext: (ctx: {
    rel: string | null;
    title: string;
    content: string;
    selectedText: string;
  }) => void;
  toggleMarkdownSource: () => void;
  setSaveState: (state: SaveState) => void;
  cycleNoteWidth: () => void;
}

export const useUi = create<UiState>((set, get) => ({
  paletteOpen: false,
  settingsOpen: false,
  settingsPage: "general",
  sidebarHidden: false,
  backlinksHidden: true,
  aiSidebarOpen: false,
  rightPanelOpen: false,
  rightPanelTab: "mark",
  activeNoteRel: null,
  activeNoteTitle: "Nota Sem Título",
  activeNoteContent: "",
  activeNoteSelectedText: "",
  markdownSource: false,
  saveState: "idle",
  noteWidth: "normal",
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  openSettings: (settingsPage = "general") =>
    set({ settingsOpen: true, settingsPage }),
  setSettingsPage: (settingsPage) => set({ settingsPage }),
  toggleSidebar: () => set({ sidebarHidden: !get().sidebarHidden }),
  toggleBacklinks: () => {
    const currentOpen = get().rightPanelOpen;
    const currentTab = get().rightPanelTab;
    if (currentOpen && currentTab === "backlinks") {
      set({ rightPanelOpen: false, backlinksHidden: true });
    } else {
      set({ rightPanelOpen: true, rightPanelTab: "backlinks", backlinksHidden: false, aiSidebarOpen: false });
    }
  },
  toggleAiSidebar: () => {
    const currentOpen = get().rightPanelOpen;
    const currentTab = get().rightPanelTab;
    if (currentOpen && currentTab === "mark") {
      set({ rightPanelOpen: false, aiSidebarOpen: false });
    } else {
      set({ rightPanelOpen: true, rightPanelTab: "mark", aiSidebarOpen: true, backlinksHidden: true });
    }
  },
  setAiSidebarOpen: (open) => {
    if (open) {
      set({ rightPanelOpen: true, rightPanelTab: "mark", aiSidebarOpen: true, backlinksHidden: true });
    } else {
      if (get().rightPanelTab === "mark") {
        set({ rightPanelOpen: false, aiSidebarOpen: false });
      }
    }
  },
  openRightPanel: (tab = "mark") =>
    set({ rightPanelOpen: true, rightPanelTab: tab, aiSidebarOpen: tab === "mark", backlinksHidden: tab === "backlinks" }),
  closeRightPanel: () => set({ rightPanelOpen: false }),
  toggleRightPanel: (tab = "mark") => {
    const currentOpen = get().rightPanelOpen;
    const currentTab = get().rightPanelTab;
    if (currentOpen && currentTab === tab) {
      set({ rightPanelOpen: false });
    } else {
      set({ rightPanelOpen: true, rightPanelTab: tab, aiSidebarOpen: tab === "mark", backlinksHidden: tab === "backlinks" });
    }
  },
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, aiSidebarOpen: tab === "mark", backlinksHidden: tab === "backlinks" }),
  setActiveNoteContext: (ctx) =>
    set({
      activeNoteRel: ctx.rel,
      activeNoteTitle: ctx.title,
      activeNoteContent: ctx.content,
      activeNoteSelectedText: ctx.selectedText,
    }),
  toggleMarkdownSource: () =>
    set({ markdownSource: !get().markdownSource }),
  setSaveState: (saveState) => set({ saveState }),
  cycleNoteWidth: () => {
    const order: NoteWidth[] = ["focused", "normal", "expanded"];
    const current = get().noteWidth;
    const next = order[(order.indexOf(current) + 1) % order.length];
    set({ noteWidth: next });
  },
}));
