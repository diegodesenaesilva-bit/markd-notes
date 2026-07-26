import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  Check,
  X,
  RefreshCw
} from "lucide-react";
import { useCalendar, type CalendarEvent } from "@/stores/calendar";
import { useVault } from "@/stores/vault";
import { cx } from "@/lib/utils";
import { toast } from "sonner";

const DAYS_OF_WEEK_SHORT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatDateHeaderPT(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayName = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });
  const dayNum = d;
  const monthName = dateObj.toLocaleDateString("pt-BR", { month: "long" });
  const yearNum = y;
  return `${dayName}, ${dayNum} de ${monthName} de ${yearNum}`;
}

export function CalendarPage() {
  const {
    events,
    visibleCategories,
    googleConnected,
    googleEmail,
    googleIcalUrl,
    syncingGoogle,
    selectedDate,
    viewMode,
    setSelectedDate,
    setViewMode,
    toggleCategory,
    addEvent,
    updateEvent,
    deleteEvent,
    syncIcalUrl,
    syncIcalContent,
    disconnectGoogle
  } = useCalendar();

  const tree = useVault((s) => s.tree);

  const [modalOpen, setModalOpen] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form states for Event modal
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(selectedDate);
  const [formStartTime, setFormStartTime] = useState("10:00");
  const [formEndTime, setFormEndTime] = useState("11:00");
  const [formCategory, setFormCategory] = useState<CalendarEvent["category"]>("event");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLinkedNote, setFormLinkedNote] = useState("");

  const [selYear, selMonth, selDay] = selectedDate.split("-").map(Number);

  // Parse current date objects
  const currentDateObj = new Date(selYear, selMonth - 1, selDay);

  const handlePrev = () => {
    const d = new Date(currentDateObj);
    if (viewMode === "day") d.setDate(d.getDate() - 1);
    else if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleNext = () => {
    const d = new Date(currentDateObj);
    if (viewMode === "day") d.setDate(d.getDate() + 1);
    else if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const openNewEventModal = (dateStr = selectedDate, timeStr = "10:00") => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDate(dateStr);
    setFormStartTime(timeStr);
    const [h, min] = timeStr.split(":").map(Number);
    const endH = String((h + 1) % 24).padStart(2, "0");
    setFormEndTime(`${endH}:${String(min).padStart(2, "0")}`);
    setFormCategory("event");
    setFormLocation("");
    setFormDescription("");
    setFormLinkedNote("");
    setModalOpen(true);
  };

  const openEditEventModal = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormDate(evt.date);
    setFormStartTime(evt.startTime);
    setFormEndTime(evt.endTime);
    setFormCategory(evt.category);
    setFormLocation(evt.location || "");
    setFormDescription(evt.description || "");
    setFormLinkedNote(evt.linkedNoteRel || "");
    setModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Por favor, digite um título para o evento");
      return;
    }

    const categoryColors: Record<CalendarEvent["category"], string> = {
      event: "#10b981", // emerald
      task: "#8b5cf6", // purple
      birthday: "#ec4899", // pink
      holiday: "#f59e0b", // amber
      google: "#3b82f6" // blue
    };

    if (editingEvent) {
      updateEvent(editingEvent.id, {
        title: formTitle.trim(),
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        category: formCategory,
        color: categoryColors[formCategory],
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        linkedNoteRel: formLinkedNote || undefined
      });
    } else {
      addEvent({
        title: formTitle.trim(),
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        category: formCategory,
        color: categoryColors[formCategory],
        location: formLocation.trim() || undefined,
        description: formDescription.trim() || undefined,
        linkedNoteRel: formLinkedNote || undefined
      });
    }
    setModalOpen(false);
  };

  // Flatten notes for linked note select
  const allNotes = useMemo(() => {
    const list: { rel: string; name: string }[] = [];
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        if (n.kind === "note") {
          list.push({ rel: n.rel, name: n.name.replace(/\.md$/i, "") });
        }
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return list;
  }, [tree]);

  // Mini Calendar Calculations
  const miniCalDays = useMemo(() => {
    const firstDayOfMonth = new Date(selYear, selMonth - 1, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const daysInPrevMonth = new Date(selYear, selMonth - 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevM = selMonth - 1 === 0 ? 12 : selMonth - 1;
      const prevY = selMonth - 1 === 0 ? selYear - 1 : selYear;
      const mStr = String(prevM).padStart(2, "0");
      const dStr = String(prevDay).padStart(2, "0");
      days.push({ dateStr: `${prevY}-${mStr}-${dStr}`, dayNum: prevDay, isCurrentMonth: false });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(selMonth).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      days.push({ dateStr: `${selYear}-${mStr}-${dStr}`, dayNum: day, isCurrentMonth: true });
    }

    // Next month padding (up to 35 or 42 cells)
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = selMonth + 1 === 13 ? 1 : selMonth + 1;
      const nextY = selMonth + 1 === 13 ? selYear + 1 : selYear;
      const mStr = String(nextM).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      days.push({ dateStr: `${nextY}-${mStr}-${dStr}`, dayNum: day, isCurrentMonth: false });
    }

    return days;
  }, [selYear, selMonth]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => visibleCategories.has(e.category));
  }, [events, visibleCategories]);

  // Events for selected day
  const dayEvents = useMemo(() => {
    return filteredEvents.filter((e) => e.date === selectedDate);
  }, [filteredEvents, selectedDate]);

  return (
    <div className="flex h-full w-full flex-col bg-bg text-ink overflow-hidden select-none">
      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between border-b border-line-soft px-6 py-3 shrink-0 bg-panel/40">
        <button
          type="button"
          onClick={() => openNewEventModal()}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Novo Evento</span>
        </button>

        <div className="flex items-center gap-2">
          {/* View Mode Selector */}
          <div className="flex items-center rounded-lg border border-line-soft bg-bg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cx(
                "rounded-md px-2.5 py-1 transition-colors font-medium",
                viewMode === "day" ? "bg-hover text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cx(
                "rounded-md px-2.5 py-1 transition-colors font-medium",
                viewMode === "week" ? "bg-hover text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cx(
                "rounded-md px-2.5 py-1 transition-colors font-medium",
                viewMode === "month" ? "bg-hover text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-line-soft text-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-ink text-sm capitalize">
            {formatDateHeaderPT(selectedDate)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToday}
            className="rounded-md border border-line-soft bg-hover/80 px-2.5 py-1 font-medium text-muted hover:text-ink hover:bg-hover transition-colors"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 rounded-md text-faint hover:text-ink hover:bg-hover transition-colors"
            title="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="p-1 rounded-md text-faint hover:text-ink hover:bg-hover transition-colors"
            title="Próximo"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Layout (Sidebar + Grid) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side Panel (Mini-Calendar + Categories + Google Connect) */}
        <div className="w-[220px] shrink-0 border-r border-line-soft p-4 flex flex-col gap-5 overflow-y-auto bg-panel/20">
          {/* Mini Month Picker Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-ink px-1">
              <span>
                {MONTH_NAMES_PT[selMonth - 1]} {selYear}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const prevM = selMonth - 1 === 0 ? 12 : selMonth - 1;
                    const prevY = selMonth - 1 === 0 ? selYear - 1 : selYear;
                    const mStr = String(prevM).padStart(2, "0");
                    setSelectedDate(`${prevY}-${mStr}-01`);
                  }}
                  className="p-0.5 rounded text-faint hover:text-ink hover:bg-hover"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextM = selMonth + 1 === 13 ? 1 : selMonth + 1;
                    const nextY = selMonth + 1 === 13 ? selYear + 1 : selYear;
                    const mStr = String(nextM).padStart(2, "0");
                    setSelectedDate(`${nextY}-${mStr}-01`);
                  }}
                  className="p-0.5 rounded text-faint hover:text-ink hover:bg-hover"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Mini Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-[10px] text-center">
              {DAYS_OF_WEEK_SHORT.map((d) => (
                <span key={d} className="text-faint font-medium">
                  {d}
                </span>
              ))}
              {miniCalDays.map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === new Date().toISOString().split("T")[0];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={cx(
                      "h-6 w-6 rounded-full mx-auto flex items-center justify-center transition-colors font-medium text-[11px]",
                      isSelected
                        ? "bg-emerald-600 text-white font-bold"
                        : isToday
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold"
                          : cell.isCurrentMonth
                            ? "text-ink hover:bg-hover"
                            : "text-faint hover:bg-hover"
                    )}
                  >
                    {cell.dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Categories Filter */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line-soft">
            <span className="text-[11px] font-semibold text-faint uppercase tracking-wider">
              Categorias
            </span>

            <div className="flex flex-col gap-1.5 text-xs">
              <CategoryCheckbox
                label="Eventos"
                color="bg-emerald-500"
                checked={visibleCategories.has("event")}
                onChange={() => toggleCategory("event")}
              />
              <CategoryCheckbox
                label="Tarefas"
                color="bg-purple-500"
                checked={visibleCategories.has("task")}
                onChange={() => toggleCategory("task")}
              />
              <CategoryCheckbox
                label="Aniversários"
                color="bg-pink-500"
                checked={visibleCategories.has("birthday")}
                onChange={() => toggleCategory("birthday")}
              />
              <CategoryCheckbox
                label="Google Calendar"
                color="bg-blue-500"
                checked={visibleCategories.has("google")}
                onChange={() => toggleCategory("google")}
              />
            </div>
          </div>

          {/* Google Calendar Connection Section */}
          <div className="flex flex-col gap-2 pt-3 border-t border-line-soft mt-auto">
            <span className="text-[11px] font-semibold text-faint uppercase tracking-wider">
              Conectar Calendário
            </span>

            {googleConnected ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">Google Agenda</span>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium shrink-0">Ativo</span>
                </div>
                <p className="text-[11px] text-faint truncate">{googleEmail || "Sincronizado"}</p>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-blue-500/10">
                  {googleIcalUrl ? (
                    <button
                      type="button"
                      disabled={syncingGoogle}
                      onClick={() => void syncIcalUrl(googleIcalUrl, googleEmail || undefined)}
                      className="flex items-center gap-1 text-[10.5px] text-blue-500 hover:underline disabled:opacity-50"
                    >
                      <RefreshCw size={10} className={syncingGoogle ? "animate-spin" : ""} />
                      {syncingGoogle ? "Sincronizando..." : "Sincronizar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGoogleModalOpen(true)}
                      className="flex items-center gap-1 text-[10.5px] text-blue-500 hover:underline"
                    >
                      Configurar Link
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={disconnectGoogle}
                    className="text-[10.5px] text-rose-500 hover:underline"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setGoogleModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg border border-line-soft bg-bg p-2 text-xs font-medium text-ink hover:bg-hover transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Conectar Google Agenda</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Calendar View Area */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-bg overflow-hidden">
          {viewMode === "day" && (
            <DayView
              selectedDate={selectedDate}
              events={dayEvents}
              onSelectEvent={openEditEventModal}
              onSlotClick={(time) => openNewEventModal(selectedDate, time)}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={openEditEventModal}
              onSlotClick={(date, time) => openNewEventModal(date, time)}
            />
          )}

          {viewMode === "month" && (
            <MonthView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setViewMode("day");
              }}
              onSelectEvent={openEditEventModal}
            />
          )}
        </div>
      </div>

      {/* Event Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-line-soft bg-bg p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-line-soft">
              <h3 className="text-base font-semibold text-ink">
                {editingEvent ? "Editar Evento" : "Novo Evento"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-faint hover:text-ink hover:bg-hover"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="flex flex-col gap-4 pt-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-faint text-[11px] uppercase">Título</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Nome do compromisso..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-md border border-line-soft bg-panel px-3 py-2 text-ink text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-faint text-[11px] uppercase">Data</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-md border border-line-soft bg-panel px-2 py-1.5 text-ink outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-faint text-[11px] uppercase">Início</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full rounded-md border border-line-soft bg-panel px-2 py-1.5 text-ink outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-faint text-[11px] uppercase">Término</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full rounded-md border border-line-soft bg-panel px-2 py-1.5 text-ink outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-faint text-[11px] uppercase">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as CalendarEvent["category"])}
                    className="w-full rounded-md border border-line-soft bg-panel px-2.5 py-1.5 text-ink outline-none"
                  >
                    <option value="event">Evento (Verde)</option>
                    <option value="task">Tarefa (Roxo)</option>
                    <option value="birthday">Aniversário (Rosa)</option>
                    <option value="holiday">Feriado (Amarelo)</option>
                    <option value="google">Google (Azul)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-faint text-[11px] uppercase">Vincular Nota</label>
                  <select
                    value={formLinkedNote}
                    onChange={(e) => setFormLinkedNote(e.target.value)}
                    className="w-full rounded-md border border-line-soft bg-panel px-2.5 py-1.5 text-ink outline-none truncate"
                  >
                    <option value="">Nenhuma nota</option>
                    {allNotes.map((n) => (
                      <option key={n.rel} value={n.rel}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-faint text-[11px] uppercase">Local / Link</label>
                <input
                  type="text"
                  placeholder="Ex: Google Meet, Sala 3..."
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full rounded-md border border-line-soft bg-panel px-3 py-1.5 text-ink outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-faint text-[11px] uppercase">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Anotações do evento..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-md border border-line-soft bg-panel px-3 py-1.5 text-ink outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-line-soft mt-2">
                {editingEvent ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteEvent(editingEvent.id);
                      setModalOpen(false);
                    }}
                    className="flex items-center gap-1 text-rose-500 hover:text-rose-600 font-medium"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-line-soft px-3 py-1.5 text-muted hover:text-ink hover:bg-hover font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 font-medium text-white hover:bg-emerald-500"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Calendar Connect Modal */}
      {googleModalOpen && (
        <GoogleConnectModal
          onClose={() => setGoogleModalOpen(false)}
          defaultEmail={googleEmail || ""}
          defaultUrl={googleIcalUrl || ""}
          onSyncUrl={async (url, email) => {
            const success = await syncIcalUrl(url, email);
            if (success) setGoogleModalOpen(false);
          }}
          onSyncContent={(content, email) => {
            const success = syncIcalContent(content, email);
            if (success) setGoogleModalOpen(false);
          }}
          syncing={syncingGoogle}
        />
      )}
    </div>
  );
}

function CategoryCheckbox({
  label,
  color,
  checked,
  onChange
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-muted hover:text-ink transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={cx(
          "h-3.5 w-3.5 rounded flex items-center justify-center border transition-colors",
          checked ? "bg-hover border-line" : "border-line-soft bg-bg"
        )}
      >
        {checked && <span className={cx("h-2 w-2 rounded-full", color)} />}
      </span>
      <span className={cx("truncate font-medium", !checked && "line-through opacity-50")}>{label}</span>
    </label>
  );
}

/* Day View Component with Hourly Timeline */
function DayView({
  selectedDate,
  events,
  onSelectEvent,
  onSlotClick
}: {
  selectedDate: string;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSlotClick: (time: string) => void;
}) {
  const setView = useVault((s) => s.setView);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Check if today is selected
  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const topPercent = ((currentHour * 60 + currentMin) / (24 * 60)) * 100;

  return (
    <div className="relative flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
      <div className="relative min-h-[1200px] border-l border-line-soft ml-16">
        {/* Current Time Indicator Line */}
        {isToday && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center"
            style={{ top: `${topPercent}%` }}
          >
            <div className="h-2.5 w-2.5 -ml-1.25 rounded-full bg-rose-500 shadow-sm" />
            <div className="h-0.5 w-full bg-rose-500" />
          </div>
        )}

        {hours.map((h) => {
          const timeStr = `${String(h).padStart(2, "0")}:00`;
          const slotEvents = events.filter((e) => {
            const startH = parseInt(e.startTime.split(":")[0], 10);
            return startH === h;
          });

          return (
            <div
              key={h}
              onClick={() => onSlotClick(timeStr)}
              className="group relative h-12 border-b border-line-soft/50 hover:bg-hover/20 cursor-pointer transition-colors"
            >
              {/* Hour Label */}
              <span className="absolute -left-16 -top-2 text-[11px] font-mono text-faint w-12 text-right">
                {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
              </span>

              {/* Render Slot Events */}
              <div className="absolute inset-0 flex flex-wrap gap-1 p-0.5 z-10 pointer-events-none">
                {slotEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(evt);
                    }}
                    className="pointer-events-auto flex items-center justify-between rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity min-w-[200px]"
                    style={{ backgroundColor: evt.color || "#10b981" }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate font-semibold">{evt.title}</span>
                      <span className="text-[10px] opacity-80">
                        {evt.startTime} - {evt.endTime}
                      </span>
                    </div>

                    {evt.linkedNoteRel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setView({ type: "note", rel: evt.linkedNoteRel! });
                        }}
                        className="p-0.5 rounded bg-black/20 hover:bg-black/40 text-white ml-2 shrink-0"
                        title={`Abrir nota: ${evt.linkedNoteRel}`}
                      >
                        <FileText size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Week View Component */
function WeekView({
  selectedDate,
  events,
  onSelectEvent,
  onSlotClick
}: {
  selectedDate: string;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSlotClick: (date: string, time: string) => void;
}) {
  const [y, m, d] = selectedDate.split("-").map(Number);
  const selectedDateObj = new Date(y, m - 1, d);
  const dayOfWeek = selectedDateObj.getDay();

  // Get week days (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    for (let i = 0; i < 7; i++) {
      const date = new Date(selectedDateObj);
      date.setDate(selectedDateObj.getDate() - dayOfWeek + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      days.push({
        dateStr,
        dayName: DAYS_OF_WEEK_SHORT[i],
        dayNum: date.getDate(),
        isToday: dateStr === todayStr
      });
    }
    return days;
  }, [selectedDateObj, dayOfWeek]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Week Header */}
      <div className="grid grid-cols-7 border-b border-line-soft text-xs text-center py-2 bg-panel/30">
        {weekDays.map((wd) => (
          <div key={wd.dateStr} className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-medium text-faint uppercase">{wd.dayName}</span>
            <span
              className={cx(
                "h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs",
                wd.isToday ? "bg-emerald-600 text-white" : "text-ink"
              )}
            >
              {wd.dayNum}
            </span>
          </div>
        ))}
      </div>

      {/* Week Grid Columns */}
      <div className="flex-1 grid grid-cols-7 divide-x divide-line-soft/50 overflow-y-auto p-2">
        {weekDays.map((wd) => {
          const dayEvts = events.filter((e) => e.date === wd.dateStr);

          return (
            <div
              key={wd.dateStr}
              onClick={() => onSlotClick(wd.dateStr, "10:00")}
              className="flex flex-col gap-1.5 p-1.5 min-h-[500px] hover:bg-hover/10 transition-colors cursor-pointer"
            >
              {dayEvts.map((evt) => (
                <div
                  key={evt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(evt);
                  }}
                  className="rounded-md p-2 text-xs text-white shadow-2xs font-medium cursor-pointer hover:opacity-90 transition-opacity flex flex-col gap-1"
                  style={{ backgroundColor: evt.color || "#10b981" }}
                >
                  <span className="font-semibold leading-tight line-clamp-2">{evt.title}</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    {evt.startTime} - {evt.endTime}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Month View Component */
function MonthView({
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent
}: {
  selectedDate: string;
  events: CalendarEvent[];
  onSelectDate: (date: string) => void;
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const [selYear, selMonth] = selectedDate.split("-").map(Number);

  const monthGridDays = useMemo(() => {
    const firstDay = new Date(selYear, selMonth - 1, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const daysInPrevMonth = new Date(selYear, selMonth - 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevM = selMonth - 1 === 0 ? 12 : selMonth - 1;
      const prevY = selMonth - 1 === 0 ? selYear - 1 : selYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`;
      days.push({ dateStr, dayNum: prevDay, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selYear}-${String(selMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ dateStr, dayNum: day, isCurrentMonth: true, isToday: dateStr === todayStr });
    }

    // Next month padding
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = selMonth + 1 === 13 ? 1 : selMonth + 1;
      const nextY = selMonth + 1 === 13 ? selYear + 1 : selYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ dateStr, dayNum: day, isCurrentMonth: false, isToday: dateStr === todayStr });
    }

    return days;
  }, [selYear, selMonth]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line-soft text-xs text-center py-2 bg-panel/30 font-medium text-faint">
        {DAYS_OF_WEEK_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-5 divide-x divide-y divide-line-soft/50 overflow-hidden">
        {monthGridDays.map((cell) => {
          const cellEvts = events.filter((e) => e.date === cell.dateStr);

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr)}
              className={cx(
                "p-1.5 flex flex-col gap-1 overflow-hidden transition-colors cursor-pointer hover:bg-hover/30",
                !cell.isCurrentMonth && "bg-panel/10 text-faint"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    "text-xs font-semibold h-5 w-5 rounded-full flex items-center justify-center",
                    cell.isToday
                      ? "bg-emerald-600 text-white"
                      : cell.isCurrentMonth
                        ? "text-ink"
                        : "text-faint"
                  )}
                >
                  {cell.dayNum}
                </span>
              </div>

              <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px]">
                {cellEvts.slice(0, 3).map((evt) => (
                  <div
                    key={evt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(evt);
                    }}
                    className="rounded px-1.5 py-0.5 text-[10.5px] text-white font-medium truncate"
                    style={{ backgroundColor: evt.color || "#10b981" }}
                  >
                    {evt.title}
                  </div>
                ))}
                {cellEvts.length > 3 && (
                  <span className="text-[10px] text-faint font-semibold pl-1">
                    +{cellEvts.length - 3} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoogleConnectModal({
  onClose,
  defaultEmail,
  defaultUrl,
  onSyncUrl,
  onSyncContent,
  syncing,
}: {
  onClose: () => void;
  defaultEmail: string;
  defaultUrl: string;
  onSyncUrl: (url: string, email: string) => Promise<void>;
  onSyncContent: (content: string, email: string) => void;
  syncing: boolean;
}) {
  const [method, setMethod] = useState<"url" | "file">("url");
  const [email, setEmail] = useState(defaultEmail || "");
  const [url, setUrl] = useState(defaultUrl || "");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onSyncContent(content, email || file.name);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-line-soft bg-bg p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-line-soft">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            Sincronizar Google Agenda Real
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-faint hover:text-ink hover:bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 pt-3 text-xs">
          <p className="text-muted leading-relaxed">
            Para sincronizar seus eventos reais do Google Agenda no seu Markd para Windows de forma 100% privada e sem servidores intermediários, escolha uma das opções abaixo:
          </p>

          <div className="flex rounded-lg border border-line-soft bg-panel p-0.5">
            <button
              type="button"
              onClick={() => setMethod("url")}
              className={cx(
                "flex-1 rounded-md py-1.5 text-[11.5px] font-medium transition-colors",
                method === "url" ? "bg-bg text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              Link Secreto iCal (.ics)
            </button>
            <button
              type="button"
              onClick={() => setMethod("file")}
              className={cx(
                "flex-1 rounded-md py-1.5 text-[11.5px] font-medium transition-colors",
                method === "file" ? "bg-bg text-ink shadow-xs" : "text-muted hover:text-ink"
              )}
            >
              Importar Arquivo .ics
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-faint text-[11px] uppercase">Seu E-mail do Google (Opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu-email@gmail.com"
              className="w-full rounded-md border border-line-soft bg-panel px-3 py-2 text-ink outline-none focus:border-blue-500"
            />
          </div>

          {method === "url" ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-[11px] text-faint leading-normal">
                <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">Como obter seu Link Secreto iCal:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Acesse o Google Agenda no navegador web.</li>
                  <li>Clique na engrenagem ⚙️ &gt; <strong>Configurações</strong>.</li>
                  <li>Selecione sua agenda na barra lateral &gt; <strong>Integrar agenda</strong>.</li>
                  <li>Copie o <strong>Endereço secreto em formato iCal</strong>.</li>
                </ol>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-faint text-[11px] uppercase">Link Secreto iCal (.ics)</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  className="w-full rounded-md border border-line-soft bg-panel px-3 py-2 text-ink outline-none focus:border-blue-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-line-soft px-3 py-1.5 text-muted hover:text-ink hover:bg-hover font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!url.trim() || syncing}
                  onClick={() => void onSyncUrl(url.trim(), email)}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {syncing ? "Sincronizando..." : "Sincronizar Eventos Reais"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-faint text-[11px] uppercase">Selecionar Arquivo .ics</label>
                <input
                  type="file"
                  accept=".ics"
                  onChange={handleFileUpload}
                  className="w-full rounded-md border border-line-soft bg-panel p-2 text-ink text-[11px]"
                />
                <span className="text-[10.5px] text-faint mt-1">
                  Exporte o arquivo de agenda no Google Agenda (Configurações &gt; Importar/Exportar) e selecione o arquivo .ics aqui.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-line-soft px-3 py-1.5 text-muted hover:text-ink hover:bg-hover font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
