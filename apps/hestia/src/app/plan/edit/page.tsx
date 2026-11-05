import type { Metadata } from "next";

import { BackLink } from "@atlas/ui/components/back-link";
import { PageHeader } from "@atlas/ui/components/page-header";

import { readPlan } from "@/lib/plan-store";

import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = { title: "Edit the floor plan" };

export default async function EditPlanPage() {
  const plan = await readPlan();
  return (
    <>
      <PageHeader
        before={<BackLink href="/plan" label="Floor plan" />}
        title="Edit the floor plan"
        description="Rooms are rectangles: drag one to move it, its corner to size it. Then place what needs looking after. Everything snaps to 10 cm."
      />
      <PlanEditor initial={plan} />
    </>
  );
}
