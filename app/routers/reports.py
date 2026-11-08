from typing import Optional
from fastapi import APIRouter, Query
from app.services.reports import get_dashboard_summary, get_detailed_report

router = APIRouter(prefix="/api/v1/reports", tags=["Analytics & Reporting"])

@router.get("/summary")
def dashboard_summary():
    return get_dashboard_summary()

@router.get("/details")
def detailed_report(
    report_type: str = Query(..., description="circulation, gate_events, or tagged_items"),
    filter_status: Optional[str] = Query(None, description="active, overdue, alarm, tagged, untagged"),
    limit: int = 100
):
    return get_detailed_report(report_type, filter_status=filter_status, limit=limit)
