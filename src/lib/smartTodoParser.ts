export interface ParsedTodoInput {
  cleanText: string;
  dueDate: number | null; // ms timestamp or null
  dueDateLabel: string | null; // e.g. "Hoje", "Amanhã", "Segunda-feira", "25 jul"
  priority: "p1" | "p2" | "p3" | "p4";
  tags: string[];
}

/**
 * Intelligent Natural Language Parser for Todoist-style quick task entry.
 * Recognizes dates like: "hoje", "amanhã", "ontem", "segunda", "terça", "25 jul", "15:00", etc.
 * Recognizes priorities: "p1" / "!1" (Urgente), "p2" / "!2" (Alta), "p3" / "!3" (Média), "p4" / "!4" (Normal).
 * Recognizes tags/projects: "#trabalho", "#compras", "#pessoal".
 */
export function parseSmartTodoInput(rawInput: string): ParsedTodoInput {
  let text = rawInput;
  const tags: string[] = [];
  let priority: "p1" | "p2" | "p3" | "p4" = "p4";

  // 1. Extract priority (p1, p2, p3, p4 or !1, !2, !3, !4)
  const priorityRegex = /(?:^|\s)(?:p([1-4])|!([1-4]))(?=\s|$)/i;
  const pMatch = priorityRegex.exec(text);
  if (pMatch) {
    const val = pMatch[1] || pMatch[2];
    if (val === "1") priority = "p1";
    if (val === "2") priority = "p2";
    if (val === "3") priority = "p3";
    if (val === "4") priority = "p4";
    text = text.replace(priorityRegex, " ").trim();
  }

  // 2. Extract hashtags/projects (e.g. #trabalho, #compras)
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(rawInput)) !== null) {
    if (tagMatch[1]) {
      tags.push(tagMatch[1].toLowerCase());
    }
  }
  text = text.replace(tagRegex, " ").trim();

  // 3. Extract time if present (e.g., "15:30", "14h")
  let extractedHour: number | null = null;
  let extractedMin: number | null = null;
  const timeRegex = /\b([0-1]?[0-9]|2[0-3])(?:[:hH]([0-5][0-9]))?\s*(?:h|hrs)?\b/;
  const timeMatch = timeRegex.exec(text);
  if (timeMatch && (text.toLowerCase().includes("h") || text.includes(":"))) {
    extractedHour = parseInt(timeMatch[1], 10);
    extractedMin = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  }

  // 4. Extract date/time tokens
  let dueDate: number | null = null;
  let dueDateLabel: string | null = null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const lower = text.toLowerCase();

  if (/\b(hoje|today)\b/i.test(lower)) {
    dueDate = today.getTime();
    dueDateLabel = "Hoje";
    text = text.replace(/\b(hoje|today)\b/gi, "").trim();
  } else if (/\b(amanhã|amanha|tomorrow)\b/i.test(lower)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dueDate = tomorrow.getTime();
    dueDateLabel = "Amanhã";
    text = text.replace(/\b(amanhã|amanha|tomorrow)\b/gi, "").trim();
  } else if (/\b(ontem|yesterday)\b/i.test(lower)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    dueDate = yesterday.getTime();
    dueDateLabel = "Ontem";
    text = text.replace(/\b(ontem|yesterday)\b/gi, "").trim();
  } else {
    const weekDays: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      terca: 2,
      terça: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sabado: 6,
      sábado: 6,
    };

    let matchedDay = false;
    for (const [dayName, dayNum] of Object.entries(weekDays)) {
      const dayRegex = new RegExp(`\\b(${dayName}|${dayName}-feira)\\b`, "i");
      if (dayRegex.test(lower)) {
        const currentDay = today.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + diff);
        dueDate = targetDate.getTime();
        dueDateLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        text = text.replace(dayRegex, "").trim();
        matchedDay = true;
        break;
      }
    }

    if (!matchedDay) {
      const dateMatch = /\b(?:dia\s+)?(\d{1,2})(?:\s+de\s+|\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)?\b/i.exec(text);
      if (dateMatch) {
        const dayVal = parseInt(dateMatch[1], 10);
        if (dayVal >= 1 && dayVal <= 31) {
          const targetDate = new Date(today);
          targetDate.setDate(dayVal);
          if (dateMatch[2]) {
            const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
            const monthIdx = months.indexOf(dateMatch[2].toLowerCase());
            if (monthIdx !== -1) targetDate.setMonth(monthIdx);
          }
          dueDate = targetDate.getTime();
          dueDateLabel = `${dayVal} ${dateMatch[2] ? dateMatch[2].toLowerCase() : ""}`.trim();
          text = text.replace(dateMatch[0], "").trim();
        }
      }
    }
  }

  // If time was parsed, attach hours/mins if we have a due date or set to today
  if (extractedHour !== null) {
    if (!dueDate) {
      dueDate = today.getTime();
      dueDateLabel = "Hoje";
    }
    const dObj = new Date(dueDate);
    dObj.setHours(extractedHour, extractedMin ?? 0, 0, 0);
    dueDate = dObj.getTime();
    dueDateLabel = `${dueDateLabel || "Hoje"} ${String(extractedHour).padStart(2, "0")}:${String(extractedMin ?? 0).padStart(2, "0")}`;
  }

  // Clean up multiple spaces
  const cleanText = text.replace(/\s+/g, " ").trim() || rawInput.trim();

  return {
    cleanText,
    dueDate,
    dueDateLabel,
    priority,
    tags,
  };
}

/**
 * Format timestamp to friendly label (e.g. "Ontem", "Hoje", "Amanhã", "25 jul")
 */
export function formatFriendlyDate(timestamp: number | null | undefined): { label: string; isOverdue: boolean; isToday: boolean } {
  if (!timestamp) return { label: "", isOverdue: false, isToday: false };

  const target = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let timeStr = "";
  if (target.getHours() !== 0 || target.getMinutes() !== 0) {
    timeStr = ` ${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`;
  }

  if (diffDays < 0) {
    return {
      label: (diffDays === -1 ? "Ontem" : `${target.getDate()} ${target.toLocaleString("pt-BR", { month: "short" })}`) + timeStr,
      isOverdue: true,
      isToday: false,
    };
  }

  if (diffDays === 0) {
    return { label: "Hoje" + timeStr, isOverdue: false, isToday: true };
  }

  if (diffDays === 1) {
    return { label: "Amanhã" + timeStr, isOverdue: false, isToday: false };
  }

  const dayName = target.toLocaleString("pt-BR", { weekday: "short" });
  const monthName = target.toLocaleString("pt-BR", { month: "short" });
  return {
    label: `${target.getDate()} ${monthName} (${dayName})${timeStr}`,
    isOverdue: false,
    isToday: false,
  };
}

/**
 * Format timestamp to complete date & time string for task history
 */
export function formatFullTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return "Data não registrada";
  const d = new Date(timestamp);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
