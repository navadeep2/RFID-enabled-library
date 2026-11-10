# Operational Runbook & Troubleshooting - AISYS RFID ILMS

This runbook outlines incident response procedures, health diagnostics, and remediation steps for operators.

---

## 1. Health Diagnostics & Service Probes

### Diagnostic Endpoint
```http
GET http://127.0.0.1:8000/api/v1/health
```

### Response Health Indicators:
* `status: "HEALTHY"`: Database connected, disk space adequate, WAL mode active.
* `status: "DEGRADED"`: Database inaccessible or locked.

---

## 2. Common Incident Procedures

### Incident 1: Database Lock (`database is locked`)
* **Symptom:** API requests return error 500 or `sqlite3.OperationalError: database is locked`.
* **Root Cause:** A lingering connection holds an uncommitted write transaction.
* **Remediation:**
  1. Terminate lingering Python worker processes:
     ```powershell
     Stop-Process -Name "python" -Force
     ```
  2. Inspect directory `data/`. If `aisys_library.db-wal` is large (> 100 MB), run a checkpoint:
     ```powershell
     python -c "from app.database import get_db_connection; conn=get_db_connection(); conn.execute('PRAGMA wal_checkpoint(TRUNCATE);'); conn.close(); print('WAL Checkpoint OK')"
     ```
  3. Restart the uvicorn service.

### Incident 2: Browser Cache Showing Stale Frontend
* **Symptom:** Browser executes old JavaScript functions or reports `Cannot read properties of undefined`.
* **Root Cause:** Aggressive browser caching of static `.js` files.
* **Remediation:**
  1. Perform a hard refresh in the browser (`Ctrl + F5` or `Shift + Reload`).
  2. The application includes a cache-buster query string (e.g. `/app.js?v=1.0.2`). When deploying updates, bump the version string in `app/static/index.html`.

### Incident 3: Corrupted or Interrupted Update
* **Symptom:** Application fails to launch post-patch, or `PRAGMA integrity_check` fails.
* **Remediation:**
  Execute automated rollback:
  ```powershell
  deploy/rollback_update.ps1
  ```
  The script automatically selects the latest verified `.db` snapshot, checks SHA-256 hash integrity, restores data files, and logs the incident.

### Incident 4: Security Gate False Alarms
* **Symptom:** Security gate triggers false alarms for legitimately borrowed items.
* **Root Cause:** Tag security bit failed to disarm during checkout.
* **Remediation:**
  1. Inspect the item status via API:
     ```http
     GET /api/v1/catalog/items/{accession_number}
     ```
  2. In the **RFID Hardware** tab &rarr; **RFID Tag Registry**, inspect the `Alarm Bit` column.
  3. If armed while the book is borrowed, click **Untag** and re-link the tag at the Staff Station, or check the book in and out again.

### Incident 5: Cloud Container Startup Failure
* **Symptom:** Docker or Render deployment fails to bind port.
* **Root Cause:** Hardcoded port mismatch.
* **Remediation:**
  Verify that the start command references the dynamic `$PORT` environment variable:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
  ```
