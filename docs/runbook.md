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
* **Root Cause:** A long-running write transaction or unfinished migration process holds an exclusive lock.
* **Remediation:**
  1. Terminate lingering python uvicorn worker processes:
     ```powershell
     Stop-Process -Name "python" -Force
     ```
  2. Inspect directory `data/`. If `aisys_library.db-wal` is extraordinarily large (> 100 MB), run a checkpoint:
     ```powershell
     python -c "from app.database import get_db_connection; conn=get_db_connection(); conn.execute('PRAGMA wal_checkpoint(TRUNCATE);'); conn.close(); print('WAL Checkpoint OK')"
     ```
  3. Restart the uvicorn service.

### Incident 2: Corrupted or Interrupted Update
* **Symptom:** Application fails to launch post-patch, or `PRAGMA integrity_check` fails.
* **Remediation:**
  Execute automated rollback:
  ```powershell
  deploy/rollback_update.ps1
  ```
  The script automatically selects the latest verified `.db` snapshot, checks SHA-256 hash integrity, restores data files, and logs the incident.

### Incident 3: Security Gate Sensor Desynchronization
* **Symptom:** Security gate triggers false alarms for legitimately borrowed items.
* **Root Cause:** Tag security bit failed to disarm during checkout.
* **Remediation:**
  1. Inspect the item status via API:
     ```http
     GET /api/v1/catalog/items/{accession_number}
     ```
  2. Verify that `security_bit` equals 0 when `status == 'ISSUED'`.
  3. Re-scan the item through the Staff Station or re-run checkin/checkout.
