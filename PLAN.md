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
| **Tyche** | Money: accounts in pesos and dollars, income and spending, bills, budgets, savings goals | New (phase 6: 6a built) | `https://tyche.<tailnet>.ts.net` |
| **Clio** | Chinese: graded texts to read and hear, words to look up, reviews, short quizzes | New (phase 7: 7a in progress) | `https://clio.<tailnet>.ts.net` |

The names: Atlas holds up the sky; Kairos is the god of the opportune moment;
Hestia keeps the hearth; Milo of Croton grew strong by carrying a calf every
day as it grew into a bull; Hygeia is the goddess of health; Tyche is the
goddess of fortune and of a city's prosperity; Clio is the Muse of history,
whose name means "to make famous", shown reading a scroll.

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
`milo`, `hygeia`, `tyche`, `clio`). Hestia keeps micasa's SQLite file, through micasa's own
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
│   └── body/             @atlas/body: the 3D body you can tap, for Milo and Hygeia
├── apps/
│   ├── atlas/            the launcher
│   ├── kairos/           Dossier, as a git subtree, plus a small patch    (phase 5; ATLAS.md)
│   ├── hestia/           house, on micasa                                 (phase 1)
│   ├── milo/             gym, offline-first                               (phase 2)
│   ├── hygeia/           health, offline-first                            (phases 3–4)
│   ├── tyche/            money, offline-first                             (phase 6; 6a built)
│   └── clio/             Chinese graded reader, offline-first             (phase 7; 7a in progress)
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
  dialog, status dot, progress steps; and, added for Tyche, a meter, stat
  cards, small dot and bar charts, and a search palette (⌘K or Ctrl+K).
- **Shell:** the sidebar (collapsible, as in Dossier), the bottom tab bar on
  phones, the page header, the light/dark switch. Nav items can sit indented
  under another, groups can fold, and an item can be a phone tab only.
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
- **Tyche:** bills overdue, bills due in the next three days, pay that's
  late, and categories over budget this month.
- **Clio:** words due for review, and whether today's goal is met (with the
  streak).

