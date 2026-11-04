# Kairos: Dossier with Atlas's patch

This folder is [Dossier](https://github.com/AienTech/dossier) v1.11.0, added
as a git subtree, with a small patch so it joins the Atlas suite. Everything
else is Dossier's own code, docs and tools; its README, DEVELOPMENT.md and
tests apply as they are. It keeps Yarn and its own lockfile, and is left out
of Atlas's pnpm workspace.

## What the patch does

1. **Its name in the sidebar and the browser tab:** Kairos, with its mark
   (the briefcase on gold). The ~190 other mentions of Dossier stay: they name
   the project it's built on (the sign-in page, Settings → About, the Claude
   connector, exported file names).
2. **The app switcher** in the sidebar's header, reading the same variables as
   every Atlas app: `ATLAS_DOMAIN`, `ATLAS_APPS`, `ATLAS_URL_<APP>`.
3. **Signing in with Tailscale.** With `ATLAS_OWNER` set, the login Tailscale
   Serve sends in `Tailscale-User-Login` is signed in without Dossier's
   password, and the sidebar has no "Sign out". A change (POST and so on)
   only counts when the browser says it came from Kairos's own pages: Dossier's
   cookie is SameSite, so other sites couldn't use it, but Tailscale adds its
   header to every request from your devices. Unset, Kairos asks for the
   password as Dossier does.
4. **Atlas's Today:** `GET /api/atlas/today` answers with Dossier's own "Worth
   a look" (interviews today or tomorrow first), readable from Atlas's address
   only.
5. **127.0.0.2:** Atlas runs every app there (deploy/compose.yml says why), so
   the PDF printer opens print pages at that address instead of `localhost`.

## The files

New, all Atlas's:

| File | |
|---|---|
| `src/atlas/apps.ts` | the suite's apps: a copy of `packages/ui/src/apps.ts`, checked against it by packages/ui's tests |
| `src/atlas/app-links.ts` | where each app is, from `ATLAS_*` |
| `src/atlas/app-switcher.tsx` | the switcher and the app marks |
| `src/atlas/atlas.css` | the apps' colours, checked against `packages/ui/src/styles.css` |
| `src/atlas/tailscale.ts` | signing in with Tailscale |
| `src/atlas/today.ts`, `src/app/api/atlas/today/route.ts` | the answer to Atlas's Today |
| `src/atlas/atlas.test.ts` | tests for all of the above, the proxy included |

Changed in Dossier's files, each marked "Atlas's patch":

| File | Change |
|---|---|
| `src/app/layout.tsx` | the tab's title |
| `src/app/(app)/sidebar.tsx` | name, mark, switcher; no "Sign out" through Tailscale |
| `src/app/globals.css` | imports `src/atlas/atlas.css` |
| `src/app/icon.svg`, `src/app/apple-icon.png` | Kairos's icons, drawn by `pnpm --filter @atlas/ui icons` |
| `src/app/favicon.ico` | deleted, so browsers use `icon.svg` |
| `src/lib/auth/session.ts` | `getSession()` also accepts Tailscale |
| `src/proxy.ts` | the proxy also lets you in through Tailscale |
| `src/lib/pdf/render.ts` | prints from the loopback address it listens on |
| `src/lib/session-audit.test.ts` | lists the Today route among the routes that check the session themselves |

## Updating to a new Dossier release

From the repository's root, with the release's tag:

```bash
git subtree pull --prefix apps/kairos https://github.com/AienTech/dossier v1.12.0 --squash
```

Conflicts can only be in the changed files above. Then, in this folder, with
Node.js 24 (Dossier needs it):

```bash
yarn install
```

```bash
yarn typecheck && yarn test
```

`yarn test` needs a Postgres for its database tests (see DEVELOPMENT.md); at
v1.11.0 with the patch it runs 1,800-odd tests. Then rebuild the stack:
`docker compose up -d --build` in `deploy`.
