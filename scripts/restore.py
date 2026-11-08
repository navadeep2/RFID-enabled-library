import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import restore_db_backup

def main():
    parser = argparse.ArgumentParser(description="AISYS Database Restore Utility")
    parser.add_argument("backup_file", type=str, help="Path to .db backup snapshot")
    parser.add_argument("--target", type=str, default=None, help="Target db path (optional)")
    args = parser.parse_args()

    print(f"Verifying and restoring database from {args.backup_file}...")
    try:
        restore_db_backup(args.backup_file, args.target)
        print("✅ Database restore verified and completed successfully.")
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
