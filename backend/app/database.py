"""Database and queue infrastructure for the API.

PostgreSQL is the production/local-service backend. SQLite remains available
when DATABASE_URL is unset so the existing isolated regression suite continues
to run without external services.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_MIGRATIONS = _PROJECT_ROOT / "backend" / "migrations"
_INSERT_OR_IGNORE = re.compile(r"INSERT\s+OR\s+IGNORE\s+INTO", re.IGNORECASE)
_INSERT_OR_REPLACE = re.compile(r"INSERT\s+OR\s+REPLACE\s+INTO", re.IGNORECASE)


def _load_local_env() -> None:
    env_file = _PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def database_url() -> str:
    _load_local_env()
    if os.getenv("ASLIKAUN_DB", "").strip():
        return ""
    return os.getenv("DATABASE_URL", "").strip()


def using_postgres() -> bool:
    return bool(database_url())


def _postgres_sql(query: str) -> str:
    ignore_insert = bool(_INSERT_OR_IGNORE.search(query))
    replace_insert = bool(_INSERT_OR_REPLACE.search(query))
    query = _INSERT_OR_IGNORE.sub("INSERT INTO", query)
    query = _INSERT_OR_REPLACE.sub("INSERT INTO", query)
    query = query.replace("?", "%s")
    if (ignore_insert or replace_insert) and "ON CONFLICT" not in query.upper():
        query = query.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"
    return query


class PostgresCursor:
    def __init__(self, cursor: Any, table_name: str | None = None) -> None:
        self._cursor = cursor
        self._table_name = table_name

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    @property
    def lastrowid(self) -> int | None:
        if not self._table_name:
            return None
        try:
            self._cursor.execute(
                "SELECT currval(pg_get_serial_sequence(%s, 'id')) AS id",
                (self._table_name,),
            )
            row = self._cursor.fetchone()
            return int(row["id"]) if row and row["id"] is not None else None
        except Exception:
            return None


class PostgresConnection:
    def __init__(self, connection: Any) -> None:
        self._connection = connection

    def __enter__(self) -> "PostgresConnection":
        self._connection.__enter__()
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self._connection.__exit__(exc_type, exc, traceback)

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> PostgresCursor:
        import psycopg

        table_match = re.search(r"INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)", query, re.IGNORECASE)
        cursor = self._connection.cursor(row_factory=psycopg.rows.dict_row)
        cursor.execute(_postgres_sql(query), params)
        return PostgresCursor(cursor, table_match.group(1) if table_match else None)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()


def connect() -> Any:
    if not using_postgres():
        import sqlite3

        db_path = os.getenv("ASLIKAUN_DB", str(_PROJECT_ROOT / "aslikaun.db"))
        connection = sqlite3.connect(db_path)
        connection.row_factory = sqlite3.Row
        return connection

    import psycopg

    connection = psycopg.connect(database_url(), row_factory=psycopg.rows.dict_row)
    from backend.app.tenant_context import current_tenant

    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.tenant_id', %s, false)", (current_tenant(),))
    return PostgresConnection(connection)


def init_postgres_schema() -> None:
    if not using_postgres():
        return
    migration_files = sorted(_MIGRATIONS.glob("*.sql"))
    if not migration_files:
        raise RuntimeError(f"No PostgreSQL migrations found in {_MIGRATIONS}")
    import psycopg

    with psycopg.connect(database_url()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations "
                "(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
            )
            for migration in migration_files:
                version = migration.name
                cursor.execute(
                    "SELECT 1 FROM schema_migrations WHERE version = %s", (version,)
                )
                if cursor.fetchone():
                    continue
                cursor.execute(migration.read_text(encoding="utf-8"))
                cursor.execute(
                    "INSERT INTO schema_migrations(version) VALUES (%s)", (version,)
                )
        connection.commit()
