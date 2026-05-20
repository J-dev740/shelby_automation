import { db, pool } from '../lib/db.js';

const CATEGORIES = [
  { id: 'c1000000-0000-4000-8000-000000000001', slug: 'coffee', name: 'Coffee', sort_order: 1 },
  { id: 'c2000000-0000-4000-8000-000000000002', slug: 'tea', name: 'Tea', sort_order: 2 }
];

const MENU_ITEMS = [
  { id: 'b1000000-0000-4000-8000-000000000001', category_id: 'c1000000-0000-4000-8000-000000000001', slug: 'cold-coffee', name: 'Cold Coffee', price_inr: 150, prep_time_min: 5, sort_order: 1 },
  { id: 'b1000000-0000-4000-8000-000000000002', category_id: 'c1000000-0000-4000-8000-000000000001', slug: 'hazelnut-cold-coffee', name: 'Hazelnut Cold Coffee', price_inr: 180, prep_time_min: 5, sort_order: 2 },
  { id: 'b2000000-0000-4000-8000-000000000001', category_id: 'c2000000-0000-4000-8000-000000000002', slug: 'masala-tea', name: 'Masala Tea', price_inr: 80, prep_time_min: 5, sort_order: 1 }
];

async function seedMenu() {
  console.log('[Seed] Starting menu seeding...');
  
  try {
    for (const cat of CATEGORIES) {
      await db.query(`
        INSERT INTO menu_categories (id, slug, name, sort_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          sort_order = EXCLUDED.sort_order;
      `, [cat.id, cat.slug, cat.name, cat.sort_order]);
      console.log(`[Seed] Upserted category: ${cat.name}`);
    }

    for (const item of MENU_ITEMS) {
      await db.query(`
        INSERT INTO menu_items (id, category_id, slug, name, price_inr, prep_time_min, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          category_id = EXCLUDED.category_id,
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          price_inr = EXCLUDED.price_inr,
          prep_time_min = EXCLUDED.prep_time_min,
          sort_order = EXCLUDED.sort_order;
      `, [item.id, item.category_id, item.slug, item.name, item.price_inr, item.prep_time_min, item.sort_order]);
      console.log(`[Seed] Upserted item: ${item.name}`);
    }

    console.log('[Seed] Menu seeding completed successfully!');
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedMenu();
