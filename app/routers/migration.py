import io
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from app.models.schemas import MigrationReport
from app.services.migration import run_migration_pipeline, rollback_migration_batch

router = APIRouter(prefix="/api/v1/migration", tags=["Data Migration Engine"])

@router.post("/upload-csv", response_model=MigrationReport)
async def upload_migration_csv(
    file: UploadFile = File(...),
    dry_run: bool = Form(False)
):
    try:
        content_bytes = await file.read()
        csv_text = content_bytes.decode("utf-8", errors="replace")
        csv_stream = io.StringIO(csv_text)
        return run_migration_pipeline(csv_stream, dry_run=dry_run)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Migration error: {str(e)}")

@router.post("/generate-synthetic")
def generate_synthetic():
    csv_file = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic_library_20000.csv"
    if not csv_file.exists():
        from scripts.generate_synthetic_20k import main as gen_main
        gen_main()
    file_size = csv_file.stat().st_size
    return {
        "success": True,
        "file_name": csv_file.name,
        "size_kb": round(file_size / 1024, 1),
        "total_rows": 20004,
        "message": f"Spreadsheet '{csv_file.name}' is prepared with 20,000 book records and test edge cases."
    }

@router.post("/import-synthetic", response_model=MigrationReport)
def import_synthetic_20k(dry_run: bool = Query(False)):
    csv_file = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic_library_20000.csv"
    if not csv_file.exists():
        raise HTTPException(status_code=404, detail="Synthetic CSV file not found on disk")
    try:
        with open(csv_file, "r", encoding="utf-8", errors="replace") as f:
            csv_text = f.read()
        stream = io.StringIO(csv_text)
        return run_migration_pipeline(stream, dry_run=dry_run)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Synthetic migration error: {str(e)}")

@router.post("/rollback/{batch_id}")
def rollback_batch(batch_id: str):
    return rollback_migration_batch(batch_id)
