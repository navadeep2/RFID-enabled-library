from typing import Optional, List, Dict, Any
from app.database import db_session

def search_catalog(
    query: Optional[str] = None,
    category: Optional[str] = None,
    available_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        sql = """
            SELECT t.id as title_id, t.isbn, t.title, t.author, t.publisher, t.publication_year, 
                   t.dewey_decimal, t.category,
                   COUNT(i.id) as total_copies,
                   SUM(CASE WHEN i.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_copies,
                   MIN(i.accession_number) as sample_accession
            FROM titles t
            LEFT JOIN items i ON t.id = i.title_id
            WHERE 1=1
        """
        params = []
        if query and query.strip():
            wildcard = f"%{query.strip()}%"
            sql += " AND (t.title LIKE ? OR t.author LIKE ? OR t.isbn LIKE ? OR t.category LIKE ?)"
            params.extend([wildcard, wildcard, wildcard, wildcard])

        if category and category.strip():
            sql += " AND t.category = ?"
            params.append(category.strip())

        sql += " GROUP BY t.id"

        if available_only:
            sql += " HAVING available_copies > 0"

        sql += " ORDER BY t.title ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(sql, params)
        rows = [dict(r) for r in cursor.fetchall()]

        # Total count query
        count_sql = "SELECT COUNT(DISTINCT t.id) FROM titles t LEFT JOIN items i ON t.id = i.title_id WHERE 1=1"
        count_params = []
        if query and query.strip():
            wildcard = f"%{query.strip()}%"
            count_sql += " AND (t.title LIKE ? OR t.author LIKE ? OR t.isbn LIKE ? OR t.category LIKE ?)"
            count_params.extend([wildcard, wildcard, wildcard, wildcard])
        if category and category.strip():
            count_sql += " AND t.category = ?"
            count_params.append(category.strip())

        cursor.execute(count_sql, count_params)
        total_results = cursor.fetchone()[0]

        return {
            "total": total_results,
            "limit": limit,
            "offset": offset,
            "results": rows
        }

def get_virtual_bookshelf(shelf_location: str, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns all items physically or catalogued on a given shelf to simulate a virtual bookshelf."""
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT i.id, i.accession_number, i.rfid_epc, i.security_bit, i.status, 
                      i.shelf_location, i.current_shelf, t.title, t.author, t.category, t.dewey_decimal
               FROM items i
               JOIN titles t ON i.title_id = t.id
               WHERE i.shelf_location = ? OR i.current_shelf = ?
               ORDER BY i.accession_number ASC""",
            (shelf_location, shelf_location)
        )
        return [dict(r) for r in cursor.fetchall()]
