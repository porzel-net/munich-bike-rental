#!/usr/bin/env python3
"""Import the old bike-request SQLite database into the current database.

The old tables are copied losslessly as legacy_* tables. The request and item
tables are also mapped to the current rental_inquiries tables so the web app
can display the imported orders.
"""

from __future__ import annotations

import argparse
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_SOURCE = "/Users/juliusporzel/Development/your-bike-rental-analysis/bike_requests.sqlite3"
DEFAULT_DATABASE = "data/bikerental.db"


def quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def timestamp_ms(value: str | None) -> int:
    if not value:
        return 0
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def backup_database(database: Path, backup: Path) -> None:
    """Create a consistent backup, including any WAL contents."""
    source = sqlite3.connect(database)
    destination = sqlite3.connect(backup)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()


def copy_legacy_tables(source: sqlite3.Connection, target: sqlite3.Connection) -> None:
    tables = source.execute(
        "SELECT name, sql FROM sqlite_master "
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()

    for name, create_sql in tables:
        legacy_name = f"legacy_{name}"
        target.execute(f"DROP TABLE IF EXISTS {quote(legacy_name)}")

        # Keep the original columns and constraints where possible, while
        # changing references to other copied tables to their legacy names.
        rewritten = re.sub(
            rf"(?i)(CREATE TABLE\s+)([\"`]??{re.escape(name)}[\"`]??)",
            rf"\1{quote(legacy_name)}",
            create_sql,
            count=1,
        )
        for other_name, _ in tables:
            rewritten = re.sub(
                rf"(?i)(REFERENCES\s+)[\"`]?{re.escape(other_name)}[\"`]?",
                rf"\1{quote('legacy_' + other_name)}",
                rewritten,
            )
        target.execute(rewritten)

        columns = [row[1] for row in source.execute(f"PRAGMA table_info({quote(name)})")]
        column_sql = ", ".join(quote(column) for column in columns)
        placeholders = ", ".join("?" for _ in columns)
        rows = source.execute(f"SELECT {column_sql} FROM {quote(name)}").fetchall()
        target.executemany(
            f"INSERT INTO {quote(legacy_name)} ({column_sql}) VALUES ({placeholders})",
            rows,
        )


def import_current_orders(source: sqlite3.Connection, target: sqlite3.Connection) -> tuple[int, int, int]:
    requests = source.execute("SELECT * FROM bike_requests ORDER BY id").fetchall()
    request_columns = [row[1] for row in source.execute("PRAGMA table_info(bike_requests)")]
    request_index = {name: index for index, name in enumerate(request_columns)}
    items = source.execute("SELECT * FROM bike_request_items ORDER BY bike_request_id, bike_number").fetchall()
    item_columns = [row[1] for row in source.execute("PRAGMA table_info(bike_request_items)")]
    item_index = {name: index for index, name in enumerate(item_columns)}

    existing = {
        row[0]: row[1]
        for row in target.execute("SELECT order_number, id FROM rental_inquiries")
    }
    item_rows_by_request: dict[int, list[sqlite3.Row]] = {}
    for item in items:
        item_rows_by_request.setdefault(item[item_index["bike_request_id"]], []).append(item)

    imported = 0
    skipped = 0
    updated = 0
    for request in requests:
        get = lambda name: request[request_index[name]]
        order_number = get("order_number") or f"LEGACY-{get('id')}"
        if order_number in existing:
            inquiry_id = existing[order_number]
            target.execute(
                "UPDATE rental_inquiries SET bike_title = ? WHERE id = ?",
                (get("original_bike_model") or get("bike_model"), inquiry_id),
            )
            target.execute("DELETE FROM rental_inquiry_bikes WHERE inquiry_id = ?", (inquiry_id,))
            updated += 1
        else:
            start = get("rental_start_date") or "1970-01-01"
            end = get("rental_end_date") or start
            bike_title = get("original_bike_model") or get("bike_model")
            message = (
                "Import aus der alten bike_requests-Datenbank. "
                f"Quelle: {get('source_key')}"
            )
            target.execute(
                """INSERT INTO rental_inquiries (
                    order_number, name, email, phone, location, period_from,
                    period_to, pickup_time, dropoff_time, message, bike_title,
                    total_price_cents, locale, mail_status, status, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'de', 'sent', 'unanswered', ?)""",
                (
                    order_number,
                    get("name") or "Unbekannt",
                    get("contact_email") or "unknown@legacy.invalid",
                    get("phone") or "-",
                    get("location") or "München",
                    start,
                    end,
                    get("pickup_time") or "-",
                    get("return_time") or "-",
                    message,
                    bike_title,
                    round((get("salesVolume") or 0) * 100),
                    timestamp_ms(get("sent_at") or get("first_imported_at")),
                ),
            )
            inquiry_id = target.execute("SELECT last_insert_rowid()").fetchone()[0]
            existing[order_number] = inquiry_id
            imported += 1

        for item in item_rows_by_request.get(get("id"), []):
            item_get = lambda name: item[item_index[name]]
            target.execute(
                """INSERT INTO rental_inquiry_bikes (
                    inquiry_id, position, height_cm, bike_size,
                    needs_pedals, pedal_type, needs_computer_mount,
                    computer_mount_type, needs_helmet, needs_clothing
                ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)""",
                (
                    inquiry_id,
                    item_get("bike_number"),
                    round(item_get("height_cm") or 0),
                    item_get("requested_bike_size") or item_get("bike_size") or "unknown",
                    int(bool(item_get("pedals_requested"))),
                    int(bool(item_get("computer_mount_requested"))),
                    int(bool(item_get("helmet_requested"))),
                    int(bool(item_get("clothing_requested"))),
                ),
            )

    return imported, skipped, updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=DEFAULT_SOURCE, type=Path)
    parser.add_argument("--database", default=DEFAULT_DATABASE, type=Path)
    parser.add_argument("--no-backup", action="store_true", help="Do not create a pre-import backup")
    args = parser.parse_args()

    if not args.source.is_file():
        raise SystemExit(f"Quelldatenbank nicht gefunden: {args.source}")
    if not args.database.is_file():
        raise SystemExit(f"Aktuelle Datenbank nicht gefunden: {args.database}")

    backup = args.database.with_name(args.database.name + ".before-legacy-import")
    if not args.no_backup:
        backup_database(args.database, backup)
        print(f"Backup: {backup}")

    source = sqlite3.connect(args.source)
    target = sqlite3.connect(args.database)
    # The source tables are copied in name order, not dependency order. The
    # copied legacy schema is therefore installed with FK checks temporarily
    # disabled; the normalized import below runs with checks enabled.
    target.execute("PRAGMA foreign_keys = OFF")
    try:
        required = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        missing = {"bike_requests", "bike_request_items"} - required
        if missing:
            raise SystemExit(f"Erforderliche Tabellen fehlen: {', '.join(sorted(missing))}")

        copy_legacy_tables(source, target)
        target.commit()
        target.execute("PRAGMA foreign_keys = ON")
        with target:
            imported, skipped, updated = import_current_orders(source, target)
        print(
            f"Import abgeschlossen: {imported} aktuelle Aufträge importiert, "
            f"{updated} aktualisiert, {skipped} bereits vorhanden."
        )
    finally:
        source.close()
        target.close()


if __name__ == "__main__":
    main()
