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
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT current_setting(''app.tenant_id'', true)',
            table_name
        );
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format(
            'DROP POLICY IF EXISTS tenant_isolation ON %I',
            table_name
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
            table_name
        );
    END LOOP;
END $$;
