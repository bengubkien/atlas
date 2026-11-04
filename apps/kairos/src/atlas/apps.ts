import { BriefcaseBusiness, Dumbbell, Globe, HeartPulse, House, type LucideIcon } from "lucide-react";

// Atlas's patch (see ATLAS.md): the suite's apps, for the switcher. A copy of
// packages/ui/src/apps.ts in Atlas, which Kairos can't import, because it
// builds on its own with Dossier's tools. packages/ui's tests check the two
// still agree.

export const APP_IDS = ["atlas", "kairos", "hestia", "milo", "hygeia"] as const;

export type AppId = (typeof APP_IDS)[number];

export type AppInfo = {
  name: string;
  /** A few words under the name, in the sidebar. */
  tagline: string;
  icon: LucideIcon;
  /** The app's colour, from atlas.css. */
  accent: string;
};

export const APPS: Record<AppId, AppInfo> = {
  atlas: { name: "Atlas", tagline: "All your apps", icon: Globe, accent: "var(--color-accent-atlas)" },
  kairos: { name: "Kairos", tagline: "Your job search", icon: BriefcaseBusiness, accent: "var(--color-accent-kairos)" },
  hestia: { name: "Hestia", tagline: "Home, looked after", icon: House, accent: "var(--color-accent-hestia)" },
  milo: { name: "Milo", tagline: "A set at a time", icon: Dumbbell, accent: "var(--color-accent-milo)" },
  hygeia: { name: "Hygeia", tagline: "Health, over time", icon: HeartPulse, accent: "var(--color-accent-hygeia)" },
};

/** Where each app is reached, or null while it isn't running. */
export type AppLinks = Record<AppId, string | null>;
