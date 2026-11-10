# User Guide - AISYS RFID ILMS

This guide assists librarians, library staff, and patrons in operating the daily features of the system.

---

## 1. Catalog & Inventory

### Searching the Catalog
1. Navigate to **Catalog** in the navigation bar.
2. Enter any search term (title, author, book barcode, or ISBN) into the search box.
3. Optionally select a category filter (e.g. *Computer Science*, *Literature*, *Reference*).
4. Press `Enter` or click **Search**.

### Viewing Availability & Pagination
* Books are displayed in a clean tabular view.
* Use the **Per page** selector (15, 30, 50, 100) to adjust view density.
* Navigate across the collection using **« First**, **‹ Prev**, **Next ›**, and **Last »** buttons.

### Action Shortcuts
* **Desk:** Immediately switches to the Circulation Desk with the book's barcode pre-filled for borrowing or returning.
* **Label:** Opens a thermal spine label preview with Dewey call numbers, Cutter code, and barcode ready to print (`Ctrl + P`).

---

## 2. Circulation Desk Operations

### Issue Book (Check Out)
1. In the **Issue Book** card, enter the Patron Card Code (e.g., `MEM-101`).
2. Enter the Item Barcode (e.g., `ACC-10001`).
3. Click **Check Out Item**.
4. The system validates:
   - Patron is active (not suspended).
   - Patron unpaid fines do not exceed the $15.00 threshold.
   - The book is not designated `REFERENCE_ONLY`.
5. Upon successful issue, the book's RFID security bit is automatically **disarmed (0)** so the patron can walk through exit doors without triggering alarms.

### Return Book (Check In)
1. In the **Return Book** card, enter the Item Barcode (e.g., `ACC-10001`).
2. Click **Check In Item**.
3. If returned past the due date, the system calculates overdue fines ($0.50 per day) and posts the charge to the patron's balance.
4. The RFID security bit is automatically **re-armed (1)** to protect the book against theft while on the shelf.

### Extend Loan (Renewal)
1. Enter the Item Barcode in the **Extend Loan** card.
2. Click **Renew Item**.
3. The loan is extended for +14 days (up to 3 consecutive renewals).

---

## 3. RFID Hardware Management

### Staff Tagging Station
* Used to pair physical books with UHF Gen2 RFID smart tags.
* Enter the Book Barcode (e.g., `ACC-10002`) and the 16–32 character hex EPC tag (e.g., `E280110520000099`).
* Click **Write & Link Tag**. The system pairs the tag, sets its security bit to armed (1), and adds it to the registry.

### RFID Tag Registry (Lower Half)
* Located in the lower half of the **RFID Hardware** tab.
* Displays a live catalog of every tagged book in the library with its EPC tag, barcode, title, shelf location, and alarm status.
* **Search:** Filter tags by typing an EPC, title, or barcode.
* **Untag Action:** Click the red **Untag** button next to any item to safely remove the tag association from the database.

### Handheld Inventory Wand (Dual-Mode)
* Used for rapid physical shelf audits.
* Enter the Shelf Location (e.g. `SHELF-CS-01`).
* In the input box, you can enter **either**:
  - **RFID EPC Tags:** `E280110520000001, E280110520000002` (as detected over the air by an RFID wand), OR
  - **Book Barcodes:** `ACC-10001, ACC-10002` (if using an optical barcode scanner or manual entry).
* Click **Audit Shelf**. The system reconciles the shelf and reports:
  - **Found:** Items correctly placed on this shelf.
  - **Misplaced:** Items found here that belong on another shelf (e.g. *1984* found on Computer Science shelf).
  - **Missing:** Items expected on this shelf that were not scanned.

### Security Gate Portal
* Simulates anti-theft pedestals at the library exit doors.
* **Passing Tag EPC:** Enter a tag ID (e.g. `E280110520000001`).
* Click **Detect Passage**:
  - **If Disarmed (Checked out):** Outputs `✅ Authorized exit: All items disarmed`. No alarm.
  - **If Armed (Unborrowed):** Triggers `🚨 THEFT ALARM TRIGGERED`. Logs the security incident, records a CCTV snapshot, and dispatches an alert email to security staff.

---

## 4. Bulk Data Migration (~20,000 Records)

* **Validate Only (Dry Run):** Tests the 20,000-record dataset (`data/synthetic_library_20000.csv`) for duplicate accessions, missing fields, and ISBN formats without writing to the live catalog.
* **Execute Live Ingestion:** Imports 20,000 records into the catalog in under 3 seconds with a balanced reconciliation report.
* **Rollback:** In case of errors, click **Rollback Ingestion Batch** to atomically remove all imported items.
* **Custom CSV Upload:** Allows librarians to upload any custom catalog spreadsheet directly from the web browser.

---

## 5. Protocols (SIP2 & NCIP)

* **3M SIP2:** Test communication with self-checkout kiosks using standard messages (93 Login, 11 Item Query, 17 Checkout, 09 Checkin, 29 Renew).
* **NCIP 2.0:** Test machine-to-machine integrations via JSON payloads (`LookupItem`, `CheckOutItem`, `CheckInItem`).

---

## 6. Audit Trail & System Health

* **KPI Dashboard:** Monitor real-time counts for catalog titles, total physical copies, RFID tagging percentage, currently borrowed items, and security gate violations.
* **Immutable Audit Trail:** Review an unalterable timestamped ledger recording every checkout, checkin, login, tag encoding, untagging, and gate breach.
* **Snapshot Backup:** Click **Snapshot Backup** in the top bar anytime to generate an integrity-verified `.db` backup file.
