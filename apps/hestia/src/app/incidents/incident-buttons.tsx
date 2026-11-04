"use client";

import { useTransition } from "react";

import { Button } from "@atlas/ui/components/button";
import { toastResult } from "@atlas/ui/components/toast";

import { resolveIncident, startIncident } from "./actions";

/** "Fixing it" and "Fixed", on an open issue. */
export function IncidentButtons({ id, title, status }: { id: string; title: string; status: "open" | "in_progress" }) {
  const [pending, startTransition] = useTransition();
  const run = (action: (id: string) => ReturnType<typeof resolveIncident>) =>
    startTransition(async () => {
      toastResult(await action(id));
    });
  return (
    <div className="flex gap-1.5">
      {status === "open" && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(startIncident)} aria-label={`Being fixed: ${title}`} className="hidden sm:inline-flex">
          Fixing it
        </Button>
      )}
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(resolveIncident)} aria-label={`Fixed: ${title}`}>
        Fixed
      </Button>
    </div>
  );
}
