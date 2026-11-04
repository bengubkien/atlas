"use client";

import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { toast } from "@atlas/ui/components/toast";

import { SyncStatus } from "@/components/sync-status";
import { thisDevice } from "@/lib/local/device";
import { useSettings } from "@/lib/local/hooks";
import type { Unit } from "@/lib/model";
import { clock } from "@/lib/units";

const RESTS = ["60", "90", "120", "180"] as const;

export default function SettingsPage() {
  const settings = useSettings();
  const device = thisDevice();
  const [syncing, setSyncing] = useState(false);

  const change = (patch: Partial<typeof settings>) => device.put("settings", { ...settings, ...patch, id: "settings" });

  const syncNow = async () => {
    setSyncing(true);
    await device.sync();
    setSyncing(false);
  };

  /** Everything on this device, as one JSON file. */
  const exportAll = async () => {
    const data = await device.exportAll();
    const blob = new Blob([JSON.stringify({ app: "milo", exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `milo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Exported.");
  };

  return (
    <>
      <PageHeader title="Settings" description="The same on every device you use Milo on." />
      <PageBody className="max-w-[720px]">
        <Panel title="Training">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span id="unit-label" className="text-sm font-medium">Weights in</span>
                <span className="text-meta text-muted">Changing it converts what&apos;s shown; nothing logged changes.</span>
              </div>
              <SegmentedControl<Unit>
                aria-labelledby="unit-label"
                value={settings.unit}
                onValueChange={(unit) => void change({ unit })}
                options={[
                  { value: "kg", label: "Kilograms" },
                  { value: "lb", label: "Pounds" },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span id="rest-label" className="text-sm font-medium">Usual rest</span>
                <span className="text-meta text-muted">Between sets, unless a routine says otherwise.</span>
              </div>
              <SegmentedControl
                aria-labelledby="rest-label"
                value={String(settings.restSeconds)}
                onValueChange={(value) => void change({ restSeconds: Number(value) })}
                options={RESTS.map((value) => ({ value, label: clock(Number(value)) }))}
              />
            </div>
          </div>
        </Panel>

        <Panel title="This device">
          <div className="flex flex-col gap-4 border-t border-line px-4 py-5 lg:px-6">
            <p className="text-sm text-pretty text-muted">
              Milo keeps everything on this device and works without the server; changes go to the server whenever it can be reached. Add Milo to your
              home screen, so the phone keeps its copy for good.
            </p>
            <SyncStatus />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={syncing} onClick={() => void syncNow()}>
                <RefreshCw size={15} aria-hidden="true" className={syncing ? "motion-safe:animate-spin" : ""} /> Sync now
              </Button>
              <Button variant="secondary" onClick={() => void exportAll()}>
                <Download size={15} aria-hidden="true" /> Export everything
              </Button>
            </div>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
