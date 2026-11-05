import "server-only";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@atlas/ui/action-result";

import { plainMessage } from "./messages";
import { MicasaError } from "./micasa/run";

/**
 * Runs a Server Action's write and answers in the shape the kit's toast
 * understands. micasa's own validation messages ("serviced_at: invalid date
 * value") are passed on, since they say what to fix; anything else is logged
 * and answered in general terms. Every screen is refreshed afterwards.
 */
export async function attempt<T>(write: () => Promise<T>, toast?: string | ((data: T) => string)): Promise<ActionResult<T>> {
  try {
    const data = await write();
    revalidatePath("/", "layout");
    return { ok: true, data, toast: typeof toast === "function" ? toast(data) : toast };
  } catch (error) {
    if (error instanceof MicasaError) return { ok: false, error: plainMessage(error.message) };
    console.error(error);
    return { ok: false, error: "That didn't save. Try again in a moment." };
  }
}
