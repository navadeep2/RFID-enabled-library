# Administrator Guide - AISYS RFID ILMS

This guide instructs library administrators on system setup, authentication, security controls, backup management, and data migrations.

---

## 1. System Requirements & Environment
* **Operating System:** Windows 11 / Windows Server 2022 or later.
* **Runtime:** Python 3.12+ (isolated local installation).
* **Network:** Local Ethernet (Isolated Intranet, zero internet connection required).
* **Storage:** 500 MB minimum for baseline application, ~100 MB per 20,000 catalog records and CCTV snapshots.

---

## 2. Starting and Stopping the Service

### Quick Launch
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open your browser to:
`http://127.0.0.1:8000`

Interactive OpenAPI/Swagger documentation is available at:
`http://127.0.0.1:8000/docs`

---

## 3. User & Role Management (RBAC)

The system supports 4 hierarchical privilege tiers:
1. **ADMIN:** System configuration, database migrations, backup/restore, audit review.
2. **LIBRARIAN:** Cataloguing, RFID tag encoding, inventory shelf audits, reporting.
3. **STAFF:** Circulation desk (checkout, checkin, renewals, fines).
4. **PATRON:** OPAC catalog discovery, borrowing status.

### Default Administrative Credentials
| Role | Member Code | Smart Card UID | Default Password |
| :--- | :--- | :--- | :--- |
| **Administrator** | `ADM-001` | `CARD-ADM-9988` | `password123` |
| **Librarian** | `LIB-001` | `CARD-LIB-7766` | `password123` |
| **Staff** | `STF-001` | `CARD-STF-5544` | `password123` |
| **Patron** | `MEM-101` | `CARD-MEM-1122` | `password123` |

---

## 4. Bulk Data Migration (~20,000 Records)

To import catalog data from a spreadsheet:
1. Navigate to **20k Bulk Migration** in the web console, or run via CLI:
   ```powershell
   # Dry run validation
   python scripts/run_migration.py --file data/synthetic_library_20000.csv --dry-run

   # Live ingestion
   python scripts/run_migration.py --file data/synthetic_library_20000.csv
   ```
2. The importer performs:
   - Schema validation (ISBN format, mandatory titles, shelf locations).
   - In-memory duplicate accession detection.
   - Streaming batch staging.
   - Generates a balanced reconciliation report.
3. In case of error, rollback any batch with:
   ```bash
   POST /api/v1/migration/rollback/{batch_id}
   ```

---

## 5. Backup & Disaster Recovery

* **Create Snapshot Backup:**
  ```powershell
  python scripts/backup.py
  ```
  Creates a point-in-time `.db` snapshot in `backups/` along with a SHA-256 integrity file (`.sha256`).

* **Restore from Snapshot:**
  ```powershell
  python scripts/restore.py backups/aisys_db_backup_<timestamp>.db
  ```
  Restores the database with SHA-256 cryptographic verification and clears stale journal locks.
