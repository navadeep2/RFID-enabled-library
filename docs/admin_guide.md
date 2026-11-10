# Administrator Guide - AISYS RFID ILMS

This guide instructs system administrators on environment configuration, user management, deployment, cloud hosting, and disaster recovery.

---

## 1. System Requirements & Environment

* **Supported Operating Systems:** Windows 11, Windows Server 2022, Linux (Ubuntu 22.04+), Docker container runtime.
* **Runtime:** Python 3.12+ (isolated virtual environment or container).
* **Storage:** 500 MB for base application; ~100 MB per 20,000 catalog records and CCTV snapshot captures.
* **Network:** Air-gapped / Local Intranet (zero external internet connection required for core operations).

---

## 2. Launching the Service

### Local Offline Launch
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser to: **`http://127.0.0.1:8000`**

Interactive OpenAPI / Swagger documentation is available at:
`http://127.0.0.1:8000/docs`

---

## 3. Cloud & Remote Hosting

### Option A: Render.com (Free Web Service)
1. Push the repository to GitHub.
2. Log into [render.com](https://render.com) and create a **New Web Service**.
3. Connect your repository.
4. Render automatically reads the repository's [`Procfile`](file:///E:/projects/aisys/Procfile) and [`Dockerfile`](file:///E:/projects/aisys/Dockerfile):
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Provides a free permanent URL (e.g., `https://aisys-ilms.onrender.com`).

### Option B: Docker Container
```bash
docker build -t aisys-ilms:latest .
docker run -d -p 8000:8000 --name aisys aisys-ilms:latest
```

### Option C: Instant Local Sharing (No Cloud Account)
```powershell
npx localtunnel --port 8000
```
Outputs an instant public HTTPS tunnel URL for remote testing.

---

## 4. User Roles & Access Control (RBAC)

The system enforces 4 hierarchical privilege tiers:
1. **ADMIN:** System configuration, database migrations, backup/restore, audit review.
2. **LIBRARIAN:** Cataloguing, RFID tag encoding, inventory shelf audits, reporting.
3. **STAFF:** Circulation desk (checkout, checkin, renewals, fines).
4. **PATRON:** Catalog discovery, borrowing status.

### Default Administrative Credentials
| Role | Member Code | Smart Card UID | Default Password |
| :--- | :--- | :--- | :--- |
| **Administrator** | `ADM-001` | `CARD-ADM-9988` | `password123` |
| **Librarian** | `LIB-001` | `CARD-LIB-7766` | `password123` |
| **Staff** | `STF-001` | `CARD-STF-5544` | `password123` |
| **Patron** | `MEM-101` | `CARD-MEM-1122` | `password123` |

---

## 5. API Endpoint Reference

### Catalog & Discovery
* `GET /api/v1/catalog/search`: Paginated bibliographic search with category and query filters.
* `GET /api/v1/catalog/shelf/{shelf_location}`: Retrieves items assigned to a physical shelf.
* `GET /api/v1/catalog/items/{accession_number}`: Retrieves individual item details and tag mapping.

### Circulation Desk
* `POST /api/v1/circulation/checkout`: Issues an item to a patron and clears the RFID security bit.
* `POST /api/v1/circulation/checkin`: Returns an item, arms the RFID security bit, and calculates overdue fines.
* `POST /api/v1/circulation/renew`: Extends loan period by +14 days within policy renewal limits.

### RFID Middleware & Devices
* `POST /api/v1/rfid/staff/tag-item`: Encodes an RFID EPC and links it to a book barcode.
* `POST /api/v1/rfid/staff/untag-item`: Disassociates an RFID EPC tag from a book.
* `GET /api/v1/rfid/tags`: Paginated registry of all active tagged items with search.
* `GET /api/v1/rfid/tags/{epc}`: Inspects individual tag memory and paired accession.
* `POST /api/v1/rfid/handheld/audit-shelf`: Reconciles shelf inventory (supports both EPCs and Barcodes).
* `POST /api/v1/rfid/gate/passage`: Monitors exit passages, detects armed items, and queues alerts.

### Migration Engine
* `POST /api/v1/migration/generate-synthetic`: Prepares/verifies the 20,000-record benchmark dataset.
* `POST /api/v1/migration/import-synthetic`: Executes dry-run validation or live ingestion of 20k rows.
* `POST /api/v1/migration/upload-csv`: Processes user-uploaded CSV catalog files.
* `POST /api/v1/migration/rollback/{batch_id}`: Atomically deletes all items from a batch and purges orphaned titles.

### System & Disaster Recovery
* `POST /api/v1/admin/backup`: Generates a point-in-time SQLite snapshot with SHA-256 verification.
* `GET /api/v1/admin/audit-logs`: Retrieves immutable system event logs.
* `GET /api/v1/reports/summary`: Retrieves live KPI metrics.

---

## 6. Backup & Disaster Recovery

* **Create Snapshot Backup:**
  ```powershell
  python scripts/backup.py
  ```
  Creates a `.db` snapshot in `backups/` alongside a SHA-256 cryptographic verification file (`.sha256`).

* **Restore from Snapshot:**
  ```powershell
  python scripts/restore.py backups/aisys_db_backup_<timestamp>.db
  ```
  Verifies the SHA-256 hash, clears stale SQLite `-wal` and `-shm` locks, and safely restores the database.
