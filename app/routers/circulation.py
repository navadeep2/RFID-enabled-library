from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    CheckoutRequest, CheckoutResponse,
    CheckinRequest, CheckinResponse,
    RenewalRequest, RenewalResponse
)
from app.services.circulation import checkout_item, checkin_item, renew_item, get_member

router = APIRouter(prefix="/api/v1/circulation", tags=["Circulation Engine"])

@router.post("/checkout", response_model=CheckoutResponse)
def api_checkout(req: CheckoutRequest):
    try:
        result = checkout_item(
            member_code=req.member_code,
            item_identifier=req.item_identifier,
            checkout_method=req.checkout_method,
            operator_id=req.operator_id
        )
        return result
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/checkin", response_model=CheckinResponse)
def api_checkin(req: CheckinRequest):
    try:
        result = checkin_item(
            item_identifier=req.item_identifier,
            operator_id=req.operator_id
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/renew", response_model=RenewalResponse)
def api_renew(req: RenewalRequest):
    if not req.item_identifier:
        raise HTTPException(status_code=400, detail="item_identifier is required")
    try:
        result = renew_item(item_identifier=req.item_identifier)
        return result
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.get("/members/{member_code}")
def api_get_member(member_code: str):
    member = get_member(member_code)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    # Return member without password hash
    safe_copy = dict(member)
    safe_copy.pop("password_hash", None)
    return safe_copy
