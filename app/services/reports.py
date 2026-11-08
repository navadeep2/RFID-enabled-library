from typing import Dict, Any, Optional
from app.database import db_session

def get_dashboard_summary(db_path: Optional[str] = None) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()

        # Item & Tag stats
        cursor.execute("SELECT COUNT(*) FROM titles")
        total_titles = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM items")
        total_items = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM items WHERE rfid_epc IS NOT NULL")
        tagged_items = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM items WHERE status = 'AVAILABLE'")
        available_items = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM items WHERE status = 'ISSUED'")
        issued_items = cursor.fetchone()[0]

        # Member stats
        cursor.execute("SELECT COUNT(*) FROM members")
        total_members = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM members WHERE is_blocked = 1")
        blocked_members = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(total_fines) FROM members")
        total_outstanding_fines = cursor.fetchone()[0] or 0.0

        # Gate stats
        cursor.execute("SELECT COUNT(*) FROM gate_events")
        total_gate_passages = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM gate_events WHERE alarm_triggered = 1")
        total_alarms = cursor.fetchone()[0]

        # Recent Gate Breaches
        cursor.execute(
            """SELECT * FROM gate_events WHERE alarm_triggered = 1 
               ORDER BY id DESC LIMIT 5"""
        )
        recent_alarms = [dict(r) for r in cursor.fetchall()]

        # Recent Circulation Activity
        cursor.execute(
            """SELECT c.*, i.accession_number, t.title, m.member_code, m.full_name 
               FROM circulation_records c
               JOIN items i ON c.item_id = i.id
               JOIN titles t ON i.title_id = t.id
               JOIN members m ON c.member_id = m.id
               ORDER BY c.id DESC LIMIT 5"""
        )
        recent_circulation = [dict(r) for r in cursor.fetchall()]

        return {
            "catalog": {
                "total_titles": total_titles,
                "total_items": total_items,
                "tagged_items": tagged_items,
                "tagging_percentage": round((tagged_items / total_items * 100), 1) if total_items > 0 else 0,
                "available_items": available_items,
                "issued_items": issued_items
            },
            "members": {
                "total_members": total_members,
                "blocked_members": blocked_members,
                "total_outstanding_fines": round(total_outstanding_fines, 2)
            },
            "security": {
                "total_passages": total_gate_passages,
                "total_alarms": total_alarms,
                "recent_alarms": recent_alarms
            },
            "recent_circulation": recent_circulation
        }

def get_detailed_report(
    report_type: str,
    filter_status: Optional[str] = None,
    limit: int = 100,
    db_path: Optional[str] = None
) -> list[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        if report_type == "circulation":
            sql = """SELECT c.id, c.checkout_date, c.due_date, c.return_date, c.renewals_count,
                            c.fine_accrued, c.checkout_method, i.accession_number, t.title, m.member_code, m.full_name
                     FROM circulation_records c
                     JOIN items i ON c.item_id = i.id
                     JOIN titles t ON i.title_id = t.id
                     JOIN members m ON c.member_id = m.id"""
            if filter_status == "active":
                sql += " WHERE c.return_date IS NULL"
            elif filter_status == "overdue":
                sql += " WHERE c.return_date IS NULL AND c.due_date < CURRENT_TIMESTAMP"
            sql += " ORDER BY c.id DESC LIMIT ?"
            cursor.execute(sql, (limit,))
            return [dict(r) for r in cursor.fetchall()]

        elif report_type == "gate_events":
            sql = "SELECT * FROM gate_events"
            params = []
            if filter_status == "alarm":
                sql += " WHERE alarm_triggered = 1"
            sql += " ORDER BY id DESC LIMIT ?"
            params.append(limit)
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

        elif report_type == "tagged_items":
            sql = """SELECT i.id, i.accession_number, i.rfid_epc, i.security_bit, i.status, 
                            i.shelf_location, i.current_shelf, i.last_seen_at, t.title, t.author, t.isbn
                     FROM items i
                     JOIN titles t ON i.title_id = t.id"""
            if filter_status == "tagged":
                sql += " WHERE i.rfid_epc IS NOT NULL"
            elif filter_status == "untagged":
                sql += " WHERE i.rfid_epc IS NULL"
            sql += " ORDER BY i.id DESC LIMIT ?"
            cursor.execute(sql, (limit,))
            return [dict(r) for r in cursor.fetchall()]

        return []
