-- Migration: Update bathrooms status constraint to use new status values
-- Run this in your Supabase SQL Editor

-- Step 1: Check what status values currently exist (for debugging)
-- Uncomment the line below to see current status values:
-- SELECT DISTINCT status FROM bathrooms;

-- Step 2: Drop the old constraint first
ALTER TABLE bathrooms DROP CONSTRAINT IF EXISTS bathrooms_status_check;

-- Step 3: Update any existing rows that use old status values
-- This must happen AFTER dropping the constraint and BEFORE adding the new one
UPDATE bathrooms 
SET status = CASE 
  WHEN status = 'usable' THEN 'verified_usable'
  WHEN status = 'unusable' THEN 'verified_unusable'
  WHEN status NOT IN ('verified_usable', 'flagged', 'verified_unusable') 
    THEN 'flagged'  -- Default any unexpected values to 'flagged'
  ELSE status
END;

-- Step 4: Verify all rows have valid status values (for debugging)
-- Uncomment the line below to check:
-- SELECT DISTINCT status FROM bathrooms;

-- Step 5: Add the new constraint with updated status values
-- This will only work if all rows now have valid status values
ALTER TABLE bathrooms 
  ADD CONSTRAINT bathrooms_status_check 
  CHECK (status IN ('verified_usable', 'flagged', 'verified_unusable'));
