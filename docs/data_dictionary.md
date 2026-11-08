# Data Dictionary - AISYS RFID ILMS

This document defines the schema, entities, primary keys, relationships, constraints, and audit invariants for the ILMS and RFID system.

---

## 1. Entities & Schemas

### `titles` (Bibliographic Records)
Represents a distinct published work.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Unique bibliographic record ID.
* `isbn` (TEXT, UNIQUE, NOT NULL): International Standard Book Number (10 or 13 digits).
* `title` (TEXT, NOT NULL): Title of the work.
* `author` (TEXT, NOT NULL): Primary author or creator.
* `publisher` (TEXT): Publishing house.
* `publication_year` (INTEGER): Year of publication.
* `dewey_decimal` (TEXT): Classification number (e.g., `005.133`).
* `category` (TEXT, NOT NULL): Subject category (e.g., `Computer Science`, `Literature`).
* `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).
* `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).

### `items` (Physical Copies & RFID Tagging)
Represents an individual physical book copy holding an accession number and optional RFID tag.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Copy ID.
* `title_id` (INTEGER, FOREIGN KEY -> `titles.id`, NOT NULL): Reference to title.
* `accession_number` (TEXT, UNIQUE, NOT NULL): Barcode / accession identifier (e.g., `ACC-10001`).
* `rfid_epc` (TEXT, UNIQUE, NULLABLE): Electronic Product Code of RFID tag (96-bit hexadecimal string, e.g. `E28011052000000123456789`).
* `security_bit` (BOOLEAN, DEFAULT 1): RFID EAS/AFI security flag (1 = Active/Alarm enabled; 0 = Inactive/Checked-out).
* `status` (TEXT, DEFAULT 'AVAILABLE'): One of `AVAILABLE`, `ISSUED`, `REFERENCE_ONLY`, `LOST`, `WEEDED`.
* `shelf_location` (TEXT, NOT NULL): Assigned shelf code (e.g., `SHELF-A1-04`).
* `current_shelf` (TEXT): Last detected shelf from inventory scans.
* `last_seen_at` (TIMESTAMP): Timestamp of last reader scan.
* `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).

### `members` (Patrons & Library Staff)
Represents borrowers, librarians, and administrative staff.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Member ID.
* `member_code` (TEXT, UNIQUE, NOT NULL): Library card number (e.g., `MEM-2024-001`).
* `smart_card_uid` (TEXT, UNIQUE, NULLABLE): NFC / Mifare 13.56MHz RFID card UID.
* `full_name` (TEXT, NOT NULL): Name of member.
* `email` (TEXT, NOT NULL): Email for notices.
* `phone` (TEXT): Phone number for SMS notifications.
* `role` (TEXT, DEFAULT 'PATRON'): One of `ADMIN`, `LIBRARIAN`, `STAFF`, `PATRON`.
* `is_blocked` (BOOLEAN, DEFAULT 0): Manual administrative block flag.
* `total_fines` (REAL, DEFAULT 0.00): Outstanding unpaid fines in USD/Currency.
* `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).

### `circulation_records` (Checkouts & Returns)
Audit-preserved history of all lending activities.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Transaction ID.
* `item_id` (INTEGER, FOREIGN KEY -> `items.id`, NOT NULL): Item borrowed.
* `member_id` (INTEGER, FOREIGN KEY -> `members.id`, NOT NULL): Borrower.
* `checkout_date` (TIMESTAMP, NOT NULL): Timestamp of issue.
* `due_date` (TIMESTAMP, NOT NULL): Due date for return.
* `return_date` (TIMESTAMP, NULLABLE): Actual return timestamp.
* `renewals_count` (INTEGER, DEFAULT 0): Number of renewals performed.
* `fine_accrued` (REAL, DEFAULT 0.00): Calculated overdue fine.
* `fine_paid` (BOOLEAN, DEFAULT 0): Whether accrued fine was settled.
* `checkout_method` (TEXT, DEFAULT 'STAFF_STATION'): `STAFF_STATION`, `SIP2`, `NCIP`.
* `operator_id` (INTEGER, FOREIGN KEY -> `members.id`, NULLABLE): Staff member executing the transaction.

### `gate_events` (Security Gate Violations & Footfall)
Logs from RFID portal gate sensors.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Event ID.
* `event_type` (TEXT, NOT NULL): `UNAUTHORISED_REMOVAL`, `FOOTFALL_PASSAGE`, `ALARM_CLEARED`.
* `rfid_epc` (TEXT, NULLABLE): Detected RFID tag EPC.
* `accession_number` (TEXT, NULLABLE): Resolved accession number.
* `security_bit` (BOOLEAN): Security flag state read by gate.
* `alarm_triggered` (BOOLEAN, DEFAULT 0): Whether audible/visual gate alarm fired.
* `cctv_snapshot_path` (TEXT, NULLABLE): Path to simulated CCTV frame capture.
* `notification_queued` (BOOLEAN, DEFAULT 0): Email alert queued to security staff.
* `timestamp` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).

### `audit_logs` (System & Security Audit Trail)
Immutable ledger of administrative, security, and circulation events.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Log entry ID.
* `actor_id` (TEXT, NOT NULL): User ID or client service name.
* `action` (TEXT, NOT NULL): Action performed (e.g. `LOGIN`, `MIGRATION_EXECUTE`, `TAG_ASSOCIATE`, `POLICY_CHANGE`).
* `entity_type` (TEXT, NOT NULL): Target entity (`ITEM`, `MEMBER`, `CONFIG`, `SYSTEM`).
* `entity_id` (TEXT): Identifier of target entity.
* `details` (TEXT): JSON-encoded event payload.
* `ip_address` (TEXT): Origin IP address.
* `timestamp` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).

### `migration_staging` (Bulk Ingestion Staging)
Isolated staging buffer for incoming 20,000 spreadsheet rows.
* `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT).
* `batch_id` (TEXT, NOT NULL): Migration run identifier.
* `raw_data` (TEXT, NOT NULL): Raw JSON representation of spreadsheet row.
* `validation_status` (TEXT, DEFAULT 'PENDING'): `PENDING`, `VALID`, `INVALID`, `DUPLICATE`, `MIGRATED`.
* `error_message` (TEXT, NULLABLE): Detailed validation failure reason.
* `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).

---

## 2. Invariants & Business Rules
1. **Security Bit Invariant:** Whenever an item is `AVAILABLE`, `security_bit = 1` (armed). Whenever checked out, `security_bit = 0` (disarmed).
2. **Circulation Cap Invariant:** A patron cannot borrow items if `total_fines >= config.max_fine_limit` (default $15.00) or `is_blocked == 1`.
3. **Reference Invariant:** Items marked `REFERENCE_ONLY` cannot be checked out under any standard circulation flow.
4. **Tag Mapping Invariant:** An `rfid_epc` can be associated with at most ONE active item record.
