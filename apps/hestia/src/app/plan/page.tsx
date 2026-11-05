import type { Metadata } from "next";
import Link from "next/link";
import { PencilRuler } from "lucide-react";

import { buttonClassName } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";

import { Due } from "@/components/due";
import { formatters } from "@/lib/format";
import { getEverything } from "@/lib/micasa/api";
import { ITEM_TYPE, roomAreas } from "@/lib/plan";
import { itemStatus, roomIncidents } from "@/lib/plan-status";
import { readPlan } from "@/lib/plan-store";

import { PlanView, type ItemView, type RoomView } from "./plan-view";

export const metadata: Metadata = { title: "Floor plan" };

/** Your home in 3D, with what needs doing where. Drawn in the editor (/plan/edit). */
export default async function PlanPage() {
  const [plan, everything, f] = await Promise.all([readPlan(), getEverything(), formatters()]);

  if (plan.rooms.length === 0) {
    return (
      <>
        <PageHeader title="Floor plan" description="Your home in 3D, with what needs doing where." />
        <PageBody className="max-w-[720px]">
          <Panel title="Draw your home first">
            <div className="flex flex-col gap-4 border-t border-line px-4 py-5 text-sm text-pretty lg:px-6">
              <p>
                Lay out the rooms as rectangles, then place what needs looking after: the fridge, the boiler, the water shut-off, the breaker panel.
                Each one can be linked to its appliance, and given its usual upkeep in a tap.
              </p>
              <p className="text-muted">A tape measure helps; ten centimetres either way doesn&apos;t matter.</p>
              <Link href="/plan/edit" className={buttonClassName("primary", "lg", "self-start")}>
                <PencilRuler size={16} aria-hidden="true" /> Draw the plan
              </Link>
            </div>
          </Panel>
        </PageBody>
      </>
    );
  }

  const byRoom = roomIncidents(plan, everything);
  const items: ItemView[] = plan.items.map((item) => {
    const status = itemStatus(item, plan, everything, f.today);
    const info = ITEM_TYPE[item.type];
    return {
      id: item.id,
      name: status.name,
      kind: info.label,
      room: status.room,
      standing: status.standing,
      appliance: status.appliance ? { id: status.appliance.id, name: status.appliance.name } : null,
      canBeAppliance: info.appliance,
      documents: status.documents,
      tasks: status.tasks.map((task) => ({ id: task.id, name: task.name, standing: task.standing, due: <Due item={task} f={f} /> })),
      incidents: status.incidents.map(({ id, title, severity }) => ({ id, title, severity })),
      // What it usually needs and doesn't have yet.
      suggestions: info.suggestions
        .map((suggestion, index) => ({ index, name: suggestion.name, months: suggestion.months }))
        .filter((suggestion) => !status.tasks.some((task) => task.name.toLowerCase().startsWith(suggestion.name.toLowerCase()))),
    };
  });
  const names = [...new Set(plan.rooms.map((room) => room.name))];
  const rooms: RoomView[] = names.map((name) => ({
    name,
    ...roomAreas(name, plan.rooms, plan.height),
    items: items.filter((item) => item.room?.toLowerCase() === name.toLowerCase()).map((item) => item.id),
    incidents: (byRoom.get(name) ?? []).map(({ id, title, severity }) => ({ id, title, severity })),
  }));

  return (
    <>
      <PageHeader
        title="Floor plan"
        description="Your home, with what needs doing where: red is overdue, amber due soon, teal looked after. Tap a room or a thing."
        actions={
          <Link href="/plan/edit" className={buttonClassName("secondary")}>
            <PencilRuler size={16} aria-hidden="true" /> Edit the plan
          </Link>
        }
      />
      <PlanView
        plan={plan}
        items={items}
        rooms={rooms}
        appliances={everything.appliances.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))}
        vendors={everything.vendors.map((vendor) => vendor.name).sort()}
        today={f.today}
        currency={f.currency}
      />
    </>
  );
}
