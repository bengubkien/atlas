import type { ReactNode } from "react";

/** Labelled facts about a record, two columns wide where there's room. Facts without a value are left out. */
export function Facts({ items }: { items: [label: string, value: ReactNode][] }) {
  const shown = items.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid gap-x-8 gap-y-4 border-t border-line px-4 py-5 sm:grid-cols-2 lg:px-6">
      {shown.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-label text-muted">{label}</dt>
          <dd className="text-sm text-pretty break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
