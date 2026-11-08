import os
import sys
import tempfile
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.database import init_database, seed_initial_data, get_db_connection
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="function")
def test_db():
    fd, path = tempfile.mkstemp(suffix="_test_aisys.db")
    os.close(fd)
    init_database(path)
    seed_initial_data(path)
    yield path
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass

@pytest.fixture(scope="function")
def client(test_db, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "db_path", test_db)
    with TestClient(app) as test_client:
        yield test_client
