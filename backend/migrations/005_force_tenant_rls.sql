DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'drivers', 'sessions', 'events', 'telemetry_batches', 'telemetry_jobs',
        'verification_requests', 'review_queue', 'driver_tokens',
        'driver_change_declarations', 'driver_consent', 'driver_face_enrollment',
        'driver_anchor_state', 'driver_challenge_log', 'device_keys', 'request_nonces'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    END LOOP;
END $$;
