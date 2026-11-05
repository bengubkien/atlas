"use client";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { useCssColors } from "@atlas/ui/css-colors";

import type { ItemStanding } from "@/lib/plan-status";
import { ITEM_TYPE, planBounds, type Plan } from "@/lib/plan";

// The plan in 3D, as a doll's house seen from above at an angle: each room a
// floor with walls cut away at a metre, so you see in; the things in it as
// simple blocks, coloured by their upkeep. Drag sideways (or use the
// buttons) to turn it; tap a thing or a room to pick it.

const COLORS = {
  floor: "--color-plan-floor",
  wall: "--color-plan-wall",
  item: "--color-plan-item",
  ok: "--color-plan-ok",
  soon: "--color-plan-soon",
  overdue: "--color-plan-overdue",
  ink: "--color-ink",
} as const;

/** The walls are cut at this height, so the rooms show. */
const WALL_CUT = 1.0;
const WALL = 0.06;
const TILT = (55 * Math.PI) / 180;
const DRAG_SLOP = 6;

const FOV = 32;

/**
 * Frames the plan: far enough that `size` metres fit across the canvas
 * whichever way is tighter (a phone's canvas is narrow), as it turns.
 */
function Camera({ size, zoom }: { size: number; zoom: number }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  useEffect(() => {
    const half = (FOV / 2) * (Math.PI / 180);
    const fit = Math.min(half, Math.atan(Math.tan(half) * aspect));
    const distance = ((size * 0.62) / Math.tan(fit)) * zoom;
    camera.position.set(0, distance * Math.sin(TILT), distance * Math.cos(TILT));
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [camera, size, zoom, aspect, invalidate]);
  return null;
}

export function Plan3D({
  plan,
  standings,
  selected,
  onSelect,
  label,
  fallback,
  className,
}: {
  plan: Plan;
  standings: Record<string, ItemStanding>;
  /** A thing's ID, or a room's name. */
  selected: string | null;
  onSelect: (id: string | null) => void;
  label: string;
  fallback: ReactNode;
  className?: string;
}) {
  const colors = useCssColors(COLORS);
  const { cx, cy, size } = planBounds(plan);
  const [yaw, setYaw] = useState(0);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, start: yaw, moved: false };
    dragged.current = false;
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now) return;
    const dx = event.clientX - now.x;
    if (!now.moved && Math.abs(dx) < DRAG_SLOP) return;
    now.moved = true;
    dragged.current = true;
    setYaw(now.start + dx * 0.008);
  };
  const endDrag = () => {
    drag.current = null;
  };
  const pick = (id: string) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!dragged.current) onSelect(id);
  };

  const H = plan.height;
  const tone = (standing: ItemStanding | undefined) => (colors ? (standing && standing !== "none" ? colors[standing] : colors.item) : "#999999");
  const button = "grid size-9 place-items-center rounded-control border border-line-control bg-card text-muted shadow-control hover:text-ink";

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        role="img"
        aria-label={label}
        className="size-full"
        style={{ touchAction: "pan-y", cursor: "grab", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {colors && (
          <Canvas
            flat
            frameloop="demand"
            dpr={[1, 2]}
            camera={{ fov: FOV, near: 0.1, far: 500 }}
            gl={{ antialias: true, alpha: true }}
            fallback={fallback}
            onPointerMissed={() => !dragged.current && onSelect(null)}
          >
            <Camera size={size} zoom={zoom} />
            {/* As on the body: sky and ground light, a key from the upper left and a soft fill, adding up to about π. */}
            <hemisphereLight args={["#ffffff", "#7d766e", 0.45 * Math.PI]} />
            <directionalLight position={[-6, 12, 8]} intensity={0.6 * Math.PI} />
            <directionalLight position={[8, 5, -4]} intensity={0.18 * Math.PI} />
            <group rotation={[0, yaw, 0]}>
              <group position={[-cx, 0, -cy]}>
                {plan.rooms.map((room) => {
                  const picked = selected === room.name;
                  const wall = (key: string, position: [number, number, number], args: [number, number, number]) => (
                    <mesh key={key} position={position} onClick={pick(room.name)}>
                      <boxGeometry args={args} />
                      <meshStandardMaterial color={colors.wall} roughness={0.9} />
                    </mesh>
                  );
                  return (
                    <group key={room.id}>
                      <mesh position={[room.x + room.w / 2, -0.02, room.y + room.d / 2]} onClick={pick(room.name)}>
                        <boxGeometry args={[room.w, 0.04, room.d]} />
                        <meshStandardMaterial color={colors.floor} emissive={picked ? colors.ok : "#000000"} emissiveIntensity={picked ? 0.25 : 0} roughness={0.95} />
                      </mesh>
                      {wall("n", [room.x + room.w / 2, WALL_CUT / 2, room.y], [room.w + WALL, WALL_CUT, WALL])}
                      {wall("s", [room.x + room.w / 2, WALL_CUT / 2, room.y + room.d], [room.w + WALL, WALL_CUT, WALL])}
                      {wall("w", [room.x, WALL_CUT / 2, room.y + room.d / 2], [WALL, WALL_CUT, room.d])}
                      {wall("e", [room.x + room.w, WALL_CUT / 2, room.y + room.d / 2], [WALL, WALL_CUT, room.d])}
                    </group>
                  );
                })}
                {plan.items.map((item) => {
                  const info = ITEM_TYPE[item.type];
                  // Small things (a valve, an alarm) are drawn a little bigger, so they can be seen and tapped.
                  const [w, d, h] = [Math.max(info.size[0], 0.25), Math.max(info.size[1], 0.25), Math.max(info.size[2], 0.2)];
                  const turned = item.rotation === 90 || item.rotation === 270;
                  const lift = Math.min(info.lift ?? 0, H - h);
                  const standing = standings[item.id];
                  const picked = selected === item.id;
                  const color = tone(standing);
                  return (
                    <group key={item.id} position={[item.x, 0, item.y]}>
                      <mesh position={[0, lift + h / 2, 0]} scale={picked ? 1.12 : 1} onClick={pick(item.id)}>
                        <boxGeometry args={[turned ? d : w, h, turned ? w : d]} />
                        <meshStandardMaterial color={color} emissive={picked ? color : "#000000"} emissiveIntensity={picked ? 0.35 : 0} roughness={0.6} />
                      </mesh>
                      {standing === "overdue" && (
                        // Overdue: a marker above it, so it's told apart by shape too, not only its colour.
                        <mesh position={[0, lift + h + 0.35, 0]} rotation={[Math.PI, 0, 0]} onClick={pick(item.id)}>
                          <coneGeometry args={[0.14, 0.3, 4]} />
                          <meshStandardMaterial color={colors.overdue} roughness={0.5} />
                        </mesh>
                      )}
                    </group>
                  );
                })}
              </group>
            </group>
          </Canvas>
        )}
      </div>
      <div className="absolute right-3 bottom-3 flex gap-1.5">
        <button type="button" className={button} aria-label="Turn left" title="Turn left" onClick={() => setYaw(yaw - Math.PI / 4)}>
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button type="button" className={button} aria-label="Turn right" title="Turn right" onClick={() => setYaw(yaw + Math.PI / 4)}>
          <RotateCw size={16} aria-hidden="true" />
        </button>
        <button type="button" className={button} aria-label="Closer" title="Closer" onClick={() => setZoom(Math.max(0.4, zoom / 1.25))}>
          <Plus size={16} aria-hidden="true" />
        </button>
        <button type="button" className={button} aria-label="Further" title="Further" onClick={() => setZoom(Math.min(2.5, zoom * 1.25))}>
          <Minus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
