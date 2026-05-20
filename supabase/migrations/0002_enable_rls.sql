-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Menu items: public read (customers browse via bot, dashboard displays)
CREATE POLICY "menu_public_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_categories_public_read" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "modifiers_public_read" ON modifiers FOR SELECT USING (true);
CREATE POLICY "modifier_groups_public_read" ON modifier_groups FOR SELECT USING (true);

-- Staff: authenticated users who exist in staff_users can read operational tables
CREATE POLICY "staff_read_orders" ON orders FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "staff_update_orders" ON orders FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));

CREATE POLICY "staff_read_order_items" ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders));
CREATE POLICY "staff_read_order_item_modifiers" ON order_item_modifiers FOR SELECT
  USING (order_item_id IN (SELECT id FROM order_items));
CREATE POLICY "staff_read_order_events" ON order_status_events FOR SELECT
  USING (order_id IN (SELECT id FROM orders));

CREATE POLICY "staff_read_sessions" ON sessions FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "staff_read_customers" ON customers FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));

-- System settings: all staff read, admin-only write
CREATE POLICY "staff_read_settings" ON system_settings FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "admin_update_settings" ON system_settings FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE role = 'admin' AND active = true));

-- Staff users: self-read only
CREATE POLICY "staff_self_read" ON staff_users FOR SELECT
  USING ((SELECT auth.uid()) = id);

-- API service role: the backend API uses the service_role key to bypass RLS
-- This is correct — the API server is trusted and handles its own auth
-- Dashboard uses anon key and relies on RLS
