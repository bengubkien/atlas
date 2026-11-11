"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Panel } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { Amount, useDateFormat } from "@/components/money";
import { typeValuation } from "@/lib/actions";
import { isDate } from "@/lib/dates";
import { useHoldings } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import type { Account, Valuation } from "@/lib/model";

/** Where an investment's value comes from, in a line: "Value on Nov 6, read from IOL". */
export function ValueLine({ latest }: { latest: Valuation | undefined }) {
  const date = useDateFormat();
  if (!latest) return <span className="text-meta text-muted">No value yet: shows what went in and out.</span>;
  return (
    <span className="text-meta text-muted">
      Value on {date(latest.date)}, {latest.source === "iol" ? "read from IOL" : "typed in"}
    </span>
  );
}

/** Type what the account is worth today, as the broker shows it. */
export function ValueDialog({ account, today, open, onOpenChange }: { account: Account; today: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);
  const save = async (form: FormData) => {
    const day = String(form.get("date") ?? "");
    const value = parseMoney(String(form.get("value") ?? ""));
    if (!isDate(day)) return setError("Pick the date.");
    if (typeof value !== "number") return setError("Type the value.");
    await typeValuation(account.id, day, value);
    toast("Value saved.");
    onOpenChange(false);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Update value" description="What it's worth today, as your broker shows it. Prices change it without any money moving.">
      {open && (
        <form action={save} className="flex flex-col gap-4">
          <Input name="value" label={`Value (${account.currency})`} inputMode="decimal" autoComplete="off" required autoFocus inputClassName="h-12 text-[22px] font-medium tabular-nums" />
          <Input name="date" type="date" label="Date" defaultValue={today} required />
          {error && (
            <p role="alert" className="text-label text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="lg">
              Save
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  );
}

/** +12.5% or −3.1%: always with its sign, so colour is never the only hint. */
function Gain({ gain }: { gain: number | null }) {
  const locale = useLocale();
  if (gain === null) return <span className="text-muted">—</span>;
  const text = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(gain).replace("-", "−");
  return <span className={gain > 0 ? "text-success" : gain < 0 ? "text-error" : "text-muted"}>{text}</span>;
}

/** The positions IOL last reported, biggest first. A stacked list reads on a phone; no table to scroll. */
export function HoldingsPanel({ account }: { account: Account }) {
  const holdings = useHoldings(account.id);
  const locale = useLocale();
  const date = useDateFormat();
  if (!holdings || holdings.length === 0) return null;
  const read = holdings.reduce((latest, holding) => (holding.date > latest ? holding.date : latest), "");
  return (
    <Panel title="Holdings" count={holdings.length}>
      <p className="border-t border-line px-4 py-2 text-meta text-muted lg:px-6">As IOL showed them on {date(read)}.</p>
      <ul className="flex flex-col divide-y divide-line border-t border-line">
        {holdings.map((holding) => (
          <li key={holding.id} className="flex min-h-16 items-center gap-3 px-4 py-2.5 lg:px-6">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{holding.symbol}</span>
              <span className="truncate text-meta text-muted">{holding.name}</span>
              <span className="text-meta text-muted tabular-nums">
                {new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(holding.quantity)} at {formatCents(holding.price, account.currency, locale)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <Amount cents={holding.value} currency={account.currency} className="text-sm font-medium" />
              <span className="text-meta tabular-nums">
                <Gain gain={holding.gain} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type IolStatus = { configured: boolean; lastReadAt: number | null; error: string | null };

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Settings' IOL panel: whether the server reads IOL, when it last did, and how to switch it on. */
export function IolPanel() {
  const locale = useLocale();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [status, setStatus] = useState<IolStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!online) return;
    let live = true;
    fetch("/api/iol", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<IolStatus>) : Promise.reject(new Error(String(response.status)))))
      .then((next) => live && (setStatus(next), setFailed(false)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [online]);

  const readNow = async () => {
    setReading(true);
    try {
      const response = await fetch("/api/iol", { method: "POST" });
      setStatus((await response.json()) as IolStatus);
    } catch {
      setStatus((current) => (current ? { ...current, error: "Tyche couldn't reach its server. Try again in a moment." } : current));
    } finally {
      setReading(false);
    }
  };

  const when = (ms: number) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);

  let body: React.ReactNode;
  if (!online || failed) body = <p className="text-sm text-muted">Connect to see IOL&apos;s status.</p>;
  else if (!status) body = <p className="text-sm text-muted">Checking…</p>;
  else if (!status.configured)
    body = (
      <>
        <p className="text-sm text-pretty">Not connected. Tyche can read your IOL account&apos;s value and holdings every few hours.</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-pretty text-muted">
          <li>In IOL: Mi cuenta → contact → &ldquo;Api&rdquo; as the reason, to ask them to switch on API access.</li>
          <li>On the server, put your IOL username and password in deploy/.env as TYCHE_IOL_USERNAME and TYCHE_IOL_PASSWORD.</li>
          <li>
            Restart Tyche (<code className="rounded bg-track px-1 text-meta">docker compose up -d tyche</code>).
          </li>
        </ol>
      </>
    );
  else
    body = (
      <>
        <p className="text-sm text-pretty">
          Connected.{" "}
          {status.lastReadAt ? `Last read ${when(status.lastReadAt)}.` : "Not read yet."}
        </p>
        {status.error && (
          <p role="alert" className="text-sm text-pretty text-error">
            The last read failed: {status.error}
          </p>
        )}
        <div>
          <Button variant="secondary" disabled={reading} onClick={() => void readNow()}>
            {reading ? "Reading…" : "Read now"}
          </Button>
        </div>
      </>
    );

  return (
    <Panel title="IOL">
      <div className="flex flex-col gap-3 border-t border-line px-4 py-5 lg:px-6">
        {body}
        <p className="text-meta text-pretty text-muted">Tyche only reads; it never places an order. Your IOL password stays on your server.</p>
      </div>
    </Panel>
  );
}
