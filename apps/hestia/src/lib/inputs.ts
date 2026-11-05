import { z } from "zod";

import { parseMoney } from "@atlas/ui/format";

// The rules Hestia's forms share, for its Server Actions, and how a saved
// value goes back into a form to be edited.

/** An amount typed in the house's currency, as cents; empty is none. */
export const money = (label: string) =>
  z
    .string()
    .trim()
    .default("")
    .transform((text, context) => {
      const cents = parseMoney(text);
      if (cents === "invalid") {
        context.addIssue({ code: "custom", message: `${label} isn't an amount: use digits, like 45.50.` });
        return z.NEVER;
      }
      return cents;
    });

/** A date from a date field, YYYY-MM-DD; empty is none. */
export const optionalDate = z
  .string()
  .trim()
  .default("")
  .refine((text) => text === "" || /^\d{4}-\d{2}-\d{2}$/.test(text), "Pick a date, or leave it empty.")
  .transform((text) => text || null);

export const requiredDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

export const text = (max = 4000) => z.string().trim().max(max, "That's too long.").default("");

/** The first thing to fix, as the form shows it. */
export const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Check the form.";

/** Cents as a form shows them to edit: "45.50", or "" for none. */
export const centsText = (cents: number | null | undefined) => (cents === null || cents === undefined ? "" : (cents / 100).toFixed(2));
