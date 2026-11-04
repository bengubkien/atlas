import type { ReactNode } from "react";

import { cn } from "../cn";

export type BadgeTone = "neutral" | "danger" | "warning" | "success";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line-field text-muted",
  danger: "border-danger-line bg-danger-surface text-error",
  warning: "border-warning-line bg-warning-surface text-warning",
  success: "border-line-field text-success",
};

/** A small rounded label for a state: "Urgent", "Under warranty". Always words, never colour alone. */
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
