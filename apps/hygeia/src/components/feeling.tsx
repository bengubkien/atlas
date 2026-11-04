"use client";

import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";

import { cn } from "@atlas/ui/cn";

export const FEELINGS: { value: number; label: string; icon: LucideIcon }[] = [
  { value: 1, label: "Awful", icon: Frown },
  { value: 2, label: "Bad", icon: Annoyed },
  { value: 3, label: "Okay", icon: Meh },
  { value: 4, label: "Good", icon: Smile },
  { value: 5, label: "Great", icon: Laugh },
];

/** How you feel, 1 to 5, as five faces with their words. Tapping the chosen one again clears it. */
export function FeelingPicker({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="How you feel" className="grid grid-cols-5 gap-1.5">
      {FEELINGS.map(({ value: each, label, icon: Icon }) => {
        const chosen = value === each;
        return (
          <button
            key={each}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => onChange(chosen ? null : each)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-card border py-2.5 text-[11px] font-medium motion-safe:transition-colors",
              chosen ? "border-transparent bg-[var(--color-chart)] text-white" : "border-line-control bg-input text-muted hover:text-ink",
            )}
          >
            <Icon size={22} aria-hidden="true" strokeWidth={chosen ? 2.25 : 1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** A feeling as an icon and its word, small. */
export function FeelingLabel({ value }: { value: number | null }) {
  const feeling = FEELINGS.find((each) => each.value === value);
  if (!feeling) return null;
  const Icon = feeling.icon;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={14} aria-hidden="true" /> {feeling.label}
    </span>
  );
}
