import { NextResponse } from "next/server";

import { deleteAttachment, readAttachment } from "@/lib/server/files";

/** Types a browser may show in a tab; anything else is downloaded. */
const SHOWN = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * An attached file. PDFs and pictures open in the browser; anything else
 * is downloaded. The browser is told not to guess the type, and (but for
 * PDFs, which Chrome won't show otherwise) to run nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await readAttachment(id);
  if (!found) return new Response("That file isn't on the server.", { status: 404 });
  const inline = SHOWN.includes(found.record.type);
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": inline ? found.record.type : "application/octet-stream",
      "Content-Length": String(found.bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(found.record.fileName || "file")}`,
      "X-Content-Type-Options": "nosniff",
      ...(found.record.type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** Deletes a file, and its record on every device. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteAttachment(id);
  return NextResponse.json({ ok: true });
}