Your browser asks each app itself, at its own address, so Tailscale tells each
one it's you, exactly as when you open it; the apps let only Atlas's address
read the answer (CORS). Atlas's server never calls the other apps, which keeps
the sidecars simple. An app that's stopped shows "Couldn't reach it" in its own
card, and the rest still load. Milo, Hygeia, Tyche and Clio answer from what the
phones have synced. Coming back to the page after a minute asks again.

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
- **Writes:** `micasa db <entity> add|edit|delete|restore`, through micasa's
  own validation; its messages ("serviced at: invalid date value") reach the
  form, and its refusals are said plainly ("This project still has 2 quotes.
  Delete them first.").
- **Deleting** is micasa's: the record is kept, marked deleted, so every
  Delete in Hestia can be undone from the message that follows it.
- **Documents** are micasa's too, stored in its database: Hestia uploads a file
  with `micasa db document add --file`, and serves it back from
  `/documents/<id>`. PDFs, pictures and plain text open in the browser;
  anything else is downloaded, and the browser is told to run nothing in it.
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
  schedule; each item's page with its details, service history and
  documents; "Log service" (date, cost, who did it, notes; a new vendor is
  added by name) and "Add item".
- **Projects:** a board by status, each project's page with its quotes side by
  side against the budget, "Add a quote", its documents, the status changed
  in place, "New project".
- **Incidents:** open issues by urgency, "Fixing it" and "Fixed", "Report an
  issue"; each issue's page with who fixed it, when, for how much, and its
  photos and invoices.
- **Appliances** with their warranties; each one's page with its upkeep, its
  issues and its manual and receipts. **Vendors** with call, email and website
  buttons. **Documents:** every file in the house, with what it belongs to.
- **Your house:** its basics, its systems (heating, cooling, water, wiring,
  roof…) and its costs and cover (insurance, property tax, community fee),
  each edited on its own.
- Every record has a "…" menu with Edit and Delete.

Still to do in Hestia: the apartment in 3D (see "3D, where place matters").

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
  **Supersets:** two or more exercises joined (from an exercise's menu, or
  marked in a routine) are done a set of each in turn, with no rest between
  them and the rest after the last.
- **History:** by month, each workout's sets and records, "Do it again", and
  "Edit": a finished workout's name, day, start, length and notes, and every
  set, added, changed or deleted, with nothing to tick.
- **Exercises:** 49 built in plus your own; each with its best set, estimated
  one-rep max (Epley) over time, and every session.
- **Routines:** exercises with sets, target reps and rest each, and which go
  as a superset with the next.
- **Muscles:** a realistic 3D body, each muscle shaded by its sets in the last 7 days
  (today and the six before) or by how recently it worked; drag to turn it,
  Front and Back to flip it. Tap a muscle, on the body or in the list beside
  it, for its exercises (yours first, with last time's sets) and "Start a
  chest workout" with three of them, or "Add these" to a workout going on.
  Plain notes when big muscles have had nothing for two weeks, pushing far
  outweighs pulling, or legs fall behind. Today names the big muscles rested
  longest, between workouts. Works offline like every screen.
- **Progress:** workouts and volume per week, sets per muscle, recent records,
  and, with your weight from Hygeia, how much each lift is for your weight
  (an estimated one-rep max over what you weighed then) and your weight by
  week. The browser asks Hygeia for it at Hygeia's own address
  (`/api/atlas/weights`, readable by Milo's pages only) and keeps a copy on
  the device for offline.
- **Settings:** kilograms or pounds, kilometres or miles, usual rest, sync
  now, export everything as JSON, and **import** from Strong or Hevy: their
  CSV export, previewed before anything is saved, exercises matched to
  Milo's by name or added; importing the same file twice adds nothing.

Still to do in Milo: nothing planned beyond what's above; ideas welcome.

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
- **Medications:** times each day, or on some days of the week only (Monday,
  Wednesday and Friday), or as needed; start and end dates; how many doses
  were taken over the last 30 days.
- **Reminders:** a calendar feed at `/calendar.ics` (iCalendar): a daily event
  with an alert for each medication time, and each appointment with alerts a
  day and two hours before. The phone's calendar subscribes, keeps the events,
  and rings even with the server off.
- **Journal:** one entry a day: how you feel (1–5), symptoms, a note; symptoms
  counted over the last 30 days.
- **Body:** the same 3D figure as Milo's, divided into 28 plain places
  (head, neck, chest, upper and lower back, belly, and on each side the
  shoulder, upper arm, elbow, forearm, wrist and hand, hip, buttock, thigh,
  knee, lower leg, ankle and foot). Each place is shaded by how many of the
  last 30 days you felt something there. Tap one, on the body or from the list,
  to see what you logged there and to log what you feel now: pain, ache,
  stiffness, swelling, itch, rash, numbness or other, how bad from 1 to 10,
  and a note. "Lately" lists the places with something, most days first.
  **Spots:** follow a mole or a patch at a place, photograph it now and then
  (the phone's camera opens), and see the first and latest photos side by
  side. Today links to it. Settings picks the figure.
- **Appointments:** who, when, where, notes; each one's page with its
  documents (a referral, a prescription).
- **Lab results:** reports typed in as printed; each result flagged against its
  reference range; each test charted across reports with its range shaded;
  the report itself attached, as the lab's PDF or a photo of the paper.
  **On the body:** the organs the tests are about (thyroid, heart, liver,
  pancreas, kidneys, bladder) on the 3D figure, teal when their latest
  results are all in range and orange when something isn't; tap one for its
  tests. Tests are placed by name, in English or Spanish; blood counts are
  listed beside the body.
- **Files:** attached files are kept on the server, in Hygeia's database (so
  the backups have them); a synced record says what each is, so the lists
  show offline. Attaching or opening one needs the server. PDFs and pictures
  open in the browser; anything else is downloaded, and the browser is told
  to run nothing in it.

Charts are the kit's, in Hygeia's teal and, for blood pressure's second line,
orange: the pair checked for colour-blind separation and contrast in both themes.

Still to do in Hygeia: the lab reader (phase 4), which fills the same report
form from a PDF or a photo (it can start from the report's attached file).

### Tyche (money) — phase 6, 6a built

Tyche keeps track of money: accounts in pesos and dollars, every income and
expense, the bills and pay that come back every month, a budget per
category, and savings goals. Its overview follows a reference design the user
chose: three summary cards over a "budget board" of four columns. It's drawn
in Atlas's own look, in light and dark, so it sits with the other apps; only
the layout comes from the reference.

Decided with the user (6 Nov 2026): Atlas's look with the reference's layout;
pesos and dollars; transactions typed in, made from recurring items, imported
from statements, and read from receipts by the local AI; the name Tyche.

Their money, as they described it after 6a:

- **Mercado Pago:** an account (wallet).
- **Naranja X:** an account, and a regular **Frasco** (daily interest, money
  in and out any time): a savings account in Tyche, its interest coming in
  through the import. Not a Frasco Fijo.
- **BBVA:** an account and the card they mostly use. **BNA:** a card too.
- **IOL** (InvertirOnline): investments, read through IOL's API.
- **Cuotas:** tracked, each purchase as N monthly charges on the card.

#### How it's built

Offline-first, like Milo and Hygeia, on `@atlas/sync`: the phone keeps its own
copy (Dexie), every screen reads it, and changes sync to Postgres (a `tyche`
database) when the server answers. An expense is logged at the till, often
with no signal and the desktop off.

- **Money is whole cents** (integers), never floating point. Each account has
  one currency, ARS or USD, and its transactions are in it.
- **Recurring items are made on the device.** Each occurrence's ID comes from
  the item and its date (`o-<recurring>-<YYYY-MM-DD>`), as Hygeia's doses do,
  so two phones making the same month's rent make one record.
- **Statuses are worked out, not stored**, except what only you know: a
  transaction is `expected` (a bill or pay not yet through), `pending` (a card
  payment not yet cleared) or `cleared`. "Overdue", "Due in 4 days", "On
  track" are worked out from that, the dates and the goals (below).
- **The server writes one kind itself:** exchange rates (below), through the
  sync store's `applyChanges`, so phones get them like any other record.

#### Pesos and dollars

- **Totals in one currency**, picked in Settings, dollars by default. Pesos
  lose value month to month, so "+3.1% vs last month" in pesos mostly measures
  inflation; in dollars it measures you. Each amount is converted at the rate
  of its own day; balances at today's.
- **Rates:** the server fetches the day's quotes (MEP by default; blue and
  official kept too) and saves them as `rate` records. Candidate source:
  DolarApi (`dolarapi.com`), to be checked before relying on it. With no
  rate for a day, the latest earlier one is used and the screen says so. A
  rate typed in by hand for a day wins over a fetched one.
- **Buying or selling dollars** is a transfer between a peso account and a
  dollar account, with both amounts, so the rate you actually got is kept.

#### Records (synced kinds)

| Kind | Fields |
|---|---|
| `account` | name, type (bank, card, cash, wallet, savings, investment), currency, opening balance and date, archived |
| `category` | name, group (bills and fixed, daily spending, income), icon, monthly budget (optional, in a currency) |
| `transaction` | account, date, amount (negative out, positive in), category, payee, note, status, recurring item and date if made from one, transfer pair, goal, import ID, attachments |
| `recurring` | name, account, category, amount (fixed or roughly), schedule (monthly on a day, every two weeks, weekly, yearly), start, end, paid automatically or not, and for a purchase in cuotas how many |
| `goal` | name, kind (safety, travel, purchase, other), target and currency, target date, account it's kept in |
| `valuation` | an investment account's value at the end of a day, typed in or read from IOL |
| `holding` | a position IOL reported: symbol, name, type, quantity, last price, value, gain |
| `rate` | day, kind (MEP, blue, official), pesos per dollar, fetched or typed |
| `attachment` | a file on the server (receipts, statements), as in Hygeia |

A goal's saved amount is the sum of the transfers marked for it. An
investment account's balance is its latest value (typed in, or read from IOL
for IOL's two accounts) plus what moved in or out after it: prices change
the value without any transaction, and without counting as income.

**Cuotas:** a purchase on a card in N cuotas is a recurring item with
`installments` N: monthly from the first cuota, paying itself, ending after
the last. Each charge appears and clears by itself ("Cuota 3 of 6"), and
what's still to come shows on the card and on Recurring bills.

**IOL:** with `TYCHE_IOL_USERNAME` and `TYCHE_IOL_PASSWORD` set, the server
reads IOL every three hours (`/api/v2/estadocuenta` for each currency's
total, `/api/v2/portafolio/argentina` for the holdings), and saves the day's
values and the holdings into two accounts it makes once, **IOL pesos** and
**IOL dólares**. It only reads. IOL has to switch on API access first.

#### Screens, from the reference

**Sidebar** (the kit's, with the app switcher in place of the reference's
logo): Overview, Analytics; *Transactions*: All, Income, Expenses, Pending
(each with its count); Recurring bills; *Accounts*: Cards and bank, Savings,
Investments; *Plan*: Savings goals, Budget limits; at the bottom, Settings and
you. The reference's second "Accounts" heading is a slip; it's "Plan" here.

**Top bar:** the page's place ("Money › Overview"), search over transactions
(⌘K or Ctrl+K, on the device, so it works offline), Export (a CSV of what the
screen shows) and **Add transaction**. Left out: Share and the row of
avatars, which are for teams; Tyche has one user.

**Overview:** "Financial overview", with the month under it and a picker.

- **Three cards.** *Balance:* every account's balance together, the change
  over the month, and the month's daily balance as a row of dots.
  *Income:* the month's income, the change from last month, and a small bar
  for each day with money in. *Spending:* the month's spending, the share of
  income it is ("61% of income spent"), and a bar filling to it. Every mark
  has a tooltip, and each card says its number in words, so nothing is colour
  alone.
- **My finances**, in tabs: *Summary*, *Budget board*, *Transactions*,
  *Goals*, with Filter (account, category, status) and the year.
- **The budget board**, four columns, each with its count and a "…" menu (Add,
  View all):
  - *Bills and fixed:* this month's recurring expenses, overdue first, then by
    due date, then paid.
  - *Daily spending:* the latest other expenses.
  - *Savings goals:* each goal's saved amount "of" its target, a progress bar,
    the target date and what's left.
  - *Income:* this month's pay and other income, expected and in.

  Each card: its category with its icon and a status label, the payee, the
  amount, and a line with the date and a note. Its own "…" menu has Mark
  paid (or Mark received), Edit and Delete, with Undo. A column shows its
  first few cards and "View all N".
- **Summary:** spending by category against each budget (the kit's bar
  list), and income against spending by month (column chart). **Transactions:**
  the month's list. **Goals:** every goal's card.

**Status labels**, always words:

| Label | When | Tone |
|---|---|---|
| Overdue · 6 days late | an expected expense past its date | danger |
| Due in 4 days | an expected expense within a week | warning |
| Paid / Cleared | a cleared bill / other expense | success |
| Pending | a card payment not yet cleared | warning |
| Received | cleared income | success |
| Expected | income not yet in (late: "Late · 2 days", warning) | neutral |
| On track / Behind / Almost there / Reached | a goal against a straight line from its start to its target date; "almost there" from 90% | info / warning / success / success |

The reference's copy has slips that come from statuses typed by hand (a bill
due in four days marked "Overdue", "Rent of October" in an April overview,
fuel filed as "Electric bill"); working them out avoids that.

**Other screens:** Analytics (spending by category over months, income
against spending, savings rate, net worth in the display currency); the
transaction lists, each with search and filters; Recurring bills (each item,
its next date, its history); accounts by type and each account's page (its
balance over time and its transactions); Savings goals; Budget limits (each
category's budget and this month's spending against it); Settings (display
currency, which rate, categories, export everything as JSON).

**On the phone** (below 1024px): tabs Overview, Transactions, Add, Bills,
More. **Add** opens a sheet built for one hand: the amount first, with a
keypad, then category chips (the most used first), the account (the last
used), and today's date. The board's columns become one column at a time,
picked with a segmented control.

#### Getting transactions in

1. **Typed in**, on any device, offline (step 6a).
2. **Recurring items** (6a): set up once; each occurrence appears from a month
   before its date as `expected`. A bill paid automatically clears itself on
   its date; others wait for "Mark paid", which can change the amount. A bill
   on the 31st falls on a short month's last day.
3. **Statement import** (6c): exports from Mercado Pago, Naranja X (account
   and Frasco) and BBVA (account and card statement), previewed before
   anything is saved, like Milo's Strong and Hevy import. Mercado Pago gives
   CSV or Excel; Naranja X and BBVA may give only PDFs, whose text is read
   directly (a statement PDF has text in it), with the local model as a
   fallback when its layout defeats a plain reading. Each row's ID comes from the file, so importing the same
   statement twice adds nothing, and a row matching one typed in by hand
   (same amount, within three days) is offered as "the same one". One
   mapping per bank, written from real exports the user provides.
4. **Receipts and statements read by the local AI** (6d), on the same
   pipeline as Hygeia's lab reader (phase 4), which moves into a shared
   package, `@atlas/reader`: the file is stored on the server, waits in a
   queue until Ollama answers, a PDF with text is read directly and a photo
   by the vision model, and the result (payee, date, total, currency, and
   lines if wanted) fills the Add form for you to check. Nothing is saved
   without your review. Needs the GTX 1080; it can't be tested in the cloud.

#### Today on Atlas

Tyche answers `/api/atlas/today` from what the phones have synced: bills
overdue, then due in the next three days, pay that's late, categories over
budget, and goals just reached.

#### What changes across the suite

- `packages/ui/src/apps.ts`: Tyche's entry (icon `Coins`, tagline "Where
  money goes"); `styles.css`: its accent (a plum, about `oklch(0.5 0.12 310)`,
  white mark at 4.5:1 or more, checked by `scripts/icons.mjs`) and its chart
  colours (checked with the dataviz skill's validator in both modes); its
  icons; Kairos's copies (`apps/kairos/src/atlas/apps.ts`, `atlas.css`), or
  `today.test.ts` fails.
- **The kit gains:** nav items one level deep and groups that fold (the
  reference's tree under All transactions), an `info` tone for `Badge`, a
  meter (progress bar), a command palette on Radix's dialog (no new
  library), a stat card, and small dot and bar sparklines. Each built once,
  in `@atlas/ui`, for any app.
- **Deploy:** a `tyche-tailscale` sidecar and `tyche` service on 127.0.0.2
  with its health check; `CREATE DATABASE tyche;`; `ATLAS_APPS`; the backup
  script's database list, its connection check, its stop list and its epoch
  renewal after a restore; `.env.example`, `SETUP.md`, README. Development
  port 3005.
- **Its Dockerfile** copies Hygeia's (it `COPY`s `packages/ui` and
  `packages/sync`).

