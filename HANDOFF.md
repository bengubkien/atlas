# Handoff: continuing Atlas

For the next agent picking up this work. Read this first, then `PLAN.md`
(design and phases), `README.md` (developing), `deploy/SETUP.md` (the user's
install guide) and `apps/kairos/ATLAS.md` (Kairos's patch). Everything below
was true after Tyche's step 6a (6 Nov 2026).

## 1. The user and how to work with them

- **Who:** GitHub `bengubkien`, a single user building a private, self-hosted
  suite of personal web apps. Repo: https://github.com/bengubkien/atlas
  (private).
- **Branch:** work on `main`; the user said so after phase 5 (which was built
  on `claude/brave-allen-jskyw0` and then merged).
- **Their standing preference:** "If not confident, ask clarifying questions
  before giving detailed answers." Ask when a decision is genuinely theirs;
  otherwise pick sensible defaults and say so.
- **They've authorized:** building in this repo, phase by phase ("Let's
  proceed", "Go to phase 5"). Don't push elsewhere, open pull requests or
  create releases without asking.
- **Their setup** (decided, don't re-ask):
  - **Desktop:** Windows with Docker Desktop (WSL 2). It isn't always on, and a
    mini PC comes later.
  - **GPU:** a GTX 1080 (8 GB, Pascal). Ollama needs the NVIDIA **580-series**
    driver (582.78 or later) and runs on its CUDA 12 build.
  - **Network:** private, behind **Tailscale** only. Nothing faces the internet.
  - **Users:** just them.
  - **Phones:** mobile versions are required. Their phone is a **Pixel 8**
    (Android, Chrome; no depth scanner). Their girlfriend has an **iPhone 17
    Pro Max** (LiDAR), which can scan the apartment for Hestia.
  - **micasa:** they won't use its terminal app; Hestia is the only interface.
  - **Health data:** typed in by hand for now. An AI reader for lab reports is
    phase 4.
  - **Dossier:** keeping a fork is OK (it's now a subtree in `apps/kairos`).
- **App names** (Greek myth, chosen by the user): **Atlas** (the suite and its
  launcher), **Kairos** (jobs, on Dossier), **Hestia** (house, on micasa),
  **Milo** (gym), **Hygeia** (health), **Tyche** (money), **Clio** (Chinese).
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
| 5 | Kairos patch, "Today" on Atlas, backup service, two security fixes | Done |
| 6 | Tyche (money), offline-first, pesos and dollars | 6a done; 6b done but Analytics; 6c waits for sample exports |
| 7 | Clio (Chinese graded reader), offline-first | 7a in progress: foundation built; word lists, dictionary, reader and sample texts under way |

**Nothing has run on the user's machine yet, on purpose:** they'll set up
once their mini PC arrives, not on the desktop. Until then, build what doesn't
need their hardware. SETUP.md is written for Windows (PowerShell); the mini
PC will probably run Linux, so check which OS it has and adapt the commands
when the time comes. Phase 4 needs Ollama on the desktop's GTX 1080 and some
of their real lab reports, so it waits too.

After phase 5 the user asked for 3D with real purpose (PLAN.md, "3D, where
place matters"). Built: **Milo's muscle map** and **Hygeia's body map** (with
spots, lab results on organs, and soreness warning Milo), on a shared 3D body
(`packages/body`), and **Hestia's floor plan**, drawn in Hestia and shown in
3D. Still to come: importing an iPhone room scan into the plan.

Then the user asked for everything that didn't need their hardware: the
restore re-send, Hestia's quotes, edits, deletes, house systems and
documents, Milo's edits, supersets, miles, body weight and imports,
Hygeia's files and weekday medications, and a working lint. All built.

Then (6 Nov 2026, session `claude/jolly-pascal-8kp8vh`) the user asked for a
sixth app, a finance tracker following a reference screenshot (a dark
"fintrack" dashboard: three summary cards over a four-column budget board).
Decided with them: **Atlas's look with the reference's layout** (not its
colours or font), **pesos and dollars**, transactions typed in, made from
recurring items, imported from statements (6c) and read from receipts by the
local AI (6d), and the name **Tyche**. Step 6a is built: see PLAN.md's
"Tyche (money)". They're in Argentina (pesos, MEP dollars, Mercado Pago).
Merged into `main` at their request. Then they named their money (PLAN.md
has the list): Mercado Pago, Naranja X (account and a regular Frasco), BBVA
(account and main card), a BNA card, and IOL for investments, read through
its API; cuotas tracked. Built: cuotas, investment values, reading IOL.

Then (11 Nov 2026) the user asked for a seventh app, a Chinese graded
reader like Du Chinese, named **Clio**. Decided with them (PLAN.md, "Clio
(Chinese)"): reading, listening, vocabulary review, writing and speaking;
AI-written graded texts plus real news simplified to level; the reader
first, with a short quiz per text, a streak and a daily goal; simplified
characters graded by HSK 3.0, bands 1–3 assumed known, English glosses;
Claude writes the texts (hosted, key on the server only), Azure Speech
makes audio with word timings and scores pronunciation; topics daily life
and dialogues, news, culture and history. 7a is split between agents: the
foundation (app, registration, records, known words, Today, shell, Settings)
is built; the word lists and dictionary (`scripts/`, `public/data/`,
`hsk.ts`, `dictionary.ts`, `pinyin.ts`, `segment.ts`), the reader, library
and sample texts come next.

Commits, oldest first: `d5ebb8e` foundation · `e740b75` Windows and GTX 1080
docs · `b1b5e74` Hestia · `66ab109` Milo · `b051d93` shared sync engine and
charts · `3f6b383` Hygeia · `aa9b835` first handoff · then phase 5: Dossier
added as a subtree (two commits: the squash and its merge), the security
fixes, Kairos's patch, Today, backups, docs.

## 3. Repository map

```
packages/ui/      @atlas/ui, the design kit (from Dossier, AGPL-3.0)
  src/styles.css       tokens (Tailwind 4 @theme), app accents; chart colours in a plain :root block (see gotchas)
  src/fonts.ts         next/font/local: Geist, Newsreader, IBM Plex Mono
  src/apps.ts          the app registry (name, tagline ≤19 chars, lucide icon, accent)
  src/app-urls.ts      appLinks(): ATLAS_DOMAIN / ATLAS_APPS / ATLAS_URL_<APP>
  src/auth.ts          viewerFrom()/guard()/fromOwnPages(): owner check, and changes only from the app's own pages
  src/today.ts         Today's shape (TodayReport/TodayItem), parseToday(), todayReport() (5 items + `more`)
  src/today-server.ts  todayResponse(): the JSON answer with CORS for Atlas's address only
  src/format.ts        formatDate / formatRelativeDays / formatMoney / parseMoney
  src/shell/           AppShell, AppSwitcher, AppMark, nav types
  src/components/      Dossier's primitives + page-header, panel, form-dialog, badge, back-link, charts
  src/*.test.ts        auth, today, and a check that Kairos's copy of apps.ts and the accents still match
  scripts/icons.mjs    draws each app's icons from apps.ts + styles.css (Kairos: only icon.svg and apple-icon.png)
packages/sync/    @atlas/sync, offline-first sync, used by Milo and Hygeia (records table, Device, service worker)
packages/body/    @atlas/body, the realistic 3D body (three.js 0.186 + React Three Fiber 9.8)
  scripts/build-figures.py  MakeHuman's CC0 base mesh + young-adult male/female targets → src/figures.ts (its docstring says how to fetch them)
  src/figures.ts       generated, don't edit: int16 positions (1/15000 m), the female as deltas, quads, joints, heights
  src/figure.ts        unpacks it: positionsOf, triangles, figureGeometry (cached per sex), jointsOf, heightOf
  src/parts.ts         the muscles: musclesFor(joints) → volumes + facing; compile, reach, partAt (the rule the shader paints with), fitted (a soft part's core and edge)
  src/areas.ts         Hygeia's 28 places: areasFor(joints), AREAS, areaName, areaFacing; drawn flat (relief 0) and soft (warmth with no edge)
  src/organs.ts        the organs lab tests are about, painted on the skin over them: organsFor, ORGANS, ORGAN_NAMES
  src/body-material.ts three's standard material plus the shader: parts' shades, a muscle's belly and fibres, a soft part's warmth and hairline, the mesh's creases, the picked group's ring; part data in a float texture (MAX_PARTS 64)
  src/body-view.tsx    <BodyView sex parts …> (parts: musclesFor or areasFor; drag to turn, Front/Back, tap/hover through partAt)
  src/css-colors.ts    useCssColors(): CSS variables → sRGB for three.js, following the theme
  src/parts.test.ts    the figure unpacks; every part claims skin on both figures, mirrored, on its side
  src/areas.test.ts    every place claims skin on its side; joints win near joints; buttocks vs lower back; under 2.5% of skin left out
apps/atlas/       the launcher: greeting, Today (src/app/today.tsx, client), the app grid
apps/kairos/      Dossier v1.11.0 as a git subtree + Atlas's patch; Yarn, Node 24, not in the pnpm workspace
  ATLAS.md             what the patch changes, file by file, and how to take a new release
  src/atlas/           the patch's own files: apps, app-links, app-switcher, tailscale, today, atlas.css, atlas.test.ts
apps/hestia/      house, server-rendered, all data via the `micasa` CLI (src/lib/micasa); src/lib/today.ts
  src/components/dialogs.tsx      DialogButton, useSubmit, FormFooter: every form in a dialog shares them
  src/components/record-menu.tsx  a record's "…" menu: Edit (its form as children), Delete with Undo (records/actions.ts)
  src/components/documents-panel.tsx  a record's documents, Attach (app/documents: actions, the file route, the list)
  src/lib/messages.ts  micasa's errors said plainly, refusals to delete included
  src/lib/plan.ts, plan-store.ts, plan-status.ts  the floor plan: rooms and typed items (sizes, suggested upkeep), saved as hestia-plan.json beside micasa's db, each item's standing
  src/app/plan/        the plan in 3D (plan-view.tsx, components/plan-3d.tsx) and its editor (edit/plan-editor.tsx, an SVG in metres)
apps/milo/        gym, client-rendered from the device's copy; src/lib/today.ts
  src/lib/muscles.ts   the muscle map's numbers: standings (7 calendar days, last trained), steps, exercisesFor, planFor, balanceNotes, restedLongest
  src/app/muscles/     the Muscles screen (?m=<muscle> picks one)
  src/lib/import.ts    Strong and Hevy CSV: parseCsv, planImport (matching, guessed muscles, stable IDs), importChanges
  src/lib/from-hygeia.ts  useFromHygeia(path, key, read): what Hygeia shares, fetched by the browser and kept in localStorage
  src/lib/soreness.ts  Hygeia's recent symptoms to the muscles they load: cautionsFor, cautionText (Today and the workout)
  src/lib/bodyweight.ts, bodyweight-hook.ts  Hygeia's weights: weightAt, strengthForWeight; fetched by the browser, kept in localStorage
  src/lib/links.tsx    the other apps' addresses for client screens (from the shell's links)
  src/app/history/edit-workout.tsx  editing a finished workout (?w=<id>&edit=1); ExerciseBlock/SetRow take `editing`
apps/hygeia/      health, client-rendered from the device's copy; src/lib/today.ts; calendar.ics
  src/lib/body.ts      the body map's numbers: places (distinct days in the last 30, latest, worst), DAY_STEPS, describe, recent
  src/lib/server/files.ts  attached files in Postgres (`files` table, made on first use) + the synced `attachment` record
  src/app/api/files/   POST uploads (25 MB, type sniffed from the bytes); /[id] GET serves, DELETE removes
  src/components/attachments.tsx  a record's files: attach, open, delete (appointments ?a=, lab reports ?r=); useAttach for others
  src/components/spots.tsx  spots on the body map (?a=<place>&s=<spot>): photos as attachments, first vs latest
  src/lib/organs.ts    lab tests to organs by name (English and Spanish), testsByHome, organStanding; page at app/labs/body
  src/app/api/atlas/symptoms/  the last two weeks' symptoms for Milo (sharedResponse, Milo's origin only)
  src/app/api/atlas/weights/  body weights for Milo (sharedResponse, Milo's origin only)
  src/app/body/        the Body screen (?a=<place> picks one); symptoms are the synced `symptom` kind
  (each of them: src/app/api/atlas/today/route.ts)
apps/tyche/       money, client-rendered from the device's copy, like Hygeia; dev port 3005
  src/lib/model.ts     the synced kinds: account, category, transaction, recurring, goal, rate, settings (cents; ARS or USD per account)
  src/lib/money.ts     rateBook/rateOn (typed beats fetched; else the latest earlier day), convert, converter (each amount at its own day's rate), formatCents
  src/lib/recurring.ts occurrencesBetween (month ends kept), occurrencesAround (−45/+31 days), withOccurrences (for the server), followItem, autopayDue
  src/lib/summary.ts   balances, dailyBalances, monthFlows (transfers aren't income or spending), overview, board, categorySpending, goalSaved
  src/lib/status.ts    words for a transaction ("Overdue · 6 days late") and a goal ("On track"), from dates, never stored
  src/lib/rates.ts, server/rates.ts  DolarApi's quotes → `rate` records, every 3 hours from instrumentation.ts (TYCHE_RATES_URL, empty = off)
  src/lib/actions.ts   every change, incl. keepUp(today): seeds the starting categories and the bills, clears autopay ones
  src/lib/today.ts     Today: overdue, due within 3 days, late pay, over budget
  src/components/      transaction-form (add/edit/transfer/mark paid), transaction-row (+ OpenTransaction: ?t= on any page), account-form, money (Amount, StatusBadge), overview/, search, export-button
  scripts/demo.mjs     a made-up month through /api/sync, for trying the screens
apps/clio/        Chinese graded reader, client-rendered from the device's copy, like Tyche; dev port 3006
  src/lib/model.ts     the synced kinds: text (content, written by the server or seeded as samples), word, review, reading, day, settings
  src/lib/words.ts     statusOf/isKnown (no record: known up to the assumed band), coverage(text, book, bandOf), dueWords, wordBook, withGlossary
  src/lib/activity.ts  day totals over devices, goalMet, streak
  src/lib/actions.ts   saveSettings, saveWord(headword, patch), addActivity({ seconds, reviews, textsFinished, wordsRead })
  src/lib/local/       device.ts (thisDevice, deviceKey), hooks.ts (useSettings, useTexts, useText, useWords, useWordBook, useDueCount, useReadings, useReading, useDays, useToday, useSync), seed.ts (seedSamples), prefs.ts (useTextSize, localStorage)
  src/lib/reading.ts   the reader's rules: wordsToMarkKnown (the finish rule), nextText (Today's pick), readingState, the reading clock (tick, pause, takeSeconds), characterCount
  src/lib/seed.ts      the samples as seeds: seedVersion(SAMPLES_VERSION from src/lib/samples), sampleRecords, retiredSamples
  src/lib/today.ts     Today: words due, today's goal and the streak
  src/app/read/        the reader page (?t=<id>); the reader itself is src/components/reader/
  src/components/reader/  reader.tsx (bar, text, finish), sentence-view.tsx (one memoised sentence), sheet.tsx (bottom sheet / desktop popover), lookup.tsx (a word), after-reading.tsx (<AfterReading>: summary, notes, the quiz's place), use-speech.ts, use-reading-clock.ts
  src/components/text-card.tsx  a text as a card (library, Today), useCoverages
  src/app/globals.css  font-zh and font-zh-serif: the CJK font stacks (system fonts only)
deploy/           compose.yml, .env.example, tailscale/serve.json, postgres/databases.sql, SETUP.md
  backup/              Dockerfile (postgres:18-alpine + gnupg, sqlite, tzdata) and atlas-backup.sh
```

App ports in development: atlas 3000, hestia 3001, milo 3002, hygeia 3004, tyche 3005, clio 3006.

## 4. Architecture decisions (and why)

- **Hosting:** one Docker Compose stack. Each app runs in the network namespace
  of its own `tailscale/tailscale:v1.104.4` sidecar, which joins the tailnet
  under the app's name. `TS_USERSPACE=true`, `--advertise-tags=tag:atlas` (so
  node keys don't expire), and the Serve config `deploy/tailscale/serve.json`
  (443 → **127.0.0.2**:3000). Addresses are `https://<app>.<tailnet>.ts.net`.
- **Why 127.0.0.2 (phase 5 fix):** in userspace mode, tailscaled hands any
  tailnet TCP connection to a port Serve doesn't handle to **127.0.0.1**:port
  (`wgengine/netstack/netstack.go`, `acceptTCP`, `case isTailscaleIP: dialIP =
  ipv4Loopback`). With the apps on 127.0.0.1:3000, any tailnet device could
  reach them past Serve with a made-up `Tailscale-User-Login`. Verified with
  Headscale: on 127.0.0.1 a forged login got through; on 127.0.0.2 the direct
  connection is refused, and through Serve the forged header is replaced by
  the real login. Every app (compose `HOSTNAME`, Dockerfiles' `HOSTNAME` and
  health checks) is on 127.0.0.2. Nothing may listen on 127.0.0.1 in a
  sidecar's namespace.
- **Sign-in:** none. Serve sends `Tailscale-User-Login` (replacing any value a
  client sends). Each app's `src/proxy.ts` calls `guard()`: only `ATLAS_OWNER`
  gets through, and (phase 5 fix) a change (non-GET/HEAD/OPTIONS) is refused
  when the browser says it came from another origin (`Sec-Fetch-Site`
  cross-site/same-site, or a mismatched `Origin`; `X-Forwarded-Host`, which
  Serve sets, is the host). Requests with neither header aren't from a
  browser and pass (seed scripts, curl). This closed a CSRF hole: Milo's and
  Hygeia's `POST /api/sync` parsed a `text/plain` body from any site.
- **Kairos:** a squashed git subtree of Dossier v1.11.0, patched in a few files
  (ATLAS.md). It trusts the same header when `ATLAS_OWNER` is set
  (`src/atlas/tailscale.ts`, used by `getSession()` and `proxy.ts`), with the
  same same-origin rule for changes; Dossier's password stays as the fallback
  (Dossier's env requires `DOSSIER_PASSWORD` anyway). The stack builds it
  from `apps/kairos` with Dossier's Dockerfile (`target: production`), with a
  health check on 127.0.0.2 and `render.ts` printing PDFs from that address.
  The Kairos mark replaces Dossier's only in the sidebar; the sign-in and
  OAuth pages keep Dossier's "D".
- **Today:** the launcher's browser fetches each running app's
  `/api/atlas/today` directly (`apps/atlas/src/app/today.tsx`), with an 8 s
  timeout and a refresh when the page is shown again after a minute. Chosen
  over server-to-server calls: Serve tells each app it's you, so there's no
  shared secret, and the sidecars need no outbound proxy (calls between
  tagged nodes would carry no user identity anyway). The answers carry
  `Access-Control-Allow-Origin` only for Atlas's own origin. Kairos returns
  Dossier's "Worth a look" (without Gmail replies, which wait on Google).
- **Backups:** `deploy/backup/atlas-backup.sh` in a postgres:18-alpine image.
  An archive is due when the newest is `ATLAS_BACKUP_EVERY_HOURS` old (from
  its file name, which survives copying), checked hourly. It holds pg_dumps
  (custom format) of kairos, milo and hygeia, `sqlite3 .backup` of Hestia's
  `micasa.db` (not `micasa backup`, which would collide with Hestia's own
  micasa commands), and `deploy/.env`. It's tarred and locked with `gpg
  --symmetric` (AES-256; passphrase from a private file, never argv), written
  as `.part` then renamed, mode 644. Pruning keeps `ATLAS_BACKUP_KEEP_DAYS`
  and always the newest 3. Restore refuses while apps hold database
  connections, runs `pg_restore --clean --if-exists --single-transaction`,
  then bumps Milo's and Hygeia's `records_seq` by 1,000,000 (for devices on
  builds from before the epoch) and renews their `sync_epoch` (migration 2 in
  `packages/sync/src/server.ts`). `/api/sync` returns the epoch; a device
  that sees a new one puts every record back in its outbox and resets its
  cursor (`startOver` in `device.ts`), so what it logged after the backup
  reaches the server again. Tested in `sync.test.ts` and end to end.
- **3D (the body):** MakeHuman's base mesh (CC0; 13,380 vertices), male or
  female (each app's settings, `body`, default male: the user's reference was
  Clip Studio Paint's male drawing figure, which itself can't be used). The
  muscles aren't geometry: they're volumes placed from the figure's joints,
  each with the way its skin faces, painted on per pixel by a shader, and
  picked through the same rule (`partAt`) from the hit point. Muscle groups
  are separate parts per side. The module is 350 KB (240 KB gzipped); the
  Muscles page's script is about 490 KB gzipped with three.js. A plain list always
  sits beside the 3D view (accessibility, no-WebGL fallback). Colours live in
  `packages/ui/src/styles.css`'s plain `:root` block (`--color-body`,
  `--color-body-line`, `--color-body-milo-1..4` and `--color-body-hygeia-1..4`,
  each validated as an ordinal ramp against the figure) and reach three.js
  through `useCssColors()`. Hygeia's places are their own parts
  (`areasFor`), not muscles; its symptoms are a synced kind of their own
  (`symptom`: area, kind, severity 1–10, at, note), separate from the
  journal's plain symptom strings. The Muscles
  page imports the 3D code directly, not lazily, so its scripts are named in
  the page's HTML and the service worker caches them at install: it works
  offline from the first visit.
- **Clio's texts arrive by sync** (decided in 7a for 7c): a text is a
  synced kind, written on the server with `applyChanges` (as Tyche's rates
  are), so the phone gets each new one on its next sync and keeps it
  offline; no second channel. Audio is a file on the server, named in the
  text. Samples are the same shape, put on the device with `Device.seed`
  (IDs `sample-<name>`). A text carries its own glossary, so it reads with
  no dictionary loaded.
- **Clio's known words:** no record means known up to `assumedBand`
  (default 3), new above; a record decides once there is one. Ignored words
  count neither way in `coverage`. Bands come in as a function, so the
  logic doesn't depend on the word-list files.
- **Clio's activity** is one `day` record per day *per device*
  (`<date>/<device>`, the device's key in localStorage), summed for the goal
  and streak: one shared counter per day would lose counts when two devices
  write it.
- **Clio's reader rules** (7a): tapping a word that counts as `new` saves
  it as `learning`, source `tapped`, with the sentence (`tapWord`), and the
  sheet says "Saved for review": the model's `tapped` means "looked up in a
  text", and it makes the finish rule fair. Known, learning and ignored
  words are only looked up. Finishing marks known each word of the text
  with no record that would count as new (`wordsToMarkKnown`, source
  `marked`, no `context`), in one save with the reading's `finishedAt`;
  Undo deletes just those records. Words read are added when a text is
  finished (all its word tokens); time counts as active time, at most
  90 s for one pause, paused while hidden, saved every 30 s.
- **Clio's samples are versioned seeds:** `Device.seed(changes, { at })`
  (added to `@atlas/sync` for this) saves with `updatedAt` `at` and
  replaces a copy seeded at an older version; a real change or deletion
  has a real time and is never replaced. The samples' own
  `SAMPLES_VERSION` (`src/lib/samples/index.ts`) goes up when they change;
  they're seeded at `seedVersion(v)` = 1 + v (small, below any real time);
  samples no longer shipped are seeded as deleted. `seedSamples()` runs on every start
  (from the shell).
- **Clio's review schedule** keeps ts-fsrs's `Card` fields on the word
  (`card`), camelCase, with moments in milliseconds where ts-fsrs has
  Dates; convert at the edge. `ts-fsrs` isn't installed yet (7b).
- **Hestia:** wraps micasa's CLI (no fork); see the gotchas.
- **Milo and Hygeia, offline-first:** every screen reads Dexie; detail views use
  query parameters (`/history?w=`, `/labs?t=`) so a fixed `PAGES` list covers
  everything offline; sync on open, `online`, visibility, every 30 s and 1.5 s
  after a change; deterministic IDs for doses (`d-<med>-<date>-<HH:MM>`) and
  journal entries (`j-<date>`); Milo stores kg, Hygeia kg and mg/dL.
- **Reminders (Hygeia):** `/calendar.ics`, floating-time daily RRULEs per
  medication time; appointments in UTC with alarms a day and two hours before.
- **No Prisma** in the Atlas apps: the sync store is one table and plain `pg`.
- **License:** AGPL-3.0 (the kit derives from Dossier; Kairos is Dossier).
  micasa (Apache-2.0) is used as a separate program. See `NOTICE`.

## 5. Gotchas: read before changing things

1. **Tailwind v4 only emits theme variables that some class uses.** Variables
   read only at runtime (chart colours, Kairos's app accents in
   `apps/kairos/src/atlas/atlas.css`) go in a plain `:root {}` block.
2. **Chart colours:** the shell sets `--color-chart(-2)` from
   `--color-chart-<app>(-2)`. Any new one must pass the dataviz skill's
   validator in both modes (surfaces `#fbfaf7` light, `#2a2825` dark).
3. **micasa quirks:** concurrent commands collide (every command rebuilds its
   FTS index), so `run.ts` queues them all; `status` exits 2 when something
   needs attention; `show all` omits empty sections on a fresh database; there's
   no "create database" command (`ensureDatabase()` runs the TUI headless);
   the currency is saved once on first run; documents only via `micasa query`.
4. **Next.js 16:** route files export only handlers and config; middleware is
   `src/proxy.ts`; `useSearchParams` pages need `<Suspense>`; `next start` warns
   about `output: standalone` (fine locally).
5. **Dexie schema:** `new Device({ version })`, default 1. Milo is on 1,
   Hygeia on 4 (2 added `symptom`, 3 `attachment`, 4 `spot`). Raise it when the stores or
   indexes change. A device that opens a new version starts its sync cursor
   from "0" once, so it fetches records its older build skipped as unknown
   (covered by a test in `packages/sync`).
6. **Sync compatibility:** synced zod schemas only gain fields with
   `.default()`, never newly required ones.
7. **pnpm 12:** `allowBuilds: { sharp: true }`; new packages with install
   scripts need approving. `apps/kairos` is excluded from the workspace.
   After changing any package.json, run `pnpm install` online and commit the
   lockfile: `pnpm install --offline` here silently leaves it stale, and the
   Dockerfiles use `--frozen-lockfile`.
8. **Windows:** `.gitattributes` forces LF line endings (the backup script and
   Kairos's `docker/start.sh` must stay LF).
9. **Dockerfiles** build from the repo root and `COPY` every workspace package
   an app uses. Kairos builds from `apps/kairos` alone.
10. **The 127.0.0.2 rule** (section 4). A new app or service in a sidecar's
    namespace must listen on 127.0.0.2 (or another non-127.0.0.1 loopback),
    and its health check must ask there.
11. **Kairos's copies:** `apps/kairos/src/atlas/apps.ts` and `atlas.css` copy
    the kit's app list and accents; `packages/ui/src/today.test.ts` fails if
    they drift. Kairos's Today shape is also a copy of `packages/ui/src/today.ts`.
12. **Dossier's dashboard** shows a React hydration warning (#418) when the
    browser's time zone differs from the server's (it renders times in the
    server's zone before the browser reports its own). Upstream behaviour, not
    the patch; in tests, set Playwright's `timezoneId` to the server's `TZ`.
13. **three.js and colour:** lights light a surface at 1/π of their
    intensity, so the lights must add up to about π where the key falls for a
    part to show its own colour; the Canvas is `flat` (no tone mapping). The
    rig is a key from the upper left, a fill, a rim from behind and a
    hemisphere light. On top, the shader draws each muscle's belly (darker
    towards its edge), straight striations across a fixed direction per part
    (faded where they'd be under a couple of pixels), and the mesh's creases
    and ridges (`creasesOf`, from its curvature, worked out in the browser).
    The figures are built 0.7 of the way to MakeHuman's most muscular, so the
    muscles have shape. Check screenshots close up and at phone size after
    any change.
14. **The picked group's ring** is drawn in the shader: skin just past any of
    the group's parts (past a volume's end, or just past the facing edge on
    a limb's side) and inside none of them. Parts of one group should meet
    (the pecs at the breastbone, the lats at the spine) or the ring outlines
    the gap. A post-processing outline adds light, so it can't draw a dark
    ring in light mode. The parts' numbers live in a float data texture
    (eight texels a part, read with texelFetch), not uniforms, so 64 parts fit
    on any WebGL 2 device. `compile(part, relief)` takes a second argument:
    call it as `parts.map((p) => compile(p))`, never `parts.map(compile)`
    (that passes the index as the relief, and the shading blows up).
    Tuning parts: render each group in its own colour in the preview below.
15. **Milo's tabs on a phone** are Today, History, Muscles, Progress; Routines,
    Exercises and Settings are under More (Today starts a routine too).
16. **Any app using `@atlas/body`** must list it in `transpilePackages` and
    `COPY` it in its Dockerfile (Milo and Hygeia do).
    Hygeia's Body is under More on a phone (after Journal in the nav).
17. **Dossier's session audit** (`src/lib/session-audit.test.ts`) requires
    every route to use `route()` or be listed as checking the session itself;
    the Today route is listed there.
18. **Hestia's uploads** go through a Server Action and the proxy (`proxy.ts`),
    so `next.config.ts` raises both of Next's body limits (1 MB and 10 MB by
    default) to 55 MB, for micasa's 50 MB documents. The upload's temporary
    folder uses `/*turbopackIgnore: true*/`, or the build traces the whole
    project. A page file can export only what Next allows: shared bits like
    `Warranty` live in `src/components`.
19. **Hestia's forms** close their dialog through `useSubmit` (the dialog's
    context), so the same form works in "Add", in a record menu's "Edit",
    and inline (the house's first-run form, with no Cancel).
20. **One app reading another's data** goes through the browser, as Today
    does: Hygeia's `/api/atlas/weights` answers with `sharedResponse(request,
    body, ["milo"])` (`@atlas/ui/today/server`), which lets only Milo's
    origin read it. Locally, give each app the other's address
    (`ATLAS_URL_MILO`, `ATLAS_URL_HYGEIA`).
21. **Milo's supersets** are a `superset` ID on the sets of each exercise in
    one (null otherwise); `blocks()` works out each exercise's place in it and
    `runs()` groups them for drawing. A routine item's `superset: true` means
    "with the next"; `supersetIds()` turns that into IDs at the start.
22. **Milo's import** IDs come from the file (`imp-<hash>`), so a second
    import of the same file finds them already there. Strong's export
    doesn't say its units; the preview asks.
23. **Hygeia's files** are in its Postgres, so backups need nothing new; a
    restore brings back the files that existed at the backup. A file added
    after it is gone, though its record may come back from a phone (the
    epoch re-send); opening it says it isn't on the server. Uploads pass
    the proxy, so `next.config.ts` sets `proxyClientMaxBodySize` to 30 MB.
24. **Medication days** are `days` (0 Sunday to 6 Saturday, empty every day).
    `dueOn` decides a day's doses; `activeOn` still means "current". The
    calendar repeats weekly with BYDAY and starts on the first such day.
25. **Lab shades on the body** are `--color-body-labs-in/out` (teal, orange),
    checked as a pair against the figure in both modes; the organ list says
    the same in words. Organs are painted on the skin (the figure has no
    insides), so the kidneys show from the back.
26. **Lint:** `pnpm lint` runs ESLint at the root (`eslint.config.mjs`: Next's
    core-web-vitals and TypeScript rules) over the workspace; Kairos lints
    itself. React's newer rules hold: read the clock with `useNow()`
    (`@atlas/ui/use-now`), not `Date.now()` while rendering; browser values
    (the address) with `useSyncExternalStore`; refs passed to children are
    named `…Ref`; no setState straight inside an effect. Spot photos are a
    plain `<img>` on purpose (Next's optimiser can't sign in).
27. **Hestia's floor plan** is the one thing Hestia stores itself: micasa
    documents must belong to a record (project, appliance…), not the house.
    `HESTIA_PLAN_PATH` (default `hestia-plan.json` beside `MICASA_DB_PATH`),
    written to `.part` then renamed. The backup script copies it as
    `hestia-plan.json` and restores it (`HESTIA_PLAN`). Things that aren't
    appliances remember the upkeep added for them (`maintenanceIds`).
28. **`useCssColors`** moved to `@atlas/ui/css-colors` (Hestia's plan uses it
    without the body package). The plan's colours are `--color-plan-*`,
    checked as a set against the floor in both modes.
29. **Records a device makes up by itself** (Tyche's bills from recurring
    items, its starting categories) go through `Device.seed`, never `put`:
    saved only if absent (a deleted one counts as present), with
    `updatedAt` 1 (`SEEDED`), so any real change anywhere wins. Their IDs
    must come from what they are (`o-<item>-<date>`, `c-groceries`). An
    occurrence still at `SEEDED` is untouched, so `followItem` may change or
    remove it when its item changes; anything else it leaves alone.
30. **Per-device conveniences don't go in synced settings.** A fresh phone
    saving the settings record (even to remember one field) writes its
    defaults over what another device chose. Tyche keeps "the last account
    used" in localStorage (`rememberAccount`, wrapped in try/catch).
31. **Tyche's money** is integer cents; rates are pesos per dollar in cents
    of a peso. Totals convert each amount at its own day's rate; anything
    without a rate is counted in `missing`, and screens say so.
32. **Several dev servers of one app** need their own build folders:
    `TYCHE_DIST_DIR=.next-<x>` (lint ignores `.next-*`). `next dev` adds each
    folder to `tsconfig.json`'s `include` and writes `AGENTS.md` into the
    app (now git-ignored): put tsconfig back before committing.
33. **Icons by name** (Tyche's categories): draw them with `CategoryIcon`
    (`createElement`), not `const Icon = iconFor(name)` in render, which the
    React lint rule `static-components` refuses.
34. **Tyche's balances take the investment values** as a last argument
    (`accountBalance`, `totalBalance`, `dailyBalances`, `overview`, or
    `balanceBook` for many questions): pass `useValuations()` wherever a
    balance is shown, or investment accounts show only what went in and out.
    Tyche's Dexie is on version 2 (valuations, holdings).
35. **Tyche's server tests** (reading IOL against a stand-in IOL) need
    `ATLAS_TEST_POSTGRES`, like the sync engine's; without it they're
    skipped. IOL's field names come from its docs and other clients, never
    a real account: check them once the user's API access is on.
36. **Soft parts** (`soft: true`; Hygeia's places) are painted as warmth,
    not filled: full at the core of the part's own skin, gone at its edge.
    Both come from `fitted()` (in `BodyView`), which measures the skin each
    part owns on the figure, because a volume's centre is inside the body
    and a neighbour often takes the skin before the volume ends. Where soft
    parts overlap they share the skin by nearness (`SOFT_SHARE`), so tapping
    still goes through `partAt`, unchanged. The warmth is mixed by square
    roots, not in linear light, or a pale shade on the dark figure ends
    abruptly. The picked soft part has no ring: it gets a hairline where its
    share of the skin is half, drawn from screen-space derivatives, so
    anything it's made from must change over many pixels (a steep step
    gives a serrated line). Muscles and organs aren't soft and are drawn as
    before; a test checks `fitted` hands them back untouched. To look at
    it: Hygeia on a test Postgres, symptoms through `POST /api/sync`
    (`{kind: "symptom", record: {id, updatedAt, deleted, area, kind,
    severity, at, note}}`), then `/body` and `/body?a=<place>`.

37. **Chinese text** has no font in the kit (Geist and Newsreader have no
    Han). Use Clio's `font-zh` (running text) or `font-zh-serif` (titles),
    system fonts only (Noto SC, PingFang, YaHei…), and put `lang="zh-Hans"`
    on the element. `font-zh-serif` is emitted once a class uses it (gotcha 1).
38. **Clio's tabs** are Today, Library, Review, Words and Settings: five, so
    the phone has no More. The Review tab shows the words due (`counts`).
    Clio has no chart colours yet; use Meter's `success` tone, or add a
    checked pair (gotcha 2) before using `chart`.
39. **Clio's Dexie** is on version 1; `word` is indexed on `card.due`
    (words without a card aren't in that index, so it lists words in
    review only).
40. **Clio's word data offline:** `/data/hsk.json` and `/data/dictionary.json`
    are cached by the shared service worker in a cache called `atlas-data`,
    not named by build. It answers from that copy at once and asks the
    server behind it (`cache: "no-cache"`, so an unchanged file costs a
    short 304 answer; Next sends a weak ETag), keeping the new file when the
    ETag differs: a new build's data replaces the old one on the next open.
    The HSK list is fetched at install (`serviceWorkerRouteFor({ precache })`
    in `app/sw.js/route.ts`); the 9 MB dictionary only the first time
    something asks for it (the Words screen's Download button, or a reader
    tap), so the first open never waits on it. Screens get both through
    `src/lib/local/data.ts`: `useHsk()`, `useDictionary(enabled = true)`,
    `getHsk()`, `getDictionary()`, and `useHskState()` /
    `useDictionaryState()` for the error. Pass `useDictionary(false)` to use
    the dictionary only if something else already loaded it. The cache only
    exists in a production build (the worker registers there only), so in
    `next dev` the dictionary says "Loaded for now".
41. **Clio's reader performance:** a text is a few hundred buttons. Taps
    are handled once on the text (`data-s`/`data-k`), each sentence is a
    memoised `SentenceView` whose `marks` prop is its tokens' statuses as
    one letter each, so changing a word re-draws only the sentences that
    hold it. Keep props to sentences stable (no new objects or closures per
    render). The progress bar is moved through a ref, not state.
42. **Clio's sheets** (`components/reader/sheet.tsx`): Radix Dialog from the
    bottom on a phone, Radix Popover (modal, anchored to the word through
    `virtualRef`) on a desktop with a mouse; both hand focus back to the
    word (`onCloseAutoFocus`). The text size is per device (localStorage,
    `useTextSize`); pinyin and "show the English" are synced settings.
    Ruby pinyin sits over whole words, so a long reading spreads its
    characters a little: that's expected.

## 6. Working in this cloud container (it's ephemeral)

Nothing here survives a restart: re-create the tools below. `$S` is the
scratchpad your system prompt gives you.

- **pnpm:**
  `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack enable --install-directory $S/bin && export PATH=$S/bin:$PATH`.
  The repo pins `pnpm@12.16.1`.
- **Yarn for Kairos:** `repo.yarnpkg.com` doesn't resolve here; corepack takes
  Yarn from npm instead with `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`.
  Then in `apps/kairos`: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 yarn install --immutable`
  and `yarn prisma generate`.
- **Node 24 for Kairos:** Dossier needs it (`crypto.argon2`); on Node 22,
  ~36 test files fail. It's at `/opt/node24/bin`: `export PATH=/opt/node24/bin:$PATH`.
- **Docker:** start the daemon with `(nohup dockerd > $S/dockerd.log 2>&1 &)`.
  Docker Hub rate-limits: pull from `mirror.gcr.io/library/<image>` (or
  `mirror.gcr.io/<owner>/<image>`) and re-tag. `tailscale/tailscale:v1.104.4`
  and `headscale/headscale:0.27.1` both come through the mirror.
- **Image builds:** no OS packages can be installed in a build here (Alpine's
  and Debian's mirrors are blocked by the sandbox's proxy). So the backup
  image (apk) and Kairos's image (apt, for Chromium) **can't be built here**.
  The Node-only images can, with the TLS workaround: a scratch copy of the
  Dockerfile with these lines after `FROM node:22-alpine AS base`, built with
  `--build-context ca=/root/.ccr`, never committed:
  ```
  COPY --from=ca ca-bundle.crt /etc/ssl/certs/sandbox-proxy.crt
  ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/sandbox-proxy.crt
  ```
  ghcr.io layer downloads are blocked too; for Hestia's image, stand in a local
  micasa with `--build-context ghcr.io/micasa-dev/micasa:2.8.2=<dir with bin/micasa>`.
- **micasa binary:** clone `https://github.com/micasa-dev/micasa`, tag
  `v2.8.2`, then
  `CGO_ENABLED=0 GOTOOLCHAIN=auto go build -ldflags "-X main.version=2.8.2" -o $S/bin/micasa ./cmd/micasa`.
  Sample data: `micasa demo --seed-only demo.db` (random each time).
- **Test Postgres:**
  `docker run -d --name atlas-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:18-alpine`.
- **All the Atlas tests** (186: ui 14, body 21, sync 10, Hestia 25, Milo 43,
  Hygeia 28, Tyche 45, plus Clio's, still growing in 7a; Tyche's 3 IOL
  tests need ATLAS_TEST_POSTGRES):
  ```
  MICASA_BIN=$S/bin/micasa ATLAS_TEST_POSTGRES=postgres://postgres:test@127.0.0.1:55432/postgres pnpm test
  ```
  Lint: `pnpm lint`, expecting nothing. Builds: `cd apps/<app> && pnpm build`, expecting 0 warnings. Types:
  `pnpm exec tsc --noEmit` in each package or app.
- **Kairos's tests** (1,803 passing, 31 skipped, with the patch), on Node 24,
  with a database of their own:
  ```
  TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/kairos_test DATABASE_URL=$TEST_DATABASE_URL yarn vitest run
  ```
  `yarn typecheck` and `yarn build` too. Sample data:
  `yarn prisma migrate deploy && yarn prisma db seed -- --demo`. A password
  hash: `yarn tsx -e "import { hashPassword } from './src/lib/auth/password-hash.ts'; hashPassword('x').then(console.log)"`.
- **Running everything for a browser test:** each app with `pnpm start --port 31xx`
  (Kairos: `yarn start`), all with `ATLAS_OWNER`, `ATLAS_APPS`, `TZ` and
  `ATLAS_URL_<APP>=http://localhost:31xx` for every app (so Today knows where
  to ask and CORS allows the launcher). The Atlas apps can take
  `ATLAS_AUTH=off`; Kairos has no such switch, so add the header in
  Playwright: `context.route("http://localhost:3101/**", r => r.continue({ headers: { ...r.request().headers(), "tailscale-user-login": "<owner>" } }))`.
  Seed Milo and Hygeia with `POST /api/sync` `{cursor:"0", changes:[{kind, record}]}`
  (records as in each app's `src/lib/model.ts`). Emulate `devices['iPhone 15']`
  for phones; screenshots the user sees at `deviceScaleFactor: 2`. Stop servers
  with `kill $(ps aux | grep next-server | grep -v grep | awk '{print $2}')`,
  never a `pkill -f` pattern that's in your own command line.
- **Rebuilding the figure** (only if the mesh or its targets should change):
  see `packages/body/scripts/build-figures.py`. The sparse clone it describes
  works here; in a `--filter=blob:none` clone, never run `git ls-tree -l`
  (it downloads every file one by one).
- **Previewing the 3D body** without building an app: bundle a small entry
  that renders `<BodyView>` with esbuild from Kairos's install
  (`apps/kairos/node_modules/esbuild/lib/main.js`, `nodePaths` set to
  `packages/body/node_modules`), serve it, and screenshot it with Playwright;
  Chromium draws WebGL headless (SwiftShader). Playwright has
  `devices["Pixel 8"]`. A tap test: `page.touchscreen.tap` on the canvas, then
  check `?m=` in the address.
- **After a container restart** Docker isn't running and `atlas-pg` is
  stopped: start `dockerd` again, then `docker start atlas-pg`. The
  scratchpad (tools, micasa) survives.
- **Testing the backup script** without its image: this machine has GnuPG and
  Postgres 16's client tools but no sqlite3. Run a `postgres:16-alpine`
  container, give the script `BACKUPS`, `HESTIA_DB`, `ENV_FILE`, `PGHOST`,
  `PGPORT` and `POSTGRES_PASSWORD`, and put a stand-in `sqlite3` first on the
  PATH: a few lines of Python's `sqlite3` module doing the script's two calls
  (`-cmd ".timeout N" DB ".backup 'PATH'"` and `DB "pragma integrity_check"`).
- **Testing Tailscale itself** with Headscale: `headscale serve` in a container
  on a Docker network, `server_url: http://headscale:8080`, embedded DERP on
  (clients can't use it over plain HTTP, but connect directly on the same
  network), a policy with `tagOwners: {"tag:atlas": ["jane@"]}`. Then
  `headscale users create jane@` and tagged/untagged `preauthkeys`. Sidecars
  join with `TS_EXTRA_ARGS="--advertise-tags=tag:atlas --login-server=http://headscale:8080"`.
  Headscale issues no certificates, so test Serve on HTTP port 80 with an
  explicit host key (`"milo.tail.test:80"`). From a second node, make requests
  through `TS_OUTBOUND_HTTP_PROXY_LISTEN=127.0.0.1:1056` with
  `http_proxy=http://127.0.0.1:1056 wget -qO- --header 'Tailscale-User-Login: x' http://...`.
- **Commits** end with the attribution lines your system prompt gives. Never
  put model IDs in commits or code.

## 7. What's next

Open work the user is waiting on, or that waits on the user, is tracked as
issues: https://github.com/bengubkien/atlas/issues. Look there first, and
close an issue when its work lands. So far: Milo's softer muscle map (#1),
Tyche's statement import (#2), IOL live (#3), DolarApi live (#4).

### Help the user set up (recommended first)
Walk them through deploy/SETUP.md on the Windows desktop. Things to watch:
the first `docker compose up -d --build` now builds Kairos (Chromium inside);
`ATLAS_BACKUP_PASSPHRASE` is required; `ATLAS_BACKUP_DIR` should be another
disk or a synced folder.

### Phase 4: Hygeia's lab reader
The design is in PLAN.md, "AI".
- **Pipeline:** upload a PDF or photo; a PDF with text is read directly, a
  photo or scan goes to a vision model; a model lists the results (test, value,
  unit, range); the user checks them in the existing report editor
  (`apps/hygeia/src/app/labs/page.tsx`, `ReportEditor`), which should accept
  prefilled rows. Nothing saves without review.
- **Queue:** jobs wait until the model can be reached, so uploading works with
  the desktop off. That needs server-side file storage, which Hygeia doesn't
  have yet (and the backup service would then need to include it).
- **Model:** local Ollama on the GTX 1080 by default; candidates `qwen3-vl:8b`,
  `gemma4:e4b`, `minicpm-v`, compared on their real reports. Untestable here.
- **After the mini PC:** keep Ollama on the desktop and reach it over
  Tailscale; the sidecars are userspace, so outbound tailnet access needs
  `TS_OUTBOUND_HTTP_PROXY_LISTEN` (tested working above).

### 3D, next (agreed with the user; PLAN.md has the ideas)
- **A room scan for Hestia's floor plan:** the user's girlfriend has an
  iPhone 17 Pro Max (LiDAR). Apple's RoomPlan exports USDZ (walls, doors,
  windows, objects by category); check whether the three.js version in use
  can read RoomPlan's USDZ (it's USDC inside) before promising it, else
  convert at import. Either way the scan becomes the plan's own shape
  (`src/lib/plan.ts`: rectangular rooms, typed items), for the editor to fix.

### Tyche, next (PLAN.md has the steps)
- **6b:** Analytics; ask the user whether to track card purchases in
  installments (*cuotas*), and whether MEP is the right default rate.
- **6c, statement import:** Mercado Pago, Naranja X (account and Frasco)
  and BBVA (account and card). Waiting for one sample export of each from
  the user. Follow Milo's import (preview, IDs from the file);
  `lib/export.ts`'s `text()` shows the spreadsheet-formula guard; card
  lines "Cuota 3/6" should match the purchase's occurrence
  (`o-<item>-<date>`), not add a new charge.
- **IOL live:** once the user has API access and the login in `.env`,
  check Settings' IOL panel and the two IOL accounts against IOL's site.
- **6d, receipts:** with Hygeia's lab reader, as one `@atlas/reader`.
- **Check DolarApi live** once the stack runs: the field names
  (`casa`, `venta`, `fechaActualizacion`) were never fetched from here.

### Clio, next (PLAN.md has the steps)
- **The reader and library** (built in 7a): `/library` (cards, newest
  first, coverage "94% known · 6 new words", filters by kind and state),
  `/read?t=<id>` (in `PAGES`), Today's "Read next" (`nextText`: the text
  you're in, else the unread one nearest 95% coverage within 90–98%).
  Decisions in section 4 ("Clio's reader rules", "samples are versioned
  seeds"). For **7b**: the quiz goes in `<AfterReading text result />`
  (`components/reader/after-reading.tsx`, the `data-slot="quiz"` block),
  from `text.questions`, saving `reading.quiz`. For **7d**: audio is behind
  `useSpeech(rate)` (`components/reader/use-speech.ts`: `available`,
  `speaking` (a sentence ID), `play(items)`, `stop()`), now the browser's
  `speechSynthesis` with a zh-CN voice (hidden when there's none); swap the
  source for `text.audio` there and add word highlighting from its
  timings. Listen buttons: the whole text in the reader's bar (from where
  you are), each sentence beside its English, a word in its sheet.
  Not done: arrow-key movement between words (each word is a tab stop),
  a paragraph break in long stories (the model has none; sentences flow
  as one paragraph per dialogue turn or story). The reader's word sheet (`Lookup`) is the quick view (the
  text's glossary and the three actions, one tap each); its "More about
  this word" opens Words' `WordDetail` for the rest (every reading, the
  characters, Forget), so the full view lives in one place.
- **The Words screen** (`/words`, built in 7a): search on top (debounced,
  `Dictionary.search`, or `searchHsk` over the HSK list until the dictionary
  is on the phone), progress per band (`bandProgress`), Your words
  (Learning, Known, Ignored) and Browse a band (a check per word, or Select
  for many). The pure parts are in `src/app/words/lists.ts` with tests.
  `WordDetail` (`src/components/word-detail.tsx`, props `{ word, onClose }`)
  is the sheet or dialog for one word: the reader can reuse it. It starts
  the dictionary only if it's already on the phone. `saveWords` and
  `forgetWords` in `actions.ts` change many words in one save. Known only
  lists words with a record: bands you assume known have none, which the
  screen says. Not done: auto-downloading the dictionary at install, and
  `ts-fsrs` cards (a word set to Learning has no card until 7b).
- **7b:** add `ts-fsrs`, review cards, the quiz after a text, the streak.
- **7c / 7d:** need a Claude API key and an Azure Speech key in `.env`
  (server only); ask the user when the time comes.

### Smaller to-dos
- **Possible upstream report to micasa:** concurrent CLI commands collide
  because every command rebuilds the FTS index. Nothing has been filed.

## 8. Verified, and never verified

Verified here in phase 5:
- Tailscale 1.104.4 sidecars on a private control server (Headscale): the
  userspace bypass to 127.0.0.1, its fix on 127.0.0.2, Serve proxying to
  127.0.0.2 and replacing a forged `Tailscale-User-Login` with the real one,
  `X-Forwarded-Host` set.
- The launcher's Today in Chromium (desktop and iPhone 15, light and dark)
  with all five apps running, Kairos signed in by the header, CORS working.
- The backup script end to end (back up, list, wrong passphrase, show-env,
  restore refused while apps are connected, restore with Hestia's house
  identical, the sequence bump, pruning, the schedule, stopping promptly).
- The launcher's Docker image healthy on 127.0.0.2.

Verified after phase 5, in Chromium as a Pixel 8 and on desktop: the muscle
map on the realistic male and female figures in both themes, a tap on the body picking a muscle, starting a workout from
it, Today's "rested longest", and the screen offline; Milo's Docker image
built with `packages/body` and healthy. Then Hygeia's body map, the same
way: a tap on the knee and on a buttock picking that place, logging a
symptom and the map and list updating, picking from the list turning the
figure, the form starting from each place's own latest entry, the female
figure in dark mode, desktop, and the screen offline; Hygeia's Docker image
built with `packages/body` and healthy.

Verified for Tyche's 6a (6 Nov 2026), on the production build with the demo
month (`scripts/demo.mjs`): every screen in Chromium at desktop width and as
a Pixel 8, light and dark, set beside the reference; opening it offline in a
fresh tab, adding an expense offline, and another device getting it once
back online; seeding (bills made on the device, autopay ones cleared, a paid
bill never overwritten by another device's seed: a sync test); Today through
the launcher; Tyche's Docker image healthy on 127.0.0.2, with the rates job
logging once when DolarApi can't be reached. All five apps build clean.

Never verified:
- Real Tailscale: HTTPS certificates, MagicDNS names, the `tag:atlas` ACL,
  phones over it.
- Docker Desktop on Windows, the setup guide's PowerShell commands, and a
  Windows folder as `ATLAS_BACKUP_DIR`.
- The Kairos image built from `apps/kairos` and the backup image (neither can
  be built here; see section 6). Dossier's Dockerfile is unchanged upstream.
- A real phone (theirs is a Pixel 8): install from Chrome, the service worker,
  wake lock, the rest timer's beep, the calendar subscription, and how the 3D
  body draws and turns on its GPU.
- The real `ghcr.io/micasa-dev/micasa:2.8.2` image inside Hestia's build.
- Ollama on the GTX 1080.
- DolarApi live (blocked here): the quote fields Tyche reads, and that the
  sidecar's network reaches it.
