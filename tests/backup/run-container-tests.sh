#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
IMAGE=${BACKUP_TEST_IMAGE:-bikerental-backup:test}
TEST_ROOT=$(mktemp -d "$ROOT_DIR/.backup-test.XXXXXX")
CRON_CONTAINER_ID=''

cleanup() {
  if [ -n "$CRON_CONTAINER_ID" ]; then
    docker rm -f "$CRON_CONTAINER_ID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT INT TERM

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf 'PASS: %s\n' "$*"
}

assert_file() {
  [ -f "$1" ] || fail "Datei fehlt: $1"
}

assert_dir() {
  [ -d "$1" ] || fail "Verzeichnis fehlt: $1"
}

assert_equal() {
  expected=$1
  actual=$2
  description=$3
  [ "$expected" = "$actual" ] || fail "$description (erwartet: $expected, erhalten: $actual)"
}

assert_contains() {
  haystack=$1
  needle=$2
  description=$3
  case "$haystack" in
    *"$needle"*) ;;
    *) fail "$description (Suchtext nicht gefunden: $needle)" ;;
  esac
}

run_backup() {
  docker run --rm --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
    --tmpfs /etc/crontabs:rw,noexec,nosuid,nodev,size=16k \
    --tmpfs /run:rw,noexec,nosuid,nodev,size=16m \
    -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    -v "$TEST_ROOT/backup":/backup \
    -v "$TEST_ROOT/source":/source:ro \
    -v "$TEST_ROOT/radicale":/radicale-source:ro \
    -v "$TEST_ROOT/secrets":/run/secrets:ro \
    "$IMAGE" "$@"
}

run_backup_rw() {
  docker run --rm --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
    --tmpfs /etc/crontabs:rw,noexec,nosuid,nodev,size=16k \
    --tmpfs /run:rw,noexec,nosuid,nodev,size=16m \
    -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    -e ALLOW_LIVE_RESTORE=true \
    -v "$TEST_ROOT/backup":/backup \
    -v "$TEST_ROOT/source":/source \
    -v "$TEST_ROOT/radicale":/radicale-source \
    -v "$TEST_ROOT/secrets":/run/secrets:ro \
    "$IMAGE" "$@"
}

run_without_secret() {
  docker run --rm --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
    --tmpfs /run:rw,noexec,nosuid,nodev,size=16m \
    -e RESTIC_PASSWORD_FILE=/run/secrets/missing \
    -v "$TEST_ROOT/backup":/backup \
    -v "$TEST_ROOT/source":/source:ro \
    -v "$TEST_ROOT/radicale":/radicale-source:ro \
    "$IMAGE" "$@"
}

run_restic() {
  docker run --rm --read-only \
    --entrypoint restic \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
    -e RESTIC_REPOSITORY=/backup/restic-repository \
    -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    -e RESTIC_CACHE_DIR=/tmp/restic-cache \
    -v "$TEST_ROOT/backup":/backup \
    -v "$TEST_ROOT/secrets":/run/secrets:ro \
    "$IMAGE" "$@"
}

command -v docker >/dev/null 2>&1 || fail "Docker ist für die Backup-Integrationstests erforderlich."
docker info >/dev/null 2>&1 || fail "Docker-Daemon ist nicht erreichbar."

if [ "${BACKUP_TEST_SKIP_BUILD:-false}" != "true" ]; then
  printf 'Baue Test-Image %s …\n' "$IMAGE"
  docker build --tag "$IMAGE" "$ROOT_DIR/backup" >/dev/null
fi

mkdir -p "$TEST_ROOT/source/financial-documents" "$TEST_ROOT/source/whatsapp-auth" "$TEST_ROOT/radicale/collections/mbr-test/contacts" "$TEST_ROOT/secrets" "$TEST_ROOT/backup"
printf 'correct horse battery staple\n' > "$TEST_ROOT/secrets/restic-password"
printf 'sensitive receipt contents\n' > "$TEST_ROOT/source/financial-documents/receipt.txt"
printf 'whatsapp credential contents\n' > "$TEST_ROOT/source/whatsapp-auth/credentials"
printf 'BEGIN:VCARD\nVERSION:3.0\nFN:Backup Contact\nEND:VCARD\n' > "$TEST_ROOT/radicale/collections/mbr-test/contacts/backup.vcf"
sqlite3 "$TEST_ROOT/source/bikerental.db" \
  'CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO smoke(value) VALUES ("backup-sensitive-value");'

if output=$(run_without_secret run 2>&1); then
  fail "Backup ohne Passwortdatei wurde fälschlich akzeptiert."
