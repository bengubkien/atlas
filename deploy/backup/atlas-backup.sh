#!/bin/sh
# Atlas's backups (PLAN.md, "Backups"; SETUP.md says how to use them).
#
# One archive holds everything: a pg_dump of each database (Kairos, Milo,
# Hygeia), a copy of Hestia's house (micasa's SQLite file, documents
# included), and your settings file (.env). It's locked with your passphrase
# (ATLAS_BACKUP_PASSPHRASE; OpenPGP, so any GnuPG can open it too) and
# written to the folder you chose (ATLAS_BACKUP_DIR).
#
#   atlas-backup schedule        what the service runs: a backup whenever the
#                                last one is ATLAS_BACKUP_EVERY_HOURS old,
#                                checked every hour the computer is on
#   atlas-backup now             one backup, now
#   atlas-backup list            the backups in the folder
#   atlas-backup restore FILE    puts the databases and the house back from FILE
#   atlas-backup show-env FILE   prints the settings file kept in FILE
set -eu

# Where things are in the container (compose.yml mounts them there).
BACKUPS=${BACKUPS:-/backups}
HESTIA_DB=${HESTIA_DB:-/hestia/micasa.db}
ENV_FILE=${ENV_FILE:-/config/env}
DATABASES="kairos milo hygeia"
EVERY_HOURS=${ATLAS_BACKUP_EVERY_HOURS:-24}
KEEP_DAYS=${ATLAS_BACKUP_KEEP_DAYS:-30}
# However old they are, the newest few are never deleted.
KEEP_AT_LEAST=3

export PGHOST="${PGHOST:-db}" PGUSER="${PGUSER:-atlas}" PGPASSWORD="${POSTGRES_PASSWORD:-}"

say() { echo "$(date '+%Y-%m-%d %H:%M') $*"; }
fail() {
  echo "$*" >&2
  exit 1
}

WORK=""
cleanup() { [ -n "$WORK" ] && rm -rf "$WORK"; WORK=""; }
trap cleanup EXIT
trap 'cleanup; exit 143' INT TERM

# gpg reads the passphrase from a file only this process can read, never
# from its command line, where other processes could see it.
gpg_with_passphrase() {
  [ -n "${ATLAS_BACKUP_PASSPHRASE:-}" ] || fail "ATLAS_BACKUP_PASSPHRASE isn't set. Set it in deploy/.env (see SETUP.md)."
  export GNUPGHOME="$WORK/gnupg"
  (
    umask 077
    mkdir -p "$GNUPGHOME"
    printf '%s' "$ATLAS_BACKUP_PASSPHRASE" > "$WORK/passphrase"
  )
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$WORK/passphrase" "$@"
}

# The archives, oldest first: their names sort by date.
archives() { find "$BACKUPS" -maxdepth 1 -type f -name 'atlas-*.tar.gpg' | sort; }

# When an archive was made, in seconds, from its name (atlas-2026-11-04-2130.tar.gpg);
# the name survives being copied, which a file's date may not.
made_at() {
  stamp=$(basename "$1" .tar.gpg | sed -n 's/^atlas-\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)-\([0-9]\{2\}\)\([0-9]\{2\}\)$/\1 \2:\3/p')
  [ -n "$stamp" ] && date -d "$stamp" +%s 2>/dev/null || echo 0
}

due() {
  newest=$(archives | tail -n 1)
  [ -z "$newest" ] && return 0
  [ $(($(date +%s) - $(made_at "$newest"))) -ge $((EVERY_HOURS * 3600)) ]
}

