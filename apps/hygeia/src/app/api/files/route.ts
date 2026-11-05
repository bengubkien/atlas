import { NextResponse } from "next/server";
import { z } from "zod";

import { newId } from "@atlas/sync/records";

import { ATTACHMENT_OWNERS, type Attachment } from "@/lib/model";
import { MAX_FILE_BYTES, saveAttachment, sniffType } from "@/lib/server/files";

const fields = z.object({
  owner: z.enum(ATTACHMENT_OWNERS),
  ownerId: z.string().min(1).max(128),
  title: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
});

/** A file's name without its folders or anything a name can't hold. */
const safeName = (name: string) => name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f"<>|*?:]/g, "").slice(-200) || "file";

/**
 * Attaches an uploaded file to an appointment, a lab report or a spot on
 * the body map. Answers with the record, which the device saves too.
 * proxy.ts has already checked it's you.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "That file is over 25 MB, the most Hygeia takes." }, { status: 413 });
  const parsed = fields.safeParse({ owner: form.get("owner"), ownerId: form.get("ownerId"), title: form.get("title") ?? "", note: form.get("note") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "That isn't something a file can be attached to." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = safeName(file.name);
  const record: Attachment = {
    id: newId(),
    updatedAt: Date.now(),
    deleted: false,
    owner: parsed.data.owner,
    ownerId: parsed.data.ownerId,
    title: parsed.data.title || fileName.replace(/\.[a-z0-9]{1,6}$/i, ""),
    fileName,
    type: sniffType(bytes),
    size: bytes.length,
    at: Date.now(),
    note: parsed.data.note,
  };
  try {
    await saveAttachment(record, bytes);
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json({ error: "The server couldn't keep the file. Try again in a moment." }, { status: 503 });
  }
  return NextResponse.json(record);
}
