# User Guide - AISYS RFID ILMS

This guide assists librarians, library staff, and patrons in using the day-to-day features of the system.

---

## 1. OPAC Catalog & Discovery
* **Search:** Enter any keyword (title, author, ISBN, or topic) in the OPAC search box.
* **Filter:** Select categories from the dropdown (Computer Science, Literature, Reference).
* **Virtual Bookshelf:** Browse books visually organized by shelf location. Click any book spine to see real-time shelf status and RFID EPC tag information.
* **Spine Labels:** Click "Spine Label" to preview thermal sticker print layouts including Dewey Call Number, Cutter code, and barcode.

---

## 2. Circulation Desk Operations

### Checking Out an Item
1. Enter the Patron Card Code (e.g., `MEM-101`).
2. Enter the Item Accession Number (e.g., `ACC-10001`) or scan the RFID EPC.
3. Click **Issue Book & Disarm RFID Security**.
4. The system validates:
   - Patron is not suspended.
   - Patron outstanding fines do not exceed the $15.00 limit.
   - Book is not designated `REFERENCE_ONLY`.
5. Upon successful checkout, the book's RFID security bit is **disarmed (0)** so it can pass through security gates.

### Returning an Item
1. Enter the Item Accession Number or scan the tag.
2. Click **Return Book & Arm Security Bit**.
3. If the item is overdue, the fine engine calculates overdue fees ($0.50/day) and posts it to the patron's balance.
4. The RFID security bit is automatically **re-armed (1)** to protect it against theft.

### Renewals
1. Enter the Accession Number in the Renew box.
2. Click **Renew Loan**. Loans can be extended up to 3 times if no overdue fines or holds exist.

---

## 3. RFID Hardware Studio

### Staff Tagging Station
* Used to pair a newly acquired book copy with an RFID Gen2 smart tag.
* Enter the Accession Number and the 16–32 character hex EPC tag ID.
* The system validates the catalog record and locks the EPC mapping.

### Handheld Inventory Scanner
* Used during periodic physical audits.
* Select the shelf ID (e.g. `SHELF-CS-01`) and simulate reading the tags on the shelf.
* The system checks:
  - **Found:** Items correctly placed on this shelf.
  - **Misplaced:** Items belonging to another shelf (triggers a double warning tone).
  - **Missing:** Books that should be on this shelf but were not scanned (triggers a caution tone).

### Security Gate Portal Simulator
* Simulates overhead security antennas at library exits.
* If a patron attempts to leave with an item whose security bit is **armed (1)**:
  - An emergency siren sounds.
  - A red security violation banner flashes.
  - The CCTV camera takes an instant visual snapshot.
  - An automated alert email is queued to security staff.
