from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from app.config import settings
from app.database import db_session
from app.services.audit import record_audit

def get_member(member_code: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM members WHERE member_code = ?", (member_code.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_item(identifier: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    clean = identifier.strip().upper()
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT i.*, t.title, t.author, t.isbn 
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.accession_number = ? OR i.rfid_epc = ?""",
            (clean, clean)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

def checkout_item(
    member_code: str,
    item_identifier: str,
    checkout_method: str = "STAFF_STATION",
    operator_id: Optional[int] = None,
    loan_days: Optional[int] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()

        # 1. Validate Patron
        cursor.execute("SELECT * FROM members WHERE member_code = ?", (member_code.strip(),))
        member = cursor.fetchone()
        if not member:
            raise ValueError(f"Patron not found: {member_code}")
        
        # Invariant 1: Blocked Member Check (AC 04)
        if member["is_blocked"]:
            raise PermissionError(f"Borrowing blocked: Member '{member['full_name']}' is suspended/blocked.")

        # Invariant 2: Configurable Fine Limit Check (AC 04)
        cursor.execute("SELECT value FROM system_config WHERE key = 'max_fine_limit'")
        fine_limit_row = cursor.fetchone()
        max_fine = float(fine_limit_row["value"]) if fine_limit_row else settings.max_fine_limit

        if member["total_fines"] >= max_fine:
            raise PermissionError(
                f"Borrowing blocked: Outstanding fines (${member['total_fines']:.2f}) reach or exceed limit (${max_fine:.2f})."
            )

        # 2. Validate Item
        clean_item = item_identifier.strip().upper()
        cursor.execute(
            """SELECT i.*, t.title FROM items i 
               JOIN titles t ON i.title_id = t.id 
               WHERE i.accession_number = ? OR i.rfid_epc = ?""",
            (clean_item, clean_item)
        )
        item = cursor.fetchone()
        if not item:
            raise ValueError(f"Item not found with identifier: {item_identifier}")

        # Invariant 3: Reference-Only Item Check (AC 04)
        if item["status"] == "REFERENCE_ONLY":
            raise PermissionError(f"Borrowing blocked: '{item['title']}' is designated as REFERENCE_ONLY.")

        # Invariant 4: Already checked out
        if item["status"] == "ISSUED":
            raise ValueError(f"Item '{item['accession_number']}' is already checked out.")

        now = datetime.now(timezone.utc)
        effective_loan_days = loan_days or settings.default_loan_period_days
        due_date = now + timedelta(days=effective_loan_days)

        cursor.execute(
            """INSERT INTO circulation_records (
                   item_id, member_id, checkout_date, due_date, renewals_count, 
                   checkout_method, operator_id
               ) VALUES (?, ?, ?, ?, 0, ?, ?)""",
            (
                item["id"],
                member["id"],
                now.isoformat(),
                due_date.isoformat(),
                checkout_method,
                operator_id
            )
        )
        circ_id = cursor.lastrowid

        cursor.execute(
            "UPDATE items SET status = 'ISSUED', security_bit = 0 WHERE id = ?",
            (item["id"],)
        )

        record_audit(
            actor_id=member["member_code"],
            action="CIRCULATION_CHECKOUT",
            entity_type="ITEM",
            entity_id=item["accession_number"],
            details={
                "circulation_id": circ_id,
                "due_date": due_date.isoformat(),
                "method": checkout_method
            },
            conn=conn
        )

        return {
            "success": True,
            "circulation_id": circ_id,
            "item_title": item["title"],
            "accession_number": item["accession_number"],
            "patron_name": member["full_name"],
            "due_date": due_date.strftime("%Y-%m-%d"),
            "security_bit": 0,
            "message": f"Successfully checked out '{item['title']}' to {member['full_name']}."
        }

def checkin_item(
    item_identifier: str,
    operator_id: Optional[int] = None,
    checkin_time: Optional[datetime] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        clean_item = item_identifier.strip().upper()

        cursor.execute(
            """SELECT i.*, t.title FROM items i 
               JOIN titles t ON i.title_id = t.id 
               WHERE i.accession_number = ? OR i.rfid_epc = ?""",
            (clean_item, clean_item)
        )
        item = cursor.fetchone()
        if not item:
            raise ValueError(f"Item not found: {item_identifier}")

        cursor.execute(
            """SELECT c.*, m.member_code, m.full_name, m.total_fines 
               FROM circulation_records c
               JOIN members m ON c.member_id = m.id
               WHERE c.item_id = ? AND c.return_date IS NULL
               ORDER BY c.id DESC LIMIT 1""",
            (item["id"],)
        )
        circ = cursor.fetchone()
        if not circ:
            cursor.execute("UPDATE items SET status = 'AVAILABLE', security_bit = 1 WHERE id = ?", (item["id"],))
            return {
                "success": True,
                "item_title": item["title"],
                "accession_number": item["accession_number"],
                "fine_accrued": 0.0,
                "message": "Item was not recorded as borrowed. Security bit re-armed to 1."
            }

        now = checkin_time or datetime.now(timezone.utc)
        due_date = datetime.fromisoformat(circ["due_date"])

        fine = 0.0
        if now > due_date:
            days_overdue = (now - due_date).days
            if days_overdue > 0:
                cursor.execute("SELECT value FROM system_config WHERE key = 'daily_fine_rate'")
                rate_row = cursor.fetchone()
                daily_rate = float(rate_row["value"]) if rate_row else settings.daily_fine_rate
                fine = round(days_overdue * daily_rate, 2)

        cursor.execute(
            """UPDATE circulation_records 
               SET return_date = ?, fine_accrued = ?
               WHERE id = ?""",
            (now.isoformat(), fine, circ["id"])
        )

        if fine > 0:
            cursor.execute(
                "UPDATE members SET total_fines = total_fines + ? WHERE id = ?",
                (fine, circ["member_id"])
            )

        cursor.execute(
            "UPDATE items SET status = 'AVAILABLE', security_bit = 1 WHERE id = ?",
            (item["id"],)
        )

        record_audit(
            actor_id=str(operator_id or "CHECKIN_DESK"),
            action="CIRCULATION_CHECKIN",
            entity_type="ITEM",
            entity_id=item["accession_number"],
            details={
                "circulation_id": circ["id"],
                "fine_accrued": fine,
                "member_code": circ["member_code"]
            },
            conn=conn
        )

        return {
            "success": True,
            "item_title": item["title"],
            "accession_number": item["accession_number"],
            "patron_name": circ["full_name"],
            "fine_accrued": fine,
            "security_bit": 1,
            "message": f"Checked in '{item['title']}'." + (f" Overdue fine: ${fine:.2f}" if fine > 0 else "")
        }

def renew_item(
    item_identifier: str,
    additional_days: Optional[int] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        clean_item = item_identifier.strip().upper()

        cursor.execute(
            """SELECT c.*, i.accession_number, t.title, m.is_blocked, m.total_fines, m.full_name
               FROM circulation_records c
               JOIN items i ON c.item_id = i.id
               JOIN titles t ON i.title_id = t.id
               JOIN members m ON c.member_id = m.id
               WHERE (i.accession_number = ? OR i.rfid_epc = ?) AND c.return_date IS NULL
               ORDER BY c.id DESC LIMIT 1""",
            (clean_item, clean_item)
        )
        circ = cursor.fetchone()
        if not circ:
            raise ValueError(f"No active loan found for item: {item_identifier}")

        if circ["is_blocked"]:
            raise PermissionError("Renewal blocked: Patron is currently suspended.")

        if circ["total_fines"] >= settings.max_fine_limit:
            raise PermissionError(f"Renewal blocked: Patron has unpaid fines of ${circ['total_fines']:.2f}.")

        if circ["renewals_count"] >= settings.max_renewal_count:
            raise ValueError(f"Renewal blocked: Reached maximum renewal limit ({settings.max_renewal_count}).")

        days_to_add = additional_days or settings.default_loan_period_days
        current_due = datetime.fromisoformat(circ["due_date"])
        new_due = current_due + timedelta(days=days_to_add)

        cursor.execute(
            """UPDATE circulation_records 
               SET due_date = ?, renewals_count = renewals_count + 1
               WHERE id = ?""",
            (new_due.isoformat(), circ["id"])
        )

        record_audit(
            actor_id=circ["full_name"],
            action="CIRCULATION_RENEWAL",
            entity_type="CIRCULATION",
            entity_id=str(circ["id"]),
            details={"new_due_date": new_due.isoformat(), "renewal_count": circ["renewals_count"] + 1},
            conn=conn
        )

        return {
            "success": True,
            "item_title": circ["title"],
            "accession_number": circ["accession_number"],
            "new_due_date": new_due.strftime("%Y-%m-%d"),
            "renewals_count": circ["renewals_count"] + 1,
            "message": f"Loan renewed until {new_due.strftime('%Y-%m-%d')}."
        }
