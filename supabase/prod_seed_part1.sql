-- =============================================================================
-- SHELBY THE BARISTA — PRODUCTION SEED SCRIPT (PART 1)
-- HSR Layout, Bangalore — Specialty Coffee & Café
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run (all inserts use ON CONFLICT DO NOTHING)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: SCHEMA (all tables, idempotent)
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
CREATE INDEX IF NOT EXISTS sessions_state_idx    ON sessions(state);

CREATE TABLE IF NOT EXISTS menu_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES menu_categories(id),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  price_inr     int  NOT NULL,
  prep_time_min int  NOT NULL DEFAULT 5,
  active        boolean NOT NULL DEFAULT true,
  sort_order    int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS menu_items_active_idx ON menu_items(active);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name       text NOT NULL,
  min_select int  NOT NULL DEFAULT 0,
  max_select int  NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modifiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name            text NOT NULL,
  price_delta_inr int  NOT NULL DEFAULT 0,
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
  subtotal_inr        int  NOT NULL,
  total_inr           int  NOT NULL,
  payment_mode        text NOT NULL DEFAULT 'counter',
  payment_status      text NOT NULL DEFAULT 'pending',
  payment_intent_id   text,
  customer_note       text,
  dynamic_eta_factor  numeric(3,2) NOT NULL DEFAULT 1.00,
  promised_eta_min    int  NOT NULL,
  intent_route        text NOT NULL DEFAULT 'order',
  cancellation_reason text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_state_created_idx ON orders(state, created_at);
CREATE INDEX IF NOT EXISTS orders_customer_idx      ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES menu_items(id),
  qty            int  NOT NULL CHECK (qty > 0),
  unit_price_inr int  NOT NULL,
  line_total_inr int  NOT NULL,
  customer_note  text,
  position       int  NOT NULL
);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id     uuid NOT NULL REFERENCES modifiers(id),
  modifier_name   text NOT NULL,
  price_delta_inr int  NOT NULL
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

ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_raw        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings     ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies (safe for re-runs)
DO $$ BEGIN
  DROP POLICY IF EXISTS "menu_public_read"              ON menu_items;
  DROP POLICY IF EXISTS "menu_categories_public_read"   ON menu_categories;
  DROP POLICY IF EXISTS "modifiers_public_read"         ON modifiers;
  DROP POLICY IF EXISTS "modifier_groups_public_read"   ON modifier_groups;
  DROP POLICY IF EXISTS "staff_read_orders"             ON orders;
  DROP POLICY IF EXISTS "staff_update_orders"           ON orders;
  DROP POLICY IF EXISTS "staff_read_order_items"        ON order_items;
  DROP POLICY IF EXISTS "staff_read_order_item_modifiers" ON order_item_modifiers;
  DROP POLICY IF EXISTS "staff_read_order_events"       ON order_status_events;
  DROP POLICY IF EXISTS "staff_read_sessions"           ON sessions;
  DROP POLICY IF EXISTS "staff_read_customers"          ON customers;
  DROP POLICY IF EXISTS "staff_read_settings"           ON system_settings;
  DROP POLICY IF EXISTS "admin_update_settings"         ON system_settings;
  DROP POLICY IF EXISTS "staff_self_read"               ON staff_users;
END $$;

CREATE POLICY "menu_public_read"             ON menu_items       FOR SELECT USING (true);
CREATE POLICY "menu_categories_public_read"  ON menu_categories  FOR SELECT USING (true);
CREATE POLICY "modifiers_public_read"        ON modifiers        FOR SELECT USING (true);
CREATE POLICY "modifier_groups_public_read"  ON modifier_groups  FOR SELECT USING (true);

CREATE POLICY "staff_read_orders"    ON orders FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "staff_update_orders"  ON orders FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));

CREATE POLICY "staff_read_order_items" ON order_items FOR SELECT
  USING (order_id IN (SELECT id FROM orders));
CREATE POLICY "staff_read_order_item_modifiers" ON order_item_modifiers FOR SELECT
  USING (order_item_id IN (SELECT id FROM order_items));
CREATE POLICY "staff_read_order_events" ON order_status_events FOR SELECT
  USING (order_id IN (SELECT id FROM orders));

CREATE POLICY "staff_read_sessions"  ON sessions FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "staff_read_customers" ON customers FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));

CREATE POLICY "staff_read_settings"  ON system_settings FOR SELECT
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE active = true));
CREATE POLICY "admin_update_settings" ON system_settings FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT id FROM staff_users WHERE role = 'admin' AND active = true));

