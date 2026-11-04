# Atlas: the plan

Atlas is a private suite of web apps for one person, self-hosted, that look and
work as one product, the way Google's apps do: the same design, one switcher
between them, and no separate sign-ins.

| App | What it does | Built from | Address |
|---|---|---|---|
| **Atlas** | The launcher: every app, and later a "Today" view across them | New | `https://atlas.<tailnet>.ts.net` |
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
Serve tells each app who is asking (the `Tailscale-User-Login` header); the
Atlas apps let in only you (`ATLAS_OWNER`), and need no login screen at all.
Kairos keeps Dossier's own password at first (with "Keep me signed in", that's
once every 30 days) until its patch teaches it to trust the same header.

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
│   └── ui/               @atlas/ui: the design kit (tokens, fonts, components, shell, switcher)
├── apps/
│   ├── atlas/            the launcher
│   ├── kairos/           Dossier, as a git subtree, plus a small patch    (phase 5)
│   ├── hestia/           house                                            (phase 1)
│   ├── milo/             gym                                              (phase 2)
│   └── hygeia/           health                                           (phases 3–4)
└── deploy/
    ├── compose.yml       the whole stack
    ├── .env.example
    ├── tailscale/        one Serve config per app
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

### Atlas (launcher)

The grid of apps, as a page. Later the **Today** view: each app answers a small
`/api/atlas/today` with what matters today, and Atlas shows them together:
interviews (Kairos), maintenance due (Hestia), today's workout (Milo),
medications and appointments (Hygeia).

### Kairos (Dossier)

Dossier at a release tag in `apps/kairos` as a git subtree, with a patch kept
as small as possible so updates stay easy:

1. The name and mark in the sidebar and the browser tab (not the ~190 other
   mentions; those name the project it's built on).
2. The app switcher in the sidebar header.
3. Signing in with Tailscale's header instead of a password.

Updating: `git subtree pull --prefix apps/kairos https://github.com/AienTech/dossier <tag> --squash`,
then rebuild. Until phase 5 the stack runs Dossier's published image unchanged.

### Hestia (micasa)

A new web front end. Its server runs the `micasa` program's JSON commands
(`micasa maintenance list`, `micasa vendor add --data …`), which go through
micasa's own validation. The micasa version is pinned in Hestia's image, and
tests check the JSON shapes Hestia relies on, so an update can't break it
quietly. Screens:

- **Home:** overdue and due-soon maintenance, open incidents, active projects,
  spending this year.
- **Maintenance:** every schedule in a table with its next due date; "Log
  service" records what was done, by whom and for how much; history per item.
- **Projects:** a board by status (like Kairos's applications), each with its
  quotes side by side.
- **Incidents, appliances (with warranties), vendors, documents, house profile.**

If running the program per request is ever too slow, the next step is a small
Go API inside a micasa fork. Hestia never writes micasa's database directly.

### Milo (gym)

- **Today:** start an empty workout or one from a routine.
- **Workout:** big tap targets; each set is weight × reps (or time, or
  distance), with last time's numbers beside it and a rest timer between sets.
- **Exercises:** a starter library you can add to; each with its history, best
  sets and estimated one-rep max.
- **Routines:** ordered exercises with target sets, reps and rest.
- **Progress:** volume per week and muscle group, records, body weight (read
  from Hygeia).

Data: `Exercise`, `Routine`, `RoutineExercise`, `Workout`, `WorkoutSet`, with
IDs made on the phone. Kilograms or pounds is a setting.

### Hygeia (health)

- **Today:** what to take, what's coming up, quick entry for a measurement.
- **Measurements:** weight, blood pressure, resting heart rate, sleep, and any
  measure you add, with charts over time.
- **Medications:** what, how much, when; mark as taken; the calendar feed for
  reminders.
- **Journal:** symptoms and how you feel, by day.
- **Appointments:** who, when, notes, and the documents from them.
- **Lab results:** reports read as above; each test charted across reports
  against its reference range.

Data: `MeasureType`, `Measurement`, `Medication`, `Dose`, `JournalEntry`,
`Appointment`, `LabReport`, `LabResult`, `Document`.

## Backups

One `backup` service in the stack, run when the machine is on: a `pg_dump` of
each database (Kairos's included) and `micasa backup` of Hestia's file,
together in one dated, encrypted archive, copied to a folder you choose (an
external drive or a cloud-synced folder). Restoring is one documented command.

## Phases

0. **Foundation.** This repository, the plan, the design kit, the Atlas launcher,
   and the Compose stack with Tailscale, Postgres and Dossier's own image.
1. **Hestia** on micasa.
2. **Milo**, phone-first and offline.
3. **Hygeia**, without the lab reader.
4. **Hygeia's lab reader** (AI).
5. **Kairos's patch** (name, switcher, Tailscale sign-in), **Today** on Atlas,
   and the backup service.

Phases 1–4 can swap order.
