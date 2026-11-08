from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_database, seed_initial_data
from app.routers import (
    health, auth, catalog, circulation, rfid,
    interop, migration, reports, admin
)
from app.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB and default seed records exist
    logger.info("Initializing AISYS Library Database schema...")
    init_database()
    logger.info("Seeding synthetic initial records...")
    seed_initial_data()
    logger.info(f"{settings.app_name} v{settings.app_version} started successfully (Offline Mode: {settings.offline_mode})")
    yield
    logger.info("Shutting down AISYS Library Service.")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="RFID-Enabled Integrated Library Management Software (ILMS) with Hardware Mocks, NCIP/SIP2 Interoperability, and Bulk Migration",
    lifespan=lifespan
)

# CORS setup for isolated intranet deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(circulation.router)
app.include_router(rfid.router)
app.include_router(interop.router)
app.include_router(migration.router)
app.include_router(reports.router)
app.include_router(admin.router)

# Mount static files and CCTV captures
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(exist_ok=True)
cctv_dir = Path(settings.cctv_storage_path)
cctv_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static/cctv", StaticFiles(directory=str(cctv_dir)), name="cctv")
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
