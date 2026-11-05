"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BodyView, type Facing } from "@atlas/body/body-view";
import { useCssColors } from "@atlas/body/css-colors";
import { isOrgan, ORGAN_NAMES, organFacing, ORGANS, organsFor, type Organ } from "@atlas/body/organs";
import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";

import { Loading } from "@/components/loading";
import { useLabReports, useLabResults, useSettings } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { organStanding, testsByHome, type TestStanding } from "@/lib/organs";

// Lab results on the organ they're about: each organ shaded by whether its
// latest results are within their ranges, tap one for its tests. Blood
// counts are about the blood itself, so they're listed beside the body.

const FACINGS = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
] as const;

const COLORS = { figure: "--color-body", outline: "--color-body-line", in: "--color-body-labs-in", out: "--color-body-labs-out" } as const;

const noon = (date: string) => new Date(`${date}T12:00`).getTime();

export default function LabsOnTheBodyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OnTheBody />
    </Suspense>
  );
}

function OnTheBody() {
  const router = useRouter();
  const param = useSearchParams().get("o");
  const selected = isOrgan(param) ? param : null;
  const reports = useLabReports();
  const results = useLabResults();
  const settings = useSettings();
  const colors = useCssColors(COLORS);
  const [facing, setFacing] = useState<Facing>(selected ? organFacing(selected) : "front");
  if (!reports || !results) return <Loading />;

  const byHome = testsByHome(reports, results);
  const shades = colors
    ? Object.fromEntries(
        ORGANS.flatMap((organ) => {
          const standing = organStanding(byHome.get(organ));
          return standing ? [[organ, standing === "out" ? colors.out : colors.in]] : [];
        }),
      )
    : {};
  const pick = (organ: Organ | null, turn = false) => {
    if (organ && turn) setFacing(organFacing(organ));
    router.replace(organ ? `/labs/body?o=${organ}` : "/labs/body", { scroll: false });
  };

  return (
    <>
      <PageHeader
        before={<BackLink href="/labs" label="Lab results" />}
        title="On the body"
        description="Each organ by its latest results: teal when they're all in range, orange when something isn't. Tap one for its tests."
      />
      <PageBody className="max-w-[1120px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Body" className="flex min-w-0 flex-col rounded-panel border border-line-card bg-card">
          <div className="flex items-center justify-end px-4 pt-4 lg:px-5">
            <SegmentedControl size="sm" aria-label="Show the" options={FACINGS} value={facing} onValueChange={setFacing} />
          </div>
          {colors ? (
            <BodyView
              className="h-[460px] w-full lg:h-[600px]"
              sex={settings.body}
              parts={organsFor}
              shades={shades}
              colors={{ figure: colors.figure, outline: colors.outline }}
              selected={selected}
              onSelect={(organ) => pick(organ)}
              facing={facing}
              onTurn={setFacing}
              label="A body with the organs your lab tests are about, shaded by whether their latest results are within range"
              fallback={<p className="p-6 text-sm text-muted">This device can&rsquo;t draw the 3D body. The list has every organ.</p>}
            />
          ) : (
            <div className="h-[460px] lg:h-[600px]" />
          )}
          <ul aria-label="What the shades mean" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-meta text-muted lg:px-5">
            {[
              ["var(--color-body)", "No results"],
              ["var(--color-body-labs-in)", "All in range"],
              ["var(--color-body-labs-out)", "Something out of range"],
            ].map(([color, label]) => (
              <li key={label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 rounded-[3px] border border-line-field" style={{ backgroundColor: color }} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {selected && <Tests key={selected} title={ORGAN_NAMES[selected]} tests={byHome.get(selected) ?? []} onClose={() => pick(null)} />}
          <Panel title="Organs">
            <PanelList>
              {ORGANS.map((organ) => {
                const tests = byHome.get(organ) ?? [];
                const standing = organStanding(tests);
                return (
                  <li key={organ}>
                    <button
                      type="button"
                      aria-pressed={selected === organ}
                      onClick={() => pick(selected === organ ? null : organ, true)}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover aria-pressed:bg-selected lg:px-6"
                    >
                      <span
                        aria-hidden="true"
                        className="size-3.5 shrink-0 rounded-[4px] border border-line-field"
                        style={{ backgroundColor: standing === "out" ? "var(--color-body-labs-out)" : standing === "in" ? "var(--color-body-labs-in)" : "var(--color-body)" }}
                      />
                      <span className="flex-1 text-sm font-medium">{ORGAN_NAMES[organ]}</span>
                      <span className="text-meta text-muted tabular-nums">
                        {tests.length ? `${tests.length} ${tests.length === 1 ? "test" : "tests"}` : "None yet"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </PanelList>
          </Panel>
          {(byHome.get("blood")?.length ?? 0) > 0 && <Tests title="Blood" tests={byHome.get("blood")!} />}
        </div>
      </PageBody>
    </>
  );
}

function Tests({ title, tests, onClose }: { title: string; tests: TestStanding[]; onClose?: () => void }) {
  const f = useFormat();
  return (
    <Panel
      title={title}
      count={tests.length || undefined}
      action={
        onClose && (
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="grid size-8 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
            <X size={16} aria-hidden="true" />
          </button>
        )
      }
    >
      {tests.length === 0 ? (
        <PanelEmpty>No results for it yet. Tests like these show here once they&apos;re on a report.</PanelEmpty>
      ) : (
        <PanelList>
          {tests.map(({ key, result, report, flag }) => (
            <PanelRow
              key={key}
              href={`/labs?t=${encodeURIComponent(key)}`}
              title={result.name}
              meta={`${result.value === null ? result.text || "–" : `${f.number(result.value, 2)}${result.unit ? ` ${result.unit}` : ""}`} · ${f.date(noon(report.date))}`}
              aside={flag === "high" || flag === "low" ? <Badge tone="warning">{flag === "high" ? "High" : "Low"}</Badge> : flag === "normal" ? <Badge tone="success">In range</Badge> : undefined}
            />
          ))}
        </PanelList>
      )}
    </Panel>
  );
}
