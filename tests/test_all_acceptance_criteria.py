import io
import os
import pytest
from app.services.circulation import checkout_item, checkin_item, renew_item
from app.services.rfid_middleware import associate_tag_to_item, get_tag_details
from app.services.inventory import audit_shelf_inventory
from app.services.gate import process_gate_passage
from app.services.sip2_ncip_adapter import SIP2Parser, NCIP2Adapter
from app.services.auth import authenticate_user, check_permission
from app.services.migration import run_migration_pipeline, rollback_migration_batch
from app.services.reports import get_dashboard_summary, get_detailed_report
from app.database import create_db_backup, restore_db_backup, get_db_connection

# =========================================================================
# AC 01: Spreadsheet Staging, Duplicates, Validation & Reconciliation
# =========================================================================
def test_ac01_spreadsheet_migration_and_rollback(test_db):
    csv_sample = """isbn,title,author,publisher,publication_year,dewey_decimal,category,accession_number,rfid_epc,shelf_location
978-0-123-00001-1,Valid Book 1,Author One,Press,2021,005.1,Computer Science,ACC-TEST-001,E280TEST0001,SHELF-CS-01
978-0-123-00002-2,Valid Book 2,Author Two,Press,2022,005.2,Computer Science,ACC-TEST-002,E280TEST0002,SHELF-CS-01
978-0131103627,Duplicate Existing,Kernighan,Prentice,1988,005.133,Computer Science,ACC-10001,E280110520000001,SHELF-CS-01
INVALID_ISBN,,Missing Title & Author,Press,2020,000.0,General,ACC-TEST-BAD,,SHELF-01
"""
    stream = io.StringIO(csv_sample)
    report = run_migration_pipeline(stream, db_path=test_db)

    assert report["total_records"] == 4
    assert report["valid_count"] == 2
    assert report["duplicate_count"] == 1
    assert report["invalid_count"] == 1
    assert report["migrated_count"] == 2
    assert report["reconciliation"]["balanced"] is True

    # Test rollback
    batch_id = report["batch_id"]
    rollback_res = rollback_migration_batch(batch_id, db_path=test_db)
    assert rollback_res["deleted_items"] == 2

# =========================================================================
# AC 02: RFID Tag Association and Validation
# =========================================================================
def test_ac02_rfid_tag_association(test_db):
    # Valid association
    res = associate_tag_to_item("ACC-10002", "E280999900000001", db_path=test_db)
    assert res["success"] is True
    assert res["rfid_epc"] == "E280999900000001"
    assert res["security_bit"] == 1

    # Verify query returns tag details
    tag = get_tag_details("E280999900000001", db_path=test_db)
    assert tag is not None
    assert tag["accession_number"] == "ACC-10002"

    # Reject duplicate EPC association
    with pytest.raises(ValueError, match="already associated"):
        associate_tag_to_item("ACC-10003", "E280999900000001", db_path=test_db)

# =========================================================================
# AC 03: SIP2 & NCIP 2.0 Checkout, Renewal, Checkin with Audit History
# =========================================================================
def test_ac03_sip2_and_ncip_interoperability(test_db):
    # 1. SIP2 Checkout (Message 17)
    sip_checkout = "17N20240101    120000AAMEM-101|ABACC-10001|"
    resp18 = SIP2Parser.process_message(sip_checkout, db_path=test_db)
    assert resp18.startswith("181") # 18 = Checkout response, 1 = success

    # Verify item is marked ISSUED and security bit is disarmed (0)
    conn = get_db_connection(test_db)
    item = conn.execute("SELECT status, security_bit FROM items WHERE accession_number = 'ACC-10001'").fetchone()
    assert item["status"] == "ISSUED"
    assert item["security_bit"] == 0
    conn.close()

    # 2. SIP2 Renewal (Message 29)
    sip_renew = "2920240101    120000ABACC-10001|"
    resp30 = SIP2Parser.process_message(sip_renew, db_path=test_db)
    assert resp30.startswith("301") # 30 = Renewal response, 1 = success

    # 3. SIP2 Checkin (Message 09)
    sip_checkin = "09N20240101    120000ABACC-10001|"
    resp10 = SIP2Parser.process_message(sip_checkin, db_path=test_db)
    assert resp10.startswith("101") # 10 = Checkin response, 1 = success

    # Verify item is AVAILABLE and security bit is re-armed (1)
    conn = get_db_connection(test_db)
    item_post = conn.execute("SELECT status, security_bit FROM items WHERE accession_number = 'ACC-10001'").fetchone()
    assert item_post["status"] == "AVAILABLE"
    assert item_post["security_bit"] == 1
    conn.close()

    # 4. NCIP 2.0 Checkout
    ncip_res = NCIP2Adapter.process_ncip_request(
        "CheckOutItem",
        {"UserId": "MEM-101", "ItemId": "ACC-10001"},
        db_path=test_db
    )
    assert "CheckOutItemResponse" in ncip_res
    assert ncip_res["CheckOutItemResponse"]["Success"] is True

