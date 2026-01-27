-- SanoCheck Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bathrooms table
CREATE TABLE IF NOT EXISTS bathrooms (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('male', 'female', 'accessible')),
  high_traffic BOOLEAN DEFAULT false,
  sensor_attached BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  health_score INTEGER DEFAULT 3 CHECK (health_score >= 0 AND health_score <= 3),
  status TEXT NOT NULL CHECK (status IN ('verified_usable', 'flagged', 'verified_unusable')),
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verifications table
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bathroom_id TEXT NOT NULL REFERENCES bathrooms(id) ON DELETE CASCADE,
  volunteer_id TEXT,
  water_available BOOLEAN NOT NULL,
  clogged BOOLEAN NOT NULL,
  usable BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resident signals table
CREATE TABLE IF NOT EXISTS resident_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bathroom_id TEXT NOT NULL REFERENCES bathrooms(id) ON DELETE CASCADE,
  signal TEXT NOT NULL CHECK (signal IN ('usable', 'unusable')),
  anonymous BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sensor readings table
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bathroom_id TEXT NOT NULL REFERENCES bathrooms(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN ('gas', 'water', 'humidity')),
  gas_type TEXT CHECK (gas_type IN ('H2S', 'NH3')), -- Only for gas sensors
  value NUMERIC NOT NULL,
  unit TEXT, -- e.g., 'ppm', '%', 'L/min'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance tasks table
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bathroom_id TEXT NOT NULL REFERENCES bathrooms(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('plumbing', 'water', 'hygiene', 'structural')),
  status TEXT NOT NULL DEFAULT 'not_assigned' CHECK (status IN ('not_assigned', 'in_progress', 'resolved')),
  contact_method TEXT CHECK (contact_method IN ('phone', 'whatsapp', 'ticket')),
  contact_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bathrooms_zone ON bathrooms(zone);
CREATE INDEX IF NOT EXISTS idx_bathrooms_status ON bathrooms(status);
CREATE INDEX IF NOT EXISTS idx_verifications_bathroom_id ON verifications(bathroom_id);
CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_signals_bathroom_id ON resident_signals(bathroom_id);
CREATE INDEX IF NOT EXISTS idx_resident_signals_created_at ON resident_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_bathroom_id ON sensor_readings(bathroom_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_created_at ON sensor_readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_bathroom_id ON maintenance_tasks(bathroom_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_bathrooms_updated_at BEFORE UPDATE ON bathrooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_tasks_updated_at BEFORE UPDATE ON maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE bathrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- Public read access for bathrooms (for public dashboard)
CREATE POLICY "Public can read bathrooms" ON bathrooms
  FOR SELECT USING (true);

-- Public read access for verifications
CREATE POLICY "Public can read verifications" ON verifications
  FOR SELECT USING (true);

-- Public can insert resident signals (anonymous)
CREATE POLICY "Public can insert resident signals" ON resident_signals
  FOR INSERT WITH CHECK (true);

-- Public can read sensor readings
CREATE POLICY "Public can read sensor readings" ON sensor_readings
  FOR SELECT USING (true);

-- Public can read maintenance tasks
CREATE POLICY "Public can read maintenance tasks" ON maintenance_tasks
  FOR SELECT USING (true);

-- Allow updates to bathrooms (for score recalculation via API)
-- In production, restrict this to authenticated admin users
CREATE POLICY "Allow bathroom updates" ON bathrooms
  FOR UPDATE USING (true) WITH CHECK (true);

-- Admin/Volunteer policies (for authenticated users with appropriate roles)
-- Note: In production, you'd check auth.uid() and user roles
-- For MVP, we'll allow service role to do everything
-- Note: Service role key bypasses RLS entirely, so this policy is for fallback
CREATE POLICY "Service role full access" ON bathrooms
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access verifications" ON verifications
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access maintenance" ON maintenance_tasks
  FOR ALL USING (true) WITH CHECK (true);
