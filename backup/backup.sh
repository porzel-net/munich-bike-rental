#!/bin/sh
set -eu

SOURCE_DIR=${SOURCE_DIR:-/source}
RADICALE_SOURCE_DIR=${RADICALE_SOURCE_DIR:-/radicale-source}
BACKUP_DIR=${BACKUP_DIR:-/backup}
RESTIC_REPOSITORY=${RESTIC_REPOSITORY:-$BACKUP_DIR/restic-repository}
RESTIC_PASSWORD_FILE=${RESTIC_PASSWORD_FILE:-/run/secrets/restic-password}
RESTIC_CACHE_DIR=${RESTIC_CACHE_DIR:-/tmp/restic-cache}
RESTIC_TAG=${RESTIC_TAG:-bikerental-full}
RESTORE_DIR=${RESTORE_DIR:-$BACKUP_DIR/restore}

export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE RESTIC_CACHE_DIR

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "FEHLER: $*" >&2
  exit 1
}

require_runtime() {
  [ -s "$RESTIC_PASSWORD_FILE" ] || fail "Restic-Passwort fehlt: $RESTIC_PASSWORD_FILE"
  mkdir -p "$BACKUP_DIR/state" "$RESTIC_REPOSITORY" "$RESTIC_CACHE_DIR"
}

ensure_repository() {
  if [ ! -f "$RESTIC_REPOSITORY/config" ]; then
    log "Initialisiere verschlüsseltes Restic-Repository: $RESTIC_REPOSITORY"
    restic init
  fi
}

copy_optional_directory() {
  name=$1
  source_path="$SOURCE_DIR/$name"
  target_path="$STAGING_DIR/$name"
  if [ -d "$source_path" ]; then
    mkdir -p "$target_path"
    cp -a "$source_path/." "$target_path/"
  fi
}

copy_external_directory() {
  name=$1
  source_path=$2
  target_path="$STAGING_DIR/$name"
  if [ -d "$source_path" ]; then
    mkdir -p "$target_path"
    cp -a "$source_path/." "$target_path/"
  fi
}

create_manifest() {
  database_sha256=$(sha256sum "$STAGING_DIR/bikerental.db" | awk '{print $1}')
  document_count=0
  whatsapp_file_count=0
  if [ -d "$STAGING_DIR/financial-documents" ]; then
    document_count=$(find "$STAGING_DIR/financial-documents" -type f | wc -l | tr -d ' ')
  fi
  if [ -d "$STAGING_DIR/whatsapp-auth" ]; then
    whatsapp_file_count=$(find "$STAGING_DIR/whatsapp-auth" -type f | wc -l | tr -d ' ')
  fi
  radicale_file_count=0
  if [ -d "$STAGING_DIR/radicale-data" ]; then
    radicale_file_count=$(find "$STAGING_DIR/radicale-data" -type f | wc -l | tr -d ' ')
  fi
  migration_count=$(sqlite3 "$STAGING_DIR/bikerental.db" \
    "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations';" 2>/dev/null || printf '0')

  cat > "$STAGING_DIR/manifest.json" <<EOF
{
  "format": 1,
  "createdAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "databaseSha256": "$database_sha256",
  "financialDocumentFiles": $document_count,
  "whatsappAuthFiles": $whatsapp_file_count,
  "radicaleDataFiles": $radicale_file_count,
  "migrationTablePresent": $([ "$migration_count" -gt 0 ] && printf 'true' || printf 'false')
}
EOF
}

run_backup() {
  require_runtime
  ensure_repository

  lock_dir="$BACKUP_DIR/state/backup.lock"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    log "Überspringe Backup: ein anderer Backup-Lauf ist aktiv."
    return 0
  fi

  STAGING_DIR=$(mktemp -d /tmp/bikerental-backup.XXXXXX)
  cleanup() {
    rm -rf "$STAGING_DIR" "$lock_dir"
  }
  trap cleanup EXIT INT TERM

  database_path="$SOURCE_DIR/bikerental.db"
  [ -f "$database_path" ] || fail "Produktive Datenbank nicht gefunden: $database_path"

  log "Erstelle konsistenten SQLite-Snapshot."
  sqlite3 "$database_path" ".backup '$STAGING_DIR/bikerental.db'"
  integrity=$(sqlite3 "$STAGING_DIR/bikerental.db" 'PRAGMA integrity_check;')
  [ "$integrity" = "ok" ] || fail "SQLite integrity_check fehlgeschlagen: $integrity"

  copy_optional_directory financial-documents
  copy_optional_directory whatsapp-auth
  copy_external_directory radicale-data "$RADICALE_SOURCE_DIR"
  create_manifest

  log "Sichere Datenbank und Dateien verschlüsselt in Restic."
  restic backup --compression max --tag "$RESTIC_TAG" "$STAGING_DIR"

  log "Bereinige alte Snapshots."
  restic forget \
    --tag "$RESTIC_TAG" \
    --group-by tags \
    --keep-daily 14 \
    --keep-weekly 8 \
    --keep-monthly 12 \
    --prune

  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$BACKUP_DIR/state/last-successful-backup"
  log "Backup erfolgreich abgeschlossen."
}