#### Steps

- **6a, the core: built.** The app, its records and sync; accounts and
  categories (with a starting set); transactions typed in, edited, deleted,
  moved between accounts; recurring items; pesos and dollars with rates; the
  overview with its cards and the budget board; the transaction lists,
  search and Export; the phone's Add screen; Today. Savings goals, budget
  limits, the Summary tab and the accounts' pages came along in 6a too: the
  board needed goals, and the rest was small once the parts existed.
- **6b, look back:** cuotas, investment values and reading IOL: *built*.
  Still to do: Analytics (spending by category over months, income against
  spending, savings rate, net worth).
- **6c, statement import:** Mercado Pago, Naranja X and BBVA (account and
  card), once the user sends a sample export of each. A card statement's
  "Cuota 3/6" lines join the purchase in cuotas they belong to.
- **6d, the receipt reader**, with or after Hygeia's lab reader.

**Checks:** unit tests for the money (cents, conversions, the rate of a day),
recurring dates (month ends, every two weeks, leap years), the deterministic
IDs, statuses and goal pacing, and import parsing; screenshots at desktop
width and as a Pixel 8, light and dark, set beside the reference; offline
from a cold start; the Docker image healthy; lint, types and builds with no
warnings.

**Learned building 6a:**

- **Records a device makes up by itself** (next month's rent, the starting
  categories) go through `Device.seed` in `@atlas/sync`: saved only if the
  device doesn't have them, as the oldest possible version (`updatedAt` 1).
  So paying a bill on one phone always wins over another phone making the
  same bill, and an occurrence still at that version has never been touched,
  so it can follow its item when the item changes.
