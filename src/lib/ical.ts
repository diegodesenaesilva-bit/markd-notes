export interface ParsedIcalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location?: string;
  description?: string;
}

export function parseIcalData(icalText: string): ParsedIcalEvent[] {
  const events: ParsedIcalEvent[] = [];
  const vevents = icalText.split("BEGIN:VEVENT");

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i].split("END:VEVENT")[0];
    if (!block) continue;

    // Unfold folded lines (lines wrapped with \r\n followed by space/tab)
    const unfolded = block.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);

    let summary = "";
    let dtstartRaw = "";
    let dtendRaw = "";
    let location = "";
    let description = "";
    let uid = "";

    for (const line of lines) {
      if (line.startsWith("SUMMARY:")) {
        summary = line.substring(8).replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      } else if (line.startsWith("SUMMARY;")) {
        const idx = line.indexOf(":");
        if (idx !== -1) summary = line.substring(idx + 1).replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      } else if (line.startsWith("DTSTART")) {
        const idx = line.indexOf(":");
        if (idx !== -1) dtstartRaw = line.substring(idx + 1).trim();
      } else if (line.startsWith("DTEND")) {
        const idx = line.indexOf(":");
        if (idx !== -1) dtendRaw = line.substring(idx + 1).trim();
      } else if (line.startsWith("LOCATION:")) {
        location = line.substring(9).replace(/\\,/g, ",").replace(/\\n/g, "\n").trim();
      } else if (line.startsWith("DESCRIPTION:")) {
        description = line.substring(12).replace(/\\,/g, ",").replace(/\\n/g, "\n").trim();
      } else if (line.startsWith("UID:")) {
        uid = line.substring(4).trim();
      }
    }

    if (!summary || !dtstartRaw) continue;

    const startParsed = parseIcalDateTime(dtstartRaw);
    const endParsed = dtendRaw ? parseIcalDateTime(dtendRaw) : startParsed;

    if (startParsed) {
      events.push({
        id: uid || `ical-${i}-${Date.now()}`,
        title: summary,
        date: startParsed.date,
        startTime: startParsed.time,
        endTime: endParsed ? endParsed.time : startParsed.time,
        location: location || undefined,
        description: description || undefined,
      });
    }
  }

  return events;
}

function parseIcalDateTime(raw: string): { date: string; time: string } | null {
  const isZulu = raw.endsWith("Z");
  const clean = raw.replace(/[^0-9T]/g, "");

  if (clean.length >= 8) {
    const year = parseInt(clean.substring(0, 4), 10);
    const month = parseInt(clean.substring(4, 6), 10);
    const day = parseInt(clean.substring(6, 8), 10);

    let hour = 9;
    let min = 0;
    const hasTime = clean.includes("T") && clean.length >= 13;

    if (hasTime) {
      const tIndex = clean.indexOf("T");
      hour = parseInt(clean.substring(tIndex + 1, tIndex + 3), 10);
      min = parseInt(clean.substring(tIndex + 3, tIndex + 5), 10);
    }

    if (isZulu && hasTime) {
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour, min));
      const localYear = utcDate.getFullYear();
      const localMonth = String(utcDate.getMonth() + 1).padStart(2, "0");
      const localDay = String(utcDate.getDate()).padStart(2, "0");
      const localHour = String(utcDate.getHours()).padStart(2, "0");
      const localMin = String(utcDate.getMinutes()).padStart(2, "0");
      return {
        date: `${localYear}-${localMonth}-${localDay}`,
        time: `${localHour}:${localMin}`,
      };
    }

    const formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const formattedTime = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    return { date: formattedDate, time: formattedTime };
  }

  return null;
}
