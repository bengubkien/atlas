"use client";

import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { toast } from "@atlas/ui/components/toast";

import { SyncStatus } from "@/components/sync-status";
import { useHost } from "@/lib/host";
import { thisDevice } from "@/lib/local/device";
import { useSettings } from "@/lib/local/hooks";
import type { Settings } from "@/lib/model";

export default function SettingsPage() {
  const settings = useSettings();
  const device = thisDevice();
  const [syncing, setSyncing] = useState(false);
  const host = useHost();

  const change = (patch: Partial<Settings>) => device.put("settings", { ...settings, ...patch, id: "settings" });

  const exportAll = async () => {
    const blob = new Blob([JSON.stringify({ app: "hygeia", exportedAt: new Date().toISOString(), ...(await device.exportAll()) }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hygeia-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Exported.");
  };

  const row = (id: string, title: string, hint: string, control: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span id={id} className="text-sm font-medium">
          {title}
        </span>
        <span className="text-meta text-muted">{hint}</span>
      </div>
      {control}
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" description="The same on every device you use Hygeia on." />
      <PageBody className="max-w-[720px]">
        <Panel title="Units">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            {row(
              "weight-unit",
              "Body weight in",
              "Changing it converts what's shown; nothing saved changes.",
              <SegmentedControl
                aria-labelledby="weight-unit"
                value={settings.weightUnit}
                onValueChange={(weightUnit) => void change({ weightUnit })}
                options={[
                  { value: "kg", label: "Kilograms" },
                  { value: "lb", label: "Pounds" },
                ]}
              />,
            )}
            {row(
              "glucose-unit",
              "Blood glucose in",
              "mg/dL is used in the US; mmol/L in most other places.",
              <SegmentedControl
                aria-labelledby="glucose-unit"
                value={settings.glucoseUnit}
                onValueChange={(glucoseUnit) => void change({ glucoseUnit })}
                options={[
                  { value: "mg/dL", label: "mg/dL" },
                  { value: "mmol/L", label: "mmol/L" },
                ]}
              />,
            )}
            {row(
              "body-figure",
              "Body on the body map",
              "Which figure Body shows what you feel on.",
              <SegmentedControl<"male" | "female">
                aria-labelledby="body-figure"
                value={settings.body}
                onValueChange={(body) => void change({ body })}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
              />,
            )}
          </div>
        </Panel>

        <Panel title="Calendar">
          <div className="flex flex-col gap-2 border-t border-line px-4 py-5 text-sm lg:px-6">
            <p className="text-muted">Your medications and appointments, as a calendar your phone can subscribe to (Medications explains how):</p>
            <code className="rounded-control bg-track px-3 py-2 font-mono text-xs break-all">https://{host}/calendar.ics</code>
          </div>
        </Panel>

        <Panel title="This device">
          <div className="flex flex-col gap-4 border-t border-line px-4 py-5 lg:px-6">
            <p className="text-sm text-pretty text-muted">
              Hygeia keeps everything on this device and works without the server; changes go to the server whenever it can be reached. Add Hygeia to
              your home screen, so the phone keeps its copy for good.
            </p>
            <SyncStatus />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  void device.sync().finally(() => setSyncing(false));
                }}
              >
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
