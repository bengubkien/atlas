"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import type { Mesh } from "three";

import { createBodyMaterial, type PartLook } from "./body-material";
import { figureGeometry, heightOf, jointsOf, type Joints, type Sex } from "./figure";
import { compile, partAt, type Part, type Vec3 } from "./parts";

export { useCssColors } from "./css-colors";

// The figure in 3D: a realistic body (MakeHuman's, CC0) with its muscles
// painted on. Drag sideways to turn it, tap a muscle to pick it. It's lit
// softly and drawn without tone mapping, so each muscle shows the colour it's
// given, close enough to read a scale from. It draws only when something
// changes, to spare a phone's battery. Always put a plain list beside it: it's
// the way in for keyboards and screen readers, and on a device without WebGL.

export type Facing = "front" | "back";
export type { Sex };

export type BodyColors = {
  /** The figure, and any muscle without a shade. */
  figure: string;
  /** The ring round the picked muscle. */
  outline: string;
};

export type BodyViewProps<G extends string> = {
  /** Male or female figure. */
  sex: Sex;
  /** What's on it: the muscles (`musclesFor`) or the places (`areasFor`), placed for the figure's joints. */
  parts: (joints: Joints) => Part<G>[];
  /** Each group's colour; a group without one is drawn in the figure's colour. */
  shades: Partial<Record<G, string>>;
  colors: BodyColors;
  selected: G | null;
  onSelect: (group: G) => void;
  /** Which way the figure faces; changing it turns the figure round. */
  facing: Facing;
  /** Called when dragging turns the figure past side-on. */
  onTurn?: (facing: Facing) => void;
  /** What the picture shows, for screen readers. */
  label: string;
  /** Shown instead on a device that can't draw 3D. */
  fallback?: ReactNode;
  className?: string;
};

/** A tap that moved further than this, in pixels, was a drag. */
const TAP_SLOP = 6;
/** Radians per pixel dragged. */
const TURN_SPEED = 0.012;
/** Every figure is drawn this tall, whatever its real height, so both fill the view alike. */
const SHOWN_HEIGHT = 1.73;

/** Eases the figure towards the way it should face; asks for frames only while it moves. */
function Turner({ yawRef, targetRef, height, children }: { yawRef: RefObject<number>; targetRef: RefObject<number>; height: number; children: ReactNode }) {
  const group = useRef<import("three").Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    const gap = targetRef.current - yawRef.current;
    if (Math.abs(gap) > 0.0005) {
      yawRef.current += gap * Math.min(1, delta * 9);
      invalidate();
    } else {
      yawRef.current = targetRef.current;
    }
    if (group.current) group.current.rotation.y = yawRef.current;
  });
  const size = SHOWN_HEIGHT / height;
  return (
    <group ref={group} position={[0, -SHOWN_HEIGHT / 2 + 0.02, 0]} scale={[size, size, size]}>
      {children}
    </group>
  );
}

/** Hands the scene's "draw a frame" to the component around it, for changes made from outside the scene. */
function Redraw({ redrawRef }: { redrawRef: RefObject<(() => void) | null> }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    redrawRef.current = invalidate;
    invalidate();
    return () => {
      redrawRef.current = null;
    };
  }, [invalidate, redrawRef]);
  return null;
}

/** The nearest angle to `from` that faces `facing`: a whole number of turns, plus a half for the back. */
function angleFacing(facing: Facing, from: number): number {
  const turn = Math.PI * 2;
  const base = facing === "front" ? 0 : Math.PI;
  return base + Math.round((from - base) / turn) * turn;
}

const facingOf = (yaw: number): Facing => (Math.cos(yaw) >= 0 ? "front" : "back");

