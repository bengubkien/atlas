# Atlas

A private suite of web apps for one person, self-hosted behind Tailscale, that
look and work as one product: one design, one switcher between them, no
separate sign-ins.

| App | For | Status |
|---|---|---|
| **Atlas** | The launcher: every app in one place | Ready |
| **Kairos** | Job search, on [Dossier](https://github.com/AienTech/dossier) | Runs as stock Dossier; its patch is phase 5 |
| **Hestia** | House maintenance, on [micasa](https://github.com/micasa-dev/micasa) | Ready; see PLAN.md for what's still to do |
| **Milo** | Gym, working offline on the phone | Ready; see PLAN.md for what's still to do |
| **Hygeia** | Health, working offline on the phone | Ready, without the lab reader (phase 4) |

- **[PLAN.md](PLAN.md):** the design, the decisions behind it and the phases.
- **[deploy/SETUP.md](deploy/SETUP.md):** from a fresh computer to the apps on your phone.

## Repository

```
packages/ui/    @atlas/ui: the design kit taken from Dossier (tokens, fonts,
                components, charts), the app shell for desktop and phone, the app switcher
packages/sync/  @atlas/sync: offline-first sync for Milo and Hygeia
apps/atlas/     the launcher
apps/hestia/    the house, on micasa's engine
apps/milo/      the gym, offline-first, syncing through Postgres
apps/hygeia/    health, offline-first, with a calendar feed for reminders
deploy/         the Docker Compose stack, Tailscale Serve config, setup guide
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

### The sync engine

`packages/sync`'s tests run the server against a real Postgres and two devices
through it; give them a Postgres to make a throwaway database in, or they're
skipped:

```bash
ATLAS_TEST_POSTGRES=postgres://user:password@localhost:5432/postgres pnpm --filter @atlas/sync test
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
