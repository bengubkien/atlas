import type { BadgeTone } from "@atlas/ui/components/badge";

import type { IncidentSeverity, IncidentStatus, ProjectStatus } from "./micasa/schemas";

/** micasa's statuses in words, with a tone for their badge. */
export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: BadgeTone }> = {
  ideating: { label: "Idea", tone: "neutral" },
  planned: { label: "Planned", tone: "neutral" },
  quoted: { label: "Quoted", tone: "neutral" },
  underway: { label: "Underway", tone: "success" },
  delayed: { label: "Delayed", tone: "warning" },
  completed: { label: "Done", tone: "success" },
  abandoned: { label: "Dropped", tone: "neutral" },
};

/** The board's columns, in the order a project moves through them. */
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["ideating", "planned", "quoted", "underway", "delayed"];

export const INCIDENT_SEVERITY: Record<IncidentSeverity, { label: string; tone: BadgeTone; order: number }> = {
  urgent: { label: "Urgent", tone: "danger", order: 0 },
  soon: { label: "Soon", tone: "warning", order: 1 },
  whenever: { label: "Whenever", tone: "neutral", order: 2 },
};

export const INCIDENT_STATUS: Record<IncidentStatus, string> = {
  open: "Open",
  in_progress: "Being fixed",
  resolved: "Fixed",
};
