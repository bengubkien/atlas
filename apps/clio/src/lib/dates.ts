// Calendar dates as "YYYY-MM-DD" strings, worked out in UTC so a day is
// always 24 hours (no daylight saving surprises).

const DAY = 86_400_000;

const toMs = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The local calendar date of a moment, on this device (or server, by its TZ). */
export const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

export const addDays = (date: string, days: number) => fromMs(toMs(date) + days * DAY);
