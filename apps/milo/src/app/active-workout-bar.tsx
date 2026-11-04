"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useActiveWorkout } from "@/lib/local/hooks";

import { Elapsed } from "./workout/elapsed";

/** While a workout is going on, a way back to it from every other screen. */
export function ActiveWorkoutBar() {
  const active = useActiveWorkout();
  const pathname = usePathname();
  if (!active || pathname === "/workout") return null;
  return (
    <Link
      href="/workout"
      className="sticky top-[calc(57px+env(safe-area-inset-top))] z-20 flex items-center gap-3 bg-[var(--color-accent-milo)] px-4 py-2.5 text-sm font-medium text-white hover:text-white lg:top-0 lg:mx-[-1px] lg:mt-2 lg:rounded-t-panel lg:px-10"
    >
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {active.name} · <Elapsed since={active.startedAt} />
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        Back to it <ChevronRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
