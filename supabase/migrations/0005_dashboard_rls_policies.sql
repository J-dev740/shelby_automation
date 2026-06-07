-- Migration: Allow dashboard (anon key) to INSERT/UPDATE on tables needed for POS orders
-- The dashboard uses mock auth (no real Supabase Auth), so we use permissive policies.

-- Customers: allow INSERT and UPDATE for POS customer creation
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE USING (true);
CREATE POLICY "anon_read_customers"   ON customers FOR SELECT USING (true);

-- Orders: allow INSERT for POS order creation, UPDATE for status changes
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "anon_read_orders"   ON orders FOR SELECT USING (true);

-- Order items: allow INSERT for POS order items
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_read_order_items"   ON order_items FOR SELECT USING (true);

-- Order item modifiers: allow INSERT
CREATE POLICY "anon_insert_order_item_modifiers" ON order_item_modifiers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_read_order_item_modifiers"   ON order_item_modifiers FOR SELECT USING (true);

-- Sessions: allow UPDATE for handoff resolution
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE USING (true);
CREATE POLICY "anon_read_sessions"   ON sessions FOR SELECT USING (true);

-- System settings: allow read/write
CREATE POLICY "anon_read_settings"   ON system_settings FOR SELECT USING (true);
CREATE POLICY "anon_update_settings" ON system_settings FOR UPDATE USING (true);
CREATE POLICY "anon_insert_settings" ON system_settings FOR INSERT WITH CHECK (true);
