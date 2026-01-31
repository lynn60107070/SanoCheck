-- =============================================================================
-- FIX: Status updates not persisting (verification, resident feedback, etc.)
-- Run this ENTIRE file in Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================
-- This allows the Next.js API (using anon key) to read and write the database.
-- Without SELECT, anon cannot see updated rows after refresh. Without UPDATE, writes fail.
-- For best results, set SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS).
-- =============================================================================

-- Bathrooms: allow anon to SELECT all rows (so refresh shows latest score/status)
DROP POLICY IF EXISTS "Allow anon read bathrooms" ON bathrooms;
CREATE POLICY "Allow anon read bathrooms" ON bathrooms
  FOR SELECT TO anon USING (true);

-- Bathrooms: allow anon to UPDATE (score, status, last_verified_at)
DROP POLICY IF EXISTS "Allow bathroom updates" ON bathrooms;
CREATE POLICY "Allow bathroom updates" ON bathrooms
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Verifications: allow INSERT (volunteer verification form)
DROP POLICY IF EXISTS "Allow insert verifications" ON verifications;
CREATE POLICY "Allow insert verifications" ON verifications
  FOR INSERT TO anon WITH CHECK (true);

-- Maintenance: allow INSERT and UPDATE (create/update tasks)
DROP POLICY IF EXISTS "Allow insert maintenance" ON maintenance_tasks;
CREATE POLICY "Allow insert maintenance" ON maintenance_tasks
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update maintenance" ON maintenance_tasks;
CREATE POLICY "Allow update maintenance" ON maintenance_tasks
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Confirm: list policies (optional, for debugging)
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('bathrooms','verifications','maintenance_tasks');
