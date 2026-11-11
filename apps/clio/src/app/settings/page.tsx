"use client";

import { Download } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@atlas/ui/components/button";
import { ToggleChip } from "@atlas/ui/components/chip";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { Select } from "@atlas/ui/components/select";
import { toast } from "@atlas/ui/components/toast";
import { Toggle } from "@atlas/ui/components/toggle";

import { SyncStatus } from "@/components/sync-status";
import { saveSettings } from "@/lib/actions";
import { thisDevice } from "@/lib/local/device";
import { useSettings, useToday } from "@/lib/local/hooks";
import { TOPICS, type PinyinMode, type Topic } from "@/lib/model";

const TOPIC_NAMES: Record<Topic, string> = { daily: "Daily life and dialogues", news: "News", culture: "Culture and history" };
const GOALS = [5, 10, 15, 20, 30, 45, 60];
const SPEEDS = ["0.6", "0.8", "1", "1.2"] as const;

/** The options, with the saved value among them even if it isn't one of the usual ones. */
const withValue = (options: number[], value: number) => (options.includes(value) ? options : [...options, value].sort((a, b) => a - b));

export default function SettingsPage() {
  const settings = useSettings();
  const today = useToday();

  const exportAll = async () => {
    const data = { app: "clio", exportedAt: new Date().toISOString(), ...(await thisDevice().exportAll()) };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    link.download = `clio-${today}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Exported.");
  };

  const toggleTopic = (topic: Topic) => {
    const topics = settings.topics.includes(topic) ? settings.topics.filter((t) => t !== topic) : [...settings.topics, topic];
    // At least one, or there'd be nothing to write about.
    if (topics.length === 0) return toast("Keep at least one topic.");
    void saveSettings({ topics: TOPICS.filter((t) => topics.includes(t)) });
  };

  const row = (id: string, title: string, hint: ReactNode, control: ReactNode) => (
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

  const speed = SPEEDS.find((value) => Number(value) === settings.audioSpeed);

  return (
    <>
      <PageHeader title="Settings" description="The same on every device you use Clio on." />
      <PageBody className="max-w-[720px]">
        <Panel title="Reading">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            {row(
              "pinyin",
              "Pinyin",
              "Over the characters: never, over words you don't know yet, or over every word.",
              <SegmentedControl<PinyinMode>
                aria-labelledby="pinyin"
                value={settings.pinyin}
                onValueChange={(pinyin) => void saveSettings({ pinyin })}
                options={[
                  { value: "off", label: "Off" },
                  { value: "unknown", label: "New words" },
                  { value: "all", label: "All" },
                ]}
              />,
            )}
            <Toggle
              label="Show the English"
              description="Under each sentence. When off, tap a sentence to see it."
              checked={settings.showTranslation}
              onCheckedChange={(showTranslation) => void saveSettings({ showTranslation })}
            />
            {row(
              "audio-speed",
              "Audio speed",
              "How fast texts are read aloud.",
              <SegmentedControl
                aria-labelledby="audio-speed"
                value={speed}
                onValueChange={(value) => void saveSettings({ audioSpeed: Number(value) })}
                options={SPEEDS.map((value) => ({ value, label: `${value}×` }))}
              />,
            )}
          </div>
        </Panel>

        <Panel title="Your level">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            <Select
              label="Words you already know"
              hint="Every word in these HSK 3.0 bands counts as known until you mark it otherwise."
              value={settings.assumedBand}
              onChange={(event) => void saveSettings({ assumedBand: Number(event.target.value) })}
            >
              <option value={0}>None</option>
              {[1, 2, 3, 4, 5, 6].map((band) => (
                <option key={band} value={band}>
                  {band === 1 ? "Band 1" : `Bands 1 to ${band}`}
                </option>
              ))}
            </Select>
            <Select
              label="New words in each text"
              hint="How many words above your level a new text brings."
              value={settings.newWordsPerText}
              onChange={(event) => void saveSettings({ newWordsPerText: Number(event.target.value) })}
            >
              {withValue([3, 4, 5, 6, 7, 8, 10], settings.newWordsPerText).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-2">
              <span id="topics" className="text-sm font-medium">
                Topics
              </span>
              <div role="group" aria-labelledby="topics" className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => (
                  <ToggleChip key={topic} selected={settings.topics.includes(topic)} check onClick={() => toggleTopic(topic)}>
                    {TOPIC_NAMES[topic]}
                  </ToggleChip>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Daily goal">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            <Select
              label="Minutes a day"
              hint="Reading, reviews and quizzes all count. Meet it each day to keep the streak."
              value={settings.dailyGoal}
              onChange={(event) => void saveSettings({ dailyGoal: Number(event.target.value) })}
            >
              {withValue(GOALS, settings.dailyGoal).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </Select>
          </div>
        </Panel>

        <Panel title="This device">
          <div className="flex flex-col gap-4 border-t border-line px-4 py-5 lg:px-6">
            <p className="text-sm text-pretty text-muted">
              Clio keeps everything on this device and works without the server; changes go to the server whenever it can be reached.
            </p>
            <SyncStatus />
            <div>
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
