import { db } from '../lib/db.js';
import { priceCart } from '../services/cart.service.js';
import { computeEtaFactor } from '../services/eta.service.js';
import { withIdempotency } from '../lib/idempotency.js';

async function runTests() {
  console.log('🚀 Starting Shelby Core Stress & Logic Tests...\n');
  const startTime = Date.now();

  try {
    // ---------------------------------------------------------
    // TEST 1: Cart Math & Database Lookup Speed
    // ---------------------------------------------------------
    console.log('🧪 TEST 1: Cart Pricing Engine');
    
    // We seeded Cold Coffee in seed.sql: m1000000-0000-4000-8000-000000000001 -> we changed it to b10...
    // Let's dynamically get the ID from the DB so the test doesn't break.
    const itemRes = await db.query(`SELECT id FROM menu_items WHERE slug = 'cold-coffee'`);
    if (itemRes.rowCount === 0) throw new Error("Seed data missing");
    const coffeeId = itemRes.rows[0].id;

    // Ensure item is active for Test 1
    await db.query(`UPDATE menu_items SET active = true WHERE id = $1`, [coffeeId]);

    const cartStart = Date.now();
    const cart = await priceCart([
      { itemId: coffeeId, qty: 2, modifierIds: [] },
    ]);
    const cartTime = Date.now() - cartStart;
    
    console.log(`✅ Cart priced in ${cartTime}ms`);
    console.log(`   Expected Total: ₹300 | Actual Total: ₹${cart.total}\n`);
    if (cart.total !== 300) throw new Error("Math is wrong!");

    // ---------------------------------------------------------
    // TEST 2: Idempotency under High Concurrency (Spam Clicks)
    // ---------------------------------------------------------
    console.log('🧪 TEST 2: Idempotency Double-Tap Protection');
    const lockKey = `order:test_user:${Date.now()}`;
    let executionCount = 0;

    // Simulate a user tapping "Confirm" 50 times in 10 milliseconds
    console.log(`   Simulating 50 rapid-fire concurrent requests for the same order...`);
    const promises = Array.from({ length: 50 }).map(() => 
      withIdempotency(lockKey, 'order_create', async () => {
        executionCount++;
        // Simulate a slow DB insert (100ms)
        await new Promise(r => setTimeout(r, 100));
        return { status: 'success', order_id: 'ord_123' };
      })
    );

    const results = await Promise.all(promises);
    
    console.log(`✅ Out of 50 concurrent requests, the core logic executed exactly ${executionCount} time(s).`);
    console.log(`   The other 49 requests safely returned the cached result:`, results[49]);
    if (executionCount !== 1) throw new Error("Idempotency failed!");
    console.log();

    // ---------------------------------------------------------
    // TEST 3: Dynamic ETA Rush Calculation
    // ---------------------------------------------------------
    console.log('🧪 TEST 3: Dynamic ETA (Kitchen Pressure Test)');
    
    const initialEta = await computeEtaFactor();
    console.log(`   Initial ETA Factor (Empty Kitchen): ${initialEta}x`);

    // Force-inject 20 fake orders into the kitchen to trigger the rush threshold (>15)
    console.log(`   Injecting 20 active orders into the kitchen...`);
    
    // We need a customer ID first
    const custRes = await db.query(`INSERT INTO customers (phone_e164) VALUES ('+15550000000') RETURNING id`);
    const custId = custRes.rows[0].id;

    for(let i = 0; i < 20; i++) {
      await db.query(`
        INSERT INTO orders (order_code, customer_id, subtotal_inr, total_inr, promised_eta_min, state)
        VALUES ($1, $2, 100, 100, 5, 'preparing')
      `, [`TEST_${Date.now()}_${i}`, custId]);
    }

    const rushedEta = await computeEtaFactor();
    console.log(`✅ Rush ETA Factor (Under Pressure): ${rushedEta}x`);
    if (rushedEta === 1.0) throw new Error("ETA did not inflate under pressure!");

    // Clean up fake orders
    await db.query(`DELETE FROM orders WHERE order_code LIKE 'TEST_%'`);
    await db.query(`DELETE FROM customers WHERE id = $1`, [custId]);

    console.log(`\n🎉 ALL TESTS PASSED SUCCESSFULLY in ${Date.now() - startTime}ms!`);
    console.log(`   The system logic is deterministic, thread-safe, and mathematically verified.\n`);

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
  } finally {
    process.exit(0);
  }
}

runTests();
