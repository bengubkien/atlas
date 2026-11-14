"use client";

import { Download } from "lucide-react";

import { Button } from "@atlas/ui/components/button";

import { getDictionary, useDictionaryOnPhone, useDictionaryState } from "@/lib/local/data";

/** What to say about the dictionary and offline, from where it is now. */
function describe({ cached, loaded, status }: ReturnType<typeof useDictionaryOnPhone>) {
  if (status === "loading") return { title: "Downloading…", hint: "About 3.4 MB. You can keep using Clio meanwhile." };
  if (cached) return { title: "On this phone", hint: "It works with no connection." };
  if (loaded) return { title: "Loaded for now", hint: "This browser isn't keeping it for offline use yet." };
  return { title: "Not downloaded", hint: "Search covers the HSK words only until it is. It's about 3.4 MB, and kept on the phone once it's here." };
}

/** "Dictionary: on this phone", or the button to get it. */
export function DictionaryStatus({ className = "" }: { className?: string }) {
  const where = useDictionaryOnPhone();
  const { error, retry } = useDictionaryState(false);
  const { title, hint } = describe(where);
  const needed = !where.cached && !where.loaded && where.status !== "loading";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5" role="status">
        <span className="text-sm font-medium">Dictionary: {title.charAt(0).toLowerCase() + title.slice(1)}</span>
        <span className="text-meta text-muted">{error && needed ? "It didn't download. Check the connection and try again." : hint}</span>
      </div>
      {needed && (
        <Button variant="secondary" size="sm" onClick={() => (error ? retry() : void getDictionary().catch(() => undefined))}>
          <Download size={14} aria-hidden="true" />
          {error ? "Try again" : "Download"}
        </Button>
      )}
    </div>
  );
}
