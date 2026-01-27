-- Complete Migration: Update bathrooms for 0-3 scoring and new status system
-- Run this in your Supabase SQL Editor
-- This is a comprehensive migration that handles everything in one go

-- ============================================================================
-- STEP 1: BACKUP (Optional but recommended)
-- ============================================================================
-- Uncomment the line below to create a backup table first:
-- CREATE TABLE bathrooms_backup AS SELECT * FROM bathrooms;

-- ============================================================================
-- STEP 2: UPDATE STATUS CONSTRAINT (Remove needs_recheck)
-- ============================================================================

-- Drop old constraint
ALTER TABLE bathrooms DROP CONSTRAINT IF EXISTS bathrooms_status_check;

-- Convert 'needs_recheck' to 'flagged'
UPDATE bathrooms 
SET status = 'flagged'
WHERE status = 'needs_recheck';

-- Convert any other legacy status values
UPDATE bathrooms 
SET status = CASE 
  WHEN status = 'usable' THEN 'verified_usable'
  WHEN status = 'unusable' THEN 'verified_unusable'
  WHEN status NOT IN ('verified_usable', 'flagged', 'verified_unusable') 
    THEN 'flagged'
  ELSE status
END;

-- Add new constraint
ALTER TABLE bathrooms 
  ADD CONSTRAINT bathrooms_status_check 
  CHECK (status IN ('verified_usable', 'flagged', 'verified_unusable'));

-- ============================================================================
-- STEP 3: CONVERT SCORES FROM 0-100 TO 0-3 (WHOLE NUMBERS)
-- ============================================================================

-- Convert scores: 0-33 -> 0, 34-66 -> 1, 67-99 -> 2, 100 -> 3
UPDATE bathrooms 
SET health_score = LEAST(3, GREATEST(0, ROUND(health_score / 33.33)));

-- Change column type to INTEGER (handles both INTEGER and NUMERIC types)
DO $$ 
BEGIN
  -- Try direct conversion
  ALTER TABLE bathrooms ALTER COLUMN health_score TYPE INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    -- If direct conversion fails, use USING clause
    ALTER TABLE bathrooms 
      ALTER COLUMN health_score TYPE INTEGER 
      USING ROUND(health_score)::INTEGER;
END $$;

-- Update constraint
ALTER TABLE bathrooms 
  DROP CONSTRAINT IF EXISTS bathrooms_health_score_check;

ALTER TABLE bathrooms 
  ADD CONSTRAINT bathrooms_health_score_check 
  CHECK (health_score >= 0 AND health_score <= 3);

-- Set default
ALTER TABLE bathrooms 
  ALTER COLUMN health_score SET DEFAULT 3;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Verify status distribution
SELECT 'Status Distribution:' as info;
SELECT status, COUNT(*) as count 
FROM bathrooms 
GROUP BY status 
ORDER BY status;

-- Verify score distribution
SELECT 'Score Distribution:' as info;
SELECT health_score, COUNT(*) as count 
FROM bathrooms 
GROUP BY health_score 
ORDER BY health_score;

-- Check for any invalid data
SELECT 'Invalid Records (if any):' as info;
SELECT id, health_score, status 
FROM bathrooms 
WHERE health_score < 0 
   OR health_score > 3 
   OR status NOT IN ('verified_usable', 'flagged', 'verified_unusable');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- If the queries above show no invalid records, the migration was successful!
