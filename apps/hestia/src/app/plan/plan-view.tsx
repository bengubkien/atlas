"use client";

import { Link2, Plus, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";

import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { PageBody } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { Select } from "@atlas/ui/components/select";
import { toastResult } from "@atlas/ui/components/toast";

import { Plan3D } from "@/components/plan-3d";
import type { IncidentSeverity } from "@/lib/micasa/schemas";
import type { Plan } from "@/lib/plan";
import type { ItemStanding } from "@/lib/plan-status";
import type { Standing } from "@/lib/schedule";

import { LogService } from "../maintenance/log-service";
import { addSuggestionAction, linkApplianceAction } from "./actions";

export type ItemView = {
  id: string;
  name: string;
  kind: string;
  room: string | null;
  standing: ItemStanding;
  appliance: { id: string; name: string } | null;
  canBeAppliance: boolean;
  documents: number;
  tasks: { id: string; name: string; standing: Standing; due: ReactNode }[];
  incidents: { id: string; title: string; severity: IncidentSeverity }[];
  suggestions: { index: number; name: string; months: number }[];
};

export type RoomView = { name: string; floor: number; walls: number; items: string[]; incidents: { id: string; title: string; severity: IncidentSeverity }[] };

const STANDING: Record<ItemStanding, { label: string; color: string }> = {
  overdue: { label: "Overdue", color: "var(--color-plan-overdue)" },
  soon: { label: "Due soon", color: "var(--color-plan-soon)" },
  ok: { label: "Looked after", color: "var(--color-plan-ok)" },
  none: { label: "Nothing to track", color: "var(--color-plan-item)" },
};

const swatch = (standing: ItemStanding) => (
  <span aria-hidden="true" className="size-3.5 shrink-0 rounded-[4px] border border-line-field" style={{ backgroundColor: STANDING[standing].color }} />
);

const every = (months: number) => (months === 1 ? "every month" : months % 12 === 0 ? (months === 12 ? "every year" : `every ${months / 12} years`) : `every ${months} months`);

export function PlanView({
  plan,
  items,
  rooms,
  appliances,
  vendors,
  today,
  currency,
}: {
  plan: Plan;
  items: ItemView[];
  rooms: RoomView[];
  appliances: { id: string; name: string }[];
  vendors: string[];
  today: string;
  currency: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const item = items.find((each) => each.id === selected) ?? null;
  const room = item ? null : (rooms.find((each) => each.name === selected) ?? null);
  const standings = Object.fromEntries(items.map((each) => [each.id, each.standing]));
  const pick = (id: string | null) => setSelected(id === selected ? null : id);

  return (
    <PageBody className="max-w-[1180px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-label="The plan in 3D" className="flex min-w-0 flex-col rounded-panel border border-line-card bg-card">
        <Plan3D
          className="h-[440px] w-full lg:h-[600px]"
          plan={plan}
          standings={standings}
          selected={selected}
          onSelect={setSelected}
          label="Your home in 3D: each room, and the things in it coloured by their upkeep. The lists beside it say the same."
          fallback={<p className="p-6 text-sm text-muted">This device can&rsquo;t draw 3D. The lists have everything.</p>}
        />
        <ul aria-label="What the colours mean" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-meta text-muted lg:px-5">
          {(["overdue", "soon", "ok", "none"] as const).map((standing) => (
            <li key={standing} className="flex items-center gap-1.5">
              {swatch(standing)}
              {STANDING[standing].label}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {item && <ItemPanel key={item.id} item={item} appliances={appliances} vendors={vendors} today={today} currency={currency} onClose={() => setSelected(null)} />}
        {room && <RoomPanel room={room} items={items} height={plan.height} onPick={setSelected} onClose={() => setSelected(null)} />}
        <Panel title="Things" count={items.length || undefined}>
          {items.length === 0 ? (
            <PanelEmpty>Nothing placed yet. Edit the plan to add the fridge, the boiler, the water shut-off…</PanelEmpty>
          ) : (
            <PanelList>
              {[...items]
                .sort((a, b) => ["overdue", "soon", "ok", "none"].indexOf(a.standing) - ["overdue", "soon", "ok", "none"].indexOf(b.standing) || a.name.localeCompare(b.name))
                .map((each) => (
                  <li key={each.id}>
                    <button
                      type="button"
                      aria-pressed={selected === each.id}
                      onClick={() => pick(each.id)}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover aria-pressed:bg-selected lg:px-6"
                    >
                      {swatch(each.standing)}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{each.name}</span>
                        <span className="truncate text-meta text-muted">{[each.room, STANDING[each.standing].label].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
            </PanelList>
          )}
        </Panel>
        <Panel title="Rooms" count={rooms.length}>
          <PanelList>
            {rooms.map((each) => (
              <li key={each.name}>
                <button
                  type="button"
                  aria-pressed={selected === each.name}
                  onClick={() => pick(each.name)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover aria-pressed:bg-selected lg:px-6"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{each.name}</span>
                    <span className="truncate text-meta text-muted">
                      {each.floor} m² · {each.items.length} {each.items.length === 1 ? "thing" : "things"}
                    </span>
                  </span>
                  {each.incidents.length > 0 && <Badge tone="warning">{each.incidents.length} open</Badge>}
                </button>
              </li>
            ))}
          </PanelList>
        </Panel>
      </div>
    </PageBody>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid size-8 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
      <X size={16} aria-hidden="true" />
    </button>
  );
}

function Incidents({ incidents }: { incidents: RoomView["incidents"] }) {
  if (incidents.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-line px-4 py-3 lg:px-6">
      <span className="text-label font-medium">Open issues</span>
      {incidents.map((incident) => (
        <Link key={incident.id} href={`/incidents/${incident.id}`} className="flex items-center gap-2 text-sm">
          <TriangleAlert size={14} aria-hidden="true" className={incident.severity === "urgent" ? "text-error" : "text-warning"} />
          {incident.title}
        </Link>
      ))}
    </div>
  );
}

/** A thing on the plan: its appliance, its upkeep (log it, or add what it usually needs), its issues. */
function ItemPanel({
  item,
  appliances,
  vendors,
  today,
  currency,
  onClose,
}: {
  item: ItemView;
  appliances: { id: string; name: string }[];
  vendors: string[];
  today: string;
  currency: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<Parameters<typeof toastResult>[0]>) => startTransition(async () => void toastResult(await action()));

  return (
    <Panel title={item.name} action={<Close onClose={onClose} />}>
      <p className="-mt-1 px-4 pb-3 text-meta text-muted lg:px-6">{[item.kind !== item.name ? item.kind : null, item.room, STANDING[item.standing].label].filter(Boolean).join(" · ")}</p>

      {(item.appliance || item.canBeAppliance) && (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 lg:px-6">
          {item.appliance ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <Link href={`/appliances/${item.appliance.id}`} className="flex items-center gap-2">
                <Link2 size={14} aria-hidden="true" /> {item.appliance.name}
                {item.documents > 0 && <span className="text-meta text-muted">· {item.documents} {item.documents === 1 ? "document" : "documents"}</span>}
              </Link>
              <Button variant="text" size="sm" disabled={pending} onClick={() => run(() => linkApplianceAction(item.id, null))}>
                Unlink
              </Button>
            </div>
          ) : (
            <>
              <span className="text-label font-medium">Its appliance</span>
              <div className="flex flex-wrap items-end gap-2">
                {appliances.length > 0 && (
                  <Select
                    aria-label="Link it to an appliance"
                    defaultValue=""
                    className="min-w-0 flex-1"
                    onChange={(event) => event.target.value && run(() => linkApplianceAction(item.id, event.target.value))}
                  >
                    <option value="">Link to one you have…</option>
                    {appliances.map((appliance) => (
                      <option key={appliance.id} value={appliance.id}>
                        {appliance.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => linkApplianceAction(item.id, "new"))}>
                  <Plus size={14} aria-hidden="true" /> Add it as one
                </Button>
              </div>
              <span className="text-meta text-muted">An appliance keeps its brand, model, warranty and manual.</span>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col border-t border-line">
        <span className="px-4 pt-3 text-label font-medium lg:px-6">Upkeep</span>
        {item.tasks.length === 0 && item.suggestions.length === 0 && <p className="px-4 pt-1 pb-3 text-meta text-muted lg:px-6">Nothing to do for it.</p>}
        {item.tasks.map((task) => (
          <div key={task.id} className="flex min-h-12 items-center gap-3 px-4 py-2 lg:px-6">
            <span className="flex min-w-0 flex-1 flex-col">
              <Link href={`/maintenance/${task.id}`} className="truncate text-sm font-medium text-ink hover:text-muted">
                {task.name}
              </Link>
              <span className="truncate text-meta text-muted">{task.due}</span>
            </span>
            <LogService item={{ id: task.id, name: task.name }} vendors={vendors} today={today} currency={currency} />
          </div>
        ))}
        {item.suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5 px-4 pt-1 pb-3 lg:px-6">
            <span className="text-meta text-muted">{item.tasks.length ? "It usually needs too:" : "It usually needs:"}</span>
            {item.suggestions.map((suggestion) => (
              <Button
                key={suggestion.index}
                variant="secondary"
                size="sm"
                disabled={pending}
                className="justify-start text-left whitespace-normal"
                onClick={() => run(() => addSuggestionAction(item.id, suggestion.index))}
              >
                <Plus size={14} aria-hidden="true" className="shrink-0" /> {suggestion.name}, {every(suggestion.months)}
              </Button>
            ))}
          </div>
        )}
      </div>
      <Incidents incidents={item.incidents} />
    </Panel>
  );
}

/** A room: its floor and walls (for paint and flooring quotes), the things in it, and the issues pinned there. */
function RoomPanel({ room, items, height, onPick, onClose }: { room: RoomView; items: ItemView[]; height: number; onPick: (id: string) => void; onClose: () => void }) {
  const mine = items.filter((item) => room.items.includes(item.id));
  return (
    <Panel title={room.name} action={<Close onClose={onClose} />}>
      <dl className="grid grid-cols-2 gap-3 border-t border-line px-4 py-3 lg:px-6">
        <div>
          <dt className="text-meta text-muted">Floor</dt>
          <dd className="font-serif text-[22px]">{room.floor} m²</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">Walls, at {height} m</dt>
          <dd className="font-serif text-[22px]">{room.walls} m²</dd>
        </div>
      </dl>
      <p className="-mt-1 px-4 pb-3 text-meta text-muted lg:px-6">For paint and flooring quotes. Doors and windows aren&apos;t taken off the walls.</p>
      {mine.length > 0 && (
        <PanelList>
          {mine.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item.id)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover lg:px-6">
                {swatch(item.standing)}
                <span className="flex-1 truncate text-sm">{item.name}</span>
                <span className="text-meta text-muted">{STANDING[item.standing].label}</span>
              </button>
            </li>
          ))}
        </PanelList>
      )}
      <Incidents incidents={room.incidents} />
    </Panel>
  );
}
