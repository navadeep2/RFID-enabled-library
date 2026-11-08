import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
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

@router.post("/rollback/{batch_id}")
def rollback_batch(batch_id: str):
    return rollback_migration_batch(batch_id)