else
  assert_contains "$output" 'Restic-Passwort fehlt' 'Fehlermeldung für fehlendes Restic-Passwort'
  pass 'fehlendes Passwort wird abgewiesen'
fi

mv "$TEST_ROOT/source/bikerental.db" "$TEST_ROOT/source/bikerental.db.saved"
if output=$(run_backup run 2>&1); then
  fail "Backup ohne Datenbank wurde fälschlich akzeptiert."
else
  assert_contains "$output" 'Produktive Datenbank nicht gefunden' 'Fehlermeldung für fehlende Datenbank'
  pass 'fehlende Datenbank wird abgewiesen'
fi
mv "$TEST_ROOT/source/bikerental.db.saved" "$TEST_ROOT/source/bikerental.db"

run_backup run >/dev/null
assert_file "$TEST_ROOT/backup/restic-repository/config"
assert_file "$TEST_ROOT/backup/state/last-successful-backup"
pass 'erstes verschlüsseltes Backup wird erstellt'

if grep -R -a -q 'backup-sensitive-value' "$TEST_ROOT/backup/restic-repository"; then
  fail 'Klartext aus der Datenbank wurde im Restic-Repository gefunden.'
fi
if grep -R -a -q 'sensitive receipt contents' "$TEST_ROOT/backup/restic-repository"; then
  fail 'Klartext aus einem Beleg wurde im Restic-Repository gefunden.'
fi
pass 'Repository enthält keine geprüften Klartextdaten'

snapshot_list=$(run_backup snapshots)
assert_contains "$snapshot_list" 'bikerental-full' 'Backup-Tag ist gesetzt'
pass 'Snapshot kann aufgelistet werden'

run_backup check >/dev/null
pass 'restic check ist erfolgreich'

run_backup restore latest /backup/restore-test >/dev/null
RESTORED_DB=$(find "$TEST_ROOT/backup/restore-test" -type f -name bikerental.db -print -quit)
RESTORED_MANIFEST=$(find "$TEST_ROOT/backup/restore-test" -type f -name manifest.json -print -quit)
assert_file "$RESTORED_DB"
assert_file "$RESTORED_MANIFEST"
assert_equal 'backup-sensitive-value' "$(sqlite3 "$RESTORED_DB" 'SELECT value FROM smoke;')" 'Datenbankinhalt nach Restore'
assert_contains "$(cat "$RESTORED_MANIFEST")" 'financialDocumentFiles": 1' 'Manifest enthält Beleganzahl'
assert_contains "$(cat "$RESTORED_MANIFEST")" 'whatsappAuthFiles": 1' 'Manifest enthält WhatsApp-Dateianzahl'
assert_contains "$(cat "$RESTORED_MANIFEST")" 'radicaleDataFiles": 1' 'Manifest enthält Radicale-Dateianzahl'
assert_equal 'sensitive receipt contents' "$(cat "$(find "$TEST_ROOT/backup/restore-test" -type f -name receipt.txt -print -quit)")" 'Beleg nach Restore'
assert_equal 'whatsapp credential contents' "$(cat "$(find "$TEST_ROOT/backup/restore-test" -type f -name credentials -print -quit)")" 'WhatsApp-Datei nach Restore'
assert_equal 'BEGIN:VCARD\nVERSION:3.0\nFN:Backup Contact\nEND:VCARD\n' "$(cat "$(find "$TEST_ROOT/backup/restore-test" -type f -name backup.vcf -print -quit)")" 'Radicale-Kontakt nach Restore'
pass 'Datenbank, Manifest, Belege und WhatsApp-Daten werden restauriert'

sqlite3 "$TEST_ROOT/source/bikerental.db" 'UPDATE smoke SET value = "same-day-update";'
run_backup run >/dev/null
same_day_snapshot_count=$(printf '%s\n' "$(run_backup snapshots)" | awk '/bikerental-full/ { count += 1 } END { print count + 0 }')
[ "$same_day_snapshot_count" -ge 1 ] || fail 'Retention hat den aktuellen Tages-Snapshot entfernt.'
pass 'Retention-Lauf funktioniert bei mehreren Backups am selben Tag'

mkdir -p "$TEST_ROOT/historical"
printf 'historical retention fixture\n' > "$TEST_ROOT/historical/file.txt"
# Restic groups snapshots by tags for retention. Create 20 dated snapshots to
# verify that daily retention is applied even though every run uses a new
# temporary staging path and a new Docker hostname.
docker run --rm --read-only --entrypoint /bin/sh \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  -e RESTIC_REPOSITORY=/backup/restic-repository \
  -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
  -e RESTIC_CACHE_DIR=/tmp/restic-cache \
  -v "$TEST_ROOT/backup":/backup \
  -v "$TEST_ROOT/historical":/historical:ro \
  -v "$TEST_ROOT/secrets":/run/secrets:ro \
  "$IMAGE" -c '
    i=1
    while [ "$i" -le 20 ]; do
      backup_time=$(date -u -d "$i days ago" "+%Y-%m-%d 12:00:00")
      restic backup --tag bikerental-full --time "$backup_time" /historical >/dev/null
      i=$((i + 1))
    done
  '
