-- =============================================================================
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- Fixes: 403 Forbidden on INSERT, 406 Not Acceptable on customer lookup
-- =============================================================================

-- Drop old restrictive policies that rely on auth.uid() (mock auth doesn't set this)
DROP POLICY IF EXISTS "staff_read_orders"            ON orders;
DROP POLICY IF EXISTS "staff_update_orders"           ON orders;
DROP POLICY IF EXISTS "staff_read_order_items"        ON order_items;
DROP POLICY IF EXISTS "staff_read_order_item_modifiers" ON order_item_modifiers;
DROP POLICY IF EXISTS "staff_read_sessions"           ON sessions;
DROP POLICY IF EXISTS "staff_read_customers"          ON customers;
DROP POLICY IF EXISTS "staff_read_settings"           ON system_settings;
DROP POLICY IF EXISTS "admin_update_settings"         ON system_settings;
DROP POLICY IF EXISTS "staff_self_read"               ON staff_users;

-- Customers: full CRUD for dashboard
CREATE POLICY "anon_read_customers"   ON customers FOR SELECT USING (true);
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE USING (true);

-- Orders: full CRUD for dashboard
CREATE POLICY "anon_read_orders"   ON orders FOR SELECT USING (true);
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE USING (true);

-- Order items: read + insert + delete (edit order replaces items)
CREATE POLICY "anon_read_order_items"   ON order_items FOR SELECT USING (true);
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE USING (true);

-- Order item modifiers: read + insert
CREATE POLICY "anon_read_order_item_modifiers"   ON order_item_modifiers FOR SELECT USING (true);
CREATE POLICY "anon_insert_order_item_modifiers" ON order_item_modifiers FOR INSERT WITH CHECK (true);

-- Sessions: read + update for handoff resolution
CREATE POLICY "anon_read_sessions"   ON sessions FOR SELECT USING (true);
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE USING (true);

-- System settings: full CRUD
CREATE POLICY "anon_read_settings"   ON system_settings FOR SELECT USING (true);
CREATE POLICY "anon_update_settings" ON system_settings FOR UPDATE USING (true);
CREATE POLICY "anon_insert_settings" ON system_settings FOR INSERT WITH CHECK (true);

-- Staff users: read for login lookup
CREATE POLICY "anon_read_staff" ON staff_users FOR SELECT USING (true);
