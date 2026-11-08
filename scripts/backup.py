import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import create_db_backup

def main():
    parser = argparse.ArgumentParser(description="AISYS Database Snapshot Backup Utility")
    parser.add_argument("--dest", type=str, default="backups", help="Destination backup directory")
    args = parser.parse_args()

    backup_path, sha256 = create_db_backup(args.dest)
    print("\n" + "=" * 50)
    print("      DATABASE SNAPSHOT CREATED")
    print("=" * 50)
    print(f"Path    : {backup_path}")
    print(f"SHA-256 : {sha256}")
    print("=" * 50)

if __name__ == "__main__":
    main()
