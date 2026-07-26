export interface ParsedTodoInput {
  cleanText: string;
  dueDate: number | null; // ms timestamp or null
  dueDateLabel: string | null; // e.g. "Hoje", "Amanhã", "Segunda-feira", "25 jul"
  tags: string[];
}

/**
 * Intelligent Natural Language Parser for Todoist-style quick task entry.
 * Recognizes dates like: "hoje", "amanhã", "ontem", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo", "25 jul", "15:00", etc.
 * Recognizes tags/projects like: "#trabalho", "#compras", "#pessoal".
 */
export function parseSmartTodoInput(rawInput: string): ParsedTodoInput {
  let text = rawInput;
  const tags: string[] = [];

  // 1. Extract hashtags/projects (e.g. #trabalho, #compras)
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(rawInput)) !== null) {
    if (tagMatch[1]) {
      tags.push(tagMatch[1].toLowerCase());
    }
  }
  text = text.replace(tagRegex, "").trim();

  // 2. Extract date/time tokens
  let dueDate: number | null = null;
  let dueDateLabel: string | null = null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const lower = text.toLowerCase();

  // Regex patterns
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
    // Check days of week (segunda, terça, etc.)
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
        if (diff <= 0) diff += 7; // next instance of that day
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + diff);
        dueDate = targetDate.getTime();
        dueDateLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        text = text.replace(dayRegex, "").trim();
        matchedDay = true;
        break;
      }
    }

    // Check specific day number / month e.g. "25 jul" or "dia 25"
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

  // 3. Clean up multiple spaces
  const cleanText = text.replace(/\s+/g, " ").trim() || rawInput.trim();

  return {
    cleanText,
    dueDate,
    dueDateLabel,
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

  if (diffDays < 0) {
    return {
      label: diffDays === -1 ? "Ontem" : `${target.getDate()} ${target.toLocaleString("pt-BR", { month: "short" })}`,
      isOverdue: true,
      isToday: false,
    };
  }

  if (diffDays === 0) {
    return { label: "Hoje", isOverdue: false, isToday: true };
  }

  if (diffDays === 1) {
    return { label: "Amanhã", isOverdue: false, isToday: false };
  }

  const dayName = target.toLocaleString("pt-BR", { weekday: "short" });
  const monthName = target.toLocaleString("pt-BR", { month: "short" });
  return {
    label: `${target.getDate()} ${monthName} (${dayName})`,
    isOverdue: false,
    isToday: false,
  };
}
