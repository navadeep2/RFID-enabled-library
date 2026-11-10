# System Architecture & Technical Design - AISYS RFID ILMS

## 1. Architectural Philosophy & Layered Model

The solution strictly adheres to the layered boundaries mandated by Section 6 of the SOP:

```
[ User Layer ]
    │ Minimalist Web Staff Interface, Catalog Inventory, RFID Hardware Registry, Reports & Admin
    ▼
[ Application Layer ]
    │ Cataloguing, Circulation, Fines Engine, Inventory, Security Rules, RBAC
    ▼
[ RFID Middleware & Interoperability ]
    │ Device-neutral event bus, Mock Adapters (Staff Station, Dual-Mode Handheld, Gates, Cards, CCTV)
    │ Protocol Mocks: SIP2 & NCIP 2.0 adapters
    ▼
[ Integration Layer ]
    │ Notification adapters (Email, Print queues), External ILMS Connectors
    ▼
[ Data Layer ]
    │ Transactional SQLite DB (WAL mode), Audit Ledger, Migration Engine & Staging
    ▼
[ Operations Layer ]
    │ Health checks, Offline installers, Snapshot backups, Docker runtime, Rollbacks
```

---

## 2. Component Design & Inter-Module Communication

1. **FastAPI Application Core (`app/main.py`)**:
   - Asynchronous ASGI HTTP engine.
   - Built-in OpenAPI documentation (`/docs`, `/redoc`).
   - CORS, security headers, request tracing, and structured exception handling.
   - Serves the minimalist, high-productivity SPA from `app/static/`.

2. **Database Engine & Resilience (`app/database.py`)**:
   - Python native `sqlite3` engine with `PRAGMA journal_mode=WAL` (Write-Ahead Logging) and `PRAGMA foreign_keys=ON`.
   - Thread-safe connection context manager with automatic rollback on exceptions.
   - Snapshot backup utility producing verifiable SHA-256 integrity hashes.

3. **RFID Middleware Engine (`app/services/rfid_middleware.py`)**:
   - Unified, device-neutral event bus.
   - **Staff Station:** Encodes and associates 16–32 character hex EPCs with catalogued books.
   - **Tag Registry:** Real-time searchable registry of all tagged items (`get_all_tagged_items`) with 1-click untagging (`untag_item`).
   - Manages tag memory banks and synchronizes security bits (`security_bit = 1` armed / `0` disarmed).

4. **Dual-Mode Inventory Engine (`app/services/inventory.py`)**:
   - Reconciles physical shelf stock against expected catalog data.
   - **Dual-Mode Identifier Resolution:** Seamlessly accepts either wireless **RFID EPCs** or printed **Book Barcodes**.
   - Classifies items into `found_items`, `misplaced_items`, and `missing_items`, updating `current_shelf` and `last_seen_at` timestamps.

5. **Security Gate & Passage Processor (`app/services/gate.py`)**:
   - Real-time portal monitoring checking EAS security bit status.
   - Disarmed tags pass silently; armed tags trigger immediate alarms, generate CCTV captures, and queue security email dispatches.

6. **Standards Interoperability (SIP2 & NCIP 2.0)**:
   - **SIP2 (Standard Interchange Protocol v2):**
     - Supports message 93/94 (Login/Response), 11/12 (Item Information), 17/18 (Item Checkout), 09/10 (Item Checkin), 29/30 (Renew).
   - **NCIP 2.0 (NISO Circulation Interchange Protocol):**
     - Supports `LookupItem`, `CheckOutItem`, `CheckInItem`, `RenewItem` message structures over RESTful JSON envelopes.

7. **20k Record Bulk Migration Engine (`app/services/migration.py`)**:
   - Streaming reader designed for low memory footprint (< 100MB RAM even for 50k+ records).
   - Multi-phase ingestion pipeline:
     1. Staging import (`migration_staging` table).
     2. Field schema validation (ISBN-10/13 formats, mandatory titles, barcode formats).
     3. Duplicate detection against both the batch and existing database.
     4. Atomic insertion into `titles` and `items` within an explicit transaction.
     5. Balanced reconciliation report accounting for 100% of rows.
     6. One-step atomic rollback capability that removes items and purges orphaned titles.

---

## 3. Deployment, Security & Containerization

- **Offline / Air-Gapped Deployment:** 100% self-contained. Zero external runtime dependencies.
- **Containerization:** Turnkey [`Dockerfile`](file:///E:/projects/aisys/Dockerfile) and [`Procfile`](file:///E:/projects/aisys/Procfile) for cloud hosting (Render.com, Railway, Fly.io).
- **Role-Based Access Control (RBAC):**
  - `ADMIN`: Full access to configuration, database, migrations, user management.
  - `LIBRARIAN`: Catalog management, item tagging, inventory audits, reports.
  - `STAFF`: Circulation desks, checking in/out, renewals, fine collection.
  - `PATRON`: Catalog discovery, personal borrowing status.
- **Audit Logging:** Every administrative action, privilege elevation, and circulation change is written into the append-only `audit_logs` table with timestamp, actor, entity, and change details.
