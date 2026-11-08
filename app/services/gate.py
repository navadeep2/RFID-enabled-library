import base64
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import settings
from app.database import db_session
from app.services.audit import record_audit
from app.services.notification import NotificationAdapter
from app.logger import logger

def simulate_cctv_capture(portal_id: str, accession_number: str, custom_base64: Optional[str] = None) -> str:
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    filename = f"cctv_{portal_id}_{accession_number}_{timestamp_str}.png"
    filepath = Path(settings.cctv_storage_path) / filename

    if custom_base64 and "," in custom_base64:
        _, b64data = custom_base64.split(",", 1)
        filepath.write_bytes(base64.b64decode(b64data))
    else:
        placeholder_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        )
        filepath.write_bytes(placeholder_png)

    return f"/static/cctv/{filename}"

def process_gate_passage(
    portal_id: str,
    detected_epcs: List[str],
    mock_cctv_base64: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    cleaned_epcs = [epc.strip().upper() for epc in detected_epcs if epc.strip()]
    violations = []
    alarm_triggered = False
    cctv_url = None
    email_queued = False

    with db_session(db_path) as conn:
        cursor = conn.cursor()

        if not cleaned_epcs:
            cursor.execute(
                """INSERT INTO gate_events (event_type, alarm_triggered) 
                   VALUES ('FOOTFALL_PASSAGE', 0)"""
            )
            return {
                "portal_id": portal_id,
                "alarm_triggered": False,
                "total_tags": 0,
                "violations": [],
                "cctv_snapshot_url": None,
                "email_alert_queued": False,
                "message": "Footfall passage recorded. No RFID tags detected."
            }

        for epc in cleaned_epcs:
            cursor.execute(
                """SELECT i.*, t.title FROM items i 
                   JOIN titles t ON i.title_id = t.id 
                   WHERE i.rfid_epc = ?""",
                (epc,)
            )
            item = cursor.fetchone()

            is_unauthorised = False
            acc_num = "UNKNOWN"
            sec_bit = 1
            item_title = "Unknown / Uncatalogued Item"

            if item:
                acc_num = item["accession_number"]
                sec_bit = item["security_bit"]
                item_title = item["title"]
                if item["security_bit"] == 1 or item["status"] != "ISSUED":
                    is_unauthorised = True
            else:
                is_unauthorised = True

            if is_unauthorised:
                alarm_triggered = True
                snapshot_path = simulate_cctv_capture(portal_id, acc_num, mock_cctv_base64)
                cctv_url = snapshot_path

                subject = f"SECURITY ALERT: Unauthorised Removal at {portal_id} - Item {acc_num}"
                body = (
                    f"Breach detected at Portal: {portal_id}\n"
                    f"Timestamp: {datetime.now(timezone.utc).isoformat()}\n"
                    f"Accession Number: {acc_num}\n"
                    f"Title: {item_title}\n"
                    f"RFID EPC: {epc}\n"
                    f"Security Bit: {sec_bit}\n"
                    f"CCTV Snapshot recorded: {snapshot_path}"
                )
                NotificationAdapter.send_email(
                    recipient="security-ops@library.local",
                    subject=subject,
                    message=body,
                    conn=conn
                )
                email_queued = True

                cursor.execute(
                    """INSERT INTO gate_events (
                           event_type, rfid_epc, accession_number, security_bit, 
                           alarm_triggered, cctv_snapshot_path, notification_queued
                       ) VALUES ('UNAUTHORISED_REMOVAL', ?, ?, ?, 1, ?, 1)""",
                    (epc, acc_num, sec_bit, snapshot_path)
                )

                violations.append({
                    "rfid_epc": epc,
                    "accession_number": acc_num,
                    "item_title": item_title,
                    "security_bit": sec_bit,
                    "snapshot_url": snapshot_path
                })
            else:
                cursor.execute(
                    """INSERT INTO gate_events (
                           event_type, rfid_epc, accession_number, security_bit, alarm_triggered
                       ) VALUES ('AUTHORISED_EXIT', ?, ?, 0, 0)""",
                    (epc, acc_num)
                )

        if alarm_triggered:
            record_audit(
                actor_id=portal_id,
                action="GATE_SECURITY_ALARM",
                entity_type="PORTAL",
                entity_id=portal_id,
                details={"violations": violations, "cctv": cctv_url},
                conn=conn
            )

        return {
            "portal_id": portal_id,
            "alarm_triggered": alarm_triggered,
            "total_tags": len(cleaned_epcs),
            "violations": violations,
            "cctv_snapshot_url": cctv_url,
            "email_alert_queued": email_queued,
            "message": "ALARM! Unauthorised item detected at gate." if alarm_triggered else "Passage approved."
        }