export function BodyView<G extends string>({ sex, parts: place, shades, colors, selected, onSelect, facing, onTurn, label, fallback, className }: BodyViewProps<G>) {
  const start = angleFacing(facing, 0);
  const yaw = useRef(start);
  const target = useRef(start);
  const redraw = useRef<(() => void) | null>(null);
  const [hovered, setHovered] = useState<G | null>(null);
  const drag = useRef<{ x: number; start: number; pointer: number } | null>(null);
  const lastFacing = useRef(facing);

  const geometry = useMemo(() => figureGeometry(sex), [sex]);
  const parts = useMemo(() => place(jointsOf(sex)), [place, sex]);
  const compiled = useMemo(() => parts.map((part) => compile(part)), [parts]);
  const body = useMemo(() => createBodyMaterial(), []);
  useEffect(() => () => body.dispose(), [body]);

  // The material's numbers change outside React's props, so ask for a frame after.
  useEffect(() => {
    const looks: PartLook[] = parts.map((part) => ({
      shade: shades[part.group] ?? null,
      hovered: hovered === part.group,
      picked: selected === part.group,
    }));
    body.update(compiled, looks, colors.figure, colors.outline);
    redraw.current?.();
  }, [body, parts, compiled, shades, hovered, selected, colors.figure, colors.outline]);

  // Turn round when told to (the buttons), unless a drag already got there.
  useEffect(() => {
    if (facing === facingOf(target.current)) return;
    target.current = angleFacing(facing, target.current);
    lastFacing.current = facing;
    redraw.current?.();
  }, [facing]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, start: target.current, pointer: event.pointerId };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now || now.pointer !== event.pointerId) return;
    const dx = event.clientX - now.x;
    if (Math.abs(dx) < TAP_SLOP) return;
    target.current = now.start + dx * TURN_SPEED;
    yaw.current = target.current;
    redraw.current?.();
    const turned = facingOf(target.current);
    if (turned !== lastFacing.current) {
      lastFacing.current = turned;
      onTurn?.(turned);
    }
  };
  const endDrag = () => {
    drag.current = null;
  };

  /** The group under the pointer: the hit point and its face, in the figure's own space, through the same rule the shader paints with. */
  const groupAt = (event: ThreeEvent<PointerEvent | MouseEvent>): G | null => {
    if (!event.face) return null;
    const point = (event.object as Mesh).worldToLocal(event.point.clone());
    const n = event.face.normal;
    const index = partAt(compiled, [point.x, point.y, point.z] as Vec3, [n.x, n.y, n.z] as Vec3);
    return index >= 0 ? parts[index]!.group : null;
  };

  return (
    <div
      role="img"
      aria-label={label}
      className={className}
      // Sideways drags turn the figure; up and down still scroll the page.
      style={{ touchAction: "pan-y", cursor: hovered ? "pointer" : "grab", userSelect: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <Canvas
        flat
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.4], fov: 26 }}
        gl={{ antialias: true, alpha: true }}
        fallback={fallback}
        onPointerMissed={() => setHovered(null)}
      >
        <Redraw redrawRef={redraw} />
        {/* Studio light, fixed to the camera as the figure turns: a key from the
            upper left that models each muscle, a soft fill, a rim from behind
            that separates the figure from the page, and sky-to-ground light
            underneath it all. three.js lights a surface at 1/π of their
            intensity, so these add up to about π where the key falls: a muscle
            there shows its own colour, and its shape shows round it. */}
        <hemisphereLight args={["#ffffff", "#7d766e", 0.36 * Math.PI]} />
        <directionalLight position={[-1.8, 2.8, 2.6]} intensity={0.72 * Math.PI} />
        <directionalLight position={[2.4, 0.4, 2]} intensity={0.16 * Math.PI} />
        <directionalLight position={[0.6, 2.4, -3.5]} intensity={0.5 * Math.PI} />
        <Turner yawRef={yaw} targetRef={target} height={heightOf(sex)}>
          {/* A soft shadow on the floor, so the figure stands on something. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0.03]} scale={[0.42, 0.24, 1]}>
            <circleGeometry args={[1, 48]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.08} depthWrite={false} />
          </mesh>
          <mesh
            geometry={geometry}
            material={body.material}
            onClick={(event) => {
              event.stopPropagation();
              if (event.delta > TAP_SLOP) return;
              const group = groupAt(event);
              if (group) onSelect(group);
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              const group = groupAt(event);
              if (group !== hovered) setHovered(group);
            }}
            onPointerOut={() => setHovered(null)}
          />
        </Turner>
      </Canvas>
    </div>
  );
}
