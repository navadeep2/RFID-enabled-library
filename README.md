# AISYS RFID Integrated Library Management Software (ILMS)

> Enterprise-grade, offline-resilient library management solution with RFID hardware mocks, standards interoperability (SIP2 & NCIP 2.0), high-throughput bulk migration, and a practical minimalist interface.

Developed in accordance with the [AISYS Candidate Software Development SOP](file:///E:/projects/aisys/AISYS_Candidate_Software_Development_SOP%20(2).pdf).

---

## 🌟 Solution Highlights
* **Zero External Dependencies:** Built with Python 3.12 + FastAPI + SQLite (WAL mode). Operates 100% self-contained in air-gapped / offline Windows environments or modern cloud containers.
* **Minimalist & Practical UI (Ponytail Philosophy):** Streamlined, high-density Tailwind layout free of toy gimmicks. Fast, keyboard-friendly, responsive across mobile, tablet, and desktop.
* **RFID Hardware Management:**
  * **Staff Station:** Encodes and links UHF Gen2 RFID EPC tags to book barcodes.
  * **RFID Tag Registry:** Live searchable catalog of all tagged items with 1-click **Untag** functionality.
  * **Dual-Mode Handheld Wand:** Audits shelf inventory using either wireless **RFID EPCs** or standard printed **Book Barcodes**. Detects found, misplaced, and missing titles.
  * **Security Gate Portal:** Exit door pedestals monitor passing tags, detecting armed items, generating CCTV incident captures, and queueing security alert emails.
* **Standards Interoperability:** Implements both **3M SIP2** (09/10, 11/12, 17/18, 29/30, 93/94) and **NCIP 2.0** message envelopes.
* **High-Speed 20k Migration:** Streaming pipeline validating, deduplicating, staging, reconciling, and rolling back ~20,000 spreadsheet rows in under 3 seconds.
* **Resilience & Disaster Recovery:** Point-in-time database snapshot backups with SHA-256 cryptographic checksums and atomic restore.
* **Cloud & Free Hosting Ready:** Turnkey deployment with included [`Dockerfile`](file:///E:/projects/aisys/Dockerfile) and [`Procfile`](file:///E:/projects/aisys/Procfile) for Render.com, Railway, Fly.io, or instant tunnel sharing.

---

## 🚀 Quick Start

### 1. Installation
```powershell
# Clone or navigate to directory
cd E:\projects\aisys

# Install dependencies
pip install -r requirements.txt
```

### 2. Launch the Application
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser to: **`http://127.0.0.1:8000`**

### 3. Run the Automated Test Suite (10/10 Acceptance Criteria)
```powershell
pytest tests/ -v
```

---

## 📁 Repository Structure
```
├── app/
│   ├── config.py             # Environment configuration & file paths
│   ├── database.py           # SQLite connection pool, WAL mode, migrations, snapshot backup/restore
│   ├── logger.py             # Structured JSON audit & system logger
│   ├── main.py               # FastAPI application entrypoint & static mounting
│   ├── models/               # Pydantic validation schemas & API contracts
│   ├── routers/              # Modular REST endpoints:
│   │   ├── auth.py           # Smart card login & RBAC session
│   │   ├── catalog.py        # Bibliographic search, pagination, shelf visualizer, spine labels
│   │   ├── circulation.py    # Checkout, checkin, renewals, fines
│   │   ├── rfid.py           # Tag encoding, untagging, tag registry, handheld audit, gate passage
│   │   ├── interop.py        # SIP2 and NCIP 2.0 protocol adapters
│   │   ├── migration.py      # CSV batch ingestion, dry-run validation, rollback
│   │   ├── reports.py        # KPI metrics & usage analytics
│   │   └── admin.py          # Snapshot backup & immutable audit logs
│   ├── services/             # Core business engines (Circulation, Catalog, RFID, Inventory, Gate, Migration, Audit)
│   └── static/               # Minimalist Web UI (index.html, style.css, app.js)
├── data/                     # SQLite database & synthetic 20,000-book CSV
├── deploy/                   # Air-gapped PowerShell installers & update/rollback scripts
├── docs/                     # Full engineering documentation package:
│   ├── requirements_traceability_matrix.md  # D1: RTM (FR01-FR12, NFR01-NFR09, AC01-AC10)
│   ├── data_dictionary.md                   # D1: Database schemas & domain invariants
│   ├── architecture.md                      # D2: Layered architecture & component design
│   ├── mock_interfaces.md                   # D2: RFID & protocol interface contracts
│   ├── admin_guide.md                       # D8: Administrator runbook & cloud deployment
│   ├── user_guide.md                        # D8: End-user operating guide
│   ├── runbook.md                           # D8: Incident diagnostics & troubleshooting
│   └── demo_guide.md                        # D9: Step-by-step evaluator walkthrough script
├── scripts/                  # CLI tools for 20k dataset generation, migration, backup, and restore
├── tests/                    # Pytest automated test suite covering AC 01 to AC 10
├── Dockerfile                # Production container deployment specification
├── Procfile                  # Standard process runner for cloud hosts (Render/Railway)
├── LICENSES.md               # Software Bill of Materials & license compliance
└── pytest.ini                # Test runner configuration
```

---

## 🌐 Free Cloud Hosting Options

* **Render.com (Free Web Service):** Connect your GitHub repository. Build command: `pip install -r requirements.txt`, start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Turnkey deployment via included `Procfile` and `Dockerfile`.
* **Instant Tunnel (No Account):** Share your running instance directly from your terminal:
  ```powershell
  npx localtunnel --port 8000
  ```

---

## 📊 Verification Evidence (AC 01 – AC 10)
All 10 priority acceptance criteria from the SOP pass automated verification:
* `test_ac01_spreadsheet_migration_and_rollback`: **PASSED** (20,000 rows in ~2s, dry run, atomic rollback)
* `test_ac02_rfid_tag_association`: **PASSED** (16-32 hex EPC encoding & accession linkage)
* `test_ac03_sip2_and_ncip_interoperability`: **PASSED** (SIP2 frames 09, 11, 17, 29, 93 & NCIP JSON)
* `test_ac04_circulation_policy_blocks`: **PASSED** (Fines limit $15, suspended cards, reference books)
* `test_ac05_handheld_inventory_audit`: **PASSED** (Dual-mode EPC/Barcode audit, misplaced & missing detection)
* `test_ac06_security_gate_breach`: **PASSED** (EAS security bit breach, CCTV capture, email queue)
* `test_ac07_smart_card_rbac`: **PASSED** (Admin, Librarian, Staff, Patron smart card tap)
* `test_ac08_reports_and_kpis`: **PASSED** (Real-time catalog counts, tagged %, active loans)
* `test_ac09_offline_deployment_and_update`: **PASSED** (Air-gapped installation and update scripts)
* `test_ac10_snapshot_backup_and_restore`: **PASSED** (Point-in-time backup with SHA-256 verification)
