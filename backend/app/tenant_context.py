from __future__ import annotations

from contextvars import ContextVar

_tenant_id: ContextVar[str] = ContextVar("aslikaun_tenant_id", default="default")


def current_tenant() -> str:
    return _tenant_id.get()


def set_tenant(tenant_id: str) -> None:
    if not tenant_id:
        raise ValueError("tenant_id must not be empty")
    _tenant_id.set(tenant_id)
