"use client";

import { ArrowUpRight, Check, CircleAlert, Clock, Dot, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { APPS, type AppId } from "@atlas/ui/apps";
import { cn } from "@atlas/ui/cn";
import { AppMark } from "@atlas/ui/shell";
import { parseToday, TODAY_PATH, type TodayItem, type TodayReport, type TodayTone } from "@atlas/ui/today";

// Today: what each running app says matters today (see @atlas/ui/today).
// Your browser asks each app at its own address, so Tailscale tells each one
// it's you, and an app that's stopped or slow only leaves its own card empty.

type Answer = { state: "loading" } | { state: "ready"; report: TodayReport } | { state: "failed" };

/** Long enough for Hestia's micasa on a cold start; short enough not to keep you waiting. */
const TIMEOUT_MS = 8_000;
/** Coming back to the page after this long asks again: the launcher may stay open for days on a phone. */
const STALE_MS = 60_000;

async function ask(href: string): Promise<TodayReport | null> {
  const response = await fetch(`${href}${TODAY_PATH}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return null;
  return parseToday(await response.json());
}

export function Today({ apps }: { apps: { id: AppId; href: string }[] }) {
  const [answers, setAnswers] = useState<Partial<Record<AppId, Answer>>>({});
  const asked = useRef(0);

  const refresh = useCallback(() => {
    asked.current = Date.now();
    for (const { id, href } of apps) {
      setAnswers((now) => (now[id]?.state === "ready" ? now : { ...now, [id]: { state: "loading" } }));
      ask(href)
        .then((report) => setAnswers((now) => ({ ...now, [id]: report ? { state: "ready", report } : { state: "failed" } })))
        .catch(() => setAnswers((now) => ({ ...now, [id]: { state: "failed" } })));
    }
  }, [apps]);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - asked.current > STALE_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (apps.length === 0) return null;
  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-3">
      <h2 id="today-heading" className="text-[15px] font-medium">
        Today
      </h2>
      <ul className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-4">
        {apps.map(({ id, href }) => (
          <li key={id} className="flex">
            <TodayCard id={id} href={href} answer={answers[id] ?? { state: "loading" }} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const TONES: Record<TodayTone | "plain", { icon: LucideIcon; className: string }> = {
  overdue: { icon: CircleAlert, className: "text-error" },
  soon: { icon: Clock, className: "text-warning" },
  done: { icon: Check, className: "text-success" },
  plain: { icon: Dot, className: "text-muted" },
};

function TodayCard({ id, href, answer }: { id: AppId; href: string; answer: Answer }) {
  const { name } = APPS[id];
  return (
    <article
      aria-labelledby={`today-${id}`}
      aria-busy={answer.state === "loading" || undefined}
      className="flex w-full min-w-0 flex-col rounded-panel border border-line-card bg-card"
    >
      <header className="flex items-start gap-3 px-4 pt-4 pb-3 lg:px-5">
        <AppMark app={id} size={28} className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={`today-${id}`} className="text-sm font-medium">
            {name}
          </h3>
          {answer.state === "loading" && (
            <span className="h-4 w-48 max-w-full animate-pulse rounded-control bg-hover motion-reduce:animate-none">
              <span className="sr-only">Asking {name}…</span>
            </span>
          )}
          {answer.state === "failed" && <p className="text-meta text-muted">Couldn&rsquo;t reach {name}. It may be stopped, or still starting.</p>}
          {answer.state === "ready" && <p className="text-meta text-pretty text-muted">{answer.report.summary}</p>}
        </div>
        <a
          href={href}
          aria-label={`Open ${name}`}
          title={`Open ${name}`}
          className="grid size-7 shrink-0 place-items-center rounded-control text-faint hover:bg-hover hover:text-ink"
        >
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </header>
      {answer.state === "ready" && answer.report.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {answer.report.items.map((item, index) => (
            <li key={`${item.href}-${index}`}>
              <TodayRow item={item} href={`${href}${item.href}`} />
            </li>
          ))}
          {answer.report.more > 0 && (
            <li>
              <a href={href} className="flex min-h-11 items-center px-4 text-meta text-muted hover:text-ink lg:px-5">
                {answer.report.more} more in {name}
              </a>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

function TodayRow({ item, href }: { item: TodayItem; href: string }) {
  const tone = TONES[item.tone ?? "plain"];
  const Icon = tone.icon;
  return (
    <a href={href} className="group/row flex min-h-12 items-center gap-3 px-4 py-2 text-ink hover:bg-hover hover:text-ink lg:px-5">
      <Icon size={16} aria-hidden="true" className={cn("shrink-0", tone.className)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.title}</span>
        {item.detail && <span className={cn("truncate text-meta", item.tone ? tone.className : "text-muted")}>{item.detail}</span>}
      </span>
    </a>
  );
}
