# Mock Interfaces & Device Abstraction Specification

This document details the interface contracts and mock adapters for unavailable physical devices and external protocols, fulfilling requirements FR 03, FR 07, and Section 6.

---

## 1. RFID Staff Station Adapter (`app/services/rfid_middleware.py`)
Simulates a desktop USB/Ethernet RFID reader used by librarians for tagging items and patron cards.

### Interface Contract:
* `read_tag() -> TagReadResult`
  - Returns scanned `epc`, `tid`, and current `security_bit` state.
* `encode_item_tag(accession_no: str, epc: str) -> TagEncodeResult`
  - Validates that `accession_no` exists in database and is not already paired to an active tag.
  - Sets tag memory bank and arms security bit (`security_bit = 1`).
* `retag_item(accession_no: str, new_epc: str, reason: str) -> TagEncodeResult`
  - Updates tag mapping with audit logging.

---

## 2. Handheld Inventory Scanner Adapter (`app/services/inventory.py`)
Simulates an Android/Windows CE mobile RFID gun used for shelf audits.

### Interface Contract:
* `scan_shelf(shelf_id: str, scanned_epcs: list[str]) -> ShelfAuditReport`
  - Compares scanned EPCs against database expectations for `shelf_id`.
  - Flags:
    - **Found:** Items correctly placed on shelf.
    - **Misplaced:** Items belonging to a different shelf location.
    - **Missing:** Items expected on this shelf but absent in scan.
  - Generates audible/visible feedback events (`BEEP_CONFIRM`, `ALARM_MISPLACED`).

---

## 3. Security Gate & CCTV Adapter (`app/services/gate.py`)
Simulates 3D overhead/pedestal RFID security gates at library entry/exit portals.

### Interface Contract:
* `process_passage(portal_id: str, tag_epcs: list[str]) -> GatePassageEvent`
  - For each detected tag:
    - Checks `security_bit` directly (can operate in offline/cache mode).
    - If `security_bit == 1` (armed/unissued):
      - Triggers siren alarm (`alarm_triggered = True`).
      - Calls mock CCTV capture service to record snapshot image.
      - Dispatches queued security email alert.
    - If `security_bit == 0` (properly checked out):
      - Silent green passage, increments footfall counter.

---

## 4. SIP2 Protocol Mock Adapter (`app/services/sip2_ncip_adapter.py`)
3M Standard Interchange Protocol v2 message boundary.

### Supported Frames:
* **Message 93 (Login):**
  - Request: `93<UID><PWD>`
  - Response: `941` (OK) or `940` (Denied)
* **Message 11 (Item Information):**
  - Request: `11<Date><ItemIdentifier>`
  - Response: `12<CircStatus><SecurityMarker><DueDate><TitleIdentifier>`
* **Message 17 (Checkout):**
  - Request: `17<SC_Renewal><NoBlock><Date><PatronIdentifier><ItemIdentifier>`
  - Response: `18<Ok><RenewalOk><MagneticMedia><Desensitize><Date><PatronIdentifier><ItemIdentifier><TitleIdentifier><DueDate>`
* **Message 09 (Checkin):**
  - Request: `09<NoBlock><Date><ItemIdentifier>`
  - Response: `10<Ok><Resensitize><MagneticMedia><Alert><Date><ItemIdentifier><TitleIdentifier>`

---

## 5. NCIP 2.0 Adapter
NISO Circulation Interchange Protocol JSON/REST endpoint (`/api/v1/interop/ncip`):
* `LookupItem`: Retrieve circulation & bibliographic status by item or tag identifier.
* `CheckOutItem`: Borrow item through NCIP protocol envelope.
* `CheckInItem`: Return item and re-sensitize security bit.
* `RenewItem`: Extend lending period.
