-- =============================================================================
-- SHELBY PRODUCTION SEED SCRIPT — PART 1
-- Run this FIRST in: Supabase Dashboard → SQL Editor → New Query
--
-- What this does:
--   1. Creates all tables (safe to run on a fresh database)
--   2. Enables Row Level Security with correct policies
--   3. Seeds menu categories, menu items, and system settings
--
-- AFTER running this script, go to Authentication → Users and create:
--   - admin@shelby.local  (password: password123)  ← turn ON "Auto Confirm User"
--   - barista@shelby.local (password: password123) ← turn ON "Auto Confirm User"
--
-- Then run PART 2 below to link them to the permissions table.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164      text UNIQUE NOT NULL,
  display_name    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid NOT NULL REFERENCES customers(id),
  state            text NOT NULL DEFAULT 'idle',
  cart_json        jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_customer_idx ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS sessions_state_idx ON sessions(state);

CREATE TABLE IF NOT EXISTS menu_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES menu_categories(id),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  price_inr     int NOT NULL,
  prep_time_min int NOT NULL DEFAULT 5,
  active        boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS menu_items_active_idx ON menu_items(active);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name       text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modifiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name            text NOT NULL,
  price_delta_inr int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS staff_users (
  id         uuid PRIMARY KEY,
  email      text UNIQUE NOT NULL,
  role       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code          text UNIQUE NOT NULL,
  customer_id         uuid NOT NULL REFERENCES customers(id),
  source              text NOT NULL DEFAULT 'whatsapp',
  state               text NOT NULL DEFAULT 'new',
  subtotal_inr        int NOT NULL,
  total_inr           int NOT NULL,
  payment_mode        text NOT NULL DEFAULT 'counter',
  payment_status      text NOT NULL DEFAULT 'pending',
  payment_intent_id   text,
  customer_note       text,
  dynamic_eta_factor  numeric(3,2) NOT NULL DEFAULT 1.00,
  promised_eta_min    int NOT NULL,
  intent_route        text NOT NULL DEFAULT 'order',
  cancellation_reason text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_state_created_idx ON orders(state, created_at);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES menu_items(id),
  qty            int NOT NULL CHECK (qty > 0),
  unit_price_inr int NOT NULL,
  line_total_inr int NOT NULL,
  customer_note  text,
  position       int NOT NULL
);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id     uuid NOT NULL REFERENCES modifiers(id),
  modifier_name   text NOT NULL,
  price_delta_inr int NOT NULL
);

CREATE TABLE IF NOT EXISTS order_status_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_state text,
  to_state   text NOT NULL,
  changed_by text,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_events_order_idx ON order_status_events(order_id, created_at);

CREATE TABLE IF NOT EXISTS messages_raw (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  payload_json jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid REFERENCES customers(id),
  direction             text NOT NULL,
  provider_msg_id       text UNIQUE,
  body                  text,
  payload_json          jsonb,
  classified_intent     text,
  classifier_confidence numeric(3,2),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         text PRIMARY KEY,
  scope       text NOT NULL,
  result_json jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key        text PRIMARY KEY,
  value_json jsonb NOT NULL,
  updated_by uuid REFERENCES staff_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

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

-- Drop existing policies before recreating (safe for re-runs)
DROP POLICY IF EXISTS "menu_public_read" ON menu_items;
DROP POLICY IF EXISTS "menu_categories_public_read" ON menu_categories;
DROP POLICY IF EXISTS "modifiers_public_read" ON modifiers;
DROP POLICY IF EXISTS "modifier_groups_public_read" ON modifier_groups;
DROP POLICY IF EXISTS "staff_read_orders" ON orders;
DROP POLICY IF EXISTS "staff_update_orders" ON orders;
DROP POLICY IF EXISTS "staff_read_order_items" ON order_items;
DROP POLICY IF EXISTS "staff_read_order_item_modifiers" ON order_item_modifiers;
DROP POLICY IF EXISTS "staff_read_order_events" ON order_status_events;
DROP POLICY IF EXISTS "staff_read_sessions" ON sessions;
DROP POLICY IF EXISTS "staff_read_customers" ON customers;
DROP POLICY IF EXISTS "staff_read_settings" ON system_settings;
DROP POLICY IF EXISTS "admin_update_settings" ON system_settings;
DROP POLICY IF EXISTS "staff_self_read" ON staff_users;

-- Menu: public read (bot and dashboard both need this without auth)
CREATE POLICY "menu_public_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_categories_public_read" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "modifiers_public_read" ON modifiers FOR SELECT USING (true);
CREATE POLICY "modifier_groups_public_read" ON modifier_groups FOR SELECT USING (true);

-- Orders: only authenticated staff can read/update
CREATE POLICY "staff_read_orders" ON orders FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "staff_update_orders" ON orders FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));

