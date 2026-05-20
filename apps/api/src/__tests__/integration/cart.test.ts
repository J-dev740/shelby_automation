import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, pool } from '../../lib/db.js';
import { priceCart, ItemUnavailableError, ModifierValidationError } from '../../services/cart.service.js';

describe('Cart & Pricing Engine Integration', () => {
  let coffeeId: string;
  let inactiveItemId: string;

  beforeAll(async () => {
    console.log('[cart.test.ts] beforeAll started');
    // Get real item IDs seeded in the DB
    let res = await db.query(`SELECT id FROM menu_items WHERE slug = 'cold-coffee'`);
    if (res.rowCount === 0) throw new Error("Seed data missing: cold-coffee");
    coffeeId = res.rows[0].id;
    // Ensure it is active for the test
    await db.query(`UPDATE menu_items SET active = true WHERE id = $1`, [coffeeId]);

    // Get a category ID for the test item
    const catRes = await db.query(`SELECT id FROM menu_categories LIMIT 1`);
    if (catRes.rowCount === 0) throw new Error("Seed data missing: categories");
    const categoryId = catRes.rows[0].id;

    // Create an inactive item for testing
    res = await db.query(`
      INSERT INTO menu_items (category_id, name, slug, price_inr, active)
      VALUES ($1, 'Inactive Coffee', 'inactive-coffee', 100, false)
      ON CONFLICT (slug) DO UPDATE SET active = false
      RETURNING id
    `, [categoryId]);
    inactiveItemId = res.rows[0].id;
  });

  afterAll(async () => {
    // Clean up
    await db.query(`DELETE FROM menu_items WHERE id = $1`, [inactiveItemId]);
  });

  it('A1: Happy path: 2x Cold Coffee = ₹300', async () => {
    const cart = await priceCart([
      { itemId: coffeeId, qty: 2, modifierIds: [] }
    ]);
    expect(cart.total).toBe(300); // 150 * 2
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].qty).toBe(2);
  });

  it('A2: Empty cart returns { total: 0 }', async () => {
    const cart = await priceCart([]);
    expect(cart.total).toBe(0);
    expect(cart.lines).toHaveLength(0);
  });

  it('A3: Multi-item cart (Coffee + Tea) sums correctly', async () => {
    const teaRes = await db.query(`SELECT id FROM menu_items WHERE slug = 'masala-tea'`);
    const teaId = teaRes.rows[0].id;
    await db.query(`UPDATE menu_items SET active = true WHERE id = $1`, [teaId]);
    const cart = await priceCart([
      { itemId: coffeeId, qty: 1, modifierIds: [] },
      { itemId: teaId, qty: 1, modifierIds: [] }
    ]);
    expect(cart.total).toBe(230); // 150 + 80
  });

  it('A4: Item marked active=false mid-cart → ItemUnavailableError', async () => {
    await expect(priceCart([
      { itemId: inactiveItemId, qty: 1, modifierIds: [] }
    ])).rejects.toThrow(ItemUnavailableError);
  });

  it('A6: Modifier pricing adds delta to unit price', async () => {
    // Create a modifier group and modifier
    const groupRes = await db.query(`
      INSERT INTO modifier_groups (item_id, name, min_select, max_select)
      VALUES ($1, 'Milk Choice', 0, 1) RETURNING id
    `, [coffeeId]);
    const groupId = groupRes.rows[0].id;
    
    const modRes = await db.query(`
      INSERT INTO modifiers (group_id, name, price_delta_inr)
      VALUES ($1, 'Almond Milk', 40) RETURNING id
    `, [groupId]);
    const modId = modRes.rows[0].id;

    const cart = await priceCart([
      { itemId: coffeeId, qty: 1, modifierIds: [modId] }
    ]);
    expect(cart.total).toBe(190); // 150 + 40

    // Cleanup
    await db.query(`DELETE FROM modifiers WHERE id = $1`, [modId]);
    await db.query(`DELETE FROM modifier_groups WHERE id = $1`, [groupId]);
  });

  it('A5: Non-existent Item ID → ItemUnavailableError', async () => {
    await expect(priceCart([
      { itemId: '00000000-0000-0000-0000-000000000000', qty: 1, modifierIds: [] }
    ])).rejects.toThrow(ItemUnavailableError);
  });

  it('A7: Modifier group max_select exceeded → ModifierValidationError', async () => {
    // Create a modifier group with max_select: 1
    const groupRes = await db.query(`
      INSERT INTO modifier_groups (item_id, name, min_select, max_select)
      VALUES ($1, 'Milk Choice', 0, 1) RETURNING id
    `, [coffeeId]);
    const groupId = groupRes.rows[0].id;
    
    const mod1Res = await db.query(`
      INSERT INTO modifiers (group_id, name, price_delta_inr)
      VALUES ($1, 'Almond Milk', 40) RETURNING id
    `, [groupId]);
    const mod2Res = await db.query(`
      INSERT INTO modifiers (group_id, name, price_delta_inr)
      VALUES ($1, 'Oat Milk', 50) RETURNING id
    `, [groupId]);

    await expect(priceCart([
      { itemId: coffeeId, qty: 1, modifierIds: [mod1Res.rows[0].id, mod2Res.rows[0].id] }
    ])).rejects.toThrow(ModifierValidationError);

    // Cleanup
    await db.query(`DELETE FROM modifiers WHERE group_id = $1`, [groupId]);
    await db.query(`DELETE FROM modifier_groups WHERE id = $1`, [groupId]);
  });

  it('A8: Inactive modifier → ItemUnavailableError', async () => {
    const groupRes = await db.query(`
      INSERT INTO modifier_groups (item_id, name, min_select, max_select)
      VALUES ($1, 'Inactive Group', 0, 1) RETURNING id
    `, [coffeeId]);
    const groupId = groupRes.rows[0].id;
    
    const modRes = await db.query(`
      INSERT INTO modifiers (group_id, name, price_delta_inr, active)
      VALUES ($1, 'Inactive Mod', 0, false) RETURNING id
    `, [groupId]);
    const modId = modRes.rows[0].id;

    await expect(priceCart([
      { itemId: coffeeId, qty: 1, modifierIds: [modId] }
    ])).rejects.toThrow(ItemUnavailableError);

    // Cleanup
    await db.query(`DELETE FROM modifiers WHERE id = $1`, [modId]);
    await db.query(`DELETE FROM modifier_groups WHERE id = $1`, [groupId]);
  });

  it('A9: prep_time_min returns the MAX across all items', async () => {
    const cart = await priceCart([
      { itemId: coffeeId, qty: 1, modifierIds: [] }
    ]);
    expect(cart.maxPrepTimeMin).toBe(5); // Cold Coffee prep_time is 5
  });
});
