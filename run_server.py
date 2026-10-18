"""Single-command runner for the Trust Juggler & AsliKaun integrated application.

Boots FastAPI + ML Bridge + Static Web Server on http://localhost:8000.
"""
import sys
from pathlib import Path
import uvicorn

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

if __name__ == "__main__":
    print("=" * 65)
    print("  Trust Juggler / AsliKaun - Continuous Identity Intelligence")
    print("=" * 65)
    print("  * Web Portal (AsliKaun):       http://localhost:8000/")
    print("  * Operations Admin Dashboard:   http://localhost:8000/dashboard.html")
    print("  * API Documentation (Swagger):  http://localhost:8000/docs")
    print("=" * 65)
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
