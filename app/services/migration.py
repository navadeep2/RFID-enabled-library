import csv
import io
import json
import re
import time
import uuid
from typing import Generator, Dict, Any, List, Optional
from app.database import db_session
from app.services.audit import record_audit
from app.logger import logger

def validate_record(row: Dict[str, str]) -> tuple[bool, Optional[str]]:
    """Validates spreadsheet row schema."""
    isbn = (row.get("isbn") or "").strip()
    title = (row.get("title") or "").strip()
    author = (row.get("author") or "").strip()
    accession = (row.get("accession_number") or "").strip()

    if not title:
        return False, "Missing mandatory field 'title'"
    if not author:
        return False, "Missing mandatory field 'author'"
    if not isbn:
        return False, "Missing mandatory field 'isbn'"
    
    clean_isbn = re.sub(r"[^0-9X]", "", isbn.upper())
    if len(clean_isbn) not in (10, 13):
        return False, f"Invalid ISBN length ({len(clean_isbn)} chars, expected 10 or 13)"

    if not accession:
        return False, "Missing mandatory field 'accession_number'"
    if len(accession) < 3:
        return False, "Accession number must be at least 3 characters"

    return True, None

def run_migration_pipeline(
    csv_stream: io.StringIO,
    batch_id: Optional[str] = None,
    dry_run: bool = False,
    operator_id: str = "ADMIN_MIGRATION",
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    start_time = time.time()
    batch_key = batch_id or f"MIG-{uuid.uuid4().hex[:8].upper()}"

    reader = csv.DictReader(csv_stream)

    total_records = 0
    valid_count = 0
    duplicate_count = 0
    invalid_count = 0
    migrated_count = 0
    error_samples = []

    seen_batch_accessions = set()

    with db_session(db_path) as conn:
        cursor = conn.cursor()

        # Load existing accessions and ISBNs from DB for fast in-memory duplicate detection
        cursor.execute("SELECT accession_number FROM items")
        existing_accessions = {r[0].upper() for r in cursor.fetchall()}

        cursor.execute("SELECT id, isbn FROM titles")
        existing_titles_map = {r[1]: r[0] for r in cursor.fetchall()}

        staging_batch = []
        titles_to_insert = []

        for row_idx, row in enumerate(reader, start=1):
            total_records += 1
            cleaned = {
                "isbn": (row.get("isbn") or row.get("ISBN") or "").strip(),
                "title": (row.get("title") or row.get("Title") or "").strip(),
                "author": (row.get("author") or row.get("Author") or "").strip(),
                "publisher": (row.get("publisher") or row.get("Publisher") or "").strip(),
                "publication_year": (row.get("publication_year") or row.get("year") or "2020").strip(),
                "dewey_decimal": (row.get("dewey_decimal") or row.get("dewey") or "000.0").strip(),
                "category": (row.get("category") or row.get("Category") or "General").strip(),
                "accession_number": (row.get("accession_number") or row.get("barcode") or "").strip().upper(),
                "rfid_epc": (row.get("rfid_epc") or row.get("epc") or "").strip().upper(),
                "shelf_location": (row.get("shelf_location") or row.get("shelf") or "SHELF-GEN-01").strip().upper(),
            }

            # 1. Validate
            is_valid, error_msg = validate_record(cleaned)
            if not is_valid:
                invalid_count += 1
                status = "INVALID"
                if len(error_samples) < 20:
                    error_samples.append({"row": row_idx, "error": error_msg, "accession": cleaned["accession_number"]})
            else:
                acc = cleaned["accession_number"]
                # 2. Check Duplicates
                if acc in existing_accessions or acc in seen_batch_accessions:
                    duplicate_count += 1
                    status = "DUPLICATE"
                    error_msg = f"Duplicate accession number: '{acc}'"
                    if len(error_samples) < 20:
                        error_samples.append({"row": row_idx, "error": error_msg, "accession": acc})
                else:
                    valid_count += 1
                    status = "VALID"
                    seen_batch_accessions.add(acc)

            # Stage row
            staging_batch.append((batch_key, json.dumps(cleaned), status, error_msg))

            # If valid and not dry run, prepare for insertion
            if status == "VALID" and not dry_run:
                isbn = cleaned["isbn"]
                try:
                    pub_year = int(cleaned["publication_year"])
                except Exception:
                    pub_year = 2020

                titles_to_insert.append((
                    isbn,
                    cleaned["title"],
                    cleaned["author"],
                    cleaned["publisher"],
                    pub_year,
                    cleaned["dewey_decimal"],
                    cleaned["category"],
                    cleaned["accession_number"],
                    cleaned["rfid_epc"] if cleaned["rfid_epc"] else None,
                    cleaned["shelf_location"]
                ))

        # Insert into staging table
        cursor.executemany(
            """INSERT INTO migration_staging (batch_id, raw_data, validation_status, error_message)
               VALUES (?, ?, ?, ?)""",
            staging_batch
        )

        # Ingestion phase (if not dry run)
        if not dry_run and titles_to_insert:
            for item in titles_to_insert:
                (isbn, title, author, pub, year, dewey, cat, acc, epc, shelf) = item
                title_id = existing_titles_map.get(isbn)
                if not title_id:
                    cursor.execute(
                        """INSERT INTO titles (isbn, title, author, publisher, publication_year, dewey_decimal, category)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (isbn, title, author, pub, year, dewey, cat)
                    )
                    title_id = cursor.lastrowid
                    existing_titles_map[isbn] = title_id

                cursor.execute(
                    """INSERT INTO items (title_id, accession_number, rfid_epc, security_bit, status, shelf_location, current_shelf)
                       VALUES (?, ?, ?, 1, 'AVAILABLE', ?, ?)""",
                    (title_id, acc, epc, shelf, shelf)
                )
                migrated_count += 1

        record_audit(
            actor_id=operator_id,
            action="MIGRATION_EXECUTE" if not dry_run else "MIGRATION_DRY_RUN",
            entity_type="MIGRATION_BATCH",
            entity_id=batch_key,
            details={
                "total": total_records,
                "valid": valid_count,
                "duplicates": duplicate_count,
                "invalid": invalid_count,
                "migrated": migrated_count,
                "dry_run": dry_run
            },
            conn=conn
        )

    duration = round(time.time() - start_time, 3)
    logger.info(
        f"Migration {batch_key} finished: {migrated_count} migrated, "
        f"{duplicate_count} dupes, {invalid_count} invalid in {duration}s"
    )

    reconciled_sum = (migrated_count if not dry_run else valid_count) + duplicate_count + invalid_count
    return {
        "batch_id": batch_key,
        "total_records": total_records,
        "valid_count": valid_count,
        "duplicate_count": duplicate_count,
        "invalid_count": invalid_count,
        "migrated_count": migrated_count,
        "is_dry_run": dry_run,
        "error_sample": error_samples,
        "duration_seconds": duration,
        "reconciliation": {
            "source_records_read": total_records,
            "target_records_accounted": reconciled_sum,
            "target_records_created": migrated_count,
            "unimported_total": duplicate_count + invalid_count,
            "balanced": reconciled_sum == total_records
        }
    }

def rollback_migration_batch(batch_id: str, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Rolls back all records imported during a specific migration batch."""
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT raw_data FROM migration_staging WHERE batch_id = ? AND validation_status = 'VALID'",
            (batch_id,)
        )
        staged_rows = cursor.fetchall()
        if not staged_rows:
            return {"batch_id": batch_id, "deleted_items": 0, "message": "No valid staged records found for this batch"}

        accessions = []
        for r in staged_rows:
            data = json.loads(r["raw_data"])
            accessions.append(data["accession_number"])

        deleted_items = 0
        if accessions:
            placeholders = ",".join("?" for _ in accessions)
            cursor.execute(f"DELETE FROM items WHERE accession_number IN ({placeholders})", accessions)
            deleted_items = cursor.rowcount

        cursor.execute("UPDATE migration_staging SET validation_status = 'ROLLED_BACK' WHERE batch_id = ?", (batch_id,))

        record_audit(
            actor_id="ADMIN_ROLLBACK",
            action="MIGRATION_ROLLBACK",
            entity_type="MIGRATION_BATCH",
            entity_id=batch_id,
            details={"deleted_items": deleted_items},
            conn=conn
        )

        return {
            "batch_id": batch_id,
            "deleted_items": deleted_items,
            "message": f"Successfully rolled back batch {batch_id}. Removed {deleted_items} items."
        }
