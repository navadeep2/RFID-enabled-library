# Software Bill of Materials & License Inventory - AISYS RFID ILMS

This inventory documents all open-source dependencies, license classifications, and offline redistribution terms, fulfilling requirement NFR 04.

| Package | Version | License | Direct / Transitive | Offline Redistribution Notes |
| :--- | :--- | :--- | :--- | :--- |
| **FastAPI** | `0.115.6` | MIT | Direct | Permissive; offline install via wheels supported |
| **Uvicorn** | `0.34.0` | BSD-3-Clause | Direct | Permissive |
| **Pydantic** | `2.10.4` | MIT | Direct | Permissive |
| **Pydantic-Core** | `2.27.2` | MIT | Transitive | Pre-compiled binary wheel for Windows amd64 |
| **Starlette** | `0.41.3` | BSD-3-Clause | Transitive | Permissive |
| **Python-Multipart**| `0.0.20` | Apache-2.0 | Direct | Permissive |
| **Jinja2** | `3.1.5` | BSD-3-Clause | Direct | Permissive |
| **Pytest** | `8.3.4` | MIT | Direct (Testing) | Permissive |
| **HTTPX** | `0.28.1` | BSD-3-Clause | Direct (Testing) | Permissive |
| **SQLite3** | `3.45+` | Public Domain | Built-in (Python) | Zero license restrictions; no external server needed |

All dependencies are 100% compliant with commercial and offline redistribution with zero viral copyleft (GPL) restrictions.
