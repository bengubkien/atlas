import { cn } from "../cn";

/**
 * An 8px dot in a status's colour (from Dossier). It's decorative: always
 * show the status's name next to it.
 */
export function StatusDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