CREATE POLICY "staff_self_read" ON staff_users FOR SELECT
  USING ((SELECT auth.uid()) = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: SYSTEM SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO system_settings (key, value_json) VALUES
  ('digital_lane_paused',  'false'::jsonb),
  ('rush_threshold',        '15'::jsonb),
  ('eta_inflation_factor',  '1.5'::jsonb),
  ('rain_protocol_active',  'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: SHELBY MENU — CATEGORIES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO menu_categories (id, slug, name, sort_order) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'cold-coffee',   '❄️ Cold Coffee',    1),
  ('c2000000-0000-4000-8000-000000000002', 'hot-coffee',    '☕ Hot Coffee',      2),
  ('c3000000-0000-4000-8000-000000000003', 'teas',          '🍵 Teas',            3),
  ('c4000000-0000-4000-8000-000000000004', 'smoothies',     '🥤 Smoothies',       4),
  ('c5000000-0000-4000-8000-000000000005', 'food',          '🥪 Food',            5),
  ('c6000000-0000-4000-8000-000000000006', 'extras',        '✨ Add-ons',         6)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: SHELBY MENU — ITEMS
-- Prices based on a specialty café in HSR Layout, Bangalore
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO menu_items (id, category_id, slug, name, description, price_inr, prep_time_min, sort_order) VALUES

  -- ── COLD COFFEE ──────────────────────────────────────────────────────────
  ('b1100000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001',
   'classic-cold-coffee', 'Classic Cold Coffee',
   'House-brewed espresso blended with chilled milk & a hint of sweetness',
   149, 4, 1),

  ('b1100000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001',
   'hazelnut-cold-coffee', 'Hazelnut Cold Coffee',
   'Cold coffee elevated with Italian hazelnut syrup — rich, smooth & indulgent',
   179, 4, 2),

  ('b1100000-0000-4000-8000-000000000003',
   'c1000000-0000-4000-8000-000000000001',
   'caramel-cold-coffee', 'Caramel Cold Coffee',
   'Double shot espresso with silky caramel swirls over cold milk',
   179, 4, 3),

  ('b1100000-0000-4000-8000-000000000004',
   'c1000000-0000-4000-8000-000000000001',
   'cold-brew', 'Cold Brew',
   '18-hour slow-steeped cold brew — bold, smooth, zero bitterness',
   199, 2, 4),

  ('b1100000-0000-4000-8000-000000000005',
   'c1000000-0000-4000-8000-000000000001',
   'spanish-latte', 'Spanish Latte',
   'Espresso + condensed milk + fresh cold milk — our most-loved cold drink',
   189, 4, 5),

  ('b1100000-0000-4000-8000-000000000006',
   'c1000000-0000-4000-8000-000000000001',
   'dalgona-coffee', 'Dalgona Coffee',
   'Whipped coffee cloud over chilled milk — aesthetic and delicious',
   199, 6, 6),

  -- ── HOT COFFEE ───────────────────────────────────────────────────────────
  ('b1200000-0000-4000-8000-000000000001',
   'c2000000-0000-4000-8000-000000000002',
   'espresso', 'Espresso',
   'A perfect double shot — intense, aromatic, pure',
   99, 3, 1),

  ('b1200000-0000-4000-8000-000000000002',
   'c2000000-0000-4000-8000-000000000002',
   'cappuccino', 'Cappuccino',
   'Equal parts espresso, steamed milk, and velvety micro-foam',
   149, 4, 2),

  ('b1200000-0000-4000-8000-000000000003',
   'c2000000-0000-4000-8000-000000000002',
   'flat-white', 'Flat White',
   'Ristretto shots with silky steamed milk — strong & smooth',
   159, 4, 3),

  ('b1200000-0000-4000-8000-000000000004',
   'c2000000-0000-4000-8000-000000000002',
   'latte', 'Café Latte',
   'Double espresso with generous steamed milk, lightly foamed',
   159, 4, 4),

  ('b1200000-0000-4000-8000-000000000005',
   'c2000000-0000-4000-8000-000000000002',
   'mocha', 'Mocha',
   'Espresso + rich chocolate + steamed milk — the perfect harmony',
   179, 5, 5),

  ('b1200000-0000-4000-8000-000000000006',
   'c2000000-0000-4000-8000-000000000002',
   'filter-coffee', 'Filter Coffee',
   'South Indian filter kaapi — strong decoction with frothed milk',
   79, 5, 6),

  -- ── TEAS ─────────────────────────────────────────────────────────────────
  ('b1300000-0000-4000-8000-000000000001',
   'c3000000-0000-4000-8000-000000000003',
   'masala-chai', 'Masala Chai',
   'House spice blend — cardamom, ginger, cinnamon, cloves. The real deal.',
   79, 5, 1),

  ('b1300000-0000-4000-8000-000000000002',
   'c3000000-0000-4000-8000-000000000003',
   'ginger-lemon-tea', 'Ginger Lemon Tea',
   'Fresh ginger, lemon & honey — the classic pick-me-up',
   89, 4, 2),

  ('b1300000-0000-4000-8000-000000000003',
   'c3000000-0000-4000-8000-000000000003',
   'matcha-latte', 'Matcha Latte',
   'Japanese ceremonial matcha with steamed oat milk — earthy & calming',
   199, 5, 3),

  ('b1300000-0000-4000-8000-000000000004',
   'c3000000-0000-4000-8000-000000000003',
   'black-tea', 'Black Tea',
   'Assam CTC — strong, bold, no-nonsense',
   59, 4, 4),

  -- ── SMOOTHIES ────────────────────────────────────────────────────────────
  ('b1400000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000004',
   'mango-smoothie', 'Mango Smoothie',
   'Alphonso mango + yoghurt + a pinch of cardamom — thick & tropical',
   189, 6, 1),

  ('b1400000-0000-4000-8000-000000000002',
   'c4000000-0000-4000-8000-000000000004',
   'mixed-berry-smoothie', 'Mixed Berry Smoothie',
   'Strawberry, blueberry & raspberry blended with chilled milk',
   199, 6, 2),

  ('b1400000-0000-4000-8000-000000000003',
   'c4000000-0000-4000-8000-000000000004',
   'banana-peanut-butter-smoothie', 'Banana Peanut Butter',
   'Frozen banana + natural peanut butter + oat milk — protein-packed',
   199, 6, 3),

  -- ── FOOD ─────────────────────────────────────────────────────────────────
  ('b1500000-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000005',
   'veg-club-sandwich', 'Veg Club Sandwich',
   'Triple-decker toasted sandwich with fresh veggies, cheese & herbed mayo',
   149, 8, 1),

  ('b1500000-0000-4000-8000-000000000002',
   'c5000000-0000-4000-8000-000000000005',
   'paneer-tikka-sandwich', 'Paneer Tikka Sandwich',
   'Grilled paneer tikka in a toasted brioche bun with mint chutney',
   179, 10, 2),

  ('b1500000-0000-4000-8000-000000000003',
   'c5000000-0000-4000-8000-000000000005',
   'avocado-toast', 'Avocado Toast',
   'Smashed avocado on sourdough, topped with chilli flakes & microgreens',
   199, 7, 3),

  ('b1500000-0000-4000-8000-000000000004',
   'c5000000-0000-4000-8000-000000000005',
   'banana-walnut-muffin', 'Banana Walnut Muffin',
   'House-baked, moist banana muffin with toasted walnut chunks',
   89, 2, 4),

  ('b1500000-0000-4000-8000-000000000005',
   'c5000000-0000-4000-8000-000000000005',
   'chocolate-brownie', 'Chocolate Brownie',
   'Dense, fudgy dark chocolate brownie — pairs perfectly with cold brew',
   99, 2, 5),

  ('b1500000-0000-4000-8000-000000000006',
   'c5000000-0000-4000-8000-000000000005',
   'croissant-plain', 'Butter Croissant',
   'Flaky, buttery, freshly-baked croissant — simple perfection',
   99, 2, 6),

  -- ── EXTRAS / ADD-ONS ─────────────────────────────────────────────────────
  ('b1600000-0000-4000-8000-000000000001',
   'c6000000-0000-4000-8000-000000000006',
   'extra-shot', 'Extra Espresso Shot',
   'Add an extra shot to any beverage for a stronger kick',
   40, 1, 1),

  ('b1600000-0000-4000-8000-000000000002',
   'c6000000-0000-4000-8000-000000000006',
   'oat-milk-swap', 'Oat Milk Swap',
   'Swap regular milk for creamy, barista-grade oat milk',
   40, 1, 2),

  ('b1600000-0000-4000-8000-000000000003',
   'c6000000-0000-4000-8000-000000000006',
   'flavour-syrup', 'Flavour Syrup',
   'Add a shot of syrup — Hazelnut, Caramel, Vanilla or Rose',
   30, 1, 3)

ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ✅ PART 1 COMPLETE — You should see "Success. No rows returned."
--
-- NEXT STEP: Go to Authentication → Users and create:
--   Email: admin@shelby.local    Password: password123  ← Auto Confirm: ON ✓
--   Email: barista@shelby.local  Password: password123  ← Auto Confirm: ON ✓
--
-- Then run prod_seed_part2.sql
-- ─────────────────────────────────────────────────────────────────────────────
