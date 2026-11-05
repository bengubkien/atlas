import { getDocumentData, isNotFound, listDocuments } from "@/lib/micasa/api";
import { SHOWN_INLINE } from "@/lib/documents";

/**
 * A document's file. PDFs, pictures and plain text open in the browser;
 * anything else is downloaded. The browser is told not to guess the type,
 * and (but for PDFs) to run nothing, so an uploaded web page can't act as
 * Hestia.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = (await listDocuments()).find((each) => each.id === id);
  if (!doc) return new Response("Not found", { status: 404 });
  try {
    const bytes = await getDocumentData(id);
    const type = doc.mime_type.split(";")[0]!.trim().toLowerCase();
    const inline = SHOWN_INLINE.includes(type);
    const name = doc.file_name || `${doc.title || "document"}`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": inline ? doc.mime_type : "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
        // Chrome won't show a PDF in a sandboxed page; a PDF can't run as Hestia anyway.
        ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (isNotFound(error)) return new Response("Not found", { status: 404 });
    throw error;
  }
}
