import { todayReport, type TodayItem, type TodayReport } from "@atlas/ui/today";

import { addDays, at, dayOf, slotsFor } from "./health";
import type { Appointment, Dose, Medication } from "./model";

// Hygeia's answer to Atlas's Today (see @atlas/ui/today), from what your
// devices have synced: today's doses not yet taken or skipped, and
// appointments today and tomorrow. A dose marked on the phone offline shows
// here once the phone has synced.

/** A dose within this long counts as coming up soon. */
const SOON_MS = 2 * 60 * 60 * 1000;

export function hygeiaToday(
  medications: Medication[],
  doses: Dose[],
  appointments: Appointment[],
  locale: string,
  now = Date.now(),
): TodayReport {
  const today = dayOf(now);
  const tomorrow = addDays(today, 1);
  const time = (ms: number) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(ms);

  const slots = slotsFor(today, medications, doses);
  const taken = slots.filter((slot) => slot.dose?.takenAt).length;
  const open = slots.filter((slot) => !slot.dose?.takenAt && !slot.dose?.skipped);
  const dose = (slot: (typeof open)[number]): TodayItem => {
    const when = at(today, slot.time);
    const late = when <= now;
    return {
      title: [slot.medication.name, slot.medication.dose].filter(Boolean).join(" "),
      detail: late ? `${time(when)}, not taken yet` : time(when),
      href: "/",
      ...(late ? { tone: "overdue" as const } : when - now <= SOON_MS ? { tone: "soon" as const } : {}),
    };
  };

  const upcoming = appointments
    .filter((appointment) => !appointment.deleted && appointment.at + appointment.minutes * 60_000 > now)
    .filter((appointment) => [today, tomorrow].includes(dayOf(appointment.at)))
    .sort((a, b) => a.at - b.at);
  const visit = (appointment: Appointment): TodayItem => {
    const day = dayOf(appointment.at) === today ? "Today" : "Tomorrow";
    return {
      title: appointment.title,
      detail: [`${day} ${time(appointment.at)}`, appointment.with].filter(Boolean).join(", "),
      href: "/appointments",
      ...(day === "Today" ? { tone: "soon" as const } : {}),
    };
  };

  const late = open.filter((slot) => at(today, slot.time) <= now);
  const later = open.filter((slot) => at(today, slot.time) > now);
  const items = [
    ...late.map(dose),
    ...upcoming.filter((a) => dayOf(a.at) === today).map(visit),
    ...later.map(dose),
    ...upcoming.filter((a) => dayOf(a.at) === tomorrow).map(visit),
  ];

  const doseLine = slots.length ? `${taken} of ${slots.length} ${slots.length === 1 ? "dose" : "doses"} taken today.` : "No doses today.";
  const visits = upcoming.filter((a) => dayOf(a.at) === today).length;
  const summary = visits ? `${doseLine} ${visits === 1 ? "An appointment" : `${visits} appointments`} today.` : doseLine;
  return todayReport(summary, items);
}
