import type { Appointment, Medication } from "./model";

// The calendar feed (iCalendar, RFC 5545) your phone's calendar subscribes
// to: a daily event for each medication time, and each appointment, with
// alerts. The phone keeps the events, so reminders ring even while the server
// is off.
//
// Medication times are "floating" (no time zone): 08:00 means 08:00 wherever
// you are. Appointments are exact moments, in UTC.

/** Escapes text for an iCalendar value. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a line at 75 octets, as the format requires; continuation lines start with a space. */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = new TextEncoder().encode(char).length;
    if (size + width > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 20261105T080000Z: a moment in UTC. */
export function utc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** 20261105T080000: a floating local date and time. */
const floating = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

export function buildCalendar({ medications, appointments, now = Date.now(), host = "hygeia" }: { medications: Medication[]; appointments: Appointment[]; now?: number; host?: string }): string {
  const stamp = utc(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atlas//Hygeia//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Hygeia",
    "X-WR-CALDESC:Medications and appointments from Hygeia",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const medication of medications) {
    if (medication.deleted || medication.asNeeded) continue;
    const what = medication.dose ? `${medication.name} (${medication.dose})` : medication.name;
    for (const time of medication.times) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${medication.id}-${time.replace(":", "")}@${host}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${floating(medication.startDate, time)}`,
        "DURATION:PT5M",
        `RRULE:FREQ=DAILY${medication.endDate ? `;UNTIL=${floating(medication.endDate, "23:59")}` : ""}`,
        `SUMMARY:${escapeText(`Take ${what}`)}`,
        ...(medication.notes ? [`DESCRIPTION:${escapeText(medication.notes)}`] : []),
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(`Take ${what}`)}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT",
      );
    }
  }

  for (const appointment of appointments) {
    if (appointment.deleted) continue;
    const description = [appointment.with ? `With ${appointment.with}.` : "", appointment.notes].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${appointment.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utc(appointment.at)}`,
      `DTEND:${utc(appointment.at + appointment.minutes * 60_000)}`,
      `SUMMARY:${escapeText(appointment.title)}`,
      ...(appointment.place ? [`LOCATION:${escapeText(appointment.place)}`] : []),
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`Tomorrow: ${appointment.title}`)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`In two hours: ${appointment.title}`)}`,
      "TRIGGER:-PT2H",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
