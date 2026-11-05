# Handoff: continuing Atlas

For the next agent picking up this work. Read this first, then `PLAN.md`
(design and phases), `README.md` (developing), `deploy/SETUP.md` (the user's
install guide) and `apps/kairos/ATLAS.md` (Kairos's patch). Everything below
was true at the end of phase 5 (4 Nov 2026).

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
| 5 | Kairos patch, "Today" on Atlas, backup service, two security fixes | Done |

**Nothing has run on the user's machine yet, on purpose:** they'll set up
once their mini PC arrives, not on the desktop. Until then, build what doesn't
need their hardware. SETUP.md is written for Windows (PowerShell); the mini
PC will probably run Linux, so check which OS it has and adapt the commands
when the time comes. Phase 4 needs Ollama on the desktop's GTX 1080 and some
of their real lab reports, so it waits too.

After phase 5 the user asked for 3D with real purpose (PLAN.md, "3D, where
place matters"). Built so far: **Milo's muscle map** and **Hygeia's body
map**, on a shared 3D body (`packages/body`). Agreed next: **Hestia's
apartment**, from an iPhone room scan or a floor plan drawn in Hestia.

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
  src/parts.ts         the muscles: musclesFor(joints) → volumes + facing; compile, reach, partAt (the rule the shader paints with)
  src/areas.ts         Hygeia's 28 places: areasFor(joints), AREAS, areaName, areaFacing; drawn flat (relief 0)
  src/body-material.ts three's standard material plus the shader: parts' shades, a muscle's belly and fibres, the mesh's creases, the picked group's ring; part data in a float texture (MAX_PARTS 64)
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
apps/milo/        gym, client-rendered from the device's copy; src/lib/today.ts
  src/lib/muscles.ts   the muscle map's numbers: standings (7 calendar days, last trained), steps, exercisesFor, planFor, balanceNotes, restedLongest
  src/app/muscles/     the Muscles screen (?m=<muscle> picks one)
  src/lib/import.ts    Strong and Hevy CSV: parseCsv, planImport (matching, guessed muscles, stable IDs), importChanges
  src/lib/bodyweight.ts, bodyweight-hook.ts  Hygeia's weights: weightAt, strengthForWeight; fetched by the browser, kept in localStorage
  src/lib/links.tsx    the other apps' addresses for client screens (from the shell's links)
  src/app/history/edit-workout.tsx  editing a finished workout (?w=<id>&edit=1); ExerciseBlock/SetRow take `editing`
apps/hygeia/      health, client-rendered from the device's copy; src/lib/today.ts; calendar.ics
  src/lib/body.ts      the body map's numbers: places (distinct days in the last 30, latest, worst), DAY_STEPS, describe, recent
  src/lib/server/files.ts  attached files in Postgres (`files` table, made on first use) + the synced `attachment` record
  src/app/api/files/   POST uploads (25 MB, type sniffed from the bytes); /[id] GET serves, DELETE removes
  src/components/attachments.tsx  a record's files: attach, open, delete (appointments ?a=, lab reports ?r=)
  src/app/api/atlas/weights/  body weights for Milo (sharedResponse, Milo's origin only)
  src/app/body/        the Body screen (?a=<place> picks one); symptoms are the synced `symptom` kind
  (each of the four: src/app/api/atlas/today/route.ts)
deploy/           compose.yml, .env.example, tailscale/serve.json, postgres/databases.sql, SETUP.md
  backup/              Dockerfile (postgres:18-alpine + gnupg, sqlite, tzdata) and atlas-backup.sh
```

App ports in development: atlas 3000, hestia 3001, milo 3002, hygeia 3004.

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
   Hygeia on 3 (2 added `symptom`, 3 `attachment`). Raise it when the stores or
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
- **All the Atlas tests** (126: ui 14, body 15, sync 9, Hestia 21, Milo 41,
  Hygeia 26):
  ```
  MICASA_BIN=$S/bin/micasa ATLAS_TEST_POSTGRES=postgres://postgres:test@127.0.0.1:55432/postgres pnpm test
  ```
  Builds: `cd apps/<app> && pnpm build`, expecting 0 warnings. Types:
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
- **Hygeia's body map, more:** organs for lab results, skin spots
  photographed over time (needs file storage, as phase 4 does), and a sore
  place warning Milo's exercises that load it.
- **Hestia's apartment:** the user's girlfriend has an iPhone 17 Pro Max
  (LiDAR), so the model can come from a room scan: Apple's RoomPlan exports
  USDZ (walls, doors, windows, objects by category); check whether the
  three.js version in use can read RoomPlan's USDZ (it's USDC inside) before
  promising it, else convert at import. A small editor in Hestia fixes what
  the scan missed, or draws a floor plan without a scan. Shown in 3D; tapping an object
  offers its maintenance (add "Clean the fridge" with a usual schedule, log
  it), warranty and documents; tints by overdue; issue pins; shut-offs.
  Storing the plan: try a micasa document attached to the house (check that
  `micasa`'s CLI can add and replace documents) before giving Hestia a store
  of its own, which would also need adding to the backups.

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
