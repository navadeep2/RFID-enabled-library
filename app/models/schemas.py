from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Authentication & RBAC
class LoginRequest(BaseModel):
    username_or_code: str
    password: Optional[str] = None
    smart_card_uid: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    member_code: str
    full_name: str
    role: str

# Cataloguing & Items
class TitleCreate(BaseModel):
    isbn: str
    title: str
    author: str
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    dewey_decimal: Optional[str] = None
    category: str = "General"

class TitleResponse(TitleCreate):
    id: int
    created_at: Any
    updated_at: Any

class ItemCreate(BaseModel):
    title_id: int
    accession_number: str
    rfid_epc: Optional[str] = None
    status: str = "AVAILABLE"
    shelf_location: str = "SHELF-A1-01"

class ItemResponse(BaseModel):
    id: int
    title_id: int
    title: str
    author: str
    isbn: str
    accession_number: str
    rfid_epc: Optional[str] = None
    security_bit: int
    status: str
    shelf_location: str
    current_shelf: Optional[str] = None
    last_seen_at: Optional[Any] = None

# Circulation
class CheckoutRequest(BaseModel):
    member_code: str
    item_identifier: str  # Can be accession_number or rfid_epc
    checkout_method: str = "STAFF_STATION"
    operator_id: Optional[int] = None

class CheckoutResponse(BaseModel):
    success: bool
    circulation_id: Optional[int] = None
    item_title: str
    accession_number: str
    patron_name: str
    due_date: str
    message: str

class CheckinRequest(BaseModel):
    item_identifier: str  # accession_number or rfid_epc
    operator_id: Optional[int] = None

class CheckinResponse(BaseModel):
    success: bool
    item_title: str
    accession_number: str
    fine_accrued: float = 0.0
    message: str

class RenewalRequest(BaseModel):
    circulation_id: Optional[int] = None
    item_identifier: Optional[str] = None

class RenewalResponse(BaseModel):
    success: bool
    new_due_date: str
    renewals_count: int
    message: str

# RFID Operations
class TagAssociationRequest(BaseModel):
    accession_number: str
    rfid_epc: str

class TagAssociationResponse(BaseModel):
    success: bool
    accession_number: str
    rfid_epc: str
    item_title: str
    security_bit: int
    message: str

class HandheldScanRequest(BaseModel):
    shelf_id: str
    scanned_epcs: List[str]

class HandheldScanResponse(BaseModel):
    shelf_id: str
    total_scanned: int
    expected_count: int
    found_items: List[Dict[str, Any]]
    misplaced_items: List[Dict[str, Any]]
    missing_items: List[Dict[str, Any]]
    audio_event: str  # "CONFIRM", "ALERT_MISPLACED", "ALERT_MISSING"

class GatePassageRequest(BaseModel):
    portal_id: str = "GATE-MAIN-01"
    detected_epcs: List[str]
    mock_cctv_frame_base64: Optional[str] = None

class GatePassageResponse(BaseModel):
    portal_id: str
    alarm_triggered: bool
    total_tags: int
    violations: List[Dict[str, Any]]
    cctv_snapshot_url: Optional[str] = None
    email_alert_queued: bool
    message: str

# Protocol Interop (SIP2 & NCIP)
class Sip2MessageRequest(BaseModel):
    raw_message: str

class Sip2MessageResponse(BaseModel):
    request_cmd: str
    response_frame: str

class NcipLookupRequest(BaseModel):
    item_id: str

# Migration
class MigrationStartRequest(BaseModel):
    csv_content: Optional[str] = None
    file_path: Optional[str] = None
    dry_run: bool = False

class MigrationReport(BaseModel):
    batch_id: str
    total_records: int
    valid_count: int
    duplicate_count: int
    invalid_count: int
    migrated_count: int
    is_dry_run: bool
    error_sample: List[Dict[str, Any]]
    duration_seconds: float
