# Handoff: continuing Atlas

For the next agent picking up this work. Read this first, then `PLAN.md`
(design and phases), `README.md` (developing) and `deploy/SETUP.md` (the user's
install guide). Everything below was true at commit `3f6b383` (4 Nov 2026).

## 1. The user and how to work with them

- **Who:** GitHub `bengubkien`, a single user building a private, self-hosted
  suite of personal web apps. Repo: https://github.com/bengubkien/atlas
  (private, branch `main`; every phase so far was committed and pushed).
- **Their standing preference:** "If not confident, ask clarifying questions
  before giving detailed answers." Ask when a decision is genuinely theirs;
  otherwise pick sensible defaults and say so.
- **They've authorized:** building in this repo and pushing to `main`
  (they said "Let's proceed" for each phase). Still don't push to anything
  else, or create releases, without asking.
- **Their setup** (decided, don't re-ask):
  - **Desktop:** Windows with Docker Desktop (WSL 2). It isn't always on, and a
    mini PC comes later.
  - **GPU:** a GTX 1080 (8 GB, Pascal). Ollama needs the NVIDIA **580-series**
    driver (582.78 or later) and runs on its CUDA 12 build.
  - **Network:** private, behind **Tailscale** only. Nothing faces the internet.
  - **Users:** just them.
  - **Phones:** mobile versions are required.
  - **micasa:** they won't use its terminal app; Hestia is the only interface.
  - **Health data:** typed in by hand for now. An AI reader for lab reports is
    planned for phase 4.
  - **Dossier:** keeping a fork is OK.
- **App names** (Greek myth, chosen by the user): **Atlas** (the suite and its
  launcher), **Kairos** (jobs, on Dossier), **Hestia** (house, on micasa),
  **Milo** (gym), **Hygeia** (health).
- **Writing style used everywhere** (UI copy, docs, comments, commit messages):
  plain words, short sentences, no jargon or marketing tone, sentence case. UI
  text says what happens ("Logged. Next due May 2, 2027."). Comments explain
  *why*. Keep that voice.

## 2. Where things stand

| Phase | What | State |
|---|---|---|
| 0 | Repo, plan, design kit, Atlas launcher, Compose stack with Tailscale sidecars | Done |
| 1 | Hestia (house) on micasa 2.8.2 | Done, with a "still to do" list in PLAN.md |
| 2 | Milo (gym), offline-first | Done, with a "still to do" list |
| 3 | Hygeia (health), offline-first, calendar feed for reminders | Done, with a "still to do" list |
| 4 | Hygeia's lab reader: PDF or photo → results via a local vision model | **Not started** |
| 5 | Kairos patch (Dossier fork: name, switcher, Tailscale sign-in), "Today" on Atlas, backup service | **Not started** |

**The last question put to the user, still unanswered:** should they run
`deploy/SETUP.md` on their Windows desktop first, or go straight to phase 5?
I recommended setting up first, because:
- phase 4 needs Ollama on their GPU and some of their real lab reports to
  choose a model;
- nothing has been tested on real Tailscale, on a real iPhone, with a calendar
  subscription, or on Docker Desktop for Windows.

Commits, oldest first: `d5ebb8e` foundation · `e740b75` Windows and GTX 1080
docs · `b1b5e74` Hestia · `66ab109` Milo · `b051d93` shared sync engine and
charts extracted · `3f6b383` Hygeia.

## 3. Repository map

```
packages/ui/      @atlas/ui, the design kit (from Dossier, AGPL-3.0)
  src/styles.css       tokens (Tailwind 4 @theme), app accents; chart colours in a plain :root block (see gotchas)
  src/fonts.ts         next/font/local: Geist, Newsreader, IBM Plex Mono
  src/apps.ts          the app registry (name, tagline ≤19 chars, lucide icon, accent)
  src/app-urls.ts      appLinks(): ATLAS_DOMAIN / ATLAS_APPS / ATLAS_URL_<APP>
  src/auth.ts          viewerFrom()/guard(): Tailscale-User-Login must equal ATLAS_OWNER; ATLAS_AUTH=off for dev
  src/format.ts        formatDate / formatRelativeDays / formatMoney / parseMoney
  src/shell/           AppShell (sidebar on desktop, top bar + TabBar with "More" sheet on phones), AppSwitcher, AppMark, nav types
  src/components/      Dossier's primitives + page-header (PageHeader/PageBar/PageBody), panel (Panel/PanelList/PanelRow/PanelEmpty),
                       form-dialog (centred / bottom sheet), badge, back-link, charts (ColumnChart, LineChart w/ 2 series + band, BarList)
  scripts/icons.mjs    draws each app's favicon/PWA icons from apps.ts + styles.css (pnpm --filter @atlas/ui icons)
packages/sync/    @atlas/sync, offline-first sync, used by Milo and Hygeia
  src/records.ts       recordBase {id, updatedAt, deleted}, changeParser(schemas), SYNC_BATCH, newId
  src/device.ts        Device<Schemas>: Dexie copy + outbox + sync(); last write wins by updatedAt
  src/server.ts        Postgres `records` table (kind,id,data jsonb,updated_at,deleted,seq), migrations, applyChanges,
                       changesSince, currentRecords, syncHandler(schemas) for app/api/sync/route.ts
  src/service-worker.ts the offline copy's worker as a string; served by app/sw.js/route.ts; ?v=<build>&pages=<list>
  src/react.tsx        useSyncInfo, useSyncRuntime (sync triggers + SW registration + storage.persist), SyncStatus
  src/sync.test.ts     server against real Postgres + two devices through it (needs ATLAS_TEST_POSTGRES)
apps/atlas/       the launcher (server-rendered): greeting + app grid
apps/hestia/      house, server-rendered, all data via the `micasa` CLI (see §5)
  src/lib/micasa/      run.ts (one-at-a-time queue, ensureDatabase), api.ts (show all + writes), schemas.ts, micasa.test.ts (contract tests)
apps/milo/        gym, client-rendered from the device's copy
  src/lib/             model.ts (zod schemas), library.ts (49 built-in exercises, ids "b-<slug>"), stats.ts, units.ts, workout.ts, local/{device,hooks}.ts
  src/app/workout/     the live workout: set rows, rest timer, wake lock, exercise picker
apps/hygeia/      health, client-rendered from the device's copy
  src/lib/             model.ts, measures.ts (built-ins "m-weight"…, unit display), health.ts (doses, adherence, labs), calendar.ts (iCalendar), actions.ts
  src/app/calendar.ics/route.ts   the reminders feed
deploy/           compose.yml (db + a Tailscale sidecar per app), .env.example, tailscale/serve.json, postgres/databases.sql, SETUP.md
```

App ports in development: atlas 3000, hestia 3001, milo 3002, hygeia 3004.

## 4. Architecture decisions (and why)

- **Hosting:** one Docker Compose stack. Each app runs in the network namespace
  of its own `tailscale/tailscale:v1.104.4` sidecar, which joins the tailnet
  under the app's name. `TS_USERSPACE=true`, `--advertise-tags=tag:atlas` (so
  node keys don't expire), and Serve config `deploy/tailscale/serve.json`
  (443 → 127.0.0.1:3000). Addresses are `https://<app>.<tailnet>.ts.net`.
  Moving machines means copying the volumes, including the sidecars' state.
- **Sign-in:** none in the Atlas apps. Tailscale Serve sends
  `Tailscale-User-Login` and strips any value a client sends itself. Each
  app's `src/proxy.ts` calls `guard()`, so only `ATLAS_OWNER` gets through,
  and apps listen on `HOSTNAME=127.0.0.1` so only the sidecar can reach them.
  **Kairos (Dossier) is the exception:** it keeps its own password and listens
  on 0.0.0.0, because Dossier's PDF printer opens `http://localhost:PORT`.
- **Kairos:** for now, stock `ghcr.io/aientech/dossier:v1.11.0` (amd64 only).
  Phase 5 plan: Dossier as a git **subtree** in `apps/kairos` with a minimal
  patch. Rename only the sidebar brand, mark and tab title; "Dossier" appears
  on ~189 lines and the rest stays. Add the switcher, and optionally trust the
  Tailscale header. Dossier's strict nonce CSP blocks injected scripts, so the
  switcher has to be in the fork.
- **Hestia:** wraps micasa's CLI (no fork). It reads everything with one
  `micasa show all --json` per request (React `cache()`), uses
  `micasa status --json` on the overview, and writes with
  `micasa db <entity> add|edit --data <json>`. The binary comes into the image
  from `ghcr.io/micasa-dev/micasa:2.8.2`.
- **Milo and Hygeia, offline-first:**
  - **Every screen** is a client component reading Dexie through `useLiveQuery`.
    Pages carry no data, so the service worker can cache them.
  - **Detail views use query parameters** (`/history?w=`, `/labs?t=`), so a
    fixed list of pages covers everything offline. Each app lists those pages
    in `PAGES` (Milo: `src/app/runtime.tsx`; Hygeia: `src/nav.ts`).
  - **Sync runs** on open, on the `online` event, when the page becomes visible,
    every 30 s and 1.5 s after a change, with a 15 s fetch timeout. The service
    worker gives navigations and RSC requests 3 s, then serves from its cache.
  - **Deterministic IDs** where two devices might create "the same" record:
    Hygeia doses `d-<medicationId>-<date>-<HH:MM>` and journal entries
    `j-<date>`; built-in exercises and measures have fixed IDs and are overridden
    by a record with the same ID.
  - **Units:** Milo stores weight in kg; Hygeia stores body weight in kg and
    glucose in mg/dL. Settings converts what's shown.
- **Reminders (Hygeia):** `/calendar.ics`. Medications are floating-time daily
  RRULEs with an alarm at the time; appointments are UTC times with alarms a
  day and two hours before. Phone calendars subscribe over Tailscale (the
  identity header is present, so the guard passes).
- **No Prisma.** The sync store is one table and plain `pg`, which is simpler and
  needs no generate step. PLAN.md originally said Prisma; this is documented.
- **License:** AGPL-3.0 (the kit derives from Dossier). micasa (Apache-2.0) is
  used as a separate program. See `NOTICE`.

## 5. Gotchas: read before changing things

1. **Tailwind v4 only emits theme variables that some class uses.** CSS
   variables referenced only at runtime (the per-app chart colours) must live in
   the plain `:root {}` block in `packages/ui/src/styles.css`, not in `@theme`.
   This bit once: charts silently fell back to the accent colour.
2. **Chart colours:**
   - The shell sets `--color-chart` and `--color-chart-2` from
     `--color-chart-<app>` and `--color-chart-<app>-2`.
   - Milo has one; Hygeia has teal plus orange (for diastolic).
   - Any new chart colour must pass the dataviz skill's validator in both modes
     (`scripts/validate_palette.js`, surfaces: light card `#fbfaf7`, dark card
     `#2a2825`). Load the `dataviz` skill before writing chart code.
3. **micasa quirks:**
   - Every command applies its schema and rebuilds its FTS index when it opens
     the database, so **concurrent commands collide**. `run.ts` queues all of
     them, reads included, at about 90 ms each.
   - `micasa status` **exits 2** when something needs attention (`okCodes: [2]`).
   - `show all` **omits empty sections** on a fresh database (schemas use
     `.nullish()`).
   - There is **no command to create a database**. `ensureDatabase()` runs the
     TUI without a terminal (it migrates, seeds defaults and saves the
     currency, then exits 1), then checks the project types exist.
   - Hestia and micasa both read `MICASA_DB_PATH`.
   - The currency comes from `MICASA_LOCALE_CURRENCY` (from `ATLAS_CURRENCY`),
     **saved once on first run**.
   - Documents can only be read back through `micasa query "select hex(data)…"`;
     IDs are ULIDs and validated before going into SQL.
4. **Next.js 16:**
   - Route files may export only handlers and config: put constants elsewhere.
   - Middleware is `src/proxy.ts`. Its matcher excludes `_next/static`, icons,
     the manifest and `sw.js`.
   - Pages using `useSearchParams` are wrapped in `<Suspense>`.
   - `next start` warns about `output: standalone`. That's fine for local tests;
     the Docker images run `node apps/<app>/server.js`.
5. **Dexie schema:** each device database is at `version(1)`. Changing a table's
   indexes needs `version(2)` in `packages/sync/src/device.ts` (and a migration
   plan for existing devices).
6. **Sync compatibility:** changing a zod schema in a synced app must stay
   backward-compatible: new fields with `.default()`, never newly required
   ones. Devices and the server hold old records, and invalid ones are refused
   or skipped.
7. **pnpm 12:**
   - `pnpm-workspace.yaml` has `allowBuilds: { sharp: true }`; new packages
     with install scripts need approving.
   - `apps/kairos` is excluded from the workspace (it'll keep Dossier's Yarn).
8. **Windows:** `.gitattributes` forces LF line endings so the containers can
   read the config files.
9. **Dockerfiles** build from the repo root and must `COPY` every workspace
   package an app uses (`packages/ui`, and `packages/sync` for Milo and Hygeia).

## 6. Working in this cloud container (it's ephemeral)

Nothing here survives a restart: re-create the tools below. Paths assume the
scratchpad given in your system prompt (call it `$S`).

- **pnpm:**
  `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack enable --install-directory $S/bin && export PATH=$S/bin:$PATH`.
  The repo pins `pnpm@12.16.1`.
- **Docker:** the daemon isn't running. Start it with `(nohup dockerd > $S/dockerd.log 2>&1 &)`.
- **Docker Hub rate limit (429):** pull from Google's mirror and re-tag it, e.g.
  `docker pull mirror.gcr.io/library/node:22-alpine && docker tag mirror.gcr.io/library/node:22-alpine node:22-alpine`
  (the same for `postgres:18-alpine`).
- **TLS-intercepting proxy** inside image builds (`SELF_SIGNED_CERT_IN_CHAIN`):
  build from a scratch copy of the Dockerfile with these two lines after
  `FROM node:22-alpine AS base`:
  ```
  COPY --from=ca ca-bundle.crt /etc/ssl/certs/sandbox-proxy.crt
  ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/sandbox-proxy.crt
  ```
  Then build with `--build-context ca=/root/.ccr`. **Never commit that
  variant**; the user's machine has no such proxy.
- **ghcr.io layer downloads are blocked** (manifests resolve). For Hestia's
  image, stand in a locally built micasa:
  `--build-context ghcr.io/micasa-dev/micasa:2.8.2=<dir containing bin/micasa>`.
- **micasa binary:** clone `https://github.com/micasa-dev/micasa`, check out
  tag `v2.8.2`, then
  `CGO_ENABLED=0 GOTOOLCHAIN=auto go build -ldflags "-X main.version=2.8.2" -o $S/bin/micasa ./cmd/micasa`
  (Go 1.27 is fetched automatically). Sample data: `micasa demo --seed-only demo.db`.
- **Test Postgres:**
  `docker run -d --name atlas-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:18-alpine`.
  Each app gets its own database (`create database milo` / `hygeia`).
- **Everything at once** (the expected counts at `3f6b383` are sync 7,
  Hestia 13, Milo 14, Hygeia 14, so 48):
  ```
  MICASA_BIN=$S/bin/micasa ATLAS_TEST_POSTGRES=postgres://postgres:test@127.0.0.1:55432/postgres pnpm test
  ```
  Builds: `cd apps/<app> && pnpm build`, expecting 0 warnings. Types:
  `pnpm exec tsc --noEmit` in each package or app (apps need a build or
  `next typegen` first for `LayoutProps`).
- **Running an app for testing:** `pnpm start --port 31xx` from its folder,
  with `ATLAS_AUTH=off`, `ATLAS_OWNER_NAME`, `ATLAS_DOMAIN=tail1234.ts.net`,
  `ATLAS_APPS=atlas,kairos,hestia,milo,hygeia`, `TZ` and the app's database
  variable (`DATABASE_URL` or `MICASA_BIN` plus `MICASA_DB_PATH`). Use
  `ATLAS_AUTH=off` when testing offline: the service worker's own fetches don't
  carry Playwright's extra headers.
- **Sample data** for Milo and Hygeia: `POST /api/sync` with
  `{cursor:"0", changes:[{kind, record}]}`. The seed scripts lived in the
  scratchpad and are gone; rebuild them from the schemas in `src/lib/model.ts`.
- **Browser checks:** Playwright is preinstalled (`require('playwright')`).
  - Emulate `devices['iPhone 15']`. For the owner check, pass
    `extraHTTPHeaders: {'Tailscale-User-Login': ...}` with `ATLAS_OWNER` set.
  - Test offline with `context.setOffline(true)`. Wait for
    `navigator.serviceWorker.controller` after one reload first.
  - The sync line has `[data-sync-status]`; the toast is `role=status`.
  - Screenshots the user sees: `deviceScaleFactor: 2`.
- **Stopping servers:** use
  `kill $(ps aux | grep next-server | grep -v grep | awk '{print $2}')`.
  Don't `pkill -f` a pattern that appears in your own command line; it kills
  your shell.
- **Commits** end with the attribution lines your system prompt gives (this
  session used `Co-Authored-By: Claude Opus 5.5 …` and a `Claude-Session:`
  URL; yours will differ). Never put model IDs in commits or code.

## 7. What's next

### Phase 4: Hygeia's lab reader
The design is in PLAN.md → "AI".
- **Pipeline:** upload a PDF or photo. A PDF with text is read directly (no
  vision model); a photo or scan goes to a vision model. A model then lists the
  results (test, value, unit, reference range). The user checks them in the
  **existing report editor** (`apps/hygeia/src/app/labs/page.tsx`,
  `ReportEditor`), which should accept prefilled rows. Nothing saves without
  review.
- **Queue:** jobs wait until the model can be reached, so uploading works with
  the desktop off. That needs server-side file storage, which Hygeia doesn't
  have yet. "Documents attached to appointments and reports" is on its to-do
  list.
- **Model:** a local Ollama on the user's GTX 1080 by default; a hosted model
  only if they turn it on. Candidates to compare on their real reports:
  `qwen3-vl:8b`, `gemma4:e4b`, `minicpm-v`. This can't be tested here (no GPU).
- **After the mini PC:** the recommended path is to keep Ollama on the desktop
  and reach it over Tailscale. The app containers' sidecars run in userspace
  mode, so outbound tailnet access from a container needs Tailscale's proxy
  options (e.g. `TS_OUTBOUND_HTTP_PROXY_LISTEN`); design for that.

### Phase 5
1. **Kairos:**
   - `git subtree add --prefix apps/kairos https://github.com/AienTech/dossier v1.11.0 --squash`.
   - Patch: the sidebar brand and mark, the browser tab title, an app switcher
     reading `ATLAS_*` variables at runtime, and optionally signing in with
     Tailscale's header.
   - Build its own image in Compose instead of the stock one.
   - Kairos's accent colour already exists in the kit (`--color-accent-kairos`); it has no chart colour yet.
2. **"Today" on Atlas:** each app exposes `/api/atlas/today` (what matters
   today) and the launcher shows them together. Mind the app-to-app networking:
   each app listens on 127.0.0.1 inside its sidecar.
3. **Backup service:** dated, encrypted archives copied to a folder the user
   chooses, made only while the machine is on. They'd include a `pg_dump` per
   database and `micasa backup` for Hestia (`docker compose exec hestia micasa
   backup /data/backup.db` works today).

### Smaller to-dos (also listed in PLAN.md)
- **Hestia:** adding quotes; editing and deleting most records; the house's
  systems and costs; documents.
- **Milo:** editing a finished workout; supersets; miles; body weight from
  Hygeia; importing from other apps.
- **Hygeia:** documents; medications on some weekdays only.
- **Possible upstream report to micasa:** concurrent CLI commands collide
  because every command rebuilds the FTS index. The user was told; nothing has
  been filed.

## 8. Never verified

- Real Tailscale: the sidecar joining, Serve certificates, the identity
  headers, the `tag:atlas` ACL.
- Docker Desktop on Windows, and the setup guide's PowerShell commands.
- A real iPhone or Android phone: Safari's service-worker behaviour, Home
  Screen install, wake lock, the beep at the end of rest (iOS has no vibration
  API), and `webcal://` calendar subscription over Tailscale.
- The stock Dossier image running in the stack.
- The real `ghcr.io/micasa-dev/micasa:2.8.2` image inside Hestia's build
  (the tag's manifest resolves; its layers couldn't be downloaded here).
- Ollama on the GTX 1080.
