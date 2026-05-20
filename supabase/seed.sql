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