-- Order sub-tables: readable if parent order is accessible
CREATE POLICY "staff_read_order_items" ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders));
CREATE POLICY "staff_read_order_item_modifiers" ON order_item_modifiers FOR SELECT
  USING (order_item_id IN (SELECT id FROM order_items));
CREATE POLICY "staff_read_order_events" ON order_status_events FOR SELECT
  USING (order_id IN (SELECT id FROM orders));

-- Sessions & customers: authenticated staff only
CREATE POLICY "staff_read_sessions" ON sessions FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "staff_read_customers" ON customers FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));

-- System settings: all staff read, admin-only write
CREATE POLICY "staff_read_settings" ON system_settings FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "admin_update_settings" ON system_settings FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE role = 'admin' AND active = true));

-- Staff users: each user can only read their own row
CREATE POLICY "staff_self_read" ON staff_users FOR SELECT
  USING ((SELECT auth.uid()) = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- System settings
INSERT INTO system_settings (key, value_json) VALUES
  ('digital_lane_paused',  'false'::jsonb),
  ('rush_threshold',        '15'::jsonb),
  ('eta_inflation_factor',  '1.5'::jsonb),
  ('rain_protocol_active',  'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Menu categories
INSERT INTO menu_categories (id, slug, name, sort_order) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'coffee',   'Coffee',   1),
  ('c2000000-0000-4000-8000-000000000002', 'tea',      'Tea',      2),
  ('c3000000-0000-4000-8000-000000000003', 'snacks',   'Snacks',   3),
  ('c4000000-0000-4000-8000-000000000004', 'smoothie', 'Smoothie', 4)
ON CONFLICT (id) DO NOTHING;

-- Menu items (prices in paise? No — price_inr is whole rupees)
INSERT INTO menu_items (id, category_id, slug, name, price_inr, prep_time_min, sort_order) VALUES
  -- Coffee
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'cold-coffee',          'Cold Coffee',          150, 5, 1),
  ('b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'hazelnut-cold-coffee', 'Hazelnut Cold Coffee', 180, 5, 2),
  ('b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'espresso',             'Espresso',             100, 3, 3),
  ('b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'cappuccino',           'Cappuccino',           160, 5, 4),
  ('b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'latte',                'Latte',                170, 5, 5),
  -- Tea
  ('b2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002', 'masala-tea',           'Masala Tea',            80, 5, 1),
  ('b2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'green-tea',            'Green Tea',             70, 4, 2),
  ('b2000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000002', 'ginger-tea',           'Ginger Tea',            80, 5, 3),
  -- Snacks
  ('b3000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000003', 'veg-sandwich',         'Veg Sandwich',         120, 8, 1),
  ('b3000000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000003', 'paneer-sandwich',      'Paneer Sandwich',      150, 8, 2),
  ('b3000000-0000-4000-8000-000000000003', 'c3000000-0000-4000-8000-000000000003', 'samosa',               'Samosa (2 pcs)',         40, 3, 3),
  -- Smoothies
  ('b4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000004', 'mango-smoothie',       'Mango Smoothie',       180, 6, 1),
  ('b4000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000004', 'strawberry-smoothie',  'Strawberry Smoothie',  180, 6, 2)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ✅ PART 1 COMPLETE
-- Now go to: Authentication → Users → Add User
--   Email: admin@shelby.local    Password: password123  ← Auto Confirm: ON
--   Email: barista@shelby.local  Password: password123  ← Auto Confirm: ON
-- Then run PART 2 below.
-- ─────────────────────────────────────────────────────────────────────────────
