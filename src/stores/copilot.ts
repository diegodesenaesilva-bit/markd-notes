import { create } from "zustand";

export interface InlineComment {
  id: string;
  selectedText: string;
  comment: string;
  createdAt: number;
}

interface CopilotState {
  copilotMode: boolean;
  autoApplyCopilot: boolean;
  inlineComments: InlineComment[];
  setCopilotMode: (enabled: boolean) => void;
  toggleCopilotMode: () => void;
  setAutoApplyCopilot: (enabled: boolean) => void;
  addInlineComment: (selectedText: string, comment: string) => void;
  removeInlineComment: (id: string) => void;
  clearInlineComments: () => void;
}

export const useCopilot = create<CopilotState>((set) => ({
  copilotMode: false,
  autoApplyCopilot: false,
  inlineComments: [],

  setCopilotMode: (enabled) => set({ copilotMode: enabled }),
  toggleCopilotMode: () => set((state) => ({ copilotMode: !state.copilotMode })),
  setAutoApplyCopilot: (enabled) => set({ autoApplyCopilot: enabled }),

  addInlineComment: (selectedText, comment) =>
    set((state) => ({
      inlineComments: [
        ...state.inlineComments,
        {
          id: Math.random().toString(36).substring(2, 9),
          selectedText,
          comment,
          createdAt: Date.now(),
        },
      ],
    })),

  removeInlineComment: (id) =>
    set((state) => ({
      inlineComments: state.inlineComments.filter((c) => c.id !== id),
    })),

  clearInlineComments: () => set({ inlineComments: [] }),
}));
