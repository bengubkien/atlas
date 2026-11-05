"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { fileSize, MAX_DOCUMENT_BYTES } from "@/lib/documents";
import { firstError, text } from "@/lib/inputs";
import { addDocument, DOCUMENT_KINDS, editDocument } from "@/lib/micasa/api";

const uploadInput = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
  title: text(200),
  notes: text(),
});

/** A file's name as micasa keeps it: no folders, nothing a file name can't hold. */
const safeName = (name: string) =>
  path
    .basename(name)
    .replace(/[\u0000-\u001f/\\:*?"<>|]/g, "")
    .slice(-120) || "file";

/**
 * Attaches an uploaded file to a record. micasa reads documents from disk,
 * so the file goes to a folder of its own for the moment, under its own
 * name (which micasa keeps), and the folder is removed afterwards.
 */
export async function uploadDocumentAction(form: FormData): Promise<ActionResult<null>> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: `That file is ${fileSize(file.size)}; the most a document can be is ${fileSize(MAX_DOCUMENT_BYTES)}.` };
  const parsed = uploadInput.safeParse({ kind: form.get("kind"), id: form.get("id"), title: form.get("title") ?? "", notes: form.get("notes") ?? "" });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { kind, id, title, notes } = parsed.data;

  // A folder outside the app, made at run time: nothing for the bundler to trace.
  const dir = await mkdtemp(path.join(/*turbopackIgnore: true*/ tmpdir(), "hestia-upload-"));
  try {
    const where = path.join(/*turbopackIgnore: true*/ dir, safeName(file.name));
    await writeFile(/*turbopackIgnore: true*/ where, Buffer.from(await file.arrayBuffer()));
    return await attempt(async () => {
      await addDocument({ entity_kind: kind, entity_id: id, ...(title ? { title } : {}), notes }, where);
      return null;
    }, `Attached ${title || safeName(file.name)}.`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const editInput = z.object({ title: z.string().trim().min(1, "Give it a name.").max(200), notes: text() });

/** Renames a document, or changes its notes. The file stays as it is. */
export async function editDocumentAction(id: string, raw: z.input<typeof editInput>): Promise<ActionResult<null>> {
  const parsed = editInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  return attempt(async () => {
    await editDocument(id, parsed.data);
    return null;
  }, "Saved.");
}
