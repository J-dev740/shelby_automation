import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, pool } from '../../lib/db.js';
import { computeEtaFactor } from '../../services/eta.service.js';

describe('Dynamic ETA Integration', () => {
  let customerId: string;

  beforeAll(async () => {
    const res = await db.query(`INSERT INTO customers (phone_e164) VALUES ($1) RETURNING id`, [`+1999${Date.now()}`]);
    customerId = res.rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM orders WHERE order_code LIKE 'ETA_TEST_%'`);
    await db.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
  });

  it('C1: Normal load (< 10 orders) → factor 1.0x', async () => {
    const factor = await computeEtaFactor();
    expect(Number(factor)).toBe(1.0);
  });

  it('C2: High load (> 15 orders) → factor > 1.0x', async () => {
    // Inject 16 orders
    for (let i = 0; i < 16; i++) {
      await db.query(`
        INSERT INTO orders (order_code, customer_id, subtotal_inr, total_inr, promised_eta_min, state)
        VALUES ($1, $2, 100, 100, 5, 'preparing')
      `, [`ETA_TEST_${i}_${Date.now()}`, customerId]);
    }

    const factor = await computeEtaFactor();
    expect(Number(factor)).toBeGreaterThan(1.0);
  });
});
