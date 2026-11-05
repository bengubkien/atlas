import type { CalendarDate } from "./dates";
import type { Everything } from "./micasa/api";
import type { Appliance, Incident } from "./micasa/schemas";
import { itemName, roomOf, type Item, type Plan } from "./plan";
import { scheduled, type Scheduled } from "./schedule";

// Where each thing on the plan stands: its appliance, its upkeep and its
// open issues, and the worst of it for its colour in 3D. Issues not tied to
// an appliance are pinned to the room their location names.

export type ItemStanding = "overdue" | "soon" | "ok" | "none";

export type ItemStatus = {
  item: Item;
  name: string;
  room: string | null;
  appliance: Appliance | null;
  tasks: Scheduled[];
  incidents: Incident[];
  documents: number;
  standing: ItemStanding;
};

const open = (incident: Incident) => incident.status !== "resolved";

export function itemStatus(item: Item, plan: Plan, everything: Everything, today: CalendarDate): ItemStatus {
  const appliance = item.applianceId ? (everything.appliances.find((each) => each.id === item.applianceId) ?? null) : null;
  const tasks = everything.maintenance
    .filter((task) => (appliance && task.appliance_id === appliance.id) || item.maintenanceIds.includes(task.id))
    .map((task) => scheduled(task, today))
    .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
  const incidents = appliance ? everything.incidents.filter((incident) => open(incident) && incident.appliance_id === appliance.id) : [];
  const standing: ItemStanding =
    tasks.some((task) => task.standing === "overdue") || incidents.some((incident) => incident.severity === "urgent")
      ? "overdue"
      : tasks.some((task) => task.standing === "soon" || task.standing === "never") || incidents.length > 0
        ? "soon"
        : tasks.length > 0 || appliance
          ? "ok"
          : "none";
  return {
    item,
    name: itemName(item),
    room: roomOf(item, plan.rooms)?.name ?? null,
    appliance,
    tasks,
    incidents,
    documents: appliance ? everything.documents.filter((doc) => doc.entity_kind === "appliance" && doc.entity_id === appliance.id).length : 0,
    standing,
  };
}

/** Open issues whose location names a room on the plan, and that aren't already on one of its appliances. */
export function roomIncidents(plan: Plan, everything: Everything): Map<string, Incident[]> {
  const placed = new Set(plan.items.map((item) => item.applianceId).filter(Boolean));
  const byRoom = new Map<string, Incident[]>();
  for (const incident of everything.incidents.filter(open)) {
    if (incident.appliance_id && placed.has(incident.appliance_id)) continue;
    const room = plan.rooms.find((each) => each.name.trim().toLowerCase() === incident.location.trim().toLowerCase());
    if (!room) continue;
    byRoom.set(room.name, [...(byRoom.get(room.name) ?? []), incident]);
  }
  return byRoom;
}
