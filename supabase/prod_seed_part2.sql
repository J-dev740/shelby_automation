-- =============================================================================
-- SHELBY PRODUCTION SEED SCRIPT — PART 2
-- Run this AFTER you have created the two Auth users in the Supabase Dashboard:
--   - admin@shelby.local    (Auto Confirm: ON, Password: password123)
--   - barista@shelby.local  (Auto Confirm: ON, Password: password123)
--
-- What this does:
--   - Links the real Auth user IDs to the staff_users permissions table
--   - This is what allows those users to log into the Dashboard
-- =============================================================================

-- Remove any old/stale staff_users rows (from previous failed attempts)
DELETE FROM staff_users;

-- Insert staff users by reading real IDs directly from the auth.users table.
-- This works regardless of what UUID Supabase assigned to the user.
INSERT INTO staff_users (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@shelby.local';

INSERT INTO staff_users (id, email, role)
SELECT id, email, 'staff'
FROM auth.users
WHERE email = 'barista@shelby.local';

-- Verify: you should see 2 rows here when it works correctly
SELECT id, email, role, active FROM staff_users;
