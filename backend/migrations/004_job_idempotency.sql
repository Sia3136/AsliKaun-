CREATE UNIQUE INDEX IF NOT EXISTS telemetry_jobs_batch_idx
    ON telemetry_jobs(tenant_id, batch_id);
