from typing import List, Dict, Any, Optional
from app.database import db_session
from app.services.audit import record_audit

def audit_shelf_inventory(
    shelf_id: str,
    scanned_epcs: List[str],
    operator_id: str = "HANDHELD_USER",
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    target_shelf = shelf_id.strip().upper()
    cleaned_epcs = [epc.strip().upper() for epc in scanned_epcs if epc.strip()]

    with db_session(db_path) as conn:
        cursor = conn.cursor()

        # 1. Fetch all items expected to be on this shelf
        cursor.execute(
            """SELECT i.*, t.title, t.author, t.dewey_decimal 
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.shelf_location = ? AND i.status = 'AVAILABLE'""",
            (target_shelf,)
        )
        all_expected_rows = [dict(row) for row in cursor.fetchall()]
        expected_items = {row["accession_number"]: row for row in all_expected_rows}

        # 2. Fetch information for all scanned identifiers (accepts either RFID EPC or Barcode Accession)
        scanned_items_map = {}
        if cleaned_epcs:
            placeholders = ",".join("?" for _ in cleaned_epcs)
            cursor.execute(
                f"""SELECT i.*, t.title, t.author, t.dewey_decimal 
                    FROM items i
                    JOIN titles t ON i.title_id = t.id
                    WHERE i.rfid_epc IN ({placeholders}) OR i.accession_number IN ({placeholders})""",
                cleaned_epcs + cleaned_epcs
            )
            for row in cursor.fetchall():
                d = dict(row)
                if d.get("rfid_epc"):
                    scanned_items_map[d["rfid_epc"]] = d
                if d.get("accession_number"):
                    scanned_items_map[d["accession_number"]] = d

        found_items = []
        misplaced_items = []
        scanned_accounted_accessions = set()

        for ident in cleaned_epcs:
            item_info = scanned_items_map.get(ident)
            if item_info:
                scanned_accounted_accessions.add(item_info["accession_number"])
                cursor.execute(
                    "UPDATE items SET current_shelf = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (target_shelf, item_info["id"])
                )

                if item_info["shelf_location"] == target_shelf:
                    found_items.append(item_info)
                else:
                    misplaced_entry = dict(item_info)
                    misplaced_entry["expected_shelf"] = item_info["shelf_location"]
                    misplaced_entry["found_on_shelf"] = target_shelf
                    misplaced_items.append(misplaced_entry)
            else:
                misplaced_items.append({
                    "rfid_epc": ident,
                    "accession_number": ident if ident.startswith("ACC-") else "UNKNOWN",
                    "title": "Unregistered / Unknown Tag",
                    "expected_shelf": "NONE",
                    "found_on_shelf": target_shelf
                })

        # 3. Missing items: Expected on target_shelf, but not scanned
        missing_items = [
            item for acc, item in expected_items.items()
            if acc not in scanned_accounted_accessions
        ]

        if misplaced_items:
            audio_event = "ALERT_MISPLACED"
        elif missing_items:
            audio_event = "ALERT_MISSING"
        else:
            audio_event = "BEEP_CONFIRM"

        report = {
            "shelf_id": target_shelf,
            "total_scanned": len(cleaned_epcs),
            "expected_count": len(expected_items),
            "found_count": len(found_items),
            "misplaced_count": len(misplaced_items),
            "missing_count": len(missing_items),
            "found_items": found_items,
            "misplaced_items": misplaced_items,
            "missing_items": missing_items,
            "audio_event": audio_event,
            "visual_status": "RED" if misplaced_items else ("YELLOW" if missing_items else "GREEN")
        }

        record_audit(
            actor_id=operator_id,
            action="INVENTORY_SHELF_AUDIT",
            entity_type="SHELF",
            entity_id=target_shelf,
            details={
                "scanned": len(cleaned_epcs),
                "misplaced": len(misplaced_items),
                "missing": len(missing_items)
            },
            conn=conn
        )

        return report
