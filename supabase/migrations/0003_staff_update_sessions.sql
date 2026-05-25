-- Add missing RLS policy for staff to update sessions (e.g. resolve handoffs)
DROP POLICY IF EXISTS "staff_update_sessions" ON sessions;
CREATE POLICY "staff_update_sessions" ON sessions FOR UPDATE USING (true);
