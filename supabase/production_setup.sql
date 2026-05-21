-- 0001_init.sql (Phase 1 essentials)

create table customers (
  id              uuid primary key default gen_random_uuid(),
  phone_e164      text unique not null,
  display_name    text,
  created_at      timestamptz not null default now()
);

create table sessions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id),
  state           text not null default 'idle',
  cart_json       jsonb not null default '[]'::jsonb,
  context_json    jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index sessions_customer_idx on sessions(customer_id);
create index sessions_state_idx on sessions(state);

create table menu_categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  sort_order      int not null default 0,
  active          boolean not null default true
);

create table menu_items (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references menu_categories(id),
  slug            text unique not null,
  name            text not null,
  price_inr       int not null,
  prep_time_min   int not null default 5,
  active          boolean not null default true,
  sort_order      int not null default 0
);
create index menu_items_active_idx on menu_items(active);

create table modifier_groups (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references menu_items(id) on delete cascade,
  name            text not null,
  min_select      int not null default 0,
  max_select      int not null default 1
);

create table modifiers (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references modifier_groups(id) on delete cascade,
  name            text not null,
  price_delta_inr int not null default 0,
  active          boolean not null default true
);

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  order_code          text unique not null,
  customer_id         uuid not null references customers(id),
  source              text not null default 'whatsapp',
  state               text not null default 'new',
  subtotal_inr        int not null,
  total_inr           int not null,
  payment_mode        text not null default 'counter',
  payment_status      text not null default 'pending',
  customer_note       text,
  dynamic_eta_factor  numeric(3,2) not null default 1.00,
  promised_eta_min    int not null,
  intent_route        text not null default 'order',
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_state_created_idx on orders(state, created_at);
create index orders_customer_idx on orders(customer_id);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  item_id         uuid not null references menu_items(id),
  qty             int not null check (qty > 0),
  unit_price_inr  int not null,
  line_total_inr  int not null,
  customer_note   text,
  position        int not null
);

create table order_item_modifiers (
  id              uuid primary key default gen_random_uuid(),
  order_item_id   uuid not null references order_items(id) on delete cascade,
  modifier_id     uuid not null references modifiers(id),
  modifier_name   text not null,
  price_delta_inr int not null
);

create table order_status_events (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  from_state      text,
  to_state        text not null,
  changed_by      text,
  reason          text,
  created_at      timestamptz not null default now()
);
create index order_status_events_order_idx on order_status_events(order_id, created_at);

create table messages_raw (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  payload_json    jsonb not null,
  received_at     timestamptz not null default now()
);

create table messages (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid references customers(id),
  direction             text not null,
  provider_msg_id       text unique,
  body                  text,
  payload_json          jsonb,
  classified_intent     text,
  classifier_confidence numeric(3,2),
  created_at            timestamptz not null default now()
);

create table idempotency_keys (
  key             text primary key,
  scope           text not null,
  result_json     jsonb,
  created_at      timestamptz not null default now()
);

create table staff_users (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  role            text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table system_settings (
  key             text primary key,
  value_json      jsonb not null,
  updated_by      uuid references staff_users(id),
  updated_at      timestamptz not null default now()
);

-- Note: we will insert the seed settings in the supabase/seed.sql
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
-- 0003_payment_fields.sql

ALTER TABLE orders
ADD COLUMN payment_intent_id text;
-- Seed system settings based on PRD requirements
INSERT INTO system_settings (key, value_json) VALUES
  ('digital_lane_paused', 'false'::jsonb),
  ('rush_threshold', '15'::jsonb),
  ('eta_inflation_factor', '1.5'::jsonb),
  ('rain_protocol_active', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed some categories
INSERT INTO menu_categories (id, slug, name, sort_order) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'coffee', 'Coffee', 1),
  ('c2000000-0000-4000-8000-000000000002', 'tea', 'Tea', 2)
ON CONFLICT (id) DO NOTHING;

-- Seed some menu items
INSERT INTO menu_items (id, category_id, slug, name, price_inr, prep_time_min, sort_order) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'cold-coffee', 'Cold Coffee', 150, 5, 1),
  ('b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'hazelnut-cold-coffee', 'Hazelnut Cold Coffee', 180, 5, 2),
  ('b2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002', 'masala-tea', 'Masala Tea', 80, 5, 1)
ON CONFLICT (id) DO NOTHING;

-- Seed a staff user
INSERT INTO staff_users (id, email, role) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'admin@shelby.local', 'admin'),
  ('a2000000-0000-4000-8000-000000000002', 'barista@shelby.local', 'staff')
ON CONFLICT (id) DO NOTHING;
