from fastapi import APIRouter
from app.models.schemas import Sip2MessageRequest, Sip2MessageResponse
from app.services.sip2_ncip_adapter import SIP2Parser, NCIP2Adapter

router = APIRouter(prefix="/api/v1/interop", tags=["Standards Interoperability (SIP2 & NCIP 2.0)"])

@router.post("/sip2", response_model=Sip2MessageResponse)
def handle_sip2_frame(req: Sip2MessageRequest):
    raw = req.raw_message.strip()
    cmd = raw[:2] if len(raw) >= 2 else "UNKNOWN"
    response_frame = SIP2Parser.process_message(raw)
    return {
        "request_cmd": cmd,
        "response_frame": response_frame
    }

@router.post("/ncip/{action}")
def handle_ncip_request(action: str, payload: dict):
    return NCIP2Adapter.process_ncip_request(action, payload)
