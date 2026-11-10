from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    TagAssociationRequest, TagAssociationResponse,
    HandheldScanRequest, HandheldScanResponse,
    GatePassageRequest, GatePassageResponse
)
from app.services.rfid_middleware import (
    associate_tag_to_item, get_tag_details,
    get_all_tagged_items, untag_item
)
from app.services.inventory import audit_shelf_inventory
from app.services.gate import process_gate_passage

router = APIRouter(prefix="/api/v1/rfid", tags=["RFID Middleware & Hardware Mocks"])

# 1. Staff Station: Associate & Untag Items (AC 02, FR 05)
@router.post("/staff/tag-item", response_model=TagAssociationResponse)
def tag_item(req: TagAssociationRequest):
    try:
        return associate_tag_to_item(req.accession_number, req.rfid_epc)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/staff/untag-item")
def untag_item_route(identifier: str = Query(..., description="Accession number or EPC to untag")):
    try:
        return untag_item(identifier)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.get("/tags")
def list_tagged_items(
    limit: int = 30,
    offset: int = 0,
    q: Optional[str] = Query(None, description="Search EPC, barcode, title, or author")
):
    return get_all_tagged_items(limit=limit, offset=offset, query=q)

@router.get("/tags/{epc}")
def inspect_tag(epc: str):
    details = get_tag_details(epc)
    if not details:
        raise HTTPException(status_code=404, detail=f"Tag EPC '{epc}' not associated with any catalogued item")
    return details

# 2. Handheld Reader: Inventory Audit (AC 05, FR 06)
@router.post("/handheld/audit-shelf", response_model=HandheldScanResponse)
def handheld_shelf_audit(req: HandheldScanRequest):
    return audit_shelf_inventory(shelf_id=req.shelf_id, scanned_epcs=req.scanned_epcs)

# 3. Security Gate: Passage & Alarm Processing (AC 06, FR 07)
@router.post("/gate/passage", response_model=GatePassageResponse)
def gate_passage(req: GatePassageRequest):
    return process_gate_passage(
        portal_id=req.portal_id,
        detected_epcs=req.detected_epcs,
        mock_cctv_base64=req.mock_cctv_frame_base64
    )
