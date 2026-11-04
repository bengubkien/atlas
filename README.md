# Atlas

A private suite of web apps for one person, self-hosted behind Tailscale, that
look and work as one product: one design, one switcher between them, no
separate sign-ins.

| App | For | Status |
|---|---|---|
| **Atlas** | The launcher: every app in one place | Ready |
| **Kairos** | Job search, on [Dossier](https://github.com/AienTech/dossier) | Runs as stock Dossier; its patch is phase 5 |
| **Hestia** | House maintenance, on [micasa](https://github.com/micasa-dev/micasa) | Phase 1 |
| **Milo** | Gym | Phase 2 |
| **Hygeia** | Health | Phases 3–4 |

- **[PLAN.md](PLAN.md):** the design, the decisions behind it and the phases.
- **[deploy/SETUP.md](deploy/SETUP.md):** from a fresh computer to the apps on your phone.

## Repository

```
packages/ui/    @atlas/ui: the design kit taken from Dossier (tokens, fonts,
                components), the app shell for desktop and phone, the app switcher
apps/atlas/     the launcher
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

After changing an app's icon or accent colour (`packages/ui/src/apps.ts`,
`packages/ui/src/styles.css`), redraw its icons:

```bash
pnpm --filter @atlas/ui icons
```

## License

[GNU Affero General Public License v3.0](LICENSE): the design kit is adapted
from Dossier, which is AGPL-3.0. See [NOTICE](NOTICE) for what comes from where.
