"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Meter } from "@atlas/ui/components/meter";
import { Panel } from "@atlas/ui/components/panel";

import { bandProgress } from "@/app/words/lists";
import { bandLabel } from "@/lib/hsk";
import type { HskList } from "@/lib/hsk";
import { useLocale } from "@/lib/locale";
import type { Word } from "@/lib/model";

/** Which bands count as known without a record, in words. */
export function assumedText(assumedBand: number): string {
  if (assumedBand <= 0) return "No band counts as known until you say so.";
  if (assumedBand >= 7) return "Every band counts as known until you say otherwise.";
  return `Bands 1${assumedBand === 1 ? "" : `–${Math.min(assumedBand, 6)}`} count as known until you say otherwise.`;
}

/** How much of each HSK band you know, as one meter a band. */
export function WordProgress({ hsk, book, assumedBand }: { hsk: HskList; book: ReadonlyMap<string, Word>; assumedBand: number }) {
  const locale = useLocale();
  const rows = useMemo(() => bandProgress(hsk, book, assumedBand), [hsk, book, assumedBand]);
  const known = rows.reduce((sum, row) => sum + row.known, 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const n = (value: number) => value.toLocaleString(locale);

  return (
    <Panel title="Words you know">
      <div className="flex flex-col gap-4 border-t border-line px-4 py-4 lg:px-6">
        <p className="text-sm">
          <span className="font-medium">{n(known)}</span> of {n(total)} HSK words.{" "}
          <span className="text-muted">
            {assumedText(assumedBand)} <Link href="/settings" className="underline underline-offset-2 hover:text-ink">Change in Settings</Link>.
          </span>
        </p>
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map(({ band, known: have, total: all }) => (
            <li key={band} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-meta">
                <span className="font-medium">{bandLabel(band)}</span>
                <span className="text-muted tabular-nums">
                  {n(have)} of {n(all)}
                </span>
              </div>
              <Meter value={have} max={all} label={`${bandLabel(band)}: ${have} of ${all} words known`} tone="success" />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