- **Today can't wait for a phone** to make next week's rent, so the server
  works the window's occurrences out from the recurring items itself
  (`withOccurrences`) and adds those no phone has synced yet.
- **What one device prefers** (the account Add starts on) lives in that
  browser, not in the synced settings: a new phone saving its defaults would
  otherwise overwrite the settings chosen on another.
- **DolarApi's field names** (`casa`, `venta`, `fechaActualizacion`) come
  from its docs' examples; this sandbox can't reach it, so the fetch has
  never run live. The reader skips anything that doesn't fit rather than
  failing, and the server logs once when fetching fails.

**Open questions for later steps:** whether MEP is the right default rate;
whether to import BNA's card statements too (the user mostly uses BBVA's).

### Clio (Chinese) — phase 7, 7a in progress

Clio is a graded reader for Mandarin, in the style of Du Chinese: read and
listen to texts at your level, tap a word to look it up, review the words
you save with spaced repetition, and answer a short quiz after each text.
Phone-first and offline-first, like Milo, Hygeia and Tyche.

Decided with the user (Nov 2026):

- **Skills:** reading, listening, vocabulary review, writing and speaking.
- **Content:** graded texts written by AI, and real news simplified to
  level. Topics: daily life and dialogues, news, culture and history.
- **First:** the reader, with a short quiz per text, a streak and a daily
  goal.
