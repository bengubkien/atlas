import type { DocumentKind } from "./micasa/api";
import type { Everything } from "./micasa/api";
import type { HouseDocument } from "./micasa/schemas";

// Documents: what each is attached to, and how to show a file's size and type.

/** micasa's largest document, by default. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/** "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "PDF", "Photo", or the file's extension. */
export function fileKind(doc: Pick<HouseDocument, "mime_type" | "file_name">): string {
  if (doc.mime_type.startsWith("application/pdf")) return "PDF";
  if (doc.mime_type.startsWith("image/")) return "Picture";
  const extension = /\.([a-z0-9]{1,6})$/i.exec(doc.file_name)?.[1];
  return extension ? extension.toUpperCase() : "File";
}

/** Types a browser may show in a tab; anything else is downloaded, so an uploaded page can't run as Hestia. */
export const SHOWN_INLINE = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"];

/** What a document is attached to: its name and page, if Hestia has one. */
export function attachedTo(doc: HouseDocument, everything: Everything): { label: string; href?: string } | null {
  const find = <T extends { id: string }>(list: T[]) => list.find((each) => each.id === doc.entity_id);
  const kind = doc.entity_kind as DocumentKind;
  switch (kind) {
    case "maintenance": {
      const item = find(everything.maintenance);
      return item ? { label: item.name, href: `/maintenance/${item.id}` } : null;
    }
    case "service_log": {
      const entry = find(everything.service_log);
      return entry ? { label: `${entry.maintenance_item}, a service`, href: `/maintenance/${entry.maintenance_item_id}` } : null;
    }
    case "project": {
      const project = find(everything.projects);
      return project ? { label: project.title, href: `/projects/${project.id}` } : null;
    }
    case "quote": {
      const quote = find(everything.quotes);
      return quote ? { label: `${quote.project}, ${quote.vendor}'s quote`, href: `/projects/${quote.project_id}` } : null;
    }
    case "appliance": {
      const appliance = find(everything.appliances);
      return appliance ? { label: appliance.name, href: `/appliances/${appliance.id}` } : null;
    }
    case "incident": {
      const incident = find(everything.incidents);
      return incident ? { label: incident.title, href: `/incidents/${incident.id}` } : null;
    }
    case "vendor": {
      const vendor = find(everything.vendors);
      return vendor ? { label: vendor.name, href: "/vendors" } : null;
    }
    default:
      return null;
  }
}
