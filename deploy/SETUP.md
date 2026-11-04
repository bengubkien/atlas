# Setting up Atlas

From a fresh computer to the apps on your phone, in about half an hour, most
of it downloads. Written for your Windows desktop; [Moving to another
computer](#moving-to-another-computer) covers the move to the mini PC, and the
same steps work on Linux.

You need:

- **Docker Desktop** for Windows, with its default WSL 2 backend. In its
  **Settings → General**, turn on **Start Docker Desktop when you sign in**,
  so the apps come back by themselves after a restart. Atlas needs about 4 GB
  of memory and 10 GB of disk.
- **Git for Windows**, to download Atlas and update it.
- **Tailscale** on this computer and on your phone, both signed in to the same
  account.

Run the commands below in **PowerShell** (Windows Terminal opens it).

**Sleep:** while Windows sleeps, the apps can't be reached. If you want them
available whenever the desktop is on, set **Settings → System → Power → Screen,
sleep and hibernate timeouts → Make my device sleep after** to **Never** when
plugged in. The screen can still turn off.

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

```powershell
git clone https://github.com/bengubkien/atlas.git
```

```powershell
cd atlas\deploy
```

```powershell
copy .env.example .env
```

```powershell
notepad .env
```

Fill in `ATLAS_OWNER`, `ATLAS_DOMAIN`, `TS_AUTHKEY` and `TZ` from above (for
`TZ`, your zone's name, like `Europe/Madrid`). Then the secrets: each command
prints one line to paste after the `=`.

`POSTGRES_PASSWORD`:

```powershell
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

`DOSSIER_SECRET`:

```powershell
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`DOSSIER_PASSWORD`: this asks for the password you'll sign in to Kairos with,
twice, and prints its hash, a line starting with `argon2id:`:

```powershell
docker run --rm -it --platform linux/amd64 ghcr.io/aientech/dossier:v1.11.0 hash-password
```

Save `.env` and close Notepad.

## 3. Start it

```powershell
docker compose up -d --build
```

The first start downloads about 2 GB and builds the launcher. Then open
`https://atlas.<your tailnet>.ts.net` on this computer or your phone, with
Tailscale on. The very first visit to each app can take a few seconds while
its certificate is issued.

Kairos asks for its own password (the one you hashed) until its patch lets
Tailscale sign you in; tick **Keep me signed in** and it asks once a month.

## 4. Put the apps on your phone

Open an app in the phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** the menu → **Install app**.

They open full screen, like any app. Tailscale has to be on to reach them.

## 5. Local AI on your graphics card (optional for now)

Kairos can write with a model running on your GTX 1080 instead of a hosted
one, and Hygeia's lab reader (phase 4) will read reports with one, so your
documents never leave the desktop. The card's 8 GB holds models of about 8
billion parameters.

1. **Driver:** install the newest NVIDIA driver in the **580 series**,
   582.78 or later, from [NVIDIA's driver
   page](https://www.nvidia.com/en-us/drivers/). It's the last series that
   supports GeForce 10 cards; newer series don't. Earlier 580 drivers make
   Ollama 0.40.13 fail with "the provided PTX was compiled with an unsupported
   toolchain".
2. **Ollama:** install it for Windows from [ollama.com](https://ollama.com).
   It runs in the tray and starts with Windows.
3. **A model for Kairos**, e.g. Dossier's default (Dossier's [Choosing an AI
   provider](https://github.com/AienTech/dossier/wiki/Choosing-an-AI-provider)
   compares others):

   ```powershell
   ollama pull llama3.1:8b
   ```

4. **Check it runs on the card:** start it once, then look at the
   `PROCESSOR` column, which should say `100% GPU`:

   ```powershell
   ollama run llama3.1:8b "Say hello"
   ```

   ```powershell
   ollama ps
   ```

5. **Point Kairos at it:** in Kairos, **Settings → AI provider**: Local,
   address `http://host.docker.internal:11434`, model `llama3.1:8b`.

If Kairos can't reach Ollama, open **Edit environment variables for your
account** from the Start menu, add `OLLAMA_HOST` with the value `0.0.0.0`,
then quit Ollama from the tray and start it again. If Windows Firewall asks,
allow **Private networks** only.

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

1. On the desktop, in `atlas\deploy`, stop the stack and save each volume to a
   file there:

   ```powershell
   docker compose stop
   ```

   ```powershell
   foreach ($v in "pgdata","kairos-data","tailscale-atlas","tailscale-kairos") { docker run --rm -v "atlas_${v}:/from" -v "${PWD}:/to" alpine tar czf "/to/$v.tgz" -C /from . }
   ```

2. Copy the `atlas` folder, with `deploy/.env` and the `.tgz` files, to the
   new computer.
3. On the new one, in `atlas/deploy`, load them back, then start. On Linux:

   ```bash
   for v in pgdata kairos-data tailscale-atlas tailscale-kairos; do docker volume create atlas_$v && docker run --rm -v atlas_$v:/to -v "$PWD":/from alpine tar xzf /from/$v.tgz -C /to; done
   ```

   ```bash
   docker compose up -d --build
   ```

Never run both computers' stacks at once: they'd claim the same names.

Your graphics card stays in the desktop. [PLAN.md](../PLAN.md#ai) says how
the AI parts keep working after the move.

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
- **`docker compose` says it can't connect:** Docker Desktop isn't running;
  start it from the Start menu and wait for it to say it's running.
