"""Ed25519 device enrollment and request-signature verification."""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException


def canonical_payload(body: Any) -> bytes:
    if hasattr(body, "model_dump"):
        data = body.model_dump(mode="json")
    else:
        data = dict(body)
    for key in ("device_signature",):
        data.pop(key, None)
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def verify_signed_request(con: Any, driver_id: str, body: Any) -> None:
    key_id = getattr(body, "device_key_id", None)
    signature = getattr(body, "device_signature", None)
    nonce = getattr(body, "device_nonce", None)
    signed_at = getattr(body, "device_signed_at", None)
    required = (
        __import__("os").getenv("ASLIKAUN_REQUIRE_DEVICE_SIGNATURE", "false").lower()
        in {"1", "true", "yes", "on"}
    )
    if not any((key_id, signature, nonce, signed_at)):
        if required:
            raise HTTPException(status_code=401, detail="Signed device request required")
        return
    if not all((key_id, signature, nonce, signed_at)):
        raise HTTPException(status_code=401, detail="Incomplete signed device request")
    now = datetime.now(timezone.utc)
    signed_datetime = signed_at if signed_at.tzinfo else signed_at.replace(tzinfo=timezone.utc)
    if abs((now - signed_datetime).total_seconds()) > 300:
        raise HTTPException(status_code=401, detail="Signed request timestamp is outside the allowed window")
    row = con.execute(
        """SELECT key_id, driver_id, public_key_pem, algorithm, active
           FROM device_keys WHERE key_id=? AND driver_id=?""",
        (key_id, driver_id),
    ).fetchone()
    if row is None or not row["active"] or row["algorithm"] != "Ed25519":
        raise HTTPException(status_code=401, detail="Unknown or inactive device key")
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        public_key = serialization.load_pem_public_key(row["public_key_pem"].encode())
        if not isinstance(public_key, Ed25519PublicKey):
            raise ValueError("not an Ed25519 public key")
        public_key.verify(
            base64.b64decode(signature, validate=True),
            canonical_payload(body),
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid device request signature") from exc
    try:
        con.execute(
            """INSERT INTO request_nonces(nonce, key_id, expires_at)
               VALUES(?, ?, ?)""",
            (nonce, key_id, now + timedelta(minutes=5)),
        )
    except Exception as exc:
        if getattr(exc, "sqlstate", None) == "23505":
            raise HTTPException(status_code=409, detail="Request nonce was already used") from exc
        raise HTTPException(status_code=503, detail="Unable to record request nonce") from exc


def new_key_id() -> str:
    return hashlib.sha256(secrets.token_bytes(32)).hexdigest()[:32]
