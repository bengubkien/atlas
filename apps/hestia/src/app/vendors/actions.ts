"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { firstError, text } from "@/lib/inputs";
import { addVendor, editVendor } from "@/lib/micasa/api";

const vendorInput = z.object({
  name: z.string().trim().min(1, "Give their name."),
  contact: text(200),
  phone: text(60),
  email: z.union([z.literal(""), z.email("That email address doesn't look right.")]).default(""),
  website: text(300),
  notes: text(),
});

/** Someone who works on the house: a new one, or changes to one (`id`). */
export async function saveVendorAction(id: string | null, raw: z.input<typeof vendorInput>): Promise<ActionResult<null>> {
  const parsed = vendorInput.safeParse({ ...raw, email: raw.email?.trim() });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, contact, phone, email, website, notes } = parsed.data;
  const input = { name, contact_name: contact, phone, email, website, notes };
  return attempt(
    async () => {
      if (id) await editVendor(id, input);
      else await addVendor(input);
      return null;
    },
    id ? "Saved." : `Added ${name}.`,
  );
}
