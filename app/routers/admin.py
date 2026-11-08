from typing import Optional
from fastapi import APIRouter, HTTPException
from app.services.audit import get_audit_trail
from app.database import create_db_backup, restore_db_backup
from app.services.notification import get_queued_notifications

router = APIRouter(prefix="/api/v1/admin", tags=["Administration & Operations"])

@router.get("/audit-logs")
def audit_logs(limit: int = 100, entity_type: Optional[str] = None):
    return get_audit_trail(limit=limit, entity_type=entity_type)

@router.get("/notifications")
def notifications(limit: int = 50):
    return get_queued_notifications(limit=limit)

@router.post("/backup")
def trigger_backup():
    try:
        backup_file, sha256 = create_db_backup()
        return {
            "success": True,
            "backup_file": backup_file,
            "sha256": sha256,
            "message": "Database snapshot successfully created."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore")
def trigger_restore(backup_file: str):
    try:
        restore_db_backup(backup_file)
        return {
            "success": True,
            "message": f"Database successfully restored from {backup_file}."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
