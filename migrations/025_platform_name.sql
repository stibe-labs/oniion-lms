INSERT INTO school_config (key, value, description)
VALUES ('platform_name', 'Stibe', 'Platform display name shown across the UI')
ON CONFLICT (key) DO NOTHING;
