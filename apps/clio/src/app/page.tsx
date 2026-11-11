"use client";

import Link from "next/link";

import { buttonClassName } from "@atlas/ui/components/button";
import { ColumnChart } from "@atlas/ui/components/charts";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";

import { DaysRow, GoalRing, weekday } from "@/components/goal";
import { Loading } from "@/components/loading";
import { SyncStatus } from "@/components/sync-status";
import { TextCard, useCoverages } from "@/components/text-card";
import { goalMet, lastDays, longestStreak, minutesToGo, streak, streakLines, totalsOn } from "@/lib/activity";
import { useDays, useDueCount, useReadings, useSettings, useTexts, useToday, useWordBook } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { nextText } from "@/lib/reading";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function TodayPage() {
  const settings = useSettings();
  const days = useDays();
  const due = useDueCount();
  const today = useToday();
  const locale = useLocale();
  const texts = useTexts();
  const readings = useReadings();
  const book = useWordBook();
  const covers = useCoverages(texts, book);

  if (!days || due === undefined || !texts || !readings || !book) return <Loading />;

  // The text you're in, else the unread one most comfortable to read now (src/lib/reading.ts).
  const next = nextText(texts, readings, (text) => covers.get(text.id)?.share ?? 0);

  const goal = settings.dailyGoal;
  const totals = totalsOn(days, today);
  const met = goalMet(totals, goal);
  const left = minutesToGo(totals, goal);
  const run = streak(days, today, goal);
  const longest = longestStreak(days, goal);
  const lines = streakLines(run, met, left);
  const week = lastDays(days, today, 7, goal);
  const weekMinutes = week.reduce((sum, day) => sum + day.seconds, 0) / 60;

  // What counted today, in words; only what happened.
  const counted = [
    totals.textsFinished > 0 && plural(totals.textsFinished, "text finished", "texts finished"),
    totals.reviews > 0 && plural(totals.reviews, "review", "reviews"),
    totals.wordsRead > 0 && plural(totals.wordsRead, "word read", "words read"),
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Today" description="Read a text, review what's due, and keep the streak." />
      <PageBody className="max-w-[720px]">
        <Panel title="Today's goal">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            <div className="flex items-center gap-5">
              <GoalRing seconds={totals.seconds} goalMinutes={goal} />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-serif text-[26px] leading-tight">{met ? "Goal met." : `${plural(left, "minute", "minutes")} to go.`}</p>
                <p className="text-sm text-muted">{counted.length > 0 ? counted.join(" · ") : "Nothing counted yet today."}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-line pt-5">
              <div className="flex flex-col gap-0.5">
                <p className="text-[15px] font-semibold">{lines.streak}</p>
                {lines.next && <p className="text-sm text-muted">{lines.next}</p>}
                {longest > 0 && <p className="text-meta text-muted">Longest: {plural(longest, "day", "days")}.</p>}
              </div>
              <DaysRow days={week} today={today} />
            </div>
          </div>
        </Panel>

        <Panel title={next?.reason === "continue" ? "Carry on reading" : "Read next"}>
          <div className="flex flex-col border-t border-line">
            {next ? (
              <TextCard flat text={next.text} reading={readings.get(next.text.id)} cover={covers.get(next.text.id)} />
            ) : (
              <p className="px-4 py-5 text-sm text-muted lg:px-6">{texts.length === 0 ? "No texts on this device yet." : "You've read every text here."}</p>
            )}
            <Link href="/library" className="border-t border-line px-4 py-3 text-meta text-muted hover:text-ink lg:px-6">
              The whole library
            </Link>
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

        <ColumnChart
          title="This week"
          description={`${Math.round(weekMinutes)} ${Math.round(weekMinutes) === 1 ? "minute" : "minutes"} in the last 7 days.`}
          points={week.map((day) => ({ key: day.date, label: weekday(day.date, locale), value: day.seconds / 60 }))}
          format={(value) => `${Math.round(value)} min`}
          axisFormat={(value) => String(Math.round(value))}
          valueLabel="Minutes"
        />

        <Panel title="This device">
          <div className="border-t border-line px-4 py-5 lg:px-6">
            <SyncStatus />
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
