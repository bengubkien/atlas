# Atlas

A private suite of web apps for one person, self-hosted behind Tailscale, that
look and work as one product: one design, one switcher between them, no
separate sign-ins, one page for today, and one backup of everything.

| App | For | Status |
|---|---|---|
| **Atlas** | The launcher: what needs you today, and every app | Ready |
| **Kairos** | Job search, on [Dossier](https://github.com/AienTech/dossier) | Ready: Dossier with a small patch ([apps/kairos/ATLAS.md](apps/kairos/ATLAS.md)) |
| **Hestia** | House maintenance, on [micasa](https://github.com/micasa-dev/micasa) | Ready; see PLAN.md for what's still to do |
| **Milo** | Gym, working offline on the phone | Ready; see PLAN.md for what's still to do |
| **Hygeia** | Health, working offline on the phone | Ready, without the lab reader (phase 4) |
| **Tyche** | Money in pesos and dollars, working offline on the phone | Ready (6a); see PLAN.md for what's still to do |
| **Clio** | Chinese graded reader, working offline on the phone | Being built (7a: the foundation) |

- **[PLAN.md](PLAN.md):** the design, the decisions behind it and the phases.
- **[deploy/SETUP.md](deploy/SETUP.md):** from a fresh computer to the apps on your phone.

## Repository

```
packages/ui/    @atlas/ui: the design kit taken from Dossier (tokens, fonts,
                components, charts), the app shell for desktop and phone, the app switcher
packages/sync/  @atlas/sync: offline-first sync for Milo, Hygeia, Tyche and Clio
packages/body/  @atlas/body: a realistic 3D body you can tap (three.js; MakeHuman's CC0 mesh), for Milo's muscle map and Hygeia's body map
apps/atlas/     the launcher, with Today from every app
apps/kairos/    the job search: Dossier as a git subtree, with Atlas's patch
apps/hestia/    the house, on micasa's engine
apps/milo/      the gym, offline-first, syncing through Postgres
apps/hygeia/    health, offline-first, with a calendar feed for reminders
apps/tyche/     money in pesos and dollars, offline-first, with exchange rates
apps/clio/      Chinese: graded texts to read and hear, words to look up and review, offline-first
deploy/         the Docker Compose stack, Tailscale Serve config, backup service, setup guide
```

## Developing

You need Node.js 22 or later; Corepack provides pnpm.

```bash
corepack enable
```

```bash
pnpm install
```

Each app reads who you are from Tailscale's headers, which don't exist on your
own machine, so turn the check off and give it the addresses to link to. Put
this in `apps/atlas/.env.local`:

```
ATLAS_AUTH=off
ATLAS_OWNER_NAME=Jane Doe
ATLAS_DOMAIN=tail1234.ts.net
ATLAS_APPS=atlas,kairos
```

Then start the launcher at http://localhost:3000:

```bash
pnpm dev
```

### Hestia

Hestia needs the `micasa` program, 2.8.2: download it for your system from
[micasa's releases](https://github.com/micasa-dev/micasa/releases/tag/v2.8.2).
Make a sample house to work on:

```bash
micasa demo --seed-only demo.db
```

Then, in `apps/hestia/.env.local` (paths are examples):

```
ATLAS_AUTH=off
MICASA_BIN=/usr/local/bin/micasa
MICASA_DB_PATH=/path/to/demo.db
```

Start it at http://localhost:3001:

```bash
pnpm dev:hestia
```

Its tests include contract tests against the real program; without
`MICASA_BIN` they're skipped:

```bash
MICASA_BIN=/usr/local/bin/micasa pnpm --filter @atlas/hestia test
```

### Milo

Milo needs a Postgres database: an empty one is enough, it makes its table.
In `apps/milo/.env.local`:

```
ATLAS_AUTH=off
DATABASE_URL=postgres://user:password@localhost:5432/milo
```

Start it at http://localhost:3002 (the offline copy only installs in a
production build: `pnpm --filter @atlas/milo build`, then `start`):

```bash
pnpm dev:milo
```

### Hygeia

The same as Milo, with its own database (`.../hygeia`), at
http://localhost:3004:

```bash
pnpm dev:hygeia
```

### Tyche

The same again, with its own database (`.../tyche`), at http://localhost:3005.
It fetches the day's dollar quotes from `TYCHE_RATES_URL` (DolarApi by
default); set it empty in `apps/tyche/.env.local` to turn that off:

```bash
pnpm dev:tyche
```

To try the screens with a made-up month of pesos and dollars (accounts, bills,
pay, goals and rates), with the server running and `ATLAS_AUTH=off`:

```bash
node apps/tyche/scripts/demo.mjs http://localhost:3005
```

To read an IOL account while developing, put `TYCHE_IOL_USERNAME` and
`TYCHE_IOL_PASSWORD` in `apps/tyche/.env.local`. Tyche's tests of reading IOL
run against a stand-in IOL and need a Postgres, like the sync engine's
(`ATLAS_TEST_POSTGRES`, below); without it they're skipped.

### Clio

The same again, with its own database (`.../clio`), at http://localhost:3006:

```bash
pnpm dev:clio
```

### The sync engine

`packages/sync`'s tests run the server against a real Postgres and two devices
through it; give them a Postgres to make a throwaway database in, or they're
skipped:

```bash
ATLAS_TEST_POSTGRES=postgres://user:password@localhost:5432/postgres pnpm --filter @atlas/sync test
```

### Today

The launcher's Today asks each running app for `/api/atlas/today` from your
browser. While developing, give every app the others' addresses, so the
launcher knows where to ask and each app lets the launcher's address read its
answer, e.g. in each app's `.env.local`:

```
ATLAS_URL_ATLAS=http://localhost:3000
ATLAS_URL_HESTIA=http://localhost:3001
ATLAS_URL_MILO=http://localhost:3002
ATLAS_URL_HYGEIA=http://localhost:3004
ATLAS_URL_TYCHE=http://localhost:3005
ATLAS_URL_CLIO=http://localhost:3006
```

### Kairos

Kairos is Dossier, and is developed the way Dossier is (its
[DEVELOPMENT.md](apps/kairos/DEVELOPMENT.md)): with Node.js 24 and Yarn,
outside the pnpm workspace. [apps/kairos/ATLAS.md](apps/kairos/ATLAS.md) lists
what Atlas changed and how to take a new Dossier release.

```bash
cd apps/kairos && yarn install
```

### Icons

After changing an app's icon or accent colour (`packages/ui/src/apps.ts`,
`packages/ui/src/styles.css`), redraw its icons:

```bash
pnpm --filter @atlas/ui icons
```

## License

[GNU Affero General Public License v3.0](LICENSE): the design kit is adapted
from Dossier, which is AGPL-3.0. See [NOTICE](NOTICE) for what comes from where.
