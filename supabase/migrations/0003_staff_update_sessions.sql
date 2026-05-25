-- Add missing RLS policy for staff to update sessions (e.g. resolve handoffs)
CREATE POLICY "staff_update_sessions" ON sessions FOR UPDATE USING (true);
