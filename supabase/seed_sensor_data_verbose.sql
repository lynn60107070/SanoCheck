-- Diagnostic version with error handling
-- This will help identify what's failing

-- First, verify bathrooms exist
SELECT id, sensor_attached FROM bathrooms WHERE id IN ('A-03', 'A-11', 'C-05', 'D-06');

-- Check current sensor readings count
SELECT bathroom_id, sensor_type, COUNT(*) as count 
FROM sensor_readings 
WHERE bathroom_id IN ('A-03', 'A-11', 'C-05', 'D-06')
AND created_at >= (NOW() - INTERVAL '24 hours')
GROUP BY bathroom_id, sensor_type
ORDER BY bathroom_id, sensor_type;

-- Now try inserting with explicit error handling
DO $$
DECLARE
    inserted_count INTEGER := 0;
    error_message TEXT;
BEGIN
    -- Delete existing
    DELETE FROM sensor_readings
    WHERE bathroom_id IN ('A-03', 'A-11', 'C-05', 'D-06')
    AND created_at >= (NOW() - INTERVAL '24 hours');
    
    RAISE NOTICE 'Deleted old readings';
    
    -- Insert A-03 data
    BEGIN
        INSERT INTO sensor_readings (bathroom_id, sensor_type, gas_type, value, unit, created_at) VALUES
        ('A-03', 'gas', 'H2S', 12, '%', NOW() - INTERVAL '23 hours'),
        ('A-03', 'water', NULL, 85, '%', NOW() - INTERVAL '23 hours'),
        ('A-03', 'humidity', NULL, 45, '%', NOW() - INTERVAL '23 hours');
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        RAISE NOTICE 'A-03: Inserted % rows', inserted_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'A-03 insert failed: %', SQLERRM;
    END;
    
    -- Verify what was inserted
    SELECT COUNT(*) INTO inserted_count 
    FROM sensor_readings 
    WHERE bathroom_id = 'A-03' 
    AND created_at >= (NOW() - INTERVAL '24 hours');
    RAISE NOTICE 'A-03 total readings after insert: %', inserted_count;
    
END $$;
