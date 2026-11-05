// A workout's start as the date and time fields show it, where you are, and back.

const two = (n: number) => String(n).padStart(2, "0");

/** "2026-11-05" for a moment, in local time. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** "07:05" for a moment, in local time. */
export function localTime(ms: number): string {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** The moment a date and a time (local) name; null if they don't. */
export function fromLocal(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const ms = new Date(`${date}T${time}:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}