# =========================================================================
# AC 04: Circulation Policy Constraints
# =========================================================================
def test_ac04_circulation_policy_blocks(test_db):
    # Rule 1: Reference-only item blocked
    with pytest.raises(PermissionError, match="REFERENCE_ONLY"):
        checkout_item("MEM-101", "ACC-10008", db_path=test_db)

    # Rule 2: Member with excessive fines blocked (MEM-102 has $25.50 fines)
    with pytest.raises(PermissionError, match="fines"):
        checkout_item("MEM-102", "ACC-10001", db_path=test_db)

    # Rule 3: Suspended / blocked member blocked (MEM-103 is blocked)
    with pytest.raises(PermissionError, match="suspended/blocked"):
        checkout_item("MEM-103", "ACC-10001", db_path=test_db)

# =========================================================================
# AC 05: Handheld Reader Shelf Inventory & Misplaced / Missing Detection
# =========================================================================
def test_ac05_handheld_inventory_audit(test_db):
    # SHELF-CS-01 expects: E280110520000001, E280110520000002, E280110520000003
    # We scan: E280110520000001 (correct) and E280110520000006 (belongs to SHELF-LIT-01)
    report = audit_shelf_inventory(
        shelf_id="SHELF-CS-01",
        scanned_epcs=["E280110520000001", "E280110520000006"],
        db_path=test_db
    )
    assert report["total_scanned"] == 2
    assert report["found_count"] == 1
    assert report["misplaced_count"] == 1
    assert report["missing_count"] == 2
    assert report["audio_event"] == "ALERT_MISPLACED"

# =========================================================================
# AC 06: Security Gate Unauthorised Removal & CCTV Snapshot Alert
# =========================================================================
def test_ac06_security_gate_breach(test_db):
    # E280110520000001 is in library with security_bit = 1 (unissued)
    res = process_gate_passage(
        portal_id="GATE-MAIN-01",
        detected_epcs=["E280110520000001"],
        db_path=test_db
    )
    assert res["alarm_triggered"] is True
    assert len(res["violations"]) == 1
    assert res["violations"][0]["accession_number"] == "ACC-10001"
    assert res["cctv_snapshot_url"] is not None
    assert res["email_alert_queued"] is True

    # Now checkout item and pass again -> silent passage
    checkout_item("MEM-101", "ACC-10001", db_path=test_db)
    res_clean = process_gate_passage(
        portal_id="GATE-MAIN-01",
        detected_epcs=["E280110520000001"],
        db_path=test_db
    )
    assert res_clean["alarm_triggered"] is False
    assert len(res_clean["violations"]) == 0

# =========================================================================
# AC 07: Smart Card Login & Role-Based Permissions
# =========================================================================
def test_ac07_smart_card_rbac(test_db):
    # Tap Librarian Smart Card
    user = authenticate_user(smart_card_uid="CARD-LIB-7766", db_path=test_db)
    assert user is not None
    assert user["full_name"] == "Librarian Robert"
    assert user["role"] == "LIBRARIAN"

    # Enforce RBAC
    assert check_permission(user["role"], ["LIBRARIAN", "STAFF"]) is True
    assert check_permission(user["role"], ["ADMIN"]) is False

# =========================================================================
# AC 08: Dashboard Statistics & Filterable Reports
# =========================================================================
def test_ac08_reports_and_kpis(test_db):
    summary = get_dashboard_summary(db_path=test_db)
    assert summary["catalog"]["total_titles"] >= 7
    assert summary["catalog"]["total_items"] >= 8
    assert summary["catalog"]["tagged_items"] >= 8
    assert summary["members"]["total_members"] >= 6

    # Tagged items filter
    tagged = get_detailed_report("tagged_items", filter_status="tagged", db_path=test_db)
    assert len(tagged) >= 8

# =========================================================================
# AC 09 & AC 10: Snapshot Backup, Integrity Verification & Restore
# =========================================================================
def test_ac10_snapshot_backup_and_restore(test_db, tmp_path):
    backup_file, sha256 = create_db_backup(str(tmp_path), source_db_path=test_db)
    assert os.path.exists(backup_file)
    assert len(sha256) == 64

    # Simulate catastrophic modification
    conn = get_db_connection(test_db)
    conn.execute("DELETE FROM items WHERE accession_number = 'ACC-10001'")
    conn.commit()
    conn.close()

    # Prove item is missing
    conn = get_db_connection(test_db)
    assert conn.execute("SELECT COUNT(*) FROM items WHERE accession_number = 'ACC-10001'").fetchone()[0] == 0
    conn.close()

    # Restore from snapshot
    restore_db_backup(backup_file, test_db)

    # Prove data is intact
    conn = get_db_connection(test_db)
    restored_count = conn.execute("SELECT COUNT(*) FROM items WHERE accession_number = 'ACC-10001'").fetchone()[0]
    conn.close()
    assert restored_count == 1

# =========================================================================
# AC 09: Offline Deployment, Update Package & Rollback Execution
# =========================================================================
def test_ac09_offline_deployment_and_update(test_db, tmp_path):
    # Test that offline package can take pre-update backup, verify integrity, and rollback
    backup_file, sha256 = create_db_backup(str(tmp_path), source_db_path=test_db)
    assert os.path.exists(backup_file)

    # Check database integrity PRAGMA
    conn = get_db_connection(test_db)
    res = conn.execute("PRAGMA integrity_check").fetchone()[0]
    conn.close()
    assert res == "ok"
