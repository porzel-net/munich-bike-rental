#!/usr/bin/env python3
"""Merge the pasted tab-separated order table into the current SQLite DB.

The pasted table is authoritative for fields it actually contains. Rows are
matched by order number where possible. Ambiguous or keyless rows are kept in
ground_truth_order_rows for auditability but are not guessed onto a booking.
"""

from __future__ import annotations

import argparse
import csv
import re
import sqlite3
from datetime import datetime
from pathlib import Path


DEFAULT_SOURCE = "/Users/juliusporzel/.codex/attachments/dcf77251-2228-47cf-ade7-c20f99afba48/pasted-text.txt"
DEFAULT_DATABASE = "data/bikerental.db"
INFO_VALUES = {"", "Keine Angabe"}


def clean(value: str | None) -> str:
    return (value or "").replace("\xa0", " ").strip()


def parse_date(value: str) -> str | None:
    value = clean(value)
    if not value:
        return None
    return datetime.strptime(value, "%d.%m.%Y").date().isoformat()


def parse_euro_cents(value: str) -> int | None:
    value = clean(value)
    if not value:
        return None
    numeric = re.sub(r"[^0-9,.-]", "", value).replace(".", "").replace(",", ".")
    try:
        return round(float(numeric) * 100)
    except ValueError:
        return None


def canonical_bike(value: str) -> str | None:
    value = clean(value)
    if value in INFO_VALUES:
        return None if value == "Keine Angabe" else ""
    return value.replace("Endurace CF SL 8 Di 2", "Endurace CF SL 8 Di2")


def parse_status(value: str) -> str | None:
    value = clean(value).lower()
    return {"ja": "executed", "ausstehend": "pending", "nein": "rejected"}.get(value)


def equipment_flags(value: str) -> tuple[int, str | None, int, int, str]:
    raw = clean(value)
    lowered = raw.lower()
    needs_pedals = int("pedal" in lowered)
    pedal_type = "spdSl" if "spd" in lowered else ("lookKeo2Max" if "klick" in lowered else None)
    needs_helmet = int("helm" in lowered)
    needs_clothing = int("kleidung" in lowered or "clothing" in lowered)
    return needs_pedals, pedal_type, needs_helmet, needs_clothing, raw


def date_matches(current: str, ground_truth: str) -> bool:
    return bool(ground_truth) and current == ground_truth


def match_score(row: dict[str, str], current: sqlite3.Row) -> int:
    score = 0
    if date_matches(current["period_from"], parse_date(row["Abholung"]) or ""):
        score += 3
    if date_matches(current["period_to"], parse_date(row["Rückgabe"]) or ""):
        score += 3
    amount = parse_euro_cents(row["Betrag"])
    if amount is not None and current["total_price_cents"] == amount:
        score += 2
    bike = canonical_bike(row["Fahrrad"])
    current_bike = canonical_bike(current["bike_title"] or "")
    if bike is not None and bike and bike == current_bike:
        score += 2
    size = clean(row["Größe"])
    if size and current["bike_size"] == size:
        score += 2
    return score


def create_audit_table(db: sqlite3.Connection) -> None:
    db.execute(
        """CREATE TABLE IF NOT EXISTS ground_truth_order_rows (
            id INTEGER PRIMARY KEY,
            order_number TEXT,
            executed TEXT,
            amount TEXT,
            requested_at TEXT,
            pickup_date TEXT,
            return_date TEXT,
            bike TEXT,
            bike_size TEXT,
            equipment TEXT,
            note TEXT,
            total TEXT,
            match_status TEXT NOT NULL,
            matched_inquiry_id INTEGER,
            match_reason TEXT,
            imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"""
    )
    db.execute("DELETE FROM ground_truth_order_rows")


