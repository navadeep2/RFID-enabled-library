# Demonstration Guide & Evaluation Script - AISYS RFID ILMS

This guide walks evaluators through demonstrating all 10 Priority Acceptance Criteria (AC 01 to AC 10) in under 5 minutes.

---

## 1. Quick Launch
Start the web application:
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open your web browser to: **`http://127.0.0.1:8000`**

---

## 2. Walkthrough Steps

### Step 1: Catalog Browsing & Pagination (AC 08, FR 01)
1. Navigate to **Catalog**.
2. Notice the total records count and clean pagination controls (`« First`, `‹ Prev`, `Page 1 of N`, `Next ›`, `Last »`).
3. Search for `"Computer Science"` or `"Algorithms"`.
4. Click **Desk** on any book row &rarr; Notice it immediately switches to the Circulation Desk with that book barcode pre-filled!

### Step 2: Circulation Desk Operations & Policy Blocks (AC 04, FR 04)
1. In the **Circulation Desk** tab:
   * **Test Normal Issue:** Check out book `ACC-10001` to patron `MEM-101`.
     * *Result:* Issued successfully, due date set to +14 days, RFID security bit **disarmed (0)**.
   * **Test Fine Barrier:** Try checking out to `MEM-102` (owes $25.50 in unpaid fines).
     * *Result:* Checkout is blocked because fines exceed the $15.00 policy limit.
   * **Test Suspended Patron:** Try checking out to `MEM-103`.
     * *Result:* Checkout is blocked because the patron card is suspended.
   * **Test Reference-Only Book:** Try checking out `ACC-10008` (Dictionary).
     * *Result:* Checkout is blocked because reference books cannot leave the library.
2. In the **Return Book** card, enter `ACC-10001` and click **Check In Item**.
   * *Result:* Book returned, late fees calculated, and RFID security bit **re-armed (1)**.

### Step 3: RFID Staff Station, Tag Registry & Untag Action (AC 02, FR 05)
1. Click **RFID Hardware**.
2. In the **Staff Tagging Station**:
   * Enter Accession `ACC-10002` and EPC `E280110520000099`.
   * Click **Write & Link Tag** &rarr; Success message confirms the tag is paired and armed.
3. In the lower half, view the **RFID Tag Registry**:
   * All tagged books are listed with their EPC tag, barcode, title, and alarm status.
   * Click the red **Untag** button next to `ACC-10002` &rarr; Confirms tag removal and updates the registry in real time.

### Step 4: Dual-Mode Handheld Wand (AC 05, FR 06)
1. Under **Handheld Inventory Wand**:
   * **Audit via RFID EPCs:** Click the preset **"RFID (1 Misplaced)"** &rarr; Shows that item `E280110520000006` (*1984*) is misplaced on the Computer Science shelf (belongs on Literature).
   * **Audit via Book Barcodes:** Click **"Barcodes (All Found)"** (`ACC-10001, ACC-10002, ACC-10003`) &rarr; Confirms all 3 books are present and on the correct shelf.

### Step 5: Security Gate Passage & Theft Alarm (AC 06, FR 07)
1. Under **Security Gate Portal**:
   * **Test Theft Breach:** Enter passing EPC `E280110520000001` (an unissued book sitting on the shelf with security bit = 1).
   * Click **Detect Passage** &rarr; Triggers **🚨 THEFT ALARM TRIGGERED**. A security incident is logged, CCTV snapshot recorded, and alert email queued.
   * **Test Authorized Exit:** Check out `ACC-10001` at the circulation desk first, then test its EPC at the gate &rarr; Outputs **✅ Authorized Exit: All items disarmed** with no alarm.

### Step 6: 20,000-Record Bulk Data Migration (AC 01, FR 02)
1. Click **Data Migration**.
2. Click **Validate Only (Dry Run)**:
   * Finishes in ~2 seconds.
   * Outputs 20,004 rows parsed, duplicate accessions flagged, and reconciliation marked **BALANCED**.
3. Click **Execute Live Ingestion**:
   * Imports 20,000 records live into the catalog.
4. Click **Rollback Ingestion Batch**:
   * Deletes all 20,000 items and automatically cleans up orphaned titles.

### Step 7: Self-Checkout Protocols (SIP2 & NCIP) (AC 03, FR 03)
1. Click **Protocols (SIP2 / NCIP)**.
2. Under 3M SIP2:
   * Select preset `11: Item Status Query` &rarr; Click **Send Frame**.
   * Returns response frame `12...` with circulation status and title.
3. Under NCIP 2.0:
   * Select `LookupItem` &rarr; Click **Send Request**.
   * Returns clean JSON bibliographic and item availability response.

### Step 8: Smart Card Authentication & RBAC (AC 07, FR 08)
1. In the top bar, use the **User:** selector:
   * Switch between **Jane (Administrator)**, **Robert (Librarian)**, **Alice (Staff)**, and **Emily (Patron)**.
   * Verifies role-based access privileges and session switching.

### Step 9: Audit Trail & Reporting (AC 08, FR 09, FR 10)
1. Click **Audit & Reports**.
2. View live KPI cards (Titles, Physical Copies, Tagged %, Borrowed, Gate Violations).
3. Inspect the audit log table recording every single checkout, checkin, login, tag encoding, untagging, and gate breach.

### Step 10: Disaster Recovery & Automated Test Suite (AC 09, AC 10)
1. In the top bar, click **Snapshot Backup** &rarr; Creates a timestamped `.db` snapshot with SHA-256 verification.
2. Run the automated pytest suite in your terminal to verify all 10 acceptance criteria:
   ```powershell
   pytest tests/ -v
   # 10 passed in ~1.3s
   ```
