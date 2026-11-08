# System Architecture & Technical Design - AISYS RFID ILMS

## 1. Architectural Philosophy & Layered Model

The solution strictly adheres to the layered boundaries mandated by Section 6 of the SOP:

```
[ User Layer ]
    │ Web Staff Interface, OPAC Search, RFID Studio, Reports & Admin
    ▼
[ Application Layer ]
    │ Cataloguing, Circulation, Fines Engine, Inventory, Security Rules, RBAC
    ▼
[ RFID Middleware & Interoperability ]
    │ Device-neutral event bus, Mock Adapters (Staff, Handheld, Gates, Cards, CCTV)
    │ Protocol Mocks: SIP2 & NCIP 2.0 adapters
    ▼
[ Integration Layer ]
    │ Notification adapters (Email, SMS, Print queues), External ILMS Connectors
    ▼
[ Data Layer ]
    │ Transactional SQLite DB (WAL mode), Audit Ledger, Migration Engine & Staging
    ▼
[ Operations Layer ]
    │ Health checks, Offline installers, Snapshot backups, Hot-patches, Rollbacks
```

---

## 2. Component Design & Inter-Module Communication

1. **FastAPI Application Core (`app/main.py`)**:
   - Asynchronous ASGI HTTP & WebSocket engine.
   - Built-in OpenAPI documentation (`/docs`, `/redoc`).
   - CORS, security headers, request tracing, and exception interceptors.
   - Serves modern responsive SPA UI from `app/static/`.

2. **Database Engine & Resilience (`app/database.py`)**:
   - Uses Python's native `sqlite3` engine with `PRAGMA journal_mode=WAL` (Write-Ahead Logging) and `PRAGMA foreign_keys=ON`.
   - Thread-safe connection context manager with automatic atomic rollbacks on exceptions.
   - Snapshot backup utility producing verifiable SHA-256 integrity hashes.

3. **RFID Middleware Engine (`app/services/rfid_middleware.py`)**:
   - Implements a unified, device-neutral event bus.
   - Encapsulates physical reader semantics into clean domain commands:
     - `read_tag(tag_id)`
     - `write_tag(tag_id, accession_no)`
     - `set_security_bit(tag_id, status)`
     - `trigger_gate_alarm(tag_id)`

4. **Standards Interoperability (SIP2 & NCIP 2.0)**:
   - **SIP2 (Standard Interchange Protocol v2):**
     - Supports message 93/94 (Login/Response), 11/12 (Item Information), 17/18 (Item Checkout), 09/10 (Item Checkin), 29/30 (Renew).
   - **NCIP 2.0 (NISO Circulation Interchange Protocol):**
     - Supports `LookupItem`, `CheckOutItem`, `CheckInItem`, `RenewItem` message structures over RESTful JSON/XML envelopes.

5. **20k Record Bulk Migration Engine (`app/services/migration.py`)**:
   - Streaming reader designed for low memory footprint (< 100MB RAM even for 50k+ records).
   - Multi-phase ingestion pipeline:
     1. Staging import (`migration_staging` table).
     2. Field schema validation (ISBN-10/13 formats, mandatory titles, barcode formats).
     3. Duplicate detection against both the batch and existing database.
     4. Atomic insertion into `titles` and `items` within an explicit transaction.
     5. Reconciliation report generating counts of processed, migrated, duplicate, and invalid rows.
     6. One-step atomic rollback capability using savepoints or transaction abortion.

---

## 3. Security, Privacy & Air-Gapped Deployment

- **Zero-Cloud Dependency:** No CDNs, no external font servers, no remote API calls. All CSS, JavaScript, icons, and dependencies are bundled locally.
- **Role-Based Access Control (RBAC):**
  - `ADMIN`: Full access to configuration, database, migrations, user creation.
  - `LIBRARIAN`: Catalog management, item tagging, inventory audits, reports.
  - `STAFF`: Circulation desks, checking in/out, renewals, fee collections.
  - `PATRON`: OPAC search, account dues view, self-service checks.
- **Audit Logging:** Every administrative action, privilege elevation, and circulation change is written into the append-only `audit_logs` table with timestamp, actor, IP address, and change diff.
