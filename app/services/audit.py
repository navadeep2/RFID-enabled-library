import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.database import db_session
from app.logger import logger

def record_audit(
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = "127.0.0.1",
    db_path: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None
) -> int:
    """Writes an immutable entry to the audit log."""
    details_str = json.dumps(details or {})
    timestamp = datetime.now(timezone.utc).isoformat()
    sql = """INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)"""
    params = (actor_id, action, entity_type, entity_id, details_str, ip_address, timestamp)

    if conn is not None:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        log_id = cursor.lastrowid
        logger.info(f"AUDIT [{action}] by {actor_id} on {entity_type}:{entity_id}")
        return log_id

    with db_session(db_path) as session_conn:
        cursor = session_conn.cursor()
        cursor.execute(sql, params)
        log_id = cursor.lastrowid
        logger.info(f"AUDIT [{action}] by {actor_id} on {entity_type}:{entity_id}")
        return log_id

def get_audit_trail(limit: int = 100, entity_type: Optional[str] = None, db_path: Optional[str] = None):
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        if entity_type:
            cursor.execute(
                "SELECT * FROM audit_logs WHERE entity_type = ? ORDER BY id DESC LIMIT ?",
                (entity_type, limit)
            )
        else:
            cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(row) for row in cursor.fetchall()]
