"use client";

import { FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";

import { thisDevice } from "@/lib/local/device";
import { useAttachments } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import type { Attachment, AttachmentOwner } from "@/lib/model";

const MAX_BYTES = 25 * 1024 * 1024;

/** "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Attaching a file to a record, and deleting one: both need the server. */
export function useAttach(owner: AttachmentOwner, ownerId: string) {
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return toast("That file is over 25 MB, the most Hygeia takes.");
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("owner", owner);
    form.set("ownerId", ownerId);
    try {
      const response = await fetch("/api/files", { method: "POST", body: form });
      const answer = (await response.json().catch(() => null)) as (Attachment & { error?: string }) | null;
      if (!response.ok || !answer || answer.error) {
        toast(answer?.error ?? "The server couldn't keep the file. Try again in a moment.");
      } else {
        await thisDevice().put("attachment", answer);
        toast(`Attached ${answer.title}.`);
      }
    } catch {
      toast("Attaching a file needs the server, and it can't be reached right now.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (file: Attachment) => {
    try {
      const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
      await thisDevice().remove("attachment", [file.id]);
      toast(`Deleted ${file.title}.`);
    } catch {
      toast("Deleting a file needs the server, and it can't be reached right now.");
    }
  };

  return { busy, upload, remove };
}

/**
 * A record's files: a referral letter, the report as the lab sent it, a
 * photo. Attaching and opening one needs the server; the list shows offline.
 */
export function Attachments({ owner, ownerId, empty, title = "Documents" }: { owner: AttachmentOwner; ownerId: string; empty: string; title?: string }) {
  const files = useAttachments(ownerId);
  const input = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const { busy, upload, remove } = useAttach(owner, ownerId);
  const f = useFormat();

  return (
    <Panel
      title={title}
      count={files?.length || undefined}
      action={
        <>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Paperclip size={15} aria-hidden="true" /> {busy ? "Uploading…" : "Attach"}
          </Button>
          <input ref={input} type="file" accept="application/pdf,image/*" className="sr-only" tabIndex={-1} aria-label="Attach a file" onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }} />
        </>
      }
    >
      {!files || files.length === 0 ? (
        <PanelEmpty>{empty}</PanelEmpty>
      ) : (
        <PanelList>
          {files.map((file) => {
            const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={file.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 lg:px-6">
                <Icon size={18} aria-hidden="true" className="shrink-0 text-muted" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-ink hover:text-muted">
                    {file.title || file.fileName}
                  </a>
                  <span className="truncate text-meta text-muted">
                    {[file.type === "application/pdf" ? "PDF" : file.type.startsWith("image/") ? "Picture" : "File", fileSize(file.size), f.day(file.at)].join(" · ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoving(file)}
                  aria-label={`Delete ${file.title || file.fileName}`}
                  title="Delete"
                  className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </PanelList>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.title || "this file"}?`}
        description="The file goes from the server and from every device. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (removing) void remove(removing);
          setRemoving(null);
        }}
      />
    </Panel>
  );
}
