# Demonstration Guide & Evaluation Script - AISYS RFID ILMS

This guide walks evaluators through demonstrating all 10 Priority Acceptance Criteria (AC 01 to AC 10) in under 5 minutes.

---

## 1. Quick Launch
Start the web application:
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open your web browser to: **`http://127.0.0.1:8000`**

---

## 2. Walkthrough Steps (Matching Acceptance Scenarios)

### Step 1: Bulk Migration of ~20,000 Records (AC 01)
1. In the sidebar, click **⚡ 20k Bulk Migration**.
2. Click **2. Dry-Run Validation**.
   - Notice the dry run completes in ~3.5 seconds.
   - Shows 20,004 total rows, 20,001 valid, 1 duplicate rejected, and 2 malformed rows caught.
   - Reconciliation status displays **BALANCED**.
3. Click **3. Execute Live Migration**.
   - Watch the live records ingest into the SQLite database.
4. Click **Instant Rollback Batch** to demonstrate atomic cancellation without corrupting existing records.

### Step 2: RFID Tag Association (AC 02)
1. Click **📡 RFID Studio**.
2. Under "Staff Tagging & Encoding Station", enter:
   - Accession Number: `ACC-10002`
   - RFID EPC: `E280110520000099`
3. Click **Encode & Associate Tag**.
4. Confirmation appears, proving the tag is now paired and armed with security bit = 1.

### Step 3: Circulation Policies & Blocking Rules (AC 04)
1. Click **🔄 Circulation Desk**.
2. In the "Test Policy Constraints" section at the bottom:
   - Click **Test Fine Limit Barrier**: Shows that patron `MEM-102` is blocked due to $25.50 unpaid fines (exceeding the $15.00 limit).
   - Click **Test Suspended Patron Barrier**: Shows that patron `MEM-103` is blocked because their account is suspended.
   - Click **Test Reference-Only Book Barrier**: Shows that item `ACC-10008` cannot be borrowed because it is marked Reference Only.

### Step 4: Issue, Return, and Protocol Flows (AC 03)
1. In Circulation Desk:
   - Issue book `ACC-10001` to patron `MEM-101`.
   - Result: Successful issue, due date assigned, **RFID security bit is disarmed (0)**.
2. In Sidebar, click **🔌 SIP2 & NCIP Interop**:
   - Dispatch a 09 Checkin frame for `ACC-10001`.
   - Result: Returns `101YN...` (checkin success, security bit re-armed).

### Step 5: Handheld Reader Shelf Audit (AC 05)
1. In **📡 RFID Studio** -> "Handheld Reader":
   - Shelf ID: `SHELF-CS-01`
   - Scanned EPCs: `E280110520000001, E280110520000006`
2. Click **Simulate Shelf Sweep**.
   - Hear the synthesized double warning tone.
   - Item `E280110520000006` is flagged as **Misplaced** (belongs on Literature shelf).
   - Other expected items are flagged as **Missing**.

### Step 6: Security Gate Breach & CCTV Snapshot (AC 06)
1. Under "RFID Security Gate Portal Simulator":
   - Gate Portal: `GATE-MAIN-01`
   - Passing Tag EPC: `E280110520000001` (active security bit).
2. Click **Simulate Gate Passage**.
   - Emergency audio siren sounds.
   - Red flashing security breach banner appears.
   - Simulated CCTV snapshot is captured on HTML5 canvas and stored locally.
   - Email notification queued to `security-ops@library.local`.

### Step 7: Smart-Card Tap Login & RBAC (AC 07)
1. In the top navigation bar, use the "Tap Card" selector:
   - Select **Administrator Jane (ADMIN)**.
   - Notice the badge changes to red ADMIN and full management privileges are unlocked.
   - Select **Patron Emily Brown (PATRON)**.
   - Role adjusts to PATRON.

### Step 8: Reports & Audit Trail (AC 08)
1. Click **📊 Reports & Audit Logs**.
2. View real-time KPI metrics (catalog titles, tagged percentage, active checkouts, gate alarms).
3. Inspect the immutable audit log table recording every single checkout, checkin, login, and tag encode event.

### Step 9 & 10: Snapshot Backup & Disaster Recovery (AC 09, AC 10)
1. In the top bar, click **💾 Backup DB**.
2. Notice the SHA-256 hash checksum generated.
3. Run the automated test suite at any time to verify 100% pass rate:
   ```powershell
   pytest tests/ -v
   ```
