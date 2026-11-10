import sys
from pathlib import Path

# Ensure project root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app as fastapi_app

async def app(scope, receive, send):
    if scope.get("type") == "http":
        headers = dict(scope.get("headers", []))
        # Vercel provides original URI in headers when rewrites occur:
        orig_path = (
            headers.get(b"x-matched-path")
            or headers.get(b"x-forwarded-uri")
            or headers.get(b"x-original-url")
        )
        current_path = scope.get("path", "")
        if orig_path:
            clean_path = orig_path.decode("utf-8").split("?")[0]
            scope["path"] = clean_path
            scope["raw_path"] = clean_path.encode("utf-8")
        elif current_path in ("/api/index.py", "api/index.py", "/api/index"):
            scope["path"] = "/"
            scope["raw_path"] = b"/"

    await fastapi_app(scope, receive, send)
