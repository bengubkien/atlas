# Atlas: the plan

Atlas is a private suite of web apps for one person, self-hosted, that look and
work as one product, the way Google's apps do: the same design, one switcher
between them, and no separate sign-ins.

| App | What it does | Built from | Address |
|---|---|---|---|
| **Atlas** | The launcher: what needs you today, and every app | New | `https://atlas.<tailnet>.ts.net` |
| **Kairos** | Job search: profile, tailored resumes and letters, applications | A fork of [Dossier](https://github.com/AienTech/dossier) | `https://kairos.<tailnet>.ts.net` |
| **Hestia** | House: maintenance schedules, projects, quotes, vendors, appliances | New web front end on [micasa](https://github.com/micasa-dev/micasa)'s engine | `https://hestia.<tailnet>.ts.net` |
| **Milo** | Gym: routines, workout logging, records, progress | New | `https://milo.<tailnet>.ts.net` |
| **Hygeia** | Health: body metrics, medications, journal, appointments, lab results | New | `https://hygeia.<tailnet>.ts.net` |

The names: Atlas holds up the sky; Kairos is the god of the opportune moment;
Hestia keeps the hearth; Milo of Croton grew strong by carrying a calf every
day as it grew into a bull; Hygeia is the goddess of health.

## Decisions

### Hosting: your desktop now, a mini PC later

Everything runs in one Docker Compose stack (`deploy/compose.yml`), in Docker
Desktop on Windows for now; `deploy/SETUP.md` is written for it. Moving to
the mini PC means copying the `deploy` folder and its data volumes and starting
it there. The addresses don't change, because each app is its own device on
your tailnet (below), and that device's identity moves with its data.

The desktop isn't always on, and that shapes three things:

- **Milo works offline.** Workouts are saved on the phone first and sent to the
  server when it's reachable, so a workout is never lost because the desktop is
  asleep. Records are given IDs on the phone, so sending one twice is harmless.
- **Hygeia's reminders live on the phone.** Until the mini PC, medication and
  appointment reminders come as a calendar feed that the phone subscribes to:
  the phone keeps the events and rings even while the server is off. Push
  notifications from the server can come once it's always on.
- **Scheduled jobs run when the machine is on.** Kairos's nightly backup (03:00
  in `TZ`) and its daily job agent only run while the desktop is awake. Atlas's
  own backup job copies every app's data together (below).

### Network and sign-in: Tailscale only

Nothing is exposed to the internet. Each app has a small Tailscale container
beside it (a "sidecar") that joins your tailnet under the app's name and serves
it over HTTPS with Tailscale Serve, which gets the certificates by itself. You
reach the apps from your laptop and phone with the Tailscale app on.

Your tailnet is the lock, so there's no separate sign-in service. Tailscale
Serve tells each app who is asking (the `Tailscale-User-Login` header, which
it sets itself, replacing any a client sends); every app, Kairos included,
lets in only you (`ATLAS_OWNER`), and needs no login screen at all.

Two things keep that header honest:

- **Serve is the only way in.** The sidecars run Tailscale in userspace, which
  hands any tailnet connection to a port other than Serve's to the same port
  on 127.0.0.1. An app listening there could be reached directly, past Serve,
  with a header made up by the sender. So the apps listen on 127.0.0.2, where
  only Serve goes. (Tested with Tailscale 1.104.4 on a private control
  server: on 127.0.0.1 a made-up login got through; on 127.0.0.2 it's
  refused.)
- **Changes only from the app's own pages.** Tailscale adds the header to
  every request from your devices, whichever website made it, so a website
  you visit could otherwise send a change to an app as you. Each app refuses
  a POST (or any other change) that the browser says came from another site,
  as Next.js already does for Server Actions.

### Phones

The design kit gets a phone layout that Dossier doesn't have: below 1024px the
sidebar becomes a bottom tab bar, and the app switcher opens as a sheet. Every
Atlas app can be installed to the home screen (a PWA). Milo and Hygeia are
designed phone-first.

Kairos stays a desktop app: Dossier is made for desktop browsers, and making it
work on a phone would mean a large fork that clashes with every update. On a
phone it opens, but isn't designed for it.

### AI

One choice of AI provider for the suite, as in Dossier: a local model through
Ollama on your desktop's GTX 1080, or a hosted one. For Hygeia's lab reports,
the local model is the default so health data stays on your machine; a hosted
one only if you turn it on.

**The card.** Its 8 GB holds models of about 8 billion parameters, including
vision models that read documents. It works through Ollama's CUDA 12 build
with NVIDIA's 580-series driver, the last series for GeForce 10 cards
(`deploy/SETUP.md` has the steps). Newer CUDA versions have dropped the card,
so it won't be supported forever.

**Reading a lab report:** upload a PDF or a phone photo → a PDF with text in it
is read directly, with no vision model; a photo or scan is read by a vision
model → a model lists each result (test, value, unit, reference range,
high/low) → you check and correct the list → only then is it saved. Nothing is
saved without your review.

Reports wait in a queue until the model can be reached, so uploading works
even while the desktop is off, and they're read when it's back. Phase 4 starts
by trying candidate vision models (Qwen3-VL 8B, Gemma 4 E4B, MiniCPM-V) on a
few of your real reports and keeps the one that gets the numbers and units
right.

**After the move to the mini PC** the card stays in the desktop. Three ways on,
to decide when you buy it:

1. **Keep Ollama on the desktop** (recommended). Hygeia on the mini PC sends
   reports to it over Tailscale, and the queue holds them while the desktop is
   off. Nothing to buy; reading waits for the desktop, which is fine for
   something as occasional as lab reports.
2. **A mini PC that can run a vision model itself**, which costs more.
3. **A hosted model**, turned on explicitly for lab reports.

### Stack

The same as Dossier, so there's one stack to learn and maintain: Next.js 16,
React 19, Tailwind CSS 4, Radix UI, lucide icons, Prisma 7 and PostgreSQL 18,
in a pnpm workspace. One Postgres server holds a database per app (`kairos`,
`milo`, `hygeia`). Hestia keeps micasa's SQLite file, through micasa's own
command line.

### License

The design kit is taken from Dossier's code, which is AGPL-3.0, so Atlas is
AGPL-3.0 too. For a private, single-user install that asks nothing of you.
micasa (Apache-2.0) is used as a program, not copied.

## Repository layout

```
atlas/
├── PLAN.md               this file
├── packages/
│   ├── ui/               @atlas/ui: the design kit (tokens, fonts, components, charts, shell, switcher)
│   ├── sync/             @atlas/sync: offline-first sync, shared by Milo and Hygeia
│   └── body/             @atlas/body: the 3D body you can tap, for Milo (and later Hygeia)
├── apps/
│   ├── atlas/            the launcher
│   ├── kairos/           Dossier, as a git subtree, plus a small patch    (phase 5; ATLAS.md)
│   ├── hestia/           house, on micasa                                 (phase 1)
│   ├── milo/             gym, offline-first                               (phase 2)
│   └── hygeia/           health, offline-first                            (phases 3–4)
└── deploy/
    ├── compose.yml       the whole stack
    ├── .env.example
    ├── tailscale/        the Serve config every app's sidecar uses
    ├── postgres/         the databases made on the first start
    ├── backup/           the backup service
    └── SETUP.md          from a fresh machine to the apps on your phone
```

## The design kit (`@atlas/ui`)

Taken from Dossier so every app looks like it by construction, not by copying:

- **Tokens:** Dossier's colour, type, radius and shadow tokens (light and dark,
  every text colour at WCAG AA), as Tailwind 4 theme variables.