- **Level:** simplified characters, graded by HSK 3.0 ("new HSK"). Bands 1–3
  (about 2,200 words) are assumed known; the user is working into band 4.
  Glosses are in English.
- **Services:** Claude writes and simplifies the texts (hosted, its key on
  the server only). Azure Speech makes the audio, with word timings for
  highlighting, and scores pronunciation.

#### How it's built

Offline-first on `@atlas/sync` (a `clio` database). The phone keeps its own
copy (Dexie), every screen reads it, and changes sync when the server
answers. Development port 3006.

- **Texts arrive by sync.** A text is a synced kind (`text`), whole: its
  sentences as tokens (`{ t, p?, w? }`: the text, its pinyin as read there,
  the headword to look up), a glossary of every headword so it reads with
  no dictionary loaded, grammar notes, quiz questions, and audio timings.
  The server writes texts itself with the sync store's `applyChanges`, as
  Tyche writes exchange rates, so a new text simply reaches the phone on
  its next sync and is there offline. Audio stays a file on the server.
  Sample texts have the same shape, shipped with the app and put on the
  device with `Device.seed`.
- **Known words:** a word you have no record for counts as known if its
  band is at or below the assumed band (Settings, 3 by default), new
  otherwise; once you tap, review or mark it, its record decides
  (`src/lib/words.ts`, with `coverage`: the share of a text's words you know).
- **Word lists and dictionary:** HSK 3.0's lists and CC-CEDICT, as data the
  app ships (`public/data`), built by `scripts/`.
- **Reviews:** FSRS (the `ts-fsrs` package). A word's schedule is kept on
  its record in ts-fsrs's own fields; each review is logged.
- **Activity:** one record per day per device (time, reviews, texts
  finished, words read), summed for the daily goal and the streak, so two
  phones never overwrite each other's counts.

#### Records (synced kinds)

| Kind | Fields |
|---|---|
| `text` | kind (story, dialogue, news, culture), band 1–9, topic, title (characters, pinyin, English), source for news, sentences (speaker, tokens, English), glossary, the new words it teaches, notes, questions, audio and timings, sample or generated |
| `word` | its headword as ID; status (new, learning, known, ignored), saved, how it got there (band, tapped, reviewed, marked), where you met it, its FSRS card |
| `review` | the word, the rating, and the card as it was before (ts-fsrs's review log) |
| `reading` | per text: started, last read, finished, furthest sentence, quiz score |
| `day` | per day and device: seconds, reviews, texts finished, words read |
| `settings` | pinyin (off, over new words, all), assumed band, daily goal in minutes, new words per text, topics, audio speed, English shown or hidden |

#### The reader (7a)

`/read?t=<id>`, phone first. The text flows as sentences (a dialogue one
turn per line, with the speaker), 22 px by default, sized per device.
Pinyin as ruby over words (off, over words you don't know, or all), new
words underlined in Clio's red, words you're learning washed in amber.
Tapping a word opens a sheet (a popover on a desktop): the word, pinyin,
the text's glossary, more from the dictionary when it's on the phone, its
band, and I know this / Learning / Ignore. A long press, or "The whole
sentence", shows the sentence with all its pinyin, its English and its
words. The 文A at a sentence's end shows its English (a setting shows all).

- **Tapping saves:** a word that counts as new goes into review when you
  tap it (`learning`, from `tapped`, with its sentence) and the sheet says
  "Saved for review". Known, learning and ignored words are only looked up.
- **Finishing** marks as known every word of the text that has no record
  and would count as new (what you didn't tap, you knew; Du Chinese and
  LingQ do the same), says how many, with Undo. It records the reading as
  finished, adds the text and its words to the day, and shows a summary,
  the grammar notes and the quiz's place (7b).
- **Progress:** the furthest sentence is kept, and the reader goes back
  there; a thin bar shows how far down you are.
- **Time** counts while you're active: each gap between taps, scrolls or
  the audio counts up to 90 seconds, and nothing while the page is hidden.
- **Listening:** the browser's Chinese voice for now (hidden when there is
  none), behind one hook that 7d's recorded audio replaces.
- **The library** lists texts newest first, with kind, band, length and
  how much you know ("94% known · 6 new words"), filtered by kind and by
  unread, started or finished. **Today** suggests the text you're in, else
  the unread one nearest 95% known within 90–98%, the comfortable range
  for reading with lookups.
- **Samples** ship with the app and are seeded with a version, so a new
  build's samples replace the old ones without touching anything of yours.

#### The quiz and Today (7b)

After finishing a text, "Take the quiz" opens a full-height sheet: one
exercise at a time, the answer shown at once (the right option ticked, a
wrong pick crossed, and for a missed word the sentence it came from),
Continue, a progress bar, Skip, and at the end "7 of 8. Two to look at
again:" with the misses listed. It's made from the text alone, so it works
offline: the text's own questions, then a word match (5 words, Chinese to
English), a meaning choice, a fill-the-gap, a reorder of a short sentence
(English shown, Chinese tiles shuffled) and, where the browser has a
Chinese voice, a listening one. Words you tapped or that are new to you
come first. A word you get wrong goes into review ("Saved for review")
unless you already have it there, marked known or set aside. The latest
score is kept on the reading and shows on the library card; the quiz can
be taken again from the summary.

**Today** is the screen you open each day: the daily goal as a ring with
what counted (texts finished, reviews, words read), the streak ("4 days in
a row. Read for 6 more minutes to keep it."), the longest streak, the last
7 days as met, partly or nothing, then the text to carry on with, the
reviews due and a small chart of minutes a day. A day is a local day on
the device; today not yet met doesn't break the streak; a day is judged by
the goal as it is now. Atlas's Today says the reviews due, the text in
progress or next, and the goal and streak.

#### Writing a text (7c)

1. Choose the words: the topic, words due for review, and 5–8 new band-4
   words.
2. Claude writes the text at the level, with those words.
3. Code checks it: the share of words above your level (about 5% at most),
   and its pinyin against CC-CEDICT.
4. Azure makes the audio, with word timings.
5. It's stored as a `text` record and arrives on the phone by sync. The
   server keeps about 15 unread texts ahead of you.

#### Screens

Today, Library, Review, Words and Settings: all five are tabs on a phone.
A text opens in the reader, from the library.

#### Steps

- **7a** (in progress): the app, the word lists, the dictionary, the reader
  with lookup and known-word tracking, sample texts. Built: the reader and
  the library (below).
- **7b:** review cards (FSRS), quizzes, the streak, the daily goal, Today.
  The quiz, the streak and goal and Today are built; the reviews are
  another agent's.
- **7c:** text generation and the news pipeline. Needs a Claude API key.
- **7d:** audio with highlighting, and listening exercises. Needs an Azure
  Speech key.
- **7e:** stroke practice (Hanzi Writer), dictation, speaking.

## 3D, where place matters

3D is used where *where* something is matters: the body (Milo, Hygeia) and the
apartment (Hestia). Kairos has nothing spatial, so it gets none. Every 3D view
keeps a plain list beside it, which says the same in words, for small screens,
keyboards and screen readers, and for devices without WebGL.

- **The body** (`packages/body`, for Milo and Hygeia): a realistic figure,
  male or female, from MakeHuman's base mesh (CC0, public domain), the same
  kind of smooth mannequin drawing apps use. What can be tapped (Milo's
  muscles, Hygeia's places) are volumes placed from the figure's own joints,
  each with the way its skin faces, and a shader paints them on the skin per
  pixel, so their edges and the ring round the picked one stay crisp. Tapping
  goes through the same rule, so what you tap is what you see. Muscles are
  drawn as muscle (a rounded belly, fine fibres, the body's creases shaded, an
  athletic build so they have form). Hygeia's places are drawn as warmth,
  with no edge: a place's shade is full over the middle of its own skin and
  fades out to where the next place begins, since "my knee hurts" has no
  outline; the place you pick gets a hairline round it. Drawn
  with three.js through React Three Fiber, only when something changes,
  without tone mapping, so each part shows its colour. Milo's shades are a
  four-step olive ramp and Hygeia's a four-step orange one, each checked as
  an ordinal scale against the figure in both modes. Each app's Settings
  picks the figure.
- **Hygeia's body map, built:** see "Body" and "Lab results" under Hygeia:
  places, spots photographed over time, and lab results on their organs. A
  sore place logged there in the last week warns Milo: Today says what to go
  easy on, and each exercise that loads it (a squat, for a knee) says so in
  the workout.
- **Hestia's floor plan, built (drawn in Hestia):** rooms as rectangles (two
  with one name make an L), and the things that need looking after placed in
  them: the fridge, the washer, the water heater, the boiler, smoke alarms,
  the water shut-off, the breaker panel and the like. In 3D (a doll's house
  with the walls cut at a metre) each thing is coloured by its upkeep: red
  overdue (with a marker above it), amber due soon, teal looked after. Tap
  one: link it to its appliance (or add it as one), add its usual upkeep in a
  tap ("Clean the fridge, every 3 months"), log it, see its issues and
  documents. Tap a room for its floor and wall areas, for paint and flooring
  quotes, and the issues whose location names it. A list beside the view
  says the same in words. micasa has nowhere to keep a plan (its documents
  belong to records, not to the house), so it's Hestia's one file of its
  own, `hestia-plan.json` beside micasa's database, and the backups take it.
- **Still to come: a room scan.** The user's Pixel 8 can't scan rooms in
  depth, but an iPhone Pro can (the user's girlfriend has a 17 Pro Max):
  apps built on Apple's RoomPlan scan a room with its LiDAR in minutes, and
  RoomPlan's own export is USDZ, with walls, doors, windows and recognised
  objects (fridge, oven, dishwasher, washer…). Hestia would turn that into
  the same plan, rooms and things, for the editor to fix what the scan
  missed.

## Backups — phase 5, built

One `backup` service in the stack (`deploy/backup`), run while the machine is
on: whenever the newest archive is a day old, checked hourly, so a desktop
that was off all day backs up soon after it starts. Each archive holds:

- a `pg_dump` of each database: Kairos's, Milo's, Hygeia's, Tyche's and Clio's;
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

After a restore, Milo's, Hygeia's, Tyche's and Clio's servers get a new "epoch", a random
value they send with every sync. A phone that sees a new one sends everything
it has again and fetches everything from the start, so what it logged after
the backup was taken comes back to the server. The newer copy of each record
wins, as always, so nothing older overwrites anything newer.

## Phases

0. **Foundation.** This repository, the plan, the design kit, the Atlas launcher,
   and the Compose stack with Tailscale, Postgres and Dossier's own image. *Done.*
1. **Hestia** on micasa. *Done, with the list above still to do.*
2. **Milo**, phone-first and offline. *Done, with the list above still to do.*
3. **Hygeia**, without the lab reader. *Done, with the list above still to do.*
4. **Hygeia's lab reader** (AI).
5. **Kairos's patch** (name, switcher, Tailscale sign-in), **Today** on Atlas,
   and the backup service. *Done.*
6. **Tyche**, money, offline-first: 6a the core, 6b cuotas, investments, IOL
   and analytics, 6c statement import, 6d the receipt reader (with phase 4).
   *6a done; 6b done but for Analytics.*
7. **Clio**, Chinese, offline-first: 7a the app, word lists, dictionary,
   reader and sample texts, 7b reviews, quizzes, streak and goal, 7c
   writing texts, 7d audio, 7e writing and speaking. *7a in progress.*

Phases 1–4 can swap order.
