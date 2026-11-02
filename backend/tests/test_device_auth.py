from __future__ import annotations

import base64
from datetime import datetime, timezone

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from backend.app.device_auth import canonical_payload
from backend.app.main import SessionIngest


def test_signed_payload_is_canonical_and_excludes_signature():
    body = SessionIngest(
        driver_id="driver-1",
        device_id="device-1",
        timestamp=datetime(2026, 11, 2, tzinfo=timezone.utc),
        device_key_id="key-1",
        device_nonce="nonce-1",
        device_signed_at=datetime(2026, 11, 2, tzinfo=timezone.utc),
        device_signature="not-part-of-signed-content",
    )
    private_key = Ed25519PrivateKey.generate()
    signature = private_key.sign(canonical_payload(body))
    private_key.public_key().verify(signature, canonical_payload(body))
    assert base64.b64encode(signature)


def test_public_key_serializes_as_enrollment_contract():
    public_key = Ed25519PrivateKey.generate().public_key()
    pem = public_key.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    assert pem.startswith(b"-----BEGIN PUBLIC KEY-----")