def apply_row(db: sqlite3.Connection, row: dict[str, str], inquiry_id: int) -> None:
    current = db.execute(
        "SELECT submitted_at FROM rental_inquiries WHERE id = ?", (inquiry_id,)
    ).fetchone()
    updates: list[str] = []
    values: list[object] = []

    status = parse_status(row["Ausgeführt "])
    if status:
        updates.append("status = ?")
        values.append(status)
    amount = parse_euro_cents(row["Betrag"])
    if amount is not None:
        updates.append("total_price_cents = ?")
        values.append(amount)

    requested_date = parse_date(row["Angefragt am "])
    if requested_date and current:
        # The source only has a date. Preserve the current time-of-day instead
        # of inventing one, while replacing the authoritative calendar date.
        current_dt = datetime.fromtimestamp(current[0] / 1000)
        requested_dt = datetime.fromisoformat(f"{requested_date}T{current_dt.time().isoformat()}")
        updates.append("submitted_at = ?")
        values.append(round(requested_dt.timestamp() * 1000))

    bike_raw = clean(row["Fahrrad"])
    bike = canonical_bike(bike_raw)
    if bike_raw:
        updates.append("bike_title = ?")
        values.append(bike or None)

    if clean(row["Abholung"]):
        updates.append("period_from = ?")
        values.append(parse_date(row["Abholung"]))
    if clean(row["Rückgabe"]):
        updates.append("period_to = ?")
        values.append(parse_date(row["Rückgabe"]))

    equipment = clean(row["Ausrüstung"])
    note = clean(row["Notiz"])
    if equipment or note:
        message_parts = []
        if equipment:
            message_parts.append(f"Ausrüstung: {equipment}")
        if note:
            message_parts.append(f"Notiz: {note}")
        updates.append("message = ?")
        values.append("\n".join(message_parts))

    if updates:
        values.append(inquiry_id)
        db.execute(f"UPDATE rental_inquiries SET {', '.join(updates)} WHERE id = ?", values)

    bikes = db.execute(
        "SELECT id FROM rental_inquiry_bikes WHERE inquiry_id = ? ORDER BY position, id",
        (inquiry_id,),
    ).fetchall()
    size = clean(row["Größe"])
    needs_pedals, pedal_type, needs_helmet, needs_clothing, _ = equipment_flags(equipment)
    bike_updates: list[str] = []
    bike_values: list[object] = []
    if size:
        bike_updates.append("bike_size = ?")
        bike_values.append(size)
    if equipment:
        bike_updates.extend(["needs_pedals = ?", "pedal_type = ?", "needs_helmet = ?", "needs_clothing = ?"])
        bike_values.extend([needs_pedals, pedal_type, needs_helmet, needs_clothing])
    if bike_updates:
        for bike_row in bikes:
            db.execute(
                f"UPDATE rental_inquiry_bikes SET {', '.join(bike_updates)} WHERE id = ?",
                [*bike_values, bike_row[0]],
            )
        if not bikes and size:
            db.execute(
                """INSERT INTO rental_inquiry_bikes (
                    inquiry_id, position, height_cm, bike_size, needs_pedals,
                    pedal_type, needs_computer_mount, computer_mount_type,
                    needs_helmet, needs_clothing
                ) VALUES (?, 1, 0, ?, ?, ?, 0, NULL, ?, ?)""",
                (inquiry_id, size, needs_pedals, pedal_type, needs_helmet, needs_clothing),
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=DEFAULT_SOURCE, type=Path)
    parser.add_argument("--database", default=DEFAULT_DATABASE, type=Path)
    parser.add_argument("--backup", type=Path)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Ground-Truth-Tabelle nicht gefunden: {args.source}")
    if not args.database.is_file():
        raise SystemExit(f"Datenbank nicht gefunden: {args.database}")

    backup = args.backup or args.database.with_name(args.database.name + ".before-ground-truth")
    source_db = sqlite3.connect(args.database)
    backup_db = sqlite3.connect(backup)
    source_db.backup(backup_db)
    backup_db.close()
    source_db.close()
    print(f"Backup: {backup}")

    with args.source.open(newline="", encoding="utf-8-sig") as file:
        rows = list(csv.DictReader(file, delimiter="\t"))

    db = sqlite3.connect(args.database)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        create_audit_table(db)
        current = db.execute(
            """SELECT i.id, i.order_number, i.period_from, i.period_to,
                      i.bike_title, i.total_price_cents,
                      b.bike_size
               FROM rental_inquiries i
               LEFT JOIN rental_inquiry_bikes b
                 ON b.inquiry_id = i.id AND b.position = 1"""
        ).fetchall()
        by_order: dict[str, list[sqlite3.Row]] = {}
        for inquiry in current:
            by_order.setdefault(clean(inquiry["order_number"]), []).append(inquiry)

        grouped: dict[str, list[dict[str, str]]] = {}
        for row in rows:
            order = clean(row["Auftragsnummer"])
            if order:
                grouped.setdefault(order, []).append(row)

        matches: dict[int, tuple[int, str]] = {}
        unresolved = 0
        for order, ground_rows in grouped.items():
            candidates = by_order.get(order, [])
            if len(ground_rows) == 1 and len(candidates) == 1:
                matches[int(ground_rows[0]["ID"])] = (candidates[0]["id"], "unique order number")
                continue
            if len(candidates) == 1:
                scored = sorted(
                    ((match_score(ground_row, candidates[0]), ground_row) for ground_row in ground_rows),
                    key=lambda item: item[0],
                    reverse=True,
                )
                if scored and (len(scored) == 1 or scored[0][0] > scored[1][0]) and scored[0][0] >= 5:
                    matches[int(scored[0][1]["ID"])] = (candidates[0]["id"], f"best match score {scored[0][0]}")
                    continue
            unresolved += len(ground_rows)

        applied = 0
        for row in rows:
            row_id = int(row["ID"])
            match = matches.get(row_id)
            if match:
                apply_row(db, row, match[0])
                status, inquiry_id, reason = "matched", match[0], match[1]
                applied += 1
            else:
                status, inquiry_id, reason = "unresolved", None, "no unique safe match"
            db.execute(
                """INSERT INTO ground_truth_order_rows (
                    id, order_number, executed, amount, requested_at,
                    pickup_date, return_date, bike, bike_size, equipment,
                    note, total, match_status, matched_inquiry_id, match_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    row_id,
                    clean(row["Auftragsnummer"]),
                    clean(row["Ausgeführt "]),
                    clean(row["Betrag"]),
                    clean(row["Angefragt am "]),
                    clean(row["Abholung"]),
                    clean(row["Rückgabe"]),
                    clean(row["Fahrrad"]),
                    clean(row["Größe"]),
                    clean(row["Ausrüstung"]),
                    clean(row["Notiz"]),
                    clean(row["Summe"]),
                    status,
                    inquiry_id,
                    reason,
                ),
            )
        db.commit()
        print(f"Ground-Truth-Zeilen: {len(rows)}")
        print(f"Sicher auf aktuelle Aufträge angewendet: {applied}")
        print(f"Ungeklärt, aber vollständig archiviert: {len(rows) - applied}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
