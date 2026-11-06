"use client";

import { Plane, Shield, ShoppingBag, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@atlas/ui/components/badge";
import { Meter } from "@atlas/ui/components/meter";

import { Amount } from "@/components/money";
import { useLocale } from "@/lib/locale";
import { goalSaved } from "@/lib/summary";
import { GOAL_LABELS, goalStanding } from "@/lib/status";
import type { Account, Goal, GoalKind, Transaction } from "@/lib/model";

import { GOAL_KIND_NAMES } from "../goal-form";

const KIND_ICONS: Record<GoalKind, LucideIcon> = { safety: Shield, travel: Plane, purchase: ShoppingBag, other: Target };

/** "Jun '27". */
function useTargetMonth() {
  const locale = useLocale();
  return (date: string) => {
    const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
    return `${month} '${date.slice(2, 4)}`;
  };
}

/** A savings goal as a card: its kind and standing, what's saved of the target, and what's left. It opens the goal (`/goals?g=`). */
export function GoalCard({ goal, account, transactions, today }: { goal: Goal; account: Account | undefined; transactions: Transaction[]; today: string }) {
  const month = useTargetMonth();
  const saved = goalSaved(goal, transactions);
  const standing = GOAL_LABELS[goalStanding(goal, saved, today)];
  const Icon = KIND_ICONS[goal.kind];
  const currency = account?.currency ?? "USD";
  return (
    <Link
      href={`/goals?g=${encodeURIComponent(goal.id)}`}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-line-card bg-card p-4 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium tracking-[0.04em] text-muted uppercase">
          <Icon size={14} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{GOAL_KIND_NAMES[goal.kind]}</span>
        </span>
        <Badge tone={standing.tone}>{standing.label}</Badge>
      </span>
      <span className="text-lead text-muted">{goal.name}</span>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <Amount cents={saved} currency={currency} whole className="font-serif text-[28px] leading-none @max-[280px]:text-[22px]" />
        <span className="text-sm text-muted">
          of <Amount cents={goal.target} currency={currency} whole />
        </span>
      </span>
      <Meter value={Math.max(0, saved)} max={goal.target} label="Saved toward the goal" />
      <span className="flex items-center justify-between gap-2 border-t border-line pt-3 text-meta text-muted">
        <span>{goal.targetDate ? `Target ${month(goal.targetDate)}` : "No target date"}</span>
        <span>{saved >= goal.target ? "Reached" : <><Amount cents={goal.target - saved} currency={currency} whole /> left</>}</span>
      </span>
    </Link>
  );
}
