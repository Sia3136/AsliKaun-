"""Single-command runner for the AsliKaun integrated application.

Boots FastAPI + ML Bridge + Static Web Server on http://localhost:8000.
"""
import os
import sys
from pathlib import Path
import uvicorn

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

if __name__ == "__main__":
    print("=" * 65)
    print("  AsliKaun - Continuous Identity Intelligence")
    print("=" * 65)
    print("  * Web Portal (AsliKaun):       http://localhost:8000/")
    print("  * Operations Admin Dashboard:   http://localhost:8000/dashboard.html")
    print("  * Driver Mobile App Demo:       http://localhost:8000/driver-app-demo.html")
    print("  * API Documentation (Swagger):  http://localhost:8000/docs")
    reload_enabled = os.getenv("ASLIKAUN_RELOAD", "0").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run(
        "backend.app.main:app",
        host=os.getenv("ASLIKAUN_HOST", "127.0.0.1"),
        port=int(os.getenv("ASLIKAUN_PORT", "8000")),
        reload=reload_enabled,
        reload_dirs=["backend", "frontend"] if reload_enabled else None,
    )
