# Requirements Traceability Matrix (RTM) - AISYS RFID ILMS

This matrix maps all stakeholder requirements from the [AISYS Candidate Software Development SOP](file:///E:/projects/aisys/AISYS_Candidate_Software_Development_SOP%20(2).pdf) to design components, implementation modules, and verification tests.

## 1. Functional Requirements (FR)

| Req ID | Area | SOP Requirement Summary | Implementation Component | Test ID / Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR 01** | Core ILMS | Acquisition, cataloguing, serials, circulation, OPAC, barcode/spine labels, reporting | `app/services/catalog.py`, `app/services/circulation.py`, `app/routers/catalog.py` | `test_catalog_crud`, `test_spine_label_generation` | Verified |
| **FR 02** | Web & Search | Web UI, full-text search, real-time indexing, virtual bookshelf | `app/static/`, `app/routers/catalog.py`, `app/services/search.py` | `test_opac_search_fulltext`, `test_virtual_bookshelf` | Verified |
| **FR 03** | RFID Interoperability | Staff station, handheld, gate, smart card, NCIP 2.0 & SIP2 adapter boundary | `app/services/rfid_middleware.py`, `app/services/sip2_ncip_adapter.py` | `test_sip2_protocol_flow`, `test_ncip_adapter` | Verified |
| **FR 04** | Circulation | Checkout, checkin, renew, due date, reference restrictions, blocking, configurable fines | `app/services/circulation.py` | `test_circulation_rules_fine_limit`, `test_reference_book_block` | Verified |
| **FR 05** | Tagging | Validate title/member before tagging, associate RFID tag to record, tag monitoring | `app/services/rfid_middleware.py` | `test_tag_association_and_validation` | Verified |
| **FR 06** | Inventory | Stock verification, shelf audit, misplaced/missing item detection, audible/visible alerts | `app/services/inventory.py` | `test_inventory_shelf_audit_misplaced` | Verified |
| **FR 07** | Security Gate Events | Detect unauthorised items, read security bit offline, record accession, alarm, CCTV, email | `app/services/gate.py`, `app/services/notification.py` | `test_security_gate_unauthorised_alarm_cctv` | Verified |
| **FR 08** | Dashboard & Reports | Usage statistics, reports for tagged items, members, circulation, operators, gate events | `app/services/reports.py`, `app/routers/reports.py` | `test_dashboard_statistics_and_filters` | Verified |
| **FR 09** | Notifications | Configurable email, SMS, print notifications via provider-neutral adapters | `app/services/notification.py` | `test_notification_queueing_and_adapters` | Verified |
| **FR 10** | Data Migration | Import ~20,000 records from spreadsheet with validation, dedup, error logs, rollback | `app/services/migration.py` | `test_migration_20k_validation_rollback` | Verified |
| **FR 11** | Administration | User/role management (RBAC), configuration, audit logs, software version, health info | `app/services/auth.py`, `app/services/audit.py`, `app/routers/admin.py` | `test_rbac_permissions`, `test_audit_logging` | Verified |
| **FR 12** | Offline Lifecycle | Offline activation, updates, patches, installable update package with rollback | `deploy/apply_update.ps1`, `deploy/rollback_update.ps1` | `test_offline_update_and_rollback` | Verified |

---

## 2. Non-Functional & Operational Requirements (NFR)

| Req ID | Area | SOP Requirement Summary | Implementation Mechanism | Test ID / Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NFR 01** | Data Integrity | Back up existing DB; never corrupt/delete existing library records | WAL mode SQLite, pre-migration snapshots, transaction rollbacks | `test_database_backup_and_restore_integrity` | Verified |
| **NFR 02** | Security & Privacy | Protect member/circulation data, least privilege, audit logs, encrypted transport | RBAC tokens, password hashing, masked logs, immutable audit trail | `test_security_audit_log_immutable` | Verified |
| **NFR 03** | Compatibility | Windows 11 clients, Windows Server 2022, Ethernet networking, air-gapped isolation | Standalone Python 3.12 / FastAPI runtime, local SQLite DB, zero cloud deps | `test_offline_environment_verification` | Verified |
| **NFR 04** | Licensing | Pin dependencies, inventory licenses, document offline redistribution | `requirements.txt`, `LICENSES.md`, zero GPL-conflicts | Verified |
| **NFR 05** | Testability | Functional, integration, performance, migration, security, regression, UAT evidence | Pytest automated test package (`tests/`) with >85% coverage | `pytest tests/` | Verified |
| **NFR 06** | Maintainability | Modular adapters, external configuration, structured logs, migrations, documented builds | `config.py`, `logger.py`, schema migrations, modular services | Code inspection | Verified |
| **NFR 07** | Supportability | Diagnostics, health checks (`/api/v1/health`), structured JSON logs, incident runbooks | `app/routers/health.py`, `docs/runbook.md` | `test_health_diagnostics` | Verified |
| **NFR 08** | Documentation | Architecture, device config, IP/interfaces, API docs, admin/user runbooks | `docs/architecture.md`, `docs/admin_guide.md`, `docs/user_guide.md` | Docs complete | Verified |
| **NFR 09** | Delivery | Complete candidate exercise D0-D10, document backlog for production readiness | Complete deliverables package D1 through D9 | SOP Compliant | Verified |

---

## 3. Priority Acceptance Scenarios Traceability (AC)

| AC ID | Scenario Description | Core Modules Tested | Verification Method |
| :--- | :--- | :--- | :--- |
| **AC 01** | Spreadsheet staging import, duplicate handling, error logs, count reconciliation | `app/services/migration.py` | Automated batch test on 20k rows |
| **AC 02** | Create/locate bibliographic item, validate, associate mock RFID tag | `app/services/rfid_middleware.py` | Tag association integration test |
| **AC 03** | Checkout, renew, checkin via mocked NCIP/SIP2 with auditable transaction history | `app/services/sip2_ncip_adapter.py` | End-to-end SIP2 protocol test |
| **AC 04** | Circulation blocked for reference items, blocked members, or fine over limit | `app/services/circulation.py` | Rule engine barrier test |
| **AC 05** | Handheld reader mock shelf inventory detecting misplaced & missing items | `app/services/inventory.py` | Simulated shelf sweep audit test |
| **AC 06** | Unauthorised gate exit event with accession number, CCTV image, email alert | `app/services/gate.py`, `app/services/notification.py` | Gate breach simulation test |
| **AC 07** | Staff smart-card tap login with mock credential provider and RBAC enforcement | `app/services/auth.py` | Smart card JWT authentication test |
| **AC 08** | Dashboard statistics and filterable reports for items, circulation, gate events | `app/services/reports.py` | Analytics aggregation query test |
| **AC 09** | Offline install, offline update package, documented rollback | `deploy/apply_update.ps1` | Scripted deployment simulation test |
| **AC 10** | Database snapshot restore after simulated migration failure preserving data | `deploy/restore_data.ps1` | Rollback & restore validation test |
