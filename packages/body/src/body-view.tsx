"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CapsuleGeometry, Quaternion, SphereGeometry, Vector3 } from "three";

import { FIGURE, MUSCLE_PARTS, normalize, type Limb, type MuscleGroup, type Shape, type Vec3 } from "./parts";

// The figure in 3D: drag sideways to turn it, tap a muscle to pick it. It's
// lit softly and drawn without tone mapping, so each muscle shows the colour
// it's given, close enough to read a scale from. It draws only when something
// changes, to spare a phone's battery. Always put a plain list beside it: it's
// the way in for keyboards and screen readers, and on a device without WebGL.

export type Facing = "front" | "back";

export type BodyColors = {
  /** The figure, and any muscle without a shade. */
  figure: string;
  /** Around the picked muscle. */
  outline: string;
};

export type BodyViewProps = {
  /** Each group's colour; a group without one is drawn in the figure's colour. */
  shades: Partial<Record<MuscleGroup, string>>;
  colors: BodyColors;
  selected: MuscleGroup | null;
  onSelect: (group: MuscleGroup) => void;
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

const UP = new Vector3(0, 1, 0);
const sphere = new SphereGeometry(1, 40, 28);
/** A tap that moved further than this, in pixels, was a drag. */
const TAP_SLOP = 6;
/** Radians per pixel dragged. */
const TURN_SPEED = 0.012;
/** How far the picked muscle rises, and how wide its outline is, in metres. */
const LIFT = 0.003;
const OUTLINE = 0.01;

const quaternionFor = (up: Vec3 | undefined) =>
  up ? new Quaternion().setFromUnitVectors(UP, new Vector3(...normalize(up))) : new Quaternion();
const PART_TURNS = new Map(MUSCLE_PARTS.map((part) => [part.id, quaternionFor(part.shape.up)]));

function Ellipsoid({ shape, grow = 0, renderOrder, children }: { shape: Shape; grow?: number; renderOrder?: number; children: ReactNode }) {
  const quaternion = useMemo(() => quaternionFor(shape.up), [shape.up]);
  return (
    <mesh
      geometry={sphere}
      renderOrder={renderOrder}
      position={shape.center as [number, number, number]}
      quaternion={quaternion}
      scale={[shape.radii[0] + grow, shape.radii[1] + grow, shape.radii[2] + grow]}
    >
      {children}
    </mesh>
  );
}

function Rod({ limb, color }: { limb: Limb; color: string }) {
  const { geometry, position, quaternion } = useMemo(() => {
    const from = new Vector3(...limb.from);
    const to = new Vector3(...limb.to);
    const direction = to.clone().sub(from);
    return {
      geometry: new CapsuleGeometry(limb.radius, direction.length(), 10, 24),
      position: from.clone().add(to).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(UP, direction.normalize()),
    };
  }, [limb]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} quaternion={quaternion}>
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** Eases the figure towards the way it should face; asks for frames only while it moves. */
function Turner({ yaw, target, children }: { yaw: { current: number }; target: { current: number }; children: ReactNode }) {
  const group = useRef<import("three").Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    const gap = target.current - yaw.current;
    if (Math.abs(gap) > 0.0005) {
      yaw.current += gap * Math.min(1, delta * 9);
      invalidate();
    } else {
      yaw.current = target.current;
    }
    if (group.current) group.current.rotation.y = yaw.current;
  });
  return (
    <group ref={group} position={[0, -0.88, 0]}>
      {children}
    </group>
  );
}

/** Asks for a frame whenever the target changes from outside the scene (dragging, the facing buttons). */
function Kick({ version }: { version: number }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [version, invalidate]);
  return null;
}

/** The nearest angle to `from` that faces `facing`: a whole number of turns, plus a half for the back. */
function angleFacing(facing: Facing, from: number): number {
  const turn = Math.PI * 2;
  const base = facing === "front" ? 0 : Math.PI;
  return base + Math.round((from - base) / turn) * turn;
}

const facingOf = (yaw: number): Facing => (Math.cos(yaw) >= 0 ? "front" : "back");

