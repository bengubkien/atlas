import { BriefcaseBusiness, Coins, Dumbbell, Globe, HeartPulse, House, type LucideIcon } from "lucide-react";

// The suite's apps, in the order the switcher and the launcher show them.
// Adding an app is one entry here, plus its accent colour in styles.css.

export const APP_IDS = ["atlas", "kairos", "hestia", "milo", "hygeia", "tyche"] as const;

export type AppId = (typeof APP_IDS)[number];

export type AppInfo = {
  id: AppId;
  name: string;
  /** A few words under the name, in the sidebar: 19 characters at most, or it's cut off. */
  tagline: string;
  /** What the app is for, in a sentence, on the launcher. */
  description: string;
  /** The line icon on the app's mark. */
  icon: LucideIcon;
  /** The app's colour, from styles.css: its mark and the switcher only. */
  accent: string;
};

export const APPS: Record<AppId, AppInfo> = {
  atlas: {
    id: "atlas",
    name: "Atlas",
    tagline: "All your apps",
    description: "Every app in the suite, and what needs you today.",
    icon: Globe,
    accent: "var(--color-accent-atlas)",
  },
  kairos: {
    id: "kairos",
    name: "Kairos",
    tagline: "Your job search",
    description: "Your profile, a tailored resume and letter for every job, and each application from draft to offer.",
    icon: BriefcaseBusiness,
    accent: "var(--color-accent-kairos)",
  },
  hestia: {
    id: "hestia",
    name: "Hestia",
    tagline: "Home, looked after",
    description: "Maintenance schedules, projects and quotes, vendors, appliances and their warranties.",
    icon: House,
    accent: "var(--color-accent-hestia)",
  },
  milo: {
    id: "milo",
    name: "Milo",
    tagline: "A set at a time",
    description: "Routines, every workout logged set by set, your records and your progress.",
    icon: Dumbbell,
    accent: "var(--color-accent-milo)",
  },
  hygeia: {
    id: "hygeia",
    name: "Hygeia",
    tagline: "Health, over time",
    description: "Measurements, medications, a journal, appointments and lab results, charted over time.",
    icon: HeartPulse,
    accent: "var(--color-accent-hygeia)",
  },
  tyche: {
    id: "tyche",
    name: "Tyche",
    tagline: "Where money goes",
    description: "Accounts in pesos and dollars, income and spending, bills, budgets and savings goals.",
    icon: Coins,
    accent: "var(--color-accent-tyche)",
  },
};

/** Where each app is reached, or null while it isn't running; worked out on the server (app-urls.ts). */
export type AppLinks = Record<AppId, string | null>;
