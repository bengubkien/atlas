import { headers } from "next/headers";
import { ArrowUpRight } from "lucide-react";

import { APP_IDS, APPS, type AppId } from "@atlas/ui/apps";
import { appLinks } from "@atlas/ui/app-urls";
import { viewerFrom } from "@atlas/ui/auth";
import { cn } from "@atlas/ui/cn";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { AppMark } from "@atlas/ui/shell";

import { Today } from "./today";

/** "Good morning" and so on, by the hour where you are (the server's TZ). */
function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The first name on your Tailscale account, if it has one. */
function firstName(name: string): string | null {
  if (!name || name.includes("@") || name === "You") return null;
  return name.trim().split(/\s+/)[0] ?? null;
}

export default async function AppsPage() {
  const viewer = viewerFrom(await headers());
  const name = viewer ? firstName(viewer.name) : null;
  const links = appLinks();
  const apps = APP_IDS.filter((id) => id !== "atlas");
  // Today asks the apps that are running; the browser does, at each app's address.
  const running = apps.flatMap((id) => (links[id] ? [{ id, href: links[id] }] : []));

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        description="What needs you today, and every app. The switcher at the top of every app brings you back here."
      />
      <PageBody>
        <Today apps={running} />
        <section aria-labelledby="apps-heading" className="flex flex-col gap-3">
          <h2 id="apps-heading" className="text-[15px] font-medium">
            Apps
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4 2xl:grid-cols-4">
            {apps.map((id) => (
              <li key={id} className="flex">
                <AppCard id={id} href={links[id]} />
              </li>
            ))}
          </ul>
        </section>
      </PageBody>
    </>
  );
}

function AppCard({ id, href }: { id: AppId; href: string | null }) {
  const { name, tagline, description } = APPS[id];
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <AppMark app={id} size={44} className={cn(!href && "opacity-45")} />
        {href ? (
          <ArrowUpRight
            size={18}
            aria-hidden="true"
            className="text-faint group-hover/card:text-ink motion-safe:transition-colors"
          />
        ) : (
          <span className="rounded-full border border-line-field px-2 py-0.5 text-[11px] font-medium text-muted">Not running yet</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-section">{name}</h3>
        <p className="text-meta text-muted">{tagline}</p>
      </div>
      <p className="text-sm text-pretty text-document">{description}</p>
      {href && <p className="mt-auto truncate pt-1 font-mono text-xs text-muted">{new URL(href).host}</p>}
    </>
  );
  const card = "flex w-full flex-col gap-4 rounded-panel border border-line-card bg-card p-5 lg:p-6";

  if (!href) return <div className={cn(card, "bg-transparent text-muted")}>{content}</div>;
  return (
    <a
      href={href}
      className={cn(
        card,
        "group/card text-ink shadow-control hover:border-line-strong hover:text-ink motion-safe:transition-[border-color,box-shadow] hover:shadow-page",
      )}
    >
      {content}
    </a>
  );
}