export function BodyView({ shades, colors, selected, onSelect, facing, onTurn, label, fallback, className }: BodyViewProps) {
  const yaw = useRef(angleFacing(facing, 0));
  const target = useRef(yaw.current);
  const [version, setVersion] = useState(0);
  const [hovered, setHovered] = useState<MuscleGroup | null>(null);
  const drag = useRef<{ x: number; start: number; pointer: number } | null>(null);
  const lastFacing = useRef(facing);

  // Turn round when told to (the buttons), unless a drag already got there.
  useEffect(() => {
    if (facing === facingOf(target.current)) return;
    target.current = angleFacing(facing, target.current);
    lastFacing.current = facing;
    setVersion((v) => v + 1);
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
    setVersion((v) => v + 1);
    const turned = facingOf(target.current);
    if (turned !== lastFacing.current) {
      lastFacing.current = turned;
      onTurn?.(turned);
    }
  };
  const endDrag = () => {
    drag.current = null;
  };

  const tap = (group: MuscleGroup) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > TAP_SLOP) return;
    onSelect(group);
  };
  const hover = (group: MuscleGroup | null) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(group);
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
        camera={{ position: [0, 0, 4.25], fov: 26 }}
        gl={{ antialias: true, alpha: true }}
        fallback={fallback}
        onPointerMissed={() => setHovered(null)}
      >
        <Kick version={version} />
        {/* three.js lights a matte surface at 1/π of their intensity, so these
            add up to about π on a surface facing you: it shows its own colour. */}
        <ambientLight intensity={0.68 * Math.PI} />
        <directionalLight position={[1.4, 2.4, 4]} intensity={0.36 * Math.PI} />
        <directionalLight position={[-2.5, 0.5, 1.5]} intensity={0.12 * Math.PI} />
        <Turner yaw={yaw} target={target}>
          {/* A soft shadow on the floor, so the figure stands on something. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0.02]} scale={[0.34, 0.2, 1]}>
            <circleGeometry args={[1, 48]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.08} depthWrite={false} />
          </mesh>

          {FIGURE.shapes.map((shape, index) => (
            <Ellipsoid key={`s${index}`} shape={shape}>
              <meshLambertMaterial color={colors.figure} />
            </Ellipsoid>
          ))}
          {FIGURE.limbs.map((limb, index) => (
            <Rod key={`l${index}`} limb={limb} color={colors.figure} />
          ))}

          {MUSCLE_PARTS.map((part) => (
            <group key={part.id}>
              <mesh
                geometry={sphere}
                renderOrder={2}
                position={part.shape.center as [number, number, number]}
                quaternion={PART_TURNS.get(part.id)}
                scale={(selected === part.group ? part.shape.radii.map((r) => r + LIFT) : part.shape.radii) as [number, number, number]}
                onClick={tap(part.group)}
                onPointerOver={hover(part.group)}
                onPointerOut={hover(null)}
              >
                <meshLambertMaterial
                  color={shades[part.group] ?? colors.figure}
                  emissive={colors.outline}
                  emissiveIntensity={hovered === part.group && selected !== part.group ? 0.08 : 0}
                />
              </mesh>
              {/* The outline: a slightly bigger shell, drawn after the figure (so the
                  figure hides what's inside it) but before the muscles, writing no
                  depth, so the muscle draws over its middle. What's left is a ring
                  round the muscle, even where it sits in a limb's curve. */}
              {selected === part.group && (
                <Ellipsoid shape={part.shape} grow={LIFT + OUTLINE} renderOrder={1}>
                  <meshBasicMaterial color={colors.outline} depthWrite={false} />
                </Ellipsoid>
              )}
            </group>
          ))}
        </Turner>
      </Canvas>
    </div>
  );
}

/**
 * Colours from CSS custom properties, as the page shows them now, following
 * light and dark mode (the system's, or the app's own switch). three.js needs
 * plain sRGB, so each is drawn onto a 1×1 canvas and read back, which works
 * for any CSS colour, light-dark() and oklch() included.
 */
export function useCssColors<K extends string>(variables: Record<K, string>): Record<K, string> | null {
  const [colors, setColors] = useState<Record<K, string> | null>(null);
  const key = JSON.stringify(variables);

  useEffect(() => {
    const names = JSON.parse(key) as Record<K, string>;
    const probe = document.createElement("span");
    probe.style.display = "none";
    document.body.append(probe);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const read = () => {
      const result = {} as Record<K, string>;
      for (const [name, variable] of Object.entries(names) as [K, string][]) {
        probe.style.color = `var(${variable})`;
        const css = getComputedStyle(probe).color;
        if (!context) {
          result[name] = css;
          continue;
        }
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = css;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        result[name] = `#${[r, g, b].map((x) => (x ?? 0).toString(16).padStart(2, "0")).join("")}`;
      }
      setColors(result);
    };
    read();

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => {
      scheme.removeEventListener("change", read);
      observer.disconnect();
      probe.remove();
    };
  }, [key]);

  return colors;
}