run_backup run >/dev/null
retained_snapshot_count=$(printf '%s\n' "$(run_backup snapshots)" | awk '/bikerental-full/ { count += 1 } END { print count + 0 }')
if [ "$retained_snapshot_count" -lt 14 ] || [ "$retained_snapshot_count" -gt 20 ]; then
  printf 'Snapshot-Ausgabe nach historischer Tages-Retention:\n%s\n' "$(run_backup snapshots)" >&2
  fail "Retention hat eine unerwartete Snapshot-Anzahl behalten: $retained_snapshot_count"
fi
pass "historische tägliche Retention behält $retained_snapshot_count passende Snapshots"

mkdir -p "$TEST_ROOT/unrelated"
printf 'unrelated repository snapshot\n' > "$TEST_ROOT/unrelated/file.txt"
# The unrelated snapshot is deliberately created through the same repository.
docker run --rm --read-only --entrypoint restic \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  -e RESTIC_REPOSITORY=/backup/restic-repository \
  -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
  -e RESTIC_CACHE_DIR=/tmp/restic-cache \
  -v "$TEST_ROOT/backup":/backup \
  -v "$TEST_ROOT/unrelated":/other:ro \
  -v "$TEST_ROOT/secrets":/run/secrets:ro \
  "$IMAGE" backup --tag unrelated /other >/dev/null
run_backup run >/dev/null
all_snapshots=$(run_restic snapshots)
assert_contains "$all_snapshots" 'unrelated' 'Retention löscht fremde Repository-Tags nicht'
pass 'Retention ist auf die bikerental-Tags begrenzt'

mkdir "$TEST_ROOT/backup/state/backup.lock"
lock_output=$(run_backup run 2>&1)
rmdir "$TEST_ROOT/backup/state/backup.lock"
assert_contains "$lock_output" 'anderer Backup-Lauf ist aktiv' 'Backup-Lock verhindert parallele Läufe'
pass 'parallele Backup-Läufe werden verhindert'

sqlite3 "$TEST_ROOT/source/bikerental.db" 'UPDATE smoke SET value = "live-before-restore";'
run_backup run >/dev/null
sqlite3 "$TEST_ROOT/source/bikerental.db" 'UPDATE smoke SET value = "live-mutated";'
if output=$(run_backup restore-live latest 2>&1); then
  fail 'Live-Restore ohne ALLOW_LIVE_RESTORE wurde fälschlich akzeptiert.'
else
  assert_contains "$output" 'Live-Restore ist absichtlich gesperrt' 'Schutz des Live-Restores'
  pass 'Live-Restore ist standardmäßig gesperrt'
fi
run_backup_rw restore-live latest >/dev/null
assert_equal 'live-before-restore' "$(sqlite3 "$TEST_ROOT/source/bikerental.db" 'SELECT value FROM smoke;')" 'Live-Restore ersetzt Datenbank'
assert_dir "$(find "$TEST_ROOT/backup/state" -maxdepth 1 -type d -name 'before-restore-*' -print -quit)"
pass 'isolierter Live-Restore ersetzt Daten und erstellt Vorher-Kopie'

CRON_CONTAINER_ID=$(docker run -d --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --tmpfs /etc/crontabs:rw,noexec,nosuid,nodev,size=16k \
  --tmpfs /run:rw,noexec,nosuid,nodev,size=16m \
  -v "$TEST_ROOT/backup":/backup \
  -v "$TEST_ROOT/secrets":/run/secrets:ro \
  bikerental-backup:test)
sleep 2
assert_equal 'true' "$(docker inspect --format '{{.State.Running}}' "$CRON_CONTAINER_ID")" 'Backup-Service läuft dauerhaft'
cron_logs=$(docker logs "$CRON_CONTAINER_ID" 2>&1)
assert_contains "$cron_logs" 'Backup-Service aktiv' 'Cron-Service meldet seinen Start'
docker rm -f "$CRON_CONTAINER_ID" >/dev/null
CRON_CONTAINER_ID=''
pass 'dauerhafter Read-only-Cron-Betrieb funktioniert'

printf '\nAlle Backup-Container- und Live-Tests erfolgreich.\n'
