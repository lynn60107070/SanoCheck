-- Seed data for SanoCheck demo
-- Run this after schema.sql

-- Insert sample bathrooms
INSERT INTO bathrooms (id, zone, type, high_traffic, sensor_attached, last_verified_at, health_score, status, location) VALUES
  ('A-03', 'A', 'male', true, true, NOW() - INTERVAL '2 days', 2, 'verified_usable', 'Main building, ground floor'),
  ('A-07', 'A', 'female', false, false, NOW() - INTERVAL '5 days', 1, 'flagged', 'Main building, first floor'),
  ('A-11', 'A', 'accessible', true, true, NOW() - INTERVAL '1 day', 3, 'verified_usable', 'Main building, ground floor'),
  ('B-04', 'B', 'male', false, true, NULL, 0, 'flagged', 'Secondary building, ground floor'),
  ('B-08', 'B', 'female', false, false, NOW() - INTERVAL '10 days', 0, 'verified_unusable', 'Secondary building, first floor'),
  ('C-01', 'C', 'accessible', true, false, NOW() - INTERVAL '3 days', 2, 'flagged', 'Clinic building'),
  ('C-05', 'C', 'male', true, true, NOW() - INTERVAL '1 day', 3, 'verified_usable', 'Clinic building, ground floor'),
  ('D-02', 'D', 'female', false, false, NOW() - INTERVAL '7 days', 1, 'flagged', 'Food distribution center'),
  ('D-06', 'D', 'accessible', true, true, NOW() - INTERVAL '4 days', 2, 'verified_usable', 'Food distribution center, ground floor')
ON CONFLICT (id) DO NOTHING;

-- Insert sample verification
INSERT INTO verifications (bathroom_id, volunteer_id, water_available, clogged, usable, notes) VALUES
  ('A-03', 'volunteer-1', true, false, true, 'All systems working'),
  ('A-07', 'volunteer-1', true, false, true, 'Needs cleaning'),
  ('A-11', 'volunteer-2', true, false, true, 'Fully accessible'),
  ('B-08', 'volunteer-1', false, true, false, 'No water, clogged drain')
ON CONFLICT DO NOTHING;

-- Insert sample resident signals
INSERT INTO resident_signals (bathroom_id, signal, anonymous) VALUES
  ('A-03', 'usable', true),
  ('A-03', 'usable', true),
  ('A-11', 'usable', true),
  ('B-04', 'unusable', true),
  ('C-01', 'usable', true)
ON CONFLICT DO NOTHING;

-- Insert sample sensor readings
INSERT INTO sensor_readings (bathroom_id, sensor_type, gas_type, value, unit) VALUES
  -- Gas readings
  ('A-03', 'gas', 'H2S', 25, 'ppm'),
  ('A-11', 'gas', 'H2S', 18, 'ppm'),
  ('B-04', 'gas', 'H2S', 65, 'ppm'),
  ('C-05', 'gas', 'H2S', 22, 'ppm'),
  ('D-06', 'gas', 'NH3', 15, 'ppm'),
  -- Water flow readings
  ('A-03', 'water', NULL, 2.5, 'L/min'),
  ('A-11', 'water', NULL, 3.0, 'L/min'),
  ('B-04', 'water', NULL, 0.2, 'L/min'),
  ('C-05', 'water', NULL, 2.8, 'L/min'),
  ('D-06', 'water', NULL, 2.2, 'L/min'),
  -- Humidity readings
  ('A-03', 'humidity', NULL, 45, '%'),
  ('A-11', 'humidity', NULL, 42, '%'),
  ('B-04', 'humidity', NULL, 75, '%'),
  ('C-05', 'humidity', NULL, 38, '%'),
  ('D-06', 'humidity', NULL, 50, '%')
ON CONFLICT DO NOTHING;

-- Insert sample maintenance task
INSERT INTO maintenance_tasks (bathroom_id, issue_type, status, contact_method) VALUES
  ('B-08', 'plumbing', 'not_assigned', 'whatsapp')
ON CONFLICT DO NOTHING;
