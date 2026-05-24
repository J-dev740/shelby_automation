import { db, pool } from '../lib/db.js';

const CATEGORIES = [
  { id: 'c1000000-0000-4000-8000-000000000001', slug: 'milk-tea', name: 'Milk Tea', sort_order: 1 },
  { id: 'c2000000-0000-4000-8000-000000000002', slug: 'black-tea', name: 'Black Tea', sort_order: 2 },
  { id: 'c3000000-0000-4000-8000-000000000003', slug: 'milk-coffee', name: 'Milk Coffee', sort_order: 3 },
  { id: 'c4000000-0000-4000-8000-000000000004', slug: 'black-coffee', name: 'Black Coffee', sort_order: 4 },
  { id: 'c5000000-0000-4000-8000-000000000005', slug: 'special', name: 'Special', sort_order: 5 },
  { id: 'c6000000-0000-4000-8000-000000000006', slug: 'cold-coffee', name: 'Cold Coffee', sort_order: 6 },
  { id: 'c7000000-0000-4000-8000-000000000007', slug: 'mojito', name: 'Mojito', sort_order: 7 },
];

const MENU_ITEMS = [
  // Milk Tea
  { id: 'b1000000-0000-4000-8000-000000000001', category_id: 'c1000000-0000-4000-8000-000000000001', slug: 'rose-tea', name: 'Rose Tea', price_inr: 40, prep_time_min: 3, sort_order: 1 },
  { id: 'b1000000-0000-4000-8000-000000000002', category_id: 'c1000000-0000-4000-8000-000000000001', slug: 'masala-tea', name: 'Masala Tea', price_inr: 40, prep_time_min: 4, sort_order: 2 },
  
  // Black Tea
  { id: 'b2000000-0000-4000-8000-000000000001', category_id: 'c2000000-0000-4000-8000-000000000002', slug: 'lemon-honey', name: 'Lemon Honey Tea', price_inr: 35, prep_time_min: 3, sort_order: 1 },

  // Milk Coffee
  { id: 'b3000000-0000-4000-8000-000000000001', category_id: 'c3000000-0000-4000-8000-000000000003', slug: 'shelby-signature', name: 'Shelby Signature Coffee', price_inr: 50, prep_time_min: 4, sort_order: 1 },
  { id: 'b3000000-0000-4000-8000-000000000002', category_id: 'c3000000-0000-4000-8000-000000000003', slug: 'hazelnut-coffee', name: 'Hazelnut Coffee', price_inr: 70, prep_time_min: 4, sort_order: 2 },

  // Black Coffee
  { id: 'b4000000-0000-4000-8000-000000000001', category_id: 'c4000000-0000-4000-8000-000000000004', slug: 'black-coffee', name: 'Black Coffee', price_inr: 25, prep_time_min: 3, sort_order: 1 },

  // Special
  { id: 'b5000000-0000-4000-8000-000000000001', category_id: 'c5000000-0000-4000-8000-000000000005', slug: 'hot-chocolate', name: 'Hot Chocolate', price_inr: 80, prep_time_min: 5, sort_order: 1 },
  
  // Cold Coffee
  { id: 'b6000000-0000-4000-8000-000000000001', category_id: 'c6000000-0000-4000-8000-000000000006', slug: 'premium-cold-coffee', name: 'Premium Cold Coffee', price_inr: 150, prep_time_min: 5, sort_order: 1 },
  { id: 'b6000000-0000-4000-8000-000000000002', category_id: 'c6000000-0000-4000-8000-000000000006', slug: 'irish-cold-coffee', name: 'Irish Cold Coffee', price_inr: 180, prep_time_min: 5, sort_order: 2 },

  // Mojito
  { id: 'b7000000-0000-4000-8000-000000000001', category_id: 'c7000000-0000-4000-8000-000000000007', slug: 'watermelon-mojito', name: 'Watermelon Mojito', price_inr: 90, prep_time_min: 4, sort_order: 1 },
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
