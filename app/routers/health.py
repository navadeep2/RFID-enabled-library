import os
import shutil
import sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings

router = APIRouter(prefix="/api/v1/health", tags=["System Diagnostics"])

@router.get("")
def get_system_health():
    # Database connectivity check
    db_ok = False
    db_size_bytes = 0
    wal_size_bytes = 0
    try:
        conn = sqlite3.connect(settings.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        if cursor.fetchone()[0] == 1:
            db_ok = True
        conn.close()

        if os.path.exists(settings.db_path):
            db_size_bytes = os.path.getsize(settings.db_path)
        wal_path = settings.db_path + "-wal"
        if os.path.exists(wal_path):
            wal_size_bytes = os.path.getsize(wal_path)
    except Exception:
        db_ok = False

    # Disk storage check
    disk = shutil.disk_usage(os.path.dirname(settings.db_path))

    return {
        "status": "HEALTHY" if db_ok else "DEGRADED",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "connected": db_ok,
            "engine": "SQLite WAL",
            "db_size_mb": round(db_size_bytes / (1024 * 1024), 2),
            "wal_size_mb": round(wal_size_bytes / (1024 * 1024), 2)
        },
        "disk": {
            "total_gb": round(disk.total / (1024**3), 2),
            "free_gb": round(disk.free / (1024**3), 2),
            "free_percentage": round((disk.free / disk.total) * 100, 1)
        },
        "offline_ready": settings.offline_mode
    }
