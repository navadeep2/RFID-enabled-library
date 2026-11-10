import re
from typing import Optional, Dict, Any, List
from app.database import db_session
from app.services.audit import record_audit

# Device-Neutral Event Bus for RFID hardware
class RFIDEventBus:
    _listeners: List[Any] = []

    @classmethod
    def register_listener(cls, listener):
        cls._listeners.append(listener)

    @classmethod
    def publish_event(cls, event_type: str, payload: Dict[str, Any]):
        for listener in cls._listeners:
            try:
                listener(event_type, payload)
            except Exception:
                pass

def validate_epc_format(epc: str) -> bool:
    clean = epc.strip().upper()
    return bool(re.match(r"^[0-9A-F]{16,32}$", clean))

def associate_tag_to_item(
    accession_number: str,
    rfid_epc: str,
    operator_id: str = "STAFF_STATION",
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    clean_acc = accession_number.strip().upper()
    clean_epc = rfid_epc.strip().upper()

    if not validate_epc_format(clean_epc):
        raise ValueError(f"Invalid RFID EPC format: '{rfid_epc}'. Must be a 16-32 character hex string.")

    with db_session(db_path) as conn:
        cursor = conn.cursor()

        cursor.execute(
            """SELECT i.*, t.title, t.isbn, t.author 
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.accession_number = ?""",
            (clean_acc,)
        )
        item = cursor.fetchone()
        if not item:
            raise ValueError(f"Validation failed: No catalog record found for accession number '{clean_acc}'")

        cursor.execute("SELECT accession_number FROM items WHERE rfid_epc = ? AND accession_number != ?", (clean_epc, clean_acc))
        conflict = cursor.fetchone()
        if conflict:
            raise ValueError(f"RFID EPC '{clean_epc}' is already associated with accession '{conflict['accession_number']}'")

        sec_bit = 0 if item["status"] == "ISSUED" else 1
        cursor.execute(
            """UPDATE items 
               SET rfid_epc = ?, security_bit = ?, last_seen_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (clean_epc, sec_bit, item["id"])
        )

        record_audit(
            actor_id=operator_id,
            action="TAG_ASSOCIATE",
            entity_type="ITEM",
            entity_id=clean_acc,
            details={"rfid_epc": clean_epc, "title": item["title"], "security_bit": sec_bit},
            conn=conn
        )

        RFIDEventBus.publish_event("TAG_ENCODED", {
            "accession_number": clean_acc,
            "rfid_epc": clean_epc,
            "security_bit": sec_bit
        })

        return {
            "success": True,
            "accession_number": clean_acc,
            "rfid_epc": clean_epc,
            "item_title": item["title"],
            "security_bit": sec_bit,
            "message": f"Successfully associated RFID Tag [{clean_epc}] to item '{item['title']}' ({clean_acc})."
        }

def get_tag_details(rfid_epc: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    clean_epc = rfid_epc.strip().upper()
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT i.*, t.title, t.author, t.isbn, t.category
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.rfid_epc = ?""",
            (clean_epc,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

def get_all_tagged_items(
    limit: int = 30,
    offset: int = 0,
    query: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        sql = """
            SELECT i.id, i.accession_number, i.rfid_epc, i.security_bit, i.status, 
                   i.shelf_location, i.current_shelf, i.last_seen_at,
                   t.title, t.author, t.category, t.dewey_decimal, t.isbn
            FROM items i
            JOIN titles t ON i.title_id = t.id
            WHERE i.rfid_epc IS NOT NULL AND i.rfid_epc != ''
        """
        params = []
        if query and query.strip():
            w = f"%{query.strip()}%"
            sql += " AND (i.rfid_epc LIKE ? OR i.accession_number LIKE ? OR t.title LIKE ? OR t.author LIKE ?)"
            params.extend([w, w, w, w])

        sql += " ORDER BY i.id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(sql, params)
        rows = [dict(r) for r in cursor.fetchall()]

        count_sql = """
            SELECT COUNT(*) 
            FROM items i
            JOIN titles t ON i.title_id = t.id
            WHERE i.rfid_epc IS NOT NULL AND i.rfid_epc != ''
        """
        count_params = []
        if query and query.strip():
            w = f"%{query.strip()}%"
            count_sql += " AND (i.rfid_epc LIKE ? OR i.accession_number LIKE ? OR t.title LIKE ? OR t.author LIKE ?)"
            count_params.extend([w, w, w, w])

        cursor.execute(count_sql, count_params)
        total = cursor.fetchone()[0]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": rows
        }

def untag_item(
    identifier: str,
    operator_id: str = "STAFF_STATION",
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    clean_id = identifier.strip().upper()
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT i.*, t.title 
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.accession_number = ? OR i.rfid_epc = ?""",
            (clean_id, clean_id)
        )
        item = cursor.fetchone()
        if not item:
            raise ValueError(f"Item not found for identifier '{clean_id}'")

        old_epc = item["rfid_epc"]
        cursor.execute(
            "UPDATE items SET rfid_epc = NULL, security_bit = 0, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
            (item["id"],)
        )

        record_audit(
            actor_id=operator_id,
            action="TAG_UNLINK",
            entity_type="ITEM",
            entity_id=item["accession_number"],
            details={"previous_rfid_epc": old_epc, "title": item["title"]},
            conn=conn
        )

        RFIDEventBus.publish_event("TAG_REMOVED", {
            "accession_number": item["accession_number"],
            "previous_epc": old_epc
        })

        return {
            "success": True,
            "accession_number": item["accession_number"],
            "removed_epc": old_epc,
            "item_title": item["title"],
            "message": f"Successfully removed RFID Tag [{old_epc}] from item '{item['title']}' ({item['accession_number']})."
        }
