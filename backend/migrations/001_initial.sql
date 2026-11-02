CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL
);

INSERT INTO tenants(tenant_id, name, created_at)
VALUES ('default', 'AsliKaun Core', now()::text)
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    name TEXT,
    provider TEXT DEFAULT 'email',
    avatar_url TEXT,
    organization TEXT,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id)
);

CREATE TABLE IF NOT EXISTS drivers (
    driver_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    anchor_json TEXT NOT NULL DEFAULT '{}',
    fast_json TEXT NOT NULL DEFAULT '{}',
    latest_json TEXT NOT NULL DEFAULT '{}',
    latest_result_json TEXT NOT NULL DEFAULT '{}',
    timeseries_json TEXT NOT NULL DEFAULT '{}',
    threshold_json TEXT NOT NULL DEFAULT '{}',
    state_version BIGINT NOT NULL DEFAULT 0,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL REFERENCES drivers(driver_id),
    timestamp TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    context_score DOUBLE PRECISION,
    behavior_score DOUBLE PRECISION,
    context_axis TEXT NOT NULL,
    behavior_axis TEXT NOT NULL,
    quadrant TEXT NOT NULL,
    decision TEXT NOT NULL,
    reasons_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    details_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_batches (
    batch_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL,
    response_json TEXT,
    status TEXT NOT NULL DEFAULT 'accepted',
    job_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_jobs (
    job_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_requests (
    challenge_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL,
    status TEXT NOT NULL,
    captured_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_queue (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    session_id BIGINT NOT NULL UNIQUE,
    driver_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolution TEXT,
    reviewer_id TEXT,
    reviewer_note TEXT
);

CREATE TABLE IF NOT EXISTS driver_tokens (
    driver_id TEXT PRIMARY KEY REFERENCES drivers(driver_id),
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    token_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    rotated_at TEXT
);

CREATE TABLE IF NOT EXISTS driver_change_declarations (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL,
    device_id TEXT,
    ip_subnet TEXT,
    zone TEXT,
    reason TEXT NOT NULL,
    declared_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    checked_at TEXT,
    matched_session_id BIGINT,
    outcome_note TEXT
);

CREATE TABLE IF NOT EXISTS driver_consent (
    driver_id TEXT PRIMARY KEY REFERENCES drivers(driver_id),
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    consent_version TEXT NOT NULL,
    given_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS driver_face_enrollment (
    driver_id TEXT PRIMARY KEY REFERENCES drivers(driver_id),
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    embedding_b64 TEXT NOT NULL,
    enrolled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_anchor_state (
    driver_id TEXT PRIMARY KEY REFERENCES drivers(driver_id),
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    anchor_mean DOUBLE PRECISION,
    cumulative DOUBLE PRECISION NOT NULL DEFAULT 0,
    buffer_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_challenge_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL,
    challenged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_keys (
    key_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    driver_id TEXT NOT NULL REFERENCES drivers(driver_id),
    public_key_pem TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'Ed25519',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS request_nonces (
    nonce TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default' REFERENCES tenants(tenant_id),
    key_id TEXT NOT NULL REFERENCES device_keys(key_id),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_tenant_driver_idx ON sessions(tenant_id, driver_id, id);
CREATE INDEX IF NOT EXISTS events_tenant_driver_idx ON events(tenant_id, driver_id, id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON telemetry_jobs(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS telemetry_jobs_batch_idx
    ON telemetry_jobs(tenant_id, batch_id);
