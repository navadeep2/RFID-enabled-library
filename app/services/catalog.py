from typing import Optional, List, Dict, Any
from app.database import db_session
from app.models.schemas import TitleCreate, ItemCreate
from app.services.audit import record_audit

def create_title(title_in: TitleCreate, actor_id: str = "SYSTEM", db_path: Optional[str] = None) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO titles (isbn, title, author, publisher, publication_year, dewey_decimal, category)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                title_in.isbn.strip(),
                title_in.title.strip(),
                title_in.author.strip(),
                title_in.publisher,
                title_in.publication_year,
                title_in.dewey_decimal,
                title_in.category
            )
        )
        title_id = cursor.lastrowid
        cursor.execute("SELECT * FROM titles WHERE id = ?", (title_id,))
        record = dict(cursor.fetchone())
        record_audit(actor_id, "TITLE_CREATE", "TITLE", str(title_id), record, conn=conn)
        return record

def create_item_copy(item_in: ItemCreate, actor_id: str = "SYSTEM", db_path: Optional[str] = None) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM titles WHERE id = ?", (item_in.title_id,))
        if not cursor.fetchone():
            raise ValueError(f"Title ID {item_in.title_id} does not exist")

        cursor.execute(
            """INSERT INTO items (title_id, accession_number, rfid_epc, status, shelf_location, current_shelf)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                item_in.title_id,
                item_in.accession_number.strip().upper(),
                item_in.rfid_epc.strip().upper() if item_in.rfid_epc else None,
                item_in.status,
                item_in.shelf_location,
                item_in.shelf_location
            )
        )
        item_id = cursor.lastrowid
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        item_record = dict(cursor.fetchone())
        record_audit(actor_id, "ITEM_CREATE", "ITEM", str(item_id), item_record, conn=conn)
        return item_record

def get_item_by_identifier(identifier: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    clean_id = identifier.strip().upper()
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT i.*, t.title, t.author, t.isbn, t.dewey_decimal, t.category
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.accession_number = ? OR i.rfid_epc = ?""",
            (clean_id, clean_id)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

def generate_spine_label_data(accession_number: str, db_path: Optional[str] = None) -> Dict[str, Any]:
    item = get_item_by_identifier(accession_number, db_path)
    if not item:
        raise ValueError(f"Item not found: {accession_number}")

    dewey = item.get("dewey_decimal") or "000.00"
    author_cutter = item["author"][:3].upper() if item["author"] else "UNK"
    year = str(item.get("publication_year") or "")
    
    label_text = f"""
=============================
  AISYS LIBRARY SYSTEM
  CALL NO : {dewey}
  CUTTER  : {author_cutter}
  YEAR    : {year}
  BARCODE : {item['accession_number']}
  RFID EPC: {item.get('rfid_epc') or 'NOT TAGGED'}
=============================
"""
    return {
        "accession_number": item["accession_number"],
        "call_number": dewey,
        "author_cutter": author_cutter,
        "year": year,
        "label_text": label_text.strip(),
        "shelf": item["shelf_location"]
    }
