-- Retain the driver's submitted verification evidence for the admin review queue.
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS session_id BIGINT;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS selfie_base64 TEXT;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS report_json TEXT;

