# Mock Interfaces & Device Abstraction Specification

This document details the interface contracts and mock adapters for hardware devices and external protocols, fulfilling requirements FR 03, FR 07, and Section 6 of the SOP.

---

## 1. RFID Staff Station Adapter (`app/services/rfid_middleware.py`)
Simulates a desktop USB/Ethernet RFID reader/writer used by librarians for tagging items and managing tag registries.

### Interface Contracts:
* `associate_tag_to_item(accession_no: str, epc: str) -> TagAssociationResponse`
  - Validates that `accession_no` exists in the database and is not already paired to an active tag.
  - Enforces 16–32 character hex EPC formatting.
  - Sets tag memory bank and arms security bit (`security_bit = 1`).
  - Emits `TAG_ENCODED` event to the internal event bus and logs an immutable audit event.
* `untag_item(identifier: str) -> dict`
  - Disassociates an RFID EPC tag from a physical book (`rfid_epc = NULL`, `security_bit = 0`).
  - Emits `TAG_REMOVED` event and logs an immutable audit event (`TAG_UNLINK`).
* `get_all_tagged_items(limit: int, offset: int, query: str) -> dict`
  - Returns a paginated catalog of all physical copies currently linked to active RFID EPC tags.
* `get_tag_details(epc: str) -> dict`
  - Looks up the catalog record and circulation status associated with an EPC.

---

## 2. Handheld Inventory Scanner Adapter (`app/services/inventory.py`)
Simulates an RFID handheld wand (e.g. Zebra / Nordic ID) with dual-mode barcode/EPC resolution for shelf audits.

### Interface Contract:
* `audit_shelf_inventory(shelf_id: str, scanned_epcs: list[str]) -> HandheldScanResponse`
  - **Dual-Mode Identifier Resolution:**
    - Accepts **RFID EPCs** (e.g. `E280110520000001`) scanned wirelessly over the air, OR
    - Accepts **Book Barcodes** (e.g. `ACC-10001`) scanned optically or entered manually.
  - Compares scanned identifiers against the catalog database for `shelf_id`.
  - Reconciles items into:
    - **Found (`found_items`):** Items assigned to this shelf and physically detected.
    - **Misplaced (`misplaced_items`):** Items detected here that belong to a different shelf location.
    - **Missing (`missing_items`):** Items catalogued on this shelf that were not detected.
  - Updates `current_shelf` and `last_seen_at` timestamps for detected items.
  - Emits status event: `ALERT_MISPLACED`, `ALERT_MISSING`, or `BEEP_CONFIRM`.

---

## 3. Security Gate & CCTV Adapter (`app/services/gate.py`)
Simulates 3D overhead/pedestal RFID security gates at library entry and exit portals.

### Interface Contract:
* `process_gate_passage(portal_id: str, detected_epcs: list[str], mock_cctv_base64: str) -> GatePassageResponse`
  - For each detected tag:
    - Inspects `security_bit` in real time:
      - **If `security_bit == 1` (Armed / Unissued):**
        - Triggers security breach (`alarm_triggered = True`).
        - Records timestamped CCTV capture to `data/cctv_captures/`.
        - Enqueues security alert email via `notification_service`.
        - Logs audit event `GATE_SECURITY_ALARM`.
      - **If `security_bit == 0` (Disarmed / Borrowed):**
        - Grants authorized silent passage (`alarm_triggered = False`).

---

## 4. SIP2 Protocol Mock Adapter (`app/services/sip2_ncip_adapter.py`)
3M Standard Interchange Protocol v2 message boundary for self-checkout kiosks and automated materials handling (AMH) sorters.

### Supported Frames:
* **Message 93 (Login Request):**
  - Frame: `93<UID><PWD>` &rarr; Response `941` (OK) or `940` (Denied).
* **Message 11 (Item Information Query):**
  - Frame: `11<Date><ItemIdentifier>` &rarr; Response `12<CircStatus><SecurityMarker><DueDate><TitleIdentifier>`.
* **Message 17 (Checkout Request):**
  - Frame: `17<SC_Renewal><NoBlock><Date><PatronIdentifier><ItemIdentifier>` &rarr; Response `18<Ok><RenewalOk><MagneticMedia><Desensitize><DueDate>`.
* **Message 09 (Checkin Request):**
  - Frame: `09<NoBlock><Date><ItemIdentifier>` &rarr; Response `10<Ok><Resensitize><Alert><Date><ItemIdentifier>`.
* **Message 29 (Renewal Request):**
  - Frame: `29<NoBlock><Date><ItemIdentifier>` &rarr; Response `30<Ok><RenewalOk><DueDate>`.

---

## 5. NCIP 2.0 Protocol Adapter
NISO Circulation Interchange Protocol JSON/REST endpoint (`/api/v1/interop/ncip`):
* `LookupItem`: Retrieve bibliographic details, shelf location, and circulation state.
* `CheckOutItem`: Issue item to patron through NCIP protocol envelope and disarm security bit.
* `CheckInItem`: Return item and re-sensitize security bit.
* `RenewItem`: Extend lending period.
