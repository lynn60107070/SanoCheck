-- Migration: Convert health_score from 0-100 scale to 0-3 scale (whole numbers)
-- Run this in your Supabase SQL Editor

-- Step 1: Update the column type to INTEGER (whole numbers only)
ALTER TABLE bathrooms 
  ALTER COLUMN health_score TYPE INTEGER;

-- Step 2: Convert all existing scores from 0-100 to 0-3 scale
-- Formula: new_score = ROUND(old_score / 33.33) then clamp to 0-3
-- This maps: 0-33 -> 0, 34-66 -> 1, 67-99 -> 2, 100 -> 3
UPDATE bathrooms 
SET health_score = LEAST(3, GREATEST(0, ROUND(health_score / 33.33)));

-- Step 3: Update the constraint to allow 0-3 range
ALTER TABLE bathrooms 
  DROP CONSTRAINT IF EXISTS bathrooms_health_score_check;

ALTER TABLE bathrooms 
  ADD CONSTRAINT bathrooms_health_score_check 
  CHECK (health_score >= 0 AND health_score <= 3);

-- Step 4: Set default to 3 instead of 100
ALTER TABLE bathrooms 
  ALTER COLUMN health_score SET DEFAULT 3;
