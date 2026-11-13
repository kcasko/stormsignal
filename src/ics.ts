// Builds an iCalendar (.ics) file of prep deadlines so reminders work without accounts or SMS.
import type { PrepTask } from "../shared/preparationEngine";

const utc = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** RFC 5545 lines are folded at 75 octets. */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export const LEAD_MINUTES = 120;

export function prepCalendar(tasks: PrepTask[], place: string, now = Date.now()): string | null {
  const dated = tasks.filter((t) => t.due && t.due - LEAD_MINUTES * 60000 > now);
  if (!dated.length) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Storm Signal//Prep deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const t of dated) {
    const start = t.due! - LEAD_MINUTES * 60000;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}-${t.due}@stormsignal`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(start)}`,
      `DTEND:${utc(start + 15 * 60000)}`,
      fold(`SUMMARY:${esc("Storm prep: " + t.title)}`),
      fold(
        `DESCRIPTION:${esc(
          `${t.reason}\nForecast hazard expected around this time in ${place}. Check current NWS forecasts and warnings first.\nSource: ${t.source.label} ${t.source.url}`,
        )}`,
      ),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc("Storm prep: " + t.title)}`),
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
