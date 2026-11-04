import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/** Back to the list a record belongs to, in place of the section's icon in the page bar. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
      className="-ml-2 grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
    >
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
  );
}
