"use client";

import { Badge } from "@atlas/ui/components/badge";
import { cn } from "@atlas/ui/cn";
import { formatDate } from "@atlas/ui/format";

import { CategoryIcon } from "@/lib/icons";
import { useToday } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import type { Category, Currency, Transaction } from "@/lib/model";
import { transactionLabel } from "@/lib/status";

/** An amount, with figures that line up in columns. `sign` writes "+" on money in. */
export function Amount({ cents, currency, sign = false, whole = false, className }: { cents: number; currency: Currency; sign?: boolean; whole?: boolean; className?: string }) {
  const locale = useLocale();
  return <span className={cn("tabular-nums", className)}>{formatCents(cents, currency, locale, { sign, whole })}</span>;
}

/** A category's icon and name, small and quiet: the line above a card's payee. */
export function CategoryLabel({ category, fallback = "No category", className }: { category: Category | null | undefined; fallback?: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-medium tracking-[0.04em] text-muted uppercase", className)}>
      <CategoryIcon name={category?.icon} size={14} className="shrink-0" />
      <span className="truncate">{category?.name ?? fallback}</span>
    </span>
  );
}

/** A transaction's status in words: "Overdue · 6 days late", "Paid". */
export function StatusBadge({ transaction, today }: { transaction: Transaction; today: string }) {
  const { label, tone } = transactionLabel(transaction, today);
  return <Badge tone={tone}>{label}</Badge>;
}

/** "Nov 6, 2026", or "Nov 6" in the current year. */
export function useDateFormat() {
  const locale = useLocale();
  const thisYear = useToday().slice(0, 4);
  return (date: string, { year }: { year?: boolean } = {}) => formatDate(date, locale, { year: year ?? date.slice(0, 4) !== thisYear });
}