backup() {
  WORK=$(mktemp -d /tmp/atlas-backup.XXXXXX)
  stamp=$(date +%Y-%m-%d-%H%M)
  name="atlas-$stamp"
  dir="$WORK/$name"
  mkdir "$dir"

  for db in $DATABASES; do
    pg_dump --format=custom --dbname="$db" --file="$dir/$db.dump"
  done
  if [ -f "$HESTIA_DB" ]; then
    # SQLite's own online backup: a consistent copy even while Hestia writes,
    # waiting up to 30 s for micasa to finish a command.
    sqlite3 -cmd ".timeout 30000" "$HESTIA_DB" ".backup '$dir/hestia.db'"
    [ "$(sqlite3 "$dir/hestia.db" 'pragma integrity_check')" = "ok" ] || fail "The copy of Hestia's house didn't check out."
  else
    say "Hestia has no house yet ($HESTIA_DB); the backup has none."
  fi
  if [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" "$dir/env"; fi

  {
    echo "Atlas backup, $(date '+%Y-%m-%d %H:%M %Z')"
    echo
    for db in $DATABASES; do echo "$db.dump    the $db database (pg_dump, custom format)"; done
    if [ -f "$dir/hestia.db" ]; then echo "hestia.db      Hestia's house: micasa's database, documents included"; fi
    if [ -f "$dir/env" ]; then echo "env            deploy/.env, your settings and secrets"; fi
  } > "$dir/README.txt"

  tar -cf "$WORK/$name.tar" -C "$WORK" "$name"
  gpg_with_passphrase --symmetric --cipher-algo AES256 --output "$WORK/$name.tar.gpg" "$WORK/$name.tar"
  # Into the folder under a temporary name first, so a half-written file is
  # never taken for a backup (a cloud folder may sync it as it's written).
  cp "$WORK/$name.tar.gpg" "$BACKUPS/.$name.tar.gpg.part"
  # Locked already, so anyone on the computer may copy it (you, without sudo).
  chmod 644 "$BACKUPS/.$name.tar.gpg.part"
  mv "$BACKUPS/.$name.tar.gpg.part" "$BACKUPS/$name.tar.gpg"
  size=$(du -h "$BACKUPS/$name.tar.gpg" | cut -f1)
  cleanup
  say "Backed up to $name.tar.gpg ($size)."
  prune
}

prune() {
  count=$(archives | wc -l)
  cutoff=$(($(date +%s) - KEEP_DAYS * 86400))
  archives | head -n "$((count > KEEP_AT_LEAST ? count - KEEP_AT_LEAST : 0))" | while read -r old; do
    if [ "$(made_at "$old")" -lt "$cutoff" ]; then
      rm -f "$old"
      say "Deleted $(basename "$old"), older than $KEEP_DAYS days."
    fi
  done
}

# Unlocks the archive a command names (a path, or a name in the backups
# folder) into $WORK, and sets FILE to it and DIR to the folder it holds.
open_archive() {
  [ -n "${1:-}" ] || fail "Which backup? Give its file name; 'atlas-backup list' shows them."
  case "$1" in
    */*) FILE="$1" ;;
    *) FILE="$BACKUPS/$1" ;;
  esac
  [ -f "$FILE" ] || fail "There's no backup at $FILE."
  WORK=$(mktemp -d /tmp/atlas-restore.XXXXXX)
  if ! gpg_with_passphrase --decrypt --output "$WORK/backup.tar" "$FILE" 2>/dev/null; then
    fail "Couldn't open $(basename "$FILE"): the passphrase isn't the one it was made with, or the file is damaged."
  fi
  tar -xf "$WORK/backup.tar" -C "$WORK"
  rm "$WORK/backup.tar"
  DIR=$(find "$WORK" -mindepth 1 -maxdepth 1 -type d -name 'atlas-*' | head -n 1)
  [ -n "$DIR" ] || fail "$(basename "$FILE") isn't an Atlas backup."
}

restore() {
  # Restoring under a running app would mix old and new data: refuse while
  # any app is connected to its database.
  busy=$(psql --dbname=postgres --tuples-only --no-align --command \
    "select string_agg(distinct datname, ', ') from pg_stat_activity where datname in ('kairos','milo','hygeia') and pid <> pg_backend_pid()")
  [ -z "$busy" ] || fail "Stop the apps first, so nothing writes while their data is put back (in use: $busy):
  docker compose stop kairos hestia milo hygeia"

  open_archive "${1:-}"
  dir=$DIR
  say "Restoring from $(basename "$FILE")."

  for db in $DATABASES; do
    [ -f "$dir/$db.dump" ] || continue
    pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$db" "$dir/$db.dump"
    say "Put back the $db database."
  done
  # Milo's and Hygeia's devices ask for "every change after N". After a
  # restore the server's N is back where it was at the backup, behind what
  # the devices last saw, so jump ahead of them: their next sync then gets
  # every change made from now on.
  for db in milo hygeia; do
    has=$(psql --dbname="$db" --tuples-only --no-align --command "select to_regclass('public.records_seq') is not null")
    if [ "$has" = "t" ]; then
      psql --quiet --dbname="$db" --command \
        "select setval('records_seq', coalesce((select max(seq) from records), 0) + 1000000)" > /dev/null
    fi
  done

  if [ -f "$dir/hestia.db" ]; then
    owner=$(stat -c '%u:%g' "$(dirname "$HESTIA_DB")")
    rm -f "$HESTIA_DB" "$HESTIA_DB-wal" "$HESTIA_DB-shm"
    cp "$dir/hestia.db" "$HESTIA_DB"
    chown "$owner" "$HESTIA_DB"
    say "Put back Hestia's house."
  fi
  if [ -f "$dir/env" ]; then
    say "The backup also holds your settings file: 'atlas-backup show-env $(basename "$FILE")' prints it."
  fi
  cleanup
  say "Done. Start the apps again: docker compose start"
}

case "${1:-schedule}" in
  schedule)
    [ -n "${ATLAS_BACKUP_PASSPHRASE:-}" ] || fail "ATLAS_BACKUP_PASSPHRASE isn't set. Set it in deploy/.env (see SETUP.md)."
    say "Backing up every $EVERY_HOURS hours while this computer is on, keeping $KEEP_DAYS days."
    until pg_isready --quiet; do sleep 5; done
    while :; do
      # Each backup is its own run of this script, so any step that fails
      # stops that backup, not the schedule.
      if due; then sh "$0" now || say "The backup failed (see above); trying again in an hour."; fi
      # In the background, so stopping the service doesn't wait out the hour.
      sleep 3600 &
      wait $!
    done
    ;;
  now) backup ;;
  list)
    archives | while read -r file; do
      printf '%s  %s\n' "$(du -h "$file" | cut -f1)" "$(basename "$file")"
    done
    ;;
  restore) restore "${2:-}" ;;
  show-env)
    open_archive "${2:-}"
    [ -f "$DIR/env" ] || fail "That backup has no settings file."
    cat "$DIR/env"
    ;;
  *) fail "Use: atlas-backup schedule | now | list | restore FILE | show-env FILE" ;;
esac
