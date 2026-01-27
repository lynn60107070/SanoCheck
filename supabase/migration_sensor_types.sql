-- Migration: Update sensor_readings table to support multiple sensor types
-- Run this in your Supabase SQL Editor if you have an existing database
-- This adds the sensor_type and unit columns, and migrates existing data

-- Step 1: Add new columns (nullable for backward compatibility)
ALTER TABLE sensor_readings 
  ADD COLUMN IF NOT EXISTS sensor_type TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- Step 2: Migrate existing data
-- If gas_type exists, assume all existing readings are gas sensors
-- Otherwise, default to 'gas' for all existing readings
UPDATE sensor_readings 
SET sensor_type = COALESCE(
  CASE 
    WHEN gas_type IS NOT NULL THEN 'gas'
    ELSE 'gas'  -- Default all existing to gas
  END,
  'gas'
),
unit = COALESCE(unit, 'ppm')
WHERE sensor_type IS NULL;

-- Add constraint for sensor_type (drop first if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_readings_sensor_type_check'
  ) THEN
    ALTER TABLE sensor_readings 
      DROP CONSTRAINT sensor_readings_sensor_type_check;
  END IF;
END $$;

ALTER TABLE sensor_readings 
  ADD CONSTRAINT sensor_readings_sensor_type_check 
  CHECK (sensor_type IN ('gas', 'water', 'humidity'));

-- Make sensor_type NOT NULL after migration
ALTER TABLE sensor_readings 
  ALTER COLUMN sensor_type SET NOT NULL;

-- Make gas_type nullable (only needed for gas sensors)
-- This will fail silently if the column is already nullable
DO $$ 
BEGIN
  ALTER TABLE sensor_readings 
    ALTER COLUMN gas_type DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Column might already be nullable, ignore error
    NULL;
END $$;

-- Add constraint that gas_type is only set for gas sensors (drop first if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_readings_gas_type_check'
  ) THEN
    ALTER TABLE sensor_readings 
      DROP CONSTRAINT sensor_readings_gas_type_check;
  END IF;
END $$;

ALTER TABLE sensor_readings 
  ADD CONSTRAINT sensor_readings_gas_type_check 
  CHECK (
    (sensor_type = 'gas' AND gas_type IS NOT NULL) OR
    (sensor_type != 'gas' AND gas_type IS NULL)
  );
