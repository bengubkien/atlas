# Setting up Atlas

From a fresh computer to the apps on your phone. It takes about half an hour,
most of it downloads. The same steps work on your desktop now and on the mini
PC later; [Moving to another computer](#moving-to-another-computer) covers the
move itself.

You need:

- **Docker:** [Docker Desktop](https://docs.docker.com/desktop/) on Windows
  (with the WSL 2 backend) or macOS, or Docker Engine with the Compose plugin
  on Linux. About 4 GB of free memory and 10 GB of disk.
- **A Tailscale account**, free for personal use, with the Tailscale app on
  this computer and on your phone, both signed in.

Kairos's image is built for Intel and AMD processors. On an Apple Silicon Mac
it runs under emulation, more slowly.

## 1. Prepare your tailnet

In the [Tailscale admin console](https://login.tailscale.com/admin):

1. **DNS:** check that **MagicDNS** is on, and turn on **HTTPS Certificates**.
   Note your **tailnet DNS name** near the top of the page, like
   `tail1234.ts.net`. That's `ATLAS_DOMAIN`.
2. **Access controls:** let yourself own the tag the apps run under. In the
   policy file, add `tag:atlas` to `tagOwners` (create the section if it isn't
   there), then save:

   ```json
   "tagOwners": {
     "tag:atlas": ["autogroup:admin"]
   },
   ```

   Tagged devices don't need to be signed in again every 180 days, the way
   your own devices do.
3. **Settings → Keys → Generate auth key:** turn on **Reusable**, and under
   **Tags** pick `tag:atlas`. Copy the key (`tskey-auth-…`). That's
   `TS_AUTHKEY`. It's only used when an app first joins; after that each app
   stays on your tailnet even when the key expires.

Your Tailscale login, as shown under **Users**, is `ATLAS_OWNER`.

## 2. Get Atlas and fill in `.env`

```bash
git clone https://github.com/bengubkien/atlas.git
```

```bash
cd atlas/deploy
```

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in `ATLAS_OWNER`, `ATLAS_DOMAIN`,
`TS_AUTHKEY` and `TZ` from above. Then the secrets: each command prints one
line to paste after the `=`. They only need Docker, so they work the same on
Windows, macOS and Linux.

`POSTGRES_PASSWORD`:

```bash
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

`DOSSIER_SECRET`:

```bash
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`DOSSIER_PASSWORD`: this asks for the password you'll sign in to Kairos with,
twice, and prints its hash, a line starting with `argon2id:`:

```bash
docker run --rm -it --platform linux/amd64 ghcr.io/aientech/dossier:v1.11.0 hash-password
```

## 3. Start it

```bash
docker compose up -d --build
```

The first start downloads about 2 GB and builds the launcher. Then open
`https://atlas.<your tailnet>.ts.net` on this computer or your phone, with
Tailscale on. The very first visit to each app can take a few seconds while
its certificate is issued.

Kairos asks for its own password (the one you hashed) until its patch lets
Tailscale sign you in; tick **Keep me signed in** and it asks once a month.

**Starting with the computer:** the apps restart by themselves whenever Docker
does. On Windows and macOS, turn on Docker Desktop's **Start Docker Desktop
when you sign in**.

## 4. Put the apps on your phone

Open an app in the phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** the menu → **Install app**.

They open full screen, like any app. Tailscale has to be on to reach them.

## Day to day

From the `deploy` folder:

| To | Run |
|---|---|
| See what's running | `docker compose ps` |
| Read an app's log | `docker compose logs -f atlas` (or `kairos`, `atlas-tailscale`, …) |
| Stop everything, keeping your data | `docker compose stop` |
| Start again | `docker compose start` |
| Update Atlas | `git pull`, then `docker compose up -d --build` |
| Update Kairos | set `DOSSIER_VERSION` in `.env`, then `docker compose up -d` |

## Moving to another computer

Your data and each app's place on your tailnet live in Docker volumes. Copy
them over, and the addresses stay the same.

1. On the old computer: `docker compose stop`, then save each volume to a file
   in the current folder:

   ```bash
   for v in pgdata kairos-data tailscale-atlas tailscale-kairos; do docker run --rm -v atlas_$v:/from -v "$PWD":/to alpine tar czf /to/$v.tgz -C /from .; done
   ```

2. Copy the `atlas` folder, with `deploy/.env` and the `.tgz` files, to the
   new computer.
3. On the new one, in `atlas/deploy`, load them back, then start:

   ```bash
   for v in pgdata kairos-data tailscale-atlas tailscale-kairos; do docker volume create atlas_$v && docker run --rm -v atlas_$v:/to -v "$PWD":/from alpine tar xzf /from/$v.tgz -C /to; done
   ```

   ```bash
   docker compose up -d --build
   ```

Never run both computers' stacks at once: they'd claim the same names.
(On Windows, run these in WSL or Git Bash.)

## When something's wrong

- **"Not for you":** `ATLAS_OWNER` doesn't match the Tailscale login you're
  using. Check it under **Users** in the admin console, fix `.env`, then
  `docker compose up -d`.
- **The address doesn't open:** check Tailscale is on, then
  `docker compose logs atlas-tailscale`. An expired or untagged auth key, or a
  missing `tagOwners` entry, shows there.
- **An app is at `atlas-1.…` instead of `atlas.…`:** a device called `atlas`
  was already on your tailnet. Remove the old one under **Machines**, then
  `docker compose restart atlas-tailscale`.
