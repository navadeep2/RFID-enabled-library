import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

# Detect serverless environments (Vercel, AWS Lambda, Netlify) where filesystem is read-only except /tmp
IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("NETLIFY"))

if IS_SERVERLESS:
    DATA_DIR = Path("/tmp/data")
    BACKUP_DIR = Path("/tmp/backups")
    SNAPSHOT_DIR = Path("/tmp/snapshots")
else:
    DATA_DIR = BASE_DIR / "data"
    BACKUP_DIR = BASE_DIR / "backups"
    SNAPSHOT_DIR = BASE_DIR / "snapshots"

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    app_name: str = "AISYS RFID Library Management System"
    app_version: str = "1.0.0"
    environment: str = os.getenv("APP_ENV", "production-offline")
    db_path: str = str(DATA_DIR / "aisys_library.db")
    secret_key: str = os.getenv("SECRET_KEY", "aisys-offline-supersecret-key-2024")
    token_expire_hours: int = 12
    max_fine_limit: float = 15.00
    daily_fine_rate: float = 0.50
    default_loan_period_days: int = 14
    max_renewal_count: int = 3
    offline_mode: bool = True
    cctv_storage_path: str = str(DATA_DIR / "cctv_captures")

settings = Settings()
Path(settings.cctv_storage_path).mkdir(parents=True, exist_ok=True)
