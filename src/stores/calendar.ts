import { create } from "zustand";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  category: "event" | "task" | "birthday" | "holiday" | "google";
  color?: string; // hex or tailwind name
  location?: string;
  description?: string;
  linkedNoteRel?: string;
  isGoogle?: boolean;
}

interface CalendarState {
  events: CalendarEvent[];
  visibleCategories: Set<string>;
  googleConnected: boolean;
  googleEmail: string | null;
  selectedDate: string; // YYYY-MM-DD
  viewMode: "day" | "week" | "month";
  
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: "day" | "week" | "month") => void;
  toggleCategory: (category: string) => void;
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  connectGoogle: (email?: string) => void;
  disconnectGoogle: () => void;
}

const STORAGE_KEY = "markd_calendar_events";
const GOOGLE_KEY = "markd_google_calendar_account";

function getTodayStr(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Reunião de Onboarding & Retenção",
    date: getTodayStr(0),
    startTime: "10:00",
    endTime: "11:00",
    category: "event",
    color: "#10b981", // emerald
    location: "Google Meet",
    description: "Apresentação da estratégia de onboarding e lançamento para a equipe.",
    linkedNoteRel: "Teste.md"
  },
  {
    id: "evt-2",
    title: "Sincronização de Projeto",
    date: getTodayStr(0),
    startTime: "14:30",
    endTime: "15:30",
    category: "event",
    color: "#10b981",
    location: "Sala de Reunião 2"
  },
  {
    id: "evt-3",
    title: "Entregar relatório semanal",
    date: getTodayStr(0),
    startTime: "16:00",
    endTime: "17:00",
    category: "task",
    color: "#8b5cf6" // purple
  },
  {
    id: "evt-4",
    title: "Review do App Markd",
    date: getTodayStr(1),
    startTime: "09:00",
    endTime: "10:00",
    category: "event",
    color: "#10b981"
  },
  {
    id: "evt-5",
    title: "Aniversário de Lançamento",
    date: getTodayStr(2),
    startTime: "08:00",
    endTime: "09:00",
    category: "birthday",
    color: "#ec4899"
  }
];

function loadEventsFromStorage(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return INITIAL_EVENTS;
}

function loadGoogleAccount(): string | null {
  try {
    return localStorage.getItem(GOOGLE_KEY) || null;
  } catch {
    return null;
  }
}

export const useCalendar = create<CalendarState>((set, get) => {
  const initialGoogle = loadGoogleAccount();

  return {
    events: loadEventsFromStorage(),
    visibleCategories: new Set(["event", "task", "birthday", "holiday", "google"]),
    googleConnected: !!initialGoogle,
    googleEmail: initialGoogle,
    selectedDate: getTodayStr(0),
    viewMode: "day",

    setSelectedDate: (date) => set({ selectedDate: date }),
    setViewMode: (mode) => set({ viewMode: mode }),

    toggleCategory: (category) => {
      const next = new Set(get().visibleCategories);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      set({ visibleCategories: next });
    },

    addEvent: (evt) => {
      const newEvt: CalendarEvent = {
        ...evt,
        id: "evt-" + Date.now(),
      };
      const updated = [...get().events, newEvt];
      set({ events: updated });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      toast.success("Evento adicionado com sucesso!");
    },

    updateEvent: (id, evt) => {
      const updated = get().events.map((e) => (e.id === id ? { ...e, ...evt } : e));
      set({ events: updated });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      toast.success("Evento atualizado!");
    },

    deleteEvent: (id) => {
      const updated = get().events.filter((e) => e.id !== id);
      set({ events: updated });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      toast.success("Evento removido");
    },

    connectGoogle: (email = "d.sena@vicunha.com") => {
      const sampleGoogleEvents: CalendarEvent[] = [
        {
          id: "google-1",
          title: "Sincronização Diária Google Calendar",
          date: getTodayStr(0),
          startTime: "11:30",
          endTime: "12:00",
          category: "google",
          color: "#3b82f6", // blue
          location: "Google Meet",
          description: "Sincronizado diretamente do Google Calendar",
          isGoogle: true
        },
        {
          id: "google-2",
          title: "Reunião de Diretoria",
          date: getTodayStr(1),
          startTime: "14:00",
          endTime: "15:30",
          category: "google",
          color: "#3b82f6",
          location: "Auditório Principal",
          description: "Sincronizado do Google Calendar",
          isGoogle: true
        }
      ];

      set({
        googleConnected: true,
        googleEmail: email,
        events: [...get().events.filter((e) => !e.isGoogle), ...sampleGoogleEvents]
      });

      try {
        localStorage.setItem(GOOGLE_KEY, email);
      } catch {
        // ignore
      }

      toast.success(`Google Agenda conectado (${email})`);
    },

    disconnectGoogle: () => {
      set({
        googleConnected: false,
        googleEmail: null,
        events: get().events.filter((e) => !e.isGoogle)
      });

      try {
        localStorage.removeItem(GOOGLE_KEY);
      } catch {
        // ignore
      }

      toast.success("Google Agenda desconectado");
    }
  };
});
