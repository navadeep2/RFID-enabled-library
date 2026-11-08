import sqlite3
from typing import Dict, Any, Optional
from app.database import db_session
from app.logger import logger

class NotificationAdapter:
    @staticmethod
    def send_email(recipient: str, subject: str, message: str, db_path: Optional[str] = None, conn: Optional[sqlite3.Connection] = None) -> int:
        return _enqueue_notification("EMAIL", recipient, subject, message, db_path, conn)

    @staticmethod
    def send_sms(recipient: str, message: str, db_path: Optional[str] = None, conn: Optional[sqlite3.Connection] = None) -> int:
        return _enqueue_notification("SMS", recipient, "SMS Alert", message, db_path, conn)

    @staticmethod
    def print_slip(recipient: str, slip_content: str, db_path: Optional[str] = None, conn: Optional[sqlite3.Connection] = None) -> int:
        return _enqueue_notification("PRINT", recipient, "Circulation Receipt Slip", slip_content, db_path, conn)

def _enqueue_notification(channel: str, recipient: str, subject: str, message: str, db_path: Optional[str] = None, conn: Optional[sqlite3.Connection] = None) -> int:
    sql = """INSERT INTO notifications (channel, recipient, subject, message, status)
             VALUES (?, ?, ?, ?, 'QUEUED')"""
    params = (channel, recipient, subject, message)

    if conn is not None:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        notif_id = cursor.lastrowid
        logger.info(f"NOTIFICATION [{channel}] to {recipient}: {subject}")
        return notif_id

    with db_session(db_path) as session_conn:
        cursor = session_conn.cursor()
        cursor.execute(sql, params)
        notif_id = cursor.lastrowid
        logger.info(f"NOTIFICATION [{channel}] to {recipient}: {subject}")
        return notif_id

def get_queued_notifications(limit: int = 50, db_path: Optional[str] = None):
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notifications ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(r) for r in cursor.fetchall()]
