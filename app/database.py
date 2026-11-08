import hashlib
import os
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator, Optional
from app.config import settings
from app.logger import logger

def get_db_connection(db_path: str = None) -> sqlite3.Connection:
    target_path = db_path or settings.db_path
    conn = sqlite3.connect(target_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

@contextmanager
def db_session(db_path: str = None) -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database transaction rolled back: {e}", exc_info=True)
        raise
    finally:
        conn.close()

def init_database(db_path: str = None) -> None:
    schema = """
    CREATE TABLE IF NOT EXISTS titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isbn TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        publisher TEXT,
        publication_year INTEGER,
        dewey_decimal TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
        accession_number TEXT UNIQUE NOT NULL,
        rfid_epc TEXT UNIQUE,
        security_bit INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'AVAILABLE',
        shelf_location TEXT NOT NULL DEFAULT 'SHELF-A1-01',
        current_shelf TEXT DEFAULT 'SHELF-A1-01',
        last_seen_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_code TEXT UNIQUE NOT NULL,
        smart_card_uid TEXT UNIQUE,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'PATRON',
        is_blocked INTEGER NOT NULL DEFAULT 0,
        total_fines REAL NOT NULL DEFAULT 0.0,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS circulation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        member_id INTEGER NOT NULL REFERENCES members(id),
        checkout_date TIMESTAMP NOT NULL,
        due_date TIMESTAMP NOT NULL,
        return_date TIMESTAMP,
        renewals_count INTEGER NOT NULL DEFAULT 0,
        fine_accrued REAL NOT NULL DEFAULT 0.0,
        fine_paid INTEGER NOT NULL DEFAULT 0,
        checkout_method TEXT NOT NULL DEFAULT 'STAFF_STATION',
        operator_id INTEGER REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS gate_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        rfid_epc TEXT,
        accession_number TEXT,
        security_bit INTEGER,
        alarm_triggered INTEGER NOT NULL DEFAULT 0,
        cctv_snapshot_path TEXT,
        notification_queued INTEGER NOT NULL DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS migration_staging (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        raw_data TEXT NOT NULL,
        validation_status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indices for fast searching and real-time operations
    CREATE INDEX IF NOT EXISTS idx_titles_isbn ON titles(isbn);
    CREATE INDEX IF NOT EXISTS idx_titles_title ON titles(title);
    CREATE INDEX IF NOT EXISTS idx_titles_author ON titles(author);
    CREATE INDEX IF NOT EXISTS idx_items_accession ON items(accession_number);
    CREATE INDEX IF NOT EXISTS idx_items_epc ON items(rfid_epc);
    CREATE INDEX IF NOT EXISTS idx_members_code ON members(member_code);
    CREATE INDEX IF NOT EXISTS idx_members_smartcard ON members(smart_card_uid);
    CREATE INDEX IF NOT EXISTS idx_circ_active ON circulation_records(item_id, return_date);
    """
    with db_session(db_path) as conn:
        conn.executescript(schema)
        default_configs = [
            ("max_fine_limit", str(settings.max_fine_limit), "Maximum allowable fine before checkout is blocked"),
            ("daily_fine_rate", str(settings.daily_fine_rate), "Fine rate per day overdue"),
            ("loan_period_days", str(settings.default_loan_period_days), "Default loan duration in days"),
            ("max_renewals", str(settings.max_renewal_count), "Maximum renewals allowed per loan"),
        ]
        conn.executemany(
            "INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)",
            default_configs
        )

def seed_initial_data(db_path: str = None) -> None:
    sample_pwd_hash = hashlib.sha256("password123".encode()).hexdigest()

    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM members")
        if cursor.fetchone()[0] > 0:
            return

        members_data = [
            ("ADM-001", "CARD-ADM-9988", "Administrator Jane", "admin@library.local", "555-0100", "ADMIN", 0, 0.0, sample_pwd_hash),
            ("LIB-001", "CARD-LIB-7766", "Librarian Robert", "robert@library.local", "555-0101", "LIBRARIAN", 0, 0.0, sample_pwd_hash),
            ("STF-001", "CARD-STF-5544", "Staff Alice", "alice@library.local", "555-0102", "STAFF", 0, 0.0, sample_pwd_hash),
            ("MEM-101", "CARD-MEM-1122", "Student Emily Brown", "emily@student.local", "555-0103", "PATRON", 0, 0.0, sample_pwd_hash),
            ("MEM-102", "CARD-MEM-3344", "Student Michael Scott", "michael@student.local", "555-0104", "PATRON", 0, 25.50, sample_pwd_hash),
            ("MEM-103", "CARD-MEM-5566", "Student Dwight Schrute", "dwight@student.local", "555-0105", "PATRON", 1, 0.0, sample_pwd_hash),
        ]
        cursor.executemany(
            """INSERT INTO members (member_code, smart_card_uid, full_name, email, phone, role, is_blocked, total_fines, password_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            members_data
        )

        titles_data = [
            ("978-0131103627", "The C Programming Language", "Brian W. Kernighan, Dennis M. Ritchie", "Prentice Hall", 1988, "005.133", "Computer Science"),
            ("978-0201633610", "Design Patterns: Elements of Reusable Object-Oriented Software", "Erich Gamma et al.", "Addison-Wesley", 1994, "005.12", "Computer Science"),
            ("978-0262033848", "Introduction to Algorithms", "Thomas H. Cormen et al.", "MIT Press", 2009, "005.1", "Computer Science"),
            ("978-0134685991", "Effective Java", "Joshua Bloch", "Addison-Wesley", 2018, "005.133", "Computer Science"),
            ("978-0451524935", "1984", "George Orwell", "Signet Classic", 1949, "823.912", "Literature"),
            ("978-0743273565", "The Great Gatsby", "F. Scott Fitzgerald", "Scribner", 1925, "813.52", "Literature"),
            ("978-0199535569", "Oxford English Dictionary Vol 1 (Ref)", "Oxford Press", "Oxford", 2020, "423.01", "Reference"),
        ]
        cursor.executemany(
            """INSERT INTO titles (isbn, title, author, publisher, publication_year, dewey_decimal, category)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            titles_data
        )

        items_data = [
            (1, "ACC-10001", "E280110520000001", 1, "AVAILABLE", "SHELF-CS-01", "SHELF-CS-01"),
            (1, "ACC-10002", "E280110520000002", 1, "AVAILABLE", "SHELF-CS-01", "SHELF-CS-01"),
            (2, "ACC-10003", "E280110520000003", 1, "AVAILABLE", "SHELF-CS-01", "SHELF-CS-01"),
            (3, "ACC-10004", "E280110520000004", 1, "AVAILABLE", "SHELF-CS-02", "SHELF-CS-02"),
            (4, "ACC-10005", "E280110520000005", 1, "AVAILABLE", "SHELF-CS-02", "SHELF-CS-02"),
            (5, "ACC-10006", "E280110520000006", 1, "AVAILABLE", "SHELF-LIT-01", "SHELF-LIT-01"),
            (6, "ACC-10007", "E280110520000007", 1, "AVAILABLE", "SHELF-LIT-01", "SHELF-LIT-01"),
            (7, "ACC-10008", "E280110520000008", 1, "REFERENCE_ONLY", "SHELF-REF-01", "SHELF-REF-01"),
        ]
        cursor.executemany(
            """INSERT INTO items (title_id, accession_number, rfid_epc, security_bit, status, shelf_location, current_shelf)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            items_data
        )

def create_db_backup(destination_dir: str = None, source_db_path: str = None) -> tuple[str, str]:
    """Creates a point-in-time snapshot of the database and returns (backup_filepath, sha256_hash)."""
    dest_dir = Path(destination_dir or settings.BACKUP_DIR if hasattr(settings, "BACKUP_DIR") else "backups")
    dest_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = dest_dir / f"aisys_db_backup_{timestamp}.db"

    source_conn = get_db_connection(source_db_path)
    try:
        dest_conn = sqlite3.connect(str(backup_file))
        source_conn.backup(dest_conn)
        dest_conn.close()
    finally:
        source_conn.close()

    hasher = hashlib.sha256()
    with open(backup_file, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    sha256 = hasher.hexdigest()

    meta_file = backup_file.with_suffix(".sha256")
    meta_file.write_text(sha256)
    logger.info(f"Database backed up to {backup_file} (SHA256: {sha256[:12]}...)")
    return str(backup_file), sha256

def restore_db_backup(backup_file: str, target_db_path: str = None) -> bool:
    """Restores database from a snapshot with SHA-256 integrity verification."""
    target_path = Path(target_db_path or settings.db_path)
    backup_path = Path(backup_file)
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    meta_file = backup_path.with_suffix(".sha256")
    if meta_file.exists():
        expected_sha = meta_file.read_text().strip()
        hasher = hashlib.sha256()
        with open(backup_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        if hasher.hexdigest() != expected_sha:
            raise ValueError("Backup integrity check failed: SHA256 mismatch")

    # Clear target wal and shm files so restore is clean
    wal = Path(f"{target_path}-wal")
    shm = Path(f"{target_path}-shm")
    if wal.exists():
        try: wal.unlink()
        except Exception: pass
    if shm.exists():
        try: shm.unlink()
        except Exception: pass

    shutil.copy2(str(backup_path), str(target_path))
    logger.info(f"Database successfully restored from {backup_file} into {target_path}")
    return True
