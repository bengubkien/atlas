import { SEEDED } from "@atlas/sync/device";

import type { Category, CategoryGroup } from "./model";

// The categories a new install starts with, to rename, delete or add to.
// Their IDs are fixed, so two devices starting at once make the same ones
// (they're seeded: see Device.seed).

const STARTING: [id: string, name: string, group: CategoryGroup, icon: string][] = [
  ["housing", "Housing", "bills", "house"],
  ["utilities", "Utilities", "bills", "lightbulb"],
  ["internet", "Internet and phone", "bills", "wifi"],
  ["insurance", "Insurance", "bills", "shield"],
  ["subscriptions", "Subscriptions", "bills", "repeat"],
  ["taxes", "Taxes and fees", "bills", "landmark"],
  ["groceries", "Groceries", "daily", "shopping-basket"],
  ["eating-out", "Eating out", "daily", "utensils"],
  ["coffee", "Coffee", "daily", "coffee"],
  ["transport", "Transport", "daily", "car"],
  ["health", "Health", "daily", "heart-pulse"],
  ["shopping", "Shopping", "daily", "shopping-bag"],
  ["fun", "Going out", "daily", "ticket"],
  ["travel", "Travel", "daily", "plane"],
  ["other", "Other", "daily", "circle"],
  ["salary", "Salary", "income", "banknote"],
  ["freelance", "Freelance", "income", "briefcase"],
  ["interest", "Interest", "income", "percent"],
  ["other-income", "Other income", "income", "circle-plus"],
];

export const startingCategories = (): Category[] =>
  STARTING.map(([id, name, group, icon]) => ({ id: `c-${id}`, updatedAt: SEEDED, deleted: false, name, group, icon, budget: null }));

export const GROUP_NAMES: Record<CategoryGroup, string> = {
  bills: "Bills and fixed",
  daily: "Daily spending",
  income: "Income",
};
