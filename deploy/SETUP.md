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
`TZ`, your zone's name, like `Europe/Madrid`), and `ATLAS_LOCALE` and
`ATLAS_CURRENCY` for how dates and amounts are written. Set the currency now:
Hestia's database keeps the one it starts with. Then the secrets: each command
prints one line to paste after the `=`.

`POSTGRES_PASSWORD`:

```powershell
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

`DOSSIER_SECRET`:

```powershell
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`DOSSIER_PASSWORD`: Tailscale signs you in to Kairos like every other app, but
Kairos (Dossier underneath) won't start without a password of its own, for if
you ever turn Tailscale's sign-in off. This asks for one, twice, and prints its
hash, a line starting with `argon2id:`:

```powershell
docker run --rm -it --platform linux/amd64 ghcr.io/aientech/dossier:v1.11.0 hash-password
```

`ATLAS_BACKUP_PASSPHRASE`: a passphrase of your own that locks every backup.
Save it in your password manager first: without it, nobody can open the
backups, you included.

`ATLAS_BACKUP_DIR`: the folder the backups go to, such as an external drive
(`D:\Backups\Atlas`) or a folder your cloud storage syncs
(`C:\Users\you\OneDrive\Atlas backups`). Leave it empty and they go to
`atlas\deploy\backups`, on the same disk as everything else, which won't
help if that disk fails. [Backups](#backups) says more.

Save `.env` and close Notepad.

## 3. Start it

```powershell
docker compose up -d --build
```

The first start downloads a few gigabytes and builds every app, Kairos
included (with a copy of Chromium, which prints its PDFs), so it can take a
quarter of an hour or more; later starts take seconds.
Then open `https://atlas.<your tailnet>.ts.net` on this computer or your
phone, with Tailscale on. The very first visit to each app can take a few
seconds while its certificate is issued.

The launcher shows **Today** from every app, then the apps themselves.
Tailscale signs you in everywhere, so there's no password to type.

## 4. Put the apps on your phone

Open an app in the phone's browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** the menu → **Install app**.

They open full screen, like any app. Tailscale has to be on to reach them. Each app is at `https://<app>.<your
tailnet>.ts.net`: Tyche, for money, is at `https://tyche.<your tailnet>.ts.net`.

**Milo, Hygeia and Tyche work without the server.** Open each once while the server
is on, and the phone keeps a copy of the app and of your data: with the
desktop off (or Tailscale off), they still open, and what you log waits on the
phone and syncs by itself when the server is back. Their Settings screens say
what's waiting. On an iPhone, add them to the Home Screen: Safari clears the
data of websites you haven't opened for a while, but not of apps on the Home
Screen.

**Tyche's exchange rates:** its server fetches the day's dollar quotes a few
times a day from DolarApi, and your devices get them when they sync, so
converting works offline too. To turn that off and type the rates in
yourself, add `TYCHE_RATES_URL=` (empty) to `.env`, then
`docker compose up -d`.

**Reminders for medications and appointments** come through your phone's
calendar: in Hygeia, open **Medications** and use **Subscribe on this device**
(on an iPhone, in Safari). The calendar keeps the events and their alerts, so
they ring even while the desktop is off; it checks Hygeia for changes every few
hours while Tailscale is on. On Android, add the address from Hygeia's
Settings in Google Calendar on a computer: **Other calendars → From URL**.

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
| Read an app's log | `docker compose logs -f atlas` (or `kairos`, `tyche`, `atlas-tailscale`, …) |
| Stop everything, keeping your data | `docker compose stop` |
| Start again | `docker compose start` |
| Update Atlas, Kairos included | `git pull`, then `docker compose up -d --build` |
| Back up now | `docker compose exec backup atlas-backup now` |
| See the backups | `docker compose exec backup atlas-backup list` |

## Updating an install that already has data

A new app can need a new database. Postgres only runs `databases.sql` the
first time, on an empty data volume, so an install made before Tyche existed
doesn't have the `tyche` database. Make it once, by hand, from the `deploy`
folder (the database user is `atlas`):

```powershell
docker compose exec db createdb -U atlas tyche
```

Then `git pull` and `docker compose up -d --build`. Add `tyche` to
`ATLAS_APPS` in `.env` too, or the launcher shows it as "Not running yet".

## Backups

The `backup` service makes one archive of everything: the databases of
Kairos, Milo, Hygeia and Tyche, Hestia's house (its documents included) and
your `.env`. Each archive is
locked with `ATLAS_BACKUP_PASSPHRASE` and named by when it was made, like
`atlas-2026-11-04-0930.tar.gpg`, in `ATLAS_BACKUP_DIR`.

- **When:** whenever the last one is a day old, checked every hour the
  computer is on. If the desktop was off all day, the backup is made soon
  after it starts. `ATLAS_BACKUP_EVERY_HOURS` changes how often.
- **How long:** 30 days (`ATLAS_BACKUP_KEEP_DAYS`), and the newest three are
  never deleted, however old.
- **Is it working?** `docker compose logs backup` says when each one was made,
  or why one failed.

Changing `ATLAS_BACKUP_PASSPHRASE` later is fine, but older backups stay
locked with the old one.

### Putting everything back

From the `deploy` folder:

1. Stop the apps, so nothing writes while their data is put back:

   ```powershell
   docker compose stop kairos hestia milo hygeia tyche
   ```

2. Pick a backup:

   ```powershell
   docker compose exec backup atlas-backup list
   ```

3. Put it back (with its name from the list):

   ```powershell
   docker compose exec backup atlas-backup restore atlas-2026-11-04-0930.tar.gpg
   ```

4. Start the apps again:

   ```powershell
   docker compose start
   ```

What you logged on your phone in Milo, Hygeia or Tyche after that backup isn't lost:
the next time the phone syncs, it sees the server was restored and sends
everything it has again. Open each app once on each phone to let it.

### If this computer is gone

The archives are standard OpenPGP files: any GnuPG opens one (on Windows,
[Gpg4win](https://gpg4win.org)), asking for the passphrase. Inside, `env` is
your old `.env`. On the new computer, follow this guide up to step 2, using
that `env` as your `.env`. Then start only the database and the backup
service, restore as above, and start everything:

```powershell
docker compose up -d --build db backup
```

```powershell
docker compose exec backup atlas-backup restore atlas-2026-11-04-0930.tar.gpg
```

```powershell
docker compose up -d --build
```

The apps join your tailnet afresh: remove the old computer's `atlas`,
`kairos`, `hestia`, `milo`, `hygeia` and `tyche` under **Machines** in the admin console
first, so the new ones get the same names.

## Moving to another computer

Your data and each app's place on your tailnet live in Docker volumes. Copy
them over, and the addresses stay the same.

1. On the desktop, in `atlas\deploy`, stop the stack and save each volume to a
   file there:

   ```powershell
   docker compose stop
   ```

   ```powershell
   foreach ($v in "pgdata","kairos-data","hestia-data","tailscale-atlas","tailscale-kairos","tailscale-hestia","tailscale-milo","tailscale-hygeia","tailscale-tyche") { docker run --rm -v "atlas_${v}:/from" -v "${PWD}:/to" alpine tar czf "/to/$v.tgz" -C /from . }
   ```

2. Copy the `atlas` folder, with `deploy/.env` and the `.tgz` files, to the
   new computer.
3. On the new one, in `atlas/deploy`, load them back, then start. On Linux:

   ```bash
   for v in pgdata kairos-data hestia-data tailscale-atlas tailscale-kairos tailscale-hestia tailscale-milo tailscale-hygeia tailscale-tyche; do docker volume create atlas_$v && docker run --rm -v atlas_$v:/to -v "$PWD":/from alpine tar xzf /from/$v.tgz -C /to; done
   ```

   ```bash
   docker compose up -d --build
   ```

Never run both computers' stacks at once: they'd claim the same names.

Your graphics card stays in the desktop. [PLAN.md](../PLAN.md#ai) says how
the AI parts keep working after the move.

## When something's wrong

- **"Not for you", or Kairos asks for a password:** `ATLAS_OWNER` doesn't match
  the Tailscale login you're using. Check it under **Users** in the admin
  console, fix `.env`, then `docker compose up -d`.
- **No backups appear:** `docker compose logs backup` says why. Check that
  `ATLAS_BACKUP_DIR` is a folder that exists.
- **The address doesn't open:** check Tailscale is on, then
  `docker compose logs atlas-tailscale`. An expired or untagged auth key, or a
  missing `tagOwners` entry, shows there.
- **An app is at `atlas-1.…` instead of `atlas.…`:** a device called `atlas`
  was already on your tailnet. Remove the old one under **Machines**, then
  `docker compose restart atlas-tailscale`.
- **`docker compose` says it can't connect:** Docker Desktop isn't running;
  start it from the Start menu and wait for it to say it's running.
