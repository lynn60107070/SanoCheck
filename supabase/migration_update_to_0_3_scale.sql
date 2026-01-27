-- Migration: Update bathrooms to 0-3 scoring scale and remove needs_recheck status
-- Run this in your Supabase SQL Editor
-- This migration handles both status changes and score conversion

-- ============================================================================
-- PART 1: UPDATE STATUS CONSTRAINT (Remove needs_recheck)
-- ============================================================================

-- Step 1: Drop the old constraint
ALTER TABLE bathrooms DROP CONSTRAINT IF EXISTS bathrooms_status_check;

-- Step 2: Convert any 'needs_recheck' statuses to 'flagged'
UPDATE bathrooms 
SET status = 'flagged'
WHERE status = 'needs_recheck';

-- Step 3: Update any other old status values
UPDATE bathrooms 
SET status = CASE 
  WHEN status = 'usable' THEN 'verified_usable'
  WHEN status = 'unusable' THEN 'verified_unusable'
  WHEN status NOT IN ('verified_usable', 'flagged', 'verified_unusable') 
    THEN 'flagged'  -- Default any unexpected values to 'flagged'
  ELSE status
END;

-- Step 4: Add the new constraint (without needs_recheck)
ALTER TABLE bathrooms 
  ADD CONSTRAINT bathrooms_status_check 
  CHECK (status IN ('verified_usable', 'flagged', 'verified_unusable'));

-- ============================================================================
-- PART 2: CONVERT SCORES FROM 0-100 TO 0-3 SCALE (WHOLE NUMBERS)
-- ============================================================================

-- Step 5: Convert health_score column type to INTEGER (whole numbers only)
-- First, we need to convert the scores, then change the type
-- If the column is already NUMERIC, convert it first

-- Convert scores from 0-100 to 0-3 scale
-- Mapping: 0-33 -> 0, 34-66 -> 1, 67-99 -> 2, 100 -> 3
UPDATE bathrooms 
SET health_score = LEAST(3, GREATEST(0, ROUND(health_score / 33.33)));

-- Step 6: Change column type to INTEGER
-- This will work if the column is already INTEGER or NUMERIC
DO $$ 
BEGIN
  -- Try to alter to INTEGER
  ALTER TABLE bathrooms 
    ALTER COLUMN health_score TYPE INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    -- If it fails, the column might need to be converted first
    -- Try converting via text as intermediate step
    ALTER TABLE bathrooms 
      ALTER COLUMN health_score TYPE INTEGER USING ROUND(health_score)::INTEGER;
END $$;

-- Step 7: Update the score constraint
ALTER TABLE bathrooms 
  DROP CONSTRAINT IF EXISTS bathrooms_health_score_check;

ALTER TABLE bathrooms 
  ADD CONSTRAINT bathrooms_health_score_check 
  CHECK (health_score >= 0 AND health_score <= 3);

-- Step 8: Set default to 3
ALTER TABLE bathrooms 
  ALTER COLUMN health_score SET DEFAULT 3;

-- ============================================================================
-- VERIFICATION QUERIES (Optional - uncomment to check results)
-- ============================================================================

-- Check status distribution
-- SELECT status, COUNT(*) as count FROM bathrooms GROUP BY status;

-- Check score distribution
-- SELECT health_score, COUNT(*) as count FROM bathrooms GROUP BY health_score ORDER BY health_score;

-- Check for any invalid data
-- SELECT id, health_score, status FROM bathrooms 
-- WHERE health_score < 0 OR health_score > 3 
--    OR status NOT IN ('verified_usable', 'flagged', 'verified_unusable');
