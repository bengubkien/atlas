"use client";

import { Pencil, PersonStanding, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { Button, buttonClassName } from "@atlas/ui/components/button";
import { LineChart } from "@atlas/ui/components/charts";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";
import { useNow } from "@atlas/ui/use-now";

import { Attachments } from "@/components/attachments";
import { Loading } from "@/components/loading";
import { dayOf, labFlag, testHistory, testKey } from "@/lib/health";
import { thisDevice } from "@/lib/local/device";
import { useLabReports, useLabResults } from "@/lib/local/hooks";
import { useFormat } from "@/lib/locale";
import { newId, type Change, type LabReport, type LabResult } from "@/lib/model";

export default function LabsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Labs />
    </Suspense>
  );
}

const noon = (date: string) => new Date(`${date}T12:00`).getTime();
const FLAG = { high: { label: "High", tone: "warning" }, low: { label: "Low", tone: "warning" }, normal: { label: "In range", tone: "success" } } as const;

function Labs() {
  const params = useSearchParams();
  const reports = useLabReports();
  const results = useLabResults();
  const f = useFormat();
  if (!reports || !results) return <Loading />;

  const reportId = params.get("r");
  const test = params.get("t");
  if (reportId === "new") return <ReportEditor />;
  if (reportId) {
    const report = reports.find((each) => each.id === reportId);
    if (!report) return <PageHeader title="Not here" description="That report isn't on this device." />;
    const mine = results.filter((result) => result.reportId === report.id);
    return params.get("edit") ? <ReportEditor report={report} results={mine} /> : <ReportView report={report} results={mine} />;
  }
  if (test) return <TestView testKeyValue={test} reports={reports} results={results} />;

  // Every test, by its latest result.
  const latestByTest = new Map<string, { result: LabResult; report: LabReport }>();
  for (const report of [...reports].reverse()) {
    for (const result of results.filter((each) => each.reportId === report.id)) latestByTest.set(testKey(result.name), { result, report });
  }
  const tests = [...latestByTest.entries()].sort((a, b) => a[1].result.name.localeCompare(b[1].result.name));

  return (
    <>
      <PageHeader
        title="Lab results"
        description="Each report's results, and every test followed across reports against its reference range."
        actions={
          <>
            {results.length > 0 && (
              <Link href="/labs/body" className={buttonClassName("secondary")}>
                <PersonStanding size={16} aria-hidden="true" /> On the body
              </Link>
            )}
            <Link href="/labs?r=new" className={buttonClassName()}>
              <Plus size={16} aria-hidden="true" /> New report
            </Link>
          </>
        }
      />
      <PageBody className="lg:grid lg:grid-cols-2 lg:items-start">
        <Panel title="Reports" count={reports.length}>
          {reports.length === 0 ? (
            <PanelEmpty>No reports yet. Add one with its results, as printed on it.</PanelEmpty>
          ) : (
            <PanelList>
              {reports.map((report) => {
                const mine = results.filter((result) => result.reportId === report.id);
                const flagged = mine.filter((result) => ["high", "low"].includes(labFlag(result) ?? "")).length;
                return (
                  <PanelRow
                    key={report.id}
                    href={`/labs?r=${report.id}`}
                    title={f.date(noon(report.date))}
                    meta={[report.lab, `${mine.length} ${mine.length === 1 ? "result" : "results"}`].filter(Boolean).join(" · ")}
                    aside={flagged > 0 ? <Badge tone="warning">{flagged} out of range</Badge> : undefined}
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>
        <Panel title="Tests" count={tests.length || undefined}>
          {tests.length === 0 ? (
            <PanelEmpty>Each test shows here once it&apos;s on a report, with its history.</PanelEmpty>
          ) : (
            <PanelList>
              {tests.map(([key, { result, report }]) => {
                const flag = labFlag(result);
                return (
                  <PanelRow
                    key={key}
                    href={`/labs?t=${encodeURIComponent(key)}`}
                    title={result.name}
                    meta={`${valueText(result, f.number)} · ${f.date(noon(report.date))}`}
                    aside={flag && flag !== "normal" ? <Badge tone={FLAG[flag].tone}>{FLAG[flag].label}</Badge> : undefined}
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

/** "118 mg/dL", "Negative". */
function valueText(result: LabResult, number: (value: number, digits?: number) => string): string {
  if (result.value === null) return result.text || "–";
  return `${number(result.value, 2)}${result.unit ? ` ${result.unit}` : ""}`;
}

/** "70–99", "< 100", "> 40". */
function rangeText(result: Pick<LabResult, "low" | "high">, number: (value: number, digits?: number) => string): string {
  if (result.low !== null && result.high !== null) return `${number(result.low, 2)}–${number(result.high, 2)}`;
  if (result.high !== null) return `< ${number(result.high, 2)}`;
  if (result.low !== null) return `> ${number(result.low, 2)}`;
  return "";
}

function ReportView({ report, results }: { report: LabReport; results: LabResult[] }) {
  const router = useRouter();
  const f = useFormat();
  const [removing, setRemoving] = useState(false);
  const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name));

  const remove = async () => {
    setRemoving(false);
    await thisDevice().save([
      { kind: "labReport", record: { ...report, deleted: true } },
      ...results.map((result): Change => ({ kind: "labResult", record: { ...result, deleted: true } })),
    ]);
    toast("Report deleted.");
    router.push("/labs");
  };

  return (
    <>
      <PageHeader
        before={<BackLink href="/labs" label="Lab results" />}
        title={f.date(noon(report.date))}
        description={[report.lab, report.notes].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(true)} aria-label="Delete report">
              <Trash2 size={15} aria-hidden="true" />
            </Button>
            <Link href={`/labs?r=${report.id}&edit=1`} className={buttonClassName("secondary")}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </Link>
          </>
        }
      />
      <PageBody className="max-w-[760px]">
        <Panel title="Results" count={sorted.length}>
          {sorted.length === 0 ? (
            <PanelEmpty>No results on this report yet.</PanelEmpty>
          ) : (
            <PanelList>
              {sorted.map((result) => {
                const flag = labFlag(result);
                return (
                  <PanelRow
                    key={result.id}
                    href={`/labs?t=${encodeURIComponent(testKey(result.name))}`}
                    title={result.name}
                    meta={valueText(result, f.number)}
                    detail={rangeText(result, f.number) ? `Reference ${rangeText(result, f.number)}${result.unit ? ` ${result.unit}` : ""}` : undefined}
                    aside={flag ? <Badge tone={FLAG[flag].tone}>{FLAG[flag].label}</Badge> : undefined}
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>
        <Attachments owner="labReport" ownerId={report.id} title="The report itself" empty="Attach the report as the lab sent it: the PDF, or a photo of the paper." />
      </PageBody>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Delete this report?"
        description="Its results go too, from every device."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </>
  );
}

function TestView({ testKeyValue, reports, results }: { testKeyValue: string; reports: LabReport[]; results: LabResult[] }) {
  const f = useFormat();
  const history = testHistory(testKeyValue, reports, results);
  const latest = history.at(-1);
  if (!latest) return <PageHeader title="Not here" description="No results for that test on this device." />;
  const numeric = history.filter((point) => point.result.value !== null);
  const unit = latest.result.unit;

  return (
    <>
      <PageHeader
        before={<BackLink href="/labs" label="Lab results" />}
        title={latest.result.name}
        description={rangeText(latest.result, f.number) ? `Reference range ${rangeText(latest.result, f.number)}${unit ? ` ${unit}` : ""}, from the latest report.` : undefined}
      />
      <PageBody className="max-w-[760px]">
        {numeric.length > 1 && (
          <LineChart
            title="Across reports"
            labels={numeric.map((point) => ({ key: point.result.id, label: f.date(noon(point.report.date)) }))}
            series={[{ name: latest.result.name, values: numeric.map((point) => point.result.value) }]}
            format={(value) => f.number(value, 2)}
            valueLabel={unit ? `${latest.result.name} (${unit})` : latest.result.name}
            band={latest.result.low !== null || latest.result.high !== null ? { low: latest.result.low, high: latest.result.high, label: "Reference" } : undefined}
          />
        )}
        <Panel title="Results" count={history.length}>
          <PanelList>
            {[...history].reverse().map(({ report, result }) => {
              const flag = labFlag(result);
              return (
                <PanelRow
                  key={result.id}
                  href={`/labs?r=${report.id}`}
                  title={valueText(result, f.number)}
                  meta={[f.date(noon(report.date)), report.lab].filter(Boolean).join(" · ")}
                  aside={flag ? <Badge tone={FLAG[flag].tone}>{FLAG[flag].label}</Badge> : undefined}
                />
              );
            })}
          </PanelList>
        </Panel>
      </PageBody>
    </>
  );
}

type Row = { id: string; name: string; value: string; unit: string; low: string; high: string };

const toRow = (result: LabResult): Row => ({
  id: result.id,
  name: result.name,
  value: result.value !== null ? String(result.value) : result.text,
  unit: result.unit,
  low: result.low !== null ? String(result.low) : "",
  high: result.high !== null ? String(result.high) : "",
});
const blankRow = (): Row => ({ id: newId(), name: "", value: "", unit: "", low: "", high: "" });
const asNumber = (text: string) => {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) ? value : null;
};

/** A report and its results, as printed on it: new, or edited. */
function ReportEditor({ report, results = [] }: { report?: LabReport; results?: LabResult[] }) {
  const router = useRouter();
  const now = useNow();
  const [date, setDate] = useState(report?.date ?? dayOf(now));
  const [lab, setLab] = useState(report?.lab ?? "");
  const [rows, setRows] = useState<Row[]>(results.length ? [...results].sort((a, b) => a.name.localeCompare(b.name)).map(toRow) : [blankRow(), blankRow(), blankRow()]);
  const [error, setError] = useState<string | null>(null);
  const set = (id: string, patch: Partial<Row>) => setRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const save = async () => {
    const filled = rows.filter((row) => row.name.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Pick the report's date.");
    if (filled.length === 0) return setError("Add at least one result: the test's name and its value.");
    const reportRecord: LabReport = { id: report?.id ?? newId(), updatedAt: 0, deleted: false, date, lab: lab.trim().slice(0, 80), notes: report?.notes ?? "" };
    const kept = new Set(filled.map((row) => row.id));
    await thisDevice().save([
      { kind: "labReport", record: reportRecord },
      ...filled.map((row): Change => {
        const value = asNumber(row.value);
        return {
          kind: "labResult",
          record: {
            id: row.id,
            updatedAt: 0,
            deleted: false,
            reportId: reportRecord.id,
            name: row.name.trim().slice(0, 80),
            value,
            text: value === null ? row.value.trim().slice(0, 80) : "",
            unit: row.unit.trim().slice(0, 24),
            low: asNumber(row.low),
            high: asNumber(row.high),
          },
        };
      }),
      // Results taken off the report.
      ...results.filter((result) => !kept.has(result.id)).map((result): Change => ({ kind: "labResult", record: { ...result, deleted: true } })),
    ]);
    toast("Report saved.");
    router.push(`/labs?r=${reportRecord.id}`);
  };

  const field = "h-10 w-full min-w-0 rounded-control border border-line-input bg-input px-2.5 text-sm shadow-control focus:border-primary";

  return (
    <>
      <PageHeader
        before={<BackLink href={report ? `/labs?r=${report.id}` : "/labs"} label={report ? "the report" : "Lab results"} />}
        title={report ? "Edit report" : "New report"}
        description="Copy the results as printed: the test, its value and unit, and the reference range beside it. A result in words (Negative) goes in Value too."
        actions={<Button onClick={() => void save()}>Save</Button>}
      />
      <PageBody className="max-w-[880px] gap-4">
        <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium">Laboratory</span>
            <input value={lab} onChange={(event) => setLab(event.target.value)} maxLength={80} placeholder="Where it was done" className={field} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_36px] gap-2 px-1 text-xs font-medium text-muted sm:grid">
            <span>Test</span>
            <span>Value</span>
            <span>Unit</span>
            <span>From</span>
            <span>To</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <fieldset
              key={row.id}
              aria-label={`Result ${i + 1}`}
              className="grid grid-cols-2 gap-2 rounded-card border border-line-card bg-card p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_36px] sm:border-0 sm:bg-transparent sm:p-0"
            >
              {/* On a phone the test's name and the remove button share a row; on a wide screen each is a column. */}
              <div className="col-span-2 flex gap-2 sm:contents">
                <input aria-label="Test" value={row.name} onChange={(event) => set(row.id, { name: event.target.value })} placeholder={i === 0 ? "LDL cholesterol" : "Test"} className={field} />
                <button type="button" onClick={() => setRows(rows.filter((each) => each.id !== row.id))} aria-label={`Remove result ${i + 1}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink sm:order-last sm:w-auto">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <input aria-label="Value" value={row.value} onChange={(event) => set(row.id, { value: event.target.value })} placeholder="Value" inputMode="decimal" className={field} />
              <input aria-label="Unit" value={row.unit} onChange={(event) => set(row.id, { unit: event.target.value })} placeholder={i === 0 ? "mg/dL" : "Unit"} className={field} />
              <input aria-label="Reference from" value={row.low} onChange={(event) => set(row.id, { low: event.target.value })} placeholder="From" inputMode="decimal" className={field} />
              <input aria-label="Reference to" value={row.high} onChange={(event) => set(row.id, { high: event.target.value })} placeholder="To" inputMode="decimal" className={field} />
            </fieldset>
          ))}
          <Button variant="secondary" onClick={() => setRows([...rows, blankRow()])} className="self-start">
            <Plus size={15} aria-hidden="true" /> Add a result
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-label text-error">
            {error}
          </p>
        )}
      </PageBody>
    </>
  );
}
