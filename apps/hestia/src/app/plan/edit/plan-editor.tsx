"use client";

import { Plus, RotateCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";

import { Button } from "@atlas/ui/components/button";
import { Input } from "@atlas/ui/components/input";
import { PageBody } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";
import { Select } from "@atlas/ui/components/select";
import { toastResult } from "@atlas/ui/components/toast";

import { ITEM_TYPE, ITEM_TYPES, itemName, snap, type Item, type ItemType, type Plan, type Room } from "@/lib/plan";

import { savePlanAction } from "../actions";

// The floor plan, drawn: an SVG in metres, with rooms as rectangles and the
// things in them as small blocks. Pointer (mouse, finger or pen) to move and
// size; the arrow keys move what's picked, 10 cm a press (a metre with
// Shift); the panel beside has the names and sizes.

type Picked = { kind: "room" | "item"; id: string } | null;
type Drag =
  | { kind: "move-room" | "move-item"; id: string; from: [number, number]; at: [number, number] }
  | { kind: "size-room"; id: string; from: [number, number]; size: [number, number] };

const newId = () => crypto.randomUUID();

/** The part of the plan to show: what's drawn, with room round it. */
function frameOf(plan: Plan): { x: number; y: number; w: number; h: number } {
  const xs = [...plan.rooms.flatMap((room) => [room.x, room.x + room.w]), ...plan.items.map((item) => item.x)];
  const ys = [...plan.rooms.flatMap((room) => [room.y, room.y + room.d]), ...plan.items.map((item) => item.y)];
  if (!xs.length) return { x: -1, y: -1, w: 10, h: 8 };
  const margin = 1.5;
  const x = Math.floor(Math.min(...xs) - margin);
  const y = Math.floor(Math.min(...ys) - margin);
  return { x, y, w: Math.max(8, Math.ceil(Math.max(...xs) + margin) - x), h: Math.max(6, Math.ceil(Math.max(...ys) + margin) - y) };
}

export function PlanEditor({ initial }: { initial: Plan }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initial);
  const [picked, setPicked] = useState<Picked>(initial.rooms[0] ? { kind: "room", id: initial.rooms[0].id } : null);
  const [frame, setFrame] = useState(() => frameOf(initial));
  const [dirty, setDirty] = useState(false);
  const [newType, setNewType] = useState<ItemType>("fridge");
  const [saving, startSaving] = useTransition();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);

  // Leaving with changes not saved asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (next: Plan, reframe = false) => {
    setPlan(next);
    setDirty(true);
    if (reframe) setFrame(frameOf(next));
  };
  const room = picked?.kind === "room" ? plan.rooms.find((each) => each.id === picked.id) : undefined;
  const item = picked?.kind === "item" ? plan.items.find((each) => each.id === picked.id) : undefined;
  const setRoom = (id: string, patch: Partial<Room>, reframe = false) => change({ ...plan, rooms: plan.rooms.map((each) => (each.id === id ? { ...each, ...patch } : each)) }, reframe);
  const setItem = (id: string, patch: Partial<Item>, reframe = false) => change({ ...plan, items: plan.items.map((each) => (each.id === id ? { ...each, ...patch } : each)) }, reframe);

  /** A pointer's place on the plan, in metres. */
  const at = (event: PointerEvent): [number, number] => {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    if (!matrix) return [0, 0];
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return [point.x, point.y];
  };

  const start = (next: Drag, event: PointerEvent) => {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    drag.current = next;
  };
  const move = (event: PointerEvent) => {
    const now = drag.current;
    if (!now) return;
    const [x, y] = at(event);
    const dx = x - now.from[0];
    const dy = y - now.from[1];
    if (now.kind === "size-room") setRoom(now.id, { w: Math.max(0.5, snap(now.size[0] + dx)), d: Math.max(0.5, snap(now.size[1] + dy)) });
    else if (now.kind === "move-room") setRoom(now.id, { x: snap(now.at[0] + dx), y: snap(now.at[1] + dy) });
    else setItem(now.id, { x: snap(now.at[0] + dx), y: snap(now.at[1] + dy) });
  };
  const end = () => {
    if (drag.current) setFrame(frameOf(plan));
    drag.current = null;
  };

  const addRoom = () => {
    const right = plan.rooms.length ? Math.max(...plan.rooms.map((each) => each.x + each.w)) : 0;
    const top = plan.rooms.length ? Math.min(...plan.rooms.map((each) => each.y)) : 0;
    const added: Room = { id: newId(), name: `Room ${plan.rooms.length + 1}`, x: snap(right), y: snap(top), w: 3, d: 3 };
    change({ ...plan, rooms: [...plan.rooms, added] }, true);
    setPicked({ kind: "room", id: added.id });
  };
  const addItem = () => {
    const home = room ?? plan.rooms[0];
    // Each new thing a little way from the last, so they don't land on each other.
    const offset = (plan.items.length % 5) * 0.4 - 0.8;
    const added: Item = {
      id: newId(),
      type: newType,
      name: "",
      x: home ? snap(home.x + home.w / 2 + offset) : 1,
      y: home ? snap(home.y + home.d / 2 + offset / 2) : 1,
      rotation: 0,
      applianceId: null,
      maintenanceIds: [],
    };
    change({ ...plan, items: [...plan.items, added] }, true);
    setPicked({ kind: "item", id: added.id });
  };
  const remove = () => {
    if (room) change({ ...plan, rooms: plan.rooms.filter((each) => each.id !== room.id) }, true);
    if (item) change({ ...plan, items: plan.items.filter((each) => each.id !== item.id) }, true);
    setPicked(null);
  };
  const save = () =>
    startSaving(async () => {
      const result = toastResult(await savePlanAction(plan));
      if (result.ok) {
        setDirty(false);
        router.push("/plan");
      }
    });

  const keys = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 1 : 0.1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const by = moves[event.key];
    if (by && (room || item)) {
      event.preventDefault();
      if (room) setRoom(room.id, { x: snap(room.x + by[0]), y: snap(room.y + by[1]) }, true);
      if (item) setItem(item.id, { x: snap(item.x + by[0]), y: snap(item.y + by[1]) }, true);
    } else if ((event.key === "Delete" || event.key === "Backspace") && (room || item)) {
      event.preventDefault();
      remove();
    }
  };

  const number = (value: string, fallback: number) => {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? snap(parsed) : fallback;
  };

  return (
    <PageBody className="max-w-[1180px] lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <section aria-label="The plan, drawn" className="flex min-w-0 flex-col rounded-panel border border-line-card bg-card">
        <svg
          ref={svg}
          role="application"
          aria-label="Floor plan editor. Arrow keys move the room or thing picked; Delete removes it."
          tabIndex={0}
          viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
          className="h-[440px] w-full touch-none rounded-t-panel outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus,currentColor)] lg:h-[600px]"
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerDown={() => setPicked(null)}
          onKeyDown={keys}
        >
          {/* A metre grid. */}
          <g stroke="var(--color-line-card)" strokeWidth={1} vectorEffect="non-scaling-stroke">
            {Array.from({ length: Math.ceil(frame.w) + 1 }, (_, i) => (
              <line key={`x${i}`} x1={frame.x + i} y1={frame.y} x2={frame.x + i} y2={frame.y + frame.h} vectorEffect="non-scaling-stroke" />
            ))}
            {Array.from({ length: Math.ceil(frame.h) + 1 }, (_, i) => (
              <line key={`y${i}`} x1={frame.x} y1={frame.y + i} x2={frame.x + frame.w} y2={frame.y + i} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {plan.rooms.map((each) => {
            const on = picked?.kind === "room" && picked.id === each.id;
            return (
              <g key={each.id}>
                <rect
                  x={each.x}
                  y={each.y}
                  width={each.w}
                  height={each.d}
                  fill="var(--color-plan-floor)"
                  fillOpacity={0.85}
                  stroke={on ? "var(--color-ink)" : "var(--color-plan-wall)"}
                  strokeWidth={on ? 3 : 2}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "move" }}
                  onPointerDown={(event) => {
                    setPicked({ kind: "room", id: each.id });
                    start({ kind: "move-room", id: each.id, from: at(event), at: [each.x, each.y] }, event);
                  }}
                />
                {on && (
                  <circle
                    cx={each.x + each.w}
                    cy={each.y + each.d}
                    r={0.28}
                    fill="var(--color-ink)"
                    style={{ cursor: "nwse-resize" }}
                    aria-label="Size the room"
                    onPointerDown={(event) => start({ kind: "size-room", id: each.id, from: at(event), size: [each.w, each.d] }, event)}
                  />
                )}
              </g>
            );
          })}
          {plan.items.map((each) => {
            const [w, d] = ITEM_TYPE[each.type].size;
            const turned = each.rotation === 90 || each.rotation === 270;
            const [width, depth] = [Math.max(turned ? d : w, 0.25), Math.max(turned ? w : d, 0.25)];
            const on = picked?.kind === "item" && picked.id === each.id;
            return (
              <g key={each.id}>
                <rect
                  x={each.x - width / 2}
                  y={each.y - depth / 2}
                  width={width}
                  height={depth}
                  rx={0.05}
                  fill={on ? "var(--color-plan-ok)" : "var(--color-plan-item)"}
                  stroke="var(--color-card)"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "move" }}
                  onPointerDown={(event) => {
                    setPicked({ kind: "item", id: each.id });
                    start({ kind: "move-item", id: each.id, from: at(event), at: [each.x, each.y] }, event);
                  }}
                />
                <text x={each.x} y={each.y + depth / 2 + 0.26} textAnchor="middle" fontSize={0.2} fill="var(--color-muted)" pointerEvents="none">
                  {itemName(each)}
                </text>
              </g>
            );
          })}
          {/* Room names last, over what's in them, each with a halo so it reads on top of a thing. */}
          <g pointerEvents="none" stroke="var(--color-card)" strokeWidth={0.07} strokeLinejoin="round" paintOrder="stroke">
            {plan.rooms.map((each) => (
              <g key={each.id}>
                <text x={each.x + 0.18} y={each.y + 0.42} fontSize={0.3} fill="var(--color-ink)">
                  {each.name}
                </text>
                <text x={each.x + 0.18} y={each.y + 0.76} fontSize={0.22} fill="var(--color-muted)">
                  {each.w} × {each.d} m
                </text>
              </g>
            ))}
          </g>
        </svg>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 lg:px-5">
          <span className="text-meta text-muted">
            {plan.rooms.length} {plan.rooms.length === 1 ? "room" : "rooms"}, {plan.items.length} {plan.items.length === 1 ? "thing" : "things"}
            {dirty ? " · not saved yet" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/plan")}>
              Cancel
            </Button>
            <Button disabled={saving || !dirty} onClick={save}>
              {saving ? "Saving…" : "Save the plan"}
            </Button>
          </div>
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Add">
          <div className="flex flex-col gap-3 border-t border-line px-4 py-4 lg:px-6">
            <Button variant="secondary" onClick={addRoom} className="self-start">
              <Plus size={15} aria-hidden="true" /> A room
            </Button>
            <div className="flex items-end gap-2">
              <Select label="A thing" value={newType} onChange={(event) => setNewType(event.target.value as ItemType)} className="min-w-0 flex-1">
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ITEM_TYPE[type].label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={addItem} disabled={plan.rooms.length === 0}>
                <Plus size={15} aria-hidden="true" /> Add
              </Button>
            </div>
            <span className="text-meta text-muted">A thing goes in the middle of the room picked; drag it where it is.</span>
          </div>
        </Panel>

        {room && (
          <Panel title="Room" key={room.id}>
            <div className="flex flex-col gap-3 border-t border-line px-4 py-4 lg:px-6">
              <Input label="Name" defaultValue={room.name} maxLength={40} onChange={(event) => event.target.value.trim() && setRoom(room.id, { name: event.target.value.slice(0, 40) })} hint="Two rooms with the same name make one L-shaped room." />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Width, m" inputMode="decimal" defaultValue={String(room.w)} key={`w${room.w}`} onBlur={(event) => setRoom(room.id, { w: number(event.target.value, room.w) }, true)} />
                <Input label="Depth, m" inputMode="decimal" defaultValue={String(room.d)} key={`d${room.d}`} onBlur={(event) => setRoom(room.id, { d: number(event.target.value, room.d) }, true)} />
              </div>
              <Button variant="danger-text" onClick={remove} className="self-start">
                <Trash2 size={15} aria-hidden="true" /> Remove the room
              </Button>
            </div>
          </Panel>
        )}
        {item && (
          <Panel title={itemName(item)} key={item.id}>
            <div className="flex flex-col gap-3 border-t border-line px-4 py-4 lg:px-6">
              <Select label="What it is" value={item.type} onChange={(event) => setItem(item.id, { type: event.target.value as ItemType })}>
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ITEM_TYPE[type].label}
                  </option>
                ))}
              </Select>
              <Input label="Name" defaultValue={item.name} maxLength={60} placeholder={ITEM_TYPE[item.type].label} onChange={(event) => setItem(item.id, { name: event.target.value.slice(0, 60) })} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setItem(item.id, { rotation: ((item.rotation + 90) % 360) as Item["rotation"] })}>
                  <RotateCw size={14} aria-hidden="true" /> Turn it
                </Button>
                <Button variant="danger-text" size="sm" onClick={remove}>
                  <Trash2 size={14} aria-hidden="true" /> Remove it
                </Button>
              </div>
              <span className="text-meta text-muted">Link it to its appliance and add its upkeep on the plan, once it&apos;s saved.</span>
            </div>
          </Panel>
        )}

        <Panel title="The home">
          <div className="flex flex-col gap-3 border-t border-line px-4 py-4 lg:px-6">
            <Input
              label="Ceiling height, m"
              inputMode="decimal"
              defaultValue={String(plan.height)}
              hint="For wall areas, when you ask for a painting quote."
              onBlur={(event) => {
                const height = number(event.target.value, plan.height);
                change({ ...plan, height: Math.min(6, Math.max(2, height)) });
              }}
            />
          </div>
        </Panel>
      </div>
    </PageBody>
  );
}
