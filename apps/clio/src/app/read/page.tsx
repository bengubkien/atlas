"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";

import { Loading } from "@/components/loading";
import { Reader } from "@/components/reader/reader";
import { useReading, useText, useWordBook } from "@/lib/local/hooks";

// A text in the reader: /read?t=<id>. One page for every text, so the
// offline copy's fixed page list covers them all.

export default function ReadPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Read />
    </Suspense>
  );
}

function Read() {
  const id = useSearchParams().get("t") ?? "";
  const text = useText(id);
  const reading = useReading(id);
  const book = useWordBook();
  if (text === undefined || reading === undefined || !book) return <Loading />;

  if (!text) {
    return (
      <>
        <PageHeader title="Not here" />
        <PageBody>
          <p className="text-sm text-muted">
            That text isn&apos;t on this device. It may have been removed, or not synced yet. <Link href="/library">The library</Link>
          </p>
        </PageBody>
      </>
    );
  }
  // Keyed by the text, so opening another one starts the reader afresh.
  return <Reader key={text.id} text={text} reading={reading} book={book} />;
}
