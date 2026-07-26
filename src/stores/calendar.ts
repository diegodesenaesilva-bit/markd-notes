import { create } from "zustand";
import { toast } from "sonner";
import { parseIcalData } from "@/lib/ical";

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
  googleIcalUrl: string | null;
  syncingGoogle: boolean;
  selectedDate: string; // YYYY-MM-DD
  viewMode: "day" | "week" | "month";
  
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: "day" | "week" | "month") => void;
  toggleCategory: (category: string) => void;
  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  syncIcalUrl: (url: string, email?: string) => Promise<boolean>;
  syncIcalContent: (content: string, email?: string) => boolean;
  disconnectGoogle: () => void;
}

const STORAGE_KEY = "markd_calendar_events";
const GOOGLE_KEY = "markd_google_calendar_account";
const GOOGLE_URL_KEY = "markd_google_calendar_ical_url";

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

function loadGoogleAccount(): { email: string | null; url: string | null } {
  try {
    return {
      email: localStorage.getItem(GOOGLE_KEY) || null,
      url: localStorage.getItem(GOOGLE_URL_KEY) || null,
    };
  } catch {
    return { email: null, url: null };
  }
}

export const useCalendar = create<CalendarState>((set, get) => {
  const initialGoogle = loadGoogleAccount();

  return {
    events: loadEventsFromStorage(),
    visibleCategories: new Set(["event", "task", "birthday", "holiday", "google"]),
    googleConnected: !!(initialGoogle.email || initialGoogle.url),
    googleEmail: initialGoogle.email,
    googleIcalUrl: initialGoogle.url,
    syncingGoogle: false,
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

    syncIcalUrl: async (url, email) => {
      set({ syncingGoogle: true });
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
        const text = await res.text();
        const parsed = parseIcalData(text);

        const googleEvents: CalendarEvent[] = parsed.map((item) => ({
          id: "google-" + item.id,
          title: item.title,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          category: "google",
          color: "#3b82f6",
          location: item.location,
          description: item.description,
          isGoogle: true,
        }));

        set({
          googleConnected: true,
          googleEmail: email || "Google Agenda (iCal)",
          googleIcalUrl: url,
          events: [...get().events.filter((e) => !e.isGoogle), ...googleEvents],
          syncingGoogle: false,
        });

        try {
          localStorage.setItem(GOOGLE_KEY, email || "Google Agenda (iCal)");
          localStorage.setItem(GOOGLE_URL_KEY, url);
        } catch {
          // ignore
        }

        toast.success(`Sincronizados ${googleEvents.length} eventos reais do Google Agenda!`);
        return true;
      } catch (err: any) {
        set({ syncingGoogle: false });
        toast.error(`Erro ao buscar feed do Google Agenda: ${err.message || "Erro de rede"}`);
        return false;
      }
    },

    syncIcalContent: (content, email) => {
      try {
        const parsed = parseIcalData(content);
        const googleEvents: CalendarEvent[] = parsed.map((item) => ({
          id: "google-" + item.id,
          title: item.title,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          category: "google",
          color: "#3b82f6",
          location: item.location,
          description: item.description,
          isGoogle: true,
        }));

        set({
          googleConnected: true,
          googleEmail: email || "Arquivo .ics do Google Agenda",
          events: [...get().events.filter((e) => !e.isGoogle), ...googleEvents],
        });

        try {
          localStorage.setItem(GOOGLE_KEY, email || "Arquivo .ics do Google Agenda");
        } catch {
          // ignore
        }

        toast.success(`Importados ${googleEvents.length} eventos reais do Google Agenda!`);
        return true;
      } catch (err: any) {
        toast.error(`Erro ao processar arquivo .ics: ${err.message || "Formato inválido"}`);
        return false;
      }
    },

    disconnectGoogle: () => {
      set({
        googleConnected: false,
        googleEmail: null,
        googleIcalUrl: null,
        events: get().events.filter((e) => !e.isGoogle)
      });

      try {
        localStorage.removeItem(GOOGLE_KEY);
        localStorage.removeItem(GOOGLE_URL_KEY);
      } catch {
        // ignore
      }

      toast.success("Google Agenda desconectado");
    }
  };
});

