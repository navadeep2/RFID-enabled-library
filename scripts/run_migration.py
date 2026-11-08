import argparse
import io
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import init_database
from app.services.migration import run_migration_pipeline

def main():
    parser = argparse.ArgumentParser(description="AISYS 20k Record Bulk Migration Utility")
    parser.add_argument("--file", type=str, default="data/synthetic_library_20000.csv", help="CSV file path")
    parser.add_argument("--dry-run", action="store_true", help="Perform validation without inserting into database")
    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    init_database()

    print(f"Loading {file_path} (Mode: {'DRY-RUN' if args.dry_run else 'LIVE INGESTION'})...")
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        csv_text = f.read()

    stream = io.StringIO(csv_text)
    report = run_migration_pipeline(stream, dry_run=args.dry_run)

    print("\n" + "=" * 50)
    print("        MIGRATION RECONCILIATION REPORT")
    print("=" * 50)
    print(f"Batch ID           : {report['batch_id']}")
    print(f"Dry Run Mode       : {report['is_dry_run']}")
    print(f"Total Source Rows  : {report['total_records']}")
    print(f"Valid Records      : {report['valid_count']}")
    print(f"Duplicates Rejected: {report['duplicate_count']}")
    print(f"Invalid Rows       : {report['invalid_count']}")
    print(f"Live Ingested      : {report['migrated_count']}")
    print(f"Execution Duration : {report['duration_seconds']} seconds")
    print(f"Reconciliation Bal : {'BALANCED' if report['reconciliation']['balanced'] else 'MISMATCH'}")
    print("=" * 50)

    if report["error_sample"]:
        print(f"\nSample Errors ({len(report['error_sample'])} recorded):")
        for err in report["error_sample"][:5]:
            print(f"  - Row {err.get('row')}: {err.get('error')} (Accession: {err.get('accession')})")

if __name__ == "__main__":
    main()
