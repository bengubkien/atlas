"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { saveHouse } from "@/lib/micasa/api";

const number = (label: string, { decimals = false, max = 1_000_000 } = {}) =>
  z
    .string()
    .trim()
    .default("")
    .transform((text, context) => {
      if (!text) return null;
      const value = Number(text.replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > max || (!decimals && !Number.isInteger(value))) {
        context.addIssue({ code: "custom", message: `${label} isn't a number Hestia can save.` });
        return z.NEVER;
      }
      return value;
    });

const houseInput = z.object({
  nickname: z.string().trim().min(1, "Give the house a name, like its street."),
  address_line1: z.string().trim().default(""),
  city: z.string().trim().default(""),
  state: z.string().trim().default(""),
  postal_code: z.string().trim().default(""),
  year_built: number("The year it was built", { max: 3000 }),
  square_feet: number("The size"),
  bedrooms: number("Bedrooms", { max: 100 }),
  bathrooms: number("Bathrooms", { decimals: true, max: 100 }),
});

export async function saveHouseAction(raw: z.input<typeof houseInput>): Promise<ActionResult<null>> {
  const parsed = houseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  return attempt(async () => {
    await saveHouse(parsed.data);
    return null;
  }, "Saved.");
}
