"use client";

import Link from "next/link";

import { buttonClassName } from "@atlas/ui/components/button";
import { Meter } from "@atlas/ui/components/meter";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";

import { Loading } from "@/components/loading";
import { SyncStatus } from "@/components/sync-status";
import { TextCard, useCoverages } from "@/components/text-card";
import { goalMet, streak, totalsOn } from "@/lib/activity";
import { useDays, useDueCount, useReadings, useSettings, useTexts, useToday, useWordBook } from "@/lib/local/hooks";
import { nextText } from "@/lib/reading";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function TodayPage() {
  const settings = useSettings();
  const days = useDays();
  const due = useDueCount();
  const today = useToday();
  const texts = useTexts();
  const readings = useReadings();
  const book = useWordBook();
  const covers = useCoverages(texts, book);

  if (!days || due === undefined || !texts || !readings || !book) return <Loading />;

  // The text you're in, else the unread one most comfortable to read now (src/lib/reading.ts).
  const next = nextText(texts, readings, (text) => covers.get(text.id)?.share ?? 0);

  const totals = totalsOn(days, today);
  const minutes = Math.floor(totals.seconds / 60);
  const met = goalMet(totals, settings.dailyGoal);
  const run = streak(days, today, settings.dailyGoal);

  return (
    <>
      <PageHeader title="Today" description="Read a text, review what's due, and keep the streak." />
      <PageBody className="max-w-[720px]">
        <Panel title={next?.reason === "continue" ? "Carry on reading" : "Read next"}>
          <div className="flex flex-col gap-3 border-t border-line px-4 py-5 lg:px-6">
            {next ? (
              <TextCard text={next.text} reading={readings.get(next.text.id)} cover={covers.get(next.text.id)} />
            ) : (
              <p className="text-sm text-muted">{texts.length === 0 ? "No texts on this device yet." : "You've read every text here."}</p>
            )}
            <Link href="/library" className="self-start text-meta text-muted underline underline-offset-2 hover:text-ink">
              The whole library
            </Link>
          </div>
        </Panel>

        <Panel title="Today's goal">
          <div className="flex flex-col gap-3 border-t border-line px-4 py-5 lg:px-6">
            <p className="text-sm">
              {met ? "Met. " : ""}
              {minutes} of {plural(settings.dailyGoal, "minute", "minutes")} today.
            </p>
            <Meter value={totals.seconds} max={settings.dailyGoal * 60} label="Today's goal" tone="success" />
            <p className="text-meta text-muted">{run === 0 ? "No streak yet: meet the goal today to start one." : `${plural(run, "day", "days")} in a row.`}</p>
          </div>
        </Panel>

        <Panel title="Review" count={due}>
          <div className="flex flex-col items-start gap-3 border-t border-line px-4 py-5 lg:px-6">
            <p className="text-sm text-muted">{due === 0 ? "Nothing to review." : `${plural(due, "word is", "words are")} due.`}</p>
            {due > 0 && (
              <Link href="/review" className={buttonClassName("secondary", "md")}>
                Review
              </Link>
            )}
          </div>
        </Panel>

        <Panel title="This device">
          <div className="border-t border-line px-4 py-5 lg:px-6">
            <SyncStatus />
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
