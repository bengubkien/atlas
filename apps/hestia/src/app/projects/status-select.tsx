"use client";

import { useTransition } from "react";

import { Select } from "@atlas/ui/components/select";
import { toastResult } from "@atlas/ui/components/toast";

import { PROJECT_STATUS } from "@/lib/labels";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/micasa/schemas";

import { setProjectStatus } from "./actions";

/** The project's status, changed in place. */
export function StatusSelect({ id, status }: { id: string; status: ProjectStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      aria-label="Status"
      // Uncontrolled, so the choice shows at once; a new status from the server resets it.
      key={status}
      defaultValue={status}
      disabled={pending}
      className="w-40"
      onChange={(event) => {
        const next = event.target.value as ProjectStatus;
        startTransition(async () => {
          toastResult(await setProjectStatus(id, next));
        });
      }}
    >
      {PROJECT_STATUSES.map((value) => (
        <option key={value} value={value}>
          {PROJECT_STATUS[value].label}
        </option>
      ))}
    </Select>
  );
}
