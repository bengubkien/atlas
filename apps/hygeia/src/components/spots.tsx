"use client";

import { Camera, ChevronRight, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { areaName, isArea } from "@atlas/body/areas";
import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";

import { thisDevice } from "@/lib/local/device";
import { useAttachments } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { newId, type Attachment, type Spot } from "@/lib/model";

import { useAttach } from "./attachments";

// Spots on the skin you keep an eye on, each photographed now and then. The
// first and latest photos side by side show whether it has changed. Photos
// are kept on the server (see attachments.tsx), so seeing them needs it.

const shown = (file: Attachment) => ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type);

/** The spots at one place, and a way to follow a new one there. */
export function SpotsHere({ area, spots }: { area: string; spots: Spot[] }) {
  const here = spots.filter((spot) => spot.area === area);
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-4 lg:px-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-medium">Spots you follow here</span>
        <SpotForm area={area} />
      </div>
      {here.length === 0 ? (
        <p className="text-meta text-muted">A mole, a patch, a scar: follow it, and photograph it now and then to see if it changes.</p>
      ) : (
        <ul className="flex flex-col">
          {here.map((spot) => (
            <SpotLink key={spot.id} spot={spot} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SpotLink({ spot, withPlace = false }: { spot: Spot; withPlace?: boolean }) {
  const photos = useAttachments(spot.id);
  const f = useFormat();
  const latest = photos?.[0];
  return (
    <li>
      <Link href={`/body?a=${spot.area}&s=${spot.id}`} scroll={false} className="flex min-h-12 items-center gap-3 rounded-control px-1 py-1.5 text-ink hover:bg-hover hover:text-ink">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{spot.name}</span>
          <span className="truncate text-meta text-muted">
            {[withPlace && isArea(spot.area) ? areaName(spot.area) : null, photos === undefined ? null : photos.length ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"}, the latest ${f.day(latest!.at)}` : "No photo yet"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-faint" />
      </Link>
    </li>
  );
}

/** Every spot you follow, for the body map's side panel. */
export function AllSpots({ spots }: { spots: Spot[] }) {
  if (spots.length === 0) return null;
  return (
    <Panel title="Spots you follow" count={spots.length}>
      <ul className="flex flex-col border-t border-line px-3 py-2 lg:px-5">
        {spots.map((spot) => (
          <SpotLink key={spot.id} spot={spot} withPlace />
        ))}
      </ul>
    </Panel>
  );
}

/** "Follow a spot", or edit one: its name and notes. */
function SpotForm({ area, spot }: { area: string; spot?: Spot }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const save = async (form: FormData) => {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    if (!name) return;
    const record: Spot = { id: spot?.id ?? newId(), updatedAt: 0, deleted: false, area, name, notes: String(form.get("notes") ?? "").trim().slice(0, 1000), at: spot?.at ?? Date.now() };
    await thisDevice().put("spot", record);
    setOpen(false);
    if (!spot) router.replace(`/body?a=${area}&s=${record.id}`, { scroll: false });
    toast(spot ? "Saved." : `Following ${name}. Add its first photo.`);
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={spot ? "Edit spot" : "Follow a spot"}
      description={isArea(area) ? areaName(area) : undefined}
      trigger={
        spot ? (
          <Button variant="secondary" size="sm">
            Edit
          </Button>
        ) : (
          <Button variant="secondary" size="sm">
            <Plus size={14} aria-hidden="true" /> Follow a spot
          </Button>
        )
      }
    >
      <form action={save} className="flex flex-col gap-4">
        <Input name="name" label="What it is" defaultValue={spot?.name} placeholder="Mole below the shoulder blade" required maxLength={80} autoComplete="off" />
        <Textarea name="notes" label="Notes" rows={2} defaultValue={spot?.notes} placeholder="Where exactly, what the doctor said…" />
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            {spot ? "Save" : "Follow it"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

/** One spot: its photos over time, the first and the latest side by side, and a way to add one. */
export function SpotView({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  const router = useRouter();
  const photos = useAttachments(spot.id);
  const { busy, upload, remove } = useAttach("spot", spot.id);
  const input = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState(false);
  const f = useFormat();
  const pictures = (photos ?? []).filter(shown);
  const first = pictures.at(-1);
  const latest = pictures[0];

  const stopFollowing = async () => {
    setRemoving(false);
    await thisDevice().remove("spot", [spot.id]);
    toast(`Stopped following ${spot.name}. Its photos stay on the server until you delete them.`);
    router.replace(`/body?a=${spot.area}`, { scroll: false });
  };

  return (
    <Panel
      title={spot.name}
      action={
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid size-8 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
          <X size={16} aria-hidden="true" />
        </button>
      }
    >
      <p className="-mt-1 px-4 pb-3 text-meta text-muted lg:px-6">
        {[isArea(spot.area) ? areaName(spot.area) : null, `followed since ${f.day(spot.at)}`].filter(Boolean).join(" · ")}
        {spot.notes ? ` · ${spot.notes}` : ""}
      </p>
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 lg:px-6">
        <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <Camera size={15} aria-hidden="true" /> {busy ? "Uploading…" : "Add a photo"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-label="Add a photo"
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <SpotForm area={spot.area} spot={spot} />
        <Button variant="danger-text" size="sm" onClick={() => setRemoving(true)}>
          Stop following
        </Button>
      </div>
      {first && latest && first.id !== latest.id && (
        <figure className="flex flex-col gap-2 border-t border-line px-4 py-3 lg:px-6">
          <figcaption className="text-label font-medium">First and latest</figcaption>
          <div className="grid grid-cols-2 gap-2">
            {[first, latest].map((photo) => (
              <div key={photo.id} className="flex flex-col gap-1">
                {/* A plain <img>: Next's optimiser would fetch the photo from the server without your Tailscale sign-in. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${photo.id}`} alt={`${spot.name}, ${f.day(photo.at)}`} className="aspect-square w-full rounded-card border border-line-card bg-surface object-cover" />
                <span className="text-meta text-muted">{f.day(photo.at)}</span>
              </div>
            ))}
          </div>
        </figure>
      )}
      {!photos || photos.length === 0 ? (
        <PanelEmpty>No photos yet. Take one in good light, from the same distance each time.</PanelEmpty>
      ) : (
        <PanelList>
          {photos.map((photo) => (
            <li key={photo.id} className="flex items-center gap-3 px-4 py-2 lg:px-6">
              {shown(photo) ? (
                <a href={`/api/files/${photo.id}`} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- see the comparison above */}
                  <img src={`/api/files/${photo.id}`} alt={`${spot.name}, ${f.day(photo.at)}`} loading="lazy" className="size-14 rounded-control border border-line-card bg-surface object-cover" />
                </a>
              ) : (
                <a href={`/api/files/${photo.id}`} className="grid size-14 shrink-0 place-items-center rounded-control border border-line-card text-meta text-muted">
                  File
                </a>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{f.day(photo.at)}</span>
                <span className="truncate text-meta text-muted">{photo.fileName}</span>
              </span>
              <button
                type="button"
                onClick={() => void remove(photo)}
                aria-label={`Delete the photo from ${f.day(photo.at)}`}
                title="Delete"
                className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </PanelList>
      )}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Stop following ${spot.name}?`}
        description="It leaves the body map on every device."
        confirmLabel="Stop following"
        onConfirm={() => void stopFollowing()}
      />
    </Panel>
  );
}
