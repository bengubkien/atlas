# The backup service (PLAN.md, "Backups"; atlas-backup.sh says what it does).
# Postgres's own image, so pg_dump and pg_restore are always the server's
# version; sqlite3 copies Hestia's house, and GnuPG locks the archive.
FROM postgres:18-alpine
RUN apk add --no-cache gnupg sqlite tzdata
COPY atlas-backup.sh /usr/local/bin/atlas-backup
RUN chmod 755 /usr/local/bin/atlas-backup
ENTRYPOINT ["atlas-backup"]
CMD ["schedule"]