- **Fonts:** Geist for text, Newsreader for titles, IBM Plex Mono for figures,
  shipped with the app (nothing fetched from a font CDN).
- **Components:** button, card, field, input, textarea, select, checkbox,
  toggle, chip, tabs, segmented control, stepper, dropdown menu, confirm
  dialog, status dot, progress steps.
- **Shell:** the sidebar (collapsible, as in Dossier), the bottom tab bar on
  phones, the page header, the light/dark switch.
- **New for Atlas:** the app switcher and the list of apps it reads
  (`packages/ui/src/apps.ts`: name, tagline, icon, accent colour, address).
  Each app has one accent colour, used only on its mark and the switcher, the
  way Google's apps share a design but keep their own colours. Adding an app is
  one entry.

## The apps

### Atlas (launcher) — Today built in phase 5

**Today**, then the grid of apps. Each app answers `GET /api/atlas/today` with a
sentence and up to five items (`packages/ui/src/today.ts` has the shape), and
the launcher shows the answers side by side, each item linking into its app:

- **Kairos:** Dossier's own "Worth a look": interviews today or tomorrow
  first, offers, drafts against their deadlines, follow-ups after a quiet week.
- **Hestia:** what's overdue, urgent issues, what's due in the coming week,
  other open issues.
- **Milo:** a workout going on, today's finished ones, or else when the last
  one was, and the week's count.
