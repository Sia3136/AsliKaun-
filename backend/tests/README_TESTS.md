# AsliKaun regression tests

Copy `tests/test_api.py` into the backend project as `tests/test_api.py`.

From the backend project root in PowerShell, install the test-only dependencies and run:

```powershell
python -m pip install -r requirements.txt
python -m pip install pytest httpx
python -m pytest -q tests
```

PostgreSQL/Redis integration smoke checks use the local services and explicit
environment variables:

```powershell
$env:DATABASE_URL="postgresql://appuser:localpassword@localhost:5432/appdb"
$env:REDIS_URL="redis://localhost:6379"
python -c "from backend.app import database; database.init_postgres_schema()"
python -m backend.worker
```

The tests use a temporary SQLite database configured through `ASLIKAUN_DB`; they do not overwrite the normal development database. They cover health, baseline/stable scoring, context-change rebaseline, behavior-change review queue and resolution, admin route protection, and driver declaration/token matching.

These are prototype regression tests, not evidence that the mock behavior scorer is a validated identity model.
