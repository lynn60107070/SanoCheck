-- Live sensor logs from ESP32 /live endpoint
-- Run in Supabase SQL Editor after schema.sql

CREATE TABLE IF NOT EXISTS live_sensor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT,
  timestamp_ms BIGINT NOT NULL,
  humidity NUMERIC NOT NULL,
  water NUMERIC NOT NULL,
  gas NUMERIC NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sensor_logs_created_at ON live_sensor_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sensor_logs_device_id ON live_sensor_logs(device_id);

COMMENT ON TABLE live_sensor_logs IS 'Live readings from ESP32 GET /live (humidity, water, gas, status)';
