#!/bin/sh
set -eu

: "${RESTIC_REPOSITORY:=/backup/restic-repository}"
: "${RESTIC_PASSWORD_FILE:=/run/secrets/restic-password}"
: "${RESTIC_CACHE_DIR:=/tmp/restic-cache}"
: "${BACKUP_SCHEDULE:=30 2 * * *}"
: "${BACKUP_TIMEZONE:=Europe/Rome}"

export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE RESTIC_CACHE_DIR TZ="$BACKUP_TIMEZONE"

mkdir -p /backup/state /backup/restic-repository "$RESTIC_CACHE_DIR"

if [ "${1:-}" = "run" ] || [ "${1:-}" = "check" ] || [ "${1:-}" = "snapshots" ] || [ "${1:-}" = "restore" ] || [ "${1:-}" = "restore-live" ]; then
  exec /usr/local/bin/backup.sh "$@"
fi

if [ ! -s "$RESTIC_PASSWORD_FILE" ]; then
  echo "Restic-Passwort fehlt: $RESTIC_PASSWORD_FILE" >&2
  exit 1
fi

if [ "${BACKUP_RUN_ON_START:-false}" = "true" ]; then
  /usr/local/bin/backup.sh run
fi

# BusyBox cron uses the container timezone. BACKUP_TIMEZONE is exported above
# so the schedule follows the configured local time instead of UTC.
printf '%s /usr/local/bin/backup.sh run\n' "$BACKUP_SCHEDULE" > /etc/crontabs/root
printf '0 4 * * 0 /usr/local/bin/backup.sh check\n' >> /etc/crontabs/root

echo "Backup-Service aktiv; täglicher Lauf: $BACKUP_SCHEDULE ($BACKUP_TIMEZONE)"
exec crond -f -l 2