run_check() {
  require_runtime
  ensure_repository
  restic check
}

list_snapshots() {
  require_runtime
  ensure_repository
  restic snapshots --tag "$RESTIC_TAG"
}

find_restored_database() {
  find "$1" -type f -name bikerental.db -print -quit
}

restore_snapshot() {
  require_runtime
  ensure_repository
  snapshot=${1:-latest}
  target=${2:-$RESTORE_DIR/$(date -u '+%Y%m%dT%H%M%SZ')}
  mkdir -p "$target"

  log "Stelle Snapshot $snapshot nach $target wieder her."
  restic restore "$snapshot" --tag "$RESTIC_TAG" --target "$target"

  restored_database=$(find_restored_database "$target")
  [ -n "$restored_database" ] || fail "Wiederhergestellte bikerental.db nicht gefunden."
  integrity=$(sqlite3 "$restored_database" 'PRAGMA integrity_check;')
  [ "$integrity" = "ok" ] || fail "Wiederhergestelltes SQLite-Backup ist inkonsistent: $integrity"
  log "Restore geprüft. Daten liegen unter: $target"
  printf '%s\n' "$target"
}

restore_live() {
  [ "${ALLOW_LIVE_RESTORE:-false}" = "true" ] || \
    fail "Live-Restore ist absichtlich gesperrt. Setze ALLOW_LIVE_RESTORE=true und stoppe zuerst den App-Container."
  require_runtime
  ensure_repository
  snapshot=${1:-latest}
  work_dir=$(mktemp -d /tmp/bikerental-restore.XXXXXX)
  cleanup_restore() { rm -rf "$work_dir"; }
  trap cleanup_restore EXIT INT TERM

  restic restore "$snapshot" --tag "$RESTIC_TAG" --target "$work_dir"
  restored_database=$(find_restored_database "$work_dir")
  [ -n "$restored_database" ] || fail "Wiederhergestellte bikerental.db nicht gefunden."
  integrity=$(sqlite3 "$restored_database" 'PRAGMA integrity_check;')
  [ "$integrity" = "ok" ] || fail "Wiederhergestelltes SQLite-Backup ist inkonsistent: $integrity"

  current_backup="$BACKUP_DIR/state/before-restore-$(date -u '+%Y%m%dT%H%M%SZ')"
  mkdir -p "$current_backup"
  [ -f "$SOURCE_DIR/bikerental.db" ] && cp -a "$SOURCE_DIR/bikerental.db" "$current_backup/"
  for name in financial-documents whatsapp-auth; do
    [ -d "$SOURCE_DIR/$name" ] && cp -a "$SOURCE_DIR/$name" "$current_backup/"
  done

  cp -a "$restored_database" "$SOURCE_DIR/bikerental.db.new"
  mv -f "$SOURCE_DIR/bikerental.db.new" "$SOURCE_DIR/bikerental.db"
  rm -f "$SOURCE_DIR/bikerental.db-wal" "$SOURCE_DIR/bikerental.db-shm"
  for name in financial-documents whatsapp-auth; do
    restored_directory=$(find "$work_dir" -type d -name "$name" -print -quit || true)
    if [ -n "$restored_directory" ]; then
      rm -rf "$SOURCE_DIR/$name"
      cp -a "$restored_directory" "$SOURCE_DIR/$name"
    fi
  done
  log "Live-Restore abgeschlossen. Vorherige Daten liegen unter $current_backup."
}

case "${1:-run}" in
  run) run_backup ;;
  check) run_check ;;
  snapshots) list_snapshots ;;
  restore) shift; restore_snapshot "$@" ;;
  restore-live) shift; restore_live "$@" ;;
  *) fail "Verwendung: backup.sh [run|check|snapshots|restore [snapshot] [ziel]|restore-live [snapshot]]" ;;
esac