- **Hygeia:** today's doses not yet taken (late ones first), appointments today
  and tomorrow, and how many doses were taken.

Your browser asks each app itself, at its own address, so Tailscale tells each
one it's you, exactly as when you open it; the apps let only Atlas's address
read the answer (CORS). Atlas's server never calls the other apps, which keeps
the sidecars simple. An app that's stopped shows "Couldn't reach it" in its own
card, and the rest still load. Milo and Hygeia answer from what the phones have
synced. Coming back to the page after a minute asks again.

### Kairos (Dossier) — phase 5, built

Dossier v1.11.0 in `apps/kairos` as a git subtree, with a patch kept as small
as possible so updates stay easy (`apps/kairos/ATLAS.md` lists every file):

1. The name and mark in the sidebar and the browser tab (not the ~190 other
   mentions; those name the project it's built on).
2. The app switcher in the sidebar header.
3. Signing in with Tailscale's header instead of a password, when
   `ATLAS_OWNER` is set; Dossier's password stays for when it isn't.
4. Its answer to Atlas's Today.
5. Printing PDFs from 127.0.0.2, where it listens.

The stack builds it with Dossier's own Dockerfile. It keeps Yarn and Node.js
24, outside the pnpm workspace. Its own tests (1,800-odd) pass with the patch,
which adds its own.

Updating: `git subtree pull --prefix apps/kairos https://github.com/AienTech/dossier <tag> --squash`,
then `yarn install`, `yarn typecheck`, `yarn test` there, and rebuild.

### Hestia (micasa) — phase 1, built

A web front end on micasa 2.8.2, pinned in Hestia's image (it copies the
program from micasa's own release image). Hestia keeps no data of its own:

- **Reads:** one `micasa show all --json` per page (every record, about 90 ms),
  plus `micasa status --json` on the overview, so "overdue" means exactly what
  micasa means by it.
- **Writes:** `micasa db <entity> add|edit --data …`, through micasa's own
  validation; its messages ("serviced at: invalid date value") reach the form.
- **Contract tests** (`apps/hestia/src/lib/micasa/micasa.test.ts`) run the real
  program on its sample house and check every shape Hestia relies on, that
  `show all` matches each `db <entity> list`, and that next-due dates match
  micasa's own, so an update can't break Hestia quietly.

Two things learned building it:

- Every micasa command applies its schema and rebuilds its search index when
  it opens the database, so two at once collide. Hestia runs them one at a time.
- micasa has no command to create a database; starting its terminal app does
  it. Hestia does that once, on its first start, and checks the result.

Screens, on desktop and phone:

- **Overview:** overdue and coming-up maintenance with a "Log" button each, open
  issues, active projects; a prompt to set up the house on a fresh install.
- **Maintenance:** grouped by overdue, due soon, later, never logged and no
  schedule; each item's page with its details and service history; "Log
  service" (date, cost, who did it, notes; a new vendor is added by name) and
  "Add item".
- **Projects:** a board by status, each project's page with its quotes side by
  side against the budget, the status changed in place, "New project".
- **Incidents:** open issues by urgency, "Fixing it" and "Fixed", "Report an issue".
- **Appliances** with their warranties, **vendors** with call, email and
  website buttons, **your house** (set up and edit its basics).

Still to do in Hestia: adding quotes; editing and deleting maintenance items,
projects, incidents, appliances and vendors; the house's systems and costs;
documents (micasa stores them; Hestia doesn't show them yet).

If running the program per request is ever too slow, the next step is a small
Go API inside a micasa fork. Hestia never writes micasa's database directly.

### Milo (gym) — phase 2, built

Milo works without the server. Your phone keeps its own copy of everything
(the browser's IndexedDB, through Dexie) and every screen reads from it, so
the desktop being off changes nothing at the gym:

The engine is shared with Hygeia, in `packages/sync` (`@atlas/sync`):

- **Offline copy:** a service worker (served at `/sw.js`) keeps every
  screen's page and scripts; the app opens with no connection at all.
- **Sync:** every change is saved on the device and queued; the device sends
  the queue to `POST /api/sync` and gets back what changed elsewhere since its
  last sync. It syncs on opening, when the connection returns, every 30 seconds
  on screen and a moment after each change, and gives up quickly when the
  server doesn't answer. If two devices change the same record, the later
  change wins (fine for one person); deletions sync as changes too.
- **Server:** one Postgres table of records with a number that rises on every
  change, so a device asks for "everything after N". Plain `pg`, not Prisma:
  for one table and three queries it's simpler, and there's nothing to generate
  at build time. Records are checked against the same schemas as on the phone.

Screens, phone-first:

- **Today:** start an empty workout or a routine; recent workouts; sync status.
- **Workout:** each exercise with last time's sets beside this time's; big
  fields and a tick per set (an empty set ticked takes last time's numbers);
  warm-up sets; a rest timer that buzzes and beeps and survives a reload; the
  screen kept awake; a banner on every other screen while it's going on.
- **History:** by month, each workout's sets and records, "Do it again".
- **Exercises:** 49 built in plus your own; each with its best set, estimated
  one-rep max (Epley) over time, and every session.
- **Routines:** exercises with sets, target reps and rest each.
- **Muscles:** a 3D body, each muscle shaded by its sets in the last 7 days
  (today and the six before) or by how recently it worked; drag to turn it,
  Front and Back to flip it. Tap a muscle, on the body or in the list beside
  it, for its exercises (yours first, with last time's sets) and "Start a
  chest workout" with three of them, or "Add these" to a workout going on.
  Plain notes when big muscles have had nothing for two weeks, pushing far
  outweighs pulling, or legs fall behind. Today names the big muscles rested
  longest, between workouts. Works offline like every screen.
- **Progress:** workouts and volume per week, sets per muscle, recent records.
- **Settings:** kilograms or pounds, usual rest, sync now, export everything as JSON.

Still to do in Milo: editing a finished workout; supersets; distances in miles;
body weight (it comes from Hygeia); importing from other gym apps.

### Hygeia (health) — phase 3, built

Offline-first like Milo, on the same engine (`@atlas/sync`): you'll often log
a weight or tick a dose at home with the desktop off. Body weight is stored in
kilograms and glucose in mg/dL; Settings picks what's shown.

- **Today:** today's doses with Take, Skip and Undo (a dose's ID is made from
  the medication, the day and the time, so marking it on two devices can't
  make two); as-needed medications; quick readings with the change over a
  week; how you feel; the next appointment.
- **Measurements:** weight, blood pressure (two numbers, each with its own
  range), resting heart rate, sleep, glucose, and your own; each charted with
  the range you aim for shaded, and its readings flagged above or below it.
  The built-in ranges are common adult references, there to edit.
- **Medications:** times each day or as needed, start and end dates, how many
  doses were taken over the last 30 days.
- **Reminders:** a calendar feed at `/calendar.ics` (iCalendar): a daily event
  with an alert for each medication time, and each appointment with alerts a
  day and two hours before. The phone's calendar subscribes, keeps the events,
  and rings even with the server off.
- **Journal:** one entry a day: how you feel (1–5), symptoms, a note; symptoms
  counted over the last 30 days.
- **Appointments:** who, when, where, notes.
- **Lab results:** reports typed in as printed; each result flagged against its
  reference range; each test charted across reports with its range shaded.

Charts are the kit's, in Hygeia's teal and, for blood pressure's second line,
orange: the pair checked for colour-blind separation and contrast in both themes.

Still to do in Hygeia: the lab reader (phase 4), which fills the same report
form from a PDF or a photo; documents attached to appointments and reports;
medications on some days of the week only.

## 3D, where place matters

3D is used where *where* something is matters: the body (Milo, Hygeia) and the
apartment (Hestia). Kairos has nothing spatial, so it gets none. Every 3D view
keeps a plain list beside it, which says the same in words, for small screens,
keyboards and screen readers, and for devices without WebGL.

- **The body** (`packages/body`, built for Milo): a stylised figure drawn in
  code from rounded shapes, with each muscle group a part you can tap, each
  side its own. No model file, so nothing to license and little to download;
  the same figure will carry Hygeia's regions. Drawn with three.js through
  React Three Fiber, only when something changes, without tone mapping, so
  each part shows its colour. Milo's shades are a four-step olive ramp,
  checked as an ordinal scale against the figure in both modes.
- **Next, Hygeia's body map:** tap where it hurts to log a symptom there, and
  see over 30 days where things keep coming back; lab results on the organ
  they're about; spots on the skin photographed over time (this needs Hygeia
  to store files, as phase 4 does). A sore knee logged in Hygeia could warn
  Milo's exercises that load it.
- **Then Hestia's apartment:** drawn in Hestia (a floor plan of rooms, with the
  appliances placed in it), since the user's phone (a Pixel 8) can't scan
  rooms in depth. Tap the fridge to add "Clean the fridge", log it, see its
  warranty or manual; objects tinted by what's overdue; issues pinned where
  they are; the water shut-off and breaker panel marked; room areas for
  painting and flooring quotes. The plan and which object is which appliance
  would be kept in micasa as a document attached to the house, if its command
  line allows, so it's in the backups with no new store.

## Backups — phase 5, built

One `backup` service in the stack (`deploy/backup`), run while the machine is
on: whenever the newest archive is a day old, checked hourly, so a desktop
that was off all day backs up soon after it starts. Each archive holds:

- a `pg_dump` of each database: Kairos's, Milo's and Hygeia's;
- a copy of Hestia's house, micasa's SQLite file with its documents, made with
  SQLite's own backup, which is safe while Hestia writes (running `micasa
  backup` instead would collide with Hestia's own micasa commands);
- `deploy/.env`: without `DOSSIER_SECRET`, Kairos's stored keys can't be read.

It's one dated file, `atlas-YYYY-MM-DD-HHMM.tar.gpg`, locked with your
passphrase (OpenPGP, AES-256, so any GnuPG opens it), written to the folder you
choose (`ATLAS_BACKUP_DIR`: an external drive or a cloud-synced folder). It
keeps 30 days, and always the newest three. `atlas-backup restore` puts it all
back, once the apps are stopped (it refuses while they're connected); SETUP.md
has the steps, and what to do if the computer itself is gone.

After a restore, Milo's and Hygeia's change counter jumps ahead, so the phones,
which remember how far they'd synced, still get every change made from then
on. What a phone logged after the backup stays on that phone, though: it isn't
sent to the server again by itself. Making the phones send everything again
after a restore is still to do.

## Phases

0. **Foundation.** This repository, the plan, the design kit, the Atlas launcher,
   and the Compose stack with Tailscale, Postgres and Dossier's own image. *Done.*
1. **Hestia** on micasa. *Done, with the list above still to do.*
2. **Milo**, phone-first and offline. *Done, with the list above still to do.*
3. **Hygeia**, without the lab reader. *Done, with the list above still to do.*
4. **Hygeia's lab reader** (AI).
5. **Kairos's patch** (name, switcher, Tailscale sign-in), **Today** on Atlas,
   and the backup service. *Done.*

Phases 1–4 can swap order.
